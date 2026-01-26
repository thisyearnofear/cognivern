import React from "react";
import { css } from "@emotion/react";
import { designTokens } from "../../styles/designTokens";
import { useLayout, Container } from "./ResponsiveLayout";
import { useTheme } from "../../stores/appStore";

export interface ContentWrapperProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  maxWidth?: string;
  padding?: boolean;
  background?: boolean;
  className?: string;
}

export const ContentWrapper: React.FC<ContentWrapperProps> = ({
  children,
  title,
  subtitle,
  actions,
  breadcrumbs,
  maxWidth,
  padding = true,
  background = true,
  className = "",
}) => {
  const { isCompactMode } = useLayout();
  const { effectiveTheme } = useTheme();

  const wrapperStyles = css`
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    ${background
      ? `
      background: ${effectiveTheme === "dark" ? "transparent" : "transparent"};
    `
      : ""}

    /* Ensure full viewport utilization */
    flex: 1;
    min-height: 0;
    overflow: hidden;
  `;

  const headerStyles = css`
    ${background
      ? `
      background: ${
        effectiveTheme === "dark"
          ? `linear-gradient(135deg, ${designTokens.colors.neutral[900]} 0%, ${designTokens.colors.neutral[800]} 100%)`
          : `linear-gradient(135deg, ${designTokens.colors.neutral[0]} 0%, ${designTokens.colors.neutral[50]} 100%)`
      };
      border-bottom: 1px solid ${
        effectiveTheme === "dark"
          ? designTokens.colors.neutral[700]
          : designTokens.colors.neutral[200]
      };
      box-shadow: ${designTokens.shadows.sm};
    `
      : ""}

    ${padding
      ? `
      padding: ${isCompactMode ? designTokens.spacing[4] : designTokens.spacing[6]} 0;
    `
      : ""}
    
    margin-bottom: ${isCompactMode
      ? designTokens.spacing[4]
      : designTokens.spacing[6]};
  `;

  const headerContentStyles = css`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: ${designTokens.spacing[4]};

    @media (max-width: ${designTokens.breakpoints.md}) {
      flex-direction: column;
      align-items: stretch;
      gap: ${designTokens.spacing[3]};
    }
  `;

  const titleSectionStyles = css`
    flex: 1;
    min-width: 0;
  `;

  const titleStyles = css`
    margin: 0 0 ${subtitle ? designTokens.spacing[1] : "0"};
    font-size: ${isCompactMode
      ? designTokens.typography.fontSize["2xl"]
      : designTokens.typography.fontSize["3xl"]};
    font-weight: ${designTokens.typography.fontWeight.bold};
    line-height: ${designTokens.typography.lineHeight.tight};
    color: ${effectiveTheme === "dark"
      ? designTokens.colors.neutral[100]
      : designTokens.colors.neutral[900]};

    @media (max-width: ${designTokens.breakpoints.sm}) {
      font-size: ${designTokens.typography.fontSize.xl};
    }
  `;

  const subtitleStyles = css`
    margin: 0;
    font-size: ${designTokens.typography.fontSize.lg};
    font-weight: ${designTokens.typography.fontWeight.normal};
    line-height: ${designTokens.typography.lineHeight.relaxed};
    color: ${effectiveTheme === "dark"
      ? designTokens.colors.neutral[400]
      : designTokens.colors.neutral[600]};

    @media (max-width: ${designTokens.breakpoints.sm}) {
      font-size: ${designTokens.typography.fontSize.base};
    }
  `;

  const actionsStyles = css`
    display: flex;
    align-items: center;
    gap: ${designTokens.spacing[3]};
    flex-shrink: 0;

    @media (max-width: ${designTokens.breakpoints.md}) {
      justify-content: flex-end;
    }

    @media (max-width: ${designTokens.breakpoints.sm}) {
      flex-wrap: wrap;
      justify-content: stretch;

      & > * {
        flex: 1;
        min-width: 120px;
      }
    }
  `;

  const breadcrumbsStyles = css`
    margin-bottom: ${designTokens.spacing[4]};

    @media (max-width: ${designTokens.breakpoints.sm}) {
      margin-bottom: ${designTokens.spacing[3]};
    }
  `;

  const contentStyles = css`
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;

    ${padding
      ? `
      padding-bottom: ${isCompactMode ? designTokens.spacing[6] : designTokens.spacing[8]};
    `
      : ""}

    /* Ensure content can expand to fill available space */
    display: flex;
    flex-direction: column;

    /* Better scrolling behavior */
    scroll-behavior: smooth;

    /* Custom scrollbar for content area */
    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background: ${effectiveTheme === "dark"
        ? designTokens.colors.neutral[600]
        : designTokens.colors.neutral[400]};
      border-radius: ${designTokens.borderRadius.full};
    }

    &::-webkit-scrollbar-thumb:hover {
      background: ${effectiveTheme === "dark"
        ? designTokens.colors.neutral[500]
        : designTokens.colors.neutral[500]};
    }
  `;

  return (
    <div css={wrapperStyles} className={className}>
      {(title || subtitle || actions || breadcrumbs) && (
        <div css={headerStyles}>
          <Container maxWidth={maxWidth}>
            {breadcrumbs && <div css={breadcrumbsStyles}>{breadcrumbs}</div>}

            <div css={headerContentStyles}>
              {(title || subtitle) && (
                <div css={titleSectionStyles}>
                  {title && <h1 css={titleStyles}>{title}</h1>}
                  {subtitle && <p css={subtitleStyles}>{subtitle}</p>}
                </div>
              )}

              {actions && <div css={actionsStyles}>{actions}</div>}
            </div>
          </Container>
        </div>
      )}

      <div css={contentStyles}>
        <Container maxWidth={maxWidth}>{children}</Container>
      </div>
    </div>
  );
};

// Specialized content wrappers for common layouts
export const DashboardWrapper: React.FC<
  Omit<ContentWrapperProps, "background">
> = (props) => <ContentWrapper {...props} background={false} />;

export const PageWrapper: React.FC<ContentWrapperProps> = (props) => (
  <ContentWrapper {...props} background={true} />
);

export const ModalContentWrapper: React.FC<
  Omit<ContentWrapperProps, "maxWidth" | "background">
> = (props) => <ContentWrapper {...props} maxWidth="100%" background={false} />;

export default ContentWrapper;
