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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  FileSearch,
  Activity,
  PlayCircle,
  PlusCircle,
  Search,
  Settings,
  HelpCircle,
  CreditCard,
  Zap,
} from "lucide-react";
import { useAppStore } from "@/stores/app-store";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { id: "agents", label: "Agents", icon: Users, href: "/agents" },
  { id: "policies", label: "Policies", icon: ShieldCheck, href: "/policies" },
  { id: "audit", label: "Audit", icon: FileSearch, href: "/audit" },
  { id: "runs", label: "Runs", icon: Activity, href: "/runs" },
  { id: "governance", label: "Governance Check", icon: PlayCircle, href: "/governance/check" },
  { id: "workshop", label: "Agent Workshop", icon: PlusCircle, href: "/agents/workshop" },
];

export function AppSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const mode = useAppStore((s) => s.mode);
  const toggleMode = useAppStore((s) => s.toggleMode);

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
              Search\u2026
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {mode === 'demo' ? 'Demo Mode' : 'Live Mode'}
              </span>
            </div>
            <Switch
              checked={mode === 'live'}
              onCheckedChange={toggleMode}
              aria-label="Toggle demo/live mode"
            />
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {mode === 'demo' ? 'Using sample data' : 'Connected to API'}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="mt-2 flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-accent cursor-pointer" aria-label="User menu">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                CV
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-1 flex-col">
              <span className="text-sm font-medium">Demo User</span>
              <span className="text-xs text-muted-foreground">Explore Mode</span>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-40">
            <DropdownMenuItem>
              <CreditCard className="h-4 w-4" />
              Connect Wallet
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
