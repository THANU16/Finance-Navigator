import {
  useGetAccounts, getGetAccountsQueryKey,
  useGetAccountsSummary, getGetAccountsSummaryQueryKey,
  useCreateAccount, useUpdateAccount, useDeleteAccount,
  useGetAccountValuations, getGetAccountValuationsQueryKey,
  useAddAccountValuation, useUpdateAccountValuation, useDeleteAccountValuation,
  useGetSettings, getGetSettingsQueryKey,
} from "@workspace/api-client-react";
import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, MoreHorizontal, Pencil, Trash2, Building2, Wallet, ArrowUpRight, ArrowDownRight, Loader2, TrendingUp, History } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const ACCOUNT_TYPES = ["bank", "money_market", "cash"];
const ACCOUNT_TAGS  = ["emergency", "opportunity", "free"];
const SUB_CATEGORIES = [
  { value: "none",       label: "—" },
  { value: "savings",    label: "Savings" },
  { value: "investment", label: "Investment (FD / interest-bearing)" },
  { value: "current",    label: "Current / Checking" },
];

interface AccountFormData {
  name: string; type: string; subCategory: string; tag: string; balance: string; currency: string;
}
const EMPTY_FORM: AccountFormData = {
  name: "", type: "bank", subCategory: "savings", tag: "free", balance: "", currency: "LKR"
};

type AccountRow = {
  id: number; name: string; type: string;
  subCategory?: string | null;
  tag: string;
  balance: number;
  currentBalance: number;
  interestEarned: number;
  currency: string;
  isActive?: boolean;
};

export default function Accounts() {
  const { toast }       = useToast();
  const queryClient     = useQueryClient();

  const { data: accounts, isLoading: isAccountsLoading } = useGetAccounts({ query: { queryKey: getGetAccountsQueryKey() } });
  const { data: summary, isLoading: isSummaryLoading }   = useGetAccountsSummary({ query: { queryKey: getGetAccountsSummaryQueryKey() } });
  const { data: settings } = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });

  const [showForm, setShowForm]               = useState(false);
  const [editAcc, setEditAcc]                 = useState<AccountRow | null>(null);
  const [deleteId, setDeleteId]               = useState<number | null>(null);
  const [form, setForm]                       = useState<AccountFormData>(EMPTY_FORM);
  const [valuationsAcc, setValuationsAcc]     = useState<AccountRow | null>(null);

  const set = (k: keyof AccountFormData, v: string) => setForm(f => ({ ...f, [k]: v }));

  const openAdd = () => { setForm(EMPTY_FORM); setEditAcc(null); setShowForm(true); };
  const openEdit = (a: AccountRow) => {
    setEditAcc(a);
    setForm({
      name: a.name, type: a.type,
      subCategory: a.subCategory || "none",
      tag: a.tag, balance: String(a.balance), currency: a.currency,
    });
    setShowForm(true);
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getGetAccountsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetAccountsSummaryQueryKey() });
  };

  const createMutation = useCreateAccount({
    mutation: {
      onSuccess: () => { toast({ title: "Account added" }); invalidateAll(); setShowForm(false); },
      onError: (e: any) => toast({ title: "Failed", description: e?.data?.error, variant: "destructive" }),
    }
  });
  const updateMutation = useUpdateAccount({
    mutation: {
      onSuccess: () => { toast({ title: "Account updated" }); invalidateAll(); setShowForm(false); },
      onError: (e: any) => toast({ title: "Failed", description: e?.data?.error, variant: "destructive" }),
    }
  });
  const deleteMutation = useDeleteAccount({
    mutation: {
      onSuccess: () => { toast({ title: "Account deleted" }); invalidateAll(); setDeleteId(null); },
      onError: (e: any) => toast({ title: "Failed to delete", description: e?.data?.error, variant: "destructive" }),
    }
  });

  const handleSubmit = () => {
    if (!form.name || !form.balance) { toast({ title: "Please fill required fields", variant: "destructive" }); return; }
    const payload = {
      name: form.name.trim(), type: form.type,
      subCategory: form.subCategory === "none" ? null : form.subCategory,
      tag: form.tag, balance: Number(form.balance), currency: form.currency || "LKR"
    };
    if (editAcc) updateMutation.mutate({ id: editAcc.id, data: payload });
    else         createMutation.mutate({ data: payload as any });
  };

  const isBusy = createMutation.isPending || updateMutation.isPending;

  if (isAccountsLoading || isSummaryLoading) return <AccountsSkeleton />;

  const targetEmergencyFund  = settings?.emergencyFundRequired ?? 500000;
  const emergencyFundPercent = summary ? Math.min(100, (summary.emergencyFund / targetEmergencyFund) * 100) : 0;

  const tagColor = (tag: string) =>
    tag === "emergency"   ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" :
    tag === "opportunity" ? "bg-primary/10 text-primary" :
                            "bg-green-500/10 text-green-600 dark:text-green-400";

  const subCategoryBadge = (sub?: string | null) => {
    if (!sub) return null;
    const colors: Record<string, string> = {
      savings:    "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      investment: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
      current:    "bg-gray-500/10 text-gray-600 dark:text-gray-400",
    };
    return (
      <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${colors[sub] ?? "bg-muted text-muted-foreground"}`}>
        {sub}
      </span>
    );
  };

  // Compute total interest earned across all accounts
  const totalInterest = accounts?.reduce((s, a: any) => s + (a.interestEarned || 0), 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Accounts</h1>
          <p className="text-muted-foreground">Bank accounts, savings, investments, and cash with interest tracking.</p>
        </div>
        <Button onClick={openAdd} data-testid="button-add-account">
          <Plus className="w-4 h-4 mr-2" /> Add Account
        </Button>
      </div>

      {summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Total Balance",     value: summary.totalBalance,   color: "", icon: <Wallet className="h-4 w-4 text-muted-foreground" /> },
            { label: "Free Cash",         value: summary.freeCash,       color: "", icon: <Wallet className="h-4 w-4 text-muted-foreground" />, sub: "Available to invest" },
            { label: "Interest Earned",   value: totalInterest,          color: "text-green-500", icon: <TrendingUp className="h-4 w-4 text-green-500" />, prefix: totalInterest >= 0 ? "+" : "" },
            { label: "Monthly Inflow",    value: summary.monthlyInflow,  color: "text-green-500", icon: <ArrowUpRight className="h-4 w-4 text-green-500" />, prefix: "+" },
            { label: "Monthly Outflow",   value: summary.monthlyOutflow, color: "text-red-500",   icon: <ArrowDownRight className="h-4 w-4 text-red-500" />, prefix: "-" },
          ].map(({ label, value, color, icon, sub, prefix }) => (
            <Card key={label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{label}</CardTitle>
                {icon}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${color}`}>{prefix}{formatCurrency(value)}</div>
                {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>All Accounts</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/20 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Tag</th>
                    <th className="px-4 py-3 font-medium text-right">Principal</th>
                    <th className="px-4 py-3 font-medium text-right">Current</th>
                    <th className="px-4 py-3 font-medium text-right">Interest</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {accounts?.map((account: any) => (
                    <tr key={account.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-4">
                        <div className="font-medium flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex flex-col gap-0.5">
                            <span>{account.name}</span>
                            {subCategoryBadge(account.subCategory)}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 capitalize">{account.type.replace(/_/g, " ")}</td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs capitalize ${tagColor(account.tag)}`}>{account.tag}</span>
                      </td>
                      <td className="px-4 py-4 text-right text-muted-foreground">{formatCurrency(account.balance, account.currency)}</td>
                      <td className="px-4 py-4 text-right font-semibold">{formatCurrency(account.currentBalance, account.currency)}</td>
                      <td className={`px-4 py-4 text-right font-medium ${account.interestEarned > 0 ? "text-green-500" : account.interestEarned < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                        {account.interestEarned !== 0
                          ? `${account.interestEarned > 0 ? "+" : ""}${formatCurrency(account.interestEarned, account.currency)}`
                          : "—"}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="cursor-pointer" onClick={() => setValuationsAcc(account)}>
                              <History className="mr-2 h-4 w-4" /> Valuations / Interest
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer" onClick={() => openEdit(account)}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit Account
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive cursor-pointer" onClick={() => setDeleteId(account.id)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                  {(!accounts || accounts.length === 0) && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No accounts yet. Add one above.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cash Tags</CardTitle>
            <CardDescription>Logical grouping of your funds</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">Emergency Fund</span>
                <span>{formatCurrency(summary?.emergencyFund || 0)}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-muted-foreground">Target: {formatCurrency(targetEmergencyFund)}</span>
                <span className="text-xs font-medium">{emergencyFundPercent.toFixed(0)}%</span>
              </div>
              <Progress value={emergencyFundPercent} className="h-2" />
            </div>
            <div className="pt-4 border-t border-border">
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">Opportunity Fund</span>
                <span>{formatCurrency(summary?.opportunityFund || 0)}</span>
              </div>
              <p className="text-xs text-muted-foreground">Reserved for market crashes</p>
            </div>
            <div className="pt-4 border-t border-border">
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-green-600 dark:text-green-400">Free Cash</span>
                <span className="text-green-600 dark:text-green-400">{formatCurrency(summary?.freeCash || 0)}</span>
              </div>
              <p className="text-xs text-muted-foreground">Ready to be deployed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={open => { if (!open) setShowForm(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editAcc ? "Edit Account" : "Add New Account"}</DialogTitle>
            <DialogDescription>{editAcc ? "Update account details." : "Add a bank or cash account to track."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Account Name <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. Sampath Bank Savings" value={form.name} onChange={e => set("name", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => set("type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g, " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sub-category</Label>
                <Select value={form.subCategory} onValueChange={v => set("subCategory", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SUB_CATEGORIES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cash Tag</Label>
                <Select value={form.tag} onValueChange={v => set("tag", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TAGS.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Input placeholder="LKR" value={form.currency} onChange={e => set("currency", e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Principal Balance <span className="text-destructive">*</span></Label>
              <Input type="number" min={0} placeholder="0" value={form.balance} onChange={e => set("balance", e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Initial deposited amount (excluding interest). Add valuations later to record interest received.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isBusy}>
              {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editAcc ? "Save Changes" : "Add Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={open => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>Are you sure? This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Valuations Dialog */}
      {valuationsAcc && (
        <ValuationsDialog
          account={valuationsAcc}
          onClose={() => setValuationsAcc(null)}
          invalidateAccounts={invalidateAll}
        />
      )}
    </div>
  );
}

// ─── Valuations Dialog ────────────────────────────────────────────────────────

function ValuationsDialog({
  account,
  onClose,
  invalidateAccounts,
}: {
  account: AccountRow;
  onClose: () => void;
  invalidateAccounts: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const accountId = account.id;

  const { data: valuations, isLoading } = useGetAccountValuations(accountId, {
    query: { queryKey: getGetAccountValuationsQueryKey(accountId) },
  });

  const today = new Date().toISOString().slice(0, 10);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [valForm, setValForm] = useState({ value: "", date: today, note: "" });

  const resetForm = () => { setValForm({ value: "", date: today, note: "" }); setEditingId(null); };

  const invalidateVals = () => {
    queryClient.invalidateQueries({ queryKey: getGetAccountValuationsQueryKey(accountId) });
    invalidateAccounts();
  };

  const addMut = useAddAccountValuation({
    mutation: {
      onSuccess: () => { toast({ title: "Valuation added" }); invalidateVals(); resetForm(); },
      onError: (e: any) => toast({ title: "Failed", description: e?.data?.error, variant: "destructive" }),
    },
  });
  const updateMut = useUpdateAccountValuation({
    mutation: {
      onSuccess: () => { toast({ title: "Valuation updated" }); invalidateVals(); resetForm(); },
      onError: (e: any) => toast({ title: "Failed", description: e?.data?.error, variant: "destructive" }),
    },
  });
  const deleteMut = useDeleteAccountValuation({
    mutation: {
      onSuccess: () => { toast({ title: "Valuation deleted" }); invalidateVals(); },
      onError: (e: any) => toast({ title: "Failed", description: e?.data?.error, variant: "destructive" }),
    },
  });

  const handleSave = () => {
    if (!valForm.value || !valForm.date) {
      toast({ title: "Value and date required", variant: "destructive" });
      return;
    }
    const data = {
      value: Number(valForm.value),
      date: valForm.date,
      note: valForm.note ? valForm.note.trim() : null,
    };
    if (editingId) updateMut.mutate({ id: accountId, valuationId: editingId, data: data as any });
    else           addMut.mutate({ id: accountId, data: data as any });
  };

  const startEdit = (v: any) => {
    setEditingId(v.id);
    setValForm({ value: String(v.value), date: v.date, note: v.note || "" });
  };

  const isBusy = addMut.isPending || updateMut.isPending;

  // Compute interest delta vs principal for each entry
  const principal = account.balance;
  const sortedAsc = (valuations ? [...valuations] : []).sort((a: any, b: any) => a.date.localeCompare(b.date));
  const interestPerEntry = new Map<number, number>();
  let prevValue = principal;
  for (const v of sortedAsc) {
    interestPerEntry.set((v as any).id, (v as any).value - prevValue);
    prevValue = (v as any).value;
  }

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            {account.name} — Valuations
          </DialogTitle>
          <DialogDescription>
            Record the bank balance over time. Interest received = current balance − principal.
          </DialogDescription>
        </DialogHeader>

        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-3">
          <div className="border rounded-lg p-3">
            <div className="text-xs text-muted-foreground">Principal</div>
            <div className="text-lg font-semibold mt-1">{formatCurrency(principal, account.currency)}</div>
          </div>
          <div className="border rounded-lg p-3">
            <div className="text-xs text-muted-foreground">Current Balance</div>
            <div className="text-lg font-semibold mt-1">{formatCurrency(account.currentBalance, account.currency)}</div>
          </div>
          <div className="border rounded-lg p-3">
            <div className="text-xs text-muted-foreground">Interest Earned</div>
            <div className={`text-lg font-semibold mt-1 ${account.interestEarned > 0 ? "text-green-500" : account.interestEarned < 0 ? "text-red-500" : ""}`}>
              {account.interestEarned > 0 ? "+" : ""}{formatCurrency(account.interestEarned, account.currency)}
            </div>
          </div>
        </div>

        {/* Add / Edit form */}
        <div className="border rounded-lg p-4 bg-muted/20 space-y-3">
          <div className="text-sm font-medium">{editingId ? "Edit Valuation" : "Add New Valuation"}</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Bank Balance ({account.currency}) <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="e.g. 105000"
                value={valForm.value}
                onChange={(e) => setValForm({ ...valForm, value: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Date <span className="text-destructive">*</span></Label>
              <Input
                type="date"
                value={valForm.date}
                onChange={(e) => setValForm({ ...valForm, date: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Note (optional)</Label>
            <Textarea
              rows={2}
              placeholder="e.g. Quarterly interest credited"
              value={valForm.note}
              onChange={(e) => setValForm({ ...valForm, note: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2">
            {editingId && <Button variant="outline" size="sm" onClick={resetForm}>Cancel</Button>}
            <Button size="sm" onClick={handleSave} disabled={isBusy}>
              {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? "Save Changes" : "Add Valuation"}
            </Button>
          </div>
        </div>

        {/* History */}
        <div className="space-y-2">
          <div className="text-sm font-medium">History</div>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !valuations || valuations.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6 border rounded-lg">
              No valuations yet. Add one above to start tracking interest.
            </div>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Date</th>
                    <th className="px-3 py-2 text-right font-medium">Balance</th>
                    <th className="px-3 py-2 text-right font-medium">Δ vs Previous</th>
                    <th className="px-3 py-2 text-left font-medium">Note</th>
                    <th className="px-3 py-2 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {valuations.map((v: any) => {
                    const delta = interestPerEntry.get(v.id) ?? 0;
                    return (
                      <tr key={v.id} className="hover:bg-muted/20">
                        <td className="px-3 py-2">{v.date}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatCurrency(v.value, account.currency)}</td>
                        <td className={`px-3 py-2 text-right ${delta > 0 ? "text-green-500" : delta < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                          {delta !== 0 ? `${delta > 0 ? "+" : ""}${formatCurrency(delta, account.currency)}` : "—"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">{v.note || "—"}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => startEdit(v)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => deleteMut.mutate({ id: accountId, valuationId: v.id })}
                              disabled={deleteMut.isPending}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AccountsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><Skeleton className="h-10 w-48 mb-2" /><Skeleton className="h-5 w-64" /></div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-4 md:grid-cols-5">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-28" />)}</div>
      <div className="grid gap-6 md:grid-cols-3">
        <Skeleton className="h-[400px] md:col-span-2" />
        <Skeleton className="h-[400px]" />
      </div>
    </div>
  );
}
