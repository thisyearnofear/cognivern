import logger from "@backend/utils/logger.js";
import type { AlertEvent, AlertSink } from './AlertSink.js';

const PAGERDUTY_EVENTS_URL = 'https://events.pagerduty.com/v2/enqueue';

export class PagerDutyAlerter implements AlertSink {
  readonly name = 'pagerduty';
  private routingKey: string | undefined;

  constructor(routingKey?: string) {
    this.routingKey = routingKey || process.env.PAGERDUTY_ROUTING_KEY;
  }

  async send(event: AlertEvent): Promise<void> {
    if (!this.routingKey) return;

    if (event.severity !== 'critical') return;

    const payload = {
      routing_key: this.routingKey,
      event_action: 'trigger',
      dedup_key: `${event.source}:${event.title}`,
      payload: {
        summary: `${event.title}: ${event.message}`,
        severity: 'critical',
        source: event.source,
        timestamp: event.timestamp,
        custom_details: event.metadata || {},
      },
    };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(PAGERDUTY_EVENTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        logger.warn(`[pagerduty] API returned HTTP ${response.status}`);
      }
    } catch (err) {
      logger.warn(
        `[pagerduty] Failed to send alert: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
