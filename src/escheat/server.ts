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
import { TestAgentService } from './services/TestAgentService.js';
import { PolicyEnforcementService } from '../services/PolicyEnforcementService.js';
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

// Create the Recall client with explicit testnet configuration
const recall = new RecallClient({
  walletClient,
});

// Log bucket information for debugging
const bucketAddress = config.RECALL_BUCKET_ADDRESS as `0x${string}`;
logger.info('Initializing connection to Recall bucket', {
  bucketAddress,
  network: config.RECALL_NETWORK,
  account: walletClient.account.address,
  chainId: testnet.id,
});

// Check if the bucket exists by listing all buckets
(async () => {
  try {
    const bucketManager = recall.bucketManager();
    const { result: buckets } = await bucketManager.list();
    const foundBucket = buckets.find((b) => b.addr.toLowerCase() === bucketAddress.toLowerCase());

    if (foundBucket) {
      logger.info('Found bucket in account list', {
        bucketAddress,
        metadata: foundBucket.metadata,
      });
    } else {
      logger.warn('Bucket not found in account list', {
        bucketAddress,
        availableBuckets: buckets.map((b) => b.addr),
      });
    }
  } catch (error) {
    logger.error('Error checking bucket existence', {
      error: error instanceof Error ? error.message : 'Unknown error',
      bucketAddress,
    });
  }
})();

// Initialize PolicyEnforcementService with Recall client
const policyEnforcementService = new PolicyEnforcementService(recall, bucketAddress);

// Initialize metrics service with proper bucket info
const metricsService = new MetricsService(recall, bucketAddress);

// Initialize TestAgentService
const testAgentService = new TestAgentService(
  metricsService,
  policyEnforcementService,
  recall,
  bucketAddress,
);

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

// Debug endpoint for Recall bucket
protectedRouter.get('/debug/bucket', async (req: Request, res: Response) => {
  try {
    const bucketManager = recall.bucketManager();
    const result: Record<string, any> = {};

    // Helper to handle BigInt in JSON serialization
    const replaceBigInts = (key: string, value: any) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    };

    try {
      // Try to list all buckets
      logger.info('Listing all buckets');
      const listResult = await bucketManager.list();
      result.buckets = listResult.result;
    } catch (error) {
      result.bucketListError = error instanceof Error ? error.message : 'Unknown error';
    }

    try {
      // Try to query the configured bucket
      logger.info('Querying bucket', { bucketAddress });
      const queryResult = await bucketManager.query(bucketAddress, {});
      result.bucketQuery = {
        objectCount: queryResult.result.objects.length,
        objectKeys: queryResult.result.objects.map((obj) => obj.key),
      };
    } catch (error) {
      result.bucketQueryError = error instanceof Error ? error.message : 'Unknown error';
    }

    try {
      // Try to query with metrics prefix
      logger.info('Querying metrics prefix', { bucketAddress });
      const metricsQuery = await bucketManager.query(bucketAddress, {
        prefix: 'metrics/',
      });
      result.metricsQuery = {
        objectCount: metricsQuery.result.objects.length,
        objectKeys: metricsQuery.result.objects.map((obj) => obj.key),
      };

      // If we found metrics objects, try to get one
      if (metricsQuery.result.objects.length > 0) {
        try {
          const sampleKey = metricsQuery.result.objects[0].key;
          logger.info('Retrieving sample metric object', { bucketAddress, key: sampleKey });
          const objectResult = await bucketManager.get(bucketAddress, sampleKey);
          const value = new TextDecoder().decode(objectResult.result);
          result.sampleMetricValue = JSON.parse(value);
        } catch (error) {
          result.sampleMetricError = error instanceof Error ? error.message : 'Unknown error';
          logger.error('Error retrieving sample metric', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    } catch (error) {
      result.metricsQueryError = error instanceof Error ? error.message : 'Unknown error';
    }

    // Use manual JSON serialization with replacer
    const responseBody = {
      timestamp: new Date().toISOString(),
      bucketAddress,
      clientAddress: walletClient.account.address,
      results: result,
    };

    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(responseBody, replaceBigInts));
  } catch (error) {
    logger.error('Error in debug endpoint', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).json({
      error: 'Debug endpoint failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
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
    logger.info('Fetching daily metrics from bucket', { bucketAddress });

    // First try to query the bucket to make sure it exists
    const bucketManager = recall.bucketManager();
    try {
      // Simplify the query to list all objects first
      logger.info('Attempting to list all objects in bucket', { bucketAddress });
      const queryResult = await bucketManager.query(bucketAddress, {});

      logger.info('Bucket query successful', {
        objects: queryResult.result.objects.length,
        objectKeys: queryResult.result.objects.map((obj) => obj.key),
        bucketAddress,
      });

      // Now try with the metrics prefix
      const metricsQuery = await bucketManager.query(bucketAddress, {
        prefix: 'metrics/',
      });

      logger.info('Metrics query successful', {
        objects: metricsQuery.result.objects.length,
        objectKeys: metricsQuery.result.objects.map((obj) => obj.key),
        bucketAddress,
      });
    } catch (bucketError) {
      logger.error('Error querying bucket', {
        error: bucketError instanceof Error ? bucketError.message : 'Unknown error',
        bucketAddress,
      });

      // Still try to get metrics from service, which might have a fallback
    }

    const metrics = await metricsService.getMetrics(MetricsPeriod.DAILY);
    res.json(metrics);
  } catch (error) {
    logger.error('Error fetching metrics', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // If we fail, return some sample metrics data so the UI can still show something
    res.json({
      timestamp: new Date().toISOString(),
      period: MetricsPeriod.DAILY,
      data: {
        actions: {
          total: 0,
          successful: 0,
          failed: 0,
          blocked: 0,
        },
        policies: {
          total: 0,
          violations: 0,
          enforced: 0,
        },
        performance: {
          averageResponseTime: 0,
          p95ResponseTime: 0,
          maxResponseTime: 0,
        },
        resources: {
          cpuUsage: 0,
          memoryUsage: 0,
          storageUsage: 0,
        },
      },
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
protectedRouter.get('/metrics/daily', getDailyMetrics);

// Agent test endpoints
const runAgentTestScenario: RequestHandler = async (req, res, next) => {
  try {
    const { scenario } = req.params;
    logger.info(`Running agent test scenario: ${scenario}`);

    let result;

    switch (scenario) {
      case 'standard':
        result = await testAgentService.runStandardAction();
        break;
      case 'unauthorized':
        result = await testAgentService.runUnauthorizedAction();
        break;
      case 'high-load':
        result = await testAgentService.runHighLoadTest();
        break;
      case 'resource-intensive':
        result = await testAgentService.runResourceIntensiveAction();
        break;
      case 'gemini-query':
        result = await testAgentService.runGeminiQuery();
        break;
      default:
        throw new APIError(400, `Unknown test scenario: ${scenario}`);
    }

    res.status(200).json(result);
  } catch (error) {
    logger.error('Error running test scenario', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    next(error);
  }
};

protectedRouter.post('/agents/test/:scenario', runAgentTestScenario);

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
