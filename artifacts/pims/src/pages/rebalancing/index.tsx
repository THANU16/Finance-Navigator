import { useGetRebalancingStatus, getGetRebalancingStatusQueryKey, useUpdateRebalancingTargets } from "@workspace/api-client-react";
import { formatPercent } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, ReferenceLine } from "recharts";
import { AlertCircle, SlidersHorizontal, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function Rebalancing() {
  const { data: status, isLoading } = useGetRebalancingStatus({
    query: { queryKey: getGetRebalancingStatusQueryKey() }
  });

  if (isLoading) {
    return <RebalancingSkeleton />;
  }

  if (!status) return null;

  const chartData = status.categories.map(c => ({
    name: c.category.replace('_', ' '),
    target: c.targetPercent,
    actual: c.actualPercent,
    drift: c.drift,
    status: c.status
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Rebalancing</h1>
        <p className="text-muted-foreground">Monitor portfolio drift and realign to targets.</p>
      </div>

      {status.needsRebalancing ? (
        <Alert variant="destructive" className="border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Rebalancing Required</AlertTitle>
          <AlertDescription>
            Your portfolio has drifted significantly from target allocations. Overall drift is {formatPercent(status.overallDrift)}.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-green-500/50 bg-green-500/10 text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Portfolio Balanced</AlertTitle>
          <AlertDescription>
            Your allocations are within acceptable limits. Overall drift is {formatPercent(status.overallDrift)}.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Category Drift</CardTitle>
            <CardDescription>Difference between target and actual allocation</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))', textTransform: 'capitalize' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  tickFormatter={(val) => `${val}%`}
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip 
                  formatter={(value: number) => `${value.toFixed(2)}%`}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                />
                <ReferenceLine y={0} stroke="hsl(var(--border))" />
                <Bar dataKey="drift" name="Drift" radius={[4, 4, 4, 4]}>
                  {chartData.map((entry, index) => {
                    let fill = "hsl(142 71% 45%)"; // balanced - green
                    if (entry.status === "overweight") fill = "hsl(348 83% 47%)"; // overweight - red
                    else if (entry.status === "underweight") fill = "hsl(217 91% 60%)"; // underweight - blue
                    
                    return <Cell key={`cell-${index}`} fill={fill} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Suggestions</CardTitle>
            <CardDescription>Recommended actions to realign</CardDescription>
          </CardHeader>
          <CardContent>
            {status.suggestions.length > 0 ? (
              <div className="space-y-4">
                {status.suggestions.map((suggestion, index) => (
                  <div key={index} className="flex items-start gap-3 text-sm">
                    <div className={`mt-0.5 rounded-full p-1 flex-shrink-0 ${
                      suggestion.priority === 'high' ? 'bg-red-500/20 text-red-500' :
                      suggestion.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-500' :
                      'bg-blue-500/20 text-blue-500'
                    }`}>
                      <SlidersHorizontal className="h-3 w-3" />
                    </div>
                    <div>
                      <div className="font-medium capitalize">{suggestion.type.replace('_', ' ')}</div>
                      <div className="text-muted-foreground">{suggestion.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center h-full">
                <CheckCircle2 className="h-12 w-12 text-green-500/50 mb-3" />
                <p className="text-muted-foreground">No actions required. Portfolio is well balanced.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Detailed Allocations</h3>
        {status.categories.map((category) => (
          <Card key={category.category} className="overflow-hidden">
            <div className="bg-muted/50 border-b border-border p-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <h4 className="font-semibold capitalize text-lg">{category.category.replace('_', ' ')}</h4>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${
                  category.status === 'overweight' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                  category.status === 'underweight' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                  'bg-green-500/10 text-green-500 border-green-500/20'
                }`}>
                  {category.status}
                </span>
              </div>
              <div className="text-sm">
                Target: <strong>{category.targetPercent}%</strong> | 
                Actual: <strong>{category.actualPercent}%</strong> | 
                Drift: <strong className={
                  category.drift > 0 ? "text-red-500" : category.drift < 0 ? "text-blue-500" : "text-green-500"
                }>{category.drift > 0 ? '+' : ''}{category.drift}%</strong>
              </div>
            </div>
            {category.assets.length > 0 && (
              <div className="p-0">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground bg-muted/20 border-b border-border">
                    <tr>
                      <th className="px-6 py-3 font-medium">Asset</th>
                      <th className="px-6 py-3 font-medium text-right">Target</th>
                      <th className="px-6 py-3 font-medium text-right">Actual</th>
                      <th className="px-6 py-3 font-medium text-right">Drift</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {category.assets.map((asset) => (
                      <tr key={asset.assetId}>
                        <td className="px-6 py-3 font-medium">{asset.assetName}</td>
                        <td className="px-6 py-3 text-right">{asset.targetPercent}%</td>
                        <td className="px-6 py-3 text-right">{asset.actualPercent}%</td>
                        <td className={`px-6 py-3 text-right ${asset.drift > 0 ? 'text-red-500' : asset.drift < 0 ? 'text-blue-500' : ''}`}>
                          {asset.drift > 0 ? '+' : ''}{asset.drift}%
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
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-5 w-64" />
      </div>
      <Skeleton className="h-16 w-full" />
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardContent className="p-6">
            <Skeleton className="h-[350px] w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-[350px] w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
