/** @jsxImportSource @emotion/react */
import React, { useEffect } from 'react';
import { css, keyframes } from '@emotion/react';
import { designTokens } from '../../styles/design-system';
import { Award, ShieldCheck, ShieldAlert, CheckCircle, Users, PlayCircle } from 'lucide-react';
import { useAchievementStore } from '../../stores/achievementStore';

const slideUp = keyframes`
  from { transform: translateY(100px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const iconMap: Record<string, React.ReactNode> = {
  'shield': <ShieldCheck size={24} />,
  'shield-alert': <ShieldAlert size={24} />,
  'award': <Award size={24} />,
  'check-circle': <CheckCircle size={24} />,
  'users': <Users size={24} />,
  'play-circle': <PlayCircle size={24} />,
};

export const AchievementToast: React.FC = () => {
  const { pending, dismissPending } = useAchievementStore();

  useEffect(() => {
    if (pending) {
      const timer = setTimeout(dismissPending, 5000);
      return () => clearTimeout(timer);
    }
  }, [pending, dismissPending]);

  if (!pending) return null;

  return (
    <div
      css={css`
        position: fixed;
        bottom: ${designTokens.spacing[6]};
        left: 50%;
        transform: translateX(-50%);
        z-index: ${designTokens.zIndex.toast || 9999};
        animation: ${slideUp} 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      `}
    >
      <div
        css={css`
          display: flex;
          align-items: center;
          gap: ${designTokens.spacing[3]};
          padding: ${designTokens.spacing[3]} ${designTokens.spacing[5]};
          background: linear-gradient(135deg, ${designTokens.colors.primary[600]}, ${designTokens.colors.primary[700]});
          border-radius: ${designTokens.borderRadius.xl};
          box-shadow: 0 10px 40px -10px ${designTokens.colors.primary[500]}80;
          color: white;
          min-width: 280px;
          cursor: pointer;

          &::before {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: inherit;
            background: linear-gradient(90deg, transparent 25%, rgba(255,255,255,0.1) 50%, transparent 75%);
            background-size: 200% 100%;
            animation: ${shimmer} 2s ease-in-out infinite;
          }
        `}
        onClick={dismissPending}
        role="alert"
        aria-live="polite"
      >
        <div css={css`
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(255,255,255,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        `}>
          {iconMap[pending.icon] || <Award size={24} />}
        </div>
        <div>
          <div css={css`
            font-size: ${designTokens.typography.fontSize.xs};
            font-weight: ${designTokens.typography.fontWeight.medium};
            opacity: 0.8;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          `}>
            Achievement Unlocked
          </div>
          <div css={css`
            font-size: ${designTokens.typography.fontSize.base};
            font-weight: ${designTokens.typography.fontWeight.bold};
          `}>
            {pending.title}
          </div>
          <div css={css`
            font-size: ${designTokens.typography.fontSize.xs};
            opacity: 0.8;
          `}>
            {pending.description}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AchievementToast;
