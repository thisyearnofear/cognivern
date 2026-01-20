/**
 * Automated Forecasting Service
 * 
 * Generates AI-powered forecasts for Sapience prediction markets
 */

import { gql } from 'graphql-request';
import { graphqlRequest } from '@sapience/sdk';
import { SapienceService, ForecastRequest } from './SapienceService.js';
import logger from '../utils/logger.js';

export interface ForecastResult {
  probability: number;
  reasoning: string;
  confidence: number;
}

export interface MarketCondition {
  id: string;
  question: string;
  shortName?: string;
  endTime: number;
  startTime?: number;
}

export class AutomatedForecastingService {
  private sapienceService: SapienceService;
  private llmApiKey: string;
  private llmModel: string;
  private minConfidence: number;

  constructor(config: {
    sapienceService: SapienceService;
    llmApiKey?: string;
    llmModel?: string;
    minConfidence?: number;
  }) {
    this.sapienceService = config.sapienceService;
    this.llmApiKey = config.llmApiKey || process.env.OPENROUTER_API_KEY || '';
    this.llmModel = config.llmModel || 'openai/gpt-4o-mini';
    this.minConfidence = config.minConfidence || 0.6;

    if (!this.llmApiKey) {
      logger.warn('AutomatedForecastingService initialized without LLM API key');
    }

    logger.info('AutomatedForecastingService initialized');
  }

  /**
   * Fetch random active condition from Sapience
   */
  async fetchRandomCondition(): Promise<MarketCondition | null> {
    const nowSec = Math.floor(Date.now() / 1000);
    
    const query = gql`
      query Conditions($nowSec: Int) {
        conditions(
          where: { 
            public: { equals: true }
            endTime: { gt: $nowSec }
          }
          take: 50
        ) {
          id
          question
          shortName
          endTime
          startTime
        }
      }
    `;

    try {
      const { conditions } = await graphqlRequest<{ conditions: MarketCondition[] }>(query, {
        nowSec,
      });

      if (conditions.length === 0) {
        logger.warn('No active conditions found');
        return null;
      }

      // Pick a random condition
      const randomIndex = Math.floor(Math.random() * conditions.length);
      return conditions[randomIndex];
    } catch (error) {
      logger.error('Failed to fetch conditions:', error);
      return null;
    }
  }

  /**
   * Generate forecast using LLM
   */
  async generateForecast(question: string): Promise<ForecastResult> {
    if (!this.llmApiKey) {
      throw new Error('LLM API key not configured');
    }

    const prompt = `You are a forecaster. Estimate the probability (0-100) that the answer to this question is YES.

Question: "${question}"

First, provide brief reasoning (1-2 sentences, under 160 characters total, no URLs or citations).
Then on the final line, output ONLY the probability as a number (e.g., "75").`;

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.llmApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.llmModel,
          messages: [{
            role: 'user',
            content: prompt,
          }],
        }),
      });

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content.trim();

      // Extract probability from last line
      const lines = content.split('\n').filter((line: string) => line.trim());
      const lastLine = lines[lines.length - 1];
      const probability = parseInt(lastLine.replace(/[^0-9]/g, ''), 10);

      // Reasoning is everything except the last line
      const reasoning = lines.slice(0, -1).join(' ').trim();

      // Calculate confidence based on how decisive the probability is
      // Probabilities near 50% indicate low confidence, near 0/100 indicate high confidence
      const confidence = Math.abs(probability - 50) / 50;

      return {
        probability: Math.max(0, Math.min(100, probability)),
        reasoning: reasoning.substring(0, 160), // Enforce character limit
        confidence,
      };
    } catch (error) {
      logger.error('Failed to generate forecast:', error);
      throw error;
    }
  }

  /**
   * Submit automated forecast for a condition
   */
  async submitAutomatedForecast(condition: MarketCondition): Promise<string> {
    const question = condition.shortName || condition.question;
    
    logger.info(`Generating forecast for: ${question}`);
    
    // Generate forecast
    const forecast = await this.generateForecast(question);
    
    logger.info(`Forecast generated: ${forecast.probability}% (confidence: ${forecast.confidence.toFixed(2)})`);
    logger.info(`Reasoning: ${forecast.reasoning}`);

    // Check confidence threshold
    if (forecast.confidence < this.minConfidence) {
      logger.warn(`Forecast confidence ${forecast.confidence.toFixed(2)} below threshold ${this.minConfidence}. Skipping submission.`);
      throw new Error('Forecast confidence too low');
    }

    // Submit forecast
    const forecastRequest: ForecastRequest = {
      marketId: condition.id,
      probability: forecast.probability,
      confidence: forecast.confidence,
      reasoning: forecast.reasoning,
    };

    const txHash = await this.sapienceService.submitForecast(forecastRequest);
    
    logger.info(`Forecast submitted successfully! Tx: ${txHash}`);
    
    return txHash;
  }

  /**
   * Run automated forecasting loop
   * Fetches a random condition and submits a forecast
   */
  async runForecastingCycle(): Promise<{
    success: boolean;
    conditionId?: string;
    txHash?: string;
    error?: string;
  }> {
    try {
      // Fetch random condition
      const condition = await this.fetchRandomCondition();
      
      if (!condition) {
        return {
          success: false,
          error: 'No active conditions available',
        };
      }

      // Submit forecast
      const txHash = await this.submitAutomatedForecast(condition);

      return {
        success: true,
        conditionId: condition.id,
        txHash,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Forecasting cycle failed:', error);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Start continuous forecasting with interval
   */
  startContinuousForecasting(intervalMinutes: number = 60): NodeJS.Timeout {
    logger.info(`Starting continuous forecasting with ${intervalMinutes} minute interval`);
    
    // Run immediately
    this.runForecastingCycle();
    
    // Then run on interval
    return setInterval(() => {
      this.runForecastingCycle();
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Get forecasting statistics
   */
  getStats() {
    return {
      llmModel: this.llmModel,
      minConfidence: this.minConfidence,
      walletAddress: this.sapienceService.getAddress(),
    };
  }
}
