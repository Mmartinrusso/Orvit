import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        // Base variants
        default:
          'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground border-border',

        // Status variants (usan tokens semánticos — sin dark: prefixes)
        pending:
          'border-warning-muted bg-warning-muted text-warning-muted-foreground',
        in_progress:
          'border-info-muted bg-info-muted text-info-muted-foreground',
        completed:
          'border-success-muted bg-success-muted text-success-muted-foreground',
        cancelled:
          'border-border bg-muted text-muted-foreground',
        overdue:
          'border-destructive/30 bg-destructive/10 text-destructive',

        // Priority variants
        low:
          'border-border bg-muted text-muted-foreground',
        medium:
          'border-warning-muted bg-warning-muted text-warning-muted-foreground',
        high:
          'border-warning/30 bg-warning/10 text-warning-muted-foreground',
        critical:
          'border-destructive/30 bg-destructive/10 text-destructive',

        // Maintenance type variants
        preventive:
          'border-info-muted bg-info-muted text-info-muted-foreground',
        corrective:
          'border-warning/30 bg-warning/10 text-warning-muted-foreground',
        predictive:
          'border-purple-200 bg-purple-100 text-purple-700 dark:border-purple-800 dark:bg-purple-900/30 dark:text-purple-300',

        // Solid versions (for emphasis)
        'pending-solid':
          'border-transparent bg-warning text-warning-foreground',
        'in_progress-solid':
          'border-transparent bg-info text-info-foreground',
        'completed-solid':
          'border-transparent bg-success text-success-foreground',
        'preventive-solid':
          'border-transparent bg-info text-info-foreground',
        'corrective-solid':
          'border-transparent bg-warning text-warning-foreground',
        'predictive-solid':
          'border-transparent bg-purple-500 text-white',
      },
      size: {
        sm: 'px-1.5 py-0.5 text-[10px]',
        default: 'px-2 py-0.5 text-xs',
        lg: 'px-2.5 py-1 text-xs',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
