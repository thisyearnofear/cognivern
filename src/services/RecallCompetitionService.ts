import axios, { AxiosInstance } from 'axios';
import logger from '../utils/logger.js';

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
  type: 'trading' | 'classification' | 'prediction' | 'sentiment';
  status: 'upcoming' | 'live' | 'completed';
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
    this.baseUrl = process.env.RECALL_API_URL || 'https://api.competitions.recall.network';
    
    this.api = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${process.env.RECALL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    logger.info('RecallCompetitionService initialized');
  }

  /**
   * Get live competitions
   */
  async getLiveCompetitions(): Promise<Competition[]> {
    try {
      const response = await this.api.get('/api/competitions/live');
      return response.data.competitions || [];
    } catch (error) {
      logger.error('Error fetching live competitions:', error);
      // Return mock data for demo purposes
      return this.getMockCompetitions().filter(c => c.status === 'live');
    }
  }

  /**
   * Get upcoming competitions
   */
  async getUpcomingCompetitions(): Promise<Competition[]> {
    try {
      const response = await this.api.get('/api/competitions/upcoming');
      return response.data.competitions || [];
    } catch (error) {
      logger.error('Error fetching upcoming competitions:', error);
      return this.getMockCompetitions().filter(c => c.status === 'upcoming');
    }
  }

  /**
   * Get completed competitions
   */
  async getCompletedCompetitions(limit: number = 10): Promise<Competition[]> {
    try {
      const response = await this.api.get(`/api/competitions/completed?limit=${limit}`);
      return response.data.competitions || [];
    } catch (error) {
      logger.error('Error fetching completed competitions:', error);
      return this.getMockCompetitions().filter(c => c.status === 'completed').slice(0, limit);
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
      return this.getMockCompetitions().find(c => c.id === competitionId) || null;
    }
  }

  /**
   * Get competition leaderboard
   */
  async getCompetitionLeaderboard(competitionId: string): Promise<RecallAgent[]> {
    try {
      const response = await this.api.get(`/api/competitions/${competitionId}/leaderboard`);
      return response.data.leaderboard || [];
    } catch (error) {
      logger.error(`Error fetching leaderboard for ${competitionId}:`, error);
      return this.getMockAgents().slice(0, 10);
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
      return this.getMockAgents().find(a => a.id === agentId) || null;
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
      logger.error('Error fetching top agents:', error);
      return this.getMockAgents().slice(0, limit);
    }
  }

  /**
   * Get agent competition history
   */
  async getAgentCompetitionHistory(agentId: string): Promise<CompetitionResult[]> {
    try {
      const response = await this.api.get(`/api/agents/${agentId}/competitions`);
      return response.data.results || [];
    } catch (error) {
      logger.error(`Error fetching competition history for ${agentId}:`, error);
      return this.getMockCompetitionResults(agentId);
    }
  }

  /**
   * Get agent trading metrics
   */
  async getAgentTradingMetrics(agentId: string, competitionId?: string): Promise<TradingMetrics | null> {
    try {
      const url = competitionId 
        ? `/api/agents/${agentId}/metrics?competition=${competitionId}`
        : `/api/agents/${agentId}/metrics`;
      
      const response = await this.api.get(url);
      return response.data.metrics || null;
    } catch (error) {
      logger.error(`Error fetching trading metrics for ${agentId}:`, error);
      return this.getMockTradingMetrics();
    }
  }

  /**
   * Submit agent to competition
   */
  async submitAgentToCompetition(agentId: string, competitionId: string): Promise<boolean> {
    try {
      const response = await this.api.post(`/api/competitions/${competitionId}/submit`, {
        agentId
      });
      return response.status === 200;
    } catch (error) {
      logger.error(`Error submitting agent ${agentId} to competition ${competitionId}:`, error);
      return false;
    }
  }

  /**
   * Get live competition feed
   */
  async getLiveCompetitionFeed(): Promise<any[]> {
    try {
      const response = await this.api.get('/api/feed/live');
      return response.data.feed || [];
    } catch (error) {
      logger.error('Error fetching live competition feed:', error);
      return this.getMockLiveFeed();
    }
  }

  // Mock data methods for demo purposes
  private getMockCompetitions(): Competition[] {
    return [
      {
        id: 'comp-001',
        name: 'DeFi Alpha Trading Championship',
        type: 'trading',
        status: 'live',
        startTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        participants: 47,
        prizePool: 50000,
        leaderboard: this.getMockAgents().slice(0, 5),
        description: 'Live DeFi trading competition with real market conditions'
      },
      {
        id: 'comp-002',
        name: 'ETH/USDC Scalping Challenge',
        type: 'trading',
        status: 'upcoming',
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        participants: 23,
        prizePool: 25000,
        leaderboard: [],
        description: 'High-frequency trading competition on ETH/USDC pair'
      },
      {
        id: 'comp-003',
        name: 'Cross-Chain Arbitrage Masters',
        type: 'trading',
        status: 'completed',
        startTime: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        participants: 89,
        prizePool: 100000,
        winner: this.getMockAgents()[0],
        leaderboard: this.getMockAgents().slice(0, 10),
        description: 'Multi-chain arbitrage opportunities across Ethereum, Polygon, and Arbitrum'
      }
    ];
  }

  private getMockAgents(): RecallAgent[] {
    return [
      {
        id: 'agent-001',
        name: 'AlphaTrader Pro',
        agentRank: 1,
        totalEarnings: 247500,
        winRate: 78.5,
        competitionsWon: 12,
        competitionsEntered: 34,
        reputation: 98.2,
        lastActive: new Date().toISOString(),
        avatar: '🤖'
      },
      {
        id: 'agent-002',
        name: 'DeFi Arbitrage Bot',
        agentRank: 2,
        totalEarnings: 189300,
        winRate: 71.2,
        competitionsWon: 9,
        competitionsEntered: 28,
        reputation: 94.7,
        lastActive: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        avatar: '⚡'
      },
      {
        id: 'agent-003',
        name: 'Quantum Yield Hunter',
        agentRank: 3,
        totalEarnings: 156800,
        winRate: 68.9,
        competitionsWon: 7,
        competitionsEntered: 25,
        reputation: 91.3,
        lastActive: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        avatar: '🔬'
      },
      {
        id: 'agent-004',
        name: 'MEV Sandwich Master',
        agentRank: 4,
        totalEarnings: 134200,
        winRate: 65.4,
        competitionsWon: 6,
        competitionsEntered: 22,
        reputation: 88.9,
        lastActive: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        avatar: '🥪'
      },
      {
        id: 'agent-005',
        name: 'Flash Loan Wizard',
        agentRank: 5,
        totalEarnings: 112600,
        winRate: 62.1,
        competitionsWon: 5,
        competitionsEntered: 19,
        reputation: 85.6,
        lastActive: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        avatar: '⚡'
      }
    ];
  }

  private getMockTradingMetrics(): TradingMetrics {
    return {
      totalReturn: 34.7,
      sharpeRatio: 2.14,
      maxDrawdown: -8.3,
      winRate: 67.8,
      avgTradeSize: 1250,
      totalTrades: 156,
      profitFactor: 1.89,
      volatility: 12.4
    };
  }

  private getMockCompetitionResults(agentId: string): CompetitionResult[] {
    return [
      {
        competitionId: 'comp-003',
        agentId,
        rank: 1,
        score: 94.7,
        metrics: this.getMockTradingMetrics(),
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      },
      {
        competitionId: 'comp-004',
        agentId,
        rank: 3,
        score: 87.2,
        metrics: this.getMockTradingMetrics(),
        timestamp: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()
      }
    ];
  }

  private getMockLiveFeed(): any[] {
    return [
      {
        type: 'competition_win',
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        data: {
          agent: this.getMockAgents()[0],
          competition: this.getMockCompetitions()[2],
          earnings: 15000
        }
      },
      {
        type: 'new_leader',
        timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        data: {
          agent: this.getMockAgents()[1],
          competition: this.getMockCompetitions()[0],
          previousRank: 3,
          newRank: 1
        }
      }
    ];
  }
}