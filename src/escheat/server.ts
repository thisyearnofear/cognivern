import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import logger from './utils/logger.js';
import { validateApiKey } from './middleware/auth.js';
import { AgentService } from './services/AgentService.js';
import { PolicyService } from './services/PolicyService.js';

const app = express();
const agentService = new AgentService();
const policyService = new PolicyService();

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
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

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
const createAgent: RequestHandler = async (req, res) => {
  try {
    const { name, type, capabilities } = req.body;

    if (!name || !type || !capabilities || !Array.isArray(capabilities)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: name, type, and capabilities array',
      });
      return;
    }

    const agent = await agentService.createAgent(name, type, capabilities);
    res.status(201).json({
      message: 'Agent created successfully',
      agent,
    });
  } catch (error) {
    logger.error('Error creating agent:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create agent',
    });
  }
};

const listAgents: RequestHandler = async (req, res) => {
  try {
    const agents = await agentService.listAgents();
    res.json({ agents });
  } catch (error) {
    logger.error('Error listing agents:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to list agents',
    });
  }
};

const getAgent: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const agent = await agentService.getAgent(id);

    if (!agent) {
      res.status(404).json({
        error: 'Not Found',
        message: `Agent ${id} not found`,
      });
      return;
    }

    res.json(agent);
  } catch (error) {
    logger.error('Error getting agent:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get agent',
    });
  }
};

// Governance Policy Endpoints
const createPolicy: RequestHandler = async (req, res) => {
  try {
    const { name, description, rules } = req.body;

    if (!name || !description || !rules || !Array.isArray(rules)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: name, description, and rules array',
      });
      return;
    }

    const policy = await policyService.createPolicy(name, description, rules);
    res.status(201).json({
      message: 'Policy created successfully',
      policy,
    });
  } catch (error) {
    logger.error('Error creating policy:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create policy',
    });
  }
};

const listPolicies: RequestHandler = async (req, res) => {
  try {
    const policies = await policyService.listPolicies();
    res.json({ policies });
  } catch (error) {
    logger.error('Error listing policies:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to list policies',
    });
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

// Register routes
protectedRouter.post('/agents', createAgent);
protectedRouter.get('/agents', listAgents);
protectedRouter.get('/agents/:id', getAgent);
protectedRouter.post('/policies', createPolicy);
protectedRouter.get('/policies', listPolicies);
protectedRouter.get('/metrics', getMetrics);
protectedRouter.get('/metrics/agents', getAgentMetrics);

// Mount protected routes
app.use('/api', protectedRouter);

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
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
