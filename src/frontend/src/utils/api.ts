/**
 * API utility functions for frontend
 */

/**
 * Get API key from environment with secure fallback
 * WARNING: This exposes the API key in the browser - only use for development
 */
export function getApiKey(): string {
  // In production, the backend should handle API authentication
  // The frontend should not have access to sensitive API keys
  if (import.meta.env.PROD) {
    console.warn("API key should not be exposed in production frontend");
    return ""; // Don't expose API key in production
  }

  const apiKey = import.meta.env.VITE_API_KEY;

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
  const apiKey = import.meta.env.VITE_API_KEY || "sapience-hackathon-key";
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
  if (!cleanEndpoint.startsWith("/api/")) {
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
  const apiKey = import.meta.env.VITE_API_KEY || "sapience-hackathon-key";
  if (apiKey) {
    headers["X-API-KEY"] = apiKey;
  }

  return headers;
}

/**
 * Base API URL (deprecated - use getApiUrl instead)
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
