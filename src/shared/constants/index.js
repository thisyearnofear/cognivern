/**
 * Shared Constants
 */
export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
};
export const AGENT_STATUS = {
    ACTIVE: "active",
    INACTIVE: "inactive",
    PAUSED: "paused",
    ERROR: "error",
};
export const POLICY_STATUS = {
    ACTIVE: "active",
    INACTIVE: "inactive",
    DRAFT: "draft",
};
export const AUDIT_LOG_LEVEL = {
    INFO: "info",
    WARN: "warn",
    ERROR: "error",
    DEBUG: "debug",
};
export const METRICS_PERIOD = {
    HOUR: "hour",
    DAY: "day",
    WEEK: "week",
    MONTH: "month",
};
export const TRADING_STATUS = {
    PENDING: "pending",
    EXECUTED: "executed",
    FAILED: "failed",
    CANCELLED: "cancelled",
};
export const GOVERNANCE_ACTION = {
    APPROVE: "approve",
    REJECT: "reject",
    PAUSE: "pause",
    RESUME: "resume",
};
export const DEFAULT_PAGINATION = {
    PAGE: 1,
    LIMIT: 20,
    MAX_LIMIT: 100,
};
export const CACHE_TTL = {
    SHORT: 60, // 1 minute
    MEDIUM: 300, // 5 minutes
    LONG: 3600, // 1 hour
    VERY_LONG: 86400, // 24 hours
};
export const RATE_LIMITS = {
    DEFAULT: {
        WINDOW_MS: 15 * 60 * 1000, // 15 minutes
        MAX_REQUESTS: 100,
    },
    STRICT: {
        WINDOW_MS: 15 * 60 * 1000, // 15 minutes
        MAX_REQUESTS: 20,
    },
};
export const BLOCKCHAIN_NETWORKS = {
    FILECOIN_MAINNET: "filecoin-mainnet",
    FILECOIN_CALIBRATION: "filecoin-calibration",
    ETHEREUM_MAINNET: "ethereum-mainnet",
    ETHEREUM_SEPOLIA: "ethereum-sepolia",
};
export const FILE_UPLOAD_LIMITS = {
    MAX_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_TYPES: ["application/json", "text/plain", "text/csv"],
};
//# sourceMappingURL=index.js.map
