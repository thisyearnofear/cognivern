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
 * Canton party ids arrive as `name::namespace` (e.g. `Alice::demo`). Users
 * only recognise the human part — the namespace is ledger routing. Returns
 * the name segment, falling back to the full id when there is no separator.
 */
export function displayPartyName(
  party: string | null | undefined,
): string {
  if (!party) return "";
  const [name] = party.split("::");
  return name || party;
}

/**
 * Short human-readable deadline: "in 5h", "in 2d", "overdue". Returns ""
 * for missing/invalid input so callers can hide the element.
 */
export function relativeDeadline(iso: string | null | undefined): string {
  if (!iso) return "";
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return "";
  const diffMs = target - Date.now();
  if (diffMs <= 0) return "deadline passed";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `closes in ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `closes in ${hours}h`;
  const days = Math.floor(hours / 24);
  return `closes in ${days}d`;
}

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
