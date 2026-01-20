/**
 * useSapienceData Hook
 * 
 * React hook for fetching and managing Sapience prediction market data
 */

import { useState, useEffect, useCallback } from 'react';
import {
  fetchActiveConditions,
  fetchMarketStats,
  fetchAccuracyLeaderboard,
  fetchForecastsByAddress,
  SapienceCondition,
  SapienceLeaderboardEntry,
  SapienceMarketStats,
  SapienceForecast,
} from '../services/sapienceApi';

export interface UseSapienceDataResult {
  // Data
  conditions: SapienceCondition[];
  stats: SapienceMarketStats | null;
  leaderboard: SapienceLeaderboardEntry[];
  agentForecasts: SapienceForecast[];
  
  // State
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  
  // Actions
  refresh: () => Promise<void>;
  fetchAgentForecasts: (address: string) => Promise<void>;
}

export function useSapienceData(agentAddress?: string): UseSapienceDataResult {
  const [conditions, setConditions] = useState<SapienceCondition[]>([]);
  const [stats, setStats] = useState<SapienceMarketStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<SapienceLeaderboardEntry[]>([]);
  const [agentForecasts, setAgentForecasts] = useState<SapienceForecast[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch all data in parallel
      const [conditionsData, statsData, leaderboardData] = await Promise.all([
        fetchActiveConditions(20),
        fetchMarketStats(),
        fetchAccuracyLeaderboard(10),
      ]);

      setConditions(conditionsData);
      setStats(statsData);
      setLeaderboard(leaderboardData);
      setLastUpdated(new Date());

      // If we have an agent address, fetch their forecasts too
      if (agentAddress) {
        const forecasts = await fetchForecastsByAddress(agentAddress);
        setAgentForecasts(forecasts);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch Sapience data';
      setError(message);
      console.error('Sapience data fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [agentAddress]);

  const fetchAgentForecastsFunc = useCallback(async (address: string) => {
    try {
      const forecasts = await fetchForecastsByAddress(address);
      setAgentForecasts(forecasts);
    } catch (err) {
      console.error('Failed to fetch agent forecasts:', err);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return {
    conditions,
    stats,
    leaderboard,
    agentForecasts,
    isLoading,
    error,
    lastUpdated,
    refresh: fetchData,
    fetchAgentForecasts: fetchAgentForecastsFunc,
  };
}

/**
 * Hook for tracking agent's position on leaderboard
 */
export function useAgentLeaderboardPosition(agentAddress?: string) {
  const [position, setPosition] = useState<number | null>(null);
  const [brierScore, setBrierScore] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!agentAddress) return;

    const fetchPosition = async () => {
      setIsLoading(true);
      try {
        const leaderboard = await fetchAccuracyLeaderboard(100);
        const entry = leaderboard.find(
          (e) => e.address.toLowerCase() === agentAddress.toLowerCase()
        );
        if (entry) {
          setPosition(entry.rank);
          setBrierScore(entry.brierScore);
        } else {
          setPosition(null);
          setBrierScore(null);
        }
      } catch (err) {
        console.error('Failed to fetch leaderboard position:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPosition();
    const interval = setInterval(fetchPosition, 120000); // Every 2 minutes
    return () => clearInterval(interval);
  }, [agentAddress]);

  return { position, brierScore, isLoading };
}
