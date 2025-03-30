import winston from 'winston';
import { config } from '../config.js';

const { format, createLogger, transports } = winston;

const logFormat = format.combine(format.timestamp(), format.errors({ stack: true }), format.json());

const logger = createLogger({
  level: config.LOG_LEVEL,
  format: logFormat,
  defaultMeta: { service: 'escheat-agents' },
  transports: [
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    }),
  ],
});

// Add file transport in production
if (config.NODE_ENV === 'production') {
  logger.add(
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
  );
  logger.add(
    new transports.File({
      filename: 'logs/combined.log',
    }),
  );
}

export default logger;
