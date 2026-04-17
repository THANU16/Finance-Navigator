import { useGetSettings, getGetSettingsQueryKey, useUpdateSettings } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

const settingsSchema = z.object({
  emergencyFundRequired: z.coerce.number().min(0),
  emergencyFundLowThreshold: z.coerce.number().min(0).max(100),
  emergencyFundCriticalThreshold: z.coerce.number().min(0).max(100),
  rebalancingDriftTolerance: z.coerce.number().min(0).max(100),
  currency: z.string().min(1),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function Settings() {
  const { data: settings, isLoading } = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const initialized = useRef(false);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      emergencyFundRequired: 500000,
      emergencyFundLowThreshold: 80,
      emergencyFundCriticalThreshold: 50,
      rebalancingDriftTolerance: 5,
      currency: "LKR"
    }
  });

  useEffect(() => {
    if (settings && !initialized.current) {
      form.reset({
        emergencyFundRequired: settings.emergencyFundRequired,
        emergencyFundLowThreshold: settings.emergencyFundLowThreshold,
        emergencyFundCriticalThreshold: settings.emergencyFundCriticalThreshold,
        rebalancingDriftTolerance: settings.rebalancingDriftTolerance,
        currency: settings.currency,
      });
      initialized.current = true;
    }
  }, [settings, form]);

  const updateMutation = useUpdateSettings({
    mutation: {
      onSuccess: () => {
        toast({ title: "Settings saved successfully" });
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      },
      onError: (error) => {
        toast({ title: "Failed to save settings", description: error.data?.error, variant: "destructive" });
      }
    }
  });

  const onSubmit = (values: SettingsFormValues) => {
    updateMutation.mutate({ data: values });
  };

  if (isLoading) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
        <p className="text-muted-foreground">Configure thresholds, targets, and general preferences.</p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>General Preferences</CardTitle>
            <CardDescription>Basic system configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currency">Base Currency</Label>
                <Input id="currency" {...form.register("currency")} />
                {form.formState.errors.currency && (
                  <p className="text-xs text-destructive">{form.formState.errors.currency.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Emergency Fund</CardTitle>
            <CardDescription>Targets and alerting thresholds</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="emergencyFundRequired">Target Amount</Label>
                <Input id="emergencyFundRequired" type="number" {...form.register("emergencyFundRequired")} />
                {form.formState.errors.emergencyFundRequired && (
                  <p className="text-xs text-destructive">{form.formState.errors.emergencyFundRequired.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyFundLowThreshold">Low Threshold (%)</Label>
                <Input id="emergencyFundLowThreshold" type="number" {...form.register("emergencyFundLowThreshold")} />
                {form.formState.errors.emergencyFundLowThreshold && (
                  <p className="text-xs text-destructive">{form.formState.errors.emergencyFundLowThreshold.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyFundCriticalThreshold">Critical Threshold (%)</Label>
                <Input id="emergencyFundCriticalThreshold" type="number" {...form.register("emergencyFundCriticalThreshold")} />
                {form.formState.errors.emergencyFundCriticalThreshold && (
                  <p className="text-xs text-destructive">{form.formState.errors.emergencyFundCriticalThreshold.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rebalancing</CardTitle>
            <CardDescription>Drift tolerance configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rebalancingDriftTolerance">Drift Tolerance (%)</Label>
                <Input id="rebalancingDriftTolerance" type="number" {...form.register("rebalancingDriftTolerance")} />
                <p className="text-xs text-muted-foreground">Alerts will trigger when allocation deviates beyond this percentage.</p>
                {form.formState.errors.rebalancingDriftTolerance && (
                  <p className="text-xs text-destructive">{form.formState.errors.rebalancingDriftTolerance.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-settings">
            {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-48 mb-2" />
        <Skeleton className="h-5 w-64" />
      </div>
      {[1, 2, 3].map(i => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-full mb-4" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
