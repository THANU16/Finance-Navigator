import { useState } from "react";
import { useGetDashboardSummary, getGetDashboardSummaryQueryKey, useGetDashboardAlerts, getGetDashboardAlertsQueryKey, useGetGrowthChart, getGetGrowthChartQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { AlertCircle, ArrowDownRight, ArrowUpRight, TrendingUp, Wallet, ShieldAlert, BadgeInfo } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid, PieChart, Pie, Cell } from "recharts";

export default function Dashboard() {
  const { data: summary, isLoading: isSummaryLoading } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() }
  });

  const { data: alerts, isLoading: isAlertsLoading } = useGetDashboardAlerts({
    query: { queryKey: getGetDashboardAlertsQueryKey() }
  });

  const { data: growthData, isLoading: isGrowthLoading } = useGetGrowthChart(
    { period: "1y" },
    { query: { queryKey: getGetGrowthChartQueryKey({ period: "1y" }) } }
  );

  if (isSummaryLoading || isAlertsLoading || isGrowthLoading) {
    return <DashboardSkeleton />;
  }

  if (!summary) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">Your complete financial picture.</p>
      </div>

      {alerts && alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <Alert key={alert.id} variant={alert.severity === "critical" ? "destructive" : "default"} className={alert.severity === "warning" ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" : ""}>
              {alert.severity === "critical" && <ShieldAlert className="h-4 w-4" />}
              {alert.severity === "warning" && <AlertCircle className="h-4 w-4" />}
              {alert.severity === "info" && <BadgeInfo className="h-4 w-4" />}
              <AlertTitle className="uppercase tracking-wider text-xs font-semibold">{alert.type}</AlertTitle>
              <AlertDescription>{alert.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Worth</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-value">
              {formatCurrency(summary.totalValue)}
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              Invested: {formatCurrency(summary.investedValue)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Return</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2" data-testid="text-total-return">
              <span className={summary.profitLoss >= 0 ? "text-green-500" : "text-red-500"}>
                {summary.profitLoss >= 0 ? "+" : ""}{formatCurrency(summary.profitLoss)}
              </span>
            </div>
            <div className={`text-xs mt-1 flex items-center gap-1 ${summary.profitLossPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {summary.profitLossPercent >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {formatPercent(summary.profitLossPercent)} all time
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Change</CardTitle>
            <LineChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-monthly-return">
              <span className={summary.monthlyReturn >= 0 ? "text-green-500" : "text-red-500"}>
                {summary.monthlyReturn >= 0 ? "+" : ""}{formatCurrency(summary.monthlyReturn)}
              </span>
            </div>
            <div className={`text-xs mt-1 flex items-center gap-1 ${summary.monthlyReturnPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {summary.monthlyReturnPercent >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {formatPercent(summary.monthlyReturnPercent)} this month
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Free Cash</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-free-cash">
              {formatCurrency(summary.cashAvailable)}
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              Available to deploy
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-7 lg:grid-cols-7">
        <Card className="md:col-span-4 lg:col-span-5">
          <CardHeader>
            <CardTitle>Portfolio Growth (1Y)</CardTitle>
            <CardDescription>Net worth vs invested capital over time</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {growthData && growthData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growthData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => {
                      const d = new Date(val);
                      return `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
                    }}
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={30}
                  />
                  <YAxis 
                    tickFormatter={(val) => `Rs ${val / 1000000}M`}
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <RechartsTooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                  />
                  <Area type="monotone" dataKey="totalValue" name="Current Value" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorValue)" strokeWidth={2} />
                  <Area type="monotone" dataKey="invested" name="Invested" stroke="hsl(var(--muted-foreground))" fillOpacity={1} fill="url(#colorInvested)" strokeWidth={2} strokeDasharray="5 5" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data available</div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-3 lg:col-span-2">
          <CardHeader>
            <CardTitle>Asset Allocation</CardTitle>
            <CardDescription>Current portfolio distribution</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="h-[200px] w-full flex justify-center">
              {summary.allocationByCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={summary.allocationByCategory}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="category"
                      stroke="none"
                    >
                      {summary.allocationByCategory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No assets</div>
              )}
            </div>
            <div className="w-full space-y-2 mt-4">
              {summary.allocationByCategory.map((category) => (
                <div key={category.category} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }}></div>
                    <span className="capitalize">{category.category.replace('_', ' ')}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{formatCurrency(category.value)}</span>
                    <span className="text-muted-foreground w-12 text-right">{category.percent}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Emergency Fund</CardTitle>
            <CardDescription>Target: {formatCurrency(summary.emergencyFundRequired)}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-3xl font-bold">{formatCurrency(summary.emergencyFundCurrent)}</div>
                  <div className="text-sm text-muted-foreground mt-1">Current Balance</div>
                </div>
                <div className="text-xl font-medium">{summary.emergencyFundPercent}%</div>
              </div>
              <Progress 
                value={summary.emergencyFundPercent} 
                className="h-3"
                indicatorClassName={
                  summary.emergencyFundPercent < 50 ? "bg-red-500" :
                  summary.emergencyFundPercent < 80 ? "bg-yellow-500" :
                  "bg-green-500"
                }
              />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Quick Insights</CardTitle>
            <CardDescription>Portfolio intelligence</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Top Performer</span>
                <span className="font-medium capitalize text-green-500">{summary.bestCategory.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Worst Performer</span>
                <span className="font-medium capitalize text-red-500">{summary.worstCategory.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Risk Level</span>
                <span className="font-medium capitalize">{summary.riskLevel}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-5 w-64" />
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
      <div className="grid gap-4 md:grid-cols-7">
        <Card className="md:col-span-4 lg:col-span-5">
          <CardContent className="p-6">
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
        <Card className="md:col-span-3 lg:col-span-2">
          <CardContent className="p-6">
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
