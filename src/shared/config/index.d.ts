/**
 * Centralized Configuration Management
 *
 * Single source of truth for all configuration across the platform.
 * Eliminates duplication and ensures consistency.
 */
export declare const config: any;
export declare const apiConfig: {
    port: any;
    apiKey: any;
    corsOrigin: any;
    rateLimit: {
        windowMs: any;
        maxRequests: any;
    };
    requestTimeout: any;
};
export declare const sapienceConfig: {
    arbitrumRpcUrl: any;
    etherealRpcUrl: any;
    privateKey: any;
    easAddress: any;
};
export declare const databaseConfig: {
    url: string;
    maxConnections: number;
    connectionTimeout: number;
    queryTimeout: number;
};
export declare const cacheConfig: {
    url: string;
    ttl: number;
    maxSize: string;
};
export declare const tradingConfig: {
    enabled: boolean;
    recallApiKeys: {
        direct: string;
        vincent: string;
    };
    maxRiskPerTrade: number;
};
export declare const blockchainConfig: {
    privateKey: string;
    rpcUrl: string;
    network: string;
    contracts: {
        governance: string;
        storage: string;
    };
};
export declare const monitoringConfig: {
    enabled: boolean;
    healthCheckInterval: number;
    retentionDays: {
        audit: number;
        logs: number;
    };
};
export declare const aiConfig: {
    openaiApiKey: any;
    modelName: any;
    geminiApiKey: any;
};
export declare const isDevelopment: boolean;
export declare const isProduction: boolean;
export declare const isTest: boolean;
//# sourceMappingURL=index.d.ts.map
