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
      setDecisions(data.decisions || data.data || []);
    } catch (err) {
      console.error(`Error fetching ${agentType} trading data:`, err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setDecisions([]);
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
