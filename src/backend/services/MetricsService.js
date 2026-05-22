import logger from "../utils/logger.js";
export class MetricsService {
    constructor() {
        logger.info("MetricsService initialized (Local Mode)");
    }
    async recordAction(action, checks, latencyMs) {
        logger.info(`[Metrics] Action: ${action.type}`, {
            latencyMs,
            passed: checks.every((c) => c.result),
        });
    }
    async getMetrics(period) {
        return this.createEmptyMetrics(period);
    }
    createEmptyMetrics(period) {
        return {
            timestamp: new Date().toISOString(),
            period,
            data: {
                actions: { total: 0, successful: 0, failed: 0, blocked: 0 },
                policies: { total: 0, violations: 0, enforced: 0 },
                performance: {
                    averageResponseTime: 0,
                    p95ResponseTime: 0,
                    maxResponseTime: 0,
                },
                resources: { cpuUsage: 0, memoryUsage: 0, storageUsage: 0 },
            },
        };
    }
}
//# sourceMappingURL=MetricsService.js.map
