import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.thisyearnofear.com";

/**
 * POST /api/os/intent
 * Wraps the existing /api/intent backend endpoint.
 * Returns a streamed response with the result text character-by-character
 * for the terminal UX.
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

  try {
    const response = await fetch(`${API_URL}/intent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, context }),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { success: false, error: `Backend error ${response.status}: ${text}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to reach intent service" },
      { status: 502 }
    );
  }
}
