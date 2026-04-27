/**
 * Error Boundary Component - Frontend Error Resilience
 *
 * Provides graceful degradation when components crash or API calls fail.
 * Integrates with appStore for centralized error tracking.
 *
 * Phase 2 Enhancement: CLEAN + MODULAR principles
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { UserFriendlyError } from './UserFriendlyError';

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

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
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
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
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

      // Default error UI using UserFriendlyError
      return (
        <UserFriendlyError
          errorType={this.getErrorType()}
          title="Something went wrong"
          message={
            this.props.componentName
              ? `Error in ${this.props.componentName}`
              : this.state.error?.message || 'An unexpected error occurred'
          }
          showRetry={this.props.showRetry !== false}
          onRetry={this.handleRetry}
          onHome={() => (window.location.href = '/')}
          onBack={() => window.history.back()}
        />
      );
    }

    return this.props.children;
  }

  private getErrorType() {
    if (!this.state.error) return 'unknown';
    const errorMessage = this.state.error.message;

    if (
      errorMessage.includes('network') ||
      errorMessage.includes('fetch') ||
      errorMessage.includes('Failed to fetch')
    ) {
      return 'network';
    }
    if (
      errorMessage.includes('500') ||
      errorMessage.includes('server') ||
      errorMessage.includes('Internal Server Error')
    ) {
      return 'server';
    }
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      return 'timeout';
    }
    if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
      return 'not_found';
    }
    if (
      errorMessage.includes('403') ||
      errorMessage.includes('Forbidden') ||
      errorMessage.includes('unauthorized')
    ) {
      return 'permission';
    }
    if (
      errorMessage.includes('validation') ||
      errorMessage.includes('invalid') ||
      errorMessage.includes('400')
    ) {
      return 'validation';
    }
    return 'unknown';
  }
}

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
