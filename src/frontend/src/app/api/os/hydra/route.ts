import { NextResponse } from "next/server";
import {
  getStatus,
  addMemory,
  fullRecall,
  recallPreferences,
  getRecentMemories,
  qna,
  MAX_MEMORY_CHARS,
  MAX_QUERY_CHARS,
  type MemoryTenant,
} from "@/lib/hydradb-service";
import { unauthorizedResponse, verifyOsSession } from "@/lib/os-session";

const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function allowRequest(workspaceId: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(workspaceId);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(workspaceId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_MAX) return false;
  bucket.count += 1;
  return true;
}

function rateLimited(): NextResponse {
  return NextResponse.json(
    { success: false, error: "Too many memory requests. Try again shortly." },
    { status: 429 },
  );
}

/**
 * GET /api/os/hydra
 * Returns HydraDB connection status and tenant health.
 * Used by the frontend to show the memory status indicator.
 */
export async function GET(request: Request) {
  const session = verifyOsSession(request);
  if (!session) return unauthorizedResponse();
  if (!allowRequest(session.workspaceId)) return rateLimited();

  const status = await getStatus();
  return NextResponse.json({ success: true, data: status });
}

/**
 * POST /api/os/hydra
 * Body: { action: string, ...params }
 *
 * Actions:
 *   - "status"          → get status
 *   - "memory"          → { text, title? } — store a memory
 *   - "recall"/"search" → { query } — full recall search
 *   - "recent"          → { limit? } — most recent memories
 *   - "preferences"     → { query } — preference recall
 *   - "qna"             → { question } — Q&A search
 */
export async function POST(request: Request) {
  const session = verifyOsSession(request);
  if (!session) return unauthorizedResponse();
  if (!allowRequest(session.workspaceId)) return rateLimited();

  const tenant: MemoryTenant = {
    workspaceId: session.workspaceId,
    userId: session.userId,
  };

  try {
    const body = await request.json();
    const { action } = body;

    if (!action || typeof action !== "string") {
      return NextResponse.json(
        { success: false, error: "Action is required" },
        { status: 400 },
      );
    }

    switch (action) {
      case "status": {
        const status = await getStatus();
        return NextResponse.json({ success: true, data: status });
      }

      case "ensure-tenant":
      case "metrics":
        return NextResponse.json(
          { success: false, error: "This action is not available" },
          { status: 403 },
        );

      case "memory": {
        const { text, title } = body;
        if (!text || typeof text !== "string") {
          return NextResponse.json(
            { success: false, error: "text is required" },
            { status: 400 },
          );
        }
        if (text.length > MAX_MEMORY_CHARS) {
          return NextResponse.json(
            { success: false, error: `text exceeds ${MAX_MEMORY_CHARS} characters` },
            { status: 400 },
          );
        }
        const result = await addMemory(text, title, tenant);
        return NextResponse.json({
          success: result.ok,
          data: result,
          error: result.error,
        });
      }

      case "recall":
      case "search": {
        const { query } = body;
        if (!query || typeof query !== "string") {
          return NextResponse.json(
            { success: false, error: "query is required" },
            { status: 400 },
          );
        }
        if (query.length > MAX_QUERY_CHARS) {
          return NextResponse.json(
            { success: false, error: `query exceeds ${MAX_QUERY_CHARS} characters` },
            { status: 400 },
          );
        }
        const result = await fullRecall(query, tenant);
        return NextResponse.json({
          success: result.ok,
          data: result,
          error: result.error,
        });
      }

      case "recent": {
        const limit =
          typeof body.limit === "number"
            ? Math.min(Math.max(1, body.limit), 20)
            : 5;
        const result = await getRecentMemories(limit, tenant);
        return NextResponse.json({
          success: result.ok,
          data: result,
          error: result.error,
        });
      }

      case "preferences": {
        const { query } = body;
        if (!query || typeof query !== "string") {
          return NextResponse.json(
            { success: false, error: "query is required" },
            { status: 400 },
          );
        }
        if (query.length > MAX_QUERY_CHARS) {
          return NextResponse.json(
            { success: false, error: `query exceeds ${MAX_QUERY_CHARS} characters` },
            { status: 400 },
          );
        }
        const result = await recallPreferences(query, tenant);
        return NextResponse.json({
          success: result.ok,
          data: result,
          error: result.error,
        });
      }

      case "qna": {
        const { question } = body;
        if (!question || typeof question !== "string") {
          return NextResponse.json(
            { success: false, error: "question is required" },
            { status: 400 },
          );
        }
        if (question.length > MAX_QUERY_CHARS) {
          return NextResponse.json(
            { success: false, error: `question exceeds ${MAX_QUERY_CHARS} characters` },
            { status: 400 },
          );
        }
        const result = await qna(question, tenant);
        return NextResponse.json({
          success: result.ok,
          data: result,
          error: result.error,
        });
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown action: ${action}. Available: status, memory, recall, preferences, qna, recent`,
          },
          { status: 400 },
        );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
