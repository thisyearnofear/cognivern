import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpinnerProps {
  className?: string;
  /**
   * Visual size variant. Mirrors the inline spinner used in the sidebar
   * sign-in button so the Copilot Run button has the same affordance.
   */
  tone?: "default" | "inverted";
}

export function Spinner({ className, tone = "default" }: SpinnerProps) {
  return (
    <Loader2
      className={cn(
        "h-4 w-4 animate-spin",
        tone === "inverted" ? "text-white" : "text-current",
        className,
      )}
      aria-hidden="true"
    />
  );
}
