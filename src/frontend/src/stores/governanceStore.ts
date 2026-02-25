import { create } from "zustand";

/**
 * Governance Domain Interfaces
 *
 * CORE PRINCIPLES:
 * - MODULAR: Independent rule and policy structures.
 * - DRY: Single source of truth for governance logic and templates.
 * - ENHANCEMENT FIRST: Bridges descriptive governance with technical runtime rules.
 */

export type StrictnessLevel = "low" | "medium" | "high";
export type RuleType = "ALLOW" | "DENY" | "REQUIRE" | "RATE_LIMIT";
export type PolicyCategory =
  | "trading"
  | "security"
  | "compliance"
  | "performance"
  | "data"
  | "ethics";

export interface GovernanceRule {
  id: string;
  name: string;
  description: string;
  type: RuleType;
  condition: string;
  action: string;
  enabled: boolean;
  strictness: StrictnessLevel;
  category: PolicyCategory;
  priority: number;
  metadata?: Record<string, any>;
}

export interface GovernancePolicy {
  id: string;
  name: string;
  description: string;
  rules: GovernanceRule[];
  status: "active" | "draft" | "archived";
  templateId?: string;
  effectivenessScore?: number;
  violationsPrevented?: number;
  createdAt: number;
  updatedAt: number;
}

export interface GovernanceTemplate {
  id: string;
  name: string;
  description: string;
  category: "trading" | "security" | "compliance" | "performance";
  icon: string;
  complexity: "simple" | "moderate" | "advanced";
  estimatedSetupTime: string;
  defaultRules: GovernanceRule[];
}

interface GovernanceState {
  // State
  policies: GovernancePolicy[];
  templates: GovernanceTemplate[];
  isLoading: boolean;
  error: string | null;

  // Actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  fetchPolicies: () => Promise<void>;
  createPolicy: (
    policy: Omit<GovernancePolicy, "id" | "createdAt" | "updatedAt">,
  ) => Promise<GovernancePolicy>;
  updatePolicy: (
    id: string,
    updates: Partial<GovernancePolicy>,
  ) => Promise<void>;
  deletePolicy: (id: string) => Promise<void>;
  applyTemplate: (
    templateId: string,
    customName?: string,
  ) => Promise<GovernancePolicy>;
}

/**
 * Default Governance Templates
 * Synchronized with PolicyManagement.tsx domain definitions.
 */
const defaultTemplates: GovernanceTemplate[] = [
  {
    id: "trading-risk-control",
    name: "Trading Risk Management",
    description:
      "Comprehensive risk controls for trading agents including position limits, stop-losses, and approval workflows.",
    category: "trading",
    icon: "📊",
    complexity: "moderate",
    estimatedSetupTime: "10-15 min",
    defaultRules: [
      {
        id: "rule-position-limit",
        name: "Position Limit",
        description: "Deny trades exceeding 10% of account balance.",
        type: "DENY",
        condition: "trade.amount > account.balance * 0.1",
        action: "block_trade",
        enabled: true,
        strictness: "medium",
        category: "trading",
        priority: 1,
        metadata: { reason: "Position size exceeds 10% of balance" },
      },
      {
        id: "rule-risk-approval",
        name: "High Risk Approval",
        description: "Require human approval for trades with high risk scores.",
        type: "REQUIRE",
        condition: "trade.riskScore > 0.8",
        action: "human_approval",
        enabled: true,
        strictness: "high",
        category: "trading",
        priority: 2,
        metadata: { timeout: 300 },
      },
      {
        id: "rule-trade-rate",
        name: "Trade Rate Limit",
        description: "Limit agents to 10 trades per hour.",
        type: "RATE_LIMIT",
        condition: "agent.trades_per_hour",
        action: "limit_to_10",
        enabled: true,
        strictness: "medium",
        category: "trading",
        priority: 3,
        metadata: { window: 3600 },
      },
    ],
  },
  {
    id: "security-baseline",
    name: "Security Foundation",
    description:
      "Essential security controls including authentication, authorization, and audit logging.",
    category: "security",
    icon: "🔒",
    complexity: "simple",
    estimatedSetupTime: "5-10 min",
    defaultRules: [
      {
        id: "rule-auth-mfa",
        name: "MFA Requirement",
        description: "Require authentication and identity verification.",
        type: "REQUIRE",
        condition: "request.authenticated === true",
        action: "verify_identity",
        enabled: true,
        strictness: "medium",
        category: "security",
        priority: 1,
        metadata: { method: "mfa" },
      },
      {
        id: "rule-network-auth",
        name: "Authorized Network",
        description: "Deny requests from unauthorized source networks.",
        type: "DENY",
        condition: 'request.source !== "authorized_network"',
        action: "block_request",
        enabled: true,
        strictness: "high",
        category: "security",
        priority: 2,
        metadata: { log_level: "high" },
      },
    ],
  },
  {
    id: "compliance-framework",
    name: "Regulatory Compliance",
    description:
      "Advanced compliance controls for regulated environments with audit trails and reporting.",
    category: "compliance",
    icon: "⚖️",
    complexity: "advanced",
    estimatedSetupTime: "20-30 min",
    defaultRules: [
      {
        id: "rule-kyc-limit",
        name: "Enhanced KYC",
        description: "Require enhanced KYC for transactions over $10k.",
        type: "REQUIRE",
        condition: "transaction.amount > 10000",
        action: "kyc_verification",
        enabled: true,
        strictness: "high",
        category: "compliance",
        priority: 1,
        metadata: { level: "enhanced" },
      },
      {
        id: "rule-jurisdiction-block",
        name: "Jurisdiction Restriction",
        description: "Block access from restricted jurisdictions.",
        type: "DENY",
        condition: 'user.jurisdiction === "restricted"',
        action: "block_access",
        enabled: true,
        strictness: "high",
        category: "compliance",
        priority: 2,
        metadata: { reason: "Regulatory restriction" },
      },
    ],
  },
];

export const useGovernanceStore = create<GovernanceState>((set, get) => ({
  policies: [],
  templates: defaultTemplates,
  isLoading: false,
  error: null,

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  /**
   * Fetches policies from storage.
   */
  fetchPolicies: async () => {
    set({ isLoading: true });
    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      const stored = localStorage.getItem("cognivern-policies");
      const policies = stored ? JSON.parse(stored) : [];
      set({ policies, isLoading: false });
    } catch (err) {
      set({ error: "Failed to fetch policies", isLoading: false });
    }
  },

  /**
   * Creates a new policy and persists it.
   */
  createPolicy: async (policyData) => {
    set({ isLoading: true });
    try {
      const newPolicy: GovernancePolicy = {
        ...policyData,
        id: `pol-${crypto.randomUUID()}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        effectivenessScore: 100, // Initial default
        violationsPrevented: 0,
      };

      set((state) => {
        const nextPolicies = [newPolicy, ...state.policies];
        localStorage.setItem(
          "cognivern-policies",
          JSON.stringify(nextPolicies),
        );
        return { policies: nextPolicies, isLoading: false };
      });

      return newPolicy;
    } catch (err) {
      set({ error: "Failed to create policy", isLoading: false });
      throw err;
    }
  },

  /**
   * Updates an existing policy.
   */
  updatePolicy: async (id, updates) => {
    set((state) => {
      const nextPolicies = state.policies.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p,
      );
      localStorage.setItem("cognivern-policies", JSON.stringify(nextPolicies));
      return { policies: nextPolicies };
    });
  },

  /**
   * Deletes a policy.
   */
  deletePolicy: async (id) => {
    set((state) => {
      const nextPolicies = state.policies.filter((p) => p.id !== id);
      localStorage.setItem("cognivern-policies", JSON.stringify(nextPolicies));
      return { policies: nextPolicies };
    });
  },

  /**
   * Applies a template to create a new policy.
   */
  applyTemplate: async (templateId, customName) => {
    const template = get().templates.find((t) => t.id === templateId);
    if (!template) throw new Error("Governance template not found");

    const policyData: Omit<GovernancePolicy, "id" | "createdAt" | "updatedAt"> =
      {
        name: customName || `My ${template.name}`,
        description: template.description,
        rules: [...template.defaultRules],
        status: "draft",
        templateId: template.id,
      };

    return get().createPolicy(policyData);
  },
}));
