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

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled rejection — exiting for clean restart", {
    reason: reason instanceof Error ? reason.message : String(reason),
    promise,
  });
  process.exit(1);
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
