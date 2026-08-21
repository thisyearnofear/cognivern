import { NextResponse } from "next/server";
import { isConfigured, fullRecall, addMemory } from "@/lib/hydradb-service";
import { apiUrl } from "@/lib/runtime-config";
import { unauthorizedResponse, verifyOsSession } from "@/lib/os-session";

/**
 * POST /api/os/intent
 * Wraps the existing /api/intent backend endpoint.
 * Optionally enriches the request with relevant HydraDB memories
 * so the intent engine has cross-session context.
 */
export async function POST(request: Request) {
  const session = verifyOsSession(request);
  if (!session) return unauthorizedResponse();

  const authorization = request.headers.get("authorization") || "";
  const body = await request.json();
  const { query, context } = body;

  if (!query || typeof query !== "string") {
    return NextResponse.json(
      { success: false, error: "Query is required" },
      { status: 400 },
    );
  }

  const restContext =
    context && typeof context === "object"
      ? { ...(context as Record<string, unknown>) }
      : {};
  delete restContext.workspaceId;
  const tenant = { workspaceId: session.workspaceId, userId: session.userId };

  let enrichedContext: Record<string, unknown> = { ...restContext };
  if (isConfigured()) {
    try {
      const recall = await fullRecall(query, tenant);
      if (recall.ok && recall.results) {
        const memoryTexts = recall.results
          .map((r) => r.text)
          .filter((t): t is string => Boolean(t));

        if (memoryTexts.length > 0) {
          enrichedContext = {
            ...enrichedContext,
            memoryContext: memoryTexts,
          };
        }
      }
    } catch {
      // Memory recall is best-effort — proceed without it
    }
  }

  try {
    const response = await fetch(apiUrl("/api/intent"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization,
      },
      body: JSON.stringify({ query, context: enrichedContext }),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { success: false, error: `Backend error ${response.status}: ${text}` },
        { status: response.status },
      );
    }

    const data = await response.json();

    if (isConfigured() && data.success && data.data) {
      const resultText =
        typeof data.data.response === "string"
          ? data.data.response.slice(0, 200)
          : "";
      if (resultText) {
        addMemory(
          `[result] ${resultText}`,
          `Result: ${query.slice(0, 60)}`,
          tenant,
        ).catch(() => {});
      }
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to reach intent service" },
      { status: 502 },
    );
  }
}
