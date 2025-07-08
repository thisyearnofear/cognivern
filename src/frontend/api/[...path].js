/**
 * Vercel API proxy function
 * Forwards requests to Hetzner server with proper authentication
 */

// Vercel serverless function
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

  // Get the API path from the request
  const { path } = req.query;
  const apiPath = Array.isArray(path) ? path.join("/") : path || "";

  // Build the target URL with query parameters
  const backendUrl = process.env.BACKEND_URL || "http://157.180.36.156:3000";
  const url = new URL(`${backendUrl}/api/${apiPath}`);

  // Forward query parameters (excluding the path parameter)
  Object.keys(req.query).forEach((key) => {
    if (key !== "path") {
      const value = req.query[key];
      if (Array.isArray(value)) {
        value.forEach((v) => url.searchParams.append(key, v));
      } else {
        url.searchParams.append(key, value);
      }
    }
  });

  const targetUrl = url.toString();

  // Get API key from environment variable (server-side only)
  const apiKey =
    process.env.API_KEY ||
    process.env.RECALL_API_KEY ||
    "5ffd36bb15925fe2_dd811d9881d72940";

  console.log("Proxy request:", {
    method: req.method,
    path: apiPath,
    targetUrl,
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey?.length,
    envVars: Object.keys(process.env).filter((key) => key.includes("RECALL")),
  });

  try {
    // Forward the request to your Hetzner server
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
        // Forward other headers if needed
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
