import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { testnet } from '@recallnet/chains';
import { RecallClient } from '@recallnet/sdk/client';
import type { ListResultBucket } from '@recallnet/sdk/bucket';
import { TestAgent } from '../agents/TestAgent.js';
import { PolicyEnforcementService } from '../services/PolicyEnforcementService.js';
import { AuditLogService } from '../services/AuditLogService.js';
import { MetricsService } from '../services/MetricsService.js';
import { MetricsPeriod } from '../types/Metrics.js';

async function runDemo() {
  // Initialize wallet client
  const privateKey = process.env.RECALL_PRIVATE_KEY!;
  const walletClient = createWalletClient({
    account: privateKeyToAccount(privateKey as `0x${string}`),
    chain: testnet as any,
    transport: http(),
  });

  // Initialize Recall client
  const recall = new RecallClient({ walletClient: walletClient as any });
  const bucketManager = recall.bucketManager();

  // Get or create bucket
  const bucketMetadata: Record<string, string> = {
    name: process.env.RECALL_BUCKET_ALIAS!,
    type: 'escheat-agents',
    environment: process.env.NODE_ENV || 'development',
  };

  let bucket: ListResultBucket | undefined;
  try {
    const { result: buckets } = await bucketManager.list();
    bucket = buckets.find((b: ListResultBucket) => {
      const metadata = b.metadata as Record<string, string>;
      return metadata.name === bucketMetadata.name;
    });

    if (!bucket) {
      const { result } = await bucketManager.create({ metadata: bucketMetadata });
      bucket = {
        kind: 0,
        addr: result.bucket,
        metadata: bucketMetadata,
      };
    }
  } catch (error) {
    console.error('Failed to initialize bucket:', error);
    throw error;
  }

  if (!bucket) {
    throw new Error('Failed to get or create bucket');
  }

  // Initialize services with bucket
  const policyService = new PolicyEnforcementService();
  const auditService = new AuditLogService(recall, bucket.addr);
  const metricsService = new MetricsService(recall, bucket.addr);

  // Load the default policy
  await policyService.loadPolicy('default-policy');

  // Create test agent
  const agent = new TestAgent();
  console.log('Test agent created:', agent.getConfig());

  // Test 1: Normal Operation
  console.log('\n🧪 Test 1: Normal Operation');
  const normalAction = await agent.performAction('data-analysis');
  const normalChecks = await policyService.evaluateAction(normalAction);
  const normalAllowed = await policyService.enforcePolicy(normalAction);
  await auditService.logAction(normalAction, normalChecks, normalAllowed);
  await metricsService.recordAction(normalAction, normalChecks, 500);
  console.log('Normal action allowed:', normalAllowed);

  // Test 2: Unauthorized Access
  console.log('\n🧪 Test 2: Unauthorized Access');
  const unauthorizedAction = await agent.performUnauthorizedAction();
  const unauthorizedChecks = await policyService.evaluateAction(unauthorizedAction);
  const unauthorizedAllowed = await policyService.enforcePolicy(unauthorizedAction);
  await auditService.logAction(unauthorizedAction, unauthorizedChecks, unauthorizedAllowed);
  await metricsService.recordAction(unauthorizedAction, unauthorizedChecks, 300);
  console.log('Unauthorized action allowed:', unauthorizedAllowed);

  // Test 3: Rate Limiting
  console.log('\n🧪 Test 3: Rate Limiting');
  const highLoadActions = await agent.performHighLoadTest(150);
  for (const action of highLoadActions) {
    const checks = await policyService.evaluateAction(action);
    const allowed = await policyService.enforcePolicy(action);
    await auditService.logAction(action, checks, allowed);
    await metricsService.recordAction(action, checks, 200);
    if (!allowed) {
      console.log('Rate limit kicked in after', action.metadata.requestsPerMinute, 'requests');
      break;
    }
  }

  // Test 4: Resource Intensive Operation
  console.log('\n🧪 Test 4: Resource Intensive Operation');
  const resourceAction = await agent.performResourceIntensiveAction();
  const resourceChecks = await policyService.evaluateAction(resourceAction);
  const resourceAllowed = await policyService.enforcePolicy(resourceAction);
  await auditService.logAction(resourceAction, resourceChecks, resourceAllowed);
  await metricsService.recordAction(resourceAction, resourceChecks, 1500);
  console.log('Resource intensive action allowed:', resourceAllowed);

  // Retrieve and display metrics
  console.log('\n📊 Metrics Report');
  const metrics = await metricsService.getMetrics(MetricsPeriod.HOURLY);
  console.log('Current metrics:', JSON.stringify(metrics, null, 2));

  // Retrieve and display recent audit logs
  console.log('\n📝 Recent Audit Logs');
  const recentLogs = await auditService.searchLogs({
    startDate: new Date(Date.now() - 3600000).toISOString(), // Last hour
    endDate: new Date().toISOString(),
  });
  console.log('Recent logs:', JSON.stringify(recentLogs, null, 2));
}

// Run the demo
runDemo().catch(console.error);
