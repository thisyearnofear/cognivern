import type { MultiModelConfig } from "./types.js";

type TaskType = "governance" | "briefing";

function getSystemPrompt(taskType: TaskType): string {
  if (taskType === "briefing") {
    return `You are the "Voice of Governance", a professional and clear AI announcer.
Your goal is to synthesize complex governance logs into a short, conversational, and authoritative briefing script.

Voice Guidelines:
- Be clear and professional.
- Use natural transitions between thoughts and actions.
- Highlight risk assessments and policy decisions clearly.
- Keep it under 200 words.
- Start with a professional greeting like "Welcome to your Governance Briefing."
- End with a summary of the current system status.
- DO NOT use Markdown formatting (bold, italics, etc.) as this script will be read by TTS.`;
  }

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

export function getChainGPTSystemPrompt(taskType: TaskType): string {
  if (taskType === "briefing") {
    return `You are the "Voice of Governance" for Cognivern, a Web3 agent spend control plane.
Your goal is to synthesize complex governance logs into a short, conversational, and authoritative briefing script.
Keep it under 200 words, professional, and focused on Web3 agent operations.`;
  }

  return `You are Cognivern's governance evaluator for autonomous Web3 agents. Cognivern is the control plane for agent operations:
- Policy: enforcing spend limits, vendor allowlists, and approval thresholds
- Privacy: Fhenix-encrypted confidential policy evaluation
- Audit: cryptographic proof of every governance decision
- Web3: smart contracts, EVM, DeFi, and blockchain protocols

Your role is to:
1. Evaluate agent actions against governance policies
2. Assess risk levels objectively (0-100 scale)
3. Provide clear, actionable reasoning with Web3-specific context
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
- 0-30: High risk, likely policy violation (reify exploits, sanction violations, rug patterns)
- 31-60: Medium risk, requires review
- 61-80: Low risk, generally safe
- 81-100: Very safe, clearly compliant

Be strict but fair. When in doubt, lean toward caution.`;
}

function extractContent(
  data: any,
  taskType: TaskType,
  path?: string[],
): string {
  if (path) {
    let value = data;
    for (const key of path) {
      value = value?.[key];
    }
    if (value) return value;
  }

  const fallback =
    taskType === "briefing"
      ? "No response"
      : JSON.stringify({ score: 50, reasoning: "No response" });
  return data.choices?.[0]?.message?.content || fallback;
}

export async function executeGroq(
  prompt: string,
  signal: AbortSignal,
  taskType: TaskType,
  config: MultiModelConfig,
  apiKey: string,
): Promise<string> {
  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.providers.groq!.model,
        messages: [
          { role: "system", content: getSystemPrompt(taskType) },
          { role: "user", content: prompt },
        ],
        temperature: taskType === "briefing" ? 0.7 : 0.3,
        max_tokens: taskType === "briefing" ? 1024 : 2048,
        response_format:
          taskType === "governance"
            ? { type: "json_object" }
            : { type: "text" },
      }),
    },
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  return extractContent(data, taskType);
}

export async function executeVenice(
  prompt: string,
  signal: AbortSignal,
  taskType: TaskType,
  config: MultiModelConfig,
  apiKey: string,
): Promise<string> {
  const response = await fetch(
    "https://api.venice.ai/api/v1/chat/completions",
    {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.providers.venice!.model,
        messages: [
          { role: "system", content: getSystemPrompt(taskType) },
          { role: "user", content: prompt },
        ],
        temperature: taskType === "briefing" ? 0.7 : 0.3,
        max_tokens: taskType === "briefing" ? 1024 : 2048,
      }),
    },
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Venice API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  return extractContent(data, taskType);
}

export async function executeFireworks(
  prompt: string,
  signal: AbortSignal,
  taskType: TaskType,
  config: MultiModelConfig,
  apiKey: string,
): Promise<string> {
  const response = await fetch(
    "https://api.fireworks.ai/inference/v1/chat/completions",
    {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: config.providers.fireworks!.model,
        messages: [
          { role: "system", content: getSystemPrompt(taskType) },
          { role: "user", content: prompt },
        ],
        temperature: taskType === "briefing" ? 0.7 : 0.3,
        max_tokens: 4096,
        top_p: 1,
        top_k: 40,
        presence_penalty: 0,
        frequency_penalty: 0,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Fireworks API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  return extractContent(data, taskType);
}

export async function executeChainGPT(
  prompt: string,
  signal: AbortSignal,
  taskType: TaskType,
  config: MultiModelConfig,
  apiKey: string,
): Promise<string> {
  const response = await fetch(
    "https://api.chaingpt.org/api/v1/chat/completions",
    {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: config.providers.chaingpt!.model,
        messages: [
          { role: "system", content: getChainGPTSystemPrompt(taskType) },
          { role: "user", content: prompt },
        ],
        temperature: taskType === "briefing" ? 0.7 : 0.3,
        max_tokens: 2048,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `ChainGPT API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  return (
    data.choices?.[0]?.message?.content ||
    (taskType === "briefing"
      ? "No response"
      : JSON.stringify({ score: 50, reasoning: "No response" }))
  );
}

export async function executeKilocode(
  prompt: string,
  signal: AbortSignal,
  taskType: TaskType,
  config: MultiModelConfig,
  apiKey: string,
): Promise<string> {
  const response = await fetch(
    "https://api.kilo.ai/api/openrouter/v1/chat/completions",
    {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: config.providers.kilocode!.model,
        messages: [
          { role: "system", content: getSystemPrompt(taskType) },
          { role: "user", content: prompt },
        ],
        temperature: taskType === "briefing" ? 0.7 : 0.3,
        max_tokens: 1024,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Kilocode API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  return extractContent(data, taskType);
}

export async function executeWorkersAI(
  prompt: string,
  signal: AbortSignal,
  taskType: TaskType,
  config: MultiModelConfig,
): Promise<string> {
  interface WorkersAiBinding {
    run(
      model: string,
      input: Record<string, unknown>,
      options?: { signal?: AbortSignal },
    ): Promise<{ response?: string }>;
  }
  const binding = (globalThis as Record<string, unknown>).ai;
  const ai = binding as WorkersAiBinding | null;
  if (!ai) {
    throw new Error("Workers AI binding not available");
  }

  const response = await ai.run(
    config.providers.workersAI!.model,
    {
      messages: [
        { role: "system", content: getSystemPrompt(taskType) },
        { role: "user", content: prompt },
      ],
      temperature: taskType === "briefing" ? 0.7 : 0.3,
      max_tokens: 1024,
    },
    { signal },
  );

  if (taskType === "briefing") {
    return response.response || "I have no briefing at this time.";
  }

  return (
    response.response ||
    JSON.stringify({ score: 50, reasoning: "No response" })
  );
}

export async function executeOpenAI(
  prompt: string,
  signal: AbortSignal,
  taskType: TaskType,
  config: MultiModelConfig,
  apiKey: string,
): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.providers.openai!.model,
      messages: [
        { role: "system", content: getSystemPrompt(taskType) },
        { role: "user", content: prompt },
      ],
      temperature: taskType === "briefing" ? 0.7 : 0.3,
      max_tokens: 1024,
      response_format:
        taskType === "governance"
          ? { type: "json_object" }
          : { type: "text" },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `OpenAI API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  return extractContent(data, taskType);
}

export async function executeGemini(
  prompt: string,
  signal: AbortSignal,
  taskType: TaskType,
  config: MultiModelConfig,
  apiKey: string,
): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.providers.gemini!.model}:generateContent?key=${apiKey}`,
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
              { text: getSystemPrompt(taskType) },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          temperature: taskType === "briefing" ? 0.7 : 0.3,
          maxOutputTokens: 1024,
          responseMimeType:
            taskType === "governance" ? "application/json" : "text/plain",
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Gemini API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  return (
    data.candidates?.[0]?.content?.parts?.[0]?.text ||
    (taskType === "briefing"
      ? "No response"
      : JSON.stringify({ score: 50, reasoning: "No response" }))
  );
}

export async function executeAnthropic(
  prompt: string,
  signal: AbortSignal,
  taskType: TaskType,
  config: MultiModelConfig,
  apiKey: string,
): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal,
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.providers.anthropic!.model,
      max_tokens: 1024,
      system: getSystemPrompt(taskType),
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Anthropic API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  return (
    data.content?.[0]?.text ||
    (taskType === "briefing"
      ? "No response"
      : JSON.stringify({ score: 50, reasoning: "No response" }))
  );
}

const providerMap: Record<
  string,
  (
    prompt: string,
    signal: AbortSignal,
    taskType: TaskType,
    config: MultiModelConfig,
    apiKey: string,
  ) => Promise<string>
> = {
  groq: executeGroq,
  venice: executeVenice,
  fireworks: executeFireworks,
  "workers-ai": (p, s, t, c, _k) => executeWorkersAI(p, s, t, c),
  chaingpt: executeChainGPT,
  kilocode: executeKilocode,
  openai: executeOpenAI,
  gemini: executeGemini,
  anthropic: executeAnthropic,
};

export function executeProvider(
  provider: string,
  prompt: string,
  signal: AbortSignal,
  taskType: TaskType,
  config: MultiModelConfig,
  apiKey: string,
): Promise<string> {
  const fn = providerMap[provider];
  if (!fn) {
    throw new Error(`Unknown provider: ${provider}`);
  }
  return fn(prompt, signal, taskType, config, apiKey);
}
