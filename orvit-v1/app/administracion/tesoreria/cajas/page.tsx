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
import { Plus, Wallet, ArrowUpCircle, ArrowDownCircle, RefreshCcw, Search, X } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useViewMode } from '@/contexts/ViewModeContext';

interface CashAccount {
  id: number;
  codigo: string;
  nombre: string;
  moneda: string;
  saldoT1: number;
  saldoTotal: number | null;
  isActive: boolean;
  esDefault: boolean;
}

async function fetchCajas(): Promise<{ data: CashAccount[]; _m: string }> {
  const res = await fetch('/api/tesoreria/cajas');
  if (!res.ok) throw new Error('Error al obtener cajas');
  return res.json();
}

async function createCaja(data: Partial<CashAccount>) {
  const res = await fetch('/api/tesoreria/cajas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Error al crear caja');
  }
  return res.json();
}

export default function CajasPage() {
  const queryClient = useQueryClient();
  const { viewMode } = useViewMode();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    moneda: 'ARS',
  });

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['tesoreria', 'cajas', viewMode],
    queryFn: fetchCajas,
  });

  const createMutation = useMutation({
    mutationFn: createCaja,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tesoreria', 'cajas'] });
      setIsDialogOpen(false);
      setFormData({ codigo: '', nombre: '', moneda: 'ARS' });
      toast.success('Caja creada exitosamente');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const isExtendedMode = data?._m === 'E';

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border">
          <div className="px-4 md:px-6 py-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
        </div>
        <div className="px-4 md:px-6 pb-6 grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
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
            <h1 className="text-xl font-semibold text-foreground">Cajas de Efectivo</h1>
          </div>
        </div>
        <div className="px-4 md:px-6 pb-6">
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">Error al cargar cajas de efectivo</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const cajas = data?.data || [];
  const filteredCajas = cajas.filter(c =>
    c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalARS = cajas
    .filter(c => c.moneda === 'ARS')
    .reduce((sum, c) => sum + c.saldoT1, 0);
  const totalUSD = cajas
    .filter(c => c.moneda === 'USD')
    .reduce((sum, c) => sum + c.saldoT1, 0);

  return (
    <div className="w-full p-0">
      {/* Header */}
      <div className="px-4 md:px-6 pt-4 pb-3 border-b border-border">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Cajas de Efectivo</h1>
            <p className="text-sm text-muted-foreground mt-1">Gestión de cajas y movimientos de efectivo</p>
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
                  Nueva Caja
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleSubmit}>
                  <DialogHeader>
                    <DialogTitle>Nueva Caja de Efectivo</DialogTitle>
                    <DialogDescription>
                      Crea una nueva caja para gestionar efectivo
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="codigo">Código</Label>
                      <Input
                        id="codigo"
                        placeholder="CAJA-001"
                        value={formData.codigo}
                        onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="nombre">Nombre</Label>
                      <Input
                        id="nombre"
                        placeholder="Caja Principal"
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="moneda">Moneda</Label>
                      <Select
                        value={formData.moneda}
                        onValueChange={(value) => setFormData({ ...formData, moneda: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar moneda" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ARS">ARS - Pesos Argentinos</SelectItem>
                          <SelectItem value="USD">USD - Dólares</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? 'Creando...' : 'Crear Caja'}
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
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Total en Pesos</p>
                  <p className="text-2xl font-bold mt-1">{formatCurrency(totalARS)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {cajas.filter(c => c.moneda === 'ARS').length} cajas activas
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-muted">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Total en Dólares</p>
                  <p className="text-2xl font-bold mt-1">USD {formatCurrency(totalUSD, 'USD')}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {cajas.filter(c => c.moneda === 'USD').length} cajas activas
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-muted">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Cajas Totales</p>
                  <p className="text-2xl font-bold mt-1 text-primary">{cajas.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {cajas.filter(c => c.isActive).length} activas
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-primary/10">
                  <Wallet className="h-4 w-4 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filtros y Lista de Cajas */}
      <div className="px-4 md:px-6 pt-4 pb-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <CardTitle className="text-sm font-medium">Listado de Cajas</CardTitle>
                <CardDescription className="text-xs">Todas las cajas de efectivo configuradas</CardDescription>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar caja..."
                    className="pl-9 h-9 w-full sm:w-48"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {cajas.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No hay cajas configuradas. Crea una nueva caja para comenzar.
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs">Código</TableHead>
                      <TableHead className="text-xs">Nombre</TableHead>
                      <TableHead className="text-xs">Moneda</TableHead>
                      <TableHead className="text-xs text-right">Saldo</TableHead>
                      {isExtendedMode && <TableHead className="text-xs text-right">Saldo Total</TableHead>}
                      <TableHead className="text-xs">Estado</TableHead>
                      <TableHead className="text-xs text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCajas.map((caja) => (
                      <TableRow key={caja.id} className="hover:bg-muted/30">
                        <TableCell className="text-sm font-medium">{caja.codigo}</TableCell>
                        <TableCell className="text-sm">
                          {caja.nombre}
                          {caja.esDefault && (
                            <Badge variant="secondary" className="ml-2 text-xs">Principal</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{caja.moneda}</TableCell>
                        <TableCell className="text-sm text-right font-mono">
                          {caja.moneda === 'USD' ? 'USD ' : ''}
                          {formatCurrency(caja.saldoT1, caja.moneda)}
                        </TableCell>
                        {isExtendedMode && (
                          <TableCell className="text-sm text-right font-mono text-muted-foreground">
                            {caja.saldoTotal !== null && caja.saldoTotal !== caja.saldoT1
                              ? formatCurrency(caja.saldoTotal, caja.moneda)
                              : '-'}
                          </TableCell>
                        )}
                        <TableCell>
                          <Badge variant={caja.isActive ? 'default' : 'secondary'} className="text-xs">
                            {caja.isActive ? 'Activa' : 'Inactiva'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Ingreso">
                              <ArrowUpCircle className="h-4 w-4 text-success" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Egreso">
                              <ArrowDownCircle className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {filteredCajas.length > 0 && (
              <p className="text-xs text-muted-foreground mt-3">
                Mostrando {filteredCajas.length} de {cajas.length} cajas
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
