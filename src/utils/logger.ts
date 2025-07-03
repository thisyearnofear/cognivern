import winston from "winston";

const { format, createLogger, transports } = winston;

const logFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.json()
);

const logger = createLogger({
  level: process.env.LOG_LEVEL,
  format: logFormat,
  defaultMeta: { service: "cognivern" },
  transports: [
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    }),
  ],
});

// Add file transport in production
if (process.env.NODE_ENV === "production") {
  logger.add(
    new transports.File({
      filename: "logs/error.log",
      level: "error",
    })
  );
  logger.add(
    new transports.File({
      filename: "logs/combined.log",
    })
  );
}

export default logger;
