'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Wallet,
  Building2,
  FileCheck,
  TrendingUp,
  AlertTriangle,
  Calendar,
  RefreshCcw,
  Zap,
  ArrowRightLeft,
  ChevronRight,
  ArrowDownToLine,
  FileSpreadsheet,
  ClipboardCheck,
  History,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface PosicionData {
  cajas: Array<{
    id: number;
    codigo: string;
    nombre: string;
    moneda: string;
    saldoT1: number;
    saldoTotal: number | null;
  }>;
  bancos: Array<{
    id: number;
    codigo: string;
    nombre: string;
    banco: string;
    moneda: string;
    saldoContable: number;
    saldoBancario: number;
  }>;
  chequesCartera: {
    items: Array<any>;
    resumen: Record<string, { cantidad: number; total: number; t1: number; t2: number }>;
  };
  totalesPorMoneda: Record<string, {
    efectivo: { t1: number; total: number };
    bancos: number;
    chequesCartera: { t1: number; total: number };
    total: { t1: number; total: number };
  }>;
  proximosVencimientos: {
    cheques: Array<any>;
    facturas: Array<any>;
  };
  _m: 'S' | 'E';
}

async function fetchPosicion(): Promise<PosicionData> {
  const res = await fetch('/api/tesoreria/posicion');
  if (!res.ok) throw new Error('Error al obtener posición');
  return res.json();
}

export default function TesoreriaPage() {
  const router = useRouter();
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['tesoreria', 'posicion'],
    queryFn: fetchPosicion,
  });

  const shortcuts = [
    { label: 'Cajas', icon: Wallet, path: '/administracion/tesoreria/cajas' },
    { label: 'Bancos', icon: Building2, path: '/administracion/tesoreria/bancos' },
    { label: 'Cheques', icon: FileCheck, path: '/administracion/tesoreria/cheques' },
    { label: 'Transferencias', icon: ArrowRightLeft, path: '/administracion/tesoreria/transferencias' },
  ];

  const advancedShortcuts = [
    { label: 'Movimientos', icon: History, path: '/administracion/tesoreria/movimientos' },
    { label: 'Depósitos', icon: ArrowDownToLine, path: '/administracion/tesoreria/depositos' },
    { label: 'Cierres', icon: ClipboardCheck, path: '/administracion/tesoreria/cierres' },
    { label: 'Conciliación', icon: FileSpreadsheet, path: '/administracion/tesoreria/conciliacion' },
  ];

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
            <h1 className="text-xl font-semibold text-foreground">Tesorería</h1>
          </div>
        </div>
        <div className="px-4 md:px-6 pb-6">
          <Card>
            <CardContent className="py-10 text-center">
              <AlertTriangle className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">Error al cargar datos de tesorería</p>
              <Button onClick={() => refetch()} variant="outline">
                <RefreshCcw className="w-4 h-4 mr-2" />
                Reintentar
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const arsData = data?.totalesPorMoneda?.['ARS'];
  const usdData = data?.totalesPorMoneda?.['USD'];
  const isExtendedMode = data?._m === 'E';

  return (
    <div className="w-full p-0">
      {/* Header */}
      <div className="px-4 md:px-6 pt-4 pb-3 border-b border-border">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Tesorería</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Posición consolidada de fondos
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isExtendedMode && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                Vista extendida
              </Badge>
            )}
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
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="px-4 md:px-6 pt-4 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Efectivo ARS */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/administracion/tesoreria/cajas')}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Efectivo (ARS)</p>
                  <p className="text-2xl font-bold mt-1">
                    {formatCurrency(arsData?.efectivo?.t1 || 0)}
                  </p>
                  {isExtendedMode && arsData?.efectivo?.total !== arsData?.efectivo?.t1 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Total: {formatCurrency(arsData?.efectivo?.total || 0)}
                    </p>
                  )}
                </div>
                <div className="p-2 rounded-lg bg-muted">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bancos ARS */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/administracion/tesoreria/bancos')}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Bancos (ARS)</p>
                  <p className="text-2xl font-bold mt-1">
                    {formatCurrency(arsData?.bancos || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {data?.bancos?.length || 0} cuentas activas
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-muted">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cheques en Cartera */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/administracion/tesoreria/cheques')}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Cheques en Cartera</p>
                  <p className="text-2xl font-bold mt-1">
                    {formatCurrency(arsData?.chequesCartera?.t1 || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {data?.chequesCartera?.items?.length || 0} documentos
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-muted">
                  <FileCheck className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total General */}
          <Card className="bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Total Disponible</p>
                  <p className="text-2xl font-bold mt-1 text-primary">
                    {formatCurrency(arsData?.total?.t1 || 0)}
                  </p>
                  {isExtendedMode && arsData?.total?.total !== arsData?.total?.t1 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Total: {formatCurrency(arsData?.total?.total || 0)}
                    </p>
                  )}
                </div>
                <div className="p-2 rounded-lg bg-primary/10">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Acciones Rapidas */}
        <Card>
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Acciones Rapidas
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="flex flex-wrap gap-2">
              {shortcuts.map((shortcut) => {
                const Icon = shortcut.icon;
                return (
                  <Button
                    key={shortcut.path}
                    variant="outline"
                    size="sm"
                    className="h-8 gap-2"
                    onClick={() => router.push(shortcut.path)}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {shortcut.label}
                  </Button>
                );
              })}
              <div className="h-8 w-px bg-border mx-1" />
              {advancedShortcuts.map((shortcut) => {
                const Icon = shortcut.icon;
                return (
                  <Button
                    key={shortcut.path}
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-2 text-muted-foreground hover:text-foreground"
                    onClick={() => router.push(shortcut.path)}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {shortcut.label}
                  </Button>
                );
              })}
              <div className="h-8 w-px bg-border mx-1" />
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => router.push('/administracion/tesoreria/flujo-caja')}>
                Flujo de Caja <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* USD si hay */}
      {usdData && (usdData.efectivo.t1 > 0 || usdData.bancos > 0) && (
        <div className="px-4 md:px-6 pt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Posición en Dólares (USD)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Efectivo</p>
                  <p className="text-lg font-semibold">USD {formatCurrency(usdData.efectivo.t1, 'USD')}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Bancos</p>
                  <p className="text-lg font-semibold">USD {formatCurrency(usdData.bancos, 'USD')}</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10">
                  <p className="text-xs text-muted-foreground mb-1">Total</p>
                  <p className="text-lg font-semibold text-primary">USD {formatCurrency(usdData.total.t1, 'USD')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dos columnas: Cajas y Bancos */}
      <div className="px-4 md:px-6 pt-4 grid gap-4 md:grid-cols-2">
        {/* Cajas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Cajas de Efectivo
            </CardTitle>
            <CardDescription className="text-xs">Saldos por caja</CardDescription>
          </CardHeader>
          <CardContent>
            {data?.cajas?.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No hay cajas configuradas</p>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <div className="divide-y">
                  {data?.cajas?.map((caja) => (
                    <div
                      key={caja.id}
                      className="flex items-center justify-between px-3 py-2.5 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => router.push('/administracion/tesoreria/cajas')}
                    >
                      <div>
                        <p className="text-sm font-medium">{caja.nombre}</p>
                        <p className="text-xs text-muted-foreground">{caja.codigo} - {caja.moneda}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{formatCurrency(caja.saldoT1)}</p>
                        {isExtendedMode && caja.saldoTotal !== null && caja.saldoTotal !== caja.saldoT1 && (
                          <p className="text-xs text-muted-foreground">
                            Total: {formatCurrency(caja.saldoTotal)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bancos */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Cuentas Bancarias
            </CardTitle>
            <CardDescription className="text-xs">Saldos por cuenta</CardDescription>
          </CardHeader>
          <CardContent>
            {data?.bancos?.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No hay cuentas bancarias configuradas</p>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <div className="divide-y">
                  {data?.bancos?.map((banco) => (
                    <div
                      key={banco.id}
                      className="flex items-center justify-between px-3 py-2.5 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => router.push('/administracion/tesoreria/bancos')}
                    >
                      <div>
                        <p className="text-sm font-medium">{banco.nombre}</p>
                        <p className="text-xs text-muted-foreground">{banco.banco} - {banco.moneda}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{formatCurrency(banco.saldoContable)}</p>
                        {banco.saldoBancario !== banco.saldoContable && (
                          <p className="text-xs text-muted-foreground">
                            Banco: {formatCurrency(banco.saldoBancario)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Próximos Vencimientos */}
      <div className="px-4 md:px-6 pt-4 pb-6 grid gap-4 md:grid-cols-2">
        {/* Cheques por vencer */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Cheques por Vencer (7 días)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.proximosVencimientos?.cheques?.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No hay cheques por vencer próximamente</p>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <div className="divide-y">
                  {data?.proximosVencimientos?.cheques?.slice(0, 5).map((cheque: any) => (
                    <div
                      key={cheque.id}
                      className="flex items-center justify-between px-3 py-2.5 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => router.push('/administracion/tesoreria/cheques')}
                    >
                      <div>
                        <p className="text-sm font-medium">#{cheque.numero}</p>
                        <p className="text-xs text-muted-foreground">{cheque.banco}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{formatCurrency(Number(cheque.importe))}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(cheque.fechaVencimiento).toLocaleDateString('es-AR')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Facturas por pagar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning-muted-foreground" />
              Pagos Pendientes (7 días)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.proximosVencimientos?.facturas?.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No hay pagos pendientes próximamente</p>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <div className="divide-y">
                  {data?.proximosVencimientos?.facturas?.slice(0, 5).map((factura: any) => (
                    <div key={factura.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-muted/30 transition-colors">
                      <div>
                        <p className="text-sm font-medium">{factura.proveedor?.name}</p>
                        <p className="text-xs text-muted-foreground">{factura.numeroFactura}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-warning-muted-foreground">{formatCurrency(Number(factura.total))}</p>
                        <p className="text-xs text-muted-foreground">
                          {factura.fechaVencimiento
                            ? new Date(factura.fechaVencimiento).toLocaleDateString('es-AR')
                            : 'Sin fecha'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
