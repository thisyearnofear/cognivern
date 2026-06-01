"use client";

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  HelpCircle,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  onError — reusable callback for external logging (Sentry, etc.)  */
/* ------------------------------------------------------------------ */
export function onError(error: Error, info: React.ErrorInfo) {
  // Log to console in development
  if (process.env.NODE_ENV === "development") {
    console.error(
      "[ErrorBoundary]",
      error.message,
      "\nComponent stack:",
      info.componentStack,
    );
  }
}

/* ------------------------------------------------------------------ */
/*  ErrorBoundary                                                     */
/* ------------------------------------------------------------------ */
interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, copied: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, copied: false };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    onError(error, info);
  }

  private handleCopyError = async () => {
    const { error } = this.state;
    const text = error
      ? `${error.name}: ${error.message}\n\n${error.stack ?? ""}`
      : "Unknown error";
    try {
      await navigator.clipboard.writeText(text);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      // Fallback for older browsers / insecure contexts
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    }
  };

  private handleReload = () => {
    this.setState({ hasError: false, error: undefined, copied: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorMessage =
        this.state.error?.message ||
        "An unexpected error occurred while loading this page.";

      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-5 p-8 text-center bg-zinc-900 rounded-xl border border-zinc-800">
          {/* Icon */}
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-zinc-800 border border-zinc-700">
            <AlertTriangle className="w-7 h-7 text-amber-400" />
          </div>

          {/* Heading & message */}
          <div className="space-y-2 max-w-md">
            <h2 className="text-xl font-semibold text-zinc-100 tracking-tight">
              Something went wrong
            </h2>
            <p className="text-sm leading-relaxed text-zinc-400 font-[family-name:var(--font-geist-mono)]">
              {errorMessage}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <Button
              variant="outline"
              onClick={this.handleReload}
              className="gap-2 bg-zinc-800 border-zinc-700 text-zinc-100 hover:bg-zinc-700 hover:text-white"
            >
              <RefreshCw className="w-4 h-4" />
              Reload page
            </Button>

            <Button
              variant="outline"
              onClick={this.handleCopyError}
              className="gap-2 bg-zinc-800 border-zinc-700 text-zinc-100 hover:bg-zinc-700 hover:text-white"
            >
              {this.state.copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy error
                </>
              )}
            </Button>

            <Button
              variant="ghost"
              onClick={() =>
                window.open("https://docs.cognivern.xyz", "_blank")
              }
              className="gap-2 text-zinc-400 hover:text-zinc-100"
            >
              <HelpCircle className="w-4 h-4" />
              Docs
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
