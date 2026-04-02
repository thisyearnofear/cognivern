/**
 * Confetti Component - Pure CSS Delight
 *
 * Lightweight celebration effect for success states.
 * Follows CLEAN + MODULAR principles.
 */

import React from "react";
import { css, keyframes } from "@emotion/react";
import { designTokens } from "../../styles/design-system";

const colors = [
  "#22c55e", // success
  "#3b82f6", // info
  "#f59e0b", // warning
  "#ec4899", // pink
  "#8b5cf6", // purple
  "#0ea5e9"  // primary
];

const fall = keyframes`
  0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
  100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
`;

export const Confetti: React.FC<{ count?: number }> = ({ count = 50 }) => {
  const particles = Array.from({ length: count });

  const containerStyles = css`
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: ${designTokens.zIndex.toast};
    overflow: hidden;
  `;

  return (
    <div css={containerStyles}>
      {particles.map((_, i) => {
        const size = Math.random() * 10 + 5;
        const left = Math.random() * 100;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const delay = Math.random() * 3;
        const duration = Math.random() * 2 + 3;

        const particleStyles = css`
          position: absolute;
          top: -20px;
          left: ${left}%;
          width: ${size}px;
          height: ${size}px;
          background-color: ${color};
          border-radius: ${Math.random() > 0.5 ? "50%" : "2px"};
          opacity: 0;
          animation: ${fall} ${duration}s ${delay}s linear forwards;
        `;

        return <div key={i} css={particleStyles} />;
      })}
    </div>
  );
};

export default Confetti;
