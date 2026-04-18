import { useGetAssets, getGetAssetsQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { ChevronRight, TrendingUp, TrendingDown, Search, BarChart3, Plus } from "lucide-react";
import { useState } from "react";

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  equity_fund:  { label: "Equity Fund",  color: "text-blue-500 border-blue-500/30 bg-blue-500/10" },
  debt_fund:    { label: "Debt Fund",    color: "text-purple-500 border-purple-500/30 bg-purple-500/10" },
  metal:        { label: "Metal",        color: "text-yellow-500 border-yellow-500/30 bg-yellow-500/10" },
  stock:        { label: "Stock",        color: "text-cyan-500 border-cyan-500/30 bg-cyan-500/10" },
  cash:         { label: "Cash",         color: "text-green-500 border-green-500/30 bg-green-500/10" },
};

const CATEGORY_ORDER = ["equity_fund", "debt_fund", "metal", "stock", "cash"];

export default function AssetAnalysisList() {
  const [search, setSearch] = useState("");

  const { data: assets, isLoading } = useGetAssets({
    query: { queryKey: getGetAssetsQueryKey() }
  });

  if (isLoading) return <AssetsSkeleton />;

  const filtered = (assets || []).filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.category.toLowerCase().includes(search.toLowerCase())
  );

  // Group by category
  const grouped = CATEGORY_ORDER.reduce<Record<string, typeof filtered>>((acc, cat) => {
    const items = filtered.filter(a => a.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});
  // Any uncategorised
  const other = filtered.filter(a => !CATEGORY_ORDER.includes(a.category));
  if (other.length) grouped["other"] = other;

  const totalValue = (assets || []).reduce((s, a) => s + Number(a.currentValue || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Asset Analysis</h1>
          <p className="text-muted-foreground mt-1">
            Select any asset to view deep analytics, log valuations, and review transactions.
          </p>
        </div>
        <Link href="/portfolio">
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" /> Manage Assets
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search assets..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Summary bar */}
      <div className="flex gap-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{filtered.length}</span> assets
        {" · "}
        Total value:
        <span className="font-semibold text-foreground">{formatCurrency(totalValue)}</span>
      </div>

      {/* Asset groups */}
      {Object.keys(grouped).length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            {assets?.length === 0
              ? <>No assets yet. <Link href="/portfolio" className="text-primary underline">Add your first asset</Link> in Portfolio.</>
              : "No assets match your search."}
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([cat, items]) => {
          const meta = CATEGORY_LABELS[cat] || { label: cat, color: "text-muted-foreground" };
          const catTotal = items.reduce((s, a) => s + Number(a.currentValue || 0), 0);
          return (
            <div key={cat} className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${meta.color.split(" ")[0].replace("text-", "bg-")}`} />
                  {meta.label}
                </h2>
                <span className="text-xs text-muted-foreground">{formatCurrency(catTotal)}</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {items.map(asset => {
                  const pl = Number(asset.profitLoss || 0);
                  const plPct = Number(asset.profitLossPercent || 0);
                  const isPositive = pl >= 0;

                  return (
                    <Link key={asset.id} href={`/assets/${asset.id}`}>
                      <Card className="group cursor-pointer hover:border-primary/50 hover:shadow-md transition-all duration-200 hover:bg-accent/5">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold truncate group-hover:text-primary transition-colors">
                                {asset.name}
                              </p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${meta.color}`}>
                                  {meta.label}
                                </Badge>
                                {asset.subCategory && (
                                  <span className="text-xs text-muted-foreground capitalize">{asset.subCategory}</span>
                                )}
                                {!asset.isActive && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Inactive</Badge>
                                )}
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-muted-foreground mb-0.5">Current Value</p>
                              <p className="font-bold text-sm">{formatCurrency(asset.currentValue, asset.currency)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-0.5">Invested</p>
                              <p className="text-sm font-medium">{formatCurrency(asset.investedValue, asset.currency)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-0.5">P&amp;L</p>
                              <p className={`text-sm font-semibold flex items-center gap-1 ${isPositive ? "text-green-500" : "text-red-500"}`}>
                                {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {isPositive ? "+" : ""}{formatCurrency(pl, asset.currency)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-0.5">Return</p>
                              <p className={`text-sm font-semibold ${isPositive ? "text-green-500" : "text-red-500"}`}>
                                {isPositive ? "+" : ""}{formatPercent(plPct)}
                              </p>
                            </div>
                          </div>

                          {/* Allocation bar */}
                          <div className="mt-3 pt-3 border-t border-border/50">
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                              <span>Allocation</span>
                              <span>{Number(asset.actualPercent || 0).toFixed(1)}% actual · {asset.targetPercent}% target</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${Math.min(Number(asset.actualPercent || 0), 100)}%` }}
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function AssetsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-5 w-80" />
      </div>
      <Skeleton className="h-10 w-64" />
      <div className="space-y-2">
        <Skeleton className="h-5 w-24" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-44" />)}
        </div>
      </div>
    </div>
  );
}
