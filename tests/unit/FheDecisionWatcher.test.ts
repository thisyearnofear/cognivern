import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockPollOutcome = vi.fn();
vi.mock('../../src/backend/services/FheThresholdClient.js', () => ({
  FheThresholdClient: vi.fn().mockImplementation(() => ({
    pollOutcome: mockPollOutcome,
  })),
  sharedFheThresholdClient: {
    pollOutcome: mockPollOutcome,
  },
}));

const mockResolveDecision = vi.fn();
const mockGetPendingDecisions = vi.fn();
const mockClearPendingDecision = vi.fn();

vi.mock('../../src/backend/services/FhenixPolicyService.js', () => ({
  FhenixPolicyService: vi.fn().mockImplementation(() => ({
    resolveDecision: mockResolveDecision,
    getPendingDecisions: mockGetPendingDecisions,
    clearPendingDecision: mockClearPendingDecision,
  })),
  sharedFhenixPolicyService: {
    resolveDecision: mockResolveDecision,
    getPendingDecisions: mockGetPendingDecisions,
    clearPendingDecision: mockClearPendingDecision,
  },
}));

async function createWatcher(config: Record<string, unknown> = {}) {
  vi.resetModules();
  const mod = await import('../../src/backend/services/FheDecisionWatcher.js');
  return new mod.FheDecisionWatcher(undefined, undefined, config);
}

describe('FheDecisionWatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPendingDecisions.mockReturnValue(new Map());
    mockResolveDecision.mockResolvedValue('0xtxhash');
    mockPollOutcome.mockResolvedValue({ outcome: 'approve' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('lifecycle', () => {
    it('does not start when disabled', async () => {
      const watcher = await createWatcher({ enabled: false });
      watcher.start();
      expect(watcher.isRunning()).toBe(false);
    });

    it('starts and stops correctly when enabled', async () => {
      const watcher = await createWatcher({ enabled: true, pollIntervalMs: 100 });
      expect(watcher.isRunning()).toBe(false);

      watcher.start();
      expect(watcher.isRunning()).toBe(true);

      watcher.stop();
      expect(watcher.isRunning()).toBe(false);
    });

    it('prevents double-start', async () => {
      const watcher = await createWatcher({ enabled: true, pollIntervalMs: 100 });
      watcher.start();
      watcher.start(); // should be no-op
      expect(watcher.isRunning()).toBe(true);
      watcher.stop();
    });
  });

  describe('getPendingCount', () => {
    it('returns 0 when no pending decisions', async () => {
      const watcher = await createWatcher({ enabled: true });
      expect(watcher.getPendingCount()).toBe(0);
    });

    it('returns correct count when pending decisions exist', async () => {
      const pending = new Map([
        ['0xdec1', { decisionId: '0xdec1', ctHash: 123n }],
        ['0xdec2', { decisionId: '0xdec2', ctHash: 456n }],
      ]);
      mockGetPendingDecisions.mockReturnValue(pending);

      const watcher = await createWatcher({ enabled: true });
      expect(watcher.getPendingCount()).toBe(2);
    });
  });

  describe('processPending', () => {
    it('skips when no pending decisions', async () => {
      const watcher = await createWatcher({ enabled: true });
      await watcher.processPending();

      expect(mockPollOutcome).not.toHaveBeenCalled();
      expect(mockResolveDecision).not.toHaveBeenCalled();
    });

    it('resolves pending decisions via threshold client', async () => {
      const pending = new Map([
        ['0xdec1', { decisionId: '0xdec1', ctHash: 123n, agentId: 'agent1', policyId: 'policy1' }],
      ]);
      mockGetPendingDecisions.mockReturnValue(pending);
      mockPollOutcome.mockResolvedValueOnce({ outcome: 'approve' });
      mockResolveDecision.mockResolvedValueOnce('0xtxhash');

      const watcher = await createWatcher({ enabled: true });
      await watcher.processPending();

      expect(mockPollOutcome).toHaveBeenCalledWith('0xdec1', 123n);
      expect(mockResolveDecision).toHaveBeenCalledWith('0xdec1', 'approve');
      expect(mockClearPendingDecision).toHaveBeenCalledWith('0xdec1');
    });

    it('handles multiple pending decisions', async () => {
      const pending = new Map([
        ['0xdec1', { decisionId: '0xdec1', ctHash: 123n }],
        ['0xdec2', { decisionId: '0xdec2', ctHash: 456n }],
      ]);
      mockGetPendingDecisions.mockReturnValue(pending);
      mockPollOutcome
        .mockResolvedValueOnce({ outcome: 'approve' })
        .mockResolvedValueOnce({ outcome: 'hold' });
      mockResolveDecision
        .mockResolvedValueOnce('0xtx1')
        .mockResolvedValueOnce('0xtx2');

      const watcher = await createWatcher({ enabled: true });
      await watcher.processPending();

      expect(mockPollOutcome).toHaveBeenCalledTimes(2);
      expect(mockResolveDecision).toHaveBeenCalledTimes(2);
      expect(mockClearPendingDecision).toHaveBeenCalledTimes(2);
    });

    it('retries when threshold client returns null', async () => {
      const pending = new Map([
        ['0xdec1', { decisionId: '0xdec1', ctHash: 123n }],
      ]);
      mockGetPendingDecisions.mockReturnValue(pending);
      mockPollOutcome.mockResolvedValueOnce(null);

      const watcher = await createWatcher({ enabled: true });
      await watcher.processPending();

      expect(mockPollOutcome).toHaveBeenCalled();
      expect(mockResolveDecision).not.toHaveBeenCalled();
      expect(mockClearPendingDecision).not.toHaveBeenCalled();
    });

    it('continues processing when one decision fails', async () => {
      const pending = new Map([
        ['0xdec1', { decisionId: '0xdec1', ctHash: 123n }],
        ['0xdec2', { decisionId: '0xdec2', ctHash: 456n }],
      ]);
      mockGetPendingDecisions.mockReturnValue(pending);
      mockPollOutcome
        .mockResolvedValueOnce({ outcome: 'approve' })
        .mockResolvedValueOnce({ outcome: 'deny' });
      mockResolveDecision
        .mockRejectedValueOnce(new Error('tx failed'))
        .mockResolvedValueOnce('0xtx2');

      const watcher = await createWatcher({ enabled: true });
      await watcher.processPending();

      expect(mockResolveDecision).toHaveBeenCalledTimes(2);
      expect(mockClearPendingDecision).toHaveBeenCalledTimes(1);
      expect(mockClearPendingDecision).toHaveBeenCalledWith('0xdec2');
    });

    it('prevents concurrent processPending calls', async () => {
      const pending = new Map([
        ['0xdec1', { decisionId: '0xdec1', ctHash: 123n }],
      ]);
      mockGetPendingDecisions.mockReturnValue(pending);
      mockPollOutcome.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ outcome: 'approve' }), 10)),
      );

      const watcher = await createWatcher({ enabled: true });

      // Fire two processPending calls concurrently
      const p1 = watcher.processPending();
      const p2 = watcher.processPending();

      await Promise.all([p1, p2]);

      // Should only process once due to the processing guard
      expect(mockPollOutcome).toHaveBeenCalledTimes(1);
    });
  });

  describe('interval polling', () => {
    it('polls at configured interval when running', async () => {
      vi.useFakeTimers();
      const pending = new Map([
        ['0xdec1', { decisionId: '0xdec1', ctHash: 123n }],
      ]);
      mockGetPendingDecisions.mockReturnValue(pending);
      mockPollOutcome.mockResolvedValue({ outcome: 'approve' });
      mockResolveDecision.mockResolvedValue('0xtxhash');

      const watcher = await createWatcher({ enabled: true, pollIntervalMs: 1000 });
      watcher.start();

      // First poll
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockPollOutcome).toHaveBeenCalledTimes(1);

      // Second poll
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockPollOutcome).toHaveBeenCalledTimes(2);

      watcher.stop();
      vi.useRealTimers();
    });
  });
});
