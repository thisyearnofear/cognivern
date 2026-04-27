export * from '../../../shared/types';

// ===== COMMON COMPONENT PROPS =====
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface LoadingProps {
  isLoading: boolean;
  error?: string | null;
}

export interface AgentComponentProps extends BaseComponentProps, LoadingProps {
  agentType: any; // Using any temporarily as AgentType is now imported
}
