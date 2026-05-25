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
} from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
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
  const user = useAppStore((s) => s.user);
  const { logout, signIn, loading: signingIn } = useAuth();

  return (
    <Sidebar className="border-border/40 border-r-0 shadow-none">
      <SidebarHeader className="p-4">
        <button
          onClick={() => router.push('/dashboard')}
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
          <ConnectButton.Custom>
            {({ account, chain, openConnectModal, openAccountModal, mounted }) => {
              const ready = mounted;
              const walletConnected = ready && account && chain;
              const appAuthenticated = user.isConnected;

              if (!ready) return <div className="h-10 w-full animate-pulse bg-muted rounded-lg" />;

              // State 1: Not connected at all
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

              // State 2: Wallet connected but App not signed in (SIWE pending)
              if (!appAuthenticated) {
                const shortAddress = `${account.address.slice(0, 6)}...${account.address.slice(-4)}`;

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
                      className="w-full text-center text-[10px] text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider font-semibold"
                    >
                      Connected as {shortAddress}
                    </button>
                  </div>
                );
              }

              // State 3: Fully Authenticated
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
                        {user.workspace?.tier === 'live' ? 'Live' : 'Demo'} Workspace
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
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
