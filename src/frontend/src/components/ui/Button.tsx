import React from "react";
import { css } from "@emotion/react";
import {
  getButtonStyles,
  type ButtonVariant,
  type ButtonSize,
} from "../../styles/design-system";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  children,
  disabled,
  className = "",
  ...props
}) => {
  const buttonCss = css`
    ${getButtonStyles(variant, size)}
    ${fullWidth && "width: 100%;"}
    ${isLoading && "pointer-events: none;"}
  `;

  const LoadingSpinner = () => (
    <div
      css={css`
        width: 16px;
        height: 16px;
        border: 2px solid transparent;
        border-top: 2px solid currentColor;
        border-radius: 50%;
        animation: spin 1s linear infinite;

        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}
    />
  );

  return (
    <button
      css={buttonCss}
      className={`cognivern-button ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <LoadingSpinner />
          Loading...
        </>
      ) : (
        <>
          {leftIcon && <span className="button-icon-left">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="button-icon-right">{rightIcon}</span>}
        </>
      )}
    </button>
  );
};

// Button component is now using the modern design system with built-in animations
