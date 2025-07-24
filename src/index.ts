import { startServer } from "./server.js";
import logger from "./utils/logger.js";

// Error handling for uncaught exceptions and unhandled rejections
process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", {
    error: error.message,
    stack: error.stack,
  });
  // Don't exit the process - just log the error and continue
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled rejection", {
    reason: reason instanceof Error ? reason.message : String(reason),
    promise,
  });
  // Don't exit the process - just log the error and continue
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
