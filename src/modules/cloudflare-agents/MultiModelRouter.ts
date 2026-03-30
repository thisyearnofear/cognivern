/**
 * Multi-Model Router for AI Governance Analysis
 *
 * Routes governance analysis requests to the optimal AI provider:
 * - Workers AI (default, cost-efficient)
 * - OpenAI (high quality)
 * - Gemini (advanced reasoning)
 *
 * Implements fallback logic and provider health checking.
 */

import type { AIAnalysisResult, MultiModelConfig } from "./types";

export class MultiModelRouter {
  private config: MultiModelConfig;

  constructor(config?: Partial<MultiModelConfig>) {
    this.config = {
      providers: {
        workersAI: {
          enabled: true,
          model: "@cf/meta/llama-3-8b-instruct",
        },
        openai: {
          enabled: true,
          model: "gpt-4o-mini",
        },
        gemini: {
          enabled: true,
          model: "gemini-2.0-flash-exp",
        },
      },
      fallbackOrder: ["workers-ai", "openai", "gemini"],
      timeoutMs: 30000,
      ...config,
    };
  }

  /**
   * Analyze governance action using configured AI provider
   */
  async analyzeGovernance(
    prompt: string,
    preference: "auto" | "workers-ai" | "openai" | "gemini" = "auto"
  ): Promise<string> {
    const provider = preference === "auto"
      ? this.config.fallbackOrder[0]
      : preference;

    return this.executeWithFallback(prompt, provider);
  }

  /**
   * Execute AI request with automatic fallback on failure
   */
  private async executeWithFallback(
    prompt: string,
    initialProvider: string,
    attempt = 0
  ): Promise<string> {
    const provider = this.config.fallbackOrder[attempt] || initialProvider;

    try {
      const result = await this.executeWithProvider(prompt, provider);
      return result;
    } catch (error) {
      console.warn(`Provider ${provider} failed:`, error);

      // Try next provider in fallback chain
      if (attempt < this.config.fallbackOrder.length - 1) {
        return this.executeWithFallback(prompt, initialProvider, attempt + 1);
      }

      // All providers failed
      throw new Error(
        `All AI providers failed (attempted: ${this.config.fallbackOrder.join(", ")})`
      );
    }
  }

  /**
   * Execute request with specific provider
   */
  private async executeWithProvider(
    prompt: string,
    provider: string
  ): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      switch (provider) {
        case "workers-ai":
          return this.executeWorkersAI(prompt, controller.signal);
        case "openai":
          return this.executeOpenAI(prompt, controller.signal);
        case "gemini":
          return this.executeGemini(prompt, controller.signal);
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Workers AI execution (Cloudflare native)
   */
  private async executeWorkersAI(
    prompt: string,
    signal: AbortSignal
  ): Promise<string> {
    // This will be called from a Worker with AI binding
    // @ts-ignore - AI binding is available in Worker environment
    const ai: Ai = globalThis.ai || this.getAIInstance();

    if (!ai) {
      throw new Error("Workers AI binding not available");
    }

    const response = await ai.run(
      this.config.providers.workersAI!.model,
      {
        messages: [
          { role: "system", content: this.getSystemPrompt() },
          { role: "user", content: prompt },
        ],
        temperature: 0.3, // Lower temperature for consistent governance decisions
        max_tokens: 1024,
      },
      { signal }
    );

    return response.response || JSON.stringify({ score: 50, reasoning: "No response" });
  }

  /**
   * OpenAI execution
   */
  private async executeOpenAI(
    prompt: string,
    signal: AbortSignal
  ): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error("OpenAI API key not configured");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.config.providers.openai!.model,
        messages: [
          { role: "system", content: this.getSystemPrompt() },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 1024,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content || JSON.stringify({ score: 50, reasoning: "No response" });
  }

  /**
   * Gemini execution
   */
  private async executeGemini(
    prompt: string,
    signal: AbortSignal
  ): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("Gemini API key not configured");
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.config.providers.gemini!.model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: this.getSystemPrompt() },
                { text: prompt },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify({ score: 50, reasoning: "No response" });
  }

  /**
   * System prompt for governance analysis
   */
  private getSystemPrompt(): string {
    return `You are an AI governance evaluator for autonomous AI agents. Your role is to:

1. Evaluate agent actions against governance policies
2. Assess risk levels objectively (0-100 scale)
3. Provide clear, actionable reasoning
4. Prioritize safety while enabling legitimate operations

You MUST respond with valid JSON in this exact format:
{
  "score": 0-100,
  "threshold": 70,
  "reasoning": "clear explanation of your decision",
  "riskFactors": ["list", "of", "identified", "risks"],
  "confidence": 0.0-1.0
}

Scoring guidelines:
- 0-30: High risk, likely policy violation
- 31-60: Medium risk, requires review
- 61-80: Low risk, generally safe
- 81-100: Very safe, clearly compliant

Be strict but fair. When in doubt, lean toward caution.`;
  }

  /**
   * Get AI instance (for testing/mock)
   */
  private getAIInstance(): Ai | null {
    // In production, this comes from the Worker environment
    // @ts-ignore
    return globalThis.ai || null;
  }

  /**
   * Test provider connectivity
   */
  async testProviders(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const provider of this.config.fallbackOrder) {
      try {
        await this.executeWithProvider("test", provider);
        results[provider] = true;
      } catch {
        results[provider] = false;
      }
    }

    return results;
  }
}
