'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { useDebounce } from '@/hooks/use-debounce';
import { useToast } from '@/hooks/use-toast';
import { usePermissionRobust } from '@/hooks/use-permissions-robust';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { WorkstationsToolbar } from '@/components/work-stations/WorkstationsToolbar';
import { WorkstationsGrid } from '@/components/work-stations/WorkstationsGrid';
import { WorkstationsTable } from '@/components/work-stations/WorkstationsTable';
import { WorkstationDetailSheet } from '@/components/work-stations/WorkstationDetailSheet';
import { WorkstationUpsertSheet } from '@/components/work-stations/WorkstationUpsertSheet';
import { WorkstationsEmptyState } from '@/components/work-stations/WorkstationsEmptyState';
import { WorkStation } from '@/components/work-stations/WorkstationCard';
import { useWorkstationsFilters, WorkstationsFilters } from '@/components/work-stations/useWorkstationsFilters';
import {
  AlertCircle,
  Loader2,
  Briefcase,
  FileText,
  Settings2,
  ClipboardList,
  CheckSquare,
  Download,
  Trash2,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

interface Sector {
  id: number;
  name: string;
}

export default function PuestosTrabajoPage() {
  const { currentCompany, currentSector } = useCompany();
  const { toast } = useToast();

  // Permisos
  const { hasPermission: canCreatePuestoTrabajo } = usePermissionRobust('crear_puesto_trabajo');
  const { hasPermission: canEditPuestoTrabajo } = usePermissionRobust('editar_puesto_trabajo');
  const { hasPermission: canDeletePuestoTrabajo } = usePermissionRobust('eliminar_puesto_trabajo');

  // Estados principales
  const [workStations, setWorkStations] = useState<WorkStation[]>([]);
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [showDashboard, setShowDashboard] = useState(true);

  // Estados para modales
  const [isUpsertSheetOpen, setIsUpsertSheetOpen] = useState(false);
  const [editingWorkStation, setEditingWorkStation] = useState<WorkStation | null>(null);
  const [selectedWorkStation, setSelectedWorkStation] = useState<WorkStation | null>(null);
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [workstationToDelete, setWorkstationToDelete] = useState<WorkStation | null>(null);

  // ✅ NUEVO: Modo selección múltiple
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Filtros
  const { filters, updateFilter, resetFilters, hasActiveFilters } = useWorkstationsFilters();
  const debouncedSearch = useDebounce(filters.search, 300);

  // Cargar datos iniciales
  useEffect(() => {
    if (currentCompany && currentSector) {
      fetchWorkStations();
      fetchSectores();
    }
  }, [currentCompany, currentSector]);

  // ✅ OPTIMIZADO: Una sola llamada al API - sin N+1 queries
  const fetchWorkStations = async () => {
    try {
      setLoading(true);
      setError(null);
      const url = `/api/work-stations?companyId=${currentCompany?.id}&sectorId=${currentSector?.id}`;
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        // ✅ El API ahora devuelve todo en una sola respuesta
        setWorkStations(data.workStations || []);
      } else {
        throw new Error('Error al cargar puestos de trabajo');
      }
    } catch (error) {
      console.error('Error fetching work stations:', error);
      setError('No se pudieron cargar los puestos de trabajo');
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los puestos de trabajo',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
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

  // ✅ NUEVO: KPIs del dashboard
  const dashboardStats = useMemo(() => {
    const total = workStations.length;
    const activos = workStations.filter(ws => ws.status === 'ACTIVE').length;
    const inactivos = workStations.filter(ws => ws.status === 'INACTIVE').length;
    const conInstructivos = workStations.filter(ws => (ws.instructivesCount || ws.instructives?.length || 0) > 0).length;
    const conMaquinas = workStations.filter(ws => (ws.machinesCount || ws.machines?.length || 0) > 0).length;
    const sinInstructivos = total - conInstructivos;
    const totalInstructivos = workStations.reduce((acc, ws) => acc + (ws.instructivesCount || ws.instructives?.length || 0), 0);
    const totalMaquinas = workStations.reduce((acc, ws) => acc + (ws.machinesCount || ws.machines?.length || 0), 0);

    return {
      total,
      activos,
      inactivos,
      conInstructivos,
      conMaquinas,
      sinInstructivos,
      totalInstructivos,
      totalMaquinas
    };
  }, [workStations]);

  // Filtrar y ordenar workstations
  const filteredAndSortedWorkStations = useMemo(() => {
    let filtered = workStations.filter(ws => {
      const searchLower = debouncedSearch.toLowerCase();
      const matchesSearch = !debouncedSearch ||
        ws.name.toLowerCase().includes(searchLower) ||
        ws.code.toLowerCase().includes(searchLower) ||
        (ws.description && ws.description.toLowerCase().includes(searchLower));

      const matchesEstado = filters.estado === 'all' || ws.status === filters.estado;

      const instructivesCount = ws.instructivesCount || ws.instructives?.length || 0;
      const hasInstructives = instructivesCount > 0;
      const matchesInstructives = filters.hasInstructives === 'all' ||
        (filters.hasInstructives === 'yes' && hasInstructives) ||
        (filters.hasInstructives === 'no' && !hasInstructives);

      const machinesCount = ws.machinesCount || ws.machines?.length || 0;
      const hasMachines = machinesCount > 0;
      const matchesMachines = filters.hasMachines === 'all' ||
        (filters.hasMachines === 'yes' && hasMachines) ||
        (filters.hasMachines === 'no' && !hasMachines);

      const matchesSector = !filters.sectorId || ws.sectorId.toString() === filters.sectorId;

      return matchesSearch && matchesEstado && matchesInstructives && matchesMachines && matchesSector;
    });

    // Ordenar
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'instructives-desc':
          return (b.instructivesCount || b.instructives?.length || 0) - (a.instructivesCount || a.instructives?.length || 0);
        case 'machines-desc':
          return (b.machinesCount || b.machines?.length || 0) - (a.machinesCount || a.machines?.length || 0);
        case 'recent-desc':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default:
          return 0;
      }
    });

    return filtered;
  }, [workStations, debouncedSearch, filters]);

  // Handlers
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchWorkStations();
    setRefreshing(false);
  }, [currentCompany, currentSector]);

  // ✅ OPTIMIZADO: Con optimistic updates
  const handleSaveWorkStation = async (data: {
    name: string;
    description?: string;
    code?: string;
    status: 'ACTIVE' | 'INACTIVE';
    sectorId?: number;
  }) => {
    if (!currentCompany) {
      toast({
        title: 'Error',
        description: 'No hay empresa seleccionada',
        variant: 'destructive'
      });
      return;
    }

    if (!data.sectorId) {
      toast({
        title: 'Error',
        description: 'Debes seleccionar un sector',
        variant: 'destructive'
      });
      return;
    }

    try {
      const isEdit = editingWorkStation && editingWorkStation.id > 0;
      const url = isEdit
        ? `/api/work-stations/${editingWorkStation.id}`
        : '/api/work-stations';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          sectorId: data.sectorId,
          companyId: currentCompany.id
        })
      });

      if (response.ok) {
        const result = await response.json();
        const savedWorkStation = result.workStation || result;

        toast({
          title: 'Éxito',
          description: result.message || (editingWorkStation
            ? 'Puesto de trabajo actualizado correctamente'
            : 'Puesto de trabajo creado correctamente')
        });

        // ✅ Optimistic: actualizar lista sin refetch completo
        if (isEdit) {
          setWorkStations(prev => prev.map(ws =>
            ws.id === savedWorkStation.id ? { ...ws, ...savedWorkStation } : ws
          ));
        } else {
          // Para creación, necesitamos los datos completos
          const detailResponse = await fetch(`/api/work-stations/${savedWorkStation.id}`);
          if (detailResponse.ok) {
            const detail = await detailResponse.json();
            setWorkStations(prev => [detail, ...prev]);
            setEditingWorkStation(detail);
          }
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al guardar el puesto de trabajo');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo guardar el puesto de trabajo',
        variant: 'destructive'
      });
      throw error;
    }
  };

  // ✅ OPTIMIZADO: Con optimistic delete
  const handleDeleteWorkStation = async () => {
    if (!workstationToDelete) return;

    const previousWorkStations = [...workStations];

    // Optimistic delete
    setWorkStations(prev => prev.filter(ws => ws.id !== workstationToDelete.id));
    setDeleteConfirmOpen(false);

    try {
      const response = await fetch(`/api/work-stations/${workstationToDelete.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast({
          title: 'Éxito',
          description: 'Puesto de trabajo eliminado correctamente'
        });
        setWorkstationToDelete(null);
      } else {
        const error = await response.json();
        // Revertir optimistic delete
        setWorkStations(previousWorkStations);
        throw new Error(error.error || 'Error al eliminar el puesto de trabajo');
      }
    } catch (error: any) {
      setWorkStations(previousWorkStations);
      setDeleteConfirmOpen(true);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo eliminar el puesto de trabajo',
        variant: 'destructive'
      });
    }
  };

  const handleToggleStatus = async (workstation: WorkStation) => {
    const newStatus = workstation.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const previousWorkStations = [...workStations];

    // Optimistic update
    setWorkStations(prev => prev.map(ws =>
      ws.id === workstation.id ? { ...ws, status: newStatus } : ws
    ));

    try {
      const response = await fetch(`/api/work-stations/${workstation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        toast({
          title: 'Éxito',
          description: `Puesto ${newStatus === 'ACTIVE' ? 'activado' : 'desactivado'} correctamente`
        });
      } else {
        setWorkStations(previousWorkStations);
        throw new Error('Error al actualizar el estado');
      }
    } catch (error: any) {
      setWorkStations(previousWorkStations);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar el estado',
        variant: 'destructive'
      });
    }
  };

  const handleDuplicate = (workstation: WorkStation) => {
    setEditingWorkStation({
      ...workstation,
      name: `${workstation.name} (Copia)`,
      id: 0,
    } as WorkStation);
    setIsUpsertSheetOpen(true);
  };

  const handleViewWorkStation = async (workstationId: number) => {
    try {
      const response = await fetch(`/api/work-stations/${workstationId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedWorkStation(data);
        setIsDetailSheetOpen(true);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo cargar el puesto de trabajo',
        variant: 'destructive'
      });
    }
  };

  // ✅ NUEVO: Exportar a CSV
  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams({
        companyId: currentCompany?.id?.toString() || '',
        format: 'csv'
      });

      if (filters.estado !== 'all') params.append('status', filters.estado);
      if (filters.sectorId) params.append('sectorId', filters.sectorId);

      const response = await fetch(`/api/work-stations/export?${params}`);

      if (!response.ok) throw new Error('Error al exportar');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `puestos-trabajo-${new Date().toISOString().split('T')[0]}.csv`;
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
        description: 'No se pudo exportar los puestos de trabajo',
        variant: 'destructive'
      });
    }
  };

  // ✅ NUEVO: Operaciones en lote
  const handleBulkChangeStatus = async (status: 'ACTIVE' | 'INACTIVE') => {
    const previousWorkStations = [...workStations];

    // Optimistic update
    setWorkStations(prev => prev.map(ws =>
      selectedIds.includes(ws.id) ? { ...ws, status } : ws
    ));

    try {
      const response = await fetch('/api/work-stations/batch', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: selectedIds,
          data: { status }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al actualizar');
      }

      const result = await response.json();
      toast({
        title: 'Éxito',
        description: result.message
      });

      setSelectedIds([]);
      setSelectionMode(false);
    } catch (error: any) {
      setWorkStations(previousWorkStations);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar los puestos',
        variant: 'destructive'
      });
    }
  };

  const handleBulkDelete = async () => {
    const previousWorkStations = [...workStations];

    // Optimistic delete
    setWorkStations(prev => prev.filter(ws => !selectedIds.includes(ws.id)));

    try {
      const response = await fetch('/api/work-stations/batch', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al eliminar');
      }

      const result = await response.json();
      toast({
        title: 'Éxito',
        description: result.message
      });

      setSelectedIds([]);
      setSelectionMode(false);
    } catch (error: any) {
      setWorkStations(previousWorkStations);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo eliminar los puestos',
        variant: 'destructive'
      });
    }
  };

  const toggleSelection = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === filteredAndSortedWorkStations.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredAndSortedWorkStations.map(ws => ws.id));
    }
  };

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
      <WorkstationsToolbar
        totalCount={workStations.length}
        filteredCount={filteredAndSortedWorkStations.length}
        filters={filters}
        onFiltersChange={(newFilters) => {
          Object.entries(newFilters).forEach(([key, value]) => {
            updateFilter(key as keyof WorkstationsFilters, value);
          });
        }}
        onRefresh={handleRefresh}
        onCreateWorkstation={() => {
          setEditingWorkStation(null);
          setIsUpsertSheetOpen(true);
        }}
        onExport={handleExportCSV}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        canCreate={canCreatePuestoTrabajo}
        refreshing={refreshing}
        availableSectores={sectores}
      />

      <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-4">
        {/* ✅ NUEVO: Dashboard KPIs */}
        {showDashboard && !loading && workStations.length > 0 && (
          <div className="mb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => updateFilter('estado', 'all')}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Total</p>
                      <p className="text-2xl font-bold">{dashboardStats.total}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Briefcase className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => updateFilter('estado', 'ACTIVE')}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Activos</p>
                      <p className="text-2xl font-bold text-success">{dashboardStats.activos}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                      <Settings2 className="h-5 w-5 text-success" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => updateFilter('hasInstructives', 'yes')}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider truncate">
                        <span className="sm:hidden">Instructivos</span>
                        <span className="hidden sm:inline">Con Instructivos</span>
                      </p>
                      <p className="text-2xl font-bold text-info-muted-foreground">{dashboardStats.conInstructivos}</p>
                      <p className="text-xs text-muted-foreground">{dashboardStats.totalInstructivos} docs</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-info/10 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-info-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => updateFilter('hasMachines', 'yes')}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider truncate">
                        <span className="sm:hidden">Máquinas</span>
                        <span className="hidden sm:inline">Con Máquinas</span>
                      </p>
                      <p className="text-2xl font-bold text-purple-600">{dashboardStats.conMaquinas}</p>
                      <p className="text-xs text-muted-foreground">{dashboardStats.totalMaquinas} asignadas</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
                      <ClipboardList className="h-5 w-5 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Controles de vista */}
        {!loading && workStations.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {/* Toggle selección */}
              <Button
                variant={selectionMode ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setSelectionMode(!selectionMode);
                  if (selectionMode) setSelectedIds([]);
                }}
                className="h-8 text-xs"
              >
                <CheckSquare className="h-3.5 w-3.5 mr-1.5" />
                {selectionMode ? 'Cancelar selección' : 'Seleccionar'}
              </Button>

              {/* Toggle dashboard */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDashboard(!showDashboard)}
                className="h-8 text-xs text-muted-foreground hidden sm:inline-flex"
              >
                {showDashboard ? 'Ocultar resumen' : 'Mostrar resumen'}
              </Button>
            </div>

            {/* Exportar */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="h-8 text-xs gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar
            </Button>
          </div>
        )}

        {/* ✅ NUEVO: Barra de acciones en lote */}
        {selectionMode && (
          <div className="flex flex-wrap items-center gap-2 p-3 mb-4 bg-muted/50 rounded-lg border">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedIds.length === filteredAndSortedWorkStations.length && filteredAndSortedWorkStations.length > 0}
                onCheckedChange={selectAll}
              />
              <span className="text-sm text-muted-foreground">
                {selectedIds.length === 0
                  ? 'Seleccionar todos'
                  : `${selectedIds.length} seleccionado${selectedIds.length !== 1 ? 's' : ''}`}
              </span>
            </div>
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 h-8 text-xs"
                  onClick={() => handleBulkChangeStatus('ACTIVE')}
                >
                  <ToggleRight className="h-3.5 w-3.5 text-success" />
                  Activar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 h-8 text-xs"
                  onClick={() => handleBulkChangeStatus('INACTIVE')}
                >
                  <ToggleLeft className="h-3.5 w-3.5 text-warning-muted-foreground" />
                  Desactivar
                </Button>
                {canDeletePuestoTrabajo && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 h-8 text-xs text-destructive hover:bg-destructive/10"
                    onClick={handleBulkDelete}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Eliminar
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredAndSortedWorkStations.length === 0 ? (
          <WorkstationsEmptyState
            hasFilters={hasActiveFilters}
            onCreateWorkstation={() => {
              setEditingWorkStation(null);
              setIsUpsertSheetOpen(true);
            }}
            canCreate={canCreatePuestoTrabajo}
            onClearFilters={resetFilters}
          />
        ) : viewMode === 'grid' ? (
          <WorkstationsGrid
            workstations={filteredAndSortedWorkStations}
            loading={false}
            onView={(ws) => handleViewWorkStation(ws.id)}
            onEdit={canEditPuestoTrabajo ? (ws) => {
              setEditingWorkStation(ws);
              setIsUpsertSheetOpen(true);
            } : undefined}
            onDelete={canDeletePuestoTrabajo ? (ws) => {
              setWorkstationToDelete(ws);
              setDeleteConfirmOpen(true);
            } : undefined}
            onDuplicate={handleDuplicate}
            onToggleStatus={handleToggleStatus}
            canEdit={canEditPuestoTrabajo}
            canDelete={canDeletePuestoTrabajo}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onToggleSelection={toggleSelection}
          />
        ) : (
          <WorkstationsTable
            workstations={filteredAndSortedWorkStations}
            loading={false}
            onView={(ws) => handleViewWorkStation(ws.id)}
            onEdit={canEditPuestoTrabajo ? (ws) => {
              setEditingWorkStation(ws);
              setIsUpsertSheetOpen(true);
            } : undefined}
            onDelete={canDeletePuestoTrabajo ? (ws) => {
              setWorkstationToDelete(ws);
              setDeleteConfirmOpen(true);
            } : undefined}
            onDuplicate={handleDuplicate}
            onToggleStatus={handleToggleStatus}
            canEdit={canEditPuestoTrabajo}
            canDelete={canDeletePuestoTrabajo}
            sortBy={filters.sortBy}
            onSort={(column) => {
              const newSort = filters.sortBy === `${column}-asc`
                ? `${column}-desc`
                : `${column}-asc`;
              updateFilter('sortBy', newSort);
            }}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onToggleSelection={toggleSelection}
          />
        )}
      </div>

      {/* Sheet de Crear/Editar */}
      <WorkstationUpsertSheet
        workstation={editingWorkStation}
        isOpen={isUpsertSheetOpen}
        onClose={() => {
          setIsUpsertSheetOpen(false);
          setEditingWorkStation(null);
        }}
        onSave={handleSaveWorkStation}
        onSuccess={async () => {
          await fetchWorkStations();
        }}
        sectorName={currentSector?.name}
        sectores={sectores}
      />

      {/* Sheet de Detalle */}
      <WorkstationDetailSheet
        workstation={selectedWorkStation}
        isOpen={isDetailSheetOpen}
        onClose={() => {
          setIsDetailSheetOpen(false);
          setSelectedWorkStation(null);
        }}
        onEdit={canEditPuestoTrabajo ? (ws) => {
          setEditingWorkStation(ws);
          setIsDetailSheetOpen(false);
          setIsUpsertSheetOpen(true);
        } : undefined}
        onDelete={canDeletePuestoTrabajo ? (ws) => {
          setWorkstationToDelete(ws);
          setDeleteConfirmOpen(true);
        } : undefined}
        onDuplicate={handleDuplicate}
        onToggleStatus={handleToggleStatus}
        canEdit={canEditPuestoTrabajo}
        canDelete={canDeletePuestoTrabajo}
      />

      {/* Confirmación de eliminación */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar puesto de trabajo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el puesto de trabajo
              {workstationToDelete && ` "${workstationToDelete.name}"`} junto con sus instructivos y máquinas asignadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-9 text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteWorkStation}
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
