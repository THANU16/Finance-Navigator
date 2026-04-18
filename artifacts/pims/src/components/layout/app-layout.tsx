import React, { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarGroupContent } from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Briefcase, Building2, ReceiptText, LineChart, SlidersHorizontal, Calculator, CandlestickChart, Settings, LogOut, User as UserIcon, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  const isPathActive = (path: string) => {
    if (path === "/" && location === "/") return true;
    if (path !== "/" && location.startsWith(path)) return true;
    return false;
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-background text-foreground overflow-hidden w-full">
        <Sidebar className="border-r border-border bg-sidebar">
          <SidebarHeader className="p-4 border-b border-border">
            <div className="flex items-center gap-2 font-bold text-lg text-primary">
              <LineChart className="w-6 h-6" />
              <span>PIMS Terminal</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 mt-4 mb-2">Overview</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isPathActive("/")} className={isPathActive("/") ? "bg-accent text-accent-foreground" : ""}>
                      <Link href="/" data-testid="link-dashboard">
                        <LayoutDashboard className="w-4 h-4 mr-2" />
                        <span>Dashboard</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isPathActive("/portfolio")} className={isPathActive("/portfolio") ? "bg-accent text-accent-foreground" : ""}>
                      <Link href="/portfolio" data-testid="link-portfolio">
                        <Briefcase className="w-4 h-4 mr-2" />
                        <span>Portfolio</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isPathActive("/accounts")} className={isPathActive("/accounts") ? "bg-accent text-accent-foreground" : ""}>
                      <Link href="/accounts" data-testid="link-accounts">
                        <Building2 className="w-4 h-4 mr-2" />
                        <span>Accounts</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isPathActive("/transactions")} className={isPathActive("/transactions") ? "bg-accent text-accent-foreground" : ""}>
                      <Link href="/transactions" data-testid="link-transactions">
                        <ReceiptText className="w-4 h-4 mr-2" />
                        <span>Transactions</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 mt-6 mb-2">Analytics</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isPathActive("/assets") && !location.startsWith("/assets/")} className={isPathActive("/assets") && !location.startsWith("/assets/") ? "bg-accent text-accent-foreground" : ""}>
                      <Link href="/assets" data-testid="link-assets">
                        <BarChart3 className="w-4 h-4 mr-2" />
                        <span>Assets</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isPathActive("/performance")} className={isPathActive("/performance") ? "bg-accent text-accent-foreground" : ""}>
                      <Link href="/performance" data-testid="link-performance">
                        <CandlestickChart className="w-4 h-4 mr-2" />
                        <span>Performance</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isPathActive("/rebalancing")} className={isPathActive("/rebalancing") ? "bg-accent text-accent-foreground" : ""}>
                      <Link href="/rebalancing" data-testid="link-rebalancing">
                        <SlidersHorizontal className="w-4 h-4 mr-2" />
                        <span>Rebalancing</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isPathActive("/sip")} className={isPathActive("/sip") ? "bg-accent text-accent-foreground" : ""}>
                      <Link href="/sip" data-testid="link-sip">
                        <Calculator className="w-4 h-4 mr-2" />
                        <span>SIP Planner</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isPathActive("/opportunity")} className={isPathActive("/opportunity") ? "bg-accent text-accent-foreground" : ""}>
                      <Link href="/opportunity" data-testid="link-opportunity">
                        <LineChart className="w-4 h-4 mr-2" />
                        <span>Opportunity Fund</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 mt-6 mb-2">System</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isPathActive("/settings")} className={isPathActive("/settings") ? "bg-accent text-accent-foreground" : ""}>
                      <Link href="/settings" data-testid="link-settings">
                        <Settings className="w-4 h-4 mr-2" />
                        <span>Settings</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="border-t border-border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-accent-foreground flex-shrink-0">
                  <UserIcon className="w-4 h-4" />
                </div>
                <div className="flex flex-col truncate">
                  <span className="text-sm font-medium truncate">{user?.name || "User"}</span>
                  <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => logout()} data-testid="button-logout" title="Logout">
                <LogOut className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>
        <main className="flex-1 overflow-auto bg-background flex flex-col h-full">
          <div className="flex-1 w-full max-w-[1600px] mx-auto p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
