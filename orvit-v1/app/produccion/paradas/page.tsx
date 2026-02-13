'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  RefreshCw,
  Calendar,
  Clock,
  Factory,
  AlertTriangle,
  Wrench,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Link2,
  CheckCircle2,
  XCircle,
  Timer,
  BarChart3,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/components/providers/ThemeProvider';
import { toast } from 'sonner';
import { format, subDays, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import NewDowntimeForm from '@/components/production/NewDowntimeForm';

interface Downtime {
  id: number;
  type: string;
  description: string;
  rootCause: string | null;
  startTime: string;
  endTime: string | null;
  durationMinutes: number | null;
  affectsLine: boolean;
  productionOrder: {
    id: number;
    code: string;
    product: { name: string };
  } | null;
  shift: { id: number; name: string } | null;
  workCenter: { id: number; name: string } | null;
  machine: { id: number; name: string; nickname: string } | null;
  reasonCode: {
    id: number;
    code: string;
    name: string;
    type: string;
    triggersMaintenance: boolean;
  } | null;
  workOrder: {
    id: number;
    title: string;
    status: string;
  } | null;
  reportedBy: { id: number; name: string };
}

export default function DowntimesPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const { theme } = useTheme();

  const [downtimes, setDowntimes] = useState<Downtime[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalDowntimes: 0, totalMinutes: 0 });
  const [workCenters, setWorkCenters] = useState<{ id: number; name: string }[]>([]);
  const [reasonCodes, setReasonCodes] = useState<{ id: number; code: string; name: string }[]>([]);

  // Filters
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [workCenterFilter, setWorkCenterFilter] = useState<string>('all');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  // Dialogs
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [createWODialog, setCreateWODialog] = useState<{ open: boolean; downtime: Downtime | null }>({
    open: false,
    downtime: null,
  });

  const canCreate = hasPermission('produccion.paradas.create');
  const canEdit = hasPermission('produccion.paradas.edit');
  const canDelete = hasPermission('produccion.paradas.delete');
  const canCreateWO = hasPermission('produccion.paradas.create_workorder');

  const fetchDowntimes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      if (typeFilter !== 'all') params.append('type', typeFilter);
      if (workCenterFilter !== 'all') params.append('workCenterId', workCenterFilter);
      params.append('page', pagination.page.toString());
      params.append('limit', pagination.limit.toString());

      const res = await fetch(`/api/production/downtimes?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setDowntimes(data.downtimes);
        setStats(data.stats);
        setPagination(prev => ({ ...prev, ...data.pagination }));
      } else {
        toast.error(data.error || 'Error al cargar las paradas');
      }
    } catch (error) {
      console.error('Error fetching downtimes:', error);
      toast.error('Error al cargar las paradas');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, typeFilter, workCenterFilter, pagination.page, pagination.limit]);

  const fetchMasterData = useCallback(async () => {
    try {
      const [wcRes, rcRes] = await Promise.all([
        fetch('/api/production/work-centers?status=ACTIVE'),
        fetch('/api/production/reason-codes?type=DOWNTIME&activeOnly=true'),
      ]);

      const [wcData, rcData] = await Promise.all([
        wcRes.json(),
        rcRes.json(),
      ]);

      if (wcData.success) setWorkCenters(wcData.workCenters);
      if (rcData.success) setReasonCodes(rcData.reasonCodes);
    } catch (error) {
      console.error('Error fetching master data:', error);
    }
  }, []);

  useEffect(() => {
    fetchDowntimes();
  }, [fetchDowntimes]);

  useEffect(() => {
    fetchMasterData();
  }, [fetchMasterData]);

  const handleCreateWorkOrder = async (downtime: Downtime) => {
    try {
      const res = await fetch(`/api/production/downtimes/${downtime.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_workorder',
          priority: 'medium',
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Orden de trabajo creada');
        setCreateWODialog({ open: false, downtime: null });
        fetchDowntimes();
      } else {
        toast.error(data.error || 'Error al crear OT');
      }
    } catch (error) {
      console.error('Error creating work order:', error);
      toast.error('Error al crear OT');
    }
  };

  const handleDelete = async (downtimeId: number) => {
    if (!confirm('¿Eliminar esta parada?')) return;

    try {
      const res = await fetch(`/api/production/downtimes/${downtimeId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Parada eliminada');
        fetchDowntimes();
      } else {
        toast.error(data.error || 'Error al eliminar');
      }
    } catch (error) {
      console.error('Error deleting downtime:', error);
      toast.error('Error al eliminar');
    }
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '-';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="px-4 md:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#ef444415' }}>
              <AlertTriangle className="h-5 w-5" style={{ color: '#ef4444' }} />
            </div>
            Paradas de Producción
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Registro y análisis de paradas</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchDowntimes()} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          {canCreate && (
            <Button size="sm" onClick={() => setShowNewDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Nueva Parada
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Paradas', value: stats.totalDowntimes, icon: AlertTriangle, color: '#ef4444' },
          { label: 'Tiempo Total', value: formatDuration(stats.totalMinutes), icon: Timer, color: '#f59e0b' },
          { label: 'No Planificadas', value: downtimes.filter(d => d.type === 'UNPLANNED').length, icon: Clock, color: '#f59e0b' },
          { label: 'Con OT', value: downtimes.filter(d => d.workOrder).length, icon: Wrench, color: '#6366f1' },
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
            <div className="flex gap-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[140px]"
              />
              <span className="self-center text-muted-foreground">a</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[140px]"
              />
            </div>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="PLANNED">Planificadas</SelectItem>
                <SelectItem value="UNPLANNED">No Planificadas</SelectItem>
              </SelectContent>
            </Select>

            <Select value={workCenterFilter} onValueChange={setWorkCenterFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Centro" />
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

      {/* Downtimes Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha/Hora</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead className="hidden md:table-cell">Centro/Máquina</TableHead>
                <TableHead>Duración</TableHead>
                <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                <TableHead className="hidden lg:table-cell">OT</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    <p className="mt-2 text-muted-foreground">Cargando paradas...</p>
                  </TableCell>
                </TableRow>
              ) : downtimes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <CheckCircle2 className="h-8 w-8 mx-auto text-green-400" />
                    <p className="mt-2 text-muted-foreground">No hay paradas registradas</p>
                  </TableCell>
                </TableRow>
              ) : (
                downtimes.map(downtime => (
                  <TableRow key={downtime.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {format(new Date(downtime.startTime), 'dd/MM HH:mm', { locale: es })}
                        </div>
                        {downtime.endTime ? (
                          <div className="text-xs text-muted-foreground">
                            → {format(new Date(downtime.endTime), 'HH:mm', { locale: es })}
                          </div>
                        ) : (
                          <div className="text-xs text-red-500">En curso</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {downtime.reasonCode?.name || 'Sin código'}
                        </div>
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {downtime.description}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <Factory className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {downtime.workCenter?.name || downtime.machine?.name || '-'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`font-medium ${
                        (downtime.durationMinutes || 0) > 60 ? 'text-red-500' : ''
                      }`}>
                        {formatDuration(downtime.durationMinutes)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge
                        variant={downtime.type === 'PLANNED' ? 'secondary' : 'destructive'}
                      >
                        {downtime.type === 'PLANNED' ? 'Planificada' : 'No Planificada'}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {downtime.workOrder ? (
                        <Badge
                          variant="outline"
                          className="cursor-pointer"
                          onClick={() => router.push(`/mantenimiento/ordenes/${downtime.workOrder!.id}`)}
                        >
                          <Wrench className="h-3 w-3 mr-1" />
                          {downtime.workOrder.status}
                        </Badge>
                      ) : downtime.reasonCode?.triggersMaintenance ? (
                        <Badge variant="outline" className="text-yellow-600 border-yellow-400">
                          Sugerida
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => router.push(`/produccion/paradas/${downtime.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Ver detalle
                          </DropdownMenuItem>

                          {canCreateWO && !downtime.workOrder && (
                            <DropdownMenuItem
                              onClick={() => setCreateWODialog({ open: true, downtime })}
                            >
                              <Wrench className="h-4 w-4 mr-2 text-blue-500" />
                              Crear OT
                            </DropdownMenuItem>
                          )}

                          {downtime.workOrder && (
                            <DropdownMenuItem
                              onClick={() => router.push(`/mantenimiento/ordenes/${downtime.workOrder!.id}`)}
                            >
                              <Link2 className="h-4 w-4 mr-2" />
                              Ver OT
                            </DropdownMenuItem>
                          )}

                          {canDelete && !downtime.workOrder && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-500"
                                onClick={() => handleDelete(downtime.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t">
              <p className="text-sm text-muted-foreground">
                Página {pagination.page} de {pagination.totalPages}
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

      {/* New Downtime Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Parada</DialogTitle>
            <DialogDescription>
              Registre una parada de producción
            </DialogDescription>
          </DialogHeader>
          <NewDowntimeForm
            onSuccess={() => {
              setShowNewDialog(false);
              fetchDowntimes();
            }}
            onCancel={() => setShowNewDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Create WorkOrder Dialog */}
      <AlertDialog
        open={createWODialog.open}
        onOpenChange={(open) => setCreateWODialog({ open, downtime: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Crear Orden de Trabajo</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Crear una orden de trabajo de mantenimiento para esta parada?
              {createWODialog.downtime && (
                <div className="mt-2 p-2 bg-muted rounded text-sm">
                  <strong>{createWODialog.downtime.reasonCode?.name}</strong>
                  <br />
                  {createWODialog.downtime.description}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => createWODialog.downtime && handleCreateWorkOrder(createWODialog.downtime)}
            >
              <Wrench className="h-4 w-4 mr-2" />
              Crear OT
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
