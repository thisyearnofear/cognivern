import axios, { AxiosInstance } from "axios";
import logger from "../utils/logger.js";

export interface RecallAgent {
  id: string;
  name: string;
  agentRank: number;
  totalEarnings: number;
  winRate: number;
  competitionsWon: number;
  competitionsEntered: number;
  reputation: number;
  lastActive: string;
  avatar?: string;
}

export interface Competition {
  id: string;
  name: string;
  type: "trading" | "classification" | "prediction" | "sentiment";
  status: "upcoming" | "live" | "completed";
  startTime: string;
  endTime: string;
  participants: number;
  prizePool: number;
  winner?: RecallAgent;
  leaderboard: RecallAgent[];
  description: string;
}

export interface TradingMetrics {
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  avgTradeSize: number;
  totalTrades: number;
  profitFactor: number;
  volatility: number;
}

export interface CompetitionResult {
  competitionId: string;
  agentId: string;
  rank: number;
  score: number;
  metrics: TradingMetrics;
  timestamp: string;
}

export class RecallCompetitionService {
  private api: AxiosInstance;
  private baseUrl: string;

  constructor() {
    this.baseUrl =
      process.env.RECALL_API_URL || "https://api.competitions.recall.network";

    this.api = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${process.env.RECALL_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });

    logger.info("RecallCompetitionService initialized");
  }

  /**
   * Get live competitions
   */
  async getLiveCompetitions(): Promise<Competition[]> {
    try {
      const response = await this.api.get("/api/competitions/live");
      return response.data.competitions || [];
    } catch (error) {
      logger.error("Error fetching live competitions:", error);
      throw new Error(
        `Failed to fetch live competitions: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get upcoming competitions
   */
  async getUpcomingCompetitions(): Promise<Competition[]> {
    try {
      const response = await this.api.get("/api/competitions/upcoming");
      return response.data.competitions || [];
    } catch (error) {
      logger.error("Error fetching upcoming competitions:", error);
      throw new Error(
        `Failed to fetch upcoming competitions: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get completed competitions
   */
  async getCompletedCompetitions(limit: number = 10): Promise<Competition[]> {
    try {
      const response = await this.api.get(
        `/api/competitions/completed?limit=${limit}`
      );
      return response.data.competitions || [];
    } catch (error) {
      logger.error("Error fetching completed competitions:", error);
      throw new Error(
        `Failed to fetch completed competitions: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get competition details
   */
  async getCompetition(competitionId: string): Promise<Competition | null> {
    try {
      const response = await this.api.get(`/api/competitions/${competitionId}`);
      return response.data.competition || null;
    } catch (error) {
      logger.error(`Error fetching competition ${competitionId}:`, error);
      throw new Error(
        `Failed to fetch competition ${competitionId}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get competition leaderboard
   */
  async getCompetitionLeaderboard(
    competitionId: string
  ): Promise<RecallAgent[]> {
    try {
      const response = await this.api.get(
        `/api/competitions/${competitionId}/leaderboard`
      );
      return response.data.leaderboard || [];
    } catch (error) {
      logger.error(`Error fetching leaderboard for ${competitionId}:`, error);
      throw new Error(
        `Failed to fetch leaderboard for ${competitionId}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get agent details
   */
  async getAgent(agentId: string): Promise<RecallAgent | null> {
    try {
      const response = await this.api.get(`/api/agents/${agentId}`);
      return response.data.agent || null;
    } catch (error) {
      logger.error(`Error fetching agent ${agentId}:`, error);
      throw new Error(
        `Failed to fetch agent ${agentId}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get top agents by AgentRank
   */
  async getTopAgents(limit: number = 20): Promise<RecallAgent[]> {
    try {
      const response = await this.api.get(`/api/agents/top?limit=${limit}`);
      return response.data.agents || [];
    } catch (error) {
      logger.error("Error fetching top agents:", error);
      throw new Error(
        `Failed to fetch top agents: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get agent competition history
   */
  async getAgentCompetitionHistory(
    agentId: string
  ): Promise<CompetitionResult[]> {
    try {
      const response = await this.api.get(
        `/api/agents/${agentId}/competitions`
      );
      return response.data.results || [];
    } catch (error) {
      logger.error(`Error fetching competition history for ${agentId}:`, error);
      throw new Error(
        `Failed to fetch competition history for ${agentId}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get agent trading metrics
   */
  async getAgentTradingMetrics(
    agentId: string,
    competitionId?: string
  ): Promise<TradingMetrics | null> {
    try {
      const url = competitionId
        ? `/api/agents/${agentId}/metrics?competition=${competitionId}`
        : `/api/agents/${agentId}/metrics`;

      const response = await this.api.get(url);
      return response.data.metrics || null;
    } catch (error) {
      logger.error(`Error fetching trading metrics for ${agentId}:`, error);
      throw new Error(
        `Failed to fetch trading metrics for ${agentId}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Submit agent to competition
   */
  async submitAgentToCompetition(
    agentId: string,
    competitionId: string
  ): Promise<boolean> {
    try {
      const response = await this.api.post(
        `/api/competitions/${competitionId}/submit`,
        {
          agentId,
        }
      );
      return response.status === 200;
    } catch (error) {
      logger.error(
        `Error submitting agent ${agentId} to competition ${competitionId}:`,
        error
      );
      return false;
    }
  }

  /**
   * Get live competition feed
   */
  async getLiveCompetitionFeed(): Promise<any[]> {
    try {
      const response = await this.api.get("/api/feed/live");
      return response.data.feed || [];
    } catch (error) {
      logger.error("Error fetching live competition feed:", error);
      throw new Error(
        `Failed to fetch live competition feed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}
