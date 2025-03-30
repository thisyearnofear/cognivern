import { MarketplaceService, PatternListing, Subscription } from './MarketplaceService.js';

async function main() {
  console.log('Starting Marketplace Service test...\n');

  try {
    // Initialize the marketplace service
    const marketplace = new MarketplaceService();
    await marketplace.initialize();

    // Test pattern listing
    console.log('Testing pattern listing...');
    const pattern: PatternListing = {
      id: 'pattern-123',
      title: 'Financial Analysis Pattern',
      description: 'A pattern for analyzing financial data and generating insights',
      pattern: '// Financial analysis logic here',
      price: 99.99,
      currency: 'USD',
      authorId: 'author-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        category: 'finance',
        tags: ['analysis', 'data', 'insights'],
        version: '1.0.0',
        rating: 4.5,
        downloads: 0,
      },
    };

    await marketplace.listPattern(pattern);

    // Test pattern retrieval
    console.log('\nTesting pattern retrieval...');
    const retrievedPattern = await marketplace.getPattern('pattern-123');
    if (retrievedPattern) {
      console.log('Retrieved Pattern:');
      console.log(`Title: ${retrievedPattern.title}`);
      console.log(`Price: ${retrievedPattern.price} ${retrievedPattern.currency}`);
      console.log(`Category: ${retrievedPattern.metadata.category}`);
      console.log(`Tags: ${retrievedPattern.metadata.tags.join(', ')}`);
    }

    // Test pattern listing with filters
    console.log('\nTesting pattern listing with filters...');
    const financePatterns = await marketplace.listPatterns('finance');
    console.log(`Found ${financePatterns.length} finance patterns`);

    const taggedPatterns = await marketplace.listPatterns(undefined, ['analysis']);
    console.log(`Found ${taggedPatterns.length} patterns tagged with 'analysis'`);

    // Test subscription creation
    console.log('\nTesting subscription creation...');
    const subscription: Subscription = {
      id: 'sub-123',
      patternId: 'pattern-123',
      subscriberId: 'user-1',
      status: 'active',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      paymentStatus: 'paid',
      metadata: {
        plan: 'monthly',
        autoRenew: true,
        lastPaymentDate: new Date(),
      },
    };

    await marketplace.createSubscription(subscription);

    // Test subscription retrieval
    console.log('\nTesting subscription retrieval...');
    const retrievedSubscription = await marketplace.getSubscription('sub-123');
    if (retrievedSubscription) {
      console.log('Retrieved Subscription:');
      console.log(`Status: ${retrievedSubscription.status}`);
      console.log(`Payment Status: ${retrievedSubscription.paymentStatus}`);
      console.log(`Plan: ${retrievedSubscription.metadata.plan}`);
      console.log(`Auto Renew: ${retrievedSubscription.metadata.autoRenew}`);
    }

    // Test subscriber patterns
    console.log('\nTesting subscriber patterns retrieval...');
    const subscriberPatterns = await marketplace.getSubscriberPatterns('user-1');
    console.log(`Found ${subscriberPatterns.length} patterns for subscriber`);
  } catch (error) {
    console.error('\nError during test:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
  }
}

main();
