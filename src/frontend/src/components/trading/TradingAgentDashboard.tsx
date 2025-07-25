import { useState } from "react";
import { css } from "@emotion/react";
import {
  designTokens,
  colorSystem,
  shadowSystem,
  keyframeAnimations,
  layoutUtils,
} from "../../styles/design-system";
import { AgentType, VincentStatus } from "../../types";
import { useAgentData, useTradingData } from "../../hooks/useAgentData";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../ui/Card";
import AgentTypeSelector from "./AgentTypeSelector";
import VincentConsentFlow from "./VincentConsentFlow";
import PolicyConfiguration from "./PolicyConfiguration";
import TradingChart from "./TradingChart";
import TradeHistory from "./TradeHistory";
import AgentStats from "./AgentStats";

export default function TradingAgentDashboard() {
  const [selectedAgentType, setSelectedAgentType] =
    useState<AgentType>("recall");

  // Use consolidated hooks instead of duplicate state management
  const {
    status: agentStatus,
    isLoading: agentLoading,
    error: agentError,
    startAgent,
    stopAgent,
  } = useAgentData(selectedAgentType);

  const {
    decisions: tradingDecisions,
    isLoading: tradingLoading,
    error: tradingError,
  } = useTradingData(selectedAgentType);

  const isLoading = agentLoading || tradingLoading;
  const error = agentError || tradingError;

  const [vincentStatus, setVincentStatus] = useState<VincentStatus>({
    isConnected: false,
    hasConsent: false,
    appId: "827",
    policies: {
      dailySpendingLimit: 500,
      allowedTokens: ["ETH", "USDC", "WBTC"],
      maxTradeSize: 200,
    },
    isConfigured: false,
  });

  const handleAgentTypeChange = (agentType: AgentType) => {
    setSelectedAgentType(agentType);
  };

  const handleVincentConsent = async (consent: boolean) => {
    if (consent) {
      setVincentStatus((prev) => ({
        ...prev,
        hasConsent: true,
        isConfigured: true,
      }));
    }
  };

  const handlePolicyUpdate = async (newPolicies: any) => {
    setVincentStatus((prev) => ({
      ...prev,
      policies: newPolicies,
    }));
  };

  const containerStyles = css`
    ${layoutUtils.container}
    padding: ${designTokens.spacing[6]};
    min-height: 100vh;
    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  `;

  const heroStyles = css`
    text-align: center;
    margin-bottom: ${designTokens.spacing[8]};
    ${keyframeAnimations.fadeInUp}
  `;

  const heroTitleStyles = css`
    font-size: clamp(2rem, 5vw, 3.5rem);
    font-weight: ${designTokens.typography.fontWeight.bold};
    line-height: ${designTokens.typography.lineHeight.tight};
    background: ${colorSystem.gradients.primary};
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: ${designTokens.spacing[4]};
  `;

  const heroSubtitleStyles = css`
    font-size: ${designTokens.typography.fontSize.xl};
    color: ${designTokens.colors.neutral[600]};
    max-width: 700px;
    margin: 0 auto ${designTokens.spacing[6]};
  `;

  const gridStyles = css`
    display: grid;
    gap: ${designTokens.spacing[6]};
    margin-bottom: ${designTokens.spacing[8]};
  `;

  const errorCardStyles = css`
    background: ${colorSystem.semantic.error.background};
    border: 1px solid ${colorSystem.semantic.error.border};
    border-radius: ${designTokens.borderRadius.lg};
    padding: ${designTokens.spacing[4]};
    margin-bottom: ${designTokens.spacing[6]};
    ${shadowSystem.sm}
  `;

  return (
    <div css={containerStyles}>
      {/* Hero Section */}
      <div css={heroStyles}>
        <h1 css={heroTitleStyles}>🚀 AI Trading Agent Dashboard</h1>
        <p css={heroSubtitleStyles}>
          Monitor and control your AI trading agents with enterprise-grade
          governance oversight and real-time performance tracking
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <Card css={errorCardStyles}>
          <CardContent>
            <div
              css={css`
                display: flex;
                align-items: center;
                gap: ${designTokens.spacing[3]};
              `}
            >
              <span
                css={css`
                  font-size: 1.5rem;
                `}
              >
                ⚠️
              </span>
              <div>
                <h3
                  css={css`
                    margin: 0;
                    color: ${colorSystem.semantic.error.text};
                  `}
                >
                  Connection Error
                </h3>
                <p
                  css={css`
                    margin: 0;
                    color: ${colorSystem.semantic.error.text};
                    opacity: 0.8;
                  `}
                >
                  {error}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent Type Selector */}
      <div css={gridStyles}>
        <AgentTypeSelector
          selectedType={selectedAgentType}
          onTypeChange={handleAgentTypeChange}
          recallStatus={agentStatus}
          vincentStatus={vincentStatus}
        />
      </div>

      {/* Vincent-specific components */}
      {selectedAgentType === "vincent" && (
        <div css={gridStyles}>
          {!vincentStatus.hasConsent && (
            <Card>
              <CardHeader>
                <CardTitle>🔐 Vincent Agent Setup</CardTitle>
                <CardDescription>
                  Configure consent and policies for your Vincent social trading
                  agent
                </CardDescription>
              </CardHeader>
              <CardContent>
                <VincentConsentFlow
                  appId={vincentStatus.appId}
                  onConsent={handleVincentConsent}
                />
              </CardContent>
            </Card>
          )}

          {vincentStatus.hasConsent && (
            <Card>
              <CardHeader>
                <CardTitle>⚙️ Policy Configuration</CardTitle>
                <CardDescription>
                  Manage trading policies and risk parameters
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PolicyConfiguration
                  policies={vincentStatus.policies}
                  onUpdate={handlePolicyUpdate}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Main Dashboard Grid */}
      <div
        css={css`
          display: grid;
          grid-template-columns: 1fr;
          gap: ${designTokens.spacing[6]};

          @media (min-width: 1024px) {
            grid-template-columns: 1fr 1fr;
          }
        `}
      >
        {/* Agent Stats */}
        <Card>
          <CardHeader>
            <CardTitle>📊 Agent Performance</CardTitle>
            <CardDescription>
              Real-time metrics and control panel
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AgentStats
              agentType={selectedAgentType}
              status={agentStatus}
              vincentStatus={
                selectedAgentType === "vincent" ? vincentStatus : undefined
              }
              onStart={startAgent}
              onStop={stopAgent}
              isLoading={isLoading}
            />
          </CardContent>
        </Card>

        {/* Trading Chart */}
        <Card>
          <CardHeader>
            <CardTitle>📈 Trading Performance</CardTitle>
            <CardDescription>
              Live trading decisions and market analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TradingChart
              decisions={tradingDecisions}
              agentType={selectedAgentType}
              isLoading={isLoading}
            />
          </CardContent>
        </Card>
      </div>

      {/* Trade History - Full Width */}
      <Card
        css={css`
          margin-top: ${designTokens.spacing[6]};
        `}
      >
        <CardHeader>
          <CardTitle>📋 Trading History</CardTitle>
          <CardDescription>
            Complete record of all trading decisions and executions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TradeHistory
            decisions={tradingDecisions}
            agentType={selectedAgentType}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
