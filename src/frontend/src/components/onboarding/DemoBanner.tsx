/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, X } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { designTokens } from '../../styles/design-system';
import { Button } from '../ui/Button';

/**
 * DemoBanner
 * ----------
 * Sticky, dismissible banner that appears when a visitor is exploring the
 * dashboard in demo mode (i.e. they clicked "Try Live Demo" on the landing
 * page without completing onboarding).
 *
 * Goals:
 *  - Make it obvious they are looking at sample data, not their own treasury.
 *  - Provide a single, low-friction CTA to convert: "Set up my treasury".
 *  - Be dismissible (`exitDemoMode`) so power users browsing the public
 *    instance aren't nagged forever.
 *
 * Conversion optimization:
 *  - Show concrete value ("Your agents won't spend a cent without your approval")
 *  - Gentle urgency without being pushy
 *  - Easy escape hatch for browsers
 */
export const DemoBanner: React.FC = () => {
  const navigate = useNavigate();
  const { preferences, exitDemoMode, markDemoValueSeen } = useAppStore();

  // Only show when the user is in demo mode AND hasn't completed onboarding.
  // Once they finish onboarding, the banner disappears.
  if (!preferences.demoExplored || preferences.onboardingCompleted) {
    return null;
  }

  const handleSetup = () => {
    // Track that they engaged with the conversion prompt
    markDemoValueSeen();
    navigate('/onboarding');
  };

  return (
    <div
      role="status"
      css={css`
        position: sticky;
        top: 0;
        z-index: 60;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: ${designTokens.spacing[4]};
        padding: ${designTokens.spacing[3]} ${designTokens.spacing[6]};
        background: linear-gradient(
          90deg,
          ${designTokens.colors.semantic.info[600]} 0%,
          ${designTokens.colors.primary[600]} 100%
        );
        color: white;
        font-size: ${designTokens.typography.fontSize.sm};
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);

        @media (max-width: 640px) {
          flex-direction: column;
          align-items: stretch;
          padding: ${designTokens.spacing[3]};
        }
      `}
    >
      <div
        css={css`
          display: flex;
          align-items: center;
          gap: ${designTokens.spacing[2]};
          min-width: 0;
        `}
      >
        <Sparkles size={16} aria-hidden />
        <span
          css={css`
            font-weight: ${designTokens.typography.fontWeight.semibold};
          `}
        >
          Demo mode
        </span>
        <span
          css={css`
            opacity: 0.9;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            @media (max-width: 640px) {
              white-space: normal;
            }
          `}
        >
          — seeing how agent governance works. Connect your treasury to protect your own agents.
        </span>
      </div>

      <div
        css={css`
          display: flex;
          align-items: center;
          gap: ${designTokens.spacing[2]};
          flex-shrink: 0;
        `}
      >
        <Button
          variant="primary"
          size="sm"
          onClick={handleSetup}
          css={css`
            background: white;
            color: ${designTokens.colors.primary[700]};
            &:hover {
              background: ${designTokens.colors.neutral[100]};
            }
          `}
        >
          Protect my agents
          <ArrowRight size={14} />
        </Button>
        <button
          type="button"
          aria-label="Continue browsing demo"
          onClick={exitDemoMode}
          css={css`
            background: transparent;
            border: none;
            color: white;
            cursor: pointer;
            padding: ${designTokens.spacing[1]};
            border-radius: ${designTokens.borderRadius.md};
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0.7;
            transition: opacity 0.15s;
            font-size: ${designTokens.typography.fontSize.xs};
            &:hover {
              opacity: 1;
              background: rgba(255, 255, 255, 0.1);
            }
          `}
        >
          Keep exploring
        </button>
      </div>
    </div>
  );
};

export default DemoBanner;
