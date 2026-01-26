// Advanced validation utilities for forms

export type ValidationRule = {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  email?: boolean;
  url?: boolean;
  number?: boolean;
  min?: number;
  max?: number;
  custom?: (value: string) => string | null;
  match?: string; // Field name to match
};

export type ValidationSchema = Record<string, ValidationRule>;

export type ValidationErrors = Record<string, string>;

export class FormValidator {
  private schema: ValidationSchema;
  private values: Record<string, string>;

  constructor(schema: ValidationSchema) {
    this.schema = schema;
    this.values = {};
  }

  setValues(values: Record<string, string>) {
    this.values = values;
  }

  validateField(fieldName: string, value: string): string | null {
    const rule = this.schema[fieldName];
    if (!rule) return null;

    // Required validation
    if (rule.required && (!value || value.trim() === "")) {
      return `${this.formatFieldName(fieldName)} is required`;
    }

    // Skip other validations if field is empty and not required
    if (!value || value.trim() === "") {
      return null;
    }

    // Length validations
    if (rule.minLength && value.length < rule.minLength) {
      return `${this.formatFieldName(fieldName)} must be at least ${rule.minLength} characters`;
    }

    if (rule.maxLength && value.length > rule.maxLength) {
      return `${this.formatFieldName(fieldName)} must be no more than ${rule.maxLength} characters`;
    }

    // Pattern validation
    if (rule.pattern && !rule.pattern.test(value)) {
      return `${this.formatFieldName(fieldName)} format is invalid`;
    }

    // Email validation
    if (rule.email && !this.isValidEmail(value)) {
      return `${this.formatFieldName(fieldName)} must be a valid email address`;
    }

    // URL validation
    if (rule.url && !this.isValidUrl(value)) {
      return `${this.formatFieldName(fieldName)} must be a valid URL`;
    }

    // Number validation
    if (rule.number) {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) {
        return `${this.formatFieldName(fieldName)} must be a valid number`;
      }

      if (rule.min !== undefined && numValue < rule.min) {
        return `${this.formatFieldName(fieldName)} must be at least ${rule.min}`;
      }

      if (rule.max !== undefined && numValue > rule.max) {
        return `${this.formatFieldName(fieldName)} must be no more than ${rule.max}`;
      }
    }

    // Match validation (for password confirmation, etc.)
    if (rule.match && this.values[rule.match] !== value) {
      return `${this.formatFieldName(fieldName)} must match ${this.formatFieldName(rule.match)}`;
    }

    // Custom validation
    if (rule.custom) {
      const customError = rule.custom(value);
      if (customError) {
        return customError;
      }
    }

    return null;
  }

  validateAll(values: Record<string, string>): ValidationErrors {
    this.setValues(values);
    const errors: ValidationErrors = {};

    Object.keys(this.schema).forEach((fieldName) => {
      const error = this.validateField(fieldName, values[fieldName] || "");
      if (error) {
        errors[fieldName] = error;
      }
    });

    return errors;
  }

  isValid(values: Record<string, string>): boolean {
    const errors = this.validateAll(values);
    return Object.keys(errors).length === 0;
  }

  private formatFieldName(fieldName: string): string {
    return fieldName
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

// Predefined validation rules
export const ValidationRules = {
  required: { required: true },
  email: { required: true, email: true },
  password: {
    required: true,
    minLength: 8,
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
  },
  confirmPassword: (passwordField: string) => ({
    required: true,
    match: passwordField,
  }),
  url: { url: true },
  phone: {
    pattern: /^[\+]?[1-9][\d]{0,15}$/,
  },
  username: {
    required: true,
    minLength: 3,
    maxLength: 20,
    pattern: /^[a-zA-Z0-9_]+$/,
  },
  name: {
    required: true,
    minLength: 2,
    maxLength: 50,
    pattern: /^[a-zA-Z\s]+$/,
  },
  number: {
    number: true,
  },
  positiveNumber: {
    number: true,
    min: 0,
  },
  percentage: {
    number: true,
    min: 0,
    max: 100,
  },
};

// Async validation for server-side checks
export class AsyncValidator {
  private pendingValidations = new Map<string, Promise<string | null>>();

  async validateAsync(
    fieldName: string,
    value: string,
    validator: (value: string) => Promise<string | null>,
  ): Promise<string | null> {
    // Cancel previous validation for this field
    if (this.pendingValidations.has(fieldName)) {
      // Note: We can't actually cancel the promise, but we can ignore its result
    }

    const validationPromise = validator(value);
    this.pendingValidations.set(fieldName, validationPromise);

    try {
      const result = await validationPromise;

      // Only return result if this is still the latest validation for this field
      if (this.pendingValidations.get(fieldName) === validationPromise) {
        this.pendingValidations.delete(fieldName);
        return result;
      }

      return null; // Validation was superseded
    } catch (error) {
      this.pendingValidations.delete(fieldName);
      return "Validation failed";
    }
  }

  cancelAll() {
    this.pendingValidations.clear();
  }
}

// Common async validators
export const AsyncValidators = {
  checkUsernameAvailability: async (
    username: string,
  ): Promise<string | null> => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));

    const unavailableUsernames = ["admin", "root", "user", "test"];
    if (unavailableUsernames.includes(username.toLowerCase())) {
      return "Username is already taken";
    }

    return null;
  },

  checkEmailAvailability: async (email: string): Promise<string | null> => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Real email validation would call your API
    // For now, return null (no error) for all emails
    return null;
  },

  validateWalletAddress: async (address: string): Promise<string | null> => {
    // Simulate blockchain validation
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Basic Ethereum address validation
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return "Invalid wallet address format";
    }

    return null;
  },
};

// Form validation hook
export const useFormValidation = (schema: ValidationSchema) => {
  const validator = new FormValidator(schema);
  const asyncValidator = new AsyncValidator();

  return {
    validateField: (fieldName: string, value: string) =>
      validator.validateField(fieldName, value),

    validateAll: (values: Record<string, string>) =>
      validator.validateAll(values),

    isValid: (values: Record<string, string>) => validator.isValid(values),

    validateAsync: (
      fieldName: string,
      value: string,
      validatorFn: (value: string) => Promise<string | null>,
    ) => asyncValidator.validateAsync(fieldName, value, validatorFn),

    cancelAsyncValidations: () => asyncValidator.cancelAll(),
  };
};
