import { useState, useEffect, useRef } from 'react';
import './AgentSimulation.css';

interface SimulationTask {
  id: string;
  name: string;
  description: string;
  humanTimeMinutes: number;
  agentTimeMinutes: number;
  humanErrorRate: number;
  agentErrorRate: number;
  complexity: 'low' | 'medium' | 'high';
}

interface SimulationResult {
  taskId: string;
  humanTime: number;
  agentTime: number;
  humanErrors: number;
  agentErrors: number;
  costSavings: number;
}

export default function AgentSimulation() {
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [simulationComplete, setSimulationComplete] = useState(false);
  const [simulationResults, setSimulationResults] = useState<SimulationResult | null>(null);
  const [logs, setLogs] = useState<{message: string, type: string}[]>([]);
  const [simulationTasks, setSimulationTasks] = useState<SimulationTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const logRef = useRef<HTMLDivElement>(null);
  

  // Add a log message
  const addLog = (message: string, type: string = 'info') => {
    setLogs(prev => [...prev, { message, type }]);
  };

  // Clear logs
  const clearLogs = () => {
    setLogs([]);
  };

  // Fetch simulation tasks from the backend
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoadingTasks(true);
        const response = await fetch('/api/simulation/tasks');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setSimulationTasks(data.tasks);
      } catch (e: any) {
        setError(`Failed to fetch simulation tasks: ${e.message}`);
        addLog(`Failed to fetch simulation tasks: ${e.message}`, 'error');
      } finally {
        setLoadingTasks(false);
      }
    };
    fetchTasks();
  }, []);

  // Get the selected task details
  const getSelectedTaskDetails = () => {
    return simulationTasks.find(task => task.id === selectedTask);
  };

  // Start the simulation
  const startSimulation = async () => {
    if (!selectedTask || simulationRunning) return;

    const task = getSelectedTaskDetails();
    if (!task) return;

    setSimulationRunning(true);
    setSimulationComplete(false);
    setSimulationResults(null);
    clearLogs();
    addLog(`Starting simulation for ${task.name}...`, 'info');

    try {
      const response = await fetch('/api/simulation/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ taskId: selectedTask }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const result: SimulationResult = data.result;

      setSimulationResults(result);
      setSimulationComplete(true);
      addLog('Simulation complete!', 'success');
      addLog(`Time saved: ${result.humanTime - result.agentTime} minutes`, 'success');
      addLog(`Error reduction: ${Math.round((1 - result.agentErrors / result.humanErrors) * 100)}%`, 'success');
      addLog(`Cost savings: ${result.costSavings.toFixed(2)} per task`, 'success');

    } catch (e: any) {
      setError(`Simulation failed: ${e.message}`);
      addLog(`Simulation failed: ${e.message}`, 'error');
    } finally {
      setSimulationRunning(false);
    }
  };

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  // Reset simulation when task changes
  useEffect(() => {
    setSimulationRunning(false);
    setSimulationComplete(false);
    setSimulationResults(null);
    clearLogs();
  }, [selectedTask]);
  
  return (
    <div className="agent-simulation">
      <div className="simulation-header">
        <h2>Agent vs Human Simulation</h2>
        <p>See how agents compare to human workers in real-time task execution</p>
      </div>
      
      <div className="simulation-content">
        <div className="task-selection">
          <h3>Select a Task to Simulate</h3>
          {loadingTasks && <p>Loading simulation tasks...</p>}
          {error && <p className="error-message">{error}</p>}
          {!loadingTasks && !error && (
            <div className="task-cards">
              {simulationTasks.map(task => (
                <div 
                  key={task.id}
                  className={`task-card ${selectedTask === task.id ? 'selected' : ''}`}
                  onClick={() => setSelectedTask(task.id)}
                >
                  <h4>{task.name}</h4>
                  <p>{task.description}</p>
                  <div className="task-metrics">
                    <div className="task-metric">
                      <span className="metric-label">Complexity:</span>
                      <span className={`metric-value complexity-${task.complexity}`}>
                        {task.complexity.charAt(0).toUpperCase() + task.complexity.slice(1)}
                      </span>
                    </div>
                    <div className="task-metric">
                      <span className="metric-label">Human Time:</span>
                      <span className="metric-value">{task.humanTimeMinutes} min</span>
                    </div>
                    <div className="task-metric">
                      <span className="metric-label">Agent Time:</span>
                      <span className="metric-value">{task.agentTimeMinutes} min</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="simulation-controls">
          <button 
            className="start-button"
            onClick={startSimulation}
            disabled={!selectedTask || simulationRunning}
          >
            {simulationRunning ? 'Simulation Running...' : 'Start Simulation'}
          </button>
        </div>
        
        <div className="simulation-visualization">
          <div className="simulation-logs">
            <div className="logs-header">
              <h4>Simulation Logs</h4>
              <button 
                className="clear-logs-button"
                onClick={clearLogs}
                disabled={simulationRunning}
              >
                Clear
              </button>
            </div>
            <div className="logs-content" ref={logRef}>
              {logs.length === 0 ? (
                <div className="empty-logs">Start a simulation to see logs</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className={`log-entry ${log.type}`}>
                    {log.message}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
        {simulationComplete && simulationResults && (
          <div className="simulation-results">
            <h3>Simulation Results</h3>
            
            <div className="results-grid">
              <div className="result-card">
                <div className="result-title">Time Efficiency</div>
                <div className="result-value">
                  {Math.round((1 - simulationResults.agentTime / simulationResults.humanTime) * 100)}%
                </div>
                <div className="result-desc">Faster than human workers</div>
              </div>
              
              <div className="result-card">
                <div className="result-title">Error Reduction</div>
                <div className="result-value">
                  {Math.round((1 - (simulationResults.agentErrors / simulationResults.humanErrors)) * 100)}%
                </div>
                <div className="result-desc">Fewer errors</div>
              </div>
              
              <div className="result-card">
                <div className="result-title">Cost Savings</div>
                <div className="result-value">${simulationResults.costSavings.toFixed(2)}</div>
                <div className="result-desc">Per task</div>
              </div>
            </div>
            
            <div className="annual-projection">
              <h4>Annual Projection (1000 tasks)</h4>
              <div className="projection-metrics">
                <div className="projection-metric">
                  <span className="metric-label">Time Saved:</span>
                  <span className="metric-value">
                    {((simulationResults.humanTime - simulationResults.agentTime) * 1000 / 60).toFixed(0)} hours
                  </span>
                </div>
                <div className="projection-metric">
                  <span className="metric-label">Errors Prevented:</span>
                  <span className="metric-value">
                    {(simulationResults.humanErrors - simulationResults.agentErrors) * 1000}
                  </span>
                </div>
                <div className="projection-metric">
                  <span className="metric-label">Cost Savings:</span>
                  <span className="metric-value">
                    ${(simulationResults.costSavings * 1000).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="simulation-cta">
              <p>Ready to see these improvements in your organization?</p>
              <button className="deploy-button">Deploy This Agent</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
