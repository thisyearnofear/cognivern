/**
 * Sapience API Service - Frontend Integration
 *
 * Integrates with Sapience prediction markets for:
 * - Fetching active conditions/markets
 * - Viewing forecasts and attestations
 * - Leaderboard and Brier Score tracking
 */

import { gql, request } from "graphql-request";

// Sapience GraphQL endpoint
const SAPIENCE_GRAPHQL_ENDPOINT = "https://api.sapience.xyz/graphql";

// Chain IDs
export const CHAIN_ID_ARBITRUM = 42161;
export const CHAIN_ID_ETHEREAL = 5064014;

// Types
export interface SapienceCondition {
  id: string;
  question: string;
  shortName?: string;
  endTime: number;
  startTime?: number;
  resolution?: number;
  resolutionTime?: number;
  outcomeSlotCount: number;
  public: boolean;
}

export interface SapienceForecast {
  id: string;
  conditionId: string;
  forecaster: string;
  probability: number;
  comment?: string;
  timestamp: number;
  txHash: string;
}

export interface SapienceLeaderboardEntry {
  address: string;
  brierScore: number;
  forecastCount: number;
  rank: number;
  accuracy?: number;
}

export interface SapienceMarketStats {
  totalConditions: number;
  activeConditions: number;
  totalForecasts: number;
  totalForecasters: number;
}

/**
 * Fetch active prediction market conditions from Sapience
 */
export async function fetchActiveConditions(
  limit = 20,
): Promise<SapienceCondition[]> {
  const nowSec = Math.floor(Date.now() / 1000);

  const query = gql`
    query GetConditions($nowSec: Int, $limit: Int) {
      conditions(
        where: { public: { equals: true }, endTime: { gt: $nowSec } }
        take: $limit
        orderBy: { endTime: asc }
      ) {
        id
        question
        shortName
        endTime
        public
      }
    }
  `;

  try {
    const { conditions } = await request<{ conditions: SapienceCondition[] }>(
      SAPIENCE_GRAPHQL_ENDPOINT,
      query,
      { nowSec, limit },
    );
    return conditions;
  } catch (error) {
    console.error("Failed to fetch Sapience conditions:", error);
    return [];
  }
}

/**
 * Fetch a specific condition by ID
 */
export async function fetchCondition(
  conditionId: string,
): Promise<SapienceCondition | null> {
  const query = gql`
    query GetCondition($id: String!) {
      condition(where: { id: $id }) {
        id
        question
        shortName
        endTime
        resolution
        resolutionTime
        public
      }
    }
  `;

  try {
    const { condition } = await request<{ condition: SapienceCondition }>(
      SAPIENCE_GRAPHQL_ENDPOINT,
      query,
      { id: conditionId },
    );
    return condition;
  } catch (error) {
    console.error("Failed to fetch condition:", error);
    return null;
  }
}

/**
 * Fetch forecasts for a specific condition
 */
export async function fetchForecastsForCondition(
  conditionId: string,
): Promise<SapienceForecast[]> {
  const query = gql`
    query GetForecasts($conditionId: String!) {
      forecasts(
        where: { conditionId: { equals: $conditionId } }
        orderBy: { timestamp: desc }
        take: 50
      ) {
        id
        conditionId
        forecaster
        probability
        comment
        timestamp
        txHash
      }
    }
  `;

  try {
    const { forecasts } = await request<{ forecasts: SapienceForecast[] }>(
      SAPIENCE_GRAPHQL_ENDPOINT,
      query,
      { conditionId },
    );
    return forecasts;
  } catch (error) {
    console.error("Failed to fetch forecasts:", error);
    return [];
  }
}

/**
 * Fetch forecasts by a specific address
 */
export async function fetchForecastsByAddress(
  address: string,
): Promise<SapienceForecast[]> {
  const query = gql`
    query GetForecastsByAddress($address: String!) {
      forecasts(
        where: { forecaster: { equals: $address } }
        orderBy: { timestamp: desc }
        take: 100
      ) {
        id
        conditionId
        forecaster
        probability
        comment
        timestamp
        txHash
      }
    }
  `;

  try {
    const { forecasts } = await request<{ forecasts: SapienceForecast[] }>(
      SAPIENCE_GRAPHQL_ENDPOINT,
      query,
      { address: address.toLowerCase() },
    );
    return forecasts;
  } catch (error) {
    console.error("Failed to fetch forecasts by address:", error);
    return [];
  }
}

/**
 * Fetch leaderboard (accuracy track)
 */
export async function fetchAccuracyLeaderboard(
  limit = 50,
): Promise<SapienceLeaderboardEntry[]> {
  // getLeaderboard requires marketAddress and chainId which are currently unknown
  // We return an empty array to prevent dashboard crashes while keeping the UI structure
  console.warn(
    "Leaderboard fetching disabled: marketAddress and chainId required",
  );
  return [];
}

/**
 * Fetch platform statistics
 */
export async function fetchMarketStats(): Promise<SapienceMarketStats> {
  const nowSec = Math.floor(Date.now() / 1000);

  const query = gql`
    query GetStats($nowSec: Int) {
      aggregateCondition(where: { public: { equals: true } }) {
        _count {
          id
        }
      }
      activeConditions: aggregateCondition(
        where: { public: { equals: true }, endTime: { gt: $nowSec } }
      ) {
        _count {
          id
        }
      }
    }
  `;

  try {
    const data = await request<{
      aggregateCondition: { _count: { id: number } };
      activeConditions: { _count: { id: number } };
    }>(SAPIENCE_GRAPHQL_ENDPOINT, query, { nowSec });

    return {
      totalConditions: data.aggregateCondition._count.id,
      activeConditions: data.activeConditions._count.id,
      totalForecasts: 0,
      totalForecasters: 0,
    };
  } catch (error) {
    console.error("Failed to fetch market stats:", error);
    return {
      totalConditions: 0,
      activeConditions: 0,
      totalForecasts: 0,
      totalForecasters: 0,
    };
  }
}

/**
 * Calculate time remaining until condition ends
 */
export function getTimeRemaining(endTime: number): string {
  const now = Date.now() / 1000;
  const remaining = endTime - now;

  if (remaining <= 0) return "Ended";

  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Format Brier Score for display
 */
export function formatBrierScore(score: number): string {
  return score.toFixed(4);
}

/**
 * Get Arbitrum explorer URL for transaction
 */
export function getArbitrumTxUrl(txHash: string): string {
  return `https://arbiscan.io/tx/${txHash}`;
}

/**
 * Get EAS attestation URL
 */
export function getEasAttestationUrl(attestationId: string): string {
  return `https://arbitrum.easscan.org/attestation/view/${attestationId}`;
}
