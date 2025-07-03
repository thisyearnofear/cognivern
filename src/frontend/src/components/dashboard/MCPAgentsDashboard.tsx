import { useState, useEffect, useRef } from 'react';
import './MCPAgentsDashboard.css';
import IntegrationDiagram from './IntegrationDiagram';
import CaseStudies from './CaseStudies';
import CaseStudyDemo from './CaseStudyDemo';

interface MCPAgent {
  name: string;
  type: string;
  status: string;
  capabilities: string[];
}

interface MCPStatus {
  status: string;
  server: string;
  agents: MCPAgent[];
}

interface AgentAction {
  id: string;
  type: string;
  timestamp: string;
  description: string;
  metadata: Record<string, any>;
  policyChecks: Array<{
    policyId: string;
    result: boolean;
    reason?: string;
  }>;
}

interface ContractCall {
  type: string;
  params: {
    methodName?: string;
    args?: Record<string, any>;
    gas?: string;
    deposit?: string;
    to?: string;
    data?: string;
    value?: string;
    gasLimit?: string;
  };
}

interface DemoResult {
  id: string;
  timestamp: string;
  type: 'action' | 'contract' | 'transaction';
  data: AgentAction | ContractCall;
  status: 'success' | 'pending' | 'failed';
}

export default function MCPAgentsDashboard() {
  const [mcpStatus, setMcpStatus] = useState<MCPStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<MCPAgent | null>(null);
  const [demoResults, setDemoResults] = useState<DemoResult[]>([]);
  const [demoRunning, setDemoRunning] = useState(false);
  const [logs, setLogs] = useState<Array<{ message: string; type: string }>>([]);
  const logRef = useRef<HTMLDivElement>(null);

  // Fetch MCP status on component mount
  useEffect(() => {
    fetchMCPStatus();
  }, []);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const fetchMCPStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/mcp/status', {
        headers: {
          'X-API-KEY': import.meta.env.VITE_API_KEY || 'escheat-api-key-123456',
        },
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      setMcpStatus(data);

      // Set the first agent as selected by default
      if (data.agents && data.agents.length > 0 && !selectedAgent) {
        setSelectedAgent(data.agents[0]);
      }

      setError(null);
    } catch (err) {
      console.error('Error fetching MCP status:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setMcpStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const reconnectMCP = async () => {
    try {
      setLoading(true);
      addLog('Attempting to reconnect to MCP server...', 'info');

      const response = await fetch('/api/mcp/reconnect', {
        method: 'POST',
        headers: {
          'X-API-KEY': import.meta.env.VITE_API_KEY || 'escheat-api-key-123456',
        },
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      addLog(`Reconnection status: ${data.status}`, 'success');
      addLog(data.message, 'info');

      // Refresh status after reconnection
      setTimeout(fetchMCPStatus, 2000);
    } catch (err) {
      console.error('Error reconnecting to MCP:', err);
      addLog(
        `Reconnection failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error',
      );
    } finally {
      setLoading(false);
    }
  };

  const addLog = (message: string, type: string) => {
    setLogs((prev) => [...prev, { message, type }]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const runAgentDemo = async () => {
    if (!selectedAgent || demoRunning) return;

    setDemoRunning(true);
    addLog(`Starting demo with ${selectedAgent.name}...`, 'info');

    try {
      // Simulate a series of agent actions
      await simulateAgentActions();
    } catch (err) {
      addLog(`Demo error: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    } finally {
      setDemoRunning(false);
    }
  };

  const simulateAgentActions = async () => {
    // Clear previous results
    setDemoResults([]);

    if (selectedAgent?.type === 'showcase') {
      await simulateShowcaseAgentActions();
    } else if (selectedAgent?.type === 'contract-agent') {
      await simulateContractAgentActions();
    }
  };

  const simulateShowcaseAgentActions = async () => {
    // Simulate policy check
    addLog('Performing policy check...', 'info');
    await delay(800);

    const policyCheckResult: DemoResult = {
      id: `demo-${Date.now()}-1`,
      timestamp: new Date().toISOString(),
      type: 'action',
      data: {
        id: `showcase-${Date.now()}-1`,
        type: 'policy-check',
        timestamp: new Date().toISOString(),
        description: 'Performing policy check for data-access action',
        metadata: {
          agent: 'showcase',
          version: '1.0.0',
          policyId: 'data-access-policy',
          actionType: 'data-access',
        },
        policyChecks: [
          {
            policyId: 'data-access-policy',
            result: true,
            reason: 'Action complies with data access policy',
          },
        ],
      },
      status: 'success',
    };

    setDemoResults((prev) => [...prev, policyCheckResult]);
    addLog('Policy check completed successfully', 'success');

    // Simulate metrics collection
    addLog('Collecting platform metrics...', 'info');
    await delay(1000);

    const metricsResult: DemoResult = {
      id: `demo-${Date.now()}-2`,
      timestamp: new Date().toISOString(),
      type: 'action',
      data: {
        id: `showcase-${Date.now()}-2`,
        type: 'metrics-collection',
        timestamp: new Date().toISOString(),
        description: 'Collecting platform performance metrics',
        metadata: {
          agent: 'showcase',
          version: '1.0.0',
          metrics: {
            responseTime: 87,
            successRate: 98.5,
            errorRate: 1.5,
            totalRequests: 1250,
          },
        },
        policyChecks: [],
      },
      status: 'success',
    };

    setDemoResults((prev) => [...prev, metricsResult]);
    addLog('Metrics collection completed', 'success');
  };

  const simulateContractAgentActions = async () => {
    // Simulate contract call generation
    addLog('Generating smart contract transaction...', 'info');
    await delay(1200);

    const contractCallResult: DemoResult = {
      id: `demo-${Date.now()}-1`,
      timestamp: new Date().toISOString(),
      type: 'contract',
      data: {
        type: 'FunctionCall',
        params: {
          methodName: 'transfer',
          args: {
            receiver_id: 'alice.near',
            amount: '1000000000000000000000000',
          },
          gas: '30000000000000',
          deposit: '1',
        },
      },
      status: 'success',
    };

    setDemoResults((prev) => [...prev, contractCallResult]);
    addLog('Contract transaction generated', 'success');

    // Simulate policy check
    addLog('Checking contract policy compliance...', 'info');
    await delay(800);

    const policyCheckResult: DemoResult = {
      id: `demo-${Date.now()}-2`,
      timestamp: new Date().toISOString(),
      type: 'action',
      data: {
        id: `contract-${Date.now()}`,
        type: 'contract-policy-check',
        timestamp: new Date().toISOString(),
        description: 'Checking policy compliance for contract interaction',
        metadata: {
          agent: 'contract-agent',
          version: '1.0.0',
          contractAddress: 'example.near',
          methodName: 'transfer',
          chain: 'near',
        },
        policyChecks: [
          {
            policyId: 'contract-interaction-policy',
            result: true,
            reason: 'Contract interaction complies with security policies',
          },
          {
            policyId: 'gas-limit-policy',
            result: true,
            reason: 'Gas limit within acceptable range',
          },
        ],
      },
      status: 'success',
    };

    setDemoResults((prev) => [...prev, policyCheckResult]);
    addLog('Contract policy check completed', 'success');
  };

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  if (loading && !mcpStatus) {
    return <div className="mcp-loading">Loading MCP status...</div>;
  }

  if (error && !mcpStatus) {
    return (
      <div className="mcp-error">
        <h3>Error Loading MCP Status</h3>
        <p>{error}</p>
        <button onClick={fetchMCPStatus}>Retry</button>
      </div>
    );
  }

  return (
    <div className="mcp-dashboard">
      <div className="mcp-header">
        <h2>Bitte Protocol MCP Integration</h2>
        <div className="mcp-status-indicator">
          <span
            className={`status-dot ${mcpStatus?.status === 'connected' ? 'connected' : 'disconnected'}`}
          ></span>
          <span className="status-text">
            {mcpStatus?.status === 'connected' ? 'Connected' : 'Disconnected'} to{' '}
            {mcpStatus?.server || 'MCP Server'}
          </span>
          <button
            className="reconnect-button"
            onClick={reconnectMCP}
            disabled={loading || mcpStatus?.status === 'connected'}
          >
            {loading ? 'Connecting...' : 'Reconnect'}
          </button>
        </div>
      </div>

      <div className="mcp-content">
        <div className="mcp-agents-panel">
          <h3>Available Agents</h3>
          {mcpStatus?.agents && mcpStatus.agents.length > 0 ? (
            <div className="agent-cards">
              {mcpStatus.agents.map((agent, index) => (
                <div
                  key={index}
                  className={`agent-card ${selectedAgent?.name === agent.name ? 'selected' : ''}`}
                  onClick={() => setSelectedAgent(agent)}
                >
                  <h4>{agent.name}</h4>
                  <div className="agent-type">{agent.type}</div>
                  <div className="agent-status">Status: {agent.status}</div>
                  <div className="agent-capabilities">
                    <h5>Capabilities:</h5>
                    <ul>
                      {agent.capabilities.map((capability, idx) => (
                        <li key={idx}>{capability}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-agents">No agents available</div>
          )}
        </div>

        <div className="mcp-demo-panel">
          <div className="demo-header">
            <h3>Agent Demo</h3>
            <button
              className="run-demo-button"
              onClick={runAgentDemo}
              disabled={!selectedAgent || demoRunning}
            >
              {demoRunning ? 'Running...' : 'Run Demo'}
            </button>
          </div>

          <div className="demo-content">
            <div className="demo-logs">
              <div className="logs-header">
                <h4>Live Logs</h4>
                <button className="clear-logs-button" onClick={clearLogs}>
                  Clear
                </button>
              </div>
              <div className="logs-content" ref={logRef}>
                {logs.length === 0 ? (
                  <div className="empty-logs">Run a demo to see logs</div>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className={`log-entry ${log.type}`}>
                      {log.message}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="demo-results">
              <h4>Results</h4>
              {demoResults.length === 0 ? (
                <div className="empty-results">No results yet</div>
              ) : (
                <div className="results-list">
                  {demoResults.map((result) => (
                    <div key={result.id} className="result-item">
                      <div className="result-header">
                        <span className="result-type">{result.type}</span>
                        <span className={`result-status ${result.status}`}>{result.status}</span>
                      </div>
                      <div className="result-timestamp">
                        {new Date(result.timestamp).toLocaleString()}
                      </div>
                      <div className="result-data">
                        <pre>{JSON.stringify(result.data, null, 2)}</pre>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <IntegrationDiagram />

      <CaseStudyDemo />

      <CaseStudies />
    </div>
  );
}
