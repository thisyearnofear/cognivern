import { GovernanceAgent } from './GovernanceAgent.js';

async function main() {
  console.log('Starting Governance Agent test...\n');

  try {
    // Initialize the governance agent
    const agent = new GovernanceAgent('test-agent-1');
    await agent.initialize();

    // Test thought logging
    console.log('Testing thought logging...');
    await agent.logThought('Initializing test sequence', 0.95);
    await agent.logThought('Testing asset scanning functionality', 0.9);

    // Test action logging
    console.log('\nTesting action logging...');
    await agent.logAction(
      'scan_assets',
      { identifiers: ['SSN-123-45-6789', 'JOHN-DOE-1990'] },
      { matches: 1 },
      { context: 'test-run' },
    );

    // Test metrics update
    console.log('\nTesting metrics update...');
    await agent.updateMetrics({
      performance: {
        responseTime: 150,
        successRate: 0.98,
        errorRate: 0.02,
      },
    });

    // Get and display results
    console.log('\nRetrieving agent state...');
    const thoughts = agent.getThoughtHistory();
    const actions = agent.getActionHistory();
    const metrics = agent.getMetrics();

    console.log('\nThought History:');
    thoughts.forEach((thought, index) => {
      console.log(
        `${index + 1}. [${thought.timestamp}] ${thought.thought} (Confidence: ${thought.confidence})`,
      );
    });

    console.log('\nAction History:');
    actions.forEach((action, index) => {
      console.log(`${index + 1}. [${action.timestamp}] ${action.action}`);
      console.log(`   Input: ${JSON.stringify(action.input)}`);
      console.log(`   Output: ${JSON.stringify(action.output)}`);
    });

    console.log('\nMetrics:');
    console.log('Performance:');
    console.log(`  Response Time: ${metrics.performance.responseTime}ms`);
    console.log(`  Success Rate: ${metrics.performance.successRate * 100}%`);
    console.log(`  Error Rate: ${metrics.performance.errorRate * 100}%`);
    console.log('\nCompliance:');
    console.log(`  Policy Violations: ${metrics.compliance.policyViolations}`);
    console.log(`  Last Audit: ${metrics.compliance.lastAudit}`);
    console.log(`  Audit Score: ${metrics.compliance.auditScore}`);
  } catch (error) {
    console.error('\nError during test:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
  }
}

main();
