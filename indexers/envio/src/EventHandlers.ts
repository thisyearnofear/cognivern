import { indexer } from "envio";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// aUSDC settlement rail (Cleanverse CVA, Monad testnet). Every transfer is a
// candidate settlement receipt; the backend links it to the spend run that
// produced the tx via txHash.
indexer.onEvent(
  { contract: "AUsdcSettlement", event: "Transfer" },
  async ({ event, context }) => {
    context.SettlementTransfer.set({
      id: `${event.chainId}-${event.transaction.hash}-${event.logIndex}`,
      chainId: event.chainId,
      contract: event.srcAddress.toLowerCase(),
      from: event.params.from.toLowerCase(),
      to: event.params.to.toLowerCase(),
      value: event.params.value,
      txHash: event.transaction.hash,
      blockNumber: event.block.number,
      logIndex: event.logIndex,
      timestamp: event.block.timestamp,
    });
  },
);

// ERC-8004 identity: mint (from == 0x0) is the registration event. Later
// transfers are ownership moves, not registrations, so they are skipped.
indexer.onEvent(
  { contract: "Erc8004Identity", event: "Transfer" },
  async ({ event, context }) => {
    if (event.params.from.toLowerCase() !== ZERO_ADDRESS) return;
    context.AgentRegistration.set({
      id: `${event.chainId}-${event.transaction.hash}-${event.logIndex}`,
      chainId: event.chainId,
      registry: event.srcAddress.toLowerCase(),
      agentId: event.params.tokenId,
      owner: event.params.to.toLowerCase(),
      txHash: event.transaction.hash,
      blockNumber: event.block.number,
      logIndex: event.logIndex,
      timestamp: event.block.timestamp,
    });
  },
);

// Reputation feedback is keyed per (agentId, clientAddress, feedbackIndex);
// a revoke flips `revoked` on the existing entity rather than deleting it so
// the evidence trail keeps both the submission and the retraction.
indexer.onEvent(
  { contract: "Erc8004Reputation", event: "NewFeedback" },
  async ({ event, context }) => {
    context.AgentFeedback.set({
      id: `${event.chainId}-${event.params.agentId}-${event.params.clientAddress.toLowerCase()}-${event.params.feedbackIndex}`,
      chainId: event.chainId,
      registry: event.srcAddress.toLowerCase(),
      agentId: event.params.agentId,
      clientAddress: event.params.clientAddress.toLowerCase(),
      feedbackIndex: Number(event.params.feedbackIndex),
      value: event.params.value,
      valueDecimals: Number(event.params.valueDecimals),
      tag1: event.params.tag1,
      tag2: event.params.tag2,
      endpoint: event.params.endpoint,
      feedbackURI: event.params.feedbackURI,
      txHash: event.transaction.hash,
      blockNumber: event.block.number,
      logIndex: event.logIndex,
      timestamp: event.block.timestamp,
      revoked: false,
    });
  },
);

indexer.onEvent(
  { contract: "Erc8004Reputation", event: "FeedbackRevoked" },
  async ({ event, context }) => {
    const id = `${event.chainId}-${event.params.agentId}-${event.params.clientAddress.toLowerCase()}-${event.params.feedbackIndex}`;
    const existing = await context.AgentFeedback.get(id);
    if (existing) {
      context.AgentFeedback.set({ ...existing, revoked: true });
    }
  },
);
