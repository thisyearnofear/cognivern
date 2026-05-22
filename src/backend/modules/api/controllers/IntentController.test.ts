import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IntentController } from './IntentController';

describe('IntentController', () => {
  let controller: IntentController;

  beforeEach(() => {
    controller = new IntentController();
  });

  describe('getMetrics', () => {
    it('should return initial metrics with zero values', () => {
      const metrics = controller.getMetrics();

      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.circuitBreakerState).toBe('closed');
    });
  });

  describe('circuit breaker', () => {
    it('should transition to open state after threshold failures', async () => {
      // Simulate 3 consecutive failures
      for (let i = 0; i < 3; i++) {
        await controller.processIntent(
          { body: { query: 'test' } } as any,
          {
            status: () => ({ json: vi.fn() }),
            json: vi.fn(),
          } as any
        );
      }

      const metrics = controller.getMetrics();
      expect(metrics.circuitBreakerState).toBe('open');
    });

    it('should track total requests', async () => {
      await controller.processIntent(
        { body: { query: 'test' } } as any,
        {
          status: () => ({ json: vi.fn() }),
          json: vi.fn(),
        } as any
      );

      const metrics = controller.getMetrics();
      expect(metrics.totalRequests).toBe(1);
    });
  });

  describe('graceful fallback', () => {
    it('should return contextual fallback when AI is unavailable', async () => {
      // Force circuit breaker open by failing 3 times
      for (let i = 0; i < 3; i++) {
        await controller.processIntent(
          { body: { query: 'test' } } as any,
          {
            status: () => ({ json: vi.fn() }),
            json: vi.fn(),
          } as any
        );
      }

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await controller.processIntent(
        { body: { query: 'show my portfolio' } } as any,
        mockRes as any
      );

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            _fallback: true,
            response: expect.stringContaining('temporarily unavailable'),
          }),
        })
      );
    });
  });
});
