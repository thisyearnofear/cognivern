import { useState, useEffect } from 'react';
import './CaseStudyDemo.css';

// This component demonstrates a specific case study with an interactive demo
export default function CaseStudyDemo() {
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [policyViolation, setPolicyViolation] = useState(false);
  
  // Healthcare case study demo
  const demoSteps = [
    {
      title: 'Patient Data Analysis',
      description: 'AI agent analyzes patient symptoms and medical history',
      action: 'Analyzing patient data and comparing with medical knowledge base...'
    },
    {
      title: 'Diagnostic Reasoning',
      description: 'Agent applies chain-of-thought reasoning to form diagnosis',
      action: 'Generating diagnostic probabilities based on symptom patterns...'
    },
    {
      title: 'Treatment Recommendation',
      description: 'Agent suggests treatment options based on diagnosis',
      action: 'Recommending treatment plan based on diagnosis and patient history...'
    },
    {
      title: 'Policy Check',
      description: 'Governance system verifies recommendation against medical policies',
      action: 'Verifying treatment recommendation against hospital policies...'
    },
    {
      title: 'Audit Log Creation',
      description: 'System records the entire decision process for future reference',
      action: 'Creating tamper-proof audit log of diagnostic process...'
    }
  ];

  // Reset the demo
  const resetDemo = () => {
    setActiveStep(0);
    setIsPlaying(false);
    setLogs([]);
    setPolicyViolation(false);
  };

  // Start the automated demo
  const playDemo = () => {
    resetDemo();
    setIsPlaying(true);
  };

  // Manually advance to the next step
  const nextStep = () => {
    if (activeStep < demoSteps.length - 1) {
      setActiveStep(activeStep + 1);
      addLog(demoSteps[activeStep + 1].action);
      
      // Simulate a policy violation at the policy check step
      if (activeStep + 1 === 3 && Math.random() > 0.7) {
        setPolicyViolation(true);
        addLog('⚠️ POLICY VIOLATION: High-risk medication requires additional approval');
        addLog('✓ Governance system blocked unauthorized prescription');
        addLog('✓ Notification sent to supervising physician');
      }
    }
  };

  // Add a log message
  const addLog = (message: string) => {
    setLogs(prev => [...prev, message]);
  };

  // Effect to automate the demo when playing
  useEffect(() => {
    if (!isPlaying) return;
    
    // Add initial log
    if (activeStep === 0 && logs.length === 0) {
      addLog(demoSteps[0].action);
    }
    
    // Advance through steps automatically
    const timer = setTimeout(() => {
      if (activeStep < demoSteps.length - 1) {
        nextStep();
      } else {
        setIsPlaying(false);
      }
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [isPlaying, activeStep, logs.length]);

  return (
    <div className="case-study-demo">
      <div className="demo-header">
        <h3>Interactive Demo: Healthcare AI Governance</h3>
        <p>See how Cognivern and Bitte Protocol work together to ensure safe, transparent AI in healthcare</p>
        
        <div className="demo-controls">
          <button 
            className="play-button" 
            onClick={playDemo} 
            disabled={isPlaying}
          >
            {isPlaying ? 'Playing...' : 'Play Demo'}
          </button>
          
          <button 
            className="step-button" 
            onClick={nextStep} 
            disabled={isPlaying || activeStep >= demoSteps.length - 1}
          >
            Next Step
          </button>
          
          <button 
            className="reset-button" 
            onClick={resetDemo}
          >
            Reset
          </button>
        </div>
      </div>
      
      <div className="demo-content">
        <div className="demo-steps">
          <div className="steps-timeline">
            {demoSteps.map((step, index) => (
              <div 
                key={index} 
                className={`step ${index === activeStep ? 'active' : ''} ${index < activeStep ? 'completed' : ''}`}
              >
                <div className="step-indicator">
                  {index < activeStep ? '✓' : index + 1}
                </div>
                <div className="step-content">
                  <h4>{step.title}</h4>
                  <p>{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="demo-visualization">
          <div className="visualization-header">
            <h4>System Activity</h4>
          </div>
          
          <div className="visualization-content">
            {activeStep === 0 && (
              <div className="visualization-patient">
                <div className="patient-icon">👤</div>
                <div className="patient-data">
                  <h5>Patient Data</h5>
                  <ul>
                    <li><strong>Age:</strong> 65</li>
                    <li><strong>Symptoms:</strong> Chest pain, shortness of breath</li>
                    <li><strong>History:</strong> Hypertension, Type 2 Diabetes</li>
                    <li><strong>Medications:</strong> Metformin, Lisinopril</li>
                  </ul>
                </div>
              </div>
            )}
            
            {activeStep === 1 && (
              <div className="visualization-reasoning">
                <h5>Diagnostic Reasoning</h5>
                <div className="reasoning-chain">
                  <div className="reasoning-node">
                    <div className="node-title">Symptoms Analysis</div>
                    <div className="node-content">Chest pain + shortness of breath suggest cardiovascular or pulmonary origin</div>
                  </div>
                  <div className="reasoning-arrow">↓</div>
                  <div className="reasoning-node">
                    <div className="node-title">Risk Factor Assessment</div>
                    <div className="node-content">Age, hypertension, and diabetes increase cardiovascular risk</div>
                  </div>
                  <div className="reasoning-arrow">↓</div>
                  <div className="reasoning-node">
                    <div className="node-title">Differential Diagnosis</div>
                    <div className="node-content">
                      <ul>
                        <li>Acute Coronary Syndrome: 68%</li>
                        <li>Heart Failure: 15%</li>
                        <li>Pulmonary Embolism: 10%</li>
                        <li>Other: 7%</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {activeStep === 2 && (
              <div className="visualization-treatment">
                <h5>Treatment Recommendation</h5>
                <div className="treatment-plan">
                  <div className="treatment-primary">
                    <div className="treatment-icon">💊</div>
                    <div className="treatment-details">
                      <h6>Primary Treatment</h6>
                      <p><strong>Medication:</strong> Nitroglycerin 0.4mg sublingual</p>
                      <p><strong>Purpose:</strong> Immediate relief of chest pain</p>
                    </div>
                  </div>
                  
                  <div className="treatment-secondary">
                    <div className="treatment-icon">🏥</div>
                    <div className="treatment-details">
                      <h6>Additional Steps</h6>
                      <ul>
                        <li>ECG monitoring</li>
                        <li>Cardiac enzyme tests</li>
                        <li>Cardiology consultation</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {activeStep === 3 && (
              <div className="visualization-policy">
                <h5>Policy Verification</h5>
                <div className={`policy-check ${policyViolation ? 'violation' : 'passed'}`}>
                  <div className="policy-icon">
                    {policyViolation ? '⚠️' : '✓'}
                  </div>
                  <div className="policy-details">
                    <h6>{policyViolation ? 'Policy Violation Detected' : 'All Policies Passed'}</h6>
                    {policyViolation ? (
                      <div className="violation-details">
                        <p>High-risk medication requires additional approval</p>
                        <p>Action: Treatment recommendation blocked pending physician review</p>
                      </div>
                    ) : (
                      <ul className="policy-list">
                        <li>✓ Treatment within standard protocols</li>
                        <li>✓ No contraindications with current medications</li>
                        <li>✓ Dosage appropriate for patient profile</li>
                        <li>✓ Required monitoring protocols included</li>
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {activeStep === 4 && (
              <div className="visualization-audit">
                <h5>Audit Log Creation</h5>
                <div className="audit-record">
                  <div className="audit-header">
                    <div className="audit-id">ID: AUD-{Math.floor(Math.random() * 1000000)}</div>
                    <div className="audit-timestamp">Timestamp: {new Date().toISOString()}</div>
                  </div>
                  <div className="audit-content">
                    <div className="audit-section">
                      <h6>Decision Path</h6>
                      <p>Complete chain-of-thought reasoning stored</p>
                    </div>
                    <div className="audit-section">
                      <h6>Policy Checks</h6>
                      <p>{policyViolation ? 'Policy violation detected and handled' : 'All policy checks passed'}</p>
                    </div>
                    <div className="audit-section">
                      <h6>Verification</h6>
                      <p>Cryptographically signed and stored on Recall Network</p>
                      <p>Accessible via Bitte Protocol MCP for authorized parties</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="demo-logs">
          <div className="logs-header">
            <h4>System Logs</h4>
          </div>
          <div className="logs-content">
            {logs.length === 0 ? (
              <div className="logs-empty">Start the demo to see system logs</div>
            ) : (
              <div className="logs-entries">
                {logs.map((log, index) => (
                  <div key={index} className="log-entry">
                    <span className="log-timestamp">[{new Date().toLocaleTimeString()}]</span>
                    <span className="log-message">{log}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
