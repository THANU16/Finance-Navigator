import { Router } from "express";
import { db, assetsTable, settingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { UpdateRebalancingTargetsBody } from "@workspace/api-zod";
import { getPortfolioMetrics } from "../lib/portfolio";

const router = Router();
router.use(requireAuth);

router.get("/status", async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const [portfolio, settingsRows] = await Promise.all([
    getPortfolioMetrics(userId),
    db.select().from(settingsTable).where(eq(settingsTable.userId, userId)).limit(1),
  ]);

  const settings = settingsRows[0];
  const tolerance = settings ? Number(settings.rebalancingDriftTolerance) : 5;
  const totalValue = portfolio.totalCurrentValue;

  // Group assets by category using accurate currentValue from portfolio service
  const categoryGroupMap = new Map<string, typeof portfolio.assets>();
  for (const a of portfolio.assets) {
    if (!categoryGroupMap.has(a.category)) categoryGroupMap.set(a.category, []);
    categoryGroupMap.get(a.category)!.push(a);
  }

  const CATEGORY_NAMES: Record<string, string> = {
    equity_fund: "Equity Funds",
    debt_fund: "Debt Funds",
    metal: "Precious Metals",
    cash: "Cash",
  };

  const categories = Array.from(categoryGroupMap.entries()).map(([cat, catAssets]) => {
    const catValue = catAssets.reduce((s, a) => s + a.currentValue, 0);
    const catTarget = catAssets.reduce((s, a) => s + a.targetPercent, 0);
    const actualPct = totalValue > 0 ? (catValue / totalValue) * 100 : 0;
    const drift = actualPct - catTarget;

    const assetDetails = catAssets.map((a) => {
      const aActual = totalValue > 0 ? (a.currentValue / totalValue) * 100 : 0;
      const aDrift = aActual - a.targetPercent;
      return {
        assetId: a.assetId,
        assetName: a.assetName,
        targetPercent: a.targetPercent,
        actualPercent: aActual,
        drift: aDrift,
        currentValue: a.currentValue,
        investedValue: a.investedAmount,
      };
    });

    return {
      category: CATEGORY_NAMES[cat] ?? cat,
      targetPercent: catTarget,
      actualPercent: actualPct,
      drift,
      status: Math.abs(drift) <= tolerance ? "balanced" : drift > 0 ? "overweight" : "underweight",
      assets: assetDetails,
    };
  });

  const overallDrift = categories.reduce((s, c) => s + Math.abs(c.drift), 0) / Math.max(categories.length, 1);
  const needsRebalancing = categories.some((c) => Math.abs(c.drift) > tolerance);

  const suggestions: Array<{ type: string; message: string; priority: string }> = [];
  categories.forEach((c) => {
    if (Math.abs(c.drift) > tolerance) {
      if (c.drift > 0) {
        suggestions.push({
          type: "reduce",
          message: `Reduce ${c.category} allocation — overweight by ${c.drift.toFixed(1)}%`,
          priority: Math.abs(c.drift) > 10 ? "high" : "medium",
        });
      } else {
        suggestions.push({
          type: "increase",
          message: `Increase ${c.category} allocation — underweight by ${Math.abs(c.drift).toFixed(1)}%`,
          priority: Math.abs(c.drift) > 10 ? "high" : "medium",
        });
      }
    }
  });

  if (needsRebalancing) {
    suggestions.push({
      type: "sip_adjust",
      message: "Adjust SIP allocation to target underweight categories",
      priority: "medium",
    });
  }

  res.json({ totalPortfolioValue: totalValue, overallDrift, needsRebalancing, categories, suggestions });
});

router.put("/targets", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const parsed = UpdateRebalancingTargetsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { assetTargets } = parsed.data;
  for (const target of assetTargets) {
    await db
      .update(assetsTable)
      .set({ targetPercent: target.targetPercent.toString() })
      .where(and(eq(assetsTable.id, target.assetId), eq(assetsTable.userId, userId)));
  }

  // Return updated full rebalancing status
  const [portfolio, settingsRows] = await Promise.all([
    getPortfolioMetrics(userId),
    db.select().from(settingsTable).where(eq(settingsTable.userId, userId)).limit(1),
  ]);

  const settings = settingsRows[0];
  const tolerance = settings ? Number(settings.rebalancingDriftTolerance) : 5;
  const totalValue = portfolio.totalCurrentValue;

  const CATEGORY_NAMES: Record<string, string> = {
    equity_fund: "Equity Funds",
    debt_fund: "Debt Funds",
    metal: "Precious Metals",
    cash: "Cash",
  };

  const categoryGroupMap = new Map<string, typeof portfolio.assets>();
  for (const a of portfolio.assets) {
    if (!categoryGroupMap.has(a.category)) categoryGroupMap.set(a.category, []);
    categoryGroupMap.get(a.category)!.push(a);
  }

  const categories = Array.from(categoryGroupMap.entries()).map(([cat, catAssets]) => {
    const catValue = catAssets.reduce((s, a) => s + a.currentValue, 0);
    const catTarget = catAssets.reduce((s, a) => s + a.targetPercent, 0);
    const actualPct = totalValue > 0 ? (catValue / totalValue) * 100 : 0;
    const drift = actualPct - catTarget;
    return {
      category: CATEGORY_NAMES[cat] ?? cat,
      targetPercent: catTarget,
      actualPercent: actualPct,
      drift,
      status: Math.abs(drift) <= tolerance ? "balanced" : drift > 0 ? "overweight" : "underweight",
      assets: catAssets.map((a) => ({
        assetId: a.assetId,
        assetName: a.assetName,
        targetPercent: a.targetPercent,
        actualPercent: totalValue > 0 ? (a.currentValue / totalValue) * 100 : 0,
        drift: (totalValue > 0 ? (a.currentValue / totalValue) * 100 : 0) - a.targetPercent,
      })),
    };
  });

  const overallDrift = categories.reduce((s, c) => s + Math.abs(c.drift), 0) / Math.max(categories.length, 1);
  const needsRebalancing = categories.some((c) => Math.abs(c.drift) > tolerance);

  res.json({ overallDrift, needsRebalancing, categories, suggestions: [] });
});

export default router;
