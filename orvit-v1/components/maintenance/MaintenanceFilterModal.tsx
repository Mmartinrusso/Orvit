'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, X, Search, List, Package, Wrench, Calendar, AlertCircle, Loader2, ChevronRight, ChevronDown, Cog, Settings2 } from 'lucide-react';
import { toast } from 'sonner';

interface Subcomponent {
  id: number;
  name: string;
  type: string;
  parentId: number;
  subcomponents?: Subcomponent[];
}

interface MachineComponent {
  id: number;
  name: string;
  type: string;
  machineId: number;
  subcomponents: Subcomponent[];
}

interface Machine {
  id: number;
  name: string;
  nickname?: string;
  type: string;
  brand?: string;
  model?: string;
  status: string;
  maintenanceCount?: number;
  sector?: {
    id: number;
    name: string;
    area?: {
      id: number;
      name: string;
    };
  };
}

interface UnidadMovil {
  id: number;
  nombre: string;
  tipo: string;
  marca?: string;
  modelo?: string;
  patente?: string;
  estado: string;
  maintenanceCount?: number;
  sector?: {
    id: number;
    name: string;
  };
}

interface MaintenanceFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewScreen: (filters: {
    machineIds: number[];
    unidadMovilIds: number[];
    maintenanceTypes: string[];
    componentIds?: number[];
    subcomponentIds?: number[];
  }) => void;
  onApplyFilters?: (filters: {
    selectedMachines: string[];
    selectedUnidadesMoviles: string[];
    assetTypeFilter: string[];
    componentIds?: number[];
    subcomponentIds?: number[];
  }) => void;
  mode?: 'list' | 'filter';
  companyId: number;
  sectorId?: number | null;
  initialFilters?: {
    machineIds: number[];
    unidadMovilIds: number[];
    maintenanceTypes: string[];
    componentIds?: number[];
    subcomponentIds?: number[];
  };
  machines?: Machine[];
  unidadesMoviles?: UnidadMovil[];
}

const maintenanceTypes = [
  { id: 'PREVENTIVE', name: 'Preventivo', color: 'bg-green-100 text-green-700 border-green-200' },
  { id: 'CORRECTIVE', name: 'Correctivo', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { id: 'PREDICTIVE', name: 'Predictivo', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'EMERGENCY', name: 'Emergencia', color: 'bg-red-100 text-red-700 border-red-200' }
];

const dateRangeOptions = [
  { id: 'all', label: 'Todos', days: null },
  { id: '7days', label: 'Próximos 7 días', days: 7 },
  { id: '30days', label: 'Próximo mes', days: 30 },
  { id: '90days', label: 'Próximos 3 meses', days: 90 },
];

export default function MaintenanceFilterModal({
  isOpen,
  onClose,
  onViewScreen,
  onApplyFilters,
  mode = 'list',
  companyId,
  sectorId,
  initialFilters,
  machines: machinesProp,
  unidadesMoviles: unidadesMovilesProp
}: MaintenanceFilterModalProps) {
  const [machines, setMachines] = useState<Machine[]>(machinesProp || []);
  const [unidadesMoviles, setUnidadesMoviles] = useState<UnidadMovil[]>(unidadesMovilesProp || []);
  const [selectedMachines, setSelectedMachines] = useState<number[]>([]);
  const [selectedUnidadesMoviles, setSelectedUnidadesMoviles] = useState<number[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['PREVENTIVE', 'CORRECTIVE']);
  const [dateRange, setDateRange] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [maintenancePreview, setMaintenancePreview] = useState<number>(0);

  // Estados para búsqueda
  const [activeTab, setActiveTab] = useState<'machines' | 'mobile'>('machines');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Estados para máquinas expandibles con componentes
  const [expandedMachines, setExpandedMachines] = useState<Set<number>>(new Set());
  const [machineComponents, setMachineComponents] = useState<Record<number, MachineComponent[]>>({});
  const [loadingComponents, setLoadingComponents] = useState<Set<number>>(new Set());
  const [selectedComponents, setSelectedComponents] = useState<number[]>([]);
  const [selectedSubcomponents, setSelectedSubcomponents] = useState<number[]>([]);
  const [expandedComponents, setExpandedComponents] = useState<Set<number>>(new Set());

  // Fetch de máquinas y unidades móviles al abrir
  useEffect(() => {
    if (isOpen && companyId) {
      // Si no se pasaron como props, hacer fetch
      if (!machinesProp || machinesProp.length === 0) {
        fetchEquipment();
      } else {
        // Filtrar máquinas por sector si está seleccionado
        let filteredMachines = machinesProp;
        if (sectorId) {
          filteredMachines = machinesProp.filter(m => m.sector?.id === sectorId);
        }

        setMachines(filteredMachines);
        // Unidades móviles no tienen sectorId, mostrar todas
        setUnidadesMoviles(unidadesMovilesProp || []);
        setDataLoading(false);
      }
    }
  }, [isOpen, companyId, sectorId, machinesProp, unidadesMovilesProp]);

  // Fetch de equipos
  const fetchEquipment = async () => {
    setDataLoading(true);
    try {
      // Construir URL con parámetros
      const machinesParams = new URLSearchParams({ companyId: companyId.toString() });
      if (sectorId) {
        machinesParams.append('sectorId', sectorId.toString());
      }

      // Fetch máquinas
      const machinesResponse = await fetch(`/api/machines?${machinesParams}`);
      if (machinesResponse.ok) {
        const machinesData = await machinesResponse.json();
        const machinesList = machinesData.data || machinesData.machines || machinesData || [];
        setMachines(Array.isArray(machinesList) ? machinesList : []);
      }

      // Fetch unidades móviles - endpoint correcto (no tienen sectorId)
      const unidadesResponse = await fetch(`/api/mantenimiento/unidades-moviles?companyId=${companyId}`);
      if (unidadesResponse.ok) {
        const unidadesData = await unidadesResponse.json();
        const unidadesList = unidadesData.unidades || unidadesData.data || unidadesData || [];
        setUnidadesMoviles(Array.isArray(unidadesList) ? unidadesList : []);
      }
    } catch (error) {
      console.error('Error fetching equipment:', error);
      toast.error('Error al cargar equipos');
    } finally {
      setDataLoading(false);
    }
  };

  // Fetch de componentes de una máquina
  const fetchMachineComponents = useCallback(async (machineId: number) => {
    if (machineComponents[machineId]) return; // Ya cargados

    setLoadingComponents(prev => new Set(prev).add(machineId));
    try {
      const response = await fetch(`/api/machines/${machineId}/components`);
      if (response.ok) {
        const components = await response.json();
        setMachineComponents(prev => ({
          ...prev,
          [machineId]: Array.isArray(components) ? components : []
        }));
      }
    } catch (error) {
      console.error('Error fetching components:', error);
    } finally {
      setLoadingComponents(prev => {
        const newSet = new Set(prev);
        newSet.delete(machineId);
        return newSet;
      });
    }
  }, [machineComponents]);

  // Toggle expandir máquina
  const toggleMachineExpand = useCallback((machineId: number) => {
    setExpandedMachines(prev => {
      const newSet = new Set(prev);
      if (newSet.has(machineId)) {
        newSet.delete(machineId);
      } else {
        newSet.add(machineId);
        // Cargar componentes al expandir
        fetchMachineComponents(machineId);
      }
      return newSet;
    });
  }, [fetchMachineComponents]);

  // Toggle expandir componente
  const toggleComponentExpand = useCallback((componentId: number) => {
    setExpandedComponents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(componentId)) {
        newSet.delete(componentId);
      } else {
        newSet.add(componentId);
      }
      return newSet;
    });
  }, []);

  // Toggle seleccionar componente
  const handleComponentToggle = useCallback((componentId: number, machineId: number, subcomponentIds: number[]) => {
    setSelectedComponents(prev => {
      const isSelected = prev.includes(componentId);
      if (isSelected) {
        // Deseleccionar componente y sus subcomponentes
        setSelectedSubcomponents(prevSub => prevSub.filter(id => !subcomponentIds.includes(id)));
        return prev.filter(id => id !== componentId);
      } else {
        // Seleccionar componente
        // Asegurar que la máquina esté seleccionada
        if (!selectedMachines.includes(machineId)) {
          setSelectedMachines(prevMachines => [...prevMachines, machineId]);
        }
        return [...prev, componentId];
      }
    });
  }, [selectedMachines]);

  // Toggle seleccionar subcomponente
  const handleSubcomponentToggle = useCallback((subcomponentId: number, componentId: number, machineId: number) => {
    setSelectedSubcomponents(prev => {
      const isSelected = prev.includes(subcomponentId);
      if (isSelected) {
        return prev.filter(id => id !== subcomponentId);
      } else {
        // Asegurar que el componente y la máquina estén seleccionados
        if (!selectedComponents.includes(componentId)) {
          setSelectedComponents(prevComp => [...prevComp, componentId]);
        }
        if (!selectedMachines.includes(machineId)) {
          setSelectedMachines(prevMachines => [...prevMachines, machineId]);
        }
        return [...prev, subcomponentId];
      }
    });
  }, [selectedComponents, selectedMachines]);

  // Inicializar filtros cuando se abra el modal
  useEffect(() => {
    if (isOpen && initialFilters) {
      setSelectedMachines(initialFilters.machineIds || []);
      setSelectedUnidadesMoviles(initialFilters.unidadMovilIds || []);
      setSelectedTypes(initialFilters.maintenanceTypes || ['PREVENTIVE', 'CORRECTIVE']);
      setSelectedComponents(initialFilters.componentIds || []);
      setSelectedSubcomponents(initialFilters.subcomponentIds || []);
    }
  }, [isOpen, initialFilters]);

  // Calcular preview de mantenimientos
  useEffect(() => {
    const totalSelected = selectedMachines.length + selectedUnidadesMoviles.length;
    // Estimación simple: cada equipo tiene ~3-5 mantenimientos en promedio
    const estimate = totalSelected * 4;
    setMaintenancePreview(estimate);
  }, [selectedMachines, selectedUnidadesMoviles]);

  // Filtrar máquinas visibles
  const filteredMachines = useMemo(() => {
    let filtered = machines;

    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(m =>
        m.name.toLowerCase().includes(searchLower) ||
        m.id.toString().includes(searchLower) ||
        m.sector?.name?.toLowerCase().includes(searchLower) ||
        m.sector?.area?.name?.toLowerCase().includes(searchLower) ||
        m.nickname?.toLowerCase().includes(searchLower)
      );
    }

    if (statusFilter === 'active') {
      filtered = filtered.filter(m => m.status === 'ACTIVE');
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter(m => m.status !== 'ACTIVE');
    }

    return filtered;
  }, [machines, searchTerm, statusFilter]);

  // Filtrar unidades móviles visibles
  const filteredUnidadesMoviles = useMemo(() => {
    let filtered = unidadesMoviles;

    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(u =>
        u.nombre?.toLowerCase().includes(searchLower) ||
        u.id.toString().includes(searchLower) ||
        u.sector?.name?.toLowerCase().includes(searchLower) ||
        u.patente?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [unidadesMoviles, searchTerm]);

  const handleMachineToggle = (machineId: number) => {
    setSelectedMachines(prev =>
      prev.includes(machineId)
        ? prev.filter(id => id !== machineId)
        : [...prev, machineId]
    );
  };

  const handleUnidadMovilToggle = (unidadId: number) => {
    setSelectedUnidadesMoviles(prev =>
      prev.includes(unidadId)
        ? prev.filter(id => id !== unidadId)
        : [...prev, unidadId]
    );
  };

  const handleTypeToggle = (typeId: string) => {
    setSelectedTypes(prev =>
      prev.includes(typeId)
        ? prev.filter(id => id !== typeId)
        : [...prev, typeId]
    );
  };

  const handleSelectVisible = () => {
    if (activeTab === 'machines') {
      const visibleIds = filteredMachines.map(m => m.id);
      const allVisibleSelected = visibleIds.every(id => selectedMachines.includes(id));

      if (allVisibleSelected) {
        setSelectedMachines(prev => prev.filter(id => !visibleIds.includes(id)));
      } else {
        setSelectedMachines(prev => [...new Set([...prev, ...visibleIds])]);
      }
    } else {
      const visibleIds = filteredUnidadesMoviles.map(u => u.id);
      const allVisibleSelected = visibleIds.every(id => selectedUnidadesMoviles.includes(id));

      if (allVisibleSelected) {
        setSelectedUnidadesMoviles(prev => prev.filter(id => !visibleIds.includes(id)));
      } else {
        setSelectedUnidadesMoviles(prev => [...new Set([...prev, ...visibleIds])]);
      }
    }
  };

  const handleClearAll = () => {
    setSelectedMachines([]);
    setSelectedUnidadesMoviles([]);
    setSelectedTypes(['PREVENTIVE', 'CORRECTIVE']);
    setSearchTerm('');
    setStatusFilter('all');
    setDateRange('all');
    setSelectedComponents([]);
    setSelectedSubcomponents([]);
    setExpandedMachines(new Set());
    setExpandedComponents(new Set());
  };

  const handleRemoveSelection = (type: 'machine' | 'unidad', id: number) => {
    if (type === 'machine') {
      setSelectedMachines(prev => prev.filter(mId => mId !== id));
    } else {
      setSelectedUnidadesMoviles(prev => prev.filter(uId => uId !== id));
    }
  };

  const formatMachineStatus = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'Activo';
      case 'INACTIVE': return 'Inactivo';
      case 'MAINTENANCE': return 'En mantenimiento';
      case 'OUT_OF_SERVICE': return 'Fuera de servicio';
      default: return status;
    }
  };

  const handleApply = async () => {
    if (selectedMachines.length === 0 && selectedUnidadesMoviles.length === 0) {
      toast.error('Selecciona al menos una máquina o unidad móvil');
      return;
    }

    if (selectedTypes.length === 0) {
      toast.error('Selecciona al menos un tipo de mantenimiento');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'filter' && onApplyFilters) {
        onApplyFilters({
          selectedMachines: selectedMachines.map(id => id.toString()),
          selectedUnidadesMoviles: selectedUnidadesMoviles.map(id => id.toString()),
          assetTypeFilter: selectedTypes,
          componentIds: selectedComponents.length > 0 ? selectedComponents : undefined,
          subcomponentIds: selectedSubcomponents.length > 0 ? selectedSubcomponents : undefined
        });
        toast.success('Filtros aplicados correctamente');
      } else {
        await onViewScreen({
          machineIds: selectedMachines,
          unidadMovilIds: selectedUnidadesMoviles,
          maintenanceTypes: selectedTypes,
          componentIds: selectedComponents.length > 0 ? selectedComponents : undefined,
          subcomponentIds: selectedSubcomponents.length > 0 ? selectedSubcomponents : undefined
        });
      }
      onClose();
    } catch (error) {
      console.error('Error:', error);
      toast.error(mode === 'filter' ? 'Error al aplicar filtros' : 'Error al mostrar en pantalla');
    } finally {
      setLoading(false);
    }
  };

  const totalSelected = selectedMachines.length + selectedUnidadesMoviles.length;
  const canProceed = totalSelected > 0 && selectedTypes.length > 0;

  const visibleSelected = activeTab === 'machines'
    ? filteredMachines.filter(m => selectedMachines.includes(m.id)).length
    : filteredUnidadesMoviles.filter(u => selectedUnidadesMoviles.includes(u.id)).length;

  const visibleTotal = activeTab === 'machines' ? filteredMachines.length : filteredUnidadesMoviles.length;

  // Obtener nombres de equipos seleccionados para chips
  const selectedMachineNames = machines.filter(m => selectedMachines.includes(m.id));
  const selectedUnidadNames = unidadesMoviles.filter(u => selectedUnidadesMoviles.includes(u.id));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="lg" className="max-h-[85vh] p-0 flex flex-col overflow-hidden gap-0">
        {/* HEADER */}
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  {mode === 'filter' ? 'Filtros de Mantenimientos' : 'Listado de Mantenimientos'}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {mode === 'filter'
                    ? 'Configura los filtros para personalizar la vista'
                    : 'Selecciona equipos para generar el listado'}
                </DialogDescription>
              </div>
            </div>
            {(totalSelected > 0 || selectedComponents.length > 0) && (
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {totalSelected > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {totalSelected} equipo{totalSelected !== 1 ? 's' : ''}
                  </Badge>
                )}
                {selectedComponents.length > 0 && (
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200">
                    {selectedComponents.length} comp.
                  </Badge>
                )}
                {selectedSubcomponents.length > 0 && (
                  <Badge variant="outline" className="text-xs bg-violet-50 text-violet-600 border-violet-200">
                    {selectedSubcomponents.length} subcomp.
                  </Badge>
                )}
              </div>
            )}
          </div>
        </DialogHeader>

        {/* BODY */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 p-4 gap-4">
          {dataLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Cargando equipos...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Sección de Tipos de Mantenimiento */}
              <div className="flex-shrink-0">
                <p className="text-xs font-medium text-muted-foreground mb-2">Tipo de mantenimiento</p>
                <div className="flex flex-wrap gap-2">
                  {maintenanceTypes.map((type) => {
                    const isSelected = selectedTypes.includes(type.id);
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => handleTypeToggle(type.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                          isSelected
                            ? type.color
                            : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted'
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-current' : 'bg-muted-foreground/30'}`} />
                        {type.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sección de Rango de Fechas */}
              <div className="flex-shrink-0">
                <p className="text-xs font-medium text-muted-foreground mb-2">Rango de fechas</p>
                <div className="flex flex-wrap gap-2">
                  {dateRangeOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setDateRange(option.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                        dateRange === option.id
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-border hover:bg-muted'
                      }`}
                    >
                      <Calendar className="h-3 w-3" />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chips de selección */}
              {(selectedMachineNames.length > 0 || selectedUnidadNames.length > 0 || selectedComponents.length > 0 || selectedSubcomponents.length > 0) && (
                <div className="flex-shrink-0">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Seleccionados</p>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {selectedMachineNames.slice(0, 6).map((machine) => (
                      <Badge
                        key={`m-${machine.id}`}
                        variant="secondary"
                        className="text-xs cursor-pointer hover:bg-destructive/10 hover:text-destructive pr-1"
                        onClick={() => handleRemoveSelection('machine', machine.id)}
                      >
                        <Wrench className="h-2.5 w-2.5 mr-1" />
                        {machine.name}
                        <X className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                    {selectedUnidadNames.slice(0, 4).map((unidad) => (
                      <Badge
                        key={`u-${unidad.id}`}
                        variant="secondary"
                        className="text-xs cursor-pointer hover:bg-destructive/10 hover:text-destructive pr-1"
                        onClick={() => handleRemoveSelection('unidad', unidad.id)}
                      >
                        <Package className="h-2.5 w-2.5 mr-1" />
                        {unidad.nombre}
                        <X className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                    {selectedComponents.length > 0 && (
                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                        <Cog className="h-2.5 w-2.5 mr-1" />
                        {selectedComponents.length} componente{selectedComponents.length !== 1 ? 's' : ''}
                      </Badge>
                    )}
                    {selectedSubcomponents.length > 0 && (
                      <Badge variant="outline" className="text-xs bg-violet-50 text-violet-700 border-violet-200">
                        <Settings2 className="h-2.5 w-2.5 mr-1" />
                        {selectedSubcomponents.length} subcomponente{selectedSubcomponents.length !== 1 ? 's' : ''}
                      </Badge>
                    )}
                    {(selectedMachineNames.length + selectedUnidadNames.length) > 10 && (
                      <Badge variant="outline" className="text-xs">
                        +{(selectedMachineNames.length + selectedUnidadNames.length) - 10} más
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Sección de Equipos */}
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground">Equipos</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearAll}
                    className="h-6 text-xs px-2 text-muted-foreground hover:text-foreground"
                  >
                    Limpiar todo
                  </Button>
                </div>

                <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as 'machines' | 'mobile'); setSearchTerm(''); }} className="flex-1 flex flex-col min-h-0">
                  <TabsList className="grid w-full grid-cols-2 h-9 flex-shrink-0">
                    <TabsTrigger value="machines" className="text-xs">
                      <Wrench className="h-3 w-3 mr-1.5" />
                      Máquinas ({machines.length})
                    </TabsTrigger>
                    <TabsTrigger value="mobile" className="text-xs">
                      <Package className="h-3 w-3 mr-1.5" />
                      Unidades ({unidadesMoviles.length})
                    </TabsTrigger>
                  </TabsList>

                  {/* Búsqueda y filtros */}
                  <div className="flex items-center gap-2 mt-3 flex-shrink-0">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder={activeTab === 'machines' ? "Buscar máquina..." : "Buscar unidad..."}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 h-8 text-xs"
                      />
                    </div>
                    {activeTab === 'machines' && (
                      <div className="flex gap-1">
                        {['all', 'active', 'inactive'].map((filter) => (
                          <button
                            key={filter}
                            type="button"
                            onClick={() => setStatusFilter(filter as 'all' | 'active' | 'inactive')}
                            className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                              statusFilter === filter
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }`}
                          >
                            {filter === 'all' ? 'Todos' : filter === 'active' ? 'Activos' : 'Inactivos'}
                          </button>
                        ))}
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSelectVisible}
                      disabled={visibleTotal === 0}
                      className="h-8 text-xs whitespace-nowrap"
                    >
                      {visibleSelected === visibleTotal && visibleTotal > 0
                        ? 'Deseleccionar'
                        : 'Seleccionar todos'}
                    </Button>
                  </div>

                  {/* Lista de equipos */}
                  <TabsContent value="machines" className="flex-1 min-h-0 mt-2">
                    <ScrollArea className="h-[280px] border rounded-md">
                      {filteredMachines.length === 0 ? (
                        <div className="flex items-center justify-center h-full py-8">
                          <div className="text-center">
                            <AlertCircle className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                            <p className="text-xs text-muted-foreground">
                              {machines.length === 0 ? 'No hay máquinas registradas' : 'Sin resultados'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-2 space-y-1">
                          {filteredMachines.map((machine) => {
                            const isSelected = selectedMachines.includes(machine.id);
                            const isExpanded = expandedMachines.has(machine.id);
                            const isLoadingComps = loadingComponents.has(machine.id);
                            const components = machineComponents[machine.id] || [];

                            return (
                              <div key={machine.id} className="space-y-1">
                                {/* Fila de la máquina */}
                                <div
                                  className={`flex items-center gap-2 p-2 rounded-md transition-colors border ${
                                    isSelected
                                      ? 'border-primary bg-primary/5'
                                      : 'border-transparent bg-muted/30 hover:bg-muted/50'
                                  }`}
                                >
                                  {/* Botón expandir */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleMachineExpand(machine.id);
                                    }}
                                    className="p-0.5 hover:bg-muted rounded transition-colors"
                                  >
                                    {isLoadingComps ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                    ) : isExpanded ? (
                                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                    ) : (
                                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                    )}
                                  </button>

                                  <Checkbox
                                    checked={isSelected}
                                    className="h-3.5 w-3.5"
                                    onClick={(e) => e.stopPropagation()}
                                    onCheckedChange={() => handleMachineToggle(machine.id)}
                                  />
                                  <div
                                    className="flex-1 min-w-0 cursor-pointer"
                                    onClick={() => handleMachineToggle(machine.id)}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-xs truncate">{machine.name}</span>
                                      {machine.maintenanceCount !== undefined && machine.maintenanceCount > 0 && (
                                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                                          {machine.maintenanceCount} mant.
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground">
                                      {machine.sector?.name || 'Sin sector'}
                                    </div>
                                  </div>
                                  <Badge
                                    variant={machine.status === 'ACTIVE' ? 'default' : 'secondary'}
                                    className="text-[10px] px-1.5 py-0 shrink-0"
                                  >
                                    {formatMachineStatus(machine.status)}
                                  </Badge>
                                </div>

                                {/* Componentes expandidos */}
                                {isExpanded && (
                                  <div className="ml-6 pl-2 border-l-2 border-muted space-y-1">
                                    {isLoadingComps ? (
                                      <div className="py-2 text-center">
                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />
                                        <p className="text-[10px] text-muted-foreground mt-1">Cargando componentes...</p>
                                      </div>
                                    ) : components.length === 0 ? (
                                      <div className="py-2 text-center">
                                        <p className="text-[10px] text-muted-foreground">Sin componentes</p>
                                      </div>
                                    ) : (
                                      components.map((component) => {
                                        const isCompSelected = selectedComponents.includes(component.id);
                                        const isCompExpanded = expandedComponents.has(component.id);
                                        const subcomps = component.subcomponents || [];
                                        const subcompIds = subcomps.map(s => s.id);

                                        return (
                                          <div key={component.id} className="space-y-1">
                                            {/* Fila del componente */}
                                            <div
                                              className={`flex items-center gap-2 p-1.5 rounded-md transition-colors ${
                                                isCompSelected
                                                  ? 'bg-blue-50 border border-blue-200'
                                                  : 'bg-muted/20 hover:bg-muted/40'
                                              }`}
                                            >
                                              {/* Botón expandir subcomponentes */}
                                              {subcomps.length > 0 ? (
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleComponentExpand(component.id);
                                                  }}
                                                  className="p-0.5 hover:bg-muted rounded transition-colors"
                                                >
                                                  {isCompExpanded ? (
                                                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                                  ) : (
                                                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                                  )}
                                                </button>
                                              ) : (
                                                <div className="w-4" />
                                              )}

                                              <Checkbox
                                                checked={isCompSelected}
                                                className="h-3 w-3"
                                                onClick={(e) => e.stopPropagation()}
                                                onCheckedChange={() => handleComponentToggle(component.id, machine.id, subcompIds)}
                                              />
                                              <div
                                                className="flex-1 flex items-center gap-1.5 cursor-pointer"
                                                onClick={() => handleComponentToggle(component.id, machine.id, subcompIds)}
                                              >
                                                <Cog className="h-3 w-3 text-blue-600" />
                                                <span className="text-[11px] font-medium">{component.name}</span>
                                                {subcomps.length > 0 && (
                                                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">
                                                    {subcomps.length} sub
                                                  </Badge>
                                                )}
                                              </div>
                                            </div>

                                            {/* Subcomponentes expandidos */}
                                            {isCompExpanded && subcomps.length > 0 && (
                                              <div className="ml-5 pl-2 border-l border-muted space-y-0.5">
                                                {subcomps.map((subcomp) => {
                                                  const isSubSelected = selectedSubcomponents.includes(subcomp.id);
                                                  return (
                                                    <div
                                                      key={subcomp.id}
                                                      className={`flex items-center gap-2 p-1 rounded transition-colors cursor-pointer ${
                                                        isSubSelected
                                                          ? 'bg-violet-50 border border-violet-200'
                                                          : 'hover:bg-muted/30'
                                                      }`}
                                                      onClick={() => handleSubcomponentToggle(subcomp.id, component.id, machine.id)}
                                                    >
                                                      <Checkbox
                                                        checked={isSubSelected}
                                                        className="h-2.5 w-2.5"
                                                        onClick={(e) => e.stopPropagation()}
                                                        onCheckedChange={() => handleSubcomponentToggle(subcomp.id, component.id, machine.id)}
                                                      />
                                                      <Settings2 className="h-2.5 w-2.5 text-violet-600" />
                                                      <span className="text-[10px]">{subcomp.name}</span>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="mobile" className="flex-1 min-h-0 mt-2">
                    <ScrollArea className="h-[250px] border rounded-md">
                      {filteredUnidadesMoviles.length === 0 ? (
                        <div className="flex items-center justify-center h-full py-8">
                          <div className="text-center">
                            <AlertCircle className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                            <p className="text-xs text-muted-foreground">
                              {unidadesMoviles.length === 0 ? 'No hay unidades registradas' : 'Sin resultados'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-2 space-y-1">
                          {filteredUnidadesMoviles.map((unidad) => {
                            const isSelected = selectedUnidadesMoviles.includes(unidad.id);
                            return (
                              <div
                                key={unidad.id}
                                className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors border ${
                                  isSelected
                                    ? 'border-primary bg-primary/5'
                                    : 'border-transparent bg-muted/30 hover:bg-muted/50'
                                }`}
                                onClick={() => handleUnidadMovilToggle(unidad.id)}
                              >
                                <Checkbox checked={isSelected} className="h-3.5 w-3.5" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-xs truncate">{unidad.nombre}</span>
                                    {unidad.maintenanceCount !== undefined && unidad.maintenanceCount > 0 && (
                                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                                        {unidad.maintenanceCount} mant.
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {unidad.patente && `${unidad.patente} • `}{unidad.sector?.name || 'Sin sector'}
                                  </div>
                                </div>
                                <Badge
                                  variant={unidad.estado === 'ACTIVO' ? 'default' : 'secondary'}
                                  className="text-[10px] px-1.5 py-0 shrink-0"
                                >
                                  {unidad.estado}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="border-t border-border bg-muted/30 px-4 py-3 flex-shrink-0">
          <div className="flex justify-between items-center">
            <Button variant="ghost" onClick={onClose} size="sm" className="text-xs">
              Cancelar
            </Button>

            <Button
              onClick={handleApply}
              disabled={loading || !canProceed || dataLoading}
              size="sm"
              className="text-xs"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Cargando...
                </>
              ) : (
                <>
                  <List className="h-3.5 w-3.5 mr-1.5" />
                  {mode === 'filter' ? 'Aplicar Filtros' : `Ver Listado (${totalSelected})`}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
