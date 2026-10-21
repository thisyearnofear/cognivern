import type { Response } from "express";
import type { RoundStatus } from "./types.js";

/**
 * Live round-change events pushed over SSE.
 *
 * Privacy invariant: this payload NEVER carries bid amounts, bidder
 * identity, proposal data, or the winner. It only says "round X changed to
 * status Y at time Z" — subscribers refetch the round over the normal API
 * for details, which applies the same disclosure rules as a fresh load.
 */
export interface SealedBidRoundEvent {
  roundId: string;
  change:
    | "created"
    | "bid_submitted"
    | "bid_withdrawn"
    | "closed"
    | "revealed"
    | "cancelled";
  status: RoundStatus;
  at: string;
}

const MAX_CONNECTIONS = 200;
// The stream is public — a single client opening hundreds of tabs must not
// starve everyone else of the global connection budget.
const MAX_PER_CLIENT = 5;

interface Subscriber {
  res: Response;
  roundId: string | null;
  clientKey: string | null;
}

// In-process fan-out for the sealed-bid SSE stream. A null roundId
// subscribes to every round (the rounds list page); a concrete id only
// receives that round's events (the detail view).
class SealedBidEventHub {
  private subscribers = new Set<Subscriber>();

  /**
   * Register an SSE response for round events. Returns an unsubscribe
   * function, or null when the connection cap is reached (callers respond
   * 503 in that case).
   */
  subscribe(
    res: Response,
    roundId: string | null,
    clientKey: string | null = null,
  ): (() => void) | null {
    if (this.subscribers.size >= MAX_CONNECTIONS) return null;
    if (clientKey !== null) {
      let held = 0;
      for (const subscriber of this.subscribers) {
        if (subscriber.clientKey === clientKey) held++;
      }
      if (held >= MAX_PER_CLIENT) return null;
    }
    const subscriber: Subscriber = { res, roundId, clientKey };
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  /** Fan an event out to matching subscribers. Never throws. */
  publish(evt: SealedBidRoundEvent): void {
    const frame = `event: sealedbid:round\ndata: ${JSON.stringify(evt)}\n\n`;
    for (const subscriber of this.subscribers) {
      if (subscriber.roundId !== null && subscriber.roundId !== evt.roundId)
        continue;
      try {
        subscriber.res.write(frame);
      } catch {
        // A dead socket throws on write — drop it so it doesn't wedge the fan-out.
        this.subscribers.delete(subscriber);
      }
    }
  }

  get connectionCount(): number {
    return this.subscribers.size;
  }
}

export const sealedBidEvents = new SealedBidEventHub();
