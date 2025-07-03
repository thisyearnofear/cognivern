import { TestAgent } from '../agents/TestAgent.js';
import { MetricsService } from './MetricsService.js';
import { PolicyEnforcementService } from './PolicyEnforcementService.js';
import logger from '../utils/logger.js';
import OpenAI from 'openai';
import { PolicyCheck, AgentAction } from '../types/Agent.js';

export class TestAgentService {
  private testAgent: TestAgent;
  private metricsService: MetricsService;
  private policyService: PolicyEnforcementService;
  private openai: OpenAI | null = null;

  constructor(
    metricsService: MetricsService,
    policyService: PolicyEnforcementService
  ) {
    this.testAgent = new TestAgent();
    this.metricsService = metricsService;
    this.policyService = policyService;

    // Initialize OpenAI if API key is available
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
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

    // Reduce the number of requests to avoid hitting Recall limits
    const requestsPerMinute = 2;
    const actions = await this.testAgent.performHighLoadTest(requestsPerMinute);

    try {
      await this.policyService.loadPolicy('test-policy');

      // Process actions but handle potential storage errors
      const results: AgentAction[] = [];

      for (const action of actions) {
        try {
          const checks = await this.policyService.evaluateAction(action);
          action.policyChecks = checks;

          try {
            // Attempt to record in Recall but catch errors
            await this.metricsService.recordAction(
              action,
              checks,
              Math.floor(Math.random() * 200) + 50,
            );
          } catch (storageError) {
            // Log the error but don't fail the test
            logger.warn('Failed to record metrics in Recall (proceeding with test)', {
              error: storageError instanceof Error ? storageError.message : 'Unknown error',
              actionId: action.id,
            });
          }

          results.push(action);
        } catch (actionError) {
          logger.error('Error processing action', {
            error: actionError instanceof Error ? actionError.message : 'Unknown error',
            actionId: action.id,
          });
          // Continue with next action rather than failing the entire batch
        }
      }

      return {
        success: true,
        actionsProcessed: results.length,
        actions: results,
        message:
          `Processed ${results.length} test actions` +
          (results.length < actions.length
            ? ` (${actions.length - results.length} actions failed)`
            : ''),
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
        model: process.env.MODEL_NAME || 'gpt-4',
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
