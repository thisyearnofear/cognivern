/**
 * @deprecated These types are being migrated to the new clean architecture structure.
 * Use domain/policy/PolicyTypes.js instead.
 *
 * This file will be removed once the migration is complete.
 */

// ---------------------------------------------------------------------------
// FHIR R4 / SHARP context types (Agents Assemble Healthcare AI Endgame)
// Propagates clinical context through multi-agent call chains per the
// Prompt Opinion SHARP extension spec.
// ---------------------------------------------------------------------------

/** Subset of FHIR R4 resource types relevant to governance policy evaluation */
export type FhirResourceType =
  | "Patient"
  | "Practitioner"
  | "Organization"
  | "Encounter"
  | "Observation"
  | "MedicationRequest"
  | "Condition"
  | "Procedure"
  | "DiagnosticReport"
  | "Bundle";

/** Minimal FHIR R4 resource reference */
export interface FhirResourceRef {
  resourceType: FhirResourceType;
  id: string;
  /** Optional display label for audit trails */
  display?: string;
}

/**
 * SHARP (Secure Healthcare Agent Resource Protocol) context block.
 * Attached to policy evaluation requests so governance decisions are
 * aware of the clinical context in which an agent is operating.
 */
export interface SharpContext {
  /** FHIR R4 resource that is the subject of the agent action */
  subject: FhirResourceRef;
  /** Encounter or episode of care this action belongs to */
  encounter?: FhirResourceRef;
  /** Practitioner or system initiating the agent action */
  requester?: FhirResourceRef;
  /** ISO-8601 timestamp of the clinical event */
  eventTime?: string;
  /** Sensitivity labels (e.g. "HIV", "MH", "SUD") per FHIR sensitivity codes */
  sensitivityLabels?: string[];
  /** Jurisdiction / data-sharing consent reference */
  consentRef?: string;
  /** Arbitrary FHIR extensions keyed by URL */
  extensions?: Record<string, unknown>;
}

/**
 * Wraps any agent action payload with FHIR/SHARP context so the
 * governance pipeline can enforce clinical data-access policies.
 */
export interface FhirContextEnvelope<T = unknown> {
  /** The original action or request payload */
  payload: T;
  /** SHARP clinical context block */
  fhirContext: SharpContext;
  /** A2A call-chain trace ID for multi-agent correlation */
  a2aTraceId?: string;
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  version: string;
  rules: PolicyRule[];
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  status: "active" | "draft" | "archived";
}

export interface PolicyRule {
  id: string;
  type: "allow" | "deny" | "require" | "rate_limit" | "contract_audit";
  condition: string;
  action: PolicyAction;
  metadata: Record<string, any>;
}

export interface PolicyAction {
  type: "block" | "log" | "notify" | "escalate";
  parameters: Record<string, any>;
}

export type PolicyRuleType = "allow" | "deny" | "require" | "rate_limit" | "contract_audit";
export type PolicyActionType = "block" | "log" | "notify" | "escalate";
