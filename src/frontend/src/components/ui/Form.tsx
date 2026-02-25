import React, { useState } from "react";
import { css } from "@emotion/react";
import { Button } from "./Button";
import {
  formStyles,
  getFormFieldGroupStyles,
  getFormLabelStyles,
  getFormInputStyles,
  formErrorStyles,
  formDescriptionStyles,
  formSubmitContainerStyles,
} from "../../styles/design-system";

export interface FormFieldProps {
  label: string;
  name: string;
  type?: "text" | "email" | "password" | "number" | "textarea" | "select";
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
  layout?: "vertical" | "horizontal";
}

export const Form: React.FC<FormProps> = ({
  fields,
  onSubmit,
  submitText = "Submit",
  loading = false,
  initialValues = {},
  layout = "vertical",
}) => {
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const handleChange = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleBlur = (name: string) => {
    setTouched((prev) => ({ ...prev, [name]: true }));
    validateField(name, values[name] || "");
  };

  const validateField = (name: string, value: string) => {
    const field = fields.find((f) => f.name === name);
    if (!field) return;

    let error = "";

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

    setErrors((prev) => ({ ...prev, [name]: error }));
    return error;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const newErrors: Record<string, string> = {};
    let hasErrors = false;

    fields.forEach((field) => {
      const error = validateField(field.name, values[field.name] || "");
      if (error) {
        newErrors[field.name] = error;
        hasErrors = true;
      }
    });

    setErrors(newErrors);
    setTouched(
      fields.reduce((acc, field) => ({ ...acc, [field.name]: true }), {}),
    );

    if (!hasErrors) {
      onSubmit(values);
    }
  };

  const renderField = (field: FormFieldProps) => {
    const value = values[field.name] || "";
    const error = errors[field.name];
    const showError = touched[field.name] && error;

    const commonProps = {
      value,
      onChange: (
        e: React.ChangeEvent<
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >,
      ) => handleChange(field.name, e.target.value),
      onBlur: () => handleBlur(field.name),
      placeholder: field.placeholder,
      disabled: field.disabled || loading,
      required: field.required,
    };

    let input: React.ReactNode;

    switch (field.type) {
      case "textarea":
        input = (
          <textarea {...commonProps} css={getFormInputStyles(!!showError)} />
        );
        break;

      case "select":
        input = (
          <select {...commonProps} css={getFormInputStyles(!!showError)}>
            <option value="">
              {field.placeholder || `Select ${field.label}`}
            </option>
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
            type={field.type || "text"}
            css={getFormInputStyles(!!showError)}
          />
        );
    }

    return (
      <div key={field.name} css={getFormFieldGroupStyles(layout)}>
        <label css={getFormLabelStyles(layout)}>
          {field.label}
          {field.required && (
            <span
              css={css`
                color: #ef4444;
                margin-left: 2px;
              `}
            >
              *
            </span>
          )}
        </label>
        <div
          css={css`
            flex: ${layout === "horizontal" ? 1 : "auto"};
          `}
        >
          {input}
          {showError && <div css={formErrorStyles}>{error}</div>}
          {field.description && !showError && (
            <div css={formDescriptionStyles}>{field.description}</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} css={formStyles}>
      {fields.map(renderField)}

      <div css={formSubmitContainerStyles}>
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
  const commonProps = {
    value,
    onChange: (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => onChange(e.target.value),
    onBlur,
    placeholder: field.placeholder,
    disabled: field.disabled,
    required: field.required,
    css: getFormInputStyles(!!error),
  };

  return (
    <div>
      <label css={getFormLabelStyles("vertical")}>
        {field.label}
        {field.required && (
          <span
            css={css`
              color: #ef4444;
              margin-left: 2px;
            `}
          >
            *
          </span>
        )}
      </label>

      {field.type === "textarea" ? (
        <textarea {...commonProps} />
      ) : field.type === "select" ? (
        <select {...commonProps}>
          <option value="">
            {field.placeholder || `Select ${field.label}`}
          </option>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input {...commonProps} type={field.type || "text"} />
      )}

      {error && <div css={formErrorStyles}>{error}</div>}
      {field.description && !error && (
        <div css={formDescriptionStyles}>{field.description}</div>
      )}
    </div>
  );
};

export default Form;
