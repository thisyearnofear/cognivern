import { NextResponse } from "next/server";
import {
  getStatus,
  ensureTenant,
  addMemory,
  fullRecall,
  recallPreferences,
  getRecentMemories,
  qna,
  getMetrics,
} from "@/lib/hydradb-service";

/**
 * GET /api/os/hydra
 * Returns HydraDB connection status and tenant health.
 * Used by the frontend to show the memory status indicator.
 */
export async function GET() {
  const status = await getStatus();
  return NextResponse.json({ success: true, data: status });
}

/**
 * POST /api/os/hydra
 * Body: { action: string, ...params }
 *
 * Actions:
 *   - "status"          → get status
 *   - "ensure-tenant"   → auto-create tenant if missing
 *   - "memory"          → { text, title? } — store a memory
 *   - "recall"          → { query } — full recall search
 *   - "recent"          → { limit? } — most recent memories
 *   - "preferences"     → { query } — preference recall
 *   - "qna"             → { question } — Q&A search
 *   - "metrics"         → get storage metrics
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (!action || typeof action !== "string") {
      return NextResponse.json(
        { success: false, error: "Action is required" },
        { status: 400 }
      );
    }

    switch (action) {
      case "status": {
        const status = await getStatus();
        return NextResponse.json({ success: true, data: status });
      }

      case "ensure-tenant": {
        const result = await ensureTenant();
        return NextResponse.json({
          success: result.ok,
          data: result,
          error: result.error,
        });
      }

      case "memory": {
        const { text, title } = body;
        if (!text || typeof text !== "string") {
          return NextResponse.json(
            { success: false, error: "text is required" },
            { status: 400 }
          );
        }
        const result = await addMemory(text, title);
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
            { status: 400 }
          );
        }
        const result = await fullRecall(query);
        return NextResponse.json({
          success: result.ok,
          data: result,
          error: result.error,
        });
      }

      case "recent": {
        const limit = typeof body.limit === "number" ? Math.min(Math.max(1, body.limit), 20) : 5;
        const result = await getRecentMemories(limit);
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
            { status: 400 }
          );
        }
        const result = await recallPreferences(query);
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
            { status: 400 }
          );
        }
        const result = await qna(question);
        return NextResponse.json({
          success: result.ok,
          data: result,
          error: result.error,
        });
      }

      case "metrics": {
        const result = await getMetrics();
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
            error: `Unknown action: ${action}. Available: status, ensure-tenant, memory, recall, preferences, qna, metrics`,
          },
          { status: 400 }
        );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
