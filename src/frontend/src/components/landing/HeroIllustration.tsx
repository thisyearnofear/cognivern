/** @jsxImportSource @emotion/react */
import { css, keyframes } from '@emotion/react';
import { designTokens } from '../../styles/design-system';

// Floating animation for decorative elements
const float = keyframes`
  0%, 100% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(-8px) rotate(2deg);
  }
`;

const floatReverse = keyframes`
  0%, 100% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(8px) rotate(-2deg);
  }
`;

const pulse = keyframes`
  0%, 100% {
    opacity: 0.4;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.05);
  }
`;

const shimmer = keyframes`
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
`;

const orbit = keyframes`
  from {
    transform: rotate(0deg) translateX(60px) rotate(0deg);
  }
  to {
    transform: rotate(360deg) translateX(60px) rotate(-360deg);
  }
`;

interface HeroIllustrationProps {
  className?: string;
}

export const HeroIllustration: React.FC<HeroIllustrationProps> = ({ className }) => {
  return (
    <div
      className={className}
      css={css`
        position: relative;
        width: 320px;
        height: 280px;
        margin: 0 auto;

        @media (max-width: 768px) {
          width: 260px;
          height: 220px;
        }
      `}
    >
      {/* Central shield */}
      <div
        css={css`
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 140px;
          height: 160px;

          @media (max-width: 768px) {
            width: 110px;
            height: 130px;
          }
        `}
      >
        {/* Shield glow */}
        <div
          css={css`
            position: absolute;
            inset: -20px;
            background: radial-gradient(
              ellipse at center,
              ${designTokens.colors.primary[400]}30 0%,
              transparent 70%
            );
            animation: ${pulse} 3s ease-in-out infinite;
          `}
        />

        {/* Shield SVG */}
        <svg viewBox="0 0 100 120" css={css`width: 100%; height: 100%;`}>
          <defs>
            <linearGradient id="shieldBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0ea5e9" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
            <linearGradient id="shieldInnerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.05" />
            </linearGradient>
            <filter id="shieldShadow">
              <feDropShadow dx="0" dy="4" stdDeviation="8" floodOpacity="0.3"/>
            </filter>
          </defs>

          {/* Main shield body */}
          <path
            d="M50 5 L10 25 V55 C10 85 27 105 50 115 C73 105 90 85 90 55 V25 L50 5Z"
            fill="url(#shieldBodyGrad)"
            filter="url(#shieldShadow)"
          />

          {/* Shield highlight */}
          <path
            d="M50 10 L15 28 V55 C15 80 30 98 50 108"
            fill="none"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Inner circle */}
          <circle cx="50" cy="55" r="35" fill="url(#shieldInnerGrad)" />

          {/* Lock icon inside */}
          <g transform="translate(50, 50)">
            <rect x="-12" y="-5" width="24" height="18" rx="3" fill="white" />
            <path d="M-8 -5 V-10 A8 8 0 0 1 8 -10 V-5" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" />
            <circle cx="0" cy="5" r="3" fill={designTokens.colors.primary[600]} />
          </g>
        </svg>
      </div>

      {/* Floating agent nodes */}
      {[
        { angle: 0, delay: '0s', color: '#22c55e', label: 'Agent' },
        { angle: 120, delay: '0.5s', color: '#f59e0b', label: 'Policy' },
        { angle: 240, delay: '1s', color: '#3b82f6', label: 'Audit' },
      ].map((node) => (
        <div
          key={node.label}
          css={css`
            position: absolute;
            top: 50%;
            left: 50%;
            width: 60px;
            height: 60px;
            transform: rotate(${node.angle}deg) translateY(-80px);
            animation: ${node.angle === 120 ? floatReverse : float} 4s ease-in-out infinite;
            animation-delay: ${node.delay};

            @media (max-width: 768px) {
              width: 48px;
              height: 48px;
              transform: rotate(${node.angle}deg) translateY(-60px);
            }
          `}
        >
          <div
            css={css`
              width: 100%;
              height: 100%;
              background: white;
              border-radius: 50%;
              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
              display: flex;
              align-items: center;
              justify-content: center;
              border: 3px solid ${node.color};
              animation: rotate -4s linear infinite;
              animation-delay: -${node.delay};
              transform: rotate(-${node.angle}deg);
            `}
          >
            {/* Node icons */}
            {node.label === 'Agent' && (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="8" r="4" stroke={node.color} strokeWidth="2" />
                <path d="M6 20C6 16 8 14 12 14C16 14 18 16 18 20" stroke={node.color} strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
            {node.label === 'Policy' && (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M9 12L11 14L15 10M21 12C21 16.97 16.97 21 12 21C7.03 21 3 16.97 3 12C3 7.03 7.03 3 12 3C16.97 3 21 7.03 21 12Z" stroke={node.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {node.label === 'Audit' && (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7M9 5C9 6.10457 9.89543 7 11 7H13C14.1046 7 15 6.10457 15 5M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5" stroke={node.color} strokeWidth="2" strokeLinecap="round" />
                <path d="M9 12L11 14L15 10" stroke={node.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>

          {/* Label */}
          <span
            css={css`
              position: absolute;
              bottom: -20px;
              left: 50%;
              transform: translateX(-50%);
              font-size: 10px;
              font-weight: 600;
              color: ${node.color};
              white-space: nowrap;

              @media (max-width: 768px) {
                font-size: 9px;
                bottom: -18px;
              }
            `}
          >
            {node.label}
          </span>
        </div>
      ))}

      {/* Connection lines (decorative) */}
      <svg
        css={css`
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          overflow: visible;
        `}
      >
        {[0, 120, 240].map((angle) => {
          const rad = (angle * Math.PI) / 180;
          const x1 = 160 + Math.sin(rad) * 50;
          const y1 = 140 - Math.cos(rad) * 50;
          const x2 = 160 + Math.sin(rad) * 100;
          const y2 = 140 - Math.cos(rad) * 100;
          return (
            <line
              key={angle}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="url(#connectionGradient)"
              strokeWidth="2"
              strokeDasharray="4 4"
              opacity="0.5"
            />
          );
        })}
        <defs>
          <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={designTokens.colors.primary[400]} stopOpacity="0.8" />
            <stop offset="100%" stopColor={designTokens.colors.primary[200]} stopOpacity="0.2" />
          </linearGradient>
        </defs>
      </svg>

      {/* Floating particles */}
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          css={css`
            position: absolute;
            width: ${6 + i * 2}px;
            height: ${6 + i * 2}px;
            background: ${i % 2 === 0 ? designTokens.colors.primary[400] : designTokens.colors.semantic.success[400]};
            border-radius: 50%;
            opacity: 0.3;
            animation: ${float} ${3 + i * 0.5}s ease-in-out infinite;
            animation-delay: ${i * 0.3}s;
            top: ${15 + i * 12}%;
            left: ${10 + i * 15}%;

            @media (max-width: 768px) {
              display: none;
            }
          `}
        />
      ))}
    </div>
  );
};

export default HeroIllustration;
