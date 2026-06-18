import { Router } from "express";
import type { EventsController } from "@backend/modules/api/controllers/EventsController.js";

export function createEventsRoutes(eventsController: EventsController): Router {
  const router = Router();

  router.get("/events/stream", (req, res) =>
    eventsController.streamEvents(req, res),
  );

  return router;
}
