import logger from "@backend/utils/logger.js";
import type { AlertEvent, AlertSink } from './AlertSink.js';

export class SlackWebhookNotifier implements AlertSink {
  readonly name = 'slack';
  private webhookUrl: string | undefined;

  constructor(webhookUrl?: string) {
    this.webhookUrl = webhookUrl || process.env.SLACK_WEBHOOK_URL;
  }

  async send(event: AlertEvent): Promise<void> {
    if (!this.webhookUrl) return;

    const color = event.severity === 'critical' ? '#ff0000' : event.severity === 'warning' ? '#ffaa00' : '#36a64f';

    const payload = {
      attachments: [
        {
          color,
          title: `[${event.severity.toUpperCase()}] ${event.title}`,
          text: event.message,
          fields: [
            { title: 'Source', value: event.source, short: true },
            { title: 'Severity', value: event.severity, short: true },
            { title: 'Time', value: event.timestamp, short: true },
          ],
          footer: 'Cognivern Governance',
        },
      ],
    };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        logger.warn(`[slack] Webhook returned HTTP ${response.status}`);
      }
    } catch (err) {
      logger.warn(
        `[slack] Failed to send alert: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
