'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Gauge,
  Plus,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  MoreHorizontal,
  Pencil,
  Trash2,
  Play,
  ShieldCheck,
} from 'lucide-react';
import { formatDistanceToNow, isPast } from 'date-fns';
import { es } from 'date-fns/locale';

interface Calibration {
  id: number;
  calibrationNumber: string;
  instrumentName: string;
  instrumentSerial: string;
  status: string;
  calibrationType: string;
  frequencyDays: number;
  lastCalibrationDate: string | null;
  nextCalibrationDate: string | null;
  machine_name: string;
  calibrated_by_name: string | null;
  result: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: 'bg-warning-muted text-warning-muted-foreground' },
  IN_PROGRESS: { label: 'En Progreso', color: 'bg-info-muted text-info-muted-foreground' },
  COMPLETED: { label: 'Completado', color: 'bg-success-muted text-success' },
  FAILED: { label: 'Fallido', color: 'bg-destructive/10 text-destructive' },
  OVERDUE: { label: 'Vencido', color: 'bg-destructive/10 text-destructive' },
};

export default function CalibrationPage() {
  const { currentCompany } = useCompany();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const FORM_DEFAULT = { machineId: '', instrumentName: '', instrumentSerial: '', calibrationType: 'INTERNAL', frequencyDays: '365' };
  const [form, setForm] = useState(FORM_DEFAULT);
  const patchForm = (patch: Partial<typeof FORM_DEFAULT>) => setForm(prev => ({ ...prev, ...patch }));

  const { data: machinesData } = useQuery({
    queryKey: ['machines-dropdown', currentCompany?.id],
    queryFn: async () => {
      const res = await fetch(`/api/machines?companyId=${currentCompany?.id}`);
      if (!res.ok) return { machines: [] };
      return res.json();
    },
    enabled: !!currentCompany?.id,
  });
  const machines = machinesData?.machines || [];

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/calibration?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Error al eliminar');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Calibración eliminada');
      queryClient.invalidateQueries({ queryKey: ['calibrations'] });
    },
    onError: (err: any) => toast.error(err.message || 'Error al eliminar calibración'),
  });

  const executeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch('/api/calibration', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'execute', result: 'PASS' }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error al ejecutar');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Calibración ejecutada correctamente');
      queryClient.invalidateQueries({ queryKey: ['calibrations'] });
    },
    onError: (err: any) => toast.error(err.message || 'Error al ejecutar calibración'),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch('/api/calibration', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'approve', approved: true }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error al aprobar');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Calibración aprobada');
      queryClient.invalidateQueries({ queryKey: ['calibrations'] });
    },
    onError: (err: any) => toast.error(err.message || 'Error al aprobar calibración'),
  });

  const handleDelete = (id: number) => {
    if (!confirm('¿Eliminar esta calibración? Esta acción no se puede deshacer.')) return;
    deleteMutation.mutate(id);
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof FORM_DEFAULT) => {
      const res = await fetch('/api/calibration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machineId: parseInt(data.machineId),
          instrumentName: data.instrumentName,
          instrumentSerial: data.instrumentSerial || undefined,
          calibrationType: data.calibrationType,
          frequencyDays: parseInt(data.frequencyDays),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error al crear');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Calibración creada correctamente');
      setIsDialogOpen(false);
      setForm(FORM_DEFAULT);
      queryClient.invalidateQueries({ queryKey: ['calibrations'] });
    },
    onError: (err: any) => toast.error(err.message || 'Error al crear calibración'),
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['calibrations', currentCompany?.id, statusFilter],
    queryFn: async () => {
      const res = await fetch(
        `/api/calibration?companyId=${currentCompany?.id}&status=${statusFilter}`
      );
      if (!res.ok) throw new Error('Error al cargar calibraciones');
      return res.json();
    },
    enabled: !!currentCompany?.id,
  });

  const calibrations: Calibration[] = data?.calibrations || [];
  const summary = data?.summary || {};

  const filteredCalibrations = calibrations.filter(c =>
    c.instrumentName.toLowerCase().includes(search.toLowerCase()) ||
    c.calibrationNumber.toLowerCase().includes(search.toLowerCase()) ||
    c.machine_name?.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || { label: status, color: 'bg-muted' };
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gauge className="h-6 w-6" />
            Gestión de Calibraciones
          </h1>
          <p className="text-muted-foreground">
            Control y seguimiento de calibración de instrumentos
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          {hasPermission('calibration.create') && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Nueva Calibración
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Calibración</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Máquina *</Label>
                  <Select value={form.machineId} onValueChange={v => patchForm({ machineId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar máquina..." />
                    </SelectTrigger>
                    <SelectContent>
                      {machines.map((m: any) => (
                        <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nombre del Instrumento *</Label>
                  <Input
                    placeholder="Ej: Manómetro digital"
                    value={form.instrumentName}
                    onChange={e => patchForm({ instrumentName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Número de Serie</Label>
                  <Input
                    placeholder="Ej: SN-12345"
                    value={form.instrumentSerial}
                    onChange={e => patchForm({ instrumentSerial: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de Calibración</Label>
                    <Select value={form.calibrationType} onValueChange={v => patchForm({ calibrationType: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INTERNAL">Interna</SelectItem>
                        <SelectItem value="EXTERNAL">Externa</SelectItem>
                        <SelectItem value="VENDOR">Proveedor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Frecuencia (días)</Label>
                    <Input
                      type="number"
                      value={form.frequencyDays}
                      onChange={e => patchForm({ frequencyDays: e.target.value })}
                    />
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={() => createMutation.mutate(form)}
                  disabled={!form.machineId || !form.instrumentName || createMutation.isPending}
                >
                  {createMutation.isPending ? 'Creando...' : 'Crear Calibración'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{summary.total || 0}</p>
              </div>
              <Gauge className="h-8 w-8 text-info-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendientes</p>
                <p className="text-2xl font-bold text-warning-muted-foreground">{summary.pending || 0}</p>
              </div>
              <Clock className="h-8 w-8 text-warning-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Vencidos</p>
                <p className="text-2xl font-bold text-destructive">{summary.overdue || 0}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completados</p>
                <p className="text-2xl font-bold text-success">{summary.completed || 0}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por instrumento, número o máquina..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="PENDING">Pendientes</SelectItem>
            <SelectItem value="IN_PROGRESS">En Progreso</SelectItem>
            <SelectItem value="COMPLETED">Completados</SelectItem>
            <SelectItem value="OVERDUE">Vencidos</SelectItem>
            <SelectItem value="FAILED">Fallidos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Instrumento</TableHead>
                <TableHead>Máquina</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Próxima Calibración</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Resultado</TableHead>
                {(hasPermission('calibration.edit') || hasPermission('calibration.delete') || hasPermission('calibration.execute') || hasPermission('calibration.approve')) && (
                  <TableHead className="w-[60px]">Acciones</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Cargando calibraciones...
                  </TableCell>
                </TableRow>
              ) : filteredCalibrations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No se encontraron calibraciones
                  </TableCell>
                </TableRow>
              ) : (
                filteredCalibrations.map((cal) => (
                  <TableRow key={cal.id}>
                    <TableCell className="font-mono text-sm">{cal.calibrationNumber}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{cal.instrumentName}</p>
                        {cal.instrumentSerial && (
                          <p className="text-xs text-muted-foreground">S/N: {cal.instrumentSerial}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{cal.machine_name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {cal.calibrationType === 'INTERNAL' ? 'Interna' :
                         cal.calibrationType === 'EXTERNAL' ? 'Externa' : 'Proveedor'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {cal.nextCalibrationDate ? (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm">
                              {formatDate(cal.nextCalibrationDate)}
                            </p>
                            <p className={`text-xs ${isPast(new Date(cal.nextCalibrationDate)) ? 'text-destructive' : 'text-muted-foreground'}`}>
                              {formatDistanceToNow(new Date(cal.nextCalibrationDate), { addSuffix: true, locale: es })}
                            </p>
                          </div>
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell>{getStatusBadge(cal.status)}</TableCell>
                    <TableCell>
                      {cal.result ? (
                        <Badge variant={cal.result === 'PASS' ? 'default' : 'destructive'}>
                          {cal.result === 'PASS' ? 'Aprobado' : cal.result === 'FAIL' ? 'Rechazado' : 'Ajustado'}
                        </Badge>
                      ) : '-'}
                    </TableCell>
                    {(hasPermission('calibration.edit') || hasPermission('calibration.delete') || hasPermission('calibration.execute') || hasPermission('calibration.approve')) && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {hasPermission('calibration.edit') && (
                              <DropdownMenuItem onClick={() => toast.info('Edición de calibración próximamente')}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                            )}
                            {hasPermission('calibration.execute') && (cal.status === 'PENDING' || cal.status === 'OVERDUE') && (
                              <DropdownMenuItem onClick={() => executeMutation.mutate(cal.id)}>
                                <Play className="h-4 w-4 mr-2" />
                                Ejecutar Calibración
                              </DropdownMenuItem>
                            )}
                            {hasPermission('calibration.approve') && cal.status === 'COMPLETED' && (
                              <DropdownMenuItem onClick={() => approveMutation.mutate(cal.id)}>
                                <ShieldCheck className="h-4 w-4 mr-2" />
                                Aprobar
                              </DropdownMenuItem>
                            )}
                            {hasPermission('calibration.delete') && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleDelete(cal.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Eliminar
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
