import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  decisionNodeId,
  scrollDecisionIntoView,
} from '@/lib/deep-link';

describe('deep-link', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('derives a stable DOM id from a decision id', () => {
    expect(decisionNodeId('log-123')).toBe('decision-log-123');
  });

  it('scrolls to the node when it exists', () => {
    const node = document.createElement('div');
    node.id = decisionNodeId('log-123');
    document.body.appendChild(node);
    const scrollIntoView = vi.fn();
    node.scrollIntoView = scrollIntoView;

    const found = scrollDecisionIntoView('log-123');

    expect(found).toBe(true);
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
    });
  });

  it('returns false and does not throw when the node is missing', () => {
    expect(scrollDecisionIntoView('missing')).toBe(false);
  });
});