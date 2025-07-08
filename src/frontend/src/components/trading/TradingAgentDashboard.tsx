import { useState, useEffect } from "react";
import "./TradingAgentDashboard.css";
import AgentTypeSelector from "./AgentTypeSelector";
import VincentConsentFlow from "./VincentConsentFlow";
import PolicyConfiguration from "./PolicyConfiguration";
import TradingChart from "./TradingChart";
import TradeHistory from "./TradeHistory";
import AgentStats from "./AgentStats";

export type AgentType = "recall" | "vincent";

interface TradingDecision {
  action: "buy" | "sell" | "hold";
  symbol: string;
  quantity: number;
  price: number;
  confidence: number;
  reasoning: string;
  riskScore: number;
  timestamp: string;
  agentType: AgentType;
  sentimentData?: {
    sentiment: number;
    confidence: number;
    sources: string[];
  };
}

interface AgentStatus {
  isActive: boolean;
  lastUpdate: string;
  tradesExecuted: number;
  performance: {
    totalReturn: number;
    winRate: number;
    sharpeRatio: number;
  };
}

interface VincentStatus {
  isConnected: boolean;
  hasConsent: boolean;
  appId: string;
  delegateeAddress?: string;
  policies: {
    dailySpendingLimit: number;
    allowedTokens: string[];
    maxTradeSize: number;
  };
}

export default function TradingAgentDashboard() {
  const [selectedAgentType, setSelectedAgentType] =
    useState<AgentType>("recall");
  const [tradingDecisions, setTradingDecisions] = useState<TradingDecision[]>(
    []
  );
  const [agentStatus, setAgentStatus] = useState<AgentStatus>({
    isActive: false,
    lastUpdate: new Date().toISOString(),
    tradesExecuted: 0,
    performance: {
      totalReturn: 0,
      winRate: 0,
      sharpeRatio: 0,
    },
  });
  const [vincentStatus, setVincentStatus] = useState<VincentStatus>({
    isConnected: false,
    hasConsent: false,
    appId: "827",
    policies: {
      dailySpendingLimit: 500,
      allowedTokens: ["ETH", "USDC", "WBTC"],
      maxTradeSize: 200,
    },
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAgentData();
    const interval = setInterval(fetchAgentData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [selectedAgentType]);

  const fetchAgentData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const apiKey = import.meta.env.VITE_API_KEY || "development-api-key";
      const headers = { "X-API-KEY": apiKey };

      if (selectedAgentType === "recall") {
        await fetchRecallAgentData(headers);
      } else {
        await fetchVincentAgentData(headers);
      }
    } catch (err) {
      setError(`Failed to fetch ${selectedAgentType} agent data`);
      console.error("Error fetching agent data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRecallAgentData = async (headers: Record<string, string>) => {
    // Fetch Recall trading decisions
    const decisionsResponse = await fetch(
      "/api/proxy/agents/recall/decisions",
      { headers }
    );
    if (decisionsResponse.ok) {
      const decisions = await decisionsResponse.json();
      setTradingDecisions(
        decisions.map((d: any) => ({ ...d, agentType: "recall" }))
      );
    }

    // Fetch Recall agent status
    const statusResponse = await fetch("/api/proxy/agents/recall/status", {
      headers,
    });
    if (statusResponse.ok) {
      const status = await statusResponse.json();
      setAgentStatus(status);
    }
  };

  const fetchVincentAgentData = async (headers: Record<string, string>) => {
    // Fetch Vincent trading decisions
    const decisionsResponse = await fetch(
      "/api/proxy/agents/vincent/decisions",
      {
        headers,
      }
    );
    if (decisionsResponse.ok) {
      const decisions = await decisionsResponse.json();
      setTradingDecisions(
        decisions.map((d: any) => ({ ...d, agentType: "vincent" }))
      );
    }

    // Fetch Vincent agent status
    const statusResponse = await fetch("/api/proxy/agents/vincent/status", {
      headers,
    });
    if (statusResponse.ok) {
      const status = await statusResponse.json();
      setAgentStatus(status.agentStatus);
      setVincentStatus(status.vincentStatus);
    }
  };

  const handleAgentTypeChange = (agentType: AgentType) => {
    setSelectedAgentType(agentType);
    setTradingDecisions([]); // Clear previous data
  };

  const handleVincentConsent = async () => {
    try {
      // Redirect to Vincent consent page
      const consentUrl = `https://dashboard.heyvincent.ai/appId/827/consent?redirectUri=${encodeURIComponent(window.location.origin + "/vincent/callback")}`;
      window.location.href = consentUrl;
    } catch (err) {
      setError("Failed to initiate Vincent consent flow");
    }
  };

  const handlePolicyUpdate = async (policies: any) => {
    try {
      const apiKey = import.meta.env.VITE_API_KEY || "development-api-key";
      const response = await fetch("/api/proxy/agents/vincent/policies", {
        method: "POST",
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(policies),
      });

      if (response.ok) {
        setVincentStatus((prev) => ({ ...prev, policies }));
      }
    } catch (err) {
      setError("Failed to update policies");
    }
  };

  const startAgent = async () => {
    try {
      const apiKey = import.meta.env.VITE_API_KEY || "development-api-key";
      const endpoint =
        selectedAgentType === "recall"
          ? "/api/agents/recall/start"
          : "/api/agents/vincent/start";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "X-API-KEY": apiKey },
      });

      if (response.ok) {
        setAgentStatus((prev) => ({ ...prev, isActive: true }));
      }
    } catch (err) {
      setError(`Failed to start ${selectedAgentType} agent`);
    }
  };

  const stopAgent = async () => {
    try {
      const apiKey = import.meta.env.VITE_API_KEY || "development-api-key";
      const endpoint =
        selectedAgentType === "recall"
          ? "/api/agents/recall/stop"
          : "/api/agents/vincent/stop";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "X-API-KEY": apiKey },
      });

      if (response.ok) {
        setAgentStatus((prev) => ({ ...prev, isActive: false }));
      }
    } catch (err) {
      setError(`Failed to stop ${selectedAgentType} agent`);
    }
  };

  return (
    <div className="trading-agent-dashboard">
      <div className="dashboard-header">
        <h2>🤖 AI Trading Agent Dashboard</h2>
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
        <div className="error-banner">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Vincent-specific components */}
      {selectedAgentType === "vincent" && (
        <div className="vincent-section">
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
