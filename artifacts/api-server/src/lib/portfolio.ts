/**
 * PortfolioCalculationService — Single Source of Truth
 *
 * Rules:
 *   investedAmount  = SUM(invest + sip transactions) - SUM(redeem transactions) per asset
 *   currentValue    = latest valuation entry (manual snapshot) — falls back to 0 if no valuation
 *   return          = currentValue - investedAmount
 *   returnPercent   = (return / investedAmount) * 100
 *   CAGR            = (currentValue / investedAmount)^(1/years) - 1, years from first invest tx
 *
 * ALL pages (dashboard, analytics, asset detail, rebalancing) must use this service.
 * No other file should re-implement these calculations.
 */

import { db, assetsTable, valuationsTable, transactionsTable, accountsTable } from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";

export interface AssetMetrics {
  assetId: number;
  assetName: string;
  category: string;
  subCategory: string | null;
  investedAmount: number;
  currentValue: number;
  returnAmount: number;
  returnPercent: number;
  /** Allocation % = asset currentValue / total portfolio investment currentValue */
  actualPercent: number;
  targetPercent: number;
  currency: string;
  isActive: boolean;
}

export interface CategoryMetrics {
  category: string;
  investedAmount: number;
  currentValue: number;
  returnAmount: number;
  returnPercent: number;
  assetCount: number;
}

export interface PortfolioMetrics {
  assets: AssetMetrics[];
  totalInvested: number;
  totalCurrentValue: number;
  totalReturn: number;
  totalReturnPercent: number;
  cagr: number | null;
  firstInvestmentDate: string | null;
  categoryMetrics: CategoryMetrics[];
}

const INVEST_TYPES = new Set(["invest", "sip"]);
const REDEEM_TYPES = new Set(["redeem"]);

const CATEGORY_NAMES: Record<string, string> = {
  equity_fund: "Equity Funds",
  debt_fund: "Debt Funds",
  metal: "Precious Metals",
  cash: "Cash",
};

export async function getPortfolioMetrics(userId: number): Promise<PortfolioMetrics> {
  const assets = await db
    .select()
    .from(assetsTable)
    .where(and(eq(assetsTable.userId, userId), eq(assetsTable.isActive, true)));

  const investmentAssets = assets.filter((a) => a.category !== "cash");

  if (investmentAssets.length === 0) {
    return {
      assets: [],
      totalInvested: 0,
      totalCurrentValue: 0,
      totalReturn: 0,
      totalReturnPercent: 0,
      cagr: null,
      firstInvestmentDate: null,
      categoryMetrics: [],
    };
  }

  const assetIds = investmentAssets.map((a) => a.id);

  // Batch: all user transactions (for invested amount computation + first date)
  const allTxs = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, userId));

  // Batch: all valuations for these assets, ordered latest-first
  const allVals = await db
    .select()
    .from(valuationsTable)
    .where(inArray(valuationsTable.assetId, assetIds))
    .orderBy(desc(valuationsTable.date));

  // Build: assetId -> invested amount (from transactions)
  const investedMap = new Map<number, number>();
  let firstInvestDate: string | null = null;

  for (const tx of allTxs) {
    if (!tx.assetId) continue;
    const prev = investedMap.get(tx.assetId) ?? 0;
    if (INVEST_TYPES.has(tx.type)) {
      investedMap.set(tx.assetId, prev + Number(tx.amount));
      // Track earliest invest/sip transaction
      if (!firstInvestDate || tx.date < firstInvestDate) {
        firstInvestDate = tx.date;
      }
    } else if (REDEEM_TYPES.has(tx.type)) {
      investedMap.set(tx.assetId, Math.max(0, prev - Number(tx.amount)));
    }
  }

  // Build: assetId -> latest valuation value (first seen = latest because ordered desc)
  const latestValMap = new Map<number, number>();
  for (const v of allVals) {
    if (!latestValMap.has(v.assetId)) {
      latestValMap.set(v.assetId, Number(v.value));
    }
  }

  // Compute per-asset metrics (actualPercent filled in after totalCurrentValue is known)
  const rawMetrics = investmentAssets.map((asset) => {
    const investedAmount = investedMap.get(asset.id) ?? 0;
    const currentValue = latestValMap.get(asset.id) ?? 0;
    const returnAmount = currentValue - investedAmount;
    const returnPercent = investedAmount > 0 ? (returnAmount / investedAmount) * 100 : 0;
    return {
      assetId: asset.id,
      assetName: asset.name,
      category: asset.category,
      subCategory: asset.subCategory,
      investedAmount,
      currentValue,
      returnAmount,
      returnPercent,
      targetPercent: Number(asset.targetPercent),
      currency: asset.currency ?? "LKR",
      isActive: asset.isActive ?? true,
    };
  });

  const totalInvested = rawMetrics.reduce((s, a) => s + a.investedAmount, 0);
  const totalCurrentValue = rawMetrics.reduce((s, a) => s + a.currentValue, 0);

  // Compute actualPercent now that totalCurrentValue is known
  const assetMetrics: AssetMetrics[] = rawMetrics.map((a) => ({
    ...a,
    actualPercent: totalCurrentValue > 0 ? (a.currentValue / totalCurrentValue) * 100 : 0,
  }));
  const totalReturn = totalCurrentValue - totalInvested;
  const totalReturnPercent = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;

  // CAGR: (currentValue / investedAmount)^(1/years) - 1
  let cagr: number | null = null;
  if (firstInvestDate && totalInvested > 0 && totalCurrentValue > 0) {
    const years =
      (Date.now() - new Date(firstInvestDate).getTime()) /
      (1000 * 60 * 60 * 24 * 365.25);
    if (years >= 0.1) {
      cagr = (Math.pow(totalCurrentValue / totalInvested, 1 / years) - 1) * 100;
    }
  }

  // Category-level rollup
  const categoryMap = new Map<string, CategoryMetrics>();
  for (const a of assetMetrics) {
    const key = a.category;
    const existing = categoryMap.get(key);
    if (!existing) {
      categoryMap.set(key, {
        category: CATEGORY_NAMES[key] ?? key,
        investedAmount: a.investedAmount,
        currentValue: a.currentValue,
        returnAmount: a.returnAmount,
        returnPercent: 0,
        assetCount: 1,
      });
    } else {
      existing.investedAmount += a.investedAmount;
      existing.currentValue += a.currentValue;
      existing.returnAmount += a.returnAmount;
      existing.assetCount += 1;
    }
  }
  const categoryMetrics: CategoryMetrics[] = Array.from(categoryMap.values()).map((c) => ({
    ...c,
    returnPercent: c.investedAmount > 0 ? (c.returnAmount / c.investedAmount) * 100 : 0,
  }));

  return {
    assets: assetMetrics,
    totalInvested,
    totalCurrentValue,
    totalReturn,
    totalReturnPercent,
    cagr,
    firstInvestmentDate: firstInvestDate,
    categoryMetrics,
  };
}

export async function getSingleAssetMetrics(
  assetId: number,
  userId: number
): Promise<AssetMetrics | null> {
  const [asset] = await db
    .select()
    .from(assetsTable)
    .where(and(eq(assetsTable.id, assetId), eq(assetsTable.userId, userId)))
    .limit(1);
  if (!asset) return null;

  const txs = await db
    .select()
    .from(transactionsTable)
    .where(and(eq(transactionsTable.assetId, assetId), eq(transactionsTable.userId, userId)));

  let investedAmount = 0;
  for (const tx of txs) {
    if (INVEST_TYPES.has(tx.type)) investedAmount += Number(tx.amount);
    else if (REDEEM_TYPES.has(tx.type)) investedAmount = Math.max(0, investedAmount - Number(tx.amount));
  }

  const [latestVal] = await db
    .select()
    .from(valuationsTable)
    .where(eq(valuationsTable.assetId, assetId))
    .orderBy(desc(valuationsTable.date))
    .limit(1);

  const currentValue = latestVal ? Number(latestVal.value) : 0;
  const returnAmount = currentValue - investedAmount;
  const returnPercent = investedAmount > 0 ? (returnAmount / investedAmount) * 100 : 0;

  return {
    assetId: asset.id,
    assetName: asset.name,
    category: asset.category,
    subCategory: asset.subCategory,
    investedAmount,
    currentValue,
    returnAmount,
    returnPercent,
    // Single-asset view: actualPercent not meaningful without portfolio context
    actualPercent: 0,
    targetPercent: Number(asset.targetPercent),
    currency: asset.currency ?? "LKR",
    isActive: asset.isActive ?? true,
  };
}

export async function getPortfolioTotalValue(userId: number): Promise<number> {
  const metrics = await getPortfolioMetrics(userId);
  const accounts = await db
    .select()
    .from(accountsTable)
    .where(and(eq(accountsTable.userId, userId), eq(accountsTable.isActive, true)));
  const cashValue = accounts.reduce((s, a) => s + Number(a.balance), 0);
  return metrics.totalCurrentValue + cashValue;
}
