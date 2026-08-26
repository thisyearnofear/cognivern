import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TimelineNode } from '@/components/audit/timeline-node';
import type { NormalizedAuditLog } from '@/lib/normalizers';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// permit-dialog → auth-fetch → session → auth → wagmi. wagmi/viem does not
// load under vitest, so stub the auth wrapper to keep the chain inert.
vi.mock('@/lib/auth-fetch', () => ({
  authFetch: vi.fn(),
}));

const HELD_RUN_LOG: NormalizedAuditLog = {
  id: 'run-abc',
  agent: 'Agent Alpha',
  action: 'swap',
  description: 'Swap 500 USDC for ETH',
  decision: 'held',
  chain: 'Ethereum',
  timestamp: '2026-08-26T12:00:00.000Z',
  time: 'now',
  latency: '45ms',
  policyChecks: [],
};

// Real run-mapped audit logs carry run-shaped fields (details/evidence).
const RAW_RUN_LOG = {
  id: 'run-abc',
  details: { stepCount: 4, artifactCount: 3 },
  outcome: 'held',
};

// Demo/synthetic logs have none of the run-shaped fields.
const RAW_DEMO_LOG = {
  id: 'log-001',
  agent: 'Alpha Trader',
  actionType: 'swap',
  outcome: 'held',
  latency: '39ms',
};

async function expandNode() {
  // The collapsed description toggles the node when clicked (bubbles to the
  // card's onClick), without hitting the status-dot button. The expand effect
  // schedules a timeline fetch; flush its setTimeout + promise resolution
  // inside act so the test ends without pending state updates.
  await act(async () => {
    fireEvent.click(screen.getByText(/Swap 500 USDC for ETH/i));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('TimelineNode run deep link', () => {
  beforeEach(() => {
    // The expand effect fetches the per-log timeline; keep it inert.
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { events: [] } }),
    });
  });

  it('links a run-backed decision to its execution record from the collapsed row', () => {
    render(<TimelineNode log={HELD_RUN_LOG} rawLog={RAW_RUN_LOG} index={0} />);

    const link = screen.getByRole('link', { name: /open run run-abc/i });
    expect(link.getAttribute('href')).toBe('/runs/run-abc');
  });

  it('keeps the expanded run card for run-backed decisions', async () => {
    render(<TimelineNode log={HELD_RUN_LOG} rawLog={RAW_RUN_LOG} index={0} />);
    await expandNode();

    const link = screen.getByRole('link', { name: /view run/i });
    expect(link.getAttribute('href')).toBe('/runs/run-abc');
  });

  it('does not link demo/synthetic decisions to a run', async () => {
    render(<TimelineNode log={HELD_RUN_LOG} rawLog={RAW_DEMO_LOG} index={0} />);
    await expandNode();

    expect(screen.queryByRole('link', { name: /view run/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /open run/i })).toBeNull();
  });
});