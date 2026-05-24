"use client";

import { useRouter, usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  FileSearch,
  Activity,
  PlayCircle,
  PlusCircle,
  Code2,
  Search,
  Settings,
  HelpCircle,
  LogOut,
} from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAppStore } from "@/stores/app-store";
import { useAuth } from "@/hooks/use-auth";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { id: "agents", label: "Agents", icon: Users, href: "/agents" },
  { id: "os", label: "Command Center", icon: PlayCircle, href: "/os" },
  { id: "policies", label: "Policies", icon: ShieldCheck, href: "/policies" },
  { id: "audit", label: "Audit", icon: FileSearch, href: "/audit" },
  { id: "runs", label: "Runs", icon: Activity, href: "/runs" },
  { id: "governance", label: "Governance Check", icon: PlayCircle, href: "/governance/check" },
  { id: "workshop", label: "Agent Workshop", icon: PlusCircle, href: "/agents/workshop" },
  { id: "integrate", label: "Integrate", icon: Code2, href: "/integrate" },
];

export function AppSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAppStore((s) => s.user);
  const { logout } = useAuth();

  const displayName = user.walletAddress
    ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
    : "Not connected";

  return (
    <Sidebar className="border-border/40 border-r-0 shadow-none">
      <SidebarHeader className="p-4">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-3 w-full text-left"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Cognivern</span>
            <span className="text-xs text-muted-foreground">AI Governance</span>
          </div>
        </button>
      </SidebarHeader>

      <SidebarContent className="px-0 gap-0">
        <SidebarGroup>
          <div className="relative px-3 py-2">
            <Search className="absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <button
              onClick={() => document.dispatchEvent(new CustomEvent("opencode-palette"))}
              className="h-9 w-full rounded-lg bg-muted/50 pl-8 pr-3 text-left text-sm text-muted-foreground border border-border shadow-none hover:bg-muted"
              aria-label="Open command palette"
            >
              Search...
            </button>
          </div>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      onClick={() => router.push(item.href)}
                      isActive={isActive}
                      className="h-9 rounded-lg px-3 font-normal text-muted-foreground"
                      aria-label={`Navigate to ${item.label}`}
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
              onClick={() => window.open("https://docs.cognivern.xyz", "_blank")}
              className="h-9 rounded-lg px-3 text-muted-foreground"
            >
              <HelpCircle className="h-[18px] w-[18px]" />
              <span>Help</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarSeparator className="my-2" />

        <div className="px-2 py-2">
          {user.isConnected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{displayName}</span>
                  <span className="text-xs text-muted-foreground">
                    {user.workspace?.tier === "live" ? "Live" : "Demo"} workspace
                  </span>
                </div>
              </div>
              <button onClick={logout} className="p-1.5 rounded-md hover:bg-muted" aria-label="Sign out">
                <LogOut className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          ) : (
            <ConnectButton.Custom>
              {({ openConnectModal }) => (
                <button
                  onClick={openConnectModal}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Connect Wallet
                </button>
              )}
            </ConnectButton.Custom>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
