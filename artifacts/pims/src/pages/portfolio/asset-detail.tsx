import { useGetAsset, getGetAssetQueryKey, useGetAssetValuations, getGetAssetValuationsQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useParams, Link } from "wouter";
import { ArrowLeft, TrendingUp, Calendar, Wallet, Percent, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export default function AssetDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0");

  const { data: asset, isLoading: isAssetLoading } = useGetAsset(id, {
    query: { enabled: !!id, queryKey: getGetAssetQueryKey(id) }
  });

  const { data: valuations, isLoading: isValuationsLoading } = useGetAssetValuations(id, {
    query: { enabled: !!id, queryKey: getGetAssetValuationsQueryKey(id) }
  });

  if (isAssetLoading || isValuationsLoading) {
    return <AssetDetailSkeleton />;
  }

  if (!asset) {
    return <div className="p-8 text-center text-muted-foreground">Asset not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/portfolio">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            {asset.name}
            <span className={`text-xs px-2 py-1 rounded-full border font-normal ${
              asset.isActive ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-muted text-muted-foreground'
            }`}>
              {asset.isActive ? 'Active' : 'Inactive'}
            </span>
          </h1>
          <p className="text-muted-foreground capitalize flex items-center gap-2">
            {asset.category.replace('_', ' ')}
            {asset.subCategory && (
              <>
                <span>•</span>
                <span>{asset.subCategory}</span>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Value</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-current-value">
              {formatCurrency(asset.currentValue, asset.currency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Invested: {formatCurrency(asset.investedValue, asset.currency)}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Return</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${asset.profitLoss >= 0 ? 'text-green-500' : 'text-red-500'}`} data-testid="text-profit-loss">
              {asset.profitLoss >= 0 ? '+' : ''}{formatCurrency(asset.profitLoss, asset.currency)}
            </div>
            <p className={`text-xs mt-1 ${asset.profitLossPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatPercent(asset.profitLossPercent)} all time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Allocation</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-allocation">
              {asset.actualPercent}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Target: {asset.targetPercent}%
            </p>
          </CardContent>
        </Card>

        {asset.nav !== null && asset.nav !== undefined ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Latest NAV / Price</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-nav">
                {asset.nav || asset.pricePerUnit || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Units: {asset.units || 0}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="flex items-center justify-center text-muted-foreground">
            <div className="text-sm">No unit data available</div>
          </Card>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Valuation History</CardTitle>
            <CardDescription>Value over time</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            {valuations && valuations.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={valuations.slice().reverse()} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tickFormatter={(val) => `${val / 1000}k`}
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value, asset.currency)}
                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                  />
                  <Area type="monotone" dataKey="value" name="Value" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorValue)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No valuation data</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Entries</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {valuations?.slice(0, 5).map((val) => (
                <div key={val.id} className="p-4 flex justify-between items-center text-sm">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{new Date(val.date).toLocaleDateString()}</span>
                  </div>
                  <div className="font-medium">
                    {formatCurrency(val.value, asset.currency)}
                  </div>
                </div>
              ))}
              {(!valuations || valuations.length === 0) && (
                <div className="p-8 text-center text-muted-foreground text-sm">No entries</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AssetDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-32" />
        </div>
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
      <div className="grid gap-6 md:grid-cols-3">
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
