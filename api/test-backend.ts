import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const backendUrl = process.env.BACKEND_URL;
    const apiKey = process.env.API_KEY;

    // Test basic connectivity
    const healthResponse = await fetch(`${backendUrl}/health`);
    const healthData = await healthResponse.json();

    const result = {
      timestamp: new Date().toISOString(),
      backendUrl,
      apiKeyConfigured: !!apiKey,
      apiKeyPrefix: apiKey ? `${apiKey.substring(0, 8)}...` : "Not configured",
      healthCheck: healthData,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: process.env.VERCEL,
        VERCEL_ENV: process.env.VERCEL_ENV,
      },
    };

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      error: "Backend connection failed",
      details: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
}
