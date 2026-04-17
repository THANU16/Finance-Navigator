import { useGetSipConfig, getGetSipConfigQueryKey, useGetSipHistory, getGetSipHistoryQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Calculator } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SipPlanner() {
  const { data: config, isLoading: isConfigLoading } = useGetSipConfig({
    query: { queryKey: getGetSipConfigQueryKey() }
  });

  const { data: history, isLoading: isHistoryLoading } = useGetSipHistory({
    query: { queryKey: getGetSipHistoryQueryKey() }
  });

  if (isConfigLoading || isHistoryLoading) {
    return <SipSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-center">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">SIP Planner</h1>
          <p className="text-muted-foreground">Automate and plan your monthly investments.</p>
        </div>
      </div>

      <Tabs defaultValue="planner">
        <TabsList>
          <TabsTrigger value="planner">Planner</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="planner" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" /> Configuration
              </CardTitle>
              <CardDescription>Setup your monthly allocation.</CardDescription>
            </CardHeader>
            <CardContent>
               <div className="p-8 text-center text-muted-foreground border rounded bg-muted/20">
                 SIP planner configuration form goes here. Needs complex slider logic summing to 100%.
               </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="history" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Execution History</CardTitle>
            </CardHeader>
            <CardContent>
              {history && history.length > 0 ? (
                <div className="space-y-4">
                   {/* Table of history here */}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground">No SIP history found.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SipSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-[400px] w-full" />
    </div>
  );
}
