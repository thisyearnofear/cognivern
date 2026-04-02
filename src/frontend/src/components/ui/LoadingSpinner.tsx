import React from "react";
import { designTokens } from "../../styles/design-system";
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
  width,
  height,
  lines = 1,
  variant = "text",
}) => {
  const renderContent = () => {
    if (type === "skeleton") {
      if (variant === "text" && lines > 1) {
        return (
          <div style={{ width: width || "100%" }}>
            {Array.from({ length: lines }).map((_, i) => (
              <div
                key={i}
                css={loadingStyles.skeleton("text", "100%", height)}
              />
            ))}
          </div>
        );
      }
      return <div css={loadingStyles.skeleton(variant, width, height)} />;
    }

    switch (type) {
      case "spinner":
        return <div css={loadingStyles.spinner(size, color)} />;
      case "dots":
        return (
          <div css={loadingStyles.dots(color)}>
            <div />
            <div />
            <div />
          </div>
        );
      case "pulse":
        return <div css={loadingStyles.pulse(color)} />;
      case "bars":
        return (
          <div css={loadingStyles.bars(color)}>
            <div />
            <div />
            <div />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div css={type === "skeleton" ? undefined : loadingStyles.container}>
      {renderContent()}
      {text && type !== "skeleton" && (
        <span css={loadingStyles.text(size)}>{text}</span>
      )}
    </div>
  );
};

export default LoadingSpinner;
