/**
 * Cloudflare Workers Client Service
 *
 * Provides a clean interface to interact with the Cloudflare edge agents.
 * Falls back gracefully when Worker is not available.
 */

import { config } from "../config.js";
import type {
  GovernanceAction,
  PolicyDecision,
} from "../modules/cloudflare-agents/types.js";

export interface WorkerAgent {
  id: string;
  name: string;
  type: string;
  status: string;
  createdAt: string;
  lastActive: string;
}

export interface WorkerMetrics {
  totalDecisions: number;
  approvedActions: number;
  rejectedActions: number;
  avgDecisionTimeMs: number;
}

export interface WorkerHealth {
  status: string;
  timestamp: string;
  environment: string;
}

export class CloudflareWorkerClient {
  private baseUrl: string;
  private enabled: boolean;
  private apiKey: string;

  constructor() {
    this.baseUrl = config.CLOUDFLARE_WORKER_URL;
    this.enabled = config.CLOUDFLARE_WORKER_ENABLED;
    this.apiKey = config.API_KEY;
  }

  /**
   * Check if Worker integration is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get Worker health status
   */
  async getHealth(): Promise<WorkerHealth | null> {
    if (!this.enabled) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        headers: { "X-API-Key": this.apiKey },
      });

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.warn("Cloudflare Worker health check failed:", error);
      return null;
    }
  }

  /**
   * List all agents from Worker
   */
  async listAgents(): Promise<WorkerAgent[]> {
    if (!this.enabled) {
      return [];
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/agents`, {
        headers: { "X-API-Key": this.apiKey },
      });

      if (!response.ok) {
        throw new Error(`List agents failed: ${response.status}`);
      }

      const data = await response.json();
      return data.success ? data.data : [];
    } catch (error) {
      console.warn("Cloudflare Worker listAgents failed:", error);
      return [];
    }
  }

  /**
   * Get agent details from Worker
   */
  async getAgent(agentId: string): Promise<WorkerAgent | null> {
    if (!this.enabled) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/agents/${agentId}`, {
        headers: { "X-API-Key": this.apiKey },
      });

      if (!response.ok) {
        throw new Error(`Get agent failed: ${response.status}`);
      }

      const data = await response.json();
      return data.success ? data.data : null;
    } catch (error) {
      console.warn(`Cloudflare Worker getAgent(${agentId}) failed:`, error);
      return null;
    }
  }

  /**
   * Register a new agent in Worker
   */
  async registerAgent(agentData: {
    name: string;
    type: string;
    capabilities?: string[];
    metadata?: Record<string, any>;
  }): Promise<WorkerAgent | null> {
    if (!this.enabled) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/agents`, {
        method: "POST",
        headers: {
          "X-API-Key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(agentData),
      });

      if (!response.ok) {
        throw new Error(`Register agent failed: ${response.status}`);
      }

      const data = await response.json();
      return data.success ? data.data : null;
    } catch (error) {
      console.warn("Cloudflare Worker registerAgent failed:", error);
      return null;
    }
  }

  /**
   * Evaluate governance action via Worker
   */
  async evaluateGovernance(
    agentId: string,
    action: GovernanceAction,
  ): Promise<PolicyDecision | null> {
    if (!this.enabled) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/governance/evaluate`, {
        method: "POST",
        headers: {
          "X-API-Key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ agentId, action }),
      });

      if (!response.ok) {
        throw new Error(`Governance evaluation failed: ${response.status}`);
      }

      const data = await response.json();
      return data.success ? data.data : null;
    } catch (error) {
      console.warn("Cloudflare Worker evaluateGovernance failed:", error);
      return null;
    }
  }

  /**
   * List policies from Worker
   */
  async listPolicies(): Promise<any[]> {
    if (!this.enabled) {
      return [];
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/governance/policies`, {
        headers: { "X-API-Key": this.apiKey },
      });

      if (!response.ok) {
        throw new Error(`List policies failed: ${response.status}`);
      }

      const data = await response.json();
      return data.success ? data.data : [];
    } catch (error) {
      console.warn("Cloudflare Worker listPolicies failed:", error);
      return [];
    }
  }

  /**
   * Get agent thought history from Worker
   */
  async getThoughtHistory(agentId: string, limit?: number): Promise<string[]> {
    if (!this.enabled) {
      return [];
    }

    try {
      const url = new URL(`${this.baseUrl}/api/agents/${agentId}/thoughts`);
      if (limit) {
        url.searchParams.set("limit", limit.toString());
      }

      const response = await fetch(url.toString(), {
        headers: { "X-API-Key": this.apiKey },
      });

      if (!response.ok) {
        throw new Error(`Get thoughts failed: ${response.status}`);
      }

      const data = await response.json();
      return data.success ? data.data : [];
    } catch (error) {
      console.warn("Cloudflare Worker getThoughtHistory failed:", error);
      return [];
    }
  }

  /**
   * Get agent metrics from Worker
   */
  async getAgentMetrics(agentId: string): Promise<WorkerMetrics | null> {
    if (!this.enabled) {
      return null;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/api/agents/${agentId}/metrics`,
        {
          headers: { "X-API-Key": this.apiKey },
        },
      );

      if (!response.ok) {
        throw new Error(`Get metrics failed: ${response.status}`);
      }

      const data = await response.json();
      return data.success ? data.data : null;
    } catch (error) {
      console.warn("Cloudflare Worker getAgentMetrics failed:", error);
      return null;
    }
  }

  /**
   * Get voice briefing audio from Worker (ElevenLabs TTS)
   */
  async getVoiceBriefing(
    agentId: string,
  ): Promise<{ audioUrl: string; script: string } | null> {
    if (!this.enabled) {
      return null;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/api/agents/${agentId}/briefing`,
        {
          headers: { "X-API-Key": this.apiKey },
        },
      );

      if (!response.ok) {
        throw new Error(`Voice briefing failed: ${response.status}`);
      }

      const script = decodeURIComponent(
        response.headers.get("X-Briefing-Script") || "",
      );
      const audioBlob = await response.blob();

      return {
        audioUrl: URL.createObjectURL(audioBlob),
        script,
      };
    } catch (error) {
      console.warn("Cloudflare Worker getVoiceBriefing failed:", error);
      return null;
    }
  }

  /**
   * Get action log from Worker
   */
  async getActionLog(
    agentId: string,
    filters?: {
      actionType?: string;
      approved?: boolean;
      limit?: number;
    },
  ): Promise<GovernanceAction[]> {
    if (!this.enabled) {
      return [];
    }

    try {
      const url = new URL(`${this.baseUrl}/api/agents/${agentId}/actions`);
      if (filters?.actionType) {
        url.searchParams.set("actionType", filters.actionType);
      }
      if (filters?.approved !== undefined) {
        url.searchParams.set("approved", filters.approved.toString());
      }
      if (filters?.limit) {
        url.searchParams.set("limit", filters.limit.toString());
      }

      const response = await fetch(url.toString(), {
        headers: { "X-API-Key": this.apiKey },
      });

      if (!response.ok) {
        throw new Error(`Get action log failed: ${response.status}`);
      }

      const data = await response.json();
      return data.success ? data.data : [];
    } catch (error) {
      console.warn("Cloudflare Worker getActionLog failed:", error);
      return [];
    }
  }
}

// Singleton instance
let workerClient: CloudflareWorkerClient | null = null;

export function getWorkerClient(): CloudflareWorkerClient {
  if (!workerClient) {
    workerClient = new CloudflareWorkerClient();
  }
  return workerClient;
}
