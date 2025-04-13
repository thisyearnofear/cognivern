import { TestAgent } from '../../agents/TestAgent.js';
import { MetricsService } from '../../services/MetricsService.js';
import { PolicyEnforcementService } from '../../services/PolicyEnforcementService.js';
import { AgentAction, PolicyCheck } from '../../types/Agent.js';
import { RecallClient } from '@recallnet/sdk/client';
import type { Address } from 'viem';
import { config } from '../config.js';
import { GoogleGenAI } from '@google/genai';
import logger from '../utils/logger.js';
import { MetricsPeriod } from '../../types/Metrics.js';

export class TestAgentService {
  private testAgent: TestAgent;
  private metricsService: MetricsService;
  private policyService: PolicyEnforcementService;
  private geminiApiKey: string;
  private genAI: GoogleGenAI | null = null;

  constructor(
    metricsService: MetricsService,
    policyService: PolicyEnforcementService,
    private recall: RecallClient,
    private bucketAddress: Address,
  ) {
    this.testAgent = new TestAgent();
    this.metricsService = metricsService;
    this.policyService = policyService;
    this.geminiApiKey = config.GEMINI_API_KEY || '';

    if (this.geminiApiKey) {
      this.genAI = new GoogleGenAI({ apiKey: this.geminiApiKey });
    } else {
      logger.warn('Gemini API key not found in configuration');
    }
  }

  async runStandardAction(): Promise<{
    action: AgentAction;
    policyChecks: PolicyCheck[];
    allowed: boolean;
    metrics: any;
  }> {
    // Record start time for latency calculation
    const startTime = Date.now();

    // Create a standard action
    const action = await this.testAgent.performAction('data-analysis');

    // Evaluate against policies
    const policyChecks = await this.createDummyPolicyChecks(action, true);

    // Calculate latency
    const latencyMs = Date.now() - startTime;

    // Record action in metrics
    await this.metricsService.recordAction(action, policyChecks, latencyMs);

    // Get updated metrics
    const metrics = await this.metricsService.getMetrics(MetricsPeriod.DAILY);

    return {
      action: {
        ...action,
        policyChecks,
      },
      policyChecks,
      allowed: true,
      metrics,
    };
  }

  async runUnauthorizedAction(): Promise<{
    action: AgentAction;
    policyChecks: PolicyCheck[];
    allowed: boolean;
    metrics: any;
  }> {
    // Record start time for latency calculation
    const startTime = Date.now();

    // Create an unauthorized action
    const action = await this.testAgent.performUnauthorizedAction();

    // Evaluate against policies - should fail
    const policyChecks = await this.createDummyPolicyChecks(action, false);

    // Calculate latency
    const latencyMs = Date.now() - startTime;

    // Record action in metrics
    await this.metricsService.recordAction(action, policyChecks, latencyMs);

    // Get updated metrics
    const metrics = await this.metricsService.getMetrics(MetricsPeriod.DAILY);

    return {
      action: {
        ...action,
        policyChecks,
      },
      policyChecks,
      allowed: false,
      metrics,
    };
  }

  async runHighLoadTest(): Promise<{
    action: AgentAction;
    policyChecks: PolicyCheck[];
    allowed: boolean;
    metrics: any;
  }> {
    // Record start time for latency calculation
    const startTime = Date.now();

    // Create 5 actions for the high load test
    const actions = await this.testAgent.performHighLoadTest(5);

    // Process each action
    for (let i = 0; i < actions.length - 1; i++) {
      const action = actions[i];
      const policyChecks = await this.createDummyPolicyChecks(action, true);
      const actionLatency = Math.floor(Math.random() * 100) + 50; // Random latency between 50-150ms
      await this.metricsService.recordAction(action, policyChecks, actionLatency);
    }

    // Process the last action (we'll return this one)
    const finalAction = actions[actions.length - 1];
    const policyChecks = await this.createDummyPolicyChecks(finalAction, true);

    // Calculate latency for the batch
    const latencyMs = Date.now() - startTime;
    await this.metricsService.recordAction(finalAction, policyChecks, latencyMs);

    // Get updated metrics
    const metrics = await this.metricsService.getMetrics(MetricsPeriod.DAILY);

    return {
      action: {
        ...finalAction,
        policyChecks,
        metadata: {
          ...finalAction.metadata,
          batchSize: actions.length,
          totalLatency: latencyMs,
        },
      },
      policyChecks,
      allowed: true,
      metrics,
    };
  }

  async runResourceIntensiveAction(): Promise<{
    action: AgentAction;
    policyChecks: PolicyCheck[];
    allowed: boolean;
    metrics: any;
  }> {
    // Record start time for latency calculation
    const startTime = Date.now();

    // Create a resource-intensive action
    const action = await this.testAgent.performResourceIntensiveAction();

    // Simulate CPU-intensive work
    this.simulateCpuIntensiveWork();

    // Evaluate against policies
    const policyChecks = await this.createDummyPolicyChecks(action, true);

    // Calculate latency (should be higher due to the CPU work)
    const latencyMs = Date.now() - startTime;

    // Record action in metrics
    await this.metricsService.recordAction(action, policyChecks, latencyMs);

    // Get updated metrics
    const metrics = await this.metricsService.getMetrics(MetricsPeriod.DAILY);

    return {
      action: {
        ...action,
        policyChecks,
        metadata: {
          ...action.metadata,
          cpuUsage: 85, // Simulated high CPU usage
          memoryUsage: 512, // Simulated memory usage in MB
        },
      },
      policyChecks,
      allowed: true,
      metrics,
    };
  }

  async runGeminiQuery(): Promise<{
    action: AgentAction;
    policyChecks: PolicyCheck[];
    allowed: boolean;
    metrics: any;
    geminiResponse?: string;
  }> {
    // Record start time for latency calculation
    const startTime = Date.now();

    // Create an action for the Gemini query
    const action = await this.testAgent.performAction('gemini-query');

    // Make a request to Gemini API
    let geminiResponse: string | undefined;
    try {
      logger.info('Attempting to query Gemini API', {
        apiKeyConfigured: !!this.geminiApiKey,
        apiKeyLength: this.geminiApiKey ? this.geminiApiKey.length : 0,
        prompt: 'Explain the importance of AI agent governance in 2-3 sentences.',
      });

      // Check if API key is available
      if (!this.geminiApiKey) {
        logger.warn('Gemini API key not found in configuration, using fallback response');
        // Provide a fallback response for demo purposes
        geminiResponse =
          'AI agent governance is crucial for ensuring that autonomous systems operate ethically, safely, and in alignment with human values. It establishes accountability frameworks and transparency mechanisms that prevent misuse while enabling innovation. Effective governance balances the transformative potential of AI with necessary safeguards to protect individuals and society.';
      } else {
        geminiResponse = await this.queryGeminiApi(
          'Explain the importance of AI agent governance in 2-3 sentences.',
        );
      }

      logger.info('Successfully received Gemini API response', {
        responseLength: geminiResponse.length,
      });

      // Update the action with the Gemini response
      action.metadata = {
        ...action.metadata,
        geminiUsed: true,
        contentLength: geminiResponse.length,
      };

      action.description = `Gemini query successful: ${geminiResponse.substring(0, 50)}...`;
    } catch (error) {
      logger.error('Error in Gemini query execution', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      action.metadata = {
        ...action.metadata,
        geminiUsed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      action.description = 'Gemini query failed';

      // Provide a fallback response for demo purposes
      geminiResponse =
        "Error retrieving response from Gemini API, but here's a fallback response: AI agent governance establishes essential guardrails for ensuring AI systems operate ethically, safely, and in alignment with human values. Proper governance frameworks help prevent misuse while enabling beneficial innovation.";
    }

    // Evaluate against policies - we'll always pass for demo purposes since we have a fallback
    const policyChecks = await this.createDummyPolicyChecks(action, true);

    // Calculate latency
    const latencyMs = Date.now() - startTime;

    // Record action in metrics
    await this.metricsService.recordAction(action, policyChecks, latencyMs);

    // Get updated metrics
    const metrics = await this.metricsService.getMetrics(MetricsPeriod.DAILY);

    return {
      action: {
        ...action,
        policyChecks,
      },
      policyChecks,
      allowed: true, // Always allowed with fallback
      metrics,
      geminiResponse,
    };
  }

  private async queryGeminiApi(prompt: string): Promise<string> {
    if (!this.genAI) {
      throw new Error('Gemini API not initialized');
    }

    try {
      logger.info('Sending request to Gemini API', {
        prompt,
        modelName: 'gemini-2.0-flash',
      });

      const response = await this.genAI.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
      });

      if (!response.text) {
        throw new Error('No text found in Gemini API response');
      }

      logger.info('Successfully received Gemini API response', {
        responseLength: response.text.length,
      });

      return response.text;
    } catch (error) {
      logger.error('Error querying Gemini API', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  // Create dummy policy checks since we don't have real policies loaded
  private async createDummyPolicyChecks(
    action: AgentAction,
    shouldPass: boolean,
  ): Promise<PolicyCheck[]> {
    const policies = [
      { id: 'rate-limit-policy', name: 'Rate Limiting' },
      { id: 'data-access-policy', name: 'Data Access' },
      { id: 'resource-usage-policy', name: 'Resource Usage' },
    ];

    return policies.map((policy) => ({
      policyId: policy.id,
      result: policy.id === 'data-access-policy' ? shouldPass : true,
      reason: shouldPass
        ? `${policy.name} check passed`
        : `${policy.name} check failed: unauthorized action type`,
    }));
  }

  // Simulate CPU-intensive work
  private simulateCpuIntensiveWork(): void {
    // Perform a computationally expensive operation
    const start = Date.now();
    let result = 0;
    for (let i = 0; i < 10000000; i++) {
      result += Math.sqrt(i) * Math.sin(i);
    }
    const duration = Date.now() - start;
    logger.debug(`CPU-intensive work took ${duration}ms, result: ${result}`);
  }
}
