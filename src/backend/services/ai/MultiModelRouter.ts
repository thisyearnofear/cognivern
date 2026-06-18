import type { MultiModelConfig } from "./multi-model-types.js";
import { executeProvider } from "./MultiModelRouter.providers.js";

export interface AiUsageRecord {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  taskClass: string;
  timestamp: string;
}

const ESTIMATED_COST_PER_1K_TOKENS: Record<string, number> = {
  gemini: 0.00125,
  openai: 0.00015,
  anthropic: 0.00025,
  groq: 0.0002,
  fireworks: 0.0001,
  kilocode: 0.0001,
  venice: 0.0001,
  chaingpt: 0.0002,
};

export class MultiModelRouter {
  private config: MultiModelConfig;
  private lastUsage: AiUsageRecord | null = null;

  constructor(config?: Partial<MultiModelConfig>) {
    this.config = {
      providers: {
        chaingpt: { enabled: true, model: "chat/completions" },
        workersAI: { enabled: true, model: "@cf/meta/llama-3-8b-instruct" },
        fireworks: { enabled: true, model: "accounts/fireworks/models/deepseek-v4-flash" },
        kilocode: { enabled: true, model: "minimax/minimax-m2.5:free" },
        groq: { enabled: true, model: "llama-3.3-70b-versatile" },
        venice: { enabled: true, model: "llama-3.3-70b" },
        openai: { enabled: true, model: "gpt-4o-mini" },
        gemini: { enabled: true, model: process.env.GEMINI_MODEL || "gemini-3.1-pro-preview" },
        anthropic: { enabled: true, model: "claude-3-haiku-20240307" },
      },
      fallbackOrder: [
        "gemini", "fireworks", "groq", "venice",
        "openai", "anthropic", "kilocode", "chaingpt", "workers-ai",
      ],
      timeoutMs: 30000,
      userApiKeys: {},
      ...config,
    };
  }

  private getApiKey(provider: string): string | undefined {
    const userKey = this.config.userApiKeys?.[provider as keyof typeof this.config.userApiKeys];
    if (userKey) return userKey;

    const envKeyMap: Record<string, string> = {
      chaingpt: "CHAINGPT_API_KEY",
      fireworks: "FIREWORKS_API_KEY",
      kilocode: "KILOCODE_API_KEY",
      groq: "GROQ_API_KEY",
      venice: "VENICE_API_KEY",
      openai: "OPENAI_API_KEY",
      gemini: "GEMINI_API_KEY",
      anthropic: "ANTHROPIC_API_KEY",
    };

    const envKey = envKeyMap[provider];
    return envKey ? process.env[envKey] : undefined;
  }

  async analyzeGovernance(
    prompt: string,
    preference:
      | "auto"
      | "workers-ai" | "fireworks" | "kilocode"
      | "openai" | "gemini" | "anthropic" | "chaingpt" = "auto",
  ): Promise<string> {
    const provider = preference === "auto" ? this.config.fallbackOrder[0] : preference;
    return this.executeWithFallback(prompt, provider, "governance");
  }

  async analyzeWithChainGPT(
    prompt: string,
    policyContext?: {
      agentId?: string;
      policyId?: string;
      currentBudget?: string;
      allowedVendors?: string[];
      holdThreshold?: string;
    },
  ): Promise<string> {
    const apiKey = this.getApiKey("chaingpt");
    if (!apiKey) {
      throw new Error("ChainGPT API key not configured");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const systemContext = policyContext
        ? `You are Cognivern's governance copilot. Cognivern is the control plane for autonomous Web3 agents:
- Policy: enforcing spend limits, vendor allowlists, and approval thresholds
- Privacy: Fhenix-encrypted confidential policy evaluation
- Audit: cryptographic proof of every governance decision

Current governance context:
- Agent: ${policyContext.agentId || "unknown"}
- Policy: ${policyContext.policyId || "unknown"}
- Budget: ${policyContext.currentBudget || "unknown"}
- Allowed Vendors: ${policyContext.allowedVendors?.join(", ") || "all"}
- Hold Threshold: ${policyContext.holdThreshold || "unknown"}

Provide governance-aware analysis with specific references to policy rules being evaluated.`
        : `You are Cognivern's Web3 governance copilot, specialized in:
- Smart contract analysis and vulnerability detection
- EVM opcode and calldata decoding
- Sanction and risk assessment for contract addresses
- Blockchain protocol analysis
- DeFi and DEX integration patterns

Provide precise, actionable governance insights with Web3-specific terminology.`;

      const response = await fetch(
        "https://api.chaingpt.org/api/v1/chat/completions",
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            model: this.config.providers.chaingpt!.model,
            messages: [
              { role: "system", content: systemContext },
              { role: "user", content: prompt },
            ],
            temperature: 0.3,
            max_tokens: 2048,
          }),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`ChainGPT API error: ${response.status} ${error}`);
      }

      const data = await response.json();
      return (
        data.choices[0]?.message?.content ||
        JSON.stringify({ score: 50, reasoning: "No response" })
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async generateBriefingScript(
    thoughts: string[],
    actions: any[],
    preference:
      | "auto"
      | "workers-ai" | "fireworks" | "kilocode"
      | "openai" | "gemini" | "anthropic" = "auto",
  ): Promise<string> {
    const provider = preference === "auto" ? this.config.fallbackOrder[0] : preference;

    const prompt = `
Recent Thoughts:
${thoughts.slice(-5).join("\n")}

Recent Actions:
${JSON.stringify(actions.slice(-3), null, 2)}

Synthesize these into a 1-minute, conversational, and professional "Voice of Governance" briefing script.
Focus on key decisions, risk assessments, and policy enforcement highlights.
`.trim();

    return this.executeWithFallback(prompt, provider, "briefing");
  }

  private async executeWithFallback(
    prompt: string,
    initialProvider: string,
    taskType: "governance" | "briefing",
    attempt = 0,
  ): Promise<string> {
    const provider = this.config.fallbackOrder[attempt] || initialProvider;

    try {
      const result = await this.executeWithProvider(prompt, provider, taskType);

      const inputTokens = Math.ceil(prompt.length / 4);
      const outputTokens = Math.ceil(result.length / 4);
      const costPer1k = ESTIMATED_COST_PER_1K_TOKENS[provider] || 0.0001;
      this.lastUsage = {
        provider,
        model: this.config.providers[provider as keyof typeof this.config.providers]?.model || "unknown",
        inputTokens,
        outputTokens,
        costUsd: ((inputTokens + outputTokens) / 1000) * costPer1k,
        taskClass: taskType,
        timestamp: new Date().toISOString(),
      };

      return result;
    } catch (error) {
      console.warn(`Provider ${provider} failed:`, error);

      if (attempt < this.config.fallbackOrder.length - 1) {
        return this.executeWithFallback(prompt, initialProvider, taskType, attempt + 1);
      }

      throw new Error(
        `All AI providers failed (attempted: ${this.config.fallbackOrder.join(", ")})`,
      );
    }
  }

  getLastUsage(): AiUsageRecord | null {
    return this.lastUsage;
  }

  private async executeWithProvider(
    prompt: string,
    provider: string,
    taskType: "governance" | "briefing",
  ): Promise<string> {
    const apiKey = this.getApiKey(provider);
    if (!apiKey && provider !== "workers-ai") {
      throw new Error(`${provider} API key not configured`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      return await executeProvider(provider, prompt, controller.signal, taskType, this.config, apiKey || "");
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async testProviders(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    for (const provider of this.config.fallbackOrder) {
      try {
        await this.executeWithProvider("test", provider, "governance");
        results[provider] = true;
      } catch {
        results[provider] = false;
      }
    }
    return results;
  }
}
