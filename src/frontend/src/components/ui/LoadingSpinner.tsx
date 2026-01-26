import React from "react";
import { designTokens } from "../../styles/designTokens";
import {
  loadingSpinnerContainerStyles,
  getLoadingSpinnerStyles,
  getLoadingDotsStyles,
  getLoadingPulseStyles,
  getLoadingBarsStyles,
  getLoadingSpinnerTextStyles,
} from "../../styles/styles";

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
        return <div css={getLoadingSpinnerStyles(size, color)} />;
      case "dots":
        return <div css={getLoadingDotsStyles(size, color)} />;
      case "pulse":
        return <div css={getLoadingPulseStyles(size, color)} />;
      case "bars":
        return <div css={getLoadingBarsStyles(size, color)} />;
      default:
        return null;
    }
  };

  return (
    <div css={loadingSpinnerContainerStyles}>
      {renderSpinner()}
      {text && <span css={getLoadingSpinnerTextStyles(size)}>{text}</span>}
    </div>
  );
};

export default LoadingSpinner;
