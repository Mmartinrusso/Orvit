'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, X, Wrench, Cog, ChevronDown, Layers } from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { cn } from '@/lib/utils';

interface MachineTreeSelectorProps {
  value: {
    machineId?: number;
    componentId?: number;
    componentIds?: number[];
    subcomponentIds?: number[];
  };
  onChange: (selection: {
    machineId?: number;
    componentId?: number;
    componentIds?: number[];
    subcomponentIds?: number[];
  }) => void;
  machines?: any[];
  allowMultiple?: boolean;
}

interface Component {
  id: number;
  name: string;
}

interface Subcomponent {
  id: number;
  name: string;
}

export function MachineTreeSelector({
  value,
  onChange,
  machines: externalMachines,
  allowMultiple = false,
}: MachineTreeSelectorProps) {
  const [machineSearch, setMachineSearch] = useState('');
  const [componentSearch, setComponentSearch] = useState('');
  const [expandedComponents, setExpandedComponents] = useState<Record<number, boolean>>({});

  // Obtener sector actual
  const { currentSector } = useCompany();

  // Cargar máquinas si no se proporcionan externamente
  const { data: fetchedMachines, isLoading: loadingMachines } = useQuery<any[]>({
    queryKey: ['machines-sector', currentSector?.id],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '200' });
      if (currentSector?.id) {
        params.append('sectorId', currentSector.id.toString());
      }

      const res = await fetch(`/api/machines?${params.toString()}`);
      if (!res.ok) throw new Error('Error al cargar máquinas');
      const json = await res.json();
      return json.machines || json.data || json;
    },
    enabled: !externalMachines && !!currentSector?.id,
    staleTime: 5 * 60 * 1000,
  });

  const allMachines = externalMachines || fetchedMachines || [];

  // Filtrar máquinas localmente
  const filteredMachines = useMemo(() => {
    if (!allMachines || !machineSearch.trim()) return [];
    const searchLower = machineSearch.toLowerCase().trim();
    return allMachines.filter((m: any) =>
      m.name.toLowerCase().includes(searchLower)
    );
  }, [allMachines, machineSearch]);

  // Fetch componentes de la máquina seleccionada
  const { data: components, isLoading: loadingComponents } = useQuery<Component[]>({
    queryKey: ['components', value.machineId],
    queryFn: async () => {
      if (!value.machineId) return [];
      const res = await fetch(`/api/machines/${value.machineId}/components`);
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || json;
    },
    enabled: !!value.machineId,
  });

  // Fetch todos los subcomponentes de todos los componentes
  const componentIdsForSubcomponents = components?.map(c => c.id) || [];

  const { data: allSubcomponents, isLoading: loadingSubcomponents } = useQuery<Record<number, Subcomponent[]>>({
    queryKey: ['subcomponents-machine', value.machineId, componentIdsForSubcomponents],
    queryFn: async () => {
      if (!componentIdsForSubcomponents || componentIdsForSubcomponents.length === 0) return {};

      const results: Record<number, Subcomponent[]> = {};
      await Promise.all(
        componentIdsForSubcomponents.map(async (componentId) => {
          const res = await fetch(`/api/components/${componentId}/subcomponents`);
          if (res.ok) {
            const json = await res.json();
            results[componentId] = json.data || json;
          } else {
            results[componentId] = [];
          }
        })
      );
      return results;
    },
    enabled: !!value.machineId && componentIdsForSubcomponents.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Filtrar componentes
  const filteredComponents = useMemo(() => {
    if (!components) return [];
    if (!componentSearch.trim()) return components;
    const searchLower = componentSearch.toLowerCase().trim();
    return components.filter((c) =>
      c.name.toLowerCase().includes(searchLower)
    );
  }, [components, componentSearch]);

  const handleMachineSelect = (machineId: number) => {
    onChange({
      machineId,
      componentId: undefined,
      componentIds: undefined,
      subcomponentIds: undefined,
    });
  };

  const handleMachineRemove = () => {
    onChange({
      machineId: undefined,
      componentId: undefined,
      componentIds: undefined,
      subcomponentIds: undefined,
    });
    setMachineSearch('');
    setComponentSearch('');
    setExpandedComponents({});
  };

  const handleComponentToggle = (componentId: number) => {
    if (allowMultiple) {
      const currentIds = value.componentIds || [];
      const newIds = currentIds.includes(componentId)
        ? currentIds.filter((id) => id !== componentId)
        : [...currentIds, componentId];

      onChange({
        machineId: value.machineId!,
        componentId: newIds.length === 1 ? newIds[0] : value.componentId,
        componentIds: newIds.length > 0 ? newIds : undefined,
        subcomponentIds: value.subcomponentIds,
      });
    } else {
      // Single selection
      const isSelected = value.componentId === componentId;
      onChange({
        machineId: value.machineId!,
        componentId: isSelected ? undefined : componentId,
        componentIds: isSelected ? undefined : [componentId],
        subcomponentIds: undefined,
      });
    }
  };

  const handleSubcomponentToggle = (subcomponentId: number) => {
    if (allowMultiple) {
      const currentIds = value.subcomponentIds || [];
      const newIds = currentIds.includes(subcomponentId)
        ? currentIds.filter((id) => id !== subcomponentId)
        : [...currentIds, subcomponentId];

      onChange({
        machineId: value.machineId!,
        componentId: value.componentId,
        componentIds: value.componentIds,
        subcomponentIds: newIds.length > 0 ? newIds : undefined,
      });
    } else {
      // Single selection
      const isSelected = value.subcomponentIds?.includes(subcomponentId);
      onChange({
        machineId: value.machineId!,
        componentId: value.componentId,
        componentIds: value.componentIds,
        subcomponentIds: isSelected ? undefined : [subcomponentId],
      });
    }
  };

  const toggleComponentExpand = (componentId: number) => {
    setExpandedComponents(prev => ({
      ...prev,
      [componentId]: !prev[componentId]
    }));
  };

  if (loadingMachines && !externalMachines) {
    return <Skeleton className="h-20 w-full" />;
  }

  const selectedMachine = allMachines.find((m: any) => m.id === value.machineId);

  return (
    <div className="space-y-4">
      {/* Si NO hay máquina seleccionada, mostrar búsqueda y lista */}
      {!value.machineId && (
        <>
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-10 h-10"
                placeholder="Buscar máquina..."
                value={machineSearch}
                onChange={(e) => setMachineSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Mostrar mensaje si no hay búsqueda */}
          {machineSearch.trim().length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Escriba para buscar máquinas...
            </p>
          )}

          {/* Mostrar resultados instantáneamente mientras escribe */}
          {machineSearch.trim().length >= 1 && (
            <ScrollArea className="max-h-[40vh]">
              <div className="space-y-2 pr-4">
                {filteredMachines.length > 0 ? (
                  filteredMachines.map((machine: any) => (
                    <div
                      key={machine.id}
                      onClick={() => handleMachineSelect(machine.id)}
                      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <Wrench className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm flex-1">{machine.name}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No se encontraron máquinas
                  </p>
                )}
              </div>
            </ScrollArea>
          )}
        </>
      )}

      {/* Si HAY máquina seleccionada, mostrar acordeón con componentes */}
      {value.machineId && selectedMachine && (
        <Accordion type="single" collapsible defaultValue="machine" className="border rounded-lg overflow-hidden">
          <AccordionItem value="machine" className="border-0">
            <div className="flex items-center">
              <AccordionTrigger className="flex-1 px-4 py-3 hover:no-underline hover:bg-muted/30 [&[data-state=open]>svg]:rotate-180">
                <div className="flex items-center gap-3 flex-1">
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{selectedMachine.name}</span>
                </div>
              </AccordionTrigger>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 mr-2"
                onClick={(e) => {
                  e.stopPropagation();
                  handleMachineRemove();
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <AccordionContent className="pt-0 pb-0">
              {/* Barra de búsqueda de componentes */}
              <div className="border-t">
                <div className="flex items-center gap-2 p-3 border-b bg-muted/20">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      className="pl-9 h-8 text-xs"
                      placeholder="Buscar componentes..."
                      value={componentSearch}
                      onChange={(e) => setComponentSearch(e.target.value)}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs px-2.5"
                    disabled={!componentSearch}
                    onClick={() => setComponentSearch('')}
                  >
                    Limpiar
                  </Button>
                </div>

                {/* Lista de componentes */}
                <ScrollArea className="max-h-[70vh]">
                  <div className="p-2">
                    {loadingComponents ? (
                      <Skeleton className="h-40 w-full" />
                    ) : filteredComponents.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        {componentSearch
                          ? 'No se encontraron componentes'
                          : 'No hay componentes disponibles'}
                      </p>
                    ) : (
                      filteredComponents.map((component) => {
                        const hasSubcomponents = (allSubcomponents?.[component.id]?.length || 0) > 0;
                        const isExpanded = expandedComponents[component.id];
                        const isChecked = value.componentId === component.id ||
                                          value.componentIds?.includes(component.id) || false;

                        return (
                          <div key={component.id} className="select-none">
                            {/* Componente */}
                            <div className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors">
                              {/* Botón expandir/colapsar subcomponentes */}
                              {hasSubcomponents ? (
                                <button
                                  type="button"
                                  onClick={() => toggleComponentExpand(component.id)}
                                  className="h-5 w-5 flex items-center justify-center shrink-0"
                                >
                                  <ChevronDown
                                    className={cn(
                                      'h-3.5 w-3.5 text-muted-foreground transition-transform',
                                      isExpanded ? 'rotate-0' : '-rotate-90'
                                    )}
                                  />
                                </button>
                              ) : (
                                <div className="w-5" />
                              )}

                              {/* Checkbox del componente */}
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={() => handleComponentToggle(component.id)}
                                className="shrink-0"
                              />

                              {/* Icono y nombre */}
                              <Cog className="h-4 w-4 text-blue-500 shrink-0" />
                              <span className="text-sm truncate">{component.name}</span>
                            </div>

                            {/* Subcomponentes (si está expandido) */}
                            {hasSubcomponents && isExpanded && (
                              <div>
                                {loadingSubcomponents ? (
                                  <Skeleton className="h-20 w-full ml-4 mt-1" />
                                ) : (
                                  allSubcomponents?.[component.id]?.map((sub) => (
                                    <div
                                      key={sub.id}
                                      className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors ml-4"
                                    >
                                      <div className="w-5" />
                                      <Checkbox
                                        checked={value.subcomponentIds?.includes(sub.id) || false}
                                        onCheckedChange={() => handleSubcomponentToggle(sub.id)}
                                        className="shrink-0"
                                      />
                                      <Layers className="h-4 w-4 text-purple-500 shrink-0" />
                                      <span className="text-sm truncate">{sub.name}</span>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}
