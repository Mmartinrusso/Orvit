'use client';

import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow
} from '@/components/ui/table';
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogBody,
 DialogFooter,
 DialogHeader,
 DialogTitle,
} from '@/components/ui/dialog';
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuSeparator,
 DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
 HoverCard,
 HoverCardContent,
 HoverCardTrigger,
} from '@/components/ui/hover-card';
import {
 Edit,
 Trash2,
 CheckCircle,
 XCircle,
 Clock,
 Building2,
 User,
 Calendar,
 DollarSign,
 FileText,
 AlertTriangle,
 Mail,
 Phone,
 Hash,
 X,
 Loader2,
 CreditCard,
 ExternalLink,
 MoreHorizontal,
 Package
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date-utils';
import { RegistrarPagoModal } from './RegistrarPagoModal';

interface ReceiptItem {
 id: number;
 descripcion: string;
 cantidad: number;
 unidad: string;
 precioUnitario: number;
 subtotal: number;
}

interface Comprobante {
 id: number;
 receiptId: number;
 montoSolicitado: number;
 receipt: {
 id: number;
 tipo: string;
 numeroSerie: string;
 numeroFactura: string;
 total: number;
 estado: string;
 fechaEmision: string | null;
 fechaVencimiento: string | null;
 items: ReceiptItem[];
 } | null;
}

interface Solicitud {
 id: number;
 numero: string;
 estado: string;
 estadoRaw: string;
 prioridad: string;
 prioridadRaw: string;
 esUrgente: boolean;
 fechaSolicitud: string;
 fechaObjetivo: string | null;
 fechaAprobacion: string | null;
 fechaPago: string | null;
 montoTotal: number;
 motivo: string | null;
 comentarios: string | null;
 motivoRechazo: string | null;
 proveedor: {
 id: number;
 nombre: string;
 razonSocial: string | null;
 cuit: string | null;
 email: string | null;
 telefono: string | null;
 };
 solicitante: {
 id: number;
 nombre: string;
 email: string;
 };
 aprobadoPor: {
 id: number;
 nombre: string;
 } | null;
 rechazadoPor: {
 id: number;
 nombre: string;
 } | null;
 comprobantes: Comprobante[];
 historial: any[];
 createdAt: string;
 updatedAt: string;
 disponibleParaPagar: boolean;
 puedeEditar: boolean;
 puedeEliminar: boolean;
}

interface SolicitudDetalleModalProps {
 solicitudId: string | number | null;
 open: boolean;
 onOpenChange: (open: boolean) => void;
 onSolicitudUpdated?: () => void;
}

const getEstadoBadge = (estado: string) => {
 const estados: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
 borrador: { color: 'bg-muted text-foreground border-border', label: 'Borrador', icon: <FileText className="w-3 h-3" /> },
 pendiente: { color: 'bg-warning-muted text-warning-muted-foreground border-warning-muted', label: 'Pendiente', icon: <Clock className="w-3 h-3" /> },
 en_revision: { color: 'bg-warning-muted text-warning-muted-foreground border-warning-muted', label: 'En Revisión', icon: <AlertTriangle className="w-3 h-3" /> },
 aprobada: { color: 'bg-info-muted text-info-muted-foreground border-info-muted', label: 'Pendiente de Pago', icon: <CreditCard className="w-3 h-3" /> },
 rechazada: { color: 'bg-destructive/10 text-destructive border-destructive/30', label: 'Rechazada', icon: <XCircle className="w-3 h-3" /> },
 convertida: { color: 'bg-info-muted text-info-muted-foreground border-info-muted', label: 'Convertida', icon: <DollarSign className="w-3 h-3" /> },
 pagada: { color: 'bg-success-muted text-success-muted-foreground border-success-muted', label: 'Pagada', icon: <CheckCircle className="w-3 h-3" /> },
 cancelada: { color: 'bg-muted text-foreground border-border', label: 'Cancelada', icon: <XCircle className="w-3 h-3" /> }
 };
 return estados[estado] || estados.pendiente;
};

const getPrioridadBadge = (prioridad: string) => {
 const prioridades: Record<string, { color: string; label: string }> = {
 baja: { color: 'bg-muted text-foreground border-border', label: 'Baja' },
 media: { color: 'bg-info-muted text-info-muted-foreground border-info-muted', label: 'Media' },
 alta: { color: 'bg-warning-muted text-warning-muted-foreground border-warning-muted', label: 'Alta' },
 urgente: { color: 'bg-destructive/10 text-destructive border-destructive/30', label: 'Urgente' }
 };
 return prioridades[prioridad] || prioridades.media;
};

const formatCurrency = (amount: number) => {
 return new Intl.NumberFormat('es-AR', {
 style: 'currency',
 currency: 'ARS',
 maximumFractionDigits: 0
 }).format(amount);
};

// formatDate imported from @/lib/date-utils (returns '' for null/undefined)

export function SolicitudDetalleModal({
 solicitudId,
 open,
 onOpenChange,
 onSolicitudUpdated
}: SolicitudDetalleModalProps) {
 const router = useRouter();
 const [solicitud, setSolicitud] = useState<Solicitud | null>(null);
 const [loading, setLoading] = useState(false);
 const [showDeleteDialog, setShowDeleteDialog] = useState(false);
 const [showRejectDialog, setShowRejectDialog] = useState(false);
 const [showPagoModal, setShowPagoModal] = useState(false);
 const [motivoRechazo, setMotivoRechazo] = useState('');
 const [actionLoading, setActionLoading] = useState(false);

 // Combinar todos los items de todos los comprobantes
 const todosLosItems = useMemo(() => {
 if (!solicitud) return [];
 return solicitud.comprobantes.flatMap(comp =>
 comp.receipt?.items?.map(item => ({
 ...item,
 comprobanteNumero: comp.receipt ? `${comp.receipt.numeroSerie}-${comp.receipt.numeroFactura}` : ''
 })) || []
 );
 }, [solicitud]);

 useEffect(() => {
 if (open && solicitudId) {
 loadSolicitud();
 } else if (!open) {
 setSolicitud(null);
 }
 }, [open, solicitudId]);

 const loadSolicitud = async () => {
 if (!solicitudId) return;

 setLoading(true);
 try {
 const response = await fetch(`/api/compras/solicitudes/${solicitudId}`);
 if (!response.ok) {
 throw new Error('Error al cargar solicitud');
 }
 const data = await response.json();
 setSolicitud(data.solicitud);
 } catch (error) {
 console.error('Error:', error);
 toast.error('Error al cargar la solicitud');
 onOpenChange(false);
 } finally {
 setLoading(false);
 }
 };

 const handleDelete = async () => {
 if (!solicitud) return;

 setActionLoading(true);
 try {
 const response = await fetch(`/api/compras/solicitudes/${solicitud.id}`, {
 method: 'DELETE'
 });

 if (!response.ok) {
 const error = await response.json();
 throw new Error(error.error || 'Error al eliminar');
 }

 toast.success('Solicitud eliminada exitosamente');
 onOpenChange(false);
 onSolicitudUpdated?.();
 } catch (error: any) {
 toast.error(error.message);
 } finally {
 setActionLoading(false);
 setShowDeleteDialog(false);
 }
 };

 const handleAprobar = async () => {
 if (!solicitud) return;

 setActionLoading(true);
 try {
 const response = await fetch(`/api/compras/solicitudes/${solicitud.id}/aprobar`, {
 method: 'POST'
 });

 if (!response.ok) {
 const error = await response.json();
 throw new Error(error.error || 'Error al aprobar');
 }

 toast.success('Solicitud aprobada exitosamente');
 loadSolicitud();
 onSolicitudUpdated?.();
 } catch (error: any) {
 toast.error(error.message);
 } finally {
 setActionLoading(false);
 }
 };

 const handleRechazar = async () => {
 if (!solicitud || !motivoRechazo.trim()) {
 toast.error('Debe ingresar un motivo de rechazo');
 return;
 }

 setActionLoading(true);
 try {
 const response = await fetch(`/api/compras/solicitudes/${solicitud.id}/rechazar`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ motivo: motivoRechazo })
 });

 if (!response.ok) {
 const error = await response.json();
 throw new Error(error.error || 'Error al rechazar');
 }

 toast.success('Solicitud rechazada');
 setShowRejectDialog(false);
 setMotivoRechazo('');
 loadSolicitud();
 onSolicitudUpdated?.();
 } catch (error: any) {
 toast.error(error.message);
 } finally {
 setActionLoading(false);
 }
 };

 const handleEdit = () => {
 if (!solicitud) return;
 onOpenChange(false);
 router.push(`/administracion/compras/solicitudes/${solicitud.id}/editar`);
 };

 const handleSacarPago = () => {
 if (!solicitud) return;
 // Abrir modal de pago directamente
 setShowPagoModal(true);
 };

 const handlePaymentComplete = () => {
 setShowPagoModal(false);
 onOpenChange(false);
 onSolicitudUpdated?.();
 };

 const handleIrACuentaCorriente = () => {
 if (!solicitud) return;
 const params = new URLSearchParams();
 params.set('tab', 'cuenta-corriente');
 solicitud.comprobantes.forEach((comp) => {
 if (comp.receiptId) {
 params.append('selectInvoices', String(comp.receiptId));
 }
 });
 onOpenChange(false);
 router.push(`/administracion/compras/proveedores/${solicitud.proveedor.id}?${params.toString()}`);
 };

 if (!open) return null;

 const estadoInfo = solicitud ? getEstadoBadge(solicitud.estado) : null;
 const prioridadInfo = solicitud ? getPrioridadBadge(solicitud.prioridad) : null;

 return (
 <>
 <Dialog open={open && !showDeleteDialog && !showRejectDialog && !showPagoModal} onOpenChange={onOpenChange}>
 <DialogContent size="xl" className="p-0 gap-0">
 {loading ? (
 <div className="flex items-center justify-center h-64">
 <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
 </div>
 ) : solicitud ? (
 <>
 {/* Header */}
 <div className="flex items-center justify-between px-6 py-4 border-b">
 <div className="flex items-center gap-3">
 <h2 className="text-lg font-semibold">{solicitud.numero}</h2>
 <Badge className={cn(estadoInfo?.color, 'border text-xs px-2 py-0.5 flex items-center gap-1')}>
 {estadoInfo?.icon}
 {estadoInfo?.label}
 </Badge>
 <Badge className={cn(prioridadInfo?.color, 'border text-xs px-2 py-0.5')}>
 {prioridadInfo?.label}
 </Badge>
 {solicitud.esUrgente && (
 <Badge variant="destructive" className="text-xs px-2 py-0.5">
 URGENTE
 </Badge>
 )}
 </div>
 <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
 <X className="w-4 h-4" />
 </Button>
 </div>

 <ScrollArea className="max-h-[calc(90vh-140px)]">
 <div className="p-6 space-y-6">
 {/* Info Grid */}
 <div className="grid grid-cols-2 gap-6">
 {/* Proveedor */}
 <div className="space-y-2">
 <h3 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
 <Building2 className="w-3.5 h-3.5" />
 PROVEEDOR
 </h3>
 <div>
 <p className="text-sm font-medium">{solicitud.proveedor.nombre}</p>
 {solicitud.proveedor.razonSocial && solicitud.proveedor.razonSocial !== solicitud.proveedor.nombre && (
 <p className="text-xs text-muted-foreground">{solicitud.proveedor.razonSocial}</p>
 )}
 <div className="mt-2 space-y-1 text-xs text-muted-foreground">
 {solicitud.proveedor.cuit && (
 <div className="flex items-center gap-1.5">
 <Hash className="w-3 h-3" />
 CUIT: {solicitud.proveedor.cuit}
 </div>
 )}
 {solicitud.proveedor.email && (
 <div className="flex items-center gap-1.5">
 <Mail className="w-3 h-3" />
 {solicitud.proveedor.email}
 </div>
 )}
 {solicitud.proveedor.telefono && (
 <div className="flex items-center gap-1.5">
 <Phone className="w-3 h-3" />
 {solicitud.proveedor.telefono}
 </div>
 )}
 </div>
 </div>
 </div>

 {/* Información */}
 <div className="space-y-2">
 <h3 className="text-xs font-medium text-muted-foreground">INFORMACIÓN</h3>
 <div className="space-y-2 text-xs">
 <div className="flex items-center justify-between">
 <span className="text-muted-foreground flex items-center gap-1.5">
 <User className="w-3 h-3" />
 Solicitante
 </span>
 <span className="font-medium">{solicitud.solicitante.nombre}</span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-muted-foreground flex items-center gap-1.5">
 <Calendar className="w-3 h-3" />
 Fecha
 </span>
 <span className="font-medium">{formatDate(solicitud.fechaSolicitud)}</span>
 </div>
 {solicitud.fechaObjetivo && (
 <div className="flex items-center justify-between">
 <span className="text-muted-foreground flex items-center gap-1.5">
 <Calendar className="w-3 h-3" />
 Objetivo
 </span>
 <span className="font-medium">{formatDate(solicitud.fechaObjetivo)}</span>
 </div>
 )}
 <Separator className="my-2" />
 <div className="flex items-center justify-between">
 <span className="text-muted-foreground flex items-center gap-1.5">
 <DollarSign className="w-3 h-3" />
 Monto Total
 </span>
 <span className="font-semibold text-sm">{formatCurrency(solicitud.montoTotal)}</span>
 </div>
 </div>
 </div>
 </div>

 {/* Comprobantes */}
 <div className="space-y-2">
 <h3 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
 <FileText className="w-3.5 h-3.5" />
 COMPROBANTES INCLUIDOS ({solicitud.comprobantes.length})
 </h3>
 <div className="border rounded-lg overflow-hidden">
 <Table>
 <TableHeader>
 <TableRow className="bg-muted/30">
 <TableHead className="text-xs font-medium">Tipo</TableHead>
 <TableHead className="text-xs font-medium">Número</TableHead>
 <TableHead className="text-xs font-medium">Emisión</TableHead>
 <TableHead className="text-xs font-medium">Vencimiento</TableHead>
 <TableHead className="text-xs font-medium text-right">Monto</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {solicitud.comprobantes.map((comp) => {
 const hasItems = comp.receipt?.items && comp.receipt.items.length > 0;
 const rowContent = (
 <TableRow key={comp.id} className={hasItems ? 'cursor-help' : ''}>
 <TableCell className="text-xs">
 <Badge variant="outline" className="text-xs px-1.5">
 {comp.receipt?.tipo || 'N/A'}
 </Badge>
 </TableCell>
 <TableCell className="text-xs">
 {comp.receipt ? `${comp.receipt.numeroSerie}-${comp.receipt.numeroFactura}` : 'N/A'}
 </TableCell>
 <TableCell className="text-xs text-muted-foreground">
 {formatDate(comp.receipt?.fechaEmision || null)}
 </TableCell>
 <TableCell className="text-xs text-muted-foreground">
 {formatDate(comp.receipt?.fechaVencimiento || null)}
 </TableCell>
 <TableCell className="text-xs font-medium text-right">
 {formatCurrency(comp.montoSolicitado)}
 </TableCell>
 </TableRow>
 );

 if (hasItems) {
 return (
 <HoverCard key={comp.id} openDelay={200} closeDelay={100}>
 <HoverCardTrigger asChild>
 {rowContent}
 </HoverCardTrigger>
 <HoverCardContent side="top" align="center" className="w-80 p-3">
 <div className="space-y-2">
 <p className="text-xs font-semibold text-muted-foreground">
 Items de {comp.receipt?.tipo} {comp.receipt?.numeroSerie}-{comp.receipt?.numeroFactura}
 </p>
 <div className="space-y-1 max-h-48 overflow-y-auto">
 {comp.receipt?.items.map((item) => (
 <div
 key={item.id}
 className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1.5"
 >
 <span className="flex-1 truncate pr-2">{item.descripcion}</span>
 <span className="text-muted-foreground mx-3 whitespace-nowrap text-xs">
 {item.cantidad} {item.unidad}
 </span>
 <span className="font-medium whitespace-nowrap">
 {formatCurrency(item.subtotal)}
 </span>
 </div>
 ))}
 </div>
 </div>
 </HoverCardContent>
 </HoverCard>
 );
 }
 return rowContent;
 })}
 {solicitud.comprobantes.length === 0 && (
 <TableRow>
 <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-6">
 No hay comprobantes asociados
 </TableCell>
 </TableRow>
 )}
 </TableBody>
 </Table>
 </div>
 </div>

 {/* Resumen de todos los items a pagar */}
 {todosLosItems.length > 0 && (
 <div className="space-y-2">
 <h3 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
 <Package className="w-3.5 h-3.5" />
 ITEMS A PAGAR ({todosLosItems.length})
 </h3>
 <div className="border rounded-lg bg-muted/20 p-3 max-h-48 overflow-y-auto">
 <div className="space-y-1">
 {todosLosItems.map((item, idx) => (
 <div
 key={`${item.id}-${idx}`}
 className="flex items-center justify-between text-xs bg-background rounded px-3 py-1.5 border"
 >
 <span className="flex-1 truncate">{item.descripcion}</span>
 <span className="text-muted-foreground mx-4 whitespace-nowrap text-xs">
 {item.cantidad} {item.unidad}
 </span>
 <span className="font-medium whitespace-nowrap">
 {formatCurrency(item.subtotal)}
 </span>
 </div>
 ))}
 </div>
 </div>
 </div>
 )}

 {/* Observaciones */}
 {solicitud.motivo && (
 <div className="space-y-2">
 <h3 className="text-xs font-medium text-muted-foreground">OBSERVACIONES</h3>
 <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3 whitespace-pre-wrap">
 {solicitud.motivo}
 </p>
 </div>
 )}

 {/* Motivo de rechazo */}
 {solicitud.motivoRechazo && (
 <div className="space-y-2 bg-destructive/10 border border-destructive/30 rounded-lg p-4">
 <h3 className="text-xs font-medium text-destructive flex items-center gap-1.5">
 <XCircle className="w-3.5 h-3.5" />
 MOTIVO DE RECHAZO
 </h3>
 <p className="text-sm text-destructive">{solicitud.motivoRechazo}</p>
 {solicitud.rechazadoPor && (
 <p className="text-xs text-destructive">
 Rechazado por: {solicitud.rechazadoPor.nombre}
 </p>
 )}
 </div>
 )}
 </div>
 </ScrollArea>

 {/* Footer con acciones */}
 <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/20">
 {/* Menú de opciones secundarias */}
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="outline" size="sm">
 <MoreHorizontal className="w-4 h-4 mr-1" />
 Opciones
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="start" className="w-48">
 <DropdownMenuItem onClick={handleIrACuentaCorriente}>
 <ExternalLink className="w-4 h-4 mr-2" />
 Ir a Cta. Corriente
 </DropdownMenuItem>
 {solicitud.puedeEditar && (
 <DropdownMenuItem onClick={handleEdit}>
 <Edit className="w-4 h-4 mr-2" />
 Editar solicitud
 </DropdownMenuItem>
 )}
 {solicitud.estado === 'pendiente' && (
 <>
 <DropdownMenuSeparator />
 <DropdownMenuItem
 className="text-destructive focus:text-destructive"
 onClick={() => setShowRejectDialog(true)}
 >
 <XCircle className="w-4 h-4 mr-2" />
 Rechazar
 </DropdownMenuItem>
 </>
 )}
 {solicitud.puedeEliminar && (
 <>
 <DropdownMenuSeparator />
 <DropdownMenuItem
 className="text-destructive focus:text-destructive"
 onClick={() => setShowDeleteDialog(true)}
 >
 <Trash2 className="w-4 h-4 mr-2" />
 Eliminar
 </DropdownMenuItem>
 </>
 )}
 </DropdownMenuContent>
 </DropdownMenu>

 {/* Acciones principales */}
 <div className="flex items-center gap-2">
 {solicitud.estado === 'pendiente' && (
 <Button
 size="sm"
 className="bg-success hover:bg-success/90"
 onClick={handleAprobar}
 disabled={actionLoading}
 >
 {actionLoading ? (
 <Loader2 className="w-4 h-4 mr-1 animate-spin" />
 ) : (
 <CheckCircle className="w-4 h-4 mr-1" />
 )}
 Aprobar
 </Button>
 )}
 {solicitud.disponibleParaPagar && (
 <Button
 size="sm"
 onClick={handleSacarPago}
 >
 <CreditCard className="w-4 h-4 mr-1" />
 Sacar Pago
 </Button>
 )}
 </div>
 </div>
 </>
 ) : (
 <div className="flex items-center justify-center h-64">
 <p className="text-muted-foreground">Solicitud no encontrada</p>
 </div>
 )}
 </DialogContent>
 </Dialog>

 {/* Dialog de confirmación de eliminación */}
 <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Eliminar Solicitud</DialogTitle>
 <DialogDescription>
 ¿Está seguro que desea eliminar la solicitud {solicitud?.numero}? Esta acción no se puede deshacer.
 </DialogDescription>
 </DialogHeader>
 <DialogFooter>
 <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={actionLoading}>
 Cancelar
 </Button>
 <Button variant="destructive" onClick={handleDelete} disabled={actionLoading}>
 {actionLoading ? 'Eliminando...' : 'Eliminar'}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* Dialog de rechazo */}
 <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Rechazar Solicitud</DialogTitle>
 <DialogDescription>
 Ingrese el motivo del rechazo para la solicitud {solicitud?.numero}.
 </DialogDescription>
 </DialogHeader>
 <DialogBody>
 <Textarea
 placeholder="Motivo del rechazo..."
 value={motivoRechazo}
 onChange={(e) => setMotivoRechazo(e.target.value)}
 rows={4}
 />
 </DialogBody>
 <DialogFooter>
 <Button variant="outline" onClick={() => setShowRejectDialog(false)} disabled={actionLoading}>
 Cancelar
 </Button>
 <Button
 variant="destructive"
 onClick={handleRechazar}
 disabled={actionLoading || !motivoRechazo.trim()}
 >
 {actionLoading ? 'Rechazando...' : 'Rechazar'}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* Modal de pago */}
 {solicitud && (
 <RegistrarPagoModal
 open={showPagoModal}
 onOpenChange={setShowPagoModal}
 proveedorId={solicitud.proveedor.id}
 proveedorNombre={solicitud.proveedor.nombre || solicitud.proveedor.razonSocial || 'Proveedor'}
 preSelectedInvoices={solicitud.comprobantes.map(c => c.receiptId)}
 onPaymentComplete={handlePaymentComplete}
 />
 )}
 </>
 );
}
