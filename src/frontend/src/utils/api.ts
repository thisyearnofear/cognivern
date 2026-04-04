/**
 * API utility functions for frontend
 */

/**
 * Get API key from environment with secure fallback
 * WARNING: This exposes the API key in the browser - only use for development
 */
export function getApiKey(): string {
  const apiKey = import.meta.env.VITE_API_KEY;

  // In production, use the environment variable if set
  // Otherwise, use a public API key for demo/hackathon purposes
  if (import.meta.env.PROD) {
    return apiKey || "sapience-hackathon-key";
  }

  if (!apiKey) {
    console.warn("VITE_API_KEY not set, using development key");
    return "development-api-key";
  }

  return apiKey;
}

/**
 * Get default headers for API requests
 */
export function getApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Always include API key for backend authentication
  const apiKey = getApiKey();
  if (apiKey) {
    headers["X-API-KEY"] = apiKey;
  }

  return headers;
}

/**
 * Get the correct API URL based on environment
 * - Production: Direct calls to backend server
 * - Development: Use Vite proxy for local development
 */
export function getApiUrl(endpoint: string): string {
  // Clean the endpoint to ensure proper formatting
  let cleanEndpoint = endpoint;

  // Ensure endpoint starts with /api/
  if (cleanEndpoint !== "/health" && !cleanEndpoint.startsWith("/api/")) {
    if (cleanEndpoint.startsWith("/")) {
      cleanEndpoint = `/api${cleanEndpoint}`;
    } else {
      cleanEndpoint = `/api/${cleanEndpoint}`;
    }
  }

  // FORCE backend URL in production to prevent calls to vercel domain
  if (import.meta.env.PROD) {
    const backendUrl = "https://api.thisyearnofear.com";
    return `${backendUrl}${cleanEndpoint}`;
  }

  // In development, use Vite proxy
  return cleanEndpoint;
}

/**
 * Add API key to request headers if needed
 */
export function getRequestHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Add API key if it exists
  const apiKey = getApiKey();
  if (apiKey) {
    headers["X-API-KEY"] = apiKey;
  }

  return headers;
}

/**
 * Base API URL (deprecated - use getApiUrl instead)
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
