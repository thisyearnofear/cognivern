import { Badge } from "@/components/ui/badge";

type StatusBadgeProps = { status: string; className?: string };

const labels: Record<string, string> = {
  paused_for_approval: "Awaiting approval",
  completed: "Completed",
  running: "Running",
  failed: "Failed",
  approved: "Approved",
  held: "Held",
  denied: "Denied",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = status === "failed" || status === "denied" ? "destructive" : status === "completed" || status === "approved" ? "secondary" : status === "running" ? "default" : "outline";
  return <Badge variant={variant} className={className}>{labels[status] || status.replaceAll("_", " ")}</Badge>;
}
