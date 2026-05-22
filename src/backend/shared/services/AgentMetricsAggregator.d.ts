/**
 * Agent Metrics Aggregator - Single Source of Truth for Agent Comparisons
 *
 * Consolidates metrics from TradingHistoryService and MetricsService
 * Provides unified comparison and filtering logic
 */
import { AgentStatus } from "../types/index.js";
import { TradingHistoryService } from "../../services/TradingHistoryService.js";
import { MetricsService } from "../../services/MetricsService.js";
export interface AgentComparisonMetrics {
    agentId: string;
    agentName: string;
    agentType: string;
    status: AgentStatus;
    ecosystem?: string;
    totalTrades: number;
    winRate: number;
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    avgLatency: number;
    uptime: number;
    successRate: number;
    errorRate: number;
    lastActive: string;
    avgCostPerTrade?: number;
    totalCost?: number;
    performance24h?: PerformanceSnapshot;
    performance7d?: PerformanceSnapshot;
    performance30d?: PerformanceSnapshot;
}
export interface PerformanceSnapshot {
    trades: number;
    winRate: number;
    return: number;
    sharpeRatio: number;
}
export interface ComparisonFilters {
    agentIds?: string[];
    agentTypes?: string[];
    ecosystems?: string[];
    status?: AgentStatus[];
    minWinRate?: number;
    maxWinRate?: number;
    minReturn?: number;
    maxReturn?: number;
    minSharpeRatio?: number;
    maxSharpeRatio?: number;
    timeRange?: {
        start: Date;
        end: Date;
    };
}
export interface ComparisonSort {
    field: keyof AgentComparisonMetrics;
    direction: "asc" | "desc";
}
export declare class AgentMetricsAggregator {
    private metricsCache;
    private cacheExpiry;
    private readonly CACHE_TTL_MS;
    private tradingHistory;
    private metricsService;
    private agentsModule;
    constructor(tradingHistory: TradingHistoryService, metricsService: MetricsService, agentsModule: any);
    /**
     * Get comparison metrics for multiple agents
     */
    getComparisonMetrics(agentIds: string[], filters?: ComparisonFilters): Promise<AgentComparisonMetrics[]>;
    /**
     * Get metrics for a single agent (with caching)
     */
    getAgentMetrics(agentId: string): Promise<AgentComparisonMetrics | null>;
    /**
     * Calculate aggregate metrics across multiple agents
     */
    calculateAggregateMetrics(metrics: AgentComparisonMetrics[]): {
        totalAgents: number;
        avgWinRate: number;
        avgReturn: number;
        avgSharpeRatio: number;
        totalTrades: number;
        bestPerformer: AgentComparisonMetrics | null;
        worstPerformer: AgentComparisonMetrics | null;
    };
    /**
     * Sort agents by specified field
     */
    sortMetrics(metrics: AgentComparisonMetrics[], sort: ComparisonSort): AgentComparisonMetrics[];
    /**
     * Apply filters to metrics
     */
    private applyFilters;
    /**
     * Fetch agent metrics from data sources
     */
    private fetchAgentMetrics;
    private calculateUptime;
    private calculateTimeBasedPerformance;
    /**
     * Get a unified dashboard data bundle (CONSOLIDATION)
     */
    getDashboardBundle(agentIds: string[], filters?: ComparisonFilters): Promise<{
        stats: {
            timestamp: string;
            totalAgents: number;
            avgWinRate: number;
            avgReturn: number;
            avgSharpeRatio: number;
            totalTrades: number;
            bestPerformer: AgentComparisonMetrics | null;
            worstPerformer: AgentComparisonMetrics | null;
        };
        agents: {
            id: string;
            name: string;
            type: string;
            status: AgentStatus;
            winRate: number;
            totalReturn: number;
            lastActive: string;
            ecosystem: string;
            uptime: number;
            performance24h: PerformanceSnapshot;
        }[];
        timestamp: string;
    }>;
    /**
     * Cache management
     */
    private getCachedMetrics;
    private cacheMetrics;
    /**
     * Clear cache for specific agent or all agents
     */
    clearCache(agentId?: string): void;
}
//# sourceMappingURL=AgentMetricsAggregator.d.ts.map
