import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DecisionPreview } from '@/components/governance/decision-preview';
import { decisionLabel, resolveDecision } from '@/lib/decision-language';

describe('DecisionPreview', () => {
  it.each([
    ['approved', 'Approved', 'This action is within the boundary'],
    ['held', 'Held for review', 'This action needs operator judgment before it can execute'],
    ['denied', 'Stopped', 'This action is outside the boundary'],
  ] as const)('renders the canonical %s outcome', (decision, label, blurb) => {
    render(
      <DecisionPreview
        decision={decision}
        reasoning="The policy result is recorded for review."
        amount={500}
      />,
    );

    expect(screen.getByRole('status', { name: `Decision: ${label}` })).toBeTruthy();
    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByText(blurb)).toBeTruthy();
    expect(screen.getByText('$500')).toBeTruthy();
    expect(screen.getByText('The policy result is recorded for review.')).toBeTruthy();
  });

  it('keeps backend denial values mapped to the user-facing stopped language', () => {
    expect(decisionLabel('denied')).toBe('Stopped');
    expect(resolveDecision('denied', false)).toBe('denied');
    expect(resolveDecision(undefined, true)).toBe('approved');
  });
});
