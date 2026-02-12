import type { ReactNode } from 'react';
import { cn } from '@/utils';

interface BadgeProps {
  variant?: 'success' | 'error' | 'warning' | 'info' | 'neutral' | 'secondary' | 'default' | 'danger';
  children: ReactNode;
  className?: string;
}

export function Badge({ variant = 'neutral', children, className }: BadgeProps) {
  const variants = {
    success: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    error: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
    info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    neutral: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300',
    secondary: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
    default: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300',
    danger: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
