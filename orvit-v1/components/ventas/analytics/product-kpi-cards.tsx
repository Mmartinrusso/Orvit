'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductKPICardProps {
  icon: LucideIcon;
  iconColor: string;
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'stable';
  alert?: boolean;
  velocityBadge?: 'ALTA' | 'MEDIA' | 'BAJA';
  trendInfo?: string;
}

export function ProductKPICard({
  icon: Icon,
  iconColor,
  label,
  value,
  subtitle,
  trend,
  alert,
  velocityBadge,
  trendInfo,
}: ProductKPICardProps) {
  return (
    <Card className={cn(alert && 'border-destructive')}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold">{value}</p>
              {trend && (
                <div className={cn(
                  "flex items-center gap-0.5 text-xs font-medium",
                  trend === 'up' && "text-success",
                  trend === 'down' && "text-destructive",
                  trend === 'stable' && "text-muted-foreground"
                )}>
                  {trend === 'up' && <TrendingUp className="h-3 w-3" />}
                  {trend === 'down' && <TrendingDown className="h-3 w-3" />}
                  {trend === 'stable' && <Minus className="h-3 w-3" />}
                  <span className="capitalize">{trend === 'up' ? 'Creciendo' : trend === 'down' ? 'Decreciendo' : 'Estable'}</span>
                </div>
              )}
            </div>
            {subtitle && (
              <p className={cn(
                "text-xs mt-1",
                alert ? "text-destructive font-medium" : "text-muted-foreground"
              )}>
                {subtitle}
              </p>
            )}
            {velocityBadge && (
              <Badge
                variant={velocityBadge === 'ALTA' ? 'default' : velocityBadge === 'MEDIA' ? 'secondary' : 'outline'}
                className={cn(
                  "mt-2 text-xs",
                  velocityBadge === 'ALTA' && "bg-success hover:bg-success/90",
                  velocityBadge === 'MEDIA' && "bg-primary hover:bg-primary/90 text-primary-foreground",
                  velocityBadge === 'BAJA' && "bg-muted text-foreground"
                )}
              >
                {velocityBadge}
              </Badge>
            )}
            {trendInfo && (
              <p className="text-xs text-muted-foreground mt-2">{trendInfo}</p>
            )}
          </div>
          <div className={cn(
            "rounded-lg p-2.5 flex-shrink-0",
            iconColor
          )}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
