import { startServer } from './server.js';
import logger from './utils/logger.js';

// Error handling for uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    promise,
  });
});

// Start the server
logger.info('Starting Governance Platform backend service');
startServer();
