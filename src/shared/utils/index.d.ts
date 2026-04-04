/**
 * Shared Utility Functions
 */
export declare function sleep(ms: number): Promise<void>;
export declare function formatBytes(bytes: number, decimals?: number): string;
export declare function generateId(): string;
export declare function isValidEmail(email: string): boolean;
export declare function sanitizeString(str: string): string;
export declare function deepClone<T>(obj: T): T;
export declare function retry<T>(fn: () => Promise<T>, maxAttempts?: number, delay?: number): Promise<T>;
//# sourceMappingURL=index.d.ts.map
