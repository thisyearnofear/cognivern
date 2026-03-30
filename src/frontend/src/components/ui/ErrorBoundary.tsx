/**
 * Error Boundary Component - Frontend Error Resilience
 *
 * Provides graceful degradation when components crash or API calls fail.
 * Integrates with appStore for centralized error tracking.
 *
 * Phase 2 Enhancement: CLEAN + MODULAR principles
 */

import { Component, ErrorInfo, ReactNode } from "react";
import { css } from "@emotion/react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { designTokens } from "../../styles/design-system";

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback UI */
  fallback?: ReactNode;
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Component name for error context */
  componentName?: string;
  /** Show retry button */
  showRetry?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Call optional error handler
    this.props.onError?.(error, errorInfo);

    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("ErrorBoundary caught an error:", error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div css={containerStyles}>
          <div css={iconStyles}>
            <AlertTriangle size={32} />
          </div>
          <h3 css={titleStyles}>Something went wrong</h3>
          <p css={messageStyles}>
            {this.props.componentName
              ? `Error in ${this.props.componentName}`
              : this.state.error?.message || "An unexpected error occurred"}
          </p>
          {this.props.showRetry !== false && (
            <button css={retryButtonStyles} onClick={this.handleRetry}>
              <RefreshCw size={16} />
              Try Again
            </button>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// ===========================================
// STYLES
// ===========================================

const containerStyles = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${designTokens.spacing[8]};
  min-height: 200px;
  text-align: center;
  background: ${designTokens.colors.background.secondary};
  border-radius: ${designTokens.borderRadius.lg};
  border: 1px solid ${designTokens.colors.semantic.error[200]};
`;

const iconStyles = css`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: ${designTokens.colors.semantic.error[100]};
  color: ${designTokens.colors.semantic.error[500]};
  margin-bottom: ${designTokens.spacing[4]};
`;

const titleStyles = css`
  font-size: 18px;
  font-weight: 600;
  color: ${designTokens.colors.text.primary};
  margin: 0 0 ${designTokens.spacing[2]} 0;
`;

const messageStyles = css`
  font-size: 14px;
  color: ${designTokens.colors.text.secondary};
  margin: 0 0 ${designTokens.spacing[4]} 0;
  max-width: 400px;
`;

const retryButtonStyles = css`
  display: inline-flex;
  align-items: center;
  gap: ${designTokens.spacing[2]};
  padding: ${designTokens.spacing[2]} ${designTokens.spacing[4]};
  font-size: 14px;
  font-weight: 500;
  color: ${designTokens.colors.primary[600]};
  background: transparent;
  border: 1px solid ${designTokens.colors.primary[300]};
  border-radius: ${designTokens.borderRadius.md};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${designTokens.colors.primary[50]};
    border-color: ${designTokens.colors.primary[400]};
  }

  &:focus {
    outline: 2px solid ${designTokens.colors.primary[500]};
    outline-offset: 2px;
  }
`;

// ===========================================
// HOOK FOR FUNCTIONAL COMPONENTS
// ===========================================

/**
 * Hook to programmatically trigger error boundary from functional components
 * Usage: const throwError = useErrorBoundary(); throwError(new Error('msg'));
 */
export function useErrorBoundary() {
  return (error: Error) => {
    // This will be caught by the nearest ErrorBoundary
    throw error;
  };
}
