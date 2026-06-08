"use client";

import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { HELP_TEXT } from "@/lib/help-text";

export function HelpIcon({ helpKey }: { helpKey: string }) {
  const help = HELP_TEXT[helpKey];
  if (!help) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          type="button"
          className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px] text-center">
          <div>
            <div className="font-medium">{help.title}</div>
            <div className="opacity-80 mt-0.5">{help.body}</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
