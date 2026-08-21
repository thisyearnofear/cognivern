import type {
  EvidenceAnchorEvent,
  EvidenceAnchorResult,
  EvidenceSink,
} from "./EvidenceSink.js";
import { filecoinStorageService } from "@backend/services/blockchain/FilecoinStorageService.js";
import { filecoinConfig } from "@backend/shared/config/index.js";
import { explorerTxUrl } from "@cognivern/shared";

const RAIL_ID = "filecoin-calibration";

export class FilecoinEvidenceSink implements EvidenceSink {
  readonly name = "filecoin";

  constructor(
    private readonly storage: {
      anchorAuditRecord(
        record: Record<string, unknown>,
      ): Promise<{
        cid: string;
        txHash?: string;
        actionId: string;
      } | null>;
    } = filecoinStorageService,
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
      chainId: filecoinConfig.chainId,
      ref: result.cid,
      explorerUrl: result.txHash
        ? explorerTxUrl(RAIL_ID, result.txHash)
        : undefined,
      evidencePatch: {
        filecoinCid: result.cid,
        filecoinTxHash: result.txHash,
        filecoinActionId: result.actionId,
      },
    };
  }
}

export const filecoinEvidenceSink = new FilecoinEvidenceSink();
