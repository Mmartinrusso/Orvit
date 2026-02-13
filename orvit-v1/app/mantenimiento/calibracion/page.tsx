'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
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
  Gauge,
  Plus,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
} from 'lucide-react';
import { format, formatDistanceToNow, isPast } from 'date-fns';
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
  PENDING: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  IN_PROGRESS: { label: 'En Progreso', color: 'bg-blue-100 text-blue-800' },
  COMPLETED: { label: 'Completado', color: 'bg-green-100 text-green-800' },
  FAILED: { label: 'Fallido', color: 'bg-red-100 text-red-800' },
  OVERDUE: { label: 'Vencido', color: 'bg-red-100 text-red-800' },
};

export default function CalibrationPage() {
  const { currentCompany } = useCompany();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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
    const config = STATUS_CONFIG[status] || { label: status, color: 'bg-gray-100' };
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
                  <Label>Nombre del Instrumento</Label>
                  <Input placeholder="Ej: Manómetro digital" />
                </div>
                <div className="space-y-2">
                  <Label>Número de Serie</Label>
                  <Input placeholder="Ej: SN-12345" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de Calibración</Label>
                    <Select defaultValue="INTERNAL">
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
                    <Input type="number" defaultValue={365} />
                  </div>
                </div>
                <Button className="w-full" onClick={() => setIsDialogOpen(false)}>
                  Crear Calibración
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{summary.total || 0}</p>
              </div>
              <Gauge className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendientes</p>
                <p className="text-2xl font-bold text-yellow-600">{summary.pending || 0}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Vencidos</p>
                <p className="text-2xl font-bold text-red-600">{summary.overdue || 0}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completados</p>
                <p className="text-2xl font-bold text-green-600">{summary.completed || 0}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Cargando...
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
                              {format(new Date(cal.nextCalibrationDate), 'dd/MM/yyyy')}
                            </p>
                            <p className={`text-xs ${isPast(new Date(cal.nextCalibrationDate)) ? 'text-red-500' : 'text-muted-foreground'}`}>
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
