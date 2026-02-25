/**
 * Shared Validation Functions
 */

import { ValidationError } from '../errors/index.js';

export interface ValidationRule<T> {
  validate: (value: T) => boolean;
  message: string;
}

export class Validator<T> {
  private rules: ValidationRule<T>[] = [];

  addRule(rule: ValidationRule<T>): this {
    this.rules.push(rule);
    return this;
  }

  validate(value: T, fieldName?: string): void {
    for (const rule of this.rules) {
      if (!rule.validate(value)) {
        throw new ValidationError(rule.message, fieldName);
      }
    }
  }
}

export const CommonValidators = {
  required: <T>(value: T): boolean => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    return true;
  },

  minLength: (min: number) => (value: string): boolean => {
    return value && value.length >= min;
  },

  maxLength: (max: number) => (value: string): boolean => {
    return !value || value.length <= max;
  },

  email: (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  },

  numeric: (value: string): boolean => {
    return !isNaN(Number(value));
  },

  positive: (value: number): boolean => {
    return value > 0;
  },

  range: (min: number, max: number) => (value: number): boolean => {
    return value >= min && value <= max;
  },

  address: (value: string): boolean => {
    // Basic Ethereum address validation
    return /^0x[a-fA-F0-9]{40}$/.test(value);
  }
};

export function validateRequired<T>(value: T, fieldName: string): void {
  if (!CommonValidators.required(value)) {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }
}

export function validateString(value: string, fieldName: string, minLength?: number, maxLength?: number): void {
  validateRequired(value, fieldName);

  if (minLength && !CommonValidators.minLength(minLength)(value)) {
    throw new ValidationError(`${fieldName} must be at least ${minLength} characters`, fieldName);
  }

  if (maxLength && !CommonValidators.maxLength(maxLength)(value)) {
    throw new ValidationError(`${fieldName} must be at most ${maxLength} characters`, fieldName);
  }
}

export function validateNumber(value: number, fieldName: string, min?: number, max?: number): void {
  validateRequired(value, fieldName);

  if (min !== undefined && value < min) {
    throw new ValidationError(`${fieldName} must be at least ${min}`, fieldName);
  }

  if (max !== undefined && value > max) {
    throw new ValidationError(`${fieldName} must be at most ${max}`, fieldName);
  }
}
