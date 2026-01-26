import { useState } from "react";
import { css } from "@emotion/react";
import { designTokens } from "../../styles/designTokens";

export default function IntegrationDiagram() {
  const [activeFlow, setActiveFlow] = useState<string | null>(null);

  const handleFlowClick = (flow: string) => {
    setActiveFlow(activeFlow === flow ? null : flow);
  };

  return (
    <div className="integration-diagram">
      <h3>Cognivern + Bitte Protocol Integration</h3>

      <div className="diagram-container">
        <div className="diagram-section cognivern">
          <div className="platform-header">
            <h4>Cognivern Platform</h4>
            <div className="platform-tag">Governance & Monitoring</div>
          </div>

          <div className="platform-components">
            <div className="component">
              <div className="component-icon policy-icon">P</div>
              <div className="component-label">Policy Engine</div>
            </div>

            <div className="component">
              <div className="component-icon metrics-icon">M</div>
              <div className="component-label">Metrics Service</div>
            </div>

            <div className="component">
              <div className="component-icon audit-icon">A</div>
              <div className="component-label">Audit Logging</div>
            </div>
          </div>
        </div>

        <div className="integration-flows">
          <div
            className={`flow-arrow flow-1 ${activeFlow === "flow-1" ? "active" : ""}`}
            onClick={() => handleFlowClick("flow-1")}
          >
            <div className="arrow-line"></div>
            <div className="arrow-head"></div>
            {activeFlow === "flow-1" && (
              <div className="flow-tooltip">
                Agent registration and capabilities exchange
              </div>
            )}
          </div>

          <div
            className={`flow-arrow flow-2 ${activeFlow === "flow-2" ? "active" : ""}`}
            onClick={() => handleFlowClick("flow-2")}
          >
            <div className="arrow-line"></div>
            <div className="arrow-head"></div>
            {activeFlow === "flow-2" && (
              <div className="flow-tooltip">
                Policy enforcement and governance
              </div>
            )}
          </div>

          <div
            className={`flow-arrow flow-3 ${activeFlow === "flow-3" ? "active" : ""}`}
            onClick={() => handleFlowClick("flow-3")}
          >
            <div className="arrow-line"></div>
            <div className="arrow-head"></div>
            {activeFlow === "flow-3" && (
              <div className="flow-tooltip">
                Transaction generation and verification
              </div>
            )}
          </div>
        </div>

        <div className="diagram-section bitte">
          <div className="platform-header">
            <h4>Bitte Protocol</h4>
            <div className="platform-tag">Multi-Chain Protocol</div>
          </div>

          <div className="platform-components">
            <div className="component">
              <div className="component-icon mcp-icon">MCP</div>
              <div className="component-label">MCP Server</div>
            </div>

            <div className="component">
              <div className="component-icon agent-icon">A</div>
              <div className="component-label">Agent Network</div>
            </div>

            <div className="component">
              <div className="component-icon tx-icon">Tx</div>
              <div className="component-label">Transaction Tools</div>
            </div>
          </div>
        </div>
      </div>

      <div className="integration-benefits">
        <h4>Key Benefits</h4>
        <ul>
          <li>
            <span className="benefit-icon">✓</span>
            <span className="benefit-text">
              <strong>Enhanced Agent Governance:</strong> Apply Cognivern's
              policy enforcement to Bitte Protocol agents
            </span>
          </li>
          <li>
            <span className="benefit-icon">✓</span>
            <span className="benefit-text">
              <strong>Multi-Chain Support:</strong> Extend governance
              capabilities across multiple blockchains
            </span>
          </li>
          <li>
            <span className="benefit-icon">✓</span>
            <span className="benefit-text">
              <strong>Verifiable Transactions:</strong> Generate and audit
              blockchain transactions with full traceability
            </span>
          </li>
          <li>
            <span className="benefit-icon">✓</span>
            <span className="benefit-text">
              <strong>Showcase Agents:</strong> Demonstrate platform
              capabilities through purpose-built agents
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
