import {
  useGetOpportunityStatus, getGetOpportunityStatusQueryKey,
  useGetDeploymentHistory, getGetDeploymentHistoryQueryKey,
  useGetSettings, getGetSettingsQueryKey,
  useUpdateSettings,
} from "@workspace/api-client-react";
import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Plus, Trash2, Pencil, Check, X, Loader2, TrendingDown, Wallet } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface Rule { dropPercent: number; deployPercent: number; }

export default function OpportunityFund() {
  const { toast }   = useToast();
  const queryClient = useQueryClient();

  const { data: status, isLoading: isStatusLoading }  = useGetOpportunityStatus({ query: { queryKey: getGetOpportunityStatusQueryKey() } });
  const { data: history, isLoading: isHistoryLoading } = useGetDeploymentHistory({ query: { queryKey: getGetDeploymentHistoryQueryKey() } });
  const { data: settings, isLoading: isSettingsLoading } = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });

  const [showRulesEditor, setShowRulesEditor] = useState(false);
  const [rules, setRules]                     = useState<Rule[]>([]);
  const [editingIdx, setEditingIdx]           = useState<number | null>(null);
  const [editDrop, setEditDrop]               = useState("");
  const [editDeploy, setEditDeploy]           = useState("");

  const updateSettings = useUpdateSettings({
    mutation: {
      onSuccess: () => {
        toast({ title: "Deployment rules updated" });
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetOpportunityStatusQueryKey() });
        setShowRulesEditor(false);
      },
      onError: (e: any) => toast({ title: "Failed to save", description: e?.data?.error, variant: "destructive" }),
    }
  });

  const openEditor = () => {
    if (!settings) return;
    const dropLevels: number[] = settings.crashDropLevels || [10, 15, 20, 25];
    const strategy: Record<string, number> = settings.crashDeploymentStrategy || { "10": 25, "15": 50, "20": 75, "25": 100 };
    setRules(dropLevels.map(drop => ({ dropPercent: drop, deployPercent: strategy[String(drop)] || 0 })).sort((a, b) => a.dropPercent - b.dropPercent));
    setEditingIdx(null);
    setShowRulesEditor(true);
  };

  const addRule = () => { setRules(prev => [...prev, { dropPercent: 0, deployPercent: 0 }]); setEditingIdx(rules.length); setEditDrop(""); setEditDeploy(""); };

  const startEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditDrop(String(rules[idx].dropPercent));
    setEditDeploy(String(rules[idx].deployPercent));
  };

  const confirmEdit = (idx: number) => {
    const drop = parseFloat(editDrop);
    const deploy = parseFloat(editDeploy);
    if (isNaN(drop) || isNaN(deploy) || drop <= 0 || deploy <= 0 || deploy > 100) {
      toast({ title: "Enter valid percentages (drop > 0, deploy 1-100)", variant: "destructive" }); return;
    }
    setRules(prev => prev.map((r, i) => i === idx ? { dropPercent: drop, deployPercent: deploy } : r));
    setEditingIdx(null);
  };

  const removeRule = (idx: number) => setRules(prev => prev.filter((_, i) => i !== idx));

  const saveRules = () => {
    const sorted = [...rules].sort((a, b) => a.dropPercent - b.dropPercent);
    const crashDropLevels = sorted.map(r => r.dropPercent);
    const crashDeploymentStrategy = Object.fromEntries(sorted.map(r => [String(r.dropPercent), r.deployPercent]));
    updateSettings.mutate({ data: { crashDropLevels, crashDeploymentStrategy } });
  };

  if (isStatusLoading || isHistoryLoading || isSettingsLoading) return <OpportunitySkeleton />;
  if (!status) return null;

  const triggeredStages = status.stages.filter(s => s.triggered);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Opportunity Fund</h1>
          <p className="text-muted-foreground">Capital ready to deploy during market crashes.</p>
        </div>
        <Button variant="outline" onClick={openEditor} className="gap-2">
          <Pencil className="h-4 w-4" /> Configure Rules
        </Button>
      </div>

      {triggeredStages.length > 0 && (
        <Alert className="border-primary/50 bg-primary/10">
          <AlertTriangle className="h-4 w-4 text-primary" />
          <AlertTitle className="text-primary">Market Drop Detected!</AlertTitle>
          <AlertDescription>
            {triggeredStages.length} stage{triggeredStages.length > 1 ? "s" : ""} triggered.
            Consider deploying {formatCurrency(triggeredStages.reduce((s, t) => s + t.deployAmount, 0))} into your equity positions.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{formatCurrency(status.availableAmount)}</div>
            <p className="text-xs text-muted-foreground mt-1">In opportunity-tagged accounts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deployed</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(status.totalDeployed)}</div>
            <p className="text-xs text-muted-foreground mt-1">Deployed to date</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{status.stages.length}</div>
            <p className="text-xs text-muted-foreground mt-1">{triggeredStages.length} triggered</p>
          </CardContent>
        </Card>
      </div>

      {/* Deployment Strategy */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Deployment Strategy</CardTitle>
              <CardDescription>Deploy {formatCurrency(status.availableAmount)} across market crash scenarios.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={openEditor} className="gap-1">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {status.stages.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground border rounded-lg bg-muted/10">
              No deployment rules configured. Click "Configure Rules" to add market crash deployment levels.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {status.stages.map((stage, idx) => (
                <Card key={idx} className={`${stage.triggered ? "border-primary/60 bg-primary/5" : ""}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex justify-between items-center text-base">
                      <span className="flex items-center gap-1.5">
                        <TrendingDown className="h-4 w-4 text-muted-foreground" />
                        Drop {stage.dropPercent}%
                      </span>
                      {stage.triggered
                        ? <Badge variant="default" className="text-xs">Triggered</Badge>
                        : <Badge variant="outline" className="text-xs text-muted-foreground">Waiting</Badge>}
                    </CardTitle>
                    <CardDescription>Deploy {stage.deployPercent}% of fund</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">{formatCurrency(stage.deployAmount)}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      = {stage.deployPercent}% of {formatCurrency(status.availableAmount)}
                    </div>
                    {stage.triggered && stage.triggeredAt && (
                      <div className="text-xs text-primary mt-2">
                        Deployed {new Date(stage.triggeredAt).toLocaleDateString()}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deployment History */}
      <Card>
        <CardHeader>
          <CardTitle>Deployment History</CardTitle>
          <CardDescription>All recorded market crash deployments.</CardDescription>
        </CardHeader>
        <CardContent>
          {history && history.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground bg-muted/20 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Drop Trigger</th>
                    <th className="px-4 py-3 font-medium text-right">Amount Deployed</th>
                    <th className="px-4 py-3 font-medium">Target Asset</th>
                    <th className="px-4 py-3 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {history.map(dep => (
                    <tr key={dep.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground">{new Date(dep.deployedAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-red-500 border-red-500/30">{dep.dropPercent}% drop</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-primary">{formatCurrency(dep.deployedAmount)}</td>
                      <td className="px-4 py-3">{dep.assetName || <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{dep.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground border rounded-lg bg-muted/10">
              No deployments recorded yet. Record one when you deploy during a market crash.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configure Rules Dialog */}
      <Dialog open={showRulesEditor} onOpenChange={open => { if (!open) setShowRulesEditor(false); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configure Deployment Rules</DialogTitle>
            <DialogDescription>
              Set how much of your opportunity fund to deploy at each market drop level. The deploy % applies to your current available balance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="grid grid-cols-12 text-xs font-medium text-muted-foreground uppercase border-b pb-2">
              <span className="col-span-4">Drop %</span>
              <span className="col-span-4">Deploy %</span>
              <span className="col-span-3">Amount</span>
              <span className="col-span-1" />
            </div>

            {rules.length === 0 && (
              <div className="py-6 text-center text-muted-foreground text-sm border rounded-lg bg-muted/10">
                No rules. Add your first deployment rule below.
              </div>
            )}

            {rules.map((rule, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                {editingIdx === idx ? (
                  <>
                    <div className="col-span-4 flex items-center gap-1">
                      <Input type="number" value={editDrop} onChange={e => setEditDrop(e.target.value)} placeholder="e.g. 10" className="h-8 text-sm" min={1} max={99} />
                      <span className="text-muted-foreground text-sm shrink-0">%</span>
                    </div>
                    <div className="col-span-4 flex items-center gap-1">
                      <Input type="number" value={editDeploy} onChange={e => setEditDeploy(e.target.value)} placeholder="e.g. 25" className="h-8 text-sm" min={1} max={100} />
                      <span className="text-muted-foreground text-sm shrink-0">%</span>
                    </div>
                    <div className="col-span-2 text-xs text-muted-foreground">
                      {formatCurrency((status.availableAmount * parseFloat(editDeploy || "0")) / 100)}
                    </div>
                    <div className="col-span-2 flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => confirmEdit(idx)}>
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingIdx(null)}>
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="col-span-4">
                      <Badge variant="outline" className="text-red-500 border-red-500/30">{rule.dropPercent}% drop</Badge>
                    </div>
                    <div className="col-span-4 text-sm font-medium">{rule.deployPercent}%</div>
                    <div className="col-span-3 text-xs text-muted-foreground">
                      {formatCurrency((status.availableAmount * rule.deployPercent) / 100)}
                    </div>
                    <div className="col-span-1 flex gap-0.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(idx)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRule(idx)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={addRule} className="w-full gap-1 mt-2">
              <Plus className="h-4 w-4" /> Add Rule
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRulesEditor(false)}>Cancel</Button>
            <Button onClick={saveRules} disabled={updateSettings.isPending}>
              {updateSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Rules
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OpportunitySkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <div><Skeleton className="h-10 w-64 mb-2" /><Skeleton className="h-5 w-40" /></div>
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">{[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}</div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
