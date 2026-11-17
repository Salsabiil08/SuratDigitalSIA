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
    <div className={cn('flex flex-wrap gap-4 justify-between items-center pb-2', className)}>
      <div>
        <h1 className="page-title-interactive text-2xl sm:text-[26px] font-bold tracking-tight text-neutral-900 m-0">
          <span className="page-title-text">{title}</span>
          <span className="page-title-accent" aria-hidden="true" />
        </h1>
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
