import {
  useGetSipConfig, getGetSipConfigQueryKey,
  useGetSipHistory, getGetSipHistoryQueryKey,
  useUpdateSipConfig,
  useRecordSipExecution,
  useCreateTransaction, getGetTransactionsQueryKey,
  useGetAssets, getGetAssetsQueryKey,
} from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calculator, Loader2, Plus, Trash2, AlertCircle,
  PlayCircle, CheckCircle2,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";

interface AssetAlloc {
  assetId: number;
  assetName: string;
  category: string;
  percent: number;
}

type Category = "equity_fund" | "debt_fund" | "metal";

const CATEGORY_LABELS: Record<string, { label: string; color: string; key: string }> = {
  equity_fund: { label: "Equity Funds",        color: "text-blue-500",   key: "equity" },
  debt_fund:   { label: "Debt Funds",           color: "text-purple-500", key: "debt" },
  metal:       { label: "Metals (Gold/Silver)", color: "text-yellow-500", key: "metals" },
};

export default function SipPlanner() {
  const { toast }   = useToast();
  const queryClient = useQueryClient();

  const { data: config, isLoading: isConfigLoading } = useGetSipConfig({ query: { queryKey: getGetSipConfigQueryKey() } });
  const { data: history, isLoading: isHistoryLoading } = useGetSipHistory({ query: { queryKey: getGetSipHistoryQueryKey() } });
  const { data: assets } = useGetAssets({ query: { queryKey: getGetAssetsQueryKey() } });

  const [monthlyAmount, setMonthlyAmount] = useState(0);
  const [equityPercent, setEquityPercent] = useState(60);
  const [debtPercent, setDebtPercent]     = useState(20);
  const [metalsPercent, setMetalsPercent] = useState(10);
  const [opportunityPercent, setOpportunityPercent] = useState(10);
  const [allocs, setAllocs]               = useState<AssetAlloc[]>([]);
  const [initialized, setInitialized]     = useState(false);

  // Execute SIP dialog
  const [showExecute, setShowExecute] = useState(false);
  const [executing, setExecuting]     = useState(false);
  const [execMonth, setExecMonth]     = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    if (config && !initialized) {
      setMonthlyAmount(config.monthlyAmount);
      setEquityPercent(config.equityPercent);
      setDebtPercent(config.debtPercent);
      setMetalsPercent(config.metalsPercent);
      setOpportunityPercent(config.opportunityPercent);
      setAllocs((config.assetAllocations || []) as AssetAlloc[]);
      setInitialized(true);
    }
  }, [config, initialized]);

  const updateSip = useUpdateSipConfig({
    mutation: {
      onSuccess: () => { toast({ title: "SIP configuration saved" }); queryClient.invalidateQueries({ queryKey: getGetSipConfigQueryKey() }); },
      onError: (e: any) => toast({ title: "Failed to save", description: e?.data?.error, variant: "destructive" }),
    }
  });

  const createTx = useCreateTransaction({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetTransactionsQueryKey() }); } } });
  const recordSip = useRecordSipExecution({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetSipHistoryQueryKey() }); } } });

  // Category totals
  const categoryTotal = equityPercent + debtPercent + metalsPercent + opportunityPercent;
  const categoryValid = Math.abs(categoryTotal - 100) < 0.01;

  // Per-category helpers
  const allocsFor = (cat: Category) => allocs.filter(a => a.category === cat);
  const allocTotal = (cat: Category) => allocsFor(cat).reduce((s, a) => s + (Number(a.percent) || 0), 0);
  const allocValid = (cat: Category) => { const t = allocTotal(cat); return allocsFor(cat).length === 0 || Math.abs(t - 100) < 0.01; };
  const allAllocsValid = (["equity_fund", "debt_fund", "metal"] as Category[]).every(allocValid);

  const addAlloc = (cat: Category) => {
    const available = (assets || []).filter(a => a.category === cat && !allocs.find(al => al.assetId === a.id && al.category === cat));
    if (!available.length) return;
    const first = available[0];
    setAllocs(prev => [...prev, { assetId: first.id, assetName: first.name, category: cat, percent: 0 }]);
  };

  const removeAlloc = (cat: Category, idx: number) => {
    const catAllocs = allocsFor(cat);
    const target = catAllocs[idx];
    setAllocs(prev => prev.filter(a => !(a.assetId === target.assetId && a.category === cat)));
  };

  const updateAllocAsset = (cat: Category, idx: number, assetId: number) => {
    const found = assets?.find(a => a.id === assetId);
    if (!found) return;
    const catAllocs = allocsFor(cat);
    const target = catAllocs[idx];
    setAllocs(prev => prev.map(a =>
      (a.assetId === target.assetId && a.category === cat)
        ? { ...a, assetId: found.id, assetName: found.name }
        : a
    ));
  };

  const updateAllocPercent = (cat: Category, idx: number, val: string) => {
    const catAllocs = allocsFor(cat);
    const target = catAllocs[idx];
    setAllocs(prev => prev.map(a =>
      (a.assetId === target.assetId && a.category === cat)
        ? { ...a, percent: Number(val) }
        : a
    ));
  };

  const handleSave = () => {
    if (!categoryValid) { toast({ title: "Category percentages must sum to 100%", variant: "destructive" }); return; }
    if (!allAllocsValid) { toast({ title: "Asset allocations must sum to 100% per category", variant: "destructive" }); return; }
    updateSip.mutate({ data: { monthlyAmount, equityPercent, debtPercent, metalsPercent, opportunityPercent, assetAllocations: allocs } });
  };

  const handleExecuteSip = async () => {
    if (!categoryValid) { toast({ title: "Fix category percentages first", variant: "destructive" }); return; }
    setExecuting(true);
    const today = new Date().toISOString().slice(0, 10);
    const breakdown: { assetId: number; assetName: string; amount: number }[] = [];
    const catAmounts: Record<Category, number> = {
      equity_fund: (monthlyAmount * equityPercent) / 100,
      debt_fund:   (monthlyAmount * debtPercent)   / 100,
      metal:       (monthlyAmount * metalsPercent)  / 100,
    };

    try {
      // Create SIP transactions for each asset allocation
      for (const cat of ["equity_fund", "debt_fund", "metal"] as Category[]) {
        const catAllocs = allocsFor(cat);
        if (catAllocs.length === 0) continue;
        for (const al of catAllocs) {
          const amount = (catAmounts[cat] * al.percent) / 100;
          if (amount <= 0) continue;
          await new Promise<void>((resolve, reject) => {
            createTx.mutate({ data: { type: "sip", amount, assetId: al.assetId, date: today, note: `SIP ${execMonth}` } }, {
              onSuccess: () => resolve(), onError: reject,
            });
          });
          breakdown.push({ assetId: al.assetId, assetName: al.assetName, amount });
        }
      }

      // Opportunity fund allocation: tag_allocation
      if (opportunityPercent > 0) {
        const oppAmount = (monthlyAmount * opportunityPercent) / 100;
        await new Promise<void>((resolve, reject) => {
          createTx.mutate({ data: { type: "tag_allocation", amount: oppAmount, tag: "opportunity", date: today, note: `SIP Opportunity ${execMonth}` } }, {
            onSuccess: () => resolve(), onError: reject,
          });
        });
      }

      // Record SIP history
      await new Promise<void>((resolve, reject) => {
        recordSip.mutate({ data: { month: execMonth, totalAmount: monthlyAmount, breakdown } }, {
          onSuccess: () => resolve(), onError: reject,
        });
      });

      toast({ title: "SIP Executed!", description: `${breakdown.length} transactions created for ${execMonth}.` });
      setShowExecute(false);
    } catch (err: any) {
      toast({ title: "SIP execution failed", description: err?.data?.error || "Some transactions may have been created.", variant: "destructive" });
    } finally {
      setExecuting(false);
    }
  };

  const monthlyEquity    = (monthlyAmount * equityPercent)    / 100;
  const monthlyDebt      = (monthlyAmount * debtPercent)      / 100;
  const monthlyMetals    = (monthlyAmount * metalsPercent)    / 100;
  const monthlyOpportunity = (monthlyAmount * opportunityPercent) / 100;

  if (isConfigLoading || isHistoryLoading) return <SipSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SIP Planner</h1>
          <p className="text-muted-foreground">Configure and execute your systematic investment plan.</p>
        </div>
        <Button variant="default" onClick={() => setShowExecute(true)} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
          <PlayCircle className="h-5 w-5" /> Execute SIP
        </Button>
      </div>

      <Tabs defaultValue="planner">
        <TabsList>
          <TabsTrigger value="planner">Planner</TabsTrigger>
          <TabsTrigger value="history">History ({history?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="planner" className="space-y-6 mt-4">
          {/* Monthly Amount */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" /> Monthly Investment Amount</CardTitle>
              <CardDescription>Total amount you invest each month via SIP.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 max-w-xs">
                <span className="text-muted-foreground font-mono text-sm">LKR</span>
                <Input type="number" value={monthlyAmount} onChange={e => setMonthlyAmount(Number(e.target.value))} min={0} className="text-lg font-bold" />
              </div>
            </CardContent>
          </Card>

          {/* Category Allocation */}
          <Card>
            <CardHeader>
              <CardTitle>Category Allocation</CardTitle>
              <CardDescription>Split across asset categories — must sum to 100%.</CardDescription>
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
                  { label: "Equity Funds",        value: equityPercent,      set: setEquityPercent,      color: "text-blue-500",   amount: monthlyEquity },
                  { label: "Debt Funds",           value: debtPercent,        set: setDebtPercent,        color: "text-purple-500", amount: monthlyDebt },
                  { label: "Metals (Gold/Silver)", value: metalsPercent,      set: setMetalsPercent,      color: "text-yellow-500", amount: monthlyMetals },
                  { label: "Opportunity Fund",     value: opportunityPercent, set: setOpportunityPercent, color: "text-green-500",  amount: monthlyOpportunity },
                ].map(({ label, value, set, color, amount }) => (
                  <div key={label} className="space-y-2 p-4 rounded-lg border bg-card">
                    <div className="flex justify-between items-center">
                      <Label className={`font-semibold ${color}`}>{label}</Label>
                      <Badge variant="outline" className="font-mono">{value}%</Badge>
                    </div>
                    <Input type="number" value={value} onChange={e => set(Number(e.target.value))} min={0} max={100} />
                    <p className="text-xs text-muted-foreground">= {formatCurrency(amount)} / month</p>
                  </div>
                ))}
              </div>
              <div className={`text-sm font-medium text-right pt-2 border-t ${categoryValid ? "text-green-500" : "text-red-500"}`}>
                Total: {categoryTotal}% {categoryValid ? "✓" : `(need ${(100 - categoryTotal).toFixed(1)}% more)`}
              </div>
            </CardContent>
          </Card>

          {/* Sub-allocations for each category */}
          {(["equity_fund", "debt_fund", "metal"] as Category[]).map(cat => {
            const { label, color } = CATEGORY_LABELS[cat];
            const catPercent = cat === "equity_fund" ? equityPercent : cat === "debt_fund" ? debtPercent : metalsPercent;
            const catMonthly = (monthlyAmount * catPercent) / 100;
            const catAssets = (assets || []).filter(a => a.category === cat);
            const catAllocs = allocsFor(cat);
            const total = allocTotal(cat);
            const valid = allocValid(cat);
            if (catAssets.length === 0) return null;

            return (
              <Card key={cat}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className={color}>{label} Sub-allocation</CardTitle>
                      <CardDescription>
                        Split {formatCurrency(catMonthly)}/mo across individual {label.toLowerCase()}. Must sum to 100% if set.
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => addAlloc(cat)} disabled={catAssets.length === catAllocs.length}>
                      <Plus className="h-4 w-4 mr-1" /> Add Fund
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!valid && catAllocs.length > 0 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>Allocations sum to <strong>{total}%</strong>. Must equal 100%.</AlertDescription>
                    </Alert>
                  )}
                  {catAllocs.length === 0 ? (
                    <div className="p-6 text-center text-muted-foreground border rounded-lg bg-muted/10 text-sm">
                      No sub-allocations set. The full {catPercent}% goes equally across all {label.toLowerCase()} by default. Add funds above for precision control.
                    </div>
                  ) : (
                    catAllocs.map((alloc, idx) => {
                      const assetAmount = (catMonthly * alloc.percent) / 100;
                      return (
                        <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/10">
                          <div className="flex-1">
                            <Select value={String(alloc.assetId)} onValueChange={v => updateAllocAsset(cat, idx, Number(v))}>
                              <SelectTrigger><SelectValue placeholder="Select fund" /></SelectTrigger>
                              <SelectContent>
                                {catAssets.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center gap-1 w-28">
                            <Input
                              type="number" value={alloc.percent}
                              onChange={e => updateAllocPercent(cat, idx, e.target.value)}
                              min={0} max={100} className="text-center"
                            />
                            <span className="text-muted-foreground text-sm shrink-0">%</span>
                          </div>
                          <div className="w-28 text-right text-sm text-muted-foreground shrink-0">{formatCurrency(assetAmount)}</div>
                          <Button variant="ghost" size="icon" onClick={() => removeAlloc(cat, idx)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      );
                    })
                  )}
                  {catAllocs.length > 0 && (
                    <div className={`text-sm font-medium text-right pt-2 border-t ${valid ? "text-green-500" : "text-red-500"}`}>
                      Total: {total}% {valid ? "✓" : `(need ${(100 - total).toFixed(1)}% more)`}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* Opportunity allocation note */}
          <Card className="border-green-500/20 bg-green-500/5">
            <CardHeader>
              <CardTitle className="text-green-500 text-base">Opportunity Fund Allocation</CardTitle>
              <CardDescription>
                {formatCurrency(monthlyOpportunity)}/month goes to your opportunity cash tag automatically on Execute SIP.
                Manage the deployment strategy in the Opportunity page.
              </CardDescription>
            </CardHeader>
          </Card>

          <div className="flex justify-end gap-3">
            <Button onClick={handleSave} disabled={updateSip.isPending || !categoryValid}>
              {updateSip.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Configuration
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>SIP Execution History</CardTitle>
              <CardDescription>Past SIP executions and their breakdowns.</CardDescription>
            </CardHeader>
            <CardContent>
              {history && history.length > 0 ? (
                <div className="space-y-4">
                  {history.map(entry => (
                    <div key={entry.id} className="border rounded-lg overflow-hidden">
                      <div className="flex justify-between items-center p-4 bg-muted/20">
                        <div>
                          <div className="font-semibold text-base">{entry.month}</div>
                          <div className="text-xs text-muted-foreground">Executed {new Date(entry.executedAt).toLocaleDateString()}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-primary text-lg">{formatCurrency(entry.totalAmount)}</div>
                          <div className="text-xs text-muted-foreground">{(entry.breakdown || []).length} allocations</div>
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
                <div className="p-10 text-center border rounded-lg bg-muted/10">
                  <CheckCircle2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground font-medium">No SIP history yet.</p>
                  <p className="text-sm text-muted-foreground mt-1">Click "Execute SIP" to run your first SIP and it will appear here.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Execute SIP Dialog */}
      <Dialog open={showExecute} onOpenChange={open => { if (!open) setShowExecute(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Execute SIP</DialogTitle>
            <DialogDescription>
              This will create SIP transactions for all configured asset allocations and record the execution in history.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>SIP Month</Label>
              <Input type="month" value={execMonth} onChange={e => setExecMonth(e.target.value)} />
            </div>
            <div className="rounded-lg border p-4 space-y-2 bg-muted/10">
              <div className="text-sm font-semibold mb-3">Execution Summary</div>
              {[
                { label: "Equity Funds",    amount: monthlyEquity,      pct: equityPercent },
                { label: "Debt Funds",      amount: monthlyDebt,        pct: debtPercent },
                { label: "Metals",          amount: monthlyMetals,      pct: metalsPercent },
                { label: "Opportunity Fund",amount: monthlyOpportunity, pct: opportunityPercent },
              ].map(r => (
                <div key={r.label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{r.label} ({r.pct}%)</span>
                  <span className="font-medium">{formatCurrency(r.amount)}</span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(monthlyAmount)}</span>
              </div>
            </div>
            {!categoryValid && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Fix category percentages before executing.</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExecute(false)}>Cancel</Button>
            <Button
              onClick={handleExecuteSip}
              disabled={executing || !categoryValid}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {executing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <PlayCircle className="mr-2 h-4 w-4" />
              Execute SIP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SipSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <div><Skeleton className="h-10 w-48 mb-2" /><Skeleton className="h-5 w-64" /></div>
        <Skeleton className="h-10 w-36" />
      </div>
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
