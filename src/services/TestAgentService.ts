import { TestAgent } from '../agents/TestAgent.js';
import { MetricsService } from './MetricsService.js';
import { PolicyEnforcementService } from './PolicyEnforcementService.js';
import { RecallClient } from '@recallnet/sdk/client';
import { Address } from 'viem';
import logger from '../utils/logger.js';
import OpenAI from 'openai';
import { config } from '../config.js';
import { PolicyCheck } from '../types/Agent.js';

export class TestAgentService {
  private testAgent: TestAgent;
  private metricsService: MetricsService;
  private policyService: PolicyEnforcementService;
  private openai: OpenAI | null = null;
  private recall: RecallClient;
  private bucketAddress: Address;

  constructor(
    metricsService: MetricsService,
    policyService: PolicyEnforcementService,
    recall: RecallClient,
    bucketAddress: Address,
  ) {
    this.testAgent = new TestAgent();
    this.metricsService = metricsService;
    this.policyService = policyService;
    this.recall = recall;
    this.bucketAddress = bucketAddress;

    // Initialize OpenAI if API key is available
    if (config.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: config.OPENAI_API_KEY,
      });
      logger.info('OpenAI API initialized for TestAgentService');
    } else {
      logger.warn('OpenAI API key not found, AI features will not be available');
    }
  }

  async runStandardAction() {
    logger.info('Running standard test action');
    const action = await this.testAgent.performAction('standard-test');

    // Load a sample policy and evaluate the action
    try {
      await this.policyService.loadPolicy('test-policy');
      const checks = await this.policyService.evaluateAction(action);
      action.policyChecks = checks;

      // Update metrics
      await this.metricsService.recordAction(action, checks, 100); // Assume 100ms latency

      return {
        success: true,
        action,
        message: 'Standard test action completed successfully',
      };
    } catch (error) {
      logger.error('Error in standard test action', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        action,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async runUnauthorizedAction() {
    logger.info('Running unauthorized test action');
    const action = await this.testAgent.performUnauthorizedAction();

    try {
      await this.policyService.loadPolicy('test-policy');
      const checks = await this.policyService.evaluateAction(action);
      action.policyChecks = checks;

      // Update metrics
      await this.metricsService.recordAction(action, checks, 150); // Assume 150ms latency

      return {
        success: true,
        action,
        message: 'Unauthorized test action completed',
        policyResult: await this.policyService.enforcePolicy(action),
      };
    } catch (error) {
      logger.error('Error in unauthorized test action', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        action,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async runHighLoadTest() {
    logger.info('Running high load test');
    const requestsPerMinute = 10; // Lower for testing
    const actions = await this.testAgent.performHighLoadTest(requestsPerMinute);

    try {
      await this.policyService.loadPolicy('test-policy');

      const results = await Promise.all(
        actions.map(async (action) => {
          const checks = await this.policyService.evaluateAction(action);
          action.policyChecks = checks;
          await this.metricsService.recordAction(
            action,
            checks,
            Math.floor(Math.random() * 200) + 50,
          ); // Random latency between 50-250ms
          return action;
        }),
      );

      return {
        success: true,
        actionsProcessed: results.length,
        actions: results,
        message: `Processed ${results.length} test actions`,
      };
    } catch (error) {
      logger.error('Error in high load test', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        actionsProcessed: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async runResourceIntensiveAction() {
    logger.info('Running resource intensive test action');
    const action = await this.testAgent.performResourceIntensiveAction();

    try {
      await this.policyService.loadPolicy('test-policy');
      const checks = await this.policyService.evaluateAction(action);
      action.policyChecks = checks;

      // Update metrics with higher latency to simulate resource intensive action
      await this.metricsService.recordAction(action, checks, 500); // Assume 500ms latency

      return {
        success: true,
        action,
        message: 'Resource intensive test action completed',
      };
    } catch (error) {
      logger.error('Error in resource intensive test action', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        action,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async runGeminiQuery() {
    logger.info('Attempting to query AI model');

    try {
      if (!this.openai) {
        logger.warn('OpenAI not configured, returning fallback response');
        return {
          success: false,
          error: 'OpenAI API key not configured',
          message: 'This is a fallback response since the OpenAI API is not configured.',
        };
      }

      const response = await this.queryAIModel('Explain how AI governance works in 2-3 sentences.');

      // Record the action
      const action = await this.testAgent.performAction('ai-query');
      action.metadata.response = response.substring(0, 100) + (response.length > 100 ? '...' : '');

      // Dummy policy checks for this action
      const checks: PolicyCheck[] = [
        {
          policyId: 'ai-safety',
          result: true,
          reason: 'Query passed safety check',
        },
      ];
      action.policyChecks = checks;

      // Update metrics
      await this.metricsService.recordAction(action, checks, 300); // Assume 300ms latency

      return {
        success: true,
        action,
        response,
        message: 'Successfully queried AI model',
      };
    } catch (error) {
      logger.error('Error querying AI model', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to query AI model',
      };
    }
  }

  private async queryAIModel(prompt: string): Promise<string> {
    if (!this.openai) {
      throw new Error('OpenAI not initialized');
    }

    try {
      // Generate content using OpenAI
      const response = await this.openai.chat.completions.create({
        model: config.MODEL_NAME || 'gpt-4',
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful assistant providing concise information about AI governance.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 150,
      });

      const text = response.choices[0]?.message?.content || 'No response generated';

      logger.info('AI query successful', {
        prompt: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : ''),
        responseLength: text.length,
      });

      return text;
    } catch (error) {
      logger.error('Error in AI query', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new Error(`AI API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
