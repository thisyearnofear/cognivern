import winston from "winston";

const { format, createLogger, transports } = winston;

// Aggressive sanitization to prevent massive logs
const sanitizeFormat = format((info) => {
  // Limit message length aggressively
  if (typeof info.message === "string" && info.message.length > 200) {
    info.message = info.message.substring(0, 200) + "... [truncated]";
  }

  // Remove ALL large objects completely
  const sanitizeValue = (value: any): any => {
    if (value === null || value === undefined) return value;
    if (typeof value === "string")
      return value.length > 100 ? value.substring(0, 100) + "..." : value;
    if (typeof value === "number" || typeof value === "boolean") return value;
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return `[Array(${value.length})]`;
    if (typeof value === "object") return "[Object removed]";
    return "[Unknown]";
  };

  // Only keep essential fields
  const sanitized: any = {
    timestamp: info.timestamp,
    level: info.level,
    service: info.service,
    message: sanitizeValue(info.message),
  };

  // Add minimal error info if present
  if (info.error) {
    const error = info.error as any;
    sanitized.error = {
      name: error.name || "Error",
      message: sanitizeValue(error.message),
      status: error.status || error.response?.status,
    };
  }

  return sanitized;
});

const logFormat = format.combine(
  format.timestamp(),
  sanitizeFormat(),
  format.errors({ stack: true }),
  format.json()
);

const logger = createLogger({
  level: process.env.LOG_LEVEL || "warn", // Only log warnings and errors
  format: logFormat,
  defaultMeta: { service: "cognivern" },
  transports: [
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    }),
  ],
});

// Add file transport in production with aggressive rotation
if (process.env.NODE_ENV === "production") {
  logger.add(
    new transports.File({
      filename: "logs/error.log",
      level: "error",
      maxsize: 2 * 1024 * 1024, // 2MB max
      maxFiles: 2, // Keep only 2 files
      tailable: true,
    })
  );
  logger.add(
    new transports.File({
      filename: "logs/combined.log",
      maxsize: 5 * 1024 * 1024, // 5MB max
      maxFiles: 2, // Keep only 2 files
      tailable: true,
    })
  );
}

export default logger;
