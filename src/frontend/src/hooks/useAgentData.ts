// Shared hooks to eliminate useState/useEffect duplication across components
import { useState, useEffect, useCallback } from 'react';
import {
  Agent,
  AgentType,
  AgentStatus,
  AgentState,
  TradingDecision,
  UseAgentState,
  UseTradingData,
} from '../types';
import { isDemoAgent } from '../utils/demoAgents';
import { getApiUrl, getApiKey } from '../utils/api';

// Generic agent data hook - replaces repeated patterns
export const useAgentData = (agentType: AgentType): UseAgentState => {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [status, setStatus] = useState<AgentState>({
    isActive: false,
    lastActivity: '',
    lastUpdate: '',
    tradesExecuted: 0,
    performance: {
      totalReturn: 0,
      winRate: 0,
      sharpeRatio: 0,
      complianceScore: 100,
      autonomyLevel: 1,
      riskProfile: 'low',
    },
    metrics: {
      avgResponseTime: 0,
      responseTime: 0,
      successRate: 0,
      errorRate: 0,
      totalRequests: 0,
      lastActive: '',
      uptime: 0,
      actionsToday: 0,
    },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(getApiUrl(`/api/agents/${agentType}/status`), {
        headers: {
          'X-API-KEY': getApiKey(),
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch ${agentType} agent data`);
      }

      const data = await response.json();
      setAgent(data.agent);
      if (data.status) {
        setStatus((prev) => ({ ...prev, ...data.status }));
      }
    } catch (err) {
      console.error(`Error fetching ${agentType} agent data:`, err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [agentType]);

  const startAgent = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(getApiUrl(`/api/agents/${agentType}/start`), {
        method: 'POST',
        headers: {
          'X-API-KEY': getApiKey(),
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to start ${agentType} agent`);
      }

      setStatus((prev) => ({ ...prev, isActive: true }));
      await refreshData();
    } catch (err) {
      console.error(`Error starting ${agentType} agent:`, err);
      setError(err instanceof Error ? err.message : 'Failed to start agent');
    }
  }, [agentType, refreshData]);

  const stopAgent = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(getApiUrl(`/api/agents/${agentType}/stop`), {
        method: 'POST',
        headers: {
          'X-API-KEY': getApiKey(),
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to stop ${agentType} agent`);
      }

      setStatus((prev) => ({ ...prev, isActive: false }));
      await refreshData();
    } catch (err) {
      console.error(`Error stopping ${agentType} agent:`, err);
      setError(err instanceof Error ? err.message : 'Failed to stop agent');
    }
  }, [agentType, refreshData]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  return {
    agent,
    status,
    isLoading,
    error,
    startAgent,
    stopAgent,
    refreshData,
  };
};

// Trading decisions hook - replaces repeated trading data patterns
export const useTradingData = (agentType: AgentType): UseTradingData => {
  const [decisions, setDecisions] = useState<TradingDecision[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(getApiUrl(`/api/agents/${agentType}/decisions`), {
        headers: {
          'X-API-KEY': getApiKey(),
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch ${agentType} trading decisions`);
      }

      const data = await response.json();
      const decisionsData = data.decisions || data.data || [];

      // Fall back to demo decisions when API returns empty for demo agents
      if (decisionsData.length === 0 && isDemoAgent(agentType)) {
        setDecisions(generateDemoDecisions(agentType));
      } else {
        setDecisions(decisionsData);
      }
    } catch (err) {
      console.error(`Error fetching ${agentType} trading data:`, err);
      // Fall back to demo decisions when API fails for demo agents
      if (isDemoAgent(agentType)) {
        setDecisions(generateDemoDecisions(agentType));
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setDecisions([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [agentType]);

  useEffect(() => {
    refreshData();

    // Set up polling for real-time updates
    const interval = setInterval(refreshData, 30000);
    return () => clearInterval(interval);
  }, [refreshData]);

  return {
    decisions,
    isLoading,
    error,
    refreshData,
  };
};

/** Generate demo trading decisions for demo agents when the API returns empty. */
function generateDemoDecisions(agentType: AgentType): TradingDecision[] {
  const actions: Array<'buy' | 'sell' | 'hold'>[] = [['buy'], ['sell'], ['hold']];
  const now = Date.now();
  return Array.from({ length: 20 }, (_, i) => ({
    id: `demo-decision-${agentType}-${i}`,
    agentType,
    timestamp: new Date(now - i * 3600000).toISOString(),
    action: [['buy'], ['sell'], ['hold']][i % 3][0],
    price: 1.05 + Math.sin(i * 0.5) * 0.15,
    confidence: 0.6 + Math.random() * 0.35,
    rationale: `Demo decision ${i + 1}: ${['Market momentum indicator positive', 'Price above SMA-50', 'Portfolio rebalancing needed', 'Risk threshold met', 'Volume spike detected'][i % 5]}`,
    sentimentData: {
      sentiment: -0.3 + Math.random() * 0.6,
      confidence: 0.5 + Math.random() * 0.4,
      sources: ['demo-market-feed'],
    },
    riskScore: Math.random() * 0.4,
    metadata: {
      dailyBudget: { used: 150 + i * 30, limit: 500 },
      portfolioValue: 5000 + Math.sin(i * 0.3) * 500,
    },
    simulation: {
      wouldExecute: true,
      warnings: [],
    },
  }));
}

// Generic loading state hook
export const useLoadingState = (initialLoading = false) => {
  const [isLoading, setIsLoading] = useState(initialLoading);
  const [error, setError] = useState<string | null>(null);

  const withLoading = useCallback(async <T>(asyncFn: () => Promise<T>): Promise<T | null> => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await asyncFn();
      return result;
    } catch (err) {
      console.error('Error in async operation:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    isLoading,
    error,
    withLoading,
    clearError,
    setIsLoading,
    setError,
  };
};
