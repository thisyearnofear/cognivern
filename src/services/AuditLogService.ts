import { AgentAction, PolicyCheck } from "../types/Agent.js";
import logger from "../utils/logger.js";
import { RecallClient } from "@recallnet/sdk/client";
import { Address } from "viem";

export interface AuditLog {
  timestamp: string;
  action: AgentAction;
  policyChecks: PolicyCheck[];
  outcome: "allowed" | "denied";
  metadata: Record<string, any>;
}

export class AuditLogService {
  private recall: RecallClient;
  private bucketAddress: Address;

  constructor(recall: RecallClient, bucketAddress: Address) {
    this.recall = recall;
    this.bucketAddress = bucketAddress;
    logger.info("AuditLogService initialized");
  }

  async logEvent(eventData: {
    eventType: string;
    agentType: string;
    timestamp: Date;
    details: Record<string, any>;
  }): Promise<void> {
    try {
      const logEntry = {
        timestamp: eventData.timestamp.toISOString(),
        eventType: eventData.eventType,
        agentType: eventData.agentType,
        details: eventData.details,
      };

      const bucketManager = this.recall.bucketManager();
      await bucketManager.add(
        this.bucketAddress,
        `events/${eventData.eventType}_${Date.now()}`,
        new TextEncoder().encode(JSON.stringify(logEntry))
      );
      logger.info(`Successfully logged event: ${eventData.eventType}`);
    } catch (error) {
      logger.error("Error logging event:", error);
    }
  }

  async logAction(
    action: AgentAction,
    policyChecks: PolicyCheck[],
    allowed: boolean
  ): Promise<void> {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        action,
        policyChecks,
        outcome: allowed ? "allowed" : "denied",
        metadata: {
          complianceStatus: allowed ? "compliant" : "non-compliant",
          latencyMs: 0, // You might want to pass this as a parameter
        },
      };

      const bucketManager = this.recall.bucketManager();
      await bucketManager.add(
        this.bucketAddress,
        `audit/${action.id}`,
        new TextEncoder().encode(JSON.stringify(logEntry))
      );
      logger.info(`Successfully logged audit entry for action ${action.id}`);
    } catch (error) {
      logger.error(
        "Error logging audit entry:",
        error instanceof Error ? error.message : "Unknown error"
      );
      // We don't rethrow to prevent cascading failures
    }
  }

  async getActionLogs(startTime: string, endTime: string): Promise<AuditLog[]> {
    try {
      logger.info("Retrieving audit logs", {
        startTime,
        endTime,
        bucketAddress: this.bucketAddress,
      });
      const bucketManager = this.recall.bucketManager();

      // Query the bucket
      const { result } = await bucketManager.query(this.bucketAddress, {
        prefix: "audit/",
      });

      if (!result || !result.objects || result.objects.length === 0) {
        logger.info("No audit logs found", { prefix: "audit/" });
        return [];
      }

      logger.info(`Found ${result.objects.length} audit log objects`);

      const logs: AuditLog[] = [];
      for (const obj of result.objects) {
        try {
          const { result: data } = await bucketManager.get(
            this.bucketAddress,
            obj.key
          );

          let logData: AuditLog;
          if (data instanceof Uint8Array) {
            const content = new TextDecoder().decode(data);
            logData = JSON.parse(content) as AuditLog;
          } else {
            logData = JSON.parse(JSON.stringify(data)) as AuditLog;
          }

          if (logData.timestamp >= startTime && logData.timestamp <= endTime) {
            logs.push(logData);
          }
        } catch (objError) {
          logger.error(
            `Error processing audit log ${obj.key}:`,
            objError instanceof Error ? objError.message : "Unknown error"
          );
        }
      }

      return logs.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    } catch (error) {
      logger.error(
        "Error retrieving audit logs:",
        error instanceof Error ? error.message : "Unknown error"
      );
      return [];
    }
  }

  async searchLogs(options: {
    startDate: string;
    endDate: string;
    agentId?: string;
    actionType?: string;
    complianceStatus?: string;
  }): Promise<any[]> {
    try {
      logger.info("Searching audit logs", {
        ...options,
        bucketAddress: this.bucketAddress,
      });

      const logs = await this.getActionLogs(options.startDate, options.endDate);

      return logs.filter((log) => {
        return (
          (!options.agentId ||
            log.action.metadata?.agent === options.agentId) &&
          (!options.actionType || log.action.type === options.actionType) &&
          (!options.complianceStatus ||
            (options.complianceStatus === "compliant" &&
              log.outcome === "allowed") ||
            (options.complianceStatus === "non-compliant" &&
              log.outcome === "denied"))
        );
      });
    } catch (error) {
      logger.error(
        "Error searching audit logs:",
        error instanceof Error ? error.message : "Unknown error"
      );
      return [];
    }
  }

  async exportLogs(
    startDate: string,
    endDate: string,
    format: "json" | "csv"
  ): Promise<any> {
    try {
      const logs = await this.searchLogs({ startDate, endDate });

      if (format === "csv") {
        const headers = [
          "timestamp",
          "agentId",
          "actionType",
          "description",
          "outcome",
          "latencyMs",
        ];
        const rows = logs.map((log) => [
          log.timestamp,
          log.action.metadata?.agent || "unknown",
          log.action.type,
          log.action.description,
          log.outcome,
          log.metadata?.latencyMs || 0,
        ]);

        const csvContent = [
          headers.join(","),
          ...rows.map((row) => row.join(",")),
        ].join("\n");

        return { format: "csv", data: csvContent };
      }

      return { format: "json", data: logs };
    } catch (error) {
      logger.error(
        "Error exporting audit logs:",
        error instanceof Error ? error.message : "Unknown error"
      );
      return {
        format: format,
        data: [],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
