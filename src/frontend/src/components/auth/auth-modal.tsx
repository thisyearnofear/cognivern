"use client";

import { useState } from "react";
import { X, Mail, Wallet } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { EmailAuthForm } from "./email-auth-form";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  defaultMode?: "login" | "register";
}

export function AuthModal({ open, onClose, defaultMode = "login" }: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<"email" | "wallet">("email");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 text-white/80 hover:text-white transition-colors"
        >
          <X className="h-6 w-6" />
        </button>

        <div className="bg-card rounded-xl border border-border p-6 shadow-xl">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold" style={{ fontFamily: "var(--font-space-grotesk)" }}>Sign in to Cognivern</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Choose how you want to authenticate
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-lg mb-5">
            <button
              onClick={() => setActiveTab("email")}
              className={`flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "email"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Mail className="h-4 w-4" />
              Email
            </button>
            <button
              onClick={() => setActiveTab("wallet")}
              className={`flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "wallet"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Wallet className="h-4 w-4" />
              Wallet
            </button>
          </div>

          {activeTab === "email" ? (
            <EmailAuthForm
              mode={defaultMode}
              onSuccess={onClose}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex justify-center py-4">
                <ConnectButton />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Connect your wallet and sign a message to authenticate.
                Your wallet serves as your identity.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
