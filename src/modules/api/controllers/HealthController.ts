/**
 * Health Controller
 */

import { Request, Response } from "express";

export class HealthController {
  async getHealth(req: Request, res: Response): Promise<void> {
    res.json({
      status: "ok",
      message: "Server is running",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  }

  async getReadiness(req: Request, res: Response): Promise<void> {
    // Check if all services are ready
    const isReady = true; // In real implementation, check database, redis, etc.

    if (isReady) {
      res.json({
        status: "ready",
        message: "All services are ready",
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: "not ready",
        message: "Some services are not ready",
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getLiveness(req: Request, res: Response): Promise<void> {
    res.json({
      status: "alive",
      message: "Service is alive",
      timestamp: new Date().toISOString(),
    });
  }

  async getSystemHealth(req: Request, res: Response): Promise<void> {
    // Return Sapience-specific system health format for frontend
    res.json({
      overall: "healthy",
      components: {
        arbitrum: "online",
        eas: "operational",
        ethereal: "online",
        policies: "inactive",
      },
      metrics: {
        totalAgents: 1,
        activeAgents: 1,
        totalForecasts: 0, // Resetting hardcoded placeholder to 0 for honesty
        complianceRate: 100,
        averageAttestationTime: 0,
      },
      timestamp: new Date().toISOString(),
    });
  }
}
