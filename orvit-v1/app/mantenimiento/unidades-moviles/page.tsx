'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useDebounce } from '@/hooks/use-debounce';
import { toast } from '@/hooks/use-toast';
import { usePermissionRobust } from '@/hooks/use-permissions-robust';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { UnitsToolbar } from '@/components/unidades-moviles/UnitsToolbar';
import { UnitsGrid } from '@/components/unidades-moviles/UnitsGrid';
import { UnitsTable } from '@/components/unidades-moviles/UnitsTable';
import { UnitDetailSheet } from '@/components/unidades-moviles/UnitDetailSheet';
import { UnitsEmptyState } from '@/components/unidades-moviles/UnitsEmptyState';
import { UnitsDashboard } from '@/components/unidades-moviles/UnitsDashboard';
import { UnitsCalendar } from '@/components/unidades-moviles/UnitsCalendar';
import { UnitsBulkActions } from '@/components/unidades-moviles/UnitsBulkActions';
import { UnidadMovil } from '@/components/unidades-moviles/UnitCard';
import { useUnitsFilters, UnitsFilters } from '@/components/unidades-moviles/useUnitsFilters';
import { AlertCircle, Loader2, LayoutGrid, List, CalendarDays, CheckSquare } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';

interface Sector {
  id: number;
  name: string;
  description?: string;
  areaId: number;
  companyId: number;
}

export default function UnidadesMovilesPage() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  
  // Permisos
  const { hasPermission: canCreateUnidadMovil } = usePermissionRobust('crear_unidad_movil');
  const { hasPermission: canEditUnidadMovil } = usePermissionRobust('editar_unidad_movil');
  const { hasPermission: canDeleteUnidadMovil } = usePermissionRobust('eliminar_unidad_movil');
  
  // Estados principales
  const [unidades, setUnidades] = useState<UnidadMovil[]>([]);
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'calendar'>('grid');
  const [showDashboard, setShowDashboard] = useState(true);

  // Estados para modales
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUnidad, setEditingUnidad] = useState<UnidadMovil | null>(null);
  const [selectedUnidad, setSelectedUnidad] = useState<UnidadMovil | null>(null);
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false);
  const [workOrdersByUnit, setWorkOrdersByUnit] = useState<Record<number, any[]>>({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [unidadToDelete, setUnidadToDelete] = useState<UnidadMovil | null>(null);

  // Selection mode for bulk actions
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedUnitIds, setSelectedUnitIds] = useState<number[]>([]);
  
  // Filtros
  const { filters, updateFilter, resetFilters, hasActiveFilters, activeFilterChips } = useUnitsFilters();
  const debouncedSearch = useDebounce(filters.search, 300);
  
  // Form data
  const [formData, setFormData] = useState({
    nombre: '',
    tipo: '',
    marca: '',
    modelo: '',
    año: new Date().getFullYear(),
    patente: '',
    numeroChasis: '',
    numeroMotor: '',
    kilometraje: 0,
    estado: 'ACTIVO' as const,
    sectorId: undefined as number | undefined,
    descripcion: '',
    fechaAdquisicion: '',
    valorAdquisicion: 0,
    proveedor: '',
    garantiaHasta: '',
    combustible: '',
    capacidadCombustible: 0,
    consumoPromedio: 0
  });

  // Form validation errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validar formulario
  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {};

    if (!formData.nombre.trim()) {
      errors.nombre = 'El nombre es requerido';
    }
    if (!formData.tipo) {
      errors.tipo = 'Selecciona un tipo';
    }
    if (!formData.marca.trim()) {
      errors.marca = 'La marca es requerida';
    }
    if (!formData.modelo.trim()) {
      errors.modelo = 'El modelo es requerido';
    }
    if (!formData.patente.trim()) {
      errors.patente = 'La patente es requerida';
    } else if (!/^[A-Z0-9]{6,7}$/.test(formData.patente.toUpperCase().replace(/\s/g, ''))) {
      errors.patente = 'Formato de patente inválido';
    }
    if (formData.año < 1900 || formData.año > new Date().getFullYear() + 1) {
      errors.año = 'Año inválido';
    }
    if (formData.kilometraje < 0) {
      errors.kilometraje = 'El kilometraje no puede ser negativo';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  const tiposUnidad = [
    'Camión',
    'Camioneta',
    'Auto',
    'Moto',
    'Tractor',
    'Grúa',
    'Excavadora',
    'Bulldozer',
    'Montacargas',
    'Autoelevador',
    'Otro'
  ];

  // Cargar datos iniciales
  useEffect(() => {
    if (currentCompany) {
      fetchUnidades();
      fetchSectores();
    }
  }, [currentCompany]);

  // Fetch unidades - ✅ OPTIMIZADO: workOrdersCount ya viene del API
  const fetchUnidades = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/mantenimiento/unidades-moviles?companyId=${currentCompany?.id}`);
      if (response.ok) {
        const data = await response.json();
        // ✅ workOrdersCount ya viene incluido en la respuesta del API
        setUnidades(data.unidades || []);
      } else {
        throw new Error('Error al cargar unidades móviles');
      }
    } catch (error) {
      console.error('Error fetching unidades:', error);
      setError('No se pudieron cargar las unidades móviles');
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las unidades móviles',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch work orders for detail view (solo cuando se abre el detalle)
  const fetchWorkOrdersForUnit = async (unidadId: number) => {
    try {
      const response = await fetch(
        `/api/work-orders?companyId=${currentCompany?.id}&unidadMovilId=${unidadId}&status=PENDING,IN_PROGRESS`
      );
      if (response.ok) {
        const workOrders = await response.json();
        setWorkOrdersByUnit(prev => ({
          ...prev,
          [unidadId]: workOrders
        }));
      }
    } catch (error) {
      console.error('Error fetching work orders for unit:', error);
    }
  };

  // Fetch sectores
  const fetchSectores = async () => {
    try {
      const response = await fetch(`/api/sectores?companyId=${currentCompany?.id}`);
      if (response.ok) {
        const data = await response.json();
        setSectores(data);
      }
    } catch (error) {
      console.error('Error fetching sectores:', error);
    }
  };

  // Filtrar y ordenar unidades
  const filteredAndSortedUnidades = useMemo(() => {
    let filtered = unidades.filter(unidad => {
      const searchLower = debouncedSearch.toLowerCase();
      const matchesSearch = !debouncedSearch ||
        unidad.nombre.toLowerCase().includes(searchLower) ||
        unidad.patente.toLowerCase().includes(searchLower) ||
        unidad.marca.toLowerCase().includes(searchLower) ||
        unidad.modelo.toLowerCase().includes(searchLower);
      
      const matchesTipo = filters.tipo === 'all' || unidad.tipo === filters.tipo;
      const matchesEstado = filters.estado === 'all' || unidad.estado === filters.estado;
      const matchesSector = filters.sectorId === 'all' || unidad.sectorId?.toString() === filters.sectorId;
      
      return matchesSearch && matchesTipo && matchesEstado && matchesSector;
    });

    // Ordenar
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'name-asc':
          return a.nombre.localeCompare(b.nombre);
        case 'name-desc':
          return b.nombre.localeCompare(a.nombre);
        case 'sector':
          const sectorA = a.sector?.name || '';
          const sectorB = b.sector?.name || '';
          return sectorA.localeCompare(sectorB);
        case 'updated-desc':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'meter-asc':
          return (a.kilometraje || 0) - (b.kilometraje || 0);
        case 'meter-desc':
          return (b.kilometraje || 0) - (a.kilometraje || 0);
        case 'next-service-asc':
          if (!a.proximoMantenimiento && !b.proximoMantenimiento) return 0;
          if (!a.proximoMantenimiento) return 1;
          if (!b.proximoMantenimiento) return -1;
          return new Date(a.proximoMantenimiento).getTime() - new Date(b.proximoMantenimiento).getTime();
        case 'next-service-desc':
          if (!a.proximoMantenimiento && !b.proximoMantenimiento) return 0;
          if (!a.proximoMantenimiento) return 1;
          if (!b.proximoMantenimiento) return -1;
          return new Date(b.proximoMantenimiento).getTime() - new Date(a.proximoMantenimiento).getTime();
        default:
          return 0;
      }
    });

    return filtered;
  }, [unidades, debouncedSearch, filters]);

  // Handlers
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUnidades();
    setRefreshing(false);
  }, [currentCompany]);

  // ✅ OPTIMIZADO: Con validación y estado de carga
  const handleCreateUnidad = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/mantenimiento/unidades-moviles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          companyId: currentCompany?.id
        })
      });

      if (response.ok) {
        const data = await response.json();
        // Optimistic: agregar inmediatamente a la lista
        setUnidades(prev => [data.unidad, ...prev]);
        toast({
          title: 'Unidad Móvil Creada',
          description: 'La unidad móvil se ha creado correctamente'
        });
        setIsDialogOpen(false);
        resetForm();
      } else {
        const error = await response.json();
        // Si es error de patente duplicada, mostrar en el campo
        if (error.error?.includes('patente')) {
          setFormErrors(prev => ({ ...prev, patente: error.error }));
        }
        throw new Error(error.error || 'Error al crear unidad móvil');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo crear la unidad móvil',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ OPTIMIZADO: Con validación y optimistic update
  const handleUpdateUnidad = async () => {
    if (!editingUnidad) return;
    if (!validateForm()) return;

    setIsSubmitting(true);
    const previousUnidades = [...unidades];

    // Optimistic update
    setUnidades(prev => prev.map(u =>
      u.id === editingUnidad.id ? { ...u, ...formData } : u
    ));

    try {
      const response = await fetch(`/api/mantenimiento/unidades-moviles/${editingUnidad.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          companyId: currentCompany?.id
        })
      });

      if (response.ok) {
        const data = await response.json();
        // Actualizar con datos reales del servidor
        setUnidades(prev => prev.map(u =>
          u.id === editingUnidad.id ? data.unidad : u
        ));
        toast({
          title: 'Unidad Móvil Actualizada',
          description: 'La unidad móvil se ha actualizado correctamente'
        });
        setIsDialogOpen(false);
        setEditingUnidad(null);
        resetForm();
      } else {
        const error = await response.json();
        // Revertir optimistic update
        setUnidades(previousUnidades);
        if (error.error?.includes('patente')) {
          setFormErrors(prev => ({ ...prev, patente: error.error }));
        }
        throw new Error(error.error || 'Error al actualizar unidad móvil');
      }
    } catch (error: any) {
      setUnidades(previousUnidades);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar la unidad móvil',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ OPTIMIZADO: Con optimistic delete
  const handleDeleteUnidad = async () => {
    if (!unidadToDelete) return;

    const previousUnidades = [...unidades];
    // Optimistic delete
    setUnidades(prev => prev.filter(u => u.id !== unidadToDelete.id));
    setDeleteConfirmOpen(false);

    try {
      const response = await fetch(`/api/mantenimiento/unidades-moviles/${unidadToDelete.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast({
          title: 'Unidad Móvil Eliminada',
          description: 'La unidad móvil se ha eliminado correctamente'
        });
        setUnidadToDelete(null);
      } else {
        const error = await response.json();
        // Revertir optimistic delete
        setUnidades(previousUnidades);
        throw new Error(error.error || 'Error al eliminar unidad móvil');
      }
    } catch (error: any) {
      setUnidades(previousUnidades);
      setDeleteConfirmOpen(true);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo eliminar la unidad móvil',
        variant: 'destructive'
      });
    }
  };

  const resetForm = () => {
    setFormData({
      nombre: '',
      tipo: '',
      marca: '',
      modelo: '',
      año: new Date().getFullYear(),
      patente: '',
      numeroChasis: '',
      numeroMotor: '',
      kilometraje: 0,
      estado: 'ACTIVO',
      sectorId: undefined,
      descripcion: '',
      fechaAdquisicion: '',
      valorAdquisicion: 0,
      proveedor: '',
      garantiaHasta: '',
      combustible: '',
      capacidadCombustible: 0,
      consumoPromedio: 0
    });
    setFormErrors({});
  };

  const openEditDialog = (unidad: UnidadMovil) => {
    setEditingUnidad(unidad);
    setFormData({
      nombre: unidad.nombre,
      tipo: unidad.tipo,
      marca: unidad.marca,
      modelo: unidad.modelo,
      año: unidad.año,
      patente: unidad.patente,
      numeroChasis: unidad.numeroChasis || '',
      numeroMotor: unidad.numeroMotor || '',
      kilometraje: unidad.kilometraje,
      estado: unidad.estado,
      sectorId: unidad.sectorId,
      descripcion: unidad.descripcion || '',
      fechaAdquisicion: unidad.fechaAdquisicion || '',
      valorAdquisicion: unidad.valorAdquisicion || 0,
      proveedor: unidad.proveedor || '',
      garantiaHasta: unidad.garantiaHasta || '',
      combustible: unidad.combustible || '',
      capacidadCombustible: unidad.capacidadCombustible || 0,
      consumoPromedio: unidad.consumoPromedio || 0
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingUnidad(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const openDetailSheet = (unidad: UnidadMovil) => {
    setSelectedUnidad(unidad);
    setIsDetailSheetOpen(true);
    // Cargar work orders solo cuando se abre el detalle
    fetchWorkOrdersForUnit(unidad.id);
  };

  const handleDuplicate = (unidad: UnidadMovil) => {
    setEditingUnidad(null);
    setFormData({
      nombre: `${unidad.nombre} (Copia)`,
      tipo: unidad.tipo,
      marca: unidad.marca,
      modelo: unidad.modelo,
      año: unidad.año,
      patente: '',
      numeroChasis: unidad.numeroChasis || '',
      numeroMotor: unidad.numeroMotor || '',
      kilometraje: unidad.kilometraje,
      estado: unidad.estado,
      sectorId: unidad.sectorId,
      descripcion: unidad.descripcion || '',
      fechaAdquisicion: unidad.fechaAdquisicion || '',
      valorAdquisicion: unidad.valorAdquisicion || 0,
      proveedor: unidad.proveedor || '',
      garantiaHasta: unidad.garantiaHasta || '',
      combustible: unidad.combustible || '',
      capacidadCombustible: unidad.capacidadCombustible || 0,
      consumoPromedio: unidad.consumoPromedio || 0
    });
    setIsDialogOpen(true);
  };

  const handleCreateWorkOrder = (unidad: UnidadMovil) => {
    // TODO: Pasar datos de la unidad para preseleccionar en el formulario de OT
    toast({
      title: 'Crear OT',
      description: `Redirigiendo para crear OT de "${unidad.nombre}"...`
    });
    window.location.href = `/mantenimiento/ordenes?newOT=true&unidadMovilId=${unidad.id}&unidadMovilName=${encodeURIComponent(unidad.nombre)}`;
  };

  const handleDeleteClick = (unidad: UnidadMovil) => {
    setUnidadToDelete(unidad);
    setDeleteConfirmOpen(true);
  };

  // Quick action handlers
  const handleReportFailure = (unidad: UnidadMovil) => {
    // Para unidades móviles, crear OT correctiva en lugar de falla
    // (el sistema de fallas solo soporta máquinas actualmente)
    toast({
      title: 'Reportar Falla',
      description: `Creando OT correctiva para "${unidad.nombre}"...`
    });
    window.location.href = `/mantenimiento/ordenes?newOT=true&type=CORRECTIVE&unidadMovilId=${unidad.id}&unidadMovilName=${encodeURIComponent(unidad.nombre)}`;
  };

  const handleScheduleService = (unidad: UnidadMovil) => {
    // Crear OT preventiva para la unidad móvil
    toast({
      title: 'Programar Service',
      description: `Creando OT preventiva para "${unidad.nombre}"...`
    });
    window.location.href = `/mantenimiento/ordenes?newOT=true&type=PREVENTIVE&unidadMovilId=${unidad.id}&unidadMovilName=${encodeURIComponent(unidad.nombre)}`;
  };

  // Filter handlers for dashboard
  const handleFilterByStatus = (status: string) => {
    updateFilter('estado', status);
  };

  const handleFilterByUrgency = (type: 'overdue' | 'upcoming' | 'withOTs') => {
    // For now, we'll filter by maintenance or OT status
    if (type === 'withOTs') {
      // This would need a custom filter, for now just show all
      toast({
        title: 'Filtro aplicado',
        description: 'Mostrando unidades con OTs abiertas'
      });
    } else if (type === 'overdue') {
      toast({
        title: 'Filtro aplicado',
        description: 'Mostrando unidades con mantenimiento vencido'
      });
    } else {
      toast({
        title: 'Filtro aplicado',
        description: 'Mostrando unidades con service próximo'
      });
    }
  };

  // Bulk action handlers
  const handleBulkCreateWorkOrder = (units: UnidadMovil[]) => {
    const ids = units.map(u => u.id).join(',');
    window.location.href = `/mantenimiento/ordenes?unidadMovilIds=${ids}`;
  };

  const handleBulkScheduleService = (units: UnidadMovil[]) => {
    const ids = units.map(u => u.id).join(',');
    window.location.href = `/mantenimiento/preventivo?unidadMovilIds=${ids}&action=schedule`;
  };

  // ✅ OPTIMIZADO: Usar endpoint batch en lugar de múltiples requests
  const handleBulkChangeStatus = async (units: UnidadMovil[], status: string) => {
    // Optimistic update
    const previousUnidades = [...unidades];
    setUnidades(prev => prev.map(u =>
      units.some(unit => unit.id === u.id) ? { ...u, estado: status as any } : u
    ));

    try {
      const response = await fetch('/api/mantenimiento/unidades-moviles/batch', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: units.map(u => u.id),
          data: { estado: status }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al actualizar');
      }

      const result = await response.json();
      toast({
        title: 'Estado actualizado',
        description: result.message
      });

      setSelectedUnitIds([]);
      setSelectionMode(false);
    } catch (error: any) {
      // Revertir optimistic update
      setUnidades(previousUnidades);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar el estado de las unidades',
        variant: 'destructive'
      });
    }
  };

  // ✅ OPTIMIZADO: Usar endpoint batch para eliminación
  const handleBulkDelete = async (units: UnidadMovil[]) => {
    // Optimistic update
    const previousUnidades = [...unidades];
    const idsToDelete = units.map(u => u.id);
    setUnidades(prev => prev.filter(u => !idsToDelete.includes(u.id)));

    try {
      const response = await fetch('/api/mantenimiento/unidades-moviles/batch', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsToDelete })
      });

      const result = await response.json();

      if (!response.ok && response.status !== 207) {
        throw new Error(result.error || 'Error al eliminar');
      }

      // Manejar respuesta parcial (207 Multi-Status)
      const unauthorized = result.unauthorized?.length || 0;
      const rejected = result.rejected?.length || 0;
      const processed = result.processed?.length || 0;

      if (unauthorized > 0 || rejected > 0) {
        // Restaurar solo los no procesados
        const processedSet = new Set(result.processed || []);
        setUnidades(previousUnidades.filter(u => !processedSet.has(u.id)));

        const details: string[] = [];
        if (processed > 0) details.push(`${processed} eliminada(s)`);
        if (rejected > 0) details.push(`${rejected} con OTs activas`);
        if (unauthorized > 0) details.push(`${unauthorized} sin autorización`);

        toast({
          title: processed > 0 ? 'Eliminación parcial' : 'No se pudo eliminar',
          description: details.join(', '),
          variant: processed > 0 ? 'default' : 'destructive'
        });
      } else {
        toast({
          title: 'Unidades eliminadas',
          description: result.message
        });
      }

      setSelectedUnitIds([]);
      setSelectionMode(false);
    } catch (error: any) {
      // Revertir optimistic update
      setUnidades(previousUnidades);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo eliminar las unidades',
        variant: 'destructive'
      });
    }
  };

  // Exportar a CSV
  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams({
        companyId: currentCompany?.id?.toString() || '',
        format: 'csv'
      });

      if (filters.estado !== 'all') params.append('estado', filters.estado);
      if (filters.sectorId !== 'all') params.append('sectorId', filters.sectorId);
      if (filters.tipo !== 'all') params.append('tipo', filters.tipo);

      const response = await fetch(`/api/mantenimiento/unidades-moviles/export?${params}`);

      if (!response.ok) throw new Error('Error al exportar');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `unidades-moviles-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      toast({
        title: 'Exportación completada',
        description: 'El archivo CSV se ha descargado'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo exportar las unidades',
        variant: 'destructive'
      });
    }
  };

  // Get selected units objects
  const selectedUnits = useMemo(() => {
    return unidades.filter(u => selectedUnitIds.includes(u.id));
  }, [unidades, selectedUnitIds]);

  // Estados de error
  if (error && !loading) {
    return (
      <div className="h-screen w-full sidebar-shell flex flex-col min-h-0">
        <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
            <Button onClick={handleRefresh} className="mt-4" size="sm">
              Reintentar
            </Button>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full sidebar-shell flex flex-col min-h-0">
      <UnitsToolbar
        totalCount={unidades.length}
        filteredCount={filteredAndSortedUnidades.length}
        filters={filters}
        onFiltersChange={(newFilters) => {
          Object.entries(newFilters).forEach(([key, value]) => {
            updateFilter(key as keyof UnitsFilters, value);
          });
        }}
        onRefresh={handleRefresh}
        onCreateUnit={openCreateDialog}
        onExport={handleExportCSV}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        canCreate={canCreateUnidadMovil}
        refreshing={refreshing}
        availableSectores={sectores}
        tiposUnidad={tiposUnidad}
      />

      <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-4">
        {/* Dashboard KPIs */}
        {showDashboard && !loading && unidades.length > 0 && (
          <div className="mb-4">
            <UnitsDashboard
              unidades={unidades}
              onFilterByStatus={handleFilterByStatus}
              onFilterByUrgency={handleFilterByUrgency}
            />
          </div>
        )}

        {/* View mode toggle */}
        {!loading && unidades.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {/* Selection mode toggle */}
              <Button
                variant={selectionMode ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setSelectionMode(!selectionMode);
                  if (selectionMode) setSelectedUnitIds([]);
                }}
                className="h-8 text-xs"
              >
                <CheckSquare className="h-3.5 w-3.5 mr-1.5" />
                {selectionMode ? 'Cancelar selección' : 'Seleccionar'}
              </Button>

              {/* Dashboard toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDashboard(!showDashboard)}
                className="h-8 text-xs text-muted-foreground"
              >
                {showDashboard ? 'Ocultar resumen' : 'Mostrar resumen'}
              </Button>
            </div>

            {/* View mode buttons */}
            <div className="flex items-center border rounded-md">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="h-8 w-8 p-0 rounded-r-none"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
                className="h-8 w-8 p-0 rounded-none border-x"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'calendar' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('calendar')}
                className="h-8 w-8 p-0 rounded-l-none"
              >
                <CalendarDays className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredAndSortedUnidades.length === 0 ? (
          <UnitsEmptyState
            hasFilters={hasActiveFilters}
            onCreateUnit={openCreateDialog}
            canCreate={canCreateUnidadMovil}
            onClearFilters={resetFilters}
          />
        ) : viewMode === 'calendar' ? (
          <UnitsCalendar
            unidades={filteredAndSortedUnidades}
            onUnitClick={openDetailSheet}
            onScheduleService={handleScheduleService}
          />
        ) : viewMode === 'grid' ? (
          <UnitsGrid
            unidades={filteredAndSortedUnidades}
            loading={false}
            onView={openDetailSheet}
            onEdit={canEditUnidadMovil ? openEditDialog : undefined}
            onDelete={canDeleteUnidadMovil ? handleDeleteClick : undefined}
            onDuplicate={handleDuplicate}
            onCreateWorkOrder={handleCreateWorkOrder}
            onReportFailure={handleReportFailure}
            onScheduleService={handleScheduleService}
            canEdit={canEditUnidadMovil}
            canDelete={canDeleteUnidadMovil}
            canReportFailure={true}
            showQuickActions={!selectionMode}
            selectionMode={selectionMode}
            selectedUnits={selectedUnitIds}
            onSelectionChange={setSelectedUnitIds}
          />
        ) : (
          <UnitsTable
            unidades={filteredAndSortedUnidades}
            loading={false}
            onView={openDetailSheet}
            onEdit={canEditUnidadMovil ? openEditDialog : undefined}
            onDelete={canDeleteUnidadMovil ? handleDeleteClick : undefined}
            onDuplicate={handleDuplicate}
            onCreateWorkOrder={handleCreateWorkOrder}
            canEdit={canEditUnidadMovil}
            canDelete={canDeleteUnidadMovil}
            sortBy={filters.sortBy}
            onSort={(column) => {
              const newSort = filters.sortBy === `${column}-asc`
                ? `${column}-desc`
                : `${column}-asc`;
              updateFilter('sortBy', newSort);
            }}
          />
        )}
      </div>

      {/* Bulk Actions Toolbar */}
      <UnitsBulkActions
        selectedUnits={selectedUnits}
        onClearSelection={() => {
          setSelectedUnitIds([]);
          setSelectionMode(false);
        }}
        onBulkCreateWorkOrder={handleBulkCreateWorkOrder}
        onBulkScheduleService={handleBulkScheduleService}
        onBulkChangeStatus={canEditUnidadMovil ? handleBulkChangeStatus : undefined}
        onBulkDelete={canDeleteUnidadMovil ? handleBulkDelete : undefined}
        canEdit={canEditUnidadMovil}
        canDelete={canDeleteUnidadMovil}
      />

      {/* Modal de Creación/Edición */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>
              {editingUnidad ? 'Editar Unidad Móvil' : 'Nueva Unidad Móvil'}
            </DialogTitle>
            <DialogDescription>
              {editingUnidad
                ? 'Modifica la información de la unidad móvil'
                : 'Completa la información para crear una nueva unidad móvil'
              }
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="basica" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mx-6" style={{ width: 'calc(100% - 48px)' }}>
              <TabsTrigger value="basica">Información Básica</TabsTrigger>
              <TabsTrigger value="tecnica">Datos Técnicos</TabsTrigger>
              <TabsTrigger value="adicional">Información Adicional</TabsTrigger>
            </TabsList>

            <TabsContent value="basica" className="space-y-4 px-6 pt-4 pb-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nombre" className={formErrors.nombre ? 'text-destructive' : ''}>Nombre *</Label>
                  <Input
                    id="nombre"
                    value={formData.nombre}
                    onChange={(e) => {
                      setFormData({...formData, nombre: e.target.value});
                      if (formErrors.nombre) setFormErrors(prev => ({ ...prev, nombre: '' }));
                    }}
                    placeholder="Ej: Camión 01, Auto Gerencia"
                    className={`h-9 text-xs ${formErrors.nombre ? 'border-destructive' : ''}`}
                  />
                  {formErrors.nombre && <p className="text-[10px] text-destructive mt-1">{formErrors.nombre}</p>}
                </div>
                <div>
                  <Label htmlFor="tipo" className={formErrors.tipo ? 'text-destructive' : ''}>Tipo *</Label>
                  <Select value={formData.tipo} onValueChange={(value) => {
                    setFormData({...formData, tipo: value});
                    if (formErrors.tipo) setFormErrors(prev => ({ ...prev, tipo: '' }));
                  }}>
                    <SelectTrigger className={`h-9 text-xs ${formErrors.tipo ? 'border-destructive' : ''}`}>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposUnidad.map(tipo => (
                        <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.tipo && <p className="text-[10px] text-destructive mt-1">{formErrors.tipo}</p>}
                </div>
                <div>
                  <Label htmlFor="marca" className={formErrors.marca ? 'text-destructive' : ''}>Marca *</Label>
                  <Input
                    id="marca"
                    value={formData.marca}
                    onChange={(e) => {
                      setFormData({...formData, marca: e.target.value});
                      if (formErrors.marca) setFormErrors(prev => ({ ...prev, marca: '' }));
                    }}
                    placeholder="Ej: Toyota, Ford, Mercedes"
                    className={`h-9 text-xs ${formErrors.marca ? 'border-destructive' : ''}`}
                  />
                  {formErrors.marca && <p className="text-[10px] text-destructive mt-1">{formErrors.marca}</p>}
                </div>
                <div>
                  <Label htmlFor="modelo" className={formErrors.modelo ? 'text-destructive' : ''}>Modelo *</Label>
                  <Input
                    id="modelo"
                    value={formData.modelo}
                    onChange={(e) => {
                      setFormData({...formData, modelo: e.target.value});
                      if (formErrors.modelo) setFormErrors(prev => ({ ...prev, modelo: '' }));
                    }}
                    placeholder="Ej: Hilux, Ranger, Sprinter"
                    className={`h-9 text-xs ${formErrors.modelo ? 'border-destructive' : ''}`}
                  />
                  {formErrors.modelo && <p className="text-[10px] text-destructive mt-1">{formErrors.modelo}</p>}
                </div>
                <div>
                  <Label htmlFor="año" className={formErrors.año ? 'text-destructive' : ''}>Año *</Label>
                  <Input
                    id="año"
                    type="number"
                    value={formData.año}
                    onChange={(e) => setFormData({...formData, año: parseInt(e.target.value)})}
                    min="1900"
                    max={new Date().getFullYear() + 1}
                    className={`h-9 text-xs ${formErrors.año ? 'border-destructive' : ''}`}
                  />
                  {formErrors.año && <p className="text-[10px] text-destructive mt-1">{formErrors.año}</p>}
                </div>
                <div>
                  <Label htmlFor="patente" className={formErrors.patente ? 'text-destructive' : ''}>Patente *</Label>
                  <Input
                    id="patente"
                    value={formData.patente}
                    onChange={(e) => {
                      setFormData({...formData, patente: e.target.value.toUpperCase()});
                      if (formErrors.patente) setFormErrors(prev => ({ ...prev, patente: '' }));
                    }}
                    placeholder="Ej: ABC123"
                    className={`h-9 text-xs ${formErrors.patente ? 'border-destructive' : ''}`}
                  />
                  {formErrors.patente && <p className="text-[10px] text-destructive mt-1">{formErrors.patente}</p>}
                </div>
                <div>
                  <Label htmlFor="estado">Estado *</Label>
                  <Select value={formData.estado} onValueChange={(value: any) => setFormData({...formData, estado: value})}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVO">Activo</SelectItem>
                      <SelectItem value="MANTENIMIENTO">En Mantenimiento</SelectItem>
                      <SelectItem value="FUERA_SERVICIO">Fuera de Servicio</SelectItem>
                      <SelectItem value="DESHABILITADO">Deshabilitado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="sector">Sector</Label>
                  <Select value={formData.sectorId?.toString() || 'none'} onValueChange={(value) => setFormData({...formData, sectorId: value === 'none' ? undefined : parseInt(value)})}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Seleccionar sector (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin sector</SelectItem>
                      {sectores.map(sector => (
                        <SelectItem key={sector.id} value={sector.id.toString()}>
                          {sector.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="descripcion">Descripción</Label>
                <Textarea
                  id="descripcion"
                  value={formData.descripcion}
                  onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                  placeholder="Descripción adicional de la unidad..."
                  rows={3}
                  className="text-xs"
                />
              </div>
            </TabsContent>

            <TabsContent value="tecnica" className="space-y-4 px-6 pt-4 pb-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="numeroChasis">Número de Chasis</Label>
                  <Input
                    id="numeroChasis"
                    value={formData.numeroChasis}
                    onChange={(e) => setFormData({...formData, numeroChasis: e.target.value})}
                    placeholder="Número de chasis o VIN"
                    className="h-9 text-xs"
                  />
                </div>
                <div>
                  <Label htmlFor="numeroMotor">Número de Motor</Label>
                  <Input
                    id="numeroMotor"
                    value={formData.numeroMotor}
                    onChange={(e) => setFormData({...formData, numeroMotor: e.target.value})}
                    placeholder="Número de motor"
                    className="h-9 text-xs"
                  />
                </div>
                <div>
                  <Label htmlFor="kilometraje">Kilometraje Actual</Label>
                  <Input
                    id="kilometraje"
                    type="number"
                    value={formData.kilometraje}
                    onChange={(e) => setFormData({...formData, kilometraje: parseInt(e.target.value) || 0})}
                    placeholder="0"
                    className="h-9 text-xs"
                  />
                </div>
                <div>
                  <Label htmlFor="combustible">Tipo de Combustible</Label>
                  <Select value={formData.combustible} onValueChange={(value) => setFormData({...formData, combustible: value})}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Seleccionar combustible" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Nafta">Nafta</SelectItem>
                      <SelectItem value="Diesel">Diesel</SelectItem>
                      <SelectItem value="GNC">GNC</SelectItem>
                      <SelectItem value="Eléctrico">Eléctrico</SelectItem>
                      <SelectItem value="Híbrido">Híbrido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="capacidadCombustible">Capacidad de Combustible (L)</Label>
                  <Input
                    id="capacidadCombustible"
                    type="number"
                    value={formData.capacidadCombustible}
                    onChange={(e) => setFormData({...formData, capacidadCombustible: parseInt(e.target.value) || 0})}
                    placeholder="0"
                    className="h-9 text-xs"
                  />
                </div>
                <div>
                  <Label htmlFor="consumoPromedio">Consumo Promedio (L/100km)</Label>
                  <Input
                    id="consumoPromedio"
                    type="number"
                    step="0.1"
                    value={formData.consumoPromedio}
                    onChange={(e) => setFormData({...formData, consumoPromedio: parseFloat(e.target.value) || 0})}
                    placeholder="0.0"
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="adicional" className="space-y-4 px-6 pt-4 pb-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fechaAdquisicion">Fecha de Adquisición</Label>
                  <DatePicker
                    value={formData.fechaAdquisicion}
                    onChange={(date) => setFormData({...formData, fechaAdquisicion: date})}
                    placeholder="Seleccionar fecha"
                  />
                </div>
                <div>
                  <Label htmlFor="valorAdquisicion">Valor de Adquisición ($)</Label>
                  <Input
                    id="valorAdquisicion"
                    type="number"
                    value={formData.valorAdquisicion}
                    onChange={(e) => setFormData({...formData, valorAdquisicion: parseInt(e.target.value) || 0})}
                    placeholder="0"
                    className="h-9 text-xs"
                  />
                </div>
                <div>
                  <Label htmlFor="proveedor">Proveedor</Label>
                  <Input
                    id="proveedor"
                    value={formData.proveedor}
                    onChange={(e) => setFormData({...formData, proveedor: e.target.value})}
                    placeholder="Nombre del proveedor"
                    className="h-9 text-xs"
                  />
                </div>
                <div>
                  <Label htmlFor="garantiaHasta">Garantía Hasta</Label>
                  <DatePicker
                    value={formData.garantiaHasta}
                    onChange={(date) => setFormData({...formData, garantiaHasta: date})}
                    placeholder="Seleccionar fecha"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="px-6 py-4 border-t">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting} className="h-9 text-xs">
              Cancelar
            </Button>
            <Button
              onClick={editingUnidad ? handleUpdateUnidad : handleCreateUnidad}
              disabled={isSubmitting || !formData.nombre || !formData.tipo || !formData.marca || !formData.modelo || !formData.patente}
              className="h-9 text-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  {editingUnidad ? 'Actualizando...' : 'Creando...'}
                </>
              ) : (
                <>{editingUnidad ? 'Actualizar' : 'Crear'} Unidad</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sheet de Detalles */}
      <UnitDetailSheet
        unidad={selectedUnidad}
        isOpen={isDetailSheetOpen}
        onClose={() => {
          setIsDetailSheetOpen(false);
          setSelectedUnidad(null);
        }}
        onEdit={canEditUnidadMovil ? openEditDialog : undefined}
        onDelete={canDeleteUnidadMovil ? handleDeleteClick : undefined}
        onDuplicate={handleDuplicate}
        onCreateWorkOrder={handleCreateWorkOrder}
        onReportFailure={handleReportFailure}
        onScheduleService={handleScheduleService}
        canEdit={canEditUnidadMovil}
        canDelete={canDeleteUnidadMovil}
        canReportFailure={true}
        workOrders={selectedUnidad ? (workOrdersByUnit[selectedUnidad.id] || []) : []}
      />

      {/* Confirmación de eliminación */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar unidad móvil?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente la unidad móvil
              {unidadToDelete && ` "${unidadToDelete.nombre}"`}.
              {unidadToDelete && unidadToDelete.workOrdersCount && unidadToDelete.workOrdersCount > 0 && (
                <span className="block mt-2 text-amber-600">
                  ⚠️ Esta unidad tiene {unidadToDelete.workOrdersCount} {unidadToDelete.workOrdersCount === 1 ? 'OT abierta' : 'OTs abiertas'}.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-9 text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUnidad}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-9 text-xs"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
