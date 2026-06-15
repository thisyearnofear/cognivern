"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useEventStream, useSseEvent } from "@/hooks/use-event-stream";
import { useDemoStore } from "@/stores/demo-store";
import { ShieldCheck, AlertTriangle, Activity, Pause, Play, LogOut } from "lucide-react";

interface AuditEvent {
  id?: string;
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

interface PolicyHoldEvent {
  event: string;
  action?: string;
  reason?: string;
  decision?: string;
  workspaceId?: string;
  timestamp?: string;
}

export function NotificationsProvider() {
  const demoMode = useDemoStore((s) => s.demoMode);

  useEventStream();

  useEffect(() => {
    function handleExpired() {
      toast.error("Session expired", {
        description: "Your session has expired. Please sign in again to continue.",
        icon: <LogOut className="h-4 w-4" />,
        duration: 8000,
      });
    }
    window.addEventListener("auth:expired", handleExpired);
    return () => window.removeEventListener("auth:expired", handleExpired);
  }, []);

  useSseEvent<AuditEvent>("audit:log", (event) => {
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

  useSseEvent<AgentStatusEvent>("agent:status", (event) => {
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

  useSseEvent<PolicyHoldEvent>("decision:notify", (event) => {
    if (demoMode) return;
    if (event.event === "policy_hold") {
      toast.warning("Policy auto-held", {
        description: event.action || event.reason || "News event triggered policy hold",
        icon: <Pause className="h-4 w-4" />,
        duration: 8000,
      });
    } else if (event.event === "policy_hold_released") {
      toast.success("Policy hold released", {
        description: event.action || "Operator released the hold",
        icon: <Play className="h-4 w-4" />,
        duration: 4000,
      });
    }
  });

  return null;
}
