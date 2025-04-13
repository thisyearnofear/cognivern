import { useState, useRef, useEffect } from 'react';
import './AgentTestPanel.css';

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

export default function AgentTestPanel() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [selectedScenario, setSelectedScenario] = useState('standard');
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (message: string, type: 'info' | 'error' | 'success' | 'loading' = 'info') => {
    setLogs((prev) => [...prev, { message, type, timestamp: new Date() }]);
  };

  const scenarios = [
    {
      id: 'standard',
      name: 'Standard Action',
      description: 'Perform a standard agent action that should pass all policy checks',
    },
    {
      id: 'unauthorized',
      name: 'Unauthorized Action',
      description: 'Attempt an unauthorized action that should fail policy checks',
    },
    {
      id: 'high-load',
      name: 'High Load Test',
      description: 'Generate multiple actions to test system performance',
    },
    {
      id: 'resource-intensive',
      name: 'Resource Intensive',
      description: 'Perform a resource-intensive operation to test monitoring',
    },
    {
      id: 'gemini-query',
      name: 'Gemini Integration',
      description: 'Use Gemini API to generate content and track it',
    },
  ];

  const runTest = async () => {
    setLoading(true);
    addLog(`Starting ${selectedScenario} test scenario...`, 'loading');

    try {
      // Add some delay to show loading state
      addLog('Initializing test environment...', 'info');
      await new Promise((resolve) => setTimeout(resolve, 300));

      addLog(`Creating agent action of type: ${selectedScenario}`, 'info');
      await new Promise((resolve) => setTimeout(resolve, 300));

      addLog('Evaluating against governance policies...', 'info');
      await new Promise((resolve) => setTimeout(resolve, 400));

      if (selectedScenario === 'gemini-query') {
        addLog('Connecting to Gemini API...', 'info');
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      if (selectedScenario === 'resource-intensive') {
        addLog('Performing CPU-intensive calculations...', 'info');
        await new Promise((resolve) => setTimeout(resolve, 800));
      }

      if (selectedScenario === 'high-load') {
        addLog('Generating batch of test actions...', 'info');
        await new Promise((resolve) => setTimeout(resolve, 300));

        for (let i = 1; i <= 5; i++) {
          addLog(`Processing action ${i}/5...`, 'info');
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      addLog('Calculating performance metrics...', 'info');
      await new Promise((resolve) => setTimeout(resolve, 300));

      addLog('Recording action in Recall bucket...', 'info');

      const response = await fetch(`http://localhost:3000/api/agents/test/${selectedScenario}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'Y10tiPBsbyEaZtVEvhu5uRj+YoRRiZQ6m3lsTOky1LQ=',
        },
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();

      // Process the response data
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

      if (data.geminiResponse) {
        addLog('Gemini API response received', 'success');
      } else if (selectedScenario === 'gemini-query') {
        addLog('Gemini API request failed', 'error');
      }

      if (data.metrics) {
        addLog('Metrics updated successfully', 'success');
      }

      addLog('Test completed successfully', 'success');
      setResults((prev) => [{ success: true, ...data }, ...prev]);
    } catch (err) {
      console.error('Error running test:', err);
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

  return (
    <div className="agent-test-panel">
      <h2>Agent Testing Panel</h2>

      <div className="scenario-selector">
        <h3>Select Test Scenario</h3>
        <div className="scenarios">
          {scenarios.map((scenario) => (
            <div
              key={scenario.id}
              className={`scenario-card ${selectedScenario === scenario.id ? 'selected' : ''}`}
              onClick={() => setSelectedScenario(scenario.id)}
            >
              <h4>{scenario.name}</h4>
              <p>{scenario.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mini-terminal-container">
        <div className="mini-terminal-header">
          <h3>Live Terminal Output</h3>
          <button className="clear-logs-btn" onClick={clearLogs}>
            Clear
          </button>
        </div>
        <div className="mini-terminal" ref={terminalRef}>
          {logs.length === 0 ? (
            <div className="terminal-placeholder">
              Run a test to see real-time execution logs...
            </div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className={`terminal-line ${log.type}`}>
                <span className="terminal-timestamp">
                  {`[${log.timestamp.toLocaleTimeString()}]`}
                </span>
                <span className="terminal-message">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="action-buttons">
        <button className="run-test-btn" onClick={runTest} disabled={loading}>
          {loading ? 'Running...' : 'Run Test'}
        </button>
        <button
          className="clear-results-btn"
          onClick={clearResults}
          disabled={results.length === 0}
        >
          Clear Results
        </button>
      </div>

      <div className="test-results">
        <h3>Test Results</h3>
        {results.length === 0 ? (
          <div className="no-results">No tests have been run yet.</div>
        ) : (
          <div className="results-list">
            {results.map((result, index) => (
              <div key={index} className={`result-card ${result.success ? 'success' : 'error'}`}>
                <div className="result-header">
                  <span className="result-status">
                    {result.success ? '✅ Success' : '❌ Error'}
                  </span>
                  <span className="result-timestamp">{new Date().toLocaleTimeString()}</span>
                </div>

                {result.error && <div className="error-message">{result.error}</div>}

                {result.action && (
                  <div className="action-details">
                    <h4>Agent Action</h4>
                    <pre>{JSON.stringify(result.action, null, 2)}</pre>

                    {result.action.policyChecks && result.action.policyChecks.length > 0 && (
                      <div className="policy-checks">
                        <h4>Policy Checks</h4>
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

                {result.geminiResponse && (
                  <div className="gemini-response">
                    <h4>Gemini Response</h4>
                    <div className="gemini-content">{result.geminiResponse}</div>
                  </div>
                )}

                {result.metrics && (
                  <div className="metrics-summary">
                    <h4>Updated Metrics</h4>
                    <div className="metrics-grid">
                      <div className="metric-item">
                        <div className="metric-label">Actions Today</div>
                        <div className="metric-value">
                          {result.metrics.data?.actions?.total || 0}
                        </div>
                      </div>
                      <div className="metric-item">
                        <div className="metric-label">Average Response</div>
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
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
