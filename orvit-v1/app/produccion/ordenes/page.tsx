'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  Filter,
  RefreshCw,
  ChevronRight,
  Calendar,
  Package,
  Clock,
  Factory,
  AlertTriangle,
  CheckCircle2,
  Pause,
  Play,
  X,
  MoreHorizontal,
  FileText,
  Trash2,
  Eye,
  Edit,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/components/providers/ThemeProvider';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';

interface ProductionOrder {
  id: number;
  code: string;
  status: string;
  priority: string;
  plannedQuantity: number;
  producedQuantity: number;
  scrapQuantity: number;
  reworkQuantity: number;
  targetUom: string;
  plannedStartDate: string;
  plannedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  notes: string | null;
  product: {
    id: string;
    name: string;
    code: string;
    unit: string;
  };
  workCenter: {
    id: number;
    code: string;
    name: string;
    type: string;
  } | null;
  responsible: {
    id: number;
    name: string;
    email: string;
  } | null;
  createdBy: {
    id: number;
    name: string;
  };
  _count: {
    dailyReports: number;
    downtimes: number;
    batchLots: number;
  };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  DRAFT: { label: 'Borrador', color: 'bg-muted-foreground', icon: <FileText className="h-3 w-3" /> },
  RELEASED: { label: 'Liberada', color: 'bg-info', icon: <CheckCircle2 className="h-3 w-3" /> },
  IN_PROGRESS: { label: 'En Progreso', color: 'bg-success', icon: <Play className="h-3 w-3" /> },
  PAUSED: { label: 'Pausada', color: 'bg-warning', icon: <Pause className="h-3 w-3" /> },
  COMPLETED: { label: 'Completada', color: 'bg-purple-500', icon: <CheckCircle2 className="h-3 w-3" /> },
  CANCELLED: { label: 'Cancelada', color: 'bg-destructive', icon: <X className="h-3 w-3" /> },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  LOW: { label: 'Baja', color: 'bg-muted-foreground' },
  NORMAL: { label: 'Normal', color: 'bg-info' },
  HIGH: { label: 'Alta', color: 'bg-warning' },
  URGENT: { label: 'Urgente', color: 'bg-destructive' },
};

export default function ProductionOrdersPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const { theme } = useTheme();
  const confirm = useConfirm();

  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [workCenterFilter, setWorkCenterFilter] = useState<string>('all');
  const [workCenters, setWorkCenters] = useState<{ id: number; code: string; name: string }[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const canCreate = hasPermission('produccion.ordenes.create');
  const canEdit = hasPermission('produccion.ordenes.edit');
  const canDelete = hasPermission('produccion.ordenes.delete');
  const canStart = hasPermission('produccion.ordenes.start');
  const canComplete = hasPermission('produccion.ordenes.complete');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      if (statusFilter === 'active') {
        params.append('status', 'DRAFT,RELEASED,IN_PROGRESS,PAUSED');
      } else if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      if (priorityFilter !== 'all') {
        params.append('priority', priorityFilter);
      }

      if (workCenterFilter !== 'all') {
        params.append('workCenterId', workCenterFilter);
      }

      params.append('page', pagination.page.toString());
      params.append('limit', pagination.limit.toString());

      const res = await fetch(`/api/production/orders?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setOrders(data.orders);
        setPagination(prev => ({ ...prev, ...data.pagination }));
      } else {
        toast.error(data.error || 'Error al cargar las órdenes');
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Error al cargar las órdenes');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, workCenterFilter, pagination.page, pagination.limit]);

  const fetchWorkCenters = useCallback(async () => {
    try {
      const res = await fetch('/api/production/work-centers?status=ACTIVE');
      const data = await res.json();
      if (data.success) {
        setWorkCenters(data.workCenters);
      }
    } catch (error) {
      console.error('Error fetching work centers:', error);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    fetchWorkCenters();
  }, [fetchWorkCenters]);

  const filteredOrders = useMemo(() => {
    if (!searchTerm) return orders;

    const term = searchTerm.toLowerCase();
    return orders.filter(order =>
      order.code.toLowerCase().includes(term) ||
      order.product.name.toLowerCase().includes(term) ||
      order.product.code.toLowerCase().includes(term) ||
      order.workCenter?.name.toLowerCase().includes(term)
    );
  }, [orders, searchTerm]);

  const handleStatusChange = async (orderId: number, newStatus: string) => {
    try {
      const res = await fetch(`/api/production/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(data.message || 'Estado actualizado');
        fetchOrders();
      } else {
        toast.error(data.error || 'Error al actualizar estado');
      }
    } catch (error) {
      console.error('Error changing status:', error);
      toast.error('Error al actualizar estado');
    }
  };

  const getCompletionPercentage = (order: ProductionOrder) => {
    if (!order.plannedQuantity) return 0;
    return Math.min(100, (Number(order.producedQuantity) / Number(order.plannedQuantity)) * 100);
  };

  const stats = useMemo(() => {
    return {
      total: pagination.total,
      inProgress: orders.filter(o => o.status === 'IN_PROGRESS').length,
      paused: orders.filter(o => o.status === 'PAUSED').length,
      urgent: orders.filter(o => o.priority === 'URGENT' && !['COMPLETED', 'CANCELLED'].includes(o.status)).length,
    };
  }, [orders, pagination.total]);

  return (
    <TooltipProvider>
      <div className="px-4 md:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#6366f115' }}>
                <Package className="h-5 w-5" style={{ color: '#6366f1' }} />
              </div>
              Órdenes de Producción
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Gestión de órdenes de producción</p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => fetchOrders()} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
            {canCreate && (
              <Button size="sm" onClick={() => router.push('/produccion/ordenes/nueva')} className="gap-2">
                <Plus className="h-4 w-4" />
                Nueva Orden
              </Button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Órdenes', value: stats.total, icon: Package, color: '#6366f1' },
            { label: 'En Progreso', value: stats.inProgress, icon: Play, color: '#10b981' },
            { label: 'Pausadas', value: stats.paused, icon: Pause, color: '#f59e0b' },
            { label: 'Urgentes', value: stats.urgent, icon: AlertTriangle, color: '#ef4444' },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                    <p className="text-2xl font-bold mt-1">{stat.value}</p>
                  </div>
                  <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${stat.color}15` }}>
                    <stat.icon className="h-5 w-5" style={{ color: stat.color }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por código, producto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Activas</SelectItem>
                  <SelectItem value="DRAFT">Borrador</SelectItem>
                  <SelectItem value="RELEASED">Liberada</SelectItem>
                  <SelectItem value="IN_PROGRESS">En Progreso</SelectItem>
                  <SelectItem value="PAUSED">Pausada</SelectItem>
                  <SelectItem value="COMPLETED">Completada</SelectItem>
                  <SelectItem value="CANCELLED">Cancelada</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Prioridad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="URGENT">Urgente</SelectItem>
                  <SelectItem value="HIGH">Alta</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="LOW">Baja</SelectItem>
                </SelectContent>
              </Select>

              <Select value={workCenterFilter} onValueChange={setWorkCenterFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Centro de trabajo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los centros</SelectItem>
                  {workCenters.map(wc => (
                    <SelectItem key={wc.id} value={wc.id.toString()}>
                      {wc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Orders Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="hidden md:table-cell">Centro</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="hidden sm:table-cell">Prioridad</TableHead>
                  <TableHead className="hidden lg:table-cell">Progreso</TableHead>
                  <TableHead className="hidden md:table-cell">Fecha Inicio</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                      <p className="mt-2 text-muted-foreground">Cargando órdenes...</p>
                    </TableCell>
                  </TableRow>
                ) : filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <Package className="h-8 w-8 mx-auto text-muted-foreground" />
                      <p className="mt-2 text-muted-foreground">No se encontraron órdenes</p>
                      {canCreate && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-4"
                          onClick={() => router.push('/produccion/ordenes/nueva')}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Crear primera orden
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map(order => {
                    const statusConfig = STATUS_CONFIG[order.status];
                    const priorityConfig = PRIORITY_CONFIG[order.priority];
                    const completion = getCompletionPercentage(order);

                    return (
                      <TableRow
                        key={order.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/produccion/ordenes/${order.id}`)}
                      >
                        <TableCell>
                          <div className="font-medium">{order.code}</div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{order.product.name}</div>
                            <div className="text-sm text-muted-foreground">{order.product.code}</div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {order.workCenter ? (
                            <div className="flex items-center gap-2">
                              <Factory className="h-4 w-4 text-muted-foreground" />
                              <span>{order.workCenter.name}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`${statusConfig.color} text-white`}
                          >
                            {statusConfig.icon}
                            <span className="ml-1">{statusConfig.label}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge
                            variant="outline"
                            className={`${priorityConfig.color} text-white border-0`}
                          >
                            {priorityConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="w-32">
                            <div className="flex justify-between text-xs mb-1">
                              <span>{Number(order.producedQuantity).toLocaleString()}</span>
                              <span>{Number(order.plannedQuantity).toLocaleString()} {order.targetUom}</span>
                            </div>
                            <Progress value={completion} className="h-2" />
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {format(new Date(order.plannedStartDate), 'dd/MM/yyyy', { locale: es })}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/produccion/ordenes/${order.id}`);
                                }}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                Ver detalle
                              </DropdownMenuItem>

                              {canEdit && ['DRAFT', 'RELEASED'].includes(order.status) && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/produccion/ordenes/${order.id}?edit=true`);
                                  }}
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuSeparator />

                              {/* Status transitions */}
                              {order.status === 'DRAFT' && canStart && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusChange(order.id, 'RELEASED');
                                  }}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-2 text-info-muted-foreground" />
                                  Liberar
                                </DropdownMenuItem>
                              )}

                              {order.status === 'RELEASED' && canStart && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusChange(order.id, 'IN_PROGRESS');
                                  }}
                                >
                                  <Play className="h-4 w-4 mr-2 text-success" />
                                  Iniciar
                                </DropdownMenuItem>
                              )}

                              {order.status === 'IN_PROGRESS' && (
                                <>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStatusChange(order.id, 'PAUSED');
                                    }}
                                  >
                                    <Pause className="h-4 w-4 mr-2 text-warning-muted-foreground" />
                                    Pausar
                                  </DropdownMenuItem>
                                  {canComplete && (
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleStatusChange(order.id, 'COMPLETED');
                                      }}
                                    >
                                      <CheckCircle2 className="h-4 w-4 mr-2 text-purple-500" />
                                      Completar
                                    </DropdownMenuItem>
                                  )}
                                </>
                              )}

                              {order.status === 'PAUSED' && canStart && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusChange(order.id, 'IN_PROGRESS');
                                  }}
                                >
                                  <Play className="h-4 w-4 mr-2 text-success" />
                                  Reanudar
                                </DropdownMenuItem>
                              )}

                              {!['COMPLETED', 'CANCELLED'].includes(order.status) && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStatusChange(order.id, 'CANCELLED');
                                    }}
                                  >
                                    <X className="h-4 w-4 mr-2" />
                                    Cancelar
                                  </DropdownMenuItem>
                                </>
                              )}

                              {canDelete && order.status === 'DRAFT' && (
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const ok = await confirm({
                                      title: 'Eliminar orden',
                                      description: '¿Eliminar esta orden?',
                                      confirmText: 'Eliminar',
                                      variant: 'destructive',
                                    });
                                    if (ok) {
                                      const res = await fetch(`/api/production/orders/${order.id}`, {
                                        method: 'DELETE',
                                      });
                                      const data = await res.json();
                                      if (data.success) {
                                        toast.success('Orden eliminada');
                                        fetchOrders();
                                      } else {
                                        toast.error(data.error);
                                      }
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Eliminar
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Mostrando {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page === 1}
                    onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page === pagination.totalPages}
                    onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
