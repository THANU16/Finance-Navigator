import { useGetAssets, getGetAssetsQueryKey, useDeleteAsset } from "@workspace/api-client-react";
import { useState } from "react";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, MoreHorizontal, Pencil, Trash2, Eye } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function Portfolio() {
  const { data: assets, isLoading } = useGetAssets({ query: { queryKey: getGetAssetsQueryKey() } });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const deleteMutation = useDeleteAsset({
    mutation: {
      onSuccess: () => {
        toast({ title: "Asset deleted" });
        queryClient.invalidateQueries({ queryKey: getGetAssetsQueryKey() });
        setDeleteId(null);
      }
    }
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  if (isLoading) {
    return <PortfolioSkeleton />;
  }

  // Group assets by category
  const grouped = assets?.reduce((acc, asset) => {
    if (!acc[asset.category]) acc[asset.category] = [];
    acc[asset.category].push(asset);
    return acc;
  }, {} as Record<string, typeof assets>) || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
          <p className="text-muted-foreground">Manage your investments and cash.</p>
        </div>
        <Button data-testid="button-add-asset">
          <Plus className="w-4 h-4 mr-2" />
          Add Asset
        </Button>
      </div>

      {Object.entries(grouped).map(([category, categoryAssets]) => (
        <Card key={category} className="overflow-hidden">
          <CardHeader className="bg-muted/50 border-b border-border py-4">
            <CardTitle className="capitalize text-lg flex items-center justify-between">
              <span>{category.replace('_', ' ')}</span>
              <span className="text-sm font-normal text-muted-foreground">
                {categoryAssets.length} asset{categoryAssets.length !== 1 ? 's' : ''}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/20 border-b border-border">
                  <tr>
                    <th className="px-6 py-3 font-medium">Asset Name</th>
                    <th className="px-6 py-3 font-medium text-right">Invested</th>
                    <th className="px-6 py-3 font-medium text-right">Current Value</th>
                    <th className="px-6 py-3 font-medium text-right">Return</th>
                    <th className="px-6 py-3 font-medium text-center">Alloc (Act/Tgt)</th>
                    <th className="px-6 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {categoryAssets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-foreground">{asset.name}</div>
                        {asset.subCategory && <div className="text-xs text-muted-foreground mt-0.5">{asset.subCategory}</div>}
                      </td>
                      <td className="px-6 py-4 text-right">{formatCurrency(asset.investedValue, asset.currency)}</td>
                      <td className="px-6 py-4 text-right font-medium">{formatCurrency(asset.currentValue, asset.currency)}</td>
                      <td className="px-6 py-4 text-right">
                        <div className={asset.profitLoss >= 0 ? "text-green-500" : "text-red-500"}>
                          {formatCurrency(asset.profitLoss, asset.currency)}
                        </div>
                        <div className={`text-xs mt-0.5 ${asset.profitLossPercent >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {formatPercent(asset.profitLossPercent)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <div className="flex items-center justify-between w-20 text-xs">
                            <span>{asset.actualPercent}%</span>
                            <span className="text-muted-foreground">/ {asset.targetPercent}%</span>
                          </div>
                          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${Math.abs(asset.actualPercent - asset.targetPercent) > 5 ? 'bg-yellow-500' : 'bg-primary'}`} 
                              style={{ width: `${Math.min(100, asset.actualPercent)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/assets/${asset.id}`} className="cursor-pointer flex w-full">
                                <Eye className="mr-2 h-4 w-4" /> View Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer">
                              <Pencil className="mr-2 h-4 w-4" /> Edit Asset
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive focus:text-destructive cursor-pointer"
                              onClick={() => setDeleteId(asset.id)}
                            >
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
          <p className="text-muted-foreground max-w-sm mb-6">
            Start building your portfolio by adding your first mutual fund, stock, or bank account.
          </p>
          <Button>Add Your First Asset</Button>
        </Card>
      )}

      <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Asset</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this asset? This will also delete all associated valuations and transactions. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}>Delete</Button>
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
        <div>
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      {[1, 2].map((i) => (
        <Card key={i}>
          <CardHeader className="py-4">
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((j) => (
                <Skeleton key={j} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
