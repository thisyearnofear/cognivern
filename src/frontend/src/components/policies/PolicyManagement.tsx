import React, { useState, useEffect } from "react";
import { css } from "@emotion/react";
import {
  designTokens,
  shadowSystem,
  keyframeAnimations,
  colorSystem,
} from "../../styles/design-system";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { getApiUrl, getRequestHeaders } from "../../utils/api";

interface Policy {
  id: string;
  name: string;
  description: string;
  version: string;
  rules: PolicyRule[];
  metadata: Record<string, any>;
  status: "active" | "draft" | "archived";
  createdAt: string;
  updatedAt: string;
  appliedToAgents: string[];
  effectivenessScore: number;
  violationsPrevented: number;
}

interface PolicyRule {
  id: string;
  type: "ALLOW" | "DENY" | "REQUIRE" | "RATE_LIMIT";
  condition: string;
  action: string;
  metadata: Record<string, any>;
  priority: number;
  enabled: boolean;
}

interface PolicyTemplate {
  id: string;
  name: string;
  description: string;
  category: "trading" | "security" | "compliance" | "performance";
  rules: Omit<PolicyRule, "id">[];
  icon: string;
  complexity: "simple" | "moderate" | "advanced";
  estimatedSetupTime: string;
}

interface AgentConnection {
  id: string;
  name: string;
  type: "trading" | "analysis" | "monitoring";
  status: "connected" | "disconnected" | "error";
  lastActivity: string;
  policiesApplied: string[];
  healthScore?: number;
}

const policyTemplates: PolicyTemplate[] = [
  {
    id: "trading-risk-control",
    name: "Trading Risk Management",
    description:
      "Comprehensive risk controls for trading agents including position limits, stop-losses, and approval workflows.",
    category: "trading",
    icon: "📊",
    complexity: "moderate",
    estimatedSetupTime: "10-15 min",
    rules: [
      {
        type: "DENY",
        condition: "trade.amount > account.balance * 0.1",
        action: "block_trade",
        metadata: { reason: "Position size exceeds 10% of balance" },
        priority: 1,
        enabled: true,
      },
      {
        type: "REQUIRE",
        condition: "trade.riskScore > 0.8",
        action: "human_approval",
        metadata: { timeout: 300 },
        priority: 2,
        enabled: true,
      },
      {
        type: "RATE_LIMIT",
        condition: "agent.trades_per_hour",
        action: "limit_to_10",
        metadata: { window: 3600 },
        priority: 3,
        enabled: true,
      },
    ],
  },
  {
    id: "security-baseline",
    name: "Security Foundation",
    description:
      "Essential security controls including authentication, authorization, and audit logging.",
    category: "security",
    icon: "🔒",
    complexity: "simple",
    estimatedSetupTime: "5-10 min",
    rules: [
      {
        type: "REQUIRE",
        condition: "request.authenticated === true",
        action: "verify_identity",
        metadata: { method: "mfa" },
        priority: 1,
        enabled: true,
      },
      {
        type: "DENY",
        condition: 'request.source !== "authorized_network"',
        action: "block_request",
        metadata: { log_level: "high" },
        priority: 2,
        enabled: true,
      },
    ],
  },
  {
    id: "compliance-framework",
    name: "Regulatory Compliance",
    description:
      "Advanced compliance controls for regulated environments with audit trails and reporting.",
    category: "compliance",
    icon: "⚖️",
    complexity: "advanced",
    estimatedSetupTime: "20-30 min",
    rules: [
      {
        type: "REQUIRE",
        condition: "transaction.amount > 10000",
        action: "kyc_verification",
        metadata: { level: "enhanced" },
        priority: 1,
        enabled: true,
      },
      {
        type: "DENY",
        condition: 'user.jurisdiction === "restricted"',
        action: "block_access",
        metadata: { reason: "Regulatory restriction" },
        priority: 2,
        enabled: true,
      },
    ],
  },
];

const containerStyles = css`
  max-width: 1400px;
  margin: 0 auto;
  padding: ${designTokens.spacing[6]};
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  min-height: 100vh;
`;

const headerStyles = css`
  margin-bottom: ${designTokens.spacing[8]};
  text-align: center;
`;

const titleStyles = css`
  font-size: ${designTokens.typography.fontSize["3xl"]};
  font-weight: ${designTokens.typography.fontWeight.bold};
  color: ${designTokens.colors.neutral[900]};
  margin-bottom: ${designTokens.spacing[3]};
  background: linear-gradient(135deg, #1e293b, #475569);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
`;

const subtitleStyles = css`
  font-size: ${designTokens.typography.fontSize.lg};
  color: ${designTokens.colors.neutral[600]};
  max-width: 600px;
  margin: 0 auto;
`;

const tabsStyles = css`
  display: flex;
  justify-content: center;
  margin-bottom: ${designTokens.spacing[8]};
  background: white;
  border-radius: ${designTokens.borderRadius.xl};
  padding: ${designTokens.spacing[2]};
  box-shadow: ${shadowSystem.sm};
  border: 1px solid ${designTokens.colors.neutral[200]};
`;

const tabStyles = css`
  padding: ${designTokens.spacing[3]} ${designTokens.spacing[6]};
  border-radius: ${designTokens.borderRadius.lg};
  border: none;
  background: transparent;
  color: ${designTokens.colors.neutral[600]};
  font-weight: ${designTokens.typography.fontWeight.medium};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    color: ${designTokens.colors.primary[600]};
    background: ${designTokens.colors.primary[50]};
  }

  &.active {
    color: ${designTokens.colors.primary[700]};
    background: ${designTokens.colors.primary[100]};
    box-shadow: ${shadowSystem.sm};
  }
`;

const gridStyles = css`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: ${designTokens.spacing[6]};
  margin-bottom: ${designTokens.spacing[8]};
`;

const templateCardStyles = css`
  background: white;
  border-radius: ${designTokens.borderRadius.xl};
  padding: ${designTokens.spacing[6]};
  box-shadow: ${shadowSystem.md};
  border: 1px solid ${designTokens.colors.neutral[200]};
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;
  overflow: hidden;

  &:hover {
    transform: translateY(-4px);
    box-shadow: ${shadowSystem.lg};
    border-color: ${designTokens.colors.primary[300]};
  }

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(
      90deg,
      ${designTokens.colors.primary[500]},
      ${designTokens.colors.primary[600]}
    );
  }
`;

const templateIconStyles = css`
  font-size: 2.5rem;
  margin-bottom: ${designTokens.spacing[4]};
  display: block;
`;

const templateTitleStyles = css`
  font-size: ${designTokens.typography.fontSize.xl};
  font-weight: ${designTokens.typography.fontWeight.bold};
  color: ${designTokens.colors.neutral[900]};
  margin-bottom: ${designTokens.spacing[2]};
`;

const templateDescriptionStyles = css`
  color: ${designTokens.colors.neutral[600]};
  margin-bottom: ${designTokens.spacing[4]};
  line-height: 1.6;
`;

const templateMetaStyles = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${designTokens.spacing[4]};
`;

const complexityBadgeStyles = css`
  padding: ${designTokens.spacing[1]} ${designTokens.spacing[3]};
  border-radius: ${designTokens.borderRadius.full};
  font-size: ${designTokens.typography.fontSize.sm};
  font-weight: ${designTokens.typography.fontWeight.medium};

  &.simple {
    background: ${designTokens.colors.semantic.success[100]};
    color: ${designTokens.colors.semantic.success[700]};
  }

  &.moderate {
    background: ${designTokens.colors.semantic.warning[100]};
    color: ${designTokens.colors.semantic.warning[700]};
  }

  &.advanced {
    background: ${designTokens.colors.semantic.error[100]};
    color: ${designTokens.colors.semantic.error[700]};
  }
`;

const statsStyles = css`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${designTokens.spacing[4]};
  margin-bottom: ${designTokens.spacing[8]};
`;

const statCardStyles = css`
  background: white;
  border-radius: ${designTokens.borderRadius.lg};
  padding: ${designTokens.spacing[6]};
  text-align: center;
  box-shadow: ${shadowSystem.sm};
  border: 1px solid ${designTokens.colors.neutral[200]};
`;

const statValueStyles = css`
  font-size: ${designTokens.typography.fontSize["2xl"]};
  font-weight: ${designTokens.typography.fontWeight.bold};
  color: ${designTokens.colors.primary[600]};
  margin-bottom: ${designTokens.spacing[2]};
`;

const statLabelStyles = css`
  color: ${designTokens.colors.neutral[600]};
  font-size: ${designTokens.typography.fontSize.sm};
`;

const emptyStateStyles = css`
  text-align: center;
  padding: ${designTokens.spacing[12]};
  color: ${designTokens.colors.neutral[500]};
`;

export default function PolicyManagement() {
  const [activeTab, setActiveTab] = useState<
    "templates" | "policies" | "agents"
  >("templates");
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [agentConnections, setAgentConnections] = useState<AgentConnection[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalPolicies: 0,
    activePolicies: 0,
    connectedAgents: 0,
  });

  useEffect(() => {
    fetchPolicies();
    fetchAgentConnections();
  }, []);

  useEffect(() => {
    setStats({
      totalPolicies: policies.length,
      activePolicies: policies.filter((p) => p.status === "active").length,
      connectedAgents: agentConnections.filter((a) => a.status === "connected")
        .length,
    });
  }, [policies, agentConnections]);

  const fetchPolicies = async () => {
    try {
      const response = await fetch(getApiUrl("/api/governance/policies"), {
        headers: getRequestHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setPolicies(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching policies:", error);
      setPolicies([]);
    }
  };

  const fetchAgentConnections = async () => {
    try {
      const response = await fetch(getApiUrl("/api/agents/connections"), {
        headers: getRequestHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setAgentConnections(data.data || []);
      } else {
        console.warn("No agent connections available");
        setAgentConnections([]);
      }
    } catch (error) {
      console.error("Error fetching agent connections:", error);
      setAgentConnections([]);
    }
  };

  const createPolicyFromTemplate = async (template: PolicyTemplate) => {
    setLoading(true);
    try {
      const newPolicy = {
        name: template.name,
        description: template.description,
        rules: template.rules.map((rule, index) => ({
          ...rule,
          id: `rule-${Date.now()}-${index}`,
        })),
        status: "draft" as const,
        metadata: {
          category: template.category,
          complexity: template.complexity,
          createdFromTemplate: template.id,
        },
      };

      const response = await fetch(getApiUrl("/api/governance/policies"), {
        method: "POST",
        headers: {
          ...getRequestHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newPolicy),
      });

      if (response.ok) {
        await fetchPolicies();
        setActiveTab("policies");
      }
    } catch (error) {
      console.error("Error creating policy:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderTemplates = () => (
    <div>
      <div css={statsStyles}>
        <div css={statCardStyles}>
          <div css={statValueStyles}>{stats.totalPolicies}</div>
          <div css={statLabelStyles}>Total Policies</div>
        </div>
        <div css={statCardStyles}>
          <div css={statValueStyles}>{stats.activePolicies}</div>
          <div css={statLabelStyles}>Active Policies</div>
        </div>
        <div css={statCardStyles}>
          <div css={statValueStyles}>{stats.connectedAgents}</div>
          <div css={statLabelStyles}>Connected Agents</div>
        </div>
      </div>

      <div css={gridStyles}>
        {policyTemplates.map((template) => (
          <div
            key={template.id}
            css={templateCardStyles}
            onClick={() => createPolicyFromTemplate(template)}
          >
            <span css={templateIconStyles}>{template.icon}</span>
            <h3 css={templateTitleStyles}>{template.name}</h3>
            <p css={templateDescriptionStyles}>{template.description}</p>

            <div css={templateMetaStyles}>
              <span
                css={[complexityBadgeStyles, css`&.${template.complexity}`]}
              >
                {template.complexity}
              </span>
              <span
                style={{
                  fontSize: "0.875rem",
                  color: designTokens.colors.neutral[500],
                }}
              >
                ⏱️ {template.estimatedSetupTime}
              </span>
            </div>

            <div
              style={{
                fontSize: "0.875rem",
                color: designTokens.colors.neutral[600],
              }}
            >
              {template.rules.length} rules included
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderPolicies = () => (
    <div>
      {policies.length === 0 ? (
        <div css={emptyStateStyles}>
          <div
            style={{ fontSize: "3rem", marginBottom: designTokens.spacing[4] }}
          >
            📋
          </div>
          <h3>No policies created yet</h3>
          <p>Start by creating a policy from one of our templates</p>
          <Button
            onClick={() => setActiveTab("templates")}
            style={{ marginTop: designTokens.spacing[4] }}
          >
            Browse Templates
          </Button>
        </div>
      ) : (
        <div css={gridStyles}>
          {policies.map((policy) => (
            <Card key={policy.id}>
              <CardHeader>
                <CardTitle>{policy.name}</CardTitle>
                <CardDescription>{policy.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Badge
                    variant={
                      policy.status === "active" ? "success" : "secondary"
                    }
                  >
                    {policy.status}
                  </Badge>
                  <span
                    style={{
                      fontSize: "0.875rem",
                      color: designTokens.colors.neutral[500],
                    }}
                  >
                    {policy.rules.length} rules
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderAgents = () => (
    <div>
      {agentConnections.length === 0 ? (
        <div css={emptyStateStyles}>
          <div
            style={{ fontSize: "3rem", marginBottom: designTokens.spacing[4] }}
          >
            🤖
          </div>
          <h3>No agents connected</h3>
          <p>Connect your first agent to start applying policies</p>
          <Button style={{ marginTop: designTokens.spacing[4] }}>
            Connect Agent
          </Button>
        </div>
      ) : (
        <div css={gridStyles}>
          {agentConnections.map((agent) => (
            <Card key={agent.id}>
              <CardHeader>
                <CardTitle>{agent.name}</CardTitle>
                <CardDescription>Type: {agent.type}</CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Badge
                    variant={agent.status === "connected" ? "success" : "error"}
                  >
                    {agent.status}
                  </Badge>
                  <span
                    style={{
                      fontSize: "0.875rem",
                      color: designTokens.colors.neutral[500],
                    }}
                  >
                    {agent.policiesApplied.length} policies applied
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div css={containerStyles}>
      <div css={headerStyles}>
        <h1 css={titleStyles}>Policy Management</h1>
        <p css={subtitleStyles}>
          Create, manage, and monitor governance policies for your autonomous
          agents
        </p>
      </div>

      <div css={tabsStyles}>
        <button
          css={[tabStyles, activeTab === "templates" && css`&.active`]}
          onClick={() => setActiveTab("templates")}
        >
          📚 Policy Templates
        </button>
        <button
          css={[tabStyles, activeTab === "policies" && css`&.active`]}
          onClick={() => setActiveTab("policies")}
        >
          📋 My Policies ({policies.length})
        </button>
        <button
          css={[tabStyles, activeTab === "agents" && css`&.active`]}
          onClick={() => setActiveTab("agents")}
        >
          🤖 Connected Agents ({agentConnections.length})
        </button>
      </div>

      {activeTab === "templates" && renderTemplates()}
      {activeTab === "policies" && renderPolicies()}
      {activeTab === "agents" && renderAgents()}
    </div>
  );
}
