"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, HelpCircle, Mail } from "lucide-react";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message = "We couldn't load this data. Please try again or contact support if the problem persists.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 p-8 text-center border border-destructive/20 rounded-xl bg-destructive/5 ${className || ""}`}>
      <div className="p-3 rounded-full bg-destructive/10">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <div className="space-y-1">
        <h3 className="font-semibold text-foreground" style={{ fontFamily: "var(--font-space-grotesk)" }}>{title}</h3>
        <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap justify-center">
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try Again
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.open("https://github.com/thisyearnofear/cognivern", "_blank")}
          className="gap-1.5"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          View Docs
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.open("https://github.com/thisyearnofear/cognivern/issues", "_blank")}
          className="gap-1.5"
        >
          <Mail className="h-3.5 w-3.5" />
          Report Issue
        </Button>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title = "No data yet",
  description = "Get started by creating your first item.",
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 p-8 text-center ${className || ""}`}>
      {icon && (
        <div className="p-4 rounded-full bg-muted">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <h3 className="font-medium text-foreground" style={{ fontFamily: "var(--font-space-grotesk)" }}>{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action && (
        <Button onClick={action.onClick} className="gap-1.5 mt-2">
          {action.icon}
          {action.label}
        </Button>
      )}
    </div>
  );
}
