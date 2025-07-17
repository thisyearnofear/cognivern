import { css } from '@emotion/react';

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
      0%, 100% {
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
      0%, 100% {
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
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    animation: spin 1s linear infinite;
  `,
} as const;

// Animation timing functions
export const easings = {
  smooth: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  bounce: 'all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  spring: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
} as const;