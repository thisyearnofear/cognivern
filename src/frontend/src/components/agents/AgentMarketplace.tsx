import { useState, useRef, useEffect } from "react";
import { css } from "@emotion/react";
import {
  designTokens,
  colorSystem,
  keyframeAnimations,
  easings,
  layoutUtils,
} from "../../styles/design-system";
import { useLoadingState } from "../../hooks/useAgentData";
import InteractiveAgentDemo from "./InteractiveAgentDemo";
import { getApiUrl, getRequestHeaders } from "../../utils/api";
import { BaseAgent } from "../../types";
import { Button } from "../ui/Button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "../ui/Card";
import { Badge } from "../ui/Badge";
import LoadingSpinner from "../ui/LoadingSpinner";
import { formStyles, getFormInputStyles, getFormLabelStyles } from "../../styles/design-system/components/form";

interface MCPAgent extends BaseAgent {
  // MCPAgent inherits id, name, type, status, capabilities, createdAt, updatedAt from BaseAgent
}

interface MCPStatus {
  status: string;
  server: string;
  agents: MCPAgent[];
}

interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  capabilities: string[];
  integrations: string[];
}

export default function AgentMarketplace() {
  const [mcpStatus, setMcpStatus] = useState<MCPStatus | null>(null);
  const { isLoading, error, withLoading, clearError } = useLoadingState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedAgent, setSelectedAgent] = useState<AgentTemplate | null>(
    null,
  );
  const [demoAgent, setDemoAgent] = useState<AgentTemplate | null>(null);
  const [deploymentStep, setDeploymentStep] = useState<number>(0);

  // Progressive disclosure states
  const [showAllAgents, setShowAllAgents] = useState<boolean>(false);
  const [showAdvancedFilters, setShowAdvancedFilters] =
    useState<boolean>(false);
  const [expandedAgentCards, setExpandedAgentCards] = useState<string[]>([]);
  const [userEngagement, setUserEngagement] = useState<number>(0);

  // Fetch MCP status on component mount
  useEffect(() => {
    fetchMCPStatus();
  }, []);

  const fetchMCPStatus = async () => {
    const result = await withLoading(async () => {
      const response = await fetch(getApiUrl("/api/mcp/status"), {
        headers: getRequestHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      setMcpStatus(data);
      return data;
    });

    if (!result) {
      setMcpStatus(null);
    }
  };

  const reconnectMCP = async () => {
    try {
      const response = await fetch(getApiUrl("/api/mcp/reconnect"), {
        method: "POST",
        headers: getRequestHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();

      // Refresh status after reconnection
      setTimeout(fetchMCPStatus, 2000);
    } catch (err) {
      console.error("Error reconnecting to MCP:", err);
    }
  };

  // Sample agent templates
  const agentTemplates: AgentTemplate[] = [
    {
      id: "ad-allocation",
      name: "Ad Allocation Agent",
      description:
        "Intelligently allocates ad placements based on contract terms, content relevance, and audience targeting",
      icon: "📊",
      category: "marketing",
      capabilities: [
        "Contract Analysis",
        "Content Relevance Scoring",
        "Audience Targeting",
        "Performance Tracking",
      ],
      integrations: ["Google Analytics", "Mailchimp", "HubSpot"],
    },
    {
      id: "compliance-guardian",
      name: "Compliance Guardian",
      description:
        "Ensures all content and operations meet regulatory requirements with automatic policy enforcement",
      icon: "🛡️",
      category: "governance",
      capabilities: [
        "Policy Enforcement",
        "Regulatory Monitoring",
        "Audit Trail Generation",
        "Violation Detection",
      ],
      integrations: ["DocuSign", "Salesforce", "Microsoft 365"],
    },
    {
      id: "content-moderator",
      name: "Content Moderation Agent",
      description:
        "Automatically reviews and moderates user-generated content according to platform policies",
      icon: "🔍",
      category: "content",
      capabilities: [
        "Text Analysis",
        "Image Recognition",
        "Policy Enforcement",
        "Escalation Management",
      ],
      integrations: ["Slack", "Discord", "WordPress"],
    },
    {
      id: "financial-advisor",
      name: "Financial Advisory Agent",
      description:
        "Provides personalized financial advice while ensuring compliance with regulations",
      icon: "💰",
      category: "finance",
      capabilities: [
        "Risk Assessment",
        "Portfolio Analysis",
        "Regulatory Compliance",
        "Document Generation",
      ],
      integrations: ["Plaid", "QuickBooks", "Stripe"],
    },
    {
      id: "supply-chain",
      name: "Supply Chain Optimizer",
      description:
        "Optimizes inventory and logistics while maintaining compliance with trade regulations",
      icon: "🚚",
      category: "operations",
      capabilities: [
        "Inventory Optimization",
        "Logistics Planning",
        "Compliance Verification",
        "Cost Analysis",
      ],
      integrations: ["SAP", "Shopify", "ShipStation"],
    },
    {
      id: "healthcare-assistant",
      name: "Healthcare Assistant",
      description:
        "Assists healthcare providers with patient management while ensuring HIPAA compliance",
      icon: "🏥",
      category: "healthcare",
      capabilities: [
        "Patient Data Management",
        "Appointment Scheduling",
        "Compliance Verification",
        "Documentation",
      ],
      integrations: ["Epic", "Cerner", "Athenahealth"],
    },
    {
      id: "legal-document",
      name: "Legal Document Analyzer",
      description:
        "Reviews legal documents and identifies potential issues while maintaining confidentiality",
      icon: "⚖️",
      category: "legal",
      capabilities: [
        "Document Analysis",
        "Risk Identification",
        "Compliance Checking",
        "Citation Verification",
      ],
      integrations: ["DocuSign", "Clio", "LexisNexis"],
    },
    {
      id: "customer-support",
      name: "Customer Support Agent",
      description:
        "Handles customer inquiries while ensuring compliance with company policies and regulations",
      icon: "🎧",
      category: "customer-service",
      capabilities: [
        "Query Resolution",
        "Escalation Management",
        "Policy Enforcement",
        "Satisfaction Tracking",
      ],
      integrations: ["Zendesk", "Intercom", "Salesforce"],
    },
  ];

  const categories = [
    { id: "all", name: "All Categories" },
    { id: "marketing", name: "Marketing" },
    { id: "governance", name: "Governance" },
    { id: "content", name: "Content" },
    { id: "finance", name: "Finance" },
    { id: "operations", name: "Operations" },
    { id: "healthcare", name: "Healthcare" },
    { id: "legal", name: "Legal" },
    { id: "customer-service", name: "Customer Service" },
  ];

  // Define featured/recommended agents (a subset of all agents)
  const featuredAgentIds = [
    "ad-allocation",
    "compliance-guardian",
    "customer-support",
    "financial-advisor",
  ];

  // Get featured agents
  const featuredAgents = agentTemplates.filter((agent) =>
    featuredAgentIds.includes(agent.id),
  );

  // Filter agents based on category and search query
  const filteredAgents = agentTemplates.filter((agent) => {
    const matchesCategory =
      selectedCategory === "all" || agent.category === selectedCategory;
    const matchesSearch =
      searchQuery === "" ||
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  // Determine which agents to display based on progressive disclosure state
  const displayedAgents = showAllAgents
    ? filteredAgents
    : searchQuery || selectedCategory !== "all"
      ? filteredAgents.slice(0, 4)
      : featuredAgents;

  const handleAgentSelect = (agent: AgentTemplate) => {
    setSelectedAgent(agent);
    setDeploymentStep(1);
  };

  const handleDeployment = () => {
    setDeploymentStep((prev) => prev + 1);

    // Simulate deployment completion after 2 seconds
    if (deploymentStep === 2) {
      setTimeout(() => {
        setDeploymentStep(4);
      }, 2000);
    }
  };

  const resetDeployment = () => {
    setSelectedAgent(null);
    setDeploymentStep(0);
  };

  const handleDemoAgent = (agent: AgentTemplate, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the card click (which would start deployment)
    setDemoAgent(agent);
    // Increment user engagement when trying a demo
    incrementUserEngagement(1);
  };

  const closeDemoMode = () => {
    setDemoAgent(null);
  };

  const deployFromDemo = () => {
    if (demoAgent) {
      setSelectedAgent(demoAgent);
      setDemoAgent(null);
      setDeploymentStep(1);
      // Increment user engagement when deploying from demo
      incrementUserEngagement(2);
    }
  };

  // Progressive disclosure methods
  const incrementUserEngagement = (amount: number) => {
    setUserEngagement((prev) => Math.min(prev + amount, 10));

    // Automatically reveal more features based on engagement level
    if (userEngagement >= 3 && !showAdvancedFilters) {
      setShowAdvancedFilters(true);
    }

    if (userEngagement >= 5 && !showAllAgents) {
      setShowAllAgents(true);
    }
  };

  const toggleAgentCardExpansion = (agentId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the card click

    setExpandedAgentCards((prev) => {
      if (prev.includes(agentId)) {
        return prev.filter((id) => id !== agentId);
      } else {
        incrementUserEngagement(1);
        return [...prev, agentId];
      }
    });
  };

  const toggleShowAllAgents = () => {
    setShowAllAgents((prev) => !prev);
    if (!showAllAgents) {
      incrementUserEngagement(1);
    }
  };

  const toggleAdvancedFilters = () => {
    setShowAdvancedFilters((prev) => !prev);
    if (!showAdvancedFilters) {
      incrementUserEngagement(1);
    }
  };

  const renderAgentCatalog = () => (
    <div
      css={css`
        animation: ${keyframeAnimations.reveal} 0.6s ${easings.out};
      `}
    >
      <div
        css={css`
          text-align: center;
          margin-bottom: ${designTokens.spacing[12]};
        `}
      >
        <h2
          css={css`
            font-size: ${designTokens.typography.fontSize["3xl"]};
            font-weight: ${designTokens.typography.fontWeight.bold};
            margin-bottom: ${designTokens.spacing[2]};
          `}
        >
          Agent Marketplace
        </h2>
        <p
          css={css`
            color: ${designTokens.colors.neutral[500]};
            max-width: 600px;
            margin: 0 auto;
          `}
        >
          Discover and deploy pre-built agents with built-in governance and
          compliance capabilities
        </p>
      </div>

      {/* Getting Started Section - Only shown to new users */}
      {userEngagement < 2 && (
        <Card
          variant="glass"
          css={css`
            margin-bottom: ${designTokens.spacing[12]};
            background: ${designTokens.colors.primary[50]};
          `}
        >
          <CardContent padding="lg">
            <h3
              css={css`
                font-weight: ${designTokens.typography.fontWeight.bold};
                margin-bottom: ${designTokens.spacing[6]};
              `}
            >
              Getting Started
            </h3>
            <div
              css={css`
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: ${designTokens.spacing[8]};
              `}
            >
              {[
                {
                  n: 1,
                  t: "Explore Featured Agents",
                  d: "Browse our curated selection of popular agents below",
                },
                {
                  n: 2,
                  t: "Try Before You Deploy",
                  d: 'Test any agent with the "Try Now" button to see it in action',
                },
                {
                  n: 3,
                  t: "Deploy With Confidence",
                  d: "When you're ready, deploy your agent with full governance controls",
                },
              ].map((step) => (
                <div
                  key={step.n}
                  css={css`
                    display: flex;
                    gap: ${designTokens.spacing[4]};
                  `}
                >
                  <div
                    css={css`
                      width: 28px;
                      height: 28px;
                      border-radius: 50%;
                      background: ${designTokens.colors.primary[500]};
                      color: white;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: ${designTokens.typography.fontSize.xs};
                      font-weight: bold;
                      flex-shrink: 0;
                    `}
                  >
                    {step.n}
                  </div>
                  <div>
                    <h4
                      css={css`
                        font-weight: 600;
                        font-size: ${designTokens.typography.fontSize.sm};
                        margin-bottom: ${designTokens.spacing[1]};
                      `}
                    >
                      {step.t}
                    </h4>
                    <p
                      css={css`
                        font-size: ${designTokens.typography.fontSize.xs};
                        color: ${designTokens.colors.neutral[500]};
                      `}
                    >
                      {step.d}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div
        css={css`
          margin-bottom: ${designTokens.spacing[10]};
        `}
      >
        {/* Basic Filters */}
        <div
          css={css`
            display: flex;
            gap: ${designTokens.spacing[4]};
            margin-bottom: ${designTokens.spacing[4]};
          `}
        >
          <div
            css={css`
              flex: 1;
              position: relative;
            `}
          >
            <input
              type="text"
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                incrementUserEngagement(1);
              }}
              css={css`
                ${getFormInputStyles()};
                padding-left: ${designTokens.spacing[4]};
              `}
            />
          </div>

          <Button
            variant={showAdvancedFilters ? "secondary" : "outline"}
            onClick={toggleAdvancedFilters}
          >
            {showAdvancedFilters ? "Hide Filters" : "Show Filters"}
          </Button>
        </div>

        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <Card
            variant="default"
            css={css`
              animation: ${keyframeAnimations.reveal} 0.4s ${easings.out};
            `}
          >
            <CardContent padding="md">
              <div
                css={css`
                  display: flex;
                  align-items: center;
                  gap: ${designTokens.spacing[4]};
                  flex-wrap: wrap;
                `}
              >
                <span
                  css={css`
                    font-size: ${designTokens.typography.fontSize.xs};
                    font-weight: bold;
                    text-transform: uppercase;
                    color: ${designTokens.colors.neutral[400]};
                  `}
                >
                  Categories:
                </span>
                <div
                  css={css`
                    display: flex;
                    gap: ${designTokens.spacing[2]};
                    flex-wrap: wrap;
                  `}
                >
                  {categories.map((category) => (
                    <Button
                      key={category.id}
                      variant={
                        selectedCategory === category.id
                          ? "secondary"
                          : "outline"
                      }
                      size="sm"
                      onClick={() => {
                        setSelectedCategory(category.id);
                        incrementUserEngagement(1);
                      }}
                    >
                      {category.name}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Section Header */}
      <div
        css={css`
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: ${designTokens.spacing[6]};
          border-bottom: 1px solid ${designTokens.colors.neutral[100]};
          padding-bottom: ${designTokens.spacing[2]};
        `}
      >
        <h3
          css={css`
            font-size: ${designTokens.typography.fontSize.xl};
            font-weight: ${designTokens.typography.fontWeight.bold};
          `}
        >
          {searchQuery || selectedCategory !== "all"
            ? "Search Results"
            : showAllAgents
              ? "All Agents"
              : "Featured Agents"}
        </h3>

        {(filteredAgents.length > 4 &&
          (searchQuery || selectedCategory !== "all")) ||
        (!showAllAgents && agentTemplates.length > featuredAgents.length) ? (
          <Button variant="outline" size="sm" onClick={toggleShowAllAgents}>
            {showAllAgents ? "Show Less" : "Show More"}
          </Button>
        ) : null}
      </div>

      <div
        css={css`
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: ${designTokens.spacing[6]};
        `}
      >
        {displayedAgents.length === 0 ? (
          <div
            css={css`
              grid-column: 1 / -1;
              text-align: center;
              padding: ${designTokens.spacing[20]};
              color: ${designTokens.colors.neutral[400]};
              background: ${designTokens.colors.neutral[50]};
              border-radius: ${designTokens.borderRadius.xl};
              border: 2px dashed ${designTokens.colors.neutral[200]};
            `}
          >
            No agents found matching your criteria
          </div>
        ) : (
          displayedAgents.map((agent, idx) => {
            const isExpanded = expandedAgentCards.includes(agent.id);

            return (
              <Card
                key={agent.id}
                variant={isExpanded ? "elevated" : "default"}
                onClick={() => handleAgentSelect(agent)}
                css={css`
                  cursor: pointer;
                  animation: ${keyframeAnimations.revealUp} 0.5s ${easings.out}
                    ${idx * 0.05}s both;
                  ${isExpanded &&
                  css`
                    grid-column: span 2;
                    ${layoutUtils.responsive.mobile(css`
                      grid-column: span 1;
                    `)}
                  `}
                `}
              >
                <CardHeader
                  css={css`
                    display: flex;
                    align-items: center;
                    gap: ${designTokens.spacing[4]};
                  `}
                >
                  <div
                    css={css`
                      font-size: ${designTokens.typography.fontSize["2xl"]};
                      background: ${designTokens.colors.primary[50]};
                      width: 48px;
                      height: 48px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      border-radius: ${designTokens.borderRadius.lg};
                    `}
                  >
                    {agent.icon}
                  </div>
                  <div>
                    <CardTitle>{agent.name}</CardTitle>
                    <Badge variant="outline" size="sm">
                      {agent.category}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p
                    css={css`
                      color: ${designTokens.colors.neutral[600]};
                      font-size: ${designTokens.typography.fontSize.sm};
                      margin-bottom: ${designTokens.spacing[6]};
                    `}
                  >
                    {agent.description}
                  </p>

                  {isExpanded && (
                    <div
                      css={css`
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: ${designTokens.spacing[8]};
                        margin-bottom: ${designTokens.spacing[6]};
                        animation: ${keyframeAnimations.reveal} 0.4s
                          ${easings.out};
                      `}
                    >
                      <div>
                        <h4
                          css={css`
                            font-size: ${designTokens.typography.fontSize.xs};
                            text-transform: uppercase;
                            color: ${designTokens.colors.neutral[400]};
                            margin-bottom: ${designTokens.spacing[2]};
                          `}
                        >
                          Capabilities
                        </h4>
                        <ul
                          css={css`
                            list-style: none;
                            padding: 0;
                            margin: 0;
                            font-size: ${designTokens.typography.fontSize.xs};
                          `}
                        >
                          {agent.capabilities.map((c, i) => (
                            <li key={i}>• {c}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4
                          css={css`
                            font-size: ${designTokens.typography.fontSize.xs};
                            text-transform: uppercase;
                            color: ${designTokens.colors.neutral[400]};
                            margin-bottom: ${designTokens.spacing[2]};
                          `}
                        >
                          Integrations
                        </h4>
                        <div
                          css={css`
                            display: flex;
                            flex-wrap: wrap;
                            gap: ${designTokens.spacing[1]};
                          `}
                        >
                          {agent.integrations.map((it, i) => (
                            <Badge key={i} variant="secondary" size="sm">
                              {it}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
                <CardFooter
                  css={css`
                    display: flex;
                    justify-content: space-between;
                    border-top: 1px solid ${designTokens.colors.neutral[100]};
                    background: ${designTokens.colors.neutral[50]};
                  `}
                >
                  <div
                    css={css`
                      display: flex;
                      gap: ${designTokens.spacing[2]};
                    `}
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => handleDemoAgent(agent, e)}
                    >
                      Try Now
                    </Button>
                    <Button size="sm">Deploy</Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => toggleAgentCardExpansion(agent.id, e)}
                  >
                    {isExpanded ? "Hide Details" : "Show Details"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })
        )}
      </div>

      {!showAllAgents && filteredAgents.length > displayedAgents.length && (
        <div
          css={css`
            margin-top: ${designTokens.spacing[8]};
            text-align: center;
          `}
        >
          <p
            css={css`
              color: ${designTokens.colors.neutral[500]};
              font-size: ${designTokens.typography.fontSize.sm};
            `}
          >
            💡 {filteredAgents.length - displayedAgents.length} more agents
            available.{" "}
            <Button variant="outline" size="sm" onClick={toggleShowAllAgents}>
              Show all
            </Button>
          </p>
        </div>
      )}
    </div>
  );

  const renderDeploymentFlow = () => {
    if (!selectedAgent) return null;

    return (
      <div
        css={css`
          animation: ${keyframeAnimations.reveal} 0.6s ${easings.out};
          max-width: 1000px;
          margin: 0 auto;
        `}
      >
        <div
          css={css`
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: ${designTokens.spacing[10]};
          `}
        >
          <Button variant="outline" onClick={resetDeployment}>
            ← Back to Marketplace
          </Button>
          <h2
            css={css`
              font-size: ${designTokens.typography.fontSize["2xl"]};
              font-weight: ${designTokens.typography.fontWeight.bold};
            `}
          >
            Deploy {selectedAgent.name}
          </h2>
          <div style={{ width: 100 }} />
        </div>

        {/* Stepper */}
        <div
          css={css`
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: ${designTokens.spacing[12]};
          `}
        >
          {[
            { n: 1, l: "Configure" },
            { n: 2, l: "Review" },
            { n: 3, l: "Deploy" },
            { n: 4, l: "Complete" },
          ].map((s, i) => (
            <React.Fragment key={s.n}>
              <div
                css={css`
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  gap: ${designTokens.spacing[2]};
                  position: relative;
                `}
              >
                <div
                  css={css`
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: ${designTokens.typography.fontSize.xs};
                    font-weight: bold;
                    background: ${deploymentStep >= s.n
                      ? designTokens.colors.primary[500]
                      : designTokens.colors.neutral[200]};
                    color: ${deploymentStep >= s.n ? "white" : designTokens.colors.neutral[500]};
                    transition: all 0.3s ease;
                    border: 4px solid
                      ${deploymentStep === s.n
                        ? designTokens.colors.primary[100]
                        : "transparent"};
                  `}
                >
                  {s.n}
                </div>
                <span
                  css={css`
                    font-size: 10px;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    font-weight: 600;
                    color: ${deploymentStep >= s.n
                      ? designTokens.colors.neutral[800]
                      : designTokens.colors.neutral[400]};
                  `}
                >
                  {s.l}
                </span>
              </div>
              {i < 3 && (
                <div
                  css={css`
                    width: 60px;
                    height: 2px;
                    background: ${deploymentStep > s.n
                      ? designTokens.colors.primary[500]
                      : designTokens.colors.neutral[200]};
                    margin: 0 ${designTokens.spacing[4]};
                    margin-top: -20px;
                    transition: all 0.3s ease;
                  `}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        <div
          css={css`
            min-height: 400px;
          `}
        >
          {deploymentStep === 1 && (
            <div
              css={css`
                display: grid;
                grid-template-columns: 1fr 1.5fr;
                gap: ${designTokens.spacing[10]};
                animation: ${keyframeAnimations.reveal} 0.5s ${easings.out};
                ${layoutUtils.responsive.mobile(css`
                  grid-template-columns: 1fr;
                `)}
              `}
            >
              <Card variant="glass">
                <CardContent
                  padding="lg"
                  css={css`
                    text-align: center;
                  `}
                >
                  <div
                    css={css`
                      font-size: ${designTokens.typography.fontSize["4xl"]};
                      margin-bottom: ${designTokens.spacing[4]};
                    `}
                  >
                    {selectedAgent.icon}
                  </div>
                  <h3
                    css={css`
                      font-weight: bold;
                      margin-bottom: ${designTokens.spacing[2]};
                    `}
                  >
                    {selectedAgent.name}
                  </h3>
                  <p
                    css={css`
                      font-size: ${designTokens.typography.fontSize.sm};
                      color: ${designTokens.colors.neutral[500]};
                    `}
                  >
                    {selectedAgent.description}
                  </p>
                </CardContent>
              </Card>

              <div
                css={css`
                  display: flex;
                  flex-direction: column;
                  gap: ${designTokens.spacing[6]};
                `}
              >
                <div css={formStyles.fieldGroup}>
                  <label css={getFormLabelStyles()}>Agent Name</label>
                  <input
                    type="text"
                    defaultValue={`My ${selectedAgent.name}`}
                    css={getFormInputStyles()}
                  />
                </div>

                <div css={formStyles.fieldGroup}>
                  <label css={getFormLabelStyles()}>Environment</label>
                  <select css={getFormInputStyles()}>
                    <option value="development">Development</option>
                    <option value="staging">Staging</option>
                    <option value="production">Production</option>
                  </select>
                </div>

                <div css={formStyles.fieldGroup}>
                  <label css={getFormLabelStyles()}>Governance Policy</label>
                  <select css={getFormInputStyles()}>
                    <option value="standard">Standard Policy</option>
                    <option value="strict">Strict Compliance</option>
                    <option value="custom">Custom Policy</option>
                  </select>
                </div>

                <div
                  css={css`
                    display: flex;
                    justify-content: flex-end;
                    margin-top: ${designTokens.spacing[4]};
                  `}
                >
                  <Button size="lg" onClick={handleDeployment}>
                    Next: Review
                  </Button>
                </div>
              </div>
            </div>
          )}

          {deploymentStep === 2 && (
            <div
              css={css`
                animation: ${keyframeAnimations.reveal} 0.5s ${easings.out};
              `}
            >
              <div
                css={css`
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: ${designTokens.spacing[8]};
                  ${layoutUtils.responsive.mobile(css`
                    grid-template-columns: 1fr;
                  `)}
                `}
              >
                <Card variant="default">
                  <CardHeader>
                    <CardTitle>Deployment Summary</CardTitle>
                  </CardHeader>
                  <CardContent padding="lg">
                    <div
                      css={css`
                        display: flex;
                        flex-direction: column;
                        gap: ${designTokens.spacing[4]};
                      `}
                    >
                      {[
                        { l: "Agent Type", v: selectedAgent.name },
                        { l: "Agent Name", v: `My ${selectedAgent.name}` },
                        { l: "Environment", v: "Development" },
                        { l: "Governance Policy", v: "Standard Policy" },
                      ].map((item) => (
                        <div
                          key={item.l}
                          css={css`
                            display: flex;
                            justify-content: space-between;
                            font-size: ${designTokens.typography.fontSize.sm};
                          `}
                        >
                          <span
                            css={css`
                              color: ${designTokens.colors.neutral[500]};
                            `}
                          >
                            {item.l}
                          </span>
                          <span css={css`
                            font-weight: 500;
                          `}>{item.v}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card variant="default">
                  <CardHeader>
                    <CardTitle>Governance Preview</CardTitle>
                  </CardHeader>
                  <CardContent padding="lg">
                    <div
                      css={css`
                        display: flex;
                        flex-direction: column;
                        gap: ${designTokens.spacing[4]};
                      `}
                    >
                      {[
                        {
                          i: "🔍",
                          t: "Complete Audit Trail",
                          d: "Every action logged with reasoning",
                        },
                        {
                          i: "🛡️",
                          t: "Policy Enforcement",
                          d: "Automatic violation prevention",
                        },
                      ].map((f) => (
                        <div
                          key={f.t}
                          css={css`
                            display: flex;
                            gap: ${designTokens.spacing[3]};
                          `}
                        >
                          <span
                            css={css`
                              font-size: ${designTokens.typography.fontSize.xl};
                            `}
                          >
                            {f.i}
                          </span>
                          <div>
                            <h4
                              css={css`
                                font-size: ${designTokens.typography.fontSize
                                  .sm};
                                font-weight: 600;
                              `}
                            >
                              {f.t}
                            </h4>
                            <p
                              css={css`
                                font-size: ${designTokens.typography.fontSize
                                  .xs};
                                color: ${designTokens.colors.neutral[500]};
                              `}
                            >
                              {f.d}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div
                css={css`
                  display: flex;
                  justify-content: center;
                  gap: ${designTokens.spacing[4]};
                  margin-top: ${designTokens.spacing[10]};
                `}
              >
                <Button variant="outline" onClick={() => setDeploymentStep(1)}>
                  Back
                </Button>
                <Button size="lg" onClick={handleDeployment}>
                  Deploy Agent
                </Button>
              </div>
            </div>
          )}

          {deploymentStep === 3 && (
            <div
              css={css`
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: ${designTokens.spacing[20]} 0;
                animation: ${keyframeAnimations.reveal} 0.5s ${easings.out};
              `}
            >
              <div
                css={css`
                  margin-bottom: ${designTokens.spacing[8]};
                `}
              >
                <LoadingSpinner size="lg" />
              </div>
              <h3
                css={css`
                  font-size: ${designTokens.typography.fontSize.xl};
                  font-weight: bold;
                  margin-bottom: ${designTokens.spacing[2]};
                `}
              >
                Deploying Agent...
              </h3>
              <p
                css={css`
                  color: ${designTokens.colors.neutral[500]};
                  margin-bottom: ${designTokens.spacing[10]};
                `}
              >
                This may take a few moments
              </p>

              <Card
                variant="outlined"
                css={css`
                  width: 100%;
                  max-width: 500px;
                  background: ${designTokens.colors.neutral[900]};
                  color: ${designTokens.colors.neutral[400]};
                  font-family: ${designTokens.typography.fontFamily.mono};
                  font-size: ${designTokens.typography.fontSize.xs};
                `}
              >
                <CardContent padding="md">
                  <div
                    css={css`
                      display: flex;
                      flex-direction: column;
                      gap: ${designTokens.spacing[1]};
                    `}
                  >
                    {[
                      "Initializing environment...",
                      "Loading governance policies...",
                      "Configuring audit logging...",
                      "Registering with MCP server...",
                    ].map((log, i) => (
                      <div
                        key={i}
                        css={css`
                          animation: ${keyframeAnimations.reveal} 0.3s
                            ${easings.out} ${i * 0.5}s both;
                        `}
                      >
                        <span
                          css={css`
                            color: ${designTokens.colors.primary[400]};
                            margin-right: ${designTokens.spacing[2]};
                          `}
                        >
                          →
                        </span>
                        {log}
                      </div>
                    ))}
                    <div
                      css={css`
                        animation: ${keyframeAnimations.shimmer} 2s infinite;
                        margin-top: ${designTokens.spacing[2]};
                        color: white;
                      `}
                    >
                      ▋
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {deploymentStep === 4 && (
            <div
              css={css`
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                animation: ${keyframeAnimations.revealUp} 0.8s ${easings.out};
              `}
            >
              <div
                css={css`
                  width: 80px;
                  height: 80px;
                  border-radius: 50%;
                  background: ${designTokens.colors.semantic.success[500]};
                  color: white;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: ${designTokens.typography.fontSize["4xl"]};
                  margin-bottom: ${designTokens.spacing[6]};
                  box-shadow: 0 0 30px
                    ${designTokens.colors.semantic.success[200]};
                `}
              >
                ✓
              </div>
              <h2
                css={css`
                  font-size: ${designTokens.typography.fontSize["3xl"]};
                  font-weight: bold;
                  margin-bottom: ${designTokens.spacing[2]};
                `}
              >
                Deployment Complete!
              </h2>
              <p
                css={css`
                  color: ${designTokens.colors.neutral[500]};
                  margin-bottom: ${designTokens.spacing[10]};
                  max-width: 500px;
                `}
              >
                Your agent has been successfully deployed and is ready to use in
                your governance network.
              </p>

              <div
                css={css`
                  display: flex;
                  gap: ${designTokens.spacing[4]};
                `}
              >
                <Button size="lg">View Dashboard</Button>
                <Button variant="outline" size="lg" onClick={resetDeployment}>
                  Back to Marketplace
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (isLoading && !mcpStatus) {
    return (
      <div className="marketplace-loading">Loading Agent Marketplace...</div>
    );
  }

  if (error && !mcpStatus) {
    return (
      <div className="marketplace-error">
        <h3>Error Loading Marketplace</h3>
        <p>{error}</p>
        <button onClick={fetchMCPStatus}>Retry</button>
      </div>
    );
  }

  return (
    <div
      css={css`
        animation: ${keyframeAnimations.reveal} 0.8s ${easings.out};
      `}
    >
      <div
        css={css`
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: ${designTokens.colors.neutral[50]};
          padding: ${designTokens.spacing[3]} ${designTokens.spacing[6]};
          border-radius: ${designTokens.borderRadius.lg};
          margin-bottom: ${designTokens.spacing[8]};
          border: 1px solid ${designTokens.colors.neutral[100]};
        `}
      >
        <div
          css={css`
            display: flex;
            align-items: center;
            gap: ${designTokens.spacing[3]};
          `}
        >
          <span
            css={css`
              width: 10px;
              height: 10px;
              border-radius: 50%;
              background: ${mcpStatus?.status === "connected"
                ? designTokens.colors.semantic.success[500]
                : designTokens.colors.semantic.error[500]};
              box-shadow: 0 0 8px
                ${mcpStatus?.status === "connected"
                  ? designTokens.colors.semantic.success[300]
                  : designTokens.colors.semantic.error[300]};
            `}
          ></span>
          <span
            css={css`
              font-size: ${designTokens.typography.fontSize.sm};
              font-weight: 500;
              color: ${designTokens.colors.neutral[700]};
            `}
          >
            {mcpStatus?.status === "connected" ? "Connected" : "Disconnected"}{" "}
            to Agent Network
          </span>
          {mcpStatus?.status !== "connected" && (
            <Button
              variant="outline"
              size="sm"
              onClick={reconnectMCP}
              disabled={isLoading}
            >
              {isLoading ? "Connecting..." : "Connect"}
            </Button>
          )}
        </div>

        <div
          css={css`
            font-size: ${designTokens.typography.fontSize.sm};
            color: ${designTokens.colors.neutral[500]};
          `}
        >
          <Badge variant="secondary" size="sm">
            {mcpStatus?.agents?.length || 0}
          </Badge>{" "}
          Active Agents
        </div>
      </div>

      {deploymentStep === 0 ? renderAgentCatalog() : renderDeploymentFlow()}

      {demoAgent && (
        <div
          css={css`
            position: fixed;
            inset: 0;
            z-index: 1000;
            background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
          `}
        >
          <div
            css={css`
              animation: ${keyframeAnimations.revealUp} 0.5s ${easings.out};
              width: 100%;
              max-width: 900px;
            `}
          >
            <InteractiveAgentDemo
              agentId={demoAgent.id}
              agentName={demoAgent.name}
              agentDescription={demoAgent.description}
              onClose={closeDemoMode}
              onDeploy={deployFromDemo}
            />
          </div>
        </div>
      )}
    </div>
  );
}
