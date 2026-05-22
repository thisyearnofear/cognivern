/**
 * Shared Validation Functions
 */
export interface ValidationRule<T> {
    validate: (value: T) => boolean;
    message: string;
}
export declare class Validator<T> {
    private rules;
    addRule(rule: ValidationRule<T>): this;
    validate(value: T, fieldName?: string): void;
}
export declare const CommonValidators: {
    required: <T>(value: T) => boolean;
    minLength: (min: number) => (value: string) => boolean;
    maxLength: (max: number) => (value: string) => boolean;
    email: (value: string) => boolean;
    numeric: (value: string) => boolean;
    positive: (value: number) => boolean;
    range: (min: number, max: number) => (value: number) => boolean;
    address: (value: string) => boolean;
};
export declare function validateRequired<T>(value: T, fieldName: string): void;
export declare function validateString(value: string, fieldName: string, minLength?: number, maxLength?: number): void;
export declare function validateNumber(value: number, fieldName: string, min?: number, max?: number): void;
//# sourceMappingURL=index.d.ts.map
