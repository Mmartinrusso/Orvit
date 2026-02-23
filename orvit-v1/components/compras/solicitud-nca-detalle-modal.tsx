'use client';

import { useState } from 'react';
import { cn, formatNumber } from '@/lib/utils';
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogFooter,
 DialogBody,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from '@/components/ui/table';
import { formatDateTime } from '@/lib/date-utils';
import { Send, FileCheck, Loader2, CheckCircle } from 'lucide-react';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';
import { toast } from 'sonner';

interface SolicitudNcaDetalleModalProps {
 solicitud: any;
 open: boolean;
 onClose: () => void;
 onUpdate: () => void;
}

const estadoLabels: Record<string, string> = {
 SNCA_NUEVA: 'Nueva',
 SNCA_ENVIADA: 'Enviada',
 SNCA_EN_REVISION: 'En Revisión',
 SNCA_APROBADA: 'Aprobada',
 SNCA_PARCIAL: 'Parcial',
 SNCA_RECHAZADA: 'Rechazada',
 SNCA_NCA_RECIBIDA: 'NCA Recibida',
 SNCA_APLICADA: 'Aplicada',
 SNCA_CERRADA: 'Cerrada',
 SNCA_CANCELADA: 'Cancelada',
};

const estadoColors: Record<string, string> = {
 SNCA_NUEVA: 'bg-info-muted text-info-muted-foreground',
 SNCA_ENVIADA: 'bg-purple-100 text-purple-800',
 SNCA_EN_REVISION: 'bg-warning-muted text-warning-muted-foreground',
 SNCA_APROBADA: 'bg-success-muted text-success-muted-foreground',
 SNCA_PARCIAL: 'bg-warning-muted text-warning-muted-foreground',
 SNCA_RECHAZADA: 'bg-destructive/10 text-destructive',
 SNCA_NCA_RECIBIDA: 'bg-success-muted text-success-muted-foreground',
 SNCA_APLICADA: 'bg-muted text-foreground',
 SNCA_CERRADA: 'bg-muted text-foreground',
 SNCA_CANCELADA: 'bg-destructive/10 text-destructive',
};

const tipoLabels: Record<string, string> = {
 SNCA_FALTANTE: 'Faltante',
 SNCA_DEVOLUCION: 'Devolución',
 SNCA_PRECIO: 'Precio',
 SNCA_DESCUENTO: 'Descuento',
 SNCA_CALIDAD: 'Calidad',
 SNCA_OTRO: 'Otro',
};

export function SolicitudNcaDetalleModal({
 solicitud,
 open,
 onClose,
 onUpdate
}: SolicitudNcaDetalleModalProps) {
 const confirm = useConfirm();
 const [loading, setLoading] = useState(false);
 const [showRegistrarNca, setShowRegistrarNca] = useState(false);
 const [ncaData, setNcaData] = useState({
 montoAprobado: solicitud?.montoSolicitado || 0,
 respuestaProveedor: '',
 ncaNumero: '',
 });

 const handleEnviar = async () => {
 const ok = await confirm({
 title: 'Enviar solicitud',
 description: '¿Enviar esta solicitud al proveedor?',
 confirmText: 'Confirmar',
 variant: 'default',
 });
 if (!ok) return;
 try {
 setLoading(true);
 const response = await fetch(`/api/compras/solicitudes-nca/${solicitud.id}/enviar`, {
 method: 'POST'
 });
 if (!response.ok) throw new Error('Error al enviar');
 onUpdate();
 onClose();
 } catch (error) {
 toast.error('Error al enviar la solicitud');
 } finally {
 setLoading(false);
 }
 };

 const handleRegistrarNca = async () => {
 try {
 setLoading(true);
 const response = await fetch(`/api/compras/solicitudes-nca/${solicitud.id}/registrar-nca`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 montoAprobado: ncaData.montoAprobado,
 respuestaProveedor: ncaData.respuestaProveedor,
 ncaNumero: ncaData.ncaNumero,
 })
 });
 if (!response.ok) throw new Error('Error al registrar NCA');
 onUpdate();
 onClose();
 } catch (error) {
 toast.error('Error al registrar la NCA');
 } finally {
 setLoading(false);
 }
 };

 const handleCerrar = async () => {
 const ok = await confirm({
 title: 'Cerrar solicitud',
 description: '¿Cerrar esta solicitud?',
 confirmText: 'Confirmar',
 variant: 'default',
 });
 if (!ok) return;
 try {
 setLoading(true);
 const response = await fetch(`/api/compras/solicitudes-nca/${solicitud.id}/cerrar`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ motivoCierre: 'Cerrada desde detalle' })
 });
 if (!response.ok) throw new Error('Error al cerrar');
 onUpdate();
 onClose();
 } catch (error) {
 toast.error('Error al cerrar la solicitud');
 } finally {
 setLoading(false);
 }
 };

 if (!solicitud) return null;

 return (
 <Dialog open={open} onOpenChange={onClose}>
 <DialogContent size="lg">
 <DialogHeader>
 <div className="flex items-center gap-3">
 <DialogTitle>Solicitud {solicitud.numero}</DialogTitle>
 <Badge className={estadoColors[solicitud.estado]}>
 {estadoLabels[solicitud.estado] || solicitud.estado}
 </Badge>
 </div>
 </DialogHeader>

 <DialogBody className="space-y-6">
 {/* Información General */}
 <div className="grid grid-cols-2 gap-4">
 <div>
 <Label className="text-xs text-muted-foreground">Proveedor</Label>
 <p className="font-medium">{solicitud.proveedor?.name}</p>
 </div>
 <div>
 <Label className="text-xs text-muted-foreground">Tipo</Label>
 <p className="font-medium">{tipoLabels[solicitud.tipo] || solicitud.tipo}</p>
 </div>
 <div>
 <Label className="text-xs text-muted-foreground">Fecha Solicitud</Label>
 <p className="font-medium">
 {formatDateTime(solicitud.fechaSolicitud)}
 </p>
 </div>
 {solicitud.fechaEnvio && (
 <div>
 <Label className="text-xs text-muted-foreground">Fecha Envío</Label>
 <p className="font-medium">
 {formatDateTime(solicitud.fechaEnvio)}
 </p>
 </div>
 )}
 {solicitud.factura && (
 <div>
 <Label className="text-xs text-muted-foreground">Factura</Label>
 <p className="font-medium">
 {solicitud.factura.numeroSerie}-{solicitud.factura.numeroFactura}
 </p>
 </div>
 )}
 {solicitud.goodsReceipt && (
 <div>
 <Label className="text-xs text-muted-foreground">Recepción</Label>
 <p className="font-medium">{solicitud.goodsReceipt.numero}</p>
 </div>
 )}
 </div>

 <Separator />

 {/* Motivo y Descripción */}
 <div className="space-y-3">
 <div>
 <Label className="text-xs text-muted-foreground">Motivo</Label>
 <p className="font-medium">{solicitud.motivo}</p>
 </div>
 {solicitud.descripcion && (
 <div>
 <Label className="text-xs text-muted-foreground">Descripción</Label>
 <p className="text-sm">{solicitud.descripcion}</p>
 </div>
 )}
 </div>

 <Separator />

 {/* Montos */}
 <div className="grid grid-cols-2 gap-4">
 <div className="p-4 bg-muted/30 rounded-lg">
 <Label className="text-xs text-muted-foreground">Monto Solicitado</Label>
 <p className="text-2xl font-bold">
 ${Number(solicitud.montoSolicitado).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
 </p>
 </div>
 {solicitud.montoAprobado != null && (
 <div className="p-4 bg-muted/30 rounded-lg">
 <Label className="text-xs text-muted-foreground">Monto Aprobado</Label>
 <p className={cn('text-2xl font-bold',
 solicitud.montoAprobado < solicitud.montoSolicitado ? 'text-warning-muted-foreground' : 'text-success'
 )}>
 ${Number(solicitud.montoAprobado).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
 </p>
 </div>
 )}
 </div>

 {/* Items */}
 {solicitud.items && solicitud.items.length > 0 && (
 <>
 <Separator />
 <div>
 <Label className="text-sm font-semibold mb-2 block">Items</Label>
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Descripción</TableHead>
 <TableHead className="text-right">Facturada</TableHead>
 <TableHead className="text-right">Solicitada</TableHead>
 <TableHead className="text-right">Precio</TableHead>
 <TableHead className="text-right">Subtotal</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {solicitud.items.map((item: any) => (
 <TableRow key={item.id}>
 <TableCell>{item.descripcion}</TableCell>
 <TableCell className="text-right">{item.cantidadFacturada} {item.unidad}</TableCell>
 <TableCell className="text-right">{item.cantidadSolicitada} {item.unidad}</TableCell>
 <TableCell className="text-right">${formatNumber(Number(item.precioUnitario), 2)}</TableCell>
 <TableCell className="text-right">${formatNumber(Number(item.subtotal), 2)}</TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 </>
 )}

 {/* Respuesta del proveedor */}
 {solicitud.respuestaProveedor && (
 <>
 <Separator />
 <div className="p-4 bg-info-muted rounded-lg">
 <Label className="text-xs text-muted-foreground">Respuesta del Proveedor</Label>
 <p className="mt-1">{solicitud.respuestaProveedor}</p>
 {solicitud.fechaRespuesta && (
 <p className="text-xs text-muted-foreground mt-2">
 {formatDateTime(solicitud.fechaRespuesta)}
 </p>
 )}
 </div>
 </>
 )}

 {/* Formulario Registrar NCA */}
 {showRegistrarNca && ['SNCA_ENVIADA', 'SNCA_EN_REVISION'].includes(solicitud.estado) && (
 <>
 <Separator />
 <div className="space-y-4 p-4 border rounded-lg">
 <Label className="text-sm font-semibold">Registrar Respuesta del Proveedor</Label>
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label>Número de NCA</Label>
 <Input
 value={ncaData.ncaNumero}
 onChange={(e) => setNcaData({ ...ncaData, ncaNumero: e.target.value })}
 placeholder="Número de NCA del proveedor"
 />
 </div>
 <div className="space-y-2">
 <Label>Monto Aprobado</Label>
 <Input
 type="number"
 value={ncaData.montoAprobado}
 onChange={(e) => setNcaData({ ...ncaData, montoAprobado: parseFloat(e.target.value) || 0 })}
 />
 </div>
 </div>
 <div className="space-y-2">
 <Label>Respuesta del Proveedor</Label>
 <Textarea
 value={ncaData.respuestaProveedor}
 onChange={(e) => setNcaData({ ...ncaData, respuestaProveedor: e.target.value })}
 placeholder="Detalle de la respuesta..."
 rows={3}
 />
 </div>
 <div className="flex gap-2">
 <Button variant="outline" onClick={() => setShowRegistrarNca(false)}>
 Cancelar
 </Button>
 <Button onClick={handleRegistrarNca} disabled={loading}>
 {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
 Registrar NCA
 </Button>
 </div>
 </div>
 </>
 )}
 </DialogBody>

 <DialogFooter>
 <Button variant="outline" onClick={onClose}>
 Cerrar
 </Button>

 {solicitud.estado === 'SNCA_NUEVA' && (
 <Button onClick={handleEnviar} disabled={loading}>
 {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
 <Send className="h-4 w-4 mr-2" />
 Enviar al Proveedor
 </Button>
 )}

 {['SNCA_ENVIADA', 'SNCA_EN_REVISION'].includes(solicitud.estado) && !showRegistrarNca && (
 <Button onClick={() => setShowRegistrarNca(true)}>
 <FileCheck className="h-4 w-4 mr-2" />
 Registrar NCA
 </Button>
 )}

 {['SNCA_NCA_RECIBIDA', 'SNCA_APROBADA', 'SNCA_PARCIAL', 'SNCA_RECHAZADA'].includes(solicitud.estado) && (
 <Button onClick={handleCerrar} disabled={loading}>
 {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
 <CheckCircle className="h-4 w-4 mr-2" />
 Cerrar Solicitud
 </Button>
 )}
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
}
