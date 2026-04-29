import { useState, useRef, useEffect, useMemo } from 'react';
import { css } from '@emotion/react';
import { ArrowRight } from 'lucide-react';
import { designTokens, keyframeAnimations, easings, layoutUtils } from '../../styles/design-system';
import { getApiHeaders, getApiUrl } from '../../utils/api';
import { BaseAgent } from '../../types';
import { useLoadingState } from '../../hooks/useAgentData';
import { Button } from '../ui/Button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../ui/Card';
import { Badge } from '../ui/Badge';
import LoadingSpinner from '../ui/LoadingSpinner';

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
  type: 'info' | 'error' | 'success' | 'loading';
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
  const addLog = (message: string, type: LogMessage['type'] = 'info') => {
    setLogs((prev) => [...prev, { message, type, timestamp: new Date() }]);
  };
  const [currentStep, setCurrentStep] = useState(1);
  const [showIntro, setShowIntro] = useState(true);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const containerStyles = css`
    min-height: 100vh;
    padding: ${designTokens.spacing[12]} ${designTokens.spacing[6]};
    background: radial-gradient(
      circle at 50% 0%,
      ${designTokens.colors.primary[50]} 0%,
      ${designTokens.colors.background.secondary} 100%
    );
    position: relative;
    overflow-x: hidden;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-image:
        linear-gradient(${designTokens.colors.neutral[200]} 1px, transparent 1px),
        linear-gradient(90deg, ${designTokens.colors.neutral[200]} 1px, transparent 1px);
      background-size: 40px 40px;
      opacity: 0.1;
      pointer-events: none;
    }
  `;

  const agentTemplates: AgentTemplate[] = [
    {
      id: 'ad-allocation',
      name: 'Ad Allocation Agent',
      description:
        'Intelligently allocates ad placements based on contract terms, content relevance, and audience targeting',
      icon: '📊',
      useCases: [
        'Newsletter publishers with multiple advertisers',
        'Content platforms with premium placement options',
        'Media companies managing sponsor commitments',
      ],
      benefits: [
        'Ensures fair distribution based on contract terms',
        'Optimizes for content relevance and engagement',
        'Maintains complete audit trail for advertiser reporting',
      ],
    },
    {
      id: 'compliance',
      name: 'Compliance Guardian',
      description:
        'Ensures all content and operations meet regulatory requirements with automatic policy enforcement',
      icon: '🛡️',
      useCases: [
        'Financial services content review',
        'Healthcare information management',
        'Legal document processing',
      ],
      benefits: [
        'Prevents policy violations before they occur',
        'Creates defensible audit trails for regulators',
        'Adapts to changing compliance requirements',
      ],
    },
    {
      id: 'insights',
      name: 'Audience Insights Agent',
      description: 'Analyzes user behavior to optimize content strategy and business decisions',
      icon: '📈',
      useCases: [
        'Content strategy optimization',
        'Subscriber retention programs',
        'Product recommendation systems',
      ],
      benefits: [
        'Identifies engagement patterns across audience segments',
        'Recommends content optimizations with expected impact',
        'Protects user privacy while delivering insights',
      ],
    },
    {
      id: 'workflow',
      name: 'Workflow Automation Agent',
      description: 'Orchestrates complex business processes with governance and human oversight',
      icon: '⚙️',
      useCases: [
        'Editorial approval workflows',
        'Customer onboarding processes',
        'Supply chain management',
      ],
      benefits: [
        'Reduces manual handoffs and bottlenecks',
        'Ensures compliance at every process step',
        'Provides real-time visibility into process status',
      ],
    },
  ];

  const scenariosByTemplate: Record<
    string,
    Array<{ id: string; name: string; description: string }>
  > = {
    'ad-allocation': [
      {
        id: 'contract-based',
        name: 'Contract-Based Allocation',
        description: 'Allocate ad placements based on contract terms and remaining inventory',
      },
      {
        id: 'relevance-based',
        name: 'Relevance-Based Placement',
        description: 'Optimize ad placements based on content relevance and expected engagement',
      },
      {
        id: 'conflict-resolution',
        name: 'Advertiser Conflict Resolution',
        description: 'Resolve conflicts when multiple advertisers want the same placement',
      },
    ],
    compliance: [
      {
        id: 'content-review',
        name: 'Content Policy Review',
        description: 'Review content against regulatory and internal policy requirements',
      },
      {
        id: 'policy-violation',
        name: 'Policy Violation Handling',
        description: 'Process content that violates policies and generate appropriate responses',
      },
      {
        id: 'audit-trail',
        name: 'Compliance Audit Trail',
        description: 'Generate detailed audit trails for regulatory reporting',
      },
    ],
    insights: [
      {
        id: 'engagement-analysis',
        name: 'Engagement Analysis',
        description: 'Analyze user engagement patterns across content types',
      },
      {
        id: 'segment-discovery',
        name: 'Audience Segment Discovery',
        description: 'Identify new audience segments based on behavior patterns',
      },
      {
        id: 'content-recommendations',
        name: 'Content Recommendations',
        description: 'Generate personalized content recommendations for audience segments',
      },
    ],
    workflow: [
      {
        id: 'approval-process',
        name: 'Multi-Stage Approval Process',
        description: 'Orchestrate a complex approval workflow with multiple stakeholders',
      },
      {
        id: 'exception-handling',
        name: 'Exception Handling',
        description: 'Process exceptions and route to appropriate human decision-makers',
      },
      {
        id: 'status-reporting',
        name: 'Status Reporting & Metrics',
        description: 'Generate real-time status reports and process metrics',
      },
    ],
  };

  const runTest = async () => {
    if (!selectedTemplate || !selectedScenario) return;

    withLoading(async () => {
      addLog(`Starting ${selectedScenario} scenario for ${selectedTemplate} agent...`, 'loading');

      try {
        // Simulate agent initialization
        addLog('Initializing agent environment...', 'info');
        await new Promise((resolve) => setTimeout(resolve, 500));

        addLog(`Loading governance policies for ${selectedTemplate}...`, 'info');
        await new Promise((resolve) => setTimeout(resolve, 400));

        // Simulate scenario-specific actions
        if (selectedTemplate === 'ad-allocation') {
          if (selectedScenario === 'contract-based') {
            addLog('Loading advertiser contract terms...', 'info');
            await new Promise((resolve) => setTimeout(resolve, 300));

            addLog('Analyzing available inventory slots...', 'info');
            await new Promise((resolve) => setTimeout(resolve, 400));

            addLog('Calculating allocation based on contract commitments...', 'info');
            await new Promise((resolve) => setTimeout(resolve, 500));
          } else if (selectedScenario === 'relevance-based') {
            addLog('Analyzing content semantics...', 'info');
            await new Promise((resolve) => setTimeout(resolve, 400));

            addLog('Calculating relevance scores for each advertiser...', 'info');
            await new Promise((resolve) => setTimeout(resolve, 500));

            addLog('Optimizing placement for maximum engagement...', 'info');
            await new Promise((resolve) => setTimeout(resolve, 400));
          } else if (selectedScenario === 'conflict-resolution') {
            addLog('Detecting placement conflicts between advertisers...', 'info');
            await new Promise((resolve) => setTimeout(resolve, 300));

            addLog('Applying conflict resolution rules...', 'info');
            await new Promise((resolve) => setTimeout(resolve, 400));

            addLog('Generating alternative placement options...', 'info');
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        } else if (selectedTemplate === 'compliance') {
          if (selectedScenario === 'content-review') {
            addLog('Loading regulatory compliance rules...', 'info');
            await new Promise((resolve) => setTimeout(resolve, 300));

            addLog('Scanning content for policy violations...', 'info');
            await new Promise((resolve) => setTimeout(resolve, 500));

            addLog('Generating compliance report...', 'info');
            await new Promise((resolve) => setTimeout(resolve, 400));
          }
        }

        addLog('Verifying against governance policies...', 'info');
        await new Promise((resolve) => setTimeout(resolve, 400));

        addLog('Recording action in audit log...', 'info');
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Make the actual API call
        const response = await fetch(getApiUrl(`/agents/test/${selectedTemplate}`), {
          method: 'POST',
          headers: getApiHeaders(),
          body: JSON.stringify({ scenario: selectedScenario }),
        });

        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }

        const data = await response.json();

        // Process the response
        if (data.action) {
          addLog(`Action completed: ${data.action.id}`, 'success');

          if (data.action.policyChecks) {
            const passedChecks = data.action.policyChecks.filter((c: any) => c.result).length;
            const failedChecks = data.action.policyChecks.filter((c: any) => !c.result).length;

            if (failedChecks > 0) {
              addLog(`Policy checks: ${passedChecks} passed, ${failedChecks} failed`, 'error');
            } else {
              addLog(`Policy checks: ${passedChecks} passed, ${failedChecks} failed`, 'success');
            }
          }
        }

        addLog('Agent execution completed successfully', 'success');
        setResults((prev) => [{ success: true, ...data }, ...prev]);

        // Move to the results step
        setCurrentStep(3);
      } catch (err) {
        console.error('Error running agent:', err);
        addLog(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
        setResults((prev) => [
          {
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error',
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
    addLog(`Selected ${agentTemplates.find((t) => t.id === templateId)?.name}`, 'info');
  };

  const handleScenarioSelect = (scenarioId: string) => {
    setSelectedScenario(scenarioId);
    addLog(
      `Selected scenario: ${scenariosByTemplate[selectedTemplate!].find((s) => s.id === scenarioId)?.name}`,
      'info',
    );
  };

  const renderIntroduction = () => (
    <div
      css={css`
        max-width: 900px;
        margin: 0 auto;
        padding: ${designTokens.spacing[12]} ${designTokens.spacing[6]};
        animation: ${keyframeAnimations.revealUp} 0.8s ${easings.out};
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
            font-size: ${designTokens.typography.fontSize['5xl']};
            font-weight: ${designTokens.typography.fontWeight.bold};
            background: linear-gradient(
              135deg,
              ${designTokens.colors.neutral[900]} 0%,
              ${designTokens.colors.primary[800]} 100%
            );
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: ${designTokens.spacing[4]};
            letter-spacing: -0.04em;
          `}
        >
          Agent Workshop
        </h2>
        <p
          css={css`
            font-size: ${designTokens.typography.fontSize.xl};
            color: ${designTokens.colors.neutral[600]};
            max-width: 700px;
            margin: 0 auto;
            line-height: 1.6;
          `}
        >
          The manufacturing floor for Governed Agents. Design, test, and validate technical agents
          with built-in policy enforcement and cryptographic accountability.
        </p>
      </div>

      <div
        css={css`
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: ${designTokens.spacing[6]};
          margin-bottom: ${designTokens.spacing[12]};
        `}
      >
        {[
          {
            icon: '🔍',
            title: 'Complete Transparency',
            desc: 'Every decision trace is cryptographically logged for full retroactive auditability.',
          },
          {
            icon: '🛡️',
            title: 'Policy Guardrails',
            desc: 'Define strict boundaries that agents cannot cross, regardless of their autonomy level.',
          },
          {
            icon: '📊',
            title: 'Validated Scenarios',
            desc: 'Run rigorous simulation tests to ensure agent behavior aligns with business intent.',
          },
        ].map((benefit, i) => (
          <Card
            key={i}
            variant="elevated"
            css={css`
              background: rgba(255, 255, 255, 0.7);
              backdrop-filter: blur(12px);
              border: 1px solid ${designTokens.colors.neutral[200]};
              animation: ${keyframeAnimations.revealUp} 0.8s ${easings.out} ${0.2 + i * 0.1}s both;
              text-align: center;
              padding: ${designTokens.spacing[8]};
            `}
          >
            <CardContent>
              <div
                css={css`
                  font-size: 3rem;
                  margin-bottom: ${designTokens.spacing[4]};
                `}
              >
                {benefit.icon}
              </div>
              <h4
                css={css`
                  font-size: ${designTokens.typography.fontSize.lg};
                  font-weight: ${designTokens.typography.fontWeight.bold};
                  margin-bottom: ${designTokens.spacing[2]};
                  color: ${designTokens.colors.neutral[900]};
                `}
              >
                {benefit.title}
              </h4>
              <p
                css={css`
                  color: ${designTokens.colors.neutral[600]};
                  font-size: ${designTokens.typography.fontSize.sm};
                  line-height: 1.5;
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
        <Button
          size="lg"
          onClick={() => setShowIntro(false)}
          css={css`
            padding: 0 ${designTokens.spacing[12]};
            height: 56px;
            font-size: ${designTokens.typography.fontSize.base};
          `}
        >
          Enter the Workshop
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
          margin-bottom: ${designTokens.spacing[12]};
          text-align: center;
        `}
      >
        <h3
          css={css`
            font-size: ${designTokens.typography.fontSize['3xl']};
            font-weight: ${designTokens.typography.fontWeight.bold};
            margin-bottom: ${designTokens.spacing[3]};
            letter-spacing: -0.02em;
          `}
        >
          Phase 1: Blueprint Selection
        </h3>
        <p
          css={css`
            color: ${designTokens.colors.neutral[500]};
            font-size: ${designTokens.typography.fontSize.lg};
          `}
        >
          Select an agent architecture to begin the governance configuration
        </p>
      </div>

      <div
        css={css`
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: ${designTokens.spacing[6]};
        `}
      >
        {agentTemplates.map((template, idx) => (
          <Card
            key={template.id}
            variant={selectedTemplate === template.id ? 'elevated' : 'outlined'}
            onClick={() => handleTemplateSelect(template.id)}
            css={css`
              cursor: pointer;
              background: ${selectedTemplate === template.id
                ? 'rgba(255, 255, 255, 0.95)'
                : 'rgba(255, 255, 255, 0.6)'};
              backdrop-filter: blur(8px);
              border: 2px solid
                ${selectedTemplate === template.id
                  ? designTokens.colors.primary[500]
                  : designTokens.colors.neutral[200]};
              transition: all 0.4s ${easings.out};
              animation: ${keyframeAnimations.revealUp} 0.5s ${easings.out} ${idx * 0.05}s both;

              &:hover {
                transform: translateY(-4px);
                border-color: ${designTokens.colors.primary[300]};
                box-shadow: ${designTokens.shadows.lg};
              }
            `}
          >
            <CardHeader
              css={css`
                display: flex;
                align-items: center;
                gap: ${designTokens.spacing[4]};
                padding: ${designTokens.spacing[6]};
              `}
            >
              <div
                css={css`
                  font-size: 1.5rem;
                  background: ${selectedTemplate === template.id
                    ? designTokens.colors.primary[600]
                    : designTokens.colors.primary[100]};
                  color: ${selectedTemplate === template.id
                    ? 'white'
                    : designTokens.colors.primary[600]};
                  width: 56px;
                  height: 56px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  border-radius: ${designTokens.borderRadius.xl};
                  transition: all 0.3s ease;
                `}
              >
                {template.icon}
              </div>
              <CardTitle
                css={css`
                  font-size: ${designTokens.typography.fontSize.xl};
                `}
              >
                {template.name}
              </CardTitle>
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
    const selectedTemplateName = agentTemplates.find((t) => t.id === selectedTemplate)?.name;

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
                font-size: ${designTokens.typography.fontSize['2xl']};
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
              variant={selectedScenario === scenario.id ? 'elevated' : 'default'}
              onClick={() => handleScenarioSelect(scenario.id)}
              css={css`
                cursor: pointer;
                border-color: ${selectedScenario === scenario.id
                  ? designTokens.colors.primary[500]
                  : 'transparent'};
                &:hover {
                  border-color: ${designTokens.colors.primary[300]};
                }
              `}
            >
              <CardContent padding="sm">
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
            {isLoading ? <LoadingSpinner size="sm" /> : 'Run Scenario'}
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
          margin-bottom: ${designTokens.spacing[10]};
        `}
      >
        <Button variant="ghost" onClick={() => setCurrentStep(2)}>
          ← Previous Step
        </Button>
        <div
          css={css`
            text-align: center;
          `}
        >
          <h3
            css={css`
              font-size: ${designTokens.typography.fontSize['3xl']};
              font-weight: ${designTokens.typography.fontWeight.bold};
              letter-spacing: -0.02em;
              margin-bottom: ${designTokens.spacing[1]};
            `}
          >
            Phase 3: Diagnostic Results
          </h3>
          <Badge variant="default">Simulation Mode</Badge>
        </div>
        <Button variant="ghost" onClick={resetWorkflow}>
          Reset Workshop
        </Button>
      </div>

      <div
        css={css`
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: ${designTokens.spacing[8]};
          margin-bottom: ${designTokens.spacing[12]};
          ${layoutUtils.responsive.mobile(css`
            grid-template-columns: 1fr;
          `)}
        `}
      >
        {/* Execution Logs / Terminal */}
        <div
          css={css`
            display: flex;
            flex-direction: column;
          `}
        >
          <div css={terminalHeaderStyles}>
            <div css={terminalDotStyles}>
              <div css={terminalDot('#ff5f56')} />
              <div css={terminalDot('#ffbd2e')} />
              <div css={terminalDot('#27c93f')} />
            </div>
            <div
              css={css`
                font-size: 10px;
                color: ${designTokens.colors.neutral[400]};
                font-family: ${designTokens.typography.fontFamily.mono};
                text-transform: uppercase;
                letter-spacing: 0.1em;
              `}
            >
              Agent Trace Monitor
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearLogs}
              css={css`
                color: ${designTokens.colors.neutral[400]};
                font-size: 10px;
                height: 20px;
              `}
            >
              Clear
            </Button>
          </div>
          <div
            css={css`
              background: #0f172a;
              color: ${designTokens.colors.neutral[300]};
              font-family: ${designTokens.typography.fontFamily.mono};
              font-size: ${designTokens.typography.fontSize.xs};
              height: 500px;
              overflow-y: auto;
              padding: ${designTokens.spacing[6]};
              border-radius: 0 0 ${designTokens.borderRadius.lg} ${designTokens.borderRadius.lg};
              border: 1px solid ${designTokens.colors.neutral[800]};
              border-top: none;
              box-shadow: ${designTokens.shadows.xl};

              /* Custom scrollbar for terminal */
              &::-webkit-scrollbar {
                width: 8px;
              }
              &::-webkit-scrollbar-track {
                background: transparent;
              }
              &::-webkit-scrollbar-thumb {
                background: #334155;
                border-radius: 4px;
              }
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
                  opacity: 0.3;
                  font-style: italic;
                `}
              >
                Waiting for agent execution...
              </div>
            ) : (
              logs.map((log, index) => (
                <div
                  key={index}
                  css={css`
                    margin-bottom: ${designTokens.spacing[3]};
                    line-height: 1.6;
                    animation: ${keyframeAnimations.reveal} 0.3s ${easings.out} both;
                    display: flex;
                    gap: ${designTokens.spacing[3]};
                  `}
                >
                  <span
                    css={css`
                      color: ${designTokens.colors.neutral[600]};
                      user-select: none;
                      min-width: 80px;
                    `}
                  >
                    {log.timestamp.toLocaleTimeString([], {
                      hour12: false,
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                  <span
                    css={css`
                      color: ${log.type === 'error'
                        ? '#f87171'
                        : log.type === 'success'
                          ? '#4ade80'
                          : log.type === 'loading'
                            ? '#60a5fa'
                            : '#94a3b8'};
                    `}
                  >
                    {log.type === 'loading' && '➤ '}
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Agent Actions / Diagnostics */}
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
                font-size: ${designTokens.typography.fontSize.lg};
                font-weight: ${designTokens.typography.fontWeight.bold};
                color: ${designTokens.colors.neutral[900]};
                letter-spacing: -0.01em;
              `}
            >
              Action Audit
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearResults}
              disabled={results.length === 0}
              css={css`
                font-size: ${designTokens.typography.fontSize.xs};
              `}
            >
              Clear Records
            </Button>
          </div>

          <div
            css={css`
              flex: 1;
              overflow-y: auto;
              max-height: 540px;
              padding-right: ${designTokens.spacing[2]};
              display: flex;
              flex-direction: column;
              gap: ${designTokens.spacing[4]};
            `}
          >
            {results.length === 0 ? (
              <div
                css={css`
                  height: 200px;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  background: rgba(255, 255, 255, 0.4);
                  border: 1px dashed ${designTokens.colors.neutral[300]};
                  border-radius: ${designTokens.borderRadius.xl};
                  color: ${designTokens.colors.neutral[400]};
                  font-size: ${designTokens.typography.fontSize.sm};
                `}
              >
                No actions recorded in this session.
              </div>
            ) : (
              results.map((result, index) => (
                <Card
                  key={index}
                  variant="elevated"
                  css={css`
                    background: white;
                    border: 1px solid ${designTokens.colors.neutral[200]};
                    border-left: 4px solid
                      ${result.success
                        ? designTokens.colors.semantic.success[500]
                        : designTokens.colors.semantic.error[500]};
                    animation: ${keyframeAnimations.revealUp} 0.5s ${easings.out} both;
                    box-shadow: ${designTokens.shadows.md};
                  `}
                >
                  <CardContent padding="sm">
                    <div
                      css={css`
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: ${designTokens.spacing[4]};
                      `}
                    >
                      <Badge variant={result.success ? 'success' : 'error'}>
                        {result.success ? 'COMPLETED' : 'FAILED'}
                      </Badge>
                      <span
                        css={css`
                          font-size: 10px;
                          font-family: ${designTokens.typography.fontFamily.mono};
                          color: ${designTokens.colors.neutral[400]};
                        `}
                      >
                        ID: {Math.random().toString(36).substring(7).toUpperCase()}
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
                          border: 1px solid ${designTokens.colors.semantic.error[100]};
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
                        <div
                          css={css`
                            display: flex;
                            align-items: center;
                            gap: ${designTokens.spacing[2]};
                            margin-bottom: ${designTokens.spacing[2]};
                          `}
                        >
                          <Badge variant="secondary" size="sm">
                            POLICY AUDIT
                          </Badge>
                        </div>

                        {result.action.policyChecks && result.action.policyChecks.length > 0 && (
                          <div
                            css={css`
                              display: flex;
                              flex-direction: column;
                              gap: ${designTokens.spacing[2]};
                              margin-top: ${designTokens.spacing[3]};
                            `}
                          >
                            {result.action.policyChecks.map((check, idx) => (
                              <div
                                key={idx}
                                css={css`
                                  display: flex;
                                  align-items: center;
                                  justify-content: space-between;
                                  padding: ${designTokens.spacing[2]} ${designTokens.spacing[3]};
                                  background: ${check.result
                                    ? 'rgba(34, 197, 94, 0.05)'
                                    : 'rgba(239, 68, 68, 0.05)'};
                                  border: 1px solid
                                    ${check.result
                                      ? 'rgba(34, 197, 94, 0.1)'
                                      : 'rgba(239, 68, 68, 0.1)'};
                                  border-radius: ${designTokens.borderRadius.md};
                                  font-size: ${designTokens.typography.fontSize.xs};
                                `}
                              >
                                <span
                                  css={css`
                                    font-weight: 600;
                                    color: ${designTokens.colors.neutral[700]};
                                  `}
                                >
                                  {check.policyId}
                                </span>
                                <span
                                  css={css`
                                    color: ${check.result ? '#16a34a' : '#dc2626'};
                                    font-weight: bold;
                                  `}
                                >
                                  {check.result ? 'PASSED' : 'DENIED'}
                                </span>
                              </div>
                            ))}
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
        variant="elevated"
        css={css`
          background: linear-gradient(
            90deg,
            ${designTokens.colors.primary[600]} 0%,
            ${designTokens.colors.primary[800]} 100%
          );
          border: none;
          color: white;
          overflow: hidden;
          position: relative;

          &::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: radial-gradient(
              circle at 100% 0%,
              rgba(255, 255, 255, 0.2) 0%,
              transparent 50%
            );
          }
        `}
      >
        <CardContent
          padding="xl"
          css={css`
            display: flex;
            align-items: center;
            justify-content: space-between;
            position: relative;
            z-index: 1;
            ${layoutUtils.responsive.mobile(css`
              flex-direction: column;
              gap: ${designTokens.spacing[8]};
              text-align: center;
            `)}
          `}
        >
          <div>
            <h4
              css={css`
                font-size: ${designTokens.typography.fontSize.xl};
                font-weight: ${designTokens.typography.fontWeight.bold};
                margin-bottom: ${designTokens.spacing[2]};
                letter-spacing: -0.01em;
              `}
            >
              Diagnostic Verification Complete
            </h4>
            <p
              css={css`
                font-size: ${designTokens.typography.fontSize.base};
                opacity: 0.8;
                max-width: 600px;
              `}
            >
              The agent has successfully cleared simulation guardrails. You may now deploy this
              configuration to the main governance ledger.
            </p>
          </div>
          <div
            css={css`
              display: flex;
              gap: ${designTokens.spacing[4]};
            `}
          >
            <Button
              variant="outline"
              onClick={resetWorkflow}
              css={css`
                background: transparent;
                color: white;
                border-color: rgba(255, 255, 255, 0.4);
                &:hover {
                  background: rgba(255, 255, 255, 0.1);
                }
              `}
            >
              Reset Workshop
            </Button>
            <Button
              css={css`
                background: white;
                color: ${designTokens.colors.primary[700]};
                &:hover {
                  background: ${designTokens.colors.neutral[50]};
                }
              `}
            >
              Deploy to Production
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div css={containerStyles}>
      {showIntro ? (
        renderIntroduction()
      ) : (
        <div
          css={css`
            max-width: 1200px;
            margin: 0 auto;
          `}
        >
          {currentStep === 1 && renderTemplateSelection()}
          {currentStep === 2 && renderScenarioSelection()}
          {currentStep === 3 && renderResults()}
        </div>
      )}
    </div>
  );
}

const terminalHeaderStyles = css`
  display: flex;
  align-items: center;
  padding: ${designTokens.spacing[3]} ${designTokens.spacing[4]};
  background: ${designTokens.colors.neutral[800]};
  border-bottom: 1px solid ${designTokens.colors.neutral[700]};
  border-radius: ${designTokens.borderRadius.md} ${designTokens.borderRadius.md} 0 0;
`;

const terminalDotStyles = css`
  display: flex;
  gap: 6px;
  margin-right: ${designTokens.spacing[4]};
`;

const terminalDot = (color: string) => css`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${color};
`;
