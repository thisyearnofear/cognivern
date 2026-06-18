/**
 * NotificationService — fires real-time alerts when governance events occur.
 *
 * Supports:
 * - Socket.io (already wired via notifications-provider)
 * - Webhook POST to agent/workspace configured URLs
 * - In-app toast (via frontend socket listener)
 */

import { createHmac } from "node:crypto";
import { getDb } from "@backend/db/index.js";
import { CircuitBreaker } from "@backend/shared/utils/circuitBreaker.js";
import { sendAlert } from "./alerting/index.js";
import { eventBus } from "./EventBus.js";
import logger from "@backend/utils/logger.js";

interface NotificationPayload {
  event: string;
  timestamp: string;
  workspaceId: string;
  agentId?: string;
  agentName?: string;
  action?: string;
  decision: string;
  reason?: string;
  amount?: number;
  currency?: string;
}

/**
 * Circuit breaker for webhook deliveries. After 5 consecutive failures
 * the circuit opens and rejects new attempts for 30s to avoid hammering
 * a degraded receiver.
 */
const webhookCircuit = new CircuitBreaker("WebhookDelivery", {
  threshold: 5,
  resetAfterMs: 30_000,
});

export const NotificationService = {
  /**
   * Fire notifications for a governance decision.
   * Sends to agent webhook, workspace webhook, and audit log.
   * Skips for approved decisions to reduce noise.
   */
  async fireDecisionNotification(payload: NotificationPayload): Promise<void> {
    // Only fire for denied/flagged decisions to avoid noise
    if (payload.decision === "approved") return;

    const db = getDb();

    // 1. Send to agent's webhook URL if configured
    if (payload.agentId) {
      const agent = db
        .prepare(
          "SELECT webhook_url, name FROM workspace_agents WHERE id = ?",
        )
        .get(payload.agentId) as { webhook_url?: string; name?: string } | undefined;

      if (agent?.webhook_url) {
        await this.deliverWebhookWithRetry(agent.webhook_url, payload);
      }
    }

    // 2. Send to workspace-level webhook if configured
    const workspaceWebhook = db
      .prepare(
        "SELECT settings FROM workspaces WHERE id = ?",
      )
      .get(payload.workspaceId) as { settings?: string } | undefined;

    if (workspaceWebhook?.settings) {
      try {
        const settings = JSON.parse(workspaceWebhook.settings);
        if (settings.webhookUrl) {
          await this.deliverWebhookWithRetry(settings.webhookUrl, payload);
        }
      } catch (err) {
        logger.warn(`[webhook] Invalid workspace settings JSON for ${payload.workspaceId}:`, err);
      }
    }

    // 3. Log notification to audit trail for debugging
    try {
      db.prepare(
        `INSERT INTO notifications (id, workspace_id, agent_id, event, payload, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        payload.workspaceId,
        payload.agentId || null,
        payload.event,
        JSON.stringify(payload),
        new Date().toISOString(),
      );
    } catch (err) {
      logger.warn("[webhook] Failed to persist notification record:", err);
    }

    // 4. Emit to SSE-connected frontend clients
    eventBus.emit(payload.workspaceId, "audit:log", {
      agentId: payload.agentId,
      agent: payload.agentName,
      action: payload.action,
      decision: payload.decision,
      outcome: payload.decision,
      timestamp: payload.timestamp,
    });

    if (payload.decision === "denied" || payload.decision === "flagged") {
      eventBus.emit(payload.workspaceId, "decision:notify", {
        event: payload.event,
        action: payload.action,
        reason: payload.reason,
        decision: payload.decision,
        workspaceId: payload.workspaceId,
        timestamp: payload.timestamp,
      });
    }

    // 5. Forward critical decisions to alert sinks (Slack/PagerDuty)
    if (payload.decision === 'denied' || payload.decision === 'flagged') {
      await sendAlert({
        severity: payload.decision === 'denied' ? 'critical' : 'warning',
        source: 'governance',
        title: `Policy ${payload.decision}: ${payload.event}`,
        message: payload.reason || `Decision ${payload.decision} for ${payload.action || 'unknown action'}`,
        metadata: {
          agentId: payload.agentId,
          agentName: payload.agentName,
          workspaceId: payload.workspaceId,
          amount: payload.amount,
          currency: payload.currency,
        },
        timestamp: payload.timestamp,
      });
    }
  },

  /**
   * Deliver a webhook with automatic retry and exponential backoff.
   * Wrapped in a circuit breaker so a degraded receiver doesn't block
   * every subsequent decision notification.
   */
  async deliverWebhookWithRetry(
    url: string,
    payload: NotificationPayload,
    attempt = 0,
  ): Promise<void> {
    const maxRetries = 2;
    try {
      await webhookCircuit.execute(() => this.sendWebhook(url, payload));
    } catch (error) {
      // Circuit-open errors are short-lived; no point retrying inside the same call
      if (error instanceof Error && error.message.includes("circuit breaker is open")) {
        logger.warn(`[webhook] Circuit OPEN, skipping ${url} delivery`);
        return;
      }
      if (attempt < maxRetries) {
        const delay = 1000 * Math.pow(2, attempt);
        logger.warn(
          `[webhook] Delivery to ${url} failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.deliverWebhookWithRetry(url, payload, attempt + 1);
      }
      logger.warn(
        `[webhook] All ${maxRetries} retry attempts exhausted for ${url}:`,
        error instanceof Error ? error.message : error,
      );
    }
  },

  /**
   * Send a POST request to a webhook URL with the notification payload.
   */
  async sendWebhook(url: string, payload: NotificationPayload): Promise<void> {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout>;
    timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const signature = this.signPayload(payload);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Cognivern-Event": payload.event,
          "X-Cognivern-Signature": signature,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(
          `HTTP ${response.status}: ${response.statusText}${body ? ` — ${body.slice(0, 200)}` : ""}`,
        );
      }
    } catch (error) {
      clearTimeout(timeout);

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Request timed out after 5000ms`);
      }
      throw error;
    }
  },

  /**
   * Generate a simple HMAC-like signature for webhook verification.
   * In production, use a proper secret key from workspace settings.
   */
  signPayload(payload: NotificationPayload): string {
    const data = JSON.stringify(payload);
    const secret = process.env.WEBHOOK_SECRET || "cognivern-webhook-default";
    const hmac = createHmac("sha256", secret);
    hmac.update(data);
    return `sha256=${hmac.digest("hex")}`;
  },

  /**
   * Create the notifications table if it doesn't exist.
   * Called during database migration.
   */
  ensureTable(): void {
    try {
      const db = getDb();
      db.exec(`
        CREATE TABLE IF NOT EXISTS notifications (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          agent_id TEXT,
          event TEXT NOT NULL,
          payload TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
          FOREIGN KEY (agent_id) REFERENCES workspace_agents(id)
        );
        CREATE INDEX IF NOT EXISTS idx_notifications_workspace ON notifications(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
      `);
    } catch (err) {
      logger.warn("[notifications] Table already exists or migration will handle it:", err);
    }
  },
};
