import { create } from "zustand";

/**
 * Represents a dynamically generated UI component from the agent.
 * Maps to the component registry in the UI domain.
 */
export interface GeneratedUIComponent {
  id: string;
  type:
    | "chart"
    | "table"
    | "stat"
    | "action-form"
    | "markdown"
    | "status"
    | "agent"
    | "policy"
    | "governance-score"
    | "forensic-timeline";
  props: Record<string, any>;
  data?: any;
}

/**
 * Represents a single interaction in the intent history.
 */
export interface IntentInteraction {
  id: string;
  timestamp: number;
  query: string;
  response?: string;
  component?: GeneratedUIComponent;
  status: "processing" | "completed" | "error";
}

/**
 * Represents a proactive suggestion based on system state or history.
 */
export interface Suggestion {
  id: string;
  label: string;
  intent: string;
  icon?: string;
  type: "action" | "query" | "nav";
}

interface IntentState {
  // UI State
  isOpen: boolean;
  isThinking: boolean;
  query: string;

  // Generative UI State
  activeComponent: GeneratedUIComponent | null;
  history: IntentInteraction[];
  suggestions: Suggestion[];
  conversationalContext: Record<string, any>;

  // Actions
  setIsOpen: (open: boolean) => void;
  setQuery: (query: string) => void;
  setIsThinking: (thinking: boolean) => void;

  /**
   * Submits a natural language intent to the agentic bridge.
   * This is the primary entry point for intent-based interaction.
   */
  submitIntent: (query: string) => Promise<void>;

  /**
   * Refreshes proactive suggestions based on the current context.
   */
  refreshSuggestions: () => void;

  /**
   * Resets the generative UI state but keeps history.
   */
  clearActiveIntent: () => void;

  /**
   * Clears the entire interaction history.
   */
  clearHistory: () => void;

  /**
   * Specifically clears only the conversational memory context.
   */
  clearConversationalContext: () => void;
}

export const useIntentStore = create<IntentState>((set, get) => ({
  isOpen: false,
  isThinking: false,
  query: "",
  activeComponent: null,
  history: [],
  suggestions: [],
  conversationalContext: {},

  setIsOpen: (isOpen) => {
    set({ isOpen });
    if (isOpen) {
      get().refreshSuggestions();
    }
  },

  setQuery: (query) => set({ query }),

  setIsThinking: (isThinking) => set({ isThinking }),

  refreshSuggestions: () => {
    const { history } = get();
    const suggestions: Suggestion[] = [];

    // Rule 1: Core visibility suggestions
    suggestions.push({
      id: "sug-top-agents",
      label: "Show top performing agents",
      intent: "show top performing agents",
      icon: "🏆",
      type: "query",
    });

    suggestions.push({
      id: "sug-safety-health",
      label: "Check system safety health",
      intent: "show safety health score",
      icon: "🛡️",
      type: "query",
    });

    // Rule 2: Context-aware follow-ups
    const lastInteraction = history[0];
    const { conversationalContext } = get();

    if (
      lastInteraction?.status === "completed" &&
      lastInteraction.query.includes("start")
    ) {
      suggestions.push({
        id: "sug-forensics",
        label: "Examine execution traces",
        intent: "show forensic traces",
        icon: "🔬",
        type: "query",
      });
    }

    if (conversationalContext.lastAgentId) {
      suggestions.push({
        id: "sug-start-last",
        label: `Start ${conversationalContext.lastAgentName}`,
        intent: `start ${conversationalContext.lastAgentName}`,
        icon: "▶️",
        type: "action",
      });
    }

    if (lastInteraction?.status === "completed") {
      if (
        lastInteraction.query.includes("create") ||
        lastInteraction.query.includes("agent")
      ) {
        suggestions.push({
          id: "sug-performance",
          label: "Check agent performance",
          intent: "show performance stats",
          icon: "📈",
          type: "query",
        });
      }
    } else {
      // Default actions if no history or specific context
      suggestions.push({
        id: "sug-create-agent",
        label: "Deploy a new trading bot",
        intent: "create new agent",
        icon: "➕",
        type: "action",
      });

      suggestions.push({
        id: "sug-risk-mgmt",
        label: "Setup Trading Risk Management",
        intent: "apply trading risk policy",
        icon: "🛡️",
        type: "action",
      });

      suggestions.push({
        id: "sug-security-baseline",
        label: "Apply Security Foundation",
        intent: "setup security baseline",
        icon: "🔒",
        type: "action",
      });

      suggestions.push({
        id: "sug-audit",
        label: "Review audit logs",
        intent: "show audit logs",
        icon: "📝",
        type: "nav",
      });
    }

    set({ suggestions });
  },

  clearActiveIntent: () =>
    set({
      activeComponent: null,
      isThinking: false,
      query: "",
    }),

  clearHistory: () =>
    set({ history: [], conversationalContext: {}, suggestions: [] }),

  clearConversationalContext: () => set({ conversationalContext: {} }),

  submitIntent: async (query: string) => {
    if (!query.trim()) return;

    const interactionId = crypto.randomUUID();
    const newInteraction: IntentInteraction = {
      id: interactionId,
      timestamp: Date.now(),
      query,
      status: "processing",
    };

    set((state) => ({
      isThinking: true,
      query: "", // Clear input after submission
      history: [newInteraction, ...state.history],
    }));

    try {
      const { conversationalContext } = get();

      // Simulate network/thinking latency
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Mock response logic for early implementation
      const mockResponse = {
        response: "I've analyzed your request. Here's what I found.",
        component: null as GeneratedUIComponent | null,
        newContext: {} as Record<string, any>,
      };

      const lowercaseQuery = query.toLowerCase();

      // Forensic Memory Logic:
      if (
        lowercaseQuery.includes("forensic") ||
        lowercaseQuery.includes("trace") ||
        lowercaseQuery.includes("explain") ||
        lowercaseQuery.includes("why")
      ) {
        mockResponse.component = {
          id: `comp-${interactionId}`,
          type: "forensic-timeline",
          props: {
            agentName: conversationalContext.lastAgentName || "Alpha Arbitrage",
            events: [
              {
                id: "1",
                timestamp: Date.now() - 5000,
                type: "observation",
                title: "Liquidity Imbalance Detected",
                description:
                  "Detected 2.4% price delta between Uniswap V3 and SushiSwap for WETH/USDC.",
              },
              {
                id: "2",
                timestamp: Date.now() - 4000,
                type: "thought",
                title: "Evaluating Arbitrage Route",
                description:
                  "Calculating gas costs and slippage. Estimated net profit: 0.042 ETH.",
              },
              {
                id: "3",
                timestamp: Date.now() - 3000,
                type: "validation",
                title: "Governance Check Passed",
                description:
                  "Trade size (10 ETH) is within the 15 ETH limit defined in 'Standard Guardrails'.",
                metadata: { policyId: "pol-standard-1" },
              },
              {
                id: "4",
                timestamp: Date.now() - 2000,
                type: "action",
                title: "Execution Triggered",
                description: "Flash swap initiated via multi-hop router.",
                metadata: { txHash: "0x742d...44e" },
              },
            ],
          },
        };
      } else if (
        (lowercaseQuery.includes("start") || lowercaseQuery.includes("run")) &&
        conversationalContext.lastAgentId
      ) {
        mockResponse.response = `Starting the agent ${conversationalContext.lastAgentName}...`;
        mockResponse.component = {
          id: `comp-${interactionId}`,
          type: "status",
          props: {
            title: "Agent Deployment",
            status: "success",
            message: `${conversationalContext.lastAgentName} is now live.`,
          },
        };
      } else if (
        lowercaseQuery.includes("risk") ||
        lowercaseQuery.includes("safety") ||
        lowercaseQuery.includes("health") ||
        lowercaseQuery.includes("score")
      ) {
        mockResponse.component = {
          id: `comp-${interactionId}`,
          type: "governance-score",
          props: {
            score: 85,
            label: "Safety Health",
            details: [
              { label: "Active Rules", value: "12" },
              { label: "High Risk Triggers", value: "0" },
              { label: "Audit Coverage", value: "98%" },
              { label: "Human Approvals", value: "Enabled" },
            ],
          },
        };
      } else if (
        lowercaseQuery.includes("policy") ||
        lowercaseQuery.includes("governance") ||
        lowercaseQuery.includes("rules")
      ) {
        mockResponse.component = {
          id: `comp-${interactionId}`,
          type: "policy",
          props: {},
          data: {
            id: "pol-standard-1",
            name: "Standard Guardrails",
            description:
              "Balanced safety policy with real-time audit logging and rate limiting.",
            status: "active",
            rules: [
              { id: "1", name: "Audit", enabled: true, strictness: "medium" },
              {
                id: "2",
                name: "Rate Limit",
                enabled: true,
                strictness: "high",
              },
            ],
          },
        };
      } else if (
        lowercaseQuery.includes("stats") ||
        lowercaseQuery.includes("performance")
      ) {
        mockResponse.component = {
          id: `comp-${interactionId}`,
          type: "stat",
          props: {
            title: "Global Win Rate",
            value: "68.2%",
            icon: "📈",
            color: "success",
            trend: { value: "4.2% since yesterday", isPositive: true },
          },
        };
      } else if (
        lowercaseQuery.includes("create") &&
        (lowercaseQuery.includes("agent") || lowercaseQuery.includes("bot"))
      ) {
        mockResponse.component = {
          id: `comp-${interactionId}`,
          type: "action-form",
          props: {
            title: "Create New Agent",
            submitText: "Deploy Agent",
            fields: [
              {
                name: "name",
                label: "Agent Name",
                placeholder: "e.g. Gamma Trend Follower",
                required: true,
              },
              {
                name: "type",
                label: "Strategy Type",
                type: "select",
                options: [
                  { value: "arbitrage", label: "Arbitrage" },
                  { value: "trend", label: "Trend Following" },
                  { value: "market-making", label: "Market Making" },
                ],
                required: true,
              },
              {
                name: "risk",
                label: "Risk Profile",
                type: "select",
                options: [
                  { value: "low", label: "Conservative" },
                  { value: "medium", label: "Balanced" },
                  { value: "high", label: "Aggressive" },
                ],
                required: true,
              },
            ],
          },
        };
      } else if (
        lowercaseQuery.includes("risk") ||
        lowercaseQuery.includes("security baseline")
      ) {
        mockResponse.response =
          "Excellent choice. I'll help you configure that governance policy.";
        mockResponse.component = {
          id: `comp-${interactionId}`,
          type: "action-form",
          props: {
            title: lowercaseQuery.includes("risk")
              ? "Configure Trading Risk Management"
              : "Configure Security Foundation",
            submitText: "Apply Policy",
            fields: [
              {
                name: "policy_name",
                label: "Policy Name",
                placeholder: "e.g. Production Guardrails",
                required: true,
              },
              {
                name: "mode",
                label: "Enforcement Mode",
                type: "select",
                options: [
                  { value: "monitor", label: "Monitoring Only" },
                  { value: "enforce", label: "Strict Enforcement" },
                ],
                required: true,
              },
            ],
          },
        };
      } else if (
        lowercaseQuery.includes("agent") ||
        lowercaseQuery.includes("bot")
      ) {
        const agentData = {
          id: "alpha-1",
          name: "Alpha Arbitrage",
          status: "active",
          winRate: 0.72,
          totalReturn: 0.154,
          description:
            "High-frequency arbitrage agent monitoring top tier liquidity pools.",
        };

        mockResponse.component = {
          id: `comp-${interactionId}`,
          type: "agent",
          props: {},
          data: agentData,
        };

        // Store context for conversational memory
        mockResponse.newContext = {
          lastAgentId: agentData.id,
          lastAgentName: agentData.name,
        };
      }

      set((state) => ({
        isThinking: false,
        activeComponent: mockResponse.component,
        conversationalContext: {
          ...state.conversationalContext,
          ...mockResponse.newContext,
        },
        history: state.history.map((h) =>
          h.id === interactionId
            ? {
                ...h,
                status: "completed" as const,
                response: mockResponse.response,
                component: mockResponse.component || undefined,
              }
            : h,
        ),
      }));
    } catch (error) {
      console.error("Intent execution failed:", error);
      set((state) => ({
        isThinking: false,
        history: state.history.map((h) =>
          h.id === interactionId
            ? {
                ...h,
                status: "error" as const,
                response:
                  "Sorry, I encountered an error processing that intent.",
              }
            : h,
        ),
      }));
    }
  },
}));
