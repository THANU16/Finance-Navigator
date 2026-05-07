/**
 * PortfolioCalculationService — Single Source of Truth
 *
 * Rules:
 *   investedAmount  = SUM(invest + sip transactions) - SUM(redeem transactions) per asset
 *   currentValue    = latest valuation entry (manual snapshot) — falls back to 0 if no valuation
 *   absoluteReturn  = currentValue - investedAmount
 *   absoluteReturnPercent = (absoluteReturn / investedAmount) * 100
 *   cagr (per-asset) = (currentValue / investedAmount)^(1/years) - 1, years from first invest tx
 *   xirr (per-asset) = annualized IRR using Newton-Raphson on dated cashflows
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
  /** Per-asset CAGR % (from first investment to now) */
  cagr: number | null;
  /** Per-asset XIRR % (accounts for irregular investment & withdrawal timing) */
  xirr: number | null;
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
  xirr: number | null;
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

/**
 * Compute XIRR using Newton-Raphson iteration.
 * cashflows: sorted by date, negative = outflow (invest), positive = inflow (redeem / terminal value)
 */
export function computeXIRR(cashflows: Array<{ amount: number; date: Date }>): number | null {
  if (cashflows.length < 2) return null;
  const hasNeg = cashflows.some((c) => c.amount < 0);
  const hasPos = cashflows.some((c) => c.amount > 0);
  if (!hasNeg || !hasPos) return null;

  const t0 = cashflows[0].date.getTime();
  const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
  const years = cashflows.map((c) => (c.date.getTime() - t0) / MS_PER_YEAR);

  const npv = (r: number) =>
    cashflows.reduce((s, cf, i) => s + cf.amount / Math.pow(1 + r, years[i]), 0);
  const dnpv = (r: number) =>
    cashflows.reduce(
      (s, cf, i) => s - (years[i] * cf.amount) / Math.pow(1 + r, years[i] + 1),
      0
    );

  let r = 0.1;
  for (let i = 0; i < 200; i++) {
    const n = npv(r);
    const d = dnpv(r);
    if (Math.abs(d) < 1e-12) break;
    const rNew = r - n / d;
    if (Math.abs(rNew - r) < 1e-8) return rNew * 100;
    r = rNew;
    if (r <= -1) r = -0.9999;
  }
  return null;
}

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
      xirr: null,
      firstInvestmentDate: null,
      categoryMetrics: [],
    };
  }

  const assetIds = investmentAssets.map((a) => a.id);

  // Batch: all user transactions (for invested amount computation + cashflow dates)
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

  // Build: assetId -> invested amount, per-asset cashflows, per-asset first invest date
  const investedMap = new Map<number, number>();
  const assetCashflowsMap = new Map<number, Array<{ amount: number; date: Date }>>();
  const assetFirstInvestDateMap = new Map<number, string>();
  let firstInvestDate: string | null = null;
  // Portfolio-level cashflows for portfolio XIRR
  const portfolioCashflows: Array<{ amount: number; date: Date }> = [];

  for (const tx of allTxs) {
    if (!tx.assetId) continue;
    const prev = investedMap.get(tx.assetId) ?? 0;
    if (!assetCashflowsMap.has(tx.assetId)) assetCashflowsMap.set(tx.assetId, []);
    const flows = assetCashflowsMap.get(tx.assetId)!;

    if (INVEST_TYPES.has(tx.type)) {
      const amt = Number(tx.amount);
      investedMap.set(tx.assetId, prev + amt);
      flows.push({ amount: -amt, date: new Date(tx.date) });
      portfolioCashflows.push({ amount: -amt, date: new Date(tx.date) });
      if (!firstInvestDate || tx.date < firstInvestDate) firstInvestDate = tx.date;
      const prevFirst = assetFirstInvestDateMap.get(tx.assetId);
      if (!prevFirst || tx.date < prevFirst) assetFirstInvestDateMap.set(tx.assetId, tx.date);
    } else if (REDEEM_TYPES.has(tx.type)) {
      const amt = Number(tx.amount);
      investedMap.set(tx.assetId, Math.max(0, prev - amt));
      flows.push({ amount: amt, date: new Date(tx.date) });
      portfolioCashflows.push({ amount: amt, date: new Date(tx.date) });
    }
  }

  // Build: assetId -> latest valuation value (first seen = latest because ordered desc)
  const latestValMap = new Map<number, number>();
  for (const v of allVals) {
    if (!latestValMap.has(v.assetId)) {
      latestValMap.set(v.assetId, Number(v.value));
    }
  }

  const today = new Date();

  // Compute per-asset metrics
  const rawMetrics = investmentAssets.map((asset) => {
    const investedAmount = investedMap.get(asset.id) ?? 0;
    const currentValue = latestValMap.get(asset.id) ?? 0;
    const returnAmount = currentValue - investedAmount;
    const returnPercent = investedAmount > 0 ? (returnAmount / investedAmount) * 100 : 0;

    // Per-asset CAGR
    const firstDate = assetFirstInvestDateMap.get(asset.id);
    let cagr: number | null = null;
    if (firstDate && investedAmount > 0 && currentValue > 0) {
      const years =
        (Date.now() - new Date(firstDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      if (years >= 0.1) {
        cagr = (Math.pow(currentValue / investedAmount, 1 / years) - 1) * 100;
      }
    }

    // Per-asset XIRR: sort cashflows + add terminal current value at today
    const rawFlows = assetCashflowsMap.get(asset.id);
    let xirr: number | null = null;
    if (rawFlows && rawFlows.length > 0 && currentValue > 0) {
      const sorted = [...rawFlows].sort((a, b) => a.date.getTime() - b.date.getTime());
      sorted.push({ amount: currentValue, date: today });
      xirr = computeXIRR(sorted);
    }

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
      cagr,
      xirr,
    };
  });

  const totalInvested = rawMetrics.reduce((s, a) => s + a.investedAmount, 0);
  const totalCurrentValue = rawMetrics.reduce((s, a) => s + a.currentValue, 0);

  const assetMetrics: AssetMetrics[] = rawMetrics.map((a) => ({
    ...a,
    actualPercent: totalCurrentValue > 0 ? (a.currentValue / totalCurrentValue) * 100 : 0,
  }));

  const totalReturn = totalCurrentValue - totalInvested;
  const totalReturnPercent = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;

  // Portfolio CAGR
  let cagr: number | null = null;
  if (firstInvestDate && totalInvested > 0 && totalCurrentValue > 0) {
    const years =
      (Date.now() - new Date(firstInvestDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (years >= 0.1) {
      cagr = (Math.pow(totalCurrentValue / totalInvested, 1 / years) - 1) * 100;
    }
  }

  // Portfolio XIRR
  let xirr: number | null = null;
  if (portfolioCashflows.length > 0 && totalCurrentValue > 0) {
    const sorted = [...portfolioCashflows].sort((a, b) => a.date.getTime() - b.date.getTime());
    sorted.push({ amount: totalCurrentValue, date: today });
    xirr = computeXIRR(sorted);
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
    xirr,
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
  let firstInvestDate: string | null = null;
  const cashflows: Array<{ amount: number; date: Date }> = [];

  for (const tx of txs) {
    if (INVEST_TYPES.has(tx.type)) {
      const amt = Number(tx.amount);
      investedAmount += amt;
      cashflows.push({ amount: -amt, date: new Date(tx.date) });
      if (!firstInvestDate || tx.date < firstInvestDate) firstInvestDate = tx.date;
    } else if (REDEEM_TYPES.has(tx.type)) {
      const amt = Number(tx.amount);
      investedAmount = Math.max(0, investedAmount - amt);
      cashflows.push({ amount: amt, date: new Date(tx.date) });
    }
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

  // Per-asset CAGR
  let cagr: number | null = null;
  if (firstInvestDate && investedAmount > 0 && currentValue > 0) {
    const years =
      (Date.now() - new Date(firstInvestDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (years >= 0.1) {
      cagr = (Math.pow(currentValue / investedAmount, 1 / years) - 1) * 100;
    }
  }

  // Per-asset XIRR
  let xirr: number | null = null;
  if (cashflows.length > 0 && currentValue > 0) {
    const sorted = [...cashflows].sort((a, b) => a.date.getTime() - b.date.getTime());
    sorted.push({ amount: currentValue, date: new Date() });
    xirr = computeXIRR(sorted);
  }

  return {
    assetId: asset.id,
    assetName: asset.name,
    category: asset.category,
    subCategory: asset.subCategory,
    investedAmount,
    currentValue,
    returnAmount,
    returnPercent,
    actualPercent: 0,
    targetPercent: Number(asset.targetPercent),
    currency: asset.currency ?? "LKR",
    isActive: asset.isActive ?? true,
    cagr,
    xirr,
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
