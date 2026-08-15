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
  // Credit program / participant statuses.
  active: "Active",
  draft: "Draft",
  paused: "Paused",
  closed: "Closed",
  suspended: "Suspended",
  revoked: "Revoked",
  // Disclosure tiers and gateway call statuses.
  open: "Open",
  detailed: "Detailed",
  standard: "Standard",
  private: "Private",
  ok: "Ok",
  upstream_error: "Upstream error",
};

const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  failed: "destructive",
  denied: "destructive",
  revoked: "destructive",
  closed: "destructive",
  completed: "secondary",
  approved: "secondary",
  paused: "secondary",
  detailed: "secondary",
  running: "default",
  active: "default",
  open: "default",
  ok: "default",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = variants[status] ?? "outline";
  return <Badge variant={variant} className={className}>{labels[status] || status.replaceAll("_", " ")}</Badge>;
}
