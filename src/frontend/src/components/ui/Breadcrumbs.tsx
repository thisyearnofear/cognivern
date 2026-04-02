/**
 * Breadcrumbs Component - Path Navigation
 *
 * Provides clear wayfinding across deep application paths.
 * Follows CLEAN + MODULAR principles.
 */

import React from "react";
import { css } from "@emotion/react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { designTokens, easings } from "../../styles/design-system";

interface BreadcrumbItem {
  label: string;
  path: string;
  isLast: boolean;
}

export const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const pathnames = location.pathname.split("/").filter((x) => x);

  // Don't show on root dashboard
  if (pathnames.length === 0) return null;

  const breadcrumbs: BreadcrumbItem[] = pathnames.map((name, index) => {
    const path = `/${pathnames.slice(0, index + 1).join("/")}`;
    const isLast = index === pathnames.length - 1;

    // Humanize labels
    let label = name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, " ");
    if (name.length > 20) label = label.slice(0, 17) + "..."; // Truncate IDs

    return { label, path, isLast };
  });

  return (
    <nav aria-label="Breadcrumb" css={navStyles}>
      <ol css={listStyles}>
        <li css={itemStyles}>
          <Link to="/" css={linkStyles} title="Home">
            <Home size={14} />
          </Link>
          <ChevronRight size={14} css={separatorStyles} />
        </li>

        {breadcrumbs.map((breadcrumb, index) => (
          <li key={breadcrumb.path} css={itemStyles}>
            {breadcrumb.isLast ? (
              <span css={currentStyles} aria-current="page">
                {breadcrumb.label}
              </span>
            ) : (
              <>
                <Link to={breadcrumb.path} css={linkStyles}>
                  {breadcrumb.label}
                </Link>
                <ChevronRight size={14} css={separatorStyles} />
              </>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

const navStyles = css`
  padding: ${designTokens.spacing[3]} 0;
  margin-bottom: ${designTokens.spacing[4]};
`;

const listStyles = css`
  display: flex;
  align-items: center;
  list-style: none;
  padding: 0;
  margin: 0;
  flex-wrap: wrap;
`;

const itemStyles = css`
  display: flex;
  align-items: center;
`;

const linkStyles = css`
  display: flex;
  align-items: center;
  color: ${designTokens.colors.neutral[500]};
  text-decoration: none;
  font-size: ${designTokens.typography.fontSize.sm};
  font-weight: ${designTokens.typography.fontWeight.medium};
  transition: ${easings.smooth};

  &:hover {
    color: ${designTokens.colors.primary[500]};
  }
`;

const separatorStyles = css`
  margin: 0 ${designTokens.spacing[2]};
  color: ${designTokens.colors.neutral[300]};
  flex-shrink: 0;
`;

const currentStyles = css`
  font-size: ${designTokens.typography.fontSize.sm};
  font-weight: ${designTokens.typography.fontWeight.semibold};
  color: ${designTokens.colors.text.primary};
`;

export default Breadcrumbs;
