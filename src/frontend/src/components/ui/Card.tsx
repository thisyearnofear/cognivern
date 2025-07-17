import React from 'react';
import { designTokens } from '../../styles/designTokens';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outlined' | 'elevated' | 'filled';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  radius?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  shadow?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

const cardVariants = {
  default: {
    backgroundColor: designTokens.colors.neutral[0],
    border: `1px solid ${designTokens.colors.neutral[200]}`,
  },
  outlined: {
    backgroundColor: 'transparent',
    border: `1px solid ${designTokens.colors.neutral[300]}`,
  },
  elevated: {
    backgroundColor: designTokens.colors.neutral[0],
    border: 'none',
    boxShadow: designTokens.shadows.lg,
  },
  filled: {
    backgroundColor: designTokens.colors.neutral[50],
    border: 'none',
  },
};

const cardPadding = {
  none: '0',
  sm: designTokens.spacing[3],
  md: designTokens.spacing[4],
  lg: designTokens.spacing[6],
};

const cardRadius = {
  none: '0',
  sm: designTokens.borderRadius.sm,
  md: designTokens.borderRadius.md,
  lg: designTokens.borderRadius.lg,
  xl: designTokens.borderRadius.xl,
};

const cardShadow = {
  none: 'none',
  sm: designTokens.shadows.sm,
  md: designTokens.shadows.md,
  lg: designTokens.shadows.lg,
};

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  padding = 'md',
  radius = 'md',
  shadow = 'sm',
  interactive = false,
  children,
  className = '',
  style,
  ...props
}) => {
  const variantStyles = cardVariants[variant];

  const cardStyle: React.CSSProperties = {
    ...variantStyles,
    padding: cardPadding[padding],
    borderRadius: cardRadius[radius],
    boxShadow: variant === 'elevated' ? designTokens.shadows.lg : cardShadow[shadow],
    transition: interactive ? `all ${designTokens.animation.duration.normal} ${designTokens.animation.easing.easeInOut}` : 'none',
    cursor: interactive ? 'pointer' : 'default',
    position: 'relative',
    overflow: 'hidden',
    ...style,
  };

  const interactiveStyles: React.CSSProperties = interactive ? {
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: designTokens.shadows.xl,
    },
  } : {};

  return (
    <div
      className={`cognivern-card ${interactive ? 'interactive' : ''} ${className}`}
      style={cardStyle}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  style,
  ...props
}) => (
  <div
    className={`cognivern-card-header ${className}`}
    style={{
      marginBottom: designTokens.spacing[4],
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  className = '',
  style,
  ...props
}) => (
  <h3
    className={`cognivern-card-title ${className}`}
    style={{
      margin: 0,
      fontSize: designTokens.typography.fontSize.lg,
      fontWeight: designTokens.typography.fontWeight.semibold,
      color: designTokens.colors.neutral[900],
      lineHeight: designTokens.typography.lineHeight.tight,
      ...style,
    }}
    {...props}
  >
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  children,
  className = '',
  style,
  ...props
}) => (
  <p
    className={`cognivern-card-description ${className}`}
    style={{
      margin: `${designTokens.spacing[1]} 0 0 0`,
      fontSize: designTokens.typography.fontSize.sm,
      color: designTokens.colors.neutral[600],
      lineHeight: designTokens.typography.lineHeight.normal,
      ...style,
    }}
    {...props}
  >
    {children}
  </p>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  style,
  ...props
}) => (
  <div
    className={`cognivern-card-content ${className}`}
    style={{
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  style,
  ...props
}) => (
  <div
    className={`cognivern-card-footer ${className}`}
    style={{
      marginTop: designTokens.spacing[4],
      paddingTop: designTokens.spacing[4],
      borderTop: `1px solid ${designTokens.colors.neutral[200]}`,
      display: 'flex',
      alignItems: 'center',
      gap: designTokens.spacing[2],
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
);