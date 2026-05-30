"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { EmailAuthForm } from "./email-auth-form";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  defaultMode?: "login" | "register";
}

export function AuthModal({ open, onClose, defaultMode = "login" }: AuthModalProps) {
  const [showEmailAuth, setShowEmailAuth] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 text-white/80 hover:text-white transition-colors"
        >
          <X className="h-6 w-6" />
        </button>

        {showEmailAuth ? (
          <EmailAuthForm
            mode={defaultMode}
            onSuccess={onClose}
            onWalletFallback={() => setShowEmailAuth(false)}
          />
        ) : (
          <div className="bg-card rounded-xl border border-border p-6 shadow-xl">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold">Sign in to Cognivern</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Connect your wallet or use email
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => setShowEmailAuth(true)}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg border border-border hover:bg-accent transition-colors"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="font-medium">Continue with Email</span>
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    or
                  </span>
                </div>
              </div>

              <p className="text-center text-sm text-muted-foreground">
                For wallet connection, please use the{" "}
                <a href="/onboarding" className="text-primary hover:underline">
                  onboarding flow
                </a>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
