import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-lg font-extrabold text-ink sm:text-xl">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-7 text-ink-muted">
            {description}
          </p>
        ) : null}
        <span className="mt-2.5 block h-px w-10 bg-gradient-rose" />
      </div>
      {action ? <div className="flex shrink-0 gap-2">{action}</div> : null}
    </div>
  );
}
