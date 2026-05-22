/**
 * Shared Error Classes
 */
export declare class ServiceError extends Error {
    readonly code: string;
    readonly statusCode: number;
    constructor(message: string, code?: string, statusCode?: number);
}
export declare class ValidationError extends Error {
    readonly field?: string;
    readonly statusCode: number;
    constructor(message: string, field?: string);
}
export declare class NotFoundError extends ServiceError {
    constructor(resource: string, id?: string);
}
export declare class UnauthorizedError extends ServiceError {
    constructor(message?: string);
}
export declare class ForbiddenError extends ServiceError {
    constructor(message?: string);
}
export declare class ConflictError extends ServiceError {
    constructor(message: string);
}
//# sourceMappingURL=index.d.ts.map
