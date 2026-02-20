'use client';

import { useState, useEffect } from 'react';
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogFooter,
 DialogBody,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
 Send,
 Truck,
 Package,
 CheckCircle,
 XCircle,
 FileText,
 RefreshCw,
 AlertTriangle,
 ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';

interface DevolucionDetalleModalProps {
 devolucion: any;
 open: boolean;
 onClose: () => void;
 onUpdate: () => void;
}

const estadoLabels: Record<string, string> = {
 BORRADOR: 'Borrador',
 SOLICITADA: 'Solicitada',
 APROBADA_PROVEEDOR: 'Aprobada por Proveedor',
 ENVIADA: 'Enviada',
 RECIBIDA_PROVEEDOR: 'Recibida por Proveedor',
 EN_EVALUACION: 'En Evaluación',
 RESUELTA: 'Resuelta',
 RECHAZADA: 'Rechazada',
 CANCELADA: 'Cancelada',
};

const estadoColors: Record<string, string> = {
 BORRADOR: 'bg-muted text-foreground',
 SOLICITADA: 'bg-info-muted text-info-muted-foreground',
 APROBADA_PROVEEDOR: 'bg-purple-100 text-purple-800',
 ENVIADA: 'bg-warning-muted text-warning-muted-foreground',
 RECIBIDA_PROVEEDOR: 'bg-cyan-100 text-cyan-800',
 EN_EVALUACION: 'bg-warning-muted text-warning-muted-foreground',
 RESUELTA: 'bg-success-muted text-success-muted-foreground',
 RECHAZADA: 'bg-destructive/10 text-destructive',
 CANCELADA: 'bg-muted text-muted-foreground',
};

const tipoLabels: Record<string, string> = {
 DEFECTO: 'Defecto',
 EXCESO: 'Exceso',
 ERROR_PEDIDO: 'Error Pedido',
 GARANTIA: 'Garantía',
 OTRO: 'Otro',
};

const stockMovementLabels: Record<string, string> = {
 SALIDA_DEVOLUCION: 'Salida Devolución',
 ENTRADA_CANCELACION_DEVOLUCION: 'Entrada Cancelación Devolución',
 ENTRADA_COMPRA: 'Entrada Compra',
 SALIDA_VENTA: 'Salida Venta',
 AJUSTE_ENTRADA: 'Ajuste Entrada',
 AJUSTE_SALIDA: 'Ajuste Salida',
};

export function DevolucionDetalleModal({
 devolucion: initialDevolucion,
 open,
 onClose,
 onUpdate
}: DevolucionDetalleModalProps) {
 const [devolucion, setDevolucion] = useState(initialDevolucion);
 const [loading, setLoading] = useState(false);
 const confirm = useConfirm();

 // Cargar detalle completo
 useEffect(() => {
 const fetchDetalle = async () => {
 try {
 const response = await fetch(`/api/compras/devoluciones/${initialDevolucion.id}`);
 if (response.ok) {
 const data = await response.json();
 setDevolucion(data);
 }
 } catch (error) {
 console.error('Error fetching detalle:', error);
 }
 };
 if (open && initialDevolucion.id) {
 fetchDetalle();
 }
 }, [open, initialDevolucion.id]);

 const handleSolicitar = async () => {
 const ok = await confirm({
 title: 'Enviar solicitud',
 description: '¿Enviar solicitud al proveedor?',
 confirmText: 'Confirmar',
 variant: 'default',
 });
 if (!ok) return;
 try {
 setLoading(true);
 const response = await fetch(`/api/compras/devoluciones/${devolucion.id}`, {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ accion: 'solicitar' })
 });
 if (!response.ok) throw new Error('Error');
 toast.success('Solicitud enviada');
 onUpdate();
 onClose();
 } catch {
 toast.error('Error al enviar solicitud');
 } finally {
 setLoading(false);
 }
 };

 const handleAprobarProveedor = async () => {
 const ok = await confirm({
 title: 'Aprobar devolución',
 description: '¿Marcar como aprobada por el proveedor?',
 confirmText: 'Confirmar',
 variant: 'default',
 });
 if (!ok) return;
 try {
 setLoading(true);
 const response = await fetch(`/api/compras/devoluciones/${devolucion.id}`, {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ accion: 'aprobar_proveedor' })
 });
 if (!response.ok) throw new Error('Error');
 toast.success('Aprobación registrada');
 onUpdate();
 onClose();
 } catch {
 toast.error('Error al aprobar');
 } finally {
 setLoading(false);
 }
 };

 const handleEnviar = async () => {
 const carrier = prompt('Transportista (opcional):');
 const trackingNumber = prompt('Número de seguimiento (opcional):');

 const ok = await confirm({
 title: 'Confirmar envío',
 description: '¿Confirmar envío? Esto descontará el stock.',
 confirmText: 'Confirmar',
 variant: 'default',
 });
 if (!ok) return;

 try {
 setLoading(true);
 toast.loading('Enviando...', { id: 'enviar' });
 const response = await fetch(`/api/compras/devoluciones/${devolucion.id}/enviar`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ carrier, trackingNumber })
 });
 const result = await response.json();
 if (!response.ok) throw new Error(result.error);
 toast.success(result.message, { id: 'enviar' });
 onUpdate();
 onClose();
 } catch (error: any) {
 toast.error(error.message, { id: 'enviar' });
 } finally {
 setLoading(false);
 }
 };

 const handleConfirmarRecepcion = async () => {
 const ok = await confirm({
 title: 'Confirmar recepción',
 description: '¿Confirmar que el proveedor recibió la mercadería?',
 confirmText: 'Confirmar',
 variant: 'default',
 });
 if (!ok) return;
 try {
 setLoading(true);
 const response = await fetch(`/api/compras/devoluciones/${devolucion.id}/confirmar-recepcion`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({})
 });
 const result = await response.json();
 if (!response.ok) throw new Error(result.error);
 toast.success(result.message);
 onUpdate();
 onClose();
 } catch (error: any) {
 toast.error(error.message);
 } finally {
 setLoading(false);
 }
 };

 const handleCancelar = async () => {
 const motivo = prompt('Motivo de cancelación:');
 if (!motivo) return;
 const cancelOk = await confirm({
 title: 'Cancelar devolución',
 description: '¿Cancelar devolución?',
 confirmText: 'Confirmar',
 variant: 'default',
 });
 if (!cancelOk) return;
 try {
 setLoading(true);
 toast.loading('Cancelando...', { id: 'cancelar' });
 const response = await fetch(`/api/compras/devoluciones/${devolucion.id}/cancelar`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ motivo })
 });
 const result = await response.json();
 if (!response.ok) throw new Error(result.error);
 toast.success(result.message, { id: 'cancelar' });
 onUpdate();
 onClose();
 } catch (error: any) {
 toast.error(error.message, { id: 'cancelar' });
 } finally {
 setLoading(false);
 }
 };

 return (
 <Dialog open={open} onOpenChange={onClose}>
 <DialogContent size="md">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-3">
 <span>Devolución {devolucion.numero}</span>
 <Badge className={estadoColors[devolucion.estado]}>
 {estadoLabels[devolucion.estado]}
 </Badge>
 </DialogTitle>
 </DialogHeader>

 <DialogBody className="space-y-5">
 {/* Info General */}
 <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
 <div>
 <p className="text-muted-foreground">Proveedor</p>
 <p className="font-medium">{devolucion.proveedor?.name}</p>
 {devolucion.proveedor?.cuit && (
 <p className="text-xs text-muted-foreground">CUIT: {devolucion.proveedor.cuit}</p>
 )}
 </div>
 <div>
 <p className="text-muted-foreground">Tipo</p>
 <Badge variant="outline">{tipoLabels[devolucion.tipo] || devolucion.tipo}</Badge>
 </div>
 <div>
 <p className="text-muted-foreground">Fecha Solicitud</p>
 <p className="font-medium">
 {format(new Date(devolucion.fechaSolicitud), 'dd/MM/yyyy', { locale: es })}
 </p>
 </div>
 {devolucion.warehouse && (
 <div>
 <p className="text-muted-foreground">Depósito</p>
 <p className="font-medium">
 {devolucion.warehouse.codigo} - {devolucion.warehouse.nombre}
 </p>
 </div>
 )}
 {devolucion.fechaEnvio && (
 <div>
 <p className="text-muted-foreground">Fecha Envío</p>
 <p className="font-medium">
 {format(new Date(devolucion.fechaEnvio), 'dd/MM/yyyy', { locale: es })}
 </p>
 </div>
 )}
 {devolucion.carrier && (
 <div>
 <p className="text-muted-foreground">Transportista</p>
 <p className="font-medium">{devolucion.carrier}</p>
 {devolucion.trackingNumber && (
 <p className="text-xs">Tracking: {devolucion.trackingNumber}</p>
 )}
 </div>
 )}
 </div>

 <Separator />

 {/* Motivo */}
 <div>
 <p className="text-sm text-muted-foreground mb-1">Motivo</p>
 <p className="text-sm font-medium">{devolucion.motivo}</p>
 {devolucion.descripcion && (
 <p className="text-sm text-muted-foreground mt-1">{devolucion.descripcion}</p>
 )}
 </div>

 <Separator />

 {/* Items */}
 <div>
 <p className="text-sm font-medium mb-3">Items ({devolucion.items?.length || 0})</p>
 <div className="border rounded-lg overflow-hidden">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Producto</TableHead>
 <TableHead className="text-right">Cantidad</TableHead>
 <TableHead>Unidad</TableHead>
 <TableHead className="text-right">Precio Ref.</TableHead>
 <TableHead>Motivo</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {devolucion.items?.map((item: any) => (
 <TableRow key={item.id}>
 <TableCell>
 <p className="font-medium">{item.descripcion || item.supplierItem?.nombre}</p>
 </TableCell>
 <TableCell className="text-right font-mono">
 {parseFloat(item.cantidad).toFixed(2)}
 </TableCell>
 <TableCell>{item.unidad}</TableCell>
 <TableCell className="text-right font-mono">
 {item.precioReferencia
 ? `$${parseFloat(item.precioReferencia).toLocaleString('es-AR')}`
 : '-'}
 </TableCell>
 <TableCell className="text-sm text-muted-foreground">
 {item.motivo || '-'}
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 </div>

 {/* Stock Movements */}
 {devolucion.stockMovements?.length > 0 && (
 <>
 <Separator />
 <div>
 <p className="text-sm font-medium mb-2">Movimientos de Stock</p>
 <div className="space-y-2">
 {devolucion.stockMovements.map((mov: any) => (
 <div key={mov.id} className="flex items-center gap-3 text-sm bg-warning-muted p-3 rounded">
 <Package className="h-4 w-4 text-warning-muted-foreground flex-shrink-0" />
 <span className="font-medium">{stockMovementLabels[mov.tipo] || mov.tipo}</span>
 <span className="font-mono">-{parseFloat(mov.cantidad).toFixed(2)}</span>
 <span className="text-muted-foreground">
 ({parseFloat(mov.cantidadAnterior).toFixed(0)} → {parseFloat(mov.cantidadPosterior).toFixed(0)})
 </span>
 </div>
 ))}
 </div>
 </div>
 </>
 )}

 {/* Credit Notes */}
 {devolucion.creditNotes?.length > 0 && (
 <>
 <Separator />
 <div>
 <p className="text-sm font-medium mb-2">Notas de Crédito Vinculadas</p>
 <div className="space-y-2">
 {devolucion.creditNotes.map((nc: any) => (
 <div key={nc.id} className="flex items-center gap-3 text-sm bg-success-muted p-3 rounded">
 <FileText className="h-4 w-4 text-success flex-shrink-0" />
 <span className="font-mono">{nc.numero}</span>
 <Badge variant="secondary">{nc.estado}</Badge>
 <span className="font-mono">${parseFloat(nc.total).toLocaleString('es-AR')}</span>
 {nc.aplicada && <CheckCircle className="h-4 w-4 text-success" />}
 </div>
 ))}
 </div>
 </div>
 </>
 )}

 {/* Warning if no NCA */}
 {['ENVIADA', 'RECIBIDA_PROVEEDOR'].includes(devolucion.estado) &&
 (!devolucion.creditNotes || devolucion.creditNotes.length === 0) && (
 <div className="flex items-center gap-2 p-3 bg-warning-muted border border-warning-muted rounded text-sm">
 <AlertTriangle className="h-5 w-5 text-warning-muted-foreground" />
 <div>
 <p className="font-medium text-warning-muted-foreground">Falta Nota de Crédito</p>
 <p className="text-warning-muted-foreground">
 Esta devolución ya fue enviada pero aún no tiene NCA asociada.
 </p>
 </div>
 </div>
 )}

 {/* Resolution */}
 {devolucion.resolucion && (
 <>
 <Separator />
 <div className="p-4 bg-muted rounded-lg">
 <p className="text-sm text-muted-foreground">Resolución</p>
 <p className="text-sm mt-1">{devolucion.resolucion}</p>
 {devolucion.fechaResolucion && (
 <p className="text-xs text-muted-foreground mt-2">
 {format(new Date(devolucion.fechaResolucion), 'dd/MM/yyyy HH:mm', { locale: es })}
 </p>
 )}
 </div>
 </>
 )}
 </DialogBody>

 {/* Actions */}
 <DialogFooter className="justify-between">
 <Button variant="outline" onClick={onClose}>
 Cerrar
 </Button>

 <div className="flex gap-2">
 {devolucion.estado === 'BORRADOR' && (
 <Button onClick={handleSolicitar} disabled={loading}>
 <Send className="h-4 w-4 mr-2" />
 Enviar Solicitud
 </Button>
 )}

 {devolucion.estado === 'SOLICITADA' && (
 <Button onClick={handleAprobarProveedor} disabled={loading}>
 <CheckCircle className="h-4 w-4 mr-2" />
 Aprobar (Proveedor)
 </Button>
 )}

 {devolucion.estado === 'APROBADA_PROVEEDOR' && (
 <>
 <Button variant="outline" onClick={handleCancelar} disabled={loading}>
 <XCircle className="h-4 w-4 mr-2" />
 Cancelar
 </Button>
 <Button onClick={handleEnviar} disabled={loading}>
 <Truck className="h-4 w-4 mr-2" />
 Enviar Mercadería
 </Button>
 </>
 )}

 {devolucion.estado === 'ENVIADA' && (
 <>
 <Button variant="outline" onClick={handleCancelar} disabled={loading}>
 <XCircle className="h-4 w-4 mr-2" />
 Cancelar
 </Button>
 <Button onClick={handleConfirmarRecepcion} disabled={loading}>
 <Package className="h-4 w-4 mr-2" />
 Confirmar Recepción
 </Button>
 </>
 )}

 {devolucion.estado === 'RECIBIDA_PROVEEDOR' && (
 <Button variant="outline" onClick={handleCancelar} disabled={loading}>
 <XCircle className="h-4 w-4 mr-2" />
 Cancelar
 </Button>
 )}
 </div>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
}
