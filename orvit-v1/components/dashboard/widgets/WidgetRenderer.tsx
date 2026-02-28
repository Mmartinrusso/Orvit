'use client';

import React from 'react';
import { WidgetInstance, WidgetStyle, getWidgetById, STYLE_LABELS, STYLE_ICONS } from '@/lib/dashboard/widget-catalog';
import { WidgetSkeleton } from './WidgetWrapper';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Palette } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

// Importar todos los widgets
import { MaintenanceKPIsWidget } from './MaintenanceKPIsWidget';
import { MaintenanceOverviewWidget } from './MaintenanceOverviewWidget';
import { MaintenanceByTypeWidget } from './MaintenanceByTypeWidget';
import { OverdueOrdersWidget } from './OverdueOrdersWidget';
import { InProgressOrdersWidget } from './InProgressOrdersWidget';
import { RecentCompletedWidget } from './RecentCompletedWidget';
import { OrdersByStatusWidget } from './OrdersByStatusWidget';
import { QuickStatsWidget } from './QuickStatsWidget';
import { MyTasksWidget } from './MyTasksWidget';
import { UpcomingMaintenancesWidget } from './UpcomingMaintenancesWidget';
import { FailuresSummaryWidget } from './FailuresSummaryWidget';
import { MaintenanceTrendsWidget } from './MaintenanceTrendsWidget';
import { TasksByStatusWidget } from './TasksByStatusWidget';
import { MachineStatusWidget } from './MachineStatusWidget';
// Nuevos widgets de mantenimiento por rol
import { MyWorkOrdersWidget } from './MyWorkOrdersWidget';
import { MyControlsTimelineWidget } from './MyControlsTimelineWidget';
import { MyRecentCompletionsWidget } from './MyRecentCompletionsWidget';
import { TeamWorkloadWidget } from './TeamWorkloadWidget';
import { FailuresOpenWidget } from './FailuresOpenWidget';
import { TeamControlsTimelineWidget } from './TeamControlsTimelineWidget';
import { TrendCompletion6mWidget } from './TrendCompletion6mWidget';
import { TopFailingMachinesWidget } from './TopFailingMachinesWidget';
import { CostByMonthWidget } from './CostByMonthWidget';
import { CrossSectorComparisonWidget } from './CrossSectorComparisonWidget';
import { SolutionEffectivenessWidget } from './SolutionEffectivenessWidget';
import { HealthScoresOverviewWidget } from './HealthScoresOverviewWidget';
import { PreventiveComplianceWidget } from './PreventiveComplianceWidget';

// Mapeo de widgetId a componente
const WIDGET_COMPONENTS: Record<string, React.ComponentType<any>> = {
  'maintenance-kpis': MaintenanceKPIsWidget,
  'maintenance-overview': MaintenanceOverviewWidget,
  'maintenance-by-type': MaintenanceByTypeWidget,
  'overdue-orders': OverdueOrdersWidget,
  'in-progress-orders': InProgressOrdersWidget,
  'recent-completed': RecentCompletedWidget,
  'orders-by-status': OrdersByStatusWidget,
  'quick-stats-total': QuickStatsWidget,
  'quick-stats-overdue': QuickStatsWidget,
  'quick-stats-completed': QuickStatsWidget,
  'quick-stats-mttr': QuickStatsWidget,
  'quick-stats-mtbf': QuickStatsWidget,
  'quick-stats-uptime': QuickStatsWidget,
  'my-tasks': MyTasksWidget,
  'pending-tasks': MyTasksWidget,
  'upcoming-maintenances': UpcomingMaintenancesWidget,
  'failures-summary': FailuresSummaryWidget,
  'maintenance-trends': MaintenanceTrendsWidget,
  'tasks-by-status': TasksByStatusWidget,
  'machine-status': MachineStatusWidget,
  // Widgets que usan componentes existentes con diferentes configuraciones
  'orders-by-priority': OrdersByStatusWidget,
  'orders-completion-rate': QuickStatsWidget,
  'critical-machines': OverdueOrdersWidget,
  'failures-by-type': MaintenanceByTypeWidget,
  'failures-recent': OverdueOrdersWidget,
  'tasks-summary': MaintenanceOverviewWidget,
  'today-schedule': UpcomingMaintenancesWidget,
  'critical-alerts': OverdueOrdersWidget,
  'maintenance-costs': QuickStatsWidget,
  // Nuevos widgets de mantenimiento por rol
  'my-work-orders': MyWorkOrdersWidget,
  'my-controls-timeline': MyControlsTimelineWidget,
  'my-recent-completions': MyRecentCompletionsWidget,
  'team-workload': TeamWorkloadWidget,
  'failures-open': FailuresOpenWidget,
  'team-controls-timeline': TeamControlsTimelineWidget,
  'trend-completion-6m': TrendCompletion6mWidget,
  'top-failing-machines': TopFailingMachinesWidget,
  'cost-by-month': CostByMonthWidget,
  'cross-sector-comparison': CrossSectorComparisonWidget,
  'solution-effectiveness': SolutionEffectivenessWidget,
  'health-scores-overview': HealthScoresOverviewWidget,
  'preventive-compliance': PreventiveComplianceWidget,
};

// Configuración adicional para widgets
const WIDGET_SETTINGS: Record<string, Record<string, any>> = {
  'quick-stats-total': { statType: 'total' },
  'quick-stats-overdue': { statType: 'overdue' },
  'quick-stats-completed': { statType: 'completed' },
  'quick-stats-mttr': { statType: 'mttr' },
  'quick-stats-mtbf': { statType: 'mtbf' },
  'quick-stats-uptime': { statType: 'uptime' },
  'orders-by-priority': { dataType: 'priority' },
  'orders-completion-rate': { statType: 'completionRate' },
};

interface WidgetRendererProps {
  widget: WidgetInstance;
  companyId: number;
  sectorId?: number | null;
  userId?: number;
  isEditMode?: boolean;
  onRemove?: (widgetInstanceId: string) => void;
  onStyleChange?: (widgetInstanceId: string, style: WidgetStyle) => void;
}

export function WidgetRenderer({
  widget,
  companyId,
  sectorId,
  userId,
  isEditMode = false,
  onRemove,
  onStyleChange,
}: WidgetRendererProps) {
  const widgetDef = getWidgetById(widget.widgetId);
  const WidgetComponent = WIDGET_COMPONENTS[widget.widgetId];

  if (!WidgetComponent) {
    return (
      <div className="h-full flex items-center justify-center bg-accent/30 rounded-lg border border-border/30 p-4">
        <p className="text-xs text-muted-foreground text-center">
          Widget "{widgetDef?.name || widget.widgetId}" próximamente
        </p>
      </div>
    );
  }

  const additionalSettings = WIDGET_SETTINGS[widget.widgetId] || {};
  const mergedSettings = { ...additionalSettings, ...widget.settings };
  const currentStyle = widget.style || widgetDef?.defaultStyle || 'list';
  const availableStyles = widgetDef?.availableStyles || ['list'];

  // Renderizar icono dinámicamente
  const renderIcon = (iconName: string) => {
    const Icon = (LucideIcons as any)[iconName];
    return Icon ? <Icon className="h-3.5 w-3.5" /> : null;
  };

  return (
    <div className="relative h-full">
      <WidgetComponent
        companyId={companyId}
        sectorId={sectorId}
        userId={userId}
        settings={mergedSettings}
        style={currentStyle}
        isEditMode={isEditMode}
        onRemove={onRemove ? () => onRemove(widget.id) : undefined}
        headerActions={
          isEditMode && availableStyles.length > 1 && onStyleChange ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm">
                  <Palette className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-xs">Estilo de visualización</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {availableStyles.map((style) => (
                  <DropdownMenuItem
                    key={style}
                    onClick={() => onStyleChange(widget.id, style)}
                    className={currentStyle === style ? 'bg-accent' : ''}
                  >
                    <span className="mr-2">{renderIcon(STYLE_ICONS[style])}</span>
                    {STYLE_LABELS[style]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : undefined
        }
      />
    </div>
  );
}

// Componente para renderizar múltiples widgets en un grid
interface WidgetGridProps {
  widgets: WidgetInstance[];
  companyId: number;
  sectorId?: number | null;
  userId?: number;
  isEditMode?: boolean;
  onRemoveWidget?: (widgetInstanceId: string) => void;
  onStyleChange?: (widgetInstanceId: string, style: WidgetStyle) => void;
  columns?: number;
}

export function WidgetGrid({
  widgets,
  companyId,
  sectorId,
  userId,
  isEditMode = false,
  onRemoveWidget,
  onStyleChange,
  columns = 4,
}: WidgetGridProps) {
  // Ordenar widgets por posición (y primero, luego x)
  const sortedWidgets = [...widgets].sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });

  return (
    <div 
      className="grid gap-4"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      }}
    >
      {sortedWidgets.map((widget) => {
        const colSpan = Math.min(widget.w, columns);
        const rowSpan = widget.h;

        return (
          <div
            key={widget.id}
            style={{
              gridColumn: `span ${colSpan}`,
              gridRow: `span ${rowSpan}`,
              minHeight: `${rowSpan * 150}px`,
            }}
          >
            <WidgetRenderer
              widget={widget}
              companyId={companyId}
              sectorId={sectorId}
              userId={userId}
              isEditMode={isEditMode}
              onRemove={onRemoveWidget}
              onStyleChange={onStyleChange}
            />
          </div>
        );
      })}
    </div>
  );
}
