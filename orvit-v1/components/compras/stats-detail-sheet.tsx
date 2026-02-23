'use client';

import { useState, useEffect } from 'react';
import { formatDate } from '@/lib/date-utils';
import {
 Sheet,
 SheetContent,
 SheetHeader,
 SheetTitle,
 SheetDescription,
} from '@/components/ui/sheet';
import {
 Card,
 CardContent,
 CardHeader,
 CardTitle,
} from '@/components/ui/card';
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
 ResponsiveContainer,
 BarChart,
 Bar,
 XAxis,
 YAxis,
 Tooltip,
 PieChart,
 Pie,
 Cell,
 AreaChart,
 Area,
 CartesianGrid,
 LineChart,
 Line,
 Legend,
} from 'recharts';
import {
 DollarSign,
 TrendingUp,
 TrendingDown,
 Calendar,
 Package,
 Building2,
 FileText,
 Clock,
 AlertTriangle,
 ChevronRight,
 ShoppingCart,
 Truck,
 FolderTree,
 Shield,
 Users,
 BarChart3,
 Target,
 Percent,
 Timer,
 AlertCircle,
 CheckCircle2,
} from 'lucide-react';
import { formatCurrency, cn, formatNumber } from '@/lib/utils';

type StatType = 'compras' | 'deuda' | 'ordenes' | 'flujo' | 'items' | 'recepciones' | 'categorias' | 'servicios';

interface StatsDetailSheetProps {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 statType: StatType;
 onNavigate?: (path: string) => void;
}

const STAT_TITLES: Record<string, { title: string; description: string; icon: React.ElementType }> = {
 compras: { title: 'Análisis de Compras', description: 'Desglose detallado con análisis ABC y tendencias', icon: ShoppingCart },
 deuda: { title: 'Análisis de Deuda', description: 'Estado de deuda con aging detallado y DSO', icon: AlertTriangle },
 ordenes: { title: 'Análisis de Órdenes', description: 'Estado, tiempos de procesamiento y métricas', icon: FileText },
 flujo: { title: 'Flujo de Pagos', description: 'Proyección de pagos a 90 días', icon: Calendar },
 items: { title: 'Top Items Comprados', description: 'Análisis ABC de productos con evolución de precios', icon: Package },
 recepciones: { title: 'Análisis de Recepciones', description: 'Recepciones con métricas de calidad y lead time', icon: Truck },
 categorias: { title: 'Análisis por Categoría', description: 'Gasto por categoría de insumos', icon: FolderTree },
 servicios: { title: 'Contratos de Servicios', description: 'Servicios, seguros y contratos activos', icon: Shield },
};

const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];
const ABC_COLORS = { A: '#10B981', B: '#F59E0B', C: '#6B7280' };

function formatCompact(value: number): string {
 if (value >= 1000000) return `$${formatNumber(value / 1000000, 1)}M`;
 if (value >= 1000) return `$${Math.round(value / 1000)}K`;
 return formatCurrency(value);
}

export function StatsDetailSheet({
 open,
 onOpenChange,
 statType,
 onNavigate
}: StatsDetailSheetProps) {
 const [data, setData] = useState<any>(null);
 const [loading, setLoading] = useState(false);

 useEffect(() => {
 if (open) {
 fetchData();
 }
 }, [open, statType]);

 const fetchData = async () => {
 setLoading(true);
 try {
 const res = await fetch(`/api/compras/dashboard/stats-detail?type=${statType}`);
 if (res.ok) {
 const result = await res.json();
 setData(result);
 }
 } catch (error) {
 console.error('Error fetching stats detail:', error);
 } finally {
 setLoading(false);
 }
 };

 const info = STAT_TITLES[statType];
 const Icon = info.icon;

 const renderContent = () => {
 if (loading) {
 return (
 <div className="space-y-4">
 <Skeleton className="h-32 w-full" />
 <Skeleton className="h-64 w-full" />
 <Skeleton className="h-48 w-full" />
 </div>
 );
 }

 if (!data) {
 return <p className="text-muted-foreground text-center py-8">No hay datos disponibles</p>;
 }

 switch (statType) {
 case 'compras':
 return <ComprasDetail data={data} onNavigate={onNavigate} />;
 case 'deuda':
 return <DeudaDetail data={data} onNavigate={onNavigate} />;
 case 'ordenes':
 return <OrdenesDetail data={data} onNavigate={onNavigate} />;
 case 'flujo':
 return <FlujoDetail data={data} onNavigate={onNavigate} />;
 case 'items':
 return <ItemsDetail data={data} />;
 case 'recepciones':
 return <RecepcionesDetail data={data} onNavigate={onNavigate} />;
 case 'categorias':
 return <CategoriasDetail data={data} />;
 case 'servicios':
 return <ServiciosDetail data={data} onNavigate={onNavigate} />;
 default:
 return null;
 }
 };

 return (
 <Sheet open={open} onOpenChange={onOpenChange}>
 <SheetContent size="lg" className="overflow-y-auto">
 <SheetHeader>
 <SheetTitle className="flex items-center gap-2">
 <Icon className="h-5 w-5" />
 {info.title}
 </SheetTitle>
 <SheetDescription>{info.description}</SheetDescription>
 </SheetHeader>

 <div className="mt-6">
 {renderContent()}
 </div>
 </SheetContent>
 </Sheet>
 );
}

// ============ COMPRAS DETAIL ============
function ComprasDetail({ data, onNavigate }: { data: any; onNavigate?: (path: string) => void }) {
 const variacionMes = data.resumen?.variacionMes || 0;
 const variacionYoY = data.resumen?.variacionYoY || 0;

 return (
 <div className="space-y-6">
 {/* Resumen Cards */}
 <div className="grid grid-cols-2 gap-3">
 <Card className="bg-primary/5">
 <CardContent className="pt-4">
 <p className="text-xs text-muted-foreground">Hoy</p>
 <p className="text-xl font-bold">{formatCompact(data.resumen?.hoy?.total || 0)}</p>
 <p className="text-xs text-muted-foreground">{data.resumen?.hoy?.cantidad || 0} facturas</p>
 </CardContent>
 </Card>
 <Card className="bg-primary/5">
 <CardContent className="pt-4">
 <p className="text-xs text-muted-foreground">Esta Semana</p>
 <p className="text-xl font-bold">{formatCompact(data.resumen?.semana?.total || 0)}</p>
 <p className="text-xs text-muted-foreground">{data.resumen?.semana?.cantidad || 0} facturas</p>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="pt-4">
 <p className="text-xs text-muted-foreground">Este Mes</p>
 <p className="text-xl font-bold">{formatCompact(data.resumen?.mes?.total || 0)}</p>
 <div className="flex items-center gap-1 mt-1">
 {variacionMes !== 0 && (
 <span className={cn('flex items-center gap-0.5 text-xs', variacionMes > 0 ? 'text-destructive' : 'text-success')}>
 {variacionMes > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
 {formatNumber(Math.abs(variacionMes), 1)}%
 </span>
 )}
 <span className="text-xs text-muted-foreground">vs mes ant.</span>
 </div>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="pt-4">
 <p className="text-xs text-muted-foreground">Este Año</p>
 <p className="text-xl font-bold">{formatCompact(data.resumen?.anio?.total || 0)}</p>
 <div className="flex items-center gap-1 mt-1">
 {variacionYoY !== 0 && (
 <span className={cn('flex items-center gap-0.5 text-xs', variacionYoY > 0 ? 'text-destructive' : 'text-success')}>
 {variacionYoY > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
 {formatNumber(Math.abs(variacionYoY), 1)}%
 </span>
 )}
 <span className="text-xs text-muted-foreground">vs año ant.</span>
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Métricas Ejecutivas */}
 <Card className="bg-info-muted0/5 border-primary/20">
 <CardHeader className="pb-2">
 <CardTitle className="text-sm flex items-center gap-2">
 <BarChart3 className="h-4 w-4" />
 Métricas Ejecutivas
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-3 gap-4">
 <div>
 <p className="text-xs text-muted-foreground">Promedio Mensual</p>
 <p className="text-lg font-bold">{formatCompact(data.resumen?.promedioMensual || 0)}</p>
 </div>
 <div>
 <p className="text-xs text-muted-foreground">Ticket Promedio</p>
 <p className="text-lg font-bold">{formatCompact(data.resumen?.ticketPromedio || 0)}</p>
 </div>
 <div>
 <p className="text-xs text-muted-foreground">Concentración Top 3</p>
 <p className="text-lg font-bold">{formatNumber(data.metricas?.concentracionTop3 || 0, 1)}%</p>
 </div>
 </div>
 </CardContent>
 </Card>

 {/* Clasificación ABC de Proveedores */}
 {data.metricas?.clasificacionABC && (
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm flex items-center gap-2">
 <Target className="h-4 w-4" />
 Clasificación ABC Proveedores
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="flex gap-4">
 {['A', 'B', 'C'].map((clase) => (
 <div key={clase} className="flex items-center gap-2">
 <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ABC_COLORS[clase as keyof typeof ABC_COLORS] }} />
 <span className="text-sm font-medium">Clase {clase}:</span>
 <span className="text-sm">{data.metricas.clasificacionABC[clase]} proveedores</span>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 )}

 {/* Compras por Categoría */}
 {data.porCategoria && data.porCategoria.length > 0 && (
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm flex items-center gap-2">
 <FolderTree className="h-4 w-4" />
 Gasto por Categoría (Este Mes)
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-2">
 {data.porCategoria.slice(0, 6).map((c: any, idx: number) => (
 <div key={c.categoria} className="space-y-1">
 <div className="flex items-center justify-between text-sm">
 <span>{c.categoria}</span>
 <span className="font-medium">{formatCompact(c.total)}</span>
 </div>
 <Progress value={c.porcentaje} className="h-2" />
 <p className="text-xs text-muted-foreground">{formatNumber(c.porcentaje, 1)}% del total</p>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 )}

 {/* Tendencia Mensual */}
 {data.porMes && data.porMes.length > 0 && (
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm">Tendencia Mensual (12 meses)</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="h-48">
 <ResponsiveContainer width="100%" height="100%">
 <AreaChart data={data.porMes}>
 <defs>
 <linearGradient id="colorMonth" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
 <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
 <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
 <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatCompact(v)} />
 <Tooltip formatter={(value: number) => formatCurrency(value)} />
 <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" fill="url(#colorMonth)" />
 </AreaChart>
 </ResponsiveContainer>
 </div>
 </CardContent>
 </Card>
 )}

 {/* Top proveedores con ABC */}
 {data.topProveedores && data.topProveedores.length > 0 && (
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm">Top Proveedores del Mes (con ABC)</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-2">
 {data.topProveedores.map((p: any, idx: number) => (
 <div
 key={p.id}
 className="flex items-center justify-between p-2 rounded hover:bg-muted/50 cursor-pointer"
 onClick={() => onNavigate?.(`/administracion/compras/proveedores/${p.id}`)}
 >
 <div className="flex items-center gap-2">
 <span className="text-xs text-muted-foreground w-5">{idx + 1}.</span>
 <Badge
 variant="outline"
 style={{
 backgroundColor: ABC_COLORS[p.clasificacion as keyof typeof ABC_COLORS] + '20',
 borderColor: ABC_COLORS[p.clasificacion as keyof typeof ABC_COLORS],
 color: ABC_COLORS[p.clasificacion as keyof typeof ABC_COLORS]
 }}
 >
 {p.clasificacion}
 </Badge>
 <span className="text-sm font-medium">{p.nombre}</span>
 </div>
 <div className="flex items-center gap-2">
 <span className="text-xs text-muted-foreground">{formatNumber(p.porcentaje, 1)}%</span>
 <span className="text-sm font-bold">{formatCompact(p.total)}</span>
 <ChevronRight className="h-4 w-4 text-muted-foreground" />
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

// ============ DEUDA DETAIL ============
function DeudaDetail({ data, onNavigate }: { data: any; onNavigate?: (path: string) => void }) {
 const porVencimiento = data.porVencimiento || {};

 return (
 <div className="space-y-6">
 {/* Resumen con DSO */}
 <div className="grid grid-cols-2 gap-3">
 <Card className="bg-destructive/5">
 <CardContent className="pt-4">
 <p className="text-xs text-muted-foreground">Deuda Total</p>
 <p className="text-xl font-bold">{formatCompact(data.resumen?.deudaTotal || 0)}</p>
 <p className="text-xs text-muted-foreground">{data.resumen?.cantidadPendientes || 0} facturas</p>
 </CardContent>
 </Card>
 <Card className={data.resumen?.facturasVencidas > 0 ? "bg-destructive/100/10" : "bg-success-muted0/10"}>
 <CardContent className="pt-4">
 <p className="text-xs text-muted-foreground">Vencido</p>
 <p className="text-xl font-bold">{formatCompact(data.resumen?.montoVencido || 0)}</p>
 <p className="text-xs text-muted-foreground">{data.resumen?.facturasVencidas || 0} facturas</p>
 </CardContent>
 </Card>
 </div>

 {/* Métricas de Salud Financiera */}
 <Card className="bg-info-muted0/5 border-primary/20">
 <CardHeader className="pb-2">
 <CardTitle className="text-sm flex items-center gap-2">
 <Timer className="h-4 w-4" />
 Métricas Financieras
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <p className="text-xs text-muted-foreground">DSO (Días de Pago)</p>
 <p className="text-2xl font-bold">{data.resumen?.dso || 0}</p>
 <p className="text-xs text-muted-foreground">días promedio para pagar</p>
 </div>
 <div>
 <p className="text-xs text-muted-foreground">Antigüedad Promedio</p>
 <p className="text-2xl font-bold">{data.resumen?.antiguedadPromedioDias || 0}</p>
 <p className="text-xs text-muted-foreground">días de deuda vencida</p>
 </div>
 </div>
 </CardContent>
 </Card>

 {/* Deuda por vencimiento (Aging) */}
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm">Aging de Deuda</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-3">
 {[
 { key: 'vencido90', label: '+90 días vencido', color: 'bg-destructive' },
 { key: 'vencido60', label: '60-90 días vencido', color: 'bg-destructive' },
 { key: 'vencido30', label: '30-60 días vencido', color: 'bg-destructive/100' },
 { key: 'vencido', label: '0-30 días vencido', color: 'bg-destructive' },
 { key: 'dias7', label: 'Próximos 7 días', color: 'bg-warning-muted0' },
 { key: 'dias15', label: '8-15 días', color: 'bg-warning-muted0' },
 { key: 'dias30', label: '16-30 días', color: 'bg-info-muted0' },
 { key: 'mas30', label: 'Más de 30 días', color: 'bg-muted-foreground' },
 ].map((item) => {
 const bucket = porVencimiento[item.key] || { total: 0, cantidad: 0 };
 const total = Number(bucket.total || 0);
 const percent = data.resumen?.deudaTotal ? (total / data.resumen.deudaTotal) * 100 : 0;

 if (total === 0) return null;

 return (
 <div key={item.key} className="space-y-1">
 <div className="flex items-center justify-between text-sm">
 <div className="flex items-center gap-2">
 <div className={cn('w-2 h-2 rounded-full', item.color)} />
 <span>{item.label}</span>
 </div>
 <span className="font-medium">{formatCompact(total)}</span>
 </div>
 <Progress value={percent} className="h-2" />
 <p className="text-xs text-muted-foreground">
 {Number(bucket.cantidad || 0)} facturas ({formatNumber(percent, 1)}%)
 </p>
 </div>
 );
 })}
 </div>
 </CardContent>
 </Card>

 {/* Deuda por proveedor con límite de crédito */}
 {data.porProveedor && data.porProveedor.length > 0 && (
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm">Deuda por Proveedor</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="flex gap-4">
 <div className="w-1/2">
 <div className="h-48">
 <ResponsiveContainer width="100%" height="100%">
 <PieChart>
 <Pie
 data={data.porProveedor.slice(0, 6)}
 dataKey="total"
 nameKey="nombre"
 cx="50%"
 cy="50%"
 innerRadius={30}
 outerRadius={70}
 >
 {data.porProveedor.slice(0, 6).map((_: any, idx: number) => (
 <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
 ))}
 </Pie>
 <Tooltip formatter={(value: number) => formatCurrency(value)} />
 </PieChart>
 </ResponsiveContainer>
 </div>
 </div>
 <div className="w-1/2 space-y-2">
 {data.porProveedor.slice(0, 6).map((p: any, idx: number) => (
 <div key={p.id} className="flex items-center gap-2 text-xs">
 <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[idx] }} />
 <span className="truncate flex-1">{p.nombre}</span>
 <span className="font-medium">{formatCompact(p.total)}</span>
 {p.utilizacion !== null && (
 <Badge variant={p.utilizacion > 80 ? "destructive" : "outline"} className="text-xs">
 {p.utilizacion}%
 </Badge>
 )}
 </div>
 ))}
 </div>
 </div>
 </CardContent>
 </Card>
 )}

 {/* Historia de Pagos */}
 {data.historiaPagos && data.historiaPagos.length > 0 && (
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm">Historia de Pagos (6 meses)</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="h-40">
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={data.historiaPagos}>
 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
 <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
 <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatCompact(v)} />
 <Tooltip formatter={(value: number) => formatCurrency(value)} />
 <Bar dataKey="totalPagado" fill="#10B981" radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 </div>
 </CardContent>
 </Card>
 )}

 {/* Facturas vencidas */}
 {data.facturasVencidas && data.facturasVencidas.length > 0 && (
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm text-destructive flex items-center gap-2">
 <AlertCircle className="h-4 w-4" />
 Facturas Vencidas
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-2 max-h-48 overflow-y-auto">
 {data.facturasVencidas.map((f: any) => (
 <div
 key={f.id}
 className="flex items-center justify-between p-2 rounded bg-destructive/5 hover:bg-destructive/10 cursor-pointer"
 onClick={() => onNavigate?.(`/administracion/compras/comprobantes/${f.id}`)}
 >
 <div>
 <p className="text-sm font-medium">{f.numero}</p>
 <p className="text-xs text-muted-foreground">{f.proveedor}</p>
 </div>
 <div className="text-right">
 <p className="text-sm font-bold">{formatCurrency(f.total)}</p>
 <p className="text-xs text-destructive">
 {f.diasVencido} días vencido
 </p>
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

// ============ ORDENES DETAIL ============
function OrdenesDetail({ data, onNavigate }: { data: any; onNavigate?: (path: string) => void }) {
 return (
 <div className="space-y-6">
 {/* Por estado */}
 {data.porEstado && data.porEstado.length > 0 && (
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm">Órdenes por Estado</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-2 gap-3">
 {data.porEstado.map((e: any) => (
 <div key={e.estado} className="p-3 bg-muted/30 rounded-lg">
 <p className="text-xs text-muted-foreground">{e.estado}</p>
 <p className="text-lg font-bold">{e.cantidad}</p>
 <p className="text-xs text-muted-foreground">{formatCompact(e.total)}</p>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 )}

 {/* Métricas de Procesamiento */}
 <Card className="bg-info-muted0/5 border-primary/20">
 <CardHeader className="pb-2">
 <CardTitle className="text-sm flex items-center gap-2">
 <Clock className="h-4 w-4" />
 Tiempos de Procesamiento
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-3 gap-4">
 <div>
 <p className="text-xs text-muted-foreground">Promedio</p>
 <p className="text-2xl font-bold">{formatNumber(data.tiempoProcesamientoDias?.promedio || 0, 1)}</p>
 <p className="text-xs text-muted-foreground">días</p>
 </div>
 <div>
 <p className="text-xs text-muted-foreground">Mínimo</p>
 <p className="text-2xl font-bold">{formatNumber(data.tiempoProcesamientoDias?.minimo || 0, 1)}</p>
 <p className="text-xs text-muted-foreground">días</p>
 </div>
 <div>
 <p className="text-xs text-muted-foreground">Máximo</p>
 <p className="text-2xl font-bold">{formatNumber(data.tiempoProcesamientoDias?.maximo || 0, 1)}</p>
 <p className="text-xs text-muted-foreground">días</p>
 </div>
 </div>
 </CardContent>
 </Card>

 {/* Métricas de Rendimiento */}
 {data.metricas && (
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm">Métricas de Rendimiento</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
 <div>
 <p className="text-sm font-medium">Tasa de Rechazo</p>
 <p className="text-xs text-muted-foreground">
 {data.metricas.ordenesRechazadas} de {data.metricas.totalOrdenes} órdenes
 </p>
 </div>
 <div className={cn('text-2xl font-bold', data.metricas.tasaRechazo > 5 ? 'text-destructive' : 'text-success')}>
 {formatNumber(data.metricas.tasaRechazo, 1)}%
 </div>
 </div>
 </CardContent>
 </Card>
 )}

 {/* Pendientes de Aprobación */}
 {data.pendientesAprobacion && data.pendientesAprobacion.length > 0 && (
 <Card className="border-warning-muted">
 <CardHeader className="pb-2">
 <CardTitle className="text-sm text-warning-muted-foreground flex items-center gap-2">
 <AlertTriangle className="h-4 w-4" />
 Pendientes de Aprobación
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-2">
 {data.pendientesAprobacion.map((o: any) => (
 <div
 key={o.id}
 className="flex items-center justify-between p-2 rounded bg-warning-muted0/5 hover:bg-warning-muted0/10 cursor-pointer"
 onClick={() => onNavigate?.(`/administracion/compras/ordenes/${o.id}`)}
 >
 <div>
 <p className="text-sm font-medium">{o.numero}</p>
 <p className="text-xs text-muted-foreground">{o.proveedor}</p>
 </div>
 <div className="text-right">
 <p className="text-sm font-bold">{formatCompact(o.total)}</p>
 <p className="text-xs text-warning-muted-foreground">{o.diasPendiente} días esperando</p>
 </div>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 )}

 {/* Tendencia mensual */}
 {data.porMes && data.porMes.length > 0 && (
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm">Órdenes por Mes</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="h-40">
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={data.porMes}>
 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
 <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
 <YAxis tick={{ fontSize: 10 }} />
 <Tooltip />
 <Bar dataKey="cantidad" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 </div>
 </CardContent>
 </Card>
 )}

 {/* Últimas órdenes */}
 {data.ultimasOrdenes && data.ultimasOrdenes.length > 0 && (
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm">Últimas Órdenes</CardTitle>
 </CardHeader>
 <CardContent>
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Número</TableHead>
 <TableHead>Proveedor</TableHead>
 <TableHead>Estado</TableHead>
 <TableHead className="text-right">Total</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {data.ultimasOrdenes.slice(0, 8).map((o: any) => (
 <TableRow
 key={o.id}
 className="cursor-pointer hover:bg-muted/50"
 onClick={() => onNavigate?.(`/administracion/compras/ordenes/${o.id}`)}
 >
 <TableCell className="font-medium">{o.numero}</TableCell>
 <TableCell className="text-muted-foreground">{o.proveedor}</TableCell>
 <TableCell><Badge variant="outline">{o.estado}</Badge></TableCell>
 <TableCell className="text-right">{formatCompact(o.total)}</TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </CardContent>
 </Card>
 )}
 </div>
 );
}

// ============ FLUJO DETAIL ============
function FlujoDetail({ data, onNavigate }: { data: any; onNavigate?: (path: string) => void }) {
 return (
 <div className="space-y-6">
 {/* Resumen de proyección */}
 <div className="grid grid-cols-5 gap-2">
 {[
 { key: 'proximo7', label: '7 días', color: 'bg-destructive/100/10' },
 { key: 'proximo15', label: '15 días', color: 'bg-warning-muted0/10' },
 { key: 'proximo30', label: '30 días', color: 'bg-warning-muted0/10' },
 { key: 'proximo60', label: '60 días', color: 'bg-info-muted0/10' },
 { key: 'proximo90', label: '90 días', color: 'bg-muted0/10' },
 ].map((item) => (
 <Card key={item.key} className={item.color}>
 <CardContent className="pt-3 pb-3 px-2">
 <p className="text-xs text-muted-foreground">{item.label}</p>
 <p className="text-sm font-bold">{formatCompact(data.resumen?.[item.key]?.total || 0)}</p>
 <p className="text-xs text-muted-foreground">{data.resumen?.[item.key]?.cantidad || 0} fact.</p>
 </CardContent>
 </Card>
 ))}
 </div>

 {/* Calendario de pagos */}
 {data.calendarioPagos && data.calendarioPagos.length > 0 && (
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm">Calendario de Vencimientos (30 días)</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="h-48">
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={data.calendarioPagos}>
 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
 <XAxis
 dataKey="dia"
 tick={{ fontSize: 9 }}
 tickFormatter={(v) => new Date(v).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
 />
 <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatCompact(v)} />
 <Tooltip
 formatter={(value: number) => formatCurrency(value)}
 labelFormatter={(label) => formatDate(label)}
 />
 <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 </div>
 </CardContent>
 </Card>
 )}

 {/* Proyección semanal */}
 {data.proyeccionSemanal && data.proyeccionSemanal.length > 0 && (
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm">Proyección Semanal (90 días)</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="h-40">
 <ResponsiveContainer width="100%" height="100%">
 <AreaChart data={data.proyeccionSemanal}>
 <defs>
 <linearGradient id="colorProyeccion" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
 <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
 <XAxis dataKey="semana" tick={{ fontSize: 10 }} />
 <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatCompact(v)} />
 <Tooltip formatter={(value: number) => formatCurrency(value)} />
 <Area type="monotone" dataKey="total" stroke="#F59E0B" fill="url(#colorProyeccion)" />
 </AreaChart>
 </ResponsiveContainer>
 </div>
 </CardContent>
 </Card>
 )}

 {/* Facturas próximas a vencer (7 días) */}
 {data.resumen?.proximo7?.facturas && data.resumen.proximo7.facturas.length > 0 && (
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm text-warning-muted-foreground">Vencen en 7 días</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-2">
 {data.resumen.proximo7.facturas.map((f: any) => (
 <div
 key={f.id}
 className="flex items-center justify-between p-2 rounded bg-warning-muted0/5 hover:bg-warning-muted0/10 cursor-pointer"
 onClick={() => onNavigate?.(`/administracion/compras/comprobantes/${f.id}`)}
 >
 <div>
 <p className="text-sm font-medium">{f.numero}</p>
 <p className="text-xs text-muted-foreground">{f.proveedor}</p>
 </div>
 <div className="text-right">
 <p className="text-sm font-bold">{formatCurrency(f.total)}</p>
 <p className="text-xs text-warning-muted-foreground">
 Vence {formatDate(f.vencimiento)}
 </p>
 </div>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 )}

 {/* Pagos realizados este mes */}
 <Card className="bg-success-muted0/5">
 <CardContent className="pt-4">
 <div className="flex items-center gap-3">
 <CheckCircle2 className="h-8 w-8 text-success" />
 <div>
 <p className="text-xs text-muted-foreground">Pagos Realizados (Este Mes)</p>
 <p className="text-2xl font-bold">{formatCompact(data.pagosRealizadosMes?.total || 0)}</p>
 <p className="text-xs text-muted-foreground">{data.pagosRealizadosMes?.cantidad || 0} pagos</p>
 </div>
 </div>
 </CardContent>
 </Card>
 </div>
 );
}

// ============ ITEMS DETAIL ============
function ItemsDetail({ data }: { data: any }) {
 if (!data.items || data.items.length === 0) {
 return <p className="text-muted-foreground text-center py-8">No hay datos de items</p>;
 }

 const totalComprado = data.items.reduce((s: number, i: any) => s + i.totalComprado, 0);

 return (
 <div className="space-y-6">
 {/* Métricas ABC */}
 {data.metricas && (
 <Card className="bg-info-muted0/5 border-primary/20">
 <CardHeader className="pb-2">
 <CardTitle className="text-sm flex items-center gap-2">
 <Target className="h-4 w-4" />
 Clasificación ABC de Items
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-4 gap-4">
 <div>
 <p className="text-xs text-muted-foreground">Clase A (80%)</p>
 <p className="text-2xl font-bold text-success">{data.metricas.clasificacionABC?.A || 0}</p>
 <p className="text-xs text-muted-foreground">items críticos</p>
 </div>
 <div>
 <p className="text-xs text-muted-foreground">Clase B (15%)</p>
 <p className="text-2xl font-bold text-warning-muted-foreground">{data.metricas.clasificacionABC?.B || 0}</p>
 <p className="text-xs text-muted-foreground">items intermedios</p>
 </div>
 <div>
 <p className="text-xs text-muted-foreground">Clase C (5%)</p>
 <p className="text-2xl font-bold text-foreground">{data.metricas.clasificacionABC?.C || 0}</p>
 <p className="text-xs text-muted-foreground">items comunes</p>
 </div>
 <div>
 <p className="text-xs text-muted-foreground">Multi-Proveedor</p>
 <p className="text-2xl font-bold text-purple-600">{data.metricas.itemsMultiProveedor || 0}</p>
 <p className="text-xs text-muted-foreground">items diversificados</p>
 </div>
 </div>
 </CardContent>
 </Card>
 )}

 {/* Evolución de precios top items */}
 {data.evolucionPrecios && Object.keys(data.evolucionPrecios).length > 0 && (
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm">Evolución de Precios (Top 5)</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="h-48">
 <ResponsiveContainer width="100%" height="100%">
 <LineChart>
 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
 <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
 <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatCompact(v)} />
 <Tooltip formatter={(value: number) => formatCurrency(value)} />
 <Legend />
 {Object.entries(data.evolucionPrecios).slice(0, 5).map(([item, values], idx) => (
 <Line
 key={item}
 type="monotone"
 data={values as any[]}
 dataKey="precio"
 name={item.substring(0, 20)}
 stroke={PIE_COLORS[idx]}
 strokeWidth={2}
 dot={false}
 />
 ))}
 </LineChart>
 </ResponsiveContainer>
 </div>
 </CardContent>
 </Card>
 )}

 {/* Tabla de items */}
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>#</TableHead>
 <TableHead>ABC</TableHead>
 <TableHead>Descripción</TableHead>
 <TableHead className="text-right">Total</TableHead>
 <TableHead className="text-right">Var. Precio</TableHead>
 <TableHead className="text-right">Provs.</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {data.items.map((item: any, idx: number) => (
 <TableRow key={item.descripcion}>
 <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
 <TableCell>
 <Badge
 variant="outline"
 style={{
 backgroundColor: ABC_COLORS[item.clasificacion as keyof typeof ABC_COLORS] + '20',
 borderColor: ABC_COLORS[item.clasificacion as keyof typeof ABC_COLORS],
 color: ABC_COLORS[item.clasificacion as keyof typeof ABC_COLORS]
 }}
 >
 {item.clasificacion}
 </Badge>
 </TableCell>
 <TableCell>
 <div>
 <p className="font-medium truncate max-w-[180px]">{item.descripcion}</p>
 <p className="text-xs text-muted-foreground">
 Prom: {formatCurrency(item.precioPromedio)}
 </p>
 </div>
 </TableCell>
 <TableCell className="text-right">
 <div>
 <p className="font-bold">{formatCompact(item.totalComprado)}</p>
 <p className="text-xs text-muted-foreground">
 {formatNumber(item.porcentaje, 1)}%
 </p>
 </div>
 </TableCell>
 <TableCell className="text-right">
 {item.variacionPrecio > 0 && (
 <span className={cn('text-xs', item.variacionPrecio > 20 ? 'text-destructive' : 'text-muted-foreground')}>
 +{formatNumber(item.variacionPrecio, 0)}%
 </span>
 )}
 </TableCell>
 <TableCell className="text-right">
 <Badge variant="outline">{item.cantidadProveedores}</Badge>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 );
}

// ============ RECEPCIONES DETAIL ============
function RecepcionesDetail({ data, onNavigate }: { data: any; onNavigate?: (path: string) => void }) {
 const variacion = data.resumen?.variacion || 0;

 return (
 <div className="space-y-6">
 {/* Resumen */}
 <div className="grid grid-cols-3 gap-3">
 <Card className="bg-primary/5">
 <CardContent className="pt-4">
 <p className="text-xs text-muted-foreground">Hoy</p>
 <p className="text-lg font-bold">{data.resumen?.hoy?.cantidad || 0}</p>
 <p className="text-xs text-muted-foreground">{formatCompact(data.resumen?.hoy?.total || 0)}</p>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="pt-4">
 <p className="text-xs text-muted-foreground">Este Mes</p>
 <p className="text-lg font-bold">{data.resumen?.mes?.cantidad || 0}</p>
 <div className="flex items-center gap-1">
 {variacion !== 0 && (
 <span className={cn('text-xs', variacion > 0 ? 'text-success' : 'text-destructive')}>
 {variacion > 0 ? '+' : ''}{formatNumber(variacion, 1)}%
 </span>
 )}
 </div>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="pt-4">
 <p className="text-xs text-muted-foreground">Mes Anterior</p>
 <p className="text-lg font-bold">{data.resumen?.mesAnterior?.cantidad || 0}</p>
 <p className="text-xs text-muted-foreground">{formatCompact(data.resumen?.mesAnterior?.total || 0)}</p>
 </CardContent>
 </Card>
 </div>

 {/* Métricas de Calidad */}
 {data.metricas && (
 <Card className="bg-info-muted0/5 border-primary/20">
 <CardHeader className="pb-2">
 <CardTitle className="text-sm flex items-center gap-2">
 <Percent className="h-4 w-4" />
 Métricas de Calidad
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm font-medium">Tasa de Recepciones con Diferencias</p>
 <p className="text-xs text-muted-foreground">
 {data.metricas.recepcionesConDiferencias} recepciones en últimos 3 meses
 </p>
 </div>
 <div className={cn('text-2xl font-bold', data.metricas.tasaDiferencias > 10 ? 'text-destructive' : 'text-success')}>
 {formatNumber(data.metricas.tasaDiferencias, 1)}%
 </div>
 </div>
 </CardContent>
 </Card>
 )}

 {/* Lead Time por Proveedor */}
 {data.leadTimeProveedores && data.leadTimeProveedores.length > 0 && (
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm flex items-center gap-2">
 <Timer className="h-4 w-4" />
 Lead Time por Proveedor
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-2">
 {data.leadTimeProveedores.map((p: any) => (
 <div key={p.proveedorId} className="flex items-center justify-between p-2 bg-muted/30 rounded">
 <div>
 <p className="text-sm font-medium">{p.proveedor}</p>
 <p className="text-xs text-muted-foreground">{p.entregas} entregas</p>
 </div>
 <div className="text-right">
 <p className={cn('text-lg font-bold', p.leadTimeDias > 15 ? 'text-warning-muted-foreground' : 'text-success')}>
 {formatNumber(p.leadTimeDias, 1)}
 </p>
 <p className="text-xs text-muted-foreground">días promedio</p>
 </div>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 )}

 {/* Por día */}
 {data.porDia && data.porDia.length > 0 && (
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm">Recepciones por Día</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="h-48">
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={data.porDia}>
 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
 <XAxis
 dataKey="dia"
 tick={{ fontSize: 9 }}
 tickFormatter={(v) => new Date(v).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
 />
 <YAxis tick={{ fontSize: 10 }} />
 <Tooltip
 formatter={(value: number, name: string) =>
 name === 'total' ? formatCurrency(value) : value
 }
 labelFormatter={(label) => formatDate(label)}
 />
 <Bar dataKey="cantidad" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 </div>
 </CardContent>
 </Card>
 )}

 {/* Últimas recepciones */}
 {data.ultimas && data.ultimas.length > 0 && (
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm">Últimas Recepciones</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-2">
 {data.ultimas.map((r: any) => (
 <div
 key={r.id}
 className="flex items-center justify-between p-2 rounded hover:bg-muted/50 cursor-pointer"
 onClick={() => onNavigate?.(`/administracion/compras/recepciones/${r.id}`)}
 >
 <div>
 <p className="text-sm font-medium">{r.numero}</p>
 <p className="text-xs text-muted-foreground">{r.proveedor}</p>
 </div>
 <div className="text-right">
 <p className="text-sm font-bold">{formatCompact(r.total)}</p>
 <p className="text-xs text-muted-foreground">
 {formatDate(r.fecha)}
 </p>
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

// ============ CATEGORIAS DETAIL (NEW) ============
function CategoriasDetail({ data }: { data: any }) {
 return (
 <div className="space-y-6">
 {/* Resumen */}
 <div className="grid grid-cols-3 gap-3">
 <Card className="bg-primary/5">
 <CardContent className="pt-4">
 <p className="text-xs text-muted-foreground">Total Categorías</p>
 <p className="text-2xl font-bold">{data.resumen?.totalCategorias || 0}</p>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="pt-4">
 <p className="text-xs text-muted-foreground">Con Gasto</p>
 <p className="text-2xl font-bold">{data.resumen?.categoriasConGasto || 0}</p>
 </CardContent>
 </Card>
 <Card className="bg-info-muted0/5">
 <CardContent className="pt-4">
 <p className="text-xs text-muted-foreground">Gasto Total (3 meses)</p>
 <p className="text-xl font-bold">{formatCompact(data.resumen?.totalGasto || 0)}</p>
 </CardContent>
 </Card>
 </div>

 {/* Gasto por categoría */}
 {data.gastoPorCategoria && data.gastoPorCategoria.length > 0 && (
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm">Gasto por Categoría (Últimos 3 meses)</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="flex gap-4">
 <div className="w-1/2">
 <div className="h-48">
 <ResponsiveContainer width="100%" height="100%">
 <PieChart>
 <Pie
 data={data.gastoPorCategoria.slice(0, 8)}
 dataKey="total"
 nameKey="categoria"
 cx="50%"
 cy="50%"
 innerRadius={30}
 outerRadius={70}
 >
 {data.gastoPorCategoria.slice(0, 8).map((_: any, idx: number) => (
 <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
 ))}
 </Pie>
 <Tooltip formatter={(value: number) => formatCurrency(value)} />
 </PieChart>
 </ResponsiveContainer>
 </div>
 </div>
 <div className="w-1/2 space-y-2">
 {data.gastoPorCategoria.slice(0, 8).map((c: any, idx: number) => (
 <div key={c.categoria} className="flex items-center gap-2 text-xs">
 <div
 className="w-3 h-3 rounded-full"
 style={{ backgroundColor: c.categoria !== 'Sin Categoría' ? PIE_COLORS[idx] : '#9CA3AF' }}
 />
 <span className="truncate flex-1">{c.categoria}</span>
 <span className="font-medium">{formatCompact(c.total)}</span>
 <span className="text-muted-foreground">({formatNumber(c.porcentaje, 1)}%)</span>
 </div>
 ))}
 </div>
 </div>
 </CardContent>
 </Card>
 )}

 {/* Tendencia por categoría */}
 {data.tendencia && Object.keys(data.tendencia).length > 0 && (
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm">Tendencia por Categoría (6 meses)</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="h-48">
 <ResponsiveContainer width="100%" height="100%">
 <LineChart>
 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
 <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
 <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatCompact(v)} />
 <Tooltip formatter={(value: number) => formatCurrency(value)} />
 <Legend />
 {Object.entries(data.tendencia).slice(0, 5).map(([cat, values], idx) => (
 <Line
 key={cat}
 type="monotone"
 data={values as any[]}
 dataKey="total"
 name={cat.substring(0, 15)}
 stroke={PIE_COLORS[idx]}
 strokeWidth={2}
 dot={false}
 />
 ))}
 </LineChart>
 </ResponsiveContainer>
 </div>
 </CardContent>
 </Card>
 )}

 {/* Lista de categorías */}
 {data.categorias && data.categorias.length > 0 && (
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm">Categorías Configuradas</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-2 gap-2">
 {data.categorias.map((c: any) => (
 <div key={c.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded">
 <div
 className="w-3 h-3 rounded-full"
 style={{ backgroundColor: c.color || '#6B7280' }}
 />
 <div className="flex-1">
 <p className="text-sm font-medium">{c.nombre}</p>
 {c.codigo && <p className="text-xs text-muted-foreground">{c.codigo}</p>}
 </div>
 <Badge variant="outline">{c.cantidadInsumos}</Badge>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 )}
 </div>
 );
}

// ============ SERVICIOS DETAIL (NEW) ============
function ServiciosDetail({ data, onNavigate }: { data: any; onNavigate?: (path: string) => void }) {
 return (
 <div className="space-y-6">
 {/* Resumen */}
 <div className="grid grid-cols-2 gap-3">
 <Card className="bg-primary/5">
 <CardContent className="pt-4">
 <p className="text-xs text-muted-foreground">Contratos Activos</p>
 <p className="text-2xl font-bold">{data.resumen?.totalContratos || 0}</p>
 </CardContent>
 </Card>
 <Card className="bg-warning-muted0/10">
 <CardContent className="pt-4">
 <p className="text-xs text-muted-foreground">Próximos a Vencer</p>
 <p className="text-2xl font-bold">{data.resumen?.contratosProxVencer || 0}</p>
 <p className="text-xs text-muted-foreground">en 90 días</p>
 </CardContent>
 </Card>
 <Card className="bg-info-muted0/5">
 <CardContent className="pt-4">
 <p className="text-xs text-muted-foreground">Gasto Mensual Est.</p>
 <p className="text-xl font-bold">{formatCompact(data.resumen?.gastoMensualEstimado || 0)}</p>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="pt-4">
 <p className="text-xs text-muted-foreground">Gasto Anual Est.</p>
 <p className="text-xl font-bold">{formatCompact(data.resumen?.gastoAnualEstimado || 0)}</p>
 </CardContent>
 </Card>
 </div>

 {/* Por tipo */}
 {data.porTipo && data.porTipo.length > 0 && (
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm">Contratos por Tipo</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-2 gap-3">
 {data.porTipo.map((t: any) => (
 <div key={t.tipo} className="p-3 bg-muted/30 rounded-lg">
 <p className="text-xs text-muted-foreground">{t.tipoLabel}</p>
 <p className="text-lg font-bold">{t.cantidad}</p>
 <p className="text-xs text-muted-foreground">{formatCompact(t.montoTotal)}/período</p>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 )}

 {/* Próximos vencimientos */}
 {data.proxVencimientos && data.proxVencimientos.length > 0 && (
 <Card className="border-warning-muted">
 <CardHeader className="pb-2">
 <CardTitle className="text-sm text-warning-muted-foreground flex items-center gap-2">
 <AlertTriangle className="h-4 w-4" />
 Próximos Vencimientos
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-2">
 {data.proxVencimientos.map((p: any) => (
 <div
 key={p.id}
 className="flex items-center justify-between p-2 rounded bg-warning-muted0/5 hover:bg-warning-muted0/10 cursor-pointer"
 onClick={() => onNavigate?.(`/administracion/compras/configuracion?tab=servicios`)}
 >
 <div>
 <p className="text-sm font-medium">{p.nombre}</p>
 <p className="text-xs text-muted-foreground">{p.tipo} - {p.proveedor}</p>
 </div>
 <div className="text-right">
 <p className="text-sm font-bold">{formatCompact(p.montoPeriodo)}</p>
 <p className={cn('text-xs', p.diasRestantes <= 30 ? 'text-warning-muted-foreground' : 'text-muted-foreground')}>
 {p.diasRestantes} días
 </p>
 </div>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 )}

 {/* Lista de contratos */}
 {data.contratos && data.contratos.length > 0 && (
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm">Todos los Contratos Activos</CardTitle>
 </CardHeader>
 <CardContent>
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Contrato</TableHead>
 <TableHead>Tipo</TableHead>
 <TableHead>Proveedor</TableHead>
 <TableHead className="text-right">Monto</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {data.contratos.slice(0, 10).map((c: any) => (
 <TableRow key={c.id}>
 <TableCell>
 <div>
 <p className="font-medium">{c.nombre}</p>
 <p className="text-xs text-muted-foreground">#{c.numero}</p>
 </div>
 </TableCell>
 <TableCell>
 <Badge variant="outline">{c.tipoLabel}</Badge>
 </TableCell>
 <TableCell className="text-muted-foreground">{c.proveedor}</TableCell>
 <TableCell className="text-right">
 <div>
 <p className="font-bold">{formatCompact(c.montoPeriodo)}</p>
 <p className="text-xs text-muted-foreground">/{c.frecuenciaPago}</p>
 </div>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </CardContent>
 </Card>
 )}
 </div>
 );
}
