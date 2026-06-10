"use client";

import { toast } from "sonner";
import { useSocketEvent } from "@/hooks/use-socket";
import { useDemoStore } from "@/stores/demo-store";
import { ShieldCheck, AlertTriangle, Activity } from "lucide-react";

interface AuditEvent {
  id: string;
  agentId?: string;
  agent?: string;
  action?: string;
  outcome?: string;
  decision?: string;
  timestamp?: string;
}

interface AgentStatusEvent {
  agentId: string;
  name?: string;
  status: string;
}

export function NotificationsProvider() {
  const demoMode = useDemoStore((s) => s.demoMode);

  // Audit log events
  useSocketEvent<AuditEvent>("audit:log", (event) => {
    if (demoMode) return;

    const agentName = event.agent || event.agentId || "Agent";
    const action = event.action || "action";
    const outcome = event.outcome || event.decision || "unknown";

    if (outcome === "denied" || outcome === "non-compliant") {
      toast.error(`Policy denied: ${action}`, {
        description: `${agentName} was blocked by governance policy`,
        icon: <AlertTriangle className="h-4 w-4" />,
        duration: 6000,
      });
    } else if (outcome === "allowed" || outcome === "approved") {
      toast.success(`Governance approved: ${action}`, {
        description: `${agentName} — ${action} passed policy checks`,
        icon: <ShieldCheck className="h-4 w-4" />,
        duration: 3000,
      });
    }
  });

  // Agent status changes
  useSocketEvent<AgentStatusEvent>("agent:status", (event) => {
    if (demoMode) return;

    const name = event.name || event.agentId;

    if (event.status === "paused") {
      toast.warning(`Agent paused: ${name}`, {
        icon: <Activity className="h-4 w-4" />,
        duration: 4000,
      });
    } else if (event.status === "active") {
      toast.info(`Agent resumed: ${name}`, {
        icon: <Activity className="h-4 w-4" />,
        duration: 3000,
      });
    }
  });

  return null;
}
