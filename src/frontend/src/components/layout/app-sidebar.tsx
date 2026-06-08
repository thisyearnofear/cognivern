"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ShieldCheck,
  Search,
  Settings,
  HelpCircle,
  LogOut,
  Sparkles,
  ArrowRight,
  PlayCircle,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAppStore } from "@/stores/app-store";
import { useAuth } from "@/hooks/use-auth";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { AuthModal } from "@/components/auth/auth-modal";
import { NAV_GROUPS, DEMO_NAV_ITEMS } from "@/lib/nav-items";

export function AppSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, demoMode, exitDemoMode } = useAppStore();
  const { logout, signIn, loading: signingIn } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  return (
    <Sidebar className="border-border/40 border-r-0 shadow-none">
      <SidebarHeader className="p-4 space-y-4">
        <div className="flex items-center gap-3 group/brand">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="flex flex-col relative">
            <span className="text-sm font-semibold">Cognivern</span>
            <span className="text-xs text-muted-foreground">AI Governance</span>
            <span className="absolute left-0 top-full mt-1 px-2 py-1 bg-foreground text-background text-[10px] rounded-md opacity-0 group-hover/brand:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap shadow-lg">
              Cogni-vern: governance for the cognitive age
            </span>
          </div>
        </div>
        <div className="px-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <span className="text-[10px] text-muted-foreground/60 cursor-help">
                  Powered by{" "}
                  <span className="text-primary/70 hover:text-primary underline decoration-dotted">
                    OWS
                  </span>
                </span>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[240px] text-xs">
                <p className="font-medium mb-1">Open Wallet Standard</p>
                <p className="text-muted-foreground">
                  Decentralized key custody for AI agents. Each agent gets its own scoped wallet with revocable permissions — no shared keys, no single point of failure.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {demoMode ? (
          <div className="relative flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-100/0 via-amber-100/50 to-amber-100/0 dark:from-amber-900/0 dark:via-amber-900/30 dark:to-amber-900/0 animate-[pulse-bg_2s_ease-in-out_infinite]" />
            <div className="relative flex items-center gap-2">
              <div className="relative">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-amber-400 rounded-full animate-ping" />
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-amber-400 rounded-full" />
              </div>
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                Demo Mode
              </span>
              <span className="ml-auto text-[10px] text-amber-600/70 dark:text-amber-400/70 font-medium">
                Sample data
              </span>
            </div>
          </div>
        ) : (
          <WorkspaceSwitcher />
        )}
      </SidebarHeader>

      <SidebarContent className="px-0 gap-0">
        <SidebarGroup>
          <div className="relative px-3 py-2">
            <Search className="absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <button
              onClick={() =>
                document.dispatchEvent(new CustomEvent("opencode-palette"))
              }
              className="h-9 w-full rounded-lg bg-muted/50 pl-8 pr-3 text-left text-sm text-muted-foreground border border-border shadow-none hover:bg-muted"
              aria-label="Open command palette"
            >
              Search...
            </button>
          </div>
        </SidebarGroup>

        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/");
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        onClick={() => router.push(item.href)}
                        isActive={isActive}
                        className="h-9 rounded-lg px-3 font-normal text-muted-foreground"
                        aria-label={`Navigate to ${item.label}`}
                        tooltip={item.description}
                      >
                        <item.icon className="h-[18px] w-[18px]" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {demoMode && (
          <SidebarGroup>
            <SidebarSeparator className="my-1" />
            <SidebarGroupContent>
              <SidebarMenu>
                {DEMO_NAV_ITEMS.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/");
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        onClick={() => router.push(item.href)}
                        isActive={isActive}
                        className="h-9 rounded-lg px-3 font-normal text-amber-600 dark:text-amber-400"
                        aria-label={`Navigate to ${item.label}`}
                        tooltip={item.description}
                      >
                        <item.icon className="h-[18px] w-[18px]" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-border/40 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => router.push("/settings")}
              className="h-9 rounded-lg px-3 text-muted-foreground"
            >
              <Settings className="h-[18px] w-[18px]" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() =>
                window.open("https://github.com/thisyearnofear/cognivern#readme", "_blank")
              }
              className="h-9 rounded-lg px-3 text-muted-foreground"
            >
              <HelpCircle className="h-[18px] w-[18px]" />
              <span>Help</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {!demoMode && (
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => {
                  useAppStore.getState().enableDemoMode();
                  router.push("/demo/spend");
                }}
                className="h-9 rounded-lg px-3 text-amber-600 dark:text-amber-400"
              >
                <PlayCircle className="h-[18px] w-[18px]" />
                <span>Try Demo</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>

        <SidebarSeparator className="my-2" />

        <div className="px-2 py-2">
          {demoMode ? (
            <div className="space-y-2">
              <button
                onClick={() => setShowAuthModal(true)}
                type="button"
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
              >
                Sign In <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={exitDemoMode}
                className="w-full text-center py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                Exit Demo
              </button>
            </div>
          ) : (
            <ConnectButton.Custom>
              {({
                account,
                chain,
                openAccountModal,
                mounted,
              }) => {
                const ready = mounted;
                const walletConnected = ready && account && chain;
                const appAuthenticated = user.isConnected;

                if (!ready)
                  return (
                    <div className="h-10 w-full animate-pulse bg-muted rounded-lg" />
                  );

                if (!walletConnected && !appAuthenticated) {
                  return (
                    <button
                      onClick={() => setShowAuthModal(true)}
                      type="button"
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Sign In
                    </button>
                  );
                }

                if (!appAuthenticated) {
                  const shortAddress = account?.displayName ?? "Unknown";
                  return (
                    <div className="space-y-2">
                      <button
                        onClick={() => signIn()}
                        disabled={signingIn}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
                      >
                        {signingIn ? (
                          <div className="h-4 w-4 animate-spin border-2 border-white/30 border-t-white rounded-full" />
                        ) : (
                          <ShieldCheck className="h-4 w-4" />
                        )}
                        Sign In to Cognivern
                      </button>
                      <button
                        onClick={openAccountModal}
                        className="w-full text-center py-1 rounded-md hover:bg-muted transition-colors"
                      >
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                          Connected as {shortAddress}
                        </span>
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="flex items-center justify-between group/user">
                    <button
                      onClick={openAccountModal}
                      className="flex items-center gap-3 flex-1 text-left hover:bg-muted/50 p-1 rounded-lg transition-colors"
                    >
                      <Avatar className="h-8 w-8 border border-border/50">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold uppercase">
                          {account?.address?.slice(2, 4) ?? "??"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold truncate">
                          {account?.displayName ?? "User"}
                        </span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-tight font-medium">
                          {user.workspace?.name ?? "Workspace"}
                        </span>
                      </div>
                    </button>
                    <button
                      onClick={logout}
                      className="p-2 rounded-md hover:bg-red-50 hover:text-red-600 text-muted-foreground transition-colors"
                      aria-label="Sign out"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  </div>
                );
              }}
            </ConnectButton.Custom>
          )}
        </div>
      </SidebarFooter>

      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </Sidebar>
  );
}
