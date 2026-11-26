/**
 * Structural evidence checks for Telegraph specialist payloads — shared by
 * the diligence collector (report-time gate) and the Gate 2 executor
 * (CRE-signal re-derivation at authorization time). Pure functions; no I/O.
 */

/**
 * Structural risk signals inside a specialist payload, independent of any
 * model reading. Miner schemas are heterogeneous, so this is a deliberately
 * conservative fail-closed heuristic: a false positive costs a human review,
 * a false negative costs an unsupported payment. Recursive — review flags
 * nested inside check results count exactly like top-level ones.
 *  - `review_required`/`reviewRequired` true → the specialist itself asks
 *    for a human;
 *  - `verified` false → the subject could not be verified;
 *  - `available` false → an upstream source (e.g. a sanctions list) could
 *    not be consulted, so the payload is a non-answer;
 *  - an `age_seconds`/`max_age_seconds` (or camelCase) pair with age beyond
 *    the maximum → the underlying source was stale on arrival.
 */
export function payloadRiskSignals(payload: unknown): string[] {
  const reasons = new Set<string>();
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (typeof value !== 'object' || value === null) return;
    const record = value as Record<string, unknown>;
    if (record.review_required === true || record.reviewRequired === true) {
      reasons.add('parent_review_required');
    }
    if (record.verified === false) reasons.add('parent_unverified');
    if (record.available === false) reasons.add('source_unavailable');
    for (const [ageKey, maxKey] of [
      ['age_seconds', 'max_age_seconds'],
      ['ageSeconds', 'maxAgeSeconds'],
    ] as const) {
      const age = record[ageKey];
      const max = record[maxKey];
      if (typeof age === 'number' && typeof max === 'number' && age > max) {
        reasons.add('source_stale');
      }
    }
    for (const item of Object.values(record)) walk(item);
  };
  walk(payload);
  return [...reasons].sort();
}

const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const normal = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '');
function clearSource(v: unknown): boolean {
  return (
    record(v) &&
    v.available === true &&
    v.match === false &&
    typeof v.age_seconds === 'number' &&
    Number.isFinite(v.age_seconds) &&
    v.age_seconds >= 0 &&
    typeof v.max_age_seconds === 'number' &&
    Number.isFinite(v.max_age_seconds) &&
    v.max_age_seconds > 0 &&
    v.age_seconds <= v.max_age_seconds
  );
}

/**
 * Parent-step evidence sufficiency for the two pinned supplier-diligence
 * miners, on top of the generic scanner. Conservative: a parent payload only
 * supports clearance when it positively identifies the subject AND reports
 * the expected verified outcome — for `7396` that includes BOTH SDN and
 * non-SDN sources being available, non-matching, and within their own
 * maximum ages. An absent or `null` source field is never read as clear;
 * this is a shape check, not a live dataset-provenance guarantee. Unknown
 * miner ids never qualify.
 */
export function supplierParentRiskSignals(
  minerId: string,
  payload: unknown,
  subjectName: unknown,
): string[] {
  const reasons = new Set(payloadRiskSignals(payload));
  const identity =
    record(payload) &&
    normal(subjectName) !== '' &&
    normal(payload.legal_name) === normal(subjectName) &&
    normal(payload.entity_status) === 'active';
  const sufficient =
    identity &&
    (minerId === '7393'
      ? payload.found === true
      : minerId === '7396' &&
        payload.verified === true &&
        normal(payload.verdict) === 'verified' &&
        payload.review_required === false &&
        record(payload.sanctions) &&
        clearSource(payload.sanctions) &&
        clearSource(payload.sanctions.non_sdn));
  if (!sufficient) reasons.add('incomplete_evidence');
  return [...reasons].sort();
}
