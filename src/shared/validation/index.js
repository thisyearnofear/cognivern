/**
 * Shared Validation Functions
 */
import { ValidationError } from "../errors/index.js";
export class Validator {
    rules = [];
    addRule(rule) {
        this.rules.push(rule);
        return this;
    }
    validate(value, fieldName) {
        for (const rule of this.rules) {
            if (!rule.validate(value)) {
                throw new ValidationError(rule.message, fieldName);
            }
        }
    }
}
export const CommonValidators = {
    required: (value) => {
        if (value === null || value === undefined)
            return false;
        if (typeof value === "string")
            return value.trim().length > 0;
        return true;
    },
    minLength: (min) => (value) => {
        return value && value.length >= min;
    },
    maxLength: (max) => (value) => {
        return !value || value.length <= max;
    },
    email: (value) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value);
    },
    numeric: (value) => {
        return !isNaN(Number(value));
    },
    positive: (value) => {
        return value > 0;
    },
    range: (min, max) => (value) => {
        return value >= min && value <= max;
    },
    address: (value) => {
        // Basic Ethereum address validation
        return /^0x[a-fA-F0-9]{40}$/.test(value);
    },
};
export function validateRequired(value, fieldName) {
    if (!CommonValidators.required(value)) {
        throw new ValidationError(`${fieldName} is required`, fieldName);
    }
}
export function validateString(value, fieldName, minLength, maxLength) {
    validateRequired(value, fieldName);
    if (minLength && !CommonValidators.minLength(minLength)(value)) {
        throw new ValidationError(`${fieldName} must be at least ${minLength} characters`, fieldName);
    }
    if (maxLength && !CommonValidators.maxLength(maxLength)(value)) {
        throw new ValidationError(`${fieldName} must be at most ${maxLength} characters`, fieldName);
    }
}
export function validateNumber(value, fieldName, min, max) {
    validateRequired(value, fieldName);
    if (min !== undefined && value < min) {
        throw new ValidationError(`${fieldName} must be at least ${min}`, fieldName);
    }
    if (max !== undefined && value > max) {
        throw new ValidationError(`${fieldName} must be at most ${max}`, fieldName);
    }
}
//# sourceMappingURL=index.js.map
