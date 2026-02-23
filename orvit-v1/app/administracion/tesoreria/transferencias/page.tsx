'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDate } from '@/lib/date-utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus, ArrowRightLeft, RefreshCw, Wallet, Building2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { useViewMode } from '@/contexts/ViewModeContext';

interface CashAccount {
  id: number;
  codigo: string;
  nombre: string;
  moneda: string;
  saldoT1: number;
}

interface BankAccount {
  id: number;
  codigo: string;
  nombre: string;
  banco: string;
  moneda: string;
  saldoContable: number;
}

interface Transfer {
  id: number;
  numero: string;
  fecha: string;
  origenCaja?: { codigo: string; nombre: string } | null;
  origenBanco?: { codigo: string; nombre: string; banco: string } | null;
  destinoCaja?: { codigo: string; nombre: string } | null;
  destinoBanco?: { codigo: string; nombre: string; banco: string } | null;
  importe: number;
  moneda: string;
  estado: string;
  docType: string;
}

interface TransferResponse {
  data: Transfer[];
  totalMes: { cantidad: number; total: number };
  _m: string;
}

async function fetchCajas(): Promise<{ data: CashAccount[]; _m: string }> {
  const res = await fetch('/api/tesoreria/cajas');
  if (!res.ok) throw new Error('Error');
  return res.json();
}

async function fetchBancos(): Promise<{ data: BankAccount[] }> {
  const res = await fetch('/api/tesoreria/bancos');
  if (!res.ok) throw new Error('Error');
  return res.json();
}

async function fetchTransferencias(): Promise<TransferResponse> {
  const res = await fetch('/api/tesoreria/transferencias');
  if (!res.ok) throw new Error('Error');
  return res.json();
}

async function createTransfer(data: any) {
  const res = await fetch('/api/tesoreria/transferencias', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Error al crear transferencia');
  }
  return res.json();
}

export default function TransferenciasPage() {
  const queryClient = useQueryClient();
  const { mode } = useViewMode();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [tipoOrigen, setTipoOrigen] = useState<'caja' | 'banco'>('caja');
  const [tipoDestino, setTipoDestino] = useState<'caja' | 'banco'>('banco');
  const [origenId, setOrigenId] = useState('');
  const [destinoId, setDestinoId] = useState('');
  const [importe, setImporte] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [esT2, setEsT2] = useState(false);

  const isExtendedMode = mode === 'E';

  const { data: cajasData, isLoading: loadingCajas } = useQuery({
    queryKey: ['tesoreria', 'cajas'],
    queryFn: fetchCajas,
  });

  const { data: bancosData, isLoading: loadingBancos } = useQuery({
    queryKey: ['tesoreria', 'bancos'],
    queryFn: fetchBancos,
  });

  const { data: transferData, isLoading: loadingTransfers } = useQuery({
    queryKey: ['tesoreria', 'transferencias'],
    queryFn: fetchTransferencias,
  });

  const createMutation = useMutation({
    mutationFn: createTransfer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tesoreria'] });
      setIsDialogOpen(false);
      resetForm();
      toast.success('Transferencia realizada exitosamente');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setTipoOrigen('caja');
    setTipoDestino('banco');
    setOrigenId('');
    setDestinoId('');
    setImporte('');
    setDescripcion('');
    setEsT2(false);
  };

  const cajas = cajasData?.data || [];
  const bancos = bancosData?.data || [];
  const transferencias = transferData?.data || [];
  const totalMes = transferData?.totalMes || { cantidad: 0, total: 0 };

  const isLoading = loadingCajas || loadingBancos || loadingTransfers;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      tipoOrigen,
      origenId,
      tipoDestino,
      destinoId,
      importe,
      descripcion,
      docType: esT2 ? 'T2' : 'T1',
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-4 w-24" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-32" /></CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transferencias Internas</h1>
          <p className="text-muted-foreground">Movimientos entre cajas y cuentas bancarias</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['tesoreria'] })}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Transferencia
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Nueva Transferencia Interna</DialogTitle>
                  <DialogDescription>
                    Transfiere fondos entre cajas y cuentas bancarias
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  {/* Origen */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Origen</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={tipoOrigen} onValueChange={(v) => { setTipoOrigen(v as 'caja' | 'banco'); setOrigenId(''); }}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="caja">
                            <div className="flex items-center gap-2">
                              <Wallet className="h-4 w-4" />
                              Caja
                            </div>
                          </SelectItem>
                          <SelectItem value="banco">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4" />
                              Banco
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={origenId} onValueChange={setOrigenId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          {tipoOrigen === 'caja' ? (
                            cajas.map((caja) => (
                              <SelectItem key={caja.id} value={String(caja.id)}>
                                {caja.nombre} ({formatCurrency(caja.saldoT1)})
                              </SelectItem>
                            ))
                          ) : (
                            bancos.map((banco) => (
                              <SelectItem key={banco.id} value={String(banco.id)}>
                                {banco.nombre} ({formatCurrency(banco.saldoContable)})
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Flecha */}
                  <div className="flex justify-center">
                    <ArrowRightLeft className="h-6 w-6 text-muted-foreground rotate-90" />
                  </div>

                  {/* Destino */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Destino</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={tipoDestino} onValueChange={(v) => { setTipoDestino(v as 'caja' | 'banco'); setDestinoId(''); }}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="caja">
                            <div className="flex items-center gap-2">
                              <Wallet className="h-4 w-4" />
                              Caja
                            </div>
                          </SelectItem>
                          <SelectItem value="banco">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4" />
                              Banco
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={destinoId} onValueChange={setDestinoId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          {tipoDestino === 'caja' ? (
                            cajas.map((caja) => (
                              <SelectItem key={caja.id} value={String(caja.id)}>
                                {caja.nombre}
                              </SelectItem>
                            ))
                          ) : (
                            bancos.map((banco) => (
                              <SelectItem key={banco.id} value={String(banco.id)}>
                                {banco.nombre}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Importe */}
                  <div className="grid gap-2">
                    <Label htmlFor="importe">Importe</Label>
                    <Input
                      id="importe"
                      type="number"
                      placeholder="0.00"
                      value={importe}
                      onChange={(e) => setImporte(e.target.value)}
                      required
                    />
                  </div>

                  {/* Descripción */}
                  <div className="grid gap-2">
                    <Label htmlFor="descripcion">Descripción (opcional)</Label>
                    <Input
                      id="descripcion"
                      placeholder="Motivo de la transferencia"
                      value={descripcion}
                      onChange={(e) => setDescripcion(e.target.value)}
                    />
                  </div>

                  {/* T2 Switch - solo visible en modo Extended */}
                  {isExtendedMode && (
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="space-y-0.5">
                        <Label>Transferencia T2</Label>
                        <p className="text-xs text-muted-foreground">
                          Marcar si es una transferencia interna
                        </p>
                      </div>
                      <Switch
                        checked={esT2}
                        onCheckedChange={setEsT2}
                      />
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Procesando...' : 'Realizar Transferencia'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Resumen Rápido */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total en Cajas</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(cajas.reduce((sum, c) => sum + c.saldoT1, 0))}
            </div>
            <p className="text-xs text-muted-foreground">{cajas.length} cajas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total en Bancos</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(bancos.reduce((sum, b) => sum + b.saldoContable, 0))}
            </div>
            <p className="text-xs text-muted-foreground">{bancos.length} cuentas</p>
          </CardContent>
        </Card>

        <Card className="bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Transferencias del Mes</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{totalMes.cantidad}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(totalMes.total)} movido
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Historial de Transferencias */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Transferencias</CardTitle>
          <CardDescription>Últimas transferencias realizadas</CardDescription>
        </CardHeader>
        <CardContent>
          {transferencias.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay transferencias registradas.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                  <TableHead>Estado</TableHead>
                  {isExtendedMode && <TableHead>Tipo</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {transferencias.map((transfer) => (
                  <TableRow key={transfer.id}>
                    <TableCell className="font-medium">{transfer.numero}</TableCell>
                    <TableCell>{formatDate(transfer.fecha)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {transfer.origenCaja ? (
                          <>
                            <Wallet className="h-4 w-4 text-muted-foreground" />
                            <span>{transfer.origenCaja.nombre}</span>
                          </>
                        ) : transfer.origenBanco ? (
                          <>
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span>{transfer.origenBanco.nombre}</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {transfer.destinoCaja ? (
                          <>
                            <Wallet className="h-4 w-4 text-muted-foreground" />
                            <span>{transfer.destinoCaja.nombre}</span>
                          </>
                        ) : transfer.destinoBanco ? (
                          <>
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span>{transfer.destinoBanco.nombre}</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(Number(transfer.importe), transfer.moneda)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={transfer.estado === 'COMPLETADA' ? 'default' : 'secondary'}>
                        {transfer.estado}
                      </Badge>
                    </TableCell>
                    {isExtendedMode && (
                      <TableCell>
                        {transfer.docType === 'T2' ? (
                          <Badge variant="outline" className="text-warning-muted-foreground border-warning-muted">T2</Badge>
                        ) : (
                          <Badge variant="outline">T1</Badge>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
