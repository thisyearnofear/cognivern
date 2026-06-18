import type { AlertEvent, AlertSink } from './AlertSink.js';
import { SlackWebhookNotifier } from './SlackWebhookNotifier.js';
import { PagerDutyAlerter } from './PagerDutyAlerter.js';
import logger from "@backend/utils/logger.js";

export type { AlertEvent, AlertSink } from './AlertSink.js';
export { SlackWebhookNotifier } from './SlackWebhookNotifier.js';
export { PagerDutyAlerter } from './PagerDutyAlerter.js';

const sinks: AlertSink[] = [];

export function initializeAlertSinks(): void {
  if (process.env.SLACK_WEBHOOK_URL) {
    sinks.push(new SlackWebhookNotifier());
    logger.info('[alerting] Slack webhook notifier enabled');
  }
  if (process.env.PAGERDUTY_ROUTING_KEY) {
    sinks.push(new PagerDutyAlerter());
    logger.info('[alerting] PagerDuty alerter enabled');
  }
}

export async function sendAlert(event: AlertEvent): Promise<void> {
  if (sinks.length === 0) return;

  await Promise.allSettled(
    sinks.map((sink) =>
      sink.send(event).catch((err) => {
        logger.warn(
          `[alerting] ${sink.name} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }),
    ),
  );
}
