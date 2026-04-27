import { getApiUrl, getApiKey } from '../utils/api';
import { UxEventType, UxEvent } from '../types';

const HEADERS = {
  'Content-Type': 'application/json',
  'X-API-KEY': getApiKey(),
};

export const uxAnalytics = {
  track: async (eventType: UxEventType, payload: Record<string, unknown> = {}): Promise<void> => {
    try {
      const event: UxEvent = {
        eventType,
        payload,
        timestamp: new Date().toISOString(),
      };

      await fetch(getApiUrl('/api/metrics/ux-events'), {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(event),
      });
    } catch {
      // Non-blocking analytics.
    }
  },
};

export type { UxEventType };
