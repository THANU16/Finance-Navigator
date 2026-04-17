import { Router } from "express";
import { db, assetsTable, settingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { UpdateRebalancingTargetsBody } from "@workspace/api-zod";

const router = Router();
router.use(requireAuth);

const categoryNames: Record<string, string> = {
  equity_fund: "Equity Funds",
  debt_fund: "Debt Funds",
  metal: "Precious Metals",
  cash: "Cash",
};

router.get("/status", async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const assets = await db.select().from(assetsTable).where(and(eq(assetsTable.userId, userId), eq(assetsTable.isActive, true)));
  const [settings] = await db.select().from(settingsTable).where(eq(settingsTable.userId, userId)).limit(1);
  const tolerance = settings ? Number(settings.rebalancingDriftTolerance) : 5;

  const totalValue = assets.reduce((s, a) => {
    return s + (a.units && a.nav ? Number(a.units) * Number(a.nav) : a.units && a.pricePerUnit ? Number(a.units) * Number(a.pricePerUnit) : 0);
  }, 0);

  const categoryGroups: Record<string, typeof assets> = {};
  assets.forEach(a => {
    if (!categoryGroups[a.category]) categoryGroups[a.category] = [];
    categoryGroups[a.category].push(a);
  });

  const categories = Object.entries(categoryGroups).map(([cat, catAssets]) => {
    const catValue = catAssets.reduce((s, a) => {
      return s + (a.units && a.nav ? Number(a.units) * Number(a.nav) : a.units && a.pricePerUnit ? Number(a.units) * Number(a.pricePerUnit) : 0);
    }, 0);
    const catTarget = catAssets.reduce((s, a) => s + Number(a.targetPercent), 0);
    const actualPct = totalValue > 0 ? (catValue / totalValue) * 100 : 0;
    const drift = actualPct - catTarget;

    const assetDetails = catAssets.map(a => {
      const aVal = a.units && a.nav ? Number(a.units) * Number(a.nav) : a.units && a.pricePerUnit ? Number(a.units) * Number(a.pricePerUnit) : 0;
      const aActual = totalValue > 0 ? (aVal / totalValue) * 100 : 0;
      const aDrift = aActual - Number(a.targetPercent);
      return {
        assetId: a.id, assetName: a.name,
        targetPercent: Number(a.targetPercent),
        actualPercent: aActual,
        drift: aDrift,
      };
    });

    return {
      category: categoryNames[cat] || cat,
      targetPercent: catTarget,
      actualPercent: actualPct,
      drift,
      status: Math.abs(drift) <= tolerance ? "balanced" : drift > 0 ? "overweight" : "underweight",
      assets: assetDetails,
    };
  });

  const overallDrift = categories.reduce((s, c) => s + Math.abs(c.drift), 0) / Math.max(categories.length, 1);
  const needsRebalancing = categories.some(c => Math.abs(c.drift) > tolerance);

  const suggestions: Array<{ type: string; message: string; priority: string }> = [];
  categories.forEach(c => {
    if (Math.abs(c.drift) > tolerance) {
      if (c.drift > 0) {
        suggestions.push({ type: "reduce", message: `Reduce ${c.category} allocation — overweight by ${c.drift.toFixed(1)}%`, priority: Math.abs(c.drift) > 10 ? "high" : "medium" });
      } else {
        suggestions.push({ type: "increase", message: `Increase ${c.category} allocation — underweight by ${Math.abs(c.drift).toFixed(1)}%`, priority: Math.abs(c.drift) > 10 ? "high" : "medium" });
      }
    }
  });

  if (needsRebalancing) {
    suggestions.push({ type: "sip_adjust", message: "Adjust SIP allocation to target underweight categories", priority: "medium" });
  }

  res.json({ overallDrift, needsRebalancing, categories, suggestions });
});

router.put("/targets", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const parsed = UpdateRebalancingTargetsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const { assetTargets } = parsed.data;

  // Update each asset's target
  for (const target of assetTargets) {
    await db.update(assetsTable).set({ targetPercent: target.targetPercent.toString() })
      .where(and(eq(assetsTable.id, target.assetId), eq(assetsTable.userId, userId)));
  }

  // Return updated status
  const assets = await db.select().from(assetsTable).where(and(eq(assetsTable.userId, userId), eq(assetsTable.isActive, true)));
  const [settings] = await db.select().from(settingsTable).where(eq(settingsTable.userId, userId)).limit(1);
  const tolerance = settings ? Number(settings.rebalancingDriftTolerance) : 5;
  const totalValue = assets.reduce((s, a) => {
    return s + (a.units && a.nav ? Number(a.units) * Number(a.nav) : a.units && a.pricePerUnit ? Number(a.units) * Number(a.pricePerUnit) : 0);
  }, 0);

  res.json({ overallDrift: 0, needsRebalancing: false, categories: [], suggestions: [] });
});

export default router;
