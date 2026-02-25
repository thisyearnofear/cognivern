import React from "react";
import { css } from "@emotion/react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "./Card";
import { Badge } from "./Badge";
import { designTokens } from "../../styles/design-system";

export interface AgentCardProps {
  agent: {
    id: string;
    name: string;
    status: "active" | "inactive" | "paused" | "error" | string;
    winRate: number;
    totalReturn: number;
    description?: string;
  };
  compact?: boolean;
  interactive?: boolean;
}

/**
 * AgentCard - A centralized component for displaying AI Agent information.
 * Used in the Unified Dashboard, Agent Marketplace, and Management views.
 *
 * CORE PRINCIPLES:
 * - ENHANCEMENT FIRST: Consolidates various agent card designs into a single robust component.
 * - MODULAR: Independent of the specific layout it's placed in.
 * - PERFORMANT: Uses lean CSS-in-JS and design tokens for optimal rendering.
 */

const cardWrapperStyles = (compact: boolean) => css`
  ${compact ? "width: 280px; flex-shrink: 0;" : "width: 100%;"}
  display: flex;
  flex-direction: column;
  height: 100%;
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;

  &:hover {
    transform: translateY(-2px);
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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const descriptionStyles = css`
  font-size: ${designTokens.typography.fontSize.sm};
  color: ${designTokens.colors.neutral[600]};
  margin: ${designTokens.spacing[2]} 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const metricsContainerStyles = css`
  display: flex;
  justify-content: space-between;
  margin-top: auto;
  padding-top: ${designTokens.spacing[4]};
  border-top: 1px solid ${designTokens.colors.neutral[100]};
  gap: ${designTokens.spacing[3]};
`;

const metricBlockStyles = css`
  display: flex;
  flex-direction: column;
`;

const metricLabelStyles = css`
  font-size: ${designTokens.typography.fontSize.xs};
  color: ${designTokens.colors.neutral[500]};
  font-weight: ${designTokens.typography.fontWeight.medium};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const metricValueStyles = (isPositive: boolean) => css`
  font-size: ${designTokens.typography.fontSize.sm};
  font-weight: ${designTokens.typography.fontWeight.bold};
  color: ${isPositive
    ? designTokens.colors.semantic.success[600]
    : designTokens.colors.semantic.error[600]};
  margin-top: 2px;
`;

export const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  compact = false,
  interactive = true,
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (interactive) {
      navigate(`/agents/${agent.id}`);
    }
  };

  return (
    <Card
      css={cardWrapperStyles(compact)}
      interactive={interactive}
      onClick={handleClick}
      padding="md"
    >
      <CardContent
        css={css`
          display: flex;
          flex-direction: column;
          height: 100%;
        `}
      >
        <div css={headerStyles}>
          <h3 css={nameStyles} title={agent.name}>
            {agent.name}
          </h3>
          <Badge variant={agent.status === "active" ? "success" : "secondary"}>
            {agent.status}
          </Badge>
        </div>

        {!compact && agent.description && (
          <p css={descriptionStyles}>{agent.description}</p>
        )}

        <div css={metricsContainerStyles}>
          <div css={metricBlockStyles}>
            <span css={metricLabelStyles}>Win Rate</span>
            <span css={metricValueStyles(agent.winRate >= 0.5)}>
              {(agent.winRate * 100).toFixed(1)}%
            </span>
          </div>
          <div css={metricBlockStyles}>
            <span css={metricLabelStyles}>Total Return</span>
            <span css={metricValueStyles(agent.totalReturn >= 0)}>
              {agent.totalReturn >= 0 ? "+" : ""}
              {(agent.totalReturn * 100).toFixed(2)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AgentCard;
