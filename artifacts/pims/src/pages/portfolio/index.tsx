import {
  useGetAssets, getGetAssetsQueryKey,
  useCreateAsset, useUpdateAsset, useDeleteAsset,
} from "@workspace/api-client-react";
import { useState } from "react";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, MoreHorizontal, Pencil, Trash2, Eye, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const CATEGORIES = [
  { value: "equity_fund", label: "Equity Fund" },
  { value: "debt_fund",   label: "Debt Fund" },
  { value: "metal",       label: "Metal (Gold/Silver)" },
  { value: "cash",        label: "Cash" },
];

const METAL_SUBS = ["gold", "silver", "platinum", "other"];

type AssetRow = { id: number; name: string; category: string; subCategory?: string | null; units?: number | null; nav?: number | null; pricePerUnit?: number | null; investedValue: number; targetPercent: number; currency: string; isActive?: boolean; currentValue: number; profitLoss: number; profitLossPercent: number; actualPercent: number; };

interface AssetFormData {
  name: string;
  category: string;
  subCategory: string;
  units: string;
  nav: string;
  pricePerUnit: string;
  investedValue: string;
  targetPercent: string;
  currency: string;
}

const EMPTY_FORM: AssetFormData = {
  name: "", category: "equity_fund", subCategory: "",
  units: "", nav: "", pricePerUnit: "", investedValue: "", targetPercent: "", currency: "LKR",
};

export default function Portfolio() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: assets, isLoading } = useGetAssets({ query: { queryKey: getGetAssetsQueryKey() } });

  const [showForm, setShowForm] = useState(false);
  const [editAsset, setEditAsset] = useState<AssetRow | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState<AssetFormData>(EMPTY_FORM);

  const set = (k: keyof AssetFormData, v: string) => setForm(f => ({ ...f, [k]: v }));

  const openAdd = () => { setForm(EMPTY_FORM); setEditAsset(null); setShowForm(true); };
  const openEdit = (a: AssetRow) => {
    setEditAsset(a);
    setForm({
      name: a.name, category: a.category, subCategory: a.subCategory || "",
      units: a.units != null ? String(a.units) : "",
      nav: a.nav != null ? String(a.nav) : "",
      pricePerUnit: a.pricePerUnit != null ? String(a.pricePerUnit) : "",
      investedValue: String(a.investedValue), targetPercent: String(a.targetPercent), currency: a.currency,
    });
    setShowForm(true);
  };

  const createMutation = useCreateAsset({
    mutation: {
      onSuccess: () => {
        toast({ title: "Asset added" });
        queryClient.invalidateQueries({ queryKey: getGetAssetsQueryKey() });
        setShowForm(false);
      },
      onError: (e: any) => toast({ title: "Failed", description: e?.data?.error, variant: "destructive" }),
    }
  });

  const updateMutation = useUpdateAsset({
    mutation: {
      onSuccess: () => {
        toast({ title: "Asset updated" });
        queryClient.invalidateQueries({ queryKey: getGetAssetsQueryKey() });
        setShowForm(false);
      },
      onError: (e: any) => toast({ title: "Failed", description: e?.data?.error, variant: "destructive" }),
    }
  });

  const deleteMutation = useDeleteAsset({
    mutation: {
      onSuccess: () => {
        toast({ title: "Asset deleted" });
        queryClient.invalidateQueries({ queryKey: getGetAssetsQueryKey() });
        setDeleteId(null);
      }
    }
  });

  const handleSubmit = () => {
    if (!form.name || !form.category || !form.investedValue || !form.targetPercent) {
      toast({ title: "Please fill required fields", variant: "destructive" }); return;
    }
    const payload: any = {
      name: form.name.trim(),
      investedValue: Number(form.investedValue),
      targetPercent: Number(form.targetPercent),
      currency: form.currency || "LKR",
    };
    if (form.subCategory) payload.subCategory = form.subCategory;
    if (form.units) payload.units = Number(form.units);
    if (form.nav) payload.nav = Number(form.nav);
    if (form.pricePerUnit) payload.pricePerUnit = Number(form.pricePerUnit);

    if (editAsset) {
      updateMutation.mutate({ id: editAsset.id, data: payload });
    } else {
      payload.category = form.category;
      createMutation.mutate({ data: payload });
    }
  };

  const isBusy = createMutation.isPending || updateMutation.isPending;

  if (isLoading) return <PortfolioSkeleton />;

  const grouped = assets?.reduce((acc, asset) => {
    if (!acc[asset.category]) acc[asset.category] = [];
    acc[asset.category].push(asset as any);
    return acc;
  }, {} as Record<string, AssetRow[]>) || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
          <p className="text-muted-foreground">Manage your investments and cash.</p>
        </div>
        <Button onClick={openAdd} data-testid="button-add-asset">
          <Plus className="w-4 h-4 mr-2" /> Add Asset
        </Button>
      </div>

      {Object.entries(grouped).map(([category, categoryAssets]) => (
        <Card key={category} className="overflow-hidden">
          <CardHeader className="bg-muted/50 border-b border-border py-4">
            <CardTitle className="capitalize text-lg flex items-center justify-between">
              <span>{category.replace(/_/g, " ")}</span>
              <span className="text-sm font-normal text-muted-foreground">{categoryAssets.length} asset{categoryAssets.length !== 1 ? "s" : ""}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/20 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 font-medium">Asset Name</th>
                    <th className="px-4 py-3 font-medium text-right">Invested</th>
                    <th className="px-4 py-3 font-medium text-right">Current Value</th>
                    <th className="px-4 py-3 font-medium text-right">Return</th>
                    <th className="px-4 py-3 font-medium text-center">Alloc (Act/Tgt)</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {categoryAssets.map(asset => (
                    <tr key={asset.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-4">
                        <div className="font-medium">{asset.name}</div>
                        {asset.subCategory && <div className="text-xs text-muted-foreground mt-0.5 capitalize">{asset.subCategory}</div>}
                      </td>
                      <td className="px-4 py-4 text-right">{formatCurrency(asset.investedValue, asset.currency)}</td>
                      <td className="px-4 py-4 text-right font-medium">{formatCurrency(asset.currentValue, asset.currency)}</td>
                      <td className="px-4 py-4 text-right">
                        <div className={asset.profitLoss >= 0 ? "text-green-500" : "text-red-500"}>{formatCurrency(asset.profitLoss, asset.currency)}</div>
                        <div className={`text-xs mt-0.5 ${asset.profitLossPercent >= 0 ? "text-green-500" : "text-red-500"}`}>{formatPercent(asset.profitLossPercent)}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center justify-between w-20 text-xs">
                            <span>{Number(asset.actualPercent).toFixed(1)}%</span>
                            <span className="text-muted-foreground">/ {asset.targetPercent}%</span>
                          </div>
                          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${Math.abs(Number(asset.actualPercent) - asset.targetPercent) > 5 ? "bg-yellow-500" : "bg-primary"}`} style={{ width: `${Math.min(100, Number(asset.actualPercent))}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/assets/${asset.id}`} className="cursor-pointer flex w-full">
                                <Eye className="mr-2 h-4 w-4" /> View Analysis
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer" onClick={() => openEdit(asset)}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit Asset
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive cursor-pointer" onClick={() => setDeleteId(asset.id)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}

      {Object.keys(grouped).length === 0 && (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
            <Plus className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No assets yet</h3>
          <p className="text-muted-foreground max-w-sm mb-6">Start building your portfolio by adding your first mutual fund, metal, or cash account.</p>
          <Button onClick={openAdd}>Add Your First Asset</Button>
        </Card>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={open => { if (!open) setShowForm(false); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editAsset ? "Edit Asset" : "Add New Asset"}</DialogTitle>
            <DialogDescription>{editAsset ? "Update asset details below." : "Fill in the details for your new asset."}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. CAL Equity Fund" value={form.name} onChange={e => set("name", e.target.value)} />
            </div>

            {!editAsset && (
              <div className="space-y-2">
                <Label>Category <span className="text-destructive">*</span></Label>
                <Select value={form.category} onValueChange={v => set("category", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(form.category === "metal" || editAsset?.category === "metal") && (
              <div className="space-y-2">
                <Label>Sub-category</Label>
                <Select value={form.subCategory || ""} onValueChange={v => set("subCategory", v)}>
                  <SelectTrigger><SelectValue placeholder="Select metal type" /></SelectTrigger>
                  <SelectContent>
                    {METAL_SUBS.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Invested Value (LKR) <span className="text-destructive">*</span></Label>
                <Input type="number" min={0} placeholder="0" value={form.investedValue} onChange={e => set("investedValue", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Target Allocation (%) <span className="text-destructive">*</span></Label>
                <Input type="number" min={0} max={100} placeholder="10" value={form.targetPercent} onChange={e => set("targetPercent", e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Units</Label>
                <Input type="number" min={0} placeholder="0" value={form.units} onChange={e => set("units", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{form.category === "metal" ? "Price/Unit (LKR)" : "Latest NAV (LKR)"}</Label>
                {form.category === "metal" || editAsset?.category === "metal"
                  ? <Input type="number" min={0} placeholder="0" value={form.pricePerUnit} onChange={e => set("pricePerUnit", e.target.value)} />
                  : <Input type="number" min={0} placeholder="0" value={form.nav} onChange={e => set("nav", e.target.value)} />
                }
              </div>
            </div>

            <div className="space-y-2">
              <Label>Currency</Label>
              <Input placeholder="LKR" value={form.currency} onChange={e => set("currency", e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isBusy}>
              {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editAsset ? "Save Changes" : "Add Asset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={open => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Asset</DialogTitle>
            <DialogDescription>Are you sure? This will also remove all valuations linked to this asset. This cannot be undone.</DialogDescription>
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

function PortfolioSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><Skeleton className="h-10 w-48 mb-2" /><Skeleton className="h-5 w-64" /></div>
        <Skeleton className="h-10 w-32" />
      </div>
      {[1, 2].map(i => (
        <Card key={i}>
          <CardHeader className="py-4"><Skeleton className="h-6 w-32" /></CardHeader>
          <CardContent className="p-6 space-y-4">{[1,2,3].map(j => <Skeleton key={j} className="h-12 w-full" />)}</CardContent>
        </Card>
      ))}
    </div>
  );
}
