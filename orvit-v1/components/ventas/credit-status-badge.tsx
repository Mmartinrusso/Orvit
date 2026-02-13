'use client';

import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AlertTriangle, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export interface QuickCreditStatus {
  hasCredit: boolean;
  isBlocked: boolean;
  hasOverdue: boolean;
  utilizationPercent: number;
  statusColor: 'green' | 'yellow' | 'red';
  statusLabel: string;
}

interface CreditStatusBadgeProps {
  status: QuickCreditStatus;
  showUtilization?: boolean;
  className?: string;
}

export function CreditStatusBadge({
  status,
  showUtilization = false,
  className = ''
}: CreditStatusBadgeProps) {
  const getVariant = () => {
    switch (status.statusColor) {
      case 'green':
        return 'default';
      case 'yellow':
        return 'secondary';
      case 'red':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getIcon = () => {
    if (status.isBlocked) return XCircle;
    if (status.hasOverdue) return AlertTriangle;
    if (!status.hasCredit) return AlertCircle;
    if (status.utilizationPercent >= 80) return AlertTriangle;
    return CheckCircle;
  };

  const Icon = getIcon();

  const getTooltipContent = () => {
    const lines = [];

    if (status.isBlocked) {
      lines.push('Cliente bloqueado');
    }
    if (status.hasOverdue) {
      lines.push('Tiene facturas vencidas');
    }
    if (!status.hasCredit && !status.isBlocked) {
      lines.push('Sin credito disponible');
    }
    if (status.utilizationPercent >= 80 && status.hasCredit) {
      lines.push(`Utilizacion: ${status.utilizationPercent.toFixed(0)}%`);
    }
    if (lines.length === 0) {
      lines.push('Credito OK');
    }

    return lines.join('\n');
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={getVariant()}
            className={`flex items-center gap-1 cursor-default ${className}`}
          >
            <Icon className="w-3 h-3" />
            {status.statusLabel}
            {showUtilization && status.hasCredit && (
              <span className="ml-1 text-xs opacity-75">
                ({status.utilizationPercent.toFixed(0)}%)
              </span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="whitespace-pre-line text-xs">{getTooltipContent()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
