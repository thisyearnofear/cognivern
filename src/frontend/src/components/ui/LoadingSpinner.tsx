import React from "react";
import { designTokens } from "../../styles/designTokens";
import { loadingStyles } from "../../styles/design-system";

export interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  color?: string;
  type?: "spinner" | "dots" | "pulse" | "bars" | "skeleton";
  text?: string;
  // Skeleton-specific props
  width?: string | number;
  height?: string | number;
  lines?: number;
  variant?: "text" | "rectangular" | "circular" | "card";
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = "md",
  color = designTokens.colors.primary[500],
  type = "spinner",
  text,
}) => {
  const renderSpinner = () => {
    switch (type) {
      case "spinner":
        return <div css={loadingStyles.spinner(size, color)} />;
      case "dots":
        return <div css={loadingStyles.dots(color)} />;
      case "pulse":
        return <div css={loadingStyles.pulse(color)} />;
      case "bars":
        return <div css={loadingStyles.bars(color)} />;
      default:
        return null;
    }
  };

  return (
    <div css={loadingStyles.container}>
      {renderSpinner()}
      {text && <span css={loadingStyles.text(size)}>{text}</span>}
    </div>
  );
};

export default LoadingSpinner;
