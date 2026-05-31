"use client";

import { useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  Plus,
  Check,
  Loader2,
  Building2,
} from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { apiClient, type Workspace } from "@/lib/api-client";
import { mutate } from "swr";

export function WorkspaceSwitcher() {
  const user = useAppStore((s) => s.user);
  const setWorkspaces = useAppStore((s) => s.setWorkspaces);
  const switchWorkspace = useAppStore((s) => s.switchWorkspace);
  const demoMode = useAppStore((s) => s.demoMode);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const workspaces = user.workspaces || [];
  const currentWorkspace = user.workspace;

  const fetchWorkspaces = useCallback(async () => {
    if (demoMode || !user.isConnected) return;
    setLoading(true);
    try {
      const res = await apiClient.listWorkspaces();
      if (res.success && res.data) {
        setWorkspaces(res.data);
      }
    } finally {
      setLoading(false);
    }
  }, [demoMode, user.isConnected, setWorkspaces]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (nextOpen && workspaces.length === 0 && !fetchedRef.current) {
        fetchedRef.current = true;
        void fetchWorkspaces();
      }
    },
    [workspaces.length, fetchWorkspaces],
  );

  const handleSwitch = useCallback(
    async (ws: Workspace) => {
      if (ws.id === currentWorkspace?.id) {
        setOpen(false);
        return;
      }
      setSwitching(ws.id);
      setError(null);
      try {
        const res = await apiClient.switchWorkspace(ws.id);
        if (res.success && res.data) {
          switchWorkspace(res.data.workspace, res.data.token);
          setOpen(false);
          // Refresh all data for the new workspace
          mutate(() => true);
        } else {
          setError(res.error || "Failed to switch workspace");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to switch");
      } finally {
        setSwitching(null);
      }
    },
    [currentWorkspace?.id, switchWorkspace],
  );

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await apiClient.createWorkspace({ name: newName.trim() });
      if (res.success && res.data) {
        setNewName("");
        setShowCreate(false);
        // Refresh workspace list
        await fetchWorkspaces();
      } else {
        setError(res.error || "Failed to create workspace");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }, [newName, fetchWorkspaces]);

  if (demoMode || !user.isConnected) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
      >
        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate">
            {currentWorkspace?.name || "Select workspace"}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {currentWorkspace?.tier === "live" ? "Production" : "Sandbox"}
          </div>
        </div>
        <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Switch Workspace</DialogTitle>
            <DialogDescription>
              Select a workspace or create a new one
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-64 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : workspaces.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                No workspaces found
              </div>
            ) : (
              workspaces.map((ws) => {
                const isCurrent = ws.id === currentWorkspace?.id;
                const isSwitching = switching === ws.id;
                return (
                  <button
                    key={ws.id}
                    onClick={() => handleSwitch(ws)}
                    disabled={isSwitching}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                      isCurrent
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-md ${
                        ws.tier === "live"
                          ? "bg-emerald-100 dark:bg-emerald-950"
                          : "bg-stone-100 dark:bg-stone-800"
                      }`}
                    >
                      <Building2
                        className={`h-4 w-4 ${
                          ws.tier === "live"
                            ? "text-emerald-600"
                            : "text-stone-500"
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {ws.name}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge
                          variant={
                            ws.tier === "live" ? "default" : "secondary"
                          }
                          className="text-[10px]"
                        >
                          {ws.tier}
                        </Badge>
                        {ws.role && (
                          <span className="text-[10px] text-muted-foreground">
                            {ws.role}
                          </span>
                        )}
                      </div>
                    </div>
                    {isCurrent ? (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    ) : isSwitching ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>

          {error && (
            <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/30 text-xs text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {showCreate ? (
            <div className="space-y-2 pt-2 border-t">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Workspace name"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleCreate}
                  disabled={!newName.trim() || creating}
                  className="gap-1.5"
                >
                  {creating ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                  Create
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowCreate(false);
                    setNewName("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreate(true)}
              className="w-full gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              New Workspace
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
