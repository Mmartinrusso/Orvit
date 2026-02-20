'use client'

import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Activity, AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react'

interface HealthScoreBadgeProps {
  score: number | null | undefined
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  showTooltip?: boolean
  className?: string
}

export function HealthScoreBadge({
  score,
  size = 'md',
  showLabel = false,
  showTooltip = true,
  className
}: HealthScoreBadgeProps) {
  const getConfig = (s: number | null | undefined) => {
    if (s === null || s === undefined) {
      return {
        label: 'Sin datos',
        color: 'bg-muted text-muted-foreground border-border',
        icon: HelpCircle,
        description: 'No hay suficientes datos para calcular el health score'
      }
    }
    if (s >= 80) {
      return {
        label: 'Bueno',
        color: 'bg-success-muted text-success border-success-muted',
        icon: CheckCircle,
        description: 'El activo está en buenas condiciones operativas'
      }
    }
    if (s >= 50) {
      return {
        label: 'Regular',
        color: 'bg-warning-muted text-warning-muted-foreground border-warning-muted',
        icon: Activity,
        description: 'El activo requiere atención preventiva'
      }
    }
    return {
      label: 'Crítico',
      color: 'bg-destructive/10 text-destructive border-destructive/20',
      icon: AlertTriangle,
      description: 'El activo necesita intervención urgente'
    }
  }

  const config = getConfig(score)
  const Icon = config.icon

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5 gap-1',
    md: 'text-sm px-2 py-1 gap-1.5',
    lg: 'text-base px-3 py-1.5 gap-2'
  }

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16
  }

  const badge = (
    <div
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        config.color,
        sizeClasses[size],
        className
      )}
    >
      <Icon size={iconSizes[size]} />
      {(score !== null && score !== undefined) && (
        <span>{score}</span>
      )}
      {showLabel && <span>{config.label}</span>}
    </div>
  )

  if (!showTooltip) {
    return badge
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <div className="text-sm">
            <p className="font-medium">{config.label}</p>
            <p className="text-muted-foreground">{config.description}</p>
            {score !== null && score !== undefined && (
              <p className="text-xs mt-1">Score: {score}/100</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface CriticalityBadgeProps {
  score: number | null | undefined
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function CriticalityBadge({
  score,
  size = 'md',
  className
}: CriticalityBadgeProps) {
  const getConfig = (s: number | null | undefined) => {
    if (s === null || s === undefined) {
      return { label: 'N/A', color: 'bg-muted text-muted-foreground' }
    }
    if (s >= 8) {
      return { label: 'Alta', color: 'bg-destructive/10 text-destructive' }
    }
    if (s >= 5) {
      return { label: 'Media', color: 'bg-warning-muted text-warning-muted-foreground' }
    }
    return { label: 'Baja', color: 'bg-success-muted text-success' }
  }

  const config = getConfig(score)

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5'
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded font-medium',
        config.color,
        sizeClasses[size],
        className
      )}
    >
      {score !== null && score !== undefined ? `${score}/10` : 'N/A'}
    </span>
  )
}
