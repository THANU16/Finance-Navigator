import { Router } from "express";
import { db, assetsTable, valuationsTable, sipHistoryTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();
router.use(requireAuth);

router.get("/performance", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const period = (req.query.period as string) || "all";

  const assets = await db.select().from(assetsTable).where(and(eq(assetsTable.userId, userId), eq(assetsTable.isActive, true)));

  const totalInvested = assets.reduce((s, a) => s + Number(a.investedValue), 0);
  const totalCurrent = assets.reduce((s, a) => {
    return s + (a.units && a.nav ? Number(a.units) * Number(a.nav) : a.units && a.pricePerUnit ? Number(a.units) * Number(a.pricePerUnit) : 0);
  }, 0);
  const totalReturn = totalCurrent - totalInvested;
  const totalReturnPercent = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;

  // CAGR — simplified, based on oldest valuation
  let cagr: number | null = null;
  const allVals = await db.select().from(valuationsTable)
    .where(eq(valuationsTable.assetId, assets[0]?.id ?? 0))
    .orderBy(valuationsTable.date)
    .limit(1);
  if (allVals.length > 0 && totalInvested > 0) {
    const years = (new Date().getTime() - new Date(allVals[0].date).getTime()) / (1000 * 60 * 60 * 24 * 365);
    if (years > 0.1) {
      cagr = (Math.pow(totalCurrent / totalInvested, 1 / years) - 1) * 100;
    }
  }

  const categoryMap: Record<string, string> = {
    equity_fund: "Equity Funds",
    debt_fund: "Debt Funds",
    metal: "Precious Metals",
  };

  const categoryPerformance = ["equity_fund", "debt_fund", "metal"].map(cat => {
    const catAssets = assets.filter(a => a.category === cat);
    const invested = catAssets.reduce((s, a) => s + Number(a.investedValue), 0);
    const current = catAssets.reduce((s, a) => {
      return s + (a.units && a.nav ? Number(a.units) * Number(a.nav) : a.units && a.pricePerUnit ? Number(a.units) * Number(a.pricePerUnit) : 0);
    }, 0);
    return {
      category: categoryMap[cat],
      invested,
      currentValue: current,
      returnAmount: current - invested,
      returnPercent: invested > 0 ? ((current - invested) / invested) * 100 : 0,
    };
  });

  // SIP performance
  const sipHistory = await db.select().from(sipHistoryTable).where(eq(sipHistoryTable.userId, userId));
  const sipTotalInvested = sipHistory.reduce((s, h) => s + Number(h.totalAmount), 0);
  const sipReturn = totalReturn * 0.7; // Approximate

  res.json({
    totalReturn,
    totalReturnPercent,
    cagr,
    categoryPerformance,
    drawdown: Math.min(0, totalReturnPercent),
    sipTotalInvested,
    sipCurrentValue: sipTotalInvested + sipReturn,
    sipReturn,
  });
});

router.get("/growth", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const period = (req.query.period as string) || "all";

  const assets = await db.select().from(assetsTable).where(eq(assetsTable.userId, userId));

  // Get all valuations grouped by date
  const allVals: { date: string; value: number }[] = [];
  for (const asset of assets) {
    const vals = await db.select().from(valuationsTable).where(eq(valuationsTable.assetId, asset.id)).orderBy(valuationsTable.date);
    vals.forEach(v => allVals.push({ date: v.date, value: Number(v.value) }));
  }

  // Group by date
  const dateMap = new Map<string, number>();
  allVals.forEach(v => {
    dateMap.set(v.date, (dateMap.get(v.date) || 0) + v.value);
  });

  const totalInvested = assets.reduce((s, a) => s + Number(a.investedValue), 0);
  const sortedDates = Array.from(dateMap.keys()).sort();

  // Filter by period
  const now = new Date();
  const periodMap: Record<string, number> = { "1m": 30, "3m": 90, "6m": 180, "1y": 365 };
  const days = periodMap[period] || 99999;
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const filteredDates = period === "all" ? sortedDates : sortedDates.filter(d => d >= cutoff);

  if (filteredDates.length === 0) {
    // Return current snapshot
    const totalCurrent = assets.reduce((s, a) => {
      return s + (a.units && a.nav ? Number(a.units) * Number(a.nav) : a.units && a.pricePerUnit ? Number(a.units) * Number(a.pricePerUnit) : 0);
    }, 0);
    res.json([{ date: now.toISOString().split("T")[0], totalValue: totalCurrent, invested: totalInvested }]);
    return;
  }

  const result = filteredDates.map(date => ({
    date,
    totalValue: dateMap.get(date) || 0,
    invested: totalInvested,
  }));

  res.json(result);
});

export default router;
