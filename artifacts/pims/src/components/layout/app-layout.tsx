import React, { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Briefcase,
  Building2,
  ReceiptText,
  LineChart,
  SlidersHorizontal,
  Calculator,
  CandlestickChart,
  Settings,
  LogOut,
  User as UserIcon,
  BarChart3,
} from "lucide-react";
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

  const navGroups = [
    {
      label: "Overview",
      items: [
        { href: "/", label: "Dashboard", icon: LayoutDashboard, testId: "link-dashboard" },
        { href: "/portfolio", label: "Portfolio", icon: Briefcase, testId: "link-portfolio" },
        { href: "/accounts", label: "Accounts", icon: Building2, testId: "link-accounts" },
        { href: "/transactions", label: "Transactions", icon: ReceiptText, testId: "link-transactions" },
      ],
    },
    {
      label: "Analytics",
      items: [
        { href: "/assets", label: "Assets", icon: BarChart3, testId: "link-assets" },
        { href: "/performance", label: "Performance", icon: CandlestickChart, testId: "link-performance" },
        { href: "/rebalancing", label: "Rebalancing", icon: SlidersHorizontal, testId: "link-rebalancing" },
        { href: "/sip", label: "SIP Planner", icon: Calculator, testId: "link-sip" },
        { href: "/opportunity", label: "Opportunity Fund", icon: LineChart, testId: "link-opportunity" },
      ],
    },
    {
      label: "System",
      items: [
        { href: "/settings", label: "Settings", icon: Settings, testId: "link-settings" },
      ],
    },
  ];

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
            {navGroups.map((group) => (
              <SidebarGroup key={group.label}>
                <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 mt-4 mb-2">
                  {group.label}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map(({ href, label, icon: Icon, testId }) => {
                      const active =
                        href === "/"
                          ? isPathActive("/") && !location.startsWith("/assets/")
                          : href === "/assets"
                          ? isPathActive("/assets") && !location.startsWith("/assets/")
                          : isPathActive(href);
                      return (
                        <SidebarMenuItem key={href}>
                          <SidebarMenuButton
                            asChild
                            isActive={active}
                            className={active ? "bg-accent text-accent-foreground" : ""}
                          >
                            <Link href={href} data-testid={testId}>
                              <Icon className="w-4 h-4 mr-2" />
                              <span>{label}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
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
              <Button
                variant="ghost"
                size="icon"
                onClick={() => logout()}
                data-testid="button-logout"
                title="Logout"
              >
                <LogOut className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Mobile top bar — only visible on small screens */}
          <header className="flex md:hidden items-center justify-between px-4 h-14 border-b border-border bg-background shrink-0">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div className="flex items-center gap-2 font-bold text-base text-primary">
                <LineChart className="w-5 h-5" />
                <span>PIMS Terminal</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <div
                className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-accent-foreground"
                title={user?.name || "User"}
              >
                <UserIcon className="w-4 h-4" />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => logout()}
                data-testid="button-logout-mobile"
                title="Logout"
              >
                <LogOut className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
          </header>

          <main className="flex-1 overflow-auto bg-background">
            <div className="w-full max-w-[1600px] mx-auto p-4 md:p-6 lg:p-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
