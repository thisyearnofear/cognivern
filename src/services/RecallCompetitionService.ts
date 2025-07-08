import axios, { AxiosInstance, AxiosError } from "axios";
import logger from "../utils/logger.js";

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

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
  private retryConfig: RetryConfig;

  constructor() {
    // Use the correct sandbox API URL for trading simulator
    this.baseUrl =
      process.env.RECALL_API_URL ||
      "https://api.sandbox.competitions.recall.network";

    // Configure retry settings for rate limiting - more conservative
    this.retryConfig = {
      maxRetries: 1, // Reduced from 3 to 1
      baseDelay: 500, // Reduced from 1000ms to 500ms
      maxDelay: 2000, // Reduced from 10000ms to 2000ms
      backoffMultiplier: 2,
    };

    this.api = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${process.env.RECALL_TRADING_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });

    logger.info(
      `RecallCompetitionService initialized with baseUrl: ${this.baseUrl}`
    );
  }

  /**
   * Check if error is rate limiting (429) or server error (5xx)
   */
  private isRetryableError(error: AxiosError): boolean {
    if (!error.response) return true; // Network errors are retryable
    const status = error.response.status;
    return status === 429 || (status >= 500 && status < 600);
  }

  /**
   * Calculate delay for exponential backoff
   */
  private calculateDelay(attempt: number): number {
    const delay =
      this.retryConfig.baseDelay *
      Math.pow(this.retryConfig.backoffMultiplier, attempt);
    return Math.min(delay, this.retryConfig.maxDelay);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Execute API request with retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (error instanceof AxiosError) {
          const status = error.response?.status;

          if (status === 429) {
            logger.warn(
              `Rate limit hit for ${operationName}, attempt ${attempt + 1}/${this.retryConfig.maxRetries + 1}`
            );
          } else if (status && status >= 500) {
            logger.warn(
              `Server error (${status}) for ${operationName}, attempt ${attempt + 1}/${this.retryConfig.maxRetries + 1}`
            );
          } else if (!this.isRetryableError(error)) {
            // Non-retryable error (4xx except 429), throw immediately
            logger.error(
              `Non-retryable error for ${operationName}: ${error.message}`
            );
            throw error;
          }

          // If this is the last attempt, don't wait
          if (attempt < this.retryConfig.maxRetries) {
            const delay = this.calculateDelay(attempt);
            logger.info(`Waiting ${delay}ms before retry...`);
            await this.sleep(delay);
          }
        } else {
          // Non-axios error, throw immediately
          throw error;
        }
      }
    }

    logger.error(`All retry attempts failed for ${operationName}`);
    throw lastError!;
  }

  /**
   * Get live competitions
   */
  async getLiveCompetitions(): Promise<Competition[]> {
    return this.executeWithRetry(async () => {
      const response = await this.api.get("/api/competitions");
      return response.data.competitions || response.data || [];
    }, "getLiveCompetitions");
  }

  /**
   * Get upcoming competitions
   */
  async getUpcomingCompetitions(): Promise<Competition[]> {
    return this.executeWithRetry(async () => {
      const response = await this.api.get("/api/competitions?status=upcoming");
      return response.data.competitions || response.data || [];
    }, "getUpcomingCompetitions");
  }

  /**
   * Get completed competitions
   */
  async getCompletedCompetitions(limit: number = 10): Promise<Competition[]> {
    return this.executeWithRetry(async () => {
      const response = await this.api.get(
        `/api/competitions?status=completed&limit=${limit}`
      );
      return response.data.competitions || response.data || [];
    }, "getCompletedCompetitions");
  }

  /**
   * Get competition details
   */
  async getCompetition(competitionId: string): Promise<Competition | null> {
    return this.executeWithRetry(async () => {
      const response = await this.api.get(`/api/competitions/${competitionId}`);
      return response.data.competition || null;
    }, `getCompetition(${competitionId})`);
  }

  /**
   * Get competition leaderboard
   */
  async getCompetitionLeaderboard(
    competitionId: string
  ): Promise<RecallAgent[]> {
    return this.executeWithRetry(async () => {
      const response = await this.api.get(
        `/api/competitions/${competitionId}/leaderboard`
      );
      return response.data.leaderboard || [];
    }, `getCompetitionLeaderboard(${competitionId})`);
  }

  /**
   * Get agent details
   */
  async getAgent(agentId: string): Promise<RecallAgent | null> {
    return this.executeWithRetry(async () => {
      const response = await this.api.get(`/api/agents/${agentId}`);
      return response.data.agent || null;
    }, `getAgent(${agentId})`);
  }

  /**
   * Get top agents by AgentRank
   */
  async getTopAgents(limit: number = 20): Promise<RecallAgent[]> {
    return this.executeWithRetry(async () => {
      const response = await this.api.get(`/api/agents?limit=${limit}`);
      return response.data.agents || response.data || [];
    }, "getTopAgents");
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
      // Only log 404s as debug, not error (agent might not exist)
      if (error instanceof Error && error.message.includes("404")) {
        logger.debug(`Agent ${agentId} not found in competition metrics`);
        return null;
      }

      // Log other errors as warnings with minimal info
      logger.warn(`Failed to fetch trading metrics for ${agentId}:`, {
        status: error instanceof Error ? error.message : "Unknown error",
        agentId,
      });
      return null; // Return null instead of throwing to prevent cascade failures
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
    return this.executeWithRetry(async () => {
      const response = await this.api.get("/api/feed/live");
      return response.data.feed || [];
    }, "getLiveCompetitionFeed");
  }

  /**
   * Get essential stats with minimal API calls
   * This method reduces the number of individual agent calls
   */
  async getEssentialStats(): Promise<{
    competitions: Competition[];
    topAgents: RecallAgent[];
    totalStats: {
      totalCompetitions: number;
      activeCompetitions: number;
      totalAgents: number;
    };
  }> {
    return this.executeWithRetry(async () => {
      // Make only essential API calls in parallel
      const [competitions, topAgents] = await Promise.all([
        this.api.get("/api/competitions?limit=5"),
        this.api.get("/api/agents?limit=10"),
      ]);

      const competitionsData =
        competitions.data.competitions || competitions.data || [];
      const agentsData = topAgents.data.agents || topAgents.data || [];

      return {
        competitions: competitionsData,
        topAgents: agentsData,
        totalStats: {
          totalCompetitions: competitionsData.length,
          activeCompetitions: competitionsData.filter(
            (c: any) => c.status === "live"
          ).length,
          totalAgents: agentsData.length,
        },
      };
    }, "getEssentialStats");
  }
}
