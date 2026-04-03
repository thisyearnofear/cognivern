import { useState } from "react";

interface SpendOsConsentFlowProps {
  appId: string;
  onConsent: () => void;
}

export default function SpendOsConsentFlow({
  appId,
  onConsent,
}: SpendOsConsentFlowProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleConsentClick = async () => {
    setIsLoading(true);
    try {
      await onConsent();
    } catch (error) {
      console.error("Consent flow error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="spendos-consent-flow">
      <div className="consent-header">
        <h3>🔐 OWS Wallet Authorization</h3>
        <p>
          Grant permission for a governed agent to request wallet actions under
          explicit policy controls
        </p>
      </div>

      <div className="consent-content">
        <div className="consent-info">
          <div className="info-section">
            <h4>What you're authorizing:</h4>
            <ul className="permission-list">
              <li>
                <span className="permission-icon">💰</span>
                <span>Request wallet-backed spend actions</span>
              </li>
              <li>
                <span className="permission-icon">📊</span>
                <span>Use scoped agent credentials for execution</span>
              </li>
              <li>
                <span className="permission-icon">🛡️</span>
                <span>Enforce budget ceilings and vendor restrictions</span>
              </li>
              <li>
                <span className="permission-icon">⏰</span>
                <span>Route high-risk actions into approval review</span>
              </li>
            </ul>
          </div>

          <div className="info-section">
            <h4>Your protection:</h4>
            <ul className="protection-list">
              <li>
                <span className="protection-icon">🔒</span>
                <span>
                  Non-custodial execution with explicit policy boundaries
                </span>
              </li>
              <li>
                <span className="protection-icon">📋</span>
                <span>
                  Policy-enforced spending limits and chain restrictions
                </span>
              </li>
              <li>
                <span className="protection-icon">🔍</span>
                <span>Complete audit trail for every attempted action</span>
              </li>
              <li>
                <span className="protection-icon">⚡</span>
                <span>Revoke or rotate scoped access anytime</span>
              </li>
            </ul>
          </div>

          <div className="info-section">
            <h4>Execution Details:</h4>
            <div className="app-details">
              <div className="detail-row">
                <span className="detail-label">App ID:</span>
                <span className="detail-value">{appId}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">App Name:</span>
                <span className="detail-value">Cognivern SpendOS Agent</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Framework:</span>
                <span className="detail-value">OWS + Cognivern</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Chains:</span>
                <span className="detail-value">
                  Ethereum, Polygon, Arbitrum, Base
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="consent-actions">
          <div className="consent-warning">
            <span className="warning-icon">⚠️</span>
            <p>
              You will be redirected to the wallet authorization flow. Review
              the requested scope before allowing the agent to act.
            </p>
          </div>

          <button
            className="consent-button"
            onClick={handleConsentClick}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="loading-spinner"></span>
                Redirecting...
              </>
            ) : (
              <>
                <span className="consent-icon">🚀</span>
                Authorize OWS Agent
              </>
            )}
          </button>

          <div className="consent-footer">
            <p>
              By clicking "Authorize", you'll review the exact permissions,
              limits, and approval semantics attached to this agent.
            </p>
          </div>
        </div>
      </div>

      <div className="consent-flow-steps">
        <h4>Authorization Process:</h4>
        <div className="steps">
          <div className="step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h5>Review Permissions</h5>
              <p>Check what the agent can do on your behalf</p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h5>Set Policies</h5>
              <p>Configure budgets, restrictions, and approvals</p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h5>Grant Consent</h5>
              <p>Authorize the agent with scoped wallet access</p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">4</div>
            <div className="step-content">
              <h5>Monitor Decisions</h5>
              <p>Review approvals, holds, denials, and audit evidence</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
