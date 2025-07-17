import React from 'react';
import { css } from '@emotion/react';
import { 
  getCardStyles as getModernCardStyles, 
  type CardVariant,
  designTokens 
} from '../../styles/design-system';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  padding = 'md',
  interactive = false,
  children,
  className = '',
  ...props
}) => {
  const paddingStyles = {
    none: '0',
    sm: designTokens.spacing[3],
    md: designTokens.spacing[6],
    lg: designTokens.spacing[8],
  };

  const cardStyles = css`
    ${getModernCardStyles(variant)}
    padding: ${paddingStyles[padding]};
    ${interactive && 'cursor: pointer;'}
  `;

  return (
    <div
      css={cardStyles}
      className={`cognivern-card ${interactive ? 'interactive' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

const cardHeaderStyles = css`
  padding-bottom: ${designTokens.spacing[4]};
  border-bottom: 1px solid ${designTokens.colors.neutral[200]};
  margin-bottom: ${designTokens.spacing[4]};
`;

const cardTitleStyles = css`
  font-size: ${designTokens.typography.fontSize.lg};
  font-weight: ${designTokens.typography.fontWeight.semibold};
  color: ${designTokens.colors.neutral[900]};
  margin: 0;
`;

const cardDescriptionStyles = css`
  font-size: ${designTokens.typography.fontSize.sm};
  color: ${designTokens.colors.neutral[600]};
  line-height: ${designTokens.typography.lineHeight.relaxed};
  margin: ${designTokens.spacing[2]} 0 0 0;
`;

const cardContentStyles = css`
  flex: 1;
`;

const cardFooterStyles = css`
  padding-top: ${designTokens.spacing[4]};
  border-top: 1px solid ${designTokens.colors.neutral[200]};
  margin-top: ${designTokens.spacing[4]};
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${designTokens.spacing[3]};
`;

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <div css={cardHeaderStyles} className={`cognivern-card-header ${className}`} {...props}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <h3 css={cardTitleStyles} className={`cognivern-card-title ${className}`} {...props}>
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <p css={cardDescriptionStyles} className={`cognivern-card-description ${className}`} {...props}>
    {children}
  </p>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <div css={cardContentStyles} className={`cognivern-card-content ${className}`} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <div css={cardFooterStyles} className={`cognivern-card-footer ${className}`} {...props}>
    {children}
  </div>
);