import React from 'react';
import { designTokens } from '../../styles/designTokens';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  // Animation props (consolidated from AnimatedButton)
  animationType?: 'lift' | 'scale' | 'glow' | 'bounce' | 'pulse' | 'none';
  rippleEffect?: boolean;
}

const buttonVariants = {
  primary: {
    backgroundColor: designTokens.colors.primary[500],
    color: designTokens.colors.neutral[0],
    border: `1px solid ${designTokens.colors.primary[500]}`,
    '&:hover:not(:disabled)': {
      backgroundColor: designTokens.colors.primary[600],
      borderColor: designTokens.colors.primary[600],
    },
    '&:focus': {
      boxShadow: `0 0 0 3px ${designTokens.colors.primary[200]}`,
    },
  },
  secondary: {
    backgroundColor: designTokens.colors.secondary[100],
    color: designTokens.colors.secondary[900],
    border: `1px solid ${designTokens.colors.secondary[200]}`,
    '&:hover:not(:disabled)': {
      backgroundColor: designTokens.colors.secondary[200],
    },
    '&:focus': {
      boxShadow: `0 0 0 3px ${designTokens.colors.secondary[200]}`,
    },
  },
  outline: {
    backgroundColor: 'transparent',
    color: designTokens.colors.primary[600],
    border: `1px solid ${designTokens.colors.primary[300]}`,
    '&:hover:not(:disabled)': {
      backgroundColor: designTokens.colors.primary[50],
      borderColor: designTokens.colors.primary[400],
    },
    '&:focus': {
      boxShadow: `0 0 0 3px ${designTokens.colors.primary[200]}`,
    },
  },
  ghost: {
    backgroundColor: 'transparent',
    color: designTokens.colors.secondary[700],
    border: '1px solid transparent',
    '&:hover:not(:disabled)': {
      backgroundColor: designTokens.colors.secondary[100],
    },
    '&:focus': {
      boxShadow: `0 0 0 3px ${designTokens.colors.secondary[200]}`,
    },
  },
  danger: {
    backgroundColor: designTokens.colors.semantic.error[500],
    color: designTokens.colors.neutral[0],
    border: `1px solid ${designTokens.colors.semantic.error[500]}`,
    '&:hover:not(:disabled)': {
      backgroundColor: designTokens.colors.semantic.error[600],
      borderColor: designTokens.colors.semantic.error[600],
    },
    '&:focus': {
      boxShadow: `0 0 0 3px ${designTokens.colors.semantic.error[200]}`,
    },
  },
};

const buttonSizes = {
  sm: {
    padding: `${designTokens.spacing[2]} ${designTokens.spacing[3]}`,
    fontSize: designTokens.typography.fontSize.sm,
    minHeight: '32px',
  },
  md: {
    padding: `${designTokens.spacing[3]} ${designTokens.spacing[4]}`,
    fontSize: designTokens.typography.fontSize.base,
    minHeight: '40px',
  },
  lg: {
    padding: `${designTokens.spacing[4]} ${designTokens.spacing[6]}`,
    fontSize: designTokens.typography.fontSize.lg,
    minHeight: '48px',
  },
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  children,
  disabled,
  className = '',
  style,
  ...props
}) => {
  const variantStyles = buttonVariants[variant];
  const sizeStyles = buttonSizes[size];

  const buttonStyle: React.CSSProperties = {
    ...variantStyles,
    ...sizeStyles,
    fontFamily: designTokens.typography.fontFamily.sans.join(', '),
    fontWeight: designTokens.typography.fontWeight.medium,
    borderRadius: designTokens.borderRadius.md,
    cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
    opacity: disabled || isLoading ? 0.6 : 1,
    transition: `all ${designTokens.animation.duration.normal} ${designTokens.animation.easing.easeInOut}`,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: designTokens.spacing[2],
    width: fullWidth ? '100%' : 'auto',
    outline: 'none',
    position: 'relative',
    ...style,
  };

  return (
    <button
      className={`cognivern-button ${className}`}
      style={buttonStyle}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <div
          style={{
            width: '16px',
            height: '16px',
            border: '2px solid currentColor',
            borderTop: '2px solid transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
      )}
      {!isLoading && leftIcon && <span>{leftIcon}</span>}
      {children}
      {!isLoading && rightIcon && <span>{rightIcon}</span>}
    </button>
  );
};

// Add keyframes for loading spinner
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);