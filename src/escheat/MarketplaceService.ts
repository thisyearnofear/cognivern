import { GovernanceStorageService, GovernanceObject } from './GovernanceStorageService.js';

export interface PatternListing {
  id: string;
  title: string;
  description: string;
  pattern: string;
  price: number;
  currency: string;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: {
    category: string;
    tags: string[];
    version: string;
    rating: number;
    downloads: number;
  };
}

export interface Subscription {
  id: string;
  patternId: string;
  subscriberId: string;
  status: 'active' | 'cancelled' | 'expired';
  startDate: Date;
  endDate: Date;
  paymentStatus: 'paid' | 'pending' | 'failed';
  metadata: {
    plan: string;
    autoRenew: boolean;
    lastPaymentDate: Date;
  };
}

export class MarketplaceService {
  private storageService: GovernanceStorageService;

  constructor() {
    this.storageService = new GovernanceStorageService();
  }

  async initialize(): Promise<void> {
    await this.storageService.initializeSystem();
  }

  async listPattern(pattern: PatternListing): Promise<void> {
    const object: GovernanceObject = {
      key: `marketplace/patterns/${pattern.id}.json`,
      size: JSON.stringify(pattern).length,
      timestamp: Date.now(),
      data: {
        ...pattern,
        createdAt: pattern.createdAt.toISOString(),
        updatedAt: pattern.updatedAt.toISOString(),
      },
      metadata: {
        type: 'listing',
        version: '1.0.0',
      },
    };

    await this.storageService.addObject('marketplace', object);
  }

  async getPattern(patternId: string): Promise<PatternListing | null> {
    const object = await this.storageService.getObject('marketplace', `patterns/${patternId}.json`);
    if (!object) return null;

    const pattern = object.data as PatternListing;
    return {
      ...pattern,
      createdAt: new Date(pattern.createdAt),
      updatedAt: new Date(pattern.updatedAt),
    };
  }

  async listPatterns(category?: string, tags?: string[]): Promise<PatternListing[]> {
    const objects = await this.storageService.listObjects('marketplace', 'patterns/');
    let patterns = objects.map((obj) => {
      const pattern = obj.data as PatternListing;
      return {
        ...pattern,
        createdAt: new Date(pattern.createdAt),
        updatedAt: new Date(pattern.updatedAt),
      };
    });

    // Apply filters
    if (category) {
      patterns = patterns.filter((p) => p.metadata.category === category);
    }
    if (tags && tags.length > 0) {
      patterns = patterns.filter((p) => tags.every((tag) => p.metadata.tags.includes(tag)));
    }

    return patterns;
  }

  async createSubscription(subscription: Subscription): Promise<void> {
    const object: GovernanceObject = {
      key: `marketplace/subscriptions/${subscription.id}.json`,
      size: JSON.stringify(subscription).length,
      timestamp: Date.now(),
      data: {
        ...subscription,
        startDate: subscription.startDate.toISOString(),
        endDate: subscription.endDate.toISOString(),
        metadata: {
          ...subscription.metadata,
          lastPaymentDate: subscription.metadata.lastPaymentDate.toISOString(),
        },
      },
      metadata: {
        type: 'subscription',
        version: '1.0.0',
      },
    };

    await this.storageService.addObject('marketplace', object);
  }

  async getSubscription(subscriptionId: string): Promise<Subscription | null> {
    const object = await this.storageService.getObject(
      'marketplace',
      `subscriptions/${subscriptionId}.json`,
    );
    if (!object) return null;

    const subscription = object.data as Subscription;
    return {
      ...subscription,
      startDate: new Date(subscription.startDate),
      endDate: new Date(subscription.endDate),
      metadata: {
        ...subscription.metadata,
        lastPaymentDate: new Date(subscription.metadata.lastPaymentDate),
      },
    };
  }

  async updateSubscription(subscriptionId: string, updates: Partial<Subscription>): Promise<void> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }

    const updatedSubscription: Subscription = {
      ...subscription,
      ...updates,
    };

    await this.createSubscription(updatedSubscription);
  }

  async getSubscriberPatterns(subscriberId: string): Promise<PatternListing[]> {
    const subscriptions = await this.storageService.listObjects('marketplace', 'subscriptions/');
    const activeSubscriptions = subscriptions
      .map((obj) => obj.data as Subscription)
      .filter((sub) => sub.subscriberId === subscriberId && sub.status === 'active');

    const patterns: PatternListing[] = [];
    for (const sub of activeSubscriptions) {
      const pattern = await this.getPattern(sub.patternId);
      if (pattern) patterns.push(pattern);
    }

    return patterns;
  }
}
