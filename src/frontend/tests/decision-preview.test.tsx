import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DecisionPreview } from '@/components/governance/decision-preview';

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
});
