"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, Key, ExternalLink } from "lucide-react";
import { useAppStore } from "@/stores/app-store";

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const workspace = useAppStore((s) => s.user.workspace);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your preferences and configuration</p>
      </div>

      {/* Appearance */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Sun className="h-4 w-4 text-amber-500" />
            Appearance
          </h2>
          <div className="flex items-center gap-2">
            {[
              { id: "light" as const, icon: Sun, label: "Light" },
              { id: "dark" as const, icon: Moon, label: "Dark" },
              { id: "system" as const, icon: Monitor, label: "System" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-all ${
                  theme === t.id
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-sky-200"
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Workspace */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Key className="h-4 w-4 text-amber-500" />
            Workspace
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{workspace?.name || "Not connected"}</div>
              <div className="text-xs text-muted-foreground">
                Tier: {workspace?.tier || "—"}
              </div>
            </div>
            <Badge variant="secondary">{workspace?.tier || "none"}</Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            API keys for your agents will be available in a future update.
          </div>
        </CardContent>
      </Card>

      {/* Connected Chains */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <ExternalLink className="h-4 w-4 text-sky-500" />
            Connected Chains
          </h2>
          <div className="space-y-2">
            {[
              { name: "X Layer", status: "connected" as const, role: "Execution" },
              { name: "Mantle", status: "connected" as const, role: "Execution" },
              { name: "Fhenix", status: "connected" as const, role: "Confidential Compute" },
              { name: "0G", status: "connected" as const, role: "Live Audit" },
              { name: "Filecoin", status: "connected" as const, role: "Archive" },
            ].map((chain) => (
              <div key={chain.name} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-sm font-medium">{chain.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{chain.role}</span>
                  <Badge variant="secondary" className="text-xs">{chain.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="text-xs text-muted-foreground">
        Cognivern v0.1.0 — AI Agent Governance Platform
      </div>
    </div>
  );
}
