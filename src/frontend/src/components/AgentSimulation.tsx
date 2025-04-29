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
  const [simulationSpeed, setSimulationSpeed] = useState<'slow' | 'normal' | 'fast'>('normal');
  const [simulationResults, setSimulationResults] = useState<SimulationResult | null>(null);
  const [humanProgress, setHumanProgress] = useState(0);
  const [agentProgress, setAgentProgress] = useState(0);
  const [humanErrors, setHumanErrors] = useState(0);
  const [agentErrors, setAgentErrors] = useState(0);
  const [logs, setLogs] = useState<{message: string, type: string}[]>([]);
  
  const logRef = useRef<HTMLDivElement>(null);
  
  // Sample simulation tasks
  const simulationTasks: SimulationTask[] = [
    {
      id: 'document-processing',
      name: 'Document Processing',
      description: 'Process and categorize incoming documents, extract key information, and route to appropriate departments',
      humanTimeMinutes: 15,
      agentTimeMinutes: 2,
      humanErrorRate: 0.08, // 8% error rate
      agentErrorRate: 0.01, // 1% error rate
      complexity: 'medium'
    },
    {
      id: 'customer-support',
      name: 'Customer Support Triage',
      description: 'Analyze customer inquiries, categorize by urgency and type, and route to appropriate support teams',
      humanTimeMinutes: 8,
      agentTimeMinutes: 1,
      humanErrorRate: 0.12,
      agentErrorRate: 0.02,
      complexity: 'medium'
    },
    {
      id: 'data-analysis',
      name: 'Data Analysis & Reporting',
      description: 'Analyze large datasets, identify patterns, and generate comprehensive reports with visualizations',
      humanTimeMinutes: 120,
      agentTimeMinutes: 10,
      humanErrorRate: 0.05,
      agentErrorRate: 0.01,
      complexity: 'high'
    },
    {
      id: 'compliance-check',
      name: 'Regulatory Compliance Check',
      description: 'Review documents for compliance with regulations, flag potential issues, and generate compliance reports',
      humanTimeMinutes: 45,
      agentTimeMinutes: 5,
      humanErrorRate: 0.15,
      agentErrorRate: 0.02,
      complexity: 'high'
    },
    {
      id: 'appointment-scheduling',
      name: 'Appointment Scheduling',
      description: 'Manage calendar availability, schedule appointments, and send confirmations and reminders',
      humanTimeMinutes: 10,
      agentTimeMinutes: 1,
      humanErrorRate: 0.07,
      agentErrorRate: 0.01,
      complexity: 'low'
    }
  ];
  
  // Get the selected task details
  const getSelectedTaskDetails = () => {
    return simulationTasks.find(task => task.id === selectedTask);
  };
  
  // Add a log message
  const addLog = (message: string, type: string = 'info') => {
    setLogs(prev => [...prev, { message, type }]);
  };
  
  // Clear logs
  const clearLogs = () => {
    setLogs([]);
  };
  
  // Start the simulation
  const startSimulation = () => {
    if (!selectedTask || simulationRunning) return;
    
    const task = getSelectedTaskDetails();
    if (!task) return;
    
    setSimulationRunning(true);
    setSimulationComplete(false);
    setHumanProgress(0);
    setAgentProgress(0);
    setHumanErrors(0);
    setAgentErrors(0);
    setSimulationResults(null);
    clearLogs();
    
    // Add initial logs
    addLog(`Starting simulation for ${task.name}...`, 'info');
    addLog(`Task complexity: ${task.complexity}`, 'info');
    addLog(`Human estimated time: ${task.humanTimeMinutes} minutes`, 'info');
    addLog(`Agent estimated time: ${task.agentTimeMinutes} minutes`, 'info');
    
    // Determine simulation duration based on speed setting
    let simulationDuration = 10000; // 10 seconds for normal speed
    if (simulationSpeed === 'slow') simulationDuration = 20000; // 20 seconds
    if (simulationSpeed === 'fast') simulationDuration = 5000; // 5 seconds
    
    // Simulate human progress
    const humanInterval = setInterval(() => {
      setHumanProgress(prev => {
        const newProgress = prev + (100 / (simulationDuration / 100));
        
        // Randomly introduce errors based on error rate
        if (Math.random() < (task.humanErrorRate / 10) && prev < 95) {
          setHumanErrors(prevErrors => {
            const newErrors = prevErrors + 1;
            addLog(`Human worker made an error (${newErrors} total)`, 'error');
            return newErrors;
          });
        }
        
        // Log progress milestones
        if (Math.floor(prev / 25) < Math.floor(newProgress / 25)) {
          addLog(`Human progress: ${Math.floor(newProgress)}%`, 'info');
        }
        
        if (newProgress >= 100) {
          clearInterval(humanInterval);
          addLog(`Human worker completed the task in ${task.humanTimeMinutes} minutes`, 'success');
          return 100;
        }
        return newProgress;
      });
    }, 100);
    
    // Simulate agent progress (faster)
    const agentInterval = setInterval(() => {
      setAgentProgress(prev => {
        const newProgress = prev + (100 / (simulationDuration / 100 * (task.agentTimeMinutes / task.humanTimeMinutes)));
        
        // Randomly introduce errors based on error rate
        if (Math.random() < (task.agentErrorRate / 10) && prev < 95) {
          setAgentErrors(prevErrors => {
            const newErrors = prevErrors + 1;
            addLog(`Agent made an error (${newErrors} total)`, 'warning');
            return newErrors;
          });
        }
        
        // Log progress milestones
        if (Math.floor(prev / 25) < Math.floor(newProgress / 25)) {
          addLog(`Agent progress: ${Math.floor(newProgress)}%`, 'info');
        }
        
        if (newProgress >= 100) {
          clearInterval(agentInterval);
          addLog(`Agent completed the task in ${task.agentTimeMinutes} minutes`, 'success');
          
          // If both are complete, end simulation
          if (humanProgress >= 100) {
            completeSimulation(task);
          }
          
          return 100;
        }
        return newProgress;
      });
    }, 100);
    
    // Ensure simulation completes even if progress calculation has small errors
    setTimeout(() => {
      clearInterval(humanInterval);
      clearInterval(agentInterval);
      setHumanProgress(100);
      setAgentProgress(100);
      completeSimulation(task);
    }, simulationDuration + 500);
  };
  
  // Complete the simulation and calculate results
  const completeSimulation = (task: SimulationTask) => {
    if (simulationComplete) return;
    
    setSimulationRunning(false);
    setSimulationComplete(true);
    
    // Calculate cost savings (assuming $50/hour for human labor)
    const humanHourlyCost = 50;
    const humanCost = (task.humanTimeMinutes / 60) * humanHourlyCost;
    const agentCost = 5; // Fixed cost per task for agent
    const costSavings = humanCost - agentCost;
    
    // Set final results
    const results: SimulationResult = {
      taskId: task.id,
      humanTime: task.humanTimeMinutes,
      agentTime: task.agentTimeMinutes,
      humanErrors: humanErrors,
      agentErrors: agentErrors,
      costSavings: costSavings
    };
    
    setSimulationResults(results);
    
    // Final log messages
    addLog('Simulation complete!', 'success');
    addLog(`Time saved: ${task.humanTimeMinutes - task.agentTimeMinutes} minutes (${Math.round((1 - task.agentTimeMinutes / task.humanTimeMinutes) * 100)}%)`, 'success');
    addLog(`Error reduction: ${Math.round((1 - task.agentErrorRate / task.humanErrorRate) * 100)}%`, 'success');
    addLog(`Cost savings: $${costSavings.toFixed(2)} per task`, 'success');
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
    setHumanProgress(0);
    setAgentProgress(0);
    setHumanErrors(0);
    setAgentErrors(0);
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
        </div>
        
        <div className="simulation-controls">
          <div className="speed-controls">
            <span>Simulation Speed:</span>
            <div className="speed-buttons">
              <button 
                className={simulationSpeed === 'slow' ? 'active' : ''}
                onClick={() => setSimulationSpeed('slow')}
                disabled={simulationRunning}
              >
                Slow
              </button>
              <button 
                className={simulationSpeed === 'normal' ? 'active' : ''}
                onClick={() => setSimulationSpeed('normal')}
                disabled={simulationRunning}
              >
                Normal
              </button>
              <button 
                className={simulationSpeed === 'fast' ? 'active' : ''}
                onClick={() => setSimulationSpeed('fast')}
                disabled={simulationRunning}
              >
                Fast
              </button>
            </div>
          </div>
          
          <button 
            className="start-button"
            onClick={startSimulation}
            disabled={!selectedTask || simulationRunning}
          >
            {simulationRunning ? 'Simulation Running...' : 'Start Simulation'}
          </button>
        </div>
        
        <div className="simulation-visualization">
          <div className="progress-comparison">
            <div className="progress-item">
              <div className="progress-label">
                <span>Human Worker</span>
                <span className="progress-percentage">{Math.round(humanProgress)}%</span>
              </div>
              <div className="progress-bar-container">
                <div 
                  className="progress-bar human-progress" 
                  style={{ width: `${humanProgress}%` }}
                ></div>
              </div>
              <div className="progress-metrics">
                <div className="metric">
                  <span className="metric-label">Errors:</span>
                  <span className="metric-value">{humanErrors}</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Est. Time:</span>
                  <span className="metric-value">
                    {getSelectedTaskDetails()?.humanTimeMinutes || 0} min
                  </span>
                </div>
              </div>
            </div>
            
            <div className="progress-item">
              <div className="progress-label">
                <span>AI Agent</span>
                <span className="progress-percentage">{Math.round(agentProgress)}%</span>
              </div>
              <div className="progress-bar-container">
                <div 
                  className="progress-bar agent-progress" 
                  style={{ width: `${agentProgress}%` }}
                ></div>
              </div>
              <div className="progress-metrics">
                <div className="metric">
                  <span className="metric-label">Errors:</span>
                  <span className="metric-value">{agentErrors}</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Est. Time:</span>
                  <span className="metric-value">
                    {getSelectedTaskDetails()?.agentTimeMinutes || 0} min
                  </span>
                </div>
              </div>
            </div>
          </div>
          
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
                  {Math.round((1 - (simulationResults.agentErrors / simulationResults.agentTime) / 
                    (simulationResults.humanErrors / simulationResults.humanTime)) * 100)}%
                </div>
                <div className="result-desc">Fewer errors per minute</div>
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
                    {((simulationResults.humanErrors / simulationResults.humanTime) * 
                      simulationResults.humanTime * 1000) - 
                      ((simulationResults.agentErrors / simulationResults.agentTime) * 
                      simulationResults.agentTime * 1000)}
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
