'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  X,
  Printer,
  Search,
  Wrench,
  Truck,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cog,
  Settings2,
  Filter
} from 'lucide-react';

interface Machine {
  id: number;
  name: string;
  nickname?: string;
  type: string;
  brand?: string;
  model?: string;
  status: string;
  sector?: {
    id: number;
    name: string;
  };
}

interface PreventiveMaintenance {
  id: number;
  title: string;
  description?: string;
  frequency: number;
  frequencyUnit: string;
  priority: string;
  estimatedDuration: number;
  durationType: string;
  machineId: number;
  instances?: any[];
  timeValue?: number;
  timeUnit?: string;
  estimatedHours?: number;
  nextMaintenanceDate?: string;
  scheduledDate?: string;
  unidadMovilId?: string;
  componentId?: number;
  componentName?: string;
  subcomponentId?: number;
  subcomponentName?: string;
  componentNames?: string[];
  subcomponentNames?: string[];
}

interface CorrectiveMaintenance {
  id: number;
  title: string;
  description?: string;
  type: string;
  priority: string;
  status: string;
  reportedDate?: string;
  assignedTo?: string;
  estimatedCost?: number;
  machineId: number;
  unidadMovilId?: string;
  componentId?: number;
  componentName?: string;
  subcomponentId?: number;
  subcomponentName?: string;
}

interface MaintenanceScreenViewProps {
  isOpen: boolean;
  onClose: () => void;
  data: {
    machines: Machine[];
    preventiveMaintenances: PreventiveMaintenance[];
    correctiveMaintenances: CorrectiveMaintenance[];
    unidadesMoviles?: any[];
  };
  filters: {
    machineIds: number[];
    maintenanceTypes: string[];
    orientation: 'horizontal' | 'vertical';
    displayType: 'screen' | 'pdf';
  };
  companyName: string;
}

function formatPriority(priority: string): string {
  const priorityMap: { [key: string]: string } = {
    'HIGH': 'Alta',
    'MEDIUM': 'Media',
    'LOW': 'Baja',
    'URGENT': 'Urgente',
    'CRITICAL': 'Critica'
  };
  return priorityMap[priority?.toUpperCase()] || priority || 'Media';
}

function formatFrequency(frequency: number, unit: string): string {
  if (!frequency) return 'Sin frecuencia';

  const unitMap: { [key: string]: string } = {
    'DAYS': 'días',
    'WEEKS': 'semanas',
    'MONTHS': 'meses',
    'YEARS': 'años',
    'HOURS': 'horas',
    'KILOMETERS': 'km'
  };
  const unitText = unitMap[unit?.toUpperCase()] || 'días';
  return `Cada ${frequency} ${unitText}`;
}

function getPriorityStyles(priority: string) {
  switch (priority?.toUpperCase()) {
    case 'HIGH':
    case 'URGENT':
    case 'CRITICAL':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'MEDIUM':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'LOW':
      return 'bg-green-100 text-green-700 border-green-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

export default function MaintenanceScreenView({
  isOpen,
  onClose,
  data,
  filters,
  companyName
}: MaintenanceScreenViewProps) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'machines' | 'mobile'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [componentFilter, setComponentFilter] = useState<string | null>(null);
  const [subcomponentFilter, setSubcomponentFilter] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showComponentFilters, setShowComponentFilters] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Extraer componentes y subcomponentes únicos
  const { uniqueComponents, uniqueSubcomponents } = useMemo(() => {
    const preventive = data.preventiveMaintenances || [];
    const corrective = data.correctiveMaintenances || [];
    const allMaintenances = [...preventive, ...corrective];

    const components = new Set<string>();
    const subcomponents = new Set<string>();

    allMaintenances.forEach((m: any) => {
      // Componente individual
      if (m.componentName) components.add(m.componentName);
      // Array de componentes
      if (m.componentNames && Array.isArray(m.componentNames)) {
        m.componentNames.forEach((name: string) => components.add(name));
      }
      // Subcomponente individual
      if (m.subcomponentName) subcomponents.add(m.subcomponentName);
      // Array de subcomponentes
      if (m.subcomponentNames && Array.isArray(m.subcomponentNames)) {
        m.subcomponentNames.forEach((name: string) => subcomponents.add(name));
      }
    });

    return {
      uniqueComponents: Array.from(components).sort(),
      uniqueSubcomponents: Array.from(subcomponents).sort()
    };
  }, [data]);

  const hasUnidades = useMemo(() => {
    return (data.unidadesMoviles || []).length > 0;
  }, [data.unidadesMoviles]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      // Expandir todos los grupos por defecto
      const allGroupIds = [
        ...data.machines.map(m => `machine-${m.id}`),
        ...(data.unidadesMoviles || []).map(u => `unidad-${u.id}`)
      ];
      setExpandedGroups(new Set(allGroupIds));
    }
    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, data]);

  // Procesar y agrupar datos
  const processedData = useMemo(() => {
    const preventive = data.preventiveMaintenances || [];
    const corrective = data.correctiveMaintenances || [];
    const machines = data.machines || [];
    const unidades = data.unidadesMoviles || [];

    // Agrupar por máquina
    const machineGroups = machines.map(machine => {
      const machinePreventive = preventive.filter(m => m.machineId === machine.id);
      const machineCorrective = corrective.filter(m => m.machineId === machine.id);
      return {
        id: `machine-${machine.id}`,
        type: 'machine' as const,
        entity: machine,
        name: machine.name,
        preventive: machinePreventive,
        corrective: machineCorrective,
        total: machinePreventive.length + machineCorrective.length
      };
    }).filter(g => g.total > 0);

    // Agrupar por unidad móvil
    const unidadGroups = unidades.map(unidad => {
      const unidadId = unidad.id?.toString();
      const unidadPreventive = preventive.filter(m => m.unidadMovilId?.toString() === unidadId);
      const unidadCorrective = corrective.filter(m => m.unidadMovilId?.toString() === unidadId);
      return {
        id: `unidad-${unidad.id}`,
        type: 'unidad' as const,
        entity: unidad,
        name: unidad.nombre || unidad.name,
        preventive: unidadPreventive,
        corrective: unidadCorrective,
        total: unidadPreventive.length + unidadCorrective.length
      };
    }).filter(g => g.total > 0);

    return {
      machineGroups,
      unidadGroups,
      allGroups: [...machineGroups, ...unidadGroups],
      totalPreventive: preventive.length,
      totalCorrective: corrective.length,
      totalMachines: machineGroups.length,
      totalUnidades: unidadGroups.length
    };
  }, [data]);

  // Función para verificar si un mantenimiento tiene el componente/subcomponente
  const maintenanceMatchesComponentFilter = (maint: any, compFilter: string | null, subcompFilter: string | null) => {
    if (!compFilter && !subcompFilter) return true;

    let matchesComponent = !compFilter;
    let matchesSubcomponent = !subcompFilter;

    if (compFilter) {
      if (maint.componentName === compFilter) matchesComponent = true;
      if (maint.componentNames && maint.componentNames.includes(compFilter)) matchesComponent = true;
    }

    if (subcompFilter) {
      if (maint.subcomponentName === subcompFilter) matchesSubcomponent = true;
      if (maint.subcomponentNames && maint.subcomponentNames.includes(subcompFilter)) matchesSubcomponent = true;
    }

    return matchesComponent && matchesSubcomponent;
  };

  // Filtrar grupos
  const filteredGroups = useMemo(() => {
    let groups = processedData.allGroups;

    // Filtrar por tab
    if (activeTab === 'machines') {
      groups = processedData.machineGroups;
    } else if (activeTab === 'mobile') {
      groups = processedData.unidadGroups;
    }

    // Filtrar por búsqueda
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      groups = groups.filter(g =>
        g.name?.toLowerCase().includes(search) ||
        g.preventive.some(m => m.title?.toLowerCase().includes(search)) ||
        g.corrective.some(m => m.title?.toLowerCase().includes(search))
      );
    }

    // Filtrar por prioridad
    if (priorityFilter) {
      groups = groups.map(g => ({
        ...g,
        preventive: g.preventive.filter(m => m.priority?.toUpperCase() === priorityFilter),
        corrective: g.corrective.filter(m => m.priority?.toUpperCase() === priorityFilter)
      })).filter(g => g.preventive.length > 0 || g.corrective.length > 0);
    }

    // Filtrar por componente/subcomponente
    if (componentFilter || subcomponentFilter) {
      groups = groups.map(g => ({
        ...g,
        preventive: g.preventive.filter(m => maintenanceMatchesComponentFilter(m, componentFilter, subcomponentFilter)),
        corrective: g.corrective.filter(m => maintenanceMatchesComponentFilter(m, componentFilter, subcomponentFilter))
      })).filter(g => g.preventive.length > 0 || g.corrective.length > 0);
    }

    return groups;
  }, [processedData, activeTab, searchTerm, priorityFilter, componentFilter, subcomponentFilter]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    setExpandedGroups(new Set(filteredGroups.map(g => g.id)));
  };

  const collapseAll = () => {
    setExpandedGroups(new Set());
  };

  const clearFilters = () => {
    setPriorityFilter(null);
    setComponentFilter(null);
    setSubcomponentFilter(null);
    setSearchTerm('');
  };

  const hasActiveFilters = priorityFilter || componentFilter || subcomponentFilter || searchTerm;

  const currentDate = new Date().toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const handlePrint = () => {
    // Expandir todos los grupos antes de imprimir
    setExpandedGroups(new Set(filteredGroups.map(g => g.id)));
    // Esperar a que se actualice el DOM y luego imprimir
    setTimeout(() => {
      window.print();
    }, 100);
  };

  if (!isOpen || !mounted) return null;

  // Determinar número de columnas para stats
  const statsColCount = hasUnidades ? 4 : 3;

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[99999] p-2 sm:p-4 print:p-0 print:bg-white print:backdrop-blur-none"
      onClick={onClose}
    >
      {/* Print styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-container, .print-container * {
            visibility: visible;
          }
          .print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: 100% !important;
            max-height: none !important;
            height: auto !important;
            overflow: visible !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          .print-hide {
            display: none !important;
          }
          .print-show {
            display: block !important;
          }
          .print-content {
            max-height: none !important;
            overflow: visible !important;
            height: auto !important;
          }
          .print-content > div {
            max-height: none !important;
            overflow: visible !important;
          }
          .print-expand {
            display: block !important;
          }
          .group-content {
            display: block !important;
          }
          @page {
            size: A4;
            margin: 8mm;
          }
        }
      `}</style>
      <div
        className="print-container bg-background rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col print:max-w-full print:max-h-none print:shadow-none print:rounded-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b flex items-center justify-between flex-shrink-0 bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center print:h-10 print:w-10">
              <Wrench className="h-6 w-6 text-primary print:h-5 print:w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">{companyName}</h1>
              <p className="text-sm text-muted-foreground">Listado de Mantenimientos</p>
            </div>
          </div>
          <div className="flex items-center gap-2 print-hide">
            <Button variant="outline" size="sm" onClick={handlePrint} className="hidden sm:flex">
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="px-4 sm:px-6 py-4 border-b bg-muted/10">
          <div className={`grid gap-3 sm:gap-4 ${hasUnidades ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
              <Wrench className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-xs text-blue-600 font-medium">Máquinas</p>
                <p className="text-lg font-bold text-blue-700">{processedData.totalMachines}</p>
              </div>
            </div>
            {hasUnidades && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-purple-50 border border-purple-100">
                <Truck className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-xs text-purple-600 font-medium">Unidades</p>
                  <p className="text-lg font-bold text-purple-700">{processedData.totalUnidades}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-100">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-xs text-green-600 font-medium">Preventivos</p>
                <p className="text-lg font-bold text-green-700">{processedData.totalPreventive}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-50 border border-orange-100">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-xs text-orange-600 font-medium">Correctivos</p>
                <p className="text-lg font-bold text-orange-700">{processedData.totalCorrective}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 sm:px-6 py-3 border-b flex flex-col gap-3 print-hide">
          {/* Primera fila: Tabs y búsqueda */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            {/* Tabs - solo mostrar si hay unidades */}
            {hasUnidades ? (
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full sm:w-auto">
                <TabsList className="grid w-full sm:w-auto grid-cols-3 h-8">
                  <TabsTrigger value="all" className="text-xs px-3">
                    Todos ({processedData.allGroups.length})
                  </TabsTrigger>
                  <TabsTrigger value="machines" className="text-xs px-3">
                    <Wrench className="h-3 w-3 mr-1" />
                    Máquinas
                  </TabsTrigger>
                  <TabsTrigger value="mobile" className="text-xs px-3">
                    <Truck className="h-3 w-3 mr-1" />
                    Unidades
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            ) : (
              <Badge variant="secondary" className="text-xs">
                <Wrench className="h-3 w-3 mr-1" />
                {processedData.totalMachines} Máquina{processedData.totalMachines !== 1 ? 's' : ''}
              </Badge>
            )}

            <div className="flex-1 flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none sm:w-48">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>

              <div className="flex gap-1">
                {['HIGH', 'MEDIUM', 'LOW'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriorityFilter(priorityFilter === p ? null : p)}
                    className={`px-2 py-1 rounded text-[10px] font-medium border transition-colors ${
                      priorityFilter === p
                        ? getPriorityStyles(p)
                        : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted'
                    }`}
                  >
                    {formatPriority(p)}
                  </button>
                ))}
              </div>

              <div className="hidden sm:flex gap-1 ml-auto">
                <Button variant="ghost" size="sm" onClick={expandAll} className="h-7 text-xs px-2">
                  <ChevronDown className="h-3 w-3 mr-1" />
                  Expandir
                </Button>
                <Button variant="ghost" size="sm" onClick={collapseAll} className="h-7 text-xs px-2">
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Colapsar
                </Button>
              </div>
            </div>
          </div>

          {/* Segunda fila: Filtros de componentes/subcomponentes */}
          {(uniqueComponents.length > 0 || uniqueSubcomponents.length > 0) && (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setShowComponentFilters(!showComponentFilters)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors self-start"
              >
                <Filter className="h-3 w-3" />
                <span>Filtrar por componentes</span>
                {showComponentFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {(componentFilter || subcomponentFilter) && (
                  <Badge variant="secondary" className="text-[10px] ml-1">
                    {[componentFilter, subcomponentFilter].filter(Boolean).length} activo
                  </Badge>
                )}
              </button>

              {showComponentFilters && (
                <div className="flex flex-col gap-2 p-3 bg-muted/30 rounded-lg">
                  {/* Componentes */}
                  {uniqueComponents.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Cog className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] font-medium text-muted-foreground">Componentes</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {uniqueComponents.map((comp) => (
                          <button
                            key={comp}
                            onClick={() => setComponentFilter(componentFilter === comp ? null : comp)}
                            className={`px-2 py-1 rounded text-[10px] font-medium border transition-colors ${
                              componentFilter === comp
                                ? 'bg-blue-100 text-blue-700 border-blue-200'
                                : 'bg-white text-muted-foreground border-border hover:bg-muted'
                            }`}
                          >
                            {comp}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Subcomponentes */}
                  {uniqueSubcomponents.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Settings2 className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] font-medium text-muted-foreground">Subcomponentes</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {uniqueSubcomponents.map((subcomp) => (
                          <button
                            key={subcomp}
                            onClick={() => setSubcomponentFilter(subcomponentFilter === subcomp ? null : subcomp)}
                            className={`px-2 py-1 rounded text-[10px] font-medium border transition-colors ${
                              subcomponentFilter === subcomp
                                ? 'bg-violet-100 text-violet-700 border-violet-200'
                                : 'bg-white text-muted-foreground border-border hover:bg-muted'
                            }`}
                          >
                            {subcomp}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="h-6 text-[10px] self-start mt-1"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Limpiar filtros
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 print-content">
          <div className="p-4 sm:p-6 space-y-4 print:p-2">
            {filteredGroups.length === 0 ? (
              <div className="text-center py-12">
                <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <Wrench className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-sm font-medium mb-1">Sin resultados</h3>
                <p className="text-xs text-muted-foreground">
                  No se encontraron mantenimientos con los filtros aplicados
                </p>
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" onClick={clearFilters} className="mt-3 text-xs">
                    Limpiar filtros
                  </Button>
                )}
              </div>
            ) : (
              filteredGroups.map((group) => {
                const isExpanded = expandedGroups.has(group.id);
                const Icon = group.type === 'machine' ? Wrench : Truck;
                const bgColor = group.type === 'machine' ? 'bg-blue-50 border-blue-200' : 'bg-purple-50 border-purple-200';
                const iconColor = group.type === 'machine' ? 'text-blue-600' : 'text-purple-600';

                return (
                  <div key={group.id} className="border rounded-lg overflow-hidden print:break-inside-avoid print:mb-4">
                    {/* Group Header */}
                    <button
                      onClick={() => toggleGroup(group.id)}
                      className={`w-full px-4 py-3 flex items-center justify-between ${bgColor} hover:opacity-90 transition-opacity print:py-2`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-lg bg-white/80 flex items-center justify-center ${iconColor} print:h-6 print:w-6`}>
                          <Icon className="h-4 w-4 print:h-3 print:w-3" />
                        </div>
                        <div className="text-left">
                          <h3 className="font-semibold text-base">{group.name}</h3>
                          <p className="text-xs text-muted-foreground">
                            {group.preventive.length} preventivos, {group.corrective.length} correctivos
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {group.preventive.length + group.corrective.length} total
                        </Badge>
                        <span className="print-hide">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </span>
                      </div>
                    </button>

                    {/* Group Content */}
                    {isExpanded && (
                      <div className="p-4 space-y-3 bg-white">
                        {/* Preventivos */}
                        {group.preventive.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                              <span className="text-xs font-medium text-green-700">
                                Preventivos ({group.preventive.length})
                              </span>
                            </div>
                            <div className="grid gap-2">
                              {group.preventive.map((maint) => (
                                <div
                                  key={maint.id}
                                  className="p-3 rounded-lg border border-l-4 border-l-green-500 bg-green-50/30 hover:bg-green-50/50 transition-colors print:break-inside-avoid"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <span className="font-medium text-sm">{maint.title}</span>
                                        <Badge variant="outline" className={`text-[10px] ${getPriorityStyles(maint.priority)}`}>
                                          {formatPriority(maint.priority)}
                                        </Badge>
                                      </div>
                                      {/* Componentes y subcomponentes del mantenimiento */}
                                      {((maint.componentNames && maint.componentNames.length > 0) ||
                                        (maint.subcomponentNames && maint.subcomponentNames.length > 0) ||
                                        maint.componentName || maint.subcomponentName) && (
                                        <div className="flex flex-wrap gap-1 mb-1.5">
                                          {maint.componentName && (
                                            <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-600 border-blue-200">
                                              <Cog className="h-2.5 w-2.5 mr-0.5" />
                                              {maint.componentName}
                                            </Badge>
                                          )}
                                          {maint.componentNames?.map((name, idx) => (
                                            <Badge key={`comp-${idx}`} variant="outline" className="text-[9px] bg-blue-50 text-blue-600 border-blue-200">
                                              <Cog className="h-2.5 w-2.5 mr-0.5" />
                                              {name}
                                            </Badge>
                                          ))}
                                          {maint.subcomponentName && (
                                            <Badge variant="outline" className="text-[9px] bg-violet-50 text-violet-600 border-violet-200">
                                              <Settings2 className="h-2.5 w-2.5 mr-0.5" />
                                              {maint.subcomponentName}
                                            </Badge>
                                          )}
                                          {maint.subcomponentNames?.map((name, idx) => (
                                            <Badge key={`subcomp-${idx}`} variant="outline" className="text-[9px] bg-violet-50 text-violet-600 border-violet-200">
                                              <Settings2 className="h-2.5 w-2.5 mr-0.5" />
                                              {name}
                                            </Badge>
                                          ))}
                                        </div>
                                      )}
                                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                          <Calendar className="h-3 w-3" />
                                          {formatFrequency(maint.frequency, maint.frequencyUnit)}
                                        </span>
                                        {(maint.timeValue || maint.estimatedHours) && (
                                          <span className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {maint.timeValue || maint.estimatedHours} {maint.timeUnit === 'HOURS' ? 'h' : 'min'}
                                          </span>
                                        )}
                                        {maint.nextMaintenanceDate && (
                                          <span className="flex items-center gap-1">
                                            Próx: {new Date(maint.nextMaintenanceDate).toLocaleDateString('es-ES')}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">#{maint.id}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Correctivos */}
                        {group.corrective.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                              <span className="text-xs font-medium text-orange-700">
                                Correctivos ({group.corrective.length})
                              </span>
                            </div>
                            <div className="grid gap-2">
                              {group.corrective.map((maint) => (
                                <div
                                  key={maint.id}
                                  className="p-3 rounded-lg border border-l-4 border-l-orange-500 bg-orange-50/30 hover:bg-orange-50/50 transition-colors print:break-inside-avoid"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <span className="font-medium text-sm">{maint.title}</span>
                                        <Badge variant="outline" className={`text-[10px] ${getPriorityStyles(maint.priority)}`}>
                                          {formatPriority(maint.priority)}
                                        </Badge>
                                      </div>
                                      {/* Componentes del correctivo */}
                                      {(maint.componentName || maint.subcomponentName) && (
                                        <div className="flex flex-wrap gap-1 mb-1.5">
                                          {maint.componentName && (
                                            <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-600 border-blue-200">
                                              <Cog className="h-2.5 w-2.5 mr-0.5" />
                                              {maint.componentName}
                                            </Badge>
                                          )}
                                          {maint.subcomponentName && (
                                            <Badge variant="outline" className="text-[9px] bg-violet-50 text-violet-600 border-violet-200">
                                              <Settings2 className="h-2.5 w-2.5 mr-0.5" />
                                              {maint.subcomponentName}
                                            </Badge>
                                          )}
                                        </div>
                                      )}
                                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                                        <span>Estado: {maint.status}</span>
                                        {maint.estimatedCost && (
                                          <span>${maint.estimatedCost}</span>
                                        )}
                                      </div>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">#{maint.id}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 border-t flex items-center justify-between text-xs text-muted-foreground bg-muted/30">
          <span>Generado: {currentDate}</span>
          <span>{filteredGroups.reduce((acc, g) => acc + g.preventive.length + g.corrective.length, 0)} mantenimientos</span>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
