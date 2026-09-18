/**
 * Route → required-scope map for workspace API keys (cvn_/imported).
 *
 * Keys carry scopes at creation, and this map is the ENFORCEMENT side —
 * previously scopes were stored and displayed but never consulted, so every
 * key was implicitly full-access (including /api/api-keys management, which
 * let a leaked read-only key mint itself more keys).
 *
 * Default posture: allow. Only the families below tighten; everything else
 * keeps pre-existing behavior to avoid breaking dashboard key usage.
 */
export function requiredScopeForRoute(method: string, path: string): string | null {
  const m = method.toUpperCase();
  const isRead = m === 'GET' || m === 'HEAD' || m === 'OPTIONS';
  const p = path.split('?')[0];

  if (p.startsWith('/api/agents')) return isRead ? 'agents:read' : 'agents:write';
  // ERC-8004 identity writes mint on-chain NFTs and publish reputation from a
  // vault wallet — same sensitivity as mutating the agents they belong to.
  if (p.startsWith('/api/erc8004')) return isRead ? 'agents:read' : 'agents:write';
  // Passkey-vault writes mint agent spend keys and move the wrapped root —
  // agent-key custody, same sensitivity as mutating the agents they serve.
  if (p.startsWith('/api/passkey-vault')) return isRead ? 'agents:read' : 'agents:write';
  // Envio sync writes signed evidence artifacts into the CRE ledger.
  if (p.startsWith('/api/envio')) return isRead ? 'audit:read' : 'agents:write';
  if (p.startsWith('/api/governance')) return isRead ? 'governance:read' : 'governance:write';
  if (p.startsWith('/api/audit')) return 'audit:read';
  if (p.startsWith('/api/spend') && !isRead) return 'spend:execute';

  // Sponsored credit programs. Reads are reporting (a judge or dashboard needs
  // them); writes provision participants and mint gateway keys that spend real
  // money, so they require the same scope as executing spend.
  if (p.startsWith('/api/credit-programs')) return isRead ? 'audit:read' : 'spend:execute';

  return null;
}

/**
 * Key-management is session-only: an API key may never create, import, or
 * revoke keys (no privilege self-escalation through a leaked credential).
 * The routes are mounted at ROOT as /api-keys (no /api prefix) — match both
 * spellings so an inconsistent rewrite can never bypass this.
 */
export function isKeyManagementPath(path: string): boolean {
  const p = path.split('?')[0];
  return (
    p === '/api/api-keys' ||
    p === '/api-keys' ||
    p.startsWith('/api/api-keys/') ||
    p.startsWith('/api-keys/')
  );
}
