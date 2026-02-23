'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
 DialogHeader,
 DialogTitle,
 DialogBody,
} from '@/components/ui/dialog';
import {
 Package,
 Building2,
 Calendar,
 Warehouse,
 FileText,
 CheckCircle,
 Clock,
 AlertTriangle,
 ShoppingCart,
 User,
 Image,
 PenTool,
 ExternalLink,
 Truck,
 Tag,
 Hash,
 Edit,
 X,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatDate, formatDateTime } from '@/lib/date-utils';
import { useRouter } from 'next/navigation';

interface RecepcionItem {
 id: number;
 cantidadEsperada?: number;
 cantidadRecibida: number;
 cantidadAceptada?: number;
 cantidadRechazada?: number;
 unidad: string;
 descripcion: string;
 codigoPropio?: string;
 codigoProveedor?: string;
 descripcionItem?: string;
 supplierItem?: {
 id: number;
 nombre: string;
 unidad: string;
 codigoProveedor?: string;
 supply?: { code?: string };
 };
 purchaseOrderItem?: {
 id: number;
 cantidad: number;
 cantidadRecibida: number;
 cantidadPendiente: number;
 precioUnitario: number;
 codigoPropio?: string;
 };
}

interface RecepcionDetalle {
 id: number;
 numero: string;
 fechaRecepcion: string;
 numeroRemito?: string;
 estado: string;
 notas?: string;
 adjuntos?: string[];
 firma?: string;
 observacionesRecepcion?: string;
 proveedor?: {
 id: number;
 name: string;
 cuit?: string;
 razon_social?: string;
 email?: string;
 phone?: string;
 };
 purchaseOrder?: {
 id: number;
 numero: string;
 estado: string;
 fechaEmision: string;
 total: number;
 };
 warehouse?: {
 id: number;
 codigo: string;
 nombre: string;
 direccion?: string;
 };
 factura?: {
 id: number;
 numeroSerie: string;
 numeroFactura: string;
 fechaEmision: string;
 total: number;
 };
 createdByUser?: {
 id: number;
 name: string;
 };
 items: RecepcionItem[];
 stockMovements?: Array<{
 id: number;
 tipo: string;
 cantidad: number;
 createdAt: string;
 }>;
 matchResults?: Array<{
 id: number;
 estado: string;
 matchCompleto: boolean;
 createdAt: string;
 }>;
}

interface RecepcionDetalleModalProps {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 recepcionId: number | null;
}

export function RecepcionDetalleModal({ open, onOpenChange, recepcionId }: RecepcionDetalleModalProps) {
 const router = useRouter();
 const [recepcion, setRecepcion] = useState<RecepcionDetalle | null>(null);
 const [loading, setLoading] = useState(false);
 const [showEvidenciaModal, setShowEvidenciaModal] = useState(false);

 const loadRecepcion = async (id: number) => {
 try {
 setLoading(true);
 const response = await fetch(`/api/compras/recepciones/${id}`);
 if (!response.ok) {
 throw new Error('Error al cargar la recepcion');
 }
 const data = await response.json();
 setRecepcion(data);
 } catch (error) {
 console.error('Error:', error);
 toast.error('Error al cargar la recepcion');
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 if (open && recepcionId) {
 loadRecepcion(recepcionId);
 } else if (!open) {
 setRecepcion(null);
 }
 }, [open, recepcionId]);

 const getEstadoBadge = (estado: string) => {
 const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
 'CONFIRMADA': { variant: 'default', icon: <CheckCircle className="w-3 h-3 mr-1" /> },
 'BORRADOR': { variant: 'outline', icon: <Edit className="w-3 h-3 mr-1" /> },
 'ANULADA': { variant: 'destructive', icon: <AlertTriangle className="w-3 h-3 mr-1" /> },
 };
 const c = config[estado] || config['BORRADOR'];
 return (
 <Badge variant={c.variant} className="flex items-center text-xs">
 {c.icon}
 {estado}
 </Badge>
 );
 };

 const formatCurrency = (amount: number) => {
 return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
 };

 const hasEvidencia = recepcion?.adjuntos?.length || recepcion?.firma;

 return (
 <>
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent size="full" className="p-0">
 <DialogHeader className="px-8 pt-8 pb-6 border-b">

 <DialogTitle className="flex items-center gap-3 text-xl">
 <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
 <Package className="w-5 h-5 text-primary" />
 </div>
 {loading ? 'Cargando recepción...' : `Recepción ${recepcion?.numero || ''}`}
 </DialogTitle>
 </DialogHeader>

 {loading ? (
 <DialogBody className="space-y-6 px-8">
 <div className="grid grid-cols-3 gap-6">
 <Skeleton className="h-36" />
 <Skeleton className="h-36" />
 <Skeleton className="h-36" />
 </div>
 <Skeleton className="h-56" />
 </DialogBody>
 ) : !recepcion ? (
 <DialogBody className="py-12 text-center px-8">
 <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
 <h2 className="text-lg font-medium">Recepcion no encontrada</h2>
 <p className="text-muted-foreground mt-2">La recepcion solicitada no existe o no tienes acceso.</p>
 </DialogBody>
 ) : (
 <DialogBody className="space-y-6 px-8">
 {/* Header con estado y acciones */}
 <div className="flex items-center justify-between bg-muted/30 rounded-lg p-4">
 <div className="flex items-center gap-4">
 {getEstadoBadge(recepcion.estado)}
 {recepcion.numeroRemito && (
 <div className="flex items-center gap-2 text-sm">
 <FileText className="w-4 h-4 text-muted-foreground" />
 <span className="text-muted-foreground">Remito:</span>
 <span className="font-medium">{recepcion.numeroRemito}</span>
 </div>
 )}
 </div>
 {hasEvidencia && (
 <Button variant="default" size="sm" onClick={() => setShowEvidenciaModal(true)} className="gap-2">
 <Image className="w-4 h-4" />
 Ver Evidencia
 </Button>
 )}
 </div>

 {/* Info Cards */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 {/* Proveedor */}
 <div className="border rounded-xl p-5 bg-card shadow-sm">
 <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-4">
 <div className="h-7 w-7 rounded-full bg-info-muted flex items-center justify-center">
 <Building2 className="w-4 h-4 text-info-muted-foreground " />
 </div>
 Proveedor
 </h3>
 {recepcion.proveedor ? (
 <div className="space-y-2">
 <p className="font-semibold text-base">{recepcion.proveedor.name}</p>
 {recepcion.proveedor.cuit && (
 <p className="text-sm text-muted-foreground">CUIT: {recepcion.proveedor.cuit}</p>
 )}
 <Button
 variant="outline"
 size="sm"
 className="mt-2"
 onClick={() => {
 onOpenChange(false);
 router.push(`/administracion/compras/proveedores/${recepcion.proveedor?.id}`);
 }}
 >
 Ver proveedor <ExternalLink className="w-3 h-3 ml-2" />
 </Button>
 </div>
 ) : (
 <p className="text-muted-foreground">Sin proveedor</p>
 )}
 </div>

 {/* Orden de Compra */}
 <div className="border rounded-xl p-5 bg-card shadow-sm">
 <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-4">
 <div className="h-7 w-7 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
 <ShoppingCart className="w-4 h-4 text-violet-600 dark:text-violet-400" />
 </div>
 Orden de Compra
 </h3>
 {recepcion.purchaseOrder ? (
 <div className="space-y-2">
 <p className="font-semibold text-base">{recepcion.purchaseOrder.numero}</p>
 <p className="text-sm text-muted-foreground">
 {formatDate(recepcion.purchaseOrder.fechaEmision)}
 </p>
 <p className="text-sm font-medium">Total: {formatCurrency(recepcion.purchaseOrder.total)}</p>
 <Badge variant="outline" className="mt-1">
 {recepcion.purchaseOrder.estado}
 </Badge>
 </div>
 ) : (
 <p className="text-muted-foreground">Sin OC relacionada</p>
 )}
 </div>

 {/* Info de Recepcion */}
 <div className="border rounded-xl p-5 bg-card shadow-sm">
 <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-4">
 <div className="h-7 w-7 rounded-full bg-success-muted flex items-center justify-center">
 <Truck className="w-4 h-4 text-success-muted-foreground" />
 </div>
 Info Recepción
 </h3>
 <div className="space-y-3">
 <div className="flex items-center gap-2 text-sm">
 <Calendar className="w-4 h-4 text-muted-foreground" />
 <span className="font-medium">
 {formatDateTime(recepcion.fechaRecepcion)}
 </span>
 </div>
 {recepcion.warehouse && (
 <div className="flex items-center gap-2 text-sm">
 <Warehouse className="w-4 h-4 text-muted-foreground" />
 <span>{recepcion.warehouse.nombre}</span>
 </div>
 )}
 {recepcion.createdByUser && (
 <div className="flex items-center gap-2 text-sm">
 <User className="w-4 h-4 text-muted-foreground" />
 <span>{recepcion.createdByUser.name}</span>
 </div>
 )}
 {recepcion.factura && (
 <div className="flex items-center gap-2 text-sm mt-2 pt-2 border-t">
 <FileText className="w-4 h-4 text-muted-foreground" />
 <span>Factura: <span className="font-medium">{recepcion.factura.numeroSerie}-{recepcion.factura.numeroFactura}</span></span>
 </div>
 )}
 </div>
 </div>
 </div>

 {/* Notas */}
 {(recepcion.notas || recepcion.observacionesRecepcion) && (
 <div className="border rounded-xl p-5 bg-warning-muted/50 border-warning-muted ">
 <h3 className="text-sm font-semibold text-warning-muted-foreground mb-3 flex items-center gap-2">
 <FileText className="w-4 h-4" />
 Notas / Observaciones
 </h3>
 <p className="text-sm whitespace-pre-wrap text-warning-muted-foreground ">
 {recepcion.observacionesRecepcion || recepcion.notas}
 </p>
 </div>
 )}

 {/* Items */}
 <div className="border rounded-xl overflow-hidden shadow-sm">
 <div className="px-5 py-4 bg-muted/30 border-b">
 <h3 className="text-sm font-semibold flex items-center gap-2">
 <Package className="w-4 h-4 text-primary" />
 Items Recibidos ({recepcion.items.length})
 </h3>
 </div>
 <div className="overflow-x-auto max-h-[350px]">
 <Table>
 <TableHeader>
 <TableRow className="bg-muted/30">
 <TableHead className="text-xs font-semibold">Cod. Interno</TableHead>
 <TableHead className="text-xs font-semibold">Cod. Proveedor</TableHead>
 <TableHead className="text-xs font-semibold">Descripción</TableHead>
 <TableHead className="text-xs font-semibold text-center">Esperada</TableHead>
 <TableHead className="text-xs font-semibold text-center">Recibida</TableHead>
 <TableHead className="text-xs font-semibold text-center">Aceptada</TableHead>
 <TableHead className="text-xs font-semibold text-center">Unidad</TableHead>
 {recepcion.items.some(i => i.purchaseOrderItem?.precioUnitario) && (
 <>
 <TableHead className="text-xs font-semibold text-right">Precio</TableHead>
 <TableHead className="text-xs font-semibold text-right">Subtotal</TableHead>
 </>
 )}
 </TableRow>
 </TableHeader>
 <TableBody>
 {recepcion.items.map((item) => {
 const codigoInterno = item.codigoPropio || item.purchaseOrderItem?.codigoPropio || item.supplierItem?.supply?.code || '-';
 const codigoProv = item.codigoProveedor || item.supplierItem?.codigoProveedor || '-';
 const descripcion = item.descripcionItem || item.descripcion || item.supplierItem?.nombre || '-';
 const precioUnit = item.purchaseOrderItem?.precioUnitario || 0;
 const subtotal = (item.cantidadAceptada || item.cantidadRecibida) * precioUnit;

 return (
 <TableRow key={item.id} className="hover:bg-muted/30">
 <TableCell className="font-mono text-xs">
 {codigoInterno !== '-' ? (
 <span className="flex items-center gap-1">
 <Hash className="w-3 h-3 text-muted-foreground" />
 {codigoInterno}
 </span>
 ) : (
 <span className="text-muted-foreground">-</span>
 )}
 </TableCell>
 <TableCell className="font-mono text-xs">
 {codigoProv !== '-' ? (
 <span className="flex items-center gap-1">
 <Tag className="w-3 h-3 text-muted-foreground" />
 {codigoProv}
 </span>
 ) : (
 <span className="text-muted-foreground">-</span>
 )}
 </TableCell>
 <TableCell className="text-sm max-w-[280px]">
 <span className="line-clamp-2 font-medium">{descripcion}</span>
 </TableCell>
 <TableCell className="text-center text-sm text-muted-foreground">
 {item.cantidadEsperada ?? '-'}
 </TableCell>
 <TableCell className="text-center font-semibold text-sm">
 {item.cantidadRecibida}
 </TableCell>
 <TableCell className="text-center font-semibold text-sm text-success-muted-foreground">
 {item.cantidadAceptada ?? item.cantidadRecibida}
 </TableCell>
 <TableCell className="text-center text-sm text-muted-foreground">
 {item.unidad || item.supplierItem?.unidad || 'UN'}
 </TableCell>
 {recepcion.items.some(i => i.purchaseOrderItem?.precioUnitario) && (
 <>
 <TableCell className="text-right text-sm">
 {precioUnit > 0 ? formatCurrency(precioUnit) : '-'}
 </TableCell>
 <TableCell className="text-right font-semibold text-sm">
 {subtotal > 0 ? formatCurrency(subtotal) : '-'}
 </TableCell>
 </>
 )}
 </TableRow>
 );
 })}
 </TableBody>
 </Table>
 </div>
 </div>

 {/* Movimientos de Stock */}
 {recepcion.stockMovements && recepcion.stockMovements.length > 0 && (
 <div className="border rounded-xl p-5 bg-card shadow-sm">
 <h3 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
 <div className="h-7 w-7 rounded-full bg-accent-cyan-muted flex items-center justify-center">
 <Package className="w-4 h-4 text-accent-cyan-muted-foreground" />
 </div>
 Movimientos de Stock ({recepcion.stockMovements.length})
 </h3>
 <div className="space-y-2">
 {recepcion.stockMovements.slice(0, 5).map((mov) => (
 <div key={mov.id} className="flex items-center justify-between text-sm p-3 bg-muted/30 rounded-lg">
 <span className="text-muted-foreground">
 {format(new Date(mov.createdAt), 'dd/MM/yy HH:mm', { locale: es })}
 </span>
 <Badge variant="outline">{mov.tipo}</Badge>
 <span className="font-semibold">{mov.cantidad}</span>
 </div>
 ))}
 </div>
 </div>
 )}
 </DialogBody>
 )}
 </DialogContent>
 </Dialog>

 {/* Modal de Evidencia */}
 <Dialog open={showEvidenciaModal} onOpenChange={setShowEvidenciaModal}>
 <DialogContent size="lg" className="p-0">
 <DialogHeader className="px-8 pt-8 pb-6 border-b">
 <DialogTitle className="flex items-center gap-3 text-xl">
 <div className="h-10 w-10 rounded-full bg-success-muted flex items-center justify-center">
 <Image className="w-5 h-5 text-success-muted-foreground" />
 </div>
 Evidencia de Recepción
 {recepcion && (
 <Badge variant="outline" className="ml-2">
 {recepcion.numero}
 </Badge>
 )}
 </DialogTitle>
 </DialogHeader>

 <DialogBody className="space-y-8 px-8">
 {/* Fotos */}
 {recepcion?.adjuntos && recepcion.adjuntos.length > 0 && (
 <div className="bg-muted/30 rounded-xl p-6">
 <h3 className="text-base font-semibold mb-4 flex items-center gap-3">
 <div className="h-8 w-8 rounded-full bg-info-muted flex items-center justify-center">
 <Image className="w-4 h-4 text-info-muted-foreground " />
 </div>
 Fotos del Remito / Mercadería
 <Badge variant="secondary" className="ml-auto">{recepcion.adjuntos.length}</Badge>
 </h3>
 <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
 {recepcion.adjuntos.map((url, index) => (
 <div
 key={index}
 className="group relative aspect-video bg-background rounded-xl overflow-hidden border-2 border-transparent hover:border-primary/50 transition-all shadow-sm hover:shadow-lg cursor-pointer"
 onClick={() => window.open(url, '_blank')}
 >
 <img
 src={url}
 alt={`Foto ${index + 1}`}
 className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
 />
 <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
 <ExternalLink className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
 </div>
 <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
 Foto {index + 1}
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Firma */}
 {recepcion?.firma && (
 <div className="bg-muted/30 rounded-xl p-6">
 <h3 className="text-base font-semibold mb-4 flex items-center gap-3">
 <div className="h-8 w-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
 <PenTool className="w-4 h-4 text-violet-600 dark:text-violet-400" />
 </div>
 Firma de Conformidad
 </h3>
 <div className="flex justify-center">
 <div className="bg-background border-2 border-dashed border-muted-foreground/30 rounded-xl p-6 max-w-md w-full">
 <img
 src={recepcion.firma}
 alt="Firma de conformidad"
 className="w-full h-auto max-h-[200px] object-contain"
 />
 <p className="text-center text-xs text-muted-foreground mt-4 pt-4 border-t">
 Firma digital registrada al momento de la recepción
 </p>
 </div>
 </div>
 </div>
 )}

 {/* Info adicional */}
 {recepcion && (
 <div className="flex items-center justify-between text-sm text-muted-foreground pt-4 border-t">
 <div className="flex items-center gap-2">
 <Calendar className="w-4 h-4" />
 <span>Fecha de recepción: {formatDateTime(recepcion.fechaRecepcion)}</span>
 </div>
 {recepcion.createdByUser && (
 <div className="flex items-center gap-2">
 <User className="w-4 h-4" />
 <span>Recibido por: {recepcion.createdByUser.name}</span>
 </div>
 )}
 </div>
 )}

 {!hasEvidencia && (
 <div className="text-center py-12">
 <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
 <Image className="h-8 w-8 text-muted-foreground" />
 </div>
 <h3 className="text-lg font-medium mb-1">Sin evidencia</h3>
 <p className="text-muted-foreground">
 No hay fotos ni firma adjuntas para esta recepción
 </p>
 </div>
 )}
 </DialogBody>
 </DialogContent>
 </Dialog>
 </>
 );
}
