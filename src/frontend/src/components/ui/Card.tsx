import React, { useState } from "react";
import { css } from "@emotion/react";
import { ChevronRight } from "lucide-react";
import {
  getCardStyles as getModernCardStyles,
  type CardVariant,
  designTokens,
} from "../../styles/design-system";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: "none" | "sm" | "md" | "lg";
  interactive?: boolean;
  /** Enable collapsible behavior */
  collapsible?: boolean;
  /** Initial collapsed state */
  defaultCollapsed?: boolean;
  /** Title for collapsible header (required if collapsible) */
  title?: string;
  /** Called when collapse state changes */
  onCollapseChange?: (collapsed: boolean) => void;
}

export const Card: React.FC<CardProps> = ({
  variant = "default",
  padding = "md",
  interactive = false,
  collapsible = false,
  defaultCollapsed = false,
  title,
  onCollapseChange,
  children,
  className = "",
  ...props
}) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const paddingStyles = {
    none: "0",
    sm: designTokens.spacing[3],
    md: designTokens.spacing[6],
    lg: designTokens.spacing[8],
  };

  const handleToggle = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    onCollapseChange?.(newState);
  };

  const cardStyles = css`
    ${getModernCardStyles(variant)}
    padding: ${paddingStyles[padding]};
    ${interactive && !collapsible && "cursor: pointer;"}
  `;

  // Collapsible card with header
  if (collapsible) {
    return (
      <div
        css={cardStyles}
        className={`cognivern-card collapsible ${isCollapsed ? "collapsed" : ""} ${className}`}
        {...props}
      >
        <button
          onClick={handleToggle}
          css={collapseHeaderStyles}
          aria-expanded={!isCollapsed}
          aria-label={`Toggle ${title || "section"}`}
        >
          <ChevronRight
            size={16}
            css={chevronStyles(isCollapsed)}
          />
          {title && <span css={collapseTitleStyles}>{title}</span>}
        </button>
        {!isCollapsed && (
          <div css={collapseContentStyles}>{children}</div>
        )}
      </div>
    );
  }

  return (
    <div
      css={cardStyles}
      className={`cognivern-card ${interactive ? "interactive" : ""} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

// Collapsible card styles
const collapseHeaderStyles = css`
  display: flex;
  align-items: center;
  gap: ${designTokens.spacing[2]};
  width: 100%;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  font-size: 14px;
  font-weight: 600;
  color: ${designTokens.colors.text.primary};

  &:focus {
    outline: 2px solid ${designTokens.colors.primary[500]};
    outline-offset: 2px;
    border-radius: ${designTokens.borderRadius.sm};
  }
`;

const chevronStyles = (isCollapsed: boolean) => css`
  transition: transform 0.2s ease;
  transform: rotate(${isCollapsed ? "0deg" : "90deg"});
  color: ${designTokens.colors.text.secondary};
  flex-shrink: 0;
`;

const collapseTitleStyles = css`
  flex: 1;
`;

const collapseContentStyles = css`
  margin-top: ${designTokens.spacing[4]};
`;

const cardHeaderStyles = css`
  padding-bottom: ${designTokens.spacing[4]};
  border-bottom: 1px solid var(--divider, ${designTokens.colors.neutral[200]});
  margin-bottom: ${designTokens.spacing[4]};
`;

const cardTitleStyles = css`
  font-size: ${designTokens.typography.fontSize.lg};
  font-weight: ${designTokens.typography.fontWeight.semibold};
  color: var(--card-text, ${designTokens.colors.neutral[900]});
  margin: 0;
`;

const cardDescriptionStyles = css`
  font-size: ${designTokens.typography.fontSize.sm};
  color: var(--text-secondary, ${designTokens.colors.neutral[600]});
  line-height: ${designTokens.typography.lineHeight.relaxed};
  margin: ${designTokens.spacing[2]} 0 0 0;
`;

const cardContentStyles = css`
  flex: 1;
`;

const cardFooterStyles = css`
  padding-top: ${designTokens.spacing[4]};
  border-top: 1px solid var(--divider, ${designTokens.colors.neutral[200]});
  margin-top: ${designTokens.spacing[4]};
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${designTokens.spacing[3]};
`;

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <div
    css={cardHeaderStyles}
    className={`cognivern-card-header ${className}`}
    {...props}
  >
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <h3
    css={cardTitleStyles}
    className={`cognivern-card-title ${className}`}
    {...props}
  >
    {children}
  </h3>
);

export const CardDescription: React.FC<
  React.HTMLAttributes<HTMLParagraphElement>
> = ({ children, className = "", ...props }) => (
  <p
    css={cardDescriptionStyles}
    className={`cognivern-card-description ${className}`}
    {...props}
  >
    {children}
  </p>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <div
    css={cardContentStyles}
    className={`cognivern-card-content ${className}`}
    {...props}
  >
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <div
    css={cardFooterStyles}
    className={`cognivern-card-footer ${className}`}
    {...props}
  >
    {children}
  </div>
);
