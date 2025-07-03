/**
 * API utility functions for frontend
 */

/**
 * Get API key from environment with secure fallback
 */
export function getApiKey(): string {
  const apiKey = import.meta.env.VITE_API_KEY;
  
  if (!apiKey) {
    console.warn('VITE_API_KEY not set, using development key');
    return 'development-api-key';
  }
  
  return apiKey;
}

/**
 * Get default headers for API requests
 */
export function getApiHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-API-KEY': getApiKey(),
  };
}

/**
 * Base API URL
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';