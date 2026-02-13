/**
 * Empty State Component
 * Displays a consistent empty state with icon, message, and optional CTA
 */

import { Button } from '@/components/ui/button';
import { LucideIcon, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
    variant?: 'default' | 'outline';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  const ActionIcon = action?.icon || Plus;
  const SecondaryIcon = secondaryAction?.icon || X;

  return (
    <div className={cn('flex flex-col items-center justify-center py-12', className)}>
      {Icon && (
        <div className="w-14 h-14 rounded-xl bg-muted/50 border border-dashed border-border flex items-center justify-center mb-4">
          <Icon className="h-6 w-6 text-muted-foreground/50" />
        </div>
      )}
      <h3 className="text-sm font-medium mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-muted-foreground mb-3 text-center max-w-sm">
          {description}
        </p>
      )}
      <div className="flex gap-2 mt-2">
        {secondaryAction && (
          <Button
            variant="outline"
            size="sm"
            onClick={secondaryAction.onClick}
          >
            <SecondaryIcon className="h-3 w-3 mr-1.5" />
            {secondaryAction.label}
          </Button>
        )}
        {action && (
          <Button
            variant={action.variant || 'default'}
            size="sm"
            onClick={action.onClick}
          >
            <ActionIcon className="h-4 w-4 mr-2" />
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Empty State for tables
 */
interface EmptyTableStateProps extends EmptyStateProps {
  colSpan: number;
}

export function EmptyTableState({ colSpan, ...props }: EmptyTableStateProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-12">
        <EmptyState {...props} />
      </td>
    </tr>
  );
}
