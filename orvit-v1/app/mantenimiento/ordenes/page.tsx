'use client';

import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, RefreshCw, CheckSquare } from 'lucide-react';
import { WorkOrder, WorkOrderStatus, Priority, MaintenanceType } from '@/lib/types';
import WorkOrderEditDialog from '@/components/work-orders/WorkOrderEditDialog';
import { WorkOrderDetailDialog } from '@/components/work-orders/WorkOrderDetailDialog';
import { WorkOrderDetailSheet } from '@/components/corrective/work-orders/WorkOrderDetailSheet';
import WorkOrderWizard from '@/components/work-orders/WorkOrderWizard';
import PrintWorkOrders from '@/components/work-orders/PrintWorkOrders';
import { useToast } from '@/hooks/use-toast';
import { useNotifications } from '@/contexts/NotificationContext';
import { usePermissionRobust } from '@/hooks/use-permissions-robust';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { useWorkOrdersDashboard } from '@/hooks/use-work-orders-dashboard';
import { WorkOrdersHeader } from '@/components/work-orders/WorkOrdersHeader';
import { WorkOrdersKpis } from '@/components/work-orders/WorkOrdersKpis';
import { WorkOrdersFiltersBar } from '@/components/work-orders/WorkOrdersFiltersBar';
import { WorkOrderFilters, defaultFilters } from '@/components/work-orders/workOrders.helpers';
import { KpiFilterType } from '@/components/work-orders/WorkOrdersKpis';
import { WorkOrdersGrid } from '@/components/work-orders/WorkOrdersGrid';
import { WorkOrdersTable } from '@/components/work-orders/WorkOrdersTable';
import { WorkOrdersEmptyState } from '@/components/work-orders/WorkOrdersEmptyState';
import { WorkOrdersLoadingState } from '@/components/work-orders/WorkOrdersLoadingState';
import ExportReports from '@/components/work-orders/ExportReports';
// V2: Nuevos componentes para vistas unificadas
import { useWorkOrdersView, WorkOrderView } from '@/components/work-orders/WorkOrdersViewSelector';
import { WorkOrdersSavedViewsBar, usePresetFilters, PRESETS, PresetKey } from '@/components/work-orders/WorkOrdersSavedViewsBar';
import { WorkOrdersDispatcherBoard } from '@/components/work-orders/WorkOrdersDispatcherBoard';
import { WorkOrdersCalendarView } from '@/components/work-orders/WorkOrdersCalendarView';
import { WorkOrdersBulkBar } from '@/components/work-orders/WorkOrdersBulkBar';

export default function OrdenesTrabajo() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const { addNotification } = useNotifications();
  const searchParams = useSearchParams();
  const router = useRouter();

  const { hasPermission: canCreateWorkOrder } = usePermissionRobust('work_orders.create');
  const { hasPermission: canDeleteWorkOrder } = usePermissionRobust('work_orders.delete');

  // V2: Obtener vista y preset desde URL
  const currentView = useWorkOrdersView();
  const presetFilters = usePresetFilters();

  const companyIdNum = currentCompany?.id ? parseInt(String(currentCompany.id)) : null;
  const {
    data: dashboardData,
    isLoading: dashboardLoading,
    error: dashboardError,
    refetch: refetchDashboard,
  } = useWorkOrdersDashboard(companyIdNum, null, { enabled: !!companyIdNum });

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const [availableUsers, setAvailableUsers] = useState<
    Array<{ id: number; name: string; type: 'user' | 'worker' }>
  >([]);
  const [availableMachines, setAvailableMachines] = useState<
    Array<{ id: number; name: string }>
  >([]);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [preselectedUnidadMovil, setPreselectedUnidadMovil] = useState<{ id: number; nombre: string } | null>(null);
  const [preselectedType, setPreselectedType] = useState<string | null>(null);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCorrectiveSheetOpen, setIsCorrectiveSheetOpen] = useState(false);
  const [correctiveSheetAction, setCorrectiveSheetAction] = useState<'close' | 'assign' | null>(null);

  // Bulk selection
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Filtros unificados
  const [filters, setFilters] = useState<WorkOrderFilters>({
    search: '',
    status: null,
    priority: null,
    assignee: 'all',
    machineId: null,
    dateRange: {},
    tags: [],
    sortBy: undefined,
  });

  // Sincronizar datos del dashboard
  useEffect(() => {
    if (dashboardData && !dashboardLoading) {
      const allOrders = [
        ...(dashboardData.pending || []),
        ...(dashboardData.inProgress || []),
        ...(dashboardData.completedRecent || []),
      ] as unknown as WorkOrder[];
      setWorkOrders(allOrders);
      setLoading(false);
      setError(null);
    }
  }, [dashboardData, dashboardLoading]);

  // Cargar usuarios y máquinas
  useEffect(() => {
    if (currentCompany) {
      fetchAvailableUsers();
      fetchAvailableMachines();
    }
  }, [currentCompany]);

  // Manejar parámetro workOrderId de la URL para abrir modal
  useEffect(() => {
    const workOrderId = searchParams.get('workOrderId');
    if (workOrderId && workOrders.length > 0) {
      const order = workOrders.find((wo) => wo.id === parseInt(workOrderId));
      if (order) {
        setSelectedOrder(order);
        // Abrir el sheet o dialog según el tipo
        if (order.maintenanceType === 'CORRECTIVE') {
          setIsCorrectiveSheetOpen(true);
        } else {
          setIsDialogOpen(true);
        }
        // Limpiar el parámetro de la URL
        router.replace('/mantenimiento/ordenes', { scroll: false });
      }
    }
  }, [searchParams, workOrders, router]);

  // Manejar parámetro unidadMovilId para abrir wizard con unidad preseleccionada
  useEffect(() => {
    const newOT = searchParams.get('newOT');
    const unidadMovilId = searchParams.get('unidadMovilId');
    const unidadMovilName = searchParams.get('unidadMovilName');
    const otType = searchParams.get('type');

    if (newOT === 'true' && unidadMovilId) {
      setPreselectedUnidadMovil({
        id: parseInt(unidadMovilId),
        nombre: unidadMovilName ? decodeURIComponent(unidadMovilName) : `Unidad ${unidadMovilId}`
      });
      if (otType) {
        setPreselectedType(otType);
      }
      setIsWizardOpen(true);
      // Limpiar parámetros de la URL
      router.replace('/mantenimiento/ordenes', { scroll: false });
    }
  }, [searchParams, router]);

  // Filtrar y ordenar órdenes
  const filteredOrders = useMemo(() => {
    let filtered = [...workOrders];

    // V2: Aplicar filtros de preset (desde URL)
    if (presetFilters.type) {
      filtered = filtered.filter((order) => order.maintenanceType === presetFilters.type);
    }
    if (presetFilters.assignee === 'current-user' && user?.id) {
      filtered = filtered.filter((order) =>
        order.assignedToId === Number(user.id) || order.assignedWorkerId === Number(user.id)
      );
    }
    if (presetFilters.assignee === 'unassigned') {
      filtered = filtered.filter((order) => !order.assignedToId && !order.assignedWorkerId);
    }

    // Filtro de búsqueda
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(
        (order) =>
          order.title.toLowerCase().includes(searchTerm) ||
          (order.description && order.description.toLowerCase().includes(searchTerm))
      );
    }

    // Filtro de estado (desde KPI o filtro)
    if (filters.status && filters.status !== 'ALL') {
      if (filters.status === 'OVERDUE') {
        const now = new Date();
        filtered = filtered.filter((order) => {
          if (!order.scheduledDate) return false;
          return (
            new Date(order.scheduledDate) < now &&
            order.status !== WorkOrderStatus.COMPLETED &&
            order.status !== WorkOrderStatus.CANCELLED
          );
        });
      } else {
        filtered = filtered.filter((order) => order.status === filters.status);
      }
    }

    // Filtro de prioridad
    if (filters.priority && filters.priority !== 'ALL') {
      filtered = filtered.filter((order) => order.priority === filters.priority);
    }

    // Filtro por asignado
    if (filters.assignee && filters.assignee !== 'all') {
      if (filters.assignee === 'unassigned') {
        filtered = filtered.filter((order) => !order.assignedToId);
      } else {
        const [type, id] = filters.assignee.split('-');
        filtered = filtered.filter((order) => {
          if (type === 'user') {
            return order.assignedToId === parseInt(id);
          } else if (type === 'worker') {
            return order.assignedWorkerId === parseInt(id);
          }
          return false;
        });
      }
    }

    // Filtro de máquina
    if (filters.machineId) {
      filtered = filtered.filter((order) => order.machineId === filters.machineId);
    }

    // Filtro de rango de fechas
    if (filters.dateRange?.from || filters.dateRange?.to) {
      filtered = filtered.filter((order) => {
        if (!order.scheduledDate) return false;
        const orderDate = new Date(order.scheduledDate);
        if (filters.dateRange?.from && orderDate < filters.dateRange.from) {
          return false;
        }
        if (filters.dateRange?.to && orderDate > filters.dateRange.to) {
          return false;
        }
        return true;
      });
    }

    // Ordenar
    if (filters.sortBy) {
      filtered.sort((a, b) => {
        switch (filters.sortBy) {
          case 'dueDate':
            const aDate = a.scheduledDate ? new Date(a.scheduledDate).getTime() : 0;
            const bDate = b.scheduledDate ? new Date(b.scheduledDate).getTime() : 0;
            return aDate - bDate;
          case 'priority':
            const priorityOrder: Record<Priority, number> = {
              CRITICAL: 4,
              HIGH: 3,
              MEDIUM: 2,
              LOW: 1,
            };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
          case 'recent':
          default:
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
      });
    }

    return filtered;
  }, [workOrders, filters, presetFilters, user?.id]);

  const fetchAvailableUsers = async () => {
    if (!currentCompany) return;
    try {
      const response = await fetch(`/api/companies/${currentCompany.id}/users`);
      if (response.ok) {
        const data = await response.json();
        const usersArray = data.users || data || [];
        if (Array.isArray(usersArray)) {
          const formattedUsers = usersArray.map((user: any) => ({
            id: user.id,
            name: user.name,
            type: user.type?.toLowerCase() || 'user',
          }));
          setAvailableUsers(formattedUsers);
        }
      }
    } catch (error) {
      console.error('Error fetching available users:', error);
    }
  };

  const fetchAvailableMachines = async () => {
    if (!currentCompany) return;
    try {
      const response = await fetch(`/api/machines?companyId=${currentCompany.id}`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setAvailableMachines(data.map((m: any) => ({ id: m.id, name: m.name })));
        }
      }
    } catch (error) {
      console.error('Error fetching machines:', error);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    try {
      await refetchDashboard();
      await fetchAvailableUsers();
      await fetchAvailableMachines();
      toast({
        title: 'Datos actualizados',
        description: 'Las órdenes de trabajo se han actualizado correctamente',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar los datos',
        variant: 'destructive',
      });
    } finally {
      setRefreshing(false);
    }
  };

  const resetFilters = useCallback(() => {
    setFilters({
      search: '',
      status: null,
      priority: null,
      assignee: 'all',
      machineId: null,
      dateRange: {},
      tags: [],
      sortBy: undefined,
    });
  }, []);

  const handleWorkOrderUpdate = (updatedOrder: WorkOrder) => {
    setWorkOrders((prev) =>
      prev.map((order) => (order.id === updatedOrder.id ? updatedOrder : order))
    );
  };

  const handleWorkOrderCreate = async (workOrderData: Partial<WorkOrder>) => {
    try {
      const response = await fetch('/api/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workOrderData),
      });

      if (response.ok) {
        const newOrder = await response.json();
        setWorkOrders((prev) => [newOrder, ...prev]);
        toast({
          title: 'Orden creada',
          description: `La orden "${newOrder.title}" se ha creado exitosamente`,
        });
      } else {
        throw new Error('Error al crear la orden');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo crear la orden de trabajo',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleWorkOrderDelete = async (workOrder: WorkOrder) => {
    try {
      if (!user) {
        toast({
          title: 'Error',
          description: 'Usuario no autenticado',
          variant: 'destructive',
        });
        return;
      }

      const isCreator = workOrder.createdById === Number(user.id);
      const isSystemAdmin = user.role === 'ADMIN' || user.role === 'SUPERADMIN';
      
      // Verificar si tiene rol de empresa "Administrador" o "Admin" (case-insensitive)
      const userRoleLower = (user.role || '').toLowerCase();
      const isCompanyAdmin = userRoleLower === 'administrador' || userRoleLower === 'admin';
      
      const isAdmin = isSystemAdmin || isCompanyAdmin;
      
      // ADMIN de sistema, ADMIN de empresa, y SUPERADMIN siempre pueden eliminar, o el creador, o usuarios con permiso específico
      if (!isCreator && !isAdmin && !canDeleteWorkOrder) {
        toast({
          title: 'Sin permisos',
          description:
            'Solo el creador de la orden o usuarios con permisos de eliminación pueden eliminar órdenes de trabajo',
          variant: 'destructive',
        });
        return;
      }

      const response = await fetch(`/api/work-orders?id=${workOrder.id}&userId=${user.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setWorkOrders((prev) => prev.filter((order) => order.id !== workOrder.id));
        toast({
          title: 'Orden eliminada',
          description: `La orden "${workOrder.title}" ha sido eliminada exitosamente`,
        });
      } else {
        throw new Error('Error al eliminar la orden');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la orden de trabajo',
        variant: 'destructive',
      });
    }
  };

  const handleStatusFilterClick = (filter: KpiFilterType) => {
    if (filter === 'UNASSIGNED') {
      setFilters((prev) => ({ ...prev, status: null, assignee: 'unassigned' }));
    } else {
      setFilters((prev) => ({ ...prev, status: filter, assignee: 'all' }));
    }
  };

  const handleToggleSelect = useCallback((id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    const activeIds = filteredOrders
      .filter(o => o.status !== WorkOrderStatus.COMPLETED && o.status !== WorkOrderStatus.CANCELLED)
      .map(o => o.id);
    setSelectedIds(prev =>
      prev.length === activeIds.length ? [] : activeIds
    );
  }, [filteredOrders]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds([]);
    setSelectionMode(false);
  }, []);

  const handleBulkComplete = useCallback(() => {
    refetchDashboard();
  }, [refetchDashboard]);

  const handleStatusChange = async (order: WorkOrder, newStatus: WorkOrderStatus) => {
    try {
      // Obtener la orden actual para tener todos los datos
      const getResponse = await fetch(`/api/work-orders/${order.id}`);
      if (!getResponse.ok) {
        throw new Error('No se pudo obtener la orden');
      }
      const currentOrder = await getResponse.json();

      // Para OTs correctivas, manejar según el caso:
      // - Si es "Iniciar" y NO tiene responsable → Abrir AssignAndPlanDialog
      // - Si es "Iniciar" y YA tiene responsable → Cambiar a IN_PROGRESS directamente
      // - Si es "Completar" → Abrir sheet para cierre guiado
      if (currentOrder.type === 'CORRECTIVE') {
        console.log('🔧 OT Correctiva:', { status: currentOrder.status, newStatus, assignedTo: currentOrder.assignedToId });

        // INICIAR: Si no tiene responsable, abrir dialog de asignación
        if (newStatus === WorkOrderStatus.IN_PROGRESS && !currentOrder.assignedToId) {
          console.log('→ Abriendo AssignAndPlanDialog (sin responsable)');
          setSelectedOrder(currentOrder);
          setCorrectiveSheetAction('assign');
          setIsCorrectiveSheetOpen(true); // El sheet tiene el flujo de asignación
          return;
        }

        // COMPLETAR: Siempre abrir sheet para cierre guiado
        if (newStatus === WorkOrderStatus.COMPLETED) {
          console.log('→ Abriendo sheet para cierre guiado');
          setSelectedOrder(currentOrder);
          setCorrectiveSheetAction('close');
          setIsCorrectiveSheetOpen(true);
          return;
        }

        // INICIAR con responsable: Proceder a cambiar estado
        // (no retornamos, dejamos que siga el flujo normal)
        console.log('→ Iniciando OT con responsable asignado');
      }

      // Verificar si es una OT que viene de una falla y se está intentando iniciar (legacy check)
      if (
        newStatus === WorkOrderStatus.IN_PROGRESS &&
        currentOrder.type === 'CORRECTIVE' &&
        currentOrder.status === WorkOrderStatus.PENDING
      ) {
        try {
          const notes = typeof currentOrder.notes === 'string'
            ? JSON.parse(currentOrder.notes)
            : currentOrder.notes;

          console.log('🔍 Verificando si es OT de falla:', {
            type: currentOrder.type,
            status: currentOrder.status,
            notes: notes,
            isOccurrenceSolution: notes?.isOccurrenceSolution,
            relatedFailureId: notes?.relatedFailureId
          });

          // Si es una OT de falla, abrir el diálogo de detalles en lugar de cambiar estado
          if (notes?.isOccurrenceSolution === true && notes?.relatedFailureId) {
            console.log('✅ Es una OT de falla! Abriendo diálogo de detalles...');
            handleViewDetails(currentOrder);
            return; // No cambiar estado, solo abrir diálogo
          }
        } catch (e) {
          console.log('⚠️ Error al parsear notes:', e);
        }
      }

      // Actualizar usando PUT
      const response = await fetch(`/api/work-orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: currentOrder.title,
          description: currentOrder.description || '',
          type: currentOrder.type,
          status: newStatus,
          priority: currentOrder.priority,
          machineId: currentOrder.machineId,
          componentId: currentOrder.componentId,
          assignedToId: currentOrder.assignedToId,
          scheduledDate: currentOrder.scheduledDate,
          startedDate: newStatus === WorkOrderStatus.IN_PROGRESS && !currentOrder.startedDate 
            ? new Date().toISOString() 
            : currentOrder.startedDate,
          completedDate: newStatus === WorkOrderStatus.COMPLETED && !currentOrder.completedDate
            ? new Date().toISOString()
            : currentOrder.completedDate,
          estimatedHours: currentOrder.estimatedHours,
          actualHours: currentOrder.actualHours,
          cost: currentOrder.cost,
          notes: currentOrder.notes,
          sectorId: currentOrder.sectorId,
        }),
      });

      if (response.ok) {
        const updatedOrder = await response.json();
        handleWorkOrderUpdate(updatedOrder);
        // Actualizar la orden seleccionada si el modal está abierto
        if (selectedOrder && selectedOrder.id === updatedOrder.id) {
          setSelectedOrder(updatedOrder);
        }
        toast({
          title: 'Estado actualizado',
          description: `La orden se ha ${newStatus === WorkOrderStatus.IN_PROGRESS ? 'iniciado' : 'completado'}`,
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al actualizar el estado');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo actualizar el estado',
        variant: 'destructive',
      });
    }
  };

  const handleExport = () => {
    // ExportReports component handles this
  };

  const handlePrint = () => {
    setIsPrintDialogOpen(true);
  };

  const handleViewDetails = (order: WorkOrder) => {
    setSelectedOrder(order);
    // Usar el nuevo sheet para OTs correctivas
    if (order.type === 'CORRECTIVE') {
      setCorrectiveSheetAction(null); // Ver detalles, no acción específica
      setIsCorrectiveSheetOpen(true);
      setIsDialogOpen(false);
    } else {
      setIsDialogOpen(true);
      setIsCorrectiveSheetOpen(false);
    }
    setIsEditDialogOpen(false);
  };

  const handleEdit = (order: WorkOrder) => {
    setSelectedOrder(order);
    setIsEditDialogOpen(true);
    setIsDialogOpen(false);
  };

  const hasActiveFilters = useMemo(() => {
    return !!(
      filters.search ||
      filters.status ||
      filters.priority ||
      filters.assignee !== 'all' ||
      filters.machineId ||
      filters.dateRange?.from ||
      filters.dateRange?.to ||
      (filters.tags && filters.tags.length > 0)
    );
  }, [filters]);

  if (loading || dashboardLoading) {
    return (
      <PermissionGuard permission="ingresar_ordenesdetrabajo">
        <div className="h-screen sidebar-shell flex flex-col min-h-0">
          <WorkOrdersHeader
            totalCount={0}
            filteredCount={0}
            onRefresh={refreshData}
            onExport={handleExport}
            onPrint={handlePrint}
            onCreateOrder={() => setIsWizardOpen(true)}
            canCreate={canCreateWorkOrder}
            refreshing={refreshing}
          />
          <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-4">
            <WorkOrdersLoadingState />
          </div>
        </div>
      </PermissionGuard>
    );
  }

  if (error || dashboardError) {
    return (
      <PermissionGuard permission="ingresar_ordenesdetrabajo">
        <div className="h-screen sidebar-shell flex flex-col min-h-0">
          <WorkOrdersHeader
            totalCount={workOrders.length}
            filteredCount={filteredOrders.length}
            onRefresh={refreshData}
            onExport={handleExport}
            onPrint={handlePrint}
            onCreateOrder={() => setIsWizardOpen(true)}
            canCreate={canCreateWorkOrder}
            refreshing={refreshing}
          />
          <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-4">
            <Alert variant="destructive" className="border-border">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error al cargar órdenes</AlertTitle>
              <AlertDescription className="flex items-center justify-between">
                <span>
                  {error?.message || dashboardError?.message || 'Ocurrió un error inesperado'}
                </span>
                <Button variant="outline" size="sm" onClick={refreshData} className="ml-4">
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Reintentar
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </PermissionGuard>
    );
  }

  return (
    <PermissionGuard permission="ingresar_ordenesdetrabajo">
      <div className="h-screen sidebar-shell flex flex-col min-h-0">
        <WorkOrdersHeader
          totalCount={workOrders.length}
          filteredCount={filteredOrders.length}
          onRefresh={refreshData}
          onExport={handleExport}
          onPrint={handlePrint}
          onCreateOrder={() => setIsWizardOpen(true)}
          canCreate={canCreateWorkOrder}
          refreshing={refreshing}
          showViewSelector={true}
        />

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-4 md:px-6 py-4 space-y-4">
            {/* V2: Barra de vistas guardadas (presets) - siempre visible */}
            <WorkOrdersSavedViewsBar workOrders={workOrders} />

            <div className="border-t border-border" />

            {/* Vista Lista: KPIs, filtros y grid/tabla */}
            {currentView === 'lista' && (
              <>
                <WorkOrdersKpis
                  workOrders={workOrders}
                  activeFilter={filters.status === null && filters.assignee === 'unassigned' ? 'UNASSIGNED' : filters.status}
                  onFilterClick={handleStatusFilterClick}
                />

                <div className="border-t border-border" />

                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <WorkOrdersFiltersBar
                      filters={filters}
                      onFiltersChange={setFilters}
                      onResetFilters={resetFilters}
                      viewMode={viewMode}
                      onViewModeChange={setViewMode}
                      availableUsers={availableUsers}
                      availableMachines={availableMachines}
                    />
                  </div>
                  <Button
                    variant={selectionMode ? 'secondary' : 'outline'}
                    size="sm"
                    className="h-9 text-xs shrink-0"
                    onClick={() => {
                      setSelectionMode(!selectionMode);
                      if (selectionMode) setSelectedIds([]);
                    }}
                  >
                    <CheckSquare className="h-3.5 w-3.5 mr-1.5" />
                    {selectionMode ? 'Cancelar selección' : 'Selección'}
                  </Button>
                </div>

                {filteredOrders.length > 0 ? (
                  <>
                    {viewMode === 'grid' ? (
                      <WorkOrdersGrid
                        workOrders={filteredOrders}
                        onViewDetails={handleViewDetails}
                        onEdit={handleEdit}
                        onDelete={handleWorkOrderDelete}
                        onStatusChange={handleStatusChange}
                        selectionMode={selectionMode}
                        selectedIds={selectedIds}
                        onToggleSelect={handleToggleSelect}
                      />
                    ) : (
                      <WorkOrdersTable
                        workOrders={filteredOrders}
                        onViewDetails={handleViewDetails}
                        onEdit={handleEdit}
                        onDelete={handleWorkOrderDelete}
                        onStatusChange={handleStatusChange}
                        selectionMode={selectionMode}
                        selectedIds={selectedIds}
                        onToggleSelect={handleToggleSelect}
                        onSelectAll={handleSelectAll}
                      />
                    )}
                  </>
                ) : (
                  <WorkOrdersEmptyState
                    hasFilters={hasActiveFilters}
                    onClearFilters={resetFilters}
                    onCreateOrder={() => setIsWizardOpen(true)}
                    canCreate={canCreateWorkOrder}
                  />
                )}
              </>
            )}

            {/* Vista Bandeja: Dispatcher board con columnas */}
            {currentView === 'bandeja' && (
              <WorkOrdersDispatcherBoard
                onSelectWorkOrder={(workOrderId) => {
                  const order = workOrders.find(wo => wo.id === workOrderId);
                  if (order) {
                    handleViewDetails(order);
                  }
                }}
              />
            )}

            {/* Vista Calendario */}
            {currentView === 'calendario' && (
              <WorkOrdersCalendarView
                onSelectWorkOrder={(workOrderId) => {
                  const order = workOrders.find(wo => wo.id === workOrderId);
                  if (order) {
                    handleViewDetails(order);
                  }
                }}
              />
            )}
          </div>
        </div>

        {/* Diálogos */}
        {selectedOrder && (
          <>
            <WorkOrderDetailDialog
              workOrder={selectedOrder}
              isOpen={isDialogOpen}
              onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) {
                  setSelectedOrder(null);
                }
              }}
              onEdit={(order) => {
                setIsEditDialogOpen(true);
                setIsDialogOpen(false);
              }}
              onStatusChange={handleStatusChange}
              onDelete={handleWorkOrderDelete}
              availableUsers={availableUsers}
              canDelete={canDeleteWorkOrder}
            />
            <WorkOrderEditDialog
              workOrder={selectedOrder}
              isOpen={isEditDialogOpen}
              onOpenChange={(open) => {
                setIsEditDialogOpen(open);
                if (!open && selectedOrder) {
                  setIsDialogOpen(true);
                }
              }}
              onUpdate={(updatedOrder) => {
                handleWorkOrderUpdate(updatedOrder);
                setSelectedOrder(updatedOrder);
                setIsEditDialogOpen(false);
                setIsDialogOpen(true);
              }}
            />
          </>
        )}

        <PrintWorkOrders
          isOpen={isPrintDialogOpen}
          onOpenChange={setIsPrintDialogOpen}
          workOrders={filteredOrders}
          availableUsers={availableUsers}
        />

        {canCreateWorkOrder && (
          <WorkOrderWizard
            isOpen={isWizardOpen}
            onClose={() => {
              setIsWizardOpen(false);
              setPreselectedUnidadMovil(null);
              setPreselectedType(null);
            }}
            onSubmit={handleWorkOrderCreate}
            preselectedUnidadMovil={preselectedUnidadMovil}
            preselectedType={preselectedType}
          />
        )}

        <ExportReports workOrders={filteredOrders} filters={filters as any} />

        {/* Bulk Actions Bar */}
        {selectionMode && (
          <WorkOrdersBulkBar
            selectedIds={selectedIds}
            totalCount={filteredOrders.filter(o => o.status !== WorkOrderStatus.COMPLETED && o.status !== WorkOrderStatus.CANCELLED).length}
            onSelectAll={handleSelectAll}
            onClearSelection={handleClearSelection}
            availableUsers={availableUsers}
            onComplete={handleBulkComplete}
          />
        )}

        {/* Sheet para OTs Correctivas con tabs de Logs, Chat, etc */}
        {selectedOrder && (
          <WorkOrderDetailSheet
            workOrderId={selectedOrder.id}
            open={isCorrectiveSheetOpen}
            onOpenChange={(open) => {
              setIsCorrectiveSheetOpen(open);
              if (!open) {
                setSelectedOrder(null);
                setCorrectiveSheetAction(null);
                refetchDashboard(); // Refrescar datos al cerrar
              }
            }}
            initialAction={correctiveSheetAction}
          />
        )}
      </div>
    </PermissionGuard>
  );
}
