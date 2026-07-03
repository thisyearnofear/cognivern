"use client";

import { Badge } from "@/components/ui/badge";
import type { SealedBidBackendName } from "@/lib/api-client";

// Small chip that surfaces which sealed-bid backend a round runs on.
// Canton gets the loud variant because it's the differentiator; FHE stays
// neutral so it doesn't fight for attention on rounds that pre-date the
// Canton rollout.
export function BackendBadge({
  backend,
  className,
}: {
  backend?: SealedBidBackendName;
  className?: string;
}) {
  if (!backend) {
    return (
      <Badge variant="outline" className={className}>
        legacy
      </Badge>
    );
  }
  if (backend === "canton") {
    return (
      <Badge
        variant="default"
        className={`bg-emerald-600 hover:bg-emerald-600 ${className ?? ""}`}
      >
        Canton
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className={className}>
      FHE
    </Badge>
  );
}
