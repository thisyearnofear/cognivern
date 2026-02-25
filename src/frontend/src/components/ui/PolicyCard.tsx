import React from "react";
import { css } from "@emotion/react";
import { Card, CardContent } from "./Card";
import { Badge } from "./Badge";
import { designTokens } from "../../styles/design-system";
import { GovernancePolicy } from "../../stores/governanceStore";

export interface PolicyCardProps {
  policy: GovernancePolicy;
  onClick?: (policy: GovernancePolicy) => void;
  interactive?: boolean;
}

/**
 * PolicyCard - A high-density component for displaying Governance Policies.
 *
 * CORE PRINCIPLES:
 * - ENHANCEMENT FIRST: Standardizes policy display across dashboard and management views.
 * - MODULAR: Independent component that consumes the GovernancePolicy interface.
 * - CLEAN: Explicit separation of header, summary metrics, and status.
 */

const cardWrapperStyles = (interactive: boolean) => css`
  height: 100%;
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
  ${interactive && "cursor: pointer;"}

  &:hover {
    ${interactive && `
      transform: translateY(-2px);
      box-shadow: ${designTokens.shadows.md};
    `}
  }
`;

const headerStyles = css`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: ${designTokens.spacing[3]};
`;

const nameStyles = css`
  font-size: ${designTokens.typography.fontSize.base};
  font-weight: ${designTokens.typography.fontWeight.semibold};
  color: ${designTokens.colors.neutral[900]};
  margin: 0;
`;

const descriptionStyles = css`
  font-size: ${designTokens.typography.fontSize.sm};
  color: ${designTokens.colors.neutral[600]};
  margin: ${designTokens.spacing[2]} 0 ${designTokens.spacing[4]};
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const ruleSummaryStyles = css`
  display: flex;
  gap: ${designTokens.spacing[4]};
  padding-top: ${designTokens.spacing[3]};
  border-top: 1px solid ${designTokens.colors.neutral[100]};
`;

const statStyles = css`
  display: flex;
  flex-direction: column;
`;

const statLabelStyles = css`
  font-size: ${designTokens.typography.fontSize.xs};
  color: ${designTokens.colors.neutral[500]};
  text-transform: uppercase;
  letter-spacing: 0.025em;
`;

const statValueStyles = css`
  font-size: ${designTokens.typography.fontSize.sm};
  font-weight: ${designTokens.typography.fontWeight.bold};
  color: ${designTokens.colors.neutral[800]};
`;

export const PolicyCard: React.FC<PolicyCardProps> = ({
  policy,
  onClick,
  interactive = true,
}) => {
  const activeRules = policy.rules.filter((r) => r.enabled).length;
  const highStrictnessCount = policy.rules.filter((r) => r.enabled && r.strictness === "high").length;

  return (
    <Card
      css={cardWrapperStyles(interactive)}
      onClick={() => interactive && onClick?.(policy)}
      interactive={interactive}
    >
      <CardContent>
        <div css={headerStyles}>
          <h3 css={nameStyles}>{policy.name}</h3>
          <Badge variant={policy.status === "active" ? "success" : "secondary"}>
            {policy.status}
          </Badge>
        </div>

        <p css={descriptionStyles}>{policy.description}</p>

        <div css={ruleSummaryStyles}>
          <div css={statStyles}>
            <span css={statLabelStyles}>Rules</span>
            <span css={statValueStyles}>{activeRules} / {policy.rules.length}</span>
          </div>
          <div css={statStyles}>
            <span css={statLabelStyles}>Strictness</span>
            <span css={statValueStyles}>
              {highStrictnessCount > 0 ? "High" : "Standard"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PolicyCard;
