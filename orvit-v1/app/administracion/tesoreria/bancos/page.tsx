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
import { Plus, Building2, RefreshCcw, Eye, FileText, Search, X } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useViewMode } from '@/contexts/ViewModeContext';

interface BankAccount {
  id: number;
  codigo: string;
  nombre: string;
  banco: string;
  tipoCuenta: string;
  numeroCuenta: string;
  cbu: string | null;
  alias: string | null;
  moneda: string;
  saldoContable: number;
  saldoBancario: number;
  isActive: boolean;
  esDefault: boolean;
}

async function fetchBancos(): Promise<{ data: BankAccount[] }> {
  const res = await fetch('/api/tesoreria/bancos');
  if (!res.ok) throw new Error('Error al obtener cuentas bancarias');
  return res.json();
}

async function createBanco(data: Partial<BankAccount>) {
  const res = await fetch('/api/tesoreria/bancos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Error al crear cuenta bancaria');
  }
  return res.json();
}

const BANCOS_ARGENTINA = [
  'Banco Nación',
  'Banco Provincia',
  'Banco Galicia',
  'Banco Santander',
  'BBVA',
  'Banco Macro',
  'HSBC',
  'ICBC',
  'Banco Credicoop',
  'Banco Patagonia',
  'Banco Ciudad',
  'Banco Supervielle',
  'Banco Comafi',
  'Brubank',
  'Uala',
  'Mercado Pago',
  'Otro',
];

export default function BancosPage() {
  const queryClient = useQueryClient();
  const { viewMode } = useViewMode();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    banco: '',
    tipoCuenta: 'CC',
    numeroCuenta: '',
    cbu: '',
    alias: '',
    moneda: 'ARS',
  });

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['tesoreria', 'bancos', viewMode],
    queryFn: fetchBancos,
  });

  const createMutation = useMutation({
    mutationFn: createBanco,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tesoreria', 'bancos'] });
      setIsDialogOpen(false);
      setFormData({
        codigo: '',
        nombre: '',
        banco: '',
        tipoCuenta: 'CC',
        numeroCuenta: '',
        cbu: '',
        alias: '',
        moneda: 'ARS',
      });
      toast.success('Cuenta bancaria creada exitosamente');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

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
            <h1 className="text-xl font-semibold text-foreground">Cuentas Bancarias</h1>
          </div>
        </div>
        <div className="px-4 md:px-6 pb-6">
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">Error al cargar cuentas bancarias</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const bancos = data?.data || [];
  const filteredBancos = bancos.filter(b =>
    b.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.banco.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalARS = bancos
    .filter(b => b.moneda === 'ARS')
    .reduce((sum, b) => sum + b.saldoContable, 0);
  const totalUSD = bancos
    .filter(b => b.moneda === 'USD')
    .reduce((sum, b) => sum + b.saldoContable, 0);
  const diferenciaTotal = bancos.reduce((sum, b) => sum + (b.saldoBancario - b.saldoContable), 0);

  return (
    <div className="w-full p-0">
      {/* Header */}
      <div className="px-4 md:px-6 pt-4 pb-3 border-b border-border">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Cuentas Bancarias</h1>
            <p className="text-sm text-muted-foreground mt-1">Gestión de cuentas bancarias y movimientos</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className={cn(
                "inline-flex items-center border border-border rounded-md p-0.5 bg-muted/40 h-7",
                "px-2 text-xs font-normal gap-1.5",
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
                  Nueva Cuenta
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-lg">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Nueva Cuenta Bancaria</DialogTitle>
                  <DialogDescription>
                    Registra una nueva cuenta bancaria
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="codigo">Código</Label>
                      <Input
                        id="codigo"
                        placeholder="BCO-001"
                        value={formData.codigo}
                        onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
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
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ARS">ARS</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="nombre">Nombre de la cuenta</Label>
                    <Input
                      id="nombre"
                      placeholder="Cuenta Corriente Principal"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="banco">Banco</Label>
                      <Select
                        value={formData.banco}
                        onValueChange={(value) => setFormData({ ...formData, banco: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar banco" />
                        </SelectTrigger>
                        <SelectContent>
                          {BANCOS_ARGENTINA.map((banco) => (
                            <SelectItem key={banco} value={banco}>{banco}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="tipoCuenta">Tipo de cuenta</Label>
                      <Select
                        value={formData.tipoCuenta}
                        onValueChange={(value) => setFormData({ ...formData, tipoCuenta: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CC">Cuenta Corriente</SelectItem>
                          <SelectItem value="CA">Caja de Ahorro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="numeroCuenta">Número de cuenta</Label>
                    <Input
                      id="numeroCuenta"
                      placeholder="1234567890"
                      value={formData.numeroCuenta}
                      onChange={(e) => setFormData({ ...formData, numeroCuenta: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="cbu">CBU</Label>
                    <Input
                      id="cbu"
                      placeholder="0000000000000000000000"
                      maxLength={22}
                      value={formData.cbu}
                      onChange={(e) => setFormData({ ...formData, cbu: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="alias">Alias</Label>
                    <Input
                      id="alias"
                      placeholder="mi.alias.banco"
                      value={formData.alias}
                      onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Creando...' : 'Crear Cuenta'}
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
                  <p className="text-xs font-medium text-muted-foreground">Total en Pesos</p>
                  <p className="text-2xl font-bold mt-1">{formatCurrency(totalARS)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {bancos.filter(b => b.moneda === 'ARS').length} cuentas
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-muted">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
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
                    {bancos.filter(b => b.moneda === 'USD').length} cuentas
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-muted">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Diferencia Conciliación</p>
                  <p className={`text-2xl font-bold mt-1 ${diferenciaTotal !== 0 ? 'text-warning-muted-foreground' : 'text-success'}`}>
                    {formatCurrency(diferenciaTotal)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Contable vs Bancario
                  </p>
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
                  <p className="text-xs font-medium text-muted-foreground">Cuentas Totales</p>
                  <p className="text-2xl font-bold mt-1 text-primary">{bancos.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {bancos.filter(b => b.isActive).length} activas
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-primary/10">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filtros y Lista de Cuentas */}
      <div className="px-4 md:px-6 pt-4 pb-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <CardTitle className="text-sm font-medium">Listado de Cuentas Bancarias</CardTitle>
                <CardDescription className="text-xs">Todas las cuentas bancarias configuradas</CardDescription>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cuenta..."
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
            {bancos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No hay cuentas bancarias configuradas. Crea una nueva cuenta para comenzar.
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs">Código</TableHead>
                      <TableHead className="text-xs">Nombre</TableHead>
                      <TableHead className="text-xs">Banco</TableHead>
                      <TableHead className="text-xs">Tipo</TableHead>
                      <TableHead className="text-xs text-right">Saldo Contable</TableHead>
                      <TableHead className="text-xs text-right">Saldo Banco</TableHead>
                      <TableHead className="text-xs">Estado</TableHead>
                      <TableHead className="text-xs text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBancos.map((banco) => (
                      <TableRow key={banco.id} className="hover:bg-muted/30">
                        <TableCell className="text-sm font-medium">{banco.codigo}</TableCell>
                        <TableCell className="text-sm">
                          {banco.nombre}
                          {banco.esDefault && (
                            <Badge variant="secondary" className="ml-2 text-xs">Principal</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{banco.banco}</TableCell>
                        <TableCell className="text-sm">
                          <Badge variant="outline" className="text-xs">{banco.tipoCuenta}</Badge>
                          <span className="ml-2 text-xs text-muted-foreground">{banco.moneda}</span>
                        </TableCell>
                        <TableCell className="text-sm text-right font-mono">
                          {formatCurrency(banco.saldoContable, banco.moneda)}
                        </TableCell>
                        <TableCell className="text-sm text-right font-mono">
                          {banco.saldoBancario !== banco.saldoContable ? (
                            <span className="text-warning-muted-foreground">
                              {formatCurrency(banco.saldoBancario, banco.moneda)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={banco.isActive ? 'default' : 'secondary'} className="text-xs">
                            {banco.isActive ? 'Activa' : 'Inactiva'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Ver movimientos">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {filteredBancos.length > 0 && (
              <p className="text-xs text-muted-foreground mt-3">
                Mostrando {filteredBancos.length} de {bancos.length} cuentas
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
