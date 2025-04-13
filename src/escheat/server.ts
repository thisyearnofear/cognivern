import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import axios, { AxiosError } from 'axios';
import { config } from './config.js';
import logger from './utils/logger.js';
import { validateApiKey } from './middleware/auth.js';
import { AgentService } from './services/AgentService.js';
import { PolicyService } from './services/PolicyService.js';
import { MetricsService } from '../services/MetricsService.js';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { testnet } from '@recallnet/chains';
import { RecallClient } from '@recallnet/sdk/client';
import { MetricsPeriod } from '../types/Metrics.js';

// Custom error class for API errors
class APIError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'APIError';
  }
}

const app = express();
const agentService = new AgentService();
const policyService = new PolicyService();

// Initialize Recall client and metrics service
const privateKey = `0x${config.RECALL_PRIVATE_KEY}` as `0x${string}`;
const walletClient = createWalletClient({
  account: privateKeyToAccount(privateKey),
  chain: testnet,
  transport: http(),
});
const recall = new RecallClient({ walletClient });
const metricsService = new MetricsService(recall, config.RECALL_BUCKET_ADDRESS as `0x${string}`);

// Trust proxy for rate limiting
app.set('trust proxy', 1);

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
const healthCheck: RequestHandler = (req, res) => {
  res.json({ status: 'ok' });
};
app.get('/health', healthCheck);

// Protected routes
const protectedRouter = express.Router();
protectedRouter.use(validateApiKey);

// Test endpoint
protectedRouter.get('/test', (req: Request, res: Response) => {
  res.json({
    message: 'API is working!',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
  });
});

// Agent Management Endpoints
const createAgent: RequestHandler = async (req, res, next) => {
  try {
    const { name, type, capabilities } = req.body;

    if (!name || !type || !capabilities || !Array.isArray(capabilities)) {
      throw new APIError(400, 'Bad Request', {
        message: 'Missing required fields: name, type, and capabilities array',
      });
    }

    logger.info('Creating agent with data:', { name, type, capabilities });
    const agent = await agentService.createAgent(name, type, capabilities);
    res.status(201).json({
      message: 'Agent created successfully',
      agent,
    });
  } catch (error) {
    next(error);
  }
};

const listAgents: RequestHandler = async (req, res, next) => {
  try {
    const agents = await agentService.listAgents();
    res.json({ agents });
  } catch (error) {
    next(error);
  }
};

const getAgent: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const agent = await agentService.getAgent(id);

    if (!agent) {
      throw new APIError(404, `Agent ${id} not found`);
    }

    res.json(agent);
  } catch (error) {
    next(error);
  }
};

// Governance Policy Endpoints
const createPolicy: RequestHandler = async (req, res, next) => {
  try {
    const { name, description, rules } = req.body;

    if (!name || !description || !rules || !Array.isArray(rules)) {
      throw new APIError(400, 'Bad Request', {
        message: 'Missing required fields: name, description, and rules array',
      });
    }

    const policy = await policyService.createPolicy(name, description, rules);
    res.status(201).json({
      message: 'Policy created successfully',
      policy,
    });
  } catch (error) {
    next(error);
  }
};

const listPolicies: RequestHandler = async (req, res, next) => {
  try {
    const policies = await policyService.listPolicies();
    res.json({ policies });
  } catch (error) {
    next(error);
  }
};

// Metrics Endpoints
const getMetrics: RequestHandler = (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    system: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    },
    performance: {
      responseTime: 150,
      successRate: 98,
      errorRate: 2,
    },
    compliance: {
      policyViolations: 0,
      auditScore: 100,
    },
  });
};

const getAgentMetrics: RequestHandler = async (req, res) => {
  try {
    const agents = await agentService.listAgents();
    res.json({
      timestamp: new Date().toISOString(),
      agents: agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        metrics: agent.metrics,
      })),
    });
  } catch (error) {
    logger.error('Error getting agent metrics:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get agent metrics',
    });
  }
};

const getDailyMetrics: RequestHandler = async (req, res, next) => {
  try {
    const metrics = await metricsService.getMetrics(MetricsPeriod.DAILY);
    res.json(metrics);
  } catch (error) {
    next(error);
  }
};

// Register routes
protectedRouter.post('/agents', createAgent);
protectedRouter.get('/agents', listAgents);
protectedRouter.get('/agents/:id', getAgent);
protectedRouter.post('/policies', createPolicy);
protectedRouter.get('/policies', listPolicies);
protectedRouter.get('/metrics', getMetrics);
protectedRouter.get('/metrics/agents', getAgentMetrics);
protectedRouter.get('/metrics/daily', getDailyMetrics);

// Mount protected routes
app.use('/api', protectedRouter);

// Error handling middleware
const errorHandler = (
  err: Error | APIError | AxiosError,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  logger.error('Error:', err);

  if (err instanceof APIError) {
    return res.status(err.statusCode).json({
      error: err.message,
      details: err.details,
    });
  }

  if (axios.isAxiosError(err)) {
    const status = err.response?.status || 500;
    const message = err.response?.data?.message || err.message;
    return res.status(status).json({
      error: 'External API Error',
      message:
        config.NODE_ENV === 'development' ? message : 'An error occurred with an external service',
    });
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: config.NODE_ENV === 'development' ? err.message : undefined,
  });
};

app.use(errorHandler);

// Start server
const startServer = () => {
  const port = config.PORT;
  app.listen(port, () => {
    logger.info(`Server running on port ${port}`);
  });
};

export { app, startServer };
