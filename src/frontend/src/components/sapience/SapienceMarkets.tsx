/**
 * SapienceMarkets Component
 * 
 * Displays live Sapience prediction markets with forecast capabilities
 */

import React, { useState } from 'react';
import { css } from '@emotion/react';
import { Card, CardContent, CardTitle } from '../ui/Card';
import { designTokens, shadowSystem, keyframeAnimations } from '../../styles/design-system';
import { useSapienceData } from '../../hooks/useSapienceData';
import { getTimeRemaining } from '../../services/sapienceApi';
import { buttonStyles, textStyles } from '../dashboard/sharedStyles';

const containerStyles = css`
  display: flex;
  flex-direction: column;
  gap: ${designTokens.spacing[6]};
`;

const statsGridStyles = css`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: ${designTokens.spacing[4]};
  margin-bottom: ${designTokens.spacing[6]};
`;

const statCardStyles = css`
  text-align: center;
  padding: ${designTokens.spacing[4]};
  background: linear-gradient(135deg, ${designTokens.colors.primary[50]} 0%, ${designTokens.colors.neutral[0]} 100%);
  border-radius: ${designTokens.borderRadius.lg};
  border: 1px solid ${designTokens.colors.primary[100]};
`;

const marketGridStyles = css`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: ${designTokens.spacing[5]};
`;

const marketCardStyles = css`
  position: relative;
  transition: all 0.3s ease;
  border-left: 4px solid ${designTokens.colors.primary[500]};

  &:hover {
    transform: translateY(-4px);
    box-shadow: ${shadowSystem.xl};
  }
`;

const statusBadgeStyles = (isActive: boolean) => css`
  display: inline-flex;
  align-items: center;
  gap: ${designTokens.spacing[1]};
  padding: ${designTokens.spacing[1]} ${designTokens.spacing[3]};
  background: ${isActive 
    ? designTokens.colors.semantic.success[50] 
    : designTokens.colors.neutral[100]};
  color: ${isActive 
    ? designTokens.colors.semantic.success[700] 
    : designTokens.colors.neutral[600]};
  border-radius: ${designTokens.borderRadius.full};
  font-size: ${designTokens.typography.fontSize.xs};
  font-weight: ${designTokens.typography.fontWeight.semibold};
`;

const timeRemainingStyles = css`
  display: flex;
  align-items: center;
  gap: ${designTokens.spacing[2]};
  font-size: ${designTokens.typography.fontSize.sm};
  color: ${designTokens.colors.neutral[500]};
  margin-top: ${designTokens.spacing[2]};
`;

const leaderboardStyles = css`
  background: ${designTokens.colors.neutral[0]};
  border-radius: ${designTokens.borderRadius.lg};
  overflow: hidden;
`;

const leaderboardRowStyles = (rank: number) => css`
  display: grid;
  grid-template-columns: 50px 1fr 100px 80px;
  gap: ${designTokens.spacing[4]};
  padding: ${designTokens.spacing[3]} ${designTokens.spacing[4]};
  border-bottom: 1px solid ${designTokens.colors.neutral[100]};
  background: ${rank <= 3 
    ? `linear-gradient(90deg, ${designTokens.colors.semantic.success[50]} 0%, transparent 100%)` 
    : 'transparent'};

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: ${designTokens.colors.neutral[50]};
  }
`;

const rankBadgeStyles = (rank: number) => css`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-weight: ${designTokens.typography.fontWeight.bold};
  font-size: ${designTokens.typography.fontSize.sm};
  ${rank === 1 && `background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); color: white;`}
  ${rank === 2 && `background: linear-gradient(135deg, #C0C0C0 0%, #A0A0A0 100%); color: white;`}
  ${rank === 3 && `background: linear-gradient(135deg, #CD7F32 0%, #8B4513 100%); color: white;`}
  ${rank > 3 && `background: ${designTokens.colors.neutral[100]}; color: ${designTokens.colors.neutral[600]};`}
`;

import { sapienceApi as sapienceBackendApi } from '../../services/apiService';

export default function SapienceMarkets() {
  const { conditions, stats, leaderboard, isLoading, error, lastUpdated, refresh } = useSapienceData();
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const handleForecast = async (conditionId: string, question: string) => {
    const probabilityStr = prompt(`Enter probability (0-100) for:\n"${question}"`);
    if (!probabilityStr) return;
    
    const probability = parseInt(probabilityStr, 10);
    if (isNaN(probability) || probability < 0 || probability > 100) {
      alert("Invalid probability");
      return;
    }

    const reasoning = prompt("Enter reasoning (optional):") || "Manual forecast";

    try {
      setSubmittingId(conditionId);
      const result = await sapienceBackendApi.submitForecast({
          conditionId,
          probability,
          reasoning,
          confidence: 1.0
      });

      if (result.success) {
        alert("Forecast submitted successfully!");
        refresh(); // Refresh data
      } else {
        alert(`Error: ${result.error || 'Submission failed'}`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to submit forecast");
    } finally {
      setSubmittingId(null);
    }
  };

  if (isLoading && conditions.length === 0) {
    return (
      <div css={containerStyles}>
        <div css={css`
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 300px;
        `}>
          <div css={css`
            text-align: center;
            ${keyframeAnimations.fadeInUp}
          `}>
            <div css={css`
              width: 48px;
              height: 48px;
              border: 3px solid ${designTokens.colors.neutral[200]};
              border-top: 3px solid ${designTokens.colors.primary[500]};
              border-radius: 50%;
              animation: spin 1s linear infinite;
              margin: 0 auto ${designTokens.spacing[4]};
              
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `} />
            <p css={textStyles.description}>Loading Sapience markets...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div css={containerStyles}>
        <Card variant="elevated">
          <CardContent>
            <div css={css`text-align: center; padding: ${designTokens.spacing[6]};`}>
              <p css={css`color: ${designTokens.colors.semantic.error[600]}; margin-bottom: ${designTokens.spacing[4]};`}>
                ⚠️ {error}
              </p>
              <button css={buttonStyles.primary} onClick={refresh}>
                Retry
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div css={containerStyles}>
      {/* Platform Stats */}
      {stats && (
        <div css={statsGridStyles}>
          <div css={statCardStyles}>
            <div css={css`
              font-size: ${designTokens.typography.fontSize['2xl']};
              font-weight: ${designTokens.typography.fontWeight.bold};
              color: ${designTokens.colors.primary[600]};
            `}>
              {stats.activeConditions}
            </div>
            <div css={textStyles.description}>Active Markets</div>
          </div>
          <div css={statCardStyles}>
            <div css={css`
              font-size: ${designTokens.typography.fontSize['2xl']};
              font-weight: ${designTokens.typography.fontWeight.bold};
              color: ${designTokens.colors.secondary[600]};
            `}>
              {stats.totalForecasts.toLocaleString()}
            </div>
            <div css={textStyles.description}>Total Forecasts</div>
          </div>
          <div css={statCardStyles}>
            <div css={css`
              font-size: ${designTokens.typography.fontSize['2xl']};
              font-weight: ${designTokens.typography.fontWeight.bold};
              color: ${designTokens.colors.semantic.success[600]};
            `}>
              {stats.totalConditions}
            </div>
            <div css={textStyles.description}>All-Time Markets</div>
          </div>
        </div>
      )}

      {/* Section Header */}
      <div css={css`
        display: flex;
        justify-content: space-between;
        align-items: center;
      `}>
        <h2 css={css`
          font-size: ${designTokens.typography.fontSize.xl};
          font-weight: ${designTokens.typography.fontWeight.bold};
        `}>
          🔮 Active Prediction Markets
        </h2>
        <div css={css`display: flex; align-items: center; gap: ${designTokens.spacing[3]};`}>
          {lastUpdated && (
            <span css={css`
              font-size: ${designTokens.typography.fontSize.xs};
              color: ${designTokens.colors.neutral[500]};
            `}>
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button css={buttonStyles.secondary} onClick={refresh}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Markets Grid */}
      <div css={marketGridStyles}>
        {conditions.map((condition) => {
          const timeRemaining = getTimeRemaining(condition.endTime);
          const isActive = condition.endTime > Date.now() / 1000;

          return (
            <Card key={condition.id} variant="elevated" css={marketCardStyles}>
              <CardContent>
                <div css={css`
                  display: flex;
                  justify-content: space-between;
                  align-items: flex-start;
                  margin-bottom: ${designTokens.spacing[3]};
                `}>
                  <span css={statusBadgeStyles(isActive)}>
                    {isActive && <span css={css`
                      width: 6px;
                      height: 6px;
                      background: ${designTokens.colors.semantic.success[500]};
                      border-radius: 50%;
                      ${keyframeAnimations.pulse}
                    `} />}
                    {isActive ? 'LIVE' : 'ENDED'}
                  </span>
                  
                  {isActive && (
                    <span css={css`
                      font-size: 0.65rem;
                      font-weight: 800;
                      color: ${designTokens.colors.primary[600]};
                      background: ${designTokens.colors.primary[50]};
                      padding: 2px 8px;
                      border-radius: 4px;
                      text-transform: uppercase;
                    `}>
                      Strategy: Horizon-Weighted
                    </span>
                  )}
                </div>

                <CardTitle css={css`
                  font-size: ${designTokens.typography.fontSize.base};
                  line-height: 1.4;
                  margin-bottom: ${designTokens.spacing[2]};
                  min-height: 2.8em;
                  display: -webkit-box;
                  -webkit-line-clamp: 2;
                  -webkit-box-orient: vertical;
                  overflow: hidden;
                `}>
                  {condition.shortName || condition.question}
                </CardTitle>

                <div css={css`
                  display: flex;
                  flex-direction: column;
                  gap: 8px;
                  margin-bottom: 16px;
                `}>
                  <div css={timeRemainingStyles}>
                    <span>⏱️</span>
                    <span>Ends: {timeRemaining}</span>
                  </div>
                  
                  <div css={css`
                    font-size: 0.75rem;
                    color: ${designTokens.colors.neutral[500]};
                    display: flex;
                    align-items: center;
                    gap: 6px;
                  `}>
                    <span>📈</span>
                    <span>Horizon Weight: <strong>{((condition.endTime - (Date.now()/1000)) / 86400).toFixed(1)}x</strong></span>
                  </div>
                </div>

                <div css={css`
                  display: flex;
                  gap: ${designTokens.spacing[2]};
                  margin-top: auto;
                `}>
                  <button 
                    css={css`flex: 1; ${buttonStyles.primary}`}
                    onClick={() => handleForecast(condition.id, condition.shortName || condition.question)}
                    disabled={!!submittingId}
                  >
                    {submittingId === condition.id ? 'Submitting...' : 'Submit Forecast'}
                  </button>
                  <a 
                    href={`https://sapience.xyz/markets/${condition.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    css={css`${buttonStyles.secondary}; text-decoration: none;`}
                  >
                    View
                  </a>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {conditions.length === 0 && (
          <div css={css`
            grid-column: 1 / -1;
            text-align: center;
            padding: ${designTokens.spacing[8]};
          `}>
            <p css={textStyles.description}>No active markets available</p>
          </div>
        )}
      </div>

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <div>
          <h2 css={css`
            font-size: ${designTokens.typography.fontSize.xl};
            font-weight: ${designTokens.typography.fontWeight.bold};
            margin-bottom: ${designTokens.spacing[4]};
          `}>
            🏆 Accuracy Leaderboard
          </h2>
          
          <Card variant="elevated">
            <div css={leaderboardStyles}>
              <div css={css`
                display: grid;
                grid-template-columns: 50px 1fr 100px 80px;
                gap: ${designTokens.spacing[4]};
                padding: ${designTokens.spacing[3]} ${designTokens.spacing[4]};
                background: ${designTokens.colors.neutral[100]};
                font-size: ${designTokens.typography.fontSize.xs};
                font-weight: ${designTokens.typography.fontWeight.semibold};
                text-transform: uppercase;
                color: ${designTokens.colors.neutral[600]};
              `}>
                <span>Rank</span>
                <span>Forecaster</span>
                <span>Brier Score</span>
                <span>Count</span>
              </div>
              
              {leaderboard.map((entry) => (
                <div key={entry.address} css={leaderboardRowStyles(entry.rank)}>
                  <div css={rankBadgeStyles(entry.rank)}>
                    {entry.rank}
                  </div>
                  <div css={css`
                    display: flex;
                    align-items: center;
                    font-family: monospace;
                    font-size: ${designTokens.typography.fontSize.sm};
                  `}>
                    {entry.address.slice(0, 6)}...{entry.address.slice(-4)}
                  </div>
                  <div css={css`
                    font-weight: ${designTokens.typography.fontWeight.semibold};
                    color: ${entry.brierScore < 0.2 
                      ? designTokens.colors.semantic.success[600] 
                      : designTokens.colors.neutral[700]};
                  `}>
                    {entry.brierScore.toFixed(4)}
                  </div>
                  <div css={css`color: ${designTokens.colors.neutral[600]};`}>
                    {entry.forecastCount}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Link to Sapience */}
      <div css={css`
        text-align: center;
        padding: ${designTokens.spacing[4]};
        background: ${designTokens.colors.neutral[50]};
        border-radius: ${designTokens.borderRadius.lg};
      `}>
        <p css={css`
          font-size: ${designTokens.typography.fontSize.sm};
          color: ${designTokens.colors.neutral[600]};
          margin-bottom: ${designTokens.spacing[2]};
        `}>
          Powered by Sapience Protocol
        </p>
        <a 
          href="https://sapience.xyz"
          target="_blank"
          rel="noopener noreferrer"
          css={css`
            color: ${designTokens.colors.primary[600]};
            font-weight: ${designTokens.typography.fontWeight.medium};
            text-decoration: none;
            &:hover { text-decoration: underline; }
          `}
        >
          sapience.xyz →
        </a>
      </div>
    </div>
  );
}
