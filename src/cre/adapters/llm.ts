import { ForecastInput, ForecastOutput } from "../types.js";

export interface LlmAdapter {
  generateForecast(input: ForecastInput): Promise<ForecastOutput>;
}

type Provider = {
  name: string;
  endpoint: string;
  apiKey: string;
  model: string;
};

function clampProbability(p: number) {
  if (!Number.isFinite(p)) return 50;
  return Math.max(0, Math.min(100, Math.round(p)));
}

export class DefaultLlmAdapter implements LlmAdapter {
  private providers: Provider[] = [
    {
      name: "routeway",
      endpoint: "https://api.routeway.ai/v1/chat/completions",
      apiKey: process.env.ROUTEWAY_API_KEY || "",
      model: "kimi-k2-0905:free",
    },
    {
      name: "groq",
      endpoint: "https://api.groq.com/openai/v1/chat/completions",
      apiKey: process.env.GROQ_API_KEY || "",
      model: "llama-3.3-70b-versatile",
    },
  ];

  async generateForecast(input: ForecastInput): Promise<ForecastOutput> {
    const prompt = this.buildPrompt(input);

    for (const p of this.providers) {
      if (!p.apiKey) continue;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        const response = await fetch(p.endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${p.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: p.model,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.2,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`${p.name} HTTP ${response.status}`);
        }

        const data = (await response.json()) as any;
        const content: string | undefined = data.choices?.[0]?.message?.content;
        if (!content) throw new Error(`${p.name} empty response`);

        const parsed = this.parseForecast(content);
        return {
          ...parsed,
          provider: p.name,
          model: p.model,
        };
      } catch {
        // continue
      }
    }

    // deterministic fallback
    return {
      probability: 50,
      reasoning: "Insufficient signal from providers; defaulting to 50%.",
      provider: "fallback",
      model: "none",
    };
  }

  private buildPrompt(input: ForecastInput) {
    const feedLines = input.priceFeeds
      .map((f) => `- ${f.feedName}: ${f.value} (decimals=${f.decimals}, updatedAt=${f.updatedAt})`)
      .join("\n");

    return [
      "You are Cognivern, a professional forecaster.",
      "Return: (1) 1-sentence reasoning (<=160 chars) and (2) final line: ONLY a number 0-100.",
      `Question: \"${input.condition.question}\"`,
      "On-chain context (Chainlink Data Feeds):",
      feedLines || "- (none)",
    ].join("\n");
  }

  private parseForecast(text: string): Pick<ForecastOutput, "probability" | "reasoning"> {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const last = lines[lines.length - 1] || "";
    const num = Number(last.replace(/[^0-9.]/g, ""));
    const probability = clampProbability(num);

    const reasoning = (lines.slice(0, -1).join(" ") || text).slice(0, 160);
    return { probability, reasoning };
  }
}
