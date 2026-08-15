import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface DisclosureSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

/** Keep secondary detail discoverable without competing with the page job. */
export function DisclosureSection({
  title,
  description,
  children,
  defaultOpen = false,
  className = '',
}: DisclosureSectionProps) {
  return (
    <details className={`group rounded-xl border bg-card ${className}`} open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-sm font-medium">{title}</span>
          {description && (
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
              {description}
            </span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border">{children}</div>
    </details>
  );
}
