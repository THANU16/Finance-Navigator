import { Router } from "express";
import { requireAuth } from "../lib/auth";
import { getPortfolioMetrics, getPortfolioTotalValue } from "../lib/portfolio";
import { db, accountsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();
router.use(requireAuth);

/**
 * GET /portfolio/summary
 * Returns the full portfolio breakdown computed fresh from transactions + valuations.
 * Use this as the "Recalculate Portfolio" trigger — every call recomputes from source data.
 */
router.get("/summary", async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const metrics = await getPortfolioMetrics(userId);

  const accounts = await db
    .select()
    .from(accountsTable)
    .where(and(eq(accountsTable.userId, userId), eq(accountsTable.isActive, true)));

  const totalCashValue = accounts.reduce((s, a) => s + Number(a.balance), 0);
  const totalPortfolioValue = metrics.totalCurrentValue + totalCashValue;

  res.json({
    totalInvested: metrics.totalInvested,
    totalCurrentValue: metrics.totalCurrentValue,
    totalReturn: metrics.totalReturn,
    totalReturnPercent: metrics.totalReturnPercent,
    cagr: metrics.cagr,
    firstInvestmentDate: metrics.firstInvestmentDate,
    totalCashValue,
    totalPortfolioValue,
    categoryMetrics: metrics.categoryMetrics,
    assets: metrics.assets.map((a) => ({
      assetId: a.assetId,
      assetName: a.assetName,
      category: a.category,
      subCategory: a.subCategory,
      investedAmount: a.investedAmount,
      currentValue: a.currentValue,
      returnAmount: a.returnAmount,
      returnPercent: a.returnPercent,
      actualPercent: a.actualPercent,
      targetPercent: a.targetPercent,
      currency: a.currency,
    })),
  });
});

/**
 * POST /portfolio/recalculate
 * Alias for GET /summary — forces a fresh recomputation and returns updated metrics.
 */
router.post("/recalculate", async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const metrics = await getPortfolioMetrics(userId);

  const accounts = await db
    .select()
    .from(accountsTable)
    .where(and(eq(accountsTable.userId, userId), eq(accountsTable.isActive, true)));

  const totalCashValue = accounts.reduce((s, a) => s + Number(a.balance), 0);
  const totalPortfolioValue = metrics.totalCurrentValue + totalCashValue;

  res.json({
    recalculatedAt: new Date().toISOString(),
    totalInvested: metrics.totalInvested,
    totalCurrentValue: metrics.totalCurrentValue,
    totalReturn: metrics.totalReturn,
    totalReturnPercent: metrics.totalReturnPercent,
    cagr: metrics.cagr,
    firstInvestmentDate: metrics.firstInvestmentDate,
    totalCashValue,
    totalPortfolioValue,
    categoryMetrics: metrics.categoryMetrics,
    assets: metrics.assets.map((a) => ({
      assetId: a.assetId,
      assetName: a.assetName,
      category: a.category,
      subCategory: a.subCategory,
      investedAmount: a.investedAmount,
      currentValue: a.currentValue,
      returnAmount: a.returnAmount,
      returnPercent: a.returnPercent,
      actualPercent: a.actualPercent,
      targetPercent: a.targetPercent,
      currency: a.currency,
    })),
  });
});

export default router;
