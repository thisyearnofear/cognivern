import React from "react";
import styled from "@emotion/styled";
import { keyframes } from "@emotion/react";
import { designTokens } from "../../styles/design-system";

/**
 * GovernanceScore - A high-end visual safety tracker.
 * Delivers the "wow factor" through smooth transitions and ambient glows.
 * Aligned with the next-generation agentic experience.
 *
 * CORE PRINCIPLES:
 * - MODULAR: Self-contained visual metric component.
 * - PERFORMANT: Uses optimized SVG and CSS transitions.
 * - WOW FACTOR: Incorporates ambient glows and smooth progress tracking.
 */

export interface GovernanceScoreProps {
  score: number;
  label?: string;
  details?: { label: string; value: string | number }[];
}

const pulseGlow = keyframes`
  0% { transform: scale(1); opacity: 0.1; }
  50% { transform: scale(1.15); opacity: 0.2; }
  100% { transform: scale(1); opacity: 0.1; }
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: ${designTokens.spacing[8]};
  background: ${designTokens.colors.neutral[0]};
  border-radius: ${designTokens.borderRadius["2xl"]};
  box-shadow: ${designTokens.shadows.xl};
  border: 1px solid ${designTokens.colors.neutral[200]};
  position: relative;
  overflow: hidden;
  width: 100%;
  transition: all 0.3s ease;

  &:hover {
    box-shadow: ${designTokens.shadows["2xl"]};
    transform: translateY(-2px);
  }
`;

const VisualWrapper = styled.div`
  position: relative;
  width: 180px;
  height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
`;

const AmbientEffect = styled.div<{ color: string }>`
  position: absolute;
  width: 100%;
  height: 100%;
  background: ${({ color }) => color};
  filter: blur(45px);
  border-radius: 50%;
  z-index: -1;
  animation: ${pulseGlow} 4s ease-in-out infinite;
`;

const ScoreDisplay = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 2;

  .value {
    font-size: ${designTokens.typography.fontSize["5xl"]};
    font-weight: ${designTokens.typography.fontWeight.bold};
    color: ${designTokens.colors.neutral[900]};
    letter-spacing: -0.04em;
    line-height: 1;
  }

  .label {
    font-size: ${designTokens.typography.fontSize.xs};
    font-weight: ${designTokens.typography.fontWeight.bold};
    color: ${designTokens.colors.neutral[400]};
    text-transform: uppercase;
    letter-spacing: 0.15em;
    margin-top: ${designTokens.spacing[2]};
  }
`;

const StyledSVG = styled.svg`
  position: absolute;
  top: 0;
  left: 0;
  transform: rotate(-90deg);
  z-index: 1;
`;

const DetailsGrid = styled.div`
  width: 100%;
  margin-top: ${designTokens.spacing[8]};
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${designTokens.spacing[6]};
  padding-top: ${designTokens.spacing[6]};
  border-top: 1px solid ${designTokens.colors.neutral[100]};
`;

const MetricBox = styled.div`
  .m-label {
    display: block;
    font-size: ${designTokens.typography.fontSize.xs};
    color: ${designTokens.colors.neutral[500]};
    font-weight: ${designTokens.typography.fontWeight.medium};
    margin-bottom: ${designTokens.spacing[1]};
  }
  .m-value {
    font-size: ${designTokens.typography.fontSize.base};
    font-weight: ${designTokens.typography.fontWeight.bold};
    color: ${designTokens.colors.neutral[800]};
  }
`;

export const GovernanceScore: React.FC<GovernanceScoreProps> = ({
  score,
  label = "System Health",
  details = [],
}) => {
  const normalizedScore = Math.max(0, Math.min(100, score));
  const size = 180;
  const strokeWidth = 12;
  const center = size / 2;
  const radius = center - strokeWidth;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (normalizedScore / 100) * circumference;

  const color =
    normalizedScore >= 80
      ? designTokens.colors.semantic.success
      : normalizedScore >= 60
        ? designTokens.colors.semantic.warning
        : designTokens.colors.semantic.error;

  return (
    <Container>
      <VisualWrapper>
        <AmbientEffect color={color} />
        <StyledSVG height={size} width={size}>
          <circle
            stroke={designTokens.colors.neutral[50]}
            fill="transparent"
            strokeWidth={strokeWidth}
            r={radius}
            cx={center}
            cy={center}
          />
          <circle
            stroke={color}
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{
              transition: "stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
            r={radius}
            cx={center}
            cy={center}
          />
        </StyledSVG>
        <ScoreDisplay>
          <span className="value">{normalizedScore}</span>
          <span className="label">{label}</span>
        </ScoreDisplay>
      </VisualWrapper>

      {details.length > 0 && (
        <DetailsGrid>
          {details.map((detail, i) => (
            <MetricBox key={i}>
              <span className="m-label">{detail.label}</span>
              <span className="m-value">{detail.value}</span>
            </MetricBox>
          ))}
        </DetailsGrid>
      )}
    </Container>
  );
};

export default GovernanceScore;
