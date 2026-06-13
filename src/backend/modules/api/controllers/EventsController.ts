import { Request, Response } from "express";
import { eventBus } from "../../../services/EventBus.js";

export class EventsController {
  async streamEvents(req: Request, res: Response): Promise<void> {
    const workspaceId = req.workspaceId;
    if (!workspaceId) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const conn = { res, workspaceId };
    eventBus.addConnection(workspaceId, conn);

    const heartbeat = setInterval(() => {
      try {
        res.write(": heartbeat\n\n");
      } catch {
        clearInterval(heartbeat);
        eventBus.removeConnection(conn);
      }
    }, 25_000);

    req.on("close", () => {
      clearInterval(heartbeat);
      eventBus.removeConnection(conn);
    });
  }
}
