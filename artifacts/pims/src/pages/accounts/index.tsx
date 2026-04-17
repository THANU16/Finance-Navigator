import { useGetAccounts, getGetAccountsQueryKey, useGetAccountsSummary, getGetAccountsSummaryQueryKey, useDeleteAccount } from "@workspace/api-client-react";
import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, MoreHorizontal, Pencil, Trash2, Building2, Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

export default function Accounts() {
  const { data: accounts, isLoading: isAccountsLoading } = useGetAccounts({ query: { queryKey: getGetAccountsQueryKey() } });
  const { data: summary, isLoading: isSummaryLoading } = useGetAccountsSummary({ query: { queryKey: getGetAccountsSummaryQueryKey() } });
  
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMutation = useDeleteAccount({
    mutation: {
      onSuccess: () => {
        toast({ title: "Account deleted" });
        queryClient.invalidateQueries({ queryKey: getGetAccountsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAccountsSummaryQueryKey() });
        setDeleteId(null);
      },
      onError: (error) => {
        toast({ title: "Failed to delete account", description: error.data?.error, variant: "destructive" });
      }
    }
  });

  if (isAccountsLoading || isSummaryLoading) {
    return <AccountsSkeleton />;
  }

  // Emergency fund tracker progress
  const targetEmergencyFund = 500000; // Mock target, ideally comes from settings
  const emergencyFundPercent = summary ? Math.min(100, (summary.emergencyFund / targetEmergencyFund) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Accounts</h1>
          <p className="text-muted-foreground">Bank accounts, cash tags, and liquid assets.</p>
        </div>
        <Button data-testid="button-add-account">
          <Plus className="w-4 h-4 mr-2" />
          Add Account
        </Button>
      </div>

      {summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Cash Balance</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-balance">{formatCurrency(summary.totalBalance)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Free Cash</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-free-cash">{formatCurrency(summary.freeCash)}</div>
              <p className="text-xs text-muted-foreground mt-1">Available to invest</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Inflow</CardTitle>
              <ArrowUpRight className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500" data-testid="text-monthly-inflow">+{formatCurrency(summary.monthlyInflow)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Outflow</CardTitle>
              <ArrowDownRight className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500" data-testid="text-monthly-outflow">-{formatCurrency(summary.monthlyOutflow)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>All Accounts</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/20 border-b border-border">
                  <tr>
                    <th className="px-6 py-3 font-medium">Name</th>
                    <th className="px-6 py-3 font-medium">Type</th>
                    <th className="px-6 py-3 font-medium">Tag</th>
                    <th className="px-6 py-3 font-medium text-right">Balance</th>
                    <th className="px-6 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {accounts?.map((account) => (
                    <tr key={account.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {account.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 capitalize">{account.type.replace('_', ' ')}</td>
                      <td className="px-6 py-4 capitalize">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          account.tag === 'emergency' ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' :
                          account.tag === 'opportunity' ? 'bg-primary/10 text-primary' :
                          'bg-green-500/10 text-green-600 dark:text-green-400'
                        }`}>
                          {account.tag}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-medium">{formatCurrency(account.balance, account.currency)}</td>
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
                              <Pencil className="mr-2 h-4 w-4" /> Edit Account
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive focus:text-destructive cursor-pointer"
                              onClick={() => setDeleteId(account.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                  {(!accounts || accounts.length === 0) && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                        No accounts found. Create one to start tracking cash.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
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
                <Progress 
                  value={emergencyFundPercent} 
                  className="h-2"
                  indicatorClassName={
                    emergencyFundPercent < 50 ? "bg-red-500" :
                    emergencyFundPercent < 80 ? "bg-yellow-500" :
                    "bg-green-500"
                  }
                />
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
      </div>

      <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this account? This will not delete transactions but will remove the account from your dashboard.
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

function AccountsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <Skeleton className="h-[400px] md:col-span-2" />
        <Skeleton className="h-[400px]" />
      </div>
    </div>
  );
}
