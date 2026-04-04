import type { CreArtifact, CreRun, CreRunEvent } from "../../cre/types.js";
export interface EvidenceEnvelope {
    hash: string;
    cid?: string;
    artifactIds?: string[];
    policyIds?: string[];
    citations?: string[];
}
export declare function hashEvidence(value: unknown): string;
export declare function extractCid(value: unknown): string | undefined;
export declare function enrichArtifactEvidence(artifact: CreArtifact): CreArtifact;
export declare function enrichRunEventEvidence(event: CreRunEvent, run: CreRun): CreRunEvent;
export declare function enrichCreRunEvidence(run: CreRun): CreRun;
//# sourceMappingURL=evidence.d.ts.map
