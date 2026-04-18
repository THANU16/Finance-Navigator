import {
  useGetTransactions, getGetTransactionsQueryKey,
  useCreateTransaction, useUpdateTransaction, useDeleteTransaction,
  useGetAssets, getGetAssetsQueryKey,
  useGetAccounts, getGetAccountsQueryKey,
} from "@workspace/api-client-react";
import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, MoreHorizontal, Pencil, Trash2, Loader2,
  ArrowDownToLine, ArrowUpFromLine, ArrowRightLeft,
  PiggyBank, RefreshCcw, HandCoins, Tags,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const TX_TYPES = [
  { value: "deposit",       label: "Deposit",        icon: <ArrowDownToLine  className="h-4 w-4 text-green-500" /> },
  { value: "withdrawal",    label: "Withdrawal",      icon: <ArrowUpFromLine  className="h-4 w-4 text-red-500" /> },
  { value: "transfer",      label: "Transfer",        icon: <ArrowRightLeft   className="h-4 w-4 text-blue-500" /> },
  { value: "invest",        label: "Invest",          icon: <PiggyBank        className="h-4 w-4 text-primary" /> },
  { value: "redeem",        label: "Redeem",          icon: <HandCoins        className="h-4 w-4 text-yellow-500" /> },
  { value: "sip",           label: "SIP",             icon: <RefreshCcw       className="h-4 w-4 text-primary" /> },
  { value: "tag_allocation",label: "Tag Allocation",  icon: <Tags             className="h-4 w-4 text-purple-500" /> },
];

const TYPE_COLOR: Record<string, string> = {
  deposit: "text-green-500", redeem: "text-green-500",
  withdrawal: "text-red-500", invest: "text-red-500", sip: "text-red-500",
  transfer: "text-blue-500", tag_allocation: "text-purple-500",
};

interface TxFormData {
  type: string; amount: string; date: string;
  assetId: string; sourceAccountId: string; destinationAccountId: string;
  tag: string; note: string;
}
const EMPTY_FORM: TxFormData = {
  type: "deposit", amount: "", date: new Date().toISOString().slice(0, 10),
  assetId: "", sourceAccountId: "", destinationAccountId: "", tag: "", note: "",
};

type TxRow = { id: number; type: string; amount: number; date: string; assetId?: number | null; assetName?: string | null; tag?: string | null; note?: string | null; sourceAccountId?: number | null; destinationAccountId?: number | null; };

// Types that make sense with an asset
const ASSET_TYPES = ["invest", "redeem", "sip"];
// Types that use accounts
const ACCOUNT_TYPES_TX = ["deposit", "withdrawal", "transfer"];

export default function Transactions() {
  const { toast }   = useToast();
  const queryClient = useQueryClient();

  const { data: transactions, isLoading } = useGetTransactions({ limit: 200 }, { query: { queryKey: getGetTransactionsQueryKey({ limit: 200 }) } });
  const { data: assets }   = useGetAssets({ query: { queryKey: getGetAssetsQueryKey() } });
  const { data: accounts } = useGetAccounts({ query: { queryKey: getGetAccountsQueryKey() } });

  const [showForm, setShowForm] = useState(false);
  const [editTx, setEditTx]     = useState<TxRow | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm]         = useState<TxFormData>(EMPTY_FORM);

  const set = (k: keyof TxFormData, v: string) => setForm(f => ({ ...f, [k]: v }));

  const openAdd = () => { setForm(EMPTY_FORM); setEditTx(null); setShowForm(true); };
  const openEdit = (t: TxRow) => {
    setEditTx(t);
    setForm({
      type: t.type, amount: String(t.amount),
      date: t.date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      assetId: t.assetId ? String(t.assetId) : "",
      sourceAccountId: t.sourceAccountId ? String(t.sourceAccountId) : "",
      destinationAccountId: t.destinationAccountId ? String(t.destinationAccountId) : "",
      tag: t.tag || "", note: t.note || "",
    });
    setShowForm(true);
  };

  const createMutation = useCreateTransaction({
    mutation: {
      onSuccess: () => {
        toast({ title: "Transaction recorded" });
        queryClient.invalidateQueries({ queryKey: getGetTransactionsQueryKey() });
        setShowForm(false);
      },
      onError: (e: any) => toast({ title: "Failed", description: e?.data?.error, variant: "destructive" }),
    }
  });

  const updateMutation = useUpdateTransaction({
    mutation: {
      onSuccess: () => {
        toast({ title: "Transaction updated" });
        queryClient.invalidateQueries({ queryKey: getGetTransactionsQueryKey() });
        setShowForm(false);
      },
      onError: (e: any) => toast({ title: "Failed", description: e?.data?.error, variant: "destructive" }),
    }
  });

  const deleteMutation = useDeleteTransaction({
    mutation: {
      onSuccess: () => {
        toast({ title: "Transaction deleted" });
        queryClient.invalidateQueries({ queryKey: getGetTransactionsQueryKey() });
        setDeleteId(null);
      },
      onError: (e: any) => toast({ title: "Failed to delete", description: e?.data?.error, variant: "destructive" }),
    }
  });

  const handleSubmit = () => {
    if (!form.amount || !form.date) { toast({ title: "Amount and date are required", variant: "destructive" }); return; }
    const payload: any = {
      type: form.type, amount: Number(form.amount), date: form.date,
      assetId: form.assetId ? Number(form.assetId) : null,
      sourceAccountId: form.sourceAccountId ? Number(form.sourceAccountId) : null,
      destinationAccountId: form.destinationAccountId ? Number(form.destinationAccountId) : null,
      tag: form.tag || null, note: form.note || null,
    };
    if (editTx) updateMutation.mutate({ id: editTx.id, data: payload });
    else        createMutation.mutate({ data: payload });
  };

  const isBusy = createMutation.isPending || updateMutation.isPending;
  const showAsset    = ASSET_TYPES.includes(form.type);
  const showAccounts = ACCOUNT_TYPES_TX.includes(form.type);

  const typeInfo = (t: string) => TX_TYPES.find(x => x.value === t);

  if (isLoading) return <TransactionsSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">Ledger of all financial movements.</p>
        </div>
        <Button onClick={openAdd} data-testid="button-add-transaction">
          <Plus className="w-4 h-4 mr-2" /> Add Transaction
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>All Transactions</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/20 border-b border-border">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Details</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions?.map(trx => (
                  <tr key={trx.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-4 whitespace-nowrap text-muted-foreground">{new Date(trx.date).toLocaleDateString()}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        {typeInfo(trx.type)?.icon}
                        <span className="capitalize">{trx.type.replace(/_/g, " ")}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {trx.assetName ? <span className="font-medium">{trx.assetName}</span>
                        : trx.tag ? <Badge variant="outline" className="capitalize text-xs">{trx.tag}</Badge>
                        : <span className="text-muted-foreground text-xs">—</span>}
                      {trx.note && <div className="text-xs text-muted-foreground mt-0.5">{trx.note}</div>}
                    </td>
                    <td className={`px-4 py-4 text-right font-semibold ${TYPE_COLOR[trx.type] || ""}`}>
                      {["withdrawal","invest","sip"].includes(trx.type) ? "−" : "+"}
                      {formatCurrency(trx.amount)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="cursor-pointer" onClick={() => openEdit(trx as any)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive cursor-pointer" onClick={() => setDeleteId(trx.id)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
                {(!transactions || transactions.length === 0) && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No transactions yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={open => { if (!open) setShowForm(false); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTx ? "Edit Transaction" : "Add Transaction"}</DialogTitle>
            <DialogDescription>Record a financial movement.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Type <span className="text-destructive">*</span></Label>
              <Select value={form.type} onValueChange={v => set("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TX_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      <div className="flex items-center gap-2">{t.icon}<span>{t.label}</span></div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount (LKR) <span className="text-destructive">*</span></Label>
                <Input type="number" min={0} placeholder="0" value={form.amount} onChange={e => set("amount", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Date <span className="text-destructive">*</span></Label>
                <Input type="date" value={form.date} onChange={e => set("date", e.target.value)} />
              </div>
            </div>

            {showAsset && (
              <div className="space-y-2">
                <Label>Asset (optional)</Label>
                <Select value={form.assetId || "none"} onValueChange={v => set("assetId", v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Select asset" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {assets?.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {showAccounts && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>From Account</Label>
                  <Select value={form.sourceAccountId || "none"} onValueChange={v => set("sourceAccountId", v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {accounts?.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>To Account</Label>
                  <Select value={form.destinationAccountId || "none"} onValueChange={v => set("destinationAccountId", v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {accounts?.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Note</Label>
              <Textarea placeholder="Optional note..." value={form.note} onChange={e => set("note", e.target.value)} rows={2} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isBusy}>
              {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editTx ? "Save Changes" : "Record Transaction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={open => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Transaction</DialogTitle>
            <DialogDescription>Are you sure? This may affect account balances. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TransactionsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><Skeleton className="h-10 w-48 mb-2" /><Skeleton className="h-5 w-64" /></div>
        <Skeleton className="h-10 w-32" />
      </div>
      <Card>
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent className="space-y-4 p-6">{[1,2,3,4,5].map(j => <Skeleton key={j} className="h-12 w-full" />)}</CardContent>
      </Card>
    </div>
  );
}
