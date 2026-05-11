import { create } from 'zustand';
import apiService from '../services/apiService';

/**
 * Represents a dynamically generated UI component from the agent.
 * Maps to the component registry in the UI domain.
 */
export interface GeneratedUIComponent {
  id: string;
  type:
    | 'chart'
    | 'table'
    | 'stat'
    | 'action-form'
    | 'markdown'
    | 'status'
    | 'agent'
    | 'policy'
    | 'governance-score'
    | 'forensic-timeline';
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
  status: 'processing' | 'completed' | 'error';
  isFallback?: boolean;
}

/**
 * Represents a proactive suggestion based on system state or history.
 */
export interface Suggestion {
  id: string;
  label: string;
  intent: string;
  icon?: string;
  type: 'action' | 'query' | 'nav';
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
  query: '',
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
      id: 'sug-top-agents',
      label: 'Show top performing agents',
      intent: 'show top performing agents',
      icon: '🏆',
      type: 'query',
    });

    suggestions.push({
      id: 'sug-safety-health',
      label: 'Check system safety health',
      intent: 'show safety health score',
      icon: '🛡️',
      type: 'query',
    });

    // Rule 2: Context-aware follow-ups
    const lastInteraction = history[0];
    const { conversationalContext } = get();

    if (lastInteraction?.status === 'completed' && lastInteraction.query.includes('start')) {
      suggestions.push({
        id: 'sug-forensics',
        label: 'Examine execution traces',
        intent: 'show forensic traces',
        icon: '🔬',
        type: 'query',
      });
    }

    if (conversationalContext.lastAgentId) {
      suggestions.push({
        id: 'sug-start-last',
        label: `Start ${conversationalContext.lastAgentName}`,
        intent: `start ${conversationalContext.lastAgentName}`,
        icon: '▶️',
        type: 'action',
      });
    }

    if (lastInteraction?.status === 'completed') {
      if (lastInteraction.query.includes('create') || lastInteraction.query.includes('agent')) {
        suggestions.push({
          id: 'sug-performance',
          label: 'Check agent performance',
          intent: 'show performance stats',
          icon: '📈',
          type: 'query',
        });
      }
    } else {
      // Default actions if no history or specific context
      suggestions.push({
        id: 'sug-create-agent',
        label: 'Deploy a new trading bot',
        intent: 'create new agent',
        icon: '➕',
        type: 'action',
      });

      suggestions.push({
        id: 'sug-risk-mgmt',
        label: 'Setup Trading Risk Management',
        intent: 'apply trading risk policy',
        icon: '🛡️',
        type: 'action',
      });

      suggestions.push({
        id: 'sug-security-baseline',
        label: 'Apply Security Foundation',
        intent: 'setup security baseline',
        icon: '🔒',
        type: 'action',
      });

      suggestions.push({
        id: 'sug-audit',
        label: 'Review audit logs',
        intent: 'show audit logs',
        icon: '📝',
        type: 'nav',
      });
    }

    set({ suggestions });
  },

  clearActiveIntent: () =>
    set({
      activeComponent: null,
      isThinking: false,
      query: '',
    }),

  clearHistory: () => set({ history: [], conversationalContext: {}, suggestions: [] }),

  clearConversationalContext: () => set({ conversationalContext: {} }),

  submitIntent: async (query: string) => {
    if (!query.trim()) return;

    const interactionId = crypto.randomUUID();
    const newInteraction: IntentInteraction = {
      id: interactionId,
      timestamp: Date.now(),
      query,
      status: 'processing',
    };

    set((state) => ({
      isThinking: true,
      query: '', // Clear input after submission
      history: [newInteraction, ...state.history],
    }));

    try {
      const { conversationalContext } = get();

      // Call real backend API for intent processing
      const response = await apiService.post<{
        success: boolean;
        data: {
          type: string;
          response: string;
          component?: {
            type: string;
            props?: Record<string, any>;
            data?: any;
          };
          context?: Record<string, any>;
          suggestions?: string[];
        };
      }>('/intent', {
        query,
        context: conversationalContext,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to process intent');
      }

      const { data } = response;

      // Convert API response to UI component
      let component: GeneratedUIComponent | null = null;
      if (data.component) {
        component = {
          id: `comp-${interactionId}`,
          type: data.component.type as GeneratedUIComponent['type'],
          props: data.component.props || {},
          data: data.component.data,
        };
      }

      const isFallback = (data as any)._fallback === true;

      set((state) => ({
        isThinking: false,
        activeComponent: component,
        conversationalContext: {
          ...state.conversationalContext,
          ...data.context,
        },
        history: state.history.map((h) =>
          h.id === interactionId
            ? {
                ...h,
                status: 'completed' as const,
                response: data.response,
                component: component || undefined,
                isFallback,
              }
            : h
        ),
      }));

      // Log fallback usage for monitoring
      if (isFallback) {
        console.warn('Intent processing using fallback - AI service may be unavailable');
      }
    } catch (error) {
      console.error('Intent execution failed:', error);
      set((state) => ({
        isThinking: false,
        history: state.history.map((h) =>
          h.id === interactionId
            ? {
                ...h,
                status: 'error' as const,
                response:
                  'Sorry, I encountered an error. The AI service may be temporarily unavailable. Please try again.',
              }
            : h
        ),
      }));
    }
  },
}));
