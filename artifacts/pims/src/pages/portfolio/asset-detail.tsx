import {
  useGetAsset, getGetAssetQueryKey,
  useGetAssetValuations, getGetAssetValuationsQueryKey,
  useGetTransactions, getGetTransactionsQueryKey,
  useAddAssetValuation, useDeleteAssetValuation,
} from "@workspace/api-client-react";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useParams, Link } from "wouter";
import { ArrowLeft, TrendingUp, Wallet, Percent, FileText, Plus, Trash2, Loader2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const TX_COLORS: Record<string, string> = {
  invest: "text-blue-500",
  redeem: "text-orange-500",
  sip: "text-green-500",
  deposit: "text-green-600",
  withdrawal: "text-red-500",
  transfer: "text-purple-500",
};

export default function AssetDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showAddValuation, setShowAddValuation] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [newNote, setNewNote] = useState("");

  const { data: asset, isLoading: isAssetLoading } = useGetAsset(id, {
    query: { enabled: !!id, queryKey: getGetAssetQueryKey(id) }
  });

  const { data: valuations, isLoading: isValuationsLoading } = useGetAssetValuations(id, {
    query: { enabled: !!id, queryKey: getGetAssetValuationsQueryKey(id) }
  });

  const { data: transactions, isLoading: isTxLoading } = useGetTransactions(
    { assetId: id },
    { query: { enabled: !!id, queryKey: getGetTransactionsQueryKey({ assetId: id }) } }
  );

  const addValuation = useAddAssetValuation({
    mutation: {
      onSuccess: () => {
        toast({ title: "Valuation added" });
        queryClient.invalidateQueries({ queryKey: getGetAssetValuationsQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetAssetQueryKey(id) });
        setShowAddValuation(false);
        setNewValue("");
        setNewNote("");
      },
      onError: (err: any) => {
        toast({ title: "Failed to add valuation", description: err?.data?.error, variant: "destructive" });
      }
    }
  });

  const deleteValuation = useDeleteAssetValuation({
    mutation: {
      onSuccess: () => {
        toast({ title: "Valuation deleted" });
        queryClient.invalidateQueries({ queryKey: getGetAssetValuationsQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetAssetQueryKey(id) });
      }
    }
  });

  const handleAddValuation = () => {
    if (!newValue || !newDate) return;
    addValuation.mutate({ assetId: id, data: { value: Number(newValue), date: newDate, note: newNote || undefined } });
  };

  if (isAssetLoading || isValuationsLoading) return <AssetDetailSkeleton />;

  if (!asset) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        <p className="text-lg">Asset not found.</p>
        <Link href="/portfolio"><Button className="mt-4" variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Portfolio</Button></Link>
      </div>
    );
  }

  const chartData = valuations ? [...valuations].sort((a, b) => a.date.localeCompare(b.date)) : [];
  const profitLoss = Number(asset.profitLoss) || 0;
  const profitLossPercent = Number(asset.profitLossPercent) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/portfolio">
          <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex flex-wrap items-center gap-3">
            {asset.name}
            <Badge variant={asset.isActive ? "default" : "secondary"} className="text-xs font-normal">
              {asset.isActive ? "Active" : "Inactive"}
            </Badge>
          </h1>
          <p className="text-muted-foreground capitalize text-sm mt-1 flex items-center gap-2">
            <span>{asset.category.replace(/_/g, " ")}</span>
            {asset.subCategory && (<><span>•</span><span>{asset.subCategory}</span></>)}
            <span>•</span>
            <span>{asset.currency}</span>
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Value</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(asset.currentValue, asset.currency)}</div>
            <p className="text-xs text-muted-foreground mt-1">Invested: {formatCurrency(asset.investedValue, asset.currency)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Return</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold flex items-center gap-1 ${profitLoss >= 0 ? "text-green-500" : "text-red-500"}`}>
              {profitLoss >= 0 ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
              {formatCurrency(Math.abs(profitLoss), asset.currency)}
            </div>
            <p className={`text-xs mt-1 ${profitLoss >= 0 ? "text-green-500" : "text-red-500"}`}>
              {formatPercent(profitLossPercent)} all time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Allocation</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Number(asset.actualPercent).toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">Target: {asset.targetPercent}%</p>
          </CardContent>
        </Card>

        {(asset.nav !== null && asset.nav !== undefined) || asset.pricePerUnit ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">NAV / Price</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(Number(asset.nav || asset.pricePerUnit), asset.currency)}</div>
              <p className="text-xs text-muted-foreground mt-1">Units: {Number(asset.units || 0).toLocaleString()}</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Units</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Number(asset.units || 0).toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">No NAV data</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Performance chart + Valuation log */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Valuation History</CardTitle>
            <CardDescription>Value over time based on logged snapshots</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="assetGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={v => new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false} axisLine={false}
                  />
                  <YAxis
                    tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false} axisLine={false} width={50}
                  />
                  <Tooltip
                    formatter={(v: number) => [formatCurrency(v, asset.currency), "Value"]}
                    labelFormatter={l => new Date(l).toLocaleDateString()}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                  />
                  <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="url(#assetGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground text-sm">
                <p>No valuation snapshots yet.</p>
                <Button variant="outline" size="sm" onClick={() => setShowAddValuation(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Add First Valuation
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Snapshots</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowAddValuation(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border max-h-[280px] overflow-y-auto">
              {valuations && valuations.length > 0 ? (
                valuations.slice(0, 10).map(val => (
                  <div key={val.id} className="px-4 py-3 flex justify-between items-center text-sm group">
                    <div>
                      <div className="font-medium">{formatCurrency(val.value, asset.currency)}</div>
                      <div className="text-xs text-muted-foreground">{new Date(val.date).toLocaleDateString()}</div>
                    </div>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => deleteValuation.mutate({ assetId: id, valuationId: val.id })}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-muted-foreground text-sm">No snapshots</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>All transactions linked to this asset</CardDescription>
        </CardHeader>
        <CardContent>
          {isTxLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : transactions && transactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border">
                    <th className="text-left py-2 px-3 font-medium">Date</th>
                    <th className="text-left py-2 px-3 font-medium">Type</th>
                    <th className="text-right py-2 px-3 font-medium">Amount</th>
                    <th className="text-left py-2 px-3 font-medium hidden sm:table-cell">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-3 text-muted-foreground">
                        {new Date(tx.date).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant="outline" className={`capitalize text-xs ${TX_COLORS[tx.type] || ""}`}>
                          {tx.type}
                        </Badge>
                      </td>
                      <td className={`py-3 px-3 text-right font-semibold ${tx.type === "redeem" || tx.type === "withdrawal" ? "text-red-500" : "text-green-500"}`}>
                        {tx.type === "redeem" || tx.type === "withdrawal" ? "-" : "+"}
                        {formatCurrency(tx.amount, asset.currency)}
                      </td>
                      <td className="py-3 px-3 text-muted-foreground hidden sm:table-cell text-xs">
                        {tx.note || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground text-sm border rounded-lg bg-muted/10">
              No transactions recorded for this asset yet.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Valuation Dialog */}
      <Dialog open={showAddValuation} onOpenChange={setShowAddValuation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Valuation Snapshot</DialogTitle>
            <DialogDescription>Record the current value of {asset.name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Value ({asset.currency})</Label>
              <Input
                type="number"
                placeholder="e.g. 250000"
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                min={0}
              />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Input placeholder="e.g. End of month NAV" value={newNote} onChange={e => setNewNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddValuation(false)}>Cancel</Button>
            <Button onClick={handleAddValuation} disabled={!newValue || !newDate || addValuation.isPending}>
              {addValuation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Snapshot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}><CardHeader className="pb-2"><Skeleton className="h-5 w-24" /></CardHeader>
            <CardContent><Skeleton className="h-8 w-32 mb-2" /><Skeleton className="h-4 w-20" /></CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardContent className="p-6"><Skeleton className="h-[300px] w-full" /></CardContent></Card>
        <Card><CardContent className="p-6"><Skeleton className="h-[300px] w-full" /></CardContent></Card>
      </div>
      <Card><CardContent className="p-6"><Skeleton className="h-[200px] w-full" /></CardContent></Card>
    </div>
  );
}
