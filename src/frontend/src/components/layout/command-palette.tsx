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
import { Bot, ListChecks, Settings, ShieldCheck } from "lucide-react";
import { ALL_NAV_ITEMS, DEMO_NAV_ITEMS } from "@/lib/nav-items";

// Views that are deliberately NOT sidebar items (docs/UX_IA_REVIEW.md: one
// rule — an item names its stage of the loop or it is a view inside an
// existing destination). The palette is the discovery surface for them.
const EXTRA_ITEMS = [
  { id: "settings", label: "Settings", href: "/settings", icon: Settings },
  { id: "onboarding", label: "Set Up Treasury", href: "/onboarding", icon: ShieldCheck },
  { id: "runs", label: "Runs", href: "/spend?view=runs", icon: ListChecks },
  { id: "governance-check", label: "Governance Check", href: "/governance/check", icon: ShieldCheck },
  { id: "copilot", label: "Copilot", href: "/copilot", icon: Bot },
  ...DEMO_NAV_ITEMS,
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
          {ALL_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem key={item.id} onSelect={() => runCommand(item.href)}>
                <Icon className="mr-2 h-4 w-4" />
                <span>{item.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandGroup heading="More">
          {EXTRA_ITEMS.map((item) => {
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
