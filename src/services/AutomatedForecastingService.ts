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
}

export class AutomatedForecastingService {
  private sapienceService: any;
  private forecastedMarkets: Set<string> = new Set();
  private graphqlEndpoint = 'https://api.sapience.xyz/graphql';
  private nextRunAt: Date | null = null;
  private lastThought: string = 'Initializing autonomous strategy...';
  private thoughtHistory: Array<{ timestamp: string; thought: string }> = [];

  // LLM Config with Fallback
  private providers = [
    {
      name: 'routeway',
      endpoint: 'https://api.routeway.ai/v1/chat/completions',
      apiKey: process.env.ROUTEWAY_API_KEY || '',
      model: 'kimi-k2-0905:free'
    },
    {
      name: 'groq',
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      apiKey: process.env.GROQ_API_KEY || '',
      model: 'llama-3.3-70b-versatile'
    }
  ];

  constructor(config: {
    sapienceService: any;
  }) {
    this.sapienceService = config.sapienceService;
    console.log('[ForecastingService] Initialized with Multi-LLM Fallback');
  }

  private recordThought(thought: string) {
    this.lastThought = thought;
    this.thoughtHistory.unshift({
      timestamp: new Date().toISOString(),
      thought
    });
    if (this.thoughtHistory.length > 10) {
      this.thoughtHistory.pop();
    }
  }

  private async callLLM(prompt: string): Promise<string> {
    this.recordThought('Consulting LLM cluster for market analysis...');
    console.log('[ForecastingService] Calling LLM...');
    for (const provider of this.providers) {
      if (!provider.apiKey) continue;
      try {
        console.log(`[ForecastingService] Trying provider: ${provider.name}`);
        const response = await fetch(provider.endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${provider.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: provider.model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
          }),
        });

        if (!response.ok) {
            throw new Error(`Provider ${provider.name} status ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content;
        if (content) return content.trim();
      } catch (error) {
        console.warn(`[ForecastingService] ${provider.name} failed`, error);
      }
    }
    throw new Error('All LLMs failed');
  }

  async fetchOptimalCondition(): Promise<MarketCondition | null> {
    this.recordThought('Scanning Sapience GraphQL for optimal market conditions...');
    console.log('[ForecastingService] Fetching optimal condition...');
    const nowSec = Math.floor(Date.now() / 1000);
    const query = `
      query GetConditions($nowSec: Int, $limit: Int) {
        conditions(
          where: { 
            public: { equals: true }
            endTime: { gt: $nowSec }
          }
          take: $limit
          orderBy: { endTime: asc }
        ) {
          id
          question
          shortName
          endTime
        }
      }
    `;

    try {
      const response = await fetch(this.graphqlEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { nowSec, limit: 50 } })
      });
      const result = await response.json();
      const conditions = result.data?.conditions as MarketCondition[];
      if (!conditions || conditions.length === 0) return null;
      
      const candidates = conditions.filter(c => !this.forecastedMarkets.has(c.id));
      if (candidates.length === 0) {
        this.forecastedMarkets.clear();
        return conditions[0];
      }
      candidates.sort((a, b) => b.endTime - a.endTime);
      return candidates[0];
    } catch (error) {
      console.error('[ForecastingService] GraphQL fetch failed', error);
      throw error;
    }
  }

  async generateForecast(question: string): Promise<ForecastResult> {
    this.recordThought(`Generating forecast for: ${question.substring(0, 50)}...`);
    const prompt = `You are a professional forecaster. Estimate the probability (0-100) that the answer to this question is YES.
Question: "${question}"
First, provide brief reasoning (1 sentence, max 150 chars).
Then on the final line, output ONLY the probability as a number.`;

    const content = await this.callLLM(prompt);
    const lines = content.split('\n').map((l: string) => l.trim()).filter(Boolean);
    const lastLine = lines[lines.length - 1];
    const probability = parseInt(lastLine.replace(/[^0-9]/g, ''), 10);
    
    // Extract reasoning from all lines except the last one
    let reasoning = lines.slice(0, -1).join(' ').trim();
    
    // Fallback if reasoning is empty or too short
    if (!reasoning || reasoning.length < 5) {
        reasoning = `Predicted ${probability}% probability for: ${question}`;
    }

    return {
      probability: Math.max(0, Math.min(100, probability)),
      reasoning: reasoning.substring(0, 160),
      confidence: Math.abs(probability - 50) / 50,
    };
  }

  async runForecastingCycle(): Promise<any> {
    console.log('[ForecastingService] Starting cycle...');
    try {
      const condition = await this.fetchOptimalCondition();
      if (!condition) {
          this.recordThought('No suitable markets found. Waiting for next cycle.');
          return { success: false, error: 'No markets' };
      }
      console.log('[ForecastingService] Selected market:', condition.question);

      const forecast = await this.generateForecast(condition.shortName || condition.question);
      console.log(`[ForecastingService] Generated forecast: ${forecast.probability}%`);

      this.recordThought(`Submitting on-chain attestation for ${condition.id.substring(0, 8)}...`);
      const txHash = await this.sapienceService.submitForecast({
        marketId: condition.id,
        probability: forecast.probability,
        confidence: forecast.confidence,
        reasoning: forecast.reasoning
      });
      console.log('[ForecastingService] Forecast submitted! Tx:', txHash);

      this.forecastedMarkets.add(condition.id);
      this.recordThought('Forecast successfully attested. Monitoring market updates.');
      return { 
          success: true, 
          txHash,
          forecast,
          conditionId: condition.id
      };
    } catch (error) {
      console.error('[ForecastingService] Cycle failed', error);
      this.recordThought('Last cycle failed. Recovering for next attempt.');
      return { success: false, error: 'Internal' };
    }
  }

  startContinuousForecasting(intervalMinutes: number = 60) {
    this.nextRunAt = new Date(Date.now() + intervalMinutes * 60 * 1000);
    
    setInterval(() => {
        this.runForecastingCycle();
        this.nextRunAt = new Date(Date.now() + intervalMinutes * 60 * 1000);
    }, intervalMinutes * 60 * 1000);
  }

  getStats() {
    return {
      providers: this.providers.map(p => ({ name: p.name, model: p.model })),
      forecastCount: this.forecastedMarkets.size,
      nextRunAt: this.nextRunAt?.toISOString(),
      lastThought: this.lastThought,
      thoughtHistory: this.thoughtHistory,
      timestamp: new Date().toISOString()
    };
  }
}
