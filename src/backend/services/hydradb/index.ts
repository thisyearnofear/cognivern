/**
 * HydraDB integration — agentic memory / cross-source retrieval substrate.
 *
 * Toggleable via HYDRADB_ENABLED. When disabled, every service no-ops and
 * cognivern behaves exactly as without the integration. When enabled, the
 * cognivern audit/run ledger is mirrored into HydraDB as app-knowledge, and
 * the retrieval service provides a fast/thinking-routed query layer for
 * cross-source questions (cognivern audit + Slack + GitHub + Linear, etc.).
 *
 * See docs/HYDRADB.md for architecture, setup, and the challenge submission.
 */

export { HydraDbClient, HydraDbError } from "./HydraDbClient.js";
export type {
  HydraDbEnvelope,
  HydraDbChunk,
  HydraDbSource,
  HydraDbGraphContext,
  HydraDbQueryResult,
} from "./HydraDbClient.js";

export {
  HydraDbIngestionService,
  hydraDbIngestion,
  COGNIVERN_DB_SCHEMA,
} from "./HydraDbIngestionService.js";
export type { AppKnowledgeRecord } from "./HydraDbIngestionService.js";

export {
  HydraDbRetrievalService,
  hydraDbRetrieval,
  classifyQuery,
} from "./HydraDbRetrievalService.js";
export type {
  RetrievalMode,
  RetrievalRequest,
  RetrievalOutcome,
  RetrievalMetrics,
} from "./HydraDbRetrievalService.js";
