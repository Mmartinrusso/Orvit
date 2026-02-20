'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ErrorMessageProps {
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

export function ErrorMessage({ error, onRetry, className }: ErrorMessageProps) {
  if (!error) return null;

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive',
        className
      )}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="flex-1">{error}</span>
      {onRetry && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-destructive hover:bg-destructive/20 hover:text-destructive"
          onClick={onRetry}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reintentar
        </Button>
      )}
    </div>
  );
}
