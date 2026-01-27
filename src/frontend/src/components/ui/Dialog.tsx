import React, { useState } from "react";
import { css } from "@emotion/react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { designTokens } from "../../styles/design-system";

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  variant?: "info" | "warning" | "success" | "error";
  children?: React.ReactNode;
  primaryAction?: {
    label: string;
    onClick: () => void;
    variant?: "primary" | "danger" | "success";
    isLoading?: boolean;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  showCancel?: boolean;
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  variant = "info",
  children,
  primaryAction,
  secondaryAction,
  showCancel = true,
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case "success":
        return css`
          border-top: 4px solid ${designTokens.colors.semantic.success[500]};
        `;
      case "warning":
        return css`
          border-top: 4px solid ${designTokens.colors.semantic.warning[500]};
        `;
      case "error":
        return css`
          border-top: 4px solid ${designTokens.colors.semantic.error[500]};
        `;
      default:
        return css`
          border-top: 4px solid ${designTokens.colors.primary[500]};
        `;
    }
  };

  const footer = (
    <div
      css={css`
        display: flex;
        gap: ${designTokens.spacing[3]};
        justify-content: flex-end;
      `}
    >
      {showCancel && (
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      )}
      {secondaryAction && (
        <Button variant="secondary" onClick={secondaryAction.onClick}>
          {secondaryAction.label}
        </Button>
      )}
      {primaryAction && (
        <Button
          variant={primaryAction.variant || "primary"}
          onClick={primaryAction.onClick}
          isLoading={primaryAction.isLoading}
        >
          {primaryAction.label}
        </Button>
      )}
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} footer={footer}>
      <div
        css={css`
          ${getVariantStyles()}
        `}
      >
        {description && (
          <p
            css={css`
              color: ${designTokens.colors.neutral[700]};
              font-size: ${designTokens.typography.fontSize.base};
              line-height: 1.6;
              margin-bottom: ${children ? designTokens.spacing[4] : 0};
            `}
          >
            {description}
          </p>
        )}
        {children}
      </div>
    </Modal>
  );
};

// Confirmation Dialog
export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "warning" | "error" | "info";
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "info",
  isLoading = false,
}) => {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={message}
      variant={variant}
      primaryAction={{
        label: confirmText,
        onClick: onConfirm,
        variant: variant === "error" ? "danger" : "primary",
        isLoading,
      }}
      secondaryAction={{
        label: cancelText,
        onClick: onClose,
      }}
      showCancel={false}
    />
  );
};

// Prompt Dialog (Input Dialog)
export interface PromptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  inputType?: "text" | "number" | "email" | "password";
  submitText?: string;
  cancelText?: string;
  validation?: (value: string) => string | null;
  isLoading?: boolean;
}

export const PromptDialog: React.FC<PromptDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  title,
  message,
  placeholder,
  defaultValue = "",
  inputType = "text",
  submitText = "Submit",
  cancelText = "Cancel",
  validation,
  isLoading = false,
}) => {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (validation) {
      const validationError = validation(value);
      if (validationError) {
        setError(validationError);
        return;
      }
    }
    onSubmit(value);
  };

  const handleClose = () => {
    setValue(defaultValue);
    setError(null);
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      description={message}
      primaryAction={{
        label: submitText,
        onClick: handleSubmit,
        isLoading,
      }}
      secondaryAction={{
        label: cancelText,
        onClick: handleClose,
      }}
      showCancel={false}
    >
      <div>
        <input
          type={inputType}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder={placeholder}
          autoFocus
          css={css`
            width: 100%;
            padding: ${designTokens.spacing[3]};
            border: 1px solid
              ${error ? designTokens.colors.semantic.error[500] : designTokens.colors.neutral[300]};
            border-radius: ${designTokens.borderRadius.md};
            font-size: ${designTokens.typography.fontSize.base};
            transition: border-color 0.2s ease;

            &:focus {
              outline: none;
              border-color: ${error ? designTokens.colors.semantic.error[500] : designTokens.colors.primary[500]};
              box-shadow: 0 0 0 3px
                ${error ? designTokens.colors.semantic.error[100] : designTokens.colors.primary[100]};
            }

            &::placeholder {
              color: ${designTokens.colors.neutral[400]};
            }
          `}
        />
        {error && (
          <p
            css={css`
              color: ${designTokens.colors.semantic.error[600]};
              font-size: ${designTokens.typography.fontSize.sm};
              margin-top: ${designTokens.spacing[2]};
            `}
          >
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
};

// Multi-field Dialog (for complex inputs like forecast submission)
export interface MultiFieldDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: Record<string, string>) => void;
  title: string;
  message?: string;
  fields: {
    name: string;
    label: string;
    type?: "text" | "number" | "textarea" | "email";
    placeholder?: string;
    defaultValue?: string;
    required?: boolean;
    validation?: (value: string) => string | null;
  }[];
  submitText?: string;
  cancelText?: string;
  isLoading?: boolean;
}

export const MultiFieldDialog: React.FC<MultiFieldDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  title,
  message,
  fields,
  submitText = "Submit",
  cancelText = "Cancel",
  isLoading = false,
}) => {
  const [values, setValues] = useState<Record<string, string>>(
    fields.reduce((acc, field) => ({ ...acc, [field.name]: field.defaultValue || "" }), {}),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {};

    fields.forEach((field) => {
      const value = values[field.name] || "";

      if (field.required && !value.trim()) {
        newErrors[field.name] = `${field.label} is required`;
        return;
      }

      if (field.validation) {
        const validationError = field.validation(value);
        if (validationError) {
          newErrors[field.name] = validationError;
        }
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(values);
  };

  const handleClose = () => {
    setValues(
      fields.reduce((acc, field) => ({ ...acc, [field.name]: field.defaultValue || "" }), {}),
    );
    setErrors({});
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      description={message}
      primaryAction={{
        label: submitText,
        onClick: handleSubmit,
        isLoading,
      }}
      secondaryAction={{
        label: cancelText,
        onClick: handleClose,
      }}
      showCancel={false}
    >
      <div
        css={css`
          display: flex;
          flex-direction: column;
          gap: ${designTokens.spacing[4]};
        `}
      >
        {fields.map((field) => {
          const error = errors[field.name];
          const InputComponent = field.type === "textarea" ? "textarea" : "input";

          return (
            <div key={field.name}>
              <label
                css={css`
                  display: block;
                  font-size: ${designTokens.typography.fontSize.sm};
                  font-weight: ${designTokens.typography.fontWeight.medium};
                  color: ${designTokens.colors.neutral[700]};
                  margin-bottom: ${designTokens.spacing[2]};
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
              <InputComponent
                type={field.type || "text"}
                value={values[field.name] || ""}
                onChange={(e) => {
                  setValues({ ...values, [field.name]: e.target.value });
                  setErrors({ ...errors, [field.name]: "" });
                }}
                placeholder={field.placeholder}
                css={css`
                  width: 100%;
                  padding: ${designTokens.spacing[3]};
                  border: 1px solid
                    ${error ? designTokens.colors.semantic.error[500] : designTokens.colors.neutral[300]};
                  border-radius: ${designTokens.borderRadius.md};
                  font-size: ${designTokens.typography.fontSize.base};
                  transition: border-color 0.2s ease;
                  ${field.type === "textarea" ? "min-height: 100px; resize: vertical;" : ""}

                  &:focus {
                    outline: none;
                    border-color: ${error ? designTokens.colors.semantic.error[500] : designTokens.colors.primary[500]};
                    box-shadow: 0 0 0 3px
                      ${error ? designTokens.colors.semantic.error[100] : designTokens.colors.primary[100]};
                  }

                  &::placeholder {
                    color: ${designTokens.colors.neutral[400]};
                  }
                `}
              />
              {error && (
                <p
                  css={css`
                    color: ${designTokens.colors.semantic.error[600]};
                    font-size: ${designTokens.typography.fontSize.sm};
                    margin-top: ${designTokens.spacing[2]};
                  `}
                >
                  {error}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Dialog>
  );
};

export default Dialog;
