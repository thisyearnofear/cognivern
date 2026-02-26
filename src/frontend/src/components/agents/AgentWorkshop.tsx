import { useState, useRef, useEffect, useMemo } from "react";
import { css } from "@emotion/react";
import {
  designTokens,
  colorSystem,
  keyframeAnimations,
  easings,
  layoutUtils,
} from "../../styles/design-system";
import { BaseAgent } from "../../types";
import { useLoadingState } from "../../hooks/useAgentData";
import { Button } from "../ui/Button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "../ui/Card";
import { Badge } from "../ui/Badge";
import LoadingSpinner from "../ui/LoadingSpinner";

interface AgentAction {
  id: string;
  type: string;
  timestamp: string;
  description: string;
  metadata: Record<string, any>;
  policyChecks: any[];
}

interface TestResult {
  success: boolean;
  action?: AgentAction;
  metrics?: any;
  error?: string;
  geminiResponse?: string;
}

interface LogMessage {
  message: string;
  type: "info" | "error" | "success" | "loading";
  timestamp: Date;
}

interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  useCases: string[];
  benefits: string[];
}

export default function AgentWorkshop() {
  const { isLoading, withLoading } = useLoadingState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [showIntro, setShowIntro] = useState(true);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (
    message: string,
    type: "info" | "error" | "success" | "loading" = "info",
  ) => {
    setLogs((prev) => [...prev, { message, type, timestamp: new Date() }]);
  };

  const agentTemplates: AgentTemplate[] = [
    {
      id: "ad-allocation",
      name: "Ad Allocation Agent",
      description:
        "Intelligently allocates ad placements based on contract terms, content relevance, and audience targeting",
      icon: "📊",
      useCases: [
        "Newsletter publishers with multiple advertisers",
        "Content platforms with premium placement options",
        "Media companies managing sponsor commitments",
      ],
      benefits: [
        "Ensures fair distribution based on contract terms",
        "Optimizes for content relevance and engagement",
        "Maintains complete audit trail for advertiser reporting",
      ],
    },
    {
      id: "compliance",
      name: "Compliance Guardian",
      description:
        "Ensures all content and operations meet regulatory requirements with automatic policy enforcement",
      icon: "🛡️",
      useCases: [
        "Financial services content review",
        "Healthcare information management",
        "Legal document processing",
      ],
      benefits: [
        "Prevents policy violations before they occur",
        "Creates defensible audit trails for regulators",
        "Adapts to changing compliance requirements",
      ],
    },
    {
      id: "insights",
      name: "Audience Insights Agent",
      description:
        "Analyzes user behavior to optimize content strategy and business decisions",
      icon: "📈",
      useCases: [
        "Content strategy optimization",
        "Subscriber retention programs",
        "Product recommendation systems",
      ],
      benefits: [
        "Identifies engagement patterns across audience segments",
        "Recommends content optimizations with expected impact",
        "Protects user privacy while delivering insights",
      ],
    },
    {
      id: "workflow",
      name: "Workflow Automation Agent",
      description:
        "Orchestrates complex business processes with governance and human oversight",
      icon: "⚙️",
      useCases: [
        "Editorial approval workflows",
        "Customer onboarding processes",
        "Supply chain management",
      ],
      benefits: [
        "Reduces manual handoffs and bottlenecks",
        "Ensures compliance at every process step",
        "Provides real-time visibility into process status",
      ],
    },
  ];

  const scenariosByTemplate: Record<
    string,
    Array<{ id: string; name: string; description: string }>
  > = {
    "ad-allocation": [
      {
        id: "contract-based",
        name: "Contract-Based Allocation",
        description:
          "Allocate ad placements based on contract terms and remaining inventory",
      },
      {
        id: "relevance-based",
        name: "Relevance-Based Placement",
        description:
          "Optimize ad placements based on content relevance and expected engagement",
      },
      {
        id: "conflict-resolution",
        name: "Advertiser Conflict Resolution",
        description:
          "Resolve conflicts when multiple advertisers want the same placement",
      },
    ],
    compliance: [
      {
        id: "content-review",
        name: "Content Policy Review",
        description:
          "Review content against regulatory and internal policy requirements",
      },
      {
        id: "policy-violation",
        name: "Policy Violation Handling",
        description:
          "Process content that violates policies and generate appropriate responses",
      },
      {
        id: "audit-trail",
        name: "Compliance Audit Trail",
        description: "Generate detailed audit trails for regulatory reporting",
      },
    ],
    insights: [
      {
        id: "engagement-analysis",
        name: "Engagement Analysis",
        description: "Analyze user engagement patterns across content types",
      },
      {
        id: "segment-discovery",
        name: "Audience Segment Discovery",
        description:
          "Identify new audience segments based on behavior patterns",
      },
      {
        id: "content-recommendations",
        name: "Content Recommendations",
        description:
          "Generate personalized content recommendations for audience segments",
      },
    ],
    workflow: [
      {
        id: "approval-process",
        name: "Multi-Stage Approval Process",
        description:
          "Orchestrate a complex approval workflow with multiple stakeholders",
      },
      {
        id: "exception-handling",
        name: "Exception Handling",
        description:
          "Process exceptions and route to appropriate human decision-makers",
      },
      {
        id: "status-reporting",
        name: "Status Reporting & Metrics",
        description: "Generate real-time status reports and process metrics",
      },
    ],
  };

  const runTest = async () => {
    if (!selectedTemplate || !selectedScenario) return;

    withLoading(async () => {
      addLog(
        `Starting ${selectedScenario} scenario for ${selectedTemplate} agent...`,
        "loading",
      );

      try {
        // Simulate agent initialization
        addLog("Initializing agent environment...", "info");
        await new Promise((resolve) => setTimeout(resolve, 500));

        addLog(`Loading governance policies for ${selectedTemplate}...`, "info");
        await new Promise((resolve) => setTimeout(resolve, 400));

        // Simulate scenario-specific actions
        if (selectedTemplate === "ad-allocation") {
          if (selectedScenario === "contract-based") {
            addLog("Loading advertiser contract terms...", "info");
            await new Promise((resolve) => setTimeout(resolve, 300));

            addLog("Analyzing available inventory slots...", "info");
            await new Promise((resolve) => setTimeout(resolve, 400));

            addLog(
              "Calculating allocation based on contract commitments...",
              "info",
            );
            await new Promise((resolve) => setTimeout(resolve, 500));
          } else if (selectedScenario === "relevance-based") {
            addLog("Analyzing content semantics...", "info");
            await new Promise((resolve) => setTimeout(resolve, 400));

            addLog(
              "Calculating relevance scores for each advertiser...",
              "info",
            );
            await new Promise((resolve) => setTimeout(resolve, 500));

            addLog("Optimizing placement for maximum engagement...", "info");
            await new Promise((resolve) => setTimeout(resolve, 400));
          } else if (selectedScenario === "conflict-resolution") {
            addLog(
              "Detecting placement conflicts between advertisers...",
              "info",
            );
            await new Promise((resolve) => setTimeout(resolve, 300));

            addLog("Applying conflict resolution rules...", "info");
            await new Promise((resolve) => setTimeout(resolve, 400));

            addLog("Generating alternative placement options...", "info");
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        } else if (selectedTemplate === "compliance") {
          if (selectedScenario === "content-review") {
            addLog("Loading regulatory compliance rules...", "info");
            await new Promise((resolve) => setTimeout(resolve, 300));

            addLog("Scanning content for policy violations...", "info");
            await new Promise((resolve) => setTimeout(resolve, 500));

            addLog("Generating compliance report...", "info");
            await new Promise((resolve) => setTimeout(resolve, 400));
          }
        }

        addLog("Verifying against governance policies...", "info");
        await new Promise((resolve) => setTimeout(resolve, 400));

        addLog("Recording action in audit log...", "info");
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Make the actual API call
        const response = await fetch(`/api/agents/test/${selectedTemplate}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY":
              import.meta.env.VITE_API_KEY || "escheat-api-key-123456",
          },
          body: JSON.stringify({ scenario: selectedScenario }),
        });

        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }

        const data = await response.json();

        // Process the response
        if (data.action) {
          addLog(`Action completed: ${data.action.id}`, "success");

          if (data.action.policyChecks) {
            const passedChecks = data.action.policyChecks.filter(
              (c: any) => c.result,
            ).length;
            const failedChecks = data.action.policyChecks.filter(
              (c: any) => !c.result,
            ).length;

            if (failedChecks > 0) {
              addLog(
                `Policy checks: ${passedChecks} passed, ${failedChecks} failed`,
                "error",
              );
            } else {
              addLog(
                `Policy checks: ${passedChecks} passed, ${failedChecks} failed`,
                "success",
              );
            }
          }
        }

        addLog("Agent execution completed successfully", "success");
        setResults((prev) => [{ success: true, ...data }, ...prev]);

        // Move to the results step
        setCurrentStep(3);
      } catch (err) {
        console.error("Error running agent:", err);
        addLog(
          `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
          "error",
        );
        setResults((prev) => [
          {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
          },
          ...prev,
        ]);
      }
    });
  };

  const clearResults = () => {
    setResults([]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const resetWorkflow = () => {
    setCurrentStep(1);
    setSelectedTemplate(null);
    setSelectedScenario(null);
    clearLogs();
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    setCurrentStep(2);
    clearLogs();
    addLog(
      `Selected ${agentTemplates.find((t) => t.id === templateId)?.name}`,
      "info",
    );
  };

  const handleScenarioSelect = (scenarioId: string) => {
    setSelectedScenario(scenarioId);
    addLog(
      `Selected scenario: ${scenariosByTemplate[selectedTemplate!].find((s) => s.id === scenarioId)?.name}`,
      "info",
    );
  };

  const renderIntroduction = () => (
    <div
      css={css`
        max-width: 800px;
        margin: 0 auto;
        padding: ${designTokens.spacing[12]} ${designTokens.spacing[6]};
        animation: ${keyframeAnimations.revealUp} 0.8s ${easings.out};
      `}
    >
      <h2
        css={css`
          font-size: ${designTokens.typography.fontSize["4xl"]};
          font-weight: ${designTokens.typography.fontWeight.bold};
          color: ${designTokens.colors.neutral[900]};
          margin-bottom: ${designTokens.spacing[4]};
          text-align: center;
        `}
      >
        Agent Workshop
      </h2>
      <p
        css={css`
          font-size: ${designTokens.typography.fontSize.xl};
          color: ${designTokens.colors.neutral[600]};
          text-align: center;
          margin-bottom: ${designTokens.spacing[12]};
          line-height: 1.6;
        `}
      >
        Build, test, and deploy AI agents with built-in governance and
        accountability. Our agents help automate complex business decisions
        while maintaining complete visibility and control.
      </p>

      <div
        css={css`
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: ${designTokens.spacing[6]};
          margin-bottom: ${designTokens.spacing[12]};
        `}
      >
        {[
          {
            icon: "🔍",
            title: "Complete Transparency",
            desc: "Every agent action is logged with detailed reasoning and policy checks",
          },
          {
            icon: "🛡️",
            title: "Policy Enforcement",
            desc: "Ensure all agent actions comply with your business rules and regulations",
          },
          {
            icon: "📊",
            title: "Performance Metrics",
            desc: "Track agent performance and compliance with real-time metrics",
          },
        ].map((benefit, i) => (
          <Card
            key={i}
            variant="glass"
            css={css`
              animation: ${keyframeAnimations.revealUp} 0.8s ${easings.out}
                ${0.2 + i * 0.1}s both;
            `}
          >
            <CardContent
              css={css`
                padding: ${designTokens.spacing[6]};
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
              `}
            >
              <div
                css={css`
                  font-size: ${designTokens.typography.fontSize["3xl"]};
                  margin-bottom: ${designTokens.spacing[4]};
                `}
              >
                {benefit.icon}
              </div>
              <h4
                css={css`
                  font-weight: ${designTokens.typography.fontWeight.semibold};
                  margin-bottom: ${designTokens.spacing[2]};
                `}
              >
                {benefit.title}
              </h4>
              <p
                css={css`
                  color: ${designTokens.colors.neutral[500]};
                  font-size: ${designTokens.typography.fontSize.sm};
                `}
              >
                {benefit.desc}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div
        css={css`
          display: flex;
          justify-content: center;
        `}
      >
        <Button size="lg" onClick={() => setShowIntro(false)}>
          Get Started with Agent Workshop
        </Button>
      </div>
    </div>
  );

  const renderTemplateSelection = () => (
    <div
      css={css`
        animation: ${keyframeAnimations.reveal} 0.6s ${easings.out};
      `}
    >
      <div
        css={css`
          margin-bottom: ${designTokens.spacing[8]};
          text-align: center;
        `}
      >
        <h3
          css={css`
            font-size: ${designTokens.typography.fontSize["2xl"]};
            font-weight: ${designTokens.typography.fontWeight.bold};
            margin-bottom: ${designTokens.spacing[2]};
          `}
        >
          Step 1: Select an Agent Template
        </h3>
        <p
          css={css`
            color: ${designTokens.colors.neutral[500]};
          `}
        >
          Choose a pre-configured agent template designed to solve specific
          business challenges
        </p>
      </div>

      <div
        css={css`
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: ${designTokens.spacing[6]};
        `}
      >
        {agentTemplates.map((template, idx) => (
          <Card
            key={template.id}
            variant={selectedTemplate === template.id ? "elevated" : "default"}
            onClick={() => handleTemplateSelect(template.id)}
            css={css`
              cursor: pointer;
              border-color: ${selectedTemplate === template.id
                ? designTokens.colors.primary[500]
                : "transparent"};
              animation: ${keyframeAnimations.revealUp} 0.5s ${easings.out}
                ${idx * 0.05}s both;
              &:hover {
                border-color: ${designTokens.colors.primary[300]};
              }
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
                {template.icon}
              </div>
              <CardTitle>{template.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p
                css={css`
                  font-size: ${designTokens.typography.fontSize.sm};
                  color: ${designTokens.colors.neutral[600]};
                  margin-bottom: ${designTokens.spacing[6]};
                `}
              >
                {template.description}
              </p>

              <div
                css={css`
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: ${designTokens.spacing[4]};
                `}
              >
                <div>
                  <h5
                    css={css`
                      font-size: ${designTokens.typography.fontSize.xs};
                      text-transform: uppercase;
                      color: ${designTokens.colors.neutral[400]};
                      margin-bottom: ${designTokens.spacing[2]};
                    `}
                  >
                    Use Cases
                  </h5>
                  <ul
                    css={css`
                      list-style: none;
                      padding: 0;
                      margin: 0;
                      font-size: ${designTokens.typography.fontSize.xs};
                      color: ${designTokens.colors.neutral[500]};
                    `}
                  >
                    {template.useCases.slice(0, 2).map((uc, i) => (
                      <li key={i}>• {uc}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h5
                    css={css`
                      font-size: ${designTokens.typography.fontSize.xs};
                      text-transform: uppercase;
                      color: ${designTokens.colors.neutral[400]};
                      margin-bottom: ${designTokens.spacing[2]};
                    `}
                  >
                    Benefits
                  </h5>
                  <ul
                    css={css`
                      list-style: none;
                      padding: 0;
                      margin: 0;
                      font-size: ${designTokens.typography.fontSize.xs};
                      color: ${designTokens.colors.neutral[500]};
                    `}
                  >
                    {template.benefits.slice(0, 2).map((b, i) => (
                      <li key={i}>• {b}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderScenarioSelection = () => {
    if (!selectedTemplate) return null;

    const scenarios = scenariosByTemplate[selectedTemplate];
    const selectedTemplateName = agentTemplates.find(
      (t) => t.id === selectedTemplate,
    )?.name;

    return (
      <div
        css={css`
          animation: ${keyframeAnimations.reveal} 0.6s ${easings.out};
        `}
      >
        <div
          css={css`
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: ${designTokens.spacing[8]};
          `}
        >
          <Button variant="outline" onClick={() => setCurrentStep(1)}>
            ← Back to Templates
          </Button>
          <div
            css={css`
              text-align: center;
            `}
          >
            <h3
              css={css`
                font-size: ${designTokens.typography.fontSize["2xl"]};
                font-weight: ${designTokens.typography.fontWeight.bold};
              `}
            >
              Step 2: Select Scenario
            </h3>
            <p
              css={css`
                color: ${designTokens.colors.neutral[500]};
                font-size: ${designTokens.typography.fontSize.sm};
              `}
            >
              For {selectedTemplateName}
            </p>
          </div>
          <div style={{ width: 100 }} /> {/* Spacer */}
        </div>

        <div
          css={css`
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: ${designTokens.spacing[6]};
            margin-bottom: ${designTokens.spacing[12]};
          `}
        >
          {scenarios.map((scenario) => (
            <Card
              key={scenario.id}
              variant={selectedScenario === scenario.id ? "elevated" : "default"}
              onClick={() => handleScenarioSelect(scenario.id)}
              css={css`
                cursor: pointer;
                border-color: ${selectedScenario === scenario.id
                  ? designTokens.colors.primary[500]
                  : "transparent"};
                &:hover {
                  border-color: ${designTokens.colors.primary[300]};
                }
              `}
            >
              <CardContent padding="lg">
                <h4
                  css={css`
                    font-weight: ${designTokens.typography.fontWeight.semibold};
                    margin-bottom: ${designTokens.spacing[2]};
                  `}
                >
                  {scenario.name}
                </h4>
                <p
                  css={css`
                    color: ${designTokens.colors.neutral[600]};
                    font-size: ${designTokens.typography.fontSize.sm};
                  `}
                >
                  {scenario.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div
          css={css`
            display: flex;
            justify-content: center;
          `}
        >
          <Button
            size="lg"
            onClick={runTest}
            disabled={!selectedScenario || isLoading}
            css={css`
              min-width: 200px;
            `}
          >
            {isLoading ? <LoadingSpinner size="sm" /> : "Run Scenario"}
          </Button>
        </div>
      </div>
    );
  };

  const renderResults = () => (
    <div
      css={css`
        animation: ${keyframeAnimations.reveal} 0.6s ${easings.out};
      `}
    >
      <div
        css={css`
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: ${designTokens.spacing[8]};
        `}
      >
        <Button variant="outline" onClick={() => setCurrentStep(2)}>
          ← Back to Scenarios
        </Button>
        <h3
          css={css`
            font-size: ${designTokens.typography.fontSize["2xl"]};
            font-weight: ${designTokens.typography.fontWeight.bold};
          `}
        >
          Step 3: Agent Results
        </h3>
        <div style={{ width: 100 }} />
      </div>

      <div
        css={css`
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: ${designTokens.spacing[8]};
          margin-bottom: ${designTokens.spacing[12]};
          ${layoutUtils.responsive.mobile(css`
            grid-template-columns: 1fr;
          `)}
        `}
      >
        {/* Execution Logs */}
        <Card variant="default">
          <CardHeader
            css={css`
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 1px solid ${designTokens.colors.neutral[100]};
            `}
          >
            <CardTitle>Execution Logs</CardTitle>
            <Button variant="outline" size="sm" onClick={clearLogs}>
              Clear
            </Button>
          </CardHeader>
          <CardContent
            css={css`
              background: ${designTokens.colors.neutral[900]};
              color: ${designTokens.colors.neutral[300]};
              font-family: ${designTokens.typography.fontFamily.mono};
              font-size: ${designTokens.typography.fontSize.xs};
              height: 400px;
              overflow-y: auto;
              padding: ${designTokens.spacing[4]};
            `}
            ref={terminalRef}
          >
            {logs.length === 0 ? (
              <div
                css={css`
                  height: 100%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  opacity: 0.5;
                `}
              >
                No logs available
              </div>
            ) : (
              logs.map((log, index) => (
                <div
                  key={index}
                  css={css`
                    margin-bottom: ${designTokens.spacing[2]};
                    line-height: 1.5;
                    animation: ${keyframeAnimations.reveal} 0.3s ${easings.out}
                      both;
                    color: ${log.type === "error"
                      ? designTokens.colors.semantic.error[400]
                      : log.type === "success"
                        ? designTokens.colors.semantic.success[400]
                        : log.type === "loading"
                          ? designTokens.colors.primary[400]
                          : "inherit"};
                  `}
                >
                  <span
                    css={css`
                      opacity: 0.5;
                      margin-right: ${designTokens.spacing[2]};
                    `}
                  >
                    {`[${log.timestamp.toLocaleTimeString()}]`}
                  </span>
                  <span>{log.message}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Agent Actions */}
        <div
          css={css`
            display: flex;
            flex-direction: column;
            gap: ${designTokens.spacing[6]};
          `}
        >
          <div
            css={css`
              display: flex;
              justify-content: space-between;
              align-items: center;
            `}
          >
            <h4
              css={css`
                font-weight: ${designTokens.typography.fontWeight.semibold};
              `}
            >
              Agent Actions
            </h4>
            <Button
              variant="outline"
              size="sm"
              onClick={clearResults}
              disabled={results.length === 0}
            >
              Clear Results
            </Button>
          </div>

          <div
            css={css`
              flex: 1;
              overflow-y: auto;
              max-height: 500px;
              padding-right: ${designTokens.spacing[2]};
            `}
          >
            {results.length === 0 ? (
              <Card
                variant="outlined"
                css={css`
                  height: 200px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  opacity: 0.5;
                `}
              >
                No results available
              </Card>
            ) : (
              results.map((result, index) => (
                <Card
                  key={index}
                  variant="default"
                  css={css`
                    margin-bottom: ${designTokens.spacing[4]};
                    border-left: 4px solid
                      ${result.success
                        ? designTokens.colors.semantic.success[500]
                        : designTokens.colors.semantic.error[500]};
                    animation: ${keyframeAnimations.revealUp} 0.5s ${easings.out}
                      both;
                  `}
                >
                  <CardContent padding="md">
                    <div
                      css={css`
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: ${designTokens.spacing[4]};
                      `}
                    >
                      <Badge variant={result.success ? "success" : "error"}>
                        {result.success ? "Success" : "Error"}
                      </Badge>
                      <span
                        css={css`
                          font-size: ${designTokens.typography.fontSize.xs};
                          color: ${designTokens.colors.neutral[400]};
                        `}
                      >
                        {new Date().toLocaleString()}
                      </span>
                    </div>

                    {result.error && (
                      <div
                        css={css`
                          color: ${designTokens.colors.semantic.error[600]};
                          font-size: ${designTokens.typography.fontSize.sm};
                          background: ${designTokens.colors.semantic.error[50]};
                          padding: ${designTokens.spacing[3]};
                          border-radius: ${designTokens.borderRadius.md};
                        `}
                      >
                        {result.error}
                      </div>
                    )}

                    {result.action && (
                      <div
                        css={css`
                          margin-top: ${designTokens.spacing[4]};
                        `}
                      >
                        <h5
                          css={css`
                            font-size: ${designTokens.typography.fontSize.xs};
                            text-transform: uppercase;
                            color: ${designTokens.colors.neutral[400]};
                            margin-bottom: ${designTokens.spacing[2]};
                          `}
                        >
                          Agent Action Details
                        </h5>
                        <pre
                          css={css`
                            background: ${designTokens.colors.neutral[50]};
                            padding: ${designTokens.spacing[3]};
                            border-radius: ${designTokens.borderRadius.md};
                            font-size: 10px;
                            overflow-x: auto;
                          `}
                        >
                          {JSON.stringify(result.action, null, 2)}
                        </pre>

                        {result.action.policyChecks &&
                          result.action.policyChecks.length > 0 && (
                            <div
                              css={css`
                                margin-top: ${designTokens.spacing[4]};
                              `}
                            >
                              <h5
                                css={css`
                                  font-size: ${designTokens.typography.fontSize
                                    .xs};
                                  text-transform: uppercase;
                                  color: ${designTokens.colors.neutral[400]};
                                  margin-bottom: ${designTokens.spacing[2]};
                                `}
                              >
                                Policy Checks
                              </h5>
                              <div
                                css={css`
                                  display: flex;
                                  flex-direction: column;
                                  gap: ${designTokens.spacing[2]};
                                `}
                              >
                                {result.action.policyChecks.map((check, idx) => (
                                  <div
                                    key={idx}
                                    css={css`
                                      display: flex;
                                      align-items: center;
                                      justify-content: space-between;
                                      padding: ${designTokens.spacing[2]};
                                      background: ${check.result
                                        ? designTokens.colors.semantic
                                            .success[50]
                                        : designTokens.colors.semantic
                                            .error[50]};
                                      border-radius: ${designTokens.borderRadius
                                        .sm};
                                      font-size: ${designTokens.typography
                                        .fontSize.xs};
                                    `}
                                  >
                                    <span
                                      css={css`
                                        font-weight: 500;
                                      `}
                                    >
                                      {check.policyId}
                                    </span>
                                    <Badge
                                      variant={
                                        check.result ? "success" : "error"
                                      }
                                      size="sm"
                                    >
                                      {check.result ? "Passed" : "Failed"}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      <Card
        variant="glass"
        css={css`
          background: ${designTokens.colors.primary[50]};
        `}
      >
        <CardContent
          padding="lg"
          css={css`
            display: flex;
            align-items: center;
            justify-content: space-between;
            ${layoutUtils.responsive.mobile(css`
              flex-direction: column;
              gap: ${designTokens.spacing[6]};
              text-align: center;
            `)}
          `}
        >
          <div>
            <h4
              css={css`
                font-weight: ${designTokens.typography.fontWeight.bold};
                margin-bottom: ${designTokens.spacing[1]};
              `}
            >
              Ready to go live?
            </h4>
            <p
              css={css`
                font-size: ${designTokens.typography.fontSize.sm};
                color: ${designTokens.colors.neutral[500]};
              `}
            >
              Deploy this agent to your production governance system.
            </p>
          </div>
          <div
            css={css`
              display: flex;
              gap: ${designTokens.spacing[4]};
            `}
          >
            <Button variant="outline" onClick={resetWorkflow}>
              Try Another
            </Button>
            <Button>Deploy to Production</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (showIntro) {
    return renderIntroduction();
  }

  return (
    <div className="agent-workshop">
      <div className="workshop-progress">
        <div className={`progress-step ${currentStep >= 1 ? "active" : ""}`}>
          <div className="step-number">1</div>
          <div className="step-label">Select Template</div>
        </div>
        <div className="progress-connector"></div>
        <div className={`progress-step ${currentStep >= 2 ? "active" : ""}`}>
          <div className="step-number">2</div>
          <div className="step-label">Choose Scenario</div>
        </div>
        <div className="progress-connector"></div>
        <div className={`progress-step ${currentStep >= 3 ? "active" : ""}`}>
          <div className="step-number">3</div>
          <div className="step-label">View Results</div>
        </div>
      </div>

      <div className="workshop-content">
        {currentStep === 1 && renderTemplateSelection()}
        {currentStep === 2 && renderScenarioSelection()}
        {currentStep === 3 && renderResults()}
      </div>
    </div>
  );
}
