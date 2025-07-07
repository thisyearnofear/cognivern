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

  // Only include API key in development
  if (import.meta.env.DEV) {
    const apiKey = getApiKey();
    if (apiKey) {
      headers["X-API-KEY"] = apiKey;
    }
  }

  return headers;
}

/**
 * Get the correct API URL based on environment
 * - Production (Vercel): Use relative URLs to leverage proxy
 * - Development: Use full URLs to connect directly to server
 */
export function getApiUrl(endpoint: string): string {
  const isProduction = import.meta.env.PROD;

  if (isProduction) {
    // In production, use relative URLs that go through Vercel's proxy
    return endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  } else {
    // In development, use full URLs to connect directly to server
    const baseUrl =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

    // Clean the endpoint to avoid double slashes
    let cleanEndpoint = endpoint;
    if (cleanEndpoint.startsWith("/api/")) {
      cleanEndpoint = cleanEndpoint.slice(4); // Remove "/api/"
    } else if (cleanEndpoint.startsWith("/")) {
      cleanEndpoint = cleanEndpoint.slice(1); // Remove leading "/"
    }

    // Ensure baseUrl doesn't end with slash and cleanEndpoint doesn't start with slash
    const cleanBaseUrl = baseUrl.replace(/\/$/, "");
    return `${cleanBaseUrl}/${cleanEndpoint}`;
  }
}

/**
 * Base API URL (deprecated - use getApiUrl instead)
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
