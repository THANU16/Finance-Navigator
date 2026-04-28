import { Router } from "express";
import { db, accountsTable, settingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { getPortfolioMetrics } from "../lib/portfolio";
import {
  getLatestAccountValuationsMap,
  effectiveAccountBalance,
  sumEffectiveBalances,
} from "../lib/account-balances";

const router = Router();
router.use(requireAuth);

const CATEGORY_COLORS: Record<string, string> = {
  "Equity Funds": "#3b82f6",
  "Debt Funds": "#10b981",
  "Precious Metals": "#f59e0b",
  Cash: "#6b7280",
};

router.get("/summary", async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const [portfolio, accounts, settingsRows] = await Promise.all([
    getPortfolioMetrics(userId),
    db.select().from(accountsTable).where(and(eq(accountsTable.userId, userId), eq(accountsTable.isActive, true))),
    db.select().from(settingsTable).where(eq(settingsTable.userId, userId)).limit(1),
  ]);

  const settings = settingsRows[0];
  const latestMap = await getLatestAccountValuationsMap(accounts.map((a) => a.id));
  const totalCashValue = sumEffectiveBalances(accounts, latestMap);
  const totalValue = portfolio.totalCurrentValue + totalCashValue;

  // Allocation by category — uses accurate currentValue from portfolio service
  const catValueMap = new Map(portfolio.categoryMetrics.map((c) => [c.category, c.currentValue]));
  const allocationByCategory = ["Equity Funds", "Debt Funds", "Precious Metals", "Cash"].map((catName) => {
    const value = catName === "Cash" ? totalCashValue : (catValueMap.get(catName) ?? 0);
    return {
      category: catName,
      value,
      percent: totalValue > 0 ? (value / totalValue) * 100 : 0,
      color: CATEGORY_COLORS[catName],
    };
  });

  // Emergency fund — uses latest valuation if present, else principal
  const emergencyFundRequired = settings ? Number(settings.emergencyFundRequired) : 0;
  const emergencyFundCurrent = sumEffectiveBalances(
    accounts.filter((a) => a.tag === "emergency"),
    latestMap,
  );
  const emergencyFundPercent = emergencyFundRequired > 0 ? (emergencyFundCurrent / emergencyFundRequired) * 100 : 0;
  const cashAvailable = sumEffectiveBalances(
    accounts.filter((a) => a.tag === "free"),
    latestMap,
  );

  // Best/worst category by return %
  const sortedCats = [...portfolio.categoryMetrics].sort((a, b) => b.returnPercent - a.returnPercent);
  const bestCategory = sortedCats[0]?.category ?? "N/A";
  const worstCategory = sortedCats[sortedCats.length - 1]?.category ?? "N/A";

  // Risk = max category concentration
  const maxCategoryPercent = Math.max(...allocationByCategory.map((c) => c.percent), 0);
  const riskLevel = maxCategoryPercent > 70 ? "High" : maxCategoryPercent > 50 ? "Medium" : "Low";

  res.json({
    totalValue,
    investedValue: portfolio.totalInvested,
    profitLoss: portfolio.totalReturn,
    profitLossPercent: portfolio.totalReturnPercent,
    monthlyReturn: portfolio.totalReturn,
    monthlyReturnPercent: portfolio.totalReturnPercent,
    allocationByCategory,
    emergencyFundRequired,
    emergencyFundCurrent,
    emergencyFundPercent,
    cashAvailable,
    bestCategory,
    worstCategory,
    riskLevel,
  });
});

router.get("/alerts", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const alerts: Array<{ id: number; type: string; message: string; severity: string; createdAt: string }> = [];
  let alertId = 1;
  const now = new Date().toISOString();

  const [portfolio, settingsRows, accounts] = await Promise.all([
    getPortfolioMetrics(userId),
    db.select().from(settingsTable).where(eq(settingsTable.userId, userId)).limit(1),
    db.select().from(accountsTable).where(and(eq(accountsTable.userId, userId), eq(accountsTable.isActive, true))),
  ]);

  const settings = settingsRows[0];
  const latestMap = await getLatestAccountValuationsMap(accounts.map((a) => a.id));
  if (settings) {
    const emergencyRequired = Number(settings.emergencyFundRequired);
    const emergencyCurrent = sumEffectiveBalances(
      accounts.filter((a) => a.tag === "emergency"),
      latestMap,
    );
    const pct = emergencyRequired > 0 ? (emergencyCurrent / emergencyRequired) * 100 : 100;
    const criticalThreshold = Number(settings.emergencyFundCriticalThreshold);
    const lowThreshold = Number(settings.emergencyFundLowThreshold);

    if (pct < criticalThreshold) {
      alerts.push({ id: alertId++, type: "emergency_fund", message: `Emergency fund critically low (${pct.toFixed(0)}% of required)`, severity: "critical", createdAt: now });
    } else if (pct < lowThreshold) {
      alerts.push({ id: alertId++, type: "emergency_fund", message: `Emergency fund below target (${pct.toFixed(0)}% of required)`, severity: "warning", createdAt: now });
    }

    // Drift check using accurate currentValue from portfolio service
    const tolerance = Number(settings.rebalancingDriftTolerance);
    const driftingAssets = portfolio.assets.filter((a) => {
      const actualPct = portfolio.totalCurrentValue > 0 ? (a.currentValue / portfolio.totalCurrentValue) * 100 : 0;
      return Math.abs(actualPct - a.targetPercent) > tolerance;
    });
    if (driftingAssets.length > 0) {
      alerts.push({ id: alertId++, type: "rebalancing", message: `Portfolio drift detected in ${driftingAssets.length} asset(s) — rebalancing recommended`, severity: "warning", createdAt: now });
    }
  }

  const freeCash = sumEffectiveBalances(
    accounts.filter((a) => a.tag === "free"),
    latestMap,
  );
  if (freeCash > 100000) {
    alerts.push({ id: alertId++, type: "idle_cash", message: `High idle cash (LKR ${freeCash.toLocaleString()}) — consider deploying`, severity: "info", createdAt: now });
  }

  res.json(alerts);
});

export default router;
