"use client";

import { apiClient } from "@/lib/api-client";

/**
 * Cached fetch of the SigNoz Cloud URL from the observability status
 * endpoint. Used to build trace deep-links that respect the user's
 * configured SigNoz instance (US, EU, or self-hosted) instead of
 * hardcoding us.signoz.cloud.
 *
 * Falls back to https://us.signoz.cloud if the endpoint is unreachable
 * or the env var is not set, so links still work in the common case.
 */

let cachedCloudUrl: string | null = null;
let fetchPromise: Promise<string> | null = null;
let cacheTimestamp = 0;

const FALLBACK_URL = "https://us.signoz.cloud";
const CACHE_TTL_MS = 60_000; // Re-resolve after 60s in case env changed

/**
 * Fetch the SigNoz Cloud URL from the observability status endpoint.
 * Cached for 60 seconds after resolution. Never throws - always resolves
 * to a URL string, falling back to the default SigNoz Cloud instance on
 * any error. On error, the cache expires after the TTL so a subsequent
 * call retries instead of permanently returning the fallback.
 */
export function getSignozCloudUrl(): Promise<string> {
  // Return cached value if fresh
  if (cachedCloudUrl !== null && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return Promise.resolve(cachedCloudUrl);
  }

  // If a fetch is already in-flight, wait for it
  if (fetchPromise) {
    return fetchPromise;
  }

  fetchPromise = apiClient
    .getObservabilityStatus()
    .then((res) => {
      const url = res.success && res.data?.signozCloudUrl
        ? res.data.signozCloudUrl
        : FALLBACK_URL;
      cachedCloudUrl = url;
      cacheTimestamp = Date.now();
      fetchPromise = null;
      return url;
    })
    .catch(() => {
      cachedCloudUrl = FALLBACK_URL;
      cacheTimestamp = Date.now(); // Will retry after TTL
      fetchPromise = null;
      return FALLBACK_URL;
    });

  return fetchPromise;
}

/**
 * Build a SigNoz trace deep-link. Resolves the cloud URL asynchronously.
 * Never throws - on any failure, falls back to the default SigNoz Cloud
 * URL so the user always gets a clickable link instead of a dead button.
 */
export async function buildSignozTraceLink(traceId: string): Promise<string> {
  try {
    const cloudUrl = await getSignozCloudUrl();
    return `${cloudUrl}/trace/${traceId}`;
  } catch {
    return `${FALLBACK_URL}/trace/${traceId}`;
  }
}

/**
 * Synchronous builder using a pre-fetched cloud URL. Pass the result of
 * getSignozCloudUrl() from a parent component's useEffect.
 */
export function buildSignozTraceLinkSync(
  traceId: string,
  cloudUrl: string,
): string {
  return `${cloudUrl}/trace/${traceId}`;
}
