/**
 * Shared Error Classes
 */
export class ServiceError extends Error {
    code;
    statusCode;
    constructor(message, code = "SERVICE_ERROR", statusCode = 500) {
        super(message);
        this.name = "ServiceError";
        this.code = code;
        this.statusCode = statusCode;
    }
}
export class ValidationError extends Error {
    field;
    statusCode = 400;
    constructor(message, field) {
        super(message);
        this.name = "ValidationError";
        this.field = field;
    }
}
export class NotFoundError extends ServiceError {
    constructor(resource, id) {
        const message = id
            ? `${resource} with id ${id} not found`
            : `${resource} not found`;
        super(message, "NOT_FOUND", 404);
        this.name = "NotFoundError";
    }
}
export class UnauthorizedError extends ServiceError {
    constructor(message = "Unauthorized") {
        super(message, "UNAUTHORIZED", 401);
        this.name = "UnauthorizedError";
    }
}
export class ForbiddenError extends ServiceError {
    constructor(message = "Forbidden") {
        super(message, "FORBIDDEN", 403);
        this.name = "ForbiddenError";
    }
}
export class ConflictError extends ServiceError {
    constructor(message) {
        super(message, "CONFLICT", 409);
        this.name = "ConflictError";
    }
}
//# sourceMappingURL=index.js.map
