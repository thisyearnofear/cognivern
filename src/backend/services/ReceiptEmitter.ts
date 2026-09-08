import { eventBus } from "@backend/services/EventBus.js";
import { isReceiptEventName } from "@cognivern/shared/receipts";
import type { RailReceiptBase } from "@cognivern/shared/receipts";

/**
 * Pushes typed async-flow receipts onto the SSE channel so the UI can wait on
 * a *named* receipt — `evidence.anchored`, `governance.decision_approved`,
 `spend.receipt_anchored`, `sealed_bid.winner_revealed` — instead of polling a
 * runId. (T3 rule: wait on receipts and worker drains, never on sleeps/polling.)
 *
 * Receipts are pure data; emission is fire-and-forget and never rejects the
 * producer's hot path — the eventBus write is wrapped in try/catch and only
 * runs for receipt names the system knows (validated via `isReceiptEventName`),
 * so an unknown payload can never push a spurious SSE event.
 *
 * @see packages/shared/src/receipts.ts (typed contract + known event names)
 */
export const receiptEmitter = {
  emit(workspaceId: string, receipt: RailReceiptBase): void {
    if (!workspaceId) return;
    if (!isReceiptEventName(receipt.type)) return;
    try {
      eventBus.emit(
        workspaceId,
        receipt.type,
        receipt as unknown as Record<string, unknown>,
      );
    } catch {
      /* never let an SSE write break the rail that produced the receipt */
    }
  },
};
