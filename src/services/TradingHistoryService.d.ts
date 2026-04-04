import { TradingDecision } from "../types/Agent.js";
export interface TradingPerformance {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    totalReturn: number;
    averageReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    volatility: number;
    profitFactor: number;
}
export interface TradingHistoryStats {
    performance: TradingPerformance;
    recentPerformance: TradingPerformance;
    performanceByDay: Record<string, TradingPerformance>;
    performanceByWeek: Record<string, TradingPerformance>;
    performanceByMonth: Record<string, TradingPerformance>;
}
export interface ChartDataPoint {
    timestamp: string;
    value: number;
    label?: string;
}
export interface TradingChartData {
    equityCurve: ChartDataPoint[];
    drawdownCurve: ChartDataPoint[];
    returnDistribution: ChartDataPoint[];
    winLossRatio: ChartDataPoint[];
}
export declare class TradingHistoryService {
    private history;
    private maxHistoryLength;
    constructor();
    /**
     * Add a trading decision to history
     */
    addDecision(decision: TradingDecision): void;
    /**
     * Get all trading history
     */
    getHistory(limit?: number): TradingDecision[];
    /**
     * Calculate comprehensive trading performance metrics
     */
    calculatePerformance(allHistory?: TradingDecision[]): TradingPerformance;
    private getEmptyPerformance;
    /**
     * Calculate comprehensive trading history statistics
     */
    calculateHistoryStats(): TradingHistoryStats;
    private calculatePerformanceByPeriod;
    private getWeekNumber;
    /**
     * Generate chart data for visualization
     */
    generateChartData(): TradingChartData;
    private getEmptyChartData;
    /**
     * Get trading history statistics summary
     */
    getHistorySummary(): any;
    /**
     * Clear trading history
     */
    clearHistory(): void;
    /**
     * Import trading history
     */
    importHistory(history: TradingDecision[]): void;
    /**
     * Export trading history
     */
    exportHistory(): TradingDecision[];
}
//# sourceMappingURL=TradingHistoryService.d.ts.map
