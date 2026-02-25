import { useState, useEffect } from "react";
import { css } from "@emotion/react";
import { designTokens } from "../../styles/design-system";
import {
  useGovernanceStore,
  GovernanceTemplate,
} from "../../stores/governanceStore";
import {
  Card,
  CardContent,
  StatCard,
  PolicyCard,
  Button,
  Badge,
  AgentCard,
  LoadingSpinner,
} from "../ui";
import { useBreakpoint } from "../../hooks/useMediaQuery";
import { getApiUrl, getRequestHeaders } from "../../utils/api";

/**
 * PolicyManagement - Central hub for governance across the platform.
 * Refactored to use centralized governanceStore and modular UI primitives.
 *
 * CORE PRINCIPLES:
 * - ENHANCEMENT FIRST: Leverages global UI components (PolicyCard, StatCard).
 * - MODULAR: Clear separation between templates, active policies, and agent links.
 * - ORGANIZED: Domain-driven state management via useGovernanceStore.
 */

export default function PolicyManagement() {
  const { isMobile, isTablet } = useBreakpoint();
  const [activeTab, setActiveTab] = useState<
    "templates" | "policies" | "agents"
  >("templates");

  // Global Governance State
  const { policies, templates, isLoading, fetchPolicies, applyTemplate } =
    useGovernanceStore();

  // Local state for agent connections (keeping existing logic for agent domain)
  const [agentConnections, setAgentConnections] = useState<any[]>([]);
  const [isAgentsLoading, setIsAgentsLoading] = useState(false);

  useEffect(() => {
    fetchPolicies();
    fetchAgentConnections();
  }, [fetchPolicies]);

  const fetchAgentConnections = async () => {
    setIsAgentsLoading(true);
    try {
      const response = await fetch(getApiUrl("/api/agents/connections"), {
        headers: getRequestHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setAgentConnections(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching agent connections:", error);
    } finally {
      setIsAgentsLoading(false);
    }
  };

  const handleTemplateSelect = async (template: GovernanceTemplate) => {
    try {
      await applyTemplate(template.id);
      setActiveTab("policies");
    } catch (error) {
      console.error("Failed to apply template:", error);
    }
  };

  // Layout Styles
  const containerStyles = css`
    padding: ${designTokens.spacing[8]};
    max-width: 1200px;
    margin: 0 auto;

    ${isMobile &&
    css`
      padding: ${designTokens.spacing[4]};
    `}
  `;

  const headerStyles = css`
    margin-bottom: ${designTokens.spacing[10]};
  `;

  const titleStyles = css`
    font-size: ${designTokens.typography.fontSize["3xl"]};
    font-weight: ${designTokens.typography.fontWeight.bold};
    color: ${designTokens.colors.neutral[900]};
    margin-bottom: ${designTokens.spacing[2]};
  `;

  const subtitleStyles = css`
    color: ${designTokens.colors.neutral[500]};
    font-size: ${designTokens.typography.fontSize.lg};
  `;

  const statsGridStyles = css`
    display: grid;
    grid-template-columns: repeat(${isMobile ? 1 : 3}, 1fr);
    gap: ${designTokens.spacing[6]};
    margin-bottom: ${designTokens.spacing[10]};
  `;

  const tabsContainerStyles = css`
    display: flex;
    gap: ${designTokens.spacing[8]};
    border-bottom: 1px solid ${designTokens.colors.neutral[200]};
    margin-bottom: ${designTokens.spacing[8]};
  `;

  const tabButtonStyles = (active: boolean) => css`
    background: none;
    border: none;
    padding: ${designTokens.spacing[4]} 0;
    font-size: ${designTokens.typography.fontSize.base};
    font-weight: ${designTokens.typography.fontWeight.semibold};
    color: ${active
      ? designTokens.colors.primary[600]
      : designTokens.colors.neutral[500]};
    border-bottom: 2px solid
      ${active ? designTokens.colors.primary[600] : "transparent"};
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      color: ${designTokens.colors.primary[500]};
    }
  `;

  const gridLayoutStyles = css`
    display: grid;
    grid-template-columns: repeat(${isMobile ? 1 : isTablet ? 2 : 3}, 1fr);
    gap: ${designTokens.spacing[6]};
  `;

  const emptyStateStyles = css`
    text-align: center;
    padding: ${designTokens.spacing[16]};
    background: ${designTokens.colors.neutral[50]};
    border-radius: ${designTokens.borderRadius.xl};
    color: ${designTokens.colors.neutral[500]};
  `;

  return (
    <div css={containerStyles}>
      <header css={headerStyles}>
        <h1 css={titleStyles}>Governance & Policies</h1>
        <p css={subtitleStyles}>
          Define guardrails and safety protocols for your autonomous agent
          ecosystem.
        </p>
      </header>

      {/* High-Level Overview Stats */}
      <div css={statsGridStyles}>
        <StatCard
          label="Total Policies"
          value={policies.length}
          icon="📋"
          color="primary"
        />
        <StatCard
          label="Active Guards"
          value={policies.filter((p) => p.status === "active").length}
          icon="🛡️"
          color="success"
        />
        <StatCard
          label="Managed Agents"
          value={agentConnections.length}
          icon="🤖"
          color="info"
        />
      </div>

      {/* Tabbed Interface */}
      <nav css={tabsContainerStyles}>
        <button
          css={tabButtonStyles(activeTab === "templates")}
          onClick={() => setActiveTab("templates")}
        >
          Templates
        </button>
        <button
          css={tabButtonStyles(activeTab === "policies")}
          onClick={() => setActiveTab("policies")}
        >
          My Policies ({policies.length})
        </button>
        <button
          css={tabButtonStyles(activeTab === "agents")}
          onClick={() => setActiveTab("agents")}
        >
          Connected Agents
        </button>
      </nav>

      {/* Tab Content */}
      <main>
        {activeTab === "templates" && (
          <div css={gridLayoutStyles}>
            {templates.map((template) => (
              <Card
                key={template.id}
                interactive
                onClick={() => handleTemplateSelect(template)}
              >
                <CardContent>
                  <div
                    style={{
                      fontSize: "2rem",
                      marginBottom: designTokens.spacing[4],
                    }}
                  >
                    {template.icon}
                  </div>
                  <h3 style={{ marginBottom: designTokens.spacing[2] }}>
                    {template.name}
                  </h3>
                  <p
                    style={{
                      color: designTokens.colors.neutral[500],
                      fontSize: "0.9rem",
                      marginBottom: designTokens.spacing[4],
                      minHeight: "3em",
                    }}
                  >
                    {template.description}
                  </p>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <Badge variant="secondary">{template.complexity}</Badge>
                    <Badge variant="outline">
                      {template.defaultRules.length} Rules
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {activeTab === "policies" && (
          <>
            {isLoading ? (
              <div style={{ textAlign: "center", padding: "40px" }}>
                <LoadingSpinner />
              </div>
            ) : policies.length === 0 ? (
              <div css={emptyStateStyles}>
                <h3>No policies created yet</h3>
                <p>Browse templates to get started with governance.</p>
                <Button
                  style={{ marginTop: "16px" }}
                  onClick={() => setActiveTab("templates")}
                >
                  View Templates
                </Button>
              </div>
            ) : (
              <div css={gridLayoutStyles}>
                {policies.map((policy) => (
                  <PolicyCard
                    key={policy.id}
                    policy={policy}
                    onClick={(p) => console.log("Edit policy", p)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "agents" && (
          <>
            {isAgentsLoading ? (
              <div style={{ textAlign: "center", padding: "40px" }}>
                <LoadingSpinner />
              </div>
            ) : agentConnections.length === 0 ? (
              <div css={emptyStateStyles}>
                <h3>No agents connected</h3>
                <p>Connect your first agent to apply governance policies.</p>
              </div>
            ) : (
              <div css={gridLayoutStyles}>
                {agentConnections.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={{
                      ...agent,
                      totalReturn: 0, // Mock for standardized card
                      winRate: 0, // Mock for standardized card
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
