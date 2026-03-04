/**
 * Metrics Controller
 */

import { Request, Response } from "express";

type UxEvent = {
  id: string;
  eventType: string;
  timestamp: string;
  payload: Record<string, unknown>;
};

const UX_EVENT_LIMIT = 1000;

export class MetricsController {
  private static uxEvents: UxEvent[] = [];

  private pushUxEvent(event: UxEvent) {
    MetricsController.uxEvents.push(event);
    if (MetricsController.uxEvents.length > UX_EVENT_LIMIT) {
      MetricsController.uxEvents = MetricsController.uxEvents.slice(
        MetricsController.uxEvents.length - UX_EVENT_LIMIT
      );
    }
  }

  async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = {
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
        },
        agents: {
          total: 0,
          active: 0,
          inactive: 0,
        },
        trading: {
          totalTrades: 0,
          successfulTrades: 0,
          failedTrades: 0,
        },
      };

      res.json({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getDailyMetrics(req: Request, res: Response): Promise<void> {
    await this.getMetrics(req, res);
  }

  async getAgentMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const metrics = {
        agentId: id,
        performance: {
          totalReturn: 0,
          winRate: 0,
          sharpeRatio: 0,
        },
        trades: {
          total: 0,
          successful: 0,
          failed: 0,
        },
      };

      res.json({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  async postUxEvent(req: Request, res: Response): Promise<void> {
    try {
      const eventType =
        typeof req.body?.eventType === "string"
          ? req.body.eventType.slice(0, 100)
          : "";
      if (!eventType) {
        res.status(400).json({ success: false, error: "eventType is required" });
        return;
      }

      const payload =
        req.body?.payload && typeof req.body.payload === "object"
          ? (req.body.payload as Record<string, unknown>)
          : {};
      const timestamp =
        typeof req.body?.timestamp === "string"
          ? req.body.timestamp
          : new Date().toISOString();

      this.pushUxEvent({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        eventType,
        payload,
        timestamp,
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getUxSummary(req: Request, res: Response): Promise<void> {
    try {
      const events = MetricsController.uxEvents;
      const byType = events.reduce(
        (acc, event) => {
          acc[event.eventType] = (acc[event.eventType] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      const completionRate = (() => {
        const approvals =
          (byType["run_approval_approve"] || 0) +
          (byType["run_approval_reject"] || 0);
        const started = byType["run_console_view"] || 0;
        if (!started) return 0;
        return Number((approvals / started).toFixed(3));
      })();

      const retryRate = (() => {
        const retries =
          (byType["run_retry"] || 0) + (byType["run_retry_from_step"] || 0);
        const started = byType["run_console_view"] || 0;
        if (!started) return 0;
        return Number((retries / started).toFixed(3));
      })();

      res.json({
        success: true,
        data: {
          totalEvents: events.length,
          byType,
          rates: {
            completionRate,
            retryRate,
          },
          lastEventAt: events.length ? events[events.length - 1].timestamp : null,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        timestamp: new Date().toISOString(),
      });
    }
  }
}
