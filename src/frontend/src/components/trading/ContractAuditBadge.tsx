/** @jsxImportSource @emotion/react */
import React from 'react';
import { css } from '@emotion/react';
import { Shield, AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';
import { designTokens } from '../../styles/design-system';

export interface ContractAuditResult {
  address: string;
  decision: 'approve' | 'hold' | 'deny';
  score: number;
  safe: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  findingsCount: number;
  summary: string;
  findings?: Array<{
    title: string;
    description: string;
    severity: string;
  }>;
  error?: string;
  source?: 'chaingpt' | 'fallback' | 'cache';
}

interface ContractAuditBadgeProps {
  audit: ContractAuditResult;
  compact?: boolean;
}

const severityColors = {
  critical: { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' },
  high: { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
  medium: { bg: '#FEF9C3', text: '#854D0E', border: '#FDE047' },
  low: { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0' },
  informational: { bg: '#DBEAFE', text: '#1E40AF', border: '#BFDBFE' },
};

const decisionConfig = {
  approve: { icon: CheckCircle, color: '#059669', label: 'Approved', bg: '#D1FAE5' },
  hold: { icon: AlertTriangle, color: '#D97706', label: 'Hold', bg: '#FEF3C7' },
  deny: { icon: XCircle, color: '#DC2626', label: 'Denied', bg: '#FEE2E2' },
};

export const ContractAuditBadge: React.FC<ContractAuditBadgeProps> = ({ audit, compact = false }) => {
  if (audit.error) {
    return (
      <div css={css`
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: ${designTokens.colors.neutral[100]};
        border-radius: ${designTokens.borderRadius.md};
        font-size: ${designTokens.typography.fontSize.sm};
        color: ${designTokens.colors.neutral[600]};
      `}>
        <Info size={16} />
        <span>Audit unavailable</span>
      </div>
    );
  }

  const decision = decisionConfig[audit.decision];
  const severity = severityColors[audit.severity];
  const DecisionIcon = decision.icon;

  if (compact) {
    return (
      <div css={css`
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        background: ${decision.bg};
        border-radius: ${designTokens.borderRadius.full};
        font-size: ${designTokens.typography.fontSize.xs};
        font-weight: ${designTokens.typography.fontWeight.medium};
        color: ${decision.color};
      `}>
        <DecisionIcon size={14} />
        <span>{decision.label}</span>
        <span css={css`
          padding: 2px 6px;
          background: ${severity.bg};
          color: ${severity.text};
          border-radius: ${designTokens.borderRadius.sm};
          font-size: 10px;
        `}>
          {audit.score}/100
        </span>
      </div>
    );
  }

  return (
    <div css={css`
      background: white;
      border: 1px solid ${designTokens.colors.neutral[200]};
      border-radius: ${designTokens.borderRadius.lg};
      overflow: hidden;
    `}>
      {/* Header */}
      <div css={css`
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: ${decision.bg};
        border-bottom: 1px solid ${designTokens.colors.neutral[200]};
      `}>
        <div css={css`
          display: flex;
          align-items: center;
          gap: 8px;
        `}>
          <Shield size={20} color={decision.color} />
          <span css={css`
            font-weight: ${designTokens.typography.fontWeight.semibold};
            color: ${decision.color};
          `}>
            {audit.source === 'fallback' ? 'Security Analysis' : 'ChainGPT Security Audit'}
          </span>
          {audit.source === 'fallback' && (
            <span css={css`
              padding: 2px 6px;
              background: ${designTokens.colors.neutral[200]};
              color: ${designTokens.colors.neutral[600]};
              border-radius: ${designTokens.borderRadius.sm};
              font-size: 10px;
              font-weight: ${designTokens.typography.fontWeight.medium};
            `}>
              HEURISTIC
            </span>
          )}
        </div>
        <div css={css`
          display: flex;
          align-items: center;
          gap: 8px;
        `}>
          <DecisionIcon size={18} color={decision.color} />
          <span css={css`
            font-weight: ${designTokens.typography.fontWeight.bold};
            color: ${decision.color};
          `}>
            {decision.label}
          </span>
        </div>
      </div>

      {/* Score & Severity */}
      <div css={css`
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 12px 16px;
        background: ${designTokens.colors.neutral[50]};
      `}>
        <div css={css`
          display: flex;
          flex-direction: column;
          align-items: center;
        `}>
          <div css={css`
            width: 56px;
            height: 56px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: ${designTokens.typography.fontSize.xl};
            font-weight: ${designTokens.typography.fontWeight.bold};
            background: ${audit.score >= 70 ? '#D1FAE5' : audit.score >= 50 ? '#FEF9C3' : '#FEE2E2'};
            color: ${audit.score >= 70 ? '#059669' : audit.score >= 50 ? '#D97706' : '#DC2626'};
          `}>
            {audit.score}
          </div>
          <span css={css`
            font-size: ${designTokens.typography.fontSize.xs};
            color: ${designTokens.colors.neutral[500]};
            margin-top: 4px;
          `}>
            Score
          </span>
        </div>

        <div css={css`
          flex: 1;
        `}>
          <div css={css`
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
          `}>
            <span css={css`
              padding: 4px 8px;
              background: ${severity.bg};
              color: ${severity.text};
              border-radius: ${designTokens.borderRadius.sm};
              font-size: ${designTokens.typography.fontSize.xs};
              font-weight: ${designTokens.typography.fontWeight.medium};
              text-transform: uppercase;
            `}>
              {audit.severity}
            </span>
            <span css={css`
              font-size: ${designTokens.typography.fontSize.sm};
              color: ${designTokens.colors.neutral[600]};
            `}>
              {audit.findingsCount} finding{audit.findingsCount !== 1 ? 's' : ''}
            </span>
          </div>
          <p css={css`
            font-size: ${designTokens.typography.fontSize.sm};
            color: ${designTokens.colors.neutral[700]};
            margin: 0;
            line-height: 1.5;
          `}>
            {audit.summary}
          </p>
        </div>
      </div>

      {/* Findings */}
      {audit.findings && audit.findings.length > 0 && (
        <div css={css`
          padding: 12px 16px;
          border-top: 1px solid ${designTokens.colors.neutral[200]};
        `}>
          <h4 css={css`
            font-size: ${designTokens.typography.fontSize.sm};
            font-weight: ${designTokens.typography.fontWeight.semibold};
            color: ${designTokens.colors.neutral[700]};
            margin: 0 0 8px 0;
          `}>
            Key Findings
          </h4>
          <div css={css`
            display: flex;
            flex-direction: column;
            gap: 6px;
          `}>
            {audit.findings.slice(0, 3).map((finding, index) => (
              <div key={index} css={css`
                display: flex;
                align-items: flex-start;
                gap: 8px;
                padding: 8px;
                background: ${designTokens.colors.neutral[50]};
                border-radius: ${designTokens.borderRadius.sm};
              `}>
                <span css={css`
                  padding: 2px 6px;
                  background: ${severityColors[finding.severity as keyof typeof severityColors]?.bg || severityColors.informational.bg};
                  color: ${severityColors[finding.severity as keyof typeof severityColors]?.text || severityColors.informational.text};
                  border-radius: ${designTokens.borderRadius.sm};
                  font-size: 10px;
                  font-weight: ${designTokens.typography.fontWeight.medium};
                  text-transform: uppercase;
                  white-space: nowrap;
                `}>
                  {finding.severity}
                </span>
                <span css={css`
                  font-size: ${designTokens.typography.fontSize.sm};
                  color: ${designTokens.colors.neutral[700]};
                `}>
                  {finding.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Address */}
      <div css={css`
        padding: 8px 16px;
        background: ${designTokens.colors.neutral[50]};
        border-top: 1px solid ${designTokens.colors.neutral[200]};
        font-size: ${designTokens.typography.fontSize.xs};
        color: ${designTokens.colors.neutral[500]};
        font-family: monospace;
      `}>
        Contract: {audit.address}
      </div>
    </div>
  );
};

export default ContractAuditBadge;
