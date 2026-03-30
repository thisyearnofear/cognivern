import React, { useState, useRef } from "react";
import { css } from "@emotion/react";
import { designTokens, keyframeAnimations } from "../../styles/design-system";
import { Card, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { agentApi } from "../../services/apiService";

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
        setError(result.error || "Failed to generate briefing");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div css={briefingContainerStyles}>
      <Card variant="outline" css={css`border-color: ${designTokens.colors.primary[200]}; background: ${designTokens.colors.primary[50]};`}>
        <CardContent css={css`padding: ${designTokens.spacing[6]};`}>
          <div css={css`display: flex; align-items: center; justify-content: space-between; margin-bottom: ${designTokens.spacing[4]};`}>
            <div>
              <h3 css={css`font-weight: bold; margin: 0; color: ${designTokens.colors.primary[900]};`}>Voice of Governance</h3>
              <p css={css`font-size: ${designTokens.typography.fontSize.xs}; color: ${designTokens.colors.primary[700]}; margin: 2px 0 0 0;`}>
                AI-generated audio summary of recent activity
              </p>
            </div>
            <Badge variant="primary">ElevenLabs AI</Badge>
          </div>

          {!briefing ? (
            <Button
              variant="primary"
              size="sm"
              onClick={handleGenerateBriefing}
              disabled={loading}
              css={css`width: 100%; background: ${designTokens.colors.primary[600]};`}
            >
              {loading ? "Synthesizing Audio..." : "Listen to Governance Briefing"}
            </Button>
          ) : (
            <div>
              <audio
                ref={audioRef}
                src={briefing.audioUrl}
                controls
                autoPlay
                css={audioPlayerStyles}
              />
              <div css={scriptContainerStyles}>
                {briefing.script}
              </div>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setBriefing(null)}
                css={css`margin-top: ${designTokens.spacing[4]}; color: ${designTokens.colors.neutral[500]};`}
              >
                Clear Briefing
              </Button>
            </div>
          )}

          {error && (
            <div css={css`color: ${designTokens.colors.semantic.error}; font-size: ${designTokens.typography.fontSize.xs}; margin-top: ${designTokens.spacing[2]}; text-align: center;`}>
              {error}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VoiceBriefing;
