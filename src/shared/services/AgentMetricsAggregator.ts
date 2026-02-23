/**
 * Agent Metrics Aggregator - Single Source of Truth for Agent Comparisons
 * 
 * Consolidates metrics from TradingHistoryService and MetricsService
 * Provides unified comparison and filtering logic
 */

import { TradingDecision, AgentMetrics, AgentStatus } from '../types/index.js';

export interface AgentComparisonMetrics {
  agentId: string;
  agentName: string;
  agentType: string;
  status: AgentStatus;
  ecosystem?: string;
  
  // Performance metrics
  totalTrades: number;
  winRate: number;
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  avgLatency: number;
  
  // Operational metrics
  uptime: number;
  successRate: number;
  errorRate: number;
  lastActive: string;
  
  // Cost metrics
  avgCostPerTrade?: number;
  totalCost?: number;
  
  // Time-based performance
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
  timeRange?: { start: Date; end: Date };
}

export interface ComparisonSort {
  field: keyof AgentComparisonMetrics;
  direction: 'asc' | 'desc';
}

export class AgentMetricsAggregator {
  private metricsCache: Map<string, AgentComparisonMetrics> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL_MS = 30000; // 30 seconds

  /**
   * Get comparison metrics for multiple agents
   */
  async getComparisonMetrics(
    agentIds: string[],
    filters?: ComparisonFilters
  ): Promise<AgentComparisonMetrics[]> {
    const metrics = await Promise.all(
      agentIds.map(id => this.getAgentMetrics(id))
    );
    
    return this.applyFilters(metrics.filter(Boolean) as AgentComparisonMetrics[], filters);
  }

  /**
   * Get metrics for a single agent (with caching)
   */
  async getAgentMetrics(agentId: string): Promise<AgentComparisonMetrics | null> {
    // Check cache
    const cached = this.getCachedMetrics(agentId);
    if (cached) return cached;

    // Fetch fresh metrics (to be implemented with actual data sources)
    const metrics = await this.fetchAgentMetrics(agentId);
    
    if (metrics) {
      this.cacheMetrics(agentId, metrics);
    }
    
    return metrics;
  }

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
  } {
    if (metrics.length === 0) {
      return {
        totalAgents: 0,
        avgWinRate: 0,
        avgReturn: 0,
        avgSharpeRatio: 0,
        totalTrades: 0,
        bestPerformer: null,
        worstPerformer: null,
      };
    }

    const totalTrades = metrics.reduce((sum, m) => sum + m.totalTrades, 0);
    const avgWinRate = metrics.reduce((sum, m) => sum + m.winRate, 0) / metrics.length;
    const avgReturn = metrics.reduce((sum, m) => sum + m.totalReturn, 0) / metrics.length;
    const avgSharpeRatio = metrics.reduce((sum, m) => sum + m.sharpeRatio, 0) / metrics.length;

    const sorted = [...metrics].sort((a, b) => b.totalReturn - a.totalReturn);

    return {
      totalAgents: metrics.length,
      avgWinRate,
      avgReturn,
      avgSharpeRatio,
      totalTrades,
      bestPerformer: sorted[0] || null,
      worstPerformer: sorted[sorted.length - 1] || null,
    };
  }

  /**
   * Sort agents by specified field
   */
  sortMetrics(
    metrics: AgentComparisonMetrics[],
    sort: ComparisonSort
  ): AgentComparisonMetrics[] {
    return [...metrics].sort((a, b) => {
      const aVal = a[sort.field];
      const bVal = b[sort.field];
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sort.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sort.direction === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      
      return 0;
    });
  }

  /**
   * Apply filters to metrics
   */
  private applyFilters(
    metrics: AgentComparisonMetrics[],
    filters?: ComparisonFilters
  ): AgentComparisonMetrics[] {
    if (!filters) return metrics;

    return metrics.filter(m => {
      if (filters.agentIds && !filters.agentIds.includes(m.agentId)) return false;
      if (filters.agentTypes && !filters.agentTypes.includes(m.agentType)) return false;
      if (filters.ecosystems && m.ecosystem && !filters.ecosystems.includes(m.ecosystem)) return false;
      if (filters.status && !filters.status.includes(m.status)) return false;
      if (filters.minWinRate !== undefined && m.winRate < filters.minWinRate) return false;
      if (filters.maxWinRate !== undefined && m.winRate > filters.maxWinRate) return false;
      if (filters.minReturn !== undefined && m.totalReturn < filters.minReturn) return false;
      if (filters.maxReturn !== undefined && m.totalReturn > filters.maxReturn) return false;
      if (filters.minSharpeRatio !== undefined && m.sharpeRatio < filters.minSharpeRatio) return false;
      if (filters.maxSharpeRatio !== undefined && m.sharpeRatio > filters.maxSharpeRatio) return false;
      
      return true;
    });
  }

  /**
   * Fetch agent metrics from data sources
   * TODO: Integrate with TradingHistoryService and MetricsService
   */
  private async fetchAgentMetrics(agentId: string): Promise<AgentComparisonMetrics | null> {
    // Placeholder - will be implemented with actual service integration
    return null;
  }

  /**
   * Cache management
   */
  private getCachedMetrics(agentId: string): AgentComparisonMetrics | null {
    const expiry = this.cacheExpiry.get(agentId);
    if (!expiry || Date.now() > expiry) {
      this.metricsCache.delete(agentId);
      this.cacheExpiry.delete(agentId);
      return null;
    }
    return this.metricsCache.get(agentId) || null;
  }

  private cacheMetrics(agentId: string, metrics: AgentComparisonMetrics): void {
    this.metricsCache.set(agentId, metrics);
    this.cacheExpiry.set(agentId, Date.now() + this.CACHE_TTL_MS);
  }

  /**
   * Clear cache for specific agent or all agents
   */
  clearCache(agentId?: string): void {
    if (agentId) {
      this.metricsCache.delete(agentId);
      this.cacheExpiry.delete(agentId);
    } else {
      this.metricsCache.clear();
      this.cacheExpiry.clear();
    }
  }
}
