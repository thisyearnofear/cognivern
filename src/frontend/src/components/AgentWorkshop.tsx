import { useState, useRef, useEffect } from 'react';
import './AgentWorkshop.css';

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
  const [loading, setLoading] = useState(false);
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

  const addLog = (message: string, type: 'info' | 'error' | 'success' | 'loading' = 'info') => {
    setLogs((prev) => [...prev, { message, type, timestamp: new Date() }]);
  };

  const agentTemplates: AgentTemplate[] = [
    {
      id: 'ad-allocation',
      name: 'Ad Allocation Agent',
      description: 'Intelligently allocates ad placements based on contract terms, content relevance, and audience targeting',
      icon: '📊',
      useCases: [
        'Newsletter publishers with multiple advertisers',
        'Content platforms with premium placement options',
        'Media companies managing sponsor commitments'
      ],
      benefits: [
        'Ensures fair distribution based on contract terms',
        'Optimizes for content relevance and engagement',
        'Maintains complete audit trail for advertiser reporting'
      ]
    },
    {
      id: 'compliance',
      name: 'Compliance Guardian',
      description: 'Ensures all content and operations meet regulatory requirements with automatic policy enforcement',
      icon: '🛡️',
      useCases: [
        'Financial services content review',
        'Healthcare information management',
        'Legal document processing'
      ],
      benefits: [
        'Prevents policy violations before they occur',
        'Creates defensible audit trails for regulators',
        'Adapts to changing compliance requirements'
      ]
    },
    {
      id: 'insights',
      name: 'Audience Insights Agent',
      description: 'Analyzes user behavior to optimize content strategy and business decisions',
      icon: '📈',
      useCases: [
        'Content strategy optimization',
        'Subscriber retention programs',
        'Product recommendation systems'
      ],
      benefits: [
        'Identifies engagement patterns across audience segments',
        'Recommends content optimizations with expected impact',
        'Protects user privacy while delivering insights'
      ]
    },
    {
      id: 'workflow',
      name: 'Workflow Automation Agent',
      description: 'Orchestrates complex business processes with governance and human oversight',
      icon: '⚙️',
      useCases: [
        'Editorial approval workflows',
        'Customer onboarding processes',
        'Supply chain management'
      ],
      benefits: [
        'Reduces manual handoffs and bottlenecks',
        'Ensures compliance at every process step',
        'Provides real-time visibility into process status'
      ]
    }
  ];

  const scenariosByTemplate: Record<string, Array<{id: string, name: string, description: string}>> = {
    'ad-allocation': [
      {
        id: 'contract-based',
        name: 'Contract-Based Allocation',
        description: 'Allocate ad placements based on contract terms and remaining inventory'
      },
      {
        id: 'relevance-based',
        name: 'Relevance-Based Placement',
        description: 'Optimize ad placements based on content relevance and expected engagement'
      },
      {
        id: 'conflict-resolution',
        name: 'Advertiser Conflict Resolution',
        description: 'Resolve conflicts when multiple advertisers want the same placement'
      }
    ],
    'compliance': [
      {
        id: 'content-review',
        name: 'Content Policy Review',
        description: 'Review content against regulatory and internal policy requirements'
      },
      {
        id: 'policy-violation',
        name: 'Policy Violation Handling',
        description: 'Process content that violates policies and generate appropriate responses'
      },
      {
        id: 'audit-trail',
        name: 'Compliance Audit Trail',
        description: 'Generate detailed audit trails for regulatory reporting'
      }
    ],
    'insights': [
      {
        id: 'engagement-analysis',
        name: 'Engagement Analysis',
        description: 'Analyze user engagement patterns across content types'
      },
      {
        id: 'segment-discovery',
        name: 'Audience Segment Discovery',
        description: 'Identify new audience segments based on behavior patterns'
      },
      {
        id: 'content-recommendations',
        name: 'Content Recommendations',
        description: 'Generate personalized content recommendations for audience segments'
      }
    ],
    'workflow': [
      {
        id: 'approval-process',
        name: 'Multi-Stage Approval Process',
        description: 'Orchestrate a complex approval workflow with multiple stakeholders'
      },
      {
        id: 'exception-handling',
        name: 'Exception Handling',
        description: 'Process exceptions and route to appropriate human decision-makers'
      },
      {
        id: 'status-reporting',
        name: 'Status Reporting & Metrics',
        description: 'Generate real-time status reports and process metrics'
      }
    ]
  };

  const runTest = async () => {
    if (!selectedTemplate || !selectedScenario) return;
    
    setLoading(true);
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
      const response = await fetch(`/api/agents/test/${selectedTemplate}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': import.meta.env.VITE_API_KEY || 'escheat-api-key-123456',
        },
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
    } finally {
      setLoading(false);
    }
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
    addLog(`Selected ${agentTemplates.find(t => t.id === templateId)?.name}`, 'info');
  };

  const handleScenarioSelect = (scenarioId: string) => {
    setSelectedScenario(scenarioId);
    addLog(`Selected scenario: ${scenariosByTemplate[selectedTemplate!].find(s => s.id === scenarioId)?.name}`, 'info');
  };

  const renderIntroduction = () => (
    <div className="agent-introduction">
      <h2>Agent Workshop</h2>
      <p className="intro-text">
        Build, test, and deploy AI agents with built-in governance and accountability. 
        Our agents help automate complex business decisions while maintaining complete 
        visibility and control.
      </p>
      
      <div className="intro-benefits">
        <div className="benefit-item">
          <div className="benefit-icon">🔍</div>
          <div className="benefit-content">
            <h4>Complete Transparency</h4>
            <p>Every agent action is logged with detailed reasoning and policy checks</p>
          </div>
        </div>
        <div className="benefit-item">
          <div className="benefit-icon">🛡️</div>
          <div className="benefit-content">
            <h4>Policy Enforcement</h4>
            <p>Ensure all agent actions comply with your business rules and regulations</p>
          </div>
        </div>
        <div className="benefit-item">
          <div className="benefit-icon">📊</div>
          <div className="benefit-content">
            <h4>Performance Metrics</h4>
            <p>Track agent performance and compliance with real-time metrics</p>
          </div>
        </div>
      </div>
      
      <button className="get-started-btn" onClick={() => setShowIntro(false)}>
        Get Started with Agent Workshop
      </button>
    </div>
  );

  const renderTemplateSelection = () => (
    <div className="template-selection">
      <h3>Step 1: Select an Agent Template</h3>
      <p className="selection-description">
        Choose a pre-configured agent template designed to solve specific business challenges
      </p>
      
      <div className="templates-grid">
        {agentTemplates.map((template) => (
          <div 
            key={template.id}
            className={`template-card ${selectedTemplate === template.id ? 'selected' : ''}`}
            onClick={() => handleTemplateSelect(template.id)}
          >
            <div className="template-icon">{template.icon}</div>
            <h4>{template.name}</h4>
            <p>{template.description}</p>
            
            <div className="template-details">
              <div className="template-use-cases">
                <h5>Use Cases</h5>
                <ul>
                  {template.useCases.map((useCase, index) => (
                    <li key={index}>{useCase}</li>
                  ))}
                </ul>
              </div>
              
              <div className="template-benefits">
                <h5>Benefits</h5>
                <ul>
                  {template.benefits.map((benefit, index) => (
                    <li key={index}>{benefit}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderScenarioSelection = () => {
    if (!selectedTemplate) return null;
    
    const scenarios = scenariosByTemplate[selectedTemplate];
    const selectedTemplateName = agentTemplates.find(t => t.id === selectedTemplate)?.name;
    
    return (
      <div className="scenario-selection">
        <div className="step-header">
          <button className="back-button" onClick={() => setCurrentStep(1)}>
            ← Back to Templates
          </button>
          <h3>Step 2: Select a Scenario for {selectedTemplateName}</h3>
        </div>
        
        <p className="selection-description">
          Choose a specific scenario to test how the agent handles different situations
        </p>
        
        <div className="scenarios-grid">
          {scenarios.map((scenario) => (
            <div 
              key={scenario.id}
              className={`scenario-card ${selectedScenario === scenario.id ? 'selected' : ''}`}
              onClick={() => handleScenarioSelect(scenario.id)}
            >
              <h4>{scenario.name}</h4>
              <p>{scenario.description}</p>
            </div>
          ))}
        </div>
        
        <div className="scenario-actions">
          <button 
            className="run-scenario-btn" 
            onClick={runTest} 
            disabled={!selectedScenario || loading}
          >
            {loading ? 'Running...' : 'Run Scenario'}
          </button>
        </div>
      </div>
    );
  };

  const renderResults = () => (
    <div className="results-view">
      <div className="step-header">
        <button className="back-button" onClick={() => setCurrentStep(2)}>
          ← Back to Scenarios
        </button>
        <h3>Step 3: Agent Results</h3>
      </div>
      
      <div className="results-container">
        <div className="execution-logs">
          <div className="logs-header">
            <h4>Execution Logs</h4>
            <button className="clear-logs-btn" onClick={clearLogs}>
              Clear
            </button>
          </div>
          <div className="logs-content" ref={terminalRef}>
            {logs.length === 0 ? (
              <div className="logs-placeholder">
                No logs available
              </div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className={`log-entry ${log.type}`}>
                  <span className="log-timestamp">
                    {`[${log.timestamp.toLocaleTimeString()}]`}
                  </span>
                  <span className="log-message">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
        
        <div className="action-results">
          <div className="results-header">
            <h4>Agent Actions</h4>
            <button 
              className="clear-results-btn" 
              onClick={clearResults}
              disabled={results.length === 0}
            >
              Clear
            </button>
          </div>
          
          <div className="results-content">
            {results.length === 0 ? (
              <div className="results-placeholder">
                No results available
              </div>
            ) : (
              results.map((result, index) => (
                <div key={index} className={`result-card ${result.success ? 'success' : 'error'}`}>
                  <div className="result-header">
                    <span className="result-status">
                      {result.success ? '✅ Success' : '❌ Error'}
                    </span>
                    <span className="result-timestamp">{new Date().toLocaleString()}</span>
                  </div>
                  
                  {result.error && <div className="error-message">{result.error}</div>}
                  
                  {result.action && (
                    <div className="action-details">
                      <h5>Agent Action</h5>
                      <pre>{JSON.stringify(result.action, null, 2)}</pre>
                      
                      {result.action.policyChecks && result.action.policyChecks.length > 0 && (
                        <div className="policy-checks">
                          <h5>Policy Checks</h5>
                          <ul>
                            {result.action.policyChecks.map((check, idx) => (
                              <li key={idx} className={check.result ? 'passed' : 'failed'}>
                                {check.policyId}: {check.result ? 'Passed' : 'Failed'} -{' '}
                                {check.reason}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {result.metrics && (
                    <div className="metrics-summary">
                      <h5>Performance Metrics</h5>
                      <div className="metrics-grid">
                        <div className="metric-item">
                          <div className="metric-label">Response Time</div>
                          <div className="metric-value">
                            {result.metrics.data?.performance?.averageResponseTime.toFixed(2) || 0} ms
                          </div>
                        </div>
                        <div className="metric-item">
                          <div className="metric-label">Policy Checks</div>
                          <div className="metric-value">
                            {result.metrics.data?.policies?.total || 0}
                          </div>
                        </div>
                        <div className="metric-item">
                          <div className="metric-label">Success Rate</div>
                          <div className="metric-value">
                            {result.metrics.data?.actions?.successful || 0}/{result.metrics.data?.actions?.total || 0}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
      <div className="next-steps">
        <h4>Next Steps</h4>
        <div className="next-steps-options">
          <button className="try-another-btn" onClick={resetWorkflow}>
            Try Another Agent
          </button>
          <button className="deploy-btn">
            Deploy to Production
          </button>
          <button className="customize-btn">
            Customize This Agent
          </button>
        </div>
      </div>
    </div>
  );

  if (showIntro) {
    return renderIntroduction();
  }

  return (
    <div className="agent-workshop">
      <div className="workshop-progress">
        <div className={`progress-step ${currentStep >= 1 ? 'active' : ''}`}>
          <div className="step-number">1</div>
          <div className="step-label">Select Template</div>
        </div>
        <div className="progress-connector"></div>
        <div className={`progress-step ${currentStep >= 2 ? 'active' : ''}`}>
          <div className="step-number">2</div>
          <div className="step-label">Choose Scenario</div>
        </div>
        <div className="progress-connector"></div>
        <div className={`progress-step ${currentStep >= 3 ? 'active' : ''}`}>
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
