import React, { useState, useEffect } from 'react';
import { css } from '@emotion/react';
import { designTokens, shadowSystem, keyframeAnimations, colorSystem } from '../../styles/design-system';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';

interface Policy {
  id: string;
  name: string;
  description: string;
  version: string;
  rules: PolicyRule[];
  metadata: Record<string, any>;
  status: 'active' | 'draft' | 'archived';
  createdAt: string;
  updatedAt: string;
  appliedToAgents: string[];
  effectivenessScore: number;
  violationsPrevented: number;
}

interface PolicyRule {
  id: string;
  type: 'ALLOW' | 'DENY' | 'REQUIRE' | 'RATE_LIMIT';
  condition: string;
  action: string;
  metadata: Record<string, any>;
  priority: number;
  enabled: boolean;
}

interface PolicyTemplate {
  id: string;
  name: string;
  description: string;
  category: 'trading' | 'security' | 'compliance' | 'performance';
  rules: Omit<PolicyRule, 'id'>[];
  icon: string;
}

import { BaseAgent } from '../../types';

interface AgentConnection extends BaseAgent {
  type: 'trading' | 'analysis' | 'monitoring';
  status: 'connected' | 'disconnected' | 'error';
  lastActivity: string;
  policiesApplied: string[];
}

const policyTemplates: PolicyTemplate[] = [
  {
    id: 'trading-risk-control',
    name: 'Trading Risk Control',
    description: 'Comprehensive risk management for trading agents',
    category: 'trading',
    icon: '📊',
    rules: [
      {
        type: 'DENY',
        condition: 'trade.amount > account.balance * 0.1',
        action: 'block_trade',
        metadata: { reason: 'Position size too large' },
        priority: 1,
        enabled: true
      },
      {
        type: 'REQUIRE',
        condition: 'trade.type === "high_risk"',
        action: 'human_approval',
        metadata: { timeout: 300 },
        priority: 2,
        enabled: true
      },
      {
        type: 'RATE_LIMIT',
        condition: 'agent.trades_per_hour',
        action: 'limit_to_5',
        metadata: { window: 3600 },
        priority: 3,
        enabled: true
      }
    ]
  },
  {
    id: 'security-baseline',
    name: 'Security Baseline',
    description: 'Essential security controls for all agents',
    category: 'security',
    icon: '🔒',
    rules: [
      {
        type: 'DENY',
        condition: 'request.source !== "authorized_network"',
        action: 'block_request',
        metadata: { log_level: 'high' },
        priority: 1,
        enabled: true
      },
      {
        type: 'REQUIRE',
        condition: 'action.type === "sensitive"',
        action: 'mfa_verification',
        metadata: { methods: ['totp', 'sms'] },
        priority: 2,
        enabled: true
      }
    ]
  }
];

const containerStyles = css`
  padding: ${designTokens.spacing[6]};
  max-width: 1400px;
  margin: 0 auto;
`;

const headerStyles = css`
  margin-bottom: ${designTokens.spacing[8]};
  text-align: center;
`;

const titleStyles = css`
  font-size: ${designTokens.typography.fontSize['3xl']};
  font-weight: ${designTokens.typography.fontWeight.bold};
  background: ${colorSystem.gradients.primary};
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: ${designTokens.spacing[4]};
`;

const subtitleStyles = css`
  font-size: ${designTokens.typography.fontSize.lg};
  color: ${designTokens.colors.neutral[600]};
  max-width: 600px;
  margin: 0 auto;
`;

const tabsStyles = css`
  display: flex;
  gap: ${designTokens.spacing[2]};
  margin-bottom: ${designTokens.spacing[6]};
  border-bottom: 1px solid ${designTokens.colors.neutral[200]};
`;

const tabStyles = css`
  padding: ${designTokens.spacing[3]} ${designTokens.spacing[6]};
  border: none;
  background: transparent;
  font-size: ${designTokens.typography.fontSize.sm};
  font-weight: ${designTokens.typography.fontWeight.medium};
  color: ${designTokens.colors.neutral[600]};
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s ease;

  &:hover {
    color: ${designTokens.colors.primary[600]};
  }

  &.active {
    color: ${designTokens.colors.primary[600]};
    border-bottom-color: ${designTokens.colors.primary[600]};
  }
`;

const gridStyles = css`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: ${designTokens.spacing[6]};
  margin-bottom: ${designTokens.spacing[8]};
`;

const templateCardStyles = css`
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid transparent;

  &:hover {
    transform: translateY(-2px);
    box-shadow: ${shadowSystem.lg};
    border-color: ${designTokens.colors.primary[200]};
  }
`;

const iconStyles = css`
  font-size: 2rem;
  margin-bottom: ${designTokens.spacing[3]};
`;

const categoryBadgeStyles = css`
  display: inline-block;
  padding: ${designTokens.spacing[1]} ${designTokens.spacing[2]};
  background: ${designTokens.colors.primary[100]};
  color: ${designTokens.colors.primary[700]};
  border-radius: ${designTokens.borderRadius.full};
  font-size: ${designTokens.typography.fontSize.xs};
  font-weight: ${designTokens.typography.fontWeight.medium};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const agentConnectionStyles = css`
  display: flex;
  align-items: center;
  gap: ${designTokens.spacing[3]};
  padding: ${designTokens.spacing[3]};
  background: ${designTokens.colors.neutral[50]};
  border-radius: ${designTokens.borderRadius.md};
  margin-bottom: ${designTokens.spacing[3]};
`;

const statusIndicatorStyles = css`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  
  &.connected {
    background: ${designTokens.colors.semantic.success[500]};
    box-shadow: 0 0 8px ${designTokens.colors.semantic.success[300]};
    ${keyframeAnimations.pulse}
  }
  
  &.disconnected {
    background: ${designTokens.colors.neutral[400]};
  }
  
  &.error {
    background: ${designTokens.colors.semantic.error[500]};
    ${keyframeAnimations.pulse}
  }
`;

const ruleItemStyles = css`
  padding: ${designTokens.spacing[4]};
  background: ${designTokens.colors.neutral[50]};
  border-radius: ${designTokens.borderRadius.md};
  border-left: 4px solid ${designTokens.colors.primary[500]};
  margin-bottom: ${designTokens.spacing[3]};
`;

const ruleTypeStyles = css`
  display: inline-block;
  padding: ${designTokens.spacing[1]} ${designTokens.spacing[2]};
  border-radius: ${designTokens.borderRadius.sm};
  font-size: ${designTokens.typography.fontSize.xs};
  font-weight: ${designTokens.typography.fontWeight.semibold};
  text-transform: uppercase;
  
  &.allow {
    background: ${designTokens.colors.semantic.success[100]};
    color: ${designTokens.colors.semantic.success[700]};
  }
  
  &.deny {
    background: ${designTokens.colors.semantic.error[100]};
    color: ${designTokens.colors.semantic.error[700]};
  }
  
  &.require {
    background: ${designTokens.colors.semantic.warning[100]};
    color: ${designTokens.colors.semantic.warning[700]};
  }
  
  &.rate_limit {
    background: ${designTokens.colors.primary[100]};
    color: ${designTokens.colors.primary[700]};
  }
`;

export default function PolicyManagement() {
  const [activeTab, setActiveTab] = useState<'templates' | 'policies' | 'agents'>('templates');
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [agentConnections, setAgentConnections] = useState<AgentConnection[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PolicyTemplate | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPolicies();
    fetchAgentConnections();
  }, []);

  const fetchPolicies = async () => {
    try {
      const response = await fetch('/api/policies', {
        headers: {
          'X-API-KEY': import.meta.env.VITE_API_KEY || 'development-api-key',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setPolicies(data.policies || []);
      }
    } catch (error) {
      console.error('Error fetching policies:', error);
    }
  };

  const fetchAgentConnections = async () => {
    // Mock data for demonstration - in real app, this would fetch from API
    setAgentConnections([
      {
        id: 'recall-agent-1',
        name: 'Recall Trading Agent',
        type: 'trading',
        status: 'connected',
        lastActivity: new Date().toISOString(),
        policiesApplied: ['trading-risk-control']
      },
      {
        id: 'vincent-agent-1',
        name: 'Vincent Social Trading Agent',
        type: 'trading',
        status: 'connected',
        lastActivity: new Date(Date.now() - 300000).toISOString(),
        policiesApplied: ['trading-risk-control', 'security-baseline']
      }
    ]);
  };

  const createPolicyFromTemplate = async (template: PolicyTemplate) => {
    setLoading(true);
    try {
      const newPolicy = {
        name: template.name,
        description: template.description,
        rules: template.rules.map((rule, index) => ({
          ...rule,
          id: `rule-${Date.now()}-${index}`
        })),
        status: 'draft' as const
      };

      const response = await fetch('/api/policies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': import.meta.env.VITE_API_KEY || 'development-api-key',
        },
        body: JSON.stringify(newPolicy)
      });

      if (response.ok) {
        await fetchPolicies();
        setActiveTab('policies');
      }
    } catch (error) {
      console.error('Error creating policy:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderTemplates = () => (
    <div>
      <div css={css`margin-bottom: ${designTokens.spacing[6]};`}>
        <h3 css={css`font-size: ${designTokens.typography.fontSize.xl}; margin-bottom: ${designTokens.spacing[2]};`}>
          Policy Templates
        </h3>
        <p css={css`color: ${designTokens.colors.neutral[600]};`}>
          Start with proven policy templates designed for common use cases
        </p>
      </div>

      <div css={gridStyles}>
        {policyTemplates.map((template) => (
          <Card 
            key={template.id} 
            variant="default" 
            css={templateCardStyles}
            onClick={() => createPolicyFromTemplate(template)}
          >
            <CardContent>
              <div css={iconStyles}>{template.icon}</div>
              <div css={css`margin-bottom: ${designTokens.spacing[2]};`}>
                <span css={categoryBadgeStyles}>{template.category}</span>
              </div>
              <CardTitle css={css`margin-bottom: ${designTokens.spacing[2]};`}>
                {template.name}
              </CardTitle>
              <CardDescription css={css`margin-bottom: ${designTokens.spacing[4]};`}>
                {template.description}
              </CardDescription>
              <div css={css`font-size: ${designTokens.typography.fontSize.sm}; color: ${designTokens.colors.neutral[500]};`}>
                {template.rules.length} rules included
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderPolicies = () => (
    <div>
      <div css={css`margin-bottom: ${designTokens.spacing[6]};`}>
        <h3 css={css`font-size: ${designTokens.typography.fontSize.xl}; margin-bottom: ${designTokens.spacing[2]};`}>
          Active Policies
        </h3>
        <p css={css`color: ${designTokens.colors.neutral[600]};`}>
          Manage your governance policies and monitor their effectiveness
        </p>
      </div>

      <div css={gridStyles}>
        {policies.map((policy) => (
          <Card key={policy.id} variant="default">
            <CardContent>
              <div css={css`display: flex; justify-content: between; align-items: start; margin-bottom: ${designTokens.spacing[3]};`}>
                <CardTitle css={css`margin-bottom: ${designTokens.spacing[2]};`}>
                  {policy.name}
                </CardTitle>
                <span css={css`
                  padding: ${designTokens.spacing[1]} ${designTokens.spacing[2]};
                  background: ${policy.status === 'active' ? designTokens.colors.semantic.success[100] : designTokens.colors.neutral[100]};
                  color: ${policy.status === 'active' ? designTokens.colors.semantic.success[700] : designTokens.colors.neutral[700]};
                  border-radius: ${designTokens.borderRadius.full};
                  font-size: ${designTokens.typography.fontSize.xs};
                  font-weight: ${designTokens.typography.fontWeight.medium};
                `}>
                  {policy.status}
                </span>
              </div>
              
              <CardDescription css={css`margin-bottom: ${designTokens.spacing[4]};`}>
                {policy.description}
              </CardDescription>

              <div css={css`margin-bottom: ${designTokens.spacing[4]};`}>
                <h4 css={css`font-size: ${designTokens.typography.fontSize.sm}; font-weight: ${designTokens.typography.fontWeight.semibold}; margin-bottom: ${designTokens.spacing[2]};`}>
                  Rules ({policy.rules.length})
                </h4>
                {policy.rules.slice(0, 2).map((rule) => (
                  <div key={rule.id} css={ruleItemStyles}>
                    <div css={css`display: flex; justify-content: between; align-items: center; margin-bottom: ${designTokens.spacing[2]};`}>
                      <span css={css`${ruleTypeStyles}; &.${rule.type.toLowerCase()}`}>
                        {rule.type}
                      </span>
                      <span css={css`font-size: ${designTokens.typography.fontSize.xs}; color: ${designTokens.colors.neutral[500]};`}>
                        Priority {rule.priority}
                      </span>
                    </div>
                    <div css={css`font-size: ${designTokens.typography.fontSize.sm}; color: ${designTokens.colors.neutral[700]};`}>
                      {rule.condition}
                    </div>
                  </div>
                ))}
                {policy.rules.length > 2 && (
                  <div css={css`font-size: ${designTokens.typography.fontSize.sm}; color: ${designTokens.colors.neutral[500]};`}>
                    +{policy.rules.length - 2} more rules
                  </div>
                )}
              </div>

              <div css={css`display: flex; justify-content: between; align-items: center; padding-top: ${designTokens.spacing[3]}; border-top: 1px solid ${designTokens.colors.neutral[200]};`}>
                <div css={css`font-size: ${designTokens.typography.fontSize.sm}; color: ${designTokens.colors.neutral[600]};`}>
                  Applied to {policy.appliedToAgents?.length || 0} agents
                </div>
                <div css={css`display: flex; gap: ${designTokens.spacing[2]};`}>
                  <button css={css`
                    padding: ${designTokens.spacing[2]} ${designTokens.spacing[3]};
                    background: ${designTokens.colors.primary[500]};
                    color: white;
                    border: none;
                    border-radius: ${designTokens.borderRadius.md};
                    font-size: ${designTokens.typography.fontSize.sm};
                    cursor: pointer;
                    transition: background 0.2s ease;
                    
                    &:hover {
                      background: ${designTokens.colors.primary[600]};
                    }
                  `}>
                    Edit
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderAgentConnections = () => (
    <div>
      <div css={css`margin-bottom: ${designTokens.spacing[6]};`}>
        <h3 css={css`font-size: ${designTokens.typography.fontSize.xl}; margin-bottom: ${designTokens.spacing[2]};`}>
          Connected Agents
        </h3>
        <p css={css`color: ${designTokens.colors.neutral[600]};`}>
          Monitor your autonomous agents and their policy compliance
        </p>
      </div>

      <div css={css`margin-bottom: ${designTokens.spacing[6]};`}>
        <Card variant="outlined">
          <CardContent>
            <CardTitle css={css`margin-bottom: ${designTokens.spacing[4]};`}>
              Connect Your Agent
            </CardTitle>
            <div css={css`display: grid; grid-template-columns: 1fr 1fr; gap: ${designTokens.spacing[4]};`}>
              <div>
                <label css={css`display: block; margin-bottom: ${designTokens.spacing[2]}; font-weight: ${designTokens.typography.fontWeight.medium};`}>
                  Agent Name
                </label>
                <input 
                  type="text" 
                  placeholder="My Trading Agent"
                  css={css`
                    width: 100%;
                    padding: ${designTokens.spacing[3]};
                    border: 1px solid ${designTokens.colors.neutral[300]};
                    border-radius: ${designTokens.borderRadius.md};
                    font-size: ${designTokens.typography.fontSize.sm};
                  `}
                />
              </div>
              <div>
                <label css={css`display: block; margin-bottom: ${designTokens.spacing[2]}; font-weight: ${designTokens.typography.fontWeight.medium};`}>
                  Agent Type
                </label>
                <select css={css`
                  width: 100%;
                  padding: ${designTokens.spacing[3]};
                  border: 1px solid ${designTokens.colors.neutral[300]};
                  border-radius: ${designTokens.borderRadius.md};
                  font-size: ${designTokens.typography.fontSize.sm};
                `}>
                  <option value="trading">Trading Agent</option>
                  <option value="analysis">Analysis Agent</option>
                  <option value="monitoring">Monitoring Agent</option>
                </select>
              </div>
            </div>
            <div css={css`margin-top: ${designTokens.spacing[4]};`}>
              <label css={css`display: block; margin-bottom: ${designTokens.spacing[2]}; font-weight: ${designTokens.typography.fontWeight.medium};`}>
                API Endpoint
              </label>
              <input 
                type="url" 
                placeholder="https://your-agent-api.com/webhook"
                css={css`
                  width: 100%;
                  padding: ${designTokens.spacing[3]};
                  border: 1px solid ${designTokens.colors.neutral[300]};
                  border-radius: ${designTokens.borderRadius.md};
                  font-size: ${designTokens.typography.fontSize.sm};
                `}
              />
            </div>
            <button css={css`
              margin-top: ${designTokens.spacing[4]};
              padding: ${designTokens.spacing[3]} ${designTokens.spacing[6]};
              background: ${designTokens.colors.primary[500]};
              color: white;
              border: none;
              border-radius: ${designTokens.borderRadius.md};
              font-size: ${designTokens.typography.fontSize.sm};
              font-weight: ${designTokens.typography.fontWeight.medium};
              cursor: pointer;
              transition: background 0.2s ease;
              
              &:hover {
                background: ${designTokens.colors.primary[600]};
              }
            `}>
              Connect Agent
            </button>
          </CardContent>
        </Card>
      </div>

      <div css={gridStyles}>
        {agentConnections.map((agent) => (
          <Card key={agent.id} variant="default">
            <CardContent>
              <div css={agentConnectionStyles}>
                <span css={css`${statusIndicatorStyles}; &.${agent.status}`} />
                <div>
                  <div css={css`font-weight: ${designTokens.typography.fontWeight.semibold};`}>
                    {agent.name}
                  </div>
                  <div css={css`font-size: ${designTokens.typography.fontSize.sm}; color: ${designTokens.colors.neutral[500]};`}>
                    {agent.type} • Last active {new Date(agent.lastActivity).toLocaleTimeString()}
                  </div>
                </div>
              </div>

              <div css={css`margin-bottom: ${designTokens.spacing[4]};`}>
                <h4 css={css`font-size: ${designTokens.typography.fontSize.sm}; font-weight: ${designTokens.typography.fontWeight.semibold}; margin-bottom: ${designTokens.spacing[2]};`}>
                  Applied Policies ({agent.policiesApplied.length})
                </h4>
                {agent.policiesApplied.map((policyId) => (
                  <span key={policyId} css={css`
                    display: inline-block;
                    margin-right: ${designTokens.spacing[2]};
                    margin-bottom: ${designTokens.spacing[1]};
                    padding: ${designTokens.spacing[1]} ${designTokens.spacing[2]};
                    background: ${designTokens.colors.primary[100]};
                    color: ${designTokens.colors.primary[700]};
                    border-radius: ${designTokens.borderRadius.full};
                    font-size: ${designTokens.typography.fontSize.xs};
                  `}>
                    {policyId}
                  </span>
                ))}
              </div>

              <div css={css`display: flex; justify-content: between; align-items: center; padding-top: ${designTokens.spacing[3]}; border-top: 1px solid ${designTokens.colors.neutral[200]};`}>
                <div css={css`font-size: ${designTokens.typography.fontSize.sm}; color: ${designTokens.colors.neutral[600]};`}>
                  Status: {agent.status}
                </div>
                <button css={css`
                  padding: ${designTokens.spacing[2]} ${designTokens.spacing[3]};
                  background: transparent;
                  color: ${designTokens.colors.primary[600]};
                  border: 1px solid ${designTokens.colors.primary[300]};
                  border-radius: ${designTokens.borderRadius.md};
                  font-size: ${designTokens.typography.fontSize.sm};
                  cursor: pointer;
                  transition: all 0.2s ease;
                  
                  &:hover {
                    background: ${designTokens.colors.primary[50]};
                  }
                `}>
                  Configure
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  return (
    <div css={containerStyles}>
      <div css={headerStyles}>
        <h1 css={titleStyles}>Policy Management</h1>
        <p css={subtitleStyles}>
          Create, manage, and monitor governance policies for your autonomous agents
        </p>
      </div>

      <div css={tabsStyles}>
        <button 
          css={css`${tabStyles}; ${activeTab === 'templates' ? '&.active' : ''}`}
          onClick={() => setActiveTab('templates')}
          className={activeTab === 'templates' ? 'active' : ''}
        >
          Policy Templates
        </button>
        <button 
          css={css`${tabStyles}; ${activeTab === 'policies' ? '&.active' : ''}`}
          onClick={() => setActiveTab('policies')}
          className={activeTab === 'policies' ? 'active' : ''}
        >
          My Policies ({policies.length})
        </button>
        <button 
          css={css`${tabStyles}; ${activeTab === 'agents' ? '&.active' : ''}`}
          onClick={() => setActiveTab('agents')}
          className={activeTab === 'agents' ? 'active' : ''}
        >
          Connected Agents ({agentConnections.length})
        </button>
      </div>

      {activeTab === 'templates' && renderTemplates()}
      {activeTab === 'policies' && renderPolicies()}
      {activeTab === 'agents' && renderAgentConnections()}
    </div>
  );
}