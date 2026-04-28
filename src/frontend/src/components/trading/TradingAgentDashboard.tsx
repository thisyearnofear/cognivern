/** @jsxImportSource @emotion/react */
import { useState, useEffect, useMemo } from 'react';
import { css } from '@emotion/react';
import {
  Users,
  BarChart3,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  AlertTriangle,
  History,
  Settings,
  Activity,
  ArrowRight,
  Filter,
  Plus,
  Brain,
  MessageSquare,
  ChevronUp,
  ChevronDown,
  Search,
  Trophy,
  Zap,
} from 'lucide-react';
import { designTokens, keyframeAnimations } from '../../styles/design-system';
import { AgentType } from '../../types';
import { useAgentData, useTradingData } from '../../hooks/useAgentData';
import { useAppStore } from '../../stores/appStore';
import { useBreakpoint } from '../../hooks/useMediaQuery';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { PageWrapper } from '../layout';
import TradingChart from './TradingChart';
import TradeHistory from './TradeHistory';
import { AgentMonitor } from './AgentMonitor';
import { InteractiveCarousel, CarouselItem } from '../ui/InteractiveCarousel';
import { agentApi } from '../../services/apiService';
import { useNavigate } from 'react-router-dom';
import VoiceBriefing from '../agents/VoiceBriefing';
import {
  agentComparisonSchema,
  defaultFilters,
  filterFieldDefinitions,
  type AgentComparisonFilters,
} from '../../lib/store/agentComparisonSchema';
import * as styles from './TradingAgentDashboard.styles';

export default function TradingAgentDashboard() {
  return (
    <ErrorBoundary componentName="Trading Agent Dashboard">
      <TradingAgentDashboardContent />
    </ErrorBoundary>
  );
}

function TradingAgentDashboardContent() {
  const navigate = useNavigate();
  const { isMobile } = useBreakpoint();
  const [showComparison, setShowComparison] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>('recall');
  const [error, setError] = useState<string | null>(null);
  const [comparisonFilters, setComparisonFilters] =
    useState<AgentComparisonFilters>(defaultFilters);
  const [comparisonData, setComparisonData] = useState<any[]>([]);
  const [isLoadingComparison, setIsLoadingComparison] = useState(false);
  // AgentMonitor handles its own data fetching
  const { preferences, updatePreferences } = useAppStore();
  const hasExploredDemo = preferences.demoExplored || preferences.onboardingCompleted;

  // Fetch comparison data when comparison view is shown
  useEffect(() => {
    if (showComparison) {
      fetchComparisonData();
    }
  }, [showComparison, comparisonFilters]);

  const fetchComparisonData = async () => {
    setIsLoadingComparison(true);
    try {
      const response = await agentApi.compareAgents({
        agentTypes: comparisonFilters.agentTypes?.length ? comparisonFilters.agentTypes : undefined,
        ecosystems: comparisonFilters.ecosystems?.length ? comparisonFilters.ecosystems : undefined,
        status: comparisonFilters.status?.length ? comparisonFilters.status : undefined,
        sortBy: comparisonFilters.sortBy || 'totalReturn',
        sortDirection: comparisonFilters.sortDirection || 'desc',
      });

      if (response.success && response.data) {
        setComparisonData(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch comparison data:', error);
    } finally {
      setIsLoadingComparison(false);
    }
  };

  const handleExploreDemo = () => {
    updatePreferences({ demoExplored: true, onboardingCompleted: true });
  };

  const updateFilter = <K extends keyof AgentComparisonFilters>(
    key: K,
    value: AgentComparisonFilters[K],
  ) => {
    setComparisonFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setComparisonFilters(defaultFilters);
  };

  // Filter comparison data based on local filters
  const filteredComparisonData = useMemo(() => {
    let filtered = [...comparisonData];

    // Apply search filter
    if (comparisonFilters.search) {
      const search = comparisonFilters.search.toLowerCase();
      filtered = filtered.filter(
        (agent) =>
          agent.agentName?.toLowerCase().includes(search) ||
          agent.agentType?.toLowerCase().includes(search),
      );
    }

    // Apply range filters
    if (comparisonFilters.complianceScore) {
      const [min, max] = comparisonFilters.complianceScore;
      filtered = filtered.filter(
        (agent) => (agent.complianceScore ?? 100) >= min && (agent.complianceScore ?? 100) <= max,
      );
    }

    if (comparisonFilters.autonomyLevel) {
      const [min, max] = comparisonFilters.autonomyLevel;
      filtered = filtered.filter(
        (agent) => (agent.autonomyLevel ?? 1) >= min && (agent.autonomyLevel ?? 1) <= max,
      );
    }

    if (comparisonFilters.riskProfile && (comparisonFilters.riskProfile as any[]).length > 0) {
      filtered = filtered.filter((agent) =>
        (comparisonFilters.riskProfile as any[]).includes(agent.riskProfile ?? 'low'),
      );
    }

    if (comparisonFilters.winRate) {
      const [min, max] = comparisonFilters.winRate;
      filtered = filtered.filter((agent) => agent.winRate >= min && agent.winRate <= max);
    }

    if (comparisonFilters.totalReturn) {
      const [min, max] = comparisonFilters.totalReturn;
      filtered = filtered.filter((agent) => agent.totalReturn >= min && agent.totalReturn <= max);
    }

    if (comparisonFilters.sharpeRatio) {
      const [min, max] = comparisonFilters.sharpeRatio;
      filtered = filtered.filter((agent) => agent.sharpeRatio >= min && agent.sharpeRatio <= max);
    }

    return filtered;
  }, [comparisonData, comparisonFilters]);
  const filterSectionStyles = css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: ${designTokens.spacing[6]};
    flex-wrap: wrap;
    gap: ${designTokens.spacing[4]};
  `;

  const errorStyles = css`
    background: ${designTokens.colors.semantic.error[50]};
    border: 1px solid ${designTokens.colors.semantic.error[200]};
    border-radius: ${designTokens.borderRadius.lg};
    padding: ${designTokens.spacing[4]};
    margin-bottom: ${designTokens.spacing[6]};
    display: flex;
    align-items: center;
    gap: ${designTokens.spacing[3]};
  `;

  const carouselItems: CarouselItem[] = [
    {
      id: 'recall',
      title: 'Research Agent',
      subtitle: 'Analysis & Intake',
      icon: '🧠',
      content: (
        <div
          css={css`
            font-size: ${designTokens.typography.fontSize.sm};
          `}
        >
          Research-focused agent that gathers context and proposes bounded actions for review.
        </div>
      ),
    },
    {
      id: 'vincent',
      title: 'Procurement Agent',
      subtitle: 'Execution & Vendors',
      icon: '🎭',
      content: (
        <div
          css={css`
            font-size: ${designTokens.typography.fontSize.sm};
          `}
        >
          Execution-focused agent that requests supplier-facing spend under strict policy controls.
        </div>
      ),
    },
    {
      id: 'sapience',
      title: 'Oversight Agent',
      subtitle: 'Policy & Review',
      icon: '👁️',
      content: (
        <div
          css={css`
            font-size: ${designTokens.typography.fontSize.sm};
          `}
        >
          Governance-focused agent that scores risk, triggers holds, and escalates actions for
          approval.
        </div>
      ),
    },
  ];

  const handleCarouselItemClick = (id: string) => {
    setSelectedAgent(id);
    // Scroll to the agent monitor or navigate to it
    const element = document.getElementById(`agent-monitor-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <PageWrapper
      title="Governed Agent Operations"
      subtitle="Monitor scoped agents, review policy outcomes, and inspect the evidence trail behind every proposed action."
      actions={
        <Button
          variant="primary"
          onClick={() => navigate('/agents/workshop')}
          leftIcon={<Plus size={18} />}
        >
          Add Governed Agent
        </Button>
      }
    >
      {/* Error Display */}
      {error && (
        <div css={styles.errorStyles}>
          <AlertTriangle size={24} color={designTokens.colors.semantic.error[500]} />
          <div>
            <h3
              css={css`
                margin: 0;
                color: ${designTokens.colors.semantic.error[700]};
              `}
            >
              Connection Error
            </h3>
            <p
              css={css`
                margin: 0;
                color: ${designTokens.colors.semantic.error[600]};
              `}
            >
              {error}
            </p>
          </div>
        </div>
      )}

      {/* Interactive Agent Carousel */}
      <div
        css={css`
          margin-top: ${designTokens.spacing[2]};
          margin-bottom: ${designTokens.spacing[10]};
        `}
      >
        <InteractiveCarousel items={carouselItems} onItemClick={handleCarouselItemClick} />
        <p
          css={css`
            text-align: center;
            font-size: ${designTokens.typography.fontSize.sm};
            color: ${designTokens.colors.neutral[500]};
            margin-top: ${designTokens.spacing[4]};
          `}
        >
          Double click active agent to view detailed profile
        </p>
      </div>

      {/* Voice Briefing - ElevenLabs AI */}
      <VoiceBriefing agentId={selectedAgent} />

      {/* Agent Comparison Toggle */}
      <div
        css={css`
          display: flex;
          justify-content: center;
          align-items: center;
          gap: ${designTokens.spacing[3]};
          margin-bottom: ${designTokens.spacing[6]};
        `}
      >
        <Button variant="secondary" size="sm" onClick={() => setShowComparison(!showComparison)}>
          {showComparison ? 'Hide' : 'Show'} Agent Comparison
        </Button>
        {showComparison && (
          <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)}>
            {showFilters ? 'Hide' : 'Show'} Filters
          </Button>
        )}
      </div>
      {/* Enhanced Agent Comparison */}
      {showComparison && (
        <Card
          variant="elevated"
          css={css`
            margin-bottom: ${designTokens.spacing[10]};
            background: rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(20px);
            border: 1px solid ${designTokens.colors.neutral[200]};
            box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.1);
            ${keyframeAnimations.fadeIn}
          `}
        >
          <CardHeader>
            <div
              css={css`
                display: flex;
                justify-content: space-between;
                align-items: center;
              `}
            >
              <div>
                <CardTitle
                  css={css`
                    font-size: ${designTokens.typography.fontSize['2xl']};
                    letter-spacing: -0.02em;
                  `}
                >
                  Agent Behavioral Intelligence
                </CardTitle>
                <CardDescription
                  css={css`
                    color: ${designTokens.colors.neutral[600]};
                  `}
                >
                  Cross-referencing compliance scores, autonomy levels, and risk metrics across the
                  governed fleet.
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                Reset All Filters
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filters Section */}
            {showFilters && (
              <div
                css={css`
                  padding: ${designTokens.spacing[6]};
                  background: rgba(15, 23, 42, 0.03);
                  border: 1px solid rgba(15, 23, 42, 0.05);
                  border-radius: ${designTokens.borderRadius.xl};
                  margin-bottom: ${designTokens.spacing[6]};
                  ${keyframeAnimations.slideInDown}
                `}
              >
                <div
                  css={css`
                    display: flex;
                    align-items: center;
                    gap: ${designTokens.spacing[2]};
                    margin: 0 0 ${designTokens.spacing[4]} 0;
                  `}
                >
                  <Filter size={18} color={designTokens.colors.primary[600]} />
                  <h4
                    css={css`
                      margin: 0;
                      font-size: ${designTokens.typography.fontSize.sm};
                      font-weight: ${designTokens.typography.fontWeight.bold};
                      text-transform: uppercase;
                      letter-spacing: 0.1em;
                      color: ${designTokens.colors.primary[600]};
                    `}
                  >
                    Intelligence Filters
                  </h4>
                </div>

                <div
                  css={css`
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                    gap: ${designTokens.spacing[6]};
                  `}
                >
                  {/* Search */}
                  <div>
                    <label
                      css={css`
                        display: block;
                        margin-bottom: ${designTokens.spacing[2]};
                        font-size: ${designTokens.typography.fontSize.xs};
                        font-weight: ${designTokens.typography.fontWeight.bold};
                        text-transform: uppercase;
                        color: ${designTokens.colors.neutral[500]};
                      `}
                    >
                      Search Governed Fleet
                    </label>
                    <div
                      css={css`
                        position: relative;
                      `}
                    >
                      <Search
                        size={14}
                        css={css`
                          position: absolute;
                          left: 12px;
                          top: 50%;
                          transform: translateY(-50%);
                          color: ${designTokens.colors.neutral[400]};
                        `}
                      />
                      <input
                        type="text"
                        placeholder="Search by name or type..."
                        value={comparisonFilters.search || ''}
                        onChange={(e) => updateFilter('search', e.target.value || null)}
                        css={css`
                          width: 100%;
                          height: 40px;
                          padding: 0 ${designTokens.spacing[3]} 0 36px;
                          background: white;
                          border: 1px solid ${designTokens.colors.neutral[200]};
                          border-radius: ${designTokens.borderRadius.lg};
                          font-size: ${designTokens.typography.fontSize.sm};
                          transition: all 0.3s ease;
                          &:focus {
                            border-color: ${designTokens.colors.primary[500]};
                            box-shadow: 0 0 0 4px ${designTokens.colors.primary[50]};
                            outline: none;
                          }
                        `}
                      />
                    </div>
                  </div>

                  {/* Agent Types */}
                  <div>
                    <label
                      css={css`
                        display: block;
                        margin-bottom: ${designTokens.spacing[2]};
                        font-size: ${designTokens.typography.fontSize.xs};
                        font-weight: ${designTokens.typography.fontWeight.bold};
                        text-transform: uppercase;
                        color: ${designTokens.colors.neutral[500]};
                      `}
                    >
                      Agent Model Type
                    </label>
                    <div
                      css={css`
                        display: flex;
                        flex-wrap: wrap;
                        gap: ${designTokens.spacing[3]};
                      `}
                    >
                      {['recall', 'vincent', 'sapience'].map((type) => (
                        <label
                          key={type}
                          css={css`
                            display: flex;
                            align-items: center;
                            gap: ${designTokens.spacing[2]};
                            font-size: ${designTokens.typography.fontSize.sm};
                            cursor: pointer;
                            color: ${designTokens.colors.neutral[700]};
                            &:hover {
                              color: ${designTokens.colors.primary[600]};
                            }
                          `}
                        >
                          <input
                            type="checkbox"
                            css={css`
                              accent-color: ${designTokens.colors.primary[600]};
                            `}
                            checked={comparisonFilters.agentTypes?.includes(type as any) || false}
                            onChange={(e) => {
                              const current = comparisonFilters.agentTypes || [];
                              const updated = e.target.checked
                                ? [...current, type as any]
                                : current.filter((t) => t !== type);
                              updateFilter('agentTypes', updated);
                            }}
                          />
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <label
                      css={css`
                        display: block;
                        margin-bottom: ${designTokens.spacing[2]};
                        font-size: ${designTokens.typography.fontSize.xs};
                        font-weight: ${designTokens.typography.fontWeight.bold};
                        text-transform: uppercase;
                        color: ${designTokens.colors.neutral[500]};
                      `}
                    >
                      Operational Status
                    </label>
                    <div
                      css={css`
                        display: flex;
                        flex-wrap: wrap;
                        gap: ${designTokens.spacing[3]};
                      `}
                    >
                      {['active', 'inactive'].map((status) => (
                        <label
                          key={status}
                          css={css`
                            display: flex;
                            align-items: center;
                            gap: ${designTokens.spacing[2]};
                            font-size: ${designTokens.typography.fontSize.sm};
                            cursor: pointer;
                            color: ${designTokens.colors.neutral[700]};
                          `}
                        >
                          <input
                            type="checkbox"
                            css={css`
                              accent-color: ${designTokens.colors.primary[600]};
                            `}
                            checked={comparisonFilters.status?.includes(status as any) || false}
                            onChange={(e) => {
                              const current = comparisonFilters.status || [];
                              const updated = e.target.checked
                                ? [...current, status as any]
                                : current.filter((s) => s !== status);
                              updateFilter('status', updated);
                            }}
                          />
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Comparison Table */}
            {isLoadingComparison ? (
              <div
                css={css`
                  text-align: center;
                  padding: ${designTokens.spacing[12]};
                  color: ${designTokens.colors.neutral[500]};
                `}
              >
                Analyzing fleet behavioral data...
              </div>
            ) : filteredComparisonData.length === 0 ? (
              <div
                css={css`
                  text-align: center;
                  padding: ${designTokens.spacing[12]};
                  color: ${designTokens.colors.neutral[500]};
                `}
              >
                No agents found matching the current criteria.
              </div>
            ) : (
              <div
                css={css`
                  overflow-x: auto;
                  border: 1px solid ${designTokens.colors.neutral[100]};
                  border-radius: ${designTokens.borderRadius.xl};
                  background: white;
                `}
              >
                <table
                  css={css`
                    width: 100%;
                    border-collapse: collapse;
                    font-size: ${designTokens.typography.fontSize.sm};

                    th,
                    td {
                      padding: ${designTokens.spacing[4]} ${designTokens.spacing[5]};
                      text-align: left;
                      border-bottom: 1px solid ${designTokens.colors.neutral[100]};
                    }

                    th {
                      background: ${designTokens.colors.neutral[50]};
                      font-weight: ${designTokens.typography.fontWeight.bold};
                      color: ${designTokens.colors.neutral[900]};
                      text-transform: uppercase;
                      letter-spacing: 0.05em;
                      font-size: ${designTokens.typography.fontSize.xs};
                      position: sticky;
                      top: 0;
                      cursor: pointer;
                      user-select: none;
                      transition: background 0.3s ease;

                      &:hover {
                        background: ${designTokens.colors.neutral[100]};
                      }
                    }

                    tbody tr {
                      transition: all 0.3s ease;
                      &:hover {
                        background: ${designTokens.colors.primary[50]}40;
                        transform: scale(1.002) translateZ(0);
                      }
                    }

                    tbody tr:last-child td {
                      border-bottom: none;
                    }
                  `}
                >
                  <thead>
                    <tr>
                      <th onClick={() => updateFilter('sortBy', 'agentName')}>
                        <div
                          css={css`
                            display: flex;
                            align-items: center;
                            gap: 6px;
                          `}
                        >
                          Governed Agent
                          {comparisonFilters.sortBy === 'agentName' &&
                            (comparisonFilters.sortDirection === 'asc' ? (
                              <ChevronUp size={14} />
                            ) : (
                              <ChevronDown size={14} />
                            ))}
                        </div>
                      </th>
                      <th onClick={() => updateFilter('sortBy', 'agentType')}>
                        <div
                          css={css`
                            display: flex;
                            align-items: center;
                            gap: 4px;
                          `}
                        >
                          Type
                          {comparisonFilters.sortBy === 'agentType' &&
                            (comparisonFilters.sortDirection === 'asc' ? (
                              <ChevronUp size={14} />
                            ) : (
                              <ChevronDown size={14} />
                            ))}
                        </div>
                      </th>
                      <th>Status</th>
                      <th onClick={() => updateFilter('sortBy', 'complianceScore')}>
                        <div
                          css={css`
                            display: flex;
                            align-items: center;
                            gap: 4px;
                          `}
                        >
                          Compliance
                          {comparisonFilters.sortBy === 'complianceScore' &&
                            (comparisonFilters.sortDirection === 'asc' ? (
                              <ChevronUp size={14} />
                            ) : (
                              <ChevronDown size={14} />
                            ))}
                        </div>
                      </th>
                      <th onClick={() => updateFilter('sortBy', 'autonomyLevel')}>
                        <div
                          css={css`
                            display: flex;
                            align-items: center;
                            gap: 4px;
                          `}
                        >
                          Autonomy
                          {comparisonFilters.sortBy === 'autonomyLevel' &&
                            (comparisonFilters.sortDirection === 'asc' ? (
                              <ChevronUp size={14} />
                            ) : (
                              <ChevronDown size={14} />
                            ))}
                        </div>
                      </th>
                      <th onClick={() => updateFilter('sortBy', 'riskProfile' as any)}>
                        <div
                          css={css`
                            display: flex;
                            align-items: center;
                            gap: 4px;
                          `}
                        >
                          Risk
                          {comparisonFilters.sortBy === ('riskProfile' as any) &&
                            (comparisonFilters.sortDirection === 'asc' ? (
                              <ChevronUp size={14} />
                            ) : (
                              <ChevronDown size={14} />
                            ))}
                        </div>
                      </th>
                      <th onClick={() => updateFilter('sortBy', 'winRate')}>
                        <div
                          css={css`
                            display: flex;
                            align-items: center;
                            gap: 4px;
                          `}
                        >
                          Win Rate
                          {comparisonFilters.sortBy === 'winRate' &&
                            (comparisonFilters.sortDirection === 'asc' ? (
                              <ChevronUp size={14} />
                            ) : (
                              <ChevronDown size={14} />
                            ))}
                        </div>
                      </th>
                      <th onClick={() => updateFilter('sortBy', 'totalReturn')}>
                        <div
                          css={css`
                            display: flex;
                            align-items: center;
                            gap: 4px;
                          `}
                        >
                          Return
                          {comparisonFilters.sortBy === 'totalReturn' &&
                            (comparisonFilters.sortDirection === 'asc' ? (
                              <ChevronUp size={14} />
                            ) : (
                              <ChevronDown size={14} />
                            ))}
                        </div>
                      </th>
                      <th onClick={() => updateFilter('sortBy', 'avgLatency')}>
                        <div
                          css={css`
                            display: flex;
                            align-items: center;
                            gap: 4px;
                          `}
                        >
                          Latency
                          {comparisonFilters.sortBy === 'avgLatency' &&
                            (comparisonFilters.sortDirection === 'asc' ? (
                              <ChevronUp size={14} />
                            ) : (
                              <ChevronDown size={14} />
                            ))}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredComparisonData.map((agent, idx) => (
                      <tr key={agent.agentId || idx}>
                        <td
                          css={css`
                            font-weight: ${designTokens.typography.fontWeight.medium};
                          `}
                        >
                          {agent.agentName || 'Unknown'}
                        </td>
                        <td>
                          <Badge variant="secondary" size="sm">
                            {agent.agentType || 'N/A'}
                          </Badge>
                        </td>
                        <td>
                          <Badge
                            variant={agent.status === 'active' ? 'success' : 'secondary'}
                            size="sm"
                          >
                            {agent.status || 'unknown'}
                          </Badge>
                        </td>
                        <td
                          css={css`
                            color: ${(agent.complianceScore ?? 100) >= 90
                              ? designTokens.colors.semantic.success
                              : (agent.complianceScore ?? 100) >= 70
                                ? designTokens.colors.semantic.warning
                                : designTokens.colors.semantic.error};
                            font-weight: ${designTokens.typography.fontWeight.medium};
                          `}
                        >
                          {agent.complianceScore ?? 100}%
                        </td>
                        <td>Lvl {agent.autonomyLevel ?? 1}</td>
                        <td>
                          <Badge
                            variant={
                              (agent.riskProfile ?? 'low') === 'low'
                                ? 'success'
                                : (agent.riskProfile ?? 'low') === 'medium'
                                  ? 'warning'
                                  : 'error'
                            }
                            size="sm"
                            css={css`
                              text-transform: capitalize;
                            `}
                          >
                            {agent.riskProfile ?? 'low'}
                          </Badge>
                        </td>
                        <td
                          css={css`
                            color: ${(agent.winRate || 0) >= 0.5
                              ? designTokens.colors.semantic.success
                              : designTokens.colors.neutral[600]};
                          `}
                        >
                          {((agent.winRate || 0) * 100).toFixed(1)}%
                        </td>
                        <td
                          css={css`
                            color: ${(agent.totalReturn || 0) >= 0
                              ? designTokens.colors.semantic.success
                              : designTokens.colors.semantic.error};
                          `}
                        >
                          {(agent.totalReturn || 0) >= 0 ? '+' : ''}
                          {((agent.totalReturn || 0) * 100).toFixed(2)}%
                        </td>
                        <td>{agent.avgLatency ? `${agent.avgLatency}ms` : 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Summary Stats */}
            {filteredComparisonData.length > 0 && (
              <div
                css={css`
                  margin-top: ${designTokens.spacing[4]};
                  padding: ${designTokens.spacing[4]};
                  background: ${designTokens.colors.primary[50]};
                  border-radius: ${designTokens.borderRadius.lg};
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                  gap: ${designTokens.spacing[4]};
                `}
              >
                <div
                  css={css`
                    text-align: center;
                  `}
                >
                  <div
                    css={css`
                      font-size: ${designTokens.typography.fontSize['2xl']};
                      font-weight: ${designTokens.typography.fontWeight.bold};
                      color: ${designTokens.colors.primary[600]};
                    `}
                  >
                    {filteredComparisonData.length}
                  </div>
                  <div
                    css={css`
                      font-size: ${designTokens.typography.fontSize.sm};
                      color: ${designTokens.colors.neutral[600]};
                    `}
                  >
                    Total Agents
                  </div>
                </div>
                <div
                  css={css`
                    text-align: center;
                  `}
                >
                  <div
                    css={css`
                      font-size: ${designTokens.typography.fontSize['2xl']};
                      font-weight: ${designTokens.typography.fontWeight.bold};
                      color: ${designTokens.colors.primary[600]};
                    `}
                  >
                    {(
                      (filteredComparisonData.reduce((sum, a) => sum + (a.winRate || 0), 0) /
                        filteredComparisonData.length) *
                      100
                    ).toFixed(1)}
                    %
                  </div>
                  <div
                    css={css`
                      font-size: ${designTokens.typography.fontSize.sm};
                      color: ${designTokens.colors.neutral[600]};
                    `}
                  >
                    Avg Win Rate
                  </div>
                </div>
                <div
                  css={css`
                    text-align: center;
                  `}
                >
                  <div
                    css={css`
                      font-size: ${designTokens.typography.fontSize['2xl']};
                      font-weight: ${designTokens.typography.fontWeight.bold};
                      color: ${designTokens.colors.primary[600]};
                    `}
                  >
                    {(
                      (filteredComparisonData.reduce((sum, a) => sum + (a.totalReturn || 0), 0) /
                        filteredComparisonData.length) *
                      100
                    ).toFixed(2)}
                    %
                  </div>
                  <div
                    css={css`
                      font-size: ${designTokens.typography.fontSize.sm};
                      color: ${designTokens.colors.neutral[600]};
                    `}
                  >
                    Avg Return
                  </div>
                </div>
                <div
                  css={css`
                    text-align: center;
                  `}
                >
                  <div
                    css={css`
                      font-size: ${designTokens.typography.fontSize['2xl']};
                      font-weight: ${designTokens.typography.fontWeight.bold};
                      color: ${designTokens.colors.primary[600]};
                    `}
                  >
                    {filteredComparisonData.reduce((sum, a) => sum + (a.totalTrades || 0), 0)}
                  </div>
                  <div
                    css={css`
                      font-size: ${designTokens.typography.fontSize.sm};
                      color: ${designTokens.colors.neutral[600]};
                    `}
                  >
                    Total Trades
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Showcase Agents Section */}
      <div
        css={css`
          margin-bottom: ${designTokens.spacing[12]};

          @media (max-width: ${designTokens.breakpoints.sm}) {
            margin-bottom: ${designTokens.spacing[8]};
          }
        `}
      >
        <div
          css={css`
            display: flex;
            align-items: center;
            gap: ${designTokens.spacing[3]};
            margin-bottom: ${designTokens.spacing[6]};
            border-bottom: 2px solid ${designTokens.colors.neutral[200]};
            padding-bottom: ${designTokens.spacing[4]};
            flex-wrap: wrap;

            @media (max-width: ${designTokens.breakpoints.sm}) {
              gap: ${designTokens.spacing[2]};
              margin-bottom: ${designTokens.spacing[4]};
              padding-bottom: ${designTokens.spacing[3]};
            }
          `}
        >
          <Trophy size={20} color={designTokens.colors.primary[500]} />
          <h2
            css={css`
              font-size: ${designTokens.typography.fontSize.xl};
              font-weight: ${designTokens.typography.fontWeight.bold};
              color: ${designTokens.colors.neutral[900]};

              @media (max-width: ${designTokens.breakpoints.sm}) {
                font-size: ${designTokens.typography.fontSize.lg};
              }
            `}
          >
            Managed Agent Views
          </h2>
          <Badge
            variant="secondary"
            css={css`
              margin-left: auto;

              @media (max-width: ${designTokens.breakpoints.sm}) {
                margin-left: 0;
              }
            `}
          >
            3 Ready
          </Badge>
        </div>

        {!hasExploredDemo ? (
          <div
            css={css`
              text-align: center;
              padding: ${designTokens.spacing[12]};
              max-width: 480px;
              margin: 0 auto;
            `}
          >
            <div
              css={css`
                width: 80px;
                height: 80px;
                border-radius: 50%;
                background: ${designTokens.colors.primary[100]};
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto ${designTokens.spacing[6]};
              `}
            >
              <Brain size={40} color={designTokens.colors.primary[500]} />
            </div>
            <h2
              css={css`
                font-size: ${designTokens.typography.fontSize['2xl']};
                font-weight: ${designTokens.typography.fontWeight.bold};
                margin-bottom: ${designTokens.spacing[3]};
                color: var(--text-primary);
              `}
            >
              Your Dashboard is Ready
            </h2>
            <p
              css={css`
                font-size: ${designTokens.typography.fontSize.base};
                color: var(--text-secondary);
                margin-bottom: ${designTokens.spacing[6]};
                line-height: ${designTokens.typography.lineHeight.relaxed};
              `}
            >
              Connect your first agent to see real spend governance in action,
              or explore with sample data to see how it works.
            </p>
            <div
              css={css`
                display: flex;
                flex-direction: column;
                gap: ${designTokens.spacing[3]};
                align-items: center;
              `}
            >
              <Button variant="outline" onClick={handleExploreDemo}>
                Explore Demo Agents
              </Button>
              <span
                css={css`
                  font-size: ${designTokens.typography.fontSize.sm};
                  color: ${designTokens.colors.neutral[500]};
                `}
              >
                Sample data with demo agents
              </span>
            </div>
          </div>
        ) : (
          <div
            css={css`
              display: grid;
              grid-template-columns: 1fr;
              gap: ${designTokens.spacing[10]};
            `}
          >
            <AgentMonitor
              agentType="governance"
              title="Spend Governance Agent"
              description="Evaluates spend requests against policies, enforces limits, and logs all decisions for audit."
              isShowcase
            />

            <AgentMonitor
              agentType="portfolio"
              title="Portfolio Agent"
              description="Executes approved spends, manages wallet access through scoped API keys, handles signing."
              isShowcase
            />

            <AgentMonitor
              agentType="sapience"
              title="Oversight Agent"
              description="Governance-first agent that reviews risk, evaluates policy fit, and routes high-impact actions into approval."
              isShowcase
            />
          </div>
        )}
      </div>

      {/* User Tracking Section */}
      <div>
        <div
          css={css`
            display: flex;
            align-items: center;
            gap: ${designTokens.spacing[3]};
            margin-bottom: ${designTokens.spacing[6]};
            border-bottom: 2px solid ${designTokens.colors.neutral[200]};
            padding-bottom: ${designTokens.spacing[4]};
            flex-wrap: wrap;

            @media (max-width: ${designTokens.breakpoints.sm}) {
              gap: ${designTokens.spacing[2]};
              margin-bottom: ${designTokens.spacing[4]};
              padding-bottom: ${designTokens.spacing[3]};
            }
          `}
        >
          <Users size={20} color={designTokens.colors.secondary[700]} />
          <h2
            css={css`
              font-size: ${designTokens.typography.fontSize.xl};
              font-weight: ${designTokens.typography.fontWeight.bold};
              color: ${designTokens.colors.neutral[900]};

              @media (max-width: ${designTokens.breakpoints.sm}) {
                font-size: ${designTokens.typography.fontSize.lg};
              }
            `}
          >
            User Provided Agents
          </h2>
          <Badge
            variant="secondary"
            css={css`
              margin-left: auto;

              @media (max-width: ${designTokens.breakpoints.sm}) {
                margin-left: 0;
              }
            `}
          >
            Private Tracking
          </Badge>
        </div>

        <Card
          css={css`
            border-style: dashed;
            border-color: ${designTokens.colors.accent[200]};
            background: ${designTokens.colors.accent[50]};
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: ${designTokens.spacing[12]};
            text-align: center;

            @media (max-width: ${designTokens.breakpoints.sm}) {
              padding: ${designTokens.spacing[8]} ${designTokens.spacing[5]};
            }
          `}
        >
          <div
            css={css`
              width: 48px;
              height: 48px;
              border-radius: 50%;
              background: white;
              display: flex;
              align-items: center;
              justify-content: center;
              margin-bottom: ${designTokens.spacing[4]};
              box-shadow: ${designTokens.shadows.sm};

              @media (max-width: ${designTokens.breakpoints.sm}) {
                width: 40px;
                height: 40px;
                margin-bottom: ${designTokens.spacing[3]};
              }
            `}
          >
            <Zap
              size={24}
              color={designTokens.colors.accent[500]}
              css={css`
                @media (max-width: ${designTokens.breakpoints.sm}) {
                  width: 20px;
                  height: 20px;
                }
              `}
            />
          </div>
          <h3
            css={css`
              margin-bottom: ${designTokens.spacing[2]};
              color: ${designTokens.colors.neutral[800]};
              font-weight: ${designTokens.typography.fontWeight.semibold};

              @media (max-width: ${designTokens.breakpoints.sm}) {
                font-size: ${designTokens.typography.fontSize.base};
              }
            `}
          >
            No Custom Agents Tracked
          </h3>
          <p
            css={css`
              color: ${designTokens.colors.neutral[600]};
              max-width: 400px;
              margin-bottom: ${designTokens.spacing[6]};
              line-height: 1.6;

              @media (max-width: ${designTokens.breakpoints.sm}) {
                max-width: 100%;
                font-size: ${designTokens.typography.fontSize.sm};
                margin-bottom: ${designTokens.spacing[5]};
              }
            `}
          >
            Connect your own OpenClaw or Hermes agents to monitor their behavioral performance and
            governance scores privately.
          </p>
          <Button variant="primary" onClick={() => navigate('/workshop')}>
            Go to Workshop
          </Button>
        </Card>
      </div>
    </PageWrapper>
  );
}
