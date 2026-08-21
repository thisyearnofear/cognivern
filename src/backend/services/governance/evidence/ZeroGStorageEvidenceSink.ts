import type {
  EvidenceAnchorEvent,
  EvidenceAnchorResult,
  EvidenceSink,
} from "./EvidenceSink.js";
import { zeroGStorageService } from "@backend/services/blockchain/ZeroGStorageService.js";
import { explorerTxUrl } from "@cognivern/shared";

const RAIL_ID = "zerog-galileo";

export class ZeroGStorageEvidenceSink implements EvidenceSink {
  readonly name = "zerog-storage";

  constructor(
    private readonly storage: {
      anchorAuditRecord(
        record: Record<string, unknown>,
      ): Promise<{
        rootHash: string;
        localHash: string;
        txHash?: string;
      } | null>;
    } = zeroGStorageService,
  ) {}

  async anchor(event: EvidenceAnchorEvent): Promise<EvidenceAnchorResult | null> {
    const result = await this.storage.anchorAuditRecord({
      ...event.payload,
      runId: event.runId,
      evidenceHash: event.payloadHash,
    });
    if (!result) return null;
    return {
      sink: this.name,
      railId: RAIL_ID,
      ref: result.rootHash,
      explorerUrl: result.txHash
        ? explorerTxUrl(RAIL_ID, result.txHash)
        : undefined,
      evidencePatch: {
        zeroGRootHash: result.rootHash,
        zeroGLocalHash: result.localHash,
        ...(result.txHash ? { zeroGTxHash: result.txHash } : {}),
      },
    };
  }
}

export const zeroGStorageEvidenceSink = new ZeroGStorageEvidenceSink();
