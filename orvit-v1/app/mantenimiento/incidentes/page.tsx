'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Columns, AlignJustify, BarChart2, CheckSquare, Download, Square, LayoutGrid } from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import dynamic from 'next/dynamic';
import { FailureKPIs } from '@/components/corrective/failures/FailureKPIs';
import { FailuresBoardView } from '@/components/corrective/failures/FailuresBoardView';
import { FailuresListView } from '@/components/corrective/failures/FailuresListView';
import { FailureQuickReportDialog } from '@/components/corrective/failures/FailureQuickReportDialog';
import { CreateIncidentDialog } from '@/components/corrective/failures/CreateIncidentDialog';
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
import { FailuresViewSelector, useFailuresView } from '@/components/corrective/failures/FailuresViewSelector';
import { useFailurePresetFilters } from '@/components/corrective/failures/FailuresSavedViewsBar';
import { FailuresBulkBar } from '@/components/corrective/failures/FailuresBulkBar';

// Dynamic imports for conditional views
const FailuresTimelineView = dynamic(
  () => import('@/components/corrective/failures/FailuresTimelineView').then(m => ({ default: m.FailuresTimelineView })),
  { loading: () => <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div> }
);
const FailuresReincidenciasView = dynamic(
  () => import('@/components/corrective/failures/FailuresReincidenciasView'),
  { loading: () => <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div> }
);
const FailuresDuplicadosView = dynamic(
  () => import('@/components/corrective/failures/FailuresDuplicadosView'),
  { loading: () => <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div> }
);

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

// Hoisted outside component
function buildQueryString(filtersObj?: FailureFilters & { incidentType?: string }): string {
  const params = new URLSearchParams();
  params.append('limit', '50');
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
  if (filtersObj.incidentType) params.append('incidentType', filtersObj.incidentType);
  return `?${params.toString()}`;
}

export default function IncidentesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { currentSector } = useCompany();
  const { hasAnyPermission, user } = useAuth();

  // V2: Vista actual desde URL
  const currentView = useFailuresView();
  const presetFilters = useFailurePresetFilters();

  // Permissions
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

  // Apply preset filters on top of URL filters
  const effectiveFilters = useMemo(() => {
    const combined = { ...filters };
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

  // Incident type tab (Fallas / Roturas)
  const incidentTab = (searchParams.get('type') || 'falla') as 'falla' | 'rotura';
  const incidentTypeFilter = incidentTab === 'rotura' ? 'ROTURA' : 'FALLA';

  const handleIncidentTabChange = useCallback((value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'falla') {
      params.delete('type');
    } else {
      params.set('type', value);
    }
    const newUrl = params.toString()
      ? `/mantenimiento/incidentes?${params.toString()}`
      : '/mantenimiento/incidentes';
    router.push(newUrl, { scroll: false });
  }, [router, searchParams]);

  const filtersWithIncidentType = useMemo(() => ({
    ...effectiveFilters,
    incidentType: incidentTypeFilter,
  }), [effectiveFilters, incidentTypeFilter]);

  // UI state
  const [createIncidentOpen, setCreateIncidentOpen] = useState(false);
  const [quickReportOpen, setQuickReportOpen] = useState(false);
  const [quickReportIncidentType, setQuickReportIncidentType] = useState<'FALLA' | 'ROTURA'>('FALLA');
  const [selectedFailure, setSelectedFailure] = useState<number | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [failureToEdit, setFailureToEdit] = useState<number | null>(null);
  const [failureToDelete, setFailureToDelete] = useState<{ id: number; title?: string } | null>(null);
  const [initialTab, setInitialTab] = useState<string | undefined>(undefined);
  const [viewMode, setViewMode] = useState<'kanban' | 'lista' | 'cronograma'>('kanban');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Auto-open failure detail from URL param
  useEffect(() => {
    const failureIdParam = searchParams.get('failure');
    if (failureIdParam) {
      const failureId = parseInt(failureIdParam);
      if (!isNaN(failureId)) {
        setSelectedFailure(failureId);
        const tabParam = searchParams.get('tab');
        setInitialTab(tabParam || undefined);
        setDetailSheetOpen(true);
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
        ? `/mantenimiento/incidentes?${params.toString()}`
        : '/mantenimiento/incidentes';
      router.push(newUrl, { scroll: false });
    },
    [router]
  );

  const handleRemoveFilter = useCallback(
    <K extends keyof FailureFilters>(
      key: K,
      value?: FailureFilters[K] extends (infer U)[] ? U : never
    ) => {
      const newFilters = { ...filters };
      if (value !== undefined && Array.isArray(filters[key])) {
        const arr = filters[key] as string[];
        const newArr = arr.filter((v) => v !== value);
        (newFilters as any)[key] = newArr.length > 0 ? newArr : undefined;
      } else {
        delete newFilters[key];
      }
      handleFiltersChange(newFilters);
    },
    [filters, handleFiltersChange]
  );

  const handleClearAll = useCallback(() => {
    handleFiltersChange({});
  }, [handleFiltersChange]);

  const handleSelectFailure = (id: number) => {
    setSelectedFailure(id);
    setDetailSheetOpen(true);
  };

  const handleCreateWorkOrder = useCallback((failureId: number) => {
    if (!canCreate) {
      toast.error('No tiene permisos para crear órdenes de trabajo');
      return;
    }
    router.push(`/mantenimiento/ordenes-trabajo/nueva?failureId=${failureId}`);
  }, [router, canCreate]);

  const handleResolveFailure = useCallback((failureId: number) => {
    if (!canEdit) {
      toast.error('No tiene permisos para resolver fallas');
      return;
    }
    setSelectedFailure(failureId);
    setDetailSheetOpen(true);
  }, [canEdit]);

  const handleLinkDuplicate = useCallback((failureId: number) => {
    if (!canEdit) {
      toast.error('No tiene permisos para vincular fallas');
      return;
    }
    setSelectedFailure(failureId);
    setDetailSheetOpen(true);
    toast.info('Seleccione la falla principal en el panel de duplicados');
  }, [canEdit]);

  const handleEditFailure = useCallback((failureId: number) => {
    if (!canEdit) {
      toast.error('No tiene permisos para editar fallas');
      return;
    }
    setFailureToEdit(failureId);
    setEditDialogOpen(true);
  }, [canEdit]);

  const handleDeleteFailure = useCallback((failureId: number) => {
    if (!canDelete) {
      toast.error('No tiene permisos para eliminar fallas');
      return;
    }
    setFailureToDelete({ id: failureId });
    setDeleteDialogOpen(true);
  }, [canDelete]);

  // Status change handler (for Kanban drag & drop)
  const handleStatusChange = useCallback(async (failureId: number, newStatus: string) => {
    if (!canEdit) {
      toast.error('No tiene permisos para cambiar el estado');
      return;
    }
    try {
      toast.loading('Actualizando estado...', { id: `status-${failureId}` });
      const res = await fetch(`/api/failure-occurrences/${failureId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          ...(newStatus === 'RESOLVED' ? { resolvedAt: new Date().toISOString() } : {}),
        }),
      });
      if (!res.ok) throw new Error('Error al actualizar');
      toast.success('Estado actualizado', { id: `status-${failureId}` });
      queryClient.invalidateQueries({ queryKey: ['failures-grid'] });
    } catch {
      toast.error('Error al cambiar estado', { id: `status-${failureId}` });
    }
  }, [canEdit, queryClient]);

  // CSV Export
  const handleExportCSV = useCallback(async () => {
    try {
      toast.loading('Exportando...', { id: 'csv-export' });
      const queryString = buildQueryString({ ...filtersWithIncidentType, });
      const res = await fetch(`/api/failure-occurrences${queryString.replace('limit=50', 'limit=1000')}`);
      if (!res.ok) throw new Error('Error al exportar');
      const json = await res.json();
      const data = json.data || json || [];

      const statusLabels: Record<string, string> = {
        REPORTED: 'Reportada', OPEN: 'Abierta', IN_PROGRESS: 'En Proceso', RESOLVED: 'Resuelta', CANCELLED: 'Cancelada',
      };

      const headers = ['ID', 'Título', 'Prioridad', 'Estado', 'Máquina', 'Downtime', 'Intermitente', 'Seguridad', 'Reportada'];
      const rows = data.map((f: any) => [
        f.id,
        f.title,
        f.priority,
        statusLabels[f.status] || f.status,
        f.machine?.name || '-',
        f.causedDowntime ? 'Sí' : 'No',
        f.isIntermittent ? 'Sí' : 'No',
        f.isSafetyRelated ? 'Sí' : 'No',
        new Date(f.reportedAt).toLocaleDateString('es-AR'),
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((row: any[]) => row.map(cell => `"${cell}"`).join(',')),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `incidentes_${incidentTab}_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      toast.success(`${data.length} registros exportados`, { id: 'csv-export' });
    } catch {
      toast.error('Error al exportar', { id: 'csv-export' });
    }
  }, [filtersWithIncidentType, incidentTab]);

  // Machine query
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

  // Grid data query
  const { data: gridData, isLoading: isGridLoading } = useQuery({
    queryKey: ['failures-grid', filtersWithIncidentType],
    queryFn: async () => {
      const queryString = buildQueryString(filtersWithIncidentType);
      const res = await fetch(`/api/failure-occurrences${queryString}`);
      if (!res.ok) throw new Error('Error al cargar fallas');
      const json = await res.json();
      return json.data || json || [];
    },
    enabled: currentView === 'reportes',
    staleTime: 30000,
  });

  return (
    <div className="h-screen sidebar-shell flex flex-col min-h-0">
      <style>{`
        @keyframes header-slide-in {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .incidents-header { animation: header-slide-in 450ms cubic-bezier(0.22,1,0.36,1) both; }
        .inc-action-btn {
          height: 32px;
          padding: 0 12px;
          font-size: 13px;
          font-weight: 500;
          border-radius: 8px;
          border: 1.5px solid #E4E4E8;
          background: #FFFFFF;
          color: #374151;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 120ms ease;
          white-space: nowrap;
        }
        .inc-action-btn:hover { border-color: #D1D5DB; background: #F9FAFB; }
        .inc-action-btn-primary {
          background: #111827;
          color: #FFFFFF;
          border-color: #111827;
        }
        .inc-action-btn-primary:hover { background: #1F2937; border-color: #1F2937; }
      `}</style>

      {/* Header */}
      <div className="incidents-header" style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}>
        {/* Row 1: Title + actions */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{
              fontSize: 20, fontWeight: 700, color: '#111827',
              letterSpacing: '-0.025em', margin: 0,
            }}>
              Incidentes
            </h1>
            {gridData && (
              <span style={{
                fontSize: 11, fontWeight: 600,
                padding: '2px 8px', borderRadius: 10,
                background: '#F3F4F6', color: '#9CA3AF',
              }}>
                {gridData.length}
              </span>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {currentView === 'reportes' && (
              <button className="inc-action-btn" onClick={handleExportCSV}>
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">CSV</span>
              </button>
            )}
            {canCreate && (
              <button
                className="inc-action-btn inc-action-btn-primary"
                onClick={() => setCreateIncidentOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Nuevo</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Tabs — type + view */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 0,
          padding: '0 20px',
          borderBottom: '1px solid #E4E4E8',
          marginTop: 10,
        }}>
          {/* Fallas / Roturas tabs */}
          {(['falla', 'rotura'] as const).map((tab) => {
            const isActive = incidentTab === tab;
            return (
              <button
                key={tab}
                onClick={() => handleIncidentTabChange(tab)}
                style={{
                  padding: '8px 16px',
                  fontSize: 13, fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#111827' : '#9CA3AF',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #111827' : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                  marginBottom: -1,
                }}
              >
                {tab === 'falla' ? 'Fallas' : 'Roturas'}
              </button>
            );
          })}

          {/* Separator */}
          <div style={{
            width: 1, height: 20, background: '#E4E4E8',
            margin: '0 8px', alignSelf: 'center', marginBottom: 5,
          }} />

          {/* View selector tabs — desktop */}
          <div className="hidden md:flex" style={{ alignItems: 'flex-end' }}>
            <FailuresViewSelector />
          </div>
        </div>

        {/* View selector móvil */}
        <div className="md:hidden" style={{
          padding: '0 20px', borderBottom: '1px solid #E4E4E8',
          overflowX: 'auto',
        }}>
          <FailuresViewSelector className="w-full" />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-4 md:px-6 py-3 md:py-4 space-y-3 md:space-y-4">
          <div className="border-t border-border" />

          {/* Vista Reportes: KPIs, filtros y grid/tabla */}
          {currentView === 'reportes' && (
            <>
              {/* KPIs */}
              <FailureKPIs
                activeFilter={effectiveFilters}
                onFilterChange={handleFiltersChange}
                incidentType={incidentTypeFilter}
              />

              <div className="border-t border-border" />

              {/* ─── Container card ─── */}
              <div style={{
                background: '#FFFFFF',
                border: '1.5px solid #D8D8DE',
                borderRadius: 8,
                boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.07)',
                overflow: 'hidden',
              }}>
                {/* Container header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 20px', borderBottom: '1px solid #E4E4E8',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      fontSize: 14, fontWeight: 600, color: '#111827',
                      letterSpacing: '-0.01em',
                    }}>
                      {incidentTab === 'rotura' ? 'Todas las roturas' : 'Todas las fallas'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* Select button */}
                    {canDelete && (
                      <button
                        title="Seleccionar"
                        onClick={() => { setSelectionMode(!selectionMode); setSelectedIds([]); }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          height: 34, width: 34, border: '1px solid #E4E4E8',
                          borderRadius: 8, background: selectionMode ? '#F5F3FF' : '#FAFAFA',
                          color: selectionMode ? '#7C3AED' : '#9CA3AF',
                          cursor: 'pointer', transition: '150ms',
                        }}
                      >
                        <Square className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {/* View toggle */}
                    <div style={{
                      display: 'flex', alignItems: 'center',
                      border: '1px solid #E4E4E8', borderRadius: 8,
                      overflow: 'hidden', background: '#FAFAFA',
                    }}>
                      {([
                        { key: 'lista' as const, icon: AlignJustify, label: 'Lista' },
                        { key: 'cronograma' as const, icon: BarChart2, label: 'Cronograma' },
                        { key: 'kanban' as const, icon: LayoutGrid, label: 'Kanban' },
                      ]).map(({ key, icon: VIcon, label }, i, arr) => (
                        <button
                          key={key}
                          onClick={() => setViewMode(key)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '7px 14px',
                            borderTop: 'none', borderBottom: 'none', borderLeft: 'none',
                            borderRight: i < arr.length - 1 ? '1px solid #E4E4E8' : 'none',
                            background: viewMode === key ? '#FFFFFF' : 'transparent',
                            color: viewMode === key ? '#111827' : '#9CA3AF',
                            fontSize: 12,
                            fontWeight: viewMode === key ? 600 : 500,
                            cursor: 'pointer',
                            boxShadow: viewMode === key ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                            transition: '150ms',
                          }}
                        >
                          <VIcon className="h-3.5 w-3.5" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Filters inside card */}
                <div style={{ padding: '12px 20px', borderBottom: '1px solid #F0F0F4' }}>
                  <FailureFiltersBar
                    filters={effectiveFilters}
                    onFiltersChange={handleFiltersChange}
                    onAdvancedFiltersOpen={() => setAdvancedFiltersOpen(true)}
                  />
                  <FilterChips
                    filters={effectiveFilters}
                    onRemoveFilter={handleRemoveFilter}
                    onClearAll={handleClearAll}
                    machineName={machineName}
                  />
                </div>

                {/* View content */}
                {viewMode === 'kanban' && (
                  <div style={{ padding: '16px 16px 0' }}>
                    <FailuresBoardView
                      failures={gridData || []}
                      isLoading={isGridLoading}
                      onSelectFailure={handleSelectFailure}
                      onEditFailure={handleEditFailure}
                      onDeleteFailure={handleDeleteFailure}
                      onCreateWorkOrder={handleCreateWorkOrder}
                      onResolveFailure={handleResolveFailure}
                      onLinkDuplicate={handleLinkDuplicate}
                      onStatusChange={handleStatusChange}
                      onCreateIncident={() => setCreateIncidentOpen(true)}
                      canCreate={canCreate}
                      canEdit={canEdit}
                      canDelete={canDelete}
                      selectionMode={selectionMode}
                      selectedIds={selectedIds}
                      onToggleSelect={(id) =>
                        setSelectedIds(prev =>
                          prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                        )
                      }
                    />
                  </div>
                )}

                {viewMode === 'lista' && (
                  <FailuresListView
                    failures={gridData || []}
                    isLoading={isGridLoading}
                    onSelectFailure={handleSelectFailure}
                  />
                )}

                {viewMode === 'cronograma' && (
                  <FailuresTimelineView
                    failures={gridData || []}
                    isLoading={isGridLoading}
                    onSelectFailure={handleSelectFailure}
                  />
                )}
              </div>
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

      {/* Bulk bar */}
      {selectionMode && (
        <FailuresBulkBar
          selectedIds={selectedIds}
          totalCount={gridData?.length || 0}
          onSelectAll={() => setSelectedIds((gridData || []).map((f: any) => f.id))}
          onClearSelection={() => { setSelectedIds([]); setSelectionMode(false); }}
          onComplete={() => { setSelectedIds([]); setSelectionMode(false); }}
        />
      )}

      {/* Dialogs */}
      <CreateIncidentDialog
        open={createIncidentOpen}
        onOpenChange={setCreateIncidentOpen}
        onRequiresOT={(type) => {
          setCreateIncidentOpen(false);
          setQuickReportIncidentType(type);
          setQuickReportOpen(true);
        }}
      />

      <FailureQuickReportDialog
        open={quickReportOpen}
        onOpenChange={setQuickReportOpen}
        incidentType={quickReportIncidentType}
      />

      <FailureDetailSheet
        failureId={selectedFailure}
        open={detailSheetOpen}
        onOpenChange={(open) => {
          setDetailSheetOpen(open);
          if (!open) setInitialTab(undefined);
        }}
        initialTab={initialTab}
      />

      <AdvancedFiltersSheet
        open={advancedFiltersOpen}
        onOpenChange={setAdvancedFiltersOpen}
        filters={filters}
        onFiltersChange={handleFiltersChange}
      />

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
