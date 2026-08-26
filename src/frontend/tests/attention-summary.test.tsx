import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AttentionSummary } from '@/components/ui/attention-summary';

describe('AttentionSummary', () => {
  it('renders attention counts as actionable chips when onClick is provided', () => {
    const onHeld = vi.fn();
    const onStopped = vi.fn();
    render(
      <AttentionSummary
        tone="attention"
        title="Needs your attention"
        description="Review held decisions and stopped outcomes."
        items={[
          { label: 'held', count: 2, onClick: onHeld },
          { label: 'stopped', count: 1, onClick: onStopped },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Review 2 held decisions' }));
    expect(onHeld).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Review 1 stopped decision' }));
    expect(onStopped).toHaveBeenCalledTimes(1);
  });

  it('renders plain chips when no onClick is provided', () => {
    render(
      <AttentionSummary
        tone="attention"
        title="Needs your attention"
        description="Review held decisions."
        items={[{ label: 'held', count: 2 }]}
      />,
    );

    expect(screen.getByText('2 held')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /review/i })).toBeNull();
  });

  it('keeps the primary action button working alongside clickable chips', () => {
    const onAction = vi.fn();
    render(
      <AttentionSummary
        tone="attention"
        title="Needs your attention"
        description="Review decisions."
        items={[{ label: 'held', count: 1, onClick: () => {} }]}
        action={{ label: 'Review decisions', onClick: onAction }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /review decisions/i }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});