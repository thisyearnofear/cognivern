"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  FileSearch,
  Activity,
  PlayCircle,
  PlusCircle,
  Settings,
} from "lucide-react";

const NAV_ITEMS = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  { id: "agents", label: "Agents", href: "/agents", icon: Users },
  { id: "policies", label: "Policies", href: "/policies", icon: ShieldCheck },
  { id: "audit", label: "Audit Logs", href: "/audit", icon: FileSearch },
  { id: "runs", label: "Runs", href: "/runs", icon: Activity },
  {
    id: "governance",
    label: "Governance Check",
    href: "/governance/check",
    icon: PlayCircle,
  },
  {
    id: "workshop",
    label: "Agent Workshop",
    href: "/agents/workshop",
    icon: PlusCircle,
  },
  { id: "settings", label: "Settings", href: "/settings", icon: Settings },
  {
    id: "onboarding",
    label: "Set Up Treasury",
    href: "/onboarding",
    icon: ShieldCheck,
  },
  { id: "demo", label: "Spend Flow Demo", href: "/demo/spend", icon: Activity },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    function handleCustomEvent() {
      setOpen((prev) => !prev);
    }
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("opencode-palette", handleCustomEvent);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("opencode-palette", handleCustomEvent);
    };
  }, []);

  const runCommand = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen} showCloseButton>
      <CommandInput placeholder="Search pages, agents, policies..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem key={item.id} onSelect={() => runCommand(item.href)}>
                <Icon className="mr-2 h-4 w-4" />
                <span>{item.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
