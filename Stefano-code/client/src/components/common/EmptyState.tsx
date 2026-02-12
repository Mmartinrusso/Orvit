import type { ReactNode } from 'react';
import { cn } from '@/utils';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
      {icon && <div className="mb-4 text-gray-400 dark:text-gray-500">{icon}</div>}
      <h3 className="text-lg font-medium text-gray-900 mb-1 dark:text-dark-text">{title}</h3>
      {description && <p className="text-sm text-gray-500 mb-4 max-w-sm dark:text-dark-text-secondary">{description}</p>}
      {action}
    </div>
  );
}
