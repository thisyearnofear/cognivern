"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { History, RotateCcw, Loader2, Clock } from "lucide-react";
import { apiClient, type PolicyVersion } from "@/lib/api-client";
import { mutate } from "swr";

interface PolicyVersionHistoryProps {
  policyId: string;
  policyName: string;
  open: boolean;
  onClose: () => void;
}

export function PolicyVersionHistory({
  policyId,
  policyName,
  open,
  onClose,
}: PolicyVersionHistoryProps) {
  const [versions, setVersions] = useState<PolicyVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getPolicyVersions(policyId);
      if (res.success && res.data) {
        setVersions(res.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load versions");
    } finally {
      setLoading(false);
    }
  }, [policyId]);

  useEffect(() => {
    if (open && !fetchedRef.current) {
      fetchedRef.current = true;
      void fetchVersions();
    }
    if (!open) {
      fetchedRef.current = false;
    }
  }, [open, fetchVersions]);

  const handleRollback = useCallback(
    async (versionId: string) => {
      setRollingBack(versionId);
      setError(null);
      try {
        const res = await apiClient.rollbackPolicy(policyId, versionId);
        if (res.success) {
          await fetchVersions();
          mutate("/api/governance/policies");
        } else {
          setError(res.error || "Rollback failed");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Rollback failed");
      } finally {
        setRollingBack(null);
      }
    },
    [policyId, fetchVersions],
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Version History
          </DialogTitle>
          <DialogDescription>
            History for <span className="font-medium">{policyName}</span>
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/30 text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No version history yet
            </div>
          ) : (
            versions.map((v, i) => {
              const isLatest = i === 0;
              const isRollingBack = rollingBack === v.id;
              return (
                <div
                  key={v.id}
                  className={`p-3 rounded-lg border transition-colors ${
                    isLatest
                      ? "border-primary/30 bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={isLatest ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        v{v.version}
                      </Badge>
                      {isLatest && (
                        <span className="text-[10px] text-primary font-medium">
                          current
                        </span>
                      )}
                    </div>
                    {!isLatest && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRollback(v.id)}
                        disabled={rollingBack !== null}
                        className="h-7 gap-1 text-xs"
                      >
                        {isRollingBack ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3 w-3" />
                        )}
                        Rollback
                      </Button>
                    )}
                  </div>
                  <div className="text-sm font-medium">{v.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {v.description}
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(v.snapshotAt).toLocaleString()}
                    <span>·</span>
                    <span>
                      {v.rules.length} rule{v.rules.length !== 1 ? "s" : ""}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {v.status}
                    </Badge>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
