/**
 * Public runtime origins. Keep deployment-specific overrides in
 * NEXT_PUBLIC_API_URL; the canonical production origin lives here so browser
 * code and Next rewrites cannot drift to a retired hostname.
 */
export const DEFAULT_API_ORIGIN = "https://cognivern.persidian.com";

export function getApiOrigin(): string {
  return (process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_ORIGIN).replace(/\/$/, "");
}

export function apiUrl(path: string): string {
  return `${getApiOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}
