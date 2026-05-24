import { NextResponse } from "next/server";
import { isConfigured, fullRecall } from "@/lib/hydradb-service";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.thisyearnofear.com";

/**
 * POST /api/os/intent
 * Wraps the existing /api/intent backend endpoint.
 * Optionally enriches the request with relevant HydraDB memories
 * so the intent engine has cross-session context.
 */
export async function POST(request: Request) {
  const body = await request.json();
  const { query, context } = body;

  if (!query || typeof query !== "string") {
    return NextResponse.json(
      { success: false, error: "Query is required" },
      { status: 400 }
    );
  }

  // Step 1: Recall relevant HydraDB memories to enrich context
  let enrichedContext = context || {};
  if (isConfigured()) {
    try {
      const recall = await fullRecall(query);
      if (recall.ok && recall.results) {
        // Extract the memory texts from the recall results
        // recall.results is a RecallResult object with a nested results array
        const innerResults = recall.results?.results;
        const memoryTexts = Array.isArray(innerResults)
          ? innerResults.map((r: { text?: string }) => r.text).filter(Boolean)
          : [];

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
    const response = await fetch(`${API_URL}/intent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, context: enrichedContext }),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { success: false, error: `Backend error ${response.status}: ${text}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Step 2: After successful intent, also store the result as a memory
    if (isConfigured() && data.success && data.data) {
      const { addMemory } = await import("@/lib/hydradb-service");
      // Dynamic import to keep the critical path fast
      const resultText =
        typeof data.data.response === "string"
          ? data.data.response.slice(0, 200)
          : "";
      if (resultText) {
        addMemory(`[result] ${resultText}`, `Result: ${query.slice(0, 60)}`).catch(() => {});
      }
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to reach intent service" },
      { status: 502 }
    );
  }
}
