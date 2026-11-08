'use client';

import { ShieldCheck } from 'lucide-react';
import {
  decisionLayer,
  type DecisionLayer as Layer,
  type NormalizedAuditLog,
} from '@/lib/normalizers';

const LAYERS: Array<{ id: Layer; label: string; className: string }> = [
  { id: 'policy', label: 'Policy blocks', className: 'bg-red-500' },
  { id: 'evaluation', label: 'Evaluation denials', className: 'bg-orange-500' },
  { id: 'escalation', label: 'Escalated to human', className: 'bg-amber-500' },
  { id: 'cleared', label: 'Cleared all layers', className: 'bg-emerald-500' },
];

/**
 * Defense-in-depth strip: which layer produced each recorded decision.
 * Makes the model-vs-enforcement story visible — a violation stopped by a
 * deterministic policy check reads differently from one the aggregate
 * evaluation denied, and held items show the human gate doing its job.
 */
export function DecisionProvenance({ logs }: { logs: NormalizedAuditLog[] }) {
  if (logs.length === 0) return null;
  const counts = LAYERS.map((layer) => ({
    ...layer,
    count: logs.filter((log) => decisionLayer(log) === layer.id).length,
  }));
  const total = logs.length;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Decision provenance</h3>
        <span className="ml-auto text-xs text-muted-foreground">
          which layer decided each action
        </span>
      </div>
      <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-muted">
        {counts.map((layer) =>
          layer.count > 0 ? (
            <div
              key={layer.id}
              className={layer.className}
              style={{ width: `${(layer.count / total) * 100}%` }}
              title={`${layer.label}: ${layer.count}`}
            />
          ) : null,
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {counts.map((layer) => (
          <span key={layer.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${layer.className}`} />
            {layer.label}
            <span className="font-mono text-foreground">{layer.count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
