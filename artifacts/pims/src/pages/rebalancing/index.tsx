import { useState, useMemo } from "react";
import { useGetRebalancingStatus, getGetRebalancingStatusQueryKey } from "@workspace/api-client-react";
import { formatPercent, formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, ReferenceLine } from "recharts";
import { AlertCircle, SlidersHorizontal, CheckCircle2, TrendingUp, TrendingDown, Minus, Wallet } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssetStatus {
  assetId: number;
  assetName: string;
  targetPercent: number;
  actualPercent: number;
  drift: number;
  currentValue: number;
  investedValue: number;
}

interface CategoryStatus {
  category: string;
  targetPercent: number;
  actualPercent: number;
  drift: number;
  status: string;
  assets: AssetStatus[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  if (status === "overweight")
    return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">Overweight</Badge>;
  if (status === "underweight")
    return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Underweight</Badge>;
  return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Balanced</Badge>;
}

function driftColor(drift: number) {
  if (drift > 0.01) return "text-red-500";
  if (drift < -0.01) return "text-yellow-500";
  return "text-green-500";
}

function gapColor(gap: number) {
  if (gap > 0) return "text-green-500";  // invest
  if (gap < 0) return "text-red-500";    // reduce
  return "text-muted-foreground";
}

function GapIcon({ gap }: { gap: number }) {
  if (gap > 0.5) return <TrendingUp className="h-3 w-3 text-green-500 inline mr-1" />;
  if (gap < -0.5) return <TrendingDown className="h-3 w-3 text-red-500 inline mr-1" />;
  return <Minus className="h-3 w-3 text-muted-foreground inline mr-1" />;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Rebalancing() {
  const { data: status, isLoading } = useGetRebalancingStatus({
    query: { queryKey: getGetRebalancingStatusQueryKey() },
  });

  const [budget, setBudget] = useState("");

  // Flatten all assets across all categories
  const allAssets: (AssetStatus & { categoryName: string })[] = useMemo(() => {
    if (!status) return [];
    return (status.categories as CategoryStatus[]).flatMap((c) =>
      c.assets.map((a) => ({ ...a, categoryName: c.category }))
    );
  }, [status]);

  const totalPortfolioValue: number = (status as any)?.totalPortfolioValue ?? 0;

  // ── Full Rebalance Plan ────────────────────────────────────────────────────
  const fullPlan = useMemo(() => {
    if (!totalPortfolioValue) return null;

    const assetPlans = allAssets.map((a) => {
      const requiredValue = (a.targetPercent / 100) * totalPortfolioValue;
      const gap = requiredValue - a.currentValue;
      return { ...a, requiredValue, gap };
    });

    const categoryPlans = (status!.categories as CategoryStatus[]).map((c) => {
      const requiredValue = (c.targetPercent / 100) * totalPortfolioValue;
      const gap = requiredValue - c.assets.reduce((s, a) => s + a.currentValue, 0);
      return { ...c, requiredValue, gap };
    });

    const totalNeeded = assetPlans.filter((a) => a.gap > 0).reduce((s, a) => s + a.gap, 0);
    return { assetPlans, categoryPlans, totalNeeded };
  }, [allAssets, totalPortfolioValue, status]);

  // ── Limited Budget Plan ────────────────────────────────────────────────────
  const budgetPlan = useMemo(() => {
    if (!fullPlan || !budget || isNaN(Number(budget)) || Number(budget) <= 0) return null;
    const available = Number(budget);

    const underweightAssets = fullPlan.assetPlans.filter((a) => a.gap > 0);
    const totalGap = underweightAssets.reduce((s, a) => s + a.gap, 0);
    if (totalGap <= 0) return null;

    const allocations = underweightAssets.map((a) => ({
      ...a,
      allocation: (a.gap / totalGap) * available,
      allocationPct: (a.gap / totalGap) * 100,
    }));

    // Group by category
    const byCategory = new Map<string, typeof allocations>();
    for (const a of allocations) {
      if (!byCategory.has(a.categoryName)) byCategory.set(a.categoryName, []);
      byCategory.get(a.categoryName)!.push(a);
    }
    const categoryAllocations = Array.from(byCategory.entries()).map(([cat, items]) => ({
      categoryName: cat,
      totalAllocation: items.reduce((s, i) => s + i.allocation, 0),
      totalPct: items.reduce((s, i) => s + i.allocationPct, 0),
      items,
    }));

    return { available, allocations, categoryAllocations };
  }, [fullPlan, budget]);

  // ── Chart ──────────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (!status) return [];
    return (status.categories as CategoryStatus[]).map((c) => ({
      name: c.category,
      target: Number(c.targetPercent.toFixed(1)),
      actual: Number(c.actualPercent.toFixed(1)),
      drift: Number(c.drift.toFixed(2)),
      status: c.status,
    }));
  }, [status]);

  if (isLoading) return <RebalancingSkeleton />;
  if (!status) return null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Rebalancing</h1>
        <p className="text-muted-foreground">Monitor drift and get actionable investment plans.</p>
      </div>

      {/* Overall status alert */}
      {status.needsRebalancing ? (
        <Alert variant="destructive" className="border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Rebalancing Required</AlertTitle>
          <AlertDescription>
            Portfolio has drifted from targets. Overall drift: <strong>{formatPercent(status.overallDrift)}</strong>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-green-500/50 bg-green-500/10 text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Portfolio Balanced</AlertTitle>
          <AlertDescription>
            Allocations are within acceptable limits. Overall drift: <strong>{formatPercent(status.overallDrift)}</strong>
          </AlertDescription>
        </Alert>
      )}

      {/* Drift chart + Suggestions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Category Drift</CardTitle>
            <CardDescription>Actual vs target allocation per category</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value: number) => `${value.toFixed(2)}%`}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                />
                <ReferenceLine y={0} stroke="hsl(var(--border))" />
                <Bar dataKey="drift" name="Drift" radius={[4, 4, 4, 4]}>
                  {chartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={
                        entry.status === "overweight"
                          ? "hsl(348 83% 47%)"
                          : entry.status === "underweight"
                          ? "hsl(45 93% 47%)"
                          : "hsl(142 71% 45%)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Suggestions</CardTitle>
            <CardDescription>Recommended actions</CardDescription>
          </CardHeader>
          <CardContent>
            {status.suggestions.length > 0 ? (
              <div className="space-y-4">
                {(status.suggestions as any[]).map((s, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <div className={`mt-0.5 rounded-full p-1 flex-shrink-0 ${
                      s.priority === "high" ? "bg-red-500/20 text-red-500" :
                      s.priority === "medium" ? "bg-yellow-500/20 text-yellow-500" :
                      "bg-blue-500/20 text-blue-500"
                    }`}>
                      <SlidersHorizontal className="h-3 w-3" />
                    </div>
                    <div>
                      <div className="font-medium capitalize">{s.type.replace("_", " ")}</div>
                      <div className="text-muted-foreground">{s.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="h-10 w-10 text-green-500/50 mb-3" />
                <p className="text-sm text-muted-foreground">No actions required.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── FULL REBALANCE PLAN ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold">Full Rebalance Plan</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Exact amounts needed to perfectly align every asset to its target allocation.
          </p>
        </div>

        {!totalPortfolioValue ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              No portfolio value found. Add valuations to your assets to see the rebalancing plan.
            </CardContent>
          </Card>
        ) : fullPlan ? (
          <>
            {/* Summary KPI */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="text-xs text-muted-foreground">Portfolio Value</div>
                  <div className="text-lg font-bold mt-1">{formatCurrency(totalPortfolioValue)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="text-xs text-muted-foreground">Total to Invest</div>
                  <div className="text-lg font-bold mt-1 text-green-500">{formatCurrency(fullPlan.totalNeeded)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="text-xs text-muted-foreground">Underweight Assets</div>
                  <div className="text-lg font-bold mt-1 text-yellow-500">
                    {fullPlan.assetPlans.filter((a) => a.gap > 0).length}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="text-xs text-muted-foreground">Overweight Assets</div>
                  <div className="text-lg font-bold mt-1 text-red-500">
                    {fullPlan.assetPlans.filter((a) => a.gap < 0).length}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Per-category breakdown */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">By Category</CardTitle>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 border-y border-border">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Target %</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actual %</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Required Value</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Current Value</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Gap (Action)</th>
                      <th className="px-4 py-3 text-center font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {fullPlan.categoryPlans.map((c) => (
                      <tr key={c.category} className="hover:bg-muted/20">
                        <td className="px-4 py-3 font-semibold">{c.category}</td>
                        <td className="px-4 py-3 text-right">{c.targetPercent.toFixed(1)}%</td>
                        <td className="px-4 py-3 text-right">{c.actualPercent.toFixed(1)}%</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(c.requiredValue)}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(c.assets.reduce((s, a) => s + a.currentValue, 0))}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${gapColor(c.gap)}`}>
                          <GapIcon gap={c.gap} />
                          {c.gap > 0 ? `+${formatCurrency(c.gap)} Invest` : c.gap < 0 ? `${formatCurrency(Math.abs(c.gap))} Reduce` : "On target"}
                        </td>
                        <td className="px-4 py-3 text-center">{statusBadge(c.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Per-asset breakdown */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">By Asset</CardTitle>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 border-y border-border">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Asset</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Target %</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actual %</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Required</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Current</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Gap (Action)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {fullPlan.assetPlans.map((a) => (
                      <tr key={a.assetId} className={`hover:bg-muted/20 ${a.gap > 0 ? "bg-green-500/5" : a.gap < 0 ? "bg-red-500/5" : ""}`}>
                        <td className="px-4 py-3 font-medium">{a.assetName}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{a.categoryName}</td>
                        <td className="px-4 py-3 text-right">{a.targetPercent.toFixed(1)}%</td>
                        <td className="px-4 py-3 text-right">{a.actualPercent.toFixed(1)}%</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(a.requiredValue)}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(a.currentValue)}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${gapColor(a.gap)}`}>
                          <GapIcon gap={a.gap} />
                          {Math.abs(a.gap) < 0.5
                            ? "On target"
                            : a.gap > 0
                            ? `+${formatCurrency(a.gap)} Invest`
                            : `${formatCurrency(Math.abs(a.gap))} Reduce`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        ) : null}
      </div>

      {/* ── LIMITED BUDGET PLAN ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold">Limited Budget Plan</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Enter how much you can invest now — the system distributes it proportionally across underweight assets only.
          </p>
        </div>

        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 max-w-xs">
                <Label htmlFor="budget-input" className="text-sm font-medium mb-1.5 block">
                  Available Investment Amount (LKR)
                </Label>
                <div className="relative">
                  <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="budget-input"
                    type="number"
                    min={0}
                    placeholder="e.g. 100000"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              {budgetPlan && (
                <div className="text-sm text-muted-foreground pb-1">
                  Distributing <strong className="text-foreground">{formatCurrency(budgetPlan.available)}</strong> across{" "}
                  <strong className="text-foreground">{budgetPlan.allocations.length}</strong> underweight asset(s)
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {budget && !budgetPlan && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              {Number(budget) <= 0
                ? "Enter a positive amount to see your allocation plan."
                : "All assets are at or above their target — no underweight assets to invest in."}
            </CardContent>
          </Card>
        )}

        {budgetPlan && (
          <>
            {/* By category */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Allocation by Category</CardTitle>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 border-y border-border">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Invest Amount</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">% of Budget</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Gap Covered</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {budgetPlan.categoryAllocations.map((c) => {
                      const catPlan = fullPlan?.categoryPlans.find((cp) => cp.category === c.categoryName);
                      const gapCovered = catPlan && catPlan.gap > 0
                        ? Math.min(100, (c.totalAllocation / catPlan.gap) * 100)
                        : 0;
                      return (
                        <tr key={c.categoryName} className="hover:bg-muted/20 bg-green-500/5">
                          <td className="px-4 py-3 font-semibold">{c.categoryName}</td>
                          <td className="px-4 py-3 text-right font-semibold text-green-500">
                            +{formatCurrency(c.totalAllocation)}
                          </td>
                          <td className="px-4 py-3 text-right">{c.totalPct.toFixed(1)}%</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{gapCovered.toFixed(0)}% of gap</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* By asset */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Allocation by Asset</CardTitle>
                <CardDescription>Only underweight assets are shown — overweight assets receive no allocation.</CardDescription>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 border-y border-border">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Asset</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Full Gap</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Invest Amount</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">% of Budget</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Gap Covered</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {budgetPlan.allocations.map((a) => (
                      <tr key={a.assetId} className="hover:bg-muted/20 bg-green-500/5">
                        <td className="px-4 py-3 font-medium">{a.assetName}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{a.categoryName}</td>
                        <td className="px-4 py-3 text-right text-yellow-500">{formatCurrency(a.gap)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-green-500">
                          +{formatCurrency(a.allocation)}
                        </td>
                        <td className="px-4 py-3 text-right">{a.allocationPct.toFixed(1)}%</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500 rounded-full"
                                style={{ width: `${Math.min(100, (a.allocation / a.gap) * 100)}%` }}
                              />
                            </div>
                            <span className="text-muted-foreground text-xs">
                              {Math.min(100, (a.allocation / a.gap) * 100).toFixed(0)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* ── DETAILED ALLOCATIONS ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Current Allocations</h2>
        {(status.categories as CategoryStatus[]).map((category) => (
          <Card key={category.category} className="overflow-hidden">
            <div className="bg-muted/40 border-b border-border px-4 py-3 flex flex-wrap justify-between items-center gap-2">
              <div className="flex items-center gap-3">
                <h4 className="font-semibold">{category.category}</h4>
                {statusBadge(category.status)}
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span>Target <strong className="text-foreground">{category.targetPercent.toFixed(1)}%</strong></span>
                <span>Actual <strong className="text-foreground">{category.actualPercent.toFixed(1)}%</strong></span>
                <span className={`font-semibold ${driftColor(category.drift)}`}>
                  Drift {category.drift > 0 ? "+" : ""}{category.drift.toFixed(2)}%
                </span>
              </div>
            </div>
            {category.assets.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground bg-muted/20 border-b border-border">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium">Asset</th>
                      <th className="px-4 py-2.5 text-right font-medium">Target</th>
                      <th className="px-4 py-2.5 text-right font-medium">Actual</th>
                      <th className="px-4 py-2.5 text-right font-medium">Drift</th>
                      <th className="px-4 py-2.5 text-right font-medium">Current Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {category.assets.map((asset) => (
                      <tr key={asset.assetId} className="hover:bg-muted/20">
                        <td className="px-4 py-2.5 font-medium">{asset.assetName}</td>
                        <td className="px-4 py-2.5 text-right">{asset.targetPercent.toFixed(1)}%</td>
                        <td className="px-4 py-2.5 text-right">{asset.actualPercent.toFixed(1)}%</td>
                        <td className={`px-4 py-2.5 text-right font-medium ${driftColor(asset.drift)}`}>
                          {asset.drift > 0 ? "+" : ""}{asset.drift.toFixed(2)}%
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">
                          {formatCurrency(asset.currentValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function RebalancingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-14 w-full" />
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardContent className="p-6"><Skeleton className="h-[300px] w-full" /></CardContent>
        </Card>
        <Card>
          <CardContent className="p-6"><Skeleton className="h-[300px] w-full" /></CardContent>
        </Card>
      </div>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
