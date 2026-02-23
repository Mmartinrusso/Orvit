'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { formatDate } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Calendar, MapPin, Mail, Download, FileSpreadsheet, Eye, Plus, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency, cn } from '@/lib/utils';
import { SellerKpiCards } from '@/components/ventas/seller-kpi-cards';
import { SellerEvolutionChart } from '@/components/ventas/seller-evolution-chart';
import { SellerFunnelChart } from '@/components/ventas/seller-funnel-chart';
import { SellerDetailTables } from '@/components/ventas/seller-detail-tables';
import { QuoteCostComposition } from '@/components/ventas/quote-cost-composition';

interface Liquidacion {
  id: number;
  numero: string;
  estado: string;
  fechaDesde: string;
  fechaHasta: string;
  totalVentas: number;
  totalComisiones: number;
  totalLiquidacion: number;
  ajustes: number;
  createdAt: string;
  createdByUser: { id: string; name: string } | null;
  _count: { items: number };
}

const LIQUIDACION_ESTADO_LABELS: Record<string, string> = {
  borrador: 'Borrador',
  confirmada: 'Confirmada',
  pagada: 'Pagada',
  cancelada: 'Cancelada',
};

const LIQUIDACION_ESTADO_VARIANT: Record<string, 'secondary' | 'default' | 'outline' | 'destructive'> = {
  borrador: 'secondary',
  confirmada: 'default',
  pagada: 'outline',
  cancelada: 'destructive',
};

interface ResumenData {
  vendedor: { id: number; name: string; email: string };
  salesRep: {
    id: number;
    nombre: string;
    comision: number;
    cuotaMensual: number;
    zona?: { id: number; nombre: string };
  } | null;
  periodo: { desde: string; hasta: string };
  cotizaciones: any[];
  ventas: any[];
  facturas: any[];
  evolucionMensual: any[];
  estadoDistribucion: Record<string, number>;
  kpis: {
    cotizacionesEmitidas: number;
    cotizacionesAceptadas: number;
    tasaConversion: number;
    ventasTotal: number;
    comisionesGeneradas: number;
    comisionesPagadas: number;
    comisionesPendientes: number;
    facturasEmitidas: number;
    facturasCobradas: number;
    clientesAtendidos: number;
    ticketPromedio: number;
    cuotaMensual: number;
    avanceCuotaPorcentaje: number;
  };
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-4 items-center">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
      <Skeleton className="h-96 rounded-lg" />
    </div>
  );
}

export default function SellerResumenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<ResumenData | null>(null);
  const [loading, setLoading] = useState(true);

  // Fechas: últimos 30 días por defecto
  const defaultDesde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const defaultHasta = new Date().toISOString().slice(0, 10);
  const [fechaDesde, setFechaDesde] = useState(defaultDesde);
  const [fechaHasta, setFechaHasta] = useState(defaultHasta);

  const [activeTab, setActiveTab] = useState('resumen');
  const [liquidaciones, setLiquidaciones] = useState<Liquidacion[]>([]);
  const [loadingLiq, setLoadingLiq] = useState(false);

  const loadLiquidaciones = async () => {
    try {
      setLoadingLiq(true);
      const res = await fetch(`/api/ventas/liquidaciones?sellerId=${id}&limit=50`, { credentials: 'include' });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setLiquidaciones(json.data || []);
    } catch {
      toast.error('Error al cargar liquidaciones');
    } finally {
      setLoadingLiq(false);
    }
  };

  const loadData = async (desde?: string, hasta?: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (desde) params.set('fechaDesde', desde);
      if (hasta) params.set('fechaHasta', hasta);

      const res = await fetch(`/api/ventas/vendedores/${id}/resumen?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Error fetching');
      const result = await res.json();
      setData(result);
    } catch (err) {
      console.error(err);
      toast.error('Error al cargar el resumen del vendedor');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(fechaDesde, fechaHasta);
  }, [id]);

  useEffect(() => {
    if (activeTab === 'liquidaciones' && liquidaciones.length === 0 && !loadingLiq) {
      loadLiquidaciones();
    }
  }, [activeTab]);

  const handleApplyDates = () => {
    loadData(fechaDesde, fechaHasta);
  };

  const handleExportCSV = () => {
    if (!data) return;

    const rows: string[][] = [
      ['Resumen de Vendedor', data.vendedor.name],
      ['Periodo', `${fechaDesde} a ${fechaHasta}`],
      [],
      ['--- COTIZACIONES ---'],
      ['Numero', 'Cliente', 'Fecha', 'Total', 'Estado'],
      ...data.cotizaciones.map((c) => [
        c.numero,
        c.client?.legalName || '',
        formatDate(c.fechaEmision),
        String(Number(c.total)),
        c.estado,
      ]),
      [],
      ['--- VENTAS ---'],
      ['Numero', 'Cliente', 'Fecha', 'Total', 'Estado', 'Comision'],
      ...data.ventas.map((v) => [
        v.numero,
        v.client?.legalName || '',
        formatDate(v.fecha),
        String(Number(v.total)),
        v.estado,
        String(Number(v.comisionMonto || 0)),
      ]),
      [],
      ['--- FACTURAS ---'],
      ['Numero', 'Cliente', 'Fecha', 'Total', 'Saldo Pendiente', 'Estado'],
      ...data.facturas.map((f) => [
        f.numeroCompleto,
        f.client?.legalName || '',
        formatDate(f.fechaEmision),
        String(Number(f.total)),
        String(Number(f.saldoPendiente)),
        f.estado,
      ]),
    ];

    const csvContent = rows.map((row) => row.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Resumen_${data.vendedor.name.replace(/\s/g, '_')}_${fechaDesde}_${fechaHasta}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado');
  };

  // Agregar items de todas las cotizaciones para composición global
  const allCotizacionItems = data?.cotizaciones.flatMap((c) =>
    (c.items || []).map((item: any) => ({
      cantidad: Number(item.cantidad),
      costBreakdown: item.costBreakdown?.map((cb: any) => ({
        concepto: cb.concepto,
        monto: Number(cb.monto),
      })),
    }))
  ) || [];

  return (
    <PermissionGuard permission="ventas.vendedores.resumen">
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              {loading ? (
                <Skeleton className="h-8 w-48" />
              ) : (
                <>
                  <h1 className="text-2xl font-bold">{data?.vendedor.name}</h1>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" />
                      {data?.vendedor.email}
                    </span>
                    {data?.salesRep?.zona && (
                      <Badge variant="outline" className="gap-1">
                        <MapPin className="w-3 h-3" />
                        {data.salesRep.zona.nombre}
                      </Badge>
                    )}
                    {data?.salesRep && (
                      <Badge variant="secondary">
                        Comisión: {Number(data.salesRep.comision)}%
                      </Badge>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!data}>
              <FileSpreadsheet className="w-4 h-4 mr-1" />
              CSV
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => router.push(`/administracion/ventas/liquidaciones/nueva?sellerId=${id}`)}
            >
              Crear Liquidación
            </Button>
          </div>
        </div>

        {/* Filtro de periodo */}
        <div className="flex items-end gap-3 bg-muted/50 p-3 rounded-lg">
          <Calendar className="h-4 w-4 text-muted-foreground mb-2" />
          <div className="space-y-1">
            <Label className="text-xs">Desde</Label>
            <Input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="h-8 w-36"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Hasta</Label>
            <Input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="h-8 w-36"
            />
          </div>
          <Button size="sm" onClick={handleApplyDates}>
            Aplicar
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="liquidaciones" className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Liquidaciones
            </TabsTrigger>
          </TabsList>

          <TabsContent value="resumen" className="mt-4 space-y-4">
            {loading ? (
              <LoadingSkeleton />
            ) : data ? (
              <>
                <SellerKpiCards kpis={data.kpis} />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2">
                    <SellerEvolutionChart data={data.evolucionMensual} />
                  </div>
                  <div>
                    <SellerFunnelChart estadoDistribucion={data.estadoDistribucion} />
                  </div>
                </div>
                <QuoteCostComposition items={allCotizacionItems} />
                <SellerDetailTables
                  cotizaciones={data.cotizaciones}
                  ventas={data.ventas}
                  facturas={data.facturas}
                />
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="liquidaciones" className="mt-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-muted-foreground">
                    {loadingLiq ? 'Cargando...' : `${liquidaciones.length} liquidacion${liquidaciones.length !== 1 ? 'es' : ''}`}
                  </p>
                  <Button
                    size="sm"
                    onClick={() => router.push(`/administracion/ventas/liquidaciones/nueva?sellerId=${id}`)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Nueva Liquidación
                  </Button>
                </div>

                {loadingLiq ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : liquidaciones.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                      <FileText className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="font-medium text-sm">Sin liquidaciones</p>
                    <p className="text-xs text-muted-foreground mt-1">No hay liquidaciones registradas para este vendedor</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">OVs</TableHead>
                        <TableHead className="text-right">Total ventas</TableHead>
                        <TableHead className="text-right">Comisión</TableHead>
                        <TableHead className="text-right">A pagar</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {liquidaciones.map((liq) => (
                        <TableRow key={liq.id} className="cursor-pointer hover:bg-muted/40" onClick={() => router.push(`/administracion/ventas/liquidaciones/${liq.id}`)}>
                          <TableCell className="font-mono text-sm font-semibold">{liq.numero}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(liq.fechaDesde), 'dd/MM/yy', { locale: es })}
                            {' – '}
                            {format(new Date(liq.fechaHasta), 'dd/MM/yy', { locale: es })}
                          </TableCell>
                          <TableCell>
                            <Badge variant={LIQUIDACION_ESTADO_VARIANT[liq.estado] || 'secondary'}>
                              {LIQUIDACION_ESTADO_LABELS[liq.estado] || liq.estado}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">{liq._count.items}</TableCell>
                          <TableCell className="text-right tabular-nums text-sm">{formatCurrency(Number(liq.totalVentas))}</TableCell>
                          <TableCell className="text-right tabular-nums text-sm text-violet-600 font-medium">{formatCurrency(Number(liq.totalComisiones))}</TableCell>
                          <TableCell className="text-right tabular-nums text-sm font-bold">{formatCurrency(Number(liq.totalLiquidacion))}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); router.push(`/administracion/ventas/liquidaciones/${liq.id}`); }}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  );
}
