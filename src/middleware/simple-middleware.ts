import { Request, Response, NextFunction } from "express";

// Simple console logger for middleware
const simpleLogger = {
  warn: (message: string) => console.warn(`[WARN] ${message}`),
  error: (message: string) => console.error(`[ERROR] ${message}`),
  info: (message: string) => console.log(`[INFO] ${message}`),
};

export const apiKeyMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const apiKey = req.headers["x-api-key"] || req.query.apiKey;

  if (!apiKey) {
    simpleLogger.warn("API request without API key");
    return res.status(401).json({
      error: "API key is required",
    });
  }

  if (apiKey !== process.env.API_KEY) {
    simpleLogger.warn("API request with invalid API key");
    return res.status(401).json({
      error: "Invalid API key",
    });
  }

  next();
};

export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  simpleLogger.error(`Unhandled error: ${error.message}`);

  // Don't expose internal errors in production
  const isDevelopment = process.env.NODE_ENV === "development";

  res.status(500).json({
    error: "Internal server error",
    message: isDevelopment ? error.message : "Something went wrong",
    ...(isDevelopment && { stack: error.stack }),
  });
};
