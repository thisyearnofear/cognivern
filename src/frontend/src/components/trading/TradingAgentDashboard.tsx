import { useState } from "react";
import { css } from "@emotion/react";
import {
  designTokens,
  shadowSystem,
  keyframeAnimations,
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
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import VincentConsentFlow from "./VincentConsentFlow";
import PolicyConfiguration from "./PolicyConfiguration";
import TradingChart from "./TradingChart";
import TradeHistory from "./TradeHistory";

export default function TradingAgentDashboard() {
  const [selectedAgentType, setSelectedAgentType] = useState<AgentType>("recall");
  const [showComparison, setShowComparison] = useState(false);

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
    max-width: 1400px;
    margin: 0 auto;
    padding: ${designTokens.spacing[6]};
    min-height: 100vh;
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  `;

  const headerStyles = css`
    text-align: center;
    margin-bottom: ${designTokens.spacing[8]};
    ${keyframeAnimations.fadeInUp}
  `;

  const titleStyles = css`
    font-size: ${designTokens.typography.fontSize['4xl']};
    font-weight: ${designTokens.typography.fontWeight.bold};
    background: linear-gradient(135deg, #1e293b, #475569);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: ${designTokens.spacing[3]};
  `;

  const subtitleStyles = css`
    font-size: ${designTokens.typography.fontSize.lg};
    color: ${designTokens.colors.neutral[600]};
    max-width: 600px;
    margin: 0 auto;
  `;

  const agentSelectorStyles = css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: ${designTokens.spacing[4]};
    margin-bottom: ${designTokens.spacing[8]};
  `;

  const agentCardStyles = (isSelected: boolean) => css`
    position: relative;
    cursor: pointer;
    transition: all 0.3s ease;
    border: 2px solid ${isSelected ? designTokens.colors.primary[500] : 'transparent'};
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: ${shadowSystem.lg};
    }
    
    ${isSelected && css`
      box-shadow: ${shadowSystem.lg};
      background: linear-gradient(135deg, ${designTokens.colors.primary[50]} 0%, white 100%);
    `}
  `;

  const agentHeaderStyles = css`
    display: flex;
    align-items: center;
    gap: ${designTokens.spacing[3]};
    margin-bottom: ${designTokens.spacing[4]};
  `;

  const agentIconStyles = css`
    font-size: 2rem;
    width: 60px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${designTokens.colors.primary[100]};
    border-radius: ${designTokens.borderRadius.xl};
  `;

  const agentInfoStyles = css`
    flex: 1;
  `;

  const agentNameStyles = css`
    font-size: ${designTokens.typography.fontSize.xl};
    font-weight: ${designTokens.typography.fontWeight.bold};
    margin-bottom: ${designTokens.spacing[1]};
    color: ${designTokens.colors.neutral[900]};
  `;

  const agentDescStyles = css`
    color: ${designTokens.colors.neutral[600]};
    font-size: ${designTokens.typography.fontSize.sm};
  `;

  const statusBadgeStyles = css`
    display: flex;
    align-items: center;
    gap: ${designTokens.spacing[1]};
  `;

  const featuresGridStyles = css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: ${designTokens.spacing[3]};
    margin-bottom: ${designTokens.spacing[4]};
  `;

  const featureStyles = css`
    display: flex;
    align-items: center;
    gap: ${designTokens.spacing[2]};
    padding: ${designTokens.spacing[2]};
    background: ${designTokens.colors.neutral[50]};
    border-radius: ${designTokens.borderRadius.md};
    font-size: ${designTokens.typography.fontSize.sm};
  `;

  const statsRowStyles = css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: ${designTokens.spacing[4]};
    border-top: 1px solid ${designTokens.colors.neutral[200]};
  `;

  const statStyles = css`
    text-align: center;
  `;

  const statValueStyles = css`
    font-weight: ${designTokens.typography.fontWeight.bold};
    color: ${designTokens.colors.primary[600]};
    font-size: ${designTokens.typography.fontSize.lg};
  `;

  const statLabelStyles = css`
    font-size: ${designTokens.typography.fontSize.xs};
    color: ${designTokens.colors.neutral[500]};
    text-transform: uppercase;
    letter-spacing: 0.05em;
  `;

  const dashboardGridStyles = css`
    display: grid;
    grid-template-columns: 1fr;
    gap: ${designTokens.spacing[6]};
    margin-bottom: ${designTokens.spacing[8]};

    @media (min-width: 1024px) {
      grid-template-columns: 1fr 1fr;
    }
  `;

  const errorStyles = css`
    background: ${designTokens.colors.semantic.error[50]};
    border: 1px solid ${designTokens.colors.semantic.error[200]};
    border-radius: ${designTokens.borderRadius.lg};
    padding: ${designTokens.spacing[4]};
    margin-bottom: ${designTokens.spacing[6]};
    display: flex;
    align-items: center;
    gap: ${designTokens.spacing[3]};
  `;

  const getAgentStatus = (type: AgentType) => {
    if (type === "vincent" && !vincentStatus.hasConsent) {
      return { text: "Setup Required", variant: "warning" as const };
    }
    return agentStatus.isActive
      ? { text: "Active", variant: "success" as const }
      : { text: "Inactive", variant: "secondary" as const };
  };

  const canStartAgent = selectedAgentType === "recall" ||
    (selectedAgentType === "vincent" && vincentStatus.hasConsent);

  return (
    <div css={containerStyles}>
      {/* Header */}
      <div css={headerStyles}>
        <h1 css={titleStyles}>AI Trading Dashboard</h1>
        <p css={subtitleStyles}>
          Monitor and control your autonomous trading agents with real-time performance tracking
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div css={errorStyles}>
          <span css={css`font-size: 1.5rem;`}>⚠️</span>
          <div>
            <h3 css={css`margin: 0; color: ${designTokens.colors.semantic.error[700]};`}>
              Connection Error
            </h3>
            <p css={css`margin: 0; color: ${designTokens.colors.semantic.error[600]};`}>
              {error}
            </p>
          </div>
        </div>
      )}

      {/* Agent Selection */}
      <div css={agentSelectorStyles}>
        {/* Recall Agent */}
        <Card
          css={agentCardStyles(selectedAgentType === "recall")}
          onClick={() => handleAgentTypeChange("recall")}
        >
          <CardContent>
            <div css={agentHeaderStyles}>
              <div css={agentIconStyles}>🏆</div>
              <div css={agentInfoStyles}>
                <h3 css={agentNameStyles}>Recall Trading Agent</h3>
                <p css={agentDescStyles}>Competition-focused algorithmic trading</p>
              </div>
              <div css={statusBadgeStyles}>
                <Badge variant={getAgentStatus("recall").variant}>
                  {getAgentStatus("recall").text}
                </Badge>
              </div>
            </div>

            <div css={featuresGridStyles}>
              <div css={featureStyles}>
                <span>🎯</span>
                <span>Competition</span>
              </div>
              <div css={featureStyles}>
                <span>⚡</span>
                <span>High-Freq</span>
              </div>
              <div css={featureStyles}>
                <span>📊</span>
                <span>Real Data</span>
              </div>
            </div>

            <div css={statsRowStyles}>
              <div css={statStyles}>
                <div css={statValueStyles}>{agentStatus.tradesExecuted}</div>
                <div css={statLabelStyles}>Trades</div>
              </div>
              <div css={statStyles}>
                <div css={statValueStyles}>
                  {(agentStatus.performance.totalReturn * 100).toFixed(1)}%
                </div>
                <div css={statLabelStyles}>Return</div>
              </div>
              <div css={statStyles}>
                <div css={statValueStyles}>
                  {(agentStatus.performance.winRate * 100).toFixed(1)}%
                </div>
                <div css={statLabelStyles}>Win Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vincent Agent */}
        <Card
          css={agentCardStyles(selectedAgentType === "vincent")}
          onClick={() => handleAgentTypeChange("vincent")}
        >
          <CardContent>
            <div css={agentHeaderStyles}>
              <div css={agentIconStyles}>🧠</div>
              <div css={agentInfoStyles}>
                <h3 css={agentNameStyles}>Vincent Social Agent</h3>
                <p css={agentDescStyles}>Sentiment-driven social trading</p>
              </div>
              <div css={statusBadgeStyles}>
                <Badge variant={getAgentStatus("vincent").variant}>
                  {getAgentStatus("vincent").text}
                </Badge>
              </div>
            </div>

            <div css={featuresGridStyles}>
              <div css={featureStyles}>
                <span>💭</span>
                <span>Sentiment</span>
              </div>
              <div css={featureStyles}>
                <span>🛡️</span>
                <span>Policies</span>
              </div>
              <div css={featureStyles}>
                <span>🌐</span>
                <span>Multi-Chain</span>
              </div>
            </div>

            <div css={statsRowStyles}>
              <div css={statStyles}>
                <div css={statValueStyles}>${vincentStatus.policies.dailySpendingLimit}</div>
                <div css={statLabelStyles}>Daily Limit</div>
              </div>
              <div css={statStyles}>
                <div css={statValueStyles}>{vincentStatus.policies.allowedTokens.length}</div>
                <div css={statLabelStyles}>Tokens</div>
              </div>
              <div css={statStyles}>
                <div css={statValueStyles}>${vincentStatus.policies.maxTradeSize}</div>
                <div css={statLabelStyles}>Max Trade</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agent Comparison Toggle */}
      <div css={css`text-align: center; margin-bottom: ${designTokens.spacing[6]};`}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowComparison(!showComparison)}
        >
          {showComparison ? "Hide" : "Show"} Agent Comparison
        </Button>
      </div>

      {/* Agent Comparison Table */}
      {showComparison && (
        <Card css={css`margin-bottom: ${designTokens.spacing[8]};`}>
          <CardHeader>
            <CardTitle>Agent Comparison</CardTitle>
            <CardDescription>Compare features and capabilities</CardDescription>
          </CardHeader>
          <CardContent>
            <div css={css`
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: ${designTokens.spacing[2]};
              
              & > div {
                padding: ${designTokens.spacing[3]};
                border-bottom: 1px solid ${designTokens.colors.neutral[200]};
              }
              
              & > div:nth-of-type(3n+1) {
                font-weight: ${designTokens.typography.fontWeight.semibold};
                background: ${designTokens.colors.neutral[50]};
              }
            `}>
              <div>Feature</div>
              <div>Recall Agent</div>
              <div>Vincent Agent</div>

              <div>Trading Style</div>
              <div>Competition-focused</div>
              <div>Sentiment-driven</div>

              <div>Data Sources</div>
              <div>Market data, Technical analysis</div>
              <div>Social media, News, Sentiment</div>

              <div>Governance</div>
              <div>Platform policies</div>
              <div>User-defined policies</div>

              <div>Execution</div>
              <div>Recall API</div>
              <div>Vincent Framework + Lit Protocol</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vincent Setup */}
      {selectedAgentType === "vincent" && !vincentStatus.hasConsent && (
        <Card css={css`margin-bottom: ${designTokens.spacing[6]};`}>
          <CardHeader>
            <CardTitle>🔐 Vincent Agent Setup</CardTitle>
            <CardDescription>
              Configure consent and policies for your Vincent social trading agent
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

      {/* Vincent Policy Configuration */}
      {selectedAgentType === "vincent" && vincentStatus.hasConsent && (
        <Card css={css`margin-bottom: ${designTokens.spacing[6]};`}>
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

      {/* Main Dashboard */}
      <div css={dashboardGridStyles}>
        {/* Agent Control & Stats */}
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedAgentType === "recall" ? "🏆 Recall Agent" : "🧠 Vincent Agent"} Control
            </CardTitle>
            <CardDescription>
              Real-time status and performance metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Control Buttons */}
            <div css={css`
              display: flex;
              gap: ${designTokens.spacing[3]};
              margin-bottom: ${designTokens.spacing[6]};
            `}>
              {!agentStatus.isActive ? (
                <Button
                  variant="primary"
                  onClick={startAgent}
                  disabled={isLoading || !canStartAgent}
                  css={css`flex: 1;`}
                >
                  {isLoading ? "Starting..." : "▶️ Start Agent"}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={stopAgent}
                  disabled={isLoading}
                  css={css`flex: 1;`}
                >
                  {isLoading ? "Stopping..." : "⏹️ Stop Agent"}
                </Button>
              )}
            </div>

            {/* Status Grid */}
            <div css={css`
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
              gap: ${designTokens.spacing[4]};
            `}>
              <div css={css`text-align: center;`}>
                <div css={css`
                  font-size: ${designTokens.typography.fontSize['2xl']};
                  font-weight: ${designTokens.typography.fontWeight.bold};
                  color: ${agentStatus.isActive ? designTokens.colors.semantic.success[600] : designTokens.colors.neutral[500]};
                `}>
                  {agentStatus.isActive ? "●" : "○"}
                </div>
                <div css={css`
                  font-size: ${designTokens.typography.fontSize.sm};
                  color: ${designTokens.colors.neutral[600]};
                `}>
                  {agentStatus.isActive ? "Active" : "Inactive"}
                </div>
              </div>

              <div css={css`text-align: center;`}>
                <div css={css`
                  font-size: ${designTokens.typography.fontSize['2xl']};
                  font-weight: ${designTokens.typography.fontWeight.bold};
                  color: ${designTokens.colors.primary[600]};
                `}>
                  {agentStatus.tradesExecuted}
                </div>
                <div css={css`
                  font-size: ${designTokens.typography.fontSize.sm};
                  color: ${designTokens.colors.neutral[600]};
                `}>
                  Trades
                </div>
              </div>

              <div css={css`text-align: center;`}>
                <div css={css`
                  font-size: ${designTokens.typography.fontSize['2xl']};
                  font-weight: ${designTokens.typography.fontWeight.bold};
                  color: ${agentStatus.performance.totalReturn >= 0 ? designTokens.colors.semantic.success[600] : designTokens.colors.semantic.error[600]};
                `}>
                  {agentStatus.performance.totalReturn >= 0 ? "+" : ""}
                  {(agentStatus.performance.totalReturn * 100).toFixed(1)}%
                </div>
                <div css={css`
                  font-size: ${designTokens.typography.fontSize.sm};
                  color: ${designTokens.colors.neutral[600]};
                `}>
                  Return
                </div>
              </div>

              <div css={css`text-align: center;`}>
                <div css={css`
                  font-size: ${designTokens.typography.fontSize['2xl']};
                  font-weight: ${designTokens.typography.fontWeight.bold};
                  color: ${designTokens.colors.primary[600]};
                `}>
                  {(agentStatus.performance.winRate * 100).toFixed(0)}%
                </div>
                <div css={css`
                  font-size: ${designTokens.typography.fontSize.sm};
                  color: ${designTokens.colors.neutral[600]};
                `}>
                  Win Rate
                </div>
              </div>
            </div>

            {/* Warning for Vincent */}
            {selectedAgentType === "vincent" && !vincentStatus.hasConsent && (
              <div css={css`
                margin-top: ${designTokens.spacing[4]};
                padding: ${designTokens.spacing[3]};
                background: ${designTokens.colors.semantic.warning[50]};
                border: 1px solid ${designTokens.colors.semantic.warning[200]};
                border-radius: ${designTokens.borderRadius.md};
                display: flex;
                align-items: center;
                gap: ${designTokens.spacing[2]};
              `}>
                <span>⚠️</span>
                <span css={css`color: ${designTokens.colors.semantic.warning[700]};`}>
                  Vincent consent required before starting
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trading Chart */}
        <Card>
          <CardHeader>
            <CardTitle>📈 Performance Chart</CardTitle>
            <CardDescription>
              Trading decisions and market analysis
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

      {/* Trade History */}
      <Card>
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
