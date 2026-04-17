import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRegisterUser } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Loader2 } from "lucide-react";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const registerMutation = useRegisterUser({
    mutation: {
      onSuccess: () => {
        toast({
          title: "Registration Successful",
          description: "Please login with your new credentials.",
        });
        setLocation("/login");
      },
      onError: (error) => {
        toast({
          title: "Registration Failed",
          description: error.data?.error || "Could not create account",
          variant: "destructive",
        });
      }
    }
  });

  const onSubmit = (values: RegisterFormValues) => {
    registerMutation.mutate({ 
      data: {
        name: values.name,
        email: values.email,
        password: values.password,
      } 
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="space-y-1 items-center justify-center pb-8">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
            <LineChart className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Create Account</CardTitle>
          <CardDescription>Join PIMS Terminal to track your portfolio</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input 
                id="name" 
                placeholder="Jane Doe"
                {...form.register("name")}
                className="bg-background"
                data-testid="input-name"
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
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
              <Label htmlFor="password">Password</Label>
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
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input 
                id="confirmPassword" 
                type="password" 
                {...form.register("confirmPassword")}
                className="bg-background"
                data-testid="input-confirm-password"
              />
              {form.formState.errors.confirmPassword && (
                <p className="text-xs text-destructive">{form.formState.errors.confirmPassword.message}</p>
              )}
            </div>
            <Button 
              type="submit" 
              className="w-full mt-4" 
              disabled={registerMutation.isPending}
              data-testid="button-register"
            >
              {registerMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Account
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4 border-t border-border pt-6 mt-2">
          <div className="text-sm text-center text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" data-testid="link-login">
              <span className="text-primary hover:underline cursor-pointer">Sign in</span>
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
