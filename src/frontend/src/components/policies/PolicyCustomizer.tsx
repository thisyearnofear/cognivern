import { useState, useEffect } from 'react';
import { css } from '@emotion/react';
import { designTokens } from '../../styles/designTokens';

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  strictness: 'low' | 'medium' | 'high';
  category: 'data' | 'security' | 'compliance' | 'ethics';
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  rules: PolicyRule[];
  template: 'minimal' | 'standard' | 'strict' | 'custom';
}

interface PolicyCustomizerProps {
  onPolicyChange: (policy: Policy) => void;
  initialPolicy?: Policy;
}

export default function PolicyCustomizer({ onPolicyChange, initialPolicy }: PolicyCustomizerProps) {
  // Default policy templates
  const policyTemplates: Record<string, Policy> = {
    minimal: {
      id: 'minimal-policy',
      name: 'Minimal Governance',
      description: 'Basic governance with minimal restrictions for maximum agent freedom',
      template: 'minimal',
      rules: [
        {
          id: 'audit-logging',
          name: 'Audit Logging',
          description: 'Log all agent actions for audit purposes',
          enabled: true,
          strictness: 'low',
          category: 'compliance',
        },
        {
          id: 'data-access',
          name: 'Data Access Control',
          description: 'Control access to sensitive data',
          enabled: true,
          strictness: 'low',
          category: 'data',
        },
        {
          id: 'rate-limiting',
          name: 'Rate Limiting',
          description: 'Limit the frequency of agent actions',
          enabled: true,
          strictness: 'low',
          category: 'security',
        },
        {
          id: 'content-filtering',
          name: 'Content Filtering',
          description: 'Filter inappropriate content',
          enabled: false,
          strictness: 'low',
          category: 'ethics',
        },
        {
          id: 'human-in-loop',
          name: 'Human-in-the-Loop',
          description: 'Require human approval for certain actions',
          enabled: false,
          strictness: 'low',
          category: 'compliance',
        },
      ],
    },
    standard: {
      id: 'standard-policy',
      name: 'Standard Governance',
      description: 'Balanced governance with reasonable restrictions',
      template: 'standard',
      rules: [
        {
          id: 'audit-logging',
          name: 'Audit Logging',
          description: 'Log all agent actions for audit purposes',
          enabled: true,
          strictness: 'medium',
          category: 'compliance',
        },
        {
          id: 'data-access',
          name: 'Data Access Control',
          description: 'Control access to sensitive data',
          enabled: true,
          strictness: 'medium',
          category: 'data',
        },
        {
          id: 'rate-limiting',
          name: 'Rate Limiting',
          description: 'Limit the frequency of agent actions',
          enabled: true,
          strictness: 'medium',
          category: 'security',
        },
        {
          id: 'content-filtering',
          name: 'Content Filtering',
          description: 'Filter inappropriate content',
          enabled: true,
          strictness: 'medium',
          category: 'ethics',
        },
        {
          id: 'human-in-loop',
          name: 'Human-in-the-Loop',
          description: 'Require human approval for certain actions',
          enabled: true,
          strictness: 'medium',
          category: 'compliance',
        },
        {
          id: 'data-protection',
          name: 'Data Protection',
          description: 'Protect sensitive data from unauthorized access',
          enabled: true,
          strictness: 'medium',
          category: 'data',
        },
      ],
    },
    strict: {
      id: 'strict-policy',
      name: 'Strict Governance',
      description: 'Maximum governance with strict restrictions for high-risk environments',
      template: 'strict',
      rules: [
        {
          id: 'audit-logging',
          name: 'Audit Logging',
          description: 'Log all agent actions for audit purposes',
          enabled: true,
          strictness: 'high',
          category: 'compliance',
        },
        {
          id: 'data-access',
          name: 'Data Access Control',
          description: 'Control access to sensitive data',
          enabled: true,
          strictness: 'high',
          category: 'data',
        },
        {
          id: 'rate-limiting',
          name: 'Rate Limiting',
          description: 'Limit the frequency of agent actions',
          enabled: true,
          strictness: 'high',
          category: 'security',
        },
        {
          id: 'content-filtering',
          name: 'Content Filtering',
          description: 'Filter inappropriate content',
          enabled: true,
          strictness: 'high',
          category: 'ethics',
        },
        {
          id: 'human-in-loop',
          name: 'Human-in-the-Loop',
          description: 'Require human approval for certain actions',
          enabled: true,
          strictness: 'high',
          category: 'compliance',
        },
        {
          id: 'data-protection',
          name: 'Data Protection',
          description: 'Protect sensitive data from unauthorized access',
          enabled: true,
          strictness: 'high',
          category: 'data',
        },
        {
          id: 'action-verification',
          name: 'Action Verification',
          description: 'Verify all actions before execution',
          enabled: true,
          strictness: 'high',
          category: 'security',
        },
        {
          id: 'ethical-guidelines',
          name: 'Ethical Guidelines',
          description: 'Enforce ethical guidelines for all actions',
          enabled: true,
          strictness: 'high',
          category: 'ethics',
        },
      ],
    },
  };

  const [selectedTemplate, setSelectedTemplate] = useState<string>(
    initialPolicy?.template || 'standard',
  );
  const [currentPolicy, setCurrentPolicy] = useState<Policy>(
    initialPolicy || policyTemplates.standard,
  );
  const [isCustomized, setIsCustomized] = useState<boolean>(initialPolicy?.template === 'custom');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // Update policy when template changes
  useEffect(() => {
    if (selectedTemplate !== 'custom') {
      setCurrentPolicy(policyTemplates[selectedTemplate]);
      setIsCustomized(false);
    }
  }, [selectedTemplate]);

  // Notify parent component when policy changes
  useEffect(() => {
    onPolicyChange(currentPolicy);
  }, [currentPolicy, onPolicyChange]);

  const handleTemplateChange = (template: string) => {
    setSelectedTemplate(template);
  };

  const handleRuleToggle = (ruleId: string) => {
    const updatedRules = currentPolicy.rules.map((rule) =>
      rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule,
    );

    const updatedPolicy = {
      ...currentPolicy,
      rules: updatedRules,
      template: 'custom',
    };

    setCurrentPolicy(updatedPolicy);
    setSelectedTemplate('custom');
    setIsCustomized(true);
  };

  const handleStrictnessChange = (ruleId: string, strictness: 'low' | 'medium' | 'high') => {
    const updatedRules = currentPolicy.rules.map((rule) =>
      rule.id === ruleId ? { ...rule, strictness } : rule,
    );

    const updatedPolicy = {
      ...currentPolicy,
      rules: updatedRules,
      template: 'custom',
    };

    setCurrentPolicy(updatedPolicy);
    setSelectedTemplate('custom');
    setIsCustomized(true);
  };

  return (
    <div className="policy-customizer">
      <div className="policy-templates">
        <h3>Governance Templates</h3>
        <div className="template-options">
          <button
            className={`template-option ${selectedTemplate === 'minimal' ? 'active' : ''}`}
            onClick={() => handleTemplateChange('minimal')}
          >
            <div className="template-icon minimal">🔍</div>
            <div className="template-info">
              <div className="template-name">Minimal</div>
              <div className="template-description">Basic governance with minimal restrictions</div>
            </div>
          </button>

          <button
            className={`template-option ${selectedTemplate === 'standard' ? 'active' : ''}`}
            onClick={() => handleTemplateChange('standard')}
          >
            <div className="template-icon standard">🛡️</div>
            <div className="template-info">
              <div className="template-name">Standard</div>
              <div className="template-description">
                Balanced governance with reasonable restrictions
              </div>
            </div>
          </button>

          <button
            className={`template-option ${selectedTemplate === 'strict' ? 'active' : ''}`}
            onClick={() => handleTemplateChange('strict')}
          >
            <div className="template-icon strict">🔒</div>
            <div className="template-info">
              <div className="template-name">Strict</div>
              <div className="template-description">
                Maximum governance with strict restrictions
              </div>
            </div>
          </button>

          {isCustomized && (
            <button
              className={`template-option ${selectedTemplate === 'custom' ? 'active' : ''}`}
              onClick={() => handleTemplateChange('custom')}
            >
              <div className="template-icon custom">⚙️</div>
              <div className="template-info">
                <div className="template-name">Custom</div>
                <div className="template-description">Your customized governance policy</div>
              </div>
            </button>
          )}
        </div>
      </div>

      <div className="policy-rules">
        <div className="rules-header">
          <h3>Policy Rules</h3>
          <button
            className={`show-advanced-button ${showAdvanced ? 'active' : ''}`}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options'}
          </button>
        </div>

        <div className="rules-list">
          {currentPolicy.rules
            .filter((rule, index) => showAdvanced || index < 4) // Show only first 4 rules unless advanced is toggled
            .map((rule) => (
              <div key={rule.id} className={`rule-item ${rule.enabled ? 'enabled' : 'disabled'}`}>
                <div className="rule-header">
                  <div className="rule-toggle">
                    <input
                      type="checkbox"
                      id={`toggle-${rule.id}`}
                      checked={rule.enabled}
                      onChange={() => handleRuleToggle(rule.id)}
                    />
                    <label htmlFor={`toggle-${rule.id}`}></label>
                  </div>

                  <div className="rule-info">
                    <div className="rule-name">{rule.name}</div>
                    <div className="rule-description">{rule.description}</div>
                  </div>

                  <div className="rule-category">{rule.category}</div>
                </div>

                {rule.enabled && (
                  <div className="rule-strictness">
                    <div className="strictness-label">Strictness:</div>
                    <div className="strictness-options">
                      <button
                        className={`strictness-option ${rule.strictness === 'low' ? 'active' : ''}`}
                        onClick={() => handleStrictnessChange(rule.id, 'low')}
                      >
                        Low
                      </button>
                      <button
                        className={`strictness-option ${rule.strictness === 'medium' ? 'active' : ''}`}
                        onClick={() => handleStrictnessChange(rule.id, 'medium')}
                      >
                        Medium
                      </button>
                      <button
                        className={`strictness-option ${rule.strictness === 'high' ? 'active' : ''}`}
                        onClick={() => handleStrictnessChange(rule.id, 'high')}
                      >
                        High
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

          {!showAdvanced && currentPolicy.rules.length > 4 && (
            <div className="more-rules-indicator">
              <span>{currentPolicy.rules.length - 4} more rules available</span>
              <button className="show-more-button" onClick={() => setShowAdvanced(true)}>
                Show All
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="policy-summary">
        <div className="summary-header">
          <h3>Policy Summary</h3>
          <div className="policy-name">{currentPolicy.name}</div>
        </div>

        <div className="summary-stats">
          <div className="stat-item">
            <div className="stat-value">{currentPolicy.rules.filter((r) => r.enabled).length}</div>
            <div className="stat-label">Active Rules</div>
          </div>

          <div className="stat-item">
            <div className="stat-value">
              {currentPolicy.rules.filter((r) => r.enabled && r.strictness === 'high').length}
            </div>
            <div className="stat-label">High Strictness</div>
          </div>

          <div className="stat-item">
            <div className="stat-value">
              {currentPolicy.rules.filter((r) => r.enabled && r.strictness === 'medium').length}
            </div>
            <div className="stat-label">Medium Strictness</div>
          </div>

          <div className="stat-item">
            <div className="stat-value">
              {currentPolicy.rules.filter((r) => r.enabled && r.strictness === 'low').length}
            </div>
            <div className="stat-label">Low Strictness</div>
          </div>
        </div>
      </div>
    </div>
  );
}
