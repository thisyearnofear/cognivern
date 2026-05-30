"use client";

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, HelpCircle, Mail } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex flex-col items-center justify-center gap-4 p-12 text-center border border-destructive/20 rounded-xl bg-destructive/5">
          <div className="p-4 rounded-full bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Something went wrong</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              {this.state.error?.message ||
                "An unexpected error occurred while loading this page."}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <Button
              variant="outline"
              onClick={() => {
                this.setState({ hasError: false, error: undefined });
                window.location.reload();
              }}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reload Page
            </Button>
            <Button
              variant="ghost"
              onClick={() => window.open("https://docs.cognivern.xyz", "_blank")}
              className="gap-1.5"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              View Docs
            </Button>
            <Button
              variant="ghost"
              onClick={() => window.open("mailto:support@cognivern.xyz", "_blank")}
              className="gap-1.5"
            >
              <Mail className="h-3.5 w-3.5" />
              Contact Support
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
