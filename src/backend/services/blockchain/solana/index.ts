/**
 * Solana settlement rail — governed SPL USDC transfers.
 *
 * Exports:
 *   SolanaSettlementService — core guards, config validation, broadcast,
 *                             confirmation, and the durable intent journal.
 *   SettlementIntentStore   — pre-broadcast journal (replay source of truth).
 *   SettlementPolicy        — funded-mandate resolution and consumption.
 *   SettlementFlow          — the guard → execute → debit pipeline the API
 *                             layer calls; keeps controller code thin.
 */

export * from './SolanaSettlementService.js';
export * from './SettlementIntentStore.js';
export * from './SettlementPolicy.js';
export * from './SettlementFlow.js';
