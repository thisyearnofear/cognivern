import { ApiModule } from "./modules/api/ApiModule.js";
import logger from "./utils/logger.js";

// Fix EventEmitter memory leak warnings
process.setMaxListeners(20);

// Initialize our modular API system
const PORT = process.env.PORT || 3000;
let apiModule: ApiModule;

export async function startServer(): Promise<void> {
  try {
    logger.info("🚀 Starting Cognivern AI Agent Governance Platform...");

    // Initialize our modular API system
    logger.info("🔧 Creating ApiModule instance");
    apiModule = new ApiModule();
    logger.info("🔧 About to initialize ApiModule");
    await apiModule.initialize();
    logger.info("🔧 ApiModule initialization complete");

    // Server is already started by ApiModule.initialize()
    logger.info(`✅ Server running on port ${PORT}`);
    logger.info(`🌐 Health check: http://localhost:${PORT}/health`);
    logger.info(`🤖 Showcase agents: http://localhost:${PORT}/api/agents`);
    logger.info("🎯 AI Agent Governance Platform ready for showcase!");

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`📡 Received ${signal}, shutting down gracefully...`);

      if (apiModule) {
        await apiModule.shutdown();
        logger.info("🛑 API module shut down");
      }

      logger.info("✅ Graceful shutdown complete");
      process.exit(0);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    // Keep the process alive until a shutdown signal is received
    return new Promise(() => {});
  } catch (error) {
    logger.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((error) => {
    logger.error("Failed to start server:", error);
    process.exit(1);
  });
}
