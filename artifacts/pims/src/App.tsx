import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import { getAuthToken } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout/app-layout";

import NotFound from "@/pages/not-found";
import Login from "@/pages/auth/login";
import Register from "@/pages/auth/register";
import ForgotPassword from "@/pages/auth/forgot-password";
import Dashboard from "@/pages/dashboard";
import Portfolio from "@/pages/portfolio";
import AssetDetail from "@/pages/portfolio/asset-detail";
import Accounts from "@/pages/accounts";
import Transactions from "@/pages/transactions";
import Performance from "@/pages/performance";
import Rebalancing from "@/pages/rebalancing";
import SipPlanner from "@/pages/sip";
import OpportunityFund from "@/pages/opportunity";
import Settings from "@/pages/settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

setAuthTokenGetter(() => {
  return getAuthToken();
});

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/forgot-password" component={ForgotPassword} />

      <Route path="/">
        <AppLayout><Dashboard /></AppLayout>
      </Route>
      <Route path="/portfolio">
        <AppLayout><Portfolio /></AppLayout>
      </Route>
      <Route path="/assets/:id">
        <AppLayout><AssetDetail /></AppLayout>
      </Route>
      <Route path="/accounts">
        <AppLayout><Accounts /></AppLayout>
      </Route>
      <Route path="/transactions">
        <AppLayout><Transactions /></AppLayout>
      </Route>
      <Route path="/performance">
        <AppLayout><Performance /></AppLayout>
      </Route>
      <Route path="/rebalancing">
        <AppLayout><Rebalancing /></AppLayout>
      </Route>
      <Route path="/sip">
        <AppLayout><SipPlanner /></AppLayout>
      </Route>
      <Route path="/opportunity">
        <AppLayout><OpportunityFund /></AppLayout>
      </Route>
      <Route path="/settings">
        <AppLayout><Settings /></AppLayout>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
