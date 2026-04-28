import React, { useState, useRef } from 'react';
import { css } from '@emotion/react';
import { designTokens, keyframeAnimations } from '../../styles/design-system';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { agentApi } from '../../services/apiService';

const briefingContainerStyles = css`
  margin-top: ${designTokens.spacing[8]};
  ${keyframeAnimations.fadeInUp};
`;

const audioPlayerStyles = css`
  width: 100%;
  height: 40px;
  border-radius: ${designTokens.borderRadius.full};
  background: ${designTokens.colors.neutral[100]};
  margin-top: ${designTokens.spacing[4]};
`;

const scriptContainerStyles = css`
  margin-top: ${designTokens.spacing[6]};
  padding: ${designTokens.spacing[4]};
  background: ${designTokens.colors.neutral[50]};
  border-radius: ${designTokens.borderRadius.lg};
  border-left: 4px solid ${designTokens.colors.primary[500]};
  font-size: ${designTokens.typography.fontSize.sm};
  line-height: 1.6;
  color: ${designTokens.colors.neutral[700]};
  font-style: italic;
`;

const VoiceBriefing: React.FC<{ agentId: string }> = ({ agentId }) => {
  const [loading, setLoading] = useState(false);
  const [briefing, setBriefing] = useState<{ audioUrl: string; script: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleGenerateBriefing = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await agentApi.getAgentBriefing(agentId);
      if (result.success && result.data) {
        setBriefing(result.data);
      } else {
        setError(result.error || 'Failed to generate briefing');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div css={briefingContainerStyles}>
      <Card
        variant="elevated"
        css={css`
          border: 1px solid ${designTokens.colors.primary[200]};
          background: linear-gradient(
            135deg,
            ${designTokens.colors.primary[50]} 0%,
            white 100%
          );
          position: relative;
          overflow: hidden;

          &::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(
              circle at center,
              ${designTokens.colors.primary[100]} 0%,
              transparent 70%
            );
            opacity: 0.4;
            pointer-events: none;
          }
        `}
      >
        <CardContent
          css={css`
            padding: ${designTokens.spacing[8]};
            position: relative;
            z-index: 1;
          `}
        >
          <div
            css={css`
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: ${designTokens.spacing[6]};
            `}
          >
            <div>
              <h3
                css={css`
                  font-size: ${designTokens.typography.fontSize.xl};
                  font-weight: ${designTokens.typography.fontWeight.bold};
                  margin: 0;
                  color: ${designTokens.colors.primary[900]};
                  letter-spacing: -0.02em;
                  display: flex;
                  align-items: center;
                  gap: ${designTokens.spacing[2]};
                `}
              >
                Voice of Governance
                {loading && (
                  <div
                    css={css`
                      width: 12px;
                      height: 12px;
                      background: ${designTokens.colors.primary[500]};
                      border-radius: 50%;
                      animation: pulse 1.5s infinite;

                      @keyframes pulse {
                        0% { transform: scale(1); opacity: 1; }
                        50% { transform: scale(1.5); opacity: 0.5; }
                        100% { transform: scale(1); opacity: 1; }
                      }
                    `}
                  />
                )}
              </h3>
              <p
                css={css`
                  font-size: ${designTokens.typography.fontSize.sm};
                  color: ${designTokens.colors.primary[700]};
                  margin: 4px 0 0 0;
                  font-weight: ${designTokens.typography.fontWeight.medium};
                `}
              >
                AI-generated intelligence summary synthesized by ElevenLabs
              </p>
            </div>
            <Badge variant="default" size="lg">
              AI Powered
            </Badge>
          </div>

          {!briefing ? (
            <Button
              variant="primary"
              size="lg"
              onClick={handleGenerateBriefing}
              disabled={loading}
              css={css`
                width: 100%;
                height: 56px;
                background: ${designTokens.colors.primary[600]};
                box-shadow: 0 10px 20px -5px rgba(37, 99, 235, 0.3);
                font-size: ${designTokens.typography.fontSize.base};
              `}
            >
              {loading ? 'Synthesizing Intelligence...' : 'Listen to Governance Briefing'}
            </Button>
          ) : (
            <div
              css={css`
                ${keyframeAnimations.fadeIn}
              `}
            >
              <audio
                ref={audioRef}
                src={briefing.audioUrl}
                controls
                autoPlay
                css={audioPlayerStyles}
              />
              <div
                css={css`
                  ${scriptContainerStyles}
                  background: white;
                  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05);
                `}
              >
                "{briefing.script}"
              </div>
              <div
                css={css`
                  display: flex;
                  justify-content: center;
                  margin-top: ${designTokens.spacing[6]};
                `}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBriefing(null)}
                  css={css`
                    color: ${designTokens.colors.neutral[500]};
                    &:hover { color: ${designTokens.colors.neutral[900]}; }
                  `}
                >
                  Clear Audio Briefing
                </Button>
              </div>
            </div>
          )}

          {error && (
            <div
              css={css`
                color: ${designTokens.colors.semantic.error[600]};
                font-size: ${designTokens.typography.fontSize.sm};
                margin-top: ${designTokens.spacing[4]};
                text-align: center;
                font-weight: ${designTokens.typography.fontWeight.medium};
              `}
            >
              {error}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VoiceBriefing;
