// Simple test function to verify Vercel API routes are working
export default async function handler(req, res) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    res.status(200).json({
      message: "Vercel API route is working!",
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.url,
      env: {
        hasApiKey: !!process.env.RECALL_API_KEY,
        nodeEnv: process.env.NODE_ENV,
      },
    });
  } catch (error) {
    console.error("Test function error:", error);
    res
      .status(500)
      .json({ error: "Test function failed", details: error.message });
  }
}
