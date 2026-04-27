import { useState } from 'react';
import { css } from '@emotion/react';
import { designTokens } from '../../styles/design-system';

export default function IntegrationDiagram() {
  const [activeFlow, setActiveFlow] = useState<string | null>(null);

  const handleFlowClick = (flow: string) => {
    setActiveFlow(activeFlow === flow ? null : flow);
  };

  return (
    <div className="integration-diagram">
      <h3>Cognivern + OWS Wallet Control Plane</h3>

      <div className="diagram-container">
        <div className="diagram-section cognivern">
          <div className="platform-header">
            <h4>Cognivern Platform</h4>
            <div className="platform-tag">Spend Governance & Forensics</div>
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
            className={`flow-arrow flow-1 ${activeFlow === 'flow-1' ? 'active' : ''}`}
            onClick={() => handleFlowClick('flow-1')}
          >
            <div className="arrow-line"></div>
            <div className="arrow-head"></div>
            {activeFlow === 'flow-1' && (
              <div className="flow-tooltip">Scoped agent access and treasury assignment</div>
            )}
          </div>

          <div
            className={`flow-arrow flow-2 ${activeFlow === 'flow-2' ? 'active' : ''}`}
            onClick={() => handleFlowClick('flow-2')}
          >
            <div className="arrow-line"></div>
            <div className="arrow-head"></div>
            {activeFlow === 'flow-2' && (
              <div className="flow-tooltip">Budget checks, allowlists, and approval thresholds</div>
            )}
          </div>

          <div
            className={`flow-arrow flow-3 ${activeFlow === 'flow-3' ? 'active' : ''}`}
            onClick={() => handleFlowClick('flow-3')}
          >
            <div className="arrow-line"></div>
            <div className="arrow-head"></div>
            {activeFlow === 'flow-3' && (
              <div className="flow-tooltip">Signed execution plus audit evidence capture</div>
            )}
          </div>
        </div>

        <div className="diagram-section ows-wallet">
          <div className="platform-header">
            <h4>OWS Wallet Layer</h4>
            <div className="platform-tag">Wallet Access & Signing</div>
          </div>

          <div className="platform-components">
            <div className="component">
              <div className="component-icon mcp-icon">MCP</div>
              <div className="component-label">Agent Access</div>
            </div>

            <div className="component">
              <div className="component-icon agent-icon">A</div>
              <div className="component-label">API Keys</div>
            </div>

            <div className="component">
              <div className="component-icon tx-icon">Tx</div>
              <div className="component-label">Policy-Gated Signing</div>
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
              <strong>SpendOS for teams:</strong> Assign budgets, restrictions, and approval rules
              per agent instead of handing out a blank check
            </span>
          </li>
          <li>
            <span className="benefit-icon">✓</span>
            <span className="benefit-text">
              <strong>Operator visibility:</strong> Watch every attempted spend move through
              approval, hold, or denial with human-readable reasons
            </span>
          </li>
          <li>
            <span className="benefit-icon">✓</span>
            <span className="benefit-text">
              <strong>Audit log forensics:</strong> Preserve the evidence chain for every decision
              so teams can investigate incidents fast
            </span>
          </li>
          <li>
            <span className="benefit-icon">✓</span>
            <span className="benefit-text">
              <strong>Wallet control without wallet sprawl:</strong> Keep OWS as the execution layer
              while Cognivern handles oversight and trust
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
