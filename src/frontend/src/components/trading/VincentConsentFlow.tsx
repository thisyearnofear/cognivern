import { useState } from "react";
import { css } from '@emotion/react';
import { designTokens, tradingStyles } from '../../styles/designTokens';

interface VincentConsentFlowProps {
  appId: string;
  onConsent: () => void;
}

export default function VincentConsentFlow({ appId, onConsent }: VincentConsentFlowProps) {
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
    <div className="vincent-consent-flow">
      <div className="consent-header">
        <h3>🔐 Vincent Framework Authorization</h3>
        <p>Grant permission for the Social Trading Agent to execute trades on your behalf</p>
      </div>

      <div className="consent-content">
        <div className="consent-info">
          <div className="info-section">
            <h4>What you're authorizing:</h4>
            <ul className="permission-list">
              <li>
                <span className="permission-icon">💰</span>
                <span>Execute token swaps using Uniswap</span>
              </li>
              <li>
                <span className="permission-icon">📊</span>
                <span>Access ERC20 token approvals</span>
              </li>
              <li>
                <span className="permission-icon">🛡️</span>
                <span>Enforce your daily spending limits</span>
              </li>
              <li>
                <span className="permission-icon">⏰</span>
                <span>Respect your time-based restrictions</span>
              </li>
            </ul>
          </div>

          <div className="info-section">
            <h4>Your protection:</h4>
            <ul className="protection-list">
              <li>
                <span className="protection-icon">🔒</span>
                <span>Non-custodial - you keep control of your assets</span>
              </li>
              <li>
                <span className="protection-icon">📋</span>
                <span>Policy-enforced spending limits</span>
              </li>
              <li>
                <span className="protection-icon">🔍</span>
                <span>Complete audit trail of all actions</span>
              </li>
              <li>
                <span className="protection-icon">⚡</span>
                <span>Revoke permissions anytime</span>
              </li>
            </ul>
          </div>

          <div className="info-section">
            <h4>Vincent App Details:</h4>
            <div className="app-details">
              <div className="detail-row">
                <span className="detail-label">App ID:</span>
                <span className="detail-value">{appId}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">App Name:</span>
                <span className="detail-value">Cognivern Social Trading Agent</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Framework:</span>
                <span className="detail-value">Vincent + Lit Protocol</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Chains:</span>
                <span className="detail-value">Ethereum, Polygon, Arbitrum, Base</span>
              </div>
            </div>
          </div>
        </div>

        <div className="consent-actions">
          <div className="consent-warning">
            <span className="warning-icon">⚠️</span>
            <p>
              You will be redirected to the Vincent consent page to authorize this application.
              Make sure you trust this application before proceeding.
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
                Authorize Vincent Agent
              </>
            )}
          </button>

          <div className="consent-footer">
            <p>
              By clicking "Authorize", you'll be taken to Vincent's secure consent page
              where you can review and approve the specific permissions.
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
              <p>Configure spending limits and restrictions</p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h5>Grant Consent</h5>
              <p>Authorize the agent with your wallet</p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">4</div>
            <div className="step-content">
              <h5>Start Trading</h5>
              <p>Agent begins sentiment-based trading</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
