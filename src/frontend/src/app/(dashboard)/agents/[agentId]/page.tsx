"use client";

import { use } from "react";
import { AgentDetailPage } from "@/components/agents/agent-detail";

export default function AgentProfilePage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = use(params);
  return <AgentDetailPage agentId={agentId} />;
}
