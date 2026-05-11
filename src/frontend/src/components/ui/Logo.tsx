/** @jsxImportSource @emotion/react */
import { css, keyframes } from '@emotion/react';
import { designTokens } from '../../styles/design-system';

// Logo animation keyframes
const pulse = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
`;

const float = keyframes`
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
`;

const rotate = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  variant?: 'default' | 'minimal' | 'animated';
  className?: string;
}

const sizeMap = {
  sm: { icon: 24, text: 14, container: 32 },
  md: { icon: 32, text: 18, container: 44 },
  lg: { icon: 40, text: 22, container: 56 },
  xl: { icon: 48, text: 28, container: 64 },
};

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showText = true,
  variant = 'default',
  className,
}) => {
  const sizes = sizeMap[size];
  const isAnimated = variant === 'animated';

  return (
    <div
      css={css`
        display: inline-flex;
        align-items: center;
        gap: ${designTokens.spacing[2]};
        cursor: pointer;
        user-select: none;
      `}
      className={className}
    >
      {/* Logo Icon */}
      <div
        css={css`
          width: ${sizes.container}px;
          height: ${sizes.container}px;
          border-radius: ${designTokens.borderRadius.lg};
          background: ${designTokens.colors.primary[600]};
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          box-shadow: ${isAnimated ? designTokens.shadows.glow.primary : 'none'};

          ${isAnimated &&
          css`
            animation: ${float} 3s ease-in-out infinite;
          `}
        `}
      >
        {/* Shield shape SVG */}
        <svg
          width={sizes.icon}
          height={sizes.icon}
          viewBox="0 0 24 24"
          fill="none"
          css={css`
            ${isAnimated &&
            css`
              animation: ${pulse} 2s ease-in-out infinite;
            `}
          `}
        >
          {/* Outer shield */}
          <path
            d="M12 2L3 7V12C3 16.97 6.84 21.56 12 23C17.16 21.56 21 16.97 21 12V7L12 2Z"
            fill="url(#shieldGradient)"
            stroke="white"
            strokeWidth="1.5"
          />
          {/* Inner brain pattern */}
          <path
            d="M12 6C10 6 8 8 8 10C8 11 8.5 12 9 13C7 13 5 14.5 5 17V18H19V17C19 14.5 17 13 15 13C15.5 12 16 11 16 10C16 8 14 6 12 6Z"
            fill="white"
            opacity="0.9"
          />
          {/* Neural connection dots */}
          <circle cx="10" cy="9" r="1" fill="white" />
          <circle cx="14" cy="9" r="1" fill="white" />
          <circle cx="12" cy="12" r="1" fill="white" />
          <circle cx="10" cy="15" r="1" fill="white" />
          <circle cx="14" cy="15" r="1" fill="white" />

          <defs>
            <linearGradient
              id="shieldGradient"
              x1="3"
              y1="2"
              x2="21"
              y2="23"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#0ea5e9" />
              <stop offset="1" stopColor="#0284c7" />
            </linearGradient>
          </defs>
        </svg>

        {/* Animated ring for animated variant */}
        {isAnimated && (
          <div
            css={css`
              position: absolute;
              inset: -4px;
              border: 2px solid ${designTokens.colors.primary[400]};
              border-radius: ${designTokens.borderRadius.xl};
              opacity: 0.5;
              animation: ${rotate} 8s linear infinite;

              &::before {
                content: '';
                position: absolute;
                top: -4px;
                left: 50%;
                width: 6px;
                height: 6px;
                background: ${designTokens.colors.primary[300]};
                border-radius: 50%;
              }
            `}
          />
        )}
      </div>

      {/* Logo Text */}
      {showText && (
        <span
          css={css`
            font-size: ${sizes.text}px;
            font-weight: ${designTokens.typography.fontWeight.bold};
            color: ${designTokens.colors.neutral[900]};
            letter-spacing: -0.02em;
            line-height: 1;

            /* Accent on 'v' for Cogni-VER-N */
            & span {
              color: ${designTokens.colors.primary[600]};
            }
          `}
        >
          Cogni<span>v</span>ern
        </span>
      )}
    </div>
  );
};

export default Logo;
