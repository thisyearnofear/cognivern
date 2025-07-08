import { useState, useEffect } from "react";
import "./WelcomeFlow.css";
import { getApiHeaders } from "../../utils/api.js";

interface WelcomeFlowProps {
  onComplete: (userType: string) => void;
}

export default function WelcomeFlow({ onComplete }: WelcomeFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedUserType, setSelectedUserType] = useState<string>("");
  const [governanceData, setGovernanceData] = useState({
    totalPolicies: 2,
    totalAgents: 2,
    totalActions: 12,
  });

  // Fetch real governance data
  useEffect(() => {
    const fetchGovernanceData = async () => {
      try {
        const headers = getApiHeaders();
        const response = await fetch("/api/dashboard/summary", {
          headers,
        });
        if (response.ok) {
          const data = await response.json();
          setGovernanceData({
            totalPolicies: data.governance.totalPolicies,
            totalAgents: data.governance.totalAgents,
            totalActions: data.governance.totalActions,
          });
        }
      } catch (error) {
        console.error("Error fetching governance data:", error);
        // Keep default values on error
      }
    };

    fetchGovernanceData();
  }, []);

  const steps = [
    {
      title: "Welcome to Cognivern",
      subtitle: "AI Agent Governance Made Simple",
      content: (
        <div className="welcome-intro">
          <div className="value-prop">
            <h3>🤖 What if your AI agents were:</h3>
            <ul className="benefits-list">
              <li>
                ✅ <strong>Transparent</strong> - Every decision recorded and
                auditable
              </li>
              <li>
                ✅ <strong>Compliant</strong> - Automatically following your
                policies
              </li>
              <li>
                ✅ <strong>Trustworthy</strong> - Governed by blockchain
                technology
              </li>
              <li>
                ✅ <strong>Accountable</strong> - With immutable audit trails
              </li>
            </ul>
          </div>

          <div className="platform-preview">
            <div className="live-stats">
              <h4>🔴 Live on Filecoin Testnet</h4>
              <div className="stats-grid">
                <div className="stat">
                  <span className="number">{governanceData.totalPolicies}</span>
                  <span className="label">Active Policies</span>
                </div>
                <div className="stat">
                  <span className="number">{governanceData.totalAgents}</span>
                  <span className="label">Governed Agents</span>
                </div>
                <div className="stat">
                  <span className="number">{governanceData.totalActions}</span>
                  <span className="label">Recorded Actions</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "How Does It Work?",
      subtitle: "Simple 3-Step Process",
      content: (
        <div className="how-it-works">
          <div className="steps-flow">
            <div className="step">
              <div className="step-icon">📝</div>
              <h4>1. Define Policies</h4>
              <p>Set rules for how your AI agents should behave</p>
              <div className="example">
                <em>Example: "Never delete user data without approval"</em>
              </div>
            </div>

            <div className="step-arrow">→</div>

            <div className="step">
              <div className="step-icon">🤖</div>
              <h4>2. Deploy Agents</h4>
              <p>Your AI agents automatically follow the policies</p>
              <div className="example">
                <em>Example: Agent asks for permission before deletions</em>
              </div>
            </div>

            <div className="step-arrow">→</div>

            <div className="step">
              <div className="step-icon">📊</div>
              <h4>3. Monitor & Audit</h4>
              <p>Track all decisions with blockchain transparency</p>
              <div className="example">
                <em>Example: See every action in immutable audit logs</em>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "What's Your Role?",
      subtitle: "Choose your path to get started",
      content: (
        <div className="user-type-selection">
          <div className="user-types">
            <div
              className={`user-type ${selectedUserType === "explorer" ? "selected" : ""}`}
              onClick={() => setSelectedUserType("explorer")}
            >
              <div className="type-icon">🔍</div>
              <h4>Explorer</h4>
              <p>I want to see how this works</p>
              <ul>
                <li>View live blockchain data</li>
                <li>See governance in action</li>
                <li>Explore without setup</li>
              </ul>
            </div>

            <div
              className={`user-type ${selectedUserType === "developer" ? "selected" : ""}`}
              onClick={() => setSelectedUserType("developer")}
            >
              <div className="type-icon">👩‍💻</div>
              <h4>Developer</h4>
              <p>I want to build with this</p>
              <ul>
                <li>Create policies and agents</li>
                <li>Connect my wallet</li>
                <li>Deploy governance rules</li>
              </ul>
            </div>

            <div
              className={`user-type ${selectedUserType === "business" ? "selected" : ""}`}
              onClick={() => setSelectedUserType("business")}
            >
              <div className="type-icon">🏢</div>
              <h4>Business User</h4>
              <p>I want to understand the value</p>
              <ul>
                <li>See ROI calculations</li>
                <li>View case studies</li>
                <li>Understand compliance benefits</li>
              </ul>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else if (selectedUserType) {
      onComplete(selectedUserType);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="welcome-flow">
      <div className="flow-container">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          ></div>
        </div>

        <div className="step-content">
          <div className="step-header">
            <h1>{steps[currentStep].title}</h1>
            <p className="subtitle">{steps[currentStep].subtitle}</p>
          </div>

          <div className="step-body">{steps[currentStep].content}</div>
        </div>

        <div className="flow-navigation">
          <button
            className="nav-btn secondary"
            onClick={prevStep}
            disabled={currentStep === 0}
          >
            ← Back
          </button>

          <div className="step-indicators">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`indicator ${index <= currentStep ? "active" : ""}`}
              ></div>
            ))}
          </div>

          <button
            className="nav-btn primary"
            onClick={nextStep}
            disabled={currentStep === steps.length - 1 && !selectedUserType}
          >
            {currentStep === steps.length - 1 ? "Get Started" : "Next"} →
          </button>
        </div>
      </div>
    </div>
  );
}
