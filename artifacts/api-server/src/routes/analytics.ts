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

  // SIP current value = investedAmount * (portfolio return ratio), pro-rated to SIP portion
  // Use the actual portfolio ratio, not an approximation
  const portfolioReturnRatio = portfolio.totalInvested > 0 ? portfolio.totalCurrentValue / portfolio.totalInvested : 1;
  const sipCurrentValue = sipTotalInvested * portfolioReturnRatio;
  const sipReturn = sipCurrentValue - sipTotalInvested;

  res.json({
    totalReturn: portfolio.totalReturn,
    totalReturnPercent: portfolio.totalReturnPercent,
    cagr: portfolio.cagr,
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

  // Compute invested amount from transactions
  const allTxs = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, userId));

  const investedByAsset = new Map<number, number>();
  for (const tx of allTxs) {
    if (!tx.assetId) continue;
    const prev = investedByAsset.get(tx.assetId) ?? 0;
    if (tx.type === "invest" || tx.type === "sip") {
      investedByAsset.set(tx.assetId, prev + Number(tx.amount));
    } else if (tx.type === "redeem") {
      investedByAsset.set(tx.assetId, Math.max(0, prev - Number(tx.amount)));
    }
  }
  const totalInvested = Array.from(investedByAsset.values()).reduce((s, v) => s + v, 0);

  // Group valuations by assetId for forward-fill approach
  const valsByAsset = new Map<number, Array<{ date: string; value: number }>>();
  for (const v of allVals) {
    if (!valsByAsset.has(v.assetId)) valsByAsset.set(v.assetId, []);
    valsByAsset.get(v.assetId)!.push({ date: v.date, value: Number(v.value) });
  }

  // Collect all unique dates
  const allDates = [...new Set(allVals.map((v) => v.date))].sort();

  // For each date, compute total portfolio value (sum of each asset's latest valuation on or before that date)
  const growthData = allDates.map((date) => {
    let totalValue = 0;
    for (const [, vals] of valsByAsset) {
      // Find latest val on or before this date
      const relevant = vals.filter((v) => v.date <= date);
      if (relevant.length > 0) {
        totalValue += relevant[relevant.length - 1].value;
      }
    }
    return { date, totalValue, invested: totalInvested };
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
    res.json([{ date: now.toISOString().split("T")[0], totalValue: portfolio.totalCurrentValue, invested: portfolio.totalInvested }]);
    return;
  }

  res.json(filtered);
});

export default router;
