'use client';

import { useState, useEffect } from 'react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  FileText,
  Users,
  UserCheck,
  Calendar,
  Clock,
  Trophy,
  Package,
  BarChart3,
  Download,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  RefreshCw,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  FileSpreadsheet,
  Printer,
} from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

// Tipos
interface Reporte {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  icon: string;
}

interface Cliente {
  id: string;
  legalName: string;
  name: string;
}

interface Vendedor {
  id: number;
  name: string;
}

// Iconos por tipo
const iconMap: Record<string, React.ElementType> = {
  Users,
  UserCheck,
  Calendar,
  Clock,
  Trophy,
  Package,
  FileText,
  BarChart3,
};

export default function ReportesPage() {
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [loading, setLoading] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [reporteActivo, setReporteActivo] = useState<string | null>(null);
  const [resultados, setResultados] = useState<any>(null);

  // Filtros
  const [fechaDesde, setFechaDesde] = useState(format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'));
  const [fechaHasta, setFechaHasta] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [clienteId, setClienteId] = useState<string>('');
  const [vendedorId, setVendedorId] = useState<string>('');
  const [agrupacion, setAgrupacion] = useState<string>('mensual');
  const [limite, setLimite] = useState<string>('20');

  // Datos para selects
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);

  useEffect(() => {
    loadReportes();
    loadClientes();
    loadVendedores();
  }, []);

  const loadReportes = async () => {
    try {
      const res = await fetch('/api/ventas/reportes');
      if (res.ok) {
        const data = await res.json();
        setReportes(data.reportes);
      }
    } catch (error) {
      console.error('Error loading reportes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadClientes = async () => {
    try {
      const res = await fetch('/api/clients?limit=500');
      if (res.ok) {
        const data = await res.json();
        // La API puede devolver array directo, data.data, o data.clients
        const clientesData = Array.isArray(data) ? data : (data.data || data.clients || []);
        setClientes(clientesData);
      }
    } catch (error) {
      console.error('Error loading clientes:', error);
    }
  };

  const loadVendedores = async () => {
    try {
      const res = await fetch('/api/users?role=VENDEDOR&limit=100');
      if (res.ok) {
        const data = await res.json();
        setVendedores(data.users || data.data || []);
      }
    } catch (error) {
      console.error('Error loading vendedores:', error);
    }
  };

  const generarReporte = async (reporteId: string) => {
    setGenerando(true);
    setReporteActivo(reporteId);
    setResultados(null);

    try {
      const params = new URLSearchParams();
      if (fechaDesde) params.append('fechaDesde', fechaDesde);
      if (fechaHasta) params.append('fechaHasta', fechaHasta);
      if (clienteId) params.append('clienteId', clienteId);
      if (vendedorId) params.append('vendedorId', vendedorId);
      if (agrupacion) params.append('agrupacion', agrupacion);
      if (limite) params.append('limite', limite);

      const res = await fetch(`/api/ventas/reportes/${reporteId}?${params}`);
      if (res.ok) {
        const data = await res.json();
        setResultados(data);
        toast.success('Reporte generado exitosamente');
      } else {
        const error = await res.json();
        toast.error(error.error || 'Error al generar reporte');
      }
    } catch (error) {
      toast.error('Error al generar el reporte');
    } finally {
      setGenerando(false);
    }
  };

  const exportarCSV = () => {
    if (!resultados) return;

    // Convertir datos a CSV según el tipo de reporte
    let csv = '';
    const reporte = reportes.find(r => r.id === reporteActivo);

    if (reporteActivo === 'ranking-clientes' && resultados.ranking) {
      csv = 'Posición,Cliente,Total Compras,Cantidad Órdenes,Ticket Promedio,Participación\n';
      resultados.ranking.forEach((r: any) => {
        csv += `${r.posicion},"${r.cliente.nombre}",${r.metricas.totalCompras},${r.metricas.cantidadOrdenes},${r.metricas.ticketPromedio},${r.participacion}%\n`;
      });
    } else if (reporteActivo === 'ranking-productos' && resultados.ranking) {
      csv = 'Posición,Producto,SKU,Cantidad Vendida,Monto Total,Participación\n';
      resultados.ranking.forEach((r: any) => {
        csv += `${r.posicion},"${r.producto.nombre}",${r.producto.sku || ''},${r.metricas.cantidadVendida},${r.metricas.montoTotal},${r.participacion}%\n`;
      });
    } else if (reporteActivo === 'cobranzas-pendientes' && resultados.todasLasFacturas) {
      csv = 'Factura,Cliente,Fecha Emisión,Fecha Vencimiento,Total,Saldo Pendiente,Días Atraso\n';
      resultados.todasLasFacturas.forEach((f: any) => {
        csv += `${f.numero},"${f.client.legalName || f.client.name}",${f.fechaEmision.split('T')[0]},${f.fechaVencimiento?.split('T')[0] || ''},${f.total},${f.saldoPendiente},${f.diasAtraso}\n`;
      });
    } else if (reporteActivo === 'ventas-periodo' && resultados.datos) {
      csv = 'Período,Órdenes,Total Órdenes,Facturas,Total Facturas,Cobrado,Pendiente\n';
      resultados.datos.forEach((d: any) => {
        csv += `${d.periodo},${d.ordenes},${d.ordenesTotal},${d.facturas},${d.facturasTotal},${d.cobrado},${d.pendiente}\n`;
      });
    }

    if (csv) {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reporteActivo}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Archivo exportado');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-AR').format(num);
  };

  const getVariacionIcon = (variacion: number) => {
    if (variacion > 0) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (variacion < 0) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-500" />;
  };

  if (loading) {
    return (
      <PermissionGuard permission="ventas.reportes.view">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </PermissionGuard>
    );
  }

  return (
    <PermissionGuard permission="ventas.reportes.view">
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reportes de Ventas</h1>
          <p className="text-muted-foreground">Genera informes detallados de tu operación comercial</p>
        </div>
      </div>

      {/* Filtros globales */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Fecha Desde</label>
              <Input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Fecha Hasta</label>
              <Input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Cliente</label>
              <Select value={clienteId || '_all'} onValueChange={(v) => setClienteId(v === '_all' ? '' : v)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Todos los clientes</SelectItem>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.legalName || c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Vendedor</label>
              <Select value={vendedorId || '_all'} onValueChange={(v) => setVendedorId(v === '_all' ? '' : v)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Todos los vendedores</SelectItem>
                  {vendedores.map((v) => (
                    <SelectItem key={v.id} value={v.id.toString()}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Agrupación</label>
              <Select value={agrupacion} onValueChange={setAgrupacion}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="diario">Diario</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="mensual">Mensual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Límite</label>
              <Select value={limite} onValueChange={setLimite}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">Top 10</SelectItem>
                  <SelectItem value="20">Top 20</SelectItem>
                  <SelectItem value="50">Top 50</SelectItem>
                  <SelectItem value="100">Top 100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de reportes */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-lg font-semibold">Reportes Disponibles</h2>
          <div className="space-y-2">
            {reportes.map((reporte) => {
              const Icon = iconMap[reporte.icon] || FileText;
              const isActive = reporteActivo === reporte.id;

              return (
                <Card
                  key={reporte.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${isActive ? 'ring-2 ring-primary bg-primary/5' : ''}`}
                  onClick={() => generarReporte(reporte.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${isActive ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-sm">{reporte.nombre}</h3>
                          {generando && isActive ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {reporte.descripcion}
                        </p>
                        <Badge variant="secondary" className="mt-2 text-[10px]">
                          {reporte.categoria}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Resultados */}
        <div className="lg:col-span-2">
          {!resultados && !generando && (
            <Card className="h-full flex items-center justify-center min-h-[400px]">
              <div className="text-center p-8">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium mb-2">Selecciona un reporte</h3>
                <p className="text-sm text-muted-foreground">
                  Haz clic en cualquier reporte de la izquierda para generar el informe
                </p>
              </div>
            </Card>
          )}

          {generando && (
            <Card className="h-full flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">Generando reporte...</p>
              </div>
            </Card>
          )}

          {resultados && !generando && (
            <div className="space-y-4">
              {/* Acciones */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {resultados.periodo?.desde || ''} - {resultados.periodo?.hasta || ''}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Generado: {resultados.generadoEn ? format(new Date(resultados.generadoEn), 'dd/MM/yyyy HH:mm', { locale: es }) : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => generarReporte(reporteActivo!)}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Actualizar
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportarCSV}>
                    <Download className="w-4 h-4 mr-2" />
                    Exportar CSV
                  </Button>
                </div>
              </div>

              {/* Contenido según tipo de reporte */}
              {reporteActivo === 'resumen-ejecutivo' && resultados.kpis && (
                <ResumenEjecutivoView data={resultados} formatCurrency={formatCurrency} getVariacionIcon={getVariacionIcon} />
              )}

              {reporteActivo === 'ventas-cliente' && resultados.cliente && (
                <VentasClienteView data={resultados} formatCurrency={formatCurrency} />
              )}

              {reporteActivo === 'ventas-vendedor' && (resultados.vendedor || resultados.ranking) && (
                <VentasVendedorView data={resultados} formatCurrency={formatCurrency} />
              )}

              {reporteActivo === 'ventas-periodo' && resultados.datos && (
                <VentasPeriodoView data={resultados} formatCurrency={formatCurrency} />
              )}

              {reporteActivo === 'cobranzas-pendientes' && resultados.aging && (
                <CobranzasPendientesView data={resultados} formatCurrency={formatCurrency} />
              )}

              {reporteActivo === 'ranking-clientes' && resultados.ranking && (
                <RankingClientesView data={resultados} formatCurrency={formatCurrency} />
              )}

              {reporteActivo === 'ranking-productos' && resultados.ranking && (
                <RankingProductosView data={resultados} formatCurrency={formatCurrency} formatNumber={formatNumber} />
              )}

              {reporteActivo === 'estado-cuenta' && resultados.cliente && (
                <EstadoCuentaView data={resultados} formatCurrency={formatCurrency} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    </PermissionGuard>
  );
}

// Componentes de visualización para cada tipo de reporte

function ResumenEjecutivoView({ data, formatCurrency, getVariacionIcon }: any) {
  return (
    <div className="space-y-4">
      {/* KPIs principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Ventas</p>
              {getVariacionIcon(data.kpis.ventas.variacion)}
            </div>
            <p className="text-xl font-bold">{formatCurrency(data.kpis.ventas.valor)}</p>
            <p className="text-xs text-muted-foreground">{data.kpis.ventas.ordenes} órdenes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Facturado</p>
              {getVariacionIcon(data.kpis.facturado.variacion)}
            </div>
            <p className="text-xl font-bold">{formatCurrency(data.kpis.facturado.valor)}</p>
            <p className="text-xs text-muted-foreground">{data.kpis.facturado.facturas} facturas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Cobrado</p>
              {getVariacionIcon(data.kpis.cobrado.variacion)}
            </div>
            <p className="text-xl font-bold text-green-600">{formatCurrency(data.kpis.cobrado.valor)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pendiente</p>
            <p className="text-xl font-bold text-orange-600">{formatCurrency(data.kpis.pendiente.valor)}</p>
            <p className="text-xs text-muted-foreground">{data.kpis.pendiente.facturas} facturas</p>
          </CardContent>
        </Card>
      </div>

      {/* Top Clientes y Vendedores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.topClientes?.map((c: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="truncate">{c.cliente}</span>
                  <span className="font-medium">{formatCurrency(c.total)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top Vendedores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.topVendedores?.map((v: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="truncate">{v.vendedor}</span>
                  <span className="font-medium">{formatCurrency(v.total)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function VentasClienteView({ data, formatCurrency }: any) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{data.cliente.legalName || data.cliente.name}</CardTitle>
          <CardDescription>CUIT: {data.cliente.cuit || 'N/A'}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Total Ventas</p>
              <p className="text-lg font-bold">{formatCurrency(data.totales.ordenesTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Facturado</p>
              <p className="text-lg font-bold">{formatCurrency(data.totales.facturasTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Pagado</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(data.totales.pagosTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Deuda Actual</p>
              <p className="text-lg font-bold text-orange-600">{formatCurrency(data.totales.deudaActual)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="ordenes">
        <TabsList>
          <TabsTrigger value="ordenes">Órdenes ({data.ordenes?.length || 0})</TabsTrigger>
          <TabsTrigger value="facturas">Facturas ({data.facturas?.length || 0})</TabsTrigger>
          <TabsTrigger value="pagos">Pagos ({data.pagos?.length || 0})</TabsTrigger>
        </TabsList>
        <TabsContent value="ordenes">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.ordenes?.slice(0, 20).map((o: any) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.numero}</TableCell>
                    <TableCell>{format(new Date(o.fechaEmision), 'dd/MM/yyyy', { locale: es })}</TableCell>
                    <TableCell><Badge variant="secondary">{o.estado}</Badge></TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(o.total))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="facturas">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.facturas?.slice(0, 20).map((f: any) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.numero}</TableCell>
                    <TableCell>{format(new Date(f.fechaEmision), 'dd/MM/yyyy', { locale: es })}</TableCell>
                    <TableCell>{f.fechaVencimiento ? format(new Date(f.fechaVencimiento), 'dd/MM/yyyy', { locale: es }) : '-'}</TableCell>
                    <TableCell><Badge variant="secondary">{f.estado}</Badge></TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(f.saldoPendiente))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="pagos">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.pagos?.slice(0, 20).map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.numero}</TableCell>
                    <TableCell>{format(new Date(p.fechaPago), 'dd/MM/yyyy', { locale: es })}</TableCell>
                    <TableCell><Badge variant="secondary">{p.estado}</Badge></TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(p.totalPago))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function VentasVendedorView({ data, formatCurrency }: any) {
  if (data.vendedor) {
    // Vista individual de vendedor
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{data.vendedor.name}</CardTitle>
            <CardDescription>{data.vendedor.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Total Ventas</p>
                <p className="text-lg font-bold">{formatCurrency(data.totales.ordenesTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Órdenes</p>
                <p className="text-lg font-bold">{data.totales.ordenesGeneradas}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ticket Promedio</p>
                <p className="text-lg font-bold">{formatCurrency(data.totales.ticketPromedio)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tasa Conversión</p>
                <p className="text-lg font-bold">{data.totales.tasaConversion}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Ranking de vendedores
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Vendedor</TableHead>
            <TableHead className="text-center">Órdenes</TableHead>
            <TableHead className="text-right">Total Ventas</TableHead>
            <TableHead className="text-right">Ticket Promedio</TableHead>
            <TableHead className="text-right">Participación</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.ranking?.map((r: any) => (
            <TableRow key={r.vendedor.id}>
              <TableCell className="font-medium">{r.posicion}</TableCell>
              <TableCell>{r.vendedor.name}</TableCell>
              <TableCell className="text-center">{r.ordenes}</TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(r.totalVentas)}</TableCell>
              <TableCell className="text-right">{formatCurrency(r.ticketPromedio)}</TableCell>
              <TableCell className="text-right">{r.participacion}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function VentasPeriodoView({ data, formatCurrency }: any) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Ventas</p>
            <p className="text-xl font-bold">{formatCurrency(data.totales.ordenesTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Órdenes</p>
            <p className="text-xl font-bold">{data.totales.ordenes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Ticket Promedio</p>
            <p className="text-xl font-bold">{formatCurrency(data.promedios.ticketPromedio)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Variación</p>
            <p className={`text-xl font-bold ${data.variacion.porcentaje >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {data.variacion.porcentaje >= 0 ? '+' : ''}{data.variacion.porcentaje}%
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Período</TableHead>
              <TableHead className="text-center">Órdenes</TableHead>
              <TableHead className="text-right">Ventas</TableHead>
              <TableHead className="text-center">Facturas</TableHead>
              <TableHead className="text-right">Facturado</TableHead>
              <TableHead className="text-right">Cobrado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.datos?.map((d: any, i: number) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{d.periodo}</TableCell>
                <TableCell className="text-center">{d.ordenes}</TableCell>
                <TableCell className="text-right">{formatCurrency(d.ordenesTotal)}</TableCell>
                <TableCell className="text-center">{d.facturas}</TableCell>
                <TableCell className="text-right">{formatCurrency(d.facturasTotal)}</TableCell>
                <TableCell className="text-right text-green-600">{formatCurrency(d.cobrado)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function CobranzasPendientesView({ data, formatCurrency }: any) {
  return (
    <div className="space-y-4">
      {/* Resumen Aging */}
      <div className="grid grid-cols-5 gap-2">
        {data.aging?.map((a: any, i: number) => (
          <Card key={i} className={a.monto > 0 ? '' : 'opacity-50'}>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">{a.categoria}</p>
              <p className="text-lg font-bold">{formatCurrency(a.monto)}</p>
              <p className="text-xs text-muted-foreground">{a.count} fact.</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Pendiente</p>
            <p className="text-xl font-bold text-orange-600">{formatCurrency(data.totales.montoTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Facturas</p>
            <p className="text-xl font-bold">{data.totales.facturas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Clientes</p>
            <p className="text-xl font-bold">{data.totales.clientes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Días Prom. Atraso</p>
            <p className="text-xl font-bold">{data.totales.diasPromedioAtraso}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Facturas Urgentes (Mayor atraso)</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Factura</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Vencimiento</TableHead>
              <TableHead className="text-center">Días Atraso</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.facturasUrgentes?.map((f: any) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{f.numero}</TableCell>
                <TableCell>{f.client?.legalName || f.client?.name}</TableCell>
                <TableCell>{f.fechaVencimiento ? format(new Date(f.fechaVencimiento), 'dd/MM/yyyy', { locale: es }) : '-'}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={f.diasAtraso > 60 ? 'destructive' : f.diasAtraso > 30 ? 'default' : 'secondary'}>
                    {f.diasAtraso} días
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(f.saldoPendiente)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function RankingClientesView({ data, formatCurrency }: any) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Ventas</p>
            <p className="text-xl font-bold">{formatCurrency(data.totales.totalVentas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Clientes Activos</p>
            <p className="text-xl font-bold">{data.totales.clientesConCompras}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Ticket Promedio</p>
            <p className="text-xl font-bold">{formatCurrency(data.totales.ticketPromedioGeneral)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Concentración 80%</p>
            <p className="text-xl font-bold">{data.totales.concentracion?.clientesPara80Porciento} clientes</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-center">Órdenes</TableHead>
              <TableHead className="text-right">Total Compras</TableHead>
              <TableHead className="text-right">Ticket Prom.</TableHead>
              <TableHead className="text-right">Participación</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.ranking?.map((r: any) => (
              <TableRow key={r.cliente.id}>
                <TableCell className="font-medium">{r.posicion}</TableCell>
                <TableCell>{r.cliente.nombre}</TableCell>
                <TableCell className="text-center">{r.metricas.cantidadOrdenes}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(r.metricas.totalCompras)}</TableCell>
                <TableCell className="text-right">{formatCurrency(r.metricas.ticketPromedio)}</TableCell>
                <TableCell className="text-right">{r.participacion}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function RankingProductosView({ data, formatCurrency, formatNumber }: any) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Ventas</p>
            <p className="text-xl font-bold">{formatCurrency(data.totales.montoTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Unidades Vendidas</p>
            <p className="text-xl font-bold">{formatNumber(data.totales.cantidadTotalUnidades)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Productos Vendidos</p>
            <p className="text-xl font-bold">{data.totales.productosVendidos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Concentración 80%</p>
            <p className="text-xl font-bold">{data.totales.concentracion?.productosPara80Porciento} prod.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-center">Cantidad</TableHead>
              <TableHead className="text-right">Monto Total</TableHead>
              <TableHead className="text-right">Participación</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.ranking?.map((r: any) => (
              <TableRow key={r.producto.id}>
                <TableCell className="font-medium">{r.posicion}</TableCell>
                <TableCell>{r.producto.nombre}</TableCell>
                <TableCell className="text-muted-foreground">{r.producto.sku || '-'}</TableCell>
                <TableCell className="text-center">{formatNumber(r.metricas.cantidadVendida)}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(r.metricas.montoTotal)}</TableCell>
                <TableCell className="text-right">{r.participacion}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {data.porCategoria?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ventas por Categoría</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.porCategoria.map((c: any, i: number) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm">{c.categoria}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">{c.productos} productos</span>
                    <span className="font-medium">{formatCurrency(c.montoTotal)}</span>
                    <Badge variant="secondary">{c.participacion}%</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EstadoCuentaView({ data, formatCurrency }: any) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{data.cliente.legalName || data.cliente.name}</CardTitle>
          <CardDescription>CUIT: {data.cliente.cuit || 'N/A'} | Email: {data.cliente.email || 'N/A'}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Saldo Actual</p>
              <p className={`text-lg font-bold ${Number(data.totales.saldoActual) > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                {formatCurrency(data.totales.saldoActual)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Límite de Crédito</p>
              <p className="text-lg font-bold">{data.cliente.creditLimit ? formatCurrency(Number(data.cliente.creditLimit)) : 'Sin límite'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Crédito Disponible</p>
              <p className={`text-lg font-bold ${(data.totales.creditoDisponible || 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {data.totales.creditoDisponible !== null ? formatCurrency(data.totales.creditoDisponible) : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Pendiente</p>
              <p className="text-lg font-bold text-orange-600">{formatCurrency(data.totales.totalPendiente)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="movimientos">
        <TabsList>
          <TabsTrigger value="movimientos">Movimientos ({data.movimientos?.length || 0})</TabsTrigger>
          <TabsTrigger value="pendientes">Pendientes ({data.facturasPendientes?.length || 0})</TabsTrigger>
          <TabsTrigger value="pagos">Pagos ({data.pagos?.length || 0})</TabsTrigger>
        </TabsList>
        <TabsContent value="movimientos">
          <Card>
            {data.saldoInicial !== 0 && (
              <div className="px-4 py-2 bg-muted text-sm">
                Saldo inicial al {data.periodo.desde}: <span className="font-medium">{formatCurrency(data.saldoInicial)}</span>
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Comprobante</TableHead>
                  <TableHead className="text-right">Debe</TableHead>
                  <TableHead className="text-right">Haber</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.movimientos?.slice(0, 50).map((m: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell>{format(new Date(m.fecha), 'dd/MM/yyyy', { locale: es })}</TableCell>
                    <TableCell><Badge variant="outline">{m.tipo}</Badge></TableCell>
                    <TableCell>{m.comprobante}</TableCell>
                    <TableCell className="text-right">{Number(m.debe) > 0 ? formatCurrency(Number(m.debe)) : '-'}</TableCell>
                    <TableCell className="text-right text-green-600">{Number(m.haber) > 0 ? formatCurrency(Number(m.haber)) : '-'}</TableCell>
                    <TableCell className={`text-right font-medium ${m.saldoAcumulado > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      {formatCurrency(m.saldoAcumulado)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="pendientes">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Factura</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.facturasPendientes?.map((f: any) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.numero}</TableCell>
                    <TableCell>{format(new Date(f.fechaEmision), 'dd/MM/yyyy', { locale: es })}</TableCell>
                    <TableCell>{f.fechaVencimiento ? format(new Date(f.fechaVencimiento), 'dd/MM/yyyy', { locale: es }) : '-'}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(f.total))}</TableCell>
                    <TableCell className="text-right font-medium text-orange-600">{formatCurrency(Number(f.saldoPendiente))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="pagos">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recibo</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.pagos?.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.numero}</TableCell>
                    <TableCell>{format(new Date(p.fechaPago), 'dd/MM/yyyy', { locale: es })}</TableCell>
                    <TableCell><Badge variant="secondary">{p.estado}</Badge></TableCell>
                    <TableCell className="text-right font-medium text-green-600">{formatCurrency(Number(p.totalPago))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
