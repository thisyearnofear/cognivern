import { css } from "@emotion/react";
import { designTokens, shadowSystem, keyframeAnimations } from "../../styles/design-system";

export const containerStyles = css`
  max-width: 1400px;
  margin: 0 auto;
  padding: ${designTokens.spacing[6]};
  min-height: 100vh;
  background: linear-gradient(
    135deg,
    ${designTokens.colors.background.secondary} 0%,
    ${designTokens.colors.background.tertiary} 100%
  );
  position: relative;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      ${designTokens.colors.primary[500]},
      transparent
    );
    opacity: 0.3;
    animation: scanline 8s linear infinite;
  }

  @keyframes scanline {
    0% { transform: translateY(-100vh); }
    100% { transform: translateY(100vh); }
  }
`;

export const headerStyles = css`
  text-align: center;
  margin-bottom: ${designTokens.spacing[8]};
  ${keyframeAnimations.fadeInUp}
`;

export const titleStyles = css`
  font-size: ${designTokens.typography.fontSize["4xl"]};
  font-weight: ${designTokens.typography.fontWeight.bold};
  background: linear-gradient(
    135deg,
    ${designTokens.colors.neutral[900]},
    ${designTokens.colors.neutral[600]}
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: ${designTokens.spacing[3]};
  letter-spacing: -0.02em;
`;

export const subtitleStyles = css`
  font-size: ${designTokens.typography.fontSize.lg};
  color: ${designTokens.colors.neutral[600]};
  max-width: 600px;
  margin: 0 auto;
`;

export const agentSelectorStyles = css`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: ${designTokens.spacing[4]};
  margin-bottom: ${designTokens.spacing[8]};
`;

export const agentCardStyles = (isSelected: boolean) => css`
  position: relative;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid
    ${isSelected ? designTokens.colors.primary[500] : "transparent"};

  &:hover {
    transform: translateY(-2px);
    box-shadow: ${shadowSystem.lg};
  }

  ${isSelected &&
  css`
    box-shadow: ${shadowSystem.lg};
    background: linear-gradient(
      135deg,
      ${designTokens.colors.primary[50]} 0%,
      white 100%
    );
  `}
`;

export const agentHeaderStyles = css`
  display: flex;
  align-items: center;
  gap: ${designTokens.spacing[3]};
  margin-bottom: ${designTokens.spacing[4]};
`;

export const agentIconStyles = css`
  font-size: 2rem;
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${designTokens.colors.primary[100]};
  border-radius: ${designTokens.borderRadius.xl};
`;

export const agentInfoStyles = css`
  flex: 1;
`;

export const agentNameStyles = css`
  font-size: ${designTokens.typography.fontSize.xl};
  font-weight: ${designTokens.typography.fontWeight.bold};
  margin-bottom: ${designTokens.spacing[1]};
  color: ${designTokens.colors.neutral[900]};
`;

export const agentDescStyles = css`
  color: ${designTokens.colors.neutral[600]};
  font-size: ${designTokens.typography.fontSize.sm};
`;

export const statusBadgeStyles = css`
  display: flex;
  align-items: center;
  gap: ${designTokens.spacing[1]};
`;

export const featuresGridStyles = css`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: ${designTokens.spacing[3]};
  margin-bottom: ${designTokens.spacing[4]};
`;

export const featureStyles = css`
  display: flex;
  align-items: center;
  gap: ${designTokens.spacing[2]};
  padding: ${designTokens.spacing[2]};
  background: ${designTokens.colors.neutral[50]};
  border-radius: ${designTokens.borderRadius.md};
  font-size: ${designTokens.typography.fontSize.sm};
`;

export const statsRowStyles = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: ${designTokens.spacing[4]};
  border-top: 1px solid ${designTokens.colors.neutral[200]};
`;

export const statStyles = css`
  text-align: center;
`;

export const statValueStyles = css`
  font-weight: ${designTokens.typography.fontWeight.bold};
  color: ${designTokens.colors.primary[600]};
  font-size: ${designTokens.typography.fontSize.lg};
`;

export const statLabelStyles = css`
  font-size: ${designTokens.typography.fontSize.xs};
  color: ${designTokens.colors.neutral[500]};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

export const dashboardGridStyles = css`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${designTokens.spacing[6]};
  margin-bottom: ${designTokens.spacing[8]};

  @media (min-width: 1024px) {
    grid-template-columns: 1fr 1fr;
  }
`;

export const errorStyles = css`
  background: ${designTokens.colors.semantic.error[50]};
  border: 1px solid ${designTokens.colors.semantic.error[200]};
  border-radius: ${designTokens.borderRadius.lg};
  padding: ${designTokens.spacing[4]};
  margin-bottom: ${designTokens.spacing[6]};
  display: flex;
  align-items: center;
  gap: ${designTokens.spacing[3]};
`;

export const sectionTitleStyles = css`
  font-size: ${designTokens.typography.fontSize.xl};
  font-weight: ${designTokens.typography.fontWeight.bold};
  margin-bottom: ${designTokens.spacing[4]};
  color: ${designTokens.colors.neutral[900]};
  display: flex;
  align-items: center;
  gap: ${designTokens.spacing[2]};
`;

export const comparisonTableStyles = css`
  width: 100%;
  border-collapse: collapse;
  margin-top: ${designTokens.spacing[4]};
  font-size: ${designTokens.typography.fontSize.sm};

  th, td {
    padding: ${designTokens.spacing[3]};
    text-align: left;
    border-bottom: 1px solid ${designTokens.colors.neutral[200]};
  }

  th {
    background: ${designTokens.colors.neutral[50]};
    color: ${designTokens.colors.neutral[600]};
    font-weight: ${designTokens.typography.fontWeight.semibold};
  }
`;

export const emptyStateStyles = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${designTokens.spacing[12]};
  text-align: center;
  color: ${designTokens.colors.neutral[500]};

  svg {
    margin-bottom: ${designTokens.spacing[4]};
    opacity: 0.5;
  }
`;
