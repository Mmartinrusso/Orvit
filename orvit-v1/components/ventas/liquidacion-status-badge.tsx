'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const LIQUIDACION_ESTADOS: Record<string, {
  label: string;
  className: string;
}> = {
  BORRADOR: {
    label: 'Borrador',
    className: 'bg-muted text-muted-foreground border-border',
  },
  CONFIRMADA: {
    label: 'Confirmada',
    className: 'bg-info-muted text-info-muted-foreground border-info-muted',
  },
  PAGADA: {
    label: 'Pagada',
    className: 'bg-success-muted text-success-muted-foreground border-success-muted',
  },
  ANULADA: {
    label: 'Anulada',
    className: 'bg-destructive/10 text-destructive border-destructive/30',
  },
};

interface LiquidacionStatusBadgeProps {
  estado: string;
  className?: string;
}

export function LiquidacionStatusBadge({ estado, className }: LiquidacionStatusBadgeProps) {
  const config = LIQUIDACION_ESTADOS[estado] || { label: estado, className: '' };
  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
