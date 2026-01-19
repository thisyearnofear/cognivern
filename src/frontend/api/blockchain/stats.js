// Vercel API proxy for blockchain stats
export default async function handler(req, res) {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  // Get API key from environment variable (server-side only)
  const apiKey = process.env.RECALL_API_KEY || "your_recall_api_key_here";

    // Build the target URL - use HTTPS for production
    const targetUrl = "https://api.thisyearnofear.com/api/blockchain/stats";

  console.log("Blockchain stats proxy request:", {
    method: req.method,
    targetUrl,
    hasApiKey: !!apiKey,
  });

  try {
    // Forward the request to your Hetzner server
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
        ...(req.headers["user-agent"] && {
          "User-Agent": req.headers["user-agent"],
        }),
      },
      // Forward body for POST/PUT requests
      ...(req.method !== "GET" &&
        req.method !== "HEAD" && { body: JSON.stringify(req.body) }),
    });

    if (!response.ok) {
      console.error(`Proxy error: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({
        error: `Backend error: ${response.status}`,
      });
    }

    const data = await response.json();

    // Set CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // Return the data
    res.status(200).json(data);
  } catch (error) {
    console.error("Proxy error:", error);
    res.status(500).json({
      error: "Failed to connect to backend server",
      details: error.message,
    });
  }
}
