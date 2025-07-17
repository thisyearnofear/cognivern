import { css } from '@emotion/react';
import { designTokens } from '../../designTokens';
import { colorSystem } from '../tokens/colors';
import { shadowSystem } from '../tokens/shadows';
import { easings } from '../animations/keyframes';

// Button component variants
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

export const buttonStyles = {
  base: css`
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: ${designTokens.spacing[2]};
    font-family: ${designTokens.typography.fontFamily.sans};
    font-weight: ${designTokens.typography.fontWeight.medium};
    border-radius: ${designTokens.borderRadius.md};
    border: none;
    cursor: pointer;
    transition: ${easings.smooth};
    overflow: hidden;
    text-decoration: none;
    
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none !important;
    }
    
    &:focus {
      outline: 2px solid ${designTokens.colors.primary[500]};
      outline-offset: 2px;
    }
    
    &:focus:not(:focus-visible) {
      outline: none;
    }
    
    // Shimmer effect
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
      transition: left 0.5s;
    }
    
    &:hover::before {
      left: 100%;
    }
    
    &:hover {
      transform: translateY(-2px);
    }
    
    &:active {
      transform: translateY(0);
    }
  `,
  
  sizes: {
    sm: css`
      padding: ${designTokens.spacing[2]} ${designTokens.spacing[3]};
      font-size: ${designTokens.typography.fontSize.sm};
      min-height: 32px;
    `,
    
    md: css`
      padding: ${designTokens.spacing[3]} ${designTokens.spacing[4]};
      font-size: ${designTokens.typography.fontSize.base};
      min-height: 40px;
    `,
    
    lg: css`
      padding: ${designTokens.spacing[4]} ${designTokens.spacing[6]};
      font-size: ${designTokens.typography.fontSize.lg};
      min-height: 48px;
    `,
  },
  
  variants: {
    primary: css`
      background: ${colorSystem.gradients.primary};
      color: ${designTokens.colors.neutral[0]};
      box-shadow: ${shadowSystem.glow.primary};
      
      &:hover {
        filter: brightness(1.1);
        box-shadow: ${shadowSystem.glow.primary}, ${designTokens.shadows.lg};
      }
    `,
    
    secondary: css`
      background: ${designTokens.colors.neutral[100]};
      color: ${designTokens.colors.neutral[700]};
      border: 1px solid ${designTokens.colors.neutral[300]};
      
      &:hover {
        background: ${designTokens.colors.neutral[200]};
        border-color: ${designTokens.colors.neutral[400]};
        box-shadow: ${designTokens.shadows.md};
      }
    `,
    
    ghost: css`
      background: transparent;
      color: ${designTokens.colors.primary[600]};
      border: 1px solid transparent;
      
      &:hover {
        background: ${designTokens.colors.primary[50]};
        border-color: ${designTokens.colors.primary[200]};
      }
    `,
    
    danger: css`
      background: ${colorSystem.gradients.danger};
      color: ${designTokens.colors.neutral[0]};
      box-shadow: ${shadowSystem.glow.error};
      
      &:hover {
        filter: brightness(1.1);
        box-shadow: ${shadowSystem.glow.error}, ${designTokens.shadows.lg};
      }
    `,
    
    success: css`
      background: ${colorSystem.gradients.success};
      color: ${designTokens.colors.neutral[0]};
      box-shadow: ${shadowSystem.glow.success};
      
      &:hover {
        filter: brightness(1.1);
        box-shadow: ${shadowSystem.glow.success}, ${designTokens.shadows.lg};
      }
    `,
  },
} as const;

// Button utility function
export const getButtonStyles = (
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md'
) => css`
  ${buttonStyles.base}
  ${buttonStyles.sizes[size]}
  ${buttonStyles.variants[variant]}
`;