import { useState } from "react";
import { css } from '@emotion/react';
import { designTokens, tradingStyles } from '../../styles/designTokens';

interface PolicyConfigurationProps {
  policies: {
    dailySpendingLimit: number;
    allowedTokens: string[];
    maxTradeSize: number;
  };
  onUpdate: (policies: any) => void;
}

const AVAILABLE_TOKENS = [
  { symbol: "ETH", name: "Ethereum", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" },
  { symbol: "USDC", name: "USD Coin", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
  { symbol: "WBTC", name: "Wrapped Bitcoin", address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599" },
  { symbol: "UNI", name: "Uniswap", address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984" },
  { symbol: "LINK", name: "Chainlink", address: "0x514910771AF9Ca656af840dff83E8264EcF986CA" },
  { symbol: "AAVE", name: "Aave", address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9" },
];

export default function PolicyConfiguration({ policies, onUpdate }: PolicyConfigurationProps) {
  const [localPolicies, setLocalPolicies] = useState(policies);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate(localPolicies);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save policies:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setLocalPolicies(policies);
    setIsEditing(false);
  };

  const toggleToken = (tokenSymbol: string) => {
    setLocalPolicies(prev => ({
      ...prev,
      allowedTokens: prev.allowedTokens.includes(tokenSymbol)
        ? prev.allowedTokens.filter(t => t !== tokenSymbol)
        : [...prev.allowedTokens, tokenSymbol]
    }));
  };

  const configStyles = css`
    ${tradingStyles.glassCard}
  `;

  return (
    <div css={configStyles}>
      <div className="policy-header">
        <h3>🛡️ Trading Policies</h3>
        <p>Configure your trading agent's behavior and limits</p>
        {!isEditing && (
          <button className="edit-button" onClick={() => setIsEditing(true)}>
            <span className="edit-icon">✏️</span>
            Edit Policies
          </button>
        )}
      </div>

      <div className="policy-content">
        {/* Daily Spending Limit */}
        <div className="policy-section">
          <h4>💰 Daily Spending Limit</h4>
          <p>Maximum amount the agent can spend per day</p>
          <div className="policy-control">
            <div className="input-group">
              <span className="input-prefix">$</span>
              <input
                type="number"
                value={localPolicies.dailySpendingLimit}
                onChange={(e) => setLocalPolicies(prev => ({
                  ...prev,
                  dailySpendingLimit: Number(e.target.value)
                }))}
                disabled={!isEditing}
                min="1"
                max="10000"
              />
              <span className="input-suffix">USD</span>
            </div>
            <div className="policy-info">
              <span className="info-icon">ℹ️</span>
              <span>Recommended: $100-$1000 for testing</span>
            </div>
          </div>
        </div>

        {/* Maximum Trade Size */}
        <div className="policy-section">
          <h4>📊 Maximum Trade Size</h4>
          <p>Largest single trade the agent can execute</p>
          <div className="policy-control">
            <div className="input-group">
              <span className="input-prefix">$</span>
              <input
                type="number"
                value={localPolicies.maxTradeSize}
                onChange={(e) => setLocalPolicies(prev => ({
                  ...prev,
                  maxTradeSize: Number(e.target.value)
                }))}
                disabled={!isEditing}
                min="1"
                max={localPolicies.dailySpendingLimit}
              />
              <span className="input-suffix">USD</span>
            </div>
            <div className="policy-info">
              <span className="info-icon">ℹ️</span>
              <span>Should be less than daily limit</span>
            </div>
          </div>
        </div>

        {/* Allowed Tokens */}
        <div className="policy-section">
          <h4>🪙 Allowed Tokens</h4>
          <p>Tokens the agent is permitted to trade</p>
          <div className="token-grid">
            {AVAILABLE_TOKENS.map((token) => (
              <div
                key={token.symbol}
                className={`token-card ${localPolicies.allowedTokens.includes(token.symbol) ? 'selected' : ''} ${!isEditing ? 'disabled' : ''}`}
                onClick={() => isEditing && toggleToken(token.symbol)}
              >
                <div className="token-header">
                  <span className="token-symbol">{token.symbol}</span>
                  {localPolicies.allowedTokens.includes(token.symbol) && (
                    <span className="selected-icon">✓</span>
                  )}
                </div>
                <div className="token-name">{token.name}</div>
                <div className="token-address">
                  {token.address.slice(0, 6)}...{token.address.slice(-4)}
                </div>
              </div>
            ))}
          </div>
          <div className="policy-info">
            <span className="info-icon">ℹ️</span>
            <span>Selected: {localPolicies.allowedTokens.length} tokens</span>
          </div>
        </div>

        {/* Policy Summary */}
        <div className="policy-summary">
          <h4>📋 Policy Summary</h4>
          <div className="summary-grid">
            <div className="summary-item">
              <span className="summary-label">Daily Limit:</span>
              <span className="summary-value">${localPolicies.dailySpendingLimit}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Max Trade:</span>
              <span className="summary-value">${localPolicies.maxTradeSize}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Allowed Tokens:</span>
              <span className="summary-value">{localPolicies.allowedTokens.length}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Risk Level:</span>
              <span className={`summary-value risk-${localPolicies.dailySpendingLimit > 1000 ? 'high' : localPolicies.dailySpendingLimit > 500 ? 'medium' : 'low'}`}>
                {localPolicies.dailySpendingLimit > 1000 ? 'High' : localPolicies.dailySpendingLimit > 500 ? 'Medium' : 'Low'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {isEditing && (
          <div className="policy-actions">
            <button
              className="save-button"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <span className="loading-spinner"></span>
                  Saving...
                </>
              ) : (
                <>
                  <span className="save-icon">💾</span>
                  Save Policies
                </>
              )}
            </button>
            <button
              className="cancel-button"
              onClick={handleCancel}
              disabled={isSaving}
            >
              <span className="cancel-icon">❌</span>
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Policy Validation */}
      <div className="policy-validation">
        <h4>✅ Policy Validation</h4>
        <div className="validation-checks">
          <div className={`validation-item ${localPolicies.dailySpendingLimit > 0 ? 'valid' : 'invalid'}`}>
            <span className="validation-icon">
              {localPolicies.dailySpendingLimit > 0 ? '✅' : '❌'}
            </span>
            <span>Daily spending limit is set</span>
          </div>
          <div className={`validation-item ${localPolicies.maxTradeSize <= localPolicies.dailySpendingLimit ? 'valid' : 'invalid'}`}>
            <span className="validation-icon">
              {localPolicies.maxTradeSize <= localPolicies.dailySpendingLimit ? '✅' : '❌'}
            </span>
            <span>Max trade size is within daily limit</span>
          </div>
          <div className={`validation-item ${localPolicies.allowedTokens.length > 0 ? 'valid' : 'invalid'}`}>
            <span className="validation-icon">
              {localPolicies.allowedTokens.length > 0 ? '✅' : '❌'}
            </span>
            <span>At least one token is allowed</span>
          </div>
        </div>
      </div>
    </div>
  );
}
