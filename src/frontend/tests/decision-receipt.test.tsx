import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DecisionReceipt } from '@/components/ui/decision-receipt';

function renderReceipt(decision: string) {
  return render(
    <DecisionReceipt
      decision={decision}
      subject="swap · 500 USDC"
      summary="A governed action."
      reference="Audit log-123"
      evidence={["Policy: spend-limit", "Distributed trace"]}
      timestamp="2026-08-26T12:00:00.000Z"
    />,
  );
}

describe('DecisionReceipt', () => {
  it('renders the canonical lifecycle and evidence labels', () => {
    renderReceipt('held');

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

  it('marks the decision and record steps as pending for held decisions', () => {
    renderReceipt('held');

    // The final outcome is not recorded yet — it awaits operator review.
    expect(screen.getByText('Awaiting operator review')).toBeTruthy();
    expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);
    expect(screen.queryByText('Reference recorded')).toBeNull();
  });

  it('marks the decision and record steps as blocked for stopped decisions', () => {
    renderReceipt('denied');

    expect(screen.getByText('Action stopped — not executed')).toBeTruthy();
    expect(screen.getAllByText('Blocked').length).toBeGreaterThan(0);
    expect(screen.queryByText('Reference recorded')).toBeNull();
  });

  it('keeps every step complete for approved decisions', () => {
    renderReceipt('approved');

    expect(screen.getByText('Reference recorded')).toBeTruthy();
    expect(screen.getAllByText('Complete').length).toBe(5);
    expect(screen.queryByText('Pending')).toBeNull();
    expect(screen.queryByText('Blocked')).toBeNull();
  });

  it('handles run statuses: paused_for_approval waits, failed stops', () => {
    const { unmount } = renderReceipt('paused_for_approval');
    expect(screen.getByText('Awaiting operator approval')).toBeTruthy();
    expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);
    unmount();

    renderReceipt('failed');
    expect(screen.getByText('Execution failed — review trace')).toBeTruthy();
    expect(screen.getAllByText('Blocked').length).toBeGreaterThan(0);
  });
});