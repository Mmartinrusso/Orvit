'use client';

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
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import {
 FileText,
 Building2,
 Calendar,
 Truck,
 CreditCard,
 FileDown,
 Clock,
 Check,
 Package,
 Hash,
 Percent,
 DollarSign,
 AlertCircle,
 CheckCircle2,
 XCircle,
 Copy,
 ExternalLink,
 Info,
 Receipt,
 ShoppingCart,
} from 'lucide-react';
import { format, differenceInDays, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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

interface CotizacionDetailModalProps {
 open: boolean;
 onClose: () => void;
 cotizacion: Cotizacion | null;
}

const ESTADO_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
 PENDIENTE: { label: 'Pendiente', color: 'bg-muted text-foreground', icon: Clock },
 RECIBIDA: { label: 'Recibida', color: 'bg-info-muted text-info-muted-foreground', icon: FileText },
 EN_REVISION: { label: 'En Revisión', color: 'bg-warning-muted text-warning-muted-foreground', icon: AlertCircle },
 SELECCIONADA: { label: 'Seleccionada', color: 'bg-success-muted text-success', icon: CheckCircle2 },
 RECHAZADA: { label: 'Rechazada', color: 'bg-destructive/10 text-destructive', icon: XCircle },
 CONVERTIDA_OC: { label: 'Convertida a OC', color: 'bg-purple-100 text-purple-700', icon: ShoppingCart },
};

export function CotizacionDetailModal({
 open,
 onClose,
 cotizacion,
}: CotizacionDetailModalProps) {
 if (!cotizacion) return null;

 const formatCurrency = (amount: number, currency: string = 'ARS') => {
 return new Intl.NumberFormat('es-AR', {
 style: 'currency',
 currency,
 minimumFractionDigits: 2,
 }).format(amount);
 };

 const copyToClipboard = (text: string) => {
 navigator.clipboard.writeText(text);
 toast.success('Copiado al portapapeles');
 };

 const estadoConfig = ESTADO_CONFIG[cotizacion.estado] || {
 label: cotizacion.estado,
 color: 'bg-muted text-foreground',
 icon: Info
 };
 const EstadoIcon = estadoConfig.icon;

 // Calcular si está vencida
 const isExpired = cotizacion.validezHasta && isPast(new Date(cotizacion.validezHasta));
 const daysUntilExpiry = cotizacion.validezHasta
 ? differenceInDays(new Date(cotizacion.validezHasta), new Date())
 : null;

 // Calcular totales
 const itemCount = cotizacion.items?.length || 0;
 const totalUnidades = cotizacion.items?.reduce((sum, item) => sum + item.cantidad, 0) || 0;
 const descuentoTotal = cotizacion.items?.reduce((sum, item) => {
 if (item.descuento && item.descuento > 0) {
 const sinDescuento = item.cantidad * item.precioUnitario;
 return sum + (sinDescuento - item.subtotal);
 }
 return sum;
 }, 0) || 0;

 return (
 <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
 <DialogContent size="full" className="p-0 gap-0">
 {/* Header mejorado */}
 <DialogHeader className="bg-muted/30">
 <div className="flex items-start justify-between gap-4">
 <div className="flex items-start gap-4">
 <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
 <Receipt className="h-6 w-6 text-primary" />
 </div>
 <div>
 <div className="flex items-center gap-2">
 <DialogTitle className="text-lg font-semibold">
 {cotizacion.numero}
 </DialogTitle>
 <Button
 variant="ghost"
 size="sm"
 className="h-6 w-6 p-0"
 onClick={() => copyToClipboard(cotizacion.numero)}
 >
 <Copy className="h-3 w-3" />
 </Button>
 </div>
 <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
 <Building2 className="h-4 w-4" />
 <span className="font-medium">{cotizacion.supplier.name}</span>
 {cotizacion.supplier.cuit && (
 <>
 <span>·</span>
 <span>CUIT: {cotizacion.supplier.cuit}</span>
 </>
 )}
 </div>
 </div>
 </div>
 <div className="flex flex-col items-end gap-2">
 {cotizacion.esSeleccionada && (
 <Badge className="bg-primary text-primary-foreground">
 <Check className="w-3 h-3 mr-1" />
 Seleccionada
 </Badge>
 )}
 <Badge className={cn("flex items-center gap-1", estadoConfig.color)}>
 <EstadoIcon className="h-3 w-3" />
 {estadoConfig.label}
 </Badge>
 </div>
 </div>
 </DialogHeader>

 <DialogBody className="space-y-6">
 {/* KPIs principales */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <Card className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
 <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
 <DollarSign className="h-4 w-4" />
 Total
 </div>
 <p className="text-2xl font-bold text-primary">
 {formatCurrency(cotizacion.total, cotizacion.moneda)}
 </p>
 <p className="text-xs text-muted-foreground mt-1">
 {cotizacion.moneda}
 </p>
 </Card>

 <Card className="p-4">
 <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
 <Package className="h-4 w-4" />
 Items
 </div>
 <p className="text-2xl font-bold">{itemCount}</p>
 <p className="text-xs text-muted-foreground mt-1">
 {totalUnidades} unidades
 </p>
 </Card>

 <Card className="p-4">
 <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
 <Truck className="h-4 w-4" />
 Entrega
 </div>
 <p className="text-2xl font-bold">
 {cotizacion.plazoEntrega ? `${cotizacion.plazoEntrega}` : '-'}
 </p>
 <p className="text-xs text-muted-foreground mt-1">
 {cotizacion.plazoEntrega ? 'días' : 'No especificado'}
 </p>
 </Card>

 <Card className={cn(
 "p-4",
 isExpired && "bg-destructive/10 border-destructive/30"
 )}>
 <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
 <Clock className="h-4 w-4" />
 Validez
 </div>
 {cotizacion.validezHasta ? (
 <>
 <p className={cn("text-2xl font-bold", isExpired && "text-destructive")}>
 {isExpired ? 'Vencida' : `${daysUntilExpiry}d`}
 </p>
 <p className={cn("text-xs mt-1", isExpired ? "text-destructive" : "text-muted-foreground")}>
 {format(new Date(cotizacion.validezHasta), 'dd/MM/yyyy')}
 </p>
 </>
 ) : (
 <>
 <p className="text-2xl font-bold">-</p>
 <p className="text-xs text-muted-foreground mt-1">Sin fecha</p>
 </>
 )}
 </Card>
 </div>

 {/* Información detallada */}
 <div className="grid md:grid-cols-2 gap-6">
 {/* Columna izquierda */}
 <div className="space-y-4">
 <h3 className="text-sm font-semibold flex items-center gap-2">
 <Info className="h-4 w-4" />
 Información General
 </h3>
 <Card className="p-4 space-y-3">
 <div className="flex justify-between items-center">
 <span className="text-sm text-muted-foreground">Fecha cotización</span>
 <span className="text-sm font-medium">
 {format(new Date(cotizacion.fechaCotizacion), "dd 'de' MMMM, yyyy", { locale: es })}
 </span>
 </div>
 <Separator />
 <div className="flex justify-between items-center">
 <span className="text-sm text-muted-foreground">Condiciones de pago</span>
 <Badge variant="outline">{cotizacion.condicionesPago || 'No especificado'}</Badge>
 </div>
 <Separator />
 <div className="flex justify-between items-center">
 <span className="text-sm text-muted-foreground">Forma de pago</span>
 <span className="text-sm font-medium">{cotizacion.formaPago || '-'}</span>
 </div>
 {cotizacion.garantia && (
 <>
 <Separator />
 <div className="flex justify-between items-center">
 <span className="text-sm text-muted-foreground">Garantía</span>
 <span className="text-sm font-medium">{cotizacion.garantia}</span>
 </div>
 </>
 )}
 {cotizacion.createdByUser && (
 <>
 <Separator />
 <div className="flex justify-between items-center">
 <span className="text-sm text-muted-foreground">Cargado por</span>
 <span className="text-sm font-medium">{cotizacion.createdByUser.name}</span>
 </div>
 </>
 )}
 </Card>
 </div>

 {/* Columna derecha - Totales */}
 <div className="space-y-4">
 <h3 className="text-sm font-semibold flex items-center gap-2">
 <DollarSign className="h-4 w-4" />
 Resumen de Totales
 </h3>
 <Card className="p-4 space-y-3">
 <div className="flex justify-between items-center">
 <span className="text-sm text-muted-foreground">Subtotal</span>
 <span className="text-sm font-medium">
 {formatCurrency(cotizacion.subtotal, cotizacion.moneda)}
 </span>
 </div>
 {descuentoTotal > 0 && (
 <>
 <Separator />
 <div className="flex justify-between items-center text-success">
 <span className="text-sm flex items-center gap-1">
 <Percent className="h-3 w-3" />
 Descuentos
 </span>
 <span className="text-sm font-medium">
 -{formatCurrency(descuentoTotal, cotizacion.moneda)}
 </span>
 </div>
 </>
 )}
 <Separator />
 <div className="flex justify-between items-center">
 <span className="text-sm text-muted-foreground">IVA (21%)</span>
 <span className="text-sm font-medium">
 {formatCurrency(cotizacion.impuestos, cotizacion.moneda)}
 </span>
 </div>
 <Separator />
 <div className="flex justify-between items-center pt-2">
 <span className="text-base font-semibold">TOTAL</span>
 <span className="text-xl font-bold text-primary">
 {formatCurrency(cotizacion.total, cotizacion.moneda)}
 </span>
 </div>
 </Card>
 </div>
 </div>

 {/* Tabla de items */}
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <h3 className="text-sm font-semibold flex items-center gap-2">
 <Package className="h-4 w-4" />
 Items Cotizados
 </h3>
 <Badge variant="secondary">{itemCount} items</Badge>
 </div>

 {cotizacion.items && cotizacion.items.length > 0 ? (
 <Card className="overflow-hidden">
 <div className="overflow-x-auto">
 <Table>
 <TableHeader>
 <TableRow className="bg-muted/50">
 <TableHead className="text-xs font-semibold w-[50px] text-center">#</TableHead>
 <TableHead className="text-xs font-semibold w-[120px]">Cód. Prov.</TableHead>
 <TableHead className="text-xs font-semibold min-w-[250px]">Descripción</TableHead>
 <TableHead className="text-xs font-semibold w-[80px] text-center">Cant.</TableHead>
 <TableHead className="text-xs font-semibold w-[80px]">Unidad</TableHead>
 <TableHead className="text-xs font-semibold w-[120px] text-right">P. Unit.</TableHead>
 <TableHead className="text-xs font-semibold w-[80px] text-right">Dto.</TableHead>
 <TableHead className="text-xs font-semibold w-[130px] text-right">Subtotal</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {cotizacion.items.map((item, idx) => (
 <TableRow key={item.id} className="hover:bg-muted/30">
 <TableCell className="text-center text-xs text-muted-foreground font-mono">
 {idx + 1}
 </TableCell>
 <TableCell>
 <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
 {item.codigoProveedor || item.supplierItem?.codigoProveedor || '-'}
 </code>
 </TableCell>
 <TableCell>
 <div>
 <p className="text-sm font-medium">{item.descripcion}</p>
 {item.notas && (
 <p className="text-xs text-muted-foreground mt-0.5">{item.notas}</p>
 )}
 </div>
 </TableCell>
 <TableCell className="text-center font-medium">{item.cantidad}</TableCell>
 <TableCell>
 <Badge variant="outline" className="text-xs">{item.unidad}</Badge>
 </TableCell>
 <TableCell className="text-right font-mono text-sm">
 {formatCurrency(item.precioUnitario, cotizacion.moneda)}
 </TableCell>
 <TableCell className="text-right">
 {item.descuento && item.descuento > 0 ? (
 <Badge variant="secondary" className="text-xs bg-success-muted text-success">
 -{item.descuento}%
 </Badge>
 ) : (
 <span className="text-muted-foreground">-</span>
 )}
 </TableCell>
 <TableCell className="text-right font-semibold text-sm">
 {formatCurrency(item.subtotal, cotizacion.moneda)}
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 </Card>
 ) : (
 <Card className="p-8 text-center">
 <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
 <p className="text-sm text-muted-foreground">Sin items detallados</p>
 </Card>
 )}
 </div>

 {/* Observaciones y beneficios */}
 {(cotizacion.observaciones || cotizacion.beneficios) && (
 <div className="grid md:grid-cols-2 gap-4">
 {cotizacion.observaciones && (
 <Card className="p-4">
 <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
 Observaciones
 </h4>
 <p className="text-sm whitespace-pre-wrap">{cotizacion.observaciones}</p>
 </Card>
 )}
 {cotizacion.beneficios && (
 <Card className="p-4 bg-success-muted/50 border-success-muted">
 <h4 className="text-xs font-semibold text-success mb-2 uppercase tracking-wider">
 Beneficios incluidos
 </h4>
 <p className="text-sm whitespace-pre-wrap">{cotizacion.beneficios}</p>
 </Card>
 )}
 </div>
 )}

 {/* Adjuntos */}
 {cotizacion.adjuntos && cotizacion.adjuntos.length > 0 && (
 <div className="space-y-3">
 <h3 className="text-sm font-semibold flex items-center gap-2">
 <FileText className="h-4 w-4" />
 Documentos Adjuntos
 </h3>
 <div className="flex flex-wrap gap-2">
 {cotizacion.adjuntos.map((url, idx) => (
 <Button
 key={idx}
 variant="outline"
 size="sm"
 className="h-9 gap-2"
 onClick={() => window.open(url, '_blank')}
 >
 <FileDown className="h-4 w-4" />
 Documento {idx + 1}
 <ExternalLink className="h-3 w-3 ml-1" />
 </Button>
 ))}
 </div>
 </div>
 )}
 </DialogBody>

 {/* Footer */}
 <DialogFooter className="justify-between bg-muted/30">
 <div className="text-xs text-muted-foreground">
 {cotizacion.createdAt && (
 <span>Creado: {format(new Date(cotizacion.createdAt), "dd/MM/yyyy HH:mm")}</span>
 )}
 </div>
 <Button variant="outline" onClick={onClose}>
 Cerrar
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
}

export default CotizacionDetailModal;
