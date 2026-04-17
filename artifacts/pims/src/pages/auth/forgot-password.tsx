import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForgotPassword, useResetPassword } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Loader2, ArrowLeft } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const emailSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const resetSchema = z.object({
  otp: z.string().length(6, "OTP must be 6 digits"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  
  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const resetForm = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { otp: "", newPassword: "" },
  });

  const forgotMutation = useForgotPassword({
    mutation: {
      onSuccess: (_, variables) => {
        setEmail(variables.data.email);
        setStep("reset");
        toast({
          title: "OTP Sent",
          description: "Please check your email for the reset code.",
        });
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error.data?.error || "Could not process request",
          variant: "destructive",
        });
      }
    }
  });

  const resetMutation = useResetPassword({
    mutation: {
      onSuccess: () => {
        toast({
          title: "Password Reset",
          description: "Your password has been reset successfully. Please login.",
        });
        setLocation("/login");
      },
      onError: (error) => {
        toast({
          title: "Reset Failed",
          description: error.data?.error || "Invalid OTP or request",
          variant: "destructive",
        });
      }
    }
  });

  const onEmailSubmit = (values: z.infer<typeof emailSchema>) => {
    forgotMutation.mutate({ data: values });
  };

  const onResetSubmit = (values: z.infer<typeof resetSchema>) => {
    resetMutation.mutate({ 
      data: {
        email,
        otp: values.otp,
        newPassword: values.newPassword
      } 
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="space-y-1 items-center justify-center pb-8 relative">
          <Link href="/login" className="absolute left-6 top-6" data-testid="link-back-login">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
            <LineChart className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Reset Password</CardTitle>
          <CardDescription>
            {step === "email" ? "Enter your email to receive a reset code" : "Enter the code and your new password"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "email" ? (
            <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="investor@example.com"
                  {...emailForm.register("email")}
                  className="bg-background"
                  data-testid="input-email"
                />
                {emailForm.formState.errors.email && (
                  <p className="text-xs text-destructive">{emailForm.formState.errors.email.message}</p>
                )}
              </div>
              <Button 
                type="submit" 
                className="w-full mt-4" 
                disabled={forgotMutation.isPending}
                data-testid="button-send-otp"
              >
                {forgotMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Send Reset Code
              </Button>
            </form>
          ) : (
            <form onSubmit={resetForm.handleSubmit(onResetSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">Reset Code</Label>
                <div className="flex justify-center py-2">
                  <InputOTP 
                    maxLength={6} 
                    value={resetForm.watch("otp")}
                    onChange={(val) => resetForm.setValue("otp", val)}
                    data-testid="input-otp"
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                {resetForm.formState.errors.otp && (
                  <p className="text-xs text-destructive text-center">{resetForm.formState.errors.otp.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input 
                  id="newPassword" 
                  type="password" 
                  {...resetForm.register("newPassword")}
                  className="bg-background"
                  data-testid="input-new-password"
                />
                {resetForm.formState.errors.newPassword && (
                  <p className="text-xs text-destructive">{resetForm.formState.errors.newPassword.message}</p>
                )}
              </div>
              <Button 
                type="submit" 
                className="w-full mt-4" 
                disabled={resetMutation.isPending}
                data-testid="button-reset-password"
              >
                {resetMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Reset Password
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
