'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Cog,
  Layers,
  AlertCircle,
  CheckSquare,
  AlertTriangle,
  Clock,
  Wrench,
  Droplets,
  Search,
  Sparkles,
  Settings,
  Gauge,
  Cpu,
  Truck,
  ClipboardCheck
} from 'lucide-react';
import { useChecklistItemsTree, parseCode, compareCodes } from '@/hooks/maintenance/use-checklist-items-tree';
import { fetchAllMaintenancesCached } from '@/hooks/use-all-maintenances';
import { useCompany } from '@/contexts/CompanyContext';

interface ChecklistItemsTabProps {
  checklistId: number;
}

interface MaintenanceData {
  id: number;
  machineId?: number;
  componentId?: number;
  subcomponentId?: number;
  machine?: { id: number; name: string; type?: string };
  component?: { id: number; name: string };
  subcomponent?: { id: number; name: string };
  unidadMovil?: { id: number; nombre: string };
}

interface ItemWithHierarchy {
  id: string;
  code: string;
  title: string;
  description?: string;
  minutes: number;
  maintenanceId?: number;
  machineId?: number;
  machineName?: string;
  componentId?: number;
  componentName?: string;
  subcomponentId?: number;
  subcomponentName?: string;
}

interface MachineGroup {
  machineId: number | null;
  machineName: string;
  isUnidadMovil: boolean;
  components: Map<string, ComponentGroup>;
}

interface ComponentGroup {
  componentId: number | null;
  componentName: string;
  subcomponents: Map<string, SubcomponentGroup>;
}

interface SubcomponentGroup {
  subcomponentId: number | null;
  subcomponentName: string;
  items: ItemWithHierarchy[];
}

// Utilidades
function formatMinutes(totalMinutes: number | null | undefined): string {
  if (!totalMinutes || totalMinutes === 0) return '—';
  
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours === 0) {
    return `${minutes} min`;
  }
  
  if (minutes === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${minutes}min`;
}

function safeText(text: string | null | undefined): string {
  return text && text.trim() ? text.trim() : '—';
}

function normalizeDescription(description: string | null | undefined): string {
  if (!description) return '';
  return description;
}

// Determinar icono basado en el título del item
function getItemIcon(title: string): React.ReactNode {
  const titleLower = title.toLowerCase();

  if (titleLower.includes('lubric') || titleLower.includes('aceite') || titleLower.includes('grasa')) {
    return <Droplets className="h-3.5 w-3.5 text-warning-muted-foreground" />;
  }
  if (titleLower.includes('limpi') || titleLower.includes('lavar')) {
    return <Sparkles className="h-3.5 w-3.5 text-info-muted-foreground" />;
  }
  if (titleLower.includes('inspecci') || titleLower.includes('verific') || titleLower.includes('revis') || titleLower.includes('control')) {
    return <Search className="h-3.5 w-3.5 text-primary" />;
  }
  if (titleLower.includes('ajust') || titleLower.includes('calibr') || titleLower.includes('torque')) {
    return <Settings className="h-3.5 w-3.5 text-primary" />;
  }
  if (titleLower.includes('cambio') || titleLower.includes('reempla') || titleLower.includes('sustitu')) {
    return <Wrench className="h-3.5 w-3.5 text-warning-muted-foreground" />;
  }
  if (titleLower.includes('medi') || titleLower.includes('nivel') || titleLower.includes('presi')) {
    return <Gauge className="h-3.5 w-3.5 text-success" />;
  }

  return <ClipboardCheck className="h-3.5 w-3.5 text-muted-foreground" />;
}

// Color del badge de tiempo según duración
function getTimeColor(minutes: number): string {
  if (minutes <= 5) return 'bg-success-muted text-success border-success/20';
  if (minutes <= 15) return 'bg-info-muted text-info-muted-foreground border-info-muted-foreground/20';
  if (minutes <= 30) return 'bg-warning-muted text-warning-muted-foreground border-warning-muted-foreground/20';
  if (minutes <= 60) return 'bg-warning-muted text-warning-muted-foreground border-warning-muted-foreground/20';
  return 'bg-destructive/10 text-destructive border-destructive/20';
}

export function ChecklistItemsTab({ checklistId }: ChecklistItemsTabProps) {
  const queryClient = useQueryClient();
  const { currentCompany } = useCompany();
  const { data, isLoading, error, refetch } = useChecklistItemsTree(checklistId);
  const [maintenanceDataMap, setMaintenanceDataMap] = useState<Map<number, MaintenanceData>>(new Map());
  const [isLoadingMaintenances, setIsLoadingMaintenances] = useState(false);

  // Cargar datos de mantenimiento
  useEffect(() => {
    if (!data?.flatItems || !currentCompany?.id) return;

    const loadMaintenanceData = async () => {
      setIsLoadingMaintenances(true);
      const maintenanceIds: number[] = [];
      
      data.flatItems.forEach(item => {
        if (item.maintenanceId && !maintenanceIds.includes(item.maintenanceId)) {
          maintenanceIds.push(item.maintenanceId);
        }
      });

      if (maintenanceIds.length === 0) {
        setIsLoadingMaintenances(false);
        return;
      }

      try {
        const maintenances = await fetchAllMaintenancesCached(currentCompany.id);
        const newMap = new Map<number, MaintenanceData>();
        
        maintenanceIds.forEach(maintenanceId => {
          const maintenance = maintenances.find((m: any) => m.id === maintenanceId);
          if (maintenance) {
            newMap.set(maintenanceId, maintenance);
          }
        });
        
        setMaintenanceDataMap(newMap);
      } catch (error) {
        console.error('Error cargando datos de mantenimiento:', error);
      } finally {
        setIsLoadingMaintenances(false);
      }
    };

    loadMaintenanceData();
  }, [data?.flatItems, currentCompany?.id]);

  // Construir árbol jerárquico
  const tree = useMemo(() => {
    if (!data?.flatItems) return null;

    const machinesMap = new Map<string, MachineGroup>();
    const itemsWithoutMachine: ItemWithHierarchy[] = [];

    data.flatItems.forEach((item) => {
      const enrichedItem: ItemWithHierarchy = {
        id: item.id,
        code: item.code || '—',
        title: safeText(item.title),
        description: item.description,
        minutes: item.minutes || 0,
        maintenanceId: item.maintenanceId,
      };

      if (!item.maintenanceId) {
        itemsWithoutMachine.push(enrichedItem);
        return;
      }

      const maintenance = maintenanceDataMap.get(item.maintenanceId);
      if (!maintenance) {
        // Si no hay datos de mantenimiento aún, agrupar por maintenanceId
        const machineKey = `maintenance_${item.maintenanceId}`;
        if (!machinesMap.has(machineKey)) {
          machinesMap.set(machineKey, {
            machineId: null,
            machineName: `Mantenimiento ${item.maintenanceId}`,
            isUnidadMovil: false,
            components: new Map(),
          });
        }
        const machine = machinesMap.get(machineKey)!;
        const componentKey = 'sin_componente';
        if (!machine.components.has(componentKey)) {
          machine.components.set(componentKey, {
            componentId: null,
            componentName: 'Sin componente',
            subcomponents: new Map(),
          });
        }
        const component = machine.components.get(componentKey)!;
        const subcomponentKey = 'sin_subcomponente';
        if (!component.subcomponents.has(subcomponentKey)) {
          component.subcomponents.set(subcomponentKey, {
            subcomponentId: null,
            subcomponentName: 'Sin subcomponente',
            items: [],
          });
        }
        component.subcomponents.get(subcomponentKey)!.items.push(enrichedItem);
        return;
      }

      // Determinar máquina
      const machine = maintenance.machine || maintenance.unidadMovil;
      const machineId = maintenance.machineId || maintenance.unidadMovil?.id || null;
      const machineName = machine 
        ? (maintenance.machine?.name || maintenance.unidadMovil?.nombre || 'Sin nombre')
        : 'Sin máquina asignada';
      const isUnidadMovil = !!maintenance.unidadMovil;

      const machineKey = machineId 
        ? `${isUnidadMovil ? 'unidad' : 'machine'}_${machineId}` 
        : `no_machine_${item.maintenanceId}`;

      if (!machinesMap.has(machineKey)) {
        machinesMap.set(machineKey, {
          machineId,
          machineName,
          isUnidadMovil,
          components: new Map(),
        });
      }

      const machineGroup = machinesMap.get(machineKey)!;

      // Determinar componente
      const component = maintenance.component;
      const componentId = maintenance.componentId || null;
      const componentName = component?.name || 'Sin componente';
      const componentKey = componentId ? `comp_${componentId}` : 'sin_componente';

      if (!machineGroup.components.has(componentKey)) {
        machineGroup.components.set(componentKey, {
          componentId,
          componentName,
          subcomponents: new Map(),
        });
      }

      const componentGroup = machineGroup.components.get(componentKey)!;

      // Determinar subcomponente
      const subcomponent = maintenance.subcomponent;
      const subcomponentId = maintenance.subcomponentId || null;
      const subcomponentName = subcomponent?.name || 'Sin subcomponente';
      const subcomponentKey = subcomponentId ? `subcomp_${subcomponentId}` : 'sin_subcomponente';

      if (!componentGroup.subcomponents.has(subcomponentKey)) {
        componentGroup.subcomponents.set(subcomponentKey, {
          subcomponentId,
          subcomponentName,
          items: [],
        });
      }

      enrichedItem.machineId = machineId || undefined;
      enrichedItem.machineName = machineName;
      enrichedItem.componentId = componentId || undefined;
      enrichedItem.componentName = componentName;
      enrichedItem.subcomponentId = subcomponentId || undefined;
      enrichedItem.subcomponentName = subcomponentName;

      componentGroup.subcomponents.get(subcomponentKey)!.items.push(enrichedItem);
    });

    // Ordenar y convertir Maps a Arrays
    const machines = Array.from(machinesMap.values())
      .sort((a, b) => a.machineName.localeCompare(b.machineName))
      .map(machine => ({
        ...machine,
        components: Array.from(machine.components.values())
          .sort((a, b) => {
            if (a.componentId === null && b.componentId !== null) return 1;
            if (a.componentId !== null && b.componentId === null) return -1;
            return a.componentName.localeCompare(b.componentName);
          })
          .map(component => ({
            ...component,
            subcomponents: Array.from(component.subcomponents.values())
              .sort((a, b) => {
                if (a.subcomponentId === null && b.subcomponentId !== null) return 1;
                if (a.subcomponentId !== null && b.subcomponentId === null) return -1;
                return a.subcomponentName.localeCompare(b.subcomponentName);
              })
              .map(subcomponent => ({
                ...subcomponent,
                items: subcomponent.items.sort((a, b) => {
                  const codeA = parseCode(a.code);
                  const codeB = parseCode(b.code);
                  return compareCodes(codeA, codeB);
                }),
              })),
          })),
      }));

    return {
      machines,
      itemsWithoutMachine: itemsWithoutMachine.sort((a, b) => {
        const codeA = parseCode(a.code);
        const codeB = parseCode(b.code);
        return compareCodes(codeA, codeB);
      }),
    };
  }, [data?.flatItems, maintenanceDataMap]);

  // Estados de carga
  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-6 w-32" />
        </div>
        
        {/* Tree skeleton */}
        <div className="space-y-4">
          <div className="bg-muted border-l-4 border-primary p-4 rounded-r-lg">
            <Skeleton className="h-5 w-64" />
          </div>
          <div className="ml-4 space-y-3">
            <div className="bg-info-muted border-l-4 border-primary/40 p-3 rounded-r-lg">
              <Skeleton className="h-4 w-48" />
            </div>
            <div className="ml-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error al cargar los items</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>No se pudieron cargar los items del checklist.</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['checklist-detail', checklistId] });
              refetch();
            }}
            className="ml-4"
          >
            Reintentar
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!data || data.totalItems === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <CheckSquare className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">Este checklist no tiene items cargados</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          Items del Checklist ({data.totalItems})
        </h3>
        <Badge variant="outline" className="text-xs">
          Tiempo Total: {formatMinutes(data.totalMinutes)}
        </Badge>
      </div>

      {/* Árbol jerárquico */}
      <div className="space-y-4">
        {tree?.machines.map((machine, machineIndex) => (
          <div key={`machine-${machine.machineId || machineIndex}`} className="space-y-3">
            {/* Nivel 1: Máquina */}
            <div className={cn('border-l-4 p-4 rounded-r-lg', machine.isUnidadMovil ? 'bg-success-muted border-success' : 'bg-info-muted border-primary')}>
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  {machine.isUnidadMovil ? (
                    <Truck className="h-5 w-5 text-success" />
                  ) : (
                    <Cpu className="h-5 w-5 text-primary" />
                  )}
                  <span className="text-xs text-muted-foreground font-normal">
                    {machine.isUnidadMovil ? 'Unidad Móvil' : 'Máquina'}
                  </span>
                  <span>{safeText(machine.machineName)}</span>
                </h4>
                <Badge variant="outline" className="text-[10px]">
                  {machine.components.reduce((sum, c) =>
                    sum + c.subcomponents.reduce((s, sc) => s + sc.items.length, 0), 0
                  )} items
                </Badge>
              </div>
            </div>

            {/* Componentes */}
            {machine.components.map((component, componentIndex) => (
              <div key={`component-${component.componentId || componentIndex}`} className="ml-4 space-y-3">
                {/* Nivel 2: Componente */}
                {component.componentId && (
                  <div className="bg-info-muted border-l-4 border-primary/40 p-3 rounded-r-lg">
                    <h5 className="font-medium text-foreground flex items-center gap-2">
                      <Layers className="h-4 w-4 text-primary" />
                      Componente: {safeText(component.componentName)}
                    </h5>
                  </div>
                )}

                {/* Subcomponentes */}
                {component.subcomponents.map((subcomponent, subcomponentIndex) => (
                  <div 
                    key={`subcomponent-${subcomponent.subcomponentId || subcomponentIndex}`}
                    className={component.componentId ? 'ml-4' : ''}
                  >
                    {/* Nivel 3: Subcomponente */}
                    {subcomponent.subcomponentId && (
                      <div className="bg-info-muted/50 border-l-4 border-primary/30 p-2 rounded-r-lg mb-2">
                        <h6 className="font-medium text-xs text-foreground flex items-center gap-2">
                          <Layers className="h-3 w-3 text-primary" />
                          Subcomponente: {safeText(subcomponent.subcomponentName)}
                        </h6>
                      </div>
                    )}

                    {/* Nivel 4: Items */}
                    <div className="space-y-2">
                      {subcomponent.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start gap-3 p-3 bg-card border rounded-lg shadow-sm hover:shadow-md transition-shadow"
                          tabIndex={0}
                        >
                          {/* Icono del tipo de tarea */}
                          <div className="flex-shrink-0 mt-0.5">
                            {getItemIcon(item.title)}
                          </div>

                          {/* Contenido principal */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                                    {item.code}
                                  </span>
                                  <h5 className="font-medium text-sm text-foreground truncate">
                                    {item.title}
                                  </h5>
                                </div>
                                {item.description && (
                                  <p className="text-xs text-muted-foreground whitespace-pre-line mt-1 line-clamp-2">
                                    {normalizeDescription(item.description)}
                                  </p>
                                )}
                              </div>

                              {/* Badge de tiempo con color */}
                              <Badge
                                variant="outline"
                                className={cn('text-[10px] shrink-0 flex items-center gap-1', getTimeColor(item.minutes))}
                              >
                                <Clock className="h-3 w-3" />
                                {formatMinutes(item.minutes)}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}

        {/* Items sin máquina asignada */}
        {tree && tree.itemsWithoutMachine.length > 0 && (
          <div className="space-y-3">
            <div className="bg-warning-muted border-l-4 border-warning-muted-foreground p-3 rounded-r-lg">
              <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning-muted-foreground" />
                Tareas generales ({tree.itemsWithoutMachine.length})
              </h4>
            </div>
            <div className="space-y-2">
              {tree.itemsWithoutMachine.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-3 bg-card border rounded-lg shadow-sm hover:shadow-md transition-shadow"
                  tabIndex={0}
                >
                  {/* Icono del tipo de tarea */}
                  <div className="flex-shrink-0 mt-0.5">
                    {getItemIcon(item.title)}
                  </div>

                  {/* Contenido principal */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                            {item.code}
                          </span>
                          <h5 className="font-medium text-sm text-foreground truncate">
                            {item.title}
                          </h5>
                        </div>
                        {item.description && (
                          <p className="text-xs text-muted-foreground whitespace-pre-line mt-1 line-clamp-2">
                            {normalizeDescription(item.description)}
                          </p>
                        )}
                      </div>

                      {/* Badge de tiempo con color */}
                      <Badge
                        variant="outline"
                        className={cn('text-[10px] shrink-0 flex items-center gap-1', getTimeColor(item.minutes))}
                      >
                        <Clock className="h-3 w-3" />
                        {formatMinutes(item.minutes)}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

