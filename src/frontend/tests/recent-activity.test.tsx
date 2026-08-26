import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import type { DecisionFilter } from '@/components/dashboard/decision-chart';

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

function renderActivity(filter: DecisionFilter = null) {
  return render(
    <RecentActivity
      loading={false}
      error={false}
      items={[
        {
          id: '1',
          agent: 'alice',
          action: 'swap 100 USDC',
          amount: '$100',
          time: 'now',
          status: 'held',
        },
      ]}
      totalCount={1}
      decisionFilter={filter}
      onClearFilter={() => {}}
      onRetry={() => {}}
    />,
  );
}

describe('RecentActivity', () => {
  beforeEach(() => pushMock.mockReset());

  it('navigates to /audit with the active decision filter preserved', () => {
    renderActivity('held');
    fireEvent.click(screen.getByRole('button', { name: /view held/i }));
    expect(pushMock).toHaveBeenCalledWith('/audit?status=held');
  });

  it('labels the audit link with the stopped vocabulary for denied', () => {
    renderActivity('denied');
    fireEvent.click(screen.getByRole('button', { name: /view stopped/i }));
    expect(pushMock).toHaveBeenCalledWith('/audit?status=denied');
  });

  it('navigates to /audit without a filter when none is active', () => {
    renderActivity(null);
    fireEvent.click(screen.getByRole('button', { name: /view all/i }));
    expect(pushMock).toHaveBeenCalledWith('/audit');
  });

  it('deep-links a row click to the specific decision in Audit', () => {
    renderActivity(null);
    fireEvent.click(screen.getByRole('button', { name: /alice/i }));
    expect(pushMock).toHaveBeenCalledWith('/audit?id=1');
  });
});