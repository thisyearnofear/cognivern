import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DecisionReceipt } from '@/components/ui/decision-receipt';

describe('DecisionReceipt', () => {
  it('renders the canonical lifecycle and evidence labels', () => {
    render(
      <DecisionReceipt
        decision="held"
        subject="swap · 500 USDC"
        summary="This action needs operator review."
        reference="Audit log-123"
        evidence={["Policy: spend-limit", "Distributed trace"]}
        timestamp="2026-08-26T12:00:00.000Z"
      />,
    );

    expect(screen.getByText('Decision receipt')).toBeTruthy();
    expect(screen.getAllByText('Held for review').length).toBeGreaterThan(0);
    expect(screen.getByRole('list', { name: 'Decision lifecycle' })).toBeTruthy();
    expect(screen.getByText('Request')).toBeTruthy();
    expect(screen.getByText('Policy')).toBeTruthy();
    expect(screen.getByText('Decision')).toBeTruthy();
    expect(screen.getByText('Evidence')).toBeTruthy();
    expect(screen.getByText('Record')).toBeTruthy();
    expect(screen.getByText('Evidence recorded')).toBeTruthy();
    expect(screen.getByText('Policy: spend-limit')).toBeTruthy();
    expect(screen.getByText('Distributed trace')).toBeTruthy();
    expect(screen.getByText('Audit log-123')).toBeTruthy();
  });

  it('renders an explicit empty evidence state', () => {
    render(
      <DecisionReceipt
        decision="approved"
        subject="transfer · 50 USDC"
        summary="Approved within policy."
        reference="Governance evaluation"
        evidence={[]}
      />,
    );

    expect(screen.getByText('No supporting evidence attached.')).toBeTruthy();
  });
});
