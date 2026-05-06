/**
 * OpenZeppelin Defender Service
 *
 * Runtime monitoring and alerts for contract interactions.
 * Uses Defender's Relayer and Sentinel APIs for transaction monitoring.
 *
 * API Docs: https://docs.openzeppelin.com/defender/
 */

import logger from "../utils/logger.js";

export interface DefenderConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl?: string;
}

export interface SentinelAlert {
  id: string;
  name: string;
  type: "FORTA" | "CONTRACT" | "BLOCK";
  status: "active" | "paused";
  addresses: string[];
  pausedReason?: string;
}

export interface AlertNotification {
  alertId: string;
  type: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  timestamp: string;
  transaction?: {
    hash: string;
    from: string;
    to: string;
    value: string;
  };
  metadata?: Record<string, any>;
}

export interface MonitorResult {
  safe: boolean;
  alerts: AlertNotification[];
  riskScore: number;
  summary: string;
}

export class OpenZeppelinDefenderService {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;

  constructor(config?: Partial<DefenderConfig>) {
    this.apiKey = config?.apiKey || process.env.OZ_DEFENDER_API_KEY || "";
    this.apiSecret = config?.apiSecret || process.env.OZ_DEFENDER_API_SECRET || "";
    this.baseUrl = config?.baseUrl || "https://api.defender.openzeppelin.com";
  }

  /**
   * Check if Defender is configured
   */
  isConfigured(): boolean {
    return this.apiKey !== "" && this.apiSecret !== "";
  }

  /**
   * Get authentication headers for Defender API
   */
  private getHeaders(): Record<string, string> {
    return {
      "X-Api-Key": this.apiKey,
      "X-Api-Secret": this.apiSecret,
      "Content-Type": "application/json",
    };
  }

  /**
   * List all sentinels (monitors)
   */
  async listSentinels(): Promise<SentinelAlert[]> {
    if (!this.isConfigured()) {
      logger.warn("OpenZeppelin Defender not configured");
      return [];
    }

    try {
      const response = await fetch(`${this.baseUrl}/sentinel/sentinels`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Defender API error: ${response.status}`);
      }

      const data = await response.json();
      return data.sentinelIds?.map((id: string, i: number) => ({
        id,
        name: data.sentinelNames?.[i] || "",
        type: data.types?.[i] || "CONTRACT",
        status: data.statuses?.[i] || "active",
        addresses: data.addresses?.[i] || [],
      })) || [];
    } catch (error) {
      logger.error("Failed to list sentinels:", error);
      return [];
    }
  }

  /**
   * Get recent alerts for a contract address
   */
  async getAlertsForContract(address: string, limit: number = 10): Promise<AlertNotification[]> {
    if (!this.isConfigured()) {
      return [];
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/sentinel/reports?limit=${limit}`,
        {
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`Defender API error: ${response.status}`);
      }

      const data = await response.json();
      const reports = data.reports || [];

      // Filter alerts related to this address
      return reports
        .filter((report: any) => {
          const addresses = report.addresses || [];
          return addresses.includes(address.toLowerCase());
        })
        .map((report: any) => ({
          alertId: report.alertId || "",
          type: report.type || "UNKNOWN",
          severity: this.mapSeverity(report.severity),
          timestamp: report.timestamp || new Date().toISOString(),
          transaction: report.transaction ? {
            hash: report.transaction.hash,
            from: report.transaction.from,
            to: report.transaction.to,
            value: report.transaction.value,
          } : undefined,
          metadata: report.metadata,
        }));
    } catch (error) {
      logger.error("Failed to get alerts:", error);
      return [];
    }
  }

  /**
   * Monitor a contract for suspicious activity
   */
  async monitorContract(address: string): Promise<MonitorResult> {
    const alerts = await this.getAlertsForContract(address);

    // Calculate risk score based on alerts
    let riskScore = 0;
    for (const alert of alerts) {
      switch (alert.severity) {
        case "CRITICAL":
          riskScore += 40;
          break;
        case "HIGH":
          riskScore += 25;
          break;
        case "MEDIUM":
          riskScore += 15;
          break;
        case "LOW":
          riskScore += 5;
          break;
      }
    }

    riskScore = Math.min(100, riskScore);
    const safe = riskScore < 50;

    return {
      safe,
      alerts,
      riskScore,
      summary: alerts.length > 0
        ? `Found ${alerts.length} alert(s) for this contract`
        : "No alerts found - contract appears clean",
    };
  }

  /**
   * Create a sentinel to monitor a contract
   */
  async createSentinel(config: {
    name: string;
    addresses: string[];
    network: string;
    alertThreshold?: number;
  }): Promise<string | null> {
    if (!this.isConfigured()) {
      logger.warn("OpenZeppelin Defender not configured");
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/sentinel/sentinels`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          name: config.name,
          type: "CONTRACT",
          addresses: config.addresses,
          network: config.network,
          confirmLevel: 1,
          alertThreshold: config.alertThreshold || 1,
        }),
      });

      if (!response.ok) {
        throw new Error(`Defender API error: ${response.status}`);
      }

      const data = await response.json();
      return data.sentinelId || null;
    } catch (error) {
      logger.error("Failed to create sentinel:", error);
      return null;
    }
  }

  /**
   * Pause a sentinel
   */
  async pauseSentinel(sentinelId: string, reason?: string): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/sentinel/sentinels/${sentinelId}`,
        {
          method: "PATCH",
          headers: this.getHeaders(),
          body: JSON.stringify({
            status: "paused",
            pausedReason: reason || "Paused by Cognivern",
          }),
        }
      );

      return response.ok;
    } catch (error) {
      logger.error("Failed to pause sentinel:", error);
      return false;
    }
  }

  /**
   * Resume a sentinel
   */
  async resumeSentinel(sentinelId: string): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/sentinel/sentinels/${sentinelId}`,
        {
          method: "PATCH",
          headers: this.getHeaders(),
          body: JSON.stringify({
            status: "active",
          }),
        }
      );

      return response.ok;
    } catch (error) {
      logger.error("Failed to resume sentinel:", error);
      return false;
    }
  }

  /**
   * Map Defender severity to our severity levels
   */
  private mapSeverity(severity: string): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
    const map: Record<string, "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"> = {
      info: "LOW",
      low: "LOW",
      medium: "MEDIUM",
      high: "HIGH",
      critical: "CRITICAL",
    };
    return map[severity?.toLowerCase()] || "LOW";
  }
}

// Singleton instance
let defenderService: OpenZeppelinDefenderService | null = null;

export function getDefenderService(): OpenZeppelinDefenderService {
  if (!defenderService) {
    defenderService = new OpenZeppelinDefenderService();
  }
  return defenderService;
}
