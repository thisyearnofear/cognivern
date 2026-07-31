/**
 * Public runtime origins. Keep deployment-specific overrides in
 * NEXT_PUBLIC_API_URL; the canonical production origin lives here so browser
 * code and Next rewrites cannot drift to a retired hostname.
 */
// Production should set NEXT_PUBLIC_API_URL to the API origin. Keeping the
// fallback local prevents a frontend build from silently routing API traffic
// to the public marketing/Vercel origin.
export const DEFAULT_API_ORIGIN = "http://localhost:3001";

export function getApiOrigin(): string {
  return (process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_ORIGIN).replace(/\/$/, "");
}

export function apiUrl(path: string): string {
  return `${getApiOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}
