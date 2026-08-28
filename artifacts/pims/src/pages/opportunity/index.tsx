import {
  useGetOpportunityStatus,
  getGetOpportunityStatusQueryKey,
  useGetDeploymentHistory,
  getGetDeploymentHistoryQueryKey,
  useGetSettings,
  getGetSettingsQueryKey,
  useUpdateSettings,
  useRecordDeployment,
  getGetTransactionsQueryKey,
  useGetAssets,
  getGetAssetsQueryKey,
  useGetAccounts,
  getGetAccountsQueryKey,
} from "@workspace/api-client-react";
import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Loader2,
  TrendingDown,
  Wallet,
  Rocket,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Rule {
  dropPercent: number;
  deployPercent: number;
}

interface AllocationRow {
  assetId: string;
  amount: string;
}

interface DeployForm {
  dropPercent: string;
  sourceAccountId: string;
  note: string;
  deployedAt: string;
  allocations: AllocationRow[];
}

const EMPTY_DEPLOY_FORM: DeployForm = {
  dropPercent: "",
  sourceAccountId: "none",
  note: "",
  deployedAt: new Date().toISOString().slice(0, 10),
  allocations: [{ assetId: "none", amount: "" }],
};

export default function OpportunityFund() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: status, isLoading: isStatusLoading } = useGetOpportunityStatus({
    query: { queryKey: getGetOpportunityStatusQueryKey() },
  });
  const { data: history, isLoading: isHistoryLoading } =
    useGetDeploymentHistory({
      query: { queryKey: getGetDeploymentHistoryQueryKey() },
    });
  const { data: settings, isLoading: isSettingsLoading } = useGetSettings({
    query: { queryKey: getGetSettingsQueryKey() },
  });
  const { data: assets } = useGetAssets({
    query: { queryKey: getGetAssetsQueryKey() },
  });
  const { data: accounts } = useGetAccounts({
    query: { queryKey: getGetAccountsQueryKey() },
  });

  const opportunityAccounts = (accounts || []).filter(
    (a) => a.tag === "opportunity" && a.isActive,
  );
  const investableAssets = (assets || []).filter((a) => a.isActive);

  const [showRulesEditor, setShowRulesEditor] = useState(false);
  const [rules, setRules] = useState<Rule[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editDrop, setEditDrop] = useState("");
  const [editDeploy, setEditDeploy] = useState("");

  // Deploy dialog state
  const [showDeployDialog, setShowDeployDialog] = useState(false);
  const [deployForm, setDeployForm] = useState<DeployForm>(EMPTY_DEPLOY_FORM);
  const [isDeploying, setIsDeploying] = useState(false);

  const updateSettings = useUpdateSettings({
    mutation: {
      onSuccess: () => {
        toast({ title: "Deployment rules updated" });
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        queryClient.invalidateQueries({
          queryKey: getGetOpportunityStatusQueryKey(),
        });
        setShowRulesEditor(false);
      },
      onError: (e: any) =>
        toast({
          title: "Failed to save",
          description: e?.data?.error,
          variant: "destructive",
        }),
    },
  });

  const recordDeployment = useRecordDeployment();

  const openDeployDialog = (stage?: {
    dropPercent: number;
    deployAmount: number;
  }) => {
    setDeployForm({
      ...EMPTY_DEPLOY_FORM,
      dropPercent: stage ? String(stage.dropPercent) : "",
      allocations: [
        {
          assetId: "none",
          amount: stage
            ? String(Math.round(stage.deployAmount * 100) / 100)
            : "",
        },
      ],
      sourceAccountId:
        opportunityAccounts.length === 1
          ? String(opportunityAccounts[0].id)
          : "none",
      deployedAt: new Date().toISOString().slice(0, 10),
    });
    setShowDeployDialog(true);
  };

  const handleDeploy = async () => {
    const dropPercent = parseFloat(deployForm.dropPercent);
    const sourceAccountId =
      deployForm.sourceAccountId && deployForm.sourceAccountId !== "none"
        ? parseInt(deployForm.sourceAccountId)
        : null;

    if (isNaN(dropPercent) || dropPercent <= 0) {
      toast({ title: "Enter a valid drop percentage", variant: "destructive" });
      return;
    }

    const parsedAllocations = deployForm.allocations.map((a) => ({
      assetId: a.assetId && a.assetId !== "none" ? parseInt(a.assetId) : null,
      amount: parseFloat(a.amount),
    }));
    if (parsedAllocations.some((a) => isNaN(a.amount) || a.amount <= 0)) {
      toast({
        title: "All allocation amounts must be greater than 0",
        variant: "destructive",
      });
      return;
    }
    const totalAmount = parsedAllocations.reduce((s, a) => s + a.amount, 0);

    setIsDeploying(true);
    try {
      await new Promise<void>((resolve, reject) => {
        recordDeployment.mutate(
          {
            data: {
              dropPercent,
              sourceAccountId,
              allocations: parsedAllocations,
              note: deployForm.note || null,
              deployedAt: deployForm.deployedAt,
            },
          },
          { onSuccess: () => resolve(), onError: reject },
        );
      });

      toast({
        title: "Deployment recorded!",
        description: `${formatCurrency(totalAmount)} deployed across ${parsedAllocations.length} fund(s).`,
      });
      queryClient.invalidateQueries({
        queryKey: getGetOpportunityStatusQueryKey(),
      });
      queryClient.invalidateQueries({
        queryKey: getGetDeploymentHistoryQueryKey(),
      });
      queryClient.invalidateQueries({ queryKey: getGetAccountsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetTransactionsQueryKey() });
      setShowDeployDialog(false);
    } catch (err: any) {
      toast({
        title: "Deployment failed",
        description: err?.data?.error,
        variant: "destructive",
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const openEditor = () => {
    if (!settings) return;
    const dropLevels: number[] = settings.crashDropLevels || [10, 15, 20, 25];
    const strategy: Record<string, number> =
      settings.crashDeploymentStrategy || {
        "10": 25,
        "15": 50,
        "20": 75,
        "25": 100,
      };
    setRules(
      dropLevels
        .map((drop) => ({
          dropPercent: drop,
          deployPercent: strategy[String(drop)] || 0,
        }))
        .sort((a, b) => a.dropPercent - b.dropPercent),
    );
    setEditingIdx(null);
    setShowRulesEditor(true);
  };

  const addRule = () => {
    setRules((prev) => [...prev, { dropPercent: 0, deployPercent: 0 }]);
    setEditingIdx(rules.length);
    setEditDrop("");
    setEditDeploy("");
  };

  const startEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditDrop(String(rules[idx].dropPercent));
    setEditDeploy(String(rules[idx].deployPercent));
  };

  const confirmEdit = (idx: number) => {
    const drop = parseFloat(editDrop);
    const deploy = parseFloat(editDeploy);
    if (
      isNaN(drop) ||
      isNaN(deploy) ||
      drop <= 0 ||
      deploy <= 0 ||
      deploy > 100
    ) {
      toast({
        title: "Enter valid percentages (drop > 0, deploy 1-100)",
        variant: "destructive",
      });
      return;
    }
    setRules((prev) =>
      prev.map((r, i) =>
        i === idx ? { dropPercent: drop, deployPercent: deploy } : r,
      ),
    );
    setEditingIdx(null);
  };

  const removeRule = (idx: number) =>
    setRules((prev) => prev.filter((_, i) => i !== idx));

  const saveRules = () => {
    const sorted = [...rules].sort((a, b) => a.dropPercent - b.dropPercent);
    const crashDropLevels = sorted.map((r) => r.dropPercent);
    const crashDeploymentStrategy = Object.fromEntries(
      sorted.map((r) => [String(r.dropPercent), r.deployPercent]),
    );
    updateSettings.mutate({
      data: { crashDropLevels, crashDeploymentStrategy },
    });
  };

  if (isStatusLoading || isHistoryLoading || isSettingsLoading)
    return <OpportunitySkeleton />;
  if (!status) return null;

  const triggeredStages = status.stages.filter((s) => s.triggered);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Opportunity Fund
          </h1>
          <p className="text-muted-foreground">
            Capital ready to deploy during market crashes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openEditor} className="gap-2">
            <Pencil className="h-4 w-4" /> Configure Rules
          </Button>
          <Button
            onClick={() => openDeployDialog()}
            className="gap-2 bg-green-600 hover:bg-green-700 text-white"
            disabled={status.availableAmount <= 0}
          >
            <Rocket className="h-4 w-4" /> Record Deployment
          </Button>
        </div>
      </div>

      {triggeredStages.length > 0 && (
        <Alert className="border-primary/50 bg-primary/10">
          <AlertTriangle className="h-4 w-4 text-primary" />
          <AlertTitle className="text-primary">
            Market Drop Detected!
          </AlertTitle>
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-3">
            <span>
              {triggeredStages.length} stage
              {triggeredStages.length > 1 ? "s" : ""} triggered. Consider
              deploying{" "}
              {formatCurrency(
                triggeredStages.reduce((s, t) => s + t.deployAmount, 0),
              )}{" "}
              into your equity positions.
            </span>
            <Button
              size="sm"
              variant="default"
              onClick={() => openDeployDialog(triggeredStages[0])}
              className="shrink-0"
            >
              Deploy Now
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Available Balance
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {formatCurrency(status.availableAmount)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              In opportunity-tagged accounts
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Deployed
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatCurrency(status.totalDeployed)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Deployed to date
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{status.stages.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {triggeredStages.length} triggered
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Deployment Strategy */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Deployment Strategy</CardTitle>
              <CardDescription>
                Deploy {formatCurrency(status.availableAmount)} across market
                crash scenarios.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={openEditor}
              className="gap-1"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {status.stages.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground border rounded-lg bg-muted/10">
              No deployment rules configured. Click "Configure Rules" to add
              market crash deployment levels.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {status.stages.map((stage, idx) => (
                <Card
                  key={idx}
                  className={`${stage.triggered ? "border-primary/60 bg-primary/5" : ""}`}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="flex justify-between items-center text-base">
                      <span className="flex items-center gap-1.5">
                        <TrendingDown className="h-4 w-4 text-muted-foreground" />
                        Drop {stage.dropPercent}%
                      </span>
                      {stage.triggered ? (
                        <Badge variant="default" className="text-xs">
                          Triggered
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-xs text-muted-foreground"
                        >
                          Waiting
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Deploy {stage.deployPercent}% of fund
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-2xl font-bold text-primary">
                      {formatCurrency(stage.deployAmount)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      = {stage.deployPercent}% of{" "}
                      {formatCurrency(status.availableAmount)}
                    </div>
                    {stage.triggered && stage.triggeredAt && (
                      <div className="text-xs text-primary">
                        Deployed{" "}
                        {new Date(stage.triggeredAt).toLocaleDateString()}
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant={stage.triggered ? "outline" : "default"}
                      className="w-full gap-1"
                      onClick={() => openDeployDialog(stage)}
                      disabled={status.availableAmount <= 0}
                    >
                      <Rocket className="h-3.5 w-3.5" />
                      {stage.triggered ? "Deploy Again" : "Deploy"}
                    </Button>
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
          <CardDescription>
            All recorded market crash deployments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {history && history.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground bg-muted/20 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Drop Trigger</th>
                    <th className="px-4 py-3 font-medium text-right">
                      Total Deployed
                    </th>
                    <th className="px-4 py-3 font-medium">Allocations</th>
                    <th className="px-4 py-3 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {history.map((dep) => (
                    <tr
                      key={dep.id}
                      className="hover:bg-muted/20 transition-colors align-top"
                    >
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(dep.deployedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className="text-red-500 border-red-500/30"
                        >
                          {dep.dropPercent}% drop
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-primary">
                        {formatCurrency(dep.deployedAmount)}
                      </td>
                      <td className="px-4 py-3">
                        {dep.allocations && dep.allocations.length > 0 ? (
                          <div className="space-y-0.5">
                            {dep.allocations.map((alloc, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-2 text-xs"
                              >
                                <span className="text-muted-foreground">
                                  {alloc.assetName || "Unspecified"}
                                </span>
                                <span className="font-medium">
                                  {formatCurrency(alloc.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {dep.note || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground border rounded-lg bg-muted/10">
              No deployments recorded yet.
              <div className="mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openDeployDialog()}
                  className="gap-1"
                >
                  <Rocket className="h-4 w-4" /> Record First Deployment
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configure Rules Dialog */}
      <Dialog
        open={showRulesEditor}
        onOpenChange={(open) => {
          if (!open) setShowRulesEditor(false);
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configure Deployment Rules</DialogTitle>
            <DialogDescription>
              Set how much of your opportunity fund to deploy at each market
              drop level. The deploy % applies to your current available
              balance.
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
                      <Input
                        type="number"
                        value={editDrop}
                        onChange={(e) => setEditDrop(e.target.value)}
                        placeholder="e.g. 10"
                        className="h-8 text-sm"
                        min={1}
                        max={99}
                      />
                      <span className="text-muted-foreground text-sm shrink-0">
                        %
                      </span>
                    </div>
                    <div className="col-span-4 flex items-center gap-1">
                      <Input
                        type="number"
                        value={editDeploy}
                        onChange={(e) => setEditDeploy(e.target.value)}
                        placeholder="e.g. 25"
                        className="h-8 text-sm"
                        min={1}
                        max={100}
                      />
                      <span className="text-muted-foreground text-sm shrink-0">
                        %
                      </span>
                    </div>
                    <div className="col-span-2 text-xs text-muted-foreground">
                      {formatCurrency(
                        (status.availableAmount *
                          parseFloat(editDeploy || "0")) /
                          100,
                      )}
                    </div>
                    <div className="col-span-2 flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => confirmEdit(idx)}
                      >
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setEditingIdx(null)}
                      >
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="col-span-4">
                      <Badge
                        variant="outline"
                        className="text-red-500 border-red-500/30"
                      >
                        {rule.dropPercent}% drop
                      </Badge>
                    </div>
                    <div className="col-span-4 text-sm font-medium">
                      {rule.deployPercent}%
                    </div>
                    <div className="col-span-3 text-xs text-muted-foreground">
                      {formatCurrency(
                        (status.availableAmount * rule.deployPercent) / 100,
                      )}
                    </div>
                    <div className="col-span-1 flex gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => startEdit(idx)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removeRule(idx)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}

            <Button
              variant="outline"
              size="sm"
              onClick={addRule}
              className="w-full gap-1 mt-2"
            >
              <Plus className="h-4 w-4" /> Add Rule
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRulesEditor(false)}>
              Cancel
            </Button>
            <Button onClick={saveRules} disabled={updateSettings.isPending}>
              {updateSettings.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Rules
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Deployment Dialog */}
      <Dialog
        open={showDeployDialog}
        onOpenChange={(open) => {
          if (!open) setShowDeployDialog(false);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Deployment</DialogTitle>
            <DialogDescription>
              Record opportunity fund capital deployed during a market crash. An
              invest transaction will be created to debit your opportunity
              account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Market Drop Trigger (%)</Label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={deployForm.dropPercent}
                    onChange={(e) =>
                      setDeployForm((f) => ({
                        ...f,
                        dropPercent: e.target.value,
                      }))
                    }
                    placeholder="e.g. 15"
                    min={1}
                    max={99}
                  />
                  <span className="text-muted-foreground text-sm shrink-0">
                    %
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Source Account</Label>
                <Select
                  value={deployForm.sourceAccountId}
                  onValueChange={(v) =>
                    setDeployForm((f) => ({ ...f, sourceAccountId: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      No account (just record)
                    </SelectItem>
                    {opportunityAccounts.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.name} — {formatCurrency(a.balance)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Per-fund allocations */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Fund Allocations</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1 h-7 text-xs"
                  onClick={() =>
                    setDeployForm((f) => ({
                      ...f,
                      allocations: [
                        ...f.allocations,
                        { assetId: "none", amount: "" },
                      ],
                    }))
                  }
                >
                  <Plus className="h-3 w-3" /> Add Fund
                </Button>
              </div>
              <div className="space-y-2">
                {deployForm.allocations.map((alloc, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 border rounded-lg bg-muted/10"
                  >
                    <div className="flex-1">
                      <Select
                        value={alloc.assetId}
                        onValueChange={(v) =>
                          setDeployForm((f) => ({
                            ...f,
                            allocations: f.allocations.map((a, i) =>
                              i === idx ? { ...a, assetId: v } : a,
                            ),
                          }))
                        }
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select fund (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No specific fund</SelectItem>
                          {investableAssets.map((a) => (
                            <SelectItem key={a.id} value={String(a.id)}>
                              {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-1 w-32 shrink-0">
                      <span className="text-muted-foreground text-xs shrink-0">
                        LKR
                      </span>
                      <Input
                        type="number"
                        className="h-8 text-sm"
                        value={alloc.amount}
                        onChange={(e) =>
                          setDeployForm((f) => ({
                            ...f,
                            allocations: f.allocations.map((a, i) =>
                              i === idx ? { ...a, amount: e.target.value } : a,
                            ),
                          }))
                        }
                        placeholder="0.00"
                        min={0}
                      />
                    </div>
                    {deployForm.allocations.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() =>
                          setDeployForm((f) => ({
                            ...f,
                            allocations: f.allocations.filter(
                              (_, i) => i !== idx,
                            ),
                          }))
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {/* Running total */}
              <div className="text-sm font-medium text-right pt-1 border-t">
                Total:{" "}
                <span className="text-primary">
                  {formatCurrency(
                    deployForm.allocations.reduce(
                      (s, a) => s + (parseFloat(a.amount) || 0),
                      0,
                    ),
                  )}
                </span>
                {status && (
                  <span className="text-muted-foreground text-xs ml-2">
                    (available: {formatCurrency(status.availableAmount)})
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Deployment Date</Label>
              <Input
                type="date"
                value={deployForm.deployedAt}
                onChange={(e) =>
                  setDeployForm((f) => ({ ...f, deployedAt: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>
                Note{" "}
                <span className="text-muted-foreground text-xs">
                  (optional)
                </span>
              </Label>
              <Textarea
                value={deployForm.note}
                onChange={(e) =>
                  setDeployForm((f) => ({ ...f, note: e.target.value }))
                }
                placeholder="e.g. Buying index funds during correction"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeployDialog(false)}
              disabled={isDeploying}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeploy}
              disabled={isDeploying}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isDeploying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Rocket className="mr-2 h-4 w-4" />
              Record Deployment
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
        <div>
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-5 w-40" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
