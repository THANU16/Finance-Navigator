import { useGetTransactions, getGetTransactionsQueryKey, useDeleteTransaction, useGetAssets, getGetAssetsQueryKey } from "@workspace/api-client-react";
import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, MoreHorizontal, Pencil, Trash2, ArrowRightLeft, ArrowDownToLine, ArrowUpFromLine, PiggyBank, RefreshCcw, HandCoins, Tags } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function Transactions() {
  const { data: transactions, isLoading } = useGetTransactions({ limit: 100 }, { query: { queryKey: getGetTransactionsQueryKey({ limit: 100 }) } });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMutation = useDeleteTransaction({
    mutation: {
      onSuccess: () => {
        toast({ title: "Transaction deleted" });
        queryClient.invalidateQueries({ queryKey: getGetTransactionsQueryKey() });
        setDeleteId(null);
      },
      onError: (error) => {
        toast({ title: "Failed to delete", description: error.data?.error, variant: "destructive" });
      }
    }
  });

  if (isLoading) {
    return <TransactionsSkeleton />;
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'deposit': return <ArrowDownToLine className="h-4 w-4 text-green-500" />;
      case 'withdrawal': return <ArrowUpFromLine className="h-4 w-4 text-red-500" />;
      case 'transfer': return <ArrowRightLeft className="h-4 w-4 text-blue-500" />;
      case 'invest': return <PiggyBank className="h-4 w-4 text-primary" />;
      case 'redeem': return <HandCoins className="h-4 w-4 text-yellow-500" />;
      case 'tag_allocation': return <Tags className="h-4 w-4 text-purple-500" />;
      case 'sip': return <RefreshCcw className="h-4 w-4 text-primary" />;
      default: return <ArrowRightLeft className="h-4 w-4" />;
    }
  };

  const getAmountColor = (type: string) => {
    if (['deposit', 'redeem'].includes(type)) return "text-green-500";
    if (['withdrawal', 'invest', 'sip'].includes(type)) return "text-red-500";
    return "";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">Ledger of all financial movements.</p>
        </div>
        <Button data-testid="button-add-transaction">
          <Plus className="w-4 h-4 mr-2" />
          Add Transaction
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/20 border-b border-border">
                <tr>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Type</th>
                  <th className="px-6 py-3 font-medium">Details</th>
                  <th className="px-6 py-3 font-medium text-right">Amount</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions?.map((trx) => (
                  <tr key={trx.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {new Date(trx.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 capitalize">
                        {getTypeIcon(trx.type)}
                        <span>{trx.type.replace('_', ' ')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {trx.assetName ? (
                        <span className="font-medium">{trx.assetName}</span>
                      ) : trx.tag ? (
                        <span className="font-medium text-muted-foreground">Tag: {trx.tag}</span>
                      ) : (
                        <span className="text-muted-foreground">Account Transfer</span>
                      )}
                      {trx.note && <div className="text-xs text-muted-foreground mt-0.5">{trx.note}</div>}
                    </td>
                    <td className={`px-6 py-4 text-right font-medium ${getAmountColor(trx.type)}`}>
                      {['withdrawal', 'invest', 'sip'].includes(trx.type) ? '-' : ''}
                      {formatCurrency(trx.amount)}
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
                          <DropdownMenuItem className="cursor-pointer">
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive cursor-pointer"
                            onClick={() => setDeleteId(trx.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
                {(!transactions || transactions.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                      No transactions recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Transaction</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this transaction? This may affect your account balances and asset invested values.
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

function TransactionsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((j) => (
              <Skeleton key={j} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
