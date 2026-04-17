import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLoginUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useLoginUser({
    mutation: {
      onSuccess: (data) => {
        login(data.token);
        queryClient.setQueryData(getGetCurrentUserQueryKey(), data.user);
        setLocation("/");
      },
      onError: (error) => {
        toast({
          title: "Login Failed",
          description: error.data?.error || "Invalid credentials",
          variant: "destructive",
        });
      }
    }
  });

  const onSubmit = (values: LoginFormValues) => {
    loginMutation.mutate({ data: values });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="space-y-1 items-center justify-center pb-8">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
            <LineChart className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">PIMS Terminal</CardTitle>
          <CardDescription>Enter your credentials to access your portfolio</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="investor@example.com"
                {...form.register("email")}
                className="bg-background"
                data-testid="input-email"
              />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password" data-testid="link-forgot-password">
                  <span className="text-xs text-primary hover:underline cursor-pointer">Forgot password?</span>
                </Link>
              </div>
              <Input 
                id="password" 
                type="password" 
                {...form.register("password")}
                className="bg-background"
                data-testid="input-password"
              />
              {form.formState.errors.password && (
                <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>
            <Button 
              type="submit" 
              className="w-full mt-4" 
              disabled={loginMutation.isPending}
              data-testid="button-login"
            >
              {loginMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sign In
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4 border-t border-border pt-6 mt-2">
          <div className="text-sm text-center text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/register" data-testid="link-register">
              <span className="text-primary hover:underline cursor-pointer">Create account</span>
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
