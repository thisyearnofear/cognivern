import { describe, it, expect, vi, beforeEach } from "vitest";
import { eventBus } from "@backend/services/EventBus.js";
import { receiptEmitter } from "@backend/services/ReceiptEmitter.js";
import type { EvidenceAnchorReceipt } from "@cognivern/shared/receipts";

/**
 * The receipt emitter is the SSE half of the "wait on named receipts, never
 * poll" rule. It must (1) only emit known receipt names, (2) require a
 * workspace, and (3) never throw — a bad SSE write can't break the rail that
 * produced the receipt.
 */
describe("receiptEmitter", () => {
  const spy = vi.spyOn(eventBus, "emit");

  beforeEach(() => {
    spy.mockClear();
  });

  const anchorReceipt: EvidenceAnchorReceipt = {
    type: "evidence.anchored",
    status: "succeeded",
    timestamp: "2026-08-09T12:00:00.000Z",
    runId: "r-1",
    ref: "0xabc",
    network: "zerog-galileo",
    message: "Evidence anchored on zerog-galileo",
  };

  it("emits a known receipt as a typed SSE event keyed by receipt.type", () => {
    receiptEmitter.emit("ws-1", anchorReceipt);

    expect(spy).toHaveBeenCalledTimes(1);
    const [workspaceId, eventName, data] = spy.mock.calls[0]!;
    expect(workspaceId).toBe("ws-1");
    // SSE event name == receipt.type — the UI pattern-matches on this.
    expect(eventName).toBe("evidence.anchored");
    expect(data).toMatchObject({ type: "evidence.anchored", runId: "r-1", ref: "0xabc" });
  });

  it("does not emit for an unknown receipt name", () => {
    // An unknown type must never push a spurious SSE event.
    receiptEmitter.emit("ws-1", {
      type: "totally.made_up",
      status: "succeeded",
      timestamp: "t",
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("does not emit without a workspaceId", () => {
    receiptEmitter.emit("", {
      type: "evidence.anchored",
      status: "succeeded",
      timestamp: "t",
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("never throws even if the eventBus write throws", () => {
    spy.mockImplementationOnce(() => {
      throw new Error("SSE write failed");
    });
    expect(() =>
      receiptEmitter.emit("ws-1", {
        type: "evidence.anchored",
        status: "succeeded",
        timestamp: "t",
      }),
    ).not.toThrow();
  });
});

