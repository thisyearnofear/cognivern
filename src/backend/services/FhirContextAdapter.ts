import crypto from "node:crypto";
import type { AgentAction } from "../types/Agent.js";
import type { SharpContext, FhirResourceRef, FhirResourceType } from "../types/Policy.js";

interface FhirResource {
  resourceType: string;
  id?: string;
  meta?: Record<string, unknown>;
  [key: string]: unknown;
}

interface MedicationRequest extends FhirResource {
  resourceType: "MedicationRequest";
  medicationCodeableConcept?: {
    coding?: Array<{ code?: string; display?: string }>;
  };
  subject?: { reference?: string; display?: string };
  requester?: { reference?: string; display?: string };
  encounter?: { reference?: string };
  dosageInstruction?: Array<{ text?: string }>;
}

interface Observation extends FhirResource {
  resourceType: "Observation";
  code?: { coding?: Array<{ code?: string; display?: string }> };
  subject?: { reference?: string; display?: string };
  encounter?: { reference?: string };
  valueQuantity?: { value?: number; unit?: string };
}

interface Patient extends FhirResource {
  resourceType: "Patient";
  name?: Array<{ given?: string[]; family?: string }>;
}

function toFhirRef(resource: FhirResource): FhirResourceRef {
  return {
    resourceType: resource.resourceType as FhirResourceType,
    id: resource.id || "unknown",
    display:
      (resource as Patient).name?.[0]?.given?.[0] ||
      (resource as Patient).name?.[0]?.family ||
      resource.resourceType,
  };
}

function extractSensitivity(resource: FhirResource): string[] {
  const securityLabels: string[] = [];
  const meta = resource.meta as Record<string, unknown> | undefined;
  const security = meta?.security as Array<{ code?: string }> | undefined;
  if (Array.isArray(security)) {
    for (const s of security) {
      if (s.code) securityLabels.push(s.code);
    }
  }
  return securityLabels;
}

export class FhirContextAdapter {
  fromMedicationRequest(resource: MedicationRequest): {
    action: AgentAction;
    fhirContext: SharpContext;
  } {
    const medication =
      resource.medicationCodeableConcept?.coding?.[0]?.display ||
      resource.medicationCodeableConcept?.coding?.[0]?.code ||
      "unknown medication";
    const dosage = resource.dosageInstruction?.[0]?.text || "";

    const action: AgentAction = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: "medication_request",
      description: `Prescribe ${medication}${dosage ? ` — ${dosage}` : ""}`,
      metadata: {
        fhirResourceType: "MedicationRequest",
        fhirResourceId: resource.id,
        medication,
        dosage,
        hipaaRelevant: true,
      },
      policyChecks: [],
    };

    const fhirContext: SharpContext = {
      subject: resource.subject
        ? {
            resourceType: "Patient",
            id: resource.subject.reference?.replace("Patient/", "") || "unknown",
            display: resource.subject.display,
          }
        : { resourceType: "Patient", id: "unknown" },
      encounter: resource.encounter
        ? {
            resourceType: "Encounter",
            id: resource.encounter.reference?.replace("Encounter/", "") || "unknown",
          }
        : undefined,
      requester: resource.requester
        ? {
            resourceType: "Practitioner",
            id: resource.requester.reference?.replace("Practitioner/", "") || "unknown",
            display: resource.requester.display,
          }
        : undefined,
      eventTime: new Date().toISOString(),
      sensitivityLabels: extractSensitivity(resource),
    };

    return { action, fhirContext };
  }

  fromObservation(resource: Observation): {
    action: AgentAction;
    fhirContext: SharpContext;
  } {
    const observationType =
      resource.code?.coding?.[0]?.display ||
      resource.code?.coding?.[0]?.code ||
      "observation";
    const value = resource.valueQuantity
      ? `${resource.valueQuantity.value} ${resource.valueQuantity.unit || ""}`.trim()
      : "";

    const action: AgentAction = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: "observation_access",
      description: `Access observation: ${observationType}${value ? ` (${value})` : ""}`,
      metadata: {
        fhirResourceType: "Observation",
        fhirResourceId: resource.id,
        observationType,
        value,
        hipaaRelevant: true,
      },
      policyChecks: [],
    };

    const fhirContext: SharpContext = {
      subject: resource.subject
        ? {
            resourceType: "Patient",
            id: resource.subject.reference?.replace("Patient/", "") || "unknown",
            display: resource.subject.display,
          }
        : { resourceType: "Patient", id: "unknown" },
      encounter: resource.encounter
        ? {
            resourceType: "Encounter",
            id: resource.encounter.reference?.replace("Encounter/", "") || "unknown",
          }
        : undefined,
      eventTime: new Date().toISOString(),
      sensitivityLabels: extractSensitivity(resource),
    };

    return { action, fhirContext };
  }

  fromPatient(resource: Patient): {
    action: AgentAction;
    fhirContext: SharpContext;
  } {
    const patientName =
      resource.name?.[0]?.given?.join(" ") ||
      resource.name?.[0]?.family ||
      "Patient";

    const action: AgentAction = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: "patient_access",
      description: `Access patient record: ${patientName}`,
      metadata: {
        fhirResourceType: "Patient",
        fhirResourceId: resource.id,
        patientName,
        hipaaRelevant: true,
      },
      policyChecks: [],
    };

    const fhirContext: SharpContext = {
      subject: toFhirRef(resource),
      eventTime: new Date().toISOString(),
      sensitivityLabels: extractSensitivity(resource),
    };

    return { action, fhirContext };
  }

  fromResource(resource: FhirResource): {
    action: AgentAction;
    fhirContext: SharpContext;
  } {
    switch (resource.resourceType) {
      case "MedicationRequest":
        return this.fromMedicationRequest(resource as MedicationRequest);
      case "Observation":
        return this.fromObservation(resource as Observation);
      case "Patient":
        return this.fromPatient(resource as Patient);
      default: {
        const action: AgentAction = {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          type: `fhir_${resource.resourceType.toLowerCase()}`,
          description: `FHIR ${resource.resourceType} access (id: ${resource.id || "unknown"})`,
          metadata: {
            fhirResourceType: resource.resourceType,
            fhirResourceId: resource.id,
            hipaaRelevant: true,
          },
          policyChecks: [],
        };
        const fhirContext: SharpContext = {
          subject: toFhirRef(resource),
          eventTime: new Date().toISOString(),
          sensitivityLabels: extractSensitivity(resource),
        };
        return { action, fhirContext };
      }
    }
  }
}

export const sharedFhirContextAdapter = new FhirContextAdapter();
