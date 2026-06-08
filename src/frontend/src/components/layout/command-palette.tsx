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
import { Settings, ShieldCheck } from "lucide-react";
import { ALL_NAV_ITEMS, DEMO_NAV_ITEMS } from "@/lib/nav-items";

const EXTRA_ITEMS = [
  { id: "settings", label: "Settings", href: "/settings", icon: Settings },
  { id: "onboarding", label: "Set Up Treasury", href: "/onboarding", icon: ShieldCheck },
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
