'use client';

import React from 'react';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface InfoTooltipProps {
  title: string;
  description: string;
  formula?: string;
  className?: string;
}

export function InfoTooltip({ title, description, formula, className }: InfoTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "p-1 rounded-md hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground",
              className
            )}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" className="max-w-xs p-3">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
            {formula && (
              <div className="mt-2 pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground font-medium mb-0.5">Fórmula:</p>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                  {formula}
                </code>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
