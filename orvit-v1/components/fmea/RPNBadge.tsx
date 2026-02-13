'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';

interface RPNBadgeProps {
  rpn: number;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function getRPNLevel(rpn: number) {
  if (rpn >= 200) return { level: 'high', label: 'Alto Riesgo', color: 'bg-red-100 text-red-800 border-red-200' };
  if (rpn >= 100) return { level: 'medium', label: 'Riesgo Medio', color: 'bg-amber-100 text-amber-800 border-amber-200' };
  return { level: 'low', label: 'Bajo Riesgo', color: 'bg-green-100 text-green-800 border-green-200' };
}

export function RPNBadge({ rpn, showIcon = true, size = 'md' }: RPNBadgeProps) {
  const { level, label, color } = getRPNLevel(rpn);

  const Icon = level === 'high' ? AlertTriangle : level === 'medium' ? AlertCircle : CheckCircle;

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-0.5',
    lg: 'text-base px-3 py-1',
  };

  return (
    <Badge variant="outline" className={cn(color, sizeClasses[size])}>
      {showIcon && <Icon className={cn('mr-1', size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} />}
      RPN: {rpn}
    </Badge>
  );
}

export function RPNIndicator({ value, label }: { value: number; label: string }) {
  const getColor = (val: number) => {
    if (val >= 8) return 'bg-red-500';
    if (val >= 5) return 'bg-amber-500';
    return 'bg-green-500';
  };

  return (
    <div className="flex flex-col items-center">
      <span className="text-xs text-muted-foreground mb-1">{label}</span>
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            className={cn(
              'w-2 h-4 rounded-sm',
              i < value ? getColor(value) : 'bg-gray-200'
            )}
          />
        ))}
      </div>
      <span className="text-sm font-medium mt-1">{value}/10</span>
    </div>
  );
}

export default RPNBadge;
