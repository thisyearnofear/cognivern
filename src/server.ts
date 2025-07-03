import express from "express";
import cors from "cors";
import { dependencyContainer } from "./infrastructure/config/dependencyInjection.js";
import { configureRoutes } from "./presentation/rest/routes/index.js";

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Configure middleware
app.use(cors());
app.use(express.json());

// Get all controllers from the dependency container
const controllers = dependencyContainer.getAllControllers();

// Configure API routes
const apiRouter = configureRoutes(controllers);

// Mount API routes at /api
app.use("/api", apiRouter);

// Basic health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Server is running" });
});

// Error handling middleware
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error(err.stack);
    res.status(500).json({
      error: "Internal Server Error",
      message: err.message,
    });
  }
);

/**
 * Start the server and listen on configured port
 */
export function startServer() {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`API endpoint: http://localhost:${PORT}/api/policies`);
  });
}

// Export app for testing purposes
export default app;
