import { AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';

export interface AttentionSummaryItem {
  label: string;
  count: number;
}

interface AttentionSummaryProps {
  tone: 'attention' | 'healthy';
  title: string;
  description: string;
  items?: AttentionSummaryItem[];
  action?: {
    label: string;
    onClick: () => void;
  };
  trailing?: ReactNode;
}

/**
 * Shared operational status treatment. Keep the next safe action adjacent to
 * the current state so routes answer "what needs my attention?" first.
 */
export function AttentionSummary({
  tone,
  title,
  description,
  items = [],
  action,
  trailing,
}: AttentionSummaryProps) {
  const isAttention = tone === 'attention';

  return (
    <section
      aria-label={isAttention ? 'Needs attention' : 'Operational status'}
      className={`rounded-xl border px-4 py-3.5 sm:px-5 ${
        isAttention
          ? 'border-amber-500/30 bg-amber-500/5'
          : 'border-emerald-500/25 bg-emerald-500/5'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            isAttention
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          }`}
        >
          {isAttention ? (
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="text-sm font-semibold">{title}</h2>
            {items.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5" aria-label="Attention counts">
                {items.map((item) => (
                  <span
                    key={item.label}
                    className="rounded-full border border-current/15 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                  >
                    {item.count} {item.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>

        {trailing}
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
              isAttention
                ? 'bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:text-amber-950 dark:hover:bg-amber-400'
                : 'border border-border bg-background text-foreground hover:bg-muted'
            }`}
          >
            {action.label}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  );
}
