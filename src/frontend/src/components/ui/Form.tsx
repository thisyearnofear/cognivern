/** @jsxImportSource @emotion/react */
import React, { useState, useCallback } from 'react';
import { css, keyframes } from '@emotion/react';
import { designTokens } from '../../styles/design-system';
import { Button } from './Button';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export interface FormFieldProps {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'textarea' | 'select' | 'url' | 'tel';
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  options?: { value: string; label: string }[];
  validation?: (value: string) => string | null;
  description?: string;
  helpText?: string;
  autoComplete?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
}

export interface FormProps {
  fields: FormFieldProps[];
  onSubmit: (data: Record<string, string>) => void;
  submitText?: string;
  loading?: boolean;
  initialValues?: Record<string, string>;
  layout?: 'vertical' | 'horizontal';
  showValidationOnBlur?: boolean;
  successMessage?: string;
}

// Validation animation
const slideIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

// Success check animation
const checkPop = keyframes`
  0% { transform: scale(0); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
`;

export const Form: React.FC<FormProps> = ({
  fields,
  onSubmit,
  submitText = 'Submit',
  loading = false,
  initialValues = {},
  layout = 'vertical',
  showValidationOnBlur = true,
  successMessage,
}) => {
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isValid, setIsValid] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handleChange = useCallback((name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }

    // Real-time validation feedback (debounced)
    if (isValid[name] === false) {
      validateField(name, value);
    }
  }, [errors, isValid]);

  const handleBlur = useCallback((name: string) => {
    setTouched((prev) => ({ ...prev, [name]: true }));
    validateField(name, values[name] || '');
  }, [values]);

  const validateField = useCallback((name: string, value: string) => {
    const field = fields.find((f) => f.name === name);
    if (!field) return '';

    let error = '';

    // Required validation
    if (field.required && !value.trim()) {
      error = `${field.label} is required`;
    }

    // Min length validation
    if (!error && field.minLength && value.length < field.minLength) {
      error = `${field.label} must be at least ${field.minLength} characters`;
    }

    // Pattern validation
    if (!error && field.pattern && value && !new RegExp(field.pattern).test(value)) {
      error = `${field.label} format is invalid`;
    }

    // Custom validation
    if (!error && field.validation && value) {
      const validationError = field.validation(value);
      if (validationError) {
        error = validationError;
      }
    }

    setErrors((prev) => ({ ...prev, [name]: error }));
    setIsValid((prev) => ({ ...prev, [name]: !error && value.length > 0 }));
    return error;
  }, [fields]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitSuccess(false);

    // Validate all fields
    const newErrors: Record<string, string> = {};
    const newValid: Record<string, boolean> = {};
    let hasErrors = false;

    fields.forEach((field) => {
      const error = validateField(field.name, values[field.name] || '');
      newValid[field.name] = !error && !!values[field.name];
      if (error) {
        newErrors[field.name] = error;
        hasErrors = true;
      }
    });

    setErrors(newErrors);
    setIsValid(newValid);
    setTouched(fields.reduce((acc, field) => ({ ...acc, [field.name]: true }), {}));

    if (!hasErrors) {
      setIsSubmitting(true);
      try {
        await onSubmit(values);
        setSubmitSuccess(true);
        // Reset form after successful submission
        setTimeout(() => {
          setSubmitSuccess(false);
        }, 3000);
      } finally {
        setIsSubmitting(false);
      }
    }
  }, [fields, values, onSubmit, validateField]);

  const renderField = (field: FormFieldProps) => {
    const value = values[field.name] || '';
    const error = errors[field.name];
    const valid = isValid[field.name];
    const showError = touched[field.name] && error;
    const showSuccess = touched[field.name] && valid && !error;

    const inputStyles = css`
      width: 100%;
      padding: ${designTokens.spacing[3]};
      font-size: ${designTokens.typography.fontSize.base};
      font-family: ${designTokens.typography.fontFamily.sans};
      background: var(--input-bg, ${designTokens.colors.neutral[0]});
      border: 2px solid ${
        showError
          ? designTokens.colors.semantic.error[500]
          : showSuccess
            ? designTokens.colors.semantic.success[500]
            : `var(--border-subtle, ${designTokens.colors.neutral[300]})`
      };
      border-radius: ${designTokens.borderRadius.md};
      color: var(--text-primary);
      transition: all ${designTokens.animation.duration.fast} ease-out;
      outline: none;

      &::placeholder {
        color: var(--text-muted);
      }

      &:focus {
        border-color: ${
          showError
            ? designTokens.colors.semantic.error[500]
            : designTokens.colors.primary[500]
        };
        box-shadow: 0 0 0 3px ${
          showError
            ? `${designTokens.colors.semantic.error[100]}`
            : `${designTokens.colors.primary[100]}`
        };
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        background: var(--bg-secondary);
      }
    `;

    const commonProps = {
      value,
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
      ) => handleChange(field.name, e.target.value),
      onBlur: () => handleBlur(field.name),
      placeholder: field.placeholder,
      disabled: field.disabled || loading || isSubmitting,
      required: field.required,
      autoComplete: field.autoComplete,
      pattern: field.pattern,
      minLength: field.minLength,
      maxLength: field.maxLength,
    };

    let input: React.ReactNode;

    switch (field.type) {
      case 'textarea':
        input = <textarea {...commonProps} css={inputStyles} rows={4} />;
        break;

      case 'select':
        input = (
          <select {...commonProps} css={inputStyles}>
            <option value="">{field.placeholder || `Select ${field.label}`}</option>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
        break;

      default:
        input = (
          <input
            {...commonProps}
            type={field.type || 'text'}
            css={inputStyles}
          />
        );
    }

    return (
      <div
        key={field.name}
        css={css`
          margin-bottom: ${designTokens.spacing[4]};
          animation: ${slideIn} 0.2s ease-out;
        `}
      >
        <label
          css={css`
            display: block;
            margin-bottom: ${designTokens.spacing[2]};
            font-size: ${designTokens.typography.fontSize.sm};
            font-weight: ${designTokens.typography.fontWeight.medium};
            color: var(--text-primary);
          `}
        >
          {field.label}
          {field.required && (
            <span
              css={css`
                color: ${designTokens.colors.semantic.error[500]};
                margin-left: 2px;
              `}
            >
              *
            </span>
          )}
        </label>

        <div css={css`position: relative;`}>
          {input}

          {/* Status icons */}
          {showSuccess && (
            <CheckCircle
              size={18}
              css={css`
                position: absolute;
                right: 12px;
                top: 50%;
                transform: translateY(-50%);
                color: ${designTokens.colors.semantic.success[500]};
                animation: ${checkPop} 0.3s ease-out;
              `}
            />
          )}
          {showError && (
            <AlertCircle
              size={18}
              css={css`
                position: absolute;
                right: 12px;
                top: 50%;
                transform: translateY(-50%);
                color: ${designTokens.colors.semantic.error[500]};
              `}
            />
          )}
        </div>

        {/* Error message */}
        {showError && (
          <div
            css={css`
              display: flex;
              align-items: center;
              gap: ${designTokens.spacing[1]};
              margin-top: ${designTokens.spacing[1]};
              font-size: ${designTokens.typography.fontSize.xs};
              color: ${designTokens.colors.semantic.error[500]};
              animation: ${slideIn} 0.2s ease-out;
            `}
          >
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {/* Help text / description */}
        {field.helpText && !showError && (
          <div
            css={css`
              margin-top: ${designTokens.spacing[1]};
              font-size: ${designTokens.typography.fontSize.xs};
              color: var(--text-secondary);
            `}
          >
            {field.helpText}
          </div>
        )}
      </div>
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      css={css`
        max-width: ${layout === 'horizontal' ? '100%' : '480px'};
      `}
    >
      {fields.map(renderField)}

      {/* Success message */}
      {submitSuccess && successMessage && (
        <div
          css={css`
            display: flex;
            align-items: center;
            gap: ${designTokens.spacing[2]};
            padding: ${designTokens.spacing[3]};
            margin-bottom: ${designTokens.spacing[4]};
            background: ${designTokens.colors.semantic.success[100]};
            color: ${designTokens.colors.semantic.success[700]};
            border-radius: ${designTokens.borderRadius.md};
            font-size: ${designTokens.typography.fontSize.sm};
            animation: ${slideIn} 0.3s ease-out;
          `}
          role="alert"
        >
          <CheckCircle size={18} />
          {successMessage}
        </div>
      )}

      <div
        css={css`
          display: flex;
          gap: ${designTokens.spacing[3]};
          margin-top: ${designTokens.spacing[6]};
        `}
      >
        <Button
          type="submit"
          variant="primary"
          isLoading={isSubmitting || loading}
          disabled={isSubmitting || loading}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} css={css`animation: ${spin} 1s linear infinite;`} />
              Submitting...
            </>
          ) : submitText}
        </Button>
      </div>
    </form>
  );
};

// Individual form field components for more flexibility
export const FormField: React.FC<{
  field: FormFieldProps;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}> = ({ field, value, error, onChange, onBlur }) => {
  const commonProps = {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      onChange(e.target.value),
    onBlur,
    placeholder: field.placeholder,
    disabled: field.disabled,
    required: field.required,
    css: getFormInputStyles(!!error),
  };

  return (
    <div>
      <label css={getFormLabelStyles('vertical')}>
        {field.label}
        {field.required && (
          <span
            css={css`
              color: ${designTokens.colors.semantic.error[500]};
              margin-left: 2px;
            `}
          >
            *
          </span>
        )}
      </label>

      {field.type === 'textarea' ? (
        <textarea {...commonProps} />
      ) : field.type === 'select' ? (
        <select {...commonProps}>
          <option value="">{field.placeholder || `Select ${field.label}`}</option>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input {...commonProps} type={field.type || 'text'} />
      )}

      {error && <div css={formErrorStyles}>{error}</div>}
      {field.description && !error && <div css={formDescriptionStyles}>{field.description}</div>}
    </div>
  );
};

export default Form;
