'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number | null;
  max?: number;
  getValueLabel?: (value: number, max: number) => string;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = null, max = 100, getValueLabel, ...props }, ref) => {
    // Validar y normalizar el valor
    const normalizedMax = max && max > 0 ? max : 100;
    const normalizedValue = value !== null && value !== undefined 
      ? Math.max(0, Math.min(normalizedMax, value)) 
      : 0;
    const percentage = normalizedMax > 0 ? (normalizedValue / normalizedMax) * 100 : 0;

    return (
      <div
        ref={ref}
        className={cn(
          'relative h-4 w-full overflow-hidden rounded-full bg-secondary',
          className
        )}
        {...props}
      >
        <div
          className="h-full w-full flex-1 bg-primary transition-all"
          style={{ transform: `translateX(-${100 - percentage}%)` }}
        />
      </div>
    );
  }
);
Progress.displayName = 'Progress';

export { Progress };
