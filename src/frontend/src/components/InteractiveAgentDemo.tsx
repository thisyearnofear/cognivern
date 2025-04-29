import { useState, useRef, useEffect } from 'react';
import './InteractiveAgentDemo.css';
import PolicyCustomizer, { Policy } from './PolicyCustomizer';
import PerformanceMetrics from './PerformanceMetrics';
import MultiAgentInteraction from './MultiAgentInteraction';

interface PolicyCheck {
  policyId: string;
  result: boolean;
  reason?: string;
}

interface AgentAction {
  id: string;
  timestamp: string;
  type: string;
  description: string;
  metadata: Record<string, any>;
  policyChecks: PolicyCheck[];
}

interface AgentResponse {
  success: boolean;
  action?: AgentAction;
  response?: string;
  error?: string;
}

interface LogMessage {
  message: string;
  type: 'info' | 'error' | 'success' | 'warning';
  timestamp: Date;
}

interface InteractiveAgentDemoProps {
  agentId: string;
  agentName: string;
  agentDescription: string;
  onClose: () => void;
  onDeploy: () => void;
}

export default function InteractiveAgentDemo({
  agentId,
  agentName,
  agentDescription,
  onClose,
  onDeploy,
}: InteractiveAgentDemoProps) {
  const [userInput, setUserInput] = useState('');
  const [conversation, setConversation] = useState<
    { role: 'user' | 'agent' | 'system'; content: string }[]
  >([
    {
      role: 'system',
      content: `Welcome to the interactive demo for ${agentName}. Try asking the agent to perform a task to see how it works with governance controls.`,
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [lastAction, setLastAction] = useState<AgentAction | null>(null);
  const [showGovernance, setShowGovernance] = useState(false);

  // New state variables for enhanced features
  const [activeTab, setActiveTab] = useState<'chat' | 'policy' | 'metrics' | 'multi-agent'>('chat');
  const [currentPolicy, setCurrentPolicy] = useState<Policy | null>(null);
  const [governanceEnabled, setGovernanceEnabled] = useState(true);
  const [showMultiAgentDemo, setShowMultiAgentDemo] = useState(false);

  // Sample available agents for multi-agent demo
  const availableAgents = [
    {
      id: agentId,
      name: agentName,
      description: agentDescription,
      icon: '🤖',
      capabilities: ['Natural Language Processing', 'Task Automation', 'Data Analysis'],
    },
    {
      id: 'data-agent',
      name: 'Data Processor',
      description: 'Specialized in data processing and analysis',
      icon: '📊',
      capabilities: ['Data Processing', 'Statistical Analysis', 'Data Visualization'],
    },
    {
      id: 'security-agent',
      name: 'Security Guardian',
      description: 'Ensures security compliance and data protection',
      icon: '🔒',
      capabilities: ['Threat Detection', 'Access Control', 'Security Auditing'],
    },
    {
      id: 'comms-agent',
      name: 'Communications Agent',
      description: 'Handles external communications and messaging',
      icon: '📨',
      capabilities: ['Email Processing', 'Message Formatting', 'Communication Protocols'],
    },
  ];

  const conversationEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (conversationEndRef.current) {
      conversationEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversation]);

  const addLog = (message: string, type: 'info' | 'error' | 'success' | 'warning' = 'info') => {
    setLogs((prev) => [...prev, { message, type, timestamp: new Date() }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userInput.trim()) return;

    // Add user message to conversation
    setConversation((prev) => [...prev, { role: 'user', content: userInput }]);

    // Clear input field
    const input = userInput;
    setUserInput('');

    // Show loading state
    setLoading(true);

    try {
      addLog(`Sending request to ${agentName}...`, 'info');

      // Add thinking indicator
      setConversation((prev) => [...prev, { role: 'agent', content: '...' }]);

      // For demo purposes, we'll use our simulated API response
      // In production, this would make a real API call
      let data: AgentResponse;

      try {
        // Try to make the actual API call
        const response = await fetch(`/api/agents/interact/${agentId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': import.meta.env.VITE_API_KEY || 'escheat-api-key-123456',
          },
          body: JSON.stringify({ input }),
        });

        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }

        data = await response.json();
      } catch (apiError) {
        console.warn('API call failed, using simulated response:', apiError);
        // Fallback to simulated response if API call fails
        data = await simulateResponse(input);
      }

      // Remove the thinking indicator
      setConversation((prev) => prev.slice(0, -1));

      if (data.success) {
        // Add agent response to conversation
        setConversation((prev) => [
          ...prev,
          { role: 'agent', content: data.response || 'No response provided' },
        ]);

        // If there's an action, store it and log policy checks
        if (data.action) {
          setLastAction(data.action);

          addLog(`Action completed: ${data.action.id}`, 'success');

          if (data.action.policyChecks) {
            const passedChecks = data.action.policyChecks.filter((c) => c.result).length;
            const failedChecks = data.action.policyChecks.filter((c) => !c.result).length;

            if (failedChecks > 0) {
              addLog(`Policy checks: ${passedChecks} passed, ${failedChecks} failed`, 'warning');
            } else {
              addLog(`Policy checks: All ${passedChecks} passed`, 'success');
            }
          }
        }
      } else {
        // Add error message to conversation
        setConversation((prev) => [
          ...prev,
          {
            role: 'agent',
            content: `I'm sorry, I couldn't complete that action. ${data.error || 'An unknown error occurred.'}`,
          },
        ]);

        addLog(`Error: ${data.error || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      console.error('Error interacting with agent:', err);

      // Remove the thinking indicator
      setConversation((prev) => prev.slice(0, -1));

      // Add error message to conversation
      setConversation((prev) => [
        ...prev,
        {
          role: 'agent',
          content: `I'm sorry, an error occurred while processing your request. Please try again.`,
        },
      ]);

      addLog(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // For demo purposes, simulate API response
  const simulateResponse = async (input: string) => {
    // Wait for a realistic delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Generate a response based on input
    let response = '';
    let policyChecks: PolicyCheck[] = [];

    if (input.toLowerCase().includes('delete') || input.toLowerCase().includes('remove')) {
      response =
        "I'm sorry, I can't perform that action as it violates the data protection policy.";
      policyChecks = [
        {
          policyId: 'data-protection',
          result: false,
          reason: 'Delete operations require explicit authorization',
        },
        { policyId: 'audit-logging', result: true },
      ];
    } else if (input.toLowerCase().includes('send') || input.toLowerCase().includes('email')) {
      response = "I've prepared the message, but it needs human approval before sending.";
      policyChecks = [
        { policyId: 'communication', result: true, reason: 'Message content approved' },
        {
          policyId: 'human-in-loop',
          result: false,
          reason: 'External communications require human approval',
        },
      ];
    } else {
      response = `I've processed your request: "${input}". The action has been completed successfully.`;
      policyChecks = [
        { policyId: 'data-access', result: true },
        { policyId: 'audit-logging', result: true },
        { policyId: 'rate-limiting', result: true },
      ];
    }

    return {
      success: true,
      response,
      action: {
        id: `action-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'user-request',
        description: `Processed user request: ${input.substring(0, 50)}${input.length > 50 ? '...' : ''}`,
        metadata: { input },
        policyChecks,
      },
    };
  };

  const toggleGovernance = () => {
    setShowGovernance((prev) => !prev);
  };

  // Handler for policy changes
  const handlePolicyChange = (policy: Policy) => {
    setCurrentPolicy(policy);

    // Log the policy change
    addLog(`Policy updated to ${policy.name}`, 'info');

    // In a real implementation, this would update the agent's governance settings
    console.log('Policy updated:', policy);
  };

  // Handler for toggling governance on/off
  const handleToggleGovernance = () => {
    setGovernanceEnabled((prev) => !prev);

    // Log the governance change
    addLog(
      `Governance ${!governanceEnabled ? 'enabled' : 'disabled'}`,
      !governanceEnabled ? 'success' : 'warning',
    );
  };

  // Handler for launching multi-agent demo
  const handleLaunchMultiAgent = () => {
    setShowMultiAgentDemo(true);
  };

  // Handler for closing multi-agent demo
  const handleCloseMultiAgent = () => {
    setShowMultiAgentDemo(false);
  };

  return (
    <div className="interactive-agent-demo">
      <div className="demo-header">
        <h2>Interactive Demo: {agentName}</h2>
        <p className="agent-description">{agentDescription}</p>

        <div className="demo-tabs">
          <button
            className={`tab-button ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            Chat
          </button>
          <button
            className={`tab-button ${activeTab === 'metrics' ? 'active' : ''}`}
            onClick={() => setActiveTab('metrics')}
          >
            Performance
          </button>

          <div className="tab-dropdown">
            <button className="tab-more-button">
              More Features
              <span className="dropdown-arrow">▼</span>
            </button>
            <div className="tab-dropdown-content">
              <button
                className={`dropdown-item ${activeTab === 'policy' ? 'active' : ''}`}
                onClick={() => setActiveTab('policy')}
              >
                Policy Customization
              </button>
              <button
                className={`dropdown-item ${activeTab === 'multi-agent' ? 'active' : ''}`}
                onClick={() => setActiveTab('multi-agent')}
              >
                Multi-Agent Collaboration
              </button>
            </div>
          </div>

          <div className="tab-indicators">
            <span className={`indicator ${activeTab === 'chat' ? 'active' : ''}`}></span>
            <span className={`indicator ${activeTab === 'metrics' ? 'active' : ''}`}></span>
            <span className={`indicator ${activeTab === 'policy' ? 'active' : ''}`}></span>
            <span className={`indicator ${activeTab === 'multi-agent' ? 'active' : ''}`}></span>
          </div>
        </div>

        <div className="demo-controls">
          {activeTab === 'chat' && (
            <button
              className={`governance-toggle ${showGovernance ? 'active' : ''}`}
              onClick={toggleGovernance}
            >
              {showGovernance ? 'Hide Governance' : 'Show Governance'}
            </button>
          )}
          <button className="close-button" onClick={onClose}>
            Close Demo
          </button>
        </div>
      </div>

      {activeTab === 'chat' && (
        <div className="demo-content">
          <div className={`conversation-container ${showGovernance ? 'with-governance' : ''}`}>
            <div className="conversation">
              {conversation.map((message, index) => (
                <div key={index} className={`message ${message.role}`}>
                  {message.role === 'user' && <div className="message-avatar">👤</div>}
                  {message.role === 'agent' && <div className="message-avatar">🤖</div>}
                  {message.role === 'system' && <div className="message-avatar">ℹ️</div>}
                  <div className="message-content">{message.content}</div>
                </div>
              ))}
              <div ref={conversationEndRef} />
            </div>

            <form className="input-form" onSubmit={handleSubmit}>
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Type a message to the agent..."
                disabled={loading}
              />
              <button type="submit" disabled={loading || !userInput.trim()}>
                {loading ? 'Sending...' : 'Send'}
              </button>
            </form>
          </div>

          {showGovernance && (
            <div className="governance-panel">
              <div className="governance-header">
                <h3>Governance Controls</h3>
              </div>

              <div className="logs-container">
                <h4>Action Logs</h4>
                <div className="logs">
                  {logs.length === 0 ? (
                    <div className="empty-logs">No actions logged yet</div>
                  ) : (
                    logs.map((log, index) => (
                      <div key={index} className={`log-entry ${log.type}`}>
                        <span className="log-time">{log.timestamp.toLocaleTimeString()}</span>
                        <span className="log-message">{log.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {lastAction && (
                <div className="policy-checks">
                  <h4>Policy Checks</h4>
                  <div className="policy-list">
                    {lastAction.policyChecks.map((check, index) => (
                      <div
                        key={index}
                        className={`policy-check ${check.result ? 'passed' : 'failed'}`}
                      >
                        <div className="check-status">{check.result ? '✓' : '✗'}</div>
                        <div className="check-details">
                          <div className="policy-name">{check.policyId}</div>
                          {check.reason && <div className="check-reason">{check.reason}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="governance-actions">
                <button className="deploy-button" onClick={onDeploy}>
                  Deploy This Agent
                </button>
                <button className="customize-button" onClick={() => setActiveTab('policy')}>
                  Customize Policies
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'policy' && (
        <div className="demo-content policy-content">
          <PolicyCustomizer onPolicyChange={handlePolicyChange} initialPolicy={currentPolicy} />

          <div className="policy-actions">
            <button
              className="apply-button"
              onClick={() => {
                setActiveTab('chat');
                addLog(
                  `Applied policy: ${currentPolicy?.name || 'Standard Governance'}`,
                  'success',
                );
              }}
            >
              Apply Policy
            </button>
            <button className="cancel-button" onClick={() => setActiveTab('chat')}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {activeTab === 'metrics' && (
        <div className="demo-content metrics-content">
          <PerformanceMetrics
            agentId={agentId}
            governanceEnabled={governanceEnabled}
            onToggleGovernance={handleToggleGovernance}
          />
        </div>
      )}

      {activeTab === 'multi-agent' && (
        <div className="demo-content multi-agent-content">
          <div className="multi-agent-intro">
            <h3>Multi-Agent Collaboration</h3>
            <p>
              Test how this agent can collaborate with other specialized agents to solve complex
              tasks. Each agent has different capabilities and governance controls.
            </p>

            <button className="launch-multi-agent-button" onClick={handleLaunchMultiAgent}>
              Launch Multi-Agent Demo
            </button>
          </div>
        </div>
      )}

      <div className="demo-footer">
        <p>This is a simulated demo environment. No real actions are being performed.</p>
      </div>

      {showMultiAgentDemo && (
        <div className="multi-agent-overlay">
          <MultiAgentInteraction
            primaryAgentId={agentId}
            availableAgents={availableAgents}
            onClose={handleCloseMultiAgent}
          />
        </div>
      )}
    </div>
  );
}
