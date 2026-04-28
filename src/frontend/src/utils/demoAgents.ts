import type { AgentType } from '../types';

/**
 * Demo agents available for exploration without connecting real wallet/agent.
 * These return mock data from the API.
 */
export const DEMO_AGENT_TYPES: readonly AgentType[] = [
  'governance',
  'portfolio',
  'sapience',
] as const;

/**
 * Check if an agent type is a demo agent (returns mock data).
 * Single source of truth for demo agent detection.
 */
export const isDemoAgent = (agentType: AgentType | string): boolean => {
  return (DEMO_AGENT_TYPES as readonly string[]).includes(agentType as string);
};

/**
 * Get display label for demo agents.
 */
export const getDemoAgentLabel = (agentType: AgentType): string => {
  switch (agentType) {
    case 'governance':
      return 'Spend Governance';
    case 'portfolio':
      return 'Portfolio Management';
    case 'sapience':
      return 'Analytics Agent';
    default:
      return 'Agent';
  }
};
