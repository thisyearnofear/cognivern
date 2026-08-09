import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  action?: ReactNode;
  className?: string;
}

/** Shared page title rhythm: one readable measure, one primary action. */
export function PageHeader({ title, description, eyebrow, action, className = "" }: PageHeaderProps) {
  return (
    <header className={`app-page-header flex-col sm:flex-row ${className}`}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-primary">{eyebrow}</p>}
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="app-page-description mt-1.5">{description}</p>}
      </div>
      {action && (
        <div className="flex shrink-0 items-center gap-2 flex-wrap sm:flex-nowrap">{action}</div>
      )}
    </header>
  );
}
