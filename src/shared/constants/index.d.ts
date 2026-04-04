/**
 * Shared Constants
 */
export declare const HTTP_STATUS: {
    readonly OK: 200;
    readonly CREATED: 201;
    readonly NO_CONTENT: 204;
    readonly BAD_REQUEST: 400;
    readonly UNAUTHORIZED: 401;
    readonly FORBIDDEN: 403;
    readonly NOT_FOUND: 404;
    readonly CONFLICT: 409;
    readonly INTERNAL_SERVER_ERROR: 500;
    readonly SERVICE_UNAVAILABLE: 503;
};
export declare const AGENT_STATUS: {
    readonly ACTIVE: "active";
    readonly INACTIVE: "inactive";
    readonly PAUSED: "paused";
    readonly ERROR: "error";
};
export declare const POLICY_STATUS: {
    readonly ACTIVE: "active";
    readonly INACTIVE: "inactive";
    readonly DRAFT: "draft";
};
export declare const AUDIT_LOG_LEVEL: {
    readonly INFO: "info";
    readonly WARN: "warn";
    readonly ERROR: "error";
    readonly DEBUG: "debug";
};
export declare const METRICS_PERIOD: {
    readonly HOUR: "hour";
    readonly DAY: "day";
    readonly WEEK: "week";
    readonly MONTH: "month";
};
export declare const TRADING_STATUS: {
    readonly PENDING: "pending";
    readonly EXECUTED: "executed";
    readonly FAILED: "failed";
    readonly CANCELLED: "cancelled";
};
export declare const GOVERNANCE_ACTION: {
    readonly APPROVE: "approve";
    readonly REJECT: "reject";
    readonly PAUSE: "pause";
    readonly RESUME: "resume";
};
export declare const DEFAULT_PAGINATION: {
    readonly PAGE: 1;
    readonly LIMIT: 20;
    readonly MAX_LIMIT: 100;
};
export declare const CACHE_TTL: {
    readonly SHORT: 60;
    readonly MEDIUM: 300;
    readonly LONG: 3600;
    readonly VERY_LONG: 86400;
};
export declare const RATE_LIMITS: {
    readonly DEFAULT: {
        readonly WINDOW_MS: number;
        readonly MAX_REQUESTS: 100;
    };
    readonly STRICT: {
        readonly WINDOW_MS: number;
        readonly MAX_REQUESTS: 20;
    };
};
export declare const BLOCKCHAIN_NETWORKS: {
    readonly FILECOIN_MAINNET: "filecoin-mainnet";
    readonly FILECOIN_CALIBRATION: "filecoin-calibration";
    readonly ETHEREUM_MAINNET: "ethereum-mainnet";
    readonly ETHEREUM_SEPOLIA: "ethereum-sepolia";
};
export declare const FILE_UPLOAD_LIMITS: {
    readonly MAX_SIZE: number;
    readonly ALLOWED_TYPES: readonly ["application/json", "text/plain", "text/csv"];
};
//# sourceMappingURL=index.d.ts.map
