'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useViewMode } from '@/contexts/ViewModeContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileCheck,
  RefreshCw,
  MoreHorizontal,
  ArrowDownToLine,
  CheckCircle,
  XCircle,
  ArrowRightLeft,
  Calendar
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

interface Cheque {
  id: number;
  numero: string;
  banco: string;
  titular: string;
  importe: number;
  moneda: string;
  fechaEmision: string;
  fechaVencimiento: string;
  estado: string;
  origen: string;
  tipo: string;
  docType: string;
  clientPayment?: { id: number; numero: string; client?: { name: string } };
  paymentOrder?: { id: number; numero: string; proveedor?: { name: string } };
}

interface ChequesResponse {
  data: Cheque[];
  resumen: Array<{
    estado: string;
    moneda: string;
    _count: { id: number };
    _sum: { importe: number };
  }>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
  _m: string;
}

async function fetchCheques(params: { estado?: string; origen?: string }): Promise<ChequesResponse> {
  const searchParams = new URLSearchParams();
  if (params.estado) searchParams.set('estado', params.estado);
  if (params.origen) searchParams.set('origen', params.origen);

  const res = await fetch(`/api/tesoreria/cheques?${searchParams.toString()}`);
  if (!res.ok) throw new Error('Error al obtener cheques');
  return res.json();
}

async function accionCheque(id: number, accion: string, data?: any) {
  const res = await fetch(`/api/tesoreria/cheques/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accion, ...data }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Error en la acción');
  }
  return res.json();
}

const ESTADO_BADGE: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  CARTERA: { variant: 'default', label: 'En Cartera' },
  DEPOSITADO: { variant: 'secondary', label: 'Depositado' },
  COBRADO: { variant: 'default', label: 'Cobrado' },
  RECHAZADO: { variant: 'destructive', label: 'Rechazado' },
  ENDOSADO: { variant: 'outline', label: 'Endosado' },
  ANULADO: { variant: 'destructive', label: 'Anulado' },
  VENCIDO: { variant: 'destructive', label: 'Vencido' },
};

export default function ChequesPage() {
  const queryClient = useQueryClient();
  const { viewMode } = useViewMode();
  const [filtroEstado, setFiltroEstado] = useState<string>('');
  const [filtroOrigen, setFiltroOrigen] = useState<string>('');
  const [selectedCheque, setSelectedCheque] = useState<Cheque | null>(null);
  const [actionDialog, setActionDialog] = useState<{ open: boolean; action: string; cheque: Cheque | null }>({
    open: false,
    action: '',
    cheque: null,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['tesoreria', 'cheques', filtroEstado, filtroOrigen, viewMode],
    queryFn: () => fetchCheques({ estado: filtroEstado, origen: filtroOrigen }),
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, accion, data }: { id: number; accion: string; data?: any }) =>
      accionCheque(id, accion, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tesoreria', 'cheques'] });
      queryClient.invalidateQueries({ queryKey: ['tesoreria', 'posicion'] });
      setActionDialog({ open: false, action: '', cheque: null });
      toast.success('Acción realizada exitosamente');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleAction = (cheque: Cheque, accion: string) => {
    if (accion === 'depositar') {
      setActionDialog({ open: true, action: 'depositar', cheque });
    } else if (accion === 'rechazar') {
      setActionDialog({ open: true, action: 'rechazar', cheque });
    } else {
      actionMutation.mutate({ id: cheque.id, accion });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-4 w-24" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-32" /></CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Error al cargar cheques</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const cheques = data?.data || [];
  const resumen = data?.resumen || [];

  // Calcular totales por estado
  const totalCartera = resumen
    .filter(r => r.estado === 'CARTERA')
    .reduce((sum, r) => sum + Number(r._sum.importe || 0), 0);
  const cantidadCartera = resumen
    .filter(r => r.estado === 'CARTERA')
    .reduce((sum, r) => sum + r._count.id, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cartera de Cheques</h1>
          <p className="text-muted-foreground">Gestión de cheques recibidos y emitidos</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['tesoreria', 'cheques'] })}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Totales */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">En Cartera</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalCartera)}</div>
            <p className="text-xs text-muted-foreground">{cantidadCartera} documentos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Depositados</CardTitle>
            <ArrowDownToLine className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(resumen.filter(r => r.estado === 'DEPOSITADO').reduce((s, r) => s + Number(r._sum.importe || 0), 0))}
            </div>
            <p className="text-xs text-muted-foreground">
              {resumen.filter(r => r.estado === 'DEPOSITADO').reduce((s, r) => s + r._count.id, 0)} documentos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cobrados</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {formatCurrency(resumen.filter(r => r.estado === 'COBRADO').reduce((s, r) => s + Number(r._sum.importe || 0), 0))}
            </div>
            <p className="text-xs text-muted-foreground">
              {resumen.filter(r => r.estado === 'COBRADO').reduce((s, r) => s + r._count.id, 0)} documentos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Rechazados</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(resumen.filter(r => r.estado === 'RECHAZADO').reduce((s, r) => s + Number(r._sum.importe || 0), 0))}
            </div>
            <p className="text-xs text-muted-foreground">
              {resumen.filter(r => r.estado === 'RECHAZADO').reduce((s, r) => s + r._count.id, 0)} documentos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros y Tabla */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Listado de Cheques</CardTitle>
              <CardDescription>Todos los cheques en el sistema</CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={filtroEstado || 'all'} onValueChange={(v) => setFiltroEstado(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="CARTERA">En Cartera</SelectItem>
                  <SelectItem value="DEPOSITADO">Depositado</SelectItem>
                  <SelectItem value="COBRADO">Cobrado</SelectItem>
                  <SelectItem value="RECHAZADO">Rechazado</SelectItem>
                  <SelectItem value="ENDOSADO">Endosado</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filtroOrigen || 'all'} onValueChange={(v) => setFiltroOrigen(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Origen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="RECIBIDO">Recibidos</SelectItem>
                  <SelectItem value="EMITIDO">Emitidos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {cheques.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay cheques que coincidan con los filtros seleccionados.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead>Titular</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cheques.map((cheque) => {
                  const vencimiento = new Date(cheque.fechaVencimiento);
                  const hoy = new Date();
                  const diasRestantes = Math.ceil((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

                  return (
                    <TableRow key={cheque.id}>
                      <TableCell className="font-medium">
                        #{cheque.numero}
                        <Badge variant="outline" className="ml-2 text-xs">
                          {cheque.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell>{cheque.banco}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{cheque.titular}</TableCell>
                      <TableCell className="text-right font-mono">
                        {cheque.moneda === 'USD' ? 'USD ' : ''}
                        {formatCurrency(cheque.importe, cheque.moneda)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span>{vencimiento.toLocaleDateString('es-AR')}</span>
                          {cheque.estado === 'CARTERA' && diasRestantes <= 7 && diasRestantes >= 0 && (
                            <Badge variant="outline" className="text-warning-muted-foreground">
                              {diasRestantes === 0 ? 'Hoy' : `${diasRestantes}d`}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={cheque.origen === 'RECIBIDO' ? 'default' : 'secondary'}>
                          {cheque.origen === 'RECIBIDO' ? 'Recibido' : 'Emitido'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={ESTADO_BADGE[cheque.estado]?.variant || 'outline'}>
                          {ESTADO_BADGE[cheque.estado]?.label || cheque.estado}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {cheque.estado === 'CARTERA' && cheque.origen === 'RECIBIDO' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleAction(cheque, 'depositar')}>
                                <ArrowDownToLine className="h-4 w-4 mr-2" />
                                Depositar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAction(cheque, 'endosar')}>
                                <ArrowRightLeft className="h-4 w-4 mr-2" />
                                Endosar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAction(cheque, 'anular')} className="text-destructive">
                                <XCircle className="h-4 w-4 mr-2" />
                                Anular
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        {cheque.estado === 'DEPOSITADO' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleAction(cheque, 'cobrar')}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Marcar Cobrado
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAction(cheque, 'rechazar')} className="text-destructive">
                                <XCircle className="h-4 w-4 mr-2" />
                                Marcar Rechazado
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog para acciones que requieren más datos */}
      <Dialog open={actionDialog.open} onOpenChange={(open) => setActionDialog({ ...actionDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.action === 'depositar' ? 'Depositar Cheque' : 'Rechazar Cheque'}
            </DialogTitle>
            <DialogDescription>
              {actionDialog.action === 'depositar'
                ? 'Selecciona la cuenta bancaria donde depositar el cheque'
                : 'Indica el motivo del rechazo'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {actionDialog.action === 'depositar' && (
              <div className="grid gap-2">
                <Label>Cuenta Bancaria</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Banco Galicia - CC</SelectItem>
                    <SelectItem value="2">Banco Nación - CA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {actionDialog.action === 'rechazar' && (
              <div className="grid gap-2">
                <Label>Motivo de Rechazo</Label>
                <Input placeholder="Ej: Fondos insuficientes" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ open: false, action: '', cheque: null })}>
              Cancelar
            </Button>
            <Button onClick={() => {
              if (actionDialog.cheque) {
                actionMutation.mutate({
                  id: actionDialog.cheque.id,
                  accion: actionDialog.action,
                  data: actionDialog.action === 'depositar' ? { bankAccountId: 1 } : { motivoRechazo: 'Fondos insuficientes' }
                });
              }
            }}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
