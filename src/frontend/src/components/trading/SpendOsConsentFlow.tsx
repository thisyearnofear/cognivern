/** @jsxImportSource @emotion/react */
import { useState } from 'react';
import { css } from '@emotion/react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  Lock,
  DollarSign,
  BarChart3,
  Shield,
  Clock,
  ClipboardList,
  Eye,
  Zap,
  AlertTriangle,
  Rocket,
  CheckCircle,
  Settings,
  UserCheck,
  Activity,
} from 'lucide-react';
import { designTokens } from '../../styles/design-system';

interface SpendOsConsentFlowProps {
  appId: string;
  onConsent: () => void;
}

const styles = {
  section: css`
    margin-bottom: ${designTokens.spacing[6]};
  `,
  sectionTitle: css`
    font-size: ${designTokens.typography.fontSize.sm};
    font-weight: ${designTokens.typography.fontWeight.semibold};
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: ${designTokens.spacing[4]};
  `,
  list: css`
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: ${designTokens.spacing[3]};
  `,
  listItem: css`
    display: flex;
    align-items: flex-start;
    gap: ${designTokens.spacing[3]};
    font-size: ${designTokens.typography.fontSize.sm};
    color: var(--text-primary);
    line-height: 1.5;
  `,
  iconWrapper: (color: string) => css`
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: ${designTokens.borderRadius.md};
    background: ${color}15;
    color: ${color};
  `,
  details: css`
    display: flex;
    flex-direction: column;
    gap: ${designTokens.spacing[2]};
  `,
  detailRow: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: ${designTokens.spacing[2]} 0;
    border-bottom: 1px solid var(--card-border);
    font-size: ${designTokens.typography.fontSize.sm};

    &:last-child {
      border-bottom: none;
    }
  `,
  detailLabel: css`
    color: var(--text-secondary);
    font-weight: ${designTokens.typography.fontWeight.medium};
  `,
  detailValue: css`
    color: var(--text-primary);
    font-weight: ${designTokens.typography.fontWeight.semibold};
  `,
  warningBox: css`
    display: flex;
    align-items: flex-start;
    gap: ${designTokens.spacing[3]};
    padding: ${designTokens.spacing[4]};
    background: ${designTokens.colors.semantic.warning[50]}99;
    border: 1px solid ${designTokens.colors.semantic.warning[200]};
    border-radius: ${designTokens.borderRadius.lg};
    margin-bottom: ${designTokens.spacing[4]};
  `,
  warningText: css`
    font-size: ${designTokens.typography.fontSize.sm};
    color: var(--text-primary);
    line-height: 1.5;
    margin: 0;
  `,
  footer: css`
    text-align: center;
    margin-top: ${designTokens.spacing[4]};
  `,
  footerText: css`
    font-size: ${designTokens.typography.fontSize.xs};
    color: var(--text-muted);
    margin: 0;
  `,
  steps: css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: ${designTokens.spacing[4]};
  `,
  step: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: ${designTokens.spacing[2]};
  `,
  stepIcon: (color: string) => css`
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: ${designTokens.borderRadius.full};
    background: ${color}15;
    color: ${color};
  `,
  stepTitle: css`
    font-size: ${designTokens.typography.fontSize.sm};
    font-weight: ${designTokens.typography.fontWeight.semibold};
    color: var(--text-primary);
    margin: 0;
  `,
  stepDesc: css`
    font-size: ${designTokens.typography.fontSize.xs};
    color: var(--text-secondary);
    line-height: 1.4;
    margin: 0;
  `,
};

export default function SpendOsConsentFlow({ appId, onConsent }: SpendOsConsentFlowProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleConsentClick = async () => {
    setIsLoading(true);
    try {
      await onConsent();
    } catch (error) {
      console.error('Consent flow error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card variant="elevated" padding="lg">
      <div css={css`display: flex; flex-direction: column; gap: ${designTokens.spacing[6]};`}>
        <div>
          <div css={css`display: flex; align-items: center; gap: ${designTokens.spacing[3]}; margin-bottom: ${designTokens.spacing[2]};`}>
            <Lock size={24} color={designTokens.colors.primary[600]} />
            <h3 css={css`margin: 0; font-size: ${designTokens.typography.fontSize.xl}; color: var(--text-primary);`}>
              OWS Wallet Authorization
            </h3>
            <Badge variant="secondary" size="sm">Consent Required</Badge>
          </div>
          <p css={css`margin: 0; font-size: ${designTokens.typography.fontSize.sm}; color: var(--text-secondary); line-height: 1.5;`}>
            Grant permission for a governed agent to request wallet actions under explicit policy controls
          </p>
        </div>

        <div css={styles.section}>
          <h4 css={styles.sectionTitle}>What you're authorizing</h4>
          <ul css={styles.list} aria-label="Permissions being granted">
            <li css={styles.listItem}>
              <span css={styles.iconWrapper(designTokens.colors.semantic.success[600])}>
                <DollarSign size={16} />
              </span>
              <span>Request wallet-backed spend actions</span>
            </li>
            <li css={styles.listItem}>
              <span css={styles.iconWrapper(designTokens.colors.primary[600])}>
                <BarChart3 size={16} />
              </span>
              <span>Use scoped agent credentials for execution</span>
            </li>
            <li css={styles.listItem}>
              <span css={styles.iconWrapper(designTokens.colors.semantic.warning[600])}>
                <Shield size={16} />
              </span>
              <span>Enforce budget ceilings and vendor restrictions</span>
            </li>
            <li css={styles.listItem}>
              <span css={styles.iconWrapper(designTokens.colors.semantic.error[600])}>
                <Clock size={16} />
              </span>
              <span>Route high-risk actions into approval review</span>
            </li>
          </ul>
        </div>

        <div css={styles.section}>
          <h4 css={styles.sectionTitle}>Your protection</h4>
          <ul css={styles.list} aria-label="Protections in place">
            <li css={styles.listItem}>
              <span css={styles.iconWrapper(designTokens.colors.primary[600])}>
                <Lock size={16} />
              </span>
              <span>Non-custodial execution with explicit policy boundaries</span>
            </li>
            <li css={styles.listItem}>
              <span css={styles.iconWrapper(designTokens.colors.semantic.success[600])}>
                <ClipboardList size={16} />
              </span>
              <span>Policy-enforced spending limits and chain restrictions</span>
            </li>
            <li css={styles.listItem}>
              <span css={styles.iconWrapper(designTokens.colors.neutral[600])}>
                <Eye size={16} />
              </span>
              <span>Complete audit trail for every attempted action</span>
            </li>
            <li css={styles.listItem}>
              <span css={styles.iconWrapper(designTokens.colors.semantic.warning[600])}>
                <Zap size={16} />
              </span>
              <span>Revoke or rotate scoped access anytime</span>
            </li>
          </ul>
        </div>

        <div css={styles.section}>
          <h4 css={styles.sectionTitle}>Execution Details</h4>
          <Card variant="default" padding="md">
            <div css={styles.details}>
              <div css={styles.detailRow}>
                <span css={styles.detailLabel}>App ID</span>
                <span css={styles.detailValue}>{appId}</span>
              </div>
              <div css={styles.detailRow}>
                <span css={styles.detailLabel}>App Name</span>
                <span css={styles.detailValue}>Cognivern SpendOS Agent</span>
              </div>
              <div css={styles.detailRow}>
                <span css={styles.detailLabel}>Framework</span>
                <span css={styles.detailValue}>OWS + Cognivern</span>
              </div>
              <div css={styles.detailRow}>
                <span css={styles.detailLabel}>Chains</span>
                <Badge variant="outline" size="sm">Ethereum</Badge>
                <span css={css`display: flex; gap: ${designTokens.spacing[1]};`}>
                  <Badge variant="outline" size="sm">Polygon</Badge>
                  <Badge variant="outline" size="sm">Arbitrum</Badge>
                  <Badge variant="outline" size="sm">Base</Badge>
                </span>
              </div>
            </div>
          </Card>
        </div>

        <div>
          <div css={styles.warningBox} role="alert">
            <AlertTriangle size={20} color={designTokens.colors.semantic.warning[600]} />
            <p css={styles.warningText}>
              You will be redirected to the wallet authorization flow. Review the requested scope
              before allowing the agent to act.
            </p>
          </div>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleConsentClick}
            disabled={isLoading}
            isLoading={isLoading}
            leftIcon={isLoading ? undefined : <Rocket size={18} />}
          >
            {isLoading ? 'Redirecting...' : 'Authorize OWS Agent'}
          </Button>

          <div css={styles.footer}>
            <p css={styles.footerText}>
              By clicking "Authorize", you'll review the exact permissions, limits, and approval
              semantics attached to this agent.
            </p>
          </div>
        </div>

        <div css={styles.section}>
          <h4 css={styles.sectionTitle}>Authorization Process</h4>
          <div css={styles.steps}>
            <div css={styles.step}>
              <div css={styles.stepIcon(designTokens.colors.primary[600])}>
                <Eye size={20} />
              </div>
              <h5 css={styles.stepTitle}>Review Permissions</h5>
              <p css={styles.stepDesc}>Check what the agent can do on your behalf</p>
            </div>
            <div css={styles.step}>
              <div css={styles.stepIcon(designTokens.colors.semantic.warning[600])}>
                <Settings size={20} />
              </div>
              <h5 css={styles.stepTitle}>Set Policies</h5>
              <p css={styles.stepDesc}>Configure budgets, restrictions, and approvals</p>
            </div>
            <div css={styles.step}>
              <div css={styles.stepIcon(designTokens.colors.semantic.success[600])}>
                <UserCheck size={20} />
              </div>
              <h5 css={styles.stepTitle}>Grant Consent</h5>
              <p css={styles.stepDesc}>Authorize the agent with scoped wallet access</p>
            </div>
            <div css={styles.step}>
              <div css={styles.stepIcon(designTokens.colors.neutral[600])}>
                <Activity size={20} />
              </div>
              <h5 css={styles.stepTitle}>Monitor Decisions</h5>
              <p css={styles.stepDesc}>Review approvals, holds, denials, and audit evidence</p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
