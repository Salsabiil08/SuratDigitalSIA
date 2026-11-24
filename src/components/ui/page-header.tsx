import * as React from 'react';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('min-w-0 max-w-full flex flex-col sm:flex-row sm:flex-wrap gap-3 justify-between items-start sm:items-center pb-2', className)}>
      <div className="min-w-0 max-w-full">
        <h1 className="page-title-interactive break-words text-2xl sm:text-[26px] font-bold tracking-tight text-neutral-900 m-0">
          <span className="page-title-text">{title}</span>
          <span className="page-title-accent" aria-hidden="true" />
        </h1>
      </div>
      {actions && <div className="min-w-0 max-w-full flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}
