import { useGetPerformanceAnalytics, getGetPerformanceAnalyticsQueryKey, useGetGrowthChart, getGetGrowthChartQueryKey } from "@workspace/api-client-react";
import { useState } from "react";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, Legend } from "recharts";
import { TrendingUp, TrendingDown, Info } from "lucide-react";

export default function Performance() {
  const [period, setPeriod] = useState<"1m" | "3m" | "6m" | "1y" | "all">("1y");
  
  const { data: analytics, isLoading: isAnalyticsLoading } = useGetPerformanceAnalytics(
    { period },
    { query: { queryKey: getGetPerformanceAnalyticsQueryKey({ period }) } }
  );

  const { data: growth, isLoading: isGrowthLoading } = useGetGrowthChart(
    { period },
    { query: { queryKey: getGetGrowthChartQueryKey({ period }) } }
  );

  if (isAnalyticsLoading || isGrowthLoading) {
    return <PerformanceSkeleton />;
  }

  if (!analytics) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Performance</h1>
          <p className="text-muted-foreground">Analyze your portfolio's historical returns.</p>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as any)} className="w-[400px]">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="1m" data-testid="tab-1m">1M</TabsTrigger>
            <TabsTrigger value="3m" data-testid="tab-3m">3M</TabsTrigger>
            <TabsTrigger value="6m" data-testid="tab-6m">6M</TabsTrigger>
            <TabsTrigger value="1y" data-testid="tab-1y">1Y</TabsTrigger>
            <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Return</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${analytics.totalReturn >= 0 ? "text-green-500" : "text-red-500"}`} data-testid="text-total-return">
              {analytics.totalReturn >= 0 ? "+" : ""}{formatCurrency(analytics.totalReturn)}
            </div>
            <p className={`text-xs mt-1 ${analytics.totalReturnPercent >= 0 ? "text-green-500" : "text-red-500"}`}>
              {formatPercent(analytics.totalReturnPercent)} for selected period
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CAGR</CardTitle>
            <Info className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-cagr">
              {analytics.cagr !== null && analytics.cagr !== undefined ? formatPercent(analytics.cagr) : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Compound Annual Growth Rate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Max Drawdown</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500" data-testid="text-drawdown">
              {formatPercent(analytics.drawdown)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Largest drop from peak
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SIP Performance</CardTitle>
            <Info className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${analytics.sipReturn >= 0 ? "text-green-500" : "text-red-500"}`} data-testid="text-sip-return">
              {analytics.sipReturn >= 0 ? "+" : ""}{formatCurrency(analytics.sipReturn)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Return on SIP investments
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-7 lg:grid-cols-7">
        <Card className="md:col-span-4 lg:col-span-5">
          <CardHeader>
            <CardTitle>Portfolio Growth</CardTitle>
            <CardDescription>Value over time</CardDescription>
          </CardHeader>
          <CardContent className="h-[420px]">
            {growth && growth.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growth} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={val => {
                      const d = new Date(val);
                      return `${d.toLocaleString("default", { month: "short" })} ${d.getFullYear()}`;
                    }}
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false} axisLine={false} minTickGap={40}
                    angle={-30} textAnchor="end" height={50}
                  />
                  <YAxis
                    tickFormatter={val => val >= 1000000 ? `Rs ${(val/1000000).toFixed(1)}M` : `Rs ${(val/1000).toFixed(0)}k`}
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false} axisLine={false} width={70}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [formatCurrency(value), name === "totalValue" ? "Portfolio Value" : "Amount Invested"]}
                    labelFormatter={label => new Date(label).toLocaleDateString()}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: 13 }}
                  />
                  <Legend
                    formatter={v => v === "totalValue" ? "Portfolio Value" : "Amount Invested"}
                    wrapperStyle={{ fontSize: 13, paddingTop: 8 }}
                  />
                  <Area type="monotone" dataKey="totalValue" name="Portfolio Value" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorValue)" strokeWidth={2.5} dot={false} />
                  <Area type="monotone" dataKey="invested" name="Amount Invested" stroke="hsl(var(--muted-foreground))" fillOpacity={1} fill="url(#colorInvested)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data available</div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-3 lg:col-span-2">
          <CardHeader>
            <CardTitle>Category Performance</CardTitle>
            <CardDescription>Return by asset class</CardDescription>
          </CardHeader>
          <CardContent className="h-[400px]">
            {analytics.categoryPerformance.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.categoryPerformance} layout="vertical" margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} stroke="hsl(var(--border))" />
                  <XAxis
                    type="number"
                    tickFormatter={v => `${v.toFixed(1)}%`}
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false} axisLine={false}
                  />
                  <YAxis
                    dataKey="category"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={val => val.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                    width={90}
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip
                    formatter={(value: number) => [`${Number(value).toFixed(2)}%`, "Return"]}
                    labelFormatter={label => String(label).replace(/_/g, " ")}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: 13 }}
                  />
                  <Bar dataKey="returnPercent" radius={[0, 4, 4, 0]} label={{ position: "right", formatter: (v: number) => `${v.toFixed(1)}%`, fontSize: 12, fill: "hsl(var(--foreground))" }}>
                    {analytics.categoryPerformance.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.returnPercent >= 0 ? "hsl(142 71% 45%)" : "hsl(348 83% 47%)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data available</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PerformanceSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-10 w-64" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-4 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-7 lg:grid-cols-7">
        <Card className="md:col-span-4 lg:col-span-5">
          <CardContent className="p-6">
            <Skeleton className="h-[400px] w-full" />
          </CardContent>
        </Card>
        <Card className="md:col-span-3 lg:col-span-2">
          <CardContent className="p-6">
            <Skeleton className="h-[400px] w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
