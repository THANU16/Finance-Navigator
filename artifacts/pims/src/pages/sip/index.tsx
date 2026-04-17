import { useGetSipConfig, getGetSipConfigQueryKey, useGetSipHistory, getGetSipHistoryQueryKey, useUpdateSipConfig, useGetAssets, getGetAssetsQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Calculator, Loader2, Plus, Trash2, AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AssetAlloc {
  assetId: number;
  assetName: string;
  category: string;
  percent: number;
}

export default function SipPlanner() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: config, isLoading: isConfigLoading } = useGetSipConfig({
    query: { queryKey: getGetSipConfigQueryKey() }
  });
  const { data: history, isLoading: isHistoryLoading } = useGetSipHistory({
    query: { queryKey: getGetSipHistoryQueryKey() }
  });
  const { data: assets } = useGetAssets({ query: { queryKey: getGetAssetsQueryKey() } });

  const [monthlyAmount, setMonthlyAmount] = useState(0);
  const [equityPercent, setEquityPercent] = useState(60);
  const [debtPercent, setDebtPercent] = useState(20);
  const [metalsPercent, setMetalsPercent] = useState(10);
  const [opportunityPercent, setOpportunityPercent] = useState(10);
  const [assetAllocations, setAssetAllocations] = useState<AssetAlloc[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (config && !initialized) {
      setMonthlyAmount(config.monthlyAmount);
      setEquityPercent(config.equityPercent);
      setDebtPercent(config.debtPercent);
      setMetalsPercent(config.metalsPercent);
      setOpportunityPercent(config.opportunityPercent);
      setAssetAllocations((config.assetAllocations || []) as AssetAlloc[]);
      setInitialized(true);
    }
  }, [config, initialized]);

  const updateMutation = useUpdateSipConfig({
    mutation: {
      onSuccess: () => {
        toast({ title: "SIP configuration saved" });
        queryClient.invalidateQueries({ queryKey: getGetSipConfigQueryKey() });
      },
      onError: (error: any) => {
        toast({ title: "Failed to save", description: error?.data?.error, variant: "destructive" });
      }
    }
  });

  const categoryTotal = equityPercent + debtPercent + metalsPercent + opportunityPercent;
  const categoryValid = categoryTotal === 100;

  const equityAssets = assets?.filter(a => a.category === "equity_fund") || [];
  const allocTotal = assetAllocations.reduce((s, a) => s + (Number(a.percent) || 0), 0);
  const allocValid = assetAllocations.length === 0 || allocTotal === 100;

  const addAllocation = () => {
    const unused = equityAssets.find(a => !assetAllocations.find(al => al.assetId === a.id));
    if (!unused) return;
    setAssetAllocations(prev => [...prev, {
      assetId: unused.id,
      assetName: unused.name,
      category: unused.category,
      percent: 0,
    }]);
  };

  const removeAllocation = (idx: number) => {
    setAssetAllocations(prev => prev.filter((_, i) => i !== idx));
  };

  const updateAllocAsset = (idx: number, assetId: number) => {
    const found = assets?.find(a => a.id === assetId);
    if (!found) return;
    setAssetAllocations(prev => prev.map((a, i) => i === idx ? { ...a, assetId: found.id, assetName: found.name, category: found.category } : a));
  };

  const updateAllocPercent = (idx: number, val: string) => {
    setAssetAllocations(prev => prev.map((a, i) => i === idx ? { ...a, percent: Number(val) } : a));
  };

  const handleSave = () => {
    if (!categoryValid) {
      toast({ title: "Category percentages must sum to 100%", variant: "destructive" }); return;
    }
    if (!allocValid) {
      toast({ title: "Asset allocations must sum to 100%", variant: "destructive" }); return;
    }
    updateMutation.mutate({
      data: { monthlyAmount, equityPercent, debtPercent, metalsPercent, opportunityPercent, assetAllocations }
    });
  };

  const monthlyEquity = (monthlyAmount * equityPercent) / 100;
  const monthlyDebt = (monthlyAmount * debtPercent) / 100;
  const monthlyMetals = (monthlyAmount * metalsPercent) / 100;
  const monthlyOpportunity = (monthlyAmount * opportunityPercent) / 100;

  if (isConfigLoading || isHistoryLoading) return <SipSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">SIP Planner</h1>
        <p className="text-muted-foreground">Configure your monthly systematic investment plan.</p>
      </div>

      <Tabs defaultValue="planner">
        <TabsList>
          <TabsTrigger value="planner">Planner</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="planner" className="space-y-6 mt-4">
          {/* Monthly Amount */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" /> Monthly Investment Amount
              </CardTitle>
              <CardDescription>Total amount you plan to invest each month.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 max-w-xs">
                <span className="text-muted-foreground font-mono text-sm">LKR</span>
                <Input
                  type="number"
                  value={monthlyAmount}
                  onChange={e => setMonthlyAmount(Number(e.target.value))}
                  min={0}
                  className="text-lg font-bold"
                />
              </div>
            </CardContent>
          </Card>

          {/* Category Allocation */}
          <Card>
            <CardHeader>
              <CardTitle>Category Allocation</CardTitle>
              <CardDescription>How to split your monthly amount across asset categories. Must sum to 100%.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!categoryValid && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Percentages sum to <strong>{categoryTotal}%</strong>. Must equal 100%.</AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: "Equity Funds", value: equityPercent, set: setEquityPercent, color: "text-blue-500", amount: monthlyEquity },
                  { label: "Debt Funds", value: debtPercent, set: setDebtPercent, color: "text-purple-500", amount: monthlyDebt },
                  { label: "Metals (Gold/Silver)", value: metalsPercent, set: setMetalsPercent, color: "text-yellow-500", amount: monthlyMetals },
                  { label: "Opportunity Fund", value: opportunityPercent, set: setOpportunityPercent, color: "text-green-500", amount: monthlyOpportunity },
                ].map(({ label, value, set, color, amount }) => (
                  <div key={label} className="space-y-2 p-4 rounded-lg border bg-card">
                    <div className="flex justify-between items-center">
                      <Label className={`font-semibold ${color}`}>{label}</Label>
                      <Badge variant="outline" className="font-mono">{value}%</Badge>
                    </div>
                    <Input
                      type="number"
                      value={value}
                      onChange={e => set(Number(e.target.value))}
                      min={0}
                      max={100}
                    />
                    <p className="text-xs text-muted-foreground">
                      = {formatCurrency(amount)} / month
                    </p>
                  </div>
                ))}
              </div>
              <div className={`text-sm font-medium text-right pt-2 border-t ${categoryValid ? 'text-green-500' : 'text-red-500'}`}>
                Total: {categoryTotal}% {categoryValid ? "✓" : `(need ${100 - categoryTotal}% more)`}
              </div>
            </CardContent>
          </Card>

          {/* Asset-level allocation for Equity */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Equity Fund Allocation</CardTitle>
                  <CardDescription>How to split the equity portion across individual funds. Must sum to 100% if set.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={addAllocation} disabled={equityAssets.length === assetAllocations.length}>
                  <Plus className="h-4 w-4 mr-1" /> Add Fund
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {!allocValid && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Fund allocations sum to <strong>{allocTotal}%</strong>. Must equal 100%.</AlertDescription>
                </Alert>
              )}
              {assetAllocations.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground border rounded-lg bg-muted/20 text-sm">
                  No fund allocations set. Add funds above to specify how equity is distributed.
                </div>
              ) : (
                assetAllocations.map((alloc, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/10">
                    <div className="flex-1">
                      <Select value={String(alloc.assetId)} onValueChange={v => updateAllocAsset(idx, Number(v))}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select fund" />
                        </SelectTrigger>
                        <SelectContent>
                          {equityAssets.map(a => (
                            <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-24 flex items-center gap-1">
                      <Input
                        type="number"
                        value={alloc.percent}
                        onChange={e => updateAllocPercent(idx, e.target.value)}
                        min={0}
                        max={100}
                        className="text-center"
                      />
                      <span className="text-muted-foreground text-sm">%</span>
                    </div>
                    <div className="w-28 text-right text-sm text-muted-foreground">
                      {formatCurrency((monthlyEquity * alloc.percent) / 100)}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeAllocation(idx)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))
              )}
              {assetAllocations.length > 0 && (
                <div className={`text-sm font-medium text-right pt-2 border-t ${allocValid ? 'text-green-500' : 'text-red-500'}`}>
                  Total: {allocTotal}% {allocValid ? "✓" : `(need ${100 - allocTotal}% more)`}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button onClick={handleSave} disabled={updateMutation.isPending || !categoryValid}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Configuration
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Execution History</CardTitle>
              <CardDescription>Past SIP executions and breakdowns.</CardDescription>
            </CardHeader>
            <CardContent>
              {history && history.length > 0 ? (
                <div className="space-y-4">
                  {history.map((entry) => (
                    <div key={entry.id} className="border rounded-lg overflow-hidden">
                      <div className="flex justify-between items-center p-4 bg-muted/20">
                        <div>
                          <div className="font-semibold">{entry.month}</div>
                          <div className="text-xs text-muted-foreground">
                            Executed {new Date(entry.executedAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-primary">{formatCurrency(entry.totalAmount)}</div>
                        </div>
                      </div>
                      {entry.breakdown && entry.breakdown.length > 0 && (
                        <div className="divide-y divide-border">
                          {entry.breakdown.map((b, i) => (
                            <div key={i} className="flex justify-between px-4 py-2 text-sm">
                              <span className="text-muted-foreground">{b.assetName}</span>
                              <span className="font-medium">{formatCurrency(b.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground border rounded bg-muted/20 text-sm">
                  No SIP history found. Once you record executions they will appear here.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SipSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-6 w-64" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
