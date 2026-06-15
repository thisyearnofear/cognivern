"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { KeyRound, Eye, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";

interface PermitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  decisionId: string;
  policyId: string;
}

interface PermitResult {
  permit: string;
  auditor: string;
  policyId: string;
  scope: string[];
  note?: string;
}

interface DecryptResult {
  decisionId: string;
  dailyLimit: string;
  spentToday: string;
  outcome: string;
  note?: string;
}

export function PermitDialog({
  open,
  onOpenChange,
  decisionId,
  policyId,
}: PermitDialogProps) {
  const [mode, setMode] = useState<"create" | "decrypt">("create");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permit, setPermit] = useState<PermitResult | null>(null);
  const [permitInput, setPermitInput] = useState("");
  const [decrypted, setDecrypted] = useState<DecryptResult | null>(null);

  const handleCreatePermit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/audit/permits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyId }),
      });
      const json = await res.json();
      if (json.success) {
        setPermit(json.data);
      } else {
        setError(json.error || "Failed to create permit");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleDecrypt = async () => {
    if (!permitInput.trim()) {
      setError("Please enter a permit");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/audit/logs/${decisionId}/decrypt`, {
        headers: { "X-Audit-Permit": permitInput.trim() },
      });
      const json = await res.json();
      if (json.success) {
        setDecrypted(json.data);
      } else {
        setError(json.error || "Failed to decrypt");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setMode("create");
    setLoading(false);
    setError(null);
    setPermit(null);
    setPermitInput("");
    setDecrypted(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-amber-500" />
            CoFHE Auditor Permit
          </DialogTitle>
          <DialogDescription>
            Create or use a permit to decrypt confidential policy evaluation data
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-2 p-1 rounded-lg bg-muted">
            <button
              onClick={() => setMode("create")}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === "create"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Create Permit
            </button>
            <button
              onClick={() => setMode("decrypt")}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === "decrypt"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Decrypt with Permit
            </button>
          </div>

          {/* Create mode */}
          {mode === "create" && !permit && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Generate an auditor permit to decrypt confidential policy
                thresholds for this decision.
              </div>
              <div className="text-xs space-y-1">
                <div>
                  <span className="text-muted-foreground">Decision ID:</span>{" "}
                  <code className="font-mono text-foreground/70">{decisionId}</code>
                </div>
                <div>
                  <span className="text-muted-foreground">Policy ID:</span>{" "}
                  <code className="font-mono text-foreground/70">{policyId}</code>
                </div>
              </div>
            </div>
          )}

          {mode === "create" && permit && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                Permit created successfully
              </div>
              <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-2">
                <div className="text-xs">
                  <span className="text-muted-foreground">Permit:</span>
                  <code className="ml-2 font-mono text-foreground/80 break-all">
                    {permit.permit}
                  </code>
                </div>
                {permit.scope && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Scope:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {permit.scope.map((s) => (
                        <Badge key={s} variant="outline" className="text-[10px]">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {permit.note && (
                  <div className="text-xs text-muted-foreground italic">
                    {permit.note}
                  </div>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                Copy this permit and use it in the &ldquo;Decrypt with Permit&rdquo; tab to
                view encrypted values.
              </div>
            </div>
          )}

          {/* Decrypt mode */}
          {mode === "decrypt" && !decrypted && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Paste your auditor permit to decrypt confidential values for
                this decision.
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Permit</label>
                <Input
                  value={permitInput}
                  onChange={(e) => setPermitInput(e.target.value)}
                  placeholder="0x..."
                  className="font-mono text-sm"
                />
              </div>
            </div>
          )}

          {mode === "decrypt" && decrypted && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                <Eye className="h-4 w-4" />
                Decrypted via CoFHE
              </div>
              <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
                <div className="text-xs">
                  <span className="text-muted-foreground">Daily Limit:</span>
                  <code className="ml-2 font-mono text-foreground/80 break-all">
                    {decrypted.dailyLimit}
                  </code>
                </div>
                <div className="text-xs">
                  <span className="text-muted-foreground">Spent Today:</span>
                  <code className="ml-2 font-mono text-foreground/80 break-all">
                    {decrypted.spentToday}
                  </code>
                </div>
                <div className="text-xs">
                  <span className="text-muted-foreground">Outcome:</span>
                  <Badge
                    variant={
                      decrypted.outcome === "approve"
                        ? "secondary"
                        : decrypted.outcome === "deny"
                          ? "destructive"
                          : "outline"
                    }
                    className="ml-2 text-[10px]"
                  >
                    {decrypted.outcome}
                  </Badge>
                </div>
                {decrypted.note && (
                  <div className="text-xs text-muted-foreground italic pt-1 border-t border-border">
                    {decrypted.note}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          {mode === "create" && !permit && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleCreatePermit} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Generate Permit
              </Button>
            </>
          )}
          {mode === "create" && permit && (
            <Button onClick={handleClose}>Close</Button>
          )}
          {mode === "decrypt" && !decrypted && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleDecrypt} disabled={loading || !permitInput.trim()}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Decrypt
              </Button>
            </>
          )}
          {mode === "decrypt" && decrypted && (
            <Button onClick={handleClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
