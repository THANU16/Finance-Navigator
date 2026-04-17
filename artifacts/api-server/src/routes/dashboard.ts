import { Router } from "express";
import { db, assetsTable, accountsTable, settingsTable, valuationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();
router.use(requireAuth);

router.get("/summary", async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const assets = await db.select().from(assetsTable).where(and(eq(assetsTable.userId, userId), eq(assetsTable.isActive, true)));
  const accounts = await db.select().from(accountsTable).where(and(eq(accountsTable.userId, userId), eq(accountsTable.isActive, true)));

  const [settings] = await db.select().from(settingsTable).where(eq(settingsTable.userId, userId)).limit(1);

  // Calculate asset values
  const totalAssetValue = assets.reduce((sum, a) => {
    const v = a.units && a.nav ? Number(a.units) * Number(a.nav) : a.units && a.pricePerUnit ? Number(a.units) * Number(a.pricePerUnit) : 0;
    return sum + v;
  }, 0);

  const totalCashValue = accounts.reduce((s, a) => s + Number(a.balance), 0);
  const totalValue = totalAssetValue + totalCashValue;
  const investedValue = assets.reduce((s, a) => s + Number(a.investedValue), 0);
  const profitLoss = totalAssetValue - investedValue;
  const profitLossPercent = investedValue > 0 ? (profitLoss / investedValue) * 100 : 0;

  // Category grouping
  const categories = ["equity_fund", "debt_fund", "metal", "cash"];
  const categoryColors: Record<string, string> = {
    equity_fund: "#3b82f6",
    debt_fund: "#10b981",
    metal: "#f59e0b",
    cash: "#6b7280",
  };
  const categoryNames: Record<string, string> = {
    equity_fund: "Equity Funds",
    debt_fund: "Debt Funds",
    metal: "Precious Metals",
    cash: "Cash",
  };

  const allocationByCategory = categories.map(cat => {
    let value = 0;
    if (cat === "cash") {
      value = totalCashValue;
    } else {
      value = assets.filter(a => a.category === cat).reduce((s, a) => {
        const v = a.units && a.nav ? Number(a.units) * Number(a.nav) : a.units && a.pricePerUnit ? Number(a.units) * Number(a.pricePerUnit) : 0;
        return s + v;
      }, 0);
    }
    return {
      category: categoryNames[cat],
      value,
      percent: totalValue > 0 ? (value / totalValue) * 100 : 0,
      color: categoryColors[cat],
    };
  });

  // Emergency fund
  const emergencyFundRequired = settings ? Number(settings.emergencyFundRequired) : 0;
  const emergencyFundCurrent = accounts.filter(a => a.tag === "emergency").reduce((s, a) => s + Number(a.balance), 0);
  const emergencyFundPercent = emergencyFundRequired > 0 ? (emergencyFundCurrent / emergencyFundRequired) * 100 : 0;
  const cashAvailable = accounts.filter(a => a.tag === "free").reduce((s, a) => s + Number(a.balance), 0);

  // Best/worst category by % return
  const categoryPerformance = ["equity_fund", "debt_fund", "metal"].map(cat => {
    const catAssets = assets.filter(a => a.category === cat);
    const invested = catAssets.reduce((s, a) => s + Number(a.investedValue), 0);
    const current = catAssets.reduce((s, a) => {
      return s + (a.units && a.nav ? Number(a.units) * Number(a.nav) : a.units && a.pricePerUnit ? Number(a.units) * Number(a.pricePerUnit) : 0);
    }, 0);
    const returnPct = invested > 0 ? ((current - invested) / invested) * 100 : 0;
    return { category: categoryNames[cat], returnPct };
  });

  const bestCategory = categoryPerformance.sort((a, b) => b.returnPct - a.returnPct)[0]?.category ?? "N/A";
  const worstCategory = categoryPerformance.sort((a, b) => a.returnPct - b.returnPct)[0]?.category ?? "N/A";

  // Risk level based on concentration
  const maxCategoryPercent = Math.max(...allocationByCategory.map(c => c.percent));
  const riskLevel = maxCategoryPercent > 70 ? "High" : maxCategoryPercent > 50 ? "Medium" : "Low";

  res.json({
    totalValue,
    investedValue,
    profitLoss,
    profitLossPercent,
    monthlyReturn: profitLoss,
    monthlyReturnPercent: profitLossPercent,
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

  const [settings] = await db.select().from(settingsTable).where(eq(settingsTable.userId, userId)).limit(1);
  const accounts = await db.select().from(accountsTable).where(and(eq(accountsTable.userId, userId), eq(accountsTable.isActive, true)));
  const assets = await db.select().from(assetsTable).where(and(eq(assetsTable.userId, userId), eq(assetsTable.isActive, true)));

  if (settings) {
    const emergencyRequired = Number(settings.emergencyFundRequired);
    const emergencyCurrent = accounts.filter(a => a.tag === "emergency").reduce((s, a) => s + Number(a.balance), 0);
    const pct = emergencyRequired > 0 ? (emergencyCurrent / emergencyRequired) * 100 : 100;
    const criticalThreshold = Number(settings.emergencyFundCriticalThreshold);
    const lowThreshold = Number(settings.emergencyFundLowThreshold);

    if (pct < criticalThreshold) {
      alerts.push({ id: alertId++, type: "emergency_fund", message: `Emergency fund critically low (${pct.toFixed(0)}% of required)`, severity: "critical", createdAt: now });
    } else if (pct < lowThreshold) {
      alerts.push({ id: alertId++, type: "emergency_fund", message: `Emergency fund below target (${pct.toFixed(0)}% of required)`, severity: "warning", createdAt: now });
    }

    // Drift check
    const totalValue = assets.reduce((s, a) => {
      return s + (a.units && a.nav ? Number(a.units) * Number(a.nav) : a.units && a.pricePerUnit ? Number(a.units) * Number(a.pricePerUnit) : 0);
    }, 0);
    const tolerance = Number(settings.rebalancingDriftTolerance);
    const overweightAssets = assets.filter(a => {
      const actual = totalValue > 0 ? ((a.units && a.nav ? Number(a.units) * Number(a.nav) : 0) / totalValue) * 100 : 0;
      return Math.abs(actual - Number(a.targetPercent)) > tolerance;
    });
    if (overweightAssets.length > 0) {
      alerts.push({ id: alertId++, type: "rebalancing", message: `Portfolio drift detected in ${overweightAssets.length} asset(s) — rebalancing recommended`, severity: "warning", createdAt: now });
    }
  }

  // High idle cash
  const freeCash = accounts.filter(a => a.tag === "free").reduce((s, a) => s + Number(a.balance), 0);
  if (freeCash > 100000) {
    alerts.push({ id: alertId++, type: "idle_cash", message: `High idle cash (LKR ${freeCash.toLocaleString()}) — consider deploying`, severity: "info", createdAt: now });
  }

  res.json(alerts);
});

export default router;
