import React, { useState } from "react";
import { css } from "@emotion/react";
import { designTokens } from "../../styles/design-system";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = "top",
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const containerStyles = css`
    display: inline-block;
    position: relative;
    cursor: help;
  `;

  const tooltipStyles = css`
    position: absolute;
    z-index: ${designTokens.zIndex.popover};
    padding: ${designTokens.spacing[2]} ${designTokens.spacing[3]};
    background: ${designTokens.colors.neutral[900]};
    color: ${designTokens.colors.neutral[0]};
    border-radius: ${designTokens.borderRadius.md};
    font-size: ${designTokens.typography.fontSize.xs};
    line-height: ${designTokens.typography.lineHeight.snug};
    max-width: 300px;
    white-space: normal;
    opacity: ${isVisible ? "1" : "0"};
    display: ${isVisible ? "block" : "none"};
    pointer-events: ${isVisible ? "auto" : "none"};
    transition:
      opacity ${designTokens.animation.duration.fast}
        ${designTokens.animation.easing.easeInOut},
      transform ${designTokens.animation.duration.fast}
        ${designTokens.animation.easing.easeInOut};
    transform: ${isVisible
      ? "translateY(0)"
      : `translateY(${position === "top" ? "8px" : "-8px"})`};
    box-shadow: ${designTokens.shadows.lg};

    ${position === "top"
      ? `
      bottom: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%) ${isVisible ? "translateY(0)" : "translateY(8px)"};

      &::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 6px solid transparent;
        border-top-color: ${designTokens.colors.neutral[900]};
      }
    `
      : ""}

    ${position === "bottom"
      ? `
      top: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%) ${isVisible ? "translateY(0)" : "translateY(-8px)"};

      &::after {
        content: '';
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 6px solid transparent;
        border-bottom-color: ${designTokens.colors.neutral[900]};
      }
    `
      : ""}

    ${position === "left"
      ? `
      right: calc(100% + 8px);
      top: 50%;
      transform: translateY(-50%) ${isVisible ? "translateX(0)" : "translateX(8px)"};

      &::after {
        content: '';
        position: absolute;
        left: 100%;
        top: 50%;
        transform: translateY(-50%);
        border: 6px solid transparent;
        border-left-color: ${designTokens.colors.neutral[900]};
      }
    `
      : ""}

    ${position === "right"
      ? `
      left: calc(100% + 8px);
      top: 50%;
      transform: translateY(-50%) ${isVisible ? "translateX(0)" : "translateX(-8px)"};

      &::after {
        content: '';
        position: absolute;
        right: 100%;
        top: 50%;
        transform: translateY(-50%);
        border: 6px solid transparent;
        border-right-color: ${designTokens.colors.neutral[900]};
      }
    `
      : ""}
  `;

  return (
    <div
      css={containerStyles}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      <div css={tooltipStyles}>{content}</div>
    </div>
  );
};

export default Tooltip;
