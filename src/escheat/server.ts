import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import logger from './utils/logger.js';
import { validateApiKey } from './middleware/auth.js';

const app = express();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: config.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  }),
);

// Rate limiting
const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// Request parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Compression
app.use(compression());

// Logging
app.use(
  morgan('combined', {
    stream: {
      write: (message: string) => logger.info(message.trim()),
    },
  }),
);

// Health check endpoint (no auth required)
app.get('/health', (req: express.Request, res: express.Response) => {
  res.json({ status: 'ok' });
});

// Protected routes
const protectedRouter = express.Router();
protectedRouter.use(validateApiKey);

// Test endpoint
protectedRouter.get('/test', (req: express.Request, res: express.Response) => {
  res.json({
    message: 'API is working!',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
  });
});

// Add your protected routes here
// Example: protectedRouter.get('/api/data', (req, res) => { ... });

// Mount protected routes
app.use('/api', protectedRouter);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: config.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
const startServer = () => {
  const port = config.PORT;
  app.listen(port, () => {
    logger.info(`Server running on port ${port}`);
  });
};

export { app, startServer };
