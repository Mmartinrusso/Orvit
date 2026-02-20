'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { MachineComponent } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Network,
  Cog,
  Wrench,
  Package,
  CircleCheckBig,
  Building,
  Search,
  X,
  Loader2
} from 'lucide-react';

interface ComponentSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  components: MachineComponent[];
  selectedComponents: string[];
  selectedSubcomponents: string[];
  onSelectionChange: (components: string[], subcomponents: string[]) => void;
  machineName?: string;
}

export default function ComponentSelectionModal({
  isOpen,
  onClose,
  components,
  selectedComponents,
  selectedSubcomponents,
  onSelectionChange,
  machineName
}: ComponentSelectionModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Calcular estadísticas
  const totalComponents = components.length;
  const totalSubcomponents = components.reduce((acc, comp) => acc + (comp.children?.length || 0), 0);
  const totalSelected = selectedComponents.length + selectedSubcomponents.length;
  
  // Filtrar componentes por búsqueda
  const filteredComponents = components.filter(comp => 
    comp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    comp.children?.some(sub => sub.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleComponentToggle = (componentId: string) => {
    if (selectedComponents.includes(componentId)) {
      // Deseleccionar componente y todos sus subcomponentes
      const component = components.find(comp => comp.id.toString() === componentId);
      const subcomponentIds = component?.children?.map(child => child.id.toString()) || [];
      onSelectionChange(
        selectedComponents.filter(id => id !== componentId),
        selectedSubcomponents.filter(id => !subcomponentIds.includes(id))
      );
    } else {
      // Seleccionar componente y todos sus subcomponentes
      const component = components.find(comp => comp.id.toString() === componentId);
      const subcomponentIds = component?.children?.map(child => child.id.toString()) || [];
      onSelectionChange(
        [...selectedComponents, componentId],
        [...selectedSubcomponents, ...subcomponentIds]
      );
    }
  };

  const handleSubcomponentToggle = (subcomponentId: string) => {
    if (selectedSubcomponents.includes(subcomponentId)) {
      onSelectionChange(
        selectedComponents,
        selectedSubcomponents.filter(id => id !== subcomponentId)
      );
    } else {
      onSelectionChange(
        selectedComponents,
        [...selectedSubcomponents, subcomponentId]
      );
    }
  };

  const handleClearSelection = () => {
    onSelectionChange([], []);
  };

  const handleConfirmSelection = () => {
    onClose();
  };

  const isComponentSelected = (componentId: string) => selectedComponents.includes(componentId);
  const isSubcomponentSelected = (subcomponentId: string) => selectedSubcomponents.includes(subcomponentId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="full">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-base font-semibold flex items-center gap-2">
                <div className="bg-primary/10 p-1.5 rounded-lg">
                  <Network className="h-4 w-4 text-primary" />
                </div>
                Seleccionar Componentes
              </DialogTitle>
              <DialogDescription className="text-xs mt-1.5">
                Selecciona los componentes y subcomponentes afectados por la falla. 
                Haz clic en un componente padre para seleccionar automáticamente todos sus subcomponentes.
              </DialogDescription>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-primary">
                {totalSelected}
              </div>
              <div className="text-xs text-muted-foreground">Seleccionados</div>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {/* Tarjetas de estadísticas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="rounded-lg border text-card-foreground shadow-sm bg-background border-border">
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Total Componentes</p>
                    <p className="text-lg font-bold text-foreground">{totalComponents + totalSubcomponents}</p>
                  </div>
                  <Package className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
            </div>
            <div className="rounded-lg border text-card-foreground shadow-sm bg-background border-border">
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Componentes Padre</p>
                    <p className="text-lg font-bold text-foreground">{selectedComponents.length}</p>
                  </div>
                  <Cog className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
            </div>
            <div className="rounded-lg border text-card-foreground shadow-sm bg-background border-border">
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Subcomponentes</p>
                    <p className="text-lg font-bold text-foreground">{selectedSubcomponents.length}</p>
                  </div>
                  <Wrench className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
            </div>
            <div className="rounded-lg border text-card-foreground shadow-sm bg-background border-border">
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Total Seleccionados</p>
                    <p className="text-lg font-bold text-foreground">{totalSelected}</p>
                  </div>
                  <CircleCheckBig className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
            </div>
          </div>

          {/* Contenido principal */}
          <div className="rounded-lg bg-card text-card-foreground shadow-sm border border-border">
            <div className="flex flex-col space-y-1.5 p-4 bg-muted/30 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-primary/10 p-1.5 rounded-lg">
                    <Building className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold tracking-tight text-sm">Componentes de {machineName || 'Máquina'}</h3>
                    <p className="text-xs text-muted-foreground">Haz clic en los componentes para seleccionarlos. Los componentes seleccionados se mostrarán resaltados.</p>
                  </div>
                </div>
                <div className="inline-flex items-center rounded-full border px-2 py-0.5 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground text-xs">
                  {totalComponents + totalSubcomponents} componentes disponibles
                </div>
              </div>
            </div>
            
            <div className="p-4">
              {/* Barra de búsqueda */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    className="pl-9 bg-background border-border text-sm h-9"
                    placeholder="Buscar componentes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-6">
                {/* Máquina Principal */}
                <div>
                  <h3 className="text-sm font-semibold mb-3 text-foreground">Máquina Principal</h3>
                  <div className="rounded-lg border bg-card text-card-foreground shadow-sm col-span-6 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20 max-w-sm mx-auto">
                    <div className="p-2.5 text-center">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <Cog className="h-3.5 w-3.5 text-primary" />
                        <h3 className="font-semibold text-xs">{machineName || 'Máquina'}</h3>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Máquina Principal</p>
                    </div>
                  </div>
                </div>

                {/* Componentes Principales */}
                <div>
                  <h3 className="text-sm font-semibold mb-3 text-foreground">Componentes Principales</h3>
                  <div className="grid grid-cols-8 gap-2.5">
                    {components.length === 0 ? (
                      <div className="col-span-8 text-center py-6">
                        <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-3" />
                        <p className="text-xs text-muted-foreground">Cargando componentes...</p>
                      </div>
                    ) : filteredComponents.length === 0 ? (
                      <div className="col-span-8 text-center py-6">
                        <p className="text-xs text-muted-foreground">
                          {searchTerm ? 'No se encontraron componentes que coincidan con la búsqueda' : 'No hay componentes disponibles'}
                        </p>
                      </div>
                    ) : (
                      filteredComponents.map((component) => (
                        <div
                          key={component.id}
                          className={cn('rounded-lg border bg-card text-card-foreground shadow-sm cursor-pointer transition-all hover:shadow-lg hover:scale-105 hover:bg-muted/50',
                            isComponentSelected(component.id.toString()) && 'ring-2 ring-primary bg-primary/5'
                          )}
                          onClick={() => handleComponentToggle(component.id.toString())}
                        >
                          <div className="p-2.5">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Cog className="h-3.5 w-3.5 text-foreground" />
                              <h4 className="font-medium text-xs line-clamp-2">{component.name}</h4>
                            </div>
                            <p className="text-[10px] text-muted-foreground">Componente</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Subcomponentes */}
                <div>
                  <h3 className="text-sm font-semibold mb-3 text-foreground">Subcomponentes</h3>
                  <div className="grid grid-cols-8 gap-2.5">
                    {filteredComponents.flatMap(component => 
                      component.children?.map(subcomponent => (
                        <div
                          key={subcomponent.id}
                          className={cn('rounded-lg border bg-card text-card-foreground shadow-sm cursor-pointer transition-all hover:shadow-lg hover:scale-105 hover:bg-muted/50',
                            isSubcomponentSelected(subcomponent.id.toString()) && 'ring-2 ring-primary bg-primary/5'
                          )}
                          onClick={() => handleSubcomponentToggle(subcomponent.id.toString())}
                        >
                          <div className="p-2.5">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Wrench className="h-3 w-3 text-foreground" />
                              <h4 className="font-medium text-xs line-clamp-2">{subcomponent.name}</h4>
                            </div>
                            <p className="text-[10px] text-muted-foreground">Subcomponente</p>
                            <p className="text-[10px] text-muted-foreground/70">de {component.name}</p>
                          </div>
                        </div>
                      )) || []
                    )}
                  </div>
                </div>

                {/* Sub-subcomponentes (vacío por ahora) */}
                <div>
                  <h3 className="text-sm font-semibold mb-3 text-foreground">Sub-subcomponentes</h3>
                  <div className="grid grid-cols-8 gap-2.5">
                    {/* Aquí se pueden agregar sub-subcomponentes en el futuro */}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Resumen de Selección */}
          <div className="rounded-lg text-card-foreground shadow-sm border border-border bg-muted/20">
            <div className="flex flex-col space-y-1.5 p-4 pb-2">
              <h3 className="font-semibold tracking-tight text-sm flex items-center gap-2">
                <CircleCheckBig className="h-4 w-4 text-primary" />
                Resumen de Selección
              </h3>
            </div>
            <div className="p-4 pt-0 space-y-3">
              {totalSelected > 0 ? (
                <div className="space-y-2">
                  {selectedComponents.length > 0 && (
                    <div>
                      <h4 className="font-medium text-xs mb-1.5">Componentes Seleccionados:</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedComponents.map(componentId => {
                          const component = components.find(c => c.id.toString() === componentId);
                          return component ? (
                            <span key={componentId} className="px-2 py-0.5 bg-info-muted text-info-muted-foreground text-xs rounded">
                              {component.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                  {selectedSubcomponents.length > 0 && (
                    <div>
                      <h4 className="font-medium text-xs mb-1.5">Subcomponentes Seleccionados:</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedSubcomponents.map(subcomponentId => {
                          const subcomponent = components
                            .flatMap(comp => comp.children || [])
                            .find(sub => sub.id.toString() === subcomponentId);
                          return subcomponent ? (
                            <span key={subcomponentId} className="px-2 py-0.5 bg-success-muted text-success text-xs rounded">
                              {subcomponent.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="font-medium text-xs">No hay componentes seleccionados</p>
                  <p className="text-xs">Haz clic en los componentes del esquema para comenzar</p>
                </div>
              )}
            </div>
          </div>
        </DialogBody>

        <DialogFooter className="border-t pt-3">
          <div className="flex justify-between w-full">
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">{totalSelected}</span> elementos seleccionados
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={handleClearSelection}
                disabled={totalSelected === 0}
                className="text-xs"
              >
                Limpiar Selección
              </Button>
              <Button type="button" size="lg" onClick={handleConfirmSelection} className="text-xs">
                Confirmar Selección
              </Button>
            </div>
          </div>
        </DialogFooter>

        {/* Botón de cerrar */}
        <button
          type="button"
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      </DialogContent>
    </Dialog>
  );
}
