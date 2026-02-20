'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogBody,
 DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
 ClipboardList,
 FileEdit,
 Clock,
 CheckCircle2,
 XCircle,
 AlertTriangle,
 User,
 Calendar,
 DollarSign,
 Send,
 Check,
 X,
 Loader2,
 FileText,
 MessageSquare,
 Building2,
 Plus,
 Trophy,
 Truck,
 CreditCard,
 Eye,
 FileDown,
 Calculator,
 PanelRightOpen,
 PanelRightClose,
 Pencil,
 Package,
 Shield,
 CalendarClock,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CotizacionFormModal } from './cotizacion-form-modal';
import { CrearOCModal } from './crear-oc-modal';
import { CotizacionDetailModal } from './cotizacion-detail-modal';

interface PedidoItem {
 id: number;
 descripcion: string;
 cantidad: number;
 unidad: string;
 especificaciones?: string;
}

interface CotizacionItem {
 id: number;
 descripcion: string;
 cantidad: number;
 unidad: string;
 precioUnitario: number;
 descuento?: number;
 subtotal: number;
 notas?: string;
 codigoProveedor?: string;
 supplierItem?: {
 id: number;
 nombre: string;
 codigoProveedor?: string;
 };
}

interface Cotizacion {
 id: number;
 numero: string;
 estado: string;
 fechaCotizacion: string;
 validezHasta?: string;
 plazoEntrega?: number;
 fechaEntregaEstimada?: string;
 condicionesPago?: string;
 formaPago?: string;
 garantia?: string;
 total: number;
 subtotal: number;
 impuestos: number;
 descuento?: number;
 moneda: string;
 esSeleccionada: boolean;
 adjuntos?: string[];
 observaciones?: string;
 beneficios?: string;
 supplier: {
 id: number;
 name: string;
 cuit?: string;
 };
 items?: CotizacionItem[];
 createdByUser?: {
 id: number;
 name: string;
 };
 createdAt?: string;
}

interface Comment {
 id: number;
 tipo: string;
 contenido: string;
 createdAt: string;
 user: {
 id: number;
 name: string;
 };
}

interface PedidoCompra {
 id: number;
 numero: string;
 titulo: string;
 descripcion?: string;
 estado: string;
 prioridad: string;
 solicitante: {
 id: number;
 name: string;
 };
 departamento?: string;
 fechaNecesidad?: string;
 presupuestoEstimado?: number;
 moneda: string;
 notas?: string;
 createdAt: string;
 items: PedidoItem[];
 quotations: Cotizacion[];
 purchaseOrders: any[];
}

type EstadoPedido =
 | 'BORRADOR'
 | 'ENVIADA'
 | 'EN_COTIZACION'
 | 'COTIZADA'
 | 'EN_APROBACION'
 | 'APROBADA'
 | 'EN_PROCESO'
 | 'COMPLETADA'
 | 'RECHAZADA'
 | 'CANCELADA';

const ESTADOS_CONFIG: Record<EstadoPedido, { label: string; icon: React.ElementType }> = {
 BORRADOR: { label: 'Borrador', icon: FileEdit },
 ENVIADA: { label: 'Enviada', icon: Send },
 EN_COTIZACION: { label: 'En Cotización', icon: Clock },
 COTIZADA: { label: 'Cotizada', icon: FileText },
 EN_APROBACION: { label: 'Pendiente Aprobación', icon: AlertTriangle },
 APROBADA: { label: 'Aprobada', icon: CheckCircle2 },
 EN_PROCESO: { label: 'En Proceso', icon: Clock },
 COMPLETADA: { label: 'Completada', icon: CheckCircle2 },
 RECHAZADA: { label: 'Rechazada', icon: XCircle },
 CANCELADA: { label: 'Cancelada', icon: XCircle },
};

const PRIORIDAD_CONFIG: Record<string, string> = {
 BAJA: 'Baja',
 NORMAL: 'Normal',
 ALTA: 'Alta',
 URGENTE: 'Urgente',
};

const parsePlazosPago = (condicion?: string): number => {
 if (!condicion) return 0;
 const lower = condicion.toLowerCase();
 if (lower.includes('contado') || lower.includes('contra entrega')) return 0;
 const match = lower.match(/(\d+)\s*d[ií]as?/);
 if (match) return parseInt(match[1]);
 return 0;
};

interface PedidoCompraDetailModalProps {
 open: boolean;
 onClose: () => void;
 pedidoId: number;
 onUpdate?: () => void;
}

export function PedidoCompraDetailModal({
 open,
 onClose,
 pedidoId,
 onUpdate,
}: PedidoCompraDetailModalProps) {
 const [pedido, setPedido] = useState<PedidoCompra | null>(null);
 const [comments, setComments] = useState<Comment[]>([]);
 const [loading, setLoading] = useState(true);
 const [actionLoading, setActionLoading] = useState(false);
 const [newComment, setNewComment] = useState('');
 const [sendingComment, setSendingComment] = useState(false);
 const [cotizacionModalOpen, setCotizacionModalOpen] = useState(false);
 const [previewPdf, setPreviewPdf] = useState<string | null>(null);
 const [activeTab, setActiveTab] = useState('info');
 const [showCalculation, setShowCalculation] = useState(false);
 const [rejectModalOpen, setRejectModalOpen] = useState(false);
 const [rejectReason, setRejectReason] = useState('');
 const [sidebarOpen, setSidebarOpen] = useState(true);
 const [crearOCModalOpen, setCrearOCModalOpen] = useState(false);
 const [cotizacionDetailOpen, setCotizacionDetailOpen] = useState(false);
 const [cotizacionDetalle, setCotizacionDetalle] = useState<Cotizacion | null>(null);
 const [cotizacionEditId, setCotizacionEditId] = useState<number | null>(null);
 const commentsEndRef = useRef<HTMLDivElement>(null);

 const selectedQuotation = useMemo(() => {
 return pedido?.quotations.find(q => q.esSeleccionada) || null;
 }, [pedido]);

 const analysis = useMemo(() => {
 if (!pedido || pedido.quotations.length === 0) return null;

 const quotes = pedido.quotations;
 const precios = quotes.map(q => q.total);
 const minPrecio = Math.min(...precios);
 const maxPrecio = Math.max(...precios);

 const plazos = quotes.map(q => ({ id: q.id, dias: parsePlazosPago(q.condicionesPago) }));
 const maxPlazoPago = Math.max(...plazos.map(p => p.dias));

 const entregas = quotes.filter(q => q.plazoEntrega).map(q => ({ id: q.id, dias: q.plazoEntrega! }));
 const minEntrega = entregas.length > 0 ? Math.min(...entregas.map(e => e.dias)) : null;

 const PESO_PRECIO = 50;
 const PESO_PAGO = 25;
 const PESO_ENTREGA = 25;

 const scores = quotes.map(q => {
 let score = 0;
 const detalles: { criterio: string; valor: string; puntos: number; esMejor: boolean }[] = [];

 const precioNorm = maxPrecio > minPrecio ? (q.total - minPrecio) / (maxPrecio - minPrecio) : 0;
 const puntosPrecio = precioNorm * PESO_PRECIO;
 score += puntosPrecio;
 detalles.push({
 criterio: 'Precio',
 valor: `$${q.total.toLocaleString('es-AR')}`,
 puntos: Math.round((PESO_PRECIO - puntosPrecio) * 10) / 10,
 esMejor: q.total === minPrecio
 });

 const plazoPago = parsePlazosPago(q.condicionesPago);
 const pagoNorm = maxPlazoPago > 0 ? 1 - (plazoPago / maxPlazoPago) : 0;
 const puntosPago = pagoNorm * PESO_PAGO;
 score += puntosPago;
 detalles.push({
 criterio: 'Plazo pago',
 valor: plazoPago > 0 ? `${plazoPago} días` : 'Contado',
 puntos: Math.round((PESO_PAGO - puntosPago) * 10) / 10,
 esMejor: plazoPago === maxPlazoPago && maxPlazoPago > 0
 });

 if (q.plazoEntrega && minEntrega) {
 const maxEntrega = Math.max(...entregas.map(e => e.dias));
 const entregaNorm = maxEntrega > minEntrega ? (q.plazoEntrega - minEntrega) / (maxEntrega - minEntrega) : 0;
 const puntosEntrega = entregaNorm * PESO_ENTREGA;
 score += puntosEntrega;
 detalles.push({
 criterio: 'Entrega',
 valor: `${q.plazoEntrega} días`,
 puntos: Math.round((PESO_ENTREGA - puntosEntrega) * 10) / 10,
 esMejor: q.plazoEntrega === minEntrega
 });
 } else {
 detalles.push({ criterio: 'Entrega', valor: '-', puntos: 0, esMejor: false });
 }

 const diffPrecio = minPrecio > 0 ? ((q.total - minPrecio) / minPrecio) * 100 : 0;

 return {
 id: q.id,
 score: Math.round(score * 10) / 10,
 totalPuntos: Math.round((100 - score) * 10) / 10,
 supplier: q.supplier.name,
 detalles,
 diffPrecio: Math.round(diffPrecio * 10) / 10,
 };
 });

 scores.sort((a, b) => a.score - b.score);
 const mejorOpcion = scores[0];

 const mejorPrecioIds = quotes.filter(q => q.total === minPrecio).map(q => q.id);
 const mejorEntregaIds = minEntrega !== null
 ? quotes.filter(q => q.plazoEntrega === minEntrega).map(q => q.id)
 : [];

 // Verificar si hay variación real en estos criterios (si todos tienen el mismo valor, no es distintivo)
 const hayVariacionPrecio = maxPrecio > minPrecio;
 const maxEntrega = entregas.length > 0 ? Math.max(...entregas.map(e => e.dias)) : null;
 const hayVariacionEntrega = minEntrega !== null && maxEntrega !== null && maxEntrega > minEntrega;

 // Determinar el criterio de recomendación basado en qué tiene de mejor la opción recomendada
 // Solo mencionar un criterio si hay variación real (si todos tienen el mismo valor, no es distintivo)
 let criterioRecomendacion = 'Mejor balance';
 if (mejorOpcion) {
 const esMejorPrecio = hayVariacionPrecio && mejorPrecioIds.includes(mejorOpcion.id);
 const esMejorEntrega = hayVariacionEntrega && mejorEntregaIds.includes(mejorOpcion.id);

 if (esMejorPrecio && esMejorEntrega) {
 criterioRecomendacion = 'Mejor precio y entrega';
 } else if (esMejorPrecio) {
 criterioRecomendacion = 'Mejor precio';
 } else if (esMejorEntrega) {
 criterioRecomendacion = 'Entrega más rápida';
 }
 }
 const ahorroPotencial = maxPrecio - minPrecio;
 const ahorroPorcentaje = maxPrecio > 0 ? ((ahorroPotencial / maxPrecio) * 100).toFixed(0) : '0';

 return {
 mejorOpcion,
 criterioRecomendacion,
 scores,
 mejorPrecioIds,
 minPrecio,
 ahorroPotencial,
 ahorroPorcentaje,
 pesos: { precio: PESO_PRECIO, pago: PESO_PAGO, entrega: PESO_ENTREGA },
 };
 }, [pedido]);

 useEffect(() => {
 if (open && pedidoId) {
 loadPedido();
 loadComments();
 }
 }, [open, pedidoId]);

 useEffect(() => {
 commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
 }, [comments]);

 const loadPedido = async () => {
 setLoading(true);
 try {
 const response = await fetch(`/api/compras/pedidos/${pedidoId}`);
 if (response.ok) {
 setPedido(await response.json());
 } else {
 toast.error('Error al cargar el pedido');
 onClose();
 }
 } catch {
 toast.error('Error al cargar el pedido');
 } finally {
 setLoading(false);
 }
 };

 const loadComments = async () => {
 try {
 const response = await fetch(`/api/compras/comments/request/${pedidoId}`);
 if (response.ok) {
 const data = await response.json();
 setComments(data.data || []);
 }
 } catch {}
 };

 const handleSendComment = async () => {
 if (!newComment.trim()) return;
 setSendingComment(true);
 try {
 const response = await fetch('/api/compras/comments', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ entidad: 'request', entidadId: pedidoId, contenido: newComment, tipo: 'COMENTARIO' }),
 });
 if (response.ok) {
 setNewComment('');
 loadComments();
 }
 } catch {}
 setSendingComment(false);
 };

 const handleAprobar = async (aprobar: boolean, motivo?: string) => {
 setActionLoading(true);
 try {
 const response = await fetch(`/api/compras/pedidos/${pedidoId}/aprobar`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ aprobar, motivo }),
 });
 if (response.ok) {
 toast.success(aprobar ? 'Pedido aprobado' : 'Pedido rechazado');
 setRejectModalOpen(false);
 setRejectReason('');
 loadPedido();
 loadComments();
 onUpdate?.();
 } else {
 const data = await response.json();
 toast.error(data.error || 'Error');
 }
 } catch {
 toast.error('Error');
 }
 setActionLoading(false);
 };

 const handleSeleccionarCotizacion = async (cotizacionId: number) => {
 if (!pedido) return;
 setActionLoading(true);
 try {
 const response = await fetch(`/api/compras/cotizaciones/${cotizacionId}/seleccionar`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ motivo: 'Seleccionada' }),
 });
 if (response.ok) {
 // Actualizar estado local sin recargar - incluir estado del pedido
 setPedido(prev => {
 if (!prev) return prev;
 return {
 ...prev,
 estado: 'EN_APROBACION', // El backend cambia el estado a EN_APROBACION
 quotations: prev.quotations.map(q => ({
 ...q,
 esSeleccionada: q.id === cotizacionId,
 estado: q.id === cotizacionId ? 'SELECCIONADA' : (q.esSeleccionada ? 'EN_REVISION' : q.estado)
 }))
 };
 });
 toast.success('Cotización seleccionada. Pendiente de aprobación.');
 onUpdate?.();
 } else {
 const data = await response.json();
 toast.error(data.error || 'Error');
 }
 } catch {
 toast.error('Error');
 }
 setActionLoading(false);
 };

 const handleConvertirOC = () => {
 // Abrir modal de crear OC
 setCrearOCModalOpen(true);
 };

 const handleOCCreated = () => {
 loadPedido();
 loadComments();
 onUpdate?.();
 };

 const formatCurrency = (amount: number, currency: string = 'ARS') => {
 return new Intl.NumberFormat('es-AR', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
 };

 const getInitials = (name: string) => name.split(').map(n => n[0]).join('').toUpperCase().slice(0, 2);

 const canAddCotizacion = pedido && ['ENVIADA', 'EN_COTIZACION', 'COTIZADA', 'EN_APROBACION'].includes(pedido.estado);
 const canAprobar = pedido && pedido.estado === 'EN_APROBACION';
 const isResolved = pedido && ['APROBADA', 'RECHAZADA', 'COMPLETADA', 'CANCELADA'].includes(pedido.estado);

 const getScoreForQuotation = (cotId: number) => analysis?.scores.find(s => s.id === cotId);

 return (
 <>
 <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
 <DialogContent size="full" className="p-0 gap-0">
 {loading ? (
 <div className="flex-1 flex items-center justify-center">
 <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
 <span className="ml-2 text-xs text-muted-foreground">Cargando...</span>
 </div>
 ) : !pedido ? (
 <div className="flex-1 flex flex-col items-center justify-center">
 <ClipboardList className="w-8 h-8 text-muted-foreground mb-2" />
 <p className="text-xs text-muted-foreground">Pedido no encontrado</p>
 </div>
 ) : (
 <>
 {/* Header */}
 <div className="px-5 md:px-6 py-4 border-b shrink-0">
 <div className="flex items-center justify-between gap-4">
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="text-base font-semibold">{pedido.numero}</span>
 <span className="text-sm text-muted-foreground hidden sm:inline">·</span>
 <span className="text-sm text-muted-foreground truncate hidden sm:inline">{pedido.titulo}</span>
 </div>
 <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
 <span>{PRIORIDAD_CONFIG[pedido.prioridad] || pedido.prioridad}</span>
 <span>·</span>
 <span className="truncate">{pedido.solicitante?.name}</span>
 </div>
 </div>
 <div className="flex items-center gap-2 shrink-0">
 <Badge variant="outline" className="text-xs h-6">
 {ESTADOS_CONFIG[pedido.estado as EstadoPedido]?.label || pedido.estado}
 </Badge>
 {canAddCotizacion && (
 <Button size="sm" className="h-8 text-sm px-3" onClick={() => setCotizacionModalOpen(true)} disabled={actionLoading}>
 <Plus className="w-4 h-4 mr-1" />
 <span className="hidden sm:inline">Cotización</span>
 </Button>
 )}
 <Button
 variant="ghost"
 size="sm"
 className="h-8 w-8 p-0"
 onClick={() => setSidebarOpen(!sidebarOpen)}
 >
 {sidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
 </Button>
 </div>
 </div>
 </div>

 {/* Main Content */}
 <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
 {/* Cotizaciones */}
 <div className="flex-1 flex flex-col overflow-hidden min-h-0">
 {pedido.quotations.length === 0 ? (
 <div className="flex-1 flex items-center justify-center p-4">
 <div className="text-center">
 <FileText className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
 <p className="text-xs text-muted-foreground mb-3">Sin cotizaciones</p>
 {canAddCotizacion && (
 <Button size="sm" className="h-7 text-xs" onClick={() => setCotizacionModalOpen(true)}>
 <Plus className="w-3 h-3 mr-1" />
 Agregar
 </Button>
 )}
 </div>
 </div>
 ) : (
 <>
 {/* Barra recomendación */}
 {analysis && pedido.quotations.length > 1 && (
 <div className="px-6 py-3 border-b bg-muted/30 shrink-0">
 <div className="flex items-center justify-between gap-3 flex-wrap">
 <div className="flex items-center gap-2">
 <Trophy className="w-4 h-4 text-primary" />
 <span className="text-sm font-medium">
 {analysis.mejorOpcion?.supplier}
 </span>
 <span className="text-xs text-muted-foreground">
 ({analysis.criterioRecomendacion})
 </span>
 </div>
 <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setShowCalculation(true)}>
 <Calculator className="w-4 h-4 mr-1" />
 Ver cálculo
 </Button>
 </div>
 </div>
 )}

 {/* Cards */}
 <ScrollArea className="flex-1">
 <div className="p-4 md:p-6">
 <div className={cn(
 'grid gap-4',
 pedido.quotations.length === 1 && 'grid-cols-1 max-w-md mx-auto',
 pedido.quotations.length === 2 && 'grid-cols-1 sm:grid-cols-2',
 pedido.quotations.length >= 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
 pedido.quotations.length >= 4 && !sidebarOpen && 'xl:grid-cols-4',
 )}>
 {pedido.quotations.map((cot) => {
 const score = getScoreForQuotation(cot.id);
 const esRecomendada = analysis?.mejorOpcion?.id === cot.id;
 const esMejorPrecio = analysis?.mejorPrecioIds.includes(cot.id);
 const canSelect = ['RECIBIDA', 'EN_REVISION', 'SELECCIONADA'].includes(cot.estado) &&
 ['ENVIADA', 'EN_COTIZACION', 'COTIZADA', 'EN_APROBACION'].includes(pedido.estado);

 return (
 <Card
 key={cot.id}
 className={cn(
 'flex flex-col overflow-hidden cursor-pointer transition-all hover:shadow-md group',
 cot.esSeleccionada && 'ring-2 ring-primary shadow-primary/10',
 esRecomendada && !cot.esSeleccionada && 'ring-1 ring-warning-muted'
 )}
 onClick={() => {
 if (canSelect && !actionLoading && !cot.esSeleccionada) {
 handleSeleccionarCotizacion(cot.id);
 }
 }}
 >
 {/* Header con gradiente */}
 <div className={cn(
 'px-4 py-3 relative overflow-hidden',
 cot.esSeleccionada
 ? 'bg-gradient-to-r from-primary/10 to-primary/5'
 : esRecomendada
 ? 'bg-gradient-to-r from-warning-muted to-warning-muted/60'
 : 'bg-muted/30'
 )}>
 <div className="flex items-start justify-between gap-2">
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-2">
 <div className={cn(
 "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
 cot.esSeleccionada ? "bg-primary/20" : "bg-muted"
 )}>
 <Building2 className={cn("w-4 h-4", cot.esSeleccionada ? "text-primary" : "text-muted-foreground")} />
 </div>
 <div className="min-w-0">
 <span className="text-sm font-semibold truncate block">{cot.supplier.name}</span>
 <p className="text-[10px] text-muted-foreground font-mono">{cot.numero}</p>
 </div>
 </div>
 </div>
 <div className="flex flex-col items-end gap-1 shrink-0">
 {cot.esSeleccionada && (
 <Badge className="bg-primary text-primary-foreground text-[10px] h-5 px-2">
 <Check className="w-3 h-3 mr-1" />
 Seleccionada
 </Badge>
 )}
 {esRecomendada && !cot.esSeleccionada && (
 <Badge className="bg-warning-muted text-warning-muted-foreground border-warning-muted text-[10px] h-5 px-2">
 <Trophy className="w-3 h-3 mr-1" />
 Recomendada
 </Badge>
 )}
 </div>
 </div>
 </div>

 {/* Precio grande */}
 <div className="px-4 py-3 border-b">
 <div className="flex items-end justify-between gap-2">
 <div>
 <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</span>
 <p className={cn(
 'text-2xl font-bold leading-none mt-0.5',
 esMejorPrecio ? 'text-success' : ''
 )}>
 {formatCurrency(cot.total, cot.moneda)}
 </p>
 {score && score.diffPrecio > 0 && (
 <p className="text-[10px] text-muted-foreground mt-1">+{score.diffPrecio}% vs mejor</p>
 )}
 </div>
 <div className="flex flex-col items-end gap-1">
 {esMejorPrecio && pedido.quotations.length > 1 && (
 <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-success-muted text-success border-success-muted">
 Mejor precio
 </Badge>
 )}
 <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
 <Truck className="w-3 h-3" />
 <span>{cot.plazoEntrega ? `${cot.plazoEntrega}d` : '-'}</span>
 <span className="mx-1">·</span>
 <CreditCard className="w-3 h-3" />
 <span>{cot.condicionesPago || '-'}</span>
 </div>
 </div>
 </div>
 </div>

 {/* Mini lista de items */}
 {cot.items && cot.items.length > 0 && (
 <div className="px-4 py-2 border-b bg-muted/20 flex-1">
 <div className="flex items-center justify-between mb-2">
 <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
 Items ({cot.items.length})
 </span>
 </div>
 <div className="space-y-1.5">
 {cot.items.slice(0, 3).map((item, idx) => (
 <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
 <div className="flex items-center gap-2 min-w-0 flex-1">
 <span className="text-muted-foreground w-4 text-right shrink-0">{idx + 1}.</span>
 <span className="truncate">{item.descripcion}</span>
 </div>
 <span className="font-medium shrink-0 tabular-nums">
 {formatCurrency(Number(item.subtotal), cot.moneda)}
 </span>
 </div>
 ))}
 {cot.items.length > 3 && (
 <p className="text-[10px] text-muted-foreground text-center pt-1">
 +{cot.items.length - 3} items más
 </p>
 )}
 </div>
 </div>
 )}

 {/* Info extra compacta */}
 <div className="px-4 py-2 text-[10px] flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
 <span className="flex items-center gap-1">
 <Calendar className="w-3 h-3" />
 {format(new Date(cot.fechaCotizacion), 'dd/MM/yy')}
 </span>
 {cot.validezHasta && (
 <span className={cn(
 "flex items-center gap-1",
 new Date(cot.validezHasta) < new Date() && 'text-destructive'
 )}>
 <CalendarClock className="w-3 h-3" />
 Válida: {format(new Date(cot.validezHasta), 'dd/MM/yy')}
 </span>
 )}
 {cot.garantia && (
 <span className="flex items-center gap-1">
 <Shield className="w-3 h-3" />
 {cot.garantia}
 </span>
 )}
 </div>

 {/* Actions */}
 <div className="px-3 py-2 border-t bg-background flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
 <Button
 variant="ghost"
 size="sm"
 className="h-7 text-xs px-2 flex-1"
 onClick={() => {
 setCotizacionDetalle(cot);
 setCotizacionDetailOpen(true);
 }}
 >
 <Eye className="w-3.5 h-3.5 mr-1" />
 Ver
 </Button>
 {/* Editar - solo si no está en proceso, aprobada, completada o rechazada */}
 {!['EN_PROCESO', 'APROBADA', 'COMPLETADA', 'RECHAZADA'].includes(pedido.estado) && (
 <Button
 variant="ghost"
 size="sm"
 className="h-7 text-xs px-2 flex-1"
 onClick={() => {
 setCotizacionEditId(cot.id);
 setCotizacionModalOpen(true);
 }}
 >
 <Pencil className="w-3.5 h-3.5 mr-1" />
 Editar
 </Button>
 )}
 {cot.adjuntos && cot.adjuntos.length > 0 && (
 <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setPreviewPdf(cot.adjuntos![0])}>
 <FileText className="w-3.5 h-3.5" />
 </Button>
 )}
 {cot.esSeleccionada && pedido.estado === 'APROBADA' && cot.estado !== 'CONVERTIDA_OC' && (
 <Button size="sm" className="h-7 text-xs px-3" onClick={handleConvertirOC}>
 Crear OC
 </Button>
 )}
 {cot.adjuntos && cot.adjuntos.length > 0 && (
 <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => window.open(cot.adjuntos![0], '_blank')}>
 <FileDown className="w-3.5 h-3.5" />
 </Button>
 )}
 </div>
 </Card>
 );
 })}
 </div>
 </div>
 </ScrollArea>

 {/* Footer aprobación */}
 {canAprobar && !isResolved && (
 <div className="px-6 py-4 border-t bg-muted/30 shrink-0">
 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
 <div className="text-sm">
 {selectedQuotation ? (
 <span>Seleccionada: <strong>{selectedQuotation.supplier.name}</strong> - {formatCurrency(selectedQuotation.total)}</span>
 ) : (
 <span className="text-muted-foreground">Selecciona una cotización tocando la card</span>
 )}
 </div>
 <div className="flex gap-2 w-full sm:w-auto">
 <Button variant="outline" size="sm" className="h-8 text-sm flex-1 sm:flex-none" onClick={() => setRejectModalOpen(true)} disabled={actionLoading}>
 <X className="w-4 h-4 mr-1" />
 Rechazar
 </Button>
 <Button size="sm" className="h-8 text-sm flex-1 sm:flex-none" onClick={() => handleAprobar(true)} disabled={actionLoading || !selectedQuotation}>
 {actionLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
 Aprobar
 </Button>
 </div>
 </div>
 </div>
 )}

 {/* Estado resuelto */}
 {isResolved && (
 <div className="px-6 py-3 border-t bg-muted/30 shrink-0">
 <div className="flex items-center justify-between gap-2">
 <div className="flex items-center gap-2 text-sm">
 {pedido.estado === 'APROBADA' && <CheckCircle2 className="w-4 h-4 text-primary" />}
 {pedido.estado === 'RECHAZADA' && <XCircle className="w-4 h-4 text-destructive" />}
 <span className="font-medium">{ESTADOS_CONFIG[pedido.estado as EstadoPedido]?.label}</span>
 {selectedQuotation && pedido.estado === 'APROBADA' && (
 <span className="text-muted-foreground">- {selectedQuotation.supplier.name}</span>
 )}
 </div>
 {/* Botón Crear OC cuando está aprobada */}
 {pedido.estado === 'APROBADA' && selectedQuotation && selectedQuotation.estado !== 'CONVERTIDA_OC' && (
 <Button
 size="sm"
 className="h-8 text-sm"
 onClick={handleConvertirOC}
 >
 <FileText className="w-4 h-4 mr-1" />
 Crear OC
 </Button>
 )}
 </div>
 </div>
 )}
 </>
 )}
 </div>

 {/* Panel lateral - colapsable */}
 {sidebarOpen && (
 <div className="w-full md:w-80 lg:w-96 flex flex-col border-t md:border-t-0 md:border-l bg-muted/5 min-h-0 h-64 md:h-auto">
 <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden min-h-0">
 <div className="px-4 pt-3 shrink-0">
 <TabsList className="w-full grid grid-cols-2 h-8">
 <TabsTrigger value="info" className="text-xs">Info</TabsTrigger>
 <TabsTrigger value="chat" className="text-xs">Chat ({comments.length})</TabsTrigger>
 </TabsList>
 </div>

 <TabsContent value="info" className="flex-1 overflow-auto m-0 p-4 space-y-3">
 <div className="p-3 bg-background rounded-lg border">
 <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
 <User className="w-4 h-4" />Solicitante
 </div>
 <p className="text-sm font-medium">{pedido?.solicitante?.name}</p>
 </div>

 <div className="p-3 bg-background rounded-lg border">
 <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
 <Calendar className="w-4 h-4" />Fechas
 </div>
 <p className="text-sm">Creado: {format(new Date(pedido.createdAt), 'dd/MM/yy HH:mm')}</p>
 {pedido?.fechaNecesidad && (
 <p className="text-sm text-primary">Necesidad: {format(new Date(pedido.fechaNecesidad), 'dd/MM/yy')}</p>
 )}
 </div>

 {pedido?.items && pedido.items.length > 0 && (
 <div className="p-3 bg-background rounded-lg border">
 <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
 <ClipboardList className="w-4 h-4" />Items ({pedido.items.length})
 </div>
 <div className="space-y-1.5">
 {pedido.items.map((item, idx) => (
 <div key={item.id || idx} className="flex items-start justify-between gap-2 text-sm">
 <span className="flex-1">{item.descripcion}</span>
 <span className="text-muted-foreground whitespace-nowrap">
 {item.cantidad} {item.unidad}
 </span>
 </div>
 ))}
 </div>
 </div>
 )}

 {pedido?.presupuestoEstimado && (
 <div className="p-3 bg-background rounded-lg border">
 <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
 <DollarSign className="w-4 h-4" />Presupuesto
 </div>
 <p className="text-sm font-medium">{formatCurrency(pedido.presupuestoEstimado)}</p>
 </div>
 )}

 {pedido?.descripcion && (
 <div className="p-3 bg-background rounded-lg border">
 <p className="text-xs text-muted-foreground mb-1">Descripción</p>
 <p className="text-sm whitespace-pre-wrap">{pedido.descripcion}</p>
 </div>
 )}

 {pedido?.notas && (
 <div className="p-3 bg-warning-muted rounded-lg border border-warning-muted">
 <p className="text-xs text-warning-muted-foreground mb-1">Notas</p>
 <p className="text-sm whitespace-pre-wrap">{pedido.notas}</p>
 </div>
 )}
 </TabsContent>

 <TabsContent value="chat" className="flex-1 flex flex-col m-0 overflow-hidden min-h-0">
 <ScrollArea className="flex-1 p-4">
 <div className="space-y-3">
 {comments.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
 <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
 <p className="text-xs">Sin comentarios</p>
 </div>
 ) : (
 comments.map((comment) => (
 <div key={comment.id} className={cn('flex gap-2.5', comment.tipo === 'SISTEMA' && 'opacity-60')}>
 <Avatar className="h-6 w-6 shrink-0">
 <AvatarFallback className={cn('text-[9px]', comment.tipo === 'SISTEMA' ? 'bg-muted' : 'bg-primary/10')}>
 {comment.tipo === 'SISTEMA' ? 'SYS' : getInitials(comment.user.name)}
 </AvatarFallback>
 </Avatar>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-1.5">
 <span className="text-xs font-medium">{comment.tipo === 'SISTEMA' ? 'Sistema' : comment.user.name}</span>
 <span className="text-xs text-muted-foreground">{format(new Date(comment.createdAt), 'dd/MM HH:mm')}</span>
 </div>
 <p className={cn('text-sm', comment.tipo === 'SISTEMA' && 'italic text-muted-foreground')}>{comment.contenido}</p>
 </div>
 </div>
 ))
 )}
 <div ref={commentsEndRef} />
 </div>
 </ScrollArea>
 <div className="p-3 border-t bg-background shrink-0">
 <div className="flex gap-2">
 <Textarea
 placeholder="Comentario..."
 value={newComment}
 onChange={(e) => setNewComment(e.target.value)}
 rows={1}
 className="resize-none text-sm min-h-[32px]"
 onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendComment(); } }}
 />
 <Button size="sm" className="h-8 w-8 p-0" onClick={handleSendComment} disabled={!newComment.trim() || sendingComment}>
 {sendingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
 </Button>
 </div>
 </div>
 </TabsContent>
 </Tabs>
 </div>
 )}
 </div>
 </>
 )}
 </DialogContent>
 </Dialog>

 {/* Modal cotización */}
 {pedido && (
 <CotizacionFormModal
 open={cotizacionModalOpen}
 onClose={() => {
 setCotizacionModalOpen(false);
 setCotizacionEditId(null);
 }}
 requestId={pedido.id}
 requestItems={pedido.items}
 cotizacionId={cotizacionEditId || undefined}
 onSuccess={() => {
 loadPedido();
 loadComments();
 onUpdate?.();
 setCotizacionEditId(null);
 }}
 />
 )}

 {/* Modal PDF - ancho completo para mejor visualización */}
 <Dialog open={!!previewPdf} onOpenChange={() => setPreviewPdf(null)}>
 <DialogContent size="full" className="p-0 gap-0">
 <DialogHeader>
 <div className="flex items-center justify-between">
 <DialogTitle className="text-xs font-medium">Vista previa</DialogTitle>
 <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => previewPdf && window.open(previewPdf, '_blank')}>
 <FileDown className="w-3 h-3 mr-1" />Abrir
 </Button>
 </div>
 </DialogHeader>
 <DialogBody className="p-0">
 {previewPdf && <iframe src={previewPdf} className="w-full h-full border-0" title="PDF" />}
 </DialogBody>
 </DialogContent>
 </Dialog>

 {/* Modal rechazo */}
 <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
 <DialogContent size="sm" className="p-0 gap-0">
 <DialogHeader>
 <DialogTitle className="text-sm font-medium flex items-center gap-2">
 <XCircle className="w-4 h-4 text-destructive" />
 Rechazar Pedido
 </DialogTitle>
 </DialogHeader>
 <DialogBody className="space-y-3">
 <div className="space-y-1.5">
 <Label className="text-xs">Motivo <span className="text-destructive">*</span></Label>
 <Textarea
 placeholder="Explique el motivo..."
 value={rejectReason}
 onChange={(e) => setRejectReason(e.target.value)}
 rows={3}
 className="resize-none text-xs"
 autoFocus
 />
 </div>
 </DialogBody>
 <DialogFooter>
 <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setRejectModalOpen(false); setRejectReason(''); }}>Cancelar</Button>
 <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={() => handleAprobar(false, rejectReason)} disabled={actionLoading || !rejectReason.trim()}>
 {actionLoading && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
 Rechazar
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* Modal cálculo */}
 <Dialog open={showCalculation} onOpenChange={setShowCalculation}>
 <DialogContent size="sm" className="p-0 gap-0">
 <DialogHeader>
 <DialogTitle className="text-sm font-medium flex items-center gap-2">
 <Calculator className="w-4 h-4" />
 Cálculo de Recomendación
 </DialogTitle>
 </DialogHeader>
 {analysis && (
 <DialogBody className="space-y-4">
 <div className="p-3 bg-muted/50 rounded-lg">
 <p className="text-xs font-medium mb-2">Criterios:</p>
 <div className="grid grid-cols-3 gap-2 text-center">
 <div className="p-2 bg-background rounded text-xs">
 <p className="font-bold text-primary">{analysis.pesos.precio}%</p>
 <p className="text-[10px] text-muted-foreground">Precio</p>
 </div>
 <div className="p-2 bg-background rounded text-xs">
 <p className="font-bold text-primary">{analysis.pesos.pago}%</p>
 <p className="text-[10px] text-muted-foreground">Plazo</p>
 </div>
 <div className="p-2 bg-background rounded text-xs">
 <p className="font-bold text-primary">{analysis.pesos.entrega}%</p>
 <p className="text-[10px] text-muted-foreground">Entrega</p>
 </div>
 </div>
 </div>

 <div className="space-y-1.5">
 {analysis.scores.map((score, index) => (
 <div key={score.id} className={cn('flex items-center justify-between p-2 rounded border text-xs', index === 0 && 'bg-primary/5 border-primary/30')}>
 <div className="flex items-center gap-2">
 <span className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold', index === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
 {index + 1}
 </span>
 <span className="font-medium">{score.supplier}</span>
 </div>
 <span className="font-bold">{score.totalPuntos} pts</span>
 </div>
 ))}
 </div>
 </DialogBody>
 )}
 <DialogFooter>
 <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowCalculation(false)}>Cerrar</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* Modal Crear OC */}
 {pedido && (
 <CrearOCModal
 open={crearOCModalOpen}
 onClose={() => setCrearOCModalOpen(false)}
 pedidoId={pedido.id}
 onSuccess={handleOCCreated}
 />
 )}

 {/* Modal Detalle Cotización */}
 <CotizacionDetailModal
 open={cotizacionDetailOpen}
 onClose={() => {
 setCotizacionDetailOpen(false);
 setCotizacionDetalle(null);
 }}
 cotizacion={cotizacionDetalle}
 />
 </>
 );
}

export default PedidoCompraDetailModal;
