/**
 * TelegraphSpendGuard
 *
 * Fail-closed policy checks for compliance-on-payment. The guard is evaluated
 * before any x402 call is made, then again between the paid screen and the
 * parent call so a changed screen price still cannot push the attempt over
 * budget. Raw subjects are never stored in evidence — only their field names
 * and a canonical hash.
 */

import { baseIntent } from './TelegraphService.js';
import type { TelegraphMinerIntegration } from './types.js';

export class TelegraphSpendGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TelegraphSpendGuardError';
  }
}

export interface TelegraphSpendGuardPolicy {
  enabled: true;
  schema: 'cognivern.telegraph.spend-guard.v1';
  maxScreeningCostUsd: number | null;
  maxTotalCostUsd: number | null;
  allowedMiners: string[] | null;
  allowedIntents: string[] | null;
  allowedScreenMiners: string[] | null;
  allowedScreenIntents: string[] | null;
  subjectAllowlist: string[] | null;
  subjectDenylist: string[] | null;
  consensusScreens: number;
  budgetId: string | null;
}

export function minerEstimatedCostUsd(
  miner: TelegraphMinerIntegration | null | undefined,
): number | null {
  const micro = miner?.min_price_usdc;
  return typeof micro === 'number' && Number.isFinite(micro) ? micro / 1_000_000 : null;
}

export function parseUsd(value: unknown): number | null {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parsePositiveUsd(raw: unknown, field: string): number | null {
  if (raw === undefined || raw === null) return null;
  const value = parseUsd(raw);
  if (value === null || value <= 0) {
    throw new TelegraphSpendGuardError(`${field} must be a positive USD amount`);
  }
  return value;
}

function stringArray(raw: unknown, field: string): string[] | null {
  if (raw === undefined || raw === null) return null;
  if (!Array.isArray(raw) || raw.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new TelegraphSpendGuardError(`${field} must be an array of non-empty strings`);
  }
  return raw.map((item) => item.trim());
}

export function normalizeSubject(value: unknown): string {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeIdentifier(value: unknown): string {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function normalizedBaseIntents(values: string[] | null, field: string): string[] | null {
  if (!values) return null;
  try {
    return values.map(baseIntent);
  } catch {
    throw new TelegraphSpendGuardError(`${field} contains an invalid intent`);
  }
}

/** Flatten primitive screening params into subject values and stable field paths. */
export function subjectTerms(params: Record<string, unknown>): {
  values: string[];
  fields: string[];
} {
  const values: string[] = [];
  const fields = new Set<string>();
  const stack: Array<{ value: unknown; path: string }> = [{ value: params, path: '' }];
  const seen = new Set<unknown>();

  while (stack.length > 0) {
    const { value, path } = stack.pop()!;
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      values.push(String(value));
      if (path) fields.add(path);
      continue;
    }
    if (typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach((item, index) => stack.push({ value: item, path: `${path}[${index}]` }));
      continue;
    }
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      stack.push({ value: item, path: path ? `${path}.${key}` : key });
    }
  }

  return { values, fields: [...fields].sort() };
}

export function normalizeSpendGuard(raw: unknown): TelegraphSpendGuardPolicy | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new TelegraphSpendGuardError('spendGuard must be an object');
  }
  const input = raw as Record<string, unknown>;
  const consensusScreensRaw = input.consensusScreens ?? input.requiredScreens ?? 1;
  const consensusScreens =
    typeof consensusScreensRaw === 'number' && Number.isInteger(consensusScreensRaw)
      ? consensusScreensRaw
      : NaN;
  if (!Number.isInteger(consensusScreens) || consensusScreens < 1) {
    throw new TelegraphSpendGuardError('consensusScreens must be an integer >= 1');
  }
  if (
    input.budgetId !== undefined &&
    input.budgetId !== null &&
    typeof input.budgetId !== 'string'
  ) {
    throw new TelegraphSpendGuardError('budgetId must be a string');
  }

  return {
    enabled: true,
    schema: 'cognivern.telegraph.spend-guard.v1',
    maxScreeningCostUsd: parsePositiveUsd(input.maxScreeningCostUsd, 'maxScreeningCostUsd'),
    maxTotalCostUsd: parsePositiveUsd(input.maxTotalCostUsd, 'maxTotalCostUsd'),
    allowedMiners: stringArray(input.allowedMiners, 'allowedMiners'),
    allowedIntents: normalizedBaseIntents(
      stringArray(input.allowedIntents, 'allowedIntents'),
      'allowedIntents',
    ),
    allowedScreenMiners: stringArray(input.allowedScreenMiners, 'allowedScreenMiners'),
    allowedScreenIntents: normalizedBaseIntents(
      stringArray(input.allowedScreenIntents, 'allowedScreenIntents'),
      'allowedScreenIntents',
    ),
    subjectAllowlist:
      stringArray(input.subjectAllowlist, 'subjectAllowlist')?.map(normalizeSubject) ?? null,
    subjectDenylist:
      stringArray(input.subjectDenylist, 'subjectDenylist')?.map(normalizeSubject) ?? null,
    consensusScreens,
    budgetId: typeof input.budgetId === 'string' ? input.budgetId : null,
  };
}

function identifierAllowed(
  allowed: string[] | null,
  identifiers: Array<string | null | undefined>,
  label: string,
): string | null {
  if (!allowed) return null;
  const normalizedAllowed = new Set(allowed.map(normalizeIdentifier));
  const matched = identifiers.some(
    (id) => id !== undefined && id !== null && normalizedAllowed.has(normalizeIdentifier(id)),
  );
  return matched ? null : `${label} is not in spendGuard.allowedMiners`;
}

function intentAllowed(
  allowed: string[] | null,
  intent: string | undefined,
  label: string,
  field: string,
): string | null {
  if (!allowed) return null;
  if (!intent) return `${field} requires an explicit ${label}`;
  return allowed.includes(baseIntent(intent))
    ? null
    : `${label} ${baseIntent(intent)} is not in ${field}`;
}

function subjectViolations(
  policy: TelegraphSpendGuardPolicy,
  params: Record<string, unknown>,
): string[] {
  const normalizedValues = new Set(
    subjectTerms(params).values.map(normalizeSubject).filter(Boolean),
  );
  const violations: string[] = [];
  if (policy.subjectDenylist?.some((item) => normalizedValues.has(item))) {
    violations.push('screened subject matched spendGuard.subjectDenylist');
  }
  if (
    policy.subjectAllowlist &&
    !policy.subjectAllowlist.some((item) => normalizedValues.has(item))
  ) {
    violations.push('screened subject is not in spendGuard.subjectAllowlist');
  }
  return violations;
}

/** Parent-call checks that can be evaluated before buying the screen. */
export function evaluateParentSpendGuard(params: {
  policy: TelegraphSpendGuardPolicy | null;
  requestedMinerId: string;
  miner?: TelegraphMinerIntegration | null;
  intent?: string;
  subjectParams: Record<string, unknown>;
  minerLookupRequired?: boolean;
  minerLookupError?: string | null;
}): string[] {
  const { policy } = params;
  if (!policy) return [];
  const violations: string[] = [];

  if (params.minerLookupRequired && params.minerLookupError) {
    violations.push(`parent miner policy could not be evaluated: ${params.minerLookupError}`);
  }
  violations.push(
    ...[
      identifierAllowed(
        policy.allowedMiners,
        [params.requestedMinerId, params.miner?.id, params.miner?.slug, params.miner?.name],
        `parent miner ${params.requestedMinerId}`,
      ),
      intentAllowed(policy.allowedIntents, params.intent, 'parent intent', 'allowedIntents'),
      ...subjectViolations(policy, params.subjectParams),
      policy.consensusScreens > 1
        ? `consensusScreens=${policy.consensusScreens} requires multiple screens; compliant-call currently performs one screen`
        : null,
    ].filter((item): item is string => Boolean(item)),
  );

  if (policy.maxTotalCostUsd !== null && minerEstimatedCostUsd(params.miner) === null) {
    violations.push(
      `maxTotalCostUsd requires a priced parent miner; ${params.requestedMinerId} has no min_price_usdc`,
    );
  }

  return violations;
}

/** Screening-miner checks evaluated after registry resolution, before payment. */
export function evaluateScreenSpendGuard(params: {
  policy: TelegraphSpendGuardPolicy | null;
  miner?: TelegraphMinerIntegration | null;
  minerId: string;
  minerName?: string;
  intent?: string;
  parentEstimatedCostUsd: number | null;
}): string[] {
  const { policy } = params;
  if (!policy) return [];
  const violations: string[] = [
    identifierAllowed(
      policy.allowedScreenMiners,
      [params.minerId, params.miner?.id, params.miner?.slug, params.miner?.name, params.minerName],
      `screening miner ${params.minerId}`,
    ),
    intentAllowed(
      policy.allowedScreenIntents,
      params.intent,
      'screening intent',
      'allowedScreenIntents',
    ),
  ].filter((item): item is string => Boolean(item));

  const screenCost = minerEstimatedCostUsd(params.miner);
  if (policy.maxScreeningCostUsd !== null) {
    if (screenCost === null) {
      violations.push(
        `maxScreeningCostUsd requires a priced screening miner; ${params.minerId} has no min_price_usdc`,
      );
    } else if (screenCost > policy.maxScreeningCostUsd) {
      violations.push(
        `screening cost $${screenCost.toFixed(4)} exceeds maxScreeningCostUsd $${policy.maxScreeningCostUsd.toFixed(4)}`,
      );
    }
  }

  if (policy.maxTotalCostUsd !== null) {
    if (screenCost === null || params.parentEstimatedCostUsd === null) {
      violations.push('maxTotalCostUsd could not be proven because a miner price is unavailable');
    } else {
      const total = screenCost + params.parentEstimatedCostUsd;
      if (total > policy.maxTotalCostUsd) {
        violations.push(
          `estimated total $${total.toFixed(4)} exceeds maxTotalCostUsd $${policy.maxTotalCostUsd.toFixed(4)}`,
        );
      }
    }
  }

  return violations;
}

/** Re-check after the paid screen using its actual cost, before parent spend. */
export function evaluatePostScreenSpendGuard(params: {
  policy: TelegraphSpendGuardPolicy | null;
  actualScreenCostUsd: unknown;
  parentEstimatedCostUsd: number | null;
}): string[] {
  const { policy } = params;
  if (!policy) return [];
  const violations: string[] = [];
  const screenCost = parseUsd(params.actualScreenCostUsd);

  if (policy.maxScreeningCostUsd !== null) {
    if (screenCost === null) {
      violations.push('actual screening cost is unavailable');
    } else if (screenCost > policy.maxScreeningCostUsd) {
      violations.push(
        `actual screening cost $${screenCost.toFixed(4)} exceeds maxScreeningCostUsd $${policy.maxScreeningCostUsd.toFixed(4)}`,
      );
    }
  }

  if (policy.maxTotalCostUsd !== null) {
    if (screenCost === null || params.parentEstimatedCostUsd === null) {
      violations.push('actual total cost could not be proven inside maxTotalCostUsd');
    } else {
      const total = screenCost + params.parentEstimatedCostUsd;
      if (total > policy.maxTotalCostUsd) {
        violations.push(
          `actual total $${total.toFixed(4)} exceeds maxTotalCostUsd $${policy.maxTotalCostUsd.toFixed(4)}`,
        );
      }
    }
  }

  return violations;
}
