import { css } from "@emotion/react";

// Reusable keyframe animations
export const keyframeAnimations = {
  fadeInUp: css`
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    animation: fadeInUp 0.6s ease-out;
  `,

  slideInRight: css`
    @keyframes slideInRight {
      from {
        opacity: 0;
        transform: translateX(30px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
    animation: slideInRight 0.5s ease-out;
  `,

  scaleIn: css`
    @keyframes scaleIn {
      from {
        opacity: 0;
        transform: scale(0.9);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
    animation: scaleIn 0.4s ease-out;
  `,

  pulse: css`
    @keyframes pulse {
      0%,
      100% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.05);
      }
    }
    animation: pulse 2s ease-in-out infinite;
  `,

  float: css`
    @keyframes float {
      0%,
      100% {
        transform: translateY(0px);
      }
      50% {
        transform: translateY(-10px);
      }
    }
    animation: float 3s ease-in-out infinite;
  `,

  spin: css`
    @keyframes spin {
      0% {
        transform: rotate(0deg);
      }
      100% {
        transform: rotate(360deg);
      }
    }
    animation: spin 1s linear infinite;
  `,

  reveal: css`
    @keyframes reveal {
      from {
        clip-path: inset(0 100% 0 0);
      }
      to {
        clip-path: inset(0 0 0 0);
      }
    }
    animation: reveal 0.8s cubic-bezier(0.77, 0, 0.175, 1);
  `,

  revealUp: css`
    @keyframes revealUp {
      from {
        clip-path: inset(100% 0 0 0);
        transform: translateY(30px);
      }
      to {
        clip-path: inset(0 0 0 0);
        transform: translateY(0);
      }
    }
    animation: revealUp 0.8s cubic-bezier(0.77, 0, 0.175, 1);
  `,

  fadeIn: css`
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    animation: fadeIn 0.3s ease-out;
  `,

  fadeOut: css`
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    animation: fadeOut 0.2s ease-in;
  `,

  slideInDown: css`
    @keyframes slideInDown {
      from { opacity: 0; transform: translateY(-20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    animation: slideInDown 0.3s ease-out;
  `,

  slideInLeft: css`
    @keyframes slideInLeft {
      from { opacity: 0; transform: translateX(-20px); }
      to { opacity: 1; transform: translateX(0); }
    }
    animation: slideInLeft 0.3s ease-out;
  `,

  slideOutUp: css`
    @keyframes slideOutUp {
      from { opacity: 1; transform: translateY(0); }
      to { opacity: 0; transform: translateY(-20px); }
    }
    animation: slideOutUp 0.2s ease-in;
  `,

  slideOutRight: css`
    @keyframes slideOutRight {
      from { opacity: 1; transform: translateX(0); }
      to { opacity: 0; transform: translateX(100%); }
    }
    animation: slideOutRight 0.3s ease-in;
  `,

  shake: css`
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      75% { transform: translateX(5px); }
    }
    animation: shake 0.3s ease-in-out;
  `,

  parallax: (amount: number) => css`
    transform: translateY(var(--scroll-y, 0) * ${amount}px);
  `,

  shimmer: css`
    @keyframes shimmer {
      0% {
        background-position: -200% 0;
      }
      100% {
        background-position: 200% 0;
      }
    }
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0) 0%,
      rgba(255, 255, 255, 0.2) 50%,
      rgba(255, 255, 255, 0) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 2s infinite;
  `,
} as const;

// Animation timing functions
export const easings = {
  smooth: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  bounce: "all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
  spring: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
} as const;
