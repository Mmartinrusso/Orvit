import type { ReactNode } from 'react';
import { cn } from '@/utils';

interface CardProps {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
  onClick?: () => void | Promise<void>;
  icon?: ReactNode;
  actions?: ReactNode;
}

export function Card({ title, children, className, footer, onClick, icon, actions }: CardProps) {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      className={cn(
        'bg-white rounded-lg shadow-sm border border-gray-200 text-left w-full dark:bg-dark-surface dark:border-dark-border dark:text-dark-text',
        onClick && 'cursor-pointer hover:shadow-md transition-shadow',
        className
      )}
      onClick={onClick}
    >
      {(title || actions) && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-dark-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            {typeof title === 'string' ? (
              <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text">{title}</h3>
            ) : (
              title
            )}
          </div>
          {actions && <div>{actions}</div>}
        </div>
      )}
      <div className="p-4">{children}</div>
      {footer && (
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg dark:border-dark-border dark:bg-dark-hover">
          {footer}
        </div>
      )}
    </Component>
  );
}
