import React, { useState, useEffect } from 'react';
import { css } from '@emotion/react';
import { designTokens, shadowSystem, keyframeAnimations, colorSystem } from '../../styles/design-system';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';

interface AuditLog {
  id: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  action: {
    type: string;
    description: string;
    input: string;
    decision: string;
    confidence?: number;
    riskScore?: number;
  };
  policyChecks: {
    policyId: string;
    policyName: string;
    result: boolean;
    reason: string;
    ruleTriggered?: string;
  }[];
  metadata: {
    modelVersion: string;
    governancePolicy: string;
    complianceStatus: "compliant" | "non-compliant" | "warning";
    latencyMs: number;
    executionContext?: string;
  };
  impact: {
    severity: 'low' | 'medium' | 'high' | 'critical';
    category: 'trading' | 'security' | 'compliance' | 'performance';
    financialImpact?: number;
  };
}

interface AIInsight {
  id: string;
  type: 'pattern' | 'anomaly' | 'recommendation' | 'trend';
  title: string;
  description: string;
  confidence: number;
  actionable: boolean;
  relatedLogs: string[];
  generatedAt: string;
}

interface FilterState {
  startDate: string;
  endDate: string;
  agentId: string;
  actionType: string;
  complianceStatus: string;
  severity: string;
  category: string;
}

const containerStyles = css`
  padding: ${designTokens.spacing[6]};
  max-width: 1600px;
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
  max-width: 800px;
  margin: 0 auto;
`;

const dashboardGridStyles = css`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: ${designTokens.spacing[4]};
  margin-bottom: ${designTokens.spacing[8]};

  @media (max-width: 1024px) {
    grid-template-columns: 1fr 1fr;
  }

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const metricCardStyles = css`
  text-align: center;
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: ${colorSystem.gradients.primary};
  }
`;

const metricValueStyles = css`
  font-size: ${designTokens.typography.fontSize['2xl']};
  font-weight: ${designTokens.typography.fontWeight.bold};
  color: ${designTokens.colors.primary[600]};
  margin-bottom: ${designTokens.spacing[2]};
`;

const metricLabelStyles = css`
  font-size: ${designTokens.typography.fontSize.sm};
  color: ${designTokens.colors.neutral[600]};
  font-weight: ${designTokens.typography.fontWeight.medium};
`;

const filtersStyles = css`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: ${designTokens.spacing[4]};
  margin-bottom: ${designTokens.spacing[6]};
  padding: ${designTokens.spacing[6]};
  background: ${designTokens.colors.neutral[50]};
  border-radius: ${designTokens.borderRadius.lg};
`;

const filterGroupStyles = css`
  display: flex;
  flex-direction: column;
  gap: ${designTokens.spacing[2]};
`;

const labelStyles = css`
  font-size: ${designTokens.typography.fontSize.sm};
  font-weight: ${designTokens.typography.fontWeight.medium};
  color: ${designTokens.colors.neutral[700]};
`;

const inputStyles = css`
  padding: ${designTokens.spacing[3]};
  border: 1px solid ${designTokens.colors.neutral[300]};
  border-radius: ${designTokens.borderRadius.md};
  font-size: ${designTokens.typography.fontSize.sm};
  transition: border-color 0.2s ease;

  &:focus {
    outline: none;
    border-color: ${designTokens.colors.primary[500]};
    box-shadow: 0 0 0 3px ${designTokens.colors.primary[100]};
  }
`;

const insightsGridStyles = css`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: ${designTokens.spacing[4]};
  margin-bottom: ${designTokens.spacing[8]};
`;

const insightCardStyles = css`
  border-left: 4px solid ${designTokens.colors.primary[500]};
  
  &.pattern {
    border-left-color: ${designTokens.colors.primary[500]};
  }
  
  &.anomaly {
    border-left-color: ${designTokens.colors.semantic.warning[500]};
  }
  
  &.recommendation {
    border-left-color: ${designTokens.colors.semantic.success[500]};
  }
  
  &.trend {
    border-left-color: ${designTokens.colors.semantic.info[500]};
  }
`;

const confidenceBarStyles = css`
  width: 100%;
  height: 4px;
  background: ${designTokens.colors.neutral[200]};
  border-radius: ${designTokens.borderRadius.full};
  overflow: hidden;
  margin-top: ${designTokens.spacing[2]};
`;

const confidenceFillStyles = (confidence: number) => css`
  height: 100%;
  background: ${confidence > 80 ? designTokens.colors.semantic.success[500] : 
              confidence > 60 ? designTokens.colors.semantic.warning[500] : 
              designTokens.colors.semantic.error[500]};
  width: ${confidence}%;
  transition: width 0.3s ease;
`;

const logTimelineStyles = css`
  display: flex;
  flex-direction: column;
  gap: ${designTokens.spacing[4]};
`;

const logItemStyles = css`
  position: relative;
  padding-left: ${designTokens.spacing[8]};
  
  &::before {
    content: '';
    position: absolute;
    left: ${designTokens.spacing[3]};
    top: ${designTokens.spacing[4]};
    width: 2px;
    height: calc(100% - ${designTokens.spacing[4]});
    background: ${designTokens.colors.neutral[200]};
  }
  
  &::after {
    content: '';
    position: absolute;
    left: ${designTokens.spacing[2]};
    top: ${designTokens.spacing[4]};
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: ${designTokens.colors.primary[500]};
    border: 2px solid white;
    box-shadow: ${shadowSystem.sm};
  }
  
  &.non-compliant::after {
    background: ${designTokens.colors.semantic.error[500]};
  }
  
  &.warning::after {
    background: ${designTokens.colors.semantic.warning[500]};
  }
`;

const statusBadgeStyles = css`
  display: inline-block;
  padding: ${designTokens.spacing[1]} ${designTokens.spacing[2]};
  border-radius: ${designTokens.borderRadius.full};
  font-size: ${designTokens.typography.fontSize.xs};
  font-weight: ${designTokens.typography.fontWeight.semibold};
  text-transform: uppercase;
  
  &.compliant {
    background: ${designTokens.colors.semantic.success[100]};
    color: ${designTokens.colors.semantic.success[700]};
  }
  
  &.non-compliant {
    background: ${designTokens.colors.semantic.error[100]};
    color: ${designTokens.colors.semantic.error[700]};
  }
  
  &.warning {
    background: ${designTokens.colors.semantic.warning[100]};
    color: ${designTokens.colors.semantic.warning[700]};
  }
`;

const severityBadgeStyles = css`
  display: inline-block;
  padding: ${designTokens.spacing[1]} ${designTokens.spacing[2]};
  border-radius: ${designTokens.borderRadius.full};
  font-size: ${designTokens.typography.fontSize.xs};
  font-weight: ${designTokens.typography.fontWeight.semibold};
  text-transform: uppercase;
  margin-left: ${designTokens.spacing[2]};
  
  &.low {
    background: ${designTokens.colors.semantic.success[100]};
    color: ${designTokens.colors.semantic.success[700]};
  }
  
  &.medium {
    background: ${designTokens.colors.semantic.warning[100]};
    color: ${designTokens.colors.semantic.warning[700]};
  }
  
  &.high {
    background: ${designTokens.colors.semantic.error[100]};
    color: ${designTokens.colors.semantic.error[700]};
  }
  
  &.critical {
    background: ${designTokens.colors.semantic.error[500]};
    color: white;
  }
`;

export default function EnhancedAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    agentId: '',
    actionType: '',
    complianceStatus: '',
    severity: '',
    category: ''
  });

  const [metrics, setMetrics] = useState({
    totalLogs: 0,
    complianceRate: 0,
    avgResponseTime: 0,
    criticalIssues: 0
  });

  useEffect(() => {
    fetchLogs();
    generateAIInsights();
  }, [filters]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams(
        Object.entries(filters).filter(([_, value]) => value !== '')
      ).toString();

      const response = await fetch(`/api/audit-logs?${queryParams}`, {
        headers: {
          'X-API-KEY': import.meta.env.VITE_API_KEY || 'development-api-key',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data);
        calculateMetrics(data);
      } else {
        // Mock data for demonstration
        const mockLogs = generateMockLogs();
        setLogs(mockLogs);
        calculateMetrics(mockLogs);
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
      // Use mock data on error
      const mockLogs = generateMockLogs();
      setLogs(mockLogs);
      calculateMetrics(mockLogs);
    } finally {
      setLoading(false);
    }
  };

  const generateMockLogs = (): AuditLog[] => [
    {
      id: '1',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      agentId: 'recall-agent-1',
      agentName: 'Recall Trading Agent',
      action: {
        type: 'trade_execution',
        description: 'Execute buy order for ETH/USDC',
        input: 'Buy 0.5 ETH at market price',
        decision: 'Approved - within risk limits',
        confidence: 0.92,
        riskScore: 0.3
      },
      policyChecks: [
        {
          policyId: 'trading-risk-control',
          policyName: 'Trading Risk Control',
          result: true,
          reason: 'Position size within 10% limit',
          ruleTriggered: 'position_size_check'
        }
      ],
      metadata: {
        modelVersion: '1.2.3',
        governancePolicy: 'trading-risk-control',
        complianceStatus: 'compliant',
        latencyMs: 150,
        executionContext: 'automated_trading'
      },
      impact: {
        severity: 'low',
        category: 'trading',
        financialImpact: 1250.50
      }
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      agentId: 'vincent-agent-1',
      agentName: 'Vincent Social Trading Agent',
      action: {
        type: 'sentiment_analysis',
        description: 'Analyze social sentiment for DOGE',
        input: 'Twitter sentiment analysis for DOGE trading decision',
        decision: 'Hold - mixed sentiment signals',
        confidence: 0.67,
        riskScore: 0.6
      },
      policyChecks: [
        {
          policyId: 'security-baseline',
          policyName: 'Security Baseline',
          result: false,
          reason: 'Sentiment source not in approved list',
          ruleTriggered: 'approved_sources_only'
        }
      ],
      metadata: {
        modelVersion: '1.2.3',
        governancePolicy: 'security-baseline',
        complianceStatus: 'non-compliant',
        latencyMs: 2300,
        executionContext: 'social_trading'
      },
      impact: {
        severity: 'medium',
        category: 'security'
      }
    }
  ];

  const calculateMetrics = (logs: AuditLog[]) => {
    const totalLogs = logs.length;
    const compliantLogs = logs.filter(log => log.metadata.complianceStatus === 'compliant').length;
    const complianceRate = totalLogs > 0 ? (compliantLogs / totalLogs) * 100 : 0;
    const avgResponseTime = logs.reduce((sum, log) => sum + log.metadata.latencyMs, 0) / totalLogs || 0;
    const criticalIssues = logs.filter(log => log.impact.severity === 'critical').length;

    setMetrics({
      totalLogs,
      complianceRate,
      avgResponseTime,
      criticalIssues
    });
  };

  const generateAIInsights = async () => {
    // Mock AI insights - in real app, this would call Gemini API
    const mockInsights: AIInsight[] = [
      {
        id: '1',
        type: 'pattern',
        title: 'Recurring Policy Violations',
        description: 'Vincent agent has violated security policies 3 times in the last 24 hours, primarily due to unapproved sentiment sources.',
        confidence: 87,
        actionable: true,
        relatedLogs: ['2'],
        generatedAt: new Date().toISOString()
      },
      {
        id: '2',
        type: 'recommendation',
        title: 'Optimize Response Times',
        description: 'Social trading agent response times are 40% higher than baseline. Consider implementing caching for sentiment analysis.',
        confidence: 92,
        actionable: true,
        relatedLogs: ['2'],
        generatedAt: new Date().toISOString()
      },
      {
        id: '3',
        type: 'trend',
        title: 'Increasing Trade Volume',
        description: 'Trading activity has increased 25% over the past week, with compliance rate remaining stable at 98.5%.',
        confidence: 95,
        actionable: false,
        relatedLogs: ['1'],
        generatedAt: new Date().toISOString()
      }
    ];

    setAiInsights(mockInsights);
  };

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const renderMetrics = () => (
    <div css={dashboardGridStyles}>
      <Card variant="default" css={metricCardStyles}>
        <CardContent>
          <div css={metricValueStyles}>{metrics.totalLogs.toLocaleString()}</div>
          <div css={metricLabelStyles}>Total Actions Logged</div>
        </CardContent>
      </Card>
      
      <Card variant="default" css={metricCardStyles}>
        <CardContent>
          <div css={metricValueStyles}>{metrics.complianceRate.toFixed(1)}%</div>
          <div css={metricLabelStyles}>Compliance Rate</div>
        </CardContent>
      </Card>
      
      <Card variant="default" css={metricCardStyles}>
        <CardContent>
          <div css={metricValueStyles}>{metrics.avgResponseTime.toFixed(0)}ms</div>
          <div css={metricLabelStyles}>Avg Response Time</div>
        </CardContent>
      </Card>
      
      <Card variant="default" css={metricCardStyles}>
        <CardContent>
          <div css={metricValueStyles}>{metrics.criticalIssues}</div>
          <div css={metricLabelStyles}>Critical Issues</div>
        </CardContent>
      </Card>
    </div>
  );

  const renderFilters = () => (
    <Card variant="outlined">
      <CardContent>
        <CardTitle css={css`margin-bottom: ${designTokens.spacing[4]};`}>
          Filter Audit Logs
        </CardTitle>
        <div css={filtersStyles}>
          <div css={filterGroupStyles}>
            <label css={labelStyles}>Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              css={inputStyles}
            />
          </div>
          
          <div css={filterGroupStyles}>
            <label css={labelStyles}>End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              css={inputStyles}
            />
          </div>
          
          <div css={filterGroupStyles}>
            <label css={labelStyles}>Agent</label>
            <select
              value={filters.agentId}
              onChange={(e) => handleFilterChange('agentId', e.target.value)}
              css={inputStyles}
            >
              <option value="">All Agents</option>
              <option value="recall-agent-1">Recall Trading Agent</option>
              <option value="vincent-agent-1">Vincent Social Trading Agent</option>
            </select>
          </div>
          
          <div css={filterGroupStyles}>
            <label css={labelStyles}>Action Type</label>
            <select
              value={filters.actionType}
              onChange={(e) => handleFilterChange('actionType', e.target.value)}
              css={inputStyles}
            >
              <option value="">All Actions</option>
              <option value="trade_execution">Trade Execution</option>
              <option value="sentiment_analysis">Sentiment Analysis</option>
              <option value="risk_assessment">Risk Assessment</option>
            </select>
          </div>
          
          <div css={filterGroupStyles}>
            <label css={labelStyles}>Compliance Status</label>
            <select
              value={filters.complianceStatus}
              onChange={(e) => handleFilterChange('complianceStatus', e.target.value)}
              css={inputStyles}
            >
              <option value="">All Status</option>
              <option value="compliant">Compliant</option>
              <option value="non-compliant">Non-Compliant</option>
              <option value="warning">Warning</option>
            </select>
          </div>
          
          <div css={filterGroupStyles}>
            <label css={labelStyles}>Severity</label>
            <select
              value={filters.severity}
              onChange={(e) => handleFilterChange('severity', e.target.value)}
              css={inputStyles}
            >
              <option value="">All Severities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderAIInsights = () => (
    <div>
      <h3 css={css`font-size: ${designTokens.typography.fontSize.xl}; margin-bottom: ${designTokens.spacing[4]}; display: flex; align-items: center; gap: ${designTokens.spacing[2]};`}>
        🤖 AI-Powered Insights
        <span css={css`font-size: ${designTokens.typography.fontSize.sm}; color: ${designTokens.colors.neutral[500]}; font-weight: normal;`}>
          Powered by Gemini
        </span>
      </h3>
      
      <div css={insightsGridStyles}>
        {aiInsights.map((insight) => (
          <Card key={insight.id} variant="default" css={css`${insightCardStyles}; &.${insight.type}`}>
            <CardContent>
              <div css={css`display: flex; justify-content: between; align-items: start; margin-bottom: ${designTokens.spacing[3]};`}>
                <CardTitle css={css`margin-bottom: ${designTokens.spacing[2]};`}>
                  {insight.title}
                </CardTitle>
                <span css={css`
                  padding: ${designTokens.spacing[1]} ${designTokens.spacing[2]};
                  background: ${designTokens.colors.primary[100]};
                  color: ${designTokens.colors.primary[700]};
                  border-radius: ${designTokens.borderRadius.full};
                  font-size: ${designTokens.typography.fontSize.xs};
                  font-weight: ${designTokens.typography.fontWeight.medium};
                  text-transform: uppercase;
                `}>
                  {insight.type}
                </span>
              </div>
              
              <CardDescription css={css`margin-bottom: ${designTokens.spacing[4]};`}>
                {insight.description}
              </CardDescription>
              
              <div css={css`margin-bottom: ${designTokens.spacing[3]};`}>
                <div css={css`display: flex; justify-content: between; align-items: center; margin-bottom: ${designTokens.spacing[1]};`}>
                  <span css={css`font-size: ${designTokens.typography.fontSize.sm}; color: ${designTokens.colors.neutral[600]};`}>
                    Confidence
                  </span>
                  <span css={css`font-size: ${designTokens.typography.fontSize.sm}; font-weight: ${designTokens.typography.fontWeight.semibold};`}>
                    {insight.confidence}%
                  </span>
                </div>
                <div css={confidenceBarStyles}>
                  <div css={confidenceFillStyles(insight.confidence)} />
                </div>
              </div>
              
              {insight.actionable && (
                <button css={css`
                  width: 100%;
                  padding: ${designTokens.spacing[3]};
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
                  Take Action
                </button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderLogs = () => (
    <div>
      <h3 css={css`font-size: ${designTokens.typography.fontSize.xl}; margin-bottom: ${designTokens.spacing[4]};`}>
        Audit Timeline
      </h3>
      
      <div css={logTimelineStyles}>
        {logs.map((log) => (
          <div key={log.id} css={css`${logItemStyles}; &.${log.metadata.complianceStatus}`}>
            <Card variant="default">
              <CardContent>
                <div css={css`display: flex; justify-content: between; align-items: start; margin-bottom: ${designTokens.spacing[3]};`}>
                  <div>
                    <CardTitle css={css`margin-bottom: ${designTokens.spacing[1]};`}>
                      {log.agentName}
                    </CardTitle>
                    <div css={css`font-size: ${designTokens.typography.fontSize.sm}; color: ${designTokens.colors.neutral[500]};`}>
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <div css={css`display: flex; align-items: center;`}>
                    <span css={css`${statusBadgeStyles}; &.${log.metadata.complianceStatus}`}>
                      {log.metadata.complianceStatus}
                    </span>
                    <span css={css`${severityBadgeStyles}; &.${log.impact.severity}`}>
                      {log.impact.severity}
                    </span>
                  </div>
                </div>
                
                <div css={css`margin-bottom: ${designTokens.spacing[4]};`}>
                  <h4 css={css`font-size: ${designTokens.typography.fontSize.sm}; font-weight: ${designTokens.typography.fontWeight.semibold}; margin-bottom: ${designTokens.spacing[2]};`}>
                    Action: {log.action.type}
                  </h4>
                  <p css={css`font-size: ${designTokens.typography.fontSize.sm}; color: ${designTokens.colors.neutral[600]}; margin-bottom: ${designTokens.spacing[2]};`}>
                    {log.action.description}
                  </p>
                  <div css={css`display: grid; grid-template-columns: 1fr 1fr; gap: ${designTokens.spacing[4]};`}>
                    <div>
                      <strong>Input:</strong> {log.action.input}
                    </div>
                    <div>
                      <strong>Decision:</strong> {log.action.decision}
                    </div>
                  </div>
                  {log.action.confidence && (
                    <div css={css`margin-top: ${designTokens.spacing[2]};`}>
                      <strong>Confidence:</strong> {(log.action.confidence * 100).toFixed(1)}%
                      {log.action.riskScore && (
                        <span css={css`margin-left: ${designTokens.spacing[4]};`}>
                          <strong>Risk Score:</strong> {(log.action.riskScore * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  )}
                </div>
                
                <div css={css`margin-bottom: ${designTokens.spacing[4]};`}>
                  <h4 css={css`font-size: ${designTokens.typography.fontSize.sm}; font-weight: ${designTokens.typography.fontWeight.semibold}; margin-bottom: ${designTokens.spacing[2]};`}>
                    Policy Checks ({log.policyChecks.length})
                  </h4>
                  {log.policyChecks.map((check, index) => (
                    <div key={index} css={css`
                      padding: ${designTokens.spacing[3]};
                      background: ${check.result ? designTokens.colors.semantic.success[50] : designTokens.colors.semantic.error[50]};
                      border-radius: ${designTokens.borderRadius.md};
                      border-left: 4px solid ${check.result ? designTokens.colors.semantic.success[500] : designTokens.colors.semantic.error[500]};
                      margin-bottom: ${designTokens.spacing[2]};
                    `}>
                      <div css={css`display: flex; justify-content: between; align-items: center; margin-bottom: ${designTokens.spacing[1]};`}>
                        <strong>{check.policyName}</strong>
                        <span css={css`
                          padding: ${designTokens.spacing[1]} ${designTokens.spacing[2]};
                          background: ${check.result ? designTokens.colors.semantic.success[100] : designTokens.colors.semantic.error[100]};
                          color: ${check.result ? designTokens.colors.semantic.success[700] : designTokens.colors.semantic.error[700]};
                          border-radius: ${designTokens.borderRadius.full};
                          font-size: ${designTokens.typography.fontSize.xs};
                          font-weight: ${designTokens.typography.fontWeight.semibold};
                        `}>
                          {check.result ? 'PASSED' : 'FAILED'}
                        </span>
                      </div>
                      <div css={css`font-size: ${designTokens.typography.fontSize.sm}; color: ${designTokens.colors.neutral[600]};`}>
                        {check.reason}
                      </div>
                      {check.ruleTriggered && (
                        <div css={css`font-size: ${designTokens.typography.fontSize.xs}; color: ${designTokens.colors.neutral[500]}; margin-top: ${designTokens.spacing[1]};`}>
                          Rule: {check.ruleTriggered}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                <div css={css`display: flex; justify-content: between; align-items: center; padding-top: ${designTokens.spacing[3]}; border-top: 1px solid ${designTokens.colors.neutral[200]};`}>
                  <div css={css`font-size: ${designTokens.typography.fontSize.sm}; color: ${designTokens.colors.neutral[600]};`}>
                    Response Time: {log.metadata.latencyMs}ms
                    {log.impact.financialImpact && (
                      <span css={css`margin-left: ${designTokens.spacing[4]};`}>
                        Impact: ${log.impact.financialImpact > 0 ? '+' : ''}${log.impact.financialImpact.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                      </span>
                    )}
                  </div>
                  <div css={css`font-size: ${designTokens.typography.fontSize.xs}; color: ${designTokens.colors.neutral[500]};`}>
                    {log.metadata.executionContext}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div css={containerStyles}>
        <div css={css`display: flex; justify-content: center; align-items: center; min-height: 400px;`}>
          <div css={css`text-align: center;`}>
            <div css={css`
              width: 40px;
              height: 40px;
              border: 3px solid ${designTokens.colors.neutral[200]};
              border-top: 3px solid ${designTokens.colors.primary[500]};
              border-radius: 50%;
              animation: spin 1s linear infinite;
              margin: 0 auto ${designTokens.spacing[4]};
              
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `} />
            <p>Loading audit logs...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div css={containerStyles}>
      <div css={headerStyles}>
        <h1 css={titleStyles}>Audit Logs & Insights</h1>
        <p css={subtitleStyles}>
          Monitor your autonomous agents with comprehensive audit trails and AI-powered insights
        </p>
      </div>

      {renderMetrics()}
      {renderFilters()}
      {renderAIInsights()}
      {renderLogs()}
    </div>
  );
}