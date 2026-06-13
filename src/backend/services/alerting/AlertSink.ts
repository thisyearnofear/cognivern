export interface AlertEvent {
  severity: 'critical' | 'warning' | 'info';
  source: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface AlertSink {
  send(event: AlertEvent): Promise<void>;
  name: string;
}
