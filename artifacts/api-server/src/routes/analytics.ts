import { Router } from "express";
import { db, assetsTable, valuationsTable, sipHistoryTable, transactionsTable } from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { getPortfolioMetrics } from "../lib/portfolio";

const router = Router();
router.use(requireAuth);

router.get("/performance", async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const [portfolio, sipHistory] = await Promise.all([
    getPortfolioMetrics(userId),
    db.select().from(sipHistoryTable).where(eq(sipHistoryTable.userId, userId)),
  ]);

  // SIP invested = sum of all SIP execution amounts
  const sipTotalInvested = sipHistory.reduce((s, h) => s + Number(h.totalAmount), 0);
  const investedInAssets = portfolio.assets.reduce((s, a) => s + a.investedAmount, 0);

  // SIP current value = investedAmount * (portfolio return ratio), pro-rated to SIP portion
  // Use the actual portfolio ratio, not an approximation
  const portfolioReturnRatio = investedInAssets > 0 ? portfolio.totalCurrentValue / investedInAssets : 1;
  const sipCurrentValue = sipTotalInvested * portfolioReturnRatio;
  const sipReturn = sipCurrentValue - sipTotalInvested;

  res.json({
    totalReturn: portfolio.totalReturn,
    totalReturnPercent: portfolio.totalReturnPercent,
    cagr: portfolio.cagr,
    xirr: portfolio.xirr,
    categoryPerformance: portfolio.categoryMetrics.map((c) => ({
      category: c.category,
      invested: c.investedAmount,
      currentValue: c.currentValue,
      returnAmount: c.returnAmount,
      returnPercent: c.returnPercent,
    })),
    drawdown: Math.min(0, portfolio.totalReturnPercent),
    sipTotalInvested,
    sipCurrentValue,
    sipReturn,
  });
});

router.get("/growth", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const period = (req.query.period as string) || "all";

  const assets = await db
    .select()
    .from(assetsTable)
    .where(and(eq(assetsTable.userId, userId), eq(assetsTable.isActive, true)));

  const investmentAssets = assets.filter((a) => a.category !== "cash");
  const assetIds = investmentAssets.map((a) => a.id);
  const assetIdSet = new Set(assetIds);

  if (assetIds.length === 0) {
    res.json([]);
    return;
  }

  // Get all valuations for these assets, ordered by date
  const allVals = await db
    .select()
    .from(valuationsTable)
    .where(inArray(valuationsTable.assetId, assetIds))
    .orderBy(valuationsTable.date);

  // Build invested deltas by date from transactions (invested changes over time).
  const allTxs = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, userId));

  const investedDeltaByDate = new Map<string, number>();
  for (const tx of allTxs) {
    if (!tx.assetId || !assetIdSet.has(tx.assetId)) continue;
    const prev = investedDeltaByDate.get(tx.date) ?? 0;
    if (tx.type === "invest" || tx.type === "sip") {
      investedDeltaByDate.set(tx.date, prev + Number(tx.amount));
    } else if (tx.type === "redeem") {
      investedDeltaByDate.set(tx.date, prev - Number(tx.amount));
    }
  }

  // Group valuations by assetId for forward-fill approach.
  const valsByAsset = new Map<number, Array<{ date: string; value: number }>>();
  for (const v of allVals) {
    if (!valsByAsset.has(v.assetId)) valsByAsset.set(v.assetId, []);
    valsByAsset.get(v.assetId)!.push({ date: v.date, value: Number(v.value) });
  }

  // Use union of valuation dates and transaction dates so both lines can change on their own dates.
  const allDates = [...new Set([...allVals.map((v) => v.date), ...investedDeltaByDate.keys()])].sort();

  if (allDates.length === 0) {
    res.json([]);
    return;
  }

  // Keep a moving pointer per asset for O(N) forward-fill over sorted dates.
  const valueIndexByAsset = new Map<number, number>();
  const currentValueByAsset = new Map<number, number>();
  for (const assetId of assetIds) {
    valueIndexByAsset.set(assetId, 0);
    currentValueByAsset.set(assetId, 0);
  }

  // For each date, compute portfolio value and cumulative invested.
  let cumulativeInvested = 0;
  const growthData = allDates.map((date) => {
    cumulativeInvested += investedDeltaByDate.get(date) ?? 0;

    let totalValue = 0;
    for (const assetId of assetIds) {
      const vals = valsByAsset.get(assetId) ?? [];
      let idx = valueIndexByAsset.get(assetId) ?? 0;

      while (idx < vals.length && vals[idx].date <= date) {
        currentValueByAsset.set(assetId, vals[idx].value);
        idx += 1;
      }

      valueIndexByAsset.set(assetId, idx);
      totalValue += currentValueByAsset.get(assetId) ?? 0;
    }

    return {
      date,
      totalValue,
      invested: Math.max(0, cumulativeInvested),
    };
  });

  // Filter by period
  const now = new Date();
  const periodMap: Record<string, number> = { "1m": 30, "3m": 90, "6m": 180, "1y": 365 };
  const days = periodMap[period] ?? 99999;
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const filtered = period === "all" ? growthData : growthData.filter((d) => d.date >= cutoff);

  if (filtered.length === 0) {
    // Return current snapshot
    const portfolio = await getPortfolioMetrics(userId);
    const investedInAssets = portfolio.assets.reduce((s, a) => s + a.investedAmount, 0);
    res.json([{ date: now.toISOString().split("T")[0], totalValue: portfolio.totalCurrentValue, invested: investedInAssets }]);
    return;
  }

  res.json(filtered);
});

export default router;
