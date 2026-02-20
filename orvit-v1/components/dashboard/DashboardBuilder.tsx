'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogBody } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Settings2, 
  Plus, 
  Save, 
  RotateCcw, 
  Layout, 
  X,
  Check,
  Search,
  GripVertical,
  Move
} from 'lucide-react';
import { 
  WidgetDefinition, 
  WidgetInstance, 
  DashboardLayout,
  WidgetStyle,
  CATEGORY_LABELS,
  STYLE_LABELS,
  STYLE_ICONS,
  getWidgetById,
  getDefaultLayoutForRole,
} from '@/lib/dashboard/widget-catalog';
import { SortableWidget } from './SortableWidget';
import { cn } from '@/lib/utils';
import * as LucideIcons from 'lucide-react';

interface DashboardBuilderProps {
  companyId: number;
  sectorId?: number | null;
  userId: number;
  userRole: string;
  userName?: string;
}

export function DashboardBuilder({
  companyId,
  sectorId,
  userId,
  userRole,
  userName,
}: DashboardBuilderProps) {
  const queryClient = useQueryClient();
  const [isEditMode, setIsEditMode] = useState(false);
  const [layout, setLayout] = useState<DashboardLayout>({ widgets: [] });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Sensores para drag & drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Cargar configuración del usuario
  const { data: configData, isLoading: loadingConfig } = useQuery({
    queryKey: ['dashboard-config', userId, companyId],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('userId', userId.toString());
      params.append('companyId', companyId.toString());
      
      const response = await fetch(`/api/dashboard/user-config?${params.toString()}`);
      if (!response.ok) throw new Error('Error fetching config');
      return response.json();
    },
    enabled: !!userId && !!companyId,
  });

  // Cargar widgets disponibles según permisos
  const { data: widgetsData, isLoading: loadingWidgets } = useQuery({
    queryKey: ['available-widgets', userId, companyId, userRole],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('userId', userId.toString());
      params.append('companyId', companyId.toString());
      params.append('role', userRole);
      
      const response = await fetch(`/api/dashboard/available-widgets?${params.toString()}`);
      if (!response.ok) throw new Error('Error fetching widgets');
      return response.json();
    },
    enabled: !!userId && !!companyId,
  });

  // Guardar configuración
  const saveMutation = useMutation({
    mutationFn: async (layoutToSave: DashboardLayout) => {
      const response = await fetch('/api/dashboard/user-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          companyId,
          layout: layoutToSave,
          isDefault: true,
        }),
      });
      if (!response.ok) throw new Error('Error saving config');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-config', userId, companyId] });
      setHasUnsavedChanges(false);
    },
  });

  // Inicializar layout
  useEffect(() => {
    if (configData?.config?.layout) {
      setLayout(configData.config.layout);
    } else if (!loadingConfig && widgetsData) {
      const userPermissions = widgetsData.userPermissions || [];
      const defaultLayout = getDefaultLayoutForRole(userRole, userPermissions);
      setLayout(defaultLayout);
    }
  }, [configData, loadingConfig, widgetsData, userRole]);

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      setLayout((prev) => {
        const oldIndex = prev.widgets.findIndex((w) => w.id === active.id);
        const newIndex = prev.widgets.findIndex((w) => w.id === over.id);
        
        const newWidgets = arrayMove(prev.widgets, oldIndex, newIndex).map((w, i) => ({
          ...w,
          order: i,
        }));

        return { ...prev, widgets: newWidgets };
      });
      setHasUnsavedChanges(true);
    }
  };

  // Agregar widget
  const addWidget = useCallback((widgetDef: WidgetDefinition) => {
    const newWidget: WidgetInstance = {
      id: `${widgetDef.id}-${Date.now()}`,
      widgetId: widgetDef.id,
      order: layout.widgets.length,
      style: widgetDef.defaultStyle,
    };

    setLayout(prev => ({
      ...prev,
      widgets: [...prev.widgets, newWidget],
    }));
    setHasUnsavedChanges(true);
    setIsAddWidgetOpen(false);
  }, [layout.widgets.length]);

  // Eliminar widget
  const removeWidget = useCallback((widgetInstanceId: string) => {
    setLayout(prev => ({
      ...prev,
      widgets: prev.widgets
        .filter(w => w.id !== widgetInstanceId)
        .map((w, i) => ({ ...w, order: i })),
    }));
    setHasUnsavedChanges(true);
  }, []);

  // Cambiar estilo
  const changeWidgetStyle = useCallback((widgetInstanceId: string, newStyle: WidgetStyle) => {
    setLayout(prev => ({
      ...prev,
      widgets: prev.widgets.map(w => 
        w.id === widgetInstanceId ? { ...w, style: newStyle } : w
      ),
    }));
    setHasUnsavedChanges(true);
  }, []);

  // Reset
  const resetToDefault = useCallback(() => {
    if (!widgetsData) return;
    const userPermissions = widgetsData.userPermissions || [];
    const defaultLayout = getDefaultLayoutForRole(userRole, userPermissions);
    setLayout(defaultLayout);
    setHasUnsavedChanges(true);
  }, [widgetsData, userRole]);

  // Guardar
  const saveChanges = () => {
    saveMutation.mutate(layout);
  };

  // Renderizar icono
  const renderIcon = (iconName: string, className?: string) => {
    const Icon = (LucideIcons as any)[iconName];
    return Icon ? <Icon className={className || "h-4 w-4"} /> : null;
  };

  const availableWidgets = widgetsData?.widgets || [];
  const widgetsByCategory = widgetsData?.widgetsByCategory || {};
  const categories = Object.keys(widgetsByCategory);
  const addedWidgetIds = layout.widgets.map(w => w.widgetId);

  // Widget activo para overlay
  const activeWidget = activeId 
    ? layout.widgets.find(w => w.id === activeId) 
    : null;
  const activeWidgetDef = activeWidget 
    ? getWidgetById(activeWidget.widgetId) 
    : null;

  if (loadingConfig || loadingWidgets) {
    return (
      <div className="h-screen sidebar-shell">
        <div className="px-4 md:px-6 py-4 space-y-4">
          <div className="flex items-center justify-between pb-4 border-b">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-9 w-32" />
          </div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen sidebar-shell overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
      <div className="px-4 md:px-6 py-4 space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-border gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
              Dashboard de Mantenimiento
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {userName ? `Hola, ${userName}` : 'Bienvenido'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isEditMode ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditMode(false);
                    if (hasUnsavedChanges && configData?.config?.layout) {
                      setLayout(configData.config.layout);
                      setHasUnsavedChanges(false);
                    }
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button variant="outline" size="sm" onClick={resetToDefault}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
                <Dialog open={isAddWidgetOpen} onOpenChange={setIsAddWidgetOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar
                    </Button>
                  </DialogTrigger>
                  <DialogContent size="md">
                    <DialogHeader>
                      <DialogTitle>Agregar Widget</DialogTitle>
                    </DialogHeader>

                    <DialogBody className="flex gap-4">
                      {/* Categorías */}
                      <div className="w-44 border-r pr-4">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Categorías</p>
                        <div className="space-y-1">
                          <Button
                            variant={selectedCategory === null ? 'secondary' : 'ghost'}
                            size="sm"
                            className="w-full justify-start text-xs"
                            onClick={() => setSelectedCategory(null)}
                          >
                            Todos ({availableWidgets.length})
                          </Button>
                          {categories.map(cat => (
                            <Button
                              key={cat}
                              variant={selectedCategory === cat ? 'secondary' : 'ghost'}
                              size="sm"
                              className="w-full justify-start text-xs"
                              onClick={() => setSelectedCategory(cat)}
                            >
                              {(CATEGORY_LABELS as any)[cat] || cat}
                            </Button>
                          ))}
                        </div>
                      </div>
                      
                      {/* Lista de widgets */}
                      <ScrollArea className="flex-1 h-[400px]">
                        <div className="space-y-2 pr-4">
                          {(selectedCategory 
                            ? widgetsByCategory[selectedCategory] || [] 
                            : availableWidgets
                          ).map((widget: WidgetDefinition) => {
                            const isAdded = addedWidgetIds.includes(widget.id);
                            return (
                              <div
                                key={widget.id}
                                className={cn(
                                  'p-3 rounded-lg border transition-all',
                                  isAdded 
                                    ? 'bg-accent/50 border-border/50 opacity-60' 
                                    : 'hover:bg-accent/30 cursor-pointer border-border/30'
                                )}
                                onClick={() => !isAdded && addWidget(widget)}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                                    {renderIcon(widget.icon)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-sm">{widget.name}</span>
                                      <Badge variant="outline" className="text-xs">
                                        {widget.cols}×{widget.rows}
                                      </Badge>
                                      {isAdded && (
                                        <Badge variant="secondary" className="text-xs">
                                          <Check className="h-3 w-3 mr-1" />
                                          Agregado
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {widget.description}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    </DialogBody>
                  </DialogContent>
                </Dialog>
                <Button
                  size="sm"
                  onClick={saveChanges}
                  disabled={!hasUnsavedChanges || saveMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setIsEditMode(true)}>
                <Settings2 className="h-4 w-4 mr-2" />
                Personalizar
              </Button>
            )}
          </div>
        </div>

        {/* Indicadores */}
        {hasUnsavedChanges && isEditMode && (
          <div className="bg-warning-muted border border-warning-muted text-warning-muted-foreground px-4 py-2 rounded-lg text-sm flex items-center gap-2">
            <div className="w-2 h-2 bg-warning rounded-full animate-pulse" />
            Cambios sin guardar
          </div>
        )}

        {isEditMode && (
          <div className="bg-info-muted border border-info-muted text-info-muted-foreground px-4 py-2 rounded-lg text-sm flex items-center gap-2">
            <Move className="h-4 w-4" />
            Arrastra los widgets para reordenarlos
          </div>
        )}

        {/* Grid de Widgets con Drag & Drop */}
        {layout.widgets.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={layout.widgets.map(w => w.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {layout.widgets
                  .sort((a, b) => a.order - b.order)
                  .map((widget) => {
                    const widgetDef = getWidgetById(widget.widgetId);
                    if (!widgetDef) return null;
                    
                    return (
                      <SortableWidget
                        key={widget.id}
                        widget={widget}
                        widgetDef={widgetDef}
                        companyId={companyId}
                        sectorId={sectorId}
                        userId={userId}
                        isEditMode={isEditMode}
                        onRemove={() => removeWidget(widget.id)}
                        onStyleChange={(newStyle) => changeWidgetStyle(widget.id, newStyle)}
                      />
                    );
                  })}
              </div>
            </SortableContext>

            {/* Overlay durante drag */}
            <DragOverlay>
              {activeId && activeWidgetDef ? (
                <Card className="opacity-80 shadow-xl border-2 border-primary">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      {renderIcon(activeWidgetDef.icon)}
                      <span className="font-medium text-sm">{activeWidgetDef.name}</span>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <Card className="border border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Layout className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Tu dashboard está vacío</h3>
              <p className="text-sm text-muted-foreground text-center mb-4">
                Agrega widgets para personalizar tu dashboard
              </p>
              <Button onClick={() => {
                setIsEditMode(true);
                setIsAddWidgetOpen(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Agregar widget
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
