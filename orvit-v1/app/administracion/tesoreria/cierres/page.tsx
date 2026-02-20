'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
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
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCcw,
  Wallet,
  Calculator,
  FileCheck2,
  XCircle,
  Banknote,
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useViewMode } from '@/contexts/ViewModeContext';
import { useCompany } from '@/contexts/CompanyContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface CashClosing {
  id: number;
  fecha: string;
  estado: 'PENDIENTE' | 'APROBADO' | 'CON_DIFERENCIA_APROBADA' | 'RECHAZADO';
  saldoSistemaEfectivo: number;
  saldoSistemaCheques: number;
  saldoSistemaTotal: number;
  arqueoEfectivo: number;
  arqueoCheques: number;
  arqueoTotal: number;
  diferencia: number;
  diferenciaNotas: string | null;
  desglose: Record<string, number> | null;
  cashAccount: { id: number; nombre: string };
}

interface CashAccount {
  id: number;
  nombre: string;
  saldoT1: number;
}

interface ClosingsResponse {
  data: CashClosing[];
  pagination: { total: number; limit: number; offset: number };
}

interface PreviewData {
  cashAccountId: number;
  fecha: string;
  saldoSistemaEfectivo: number;
  saldoSistemaCheques: number;
  saldoSistemaTotal: number;
}

async function fetchClosings(
  companyId: number,
  viewMode: string,
  filters: { estado?: string; limit: number; offset: number }
): Promise<ClosingsResponse> {
  const params = new URLSearchParams({
    companyId: companyId.toString(),
    viewMode,
    limit: filters.limit.toString(),
    offset: filters.offset.toString(),
  });
  if (filters.estado) params.append('estado', filters.estado);

  const res = await fetch(`/api/tesoreria/cierres?${params}`);
  if (!res.ok) throw new Error('Error al obtener cierres');
  return res.json();
}

async function fetchCajas(): Promise<{ data: CashAccount[] }> {
  const res = await fetch('/api/tesoreria/cajas');
  if (!res.ok) throw new Error('Error al obtener cajas');
  return res.json();
}

async function fetchPreview(
  companyId: number,
  cashAccountId: number,
  fecha: string,
  viewMode: string
): Promise<PreviewData> {
  const params = new URLSearchParams({
    companyId: companyId.toString(),
    cashAccountId: cashAccountId.toString(),
    fecha,
    viewMode,
    action: 'preview',
  });

  const res = await fetch(`/api/tesoreria/cierres?${params}`);
  if (!res.ok) throw new Error('Error al obtener saldo');
  return res.json();
}

async function createClosing(data: {
  cashAccountId: number;
  fecha: string;
  arqueoEfectivo: number;
  arqueoCheques: number;
  desglose?: Record<string, number>;
  diferenciaNotas?: string;
  docType: 'T1' | 'T2';
}) {
  const res = await fetch('/api/tesoreria/cierres', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Error al crear cierre');
  }
  return res.json();
}

// Argentine bill denominations
const BILLETES = [
  { valor: 100000, label: '100.000' },
  { valor: 50000, label: '50.000' },
  { valor: 20000, label: '20.000' },
  { valor: 10000, label: '10.000' },
  { valor: 5000, label: '5.000' },
  { valor: 2000, label: '2.000' },
  { valor: 1000, label: '1.000' },
  { valor: 500, label: '500' },
  { valor: 200, label: '200' },
  { valor: 100, label: '100' },
  { valor: 50, label: '50' },
  { valor: 20, label: '20' },
  { valor: 10, label: '10' },
];

export default function CierresPage() {
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
    fecha: format(new Date(), 'yyyy-MM-dd'),
    arqueoEfectivo: 0,
    arqueoCheques: 0,
    desglose: {} as Record<string, number>,
    diferenciaNotas: '',
    docType: 'T1' as 'T1' | 'T2',
  });

  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [showDesglose, setShowDesglose] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['tesoreria', 'cierres', companyId, viewMode, filters],
    queryFn: () => fetchClosings(companyId, viewMode, filters),
    enabled: !!companyId,
  });

  const { data: cajasData } = useQuery({
    queryKey: ['tesoreria', 'cajas'],
    queryFn: fetchCajas,
  });

  const createMutation = useMutation({
    mutationFn: createClosing,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tesoreria', 'cierres'] });
      setIsDialogOpen(false);
      resetForm();
      if (result.diferencia === 0) {
        toast.success('Cierre completado sin diferencias');
      } else {
        toast.warning(`Cierre creado con diferencia de ${formatCurrency(result.diferencia)}`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      cashAccountId: 0,
      fecha: format(new Date(), 'yyyy-MM-dd'),
      arqueoEfectivo: 0,
      arqueoCheques: 0,
      desglose: {},
      diferenciaNotas: '',
      docType: 'T1',
    });
    setPreview(null);
    setShowDesglose(false);
  };

  const loadPreview = async () => {
    if (!formData.cashAccountId || !formData.fecha) return;
    try {
      const previewData = await fetchPreview(companyId, formData.cashAccountId, formData.fecha, viewMode);
      setPreview(previewData);
    } catch {
      toast.error('Error al obtener saldo del sistema');
    }
  };

  const updateDesglose = (valor: string, cantidad: number) => {
    const newDesglose = { ...formData.desglose, [valor]: cantidad };
    // Calculate total from desglose
    const totalFromDesglose = Object.entries(newDesglose).reduce(
      (sum, [val, cant]) => sum + parseInt(val) * cant,
      0
    );
    setFormData({
      ...formData,
      desglose: newDesglose,
      arqueoEfectivo: totalFromDesglose,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.cashAccountId) {
      toast.error('Seleccione una caja');
      return;
    }
    createMutation.mutate(formData);
  };

  const diferencia = preview
    ? (formData.arqueoEfectivo + formData.arqueoCheques) - Number(preview.saldoSistemaTotal)
    : 0;

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
            <h1 className="text-xl font-semibold text-foreground">Cierres de Caja</h1>
          </div>
        </div>
        <div className="px-4 md:px-6 pb-6">
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">Error al cargar cierres</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const closings = data?.data || [];
  const pagination = data?.pagination || { total: 0, limit: 50, offset: 0 };
  const cajas = cajasData?.data || [];

  const aprobados = closings.filter((c) => c.estado === 'APROBADO').length;
  const conDiferencia = closings.filter((c) => c.estado === 'CON_DIFERENCIA_APROBADA').length;
  const pendientes = closings.filter((c) => c.estado === 'PENDIENTE').length;

  return (
    <div className="w-full p-0">
      {/* Header */}
      <div className="px-4 md:px-6 pt-4 pb-3 border-b border-border">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Cierres de Caja</h1>
            <p className="text-sm text-muted-foreground mt-1">Arqueo y cierre diario de cajas</p>
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
                  Nuevo Cierre
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <form onSubmit={handleSubmit}>
                  <DialogHeader>
                    <DialogTitle>Cierre de Caja</DialogTitle>
                    <DialogDescription>
                      Realizar arqueo y cierre de caja
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    {/* Caja y Fecha */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Caja</Label>
                        <Select
                          value={formData.cashAccountId.toString()}
                          onValueChange={(value) => {
                            setFormData({ ...formData, cashAccountId: parseInt(value) });
                            setPreview(null);
                          }}
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
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="fecha">Fecha de cierre</Label>
                        <Input
                          id="fecha"
                          type="date"
                          value={formData.fecha}
                          onChange={(e) => {
                            setFormData({ ...formData, fecha: e.target.value });
                            setPreview(null);
                          }}
                          required
                        />
                      </div>
                    </div>

                    {/* Get system balance button */}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={loadPreview}
                      disabled={!formData.cashAccountId || !formData.fecha}
                    >
                      <Calculator className="h-4 w-4 mr-2" />
                      Obtener saldo del sistema
                    </Button>

                    {/* System balance */}
                    {preview && (
                      <Card className="bg-muted/30">
                        <CardContent className="p-4">
                          <p className="text-xs font-medium text-muted-foreground mb-3">Saldo según sistema</p>
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Efectivo</p>
                              <p className="text-lg font-bold">{formatCurrency(preview.saldoSistemaEfectivo)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Cheques</p>
                              <p className="text-lg font-bold">{formatCurrency(preview.saldoSistemaCheques)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Total</p>
                              <p className="text-lg font-bold text-primary">{formatCurrency(preview.saldoSistemaTotal)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Arqueo */}
                    {preview && (
                      <>
                        <div className="border-t pt-4">
                          <Label className="text-sm font-medium mb-3 block">Arqueo Físico</Label>

                          {/* Toggle desglose */}
                          <div className="flex items-center gap-2 mb-3">
                            <Button
                              type="button"
                              variant={showDesglose ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setShowDesglose(!showDesglose)}
                            >
                              <Banknote className="h-3.5 w-3.5 mr-1" />
                              {showDesglose ? 'Ocultar desglose' : 'Contar por billetes'}
                            </Button>
                          </div>

                          {/* Desglose por billetes */}
                          {showDesglose && (
                            <div className="grid grid-cols-4 gap-2 mb-4 p-3 bg-muted/30 rounded-lg">
                              {BILLETES.map((billete) => (
                                <div key={billete.valor} className="flex items-center gap-2">
                                  <span className="text-xs w-14">${billete.label}</span>
                                  <Input
                                    type="number"
                                    min="0"
                                    className="h-7 w-16 text-xs"
                                    placeholder="0"
                                    value={formData.desglose[billete.valor.toString()] || ''}
                                    onChange={(e) =>
                                      updateDesglose(billete.valor.toString(), parseInt(e.target.value) || 0)
                                    }
                                  />
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                              <Label htmlFor="arqueoEfectivo">Efectivo contado</Label>
                              <Input
                                id="arqueoEfectivo"
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.arqueoEfectivo || ''}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    arqueoEfectivo: parseFloat(e.target.value) || 0,
                                  })
                                }
                                disabled={showDesglose}
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="arqueoCheques">Cheques contados</Label>
                              <Input
                                id="arqueoCheques"
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.arqueoCheques || ''}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    arqueoCheques: parseFloat(e.target.value) || 0,
                                  })
                                }
                              />
                            </div>
                          </div>
                        </div>

                        {/* Difference */}
                        <Card className={cn(
                          "border-2",
                          diferencia === 0 ? "border-success-muted bg-success-muted" :
                          Math.abs(diferencia) < 100 ? "border-warning-muted bg-warning-muted" :
                          "border-destructive/30 bg-destructive/10"
                        )}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {diferencia === 0 ? (
                                  <CheckCircle2 className="h-5 w-5 text-success" />
                                ) : (
                                  <AlertCircle className="h-5 w-5 text-warning-muted-foreground" />
                                )}
                                <span className="font-medium">Diferencia</span>
                              </div>
                              <span className={cn(
                                "text-2xl font-bold",
                                diferencia === 0 ? "text-success" :
                                diferencia > 0 ? "text-info-muted-foreground" : "text-destructive"
                              )}>
                                {diferencia > 0 ? '+' : ''}{formatCurrency(diferencia)}
                              </span>
                            </div>
                            {diferencia !== 0 && (
                              <p className="text-xs text-muted-foreground mt-2">
                                {diferencia > 0 ? 'Sobrante de caja' : 'Faltante de caja'}
                              </p>
                            )}
                          </CardContent>
                        </Card>

                        {/* Notes for difference */}
                        {diferencia !== 0 && (
                          <div className="grid gap-2">
                            <Label htmlFor="notas">Notas sobre la diferencia</Label>
                            <Textarea
                              id="notas"
                              placeholder="Explique el motivo de la diferencia..."
                              value={formData.diferenciaNotas}
                              onChange={(e) =>
                                setFormData({ ...formData, diferenciaNotas: e.target.value })
                              }
                              rows={3}
                            />
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
                      </>
                    )}
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
                    <Button type="submit" disabled={createMutation.isPending || !preview}>
                      {createMutation.isPending ? 'Guardando...' : 'Guardar Cierre'}
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
                  <p className="text-xs font-medium text-muted-foreground">Aprobados</p>
                  <p className="text-2xl font-bold mt-1 text-success">{aprobados}</p>
                  <p className="text-xs text-muted-foreground mt-1">Sin diferencias</p>
                </div>
                <div className="p-2 rounded-lg bg-success-muted">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Con Diferencia</p>
                  <p className="text-2xl font-bold mt-1 text-warning-muted-foreground">{conDiferencia}</p>
                  <p className="text-xs text-muted-foreground mt-1">Diferencias aprobadas</p>
                </div>
                <div className="p-2 rounded-lg bg-warning-muted">
                  <AlertCircle className="h-4 w-4 text-warning-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Pendientes</p>
                  <p className="text-2xl font-bold mt-1 text-info-muted-foreground">{pendientes}</p>
                  <p className="text-xs text-muted-foreground mt-1">Por aprobar</p>
                </div>
                <div className="p-2 rounded-lg bg-info-muted">
                  <Clock className="h-4 w-4 text-info-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Total Cierres</p>
                  <p className="text-2xl font-bold mt-1 text-primary">{closings.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">En el período</p>
                </div>
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileCheck2 className="h-4 w-4 text-primary" />
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
                <CardTitle className="text-sm font-medium">Historial de Cierres</CardTitle>
                <CardDescription className="text-xs">Cierres de caja realizados</CardDescription>
              </div>
              <Select
                value={filters.estado}
                onValueChange={(value) => setFilters({ ...filters, estado: value, offset: 0 })}
              >
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="APROBADO">Aprobados</SelectItem>
                  <SelectItem value="CON_DIFERENCIA_APROBADA">Con diferencia</SelectItem>
                  <SelectItem value="PENDIENTE">Pendientes</SelectItem>
                  <SelectItem value="RECHAZADO">Rechazados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {closings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No hay cierres de caja registrados.
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs">Fecha</TableHead>
                      <TableHead className="text-xs">Caja</TableHead>
                      <TableHead className="text-xs text-right">Sistema</TableHead>
                      <TableHead className="text-xs text-right">Arqueo</TableHead>
                      <TableHead className="text-xs text-right">Diferencia</TableHead>
                      <TableHead className="text-xs">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {closings.map((closing) => (
                      <TableRow key={closing.id} className="hover:bg-muted/30">
                        <TableCell className="text-sm">
                          {format(new Date(closing.fecha), 'dd/MM/yy', { locale: es })}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="flex items-center gap-1.5">
                            <Wallet className="h-3 w-3 text-muted-foreground" />
                            {closing.cashAccount.nombre}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-right font-mono">
                          {formatCurrency(closing.saldoSistemaTotal)}
                        </TableCell>
                        <TableCell className="text-sm text-right font-mono">
                          {formatCurrency(closing.arqueoTotal)}
                        </TableCell>
                        <TableCell className={cn(
                          "text-sm text-right font-mono",
                          closing.diferencia === 0 ? "text-success" :
                          closing.diferencia > 0 ? "text-info-muted-foreground" : "text-destructive"
                        )}>
                          {closing.diferencia > 0 ? '+' : ''}{formatCurrency(closing.diferencia)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              closing.estado === 'APROBADO' ? 'default' :
                              closing.estado === 'CON_DIFERENCIA_APROBADA' ? 'secondary' :
                              closing.estado === 'PENDIENTE' ? 'outline' : 'destructive'
                            }
                            className="text-xs"
                          >
                            {closing.estado === 'CON_DIFERENCIA_APROBADA' ? 'CON DIF.' : closing.estado}
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
