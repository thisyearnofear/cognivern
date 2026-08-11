/**
 * Wallet-address and workspace-name display helpers.
 *
 * Two problems these solve:
 *
 * 1. `0x…` truncation was inlined as `addr.slice(0, 6) + "..." + addr.slice(-4)`
 *    in a dozen components with drifting separators (`...` vs `…`). One helper,
 *    one format.
 *
 * 2. The backend names a first-login workspace after the signing wallet
 *    (`AuthController`: `${address.slice(0,6)}...${address.slice(-4)}'s Workspace`).
 *    Rendering that name verbatim alongside the wallet identity — which the
 *    sidebar switcher, the sidebar footer, the dashboard subtitle and the
 *    settings card all did simultaneously — put the same truncated address on
 *    screen three or four times at once. `workspaceLabel` recognises the
 *    auto-generated name and substitutes a neutral label, so only a workspace
 *    the user actually named shows a name.
 */

/** Neutral label used in place of an auto-generated, address-derived name. */
export const DEFAULT_WORKSPACE_LABEL = "Personal workspace";

/**
 * Matches the server-generated default workspace name, e.g.
 * `0x1e17...5D40's Workspace`. Tolerates either separator and a curly
 * apostrophe in case the name is ever round-tripped through a formatter.
 */
const GENERATED_WORKSPACE_NAME =
  /^0x[0-9a-f]{4}(?:\.{3}|…)[0-9a-f]{4}['’]s\s+workspace$/i;

/**
 * `0x1e1734d0…5D40` → `0x1e17…5D40`. Returns an empty string for a missing
 * address so callers can render `{shortAddress(a) || fallback}`.
 */
export function shortAddress(
  address: string | null | undefined,
  { leading = 6, trailing = 4 }: { leading?: number; trailing?: number } = {},
): string {
  if (!address) return "";
  if (address.length <= leading + trailing + 1) return address;
  return `${address.slice(0, leading)}…${address.slice(-trailing)}`;
}

/** True when `name` is the backend's address-derived default. */
export function isGeneratedWorkspaceName(
  name: string | null | undefined,
): boolean {
  if (!name) return false;
  return GENERATED_WORKSPACE_NAME.test(name.trim());
}

/**
 * The name to show for a workspace. Auto-generated address-derived names
 * collapse to `DEFAULT_WORKSPACE_LABEL`; user-chosen names pass through.
 */
export function workspaceLabel(
  workspace: { name?: string | null } | null | undefined,
  fallback: string = DEFAULT_WORKSPACE_LABEL,
): string {
  const name = workspace?.name?.trim();
  if (!name) return fallback;
  return isGeneratedWorkspaceName(name) ? fallback : name;
}
