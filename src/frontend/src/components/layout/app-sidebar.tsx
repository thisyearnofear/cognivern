'use client';

import { useRouter, usePathname } from 'next/navigation';
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
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/app-store';
import { useAuth } from '@/hooks/use-auth';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { id: 'agents', label: 'Agents', icon: Users, href: '/agents' },
  { id: 'os', label: 'Command Center', icon: PlayCircle, href: '/os' },
  { id: 'policies', label: 'Policies', icon: ShieldCheck, href: '/policies' },
  { id: 'audit', label: 'Audit', icon: FileSearch, href: '/audit' },
  { id: 'runs', label: 'Runs', icon: Activity, href: '/runs' },
  { id: 'governance', label: 'Governance Check', icon: PlayCircle, href: '/governance/check' },
  { id: 'workshop', label: 'Agent Workshop', icon: PlusCircle, href: '/agents/workshop' },
  { id: 'integrate', label: 'Integrate', icon: Code2, href: '/integrate' },
];

export function AppSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, setWorkspaceMode, demoMode, exitDemoMode } = useAppStore();
  const { logout, signIn, loading: signingIn } = useAuth();

  const isSandbox = user.workspaceMode === 'sandbox';

  return (
    <Sidebar className="border-border/40 border-r-0 shadow-none">
      <SidebarHeader className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Cognivern</span>
            <span className="text-xs text-muted-foreground">AI Governance</span>
          </div>
        </div>

        <div className="relative grid grid-cols-2 p-1 bg-muted rounded-lg border border-border/50">
          <motion.div
            className="absolute inset-y-1 w-[calc(50%-8px)] rounded-md bg-background shadow-sm"
            animate={{ x: isSandbox ? 4 : 'calc(100% + 4px)' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          />
          <button
            onClick={() => setWorkspaceMode('sandbox')}
            className={`relative z-10 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              isSandbox ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Sandbox
          </button>
          <button
            onClick={() => setWorkspaceMode('production')}
            className={`relative z-10 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              !isSandbox ? 'text-emerald-600' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Production
          </button>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-0 gap-0">
        <SidebarGroup>
          <div className="relative px-3 py-2">
            <Search className="absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <button
              onClick={() => document.dispatchEvent(new CustomEvent('opencode-palette'))}
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
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
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
              onClick={() => router.push('/settings')}
              className="h-9 rounded-lg px-3 text-muted-foreground"
            >
              <Settings className="h-[18px] w-[18px]" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => window.open('https://docs.cognivern.xyz', '_blank')}
              className="h-9 rounded-lg px-3 text-muted-foreground"
            >
              <HelpCircle className="h-[18px] w-[18px]" />
              <span>Help</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarSeparator className="my-2" />

        <div className="px-2 py-2">
          {demoMode ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Demo Mode</span>
              </div>
              <button
                onClick={() => router.push('/onboarding')}
                type="button"
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
              >
                Connect Wallet <ArrowRight className="h-3.5 w-3.5" />
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
              {({ account, chain, openConnectModal, openAccountModal, mounted }) => {
                const ready = mounted;
                const walletConnected = ready && account && chain;
                const appAuthenticated = user.isConnected;

                if (!ready) return <div className="h-10 w-full animate-pulse bg-muted rounded-lg" />;

                if (!walletConnected) {
                  return (
                    <button
                      onClick={openConnectModal}
                      type="button"
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Connect Wallet
                    </button>
                  );
                }

                if (!appAuthenticated) {
                  const shortAddress = account.displayName;
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
                          {account.address.slice(2, 4)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold truncate">
                          {account.displayName}
                        </span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-tight font-medium">
                          {isSandbox ? 'Sandbox Mode' : 'Production Mode'}
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
    </Sidebar>
  );
}
