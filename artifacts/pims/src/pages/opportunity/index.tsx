import { useGetOpportunityStatus, getGetOpportunityStatusQueryKey, useGetDeploymentHistory, getGetDeploymentHistoryQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

export default function OpportunityFund() {
  const { data: status, isLoading: isStatusLoading } = useGetOpportunityStatus({
    query: { queryKey: getGetOpportunityStatusQueryKey() }
  });

  const { data: history, isLoading: isHistoryLoading } = useGetDeploymentHistory({
    query: { queryKey: getGetDeploymentHistoryQueryKey() }
  });

  if (isStatusLoading || isHistoryLoading) {
    return <OpportunitySkeleton />;
  }

  if (!status) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-center">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Opportunity Fund</h1>
          <p className="text-muted-foreground">Capital ready to deploy during market crashes.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
            <LineChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary" data-testid="text-available">
              {formatCurrency(status.availableAmount)}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deployed</CardTitle>
            <LineChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-deployed">
              {formatCurrency(status.totalDeployed)}
            </div>
          </CardContent>
        </Card>
      </div>

      <h3 className="text-xl font-semibold mt-8 mb-4">Deployment Strategy</h3>
      <div className="grid gap-4 md:grid-cols-4">
        {status.stages.map((stage, idx) => (
          <Card key={idx} className={stage.triggered ? "border-primary bg-primary/5" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="flex justify-between items-center">
                <span>Drop: {stage.dropPercent}%</span>
                {stage.triggered && <AlertTriangle className="h-4 w-4 text-primary" />}
              </CardTitle>
              <CardDescription>Deploy {stage.deployPercent}% of fund</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold mb-2">
                {formatCurrency(stage.deployAmount)}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className={`w-2 h-2 rounded-full ${stage.triggered ? 'bg-primary' : 'bg-muted'}`} />
                {stage.triggered ? 'Triggered' : 'Waiting'}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Deployment History</CardTitle>
        </CardHeader>
        <CardContent>
          {history && history.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground bg-muted/20 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Drop %</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Asset</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {history.map((dep) => (
                    <tr key={dep.id}>
                      <td className="px-4 py-3">{new Date(dep.deployedAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">{dep.dropPercent}%</td>
                      <td className="px-4 py-3">{formatCurrency(dep.deployedAmount)}</td>
                      <td className="px-4 py-3">{dep.assetName || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground border rounded bg-muted/20">
              No deployments recorded yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function OpportunitySkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64 mb-6" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <div className="grid gap-4 md:grid-cols-4 mt-8">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)}
      </div>
    </div>
  );
}
