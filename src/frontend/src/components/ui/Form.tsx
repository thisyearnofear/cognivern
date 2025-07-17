import React, { useState } from 'react';
import { designTokens } from '../../styles/designTokens';
import { Button } from './Button';

export interface FormFieldProps {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'textarea' | 'select';
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  options?: { value: string; label: string }[];
  validation?: (value: string) => string | null;
  description?: string;
}

export interface FormProps {
  fields: FormFieldProps[];
  onSubmit: (data: Record<string, string>) => void;
  submitText?: string;
  loading?: boolean;
  initialValues?: Record<string, string>;
  layout?: 'vertical' | 'horizontal';
}

export const Form: React.FC<FormProps> = ({
  fields,
  onSubmit,
  submitText = 'Submit',
  loading = false,
  initialValues = {},
  layout = 'vertical',
}) => {
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const handleChange = (name: string, value: string) => {
    setValues(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleBlur = (name: string) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    validateField(name, values[name] || '');
  };

  const validateField = (name: string, value: string) => {
    const field = fields.find(f => f.name === name);
    if (!field) return;

    let error = '';

    // Required validation
    if (field.required && !value.trim()) {
      error = `${field.label} is required`;
    }

    // Custom validation
    if (!error && field.validation && value) {
      const validationError = field.validation(value);
      if (validationError) {
        error = validationError;
      }
    }

    setErrors(prev => ({ ...prev, [name]: error }));
    return error;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const newErrors: Record<string, string> = {};
    let hasErrors = false;

    fields.forEach(field => {
      const error = validateField(field.name, values[field.name] || '');
      if (error) {
        newErrors[field.name] = error;
        hasErrors = true;
      }
    });

    setErrors(newErrors);
    setTouched(fields.reduce((acc, field) => ({ ...acc, [field.name]: true }), {}));

    if (!hasErrors) {
      onSubmit(values);
    }
  };

  const formStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: designTokens.spacing[4],
  };

  const fieldGroupStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: layout === 'horizontal' ? 'row' : 'column',
    gap: layout === 'horizontal' ? designTokens.spacing[4] : designTokens.spacing[2],
    alignItems: layout === 'horizontal' ? 'center' : 'stretch',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: designTokens.typography.fontSize.sm,
    fontWeight: designTokens.typography.fontWeight.medium,
    color: designTokens.colors.neutral[700],
    minWidth: layout === 'horizontal' ? '120px' : 'auto',
  };

  const inputStyle = (hasError: boolean): React.CSSProperties => ({
    padding: designTokens.spacing[3],
    border: `1px solid ${hasError 
      ? designTokens.colors.semantic.error[500] 
      : designTokens.colors.neutral[300]}`,
    borderRadius: designTokens.borderRadius.md,
    fontSize: designTokens.typography.fontSize.sm,
    fontFamily: designTokens.typography.fontFamily.sans.join(', '),
    transition: `border-color ${designTokens.animation.duration.fast} ${designTokens.animation.easing.easeInOut}`,
    outline: 'none',
    backgroundColor: designTokens.colors.neutral[0],
    color: designTokens.colors.neutral[900],
    flex: layout === 'horizontal' ? 1 : 'auto',
  });

  const textareaStyle = (hasError: boolean): React.CSSProperties => ({
    ...inputStyle(hasError),
    minHeight: '100px',
    resize: 'vertical',
    fontFamily: designTokens.typography.fontFamily.sans.join(', '),
  });

  const selectStyle = (hasError: boolean): React.CSSProperties => ({
    ...inputStyle(hasError),
    cursor: 'pointer',
  });

  const errorStyle: React.CSSProperties = {
    fontSize: designTokens.typography.fontSize.xs,
    color: designTokens.colors.semantic.error[600],
    marginTop: designTokens.spacing[1],
  };

  const descriptionStyle: React.CSSProperties = {
    fontSize: designTokens.typography.fontSize.xs,
    color: designTokens.colors.neutral[500],
    marginTop: designTokens.spacing[1],
  };

  const renderField = (field: FormFieldProps) => {
    const value = values[field.name] || '';
    const error = errors[field.name];
    const showError = touched[field.name] && error;

    const commonProps = {
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => 
        handleChange(field.name, e.target.value),
      onBlur: () => handleBlur(field.name),
      placeholder: field.placeholder,
      disabled: field.disabled || loading,
      required: field.required,
    };

    let input: React.ReactNode;

    switch (field.type) {
      case 'textarea':
        input = (
          <textarea
            {...commonProps}
            style={textareaStyle(!!showError)}
          />
        );
        break;
      
      case 'select':
        input = (
          <select
            {...commonProps}
            style={selectStyle(!!showError)}
          >
            <option value="">{field.placeholder || `Select ${field.label}`}</option>
            {field.options?.map(option => (
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
            style={inputStyle(!!showError)}
          />
        );
    }

    return (
      <div key={field.name} style={fieldGroupStyle}>
        <label style={labelStyle}>
          {field.label}
          {field.required && <span style={{ color: designTokens.colors.semantic.error[500] }}>*</span>}
        </label>
        <div style={{ flex: layout === 'horizontal' ? 1 : 'auto' }}>
          {input}
          {showError && <div style={errorStyle}>{error}</div>}
          {field.description && !showError && (
            <div style={descriptionStyle}>{field.description}</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} style={formStyle}>
      {fields.map(renderField)}
      
      <div style={{ 
        display: 'flex', 
        justifyContent: 'flex-end',
        marginTop: designTokens.spacing[2],
      }}>
        <Button
          type="submit"
          variant="primary"
          isLoading={loading}
          disabled={loading}
        >
          {submitText}
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
  const inputStyle = (hasError: boolean): React.CSSProperties => ({
    width: '100%',
    padding: designTokens.spacing[3],
    border: `1px solid ${hasError 
      ? designTokens.colors.semantic.error[500] 
      : designTokens.colors.neutral[300]}`,
    borderRadius: designTokens.borderRadius.md,
    fontSize: designTokens.typography.fontSize.sm,
    fontFamily: designTokens.typography.fontFamily.sans.join(', '),
    transition: `border-color ${designTokens.animation.duration.fast} ${designTokens.animation.easing.easeInOut}`,
    outline: 'none',
    backgroundColor: designTokens.colors.neutral[0],
    color: designTokens.colors.neutral[900],
  });

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: designTokens.spacing[2],
    fontSize: designTokens.typography.fontSize.sm,
    fontWeight: designTokens.typography.fontWeight.medium,
    color: designTokens.colors.neutral[700],
  };

  const errorStyle: React.CSSProperties = {
    fontSize: designTokens.typography.fontSize.xs,
    color: designTokens.colors.semantic.error[600],
    marginTop: designTokens.spacing[1],
  };

  const commonProps = {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => 
      onChange(e.target.value),
    onBlur,
    placeholder: field.placeholder,
    disabled: field.disabled,
    required: field.required,
    style: inputStyle(!!error),
  };

  return (
    <div>
      <label style={labelStyle}>
        {field.label}
        {field.required && <span style={{ color: designTokens.colors.semantic.error[500] }}>*</span>}
      </label>
      
      {field.type === 'textarea' ? (
        <textarea {...commonProps} style={{ ...commonProps.style, minHeight: '100px', resize: 'vertical' }} />
      ) : field.type === 'select' ? (
        <select {...commonProps}>
          <option value="">{field.placeholder || `Select ${field.label}`}</option>
          {field.options?.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input {...commonProps} type={field.type || 'text'} />
      )}
      
      {error && <div style={errorStyle}>{error}</div>}
      {field.description && !error && (
        <div style={{
          fontSize: designTokens.typography.fontSize.xs,
          color: designTokens.colors.neutral[500],
          marginTop: designTokens.spacing[1],
        }}>
          {field.description}
        </div>
      )}
    </div>
  );
};

export default Form;