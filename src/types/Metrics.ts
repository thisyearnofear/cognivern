export interface Metrics {
  timestamp: string;
  period: MetricsPeriod;
  data: MetricsData;
}

export enum MetricsPeriod {
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export interface MetricsData {
  actions: {
    total: number;
    successful: number;
    failed: number;
    blocked: number;
  };
  policies: {
    total: number;
    violations: number;
    enforced: number;
  };
  performance: {
    averageResponseTime: number;
    p95ResponseTime: number;
    maxResponseTime: number;
  };
  resources: {
    cpuUsage: number;
    memoryUsage: number;
    storageUsage: number;
  };
}
