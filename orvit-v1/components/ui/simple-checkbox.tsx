'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SimpleCheckboxProps {
  checked?: boolean;
  readOnly?: boolean;
  className?: string;
}

export function SimpleCheckbox({
  checked = false,
  readOnly = false,
  className
}: SimpleCheckboxProps) {
  return (
    <div
      className={cn(
        'peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked && 'bg-primary text-primary-foreground',
        !checked && 'bg-background',
        className
      )}
      role="checkbox"
      aria-checked={checked}
      tabIndex={readOnly ? -1 : 0}
    >
      {checked && (
        <Check className="h-4 w-4 text-primary-foreground" strokeWidth={3} />
      )}
    </div>
  );
}

