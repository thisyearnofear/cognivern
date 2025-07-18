import { useState } from "react";
import { css } from '@emotion/react';
import { designTokens, tradingStyles } from '../../styles/designTokens';
import { AgentType, VincentStatus } from '../../types';
import { useAgentData, useTradingData } from '../../hooks/useAgentData';
import AgentTypeSelector from "./AgentTypeSelector";
import VincentConsentFlow from "./VincentConsentFlow";
import PolicyConfiguration from "./PolicyConfiguration";
import TradingChart from "./TradingChart";
import TradeHistory from "./TradeHistory";
import AgentStats from "./AgentStats";

export default function TradingAgentDashboard() {
  const [selectedAgentType, setSelectedAgentType] = useState<AgentType>("recall");
  
  // Use consolidated hooks instead of duplicate state management
  const { 
    status: agentStatus, 
    isLoading: agentLoading, 
    error: agentError,
    startAgent,
    stopAgent 
  } = useAgentData(selectedAgentType);
  
  const { 
    decisions: tradingDecisions, 
    isLoading: tradingLoading,
    error: tradingError 
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

  const dashboardStyles = css`
    ${tradingStyles.dashboardContainer}
  `;

  const headerStyles = css`
    text-align: center;
    margin-bottom: ${designTokens.spacing[8]};
    
    h2 {
      font-size: ${designTokens.typography.fontSize['3xl']};
      font-weight: ${designTokens.typography.fontWeight.bold};
      background: linear-gradient(45deg, #fff, #e0e7ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: ${designTokens.spacing[2]};
    }
    
    p {
      color: rgba(255, 255, 255, 0.8);
      font-size: ${designTokens.typography.fontSize.lg};
    }
  `;

  const errorStyles = css`
    background: ${designTokens.colors.semantic.errorBg};
    color: ${designTokens.colors.semantic.error};
    padding: ${designTokens.spacing[4]};
    border-radius: ${designTokens.borderRadius.lg};
    margin-bottom: ${designTokens.spacing[4]};
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;

  return (
    <div css={dashboardStyles}>
      <div css={headerStyles}>
        <h2>🚀 AI Trading Agent Dashboard</h2>
        <p>
          Monitor and control your AI trading agents with governance oversight
        </p>
      </div>

      {/* Agent Type Selector */}
      <AgentTypeSelector
        selectedType={selectedAgentType}
        onTypeChange={handleAgentTypeChange}
        recallStatus={agentStatus}
        vincentStatus={vincentStatus}
      />

      {error && (
        <div css={errorStyles}>
          <span>⚠️ {error}</span>
        </div>
      )}

      {/* Vincent-specific components */}
      {selectedAgentType === "vincent" && (
        <div css={css`margin-bottom: ${designTokens.spacing[6]};`}>
          {!vincentStatus.hasConsent && (
            <VincentConsentFlow
              appId={vincentStatus.appId}
              onConsent={handleVincentConsent}
            />
          )}

          {vincentStatus.hasConsent && (
            <PolicyConfiguration
              policies={vincentStatus.policies}
              onUpdate={handlePolicyUpdate}
            />
          )}
        </div>
      )}

      {/* Agent Stats - Reused for both types */}
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

      {/* Trading Chart - Reused for both types */}
      <TradingChart
        decisions={tradingDecisions}
        agentType={selectedAgentType}
        isLoading={isLoading}
      />

      {/* Trade History - Enhanced for both types */}
      <TradeHistory
        decisions={tradingDecisions}
        agentType={selectedAgentType}
        isLoading={isLoading}
      />
    </div>
  );
}