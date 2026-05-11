import { FileText, Users, Shield, Plus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { css } from '@emotion/react';
import { designTokens } from '../../styles/design-system';
import { useGovernanceStore, GovernanceTemplate } from '../../stores/governanceStore';
import {
  Card,
  CardContent,
  StatCard,
  PolicyCard,
  Button,
  Badge,
  AgentCard,
  LoadingSpinner,
  ErrorBoundary,
  EmptyState,
} from '../ui';
import { PageWrapper } from '../layout';
import { useBreakpoint } from '../../hooks/useMediaQuery';
import { agentApi } from '../../services/apiService';

interface AgentConnection {
  id: string;
  name: string;
  status?: string;
  description?: string;
  winRate?: number;
  totalReturn?: number;
}

/**
 * PolicyManagement - Central hub for governance across the platform.
 * Refactored to use centralized governanceStore and modular UI primitives.
 *
 * CORE PRINCIPLES:
 * - ENHANCEMENT FIRST: Leverages global UI components (PolicyCard, StatCard).
 * - MODULAR: Clear separation between templates, active policies, and agent links.
 * - ORGANIZED: Domain-driven state management via useGovernanceStore.
 */

export default function PolicyManagement() {
  return (
    <ErrorBoundary componentName="Policy Management">
      <PolicyManagementContent />
    </ErrorBoundary>
  );
}

function PolicyManagementContent() {
  const navigate = useNavigate();
  const { isMobile, isTablet } = useBreakpoint();
  const [activeTab, setActiveTab] = useState<'templates' | 'policies' | 'agents'>('templates');

  // Global Governance State
  const { policies, templates, isLoading, fetchPolicies, applyTemplate } = useGovernanceStore();

  // Local state for agent connections (keeping existing logic for agent domain)
  const [agentConnections, setAgentConnections] = useState<AgentConnection[]>([]);
  const [isAgentsLoading, setIsAgentsLoading] = useState(false);

  useEffect(() => {
    fetchPolicies();
    fetchAgentConnections();
  }, [fetchPolicies]);

  const fetchAgentConnections = async () => {
    setIsAgentsLoading(true);
    try {
      const response = await agentApi.getConnections();
      if (response.success && response.data) {
        const payload = response.data as { data?: AgentConnection[] };
        setAgentConnections(Array.isArray(payload.data) ? payload.data : []);
      }
    } catch (error) {
      console.error('Error fetching agent connections:', error);
    } finally {
      setIsAgentsLoading(false);
    }
  };

  const handleTemplateSelect = async (template: GovernanceTemplate) => {
    try {
      await applyTemplate(template.id);
      setActiveTab('policies');
    } catch (error) {
      console.error('Failed to apply template:', error);
    }
  };

  const getTemplateMonogram = (name: string) =>
    name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  // Layout Styles

  const headerStyles = css`
    margin-bottom: ${designTokens.spacing[10]};
  `;

  const titleStyles = css`
    font-size: ${designTokens.typography.fontSize['3xl']};
    font-weight: ${designTokens.typography.fontWeight.bold};
    color: ${designTokens.colors.neutral[900]};
    margin-bottom: ${designTokens.spacing[2]};
  `;

  const subtitleStyles = css`
    color: ${designTokens.colors.neutral[500]};
    font-size: ${designTokens.typography.fontSize.lg};
  `;

  const statsGridStyles = css`
    display: grid;
    grid-template-columns: repeat(${isMobile ? 1 : 3}, 1fr);
    gap: ${designTokens.spacing[6]};
    margin-bottom: ${designTokens.spacing[10]};
  `;

  const tabsContainerStyles = css`
    display: flex;
    gap: ${designTokens.spacing[1]};
    border-bottom: 1px solid ${designTokens.colors.border.primary};
    margin-bottom: ${designTokens.spacing[6]};
  `;

  const tabButtonStyles = (active: boolean) => css`
    background: none;
    border: none;
    padding: ${designTokens.spacing[3]} ${designTokens.spacing[4]};
    font-size: ${designTokens.typography.fontSize.sm};
    font-weight: ${designTokens.typography.fontWeight.medium};
    color: ${active ? designTokens.colors.text.primary : designTokens.colors.text.secondary};
    border-bottom: 2px solid ${active ? designTokens.colors.primary[500] : 'transparent'};
    margin-bottom: -1px;
    cursor: pointer;
    transition: all 150ms ease-out;
    display: inline-flex;
    align-items: center;
    gap: ${designTokens.spacing[2]};

    svg {
      width: 14px;
      height: 14px;
      opacity: 0.7;
      transition: opacity 150ms ease-out;
    }

    &:hover {
      color: ${designTokens.colors.text.primary};

      svg {
        opacity: 1;
      }
    }
  `;

  const sectionTitleStyles = css`
    font-size: ${designTokens.typography.fontSize.xl};
    font-weight: ${designTokens.typography.fontWeight.semibold};
  `;

  const gridLayoutStyles = css`
    display: grid;
    grid-template-columns: repeat(${isMobile ? 1 : isTablet ? 2 : 3}, 1fr);
    gap: ${designTokens.spacing[6]};
  `;

  return (
    <PageWrapper
      title="Governance & Policies"
      subtitle="Create spend guardrails, review active approvals, and manage which agents operate under governance."
    >
      {/* High-Level Overview Stats */}
      <div css={statsGridStyles}>
        <StatCard
          label="Total Policies"
          value={policies.length}
          icon={<FileText size={20} />}
          color="primary"
        />
        <StatCard
          label="Active Policies"
          value={policies.filter((p) => p.status === 'active').length}
          icon={<Shield size={20} />}
          color="success"
        />
        <StatCard
          label="Governed Agents"
          value={agentConnections.length}
          icon={<Users size={20} />}
          color="info"
        />
      </div>

      {/* Tabbed Interface */}
      <nav css={tabsContainerStyles}>
        <button
          css={tabButtonStyles(activeTab === 'templates')}
          onClick={() => setActiveTab('templates')}
        >
          <FileText size={14} />
          Templates
        </button>
        <button
          css={tabButtonStyles(activeTab === 'policies')}
          onClick={() => setActiveTab('policies')}
        >
          <Shield size={14} />
          Active Policies ({policies.length})
        </button>
        <button
          css={tabButtonStyles(activeTab === 'agents')}
          onClick={() => setActiveTab('agents')}
        >
          <Users size={14} />
          Agent Coverage
        </button>
      </nav>

      {/* Tab Content */}
      <main>
        {activeTab === 'templates' && (
          <div css={gridLayoutStyles}>
            {templates.map((template) => (
              <Card key={template.id} interactive onClick={() => handleTemplateSelect(template)}>
                <CardContent>
                  <div
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      width: '40px',
                      height: '40px',
                      borderRadius: '9999px',
                      border: `1px solid ${designTokens.colors.neutral[300]}`,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: designTokens.colors.neutral[700],
                      background: designTokens.colors.neutral[100],
                      marginBottom: designTokens.spacing[4],
                    }}
                  >
                    {getTemplateMonogram(template.name)}
                  </div>
                  <h3 style={{ marginBottom: designTokens.spacing[2] }}>{template.name}</h3>
                  <p
                    style={{
                      color: designTokens.colors.neutral[500],
                      fontSize: '0.9rem',
                      marginBottom: designTokens.spacing[4],
                      minHeight: '3em',
                    }}
                  >
                    {template.description}
                  </p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Badge variant="secondary">{template.complexity}</Badge>
                    <Badge variant="outline">{template.defaultRules.length} Rules</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {activeTab === 'policies' && (
          <>
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <LoadingSpinner />
              </div>
            ) : policies.length === 0 ? (
              <EmptyState
                type="policies"
                title="No policies created yet"
                description="Start with a template to apply clear spend guardrails to your agents."
                actionLabel="View Templates"
                onAction={() => setActiveTab('templates')}
              />
            ) : (
              <div css={gridLayoutStyles}>
                {policies.map((policy) => (
                  <PolicyCard
                    key={policy.id}
                    policy={policy}
                    onClick={(p) => console.log('Edit policy', p)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'agents' && (
          <>
            {isAgentsLoading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <LoadingSpinner />
              </div>
            ) : agentConnections.length === 0 ? (
              <EmptyState
                type="agents"
                title="No governed agents yet"
                description="Connect your first agent to apply policies and enforce spend controls."
                actionLabel="Connect Agent"
                onAction={() => navigate('/agents/workshop')}
              />
            ) : (
              <div css={gridLayoutStyles}>
                {agentConnections.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={{
                      ...agent,
                      status: agent.status ?? 'disconnected',
                      totalReturn: agent.totalReturn ?? 0,
                      winRate: agent.winRate ?? 0,
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </PageWrapper>
  );
}
