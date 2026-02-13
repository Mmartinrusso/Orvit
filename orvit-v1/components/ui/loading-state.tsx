/**
 * Loading State Components
 * Provides consistent loading indicators across the app
 */

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

/**
 * Full page or section loading state
 */
export function LoadingState({
  message = 'Cargando...',
  size = 'md',
  className,
}: LoadingStateProps) {
  return (
    <div className={cn('flex items-center justify-center p-12', className)}>
      <div className="text-center">
        <Loader2 className={cn('animate-spin text-primary mx-auto mb-3', sizeClasses[size])} />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

/**
 * Inline loading state (for buttons, cards, etc)
 */
export function InlineLoadingState({
  message = 'Cargando...',
  size = 'sm',
  className,
}: LoadingStateProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Loader2 className={cn('animate-spin text-muted-foreground', sizeClasses[size])} />
      <span className="text-sm text-muted-foreground">{message}</span>
    </div>
  );
}

/**
 * Loading button content
 */
interface LoadingButtonProps {
  isLoading: boolean;
  loadingText?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export function LoadingButtonContent({
  isLoading,
  loadingText = 'Guardando...',
  children,
  icon,
}: LoadingButtonProps) {
  if (isLoading) {
    return (
      <span className="flex items-center gap-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {loadingText}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5">
      {icon}
      {children}
    </span>
  );
}

/**
 * Loading overlay (for table rows, cards, etc)
 */
interface LoadingOverlayProps {
  isLoading: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingOverlay({
  isLoading,
  size = 'md',
  className,
}: LoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <div className={cn(
      'absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-lg z-10',
      className
    )}>
      <Loader2 className={cn('animate-spin text-primary', sizeClasses[size])} />
    </div>
  );
}

/**
 * Table loading skeleton
 */
interface TableLoadingStateProps {
  rows?: number;
  columns?: number;
}

export function TableLoadingState({ rows = 5, columns = 5 }: TableLoadingStateProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <td key={colIndex} className="p-3">
              <div className="h-4 bg-muted/50 rounded animate-pulse" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
