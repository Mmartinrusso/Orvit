'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Calendar,
  ArrowUpCircle,
  ArrowDownCircle,
  Wallet,
  FileCheck,
  Receipt
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useViewMode } from '@/contexts/ViewModeContext';
import FlujoCajaProyeccion from '@/components/tesoreria/FlujoCajaProyeccion';

interface PosicionData {
  cajas: Array<{ saldoT1: number; saldoTotal: number | null }>;
  bancos: Array<{ saldoContable: number }>;
  chequesCartera: { items: Array<any>; resumen: Record<string, any> };
  totalesPorMoneda: Record<string, any>;
  proximosVencimientos: {
    cheques: Array<any>;
    facturas: Array<any>;
  };
  _m: string;
}

async function fetchPosicion(): Promise<PosicionData> {
  const res = await fetch('/api/tesoreria/posicion');
  if (!res.ok) throw new Error('Error');
  return res.json();
}

export default function FlujoCajaPage() {
  const queryClient = useQueryClient();
  const { mode } = useViewMode();
  const [periodoProyeccion, setPeriodoProyeccion] = useState<string>('7');

  const isExtendedMode = mode === 'E';

  const { data, isLoading, error } = useQuery({
    queryKey: ['tesoreria', 'posicion'],
    queryFn: fetchPosicion,
  });

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
            <p className="text-destructive">Error al cargar datos de flujo de caja</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calcular posición actual - T1
  const totalCajasT1 = data?.cajas?.reduce((sum, c) => sum + c.saldoT1, 0) || 0;
  const totalBancos = data?.bancos?.reduce((sum, b) => sum + b.saldoContable, 0) || 0;
  const totalChequesCarteraT1 = data?.totalesPorMoneda?.['ARS']?.chequesCartera?.t1 || 0;
  const posicionActualT1 = totalCajasT1 + totalBancos + totalChequesCarteraT1;

  // Calcular posición actual - Total (T1+T2) si estamos en modo extended
  const totalCajasTotal = isExtendedMode
    ? data?.cajas?.reduce((sum, c) => sum + (c.saldoTotal ?? c.saldoT1), 0) || 0
    : totalCajasT1;
  const totalChequesCarteraTotal = isExtendedMode
    ? data?.totalesPorMoneda?.['ARS']?.chequesCartera?.total || totalChequesCarteraT1
    : totalChequesCarteraT1;
  const posicionActualTotal = totalCajasTotal + totalBancos + totalChequesCarteraTotal;

  // Usar total real si estamos en modo E, sino usar T1
  const posicionActual = isExtendedMode ? posicionActualTotal : posicionActualT1;

  // Próximos ingresos (cheques por vencer)
  const chequesPorVencer = data?.proximosVencimientos?.cheques || [];
  const totalIngresosProyectados = chequesPorVencer.reduce(
    (sum, c) => sum + Number(c.importe), 0
  );

  // Próximos egresos (facturas por pagar)
  const facturasPorPagar = data?.proximosVencimientos?.facturas || [];
  const totalEgresosProyectados = facturasPorPagar.reduce(
    (sum, f) => sum + Number(f.total), 0
  );

  // Saldo proyectado
  const saldoProyectado = posicionActual + totalIngresosProyectados - totalEgresosProyectados;

  // Generar proyección por día
  const hoy = new Date();
  const dias = parseInt(periodoProyeccion);
  const proyeccionDiaria: Array<{
    fecha: Date;
    ingresos: number;
    egresos: number;
    saldoAcumulado: number;
  }> = [];

  let saldoAcumulado = posicionActual;
  for (let i = 0; i < dias; i++) {
    const fecha = new Date(hoy);
    fecha.setDate(fecha.getDate() + i);
    const fechaStr = fecha.toISOString().split('T')[0];

    const ingresosDelDia = chequesPorVencer
      .filter(c => c.fechaVencimiento?.split('T')[0] === fechaStr)
      .reduce((sum, c) => sum + Number(c.importe), 0);

    const egresosDelDia = facturasPorPagar
      .filter(f => f.fechaVencimiento?.split('T')[0] === fechaStr)
      .reduce((sum, f) => sum + Number(f.total), 0);

    saldoAcumulado = saldoAcumulado + ingresosDelDia - egresosDelDia;

    proyeccionDiaria.push({
      fecha,
      ingresos: ingresosDelDia,
      egresos: egresosDelDia,
      saldoAcumulado,
    });
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Flujo de Caja</h1>
          <p className="text-muted-foreground">Proyección de ingresos y egresos</p>
        </div>
        <div className="flex gap-2">
          <Select value={periodoProyeccion} onValueChange={setPeriodoProyeccion}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 días</SelectItem>
              <SelectItem value="14">14 días</SelectItem>
              <SelectItem value="30">30 días</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['tesoreria'] })}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Posición Actual</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(posicionActual)}</div>
            {isExtendedMode && posicionActualT1 !== posicionActualTotal && (
              <p className="text-xs text-muted-foreground">
                T1: {formatCurrency(posicionActualT1)}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Cajas + Bancos + Cheques
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Proyectados</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              +{formatCurrency(totalIngresosProyectados)}
            </div>
            <p className="text-xs text-muted-foreground">
              {chequesPorVencer.length} cheques por cobrar
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Egresos Proyectados</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              -{formatCurrency(totalEgresosProyectados)}
            </div>
            <p className="text-xs text-muted-foreground">
              {facturasPorPagar.length} pagos pendientes
            </p>
          </CardContent>
        </Card>

        <Card className={saldoProyectado >= 0 ? 'bg-green-50 dark:bg-green-900/10' : 'bg-red-50 dark:bg-red-900/10'}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Saldo Proyectado</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${saldoProyectado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(saldoProyectado)}
            </div>
            <p className="text-xs text-muted-foreground">
              Al {proyeccionDiaria[proyeccionDiaria.length - 1]?.fecha.toLocaleDateString('es-AR')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Proyección Diaria */}
      <Card>
        <CardHeader>
          <CardTitle>Proyección Diaria</CardTitle>
          <CardDescription>Movimientos esperados por día</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Ingresos</TableHead>
                <TableHead className="text-right">Egresos</TableHead>
                <TableHead className="text-right">Saldo Acumulado</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proyeccionDiaria.map((dia, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">
                    {dia.fecha.toLocaleDateString('es-AR', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short'
                    })}
                    {idx === 0 && <Badge variant="outline" className="ml-2">Hoy</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    {dia.ingresos > 0 ? (
                      <span className="text-green-600 flex items-center justify-end gap-1">
                        <ArrowUpCircle className="h-3 w-3" />
                        +{formatCurrency(dia.ingresos)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {dia.egresos > 0 ? (
                      <span className="text-red-600 flex items-center justify-end gap-1">
                        <ArrowDownCircle className="h-3 w-3" />
                        -{formatCurrency(dia.egresos)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <span className={dia.saldoAcumulado >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {formatCurrency(dia.saldoAcumulado)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {dia.saldoAcumulado < 0 && (
                      <Badge variant="destructive">Déficit</Badge>
                    )}
                    {dia.saldoAcumulado >= 0 && dia.saldoAcumulado < posicionActual * 0.2 && (
                      <Badge variant="outline" className="text-yellow-600">Bajo</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detalle de Próximos Movimientos */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Cheques por Vencer */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-green-600" />
              Cheques por Cobrar
            </CardTitle>
            <CardDescription>Próximos {periodoProyeccion} días</CardDescription>
          </CardHeader>
          <CardContent>
            {chequesPorVencer.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay cheques por vencer en este período
              </p>
            ) : (
              <div className="space-y-3">
                {chequesPorVencer.slice(0, 5).map((cheque: any) => (
                  <div key={cheque.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium text-sm">#{cheque.numero}</p>
                      <p className="text-xs text-muted-foreground">{cheque.banco}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-green-600">
                        +{formatCurrency(Number(cheque.importe))}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(cheque.fechaVencimiento).toLocaleDateString('es-AR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Facturas por Pagar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt className="h-5 w-5 text-red-600" />
              Pagos Pendientes
            </CardTitle>
            <CardDescription>Próximos {periodoProyeccion} días</CardDescription>
          </CardHeader>
          <CardContent>
            {facturasPorPagar.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay pagos pendientes en este período
              </p>
            ) : (
              <div className="space-y-3">
                {facturasPorPagar.slice(0, 5).map((factura: any) => (
                  <div key={factura.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium text-sm">{factura.proveedor?.name || 'Sin proveedor'}</p>
                      <p className="text-xs text-muted-foreground">{factura.numeroFactura}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-red-600">
                        -{formatCurrency(Number(factura.total))}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {factura.fechaVencimiento
                          ? new Date(factura.fechaVencimiento).toLocaleDateString('es-AR')
                          : 'Sin fecha'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Proyección Avanzada */}
      <FlujoCajaProyeccion />
    </div>
  );
}
