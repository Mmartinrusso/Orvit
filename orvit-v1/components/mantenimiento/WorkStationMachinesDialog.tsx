'use client';

import { useState, useEffect } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Settings, 
  X,
  Search,
  Building2,
  Cog,
  Layers,
  CheckCircle,
  Package,
  Wrench,
  Check,
  ChevronDown,
  ChevronRight,
  Network,
  Building
} from 'lucide-react';

interface HierarchicalItem {
  id: number;
  name: string;
  type: 'MACHINE' | 'COMPONENT' | 'SUB_COMPONENT';
  displayName: string;
  fullPath: string;
  description?: string;
  technicalInfo?: string;
  logo?: string;
  brand?: string;
  model?: string;
  status?: string;
  children?: HierarchicalItem[];
}

interface WorkStationMachine {
  id: number;
  workStationId: number;
  machineId: number;
  isRequired: boolean;
  notes?: string;
  machine: {
    id: number;
    name: string;
    nickname?: string;
    type: string;
    brand?: string;
    model?: string;
    status: string;
    photo?: string;
    logo?: string;
  };
}

interface WorkStationMachinesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workStationId: number;
  onSuccess: () => void;
}

export default function WorkStationMachinesDialog({
  open,
  onOpenChange,
  workStationId,
  onSuccess
}: WorkStationMachinesDialogProps) {
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [machines, setMachines] = useState<WorkStationMachine[]>([]);
  const [availableItems, setAvailableItems] = useState<HierarchicalItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedComponents, setSelectedComponents] = useState<number[]>([]);
  const [selectedSubcomponents, setSelectedSubcomponents] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Cargar máquinas del puesto de trabajo
  const loadWorkStationMachines = async () => {
    try {
      const response = await fetch(`/api/work-stations/${workStationId}/machines`);
      if (response.ok) {
        const data = await response.json();
        setMachines(data);
        
        // Marcar como seleccionados los elementos ya asignados
        const assignedIds = data.map((item: WorkStationMachine) => item.machineId);
        
        // Separar componentes principales y subcomponentes
        const mainComponents = [];
        const subComponents = [];
        
        for (const assignedId of assignedIds) {
          // Buscar si es un componente principal
          const mainComponent = availableItems.find(item => item.id === assignedId);
          if (mainComponent) {
            mainComponents.push(assignedId);
          } else {
            // Buscar si es un subcomponente
            const isSubcomponent = availableItems.some(item => 
              item.children?.some(child => child.id === assignedId)
            );
            if (isSubcomponent) {
              subComponents.push(assignedId);
            }
          }
        }
        
        setSelectedComponents(mainComponents);
        setSelectedSubcomponents(subComponents);
      }
    } catch (error) {
      console.error('Error cargando máquinas:', error);
    }
  };

  // Cargar máquinas y componentes disponibles
  const loadAvailableMachines = async () => {
    try {
      if (!currentCompany?.id) return;
      
      const response = await fetch(`/api/machines-and-components?companyId=${currentCompany.id}&includeComponents=true`);
      if (response.ok) {
        const data = await response.json();
        setAvailableItems(data.machines || []);
        
        // Después de cargar los elementos disponibles, cargar las máquinas asignadas
        await loadWorkStationMachines();
      } else {
        console.error('❌ Error en la respuesta de la API:', response.status);
      }
    } catch (error) {
      console.error('Error cargando máquinas y componentes disponibles:', error);
    }
  };

  useEffect(() => {
    if (open && workStationId) {
      loadAvailableMachines();
    }
  }, [open, workStationId, currentCompany?.id]);

  const handleSaveSelection = async () => {
    if (selectedComponents.length === 0 && selectedSubcomponents.length === 0) {
      toast({
        title: 'Error',
        description: 'Por favor selecciona al menos un componente',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      // Primero, remover todos los elementos actuales (solo si existen)
      for (const machine of machines) {
        try {
          await fetch(`/api/work-stations/${workStationId}/machines/${machine.machineId}`, {
            method: 'DELETE',
          });
        } catch (error) {
          // Continuar con el proceso aunque falle la eliminación
        }
      }

      // Luego, agregar los elementos seleccionados
      const allSelectedIds = [...selectedComponents, ...selectedSubcomponents];
      const addedElements = [];
      
      for (const itemId of allSelectedIds) {
        try {
          const response = await fetch(`/api/work-stations/${workStationId}/machines`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              machineId: itemId,
              isRequired: true,
              notes: null
            }),
          });

          if (response.ok) {
            const result = await response.json();
            addedElements.push(result);
          }
        } catch (error) {
          // Continuar con el proceso aunque falle la adición
        }
      }

      if (addedElements.length > 0) {
        toast({
          title: 'Éxito',
          description: `${addedElements.length} componentes actualizados correctamente`
        });
        
        onSuccess();
        onOpenChange(false);
      } else {
        toast({
          title: 'Advertencia',
          description: 'No se pudieron agregar nuevos componentes',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error guardando selección:', error);
      toast({
        title: 'Error',
        description: 'Error al guardar la selección',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleComponentToggle = (componentId: number) => {
    if (selectedComponents.includes(componentId)) {
      // Remover componente y sus subcomponentes
      const component = availableItems.find(item => item.id === componentId);
      const subcomponentIds = component?.children?.map(child => child.id) || [];
      
      const newSelectedComponents = selectedComponents.filter(id => id !== componentId);
      const newSelectedSubcomponents = selectedSubcomponents.filter(id => !subcomponentIds.includes(id));
      
      setSelectedComponents(newSelectedComponents);
      setSelectedSubcomponents(newSelectedSubcomponents);
    } else {
      // Agregar componente y sus subcomponentes
      const component = availableItems.find(item => item.id === componentId);
      const subcomponentIds = component?.children?.map(child => child.id) || [];
      
      const newSelectedComponents = [...selectedComponents, componentId];
      const newSelectedSubcomponents = [...selectedSubcomponents, ...subcomponentIds];
      
      setSelectedComponents(newSelectedComponents);
      setSelectedSubcomponents(newSelectedSubcomponents);
    }
  };

  const handleSubcomponentToggle = (subcomponentId: number) => {
    if (selectedSubcomponents.includes(subcomponentId)) {
      // Remover solo el subcomponente
      const newSelectedSubcomponents = selectedSubcomponents.filter(id => id !== subcomponentId);
      setSelectedSubcomponents(newSelectedSubcomponents);
    } else {
      // Agregar subcomponente y asegurar que el padre esté seleccionado
      const parentComponent = availableItems.find(item => 
        item.children?.some(child => child.id === subcomponentId)
      );
      
      let newSelectedComponents = selectedComponents;
      if (parentComponent && !selectedComponents.includes(parentComponent.id)) {
        newSelectedComponents = [...selectedComponents, parentComponent.id];
        setSelectedComponents(newSelectedComponents);
      }
      
      const newSelectedSubcomponents = [...selectedSubcomponents, subcomponentId];
      setSelectedSubcomponents(newSelectedSubcomponents);
    }
  };

  const filteredItems = availableItems.filter(item => 
    item.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.fullPath.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalSelected = selectedComponents.length + selectedSubcomponents.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="full">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-lg">
                  <Network className="h-6 w-6 text-primary" />
                </div>
                Seleccionar Componentes
              </DialogTitle>
              <DialogDescription className="text-base mt-2">
                Selecciona los componentes y subcomponentes involucrados en este puesto de trabajo. 
                Haz clic en un componente padre para seleccionar automáticamente todos sus subcomponentes.
              </DialogDescription>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">
                {totalSelected}
              </div>
              <div className="text-sm text-muted-foreground">Seleccionados</div>
            </div>
          </div>
        </DialogHeader>

        <DialogBody>
          {/* Estadísticas rápidas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-background border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Componentes</p>
                    <p className="text-2xl font-bold text-foreground">{availableItems.length}</p>
                  </div>
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-background border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Componentes Padre</p>
                    <p className="text-2xl font-bold text-foreground">{selectedComponents.length}</p>
                  </div>
                  <Cog className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-background border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Subcomponentes</p>
                    <p className="text-2xl font-bold text-foreground">{selectedSubcomponents.length}</p>
                  </div>
                  <Wrench className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-background border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Seleccionados</p>
                    <p className="text-2xl font-bold text-foreground">{totalSelected}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Grid de Tarjetas de Componentes Organizados */}
          <Card className="border border-border">
            <CardHeader className="bg-muted/30 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <Building className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Componentes de {currentCompany?.name || 'Empresa'}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Haz clic en los componentes para seleccionarlos. Los componentes seleccionados se mostrarán resaltados.
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-sm">
                  {filteredItems.length} componentes disponibles
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {/* Debug temporal */}
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="font-semibold text-yellow-800 mb-2">Debug Info:</h4>
                <div className="text-sm text-yellow-700 space-y-1">
                  <p>Total elementos disponibles: {availableItems.length}</p>
                  <p>Elementos filtrados: {filteredItems.length}</p>
                  <p>Componentes seleccionados: {selectedComponents.length}</p>
                  <p>Subcomponentes seleccionados: {selectedSubcomponents.length}</p>
                  <p>Elementos con hijos: {availableItems.filter(item => item.children && item.children.length > 0).length}</p>
                  <details className="mt-2">
                    <summary className="cursor-pointer font-medium">Ver estructura de datos</summary>
                    <pre className="mt-2 text-xs bg-white p-2 rounded border overflow-auto max-h-40">
                      {JSON.stringify(availableItems.map(item => ({
                        id: item.id,
                        name: item.name,
                        type: item.type,
                        childrenCount: item.children?.length || 0,
                        children: item.children?.map(child => ({
                          id: child.id,
                          name: child.name,
                          childrenCount: child.children?.length || 0
                        }))
                      })), null, 2)}
                    </pre>
                  </details>
                </div>
              </div>

              {/* Barra de búsqueda */}
              <div className="mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar componentes..."
                    className="pl-10 bg-background border-border"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-8">
                {/* Tarjeta de la máquina principal */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-foreground">Máquina Principal</h3>
                  <Card 
                    key="machine-root"
                    className="col-span-6 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20 max-w-sm mx-auto"
                  >
                    <CardContent className="p-3 text-center">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Cog className="h-4 w-4 text-primary" />
                        <h3 className="font-semibold text-sm">{availableItems[0]?.name || 'Máquina'}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground">Máquina Principal</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Componentes principales */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-foreground">Componentes Principales</h3>
                  <div className="grid grid-cols-8 gap-3">
                    {availableItems
                      .filter(item => 
                        searchTerm === '' || 
                        item.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        item.name.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map((item) => (
                        <Card 
                          key={item.id}
                          className={`cursor-pointer transition-all hover:shadow-lg hover:scale-105 ${
                            selectedComponents.includes(item.id) 
                              ? 'ring-2 ring-primary bg-primary/5' 
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => handleComponentToggle(item.id)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <Cog className="h-4 w-4 text-foreground" />
                              <h4 className="font-medium text-xs line-clamp-2">{item.displayName}</h4>
                            </div>
                            <p className="text-xs text-muted-foreground">Componente</p>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </div>

                {/* Subcomponentes */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-foreground">Subcomponentes</h3>
                  <div className="grid grid-cols-8 gap-3">
                    {availableItems
                      .flatMap((item) => 
                        item.children?.map((child) => ({
                          ...child,
                          parentName: item.name,
                          level: 0
                        })) || []
                      )
                      .filter(child => 
                        searchTerm === '' || 
                        child.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        child.parentName.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map((child) => (
                        <Card 
                          key={`${child.parentName}-${child.id}-${child.level}`}
                          className={`cursor-pointer transition-all hover:shadow-lg hover:scale-105 ${
                            selectedSubcomponents.includes(child.id) 
                              ? 'ring-2 ring-primary bg-primary/5' 
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => handleSubcomponentToggle(child.id)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <Wrench className="h-3 w-3 text-foreground" />
                              <h4 className="font-medium text-xs line-clamp-2">{child.name}</h4>
                            </div>
                            <p className="text-xs text-muted-foreground">Subcomponente</p>
                            <p className="text-xs text-muted-foreground/70">de {child.parentName}</p>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </div>

                {/* Sub-subcomponentes */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-foreground">Sub-subcomponentes</h3>
                  <div className="grid grid-cols-8 gap-3">
                    {availableItems
                      .flatMap((item) => 
                        item.children?.flatMap((subcomponent) => 
                          subcomponent.children?.map((subSubcomponent) => ({
                            ...subSubcomponent,
                            parentName: subcomponent.name,
                            grandParentName: item.name,
                            level: 1
                          })) || []
                        ) || []
                      )
                      .filter(child => 
                        searchTerm === '' || 
                        child.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        child.parentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        child.grandParentName.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map((child) => (
                        <Card 
                          key={`${child.grandParentName}-${child.parentName}-${child.id}-${child.level}`}
                          className={`cursor-pointer transition-all hover:shadow-lg hover:scale-105 ${
                            selectedSubcomponents.includes(child.id) 
                              ? 'ring-2 ring-primary bg-primary/5' 
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => handleSubcomponentToggle(child.id)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <Wrench className="h-3 w-3 text-foreground" />
                              <h4 className="font-medium text-xs line-clamp-2">{child.name}</h4>
                            </div>
                            <p className="text-xs text-muted-foreground">Sub-subcomponente</p>
                            <p className="text-xs text-muted-foreground/70">de {child.parentName}</p>
                            <p className="text-xs text-muted-foreground/50">({child.grandParentName})</p>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resumen de selección */}
          <Card className="border border-border bg-muted/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                Resumen de Selección
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Componentes seleccionados */}
              {selectedComponents.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Cog className="h-4 w-4 text-primary" />
                    Componentes Principales ({selectedComponents.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedComponents.map((componentId) => {
                      const component = availableItems.find(c => c.id === componentId);
                      return component ? (
                        <div key={componentId} className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-2 rounded-lg text-sm font-medium shadow-sm">
                          <Cog className="h-4 w-4" />
                          <span>{component.displayName}</span>
                          <button
                            type="button"
                            onClick={() => handleComponentToggle(componentId)}
                            className="ml-2 hover:bg-primary/20 rounded-full w-5 h-5 flex items-center justify-center transition-colors"
                          >
                            ×
                          </button>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
              
              {/* Subcomponentes seleccionados */}
              {(() => {
                const level1Subcomponents = selectedSubcomponents.filter(subcomponentId => {
                  return availableItems.some(comp => 
                    comp.children?.some(child => child.id === subcomponentId)
                  );
                });
                
                return level1Subcomponents.length > 0 ? (
                  <div>
                    <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-primary" />
                      Subcomponentes ({level1Subcomponents.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {level1Subcomponents.map((subcomponentId) => {
                        const subcomponent = availableItems
                          .flatMap(comp => comp.children || [])
                          .find(child => child.id === subcomponentId);
                        return subcomponent ? (
                          <div key={subcomponentId} className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-2 rounded-lg text-sm font-medium shadow-sm">
                            <Wrench className="h-4 w-4" />
                            <span>{subcomponent.name}</span>
                            <button
                              type="button"
                              onClick={() => handleSubcomponentToggle(subcomponentId)}
                              className="ml-2 hover:bg-primary/20 rounded-full w-5 h-5 flex items-center justify-center transition-colors"
                            >
                              ×
                            </button>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Sub-subcomponentes seleccionados */}
              {(() => {
                const level2Subcomponents = selectedSubcomponents.filter(subcomponentId => {
                  return availableItems.some(comp => 
                    comp.children?.some(subcomp => 
                      subcomp.children?.some(subSubcomp => subSubcomp.id === subcomponentId)
                    )
                  );
                });
                
                return level2Subcomponents.length > 0 ? (
                  <div>
                    <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-primary" />
                      Sub-subcomponentes ({level2Subcomponents.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {level2Subcomponents.map((subcomponentId) => {
                        const subSubcomponent = availableItems
                          .flatMap(comp => comp.children || [])
                          .flatMap(subcomp => subcomp.children || [])
                          .find(child => child.id === subcomponentId);
                        
                        // Encontrar el subcomponente padre
                        const parentSubcomponent = availableItems
                          .flatMap(comp => comp.children || [])
                          .find(subcomp => 
                            subcomp.children?.some(subSubcomp => subSubcomp.id === subcomponentId)
                          );
                        
                        return subSubcomponent ? (
                          <div key={subcomponentId} className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-2 rounded-lg text-sm font-medium shadow-sm">
                            <Wrench className="h-4 w-4" />
                            <span>{subSubcomponent.name}</span>
                            <span className="text-xs opacity-70">({parentSubcomponent?.name})</span>
                            <button
                              type="button"
                              onClick={() => handleSubcomponentToggle(subcomponentId)}
                              className="ml-2 hover:bg-primary/20 rounded-full w-5 h-5 flex items-center justify-center transition-colors"
                            >
                              ×
                            </button>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Mensaje cuando no hay selecciones */}
              {selectedComponents.length === 0 && selectedSubcomponents.length === 0 && (
                <div className="text-center py-6 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No hay componentes seleccionados</p>
                  <p className="text-sm">Haz clic en los componentes del esquema para comenzar</p>
                </div>
              )}
            </CardContent>
          </Card>
        </DialogBody>

        <DialogFooter className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">{totalSelected}</span> elementos seleccionados
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedComponents([]);
                setSelectedSubcomponents([]);
              }}
              size="default"
            >
              Limpiar Selección
            </Button>
            <Button
              onClick={handleSaveSelection}
              disabled={loading || totalSelected === 0}
              size="default"
            >
              {loading ? 'Guardando...' : 'Confirmar Selección'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 