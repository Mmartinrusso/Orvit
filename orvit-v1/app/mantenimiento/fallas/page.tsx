'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, LayoutGrid, List } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Skeleton } from '@/components/ui/skeleton';
import { FailureKPIs } from '@/components/corrective/failures/FailureKPIs';
import { FailureListTable } from '@/components/corrective/failures/FailureListTable';
import { FailuresGrid } from '@/components/corrective/failures/FailuresGrid';
import { FailureQuickReportDialog } from '@/components/corrective/failures/FailureQuickReportDialog';
import { FailureDetailSheet } from '@/components/corrective/failures/FailureDetailSheet';
import { EditFailureDialog } from '@/components/corrective/failures/EditFailureDialog';
import { DeleteFailureDialog } from '@/components/corrective/failures/DeleteFailureDialog';
import {
  FailureFiltersBar,
  type FailureFilters,
} from '@/components/corrective/failures/FailureFiltersBar';
import { FilterChips } from '@/components/corrective/failures/FilterChips';
import { AdvancedFiltersSheet } from '@/components/corrective/failures/AdvancedFiltersSheet';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
// V2: Nuevos componentes para vistas unificadas
import { FailuresViewSelector, useFailuresView } from '@/components/corrective/failures/FailuresViewSelector';
import { FailuresSavedViewsBar, useFailurePresetFilters } from '@/components/corrective/failures/FailuresSavedViewsBar';
import { FailuresReincidenciasView } from '@/components/corrective/failures/FailuresReincidenciasView';
import { FailuresDuplicadosView } from '@/components/corrective/failures/FailuresDuplicadosView';

/**
 * Página principal de Mantenimiento Correctivo - Fallas V2
 *
 * Features:
 * - Vista unificada con selector: Reportes | Reincidencias | Duplicados
 * - Presets de filtros guardados (URL-driven)
 * - KPIs clickeables (Total Abiertas, Reincidencias, Con Downtime, Sin Asignar)
 * - Filtros con sincronización URL
 * - Tabla/Grid de fallas con acciones
 * - Quick Report (modo rápido 20-30s)
 */

// Parse URL search params to filters object
function parseFiltersFromURL(searchParams: URLSearchParams): FailureFilters {
  const filters: FailureFilters = {};

  const search = searchParams.get('search');
  if (search) filters.search = search;

  const status = searchParams.get('status');
  if (status) filters.status = status.split(',');

  const machineId = searchParams.get('machineId');
  if (machineId) filters.machineId = parseInt(machineId);

  const priority = searchParams.get('priority');
  if (priority) filters.priority = priority.split(',');

  if (searchParams.get('causedDowntime') === 'true')
    filters.causedDowntime = true;
  if (searchParams.get('isIntermittent') === 'true')
    filters.isIntermittent = true;
  if (searchParams.get('isObservation') === 'true')
    filters.isObservation = true;

  const dateFrom = searchParams.get('dateFrom');
  if (dateFrom) filters.dateFrom = dateFrom;

  const dateTo = searchParams.get('dateTo');
  if (dateTo) filters.dateTo = dateTo;

  const componentId = searchParams.get('componentId');
  if (componentId) filters.componentId = parseInt(componentId);

  const subcomponentId = searchParams.get('subcomponentId');
  if (subcomponentId) filters.subcomponentId = parseInt(subcomponentId);

  const reportedById = searchParams.get('reportedById');
  if (reportedById) filters.reportedById = parseInt(reportedById);

  const hasWorkOrder = searchParams.get('hasWorkOrder');
  if (hasWorkOrder === 'true') filters.hasWorkOrder = true;
  if (hasWorkOrder === 'false') filters.hasWorkOrder = false;

  const hasDuplicates = searchParams.get('hasDuplicates');
  if (hasDuplicates === 'true') filters.hasDuplicates = true;
  if (hasDuplicates === 'false') filters.hasDuplicates = false;

  return filters;
}

// Convert filters to URL search params
function filtersToURLParams(filters: FailureFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.search) params.set('search', filters.search);
  if (filters.status?.length) params.set('status', filters.status.join(','));
  if (filters.machineId) params.set('machineId', filters.machineId.toString());
  if (filters.priority?.length)
    params.set('priority', filters.priority.join(','));
  if (filters.causedDowntime) params.set('causedDowntime', 'true');
  if (filters.isIntermittent) params.set('isIntermittent', 'true');
  if (filters.isObservation) params.set('isObservation', 'true');
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  if (filters.componentId)
    params.set('componentId', filters.componentId.toString());
  if (filters.subcomponentId)
    params.set('subcomponentId', filters.subcomponentId.toString());
  if (filters.reportedById)
    params.set('reportedById', filters.reportedById.toString());
  if (filters.hasWorkOrder !== undefined)
    params.set('hasWorkOrder', filters.hasWorkOrder.toString());
  if (filters.hasDuplicates !== undefined)
    params.set('hasDuplicates', filters.hasDuplicates.toString());

  return params;
}

export default function FallasPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { currentSector, currentCompany } = useCompany();
  const { hasPermission, hasAnyPermission, user } = useAuth();

  // V2: Vista actual desde URL
  const currentView = useFailuresView();
  const presetFilters = useFailurePresetFilters();

  // Permisos - verificar múltiples permisos posibles
  // Los admin siempre pueden editar fallas
  const userRole = user?.role?.toUpperCase() || '';
  const isAdmin = userRole.includes('ADMIN') || userRole === 'SUPERADMIN';

  const canCreate = hasAnyPermission(['work_orders.create', 'failures.create']) || isAdmin;
  const canEdit = hasAnyPermission(['work_orders.edit', 'failures.edit', 'failures.update']) || isAdmin;
  const canDelete = hasAnyPermission(['work_orders.delete', 'failures.delete']) || isAdmin;

  // Parse filters from URL
  const filters = useMemo(
    () => parseFiltersFromURL(searchParams),
    [searchParams]
  );

  // V2: Aplicar filtros de preset a los filtros de URL
  const effectiveFilters = useMemo(() => {
    const combined = { ...filters };

    // Aplicar preset filters
    if (presetFilters.status) {
      combined.status = Array.isArray(presetFilters.status) ? presetFilters.status : [presetFilters.status];
    }
    if (presetFilters.priority) {
      combined.priority = presetFilters.priority;
    }
    if (presetFilters.hasWorkOrder !== undefined) {
      combined.hasWorkOrder = presetFilters.hasWorkOrder;
    }
    if (presetFilters.causedDowntime) {
      combined.causedDowntime = presetFilters.causedDowntime;
    }

    return combined;
  }, [filters, presetFilters]);

  const [quickReportOpen, setQuickReportOpen] = useState(false);
  const [selectedFailure, setSelectedFailure] = useState<number | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [failureToEdit, setFailureToEdit] = useState<number | null>(null);
  const [failureToDelete, setFailureToDelete] = useState<{ id: number; title?: string } | null>(null);
  const [initialTab, setInitialTab] = useState<string | undefined>(undefined);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Auto-open failure detail sheet from URL param (e.g., ?failure=123&tab=solutions)
  useEffect(() => {
    const failureIdParam = searchParams.get('failure');
    if (failureIdParam) {
      const failureId = parseInt(failureIdParam);
      if (!isNaN(failureId)) {
        setSelectedFailure(failureId);
        // Get optional tab parameter
        const tabParam = searchParams.get('tab');
        setInitialTab(tabParam || undefined);
        setDetailSheetOpen(true);
        // Clean up URL after opening
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('failure');
        newUrl.searchParams.delete('tab');
        router.replace(newUrl.pathname + newUrl.search, { scroll: false });
      }
    }
  }, [searchParams, router]);

  // Update URL when filters change
  const handleFiltersChange = useCallback(
    (newFilters: FailureFilters) => {
      const params = filtersToURLParams(newFilters);
      const newUrl = params.toString()
        ? `/mantenimiento/fallas?${params.toString()}`
        : '/mantenimiento/fallas';
      router.push(newUrl, { scroll: false });
    },
    [router]
  );

  // Remove single filter
  const handleRemoveFilter = useCallback(
    <K extends keyof FailureFilters>(
      key: K,
      value?: FailureFilters[K] extends (infer U)[] ? U : never
    ) => {
      const newFilters = { ...filters };

      // If it's an array filter with a specific value to remove
      if (value !== undefined && Array.isArray(filters[key])) {
        const arr = filters[key] as string[];
        const newArr = arr.filter((v) => v !== value);
        (newFilters as any)[key] = newArr.length > 0 ? newArr : undefined;
      } else {
        // Remove the entire filter
        delete newFilters[key];
      }

      handleFiltersChange(newFilters);
    },
    [filters, handleFiltersChange]
  );

  // Clear all filters
  const handleClearAll = useCallback(() => {
    handleFiltersChange({});
  }, [handleFiltersChange]);

  const handleSelectFailure = (id: number) => {
    setSelectedFailure(id);
    setDetailSheetOpen(true);
  };

  // Handler para crear OT desde la tabla (requiere permiso crear)
  const handleCreateWorkOrder = useCallback((failureId: number) => {
    if (!canCreate) {
      toast.error('No tiene permisos para crear órdenes de trabajo');
      return;
    }
    router.push(`/mantenimiento/ordenes-trabajo/nueva?failureId=${failureId}`);
  }, [router, canCreate]);

  // Handler para resolver falla (requiere permiso editar)
  const handleResolveFailure = useCallback((failureId: number) => {
    if (!canEdit) {
      toast.error('No tiene permisos para resolver fallas');
      return;
    }
    setSelectedFailure(failureId);
    setDetailSheetOpen(true);
  }, [canEdit]);

  // Handler para vincular duplicado desde tabla (requiere permiso editar)
  const handleLinkDuplicate = useCallback((failureId: number) => {
    if (!canEdit) {
      toast.error('No tiene permisos para vincular fallas');
      return;
    }
    setSelectedFailure(failureId);
    setDetailSheetOpen(true);
    toast.info('Seleccione la falla principal en el panel de duplicados');
  }, [canEdit]);

  // Handler para editar falla
  const handleEditFailure = useCallback((failureId: number) => {
    if (!canEdit) {
      toast.error('No tiene permisos para editar fallas');
      return;
    }
    setFailureToEdit(failureId);
    setEditDialogOpen(true);
  }, [canEdit]);

  // Handler para eliminar falla
  const handleDeleteFailure = useCallback((failureId: number) => {
    if (!canDelete) {
      toast.error('No tiene permisos para eliminar fallas');
      return;
    }
    // Buscar el título de la falla para mostrarlo en el diálogo
    setFailureToDelete({ id: failureId });
    setDeleteDialogOpen(true);
  }, [canDelete]);

  // Fetch machine name for chips display
  const { data: machines } = useQuery({
    queryKey: ['machines-filter', currentSector?.id],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '200' });
      if (currentSector?.id) {
        params.append('sectorId', currentSector.id.toString());
      }
      const res = await fetch(`/api/machines?${params.toString()}`);
      if (!res.ok) return [];
      const json = await res.json();
      return json.machines || json.data || json;
    },
    staleTime: 5 * 60 * 1000,
  });

  const machineName = filters.machineId
    ? machines?.find((m: any) => m.id === filters.machineId)?.name
    : undefined;

  // Query para la vista grid (solo cuando viewMode === 'grid')
  const buildQueryString = (filtersObj?: FailureFilters): string => {
    const params = new URLSearchParams();
    params.append('limit', '50'); // Cargar 50 items para grid
    if (!filtersObj) return `?${params.toString()}`;
    if (filtersObj.search) params.append('search', filtersObj.search);
    if (filtersObj.status?.length) params.append('status', filtersObj.status.join(','));
    if (filtersObj.machineId) params.append('machineId', filtersObj.machineId.toString());
    if (filtersObj.priority?.length) params.append('priority', filtersObj.priority.join(','));
    if (filtersObj.causedDowntime) params.append('causedDowntime', 'true');
    if (filtersObj.isIntermittent) params.append('isIntermittent', 'true');
    if (filtersObj.isObservation) params.append('isObservation', 'true');
    if (filtersObj.dateFrom) params.append('dateFrom', filtersObj.dateFrom);
    if (filtersObj.dateTo) params.append('dateTo', filtersObj.dateTo);
    if (filtersObj.componentId) params.append('componentId', filtersObj.componentId.toString());
    if (filtersObj.subcomponentId) params.append('subcomponentId', filtersObj.subcomponentId.toString());
    if (filtersObj.reportedById) params.append('reportedById', filtersObj.reportedById.toString());
    if (filtersObj.hasWorkOrder !== undefined) params.append('hasWorkOrder', filtersObj.hasWorkOrder.toString());
    if (filtersObj.hasDuplicates !== undefined) params.append('hasDuplicates', filtersObj.hasDuplicates.toString());
    return `?${params.toString()}`;
  };

  const { data: gridData, isLoading: isGridLoading } = useQuery({
    queryKey: ['failures-grid', effectiveFilters],
    queryFn: async () => {
      const queryString = buildQueryString(effectiveFilters);
      const res = await fetch(`/api/failure-occurrences${queryString}`);
      if (!res.ok) throw new Error('Error al cargar fallas');
      const json = await res.json();
      return json.data || json || [];
    },
    enabled: viewMode === 'grid' && currentView === 'reportes',
    staleTime: 30000,
  });

  return (
    <div className="h-screen sidebar-shell flex flex-col min-h-0">
      {/* V2: Header sticky con selector de vista */}
      <div className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="px-4 md:px-6 pt-4 pb-3">
          <div className="flex items-center justify-between gap-4">
            {/* Lado izquierdo: Título */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0">
                <h1 className="text-xl font-semibold text-foreground truncate">
                  Fallas
                </h1>
                <p className="text-sm text-muted-foreground mt-1 hidden sm:block">
                  Sistema de Mantenimiento Correctivo
                </p>
              </div>
            </div>

            {/* Centro: View selector — solo desktop */}
            <div className="hidden md:flex flex-1 justify-center">
              <FailuresViewSelector />
            </div>

            {/* Lado derecho: Acciones */}
            <div className="flex gap-2 items-center">
              {canCreate && (
                <Button onClick={() => setQuickReportOpen(true)} size="sm" className="bg-black hover:bg-muted-foreground text-white">
                  <Plus className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Nueva Falla</span>
                  <span className="sm:hidden">Nueva</span>
                </Button>
              )}
            </div>
          </div>
          {/* View selector móvil — debajo del título */}
          <div className="mt-3 md:hidden">
            <FailuresViewSelector className="w-full" />
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-4 md:px-6 py-3 md:py-4 space-y-3 md:space-y-4">
          {/* V2: Barra de vistas guardadas (presets) - siempre visible */}
          <FailuresSavedViewsBar failures={gridData || []} />

          <div className="border-t border-border" />

          {/* Vista Reportes: KPIs, filtros y grid/tabla */}
          {currentView === 'reportes' && (
            <>
              {/* KPIs */}
              <FailureKPIs
                activeFilter={effectiveFilters}
                onFilterChange={handleFiltersChange}
              />

              <div className="border-t border-border" />

              {/* Filtros + Toggle vista en la misma fila */}
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <FailureFiltersBar
                    filters={effectiveFilters}
                    onFiltersChange={handleFiltersChange}
                    onAdvancedFiltersOpen={() => setAdvancedFiltersOpen(true)}
                  />
                </div>
                <ToggleGroup
                  type="single"
                  value={viewMode}
                  onValueChange={(value) => value && setViewMode(value as 'grid' | 'table')}
                  className="border border-border rounded-lg bg-background shrink-0"
                >
                  <ToggleGroupItem
                    value="grid"
                    aria-label="Vista de cuadrícula"
                    className="h-9 px-3 data-[state=on]:bg-muted"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="table"
                    aria-label="Vista de tabla"
                    className="h-9 px-3 data-[state=on]:bg-muted"
                  >
                    <List className="h-3.5 w-3.5" />
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              {/* Chips de filtros activos */}
              <FilterChips
                filters={effectiveFilters}
                onRemoveFilter={handleRemoveFilter}
                onClearAll={handleClearAll}
                machineName={machineName}
              />

              {/* Vista Grid o Tabla */}
              {viewMode === 'grid' ? (
                isGridLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {[...Array(8)].map((_, i) => (
                      <Skeleton key={i} className="h-48 rounded-xl" />
                    ))}
                  </div>
                ) : (gridData?.length ?? 0) === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      {effectiveFilters && Object.keys(effectiveFilters).length > 0
                        ? 'No se encontraron fallas con los filtros aplicados'
                        : 'No hay fallas registradas'}
                    </p>
                  </div>
                ) : (
                  <FailuresGrid
                    failures={gridData || []}
                    onSelectFailure={handleSelectFailure}
                    onCreateWorkOrder={handleCreateWorkOrder}
                    onResolveFailure={handleResolveFailure}
                    onLinkDuplicate={handleLinkDuplicate}
                    onEditFailure={handleEditFailure}
                    onDeleteFailure={handleDeleteFailure}
                    canCreate={canCreate}
                    canEdit={canEdit}
                    canDelete={canDelete}
                  />
                )
              ) : (
                <FailureListTable
                  filters={effectiveFilters}
                  onSelectFailure={handleSelectFailure}
                  onCreateWorkOrder={handleCreateWorkOrder}
                  onResolveFailure={handleResolveFailure}
                  onLinkDuplicate={handleLinkDuplicate}
                  onEditFailure={handleEditFailure}
                  onDeleteFailure={handleDeleteFailure}
                  canCreate={canCreate}
                  canEdit={canEdit}
                  canDelete={canDelete}
                />
              )}
            </>
          )}

          {/* Vista Reincidencias */}
          {currentView === 'reincidencias' && (
            <FailuresReincidenciasView
              onSelectFailure={handleSelectFailure}
            />
          )}

          {/* Vista Duplicados */}
          {currentView === 'duplicados' && (
            <FailuresDuplicadosView
              onSelectFailure={handleSelectFailure}
            />
          )}
        </div>
      </div>

      {/* Dialogs */}
      <FailureQuickReportDialog
        open={quickReportOpen}
        onOpenChange={setQuickReportOpen}
      />

      <FailureDetailSheet
        failureId={selectedFailure}
        open={detailSheetOpen}
        onOpenChange={(open) => {
          setDetailSheetOpen(open);
          if (!open) setInitialTab(undefined); // Reset tab when closing
        }}
        initialTab={initialTab}
      />

      <AdvancedFiltersSheet
        open={advancedFiltersOpen}
        onOpenChange={setAdvancedFiltersOpen}
        filters={filters}
        onFiltersChange={handleFiltersChange}
      />

      {/* Dialog de edición */}
      <EditFailureDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        failureId={failureToEdit}
        onSuccess={() => {
          setEditDialogOpen(false);
          setFailureToEdit(null);
          queryClient.invalidateQueries({ queryKey: ['failures-grid'] });
        }}
      />

      {/* Dialog de eliminación */}
      <DeleteFailureDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        failureId={failureToDelete?.id || null}
        failureTitle={failureToDelete?.title}
        onSuccess={() => {
          setDeleteDialogOpen(false);
          setFailureToDelete(null);
          queryClient.invalidateQueries({ queryKey: ['failures-grid'] });
        }}
      />
    </div>
  );
}
