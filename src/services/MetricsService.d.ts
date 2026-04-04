import { Metrics, MetricsPeriod } from "../types/Metrics.js";
import { AgentAction, PolicyCheck } from "../types/Agent.js";
export declare class MetricsService {
    constructor();
    recordAction(action: AgentAction, checks: PolicyCheck[], latencyMs: number): Promise<void>;
    getMetrics(period: MetricsPeriod): Promise<Metrics>;
    private createEmptyMetrics;
}
//# sourceMappingURL=MetricsService.d.ts.map
