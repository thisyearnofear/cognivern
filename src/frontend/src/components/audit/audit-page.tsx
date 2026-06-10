"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, Clock, FileSearch, PlayCircle, Users, Shield, Lock, Fingerprint } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuditLogs } from "@/hooks/use-api";
import {
  normalizeAuditLogs,
  computeComplianceRate,
  computeAverageLatency,
} from "@/lib/normalizers";

export function AuditPage() {
  const router = useRouter();
  const { data: rawLogs, isLoading, error } = useAuditLogs();

  const logs = normalizeAuditLogs(rawLogs);
  const total = logs.length;
  const compliance = computeComplianceRate(logs);
  const avgLatency = computeAverageLatency(logs);
  const critical = logs.filter((l) => l.decision === "denied").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Complete governance audit trail
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {isLoading ? (
          [1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-12 w-24" />
              </CardContent>
            </Card>
          ))
        ) : error ? (
          <div className="col-span-4 p-8 text-center text-muted-foreground border rounded-xl">
            <p>Failed to load audit logs</p>
            <p className="text-xs mt-1">The backend may be unavailable</p>
          </div>
        ) : (
          <>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{total}</div>
                <div className="text-xs text-muted-foreground">
                  Total Actions
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{compliance}%</div>
                <div className="text-xs text-muted-foreground">
                  Compliance Rate
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{avgLatency}ms</div>
                <div className="text-xs text-muted-foreground">
                  Avg Response
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{critical}</div>
                <div className="text-xs text-muted-foreground">
                  Critical Issues
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Security Architecture */}
      <Card className="bg-muted/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-emerald-500" />
            <h2 className="font-semibold text-sm">Security Architecture</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {[
              { icon: Fingerprint, label: "Auth", value: "SIWE + JWT with nonce replay" },
              { icon: Lock, label: "API Keys", value: "scrypt hashed, scoped permissions" },
              { icon: Shield, label: "Rate Limiting", value: "3 layers (global, workspace, per-key)" },
              { icon: Lock, label: "Encryption", value: "Fhenix FHE on-chain evaluation" },
              { icon: Shield, label: "Audit", value: "Immutable on Filecoin / 0G" },
              { icon: Shield, label: "Contract Audit", value: "ChainGPT scan on recipients" },
            ].map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="flex items-center gap-2 text-muted-foreground"
              >
                <Icon className="h-3 w-3 text-emerald-500 shrink-0" />
                <span>
                  <span className="font-medium text-foreground">{label}:</span>{" "}
                  {value}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Log Timeline */}
      {!error && logs.length === 0 && !isLoading ? (
        <div className="p-12 text-center border rounded-xl">
          <FileSearch className="h-8 w-8 mx-auto mb-3 opacity-50 text-muted-foreground" />
          <p className="font-medium">No audit logs yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            Activity will appear here as governed agents execute spends. Register an agent and run a governance check to see your first audit entry.
          </p>
          <div className="flex items-center justify-center gap-3 mt-6">
            <Button variant="outline" onClick={() => router.push("/governance/check")}>
              <PlayCircle className="h-3.5 w-3.5 mr-1.5" /> Run a Check
            </Button>
            <Button variant="outline" onClick={() => router.push("/agents/workshop")}>
              <Users className="h-3.5 w-3.5 mr-1.5" /> Register Agent
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-start gap-3 sm:gap-4">
                <div
                  className={`p-2 rounded-lg flex-shrink-0 ${
                    log.decision === "approved"
                      ? "bg-emerald-100 dark:bg-emerald-950"
                      : log.decision === "denied"
                        ? "bg-red-100 dark:bg-red-950"
                        : "bg-amber-100 dark:bg-amber-950"
                  }`}
                >
                  {log.decision === "approved" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : log.decision === "denied" ? (
                    <XCircle className="h-4 w-4 text-red-600" />
                  ) : (
                    <Clock className="h-4 w-4 text-amber-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-sm">{log.agent}</span>
                    <Badge variant="outline" className="text-xs">
                      {log.action}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {log.chain}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {log.description}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 sm:ml-auto pl-10 sm:pl-0">
                <Badge
                  variant={
                    log.decision === "approved"
                      ? "secondary"
                      : log.decision === "denied"
                        ? "destructive"
                        : "outline"
                  }
                >
                  {log.decision}
                </Badge>
                <span className="text-xs text-muted-foreground font-mono">
                  {log.latency}
                </span>
                <span className="text-xs text-muted-foreground">
                  {log.time}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
