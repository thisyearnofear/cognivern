import logger from '../utils/logger.js';
import { TradingDecision } from '../types/Agent.js';

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

export class TradingHistoryService {
  private history: TradingDecision[];
  private maxHistoryLength: number;

  constructor() {
    this.history = [];
    this.maxHistoryLength = 1000; // Keep last 1000 trades
    logger.info('TradingHistoryService initialized');
  }

  /**
   * Add a trading decision to history
   */
  addDecision(decision: TradingDecision): void {
    this.history.unshift(decision);
    if (this.history.length > this.maxHistoryLength) {
      this.history.pop();
    }
  }

  /**
   * Get all trading history
   */
  getHistory(limit: number = 100): TradingDecision[] {
    return this.history.slice(0, limit);
  }

  /**
   * Calculate comprehensive trading performance metrics
   */
  calculatePerformance(allHistory: TradingDecision[] = this.history): TradingPerformance {
    if (allHistory.length === 0) {
      return this.getEmptyPerformance();
    }

    let totalReturn = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    const returns: number[] = [];

    // Calculate individual trade returns and classify wins/losses
    for (const trade of allHistory) {
      // For forecasting, we use confidence as a proxy for return
      // In real trading, this would be actual P&L
      const tradeReturn = trade.confidence || 0;
      totalReturn += tradeReturn;
      returns.push(tradeReturn);

      if (tradeReturn > 0) {
        winningTrades++;
      } else if (tradeReturn < 0) {
        losingTrades++;
      }
    }

    const totalTrades = allHistory.length;
    const winRate = totalTrades > 0 ? winningTrades / totalTrades : 0;
    const averageReturn = totalTrades > 0 ? totalReturn / totalTrades : 0;

    // Calculate volatility (standard deviation of returns)
    const meanReturn = averageReturn;
    const squaredDiffs = returns.map(r => Math.pow(r - meanReturn, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / totalTrades;
    const volatility = Math.sqrt(variance);

    // Calculate Sharpe ratio (assuming risk-free rate = 0)
    const sharpeRatio = volatility > 0 ? averageReturn / volatility : 0;

    // Calculate max drawdown
    let maxDrawdown = 0;
    let peak = -Infinity;
    let currentDrawdown = 0;

    for (const tradeReturn of returns) {
      peak = Math.max(peak, tradeReturn);
      currentDrawdown = peak - tradeReturn;
      maxDrawdown = Math.max(maxDrawdown, currentDrawdown);
    }

    // Calculate profit factor
    const profitFactor = losingTrades > 0
      ? (winningTrades * averageReturn) / Math.abs(losingTrades * averageReturn)
      : winningTrades > 0 ? Infinity : 0;

    return {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      totalReturn,
      averageReturn,
      sharpeRatio,
      maxDrawdown,
      volatility,
      profitFactor,
    };
  }

  private getEmptyPerformance(): TradingPerformance {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalReturn: 0,
      averageReturn: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      volatility: 0,
      profitFactor: 0,
    };
  }

  /**
   * Calculate comprehensive trading history statistics
   */
  calculateHistoryStats(): TradingHistoryStats {
    const allPerformance = this.calculatePerformance();

    // Calculate recent performance (last 30 trades or 30 days)
    const recentHistory = this.history.filter(trade => {
      const tradeDate = new Date(trade.timestamp);
      const daysAgo = (Date.now() - tradeDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysAgo <= 30;
    }).slice(0, 30);

    const recentPerformance = this.calculatePerformance(recentHistory);

    // Calculate performance by time periods
    const performanceByDay = this.calculatePerformanceByPeriod('day');
    const performanceByWeek = this.calculatePerformanceByPeriod('week');
    const performanceByMonth = this.calculatePerformanceByPeriod('month');

    return {
      performance: allPerformance,
      recentPerformance,
      performanceByDay,
      performanceByWeek,
      performanceByMonth,
    };
  }

  private calculatePerformanceByPeriod(period: 'day' | 'week' | 'month'): Record<string, TradingPerformance> {
    const result: Record<string, TradingPerformance> = {};

    for (const trade of this.history) {
      const tradeDate = new Date(trade.timestamp);
      let periodKey: string;

      switch (period) {
        case 'day':
          periodKey = tradeDate.toISOString().split('T')[0]; // YYYY-MM-DD
          break;
        case 'week':
          // Get year and week number
          const weekNumber = this.getWeekNumber(tradeDate);
          periodKey = `${tradeDate.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
          break;
        case 'month':
          periodKey = `${tradeDate.getFullYear()}-${(tradeDate.getMonth() + 1).toString().padStart(2, '0')}`;
          break;
      }

      if (!result[periodKey]) {
        result[periodKey] = this.getEmptyPerformance();
      }

      // Update performance for this period
      const periodPerformance = result[periodKey];
      periodPerformance.totalTrades++;

      const tradeReturn = trade.confidence || 0;
      periodPerformance.totalReturn += tradeReturn;

      if (tradeReturn > 0) {
        periodPerformance.winningTrades++;
      } else if (tradeReturn < 0) {
        periodPerformance.losingTrades++;
      }

      // Recalculate derived metrics
      periodPerformance.winRate = periodPerformance.totalTrades > 0
        ? periodPerformance.winningTrades / periodPerformance.totalTrades
        : 0;
      periodPerformance.averageReturn = periodPerformance.totalTrades > 0
        ? periodPerformance.totalReturn / periodPerformance.totalTrades
        : 0;
    }

    return result;
  }

  private getWeekNumber(date: Date): number {
    // Copy date so we don't modify the original
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    // Thursday in current week decides the year
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    // January 4 is always in week 1
    const week1 = new Date(d.getFullYear(), 0, 4);
    // Adjust to Thursday in week 1 and count weeks
    return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000) / 7);
  }

  /**
   * Generate chart data for visualization
   */
  generateChartData(): TradingChartData {
    if (this.history.length === 0) {
      return this.getEmptyChartData();
    }

    // Generate equity curve (cumulative returns over time)
    const equityCurve: ChartDataPoint[] = [];
    let cumulativeReturn = 0;

    // Sort history by timestamp for proper equity curve
    const sortedHistory = [...this.history].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    for (const trade of sortedHistory) {
      cumulativeReturn += trade.confidence || 0;
      equityCurve.push({
        timestamp: trade.timestamp,
        value: cumulativeReturn,
        label: `Trade: ${trade.action}`,
      });
    }

    // Generate drawdown curve
    const drawdownCurve: ChartDataPoint[] = [];
    let peak = -Infinity;
    let currentDrawdown = 0;

    for (const trade of sortedHistory) {
      const tradeReturn = trade.confidence || 0;
      peak = Math.max(peak, cumulativeReturn);
      currentDrawdown = peak - cumulativeReturn;
      drawdownCurve.push({
        timestamp: trade.timestamp,
        value: currentDrawdown,
      });
    }

    // Generate return distribution
    const returnDistribution: ChartDataPoint[] = [];
    const returns = sortedHistory.map(trade => trade.confidence || 0);

    // Create bins for return distribution
    const minReturn = Math.min(...returns);
    const maxReturn = Math.max(...returns);
    const binSize = (maxReturn - minReturn) / 10;

    for (let i = 0; i < 10; i++) {
      const binStart = minReturn + i * binSize;
      const binEnd = binStart + binSize;
      const count = returns.filter(r => r >= binStart && r < binEnd).length;

      returnDistribution.push({
        timestamp: `bin-${i}`,
        value: count,
        label: `${binStart.toFixed(2)}-${binEnd.toFixed(2)}`,
      });
    }

    // Generate win/loss ratio data
    const winLossRatio: ChartDataPoint[] = [];
    const wins = sortedHistory.filter(trade => (trade.confidence || 0) > 0).length;
    const losses = sortedHistory.filter(trade => (trade.confidence || 0) < 0).length;
    const neutral = sortedHistory.filter(trade => (trade.confidence || 0) === 0).length;

    if (wins > 0) {
      winLossRatio.push({
        timestamp: 'wins',
        value: wins,
        label: 'Winning Trades',
      });
    }

    if (losses > 0) {
      winLossRatio.push({
        timestamp: 'losses',
        value: losses,
        label: 'Losing Trades',
      });
    }

    if (neutral > 0) {
      winLossRatio.push({
        timestamp: 'neutral',
        value: neutral,
        label: 'Neutral Trades',
      });
    }

    return {
      equityCurve,
      drawdownCurve,
      returnDistribution,
      winLossRatio,
    };
  }

  private getEmptyChartData(): TradingChartData {
    return {
      equityCurve: [],
      drawdownCurve: [],
      returnDistribution: [],
      winLossRatio: [],
    };
  }

  /**
   * Get trading history statistics summary
   */
  getHistorySummary(): any {
    const stats = this.calculateHistoryStats();
    const chartData = this.generateChartData();

    return {
      summary: {
        totalTrades: stats.performance.totalTrades,
        winRate: stats.performance.winRate,
        totalReturn: stats.performance.totalReturn,
        sharpeRatio: stats.performance.sharpeRatio,
        maxDrawdown: stats.performance.maxDrawdown,
      },
      recent: {
        totalTrades: stats.recentPerformance.totalTrades,
        winRate: stats.recentPerformance.winRate,
        totalReturn: stats.recentPerformance.totalReturn,
      },
      charts: chartData,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Clear trading history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Import trading history
   */
  importHistory(history: TradingDecision[]): void {
    this.history = history.slice(0, this.maxHistoryLength);
  }

  /**
   * Export trading history
   */
  exportHistory(): TradingDecision[] {
    return [...this.history];
  }
}
