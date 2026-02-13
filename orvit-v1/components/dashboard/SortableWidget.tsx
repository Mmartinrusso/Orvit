'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { GripVertical, X, Palette, MoreVertical } from 'lucide-react';
import { 
  WidgetDefinition, 
  WidgetInstance, 
  WidgetStyle,
  STYLE_LABELS,
  STYLE_ICONS,
} from '@/lib/dashboard/widget-catalog';
import { cn } from '@/lib/utils';
import * as LucideIcons from 'lucide-react';

// Importar widgets
import { KpiStatWidget } from './widgets/KpiStatWidget';
import { OrdersListWidget } from './widgets/OrdersListWidget';
import { OrdersChartWidget } from './widgets/OrdersChartWidget';
import { MaintenanceTypeWidget } from './widgets/MaintenanceTypeWidget';
import { MaintenanceKPIsWidget } from './widgets/MaintenanceKPIsWidget';
import { MachineStatusWidget } from './widgets/MachineStatusWidget';
import { MyTasksWidget } from './widgets/MyTasksWidget';
import { TasksByStatusWidget } from './widgets/TasksByStatusWidget';
import { UpcomingMaintenancesWidget } from './widgets/UpcomingMaintenancesWidget';
import { MaintenanceCalendarWidget } from './widgets/MaintenanceCalendarWidget';

interface SortableWidgetProps {
  widget: WidgetInstance;
  widgetDef: WidgetDefinition;
  companyId: number;
  sectorId?: number | null;
  userId?: number;
  isEditMode: boolean;
  onRemove: () => void;
  onStyleChange: (style: WidgetStyle) => void;
}

// Mapeo de widgets a componentes
const WIDGET_COMPONENTS: Record<string, React.ComponentType<any>> = {
  'kpi-total-orders': KpiStatWidget,
  'kpi-overdue': KpiStatWidget,
  'kpi-completed': KpiStatWidget,
  'kpi-in-progress': KpiStatWidget,
  'orders-overdue-list': OrdersListWidget,
  'orders-in-progress': OrdersListWidget,
  'orders-completed': OrdersListWidget,
  'orders-by-status': OrdersChartWidget,
  'orders-by-priority': OrdersChartWidget,
  'maintenance-type': MaintenanceTypeWidget,
  'maintenance-kpis': MaintenanceKPIsWidget,
  'machines-status': MachineStatusWidget,
  'my-tasks': MyTasksWidget,
  'tasks-by-status': TasksByStatusWidget,
  'upcoming-maintenance': UpcomingMaintenancesWidget,
  'maintenance-calendar': MaintenanceCalendarWidget,
};

export function SortableWidget({
  widget,
  widgetDef,
  companyId,
  sectorId,
  userId,
  isEditMode,
  onRemove,
  onStyleChange,
}: SortableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const renderIcon = (iconName: string, className?: string) => {
    const Icon = (LucideIcons as any)[iconName];
    return Icon ? <Icon className={className || "h-4 w-4"} /> : null;
  };

  const WidgetComponent = WIDGET_COMPONENTS[widget.widgetId];
  const currentStyle = widget.style || widgetDef.defaultStyle;

  // Calcular columnas
  const colSpan = widgetDef.cols === 1 ? 'col-span-1' :
                  widgetDef.cols === 2 ? 'sm:col-span-2 col-span-1' :
                  widgetDef.cols === 3 ? 'sm:col-span-2 lg:col-span-3 col-span-1' :
                  'col-span-full';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        colSpan,
        isDragging && 'opacity-50 z-50',
      )}
    >
      <Card className={cn(
        'h-full transition-all duration-200',
        isEditMode && 'ring-2 ring-transparent hover:ring-primary/30',
        isDragging && 'ring-2 ring-primary shadow-lg'
      )}>
        <CardHeader className="flex flex-row items-center justify-between py-2 px-3 space-y-0 border-b">
          <div className="flex items-center gap-2">
            {isEditMode && (
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing p-1 -ml-1 rounded hover:bg-accent"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <div className="flex items-center gap-1.5">
              {renderIcon(widgetDef.icon, "h-3.5 w-3.5 text-muted-foreground")}
              <CardTitle className="text-xs font-medium">{widgetDef.name}</CardTitle>
            </div>
          </div>
          
          {isEditMode && (
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-xs px-1.5 py-0">
                {widgetDef.cols}×{widgetDef.rows}
              </Badge>
              
              {widgetDef.availableStyles.length > 1 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Palette className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuLabel className="text-xs">Estilo</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {widgetDef.availableStyles.map((s) => (
                      <DropdownMenuItem
                        key={s}
                        onClick={() => onStyleChange(s)}
                        className={cn(
                          'text-xs',
                          currentStyle === s && 'bg-accent'
                        )}
                      >
                        {renderIcon(STYLE_ICONS[s], "h-3 w-3 mr-2")}
                        {STYLE_LABELS[s]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={onRemove}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </CardHeader>
        
        <CardContent className="p-3">
          {WidgetComponent ? (
            <WidgetComponent
              widgetId={widget.widgetId}
              companyId={companyId}
              sectorId={sectorId}
              userId={userId}
              style={currentStyle}
            />
          ) : (
            <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
              Widget no disponible
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

