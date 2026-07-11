import { startServer } from "./server.js";
import logger from "./backend/utils/logger.js";

// Error handling for uncaught exceptions and unhandled rejections.
// In both cases the process is in an unknown state — exit so PM2 restarts
// us cleanly rather than continuing with corrupted memory/connections.
process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception — exiting for clean restart", {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

// Log async failures but keep serving — exiting on every rejection caused PM2
// restarts (502) when TestSprite (or other clients) hit many endpoints at once.
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection — request may have failed", {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

// Add process exit debugging
process.on("exit", (code) => {
  logger.error(`Process is exiting with code: ${code}`);
});

process.on("beforeExit", (code) => {
  logger.error(`Process beforeExit event with code: ${code}`);
});

// Start the server
async function main() {
  logger.info("Starting Governance Platform backend service");
  logger.info("About to call startServer()");
  await startServer();
  logger.error("startServer() returned - this should never happen!");
}

main().catch((error) => {
  logger.error("Failed to start application:", error);
  logger.error("Error stack:", error.stack);
  process.exit(1);
});
