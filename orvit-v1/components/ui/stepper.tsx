'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle } from 'lucide-react';

export interface Step {
  id: string;
  label: string;
  description?: string;
}

interface StepperProps {
  steps: Step[];
  currentStep: string;
  onStepClick?: (stepId: string) => void;
  className?: string;
}

export function Stepper({ steps, currentStep, onStepClick, className }: StepperProps) {
  const currentIndex = steps.findIndex(step => step.id === currentStep);
  
  return (
    <div className={cn('w-full', className)}>
      <div className="relative flex items-center justify-between">
        {/* Línea de conexión */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-border">
          <div 
            className="h-full bg-primary transition-all duration-300 ease-in-out"
            style={{ width: `${(currentIndex / (steps.length - 1)) * 100}%` }}
          />
        </div>
        
        {/* Steps */}
        <div className="relative flex w-full justify-between">
          {steps.map((step, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;
            const isClickable = !!onStepClick;
            
            return (
              <div
                key={step.id}
                className={cn(
                  'relative flex flex-col items-center flex-1',
                  isClickable && 'cursor-pointer group'
                )}
                onClick={() => isClickable && onStepClick?.(step.id)}
              >
                {/* Icono del step */}
                <div
                  className={cn(
                    'relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-200',
                    isCompleted && 'bg-primary border-primary text-primary-foreground',
                    isCurrent && 'bg-primary border-primary text-primary-foreground ring-4 ring-primary/20',
                    !isCompleted && !isCurrent && 'bg-background border-border text-muted-foreground',
                    isClickable && !isCurrent && !isCompleted && 'group-hover:border-primary/50 group-hover:bg-muted/50'
                  )}
                >
                  <span className={cn(
                    'text-sm font-semibold',
                    isCompleted || isCurrent ? 'text-primary-foreground' : 'text-muted-foreground'
                  )}>
                    {index + 1}
                  </span>
                </div>
                
                {/* Label */}
                <div className="mt-2 text-center max-w-[120px]">
                  <p
                    className={cn(
                      'text-xs font-medium transition-colors',
                      isCurrent && 'text-primary',
                      isCompleted && 'text-foreground',
                      !isCompleted && !isCurrent && 'text-muted-foreground'
                    )}
                  >
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
