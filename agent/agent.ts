/**
 * Cognivern Copilot — main agent runtime.
 *
 * Implements the Gemini 3 function-calling loop with the multi-step
 * mission protocol described in agent/instructions.md:
 *
 *   PLAN → EVIDENCE → PREVIEW → CONFIRM → EXECUTE → AUDIT
 *
 * This runtime is the canonical "agent" submitted to the Google Cloud
 * "Building Agents for Real-World Challenges" hackathon. The same
 * runtime is wrapped for Agent Builder via agent/agent-builder.yaml.
 *
 * Run locally:
 *   GEMINI_API_KEY=...  COGNIVERN_API_KEY=...  \
 *   MONGODB_URI=mongodb+srv://...  pnpm tsx agent/agent.ts "Pay vendor 0xabc..."
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  ALL_TOOL_DECLARATIONS,
  executeTool,
  HUMAN_CONFIRMATION_REQUIRED,
  AgentToolContext,
} from "./tools/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: unknown };
}

interface GeminiContent {
  role: "user" | "model" | "function";
  parts: GeminiPart[];
}

interface GeminiTool {
  functionDeclarations: typeof ALL_TOOL_DECLARATIONS;
}

interface AgentRunResult {
  /** Final user-facing summary. */
  summary: string;
  /** Decision id from preview, if a spend was attempted. */
  decisionId?: string;
  /** Attestation hash from preview. */
  attestationHash?: string;
  /** Audit log id from the executed spend, if any. */
  auditLogId?: string;
  /** Full transcript of tool calls. */
  transcript: Array<{
    role: "model" | "tool";
    name?: string;
    args?: Record<string, unknown>;
    result?: unknown;
    text?: string;
  }>;
}

// ---------------------------------------------------------------------------
// System prompt loader
// ---------------------------------------------------------------------------

async function loadInstructions(): Promise<string> {
  return (await readFile(join(__dirname, "instructions.md"), "utf8")).trim();
}

// ---------------------------------------------------------------------------
// Human-in-the-loop gate
// ---------------------------------------------------------------------------

async function askHuman(
  prompt: string,
  context: Record<string, unknown>,
): Promise<{ approved: boolean; token?: string }> {
  // In Agent Builder this is a webhook back to the operator UI.
  // Locally we read from stdin so a CLI demo still works.
  if (!process.stdin.isTTY) {
    return { approved: true, token: "auto-approved-non-interactive" };
  }
  process.stdout.write(
    `\n[HUMAN-IN-THE-LOOP] ${prompt}\n${JSON.stringify(context, null, 2)}\nApprove? [y/N] `,
  );
  return new Promise((resolve) => {
    let buf = "";
    process.stdin.once("data", (chunk) => {
      buf = chunk.toString().trim().toLowerCase();
      resolve({ approved: buf === "y" || buf === "yes", token: `cli-${Date.now()}` });
    });
  });
}

// ---------------------------------------------------------------------------
// Gemini 3 REST call
// ---------------------------------------------------------------------------

async function callGemini(
  apiKey: string,
  model: string,
  systemInstruction: string,
  contents: GeminiContent[],
): Promise<GeminiContent> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents,
    tools: [
      {
        functionDeclarations: [...ALL_TOOL_DECLARATIONS],
      } as GeminiTool,
    ],
    toolConfig: { functionCallingConfig: { mode: "AUTO" } },
    generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
  };

  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Gemini ${model} error: ${r.status} ${err}`);
  }
  const data = (await r.json()) as { candidates: Array<{ content: GeminiContent }> };
  return data.candidates[0].content;
}

// ---------------------------------------------------------------------------
// Main agent loop
// ---------------------------------------------------------------------------

export interface AgentRunOptions {
  goal: string;
  cognivernApiKey: string;
  cognivernBaseUrl: string;
  mongodbUri: string;
  mongodbDatabase: string;
  geminiApiKey?: string;
  geminiModel?: string;
  /** When true, the agent will not call cognivern_execute_spend even if
   *  the human approves. Useful for the recorded demo. */
  previewOnly?: boolean;
}

export async function runAgent(opts: AgentRunOptions): Promise<AgentRunResult> {
  const model = opts.geminiModel || process.env.GEMINI_MODEL || "gemini-3-pro-preview";
  const apiKey = opts.geminiApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY required");

  const ctx: AgentToolContext = {
    cognivern: {
      apiKey: opts.cognivernApiKey,
      baseUrl: opts.cognivernBaseUrl,
    },
    mongodb: {
      mongodbUri: opts.mongodbUri,
      databaseName: opts.mongodbDatabase,
      useStdioServer: false,
    },
  };

  const systemInstruction = await loadInstructions();
  const contents: GeminiContent[] = [
    {
      role: "user",
      parts: [{ text: opts.goal }],
    },
  ];

  const transcript: AgentRunResult["transcript"] = [];
  let decisionId: string | undefined;
  let attestationHash: string | undefined;
  let auditLogId: string | undefined;
  const MAX_TURNS = 12;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const modelContent = await callGemini(
      apiKey,
      model,
      systemInstruction,
      contents,
    );

    // No function call — model is done.
    const fnCall = modelContent.parts.find((p) => p.functionCall);
    if (!fnCall) {
      const text =
        modelContent.parts.find((p) => p.text)?.text ||
        "(no response from model)";
      transcript.push({ role: "model", text });
      return {
        summary: text,
        decisionId,
        attestationHash,
        auditLogId,
        transcript,
      };
    }

    // Push the model turn into history.
    contents.push({ role: "model", parts: modelContent.parts });
    transcript.push({
      role: "model",
      name: fnCall.functionCall!.name,
      args: fnCall.functionCall!.args,
    });

    // HITL gate.
    if (HUMAN_CONFIRMATION_REQUIRED.has(fnCall.functionCall!.name)) {
      const confirm = await askHuman(
        `The agent wants to call ${fnCall.functionCall!.name}. Approve?`,
        fnCall.functionCall!.args,
      );
      if (!confirm.approved) {
        const refusal = "Operator denied execution. Spend aborted.";
        contents.push({
          role: "function",
          parts: [
            {
              functionResponse: {
                name: fnCall.functionCall!.name,
                response: { denied: true, reason: refusal },
              },
            },
          ],
        });
        transcript.push({ role: "tool", result: { denied: true, reason: refusal } });
        // Ask the model to wrap up.
        continue;
      }
      fnCall.functionCall!.args.humanConfirmationToken = confirm.token;
    }

    // Execute the tool.
    let result: unknown;
    try {
      result = await executeTool(
        ctx,
        fnCall.functionCall!.name,
        fnCall.functionCall!.args,
      );
    } catch (e) {
      result = { error: e instanceof Error ? e.message : String(e) };
    }
    transcript.push({ role: "tool", result });

    // Capture the receipts when they appear.
    if (
      fnCall.functionCall!.name === "cognivern_preview_spend" &&
      typeof result === "object" &&
      result !== null
    ) {
      const r = result as Record<string, unknown>;
      if (typeof r.decisionId === "string") decisionId = r.decisionId;
      if (typeof r.attestationHash === "string") attestationHash = r.attestationHash;
    }
    if (
      fnCall.functionCall!.name === "cognivern_execute_spend" &&
      typeof result === "object" &&
      result !== null
    ) {
      const r = result as Record<string, unknown>;
      if (typeof r.auditLogId === "string") auditLogId = r.auditLogId;
    }

    // If previewOnly is set, intercept execute_spend.
    if (
      opts.previewOnly &&
      fnCall.functionCall!.name === "cognivern_execute_spend"
    ) {
      const intercepted = {
        intercepted: true,
        reason: "previewOnly mode — no real spend",
      };
      contents.push({
        role: "function",
        parts: [
          {
            functionResponse: { name: fnCall.functionCall!.name, response: intercepted },
          },
        ],
      });
      transcript.push({ role: "tool", result: intercepted });
      continue;
    }

    contents.push({
      role: "function",
      parts: [
        {
          functionResponse: {
            name: fnCall.functionCall!.name,
            response: result,
          },
        },
      ],
    });
  }

  return {
    summary: "Agent reached max turns without a final answer.",
    decisionId,
    attestationHash,
    auditLogId,
    transcript,
  };
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const goal = process.argv[2] || "Pay 100 USDC to vendor 0xABC for API credits if their last audit was clean.";
  runAgent({
    goal,
    cognivernApiKey: process.env.COGNIVERN_API_KEY || "development-api-key",
    cognivernBaseUrl: process.env.COGNIVERN_BASE_URL || "https://cognivern.thisyearnofear.com",
    mongodbUri:
      process.env.MONGODB_URI ||
      "mongodb://localhost:27017",
    mongodbDatabase: process.env.MONGODB_DB_NAME || "cognivern",
    previewOnly: process.env.PREVIEW_ONLY === "1",
  })
    .then((r) => {
      console.log("\n=== AGENT SUMMARY ===");
      console.log(r.summary);
      console.log("\n=== RECEIPTS ===");
      console.log("decisionId:        ", r.decisionId);
      console.log("attestationHash:   ", r.attestationHash);
      console.log("auditLogId:        ", r.auditLogId);
    })
    .catch((e) => {
      console.error("Agent failed:", e);
      process.exit(1);
    });
}
