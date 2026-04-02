/**
 * User-Friendly Error Component
 *
 * Provides clear, actionable error messages with recovery paths.
 * Follows CLEAN + MODULAR principles.
 */

import React from "react";
import { css } from "@emotion/react";
import {
  AlertTriangle,
  RefreshCw,
  Home,
  ArrowLeft,
  Settings,
  WifiOff,
  Server,
  Clock,
  FileQuestion
} from "lucide-react";
import { designTokens } from "../../styles/design-system";
import { Button } from "./Button";

export type ErrorType =
  | "network"
  | "server"
  | "timeout"
  | "not_found"
  | "permission"
  | "validation"
  | "unknown";

export interface UserFriendlyErrorProps {
  errorType?: ErrorType;
  message?: string;
  title?: string;
  showRetry?: boolean;
  showBack?: boolean;
  showHome?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  onRetry?: () => void;
  onBack?: () => void;
  onHome?: () => void;
  details?: string;
  testId?: string;
}

const errorConfig: Record<ErrorType, {
  icon: React.ReactNode;
  title: string;
  message: string;
  suggestion: string;
}> = {
  network: {
    icon: <WifiOff size={32} />,
    title: "Connection Problem",
    message: "Unable to reach our servers",
    suggestion: "Check your internet connection and try again"
  },
  server: {
    icon: <Server size={32} />,
    title: "Server Issue",
    message: "Something went wrong on our end",
    suggestion: "This is usually temporary. Please try again in a few moments."
  },
  timeout: {
    icon: <Clock size={32} />,
    title: "Request Timeout",
    message: "The request took too long",
    suggestion: "Try refreshing the page or check your connection"
  },
  not_found: {
    icon: <FileQuestion size={32} />,
    title: "Not Found",
    message: "The page or resource you're looking for doesn't exist",
    suggestion: "It may have been moved or deleted"
  },
  permission: {
    icon: <Settings size={32} />,
    title: "Access Denied",
    message: "You don't have permission to view this",
    suggestion: "Contact your administrator if you need access"
  },
  validation: {
    icon: <AlertTriangle size={32} />,
    title: "Invalid Input",
    message: "Please check your input and try again",
    suggestion: "Make sure all required fields are filled correctly"
  },
  unknown: {
    icon: <AlertTriangle size={32} />,
    title: "Something Went Wrong",
    message: "An unexpected error occurred",
    suggestion: "Please try again or contact support if the problem persists"
  }
};

export const UserFriendlyError: React.FC<UserFriendlyErrorProps> = ({
  errorType = "unknown",
  message,
  title,
  showRetry = true,
  showBack = true,
  showHome = true,
  action,
  onRetry,
  onBack,
  onHome,
  details,
  testId
}) => {
  const config = errorConfig[errorType];

  return (
    <div
      css={containerStyles}
      data-testid={testId}
      role="alert"
      aria-live="polite"
    >
      <div css={iconContainerStyles(errorType)}>
        {config.icon}
      </div>

      <h3 css={titleStyles}>{title || config.title}</h3>
      <p css={messageStyles}>{message || config.message}</p>
      <p css={suggestionStyles}>{details || config.suggestion}</p>

      <div css={actionsStyles}>
        {showRetry && (
          <Button variant="primary" onClick={onRetry} icon={<RefreshCw size={16} />}>
            Try Again
          </Button>
        )}
        {showBack && (
          <Button variant="outline" onClick={onBack} icon={<ArrowLeft size={16} />}>
            Go Back
          </Button>
        )}
        {showHome && (
          <Button variant="ghost" onClick={onHome} icon={<Home size={16} />}>
            Home
          </Button>
        )}
        {action && (
          <Button variant="outline" onClick={action.onClick}>
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
};

const containerStyles = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${designTokens.spacing[8]};
  min-height: 300px;
  text-align: center;
  background: ${designTokens.colors.background.primary};
  border-radius: ${designTokens.borderRadius.xl};
  border: 1px solid ${designTokens.colors.neutral[200]};
  max-width: 480px;
  margin: ${designTokens.spacing[8]} auto;
`;

const iconContainerStyles = (errorType: ErrorType) => {
  const colorMap: Record<ErrorType, string> = {
    network: designTokens.colors.semantic.warning[500],
    server: designTokens.colors.semantic.error[500],
    timeout: designTokens.colors.semantic.warning[500],
    not_found: designTokens.colors.primary[500],
    permission: designTokens.colors.semantic.error[500],
    validation: designTokens.colors.semantic.warning[500],
    unknown: designTokens.colors.semantic.error[500],
  };

  return css`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: ${colorMap[errorType]}15;
    color: ${colorMap[errorType]};
    margin-bottom: ${designTokens.spacing[4]};
  `;
};

const titleStyles = css`
  font-size: ${designTokens.typography.fontSize.xl};
  font-weight: ${designTokens.typography.fontWeight.bold};
  color: ${designTokens.colors.text.primary};
  margin: 0 0 ${designTokens.spacing[2]} 0;
`;

const messageStyles = css`
  font-size: ${designTokens.typography.fontSize.base};
  color: ${designTokens.colors.text.secondary};
  margin: 0 0 ${designTokens.spacing[2]} 0;
  max-width: 360px;
`;

const suggestionStyles = css`
  font-size: ${designTokens.typography.fontSize.sm};
  color: ${designTokens.colors.text.secondary};
  margin: 0 0 ${designTokens.spacing[6]} 0;
  max-width: 360px;
  opacity: 0.8;
`;

const actionsStyles = css`
  display: flex;
  flex-wrap: wrap;
  gap: ${designTokens.spacing[3]};
  justify-content: center;
`;

export function useErrorTranslation() {
  return (error: unknown): ErrorType => {
    if (!error) return "unknown";
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("network") || errorMessage.includes("fetch") || errorMessage.includes("Failed to fetch")) {
      return "network";
    }
    if (errorMessage.includes("500") || errorMessage.includes("server") || errorMessage.includes("Internal Server Error")) {
      return "server";
    }
    if (errorMessage.includes("timeout") || errorMessage.includes("timed out")) {
      return "timeout";
    }
    if (errorMessage.includes("404") || errorMessage.includes("Not Found")) {
      return "not_found";
    }
    if (errorMessage.includes("403") || errorMessage.includes("Forbidden") || errorMessage.includes("unauthorized")) {
      return "permission";
    }
    if (errorMessage.includes("validation") || errorMessage.includes("invalid") || errorMessage.includes("400")) {
      return "validation";
    }
    return "unknown";
  };
}

export default UserFriendlyError;
