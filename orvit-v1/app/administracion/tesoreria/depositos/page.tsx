'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus,
  RefreshCcw,
  ArrowRight,
  Wallet,
  Building2,
  FileCheck2,
  X,
  Banknote,
  FileText,
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useViewMode } from '@/contexts/ViewModeContext';
import { useCompany } from '@/contexts/CompanyContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { v4 as uuidv4 } from 'uuid';

interface CashDeposit {
  id: number;
  numero: string;
  fecha: string;
  estado: 'PENDIENTE' | 'CONFIRMADO' | 'RECHAZADO';
  efectivo: number;
  cheques: number;
  total: number;
  numeroComprobante: string | null;
  cashAccount: { id: number; nombre: string };
  bankAccount: { id: number; nombre: string; banco: string };
}

interface CashAccount {
  id: number;
  nombre: string;
  saldoT1: number;
}

interface BankAccount {
  id: number;
  nombre: string;
  banco: string;
}

interface Cheque {
  id: number;
  numero: string;
  banco: string;
  monto: number;
  fechaVencimiento: string;
  estado: string;
}

interface DepositsResponse {
  data: CashDeposit[];
  pagination: { total: number; limit: number; offset: number };
}

async function fetchDeposits(
  companyId: number,
  viewMode: string,
  filters: { estado?: string; limit: number; offset: number }
): Promise<DepositsResponse> {
  const params = new URLSearchParams({
    companyId: companyId.toString(),
    viewMode,
    limit: filters.limit.toString(),
    offset: filters.offset.toString(),
  });
  if (filters.estado) params.append('estado', filters.estado);

  const res = await fetch(`/api/tesoreria/depositos?${params}`);
  if (!res.ok) throw new Error('Error al obtener depósitos');
  return res.json();
}

async function fetchCajas(): Promise<{ data: CashAccount[] }> {
  const res = await fetch('/api/tesoreria/cajas');
  if (!res.ok) throw new Error('Error al obtener cajas');
  return res.json();
}

async function fetchBancos(): Promise<{ data: BankAccount[] }> {
  const res = await fetch('/api/tesoreria/bancos');
  if (!res.ok) throw new Error('Error al obtener bancos');
  return res.json();
}

async function fetchChequesEnCartera(companyId: number): Promise<{ data: Cheque[] }> {
  const res = await fetch(`/api/tesoreria/cheques?companyId=${companyId}&estado=CARTERA`);
  if (!res.ok) throw new Error('Error al obtener cheques');
  return res.json();
}

async function createDeposit(data: {
  cashAccountId: number;
  bankAccountId: number;
  fecha: string;
  efectivo: number;
  chequeIds: number[];
  numeroComprobante?: string;
  docType: 'T1' | 'T2';
}) {
  const res = await fetch('/api/tesoreria/depositos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': uuidv4(),
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Error al crear depósito');
  }
  return res.json();
}

export default function DepositosPage() {
  const queryClient = useQueryClient();
  const { viewMode } = useViewMode();
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id || 0;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filters, setFilters] = useState({
    estado: '',
    limit: 50,
    offset: 0,
  });

  const [formData, setFormData] = useState({
    cashAccountId: 0,
    bankAccountId: 0,
    fecha: format(new Date(), 'yyyy-MM-dd'),
    efectivo: 0,
    chequeIds: [] as number[],
    numeroComprobante: '',
    docType: 'T1' as 'T1' | 'T2',
  });

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['tesoreria', 'depositos', companyId, viewMode, filters],
    queryFn: () => fetchDeposits(companyId, viewMode, filters),
    enabled: !!companyId,
  });

  const { data: cajasData } = useQuery({
    queryKey: ['tesoreria', 'cajas'],
    queryFn: fetchCajas,
  });

  const { data: bancosData } = useQuery({
    queryKey: ['tesoreria', 'bancos'],
    queryFn: fetchBancos,
  });

  const { data: chequesData } = useQuery({
    queryKey: ['tesoreria', 'cheques-cartera', companyId],
    queryFn: () => fetchChequesEnCartera(companyId),
    enabled: !!companyId && isDialogOpen,
  });

  const createMutation = useMutation({
    mutationFn: createDeposit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tesoreria', 'depositos'] });
      queryClient.invalidateQueries({ queryKey: ['tesoreria', 'cajas'] });
      queryClient.invalidateQueries({ queryKey: ['tesoreria', 'bancos'] });
      queryClient.invalidateQueries({ queryKey: ['tesoreria', 'cheques-cartera'] });
      setIsDialogOpen(false);
      resetForm();
      toast.success('Depósito creado exitosamente');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      cashAccountId: 0,
      bankAccountId: 0,
      fecha: format(new Date(), 'yyyy-MM-dd'),
      efectivo: 0,
      chequeIds: [],
      numeroComprobante: '',
      docType: 'T1',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.cashAccountId || !formData.bankAccountId) {
      toast.error('Seleccione caja y banco');
      return;
    }
    if (formData.efectivo <= 0 && formData.chequeIds.length === 0) {
      toast.error('Ingrese monto en efectivo o seleccione cheques');
      return;
    }
    createMutation.mutate(formData);
  };

  const toggleCheque = (chequeId: number) => {
    setFormData((prev) => ({
      ...prev,
      chequeIds: prev.chequeIds.includes(chequeId)
        ? prev.chequeIds.filter((id) => id !== chequeId)
        : [...prev.chequeIds, chequeId],
    }));
  };

  const selectedChequesTotal = (chequesData?.data || [])
    .filter((c) => formData.chequeIds.includes(c.id))
    .reduce((sum, c) => sum + c.monto, 0);

  const depositTotal = formData.efectivo + selectedChequesTotal;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border">
          <div className="px-4 md:px-6 py-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
        </div>
        <div className="px-4 md:px-6 pb-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border">
          <div className="px-4 md:px-6 py-3">
            <h1 className="text-xl font-semibold text-foreground">Depósitos</h1>
          </div>
        </div>
        <div className="px-4 md:px-6 pb-6">
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">Error al cargar depósitos</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const deposits = data?.data || [];
  const pagination = data?.pagination || { total: 0, limit: 50, offset: 0 };
  const cajas = cajasData?.data || [];
  const bancos = bancosData?.data || [];
  const chequesEnCartera = chequesData?.data || [];

  const totalDepositos = deposits.reduce((sum, d) => sum + d.total, 0);
  const pendientes = deposits.filter((d) => d.estado === 'PENDIENTE').length;

  return (
    <div className="w-full p-0">
      {/* Header */}
      <div className="px-4 md:px-6 pt-4 pb-3 border-b border-border">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Depósitos</h1>
            <p className="text-sm text-muted-foreground mt-1">Depósitos de caja a banco</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className={cn(
                "inline-flex items-center border border-border rounded-md p-0.5 bg-muted/40 h-7",
                "px-2 text-[11px] font-normal gap-1.5",
                "hover:bg-muted disabled:opacity-50",
                isFetching && "bg-background shadow-sm"
              )}
            >
              <RefreshCcw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
              Actualizar
            </button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-7 text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Nuevo Depósito
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <form onSubmit={handleSubmit}>
                  <DialogHeader>
                    <DialogTitle>Nuevo Depósito</DialogTitle>
                    <DialogDescription>
                      Registrar depósito de efectivo y/o cheques de caja a banco
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    {/* Cuentas */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Desde Caja</Label>
                        <Select
                          value={formData.cashAccountId.toString()}
                          onValueChange={(value) =>
                            setFormData({ ...formData, cashAccountId: parseInt(value) })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar caja" />
                          </SelectTrigger>
                          <SelectContent>
                            {cajas.map((caja) => (
                              <SelectItem key={caja.id} value={caja.id.toString()}>
                                <div className="flex items-center gap-2">
                                  <Wallet className="h-3.5 w-3.5" />
                                  {caja.nombre}
                                  <span className="text-muted-foreground">
                                    ({formatCurrency(caja.saldoT1)})
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label>A Banco</Label>
                        <Select
                          value={formData.bankAccountId.toString()}
                          onValueChange={(value) =>
                            setFormData({ ...formData, bankAccountId: parseInt(value) })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar banco" />
                          </SelectTrigger>
                          <SelectContent>
                            {bancos.map((banco) => (
                              <SelectItem key={banco.id} value={banco.id.toString()}>
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-3.5 w-3.5" />
                                  {banco.nombre} - {banco.banco}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Flow indicator */}
                    <div className="flex items-center justify-center gap-4 py-2 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Caja</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-primary" />
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Banco</span>
                      </div>
                    </div>

                    {/* Fecha y comprobante */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="fecha">Fecha</Label>
                        <Input
                          id="fecha"
                          type="date"
                          value={formData.fecha}
                          onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="comprobante">N° Comprobante</Label>
                        <Input
                          id="comprobante"
                          placeholder="Número de boleta"
                          value={formData.numeroComprobante}
                          onChange={(e) =>
                            setFormData({ ...formData, numeroComprobante: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    {/* Efectivo */}
                    <div className="grid gap-2">
                      <Label htmlFor="efectivo">Efectivo a depositar</Label>
                      <div className="relative">
                        <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="efectivo"
                          type="number"
                          step="0.01"
                          min="0"
                          className="pl-9"
                          placeholder="0.00"
                          value={formData.efectivo || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, efectivo: parseFloat(e.target.value) || 0 })
                          }
                        />
                      </div>
                    </div>

                    {/* Cheques */}
                    {chequesEnCartera.length > 0 && (
                      <div className="grid gap-2">
                        <Label>Cheques a depositar</Label>
                        <div className="border rounded-lg max-h-[200px] overflow-y-auto">
                          {chequesEnCartera.map((cheque) => (
                            <div
                              key={cheque.id}
                              className={cn(
                                "flex items-center gap-3 p-3 border-b last:border-b-0",
                                "hover:bg-muted/30 cursor-pointer",
                                formData.chequeIds.includes(cheque.id) && "bg-primary/5"
                              )}
                              onClick={() => toggleCheque(cheque.id)}
                            >
                              <Checkbox
                                checked={formData.chequeIds.includes(cheque.id)}
                                onCheckedChange={() => toggleCheque(cheque.id)}
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">#{cheque.numero}</span>
                                  <span className="text-xs text-muted-foreground">{cheque.banco}</span>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Vence: {format(new Date(cheque.fechaVencimiento), 'dd/MM/yy', { locale: es })}
                                </div>
                              </div>
                              <span className="font-mono text-sm">{formatCurrency(cheque.monto)}</span>
                            </div>
                          ))}
                        </div>
                        {formData.chequeIds.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {formData.chequeIds.length} cheque(s) seleccionado(s): {formatCurrency(selectedChequesTotal)}
                          </p>
                        )}
                      </div>
                    )}

                    {/* DocType */}
                    <div className="grid gap-2">
                      <Label>Tipo documento</Label>
                      <Select
                        value={formData.docType}
                        onValueChange={(value: 'T1' | 'T2') =>
                          setFormData({ ...formData, docType: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="T1">T1 - Formal</SelectItem>
                          <SelectItem value="T2">T2 - Informal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Total */}
                    <div className="p-4 bg-primary/5 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Total a depositar</span>
                        <span className="text-2xl font-bold text-primary">
                          {formatCurrency(depositTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsDialogOpen(false);
                        resetForm();
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending || depositTotal <= 0}>
                      {createMutation.isPending ? 'Creando...' : 'Crear Depósito'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Totales */}
      <div className="px-4 md:px-6 pt-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Total Depositado</p>
                  <p className="text-2xl font-bold mt-1">{formatCurrency(totalDepositos)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{deposits.length} depósitos</p>
                </div>
                <div className="p-2 rounded-lg bg-muted">
                  <Banknote className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Pendientes</p>
                  <p className="text-2xl font-bold mt-1 text-yellow-600">{pendientes}</p>
                  <p className="text-xs text-muted-foreground mt-1">Por confirmar</p>
                </div>
                <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                  <FileCheck2 className="h-4 w-4 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Cheques en Cartera</p>
                  <p className="text-2xl font-bold mt-1">{chequesEnCartera.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Disponibles para depósito</p>
                </div>
                <div className="p-2 rounded-lg bg-muted">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Cajas Disponibles</p>
                  <p className="text-2xl font-bold mt-1 text-primary">{cajas.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">{bancos.length} bancos</p>
                </div>
                <div className="p-2 rounded-lg bg-primary/10">
                  <Wallet className="h-4 w-4 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Lista */}
      <div className="px-4 md:px-6 pt-4 pb-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <CardTitle className="text-sm font-medium">Listado de Depósitos</CardTitle>
                <CardDescription className="text-xs">Historial de depósitos realizados</CardDescription>
              </div>
              <Select
                value={filters.estado}
                onValueChange={(value) => setFilters({ ...filters, estado: value, offset: 0 })}
              >
                <SelectTrigger className="w-[150px] h-8 text-xs">
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="CONFIRMADO">Confirmados</SelectItem>
                  <SelectItem value="PENDIENTE">Pendientes</SelectItem>
                  <SelectItem value="RECHAZADO">Rechazados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {deposits.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No hay depósitos registrados.
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs">N°</TableHead>
                      <TableHead className="text-xs">Fecha</TableHead>
                      <TableHead className="text-xs">Desde</TableHead>
                      <TableHead className="text-xs">Hacia</TableHead>
                      <TableHead className="text-xs text-right">Efectivo</TableHead>
                      <TableHead className="text-xs text-right">Cheques</TableHead>
                      <TableHead className="text-xs text-right">Total</TableHead>
                      <TableHead className="text-xs">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deposits.map((dep) => (
                      <TableRow key={dep.id} className="hover:bg-muted/30">
                        <TableCell className="text-sm font-medium">{dep.numero}</TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(dep.fecha), 'dd/MM/yy', { locale: es })}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="flex items-center gap-1.5">
                            <Wallet className="h-3 w-3 text-muted-foreground" />
                            {dep.cashAccount.nombre}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            {dep.bankAccount.nombre}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-right font-mono">
                          {dep.efectivo > 0 ? formatCurrency(dep.efectivo) : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-right font-mono">
                          {dep.cheques > 0 ? formatCurrency(dep.cheques) : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-right font-mono font-semibold">
                          {formatCurrency(dep.total)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              dep.estado === 'CONFIRMADO' ? 'default' :
                              dep.estado === 'PENDIENTE' ? 'secondary' : 'destructive'
                            }
                            className="text-xs"
                          >
                            {dep.estado}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {pagination.total > filters.limit && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-muted-foreground">
                  Mostrando {filters.offset + 1}-{Math.min(filters.offset + filters.limit, pagination.total)} de {pagination.total}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={filters.offset === 0}
                    onClick={() => setFilters({ ...filters, offset: Math.max(0, filters.offset - filters.limit) })}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={filters.offset + filters.limit >= pagination.total}
                    onClick={() => setFilters({ ...filters, offset: filters.offset + filters.limit })}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
