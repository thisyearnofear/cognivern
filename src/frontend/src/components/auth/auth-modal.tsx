"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { X, Mail, Wallet, ShieldCheck, Loader2 } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { EmailAuthForm } from "./email-auth-form";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/stores/auth-store";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  defaultMode?: "login" | "register";
}

export function AuthModal({ open, onClose, defaultMode = "login" }: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<"email" | "wallet">("email");
  const { address, isConnected } = useAccount();
  const { signIn, loading, error } = useAuth();
  const isAppAuthenticated = useAuthStore((state) => state.isConnected);

  const finishWalletSignIn = async () => {
    try {
      await signIn();
      onClose();
    } catch {
      // useAuth surfaces the failure in the modal and via toast.
    }
  };

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
            <h2 className="text-xl font-semibold" style={{ fontFamily: "var(--font-space-grotesk)" }}>
              {activeTab === "wallet" && isConnected && !isAppAuthenticated ? "Finish signing in" : "Sign in to Cognivern"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {activeTab === "wallet" && isConnected && !isAppAuthenticated
                ? "Your wallet is connected. One final step creates your Cognivern session."
                : "Choose how you want to authenticate"}
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
              {!isConnected || !address ? (
                <>
                  <div className="flex justify-center py-4">
                    <ConnectButton />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Connect your wallet first. You will then be asked to sign a message to authenticate.
                  </p>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-500" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Wallet connected</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">{address}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void finishWalletSignIn()}
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60"
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {loading ? "Waiting for signature…" : "Sign message to finish"}
                  </button>
                  <p className="text-center text-xs text-muted-foreground">
                    This is a gasless authentication signature. It does not move funds or submit a transaction.
                  </p>
                  {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
