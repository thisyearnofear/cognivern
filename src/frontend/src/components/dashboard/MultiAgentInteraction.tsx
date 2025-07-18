import { useState, useEffect, useRef } from 'react';
import { css } from '@emotion/react';
import { designTokens } from '../../styles/designTokens';

import { BaseAgent } from '../../types';

interface InteractionAgent extends BaseAgent {
  description: string;
  icon: string;
}

interface Message {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  content: string;
  timestamp: string;
  status: 'pending' | 'approved' | 'rejected';
  policyChecks?: {
    policyId: string;
    result: boolean;
    reason?: string;
  }[];
}

interface MultiAgentInteractionProps {
  primaryAgentId: string;
  availableAgents: InteractionAgent[];
  onClose: () => void;
}

export default function MultiAgentInteraction({
  primaryAgentId,
  availableAgents,
  onClose,
}: MultiAgentInteractionProps) {
  const [selectedAgents, setSelectedAgents] = useState<string[]>([primaryAgentId]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'interaction' | 'governance'>('interaction');
  const [showAllAgents, setShowAllAgents] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Find agent by ID
  const getAgent = (agentId: string): Agent | undefined => {
    return availableAgents.find((agent) => agent.id === agentId);
  };

  // Toggle agent selection
  const toggleAgentSelection = (agentId: string) => {
    if (agentId === primaryAgentId) return; // Can't deselect primary agent

    setSelectedAgents((prev) => {
      if (prev.includes(agentId)) {
        return prev.filter((id) => id !== agentId);
      } else {
        return [...prev, agentId];
      }
    });
  };

  // Handle user input submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userInput.trim() || loading) return;

    setLoading(true);

    try {
      // Create a new message from user to primary agent
      const userMessage: Message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        fromAgentId: 'user',
        toAgentId: primaryAgentId,
        content: userInput,
        timestamp: new Date().toISOString(),
        status: 'approved',
      };

      setMessages((prev) => [...prev, userMessage]);
      setUserInput('');

      // Simulate processing time
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Generate primary agent response
      await generateAgentResponse(primaryAgentId, userInput);

      // If there are other selected agents, have them interact
      if (selectedAgents.length > 1) {
        // Simulate a delay between agent responses
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // Generate interactions between agents
        await generateAgentInteractions();
      }
    } catch (error) {
      console.error('Error in multi-agent interaction:', error);
    } finally {
      setLoading(false);
    }
  };

  // Generate a response from an agent
  const generateAgentResponse = async (agentId: string, prompt: string) => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 800));

    const agent = getAgent(agentId);
    if (!agent) return;

    // Generate a response based on the agent's capabilities
    let response = '';
    let status: 'approved' | 'rejected' | 'pending' = 'approved';
    let policyChecks = [];

    // Generate different responses based on the prompt content
    if (prompt.toLowerCase().includes('delete') || prompt.toLowerCase().includes('remove')) {
      response = `I've analyzed the request to delete/remove data. This requires additional verification.`;
      status = 'pending';
      policyChecks = [
        {
          policyId: 'data-protection',
          result: false,
          reason: 'Delete operations require explicit authorization',
        },
        { policyId: 'audit-logging', result: true },
      ];
    } else if (prompt.toLowerCase().includes('send') || prompt.toLowerCase().includes('email')) {
      response = `I've prepared the message content based on your request. It's ready for review before sending.`;
      status = 'pending';
      policyChecks = [
        { policyId: 'communication', result: true, reason: 'Message content approved' },
        {
          policyId: 'human-in-loop',
          result: false,
          reason: 'External communications require human approval',
        },
      ];
    } else {
      // Generate a response based on the agent's capabilities
      const capability = agent.capabilities[Math.floor(Math.random() * agent.capabilities.length)];
      response = `I've processed your request using my ${capability} capability. The task has been completed successfully.`;
      policyChecks = [
        { policyId: 'data-access', result: true },
        { policyId: 'audit-logging', result: true },
        { policyId: 'rate-limiting', result: true },
      ];
    }

    const newMessage: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      fromAgentId: agentId,
      toAgentId: 'user',
      content: response,
      timestamp: new Date().toISOString(),
      status,
      policyChecks,
    };

    setMessages((prev) => [...prev, newMessage]);
    return newMessage;
  };

  // Generate interactions between agents
  const generateAgentInteractions = async () => {
    // Get agents other than the primary one
    const secondaryAgents = selectedAgents.filter((id) => id !== primaryAgentId);

    // For each secondary agent, generate an interaction
    for (const agentId of secondaryAgents) {
      // Simulate processing time
      await new Promise((resolve) => setTimeout(resolve, 800));

      const agent = getAgent(agentId);
      const primaryAgent = getAgent(primaryAgentId);

      if (!agent || !primaryAgent) continue;

      // Primary agent asks secondary agent for help
      const requestMessage: Message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        fromAgentId: primaryAgentId,
        toAgentId: agentId,
        content: `I need assistance with a task that requires your ${agent.capabilities[0]} capability. Can you help process this request?`,
        timestamp: new Date().toISOString(),
        status: 'approved',
        policyChecks: [
          { policyId: 'agent-collaboration', result: true },
          { policyId: 'data-sharing', result: true },
        ],
      };

      setMessages((prev) => [...prev, requestMessage]);

      // Simulate processing time
      await new Promise((resolve) => setTimeout(resolve, 1200));

      // Secondary agent responds
      const responseMessage: Message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        fromAgentId: agentId,
        toAgentId: primaryAgentId,
        content: `I've analyzed the request and completed the task using my ${agent.capabilities[0]} capability. Here are the results for your review.`,
        timestamp: new Date().toISOString(),
        status: 'approved',
        policyChecks: [
          { policyId: 'agent-collaboration', result: true },
          { policyId: 'data-sharing', result: true },
          { policyId: 'result-verification', result: true },
        ],
      };

      setMessages((prev) => [...prev, responseMessage]);

      // Simulate processing time
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Primary agent confirms to user
      const confirmationMessage: Message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        fromAgentId: primaryAgentId,
        toAgentId: 'user',
        content: `I've collaborated with the ${agent.name} to complete your request. The task has been successfully processed with enhanced capabilities.`,
        timestamp: new Date().toISOString(),
        status: 'approved',
        policyChecks: [
          { policyId: 'result-verification', result: true },
          { policyId: 'audit-logging', result: true },
        ],
      };

      setMessages((prev) => [...prev, confirmationMessage]);
    }
  };

  // Approve a pending message
  const approveMessage = (messageId: string) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, status: 'approved' } : msg)),
    );
  };

  // Reject a pending message
  const rejectMessage = (messageId: string) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, status: 'rejected' } : msg)),
    );
  };

  return (
    <div className="multi-agent-interaction">
      <div className="interaction-header">
        <h2>Multi-Agent Collaboration</h2>
        <div className="header-actions">
          <button
            className={`view-toggle ${activeTab === 'governance' ? 'active' : ''}`}
            onClick={() => setActiveTab(activeTab === 'interaction' ? 'governance' : 'interaction')}
          >
            {activeTab === 'interaction' ? 'Show Governance' : 'Show Chat'}
          </button>
          <button className="close-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <div className="interaction-content">
        <div className="agents-selection">
          <div className="agents-header">
            <h3>Participating Agents</h3>
            {availableAgents.length > 3 &&
              (showAllAgents ? (
                <button className="show-less-button" onClick={() => setShowAllAgents(false)}>
                  Show Less
                </button>
              ) : (
                <button className="show-more-button" onClick={() => setShowAllAgents(true)}>
                  Show All Agents
                </button>
              ))}
          </div>
          <div className="agents-grid">
            {availableAgents
              .filter(
                (agent) =>
                  showAllAgents ||
                  agent.id === primaryAgentId ||
                  selectedAgents.includes(agent.id) ||
                  availableAgents.indexOf(agent) < 3,
              )
              .map((agent) => (
                <div
                  key={agent.id}
                  className={`agent-card ${selectedAgents.includes(agent.id) ? 'selected' : ''} ${agent.id === primaryAgentId ? 'primary' : ''}`}
                  onClick={() => toggleAgentSelection(agent.id)}
                >
                  <div className="agent-icon">{agent.icon}</div>
                  <div className="agent-info">
                    <div className="agent-name">{agent.name}</div>
                    <div className="agent-capabilities">
                      {agent.capabilities.slice(0, 2).map((capability, index) => (
                        <span key={index} className="capability-tag">
                          {capability}
                        </span>
                      ))}
                      {agent.capabilities.length > 2 && (
                        <span className="capability-more">+{agent.capabilities.length - 2}</span>
                      )}
                    </div>
                  </div>
                  {agent.id === primaryAgentId && <div className="primary-badge">Primary</div>}
                </div>
              ))}
          </div>
        </div>

        {activeTab === 'interaction' ? (
          <div className="interaction-panel">
            <div className="messages-container">
              {messages.length === 0 ? (
                <div className="empty-messages">
                  <p>
                    No messages yet. Start the conversation to see multi-agent collaboration in
                    action.
                  </p>
                </div>
              ) : (
                <div className="messages">
                  {messages.map((message) => {
                    const fromAgent =
                      message.fromAgentId === 'user'
                        ? { name: 'You', icon: '👤' }
                        : getAgent(message.fromAgentId);

                    const toAgent =
                      message.toAgentId === 'user'
                        ? { name: 'You', icon: '👤' }
                        : getAgent(message.toAgentId);

                    if (!fromAgent || !toAgent) return null;

                    return (
                      <div
                        key={message.id}
                        className={`message ${message.fromAgentId === 'user' ? 'user-message' : 'agent-message'} ${message.status}`}
                      >
                        <div className="message-header">
                          <div className="message-from">
                            <span className="agent-icon">{fromAgent.icon}</span>
                            <span className="agent-name">{fromAgent.name}</span>
                          </div>
                          <div className="message-to">
                            <span className="to-label">to</span>
                            <span className="agent-icon">{toAgent.icon}</span>
                            <span className="agent-name">{toAgent.name}</span>
                          </div>
                        </div>

                        <div className="message-content">{message.content}</div>

                        {message.status === 'pending' && (
                          <div className="message-actions">
                            <div className="action-label">This message requires approval:</div>
                            <div className="action-buttons">
                              <button
                                className="approve-button"
                                onClick={() => approveMessage(message.id)}
                              >
                                Approve
                              </button>
                              <button
                                className="reject-button"
                                onClick={() => rejectMessage(message.id)}
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        )}

                        {message.status === 'rejected' && (
                          <div className="rejection-notice">
                            This message was rejected due to policy violations.
                          </div>
                        )}

                        <div className="message-timestamp">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <form className="input-form" onSubmit={handleSubmit}>
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder={`Send a message to ${getAgent(primaryAgentId)?.name || 'primary agent'}...`}
                disabled={loading}
              />
              <button type="submit" disabled={loading || !userInput.trim()}>
                {loading ? 'Sending...' : 'Send'}
              </button>
            </form>
          </div>
        ) : (
          <div className="governance-panel">
            <div className="governance-header">
              <h3>Governance Overview</h3>
              <p>Monitor policy checks and agent interactions</p>
            </div>

            <div className="policy-checks">
              <h4>Policy Checks</h4>
              <div className="checks-summary">
                <div className="check-stat">
                  <div className="stat-value">
                    {messages.filter((m) => m.policyChecks?.every((c) => c.result)).length}
                  </div>
                  <div className="stat-label">Passed</div>
                </div>
                <div className="check-stat">
                  <div className="stat-value">
                    {messages.filter((m) => m.policyChecks?.some((c) => !c.result)).length}
                  </div>
                  <div className="stat-label">Failed</div>
                </div>
                <div className="check-stat">
                  <div className="stat-value">
                    {messages.filter((m) => m.status === 'pending').length}
                  </div>
                  <div className="stat-label">Pending</div>
                </div>
              </div>

              <div className="checks-list">
                {messages
                  .filter((m) => m.policyChecks && m.policyChecks.length > 0)
                  .map((message) => {
                    const agent =
                      message.fromAgentId === 'user'
                        ? { name: 'You', icon: '👤' }
                        : getAgent(message.fromAgentId);

                    if (!agent || !message.policyChecks) return null;

                    return (
                      <div key={message.id} className="check-item">
                        <div className="check-header">
                          <div className="check-agent">
                            <span className="agent-icon">{agent.icon}</span>
                            <span className="agent-name">{agent.name}</span>
                          </div>
                          <div className="check-timestamp">
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </div>
                        </div>

                        <div className="check-policies">
                          {message.policyChecks.map((check, index) => (
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
                    );
                  })}
              </div>
            </div>

            <div className="interaction-flow">
              <h4>Agent Interaction Flow</h4>
              <div className="flow-diagram">
                {selectedAgents.length <= 1 ? (
                  <div className="no-flow">
                    Select multiple agents to visualize interaction flow
                  </div>
                ) : (
                  <div className="flow-chart">
                    <div className="flow-node user">
                      <div className="node-icon">👤</div>
                      <div className="node-label">User</div>
                    </div>

                    <div className="flow-arrow">→</div>

                    <div className="flow-node primary">
                      <div className="node-icon">{getAgent(primaryAgentId)?.icon}</div>
                      <div className="node-label">{getAgent(primaryAgentId)?.name}</div>
                    </div>

                    {selectedAgents
                      .filter((id) => id !== primaryAgentId)
                      .map((agentId, index) => {
                        const agent = getAgent(agentId);
                        if (!agent) return null;

                        return (
                          <div key={agentId} className="flow-branch">
                            <div className="flow-arrow">→</div>
                            <div className="flow-node secondary">
                              <div className="node-icon">{agent.icon}</div>
                              <div className="node-label">{agent.name}</div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
