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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface SolicitudNcaFormModalProps {
 open: boolean;
 onClose: () => void;
 onSuccess: () => void;
 facturaId?: number;
 recepcionId?: number;
}

const tipoOptions = [
 { value: 'SNCA_FALTANTE', label: 'Faltante - Llegó menos de lo facturado' },
 { value: 'SNCA_DEVOLUCION', label: 'Devolución - Se devolvió mercadería' },
 { value: 'SNCA_PRECIO', label: 'Precio - Precio facturado incorrecto' },
 { value: 'SNCA_DESCUENTO', label: 'Descuento - Descuento no aplicado' },
 { value: 'SNCA_CALIDAD', label: 'Calidad - Problema de calidad' },
 { value: 'SNCA_OTRO', label: 'Otro' },
];

interface ItemSolicitud {
 descripcion: string;
 cantidadFacturada: number;
 cantidadSolicitada: number;
 unidad: string;
 precioUnitario: number;
 motivo: string;
}

export function SolicitudNcaFormModal({
 open,
 onClose,
 onSuccess,
 facturaId,
 recepcionId
}: SolicitudNcaFormModalProps) {
 const [loading, setLoading] = useState(false);
 const [proveedores, setProveedores] = useState<any[]>([]);
 const [facturas, setFacturas] = useState<any[]>([]);

 const [formData, setFormData] = useState({
 proveedorId: '',
 tipo: 'SNCA_FALTANTE',
 facturaId: facturaId?.toString() || '',
 goodsReceiptId: recepcionId?.toString() || '',
 motivo: '',
 descripcion: '',
 });

 const [items, setItems] = useState<ItemSolicitud[]>([
 { descripcion: '', cantidadFacturada: 0, cantidadSolicitada: 0, unidad: 'UN', precioUnitario: 0, motivo: '' }
 ]);

 useEffect(() => {
 const fetchProveedores = async () => {
 try {
 const response = await fetch('/api/compras/proveedores?limit=1000');
 if (response.ok) {
 const result = await response.json();
 setProveedores(result.data || result);
 }
 } catch (error) {
 console.error('Error fetching proveedores:', error);
 }
 };
 fetchProveedores();
 }, []);

 useEffect(() => {
 const fetchFacturas = async () => {
 if (!formData.proveedorId) return;
 try {
 const response = await fetch(`/api/compras/comprobantes?proveedorId=${formData.proveedorId}&limit=100`);
 if (response.ok) {
 const result = await response.json();
 setFacturas(result.data || []);
 }
 } catch (error) {
 console.error('Error fetching facturas:', error);
 }
 };
 fetchFacturas();
 }, [formData.proveedorId]);

 const addItem = () => {
 setItems([...items, { descripcion: '', cantidadFacturada: 0, cantidadSolicitada: 0, unidad: 'UN', precioUnitario: 0, motivo: '' }]);
 };

 const removeItem = (index: number) => {
 if (items.length > 1) {
 setItems(items.filter((_, i) => i !== index));
 }
 };

 const updateItem = (index: number, field: keyof ItemSolicitud, value: string | number) => {
 const updated = [...items];
 updated[index] = { ...updated[index], [field]: value };
 setItems(updated);
 };

 const calcularMontoTotal = () => {
 return items.reduce((total, item) => {
 return total + (item.cantidadSolicitada * item.precioUnitario);
 }, 0);
 };

 const handleSubmit = async () => {
 if (!formData.proveedorId || !formData.tipo || !formData.motivo) {
 toast.warning('Complete los campos obligatorios');
 return;
 }

 if (items.some(i => !i.descripcion || i.cantidadSolicitada <= 0)) {
 toast.warning('Todos los items deben tener descripción y cantidad');
 return;
 }

 try {
 setLoading(true);
 const response = await fetch('/api/compras/solicitudes-nca', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 proveedorId: parseInt(formData.proveedorId),
 tipo: formData.tipo,
 facturaId: formData.facturaId ? parseInt(formData.facturaId) : undefined,
 goodsReceiptId: formData.goodsReceiptId ? parseInt(formData.goodsReceiptId) : undefined,
 montoSolicitado: calcularMontoTotal(),
 motivo: formData.motivo,
 descripcion: formData.descripcion,
 items: items.map(item => ({
 ...item,
 subtotal: item.cantidadSolicitada * item.precioUnitario
 }))
 })
 });

 if (!response.ok) {
 const error = await response.json();
 throw new Error(error.error || 'Error al crear solicitud');
 }

 onSuccess();
 } catch (error: any) {
 toast.error(error.message);
 } finally {
 setLoading(false);
 }
 };

 return (
 <Dialog open={open} onOpenChange={onClose}>
 <DialogContent size="lg">
 <DialogHeader>
 <DialogTitle>Nueva Solicitud de Nota de Crédito</DialogTitle>
 </DialogHeader>

 <DialogBody className="space-y-6">
 {/* Datos principales */}
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label>Proveedor *</Label>
 <Select
 value={formData.proveedorId}
 onValueChange={(v) => setFormData({ ...formData, proveedorId: v })}
 >
 <SelectTrigger>
 <SelectValue placeholder="Seleccionar proveedor" />
 </SelectTrigger>
 <SelectContent>
 {proveedores.map((p) => (
 <SelectItem key={p.id} value={p.id.toString()}>
 {p.name}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label>Tipo de Solicitud *</Label>
 <Select
 value={formData.tipo}
 onValueChange={(v) => setFormData({ ...formData, tipo: v })}
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {tipoOptions.map((t) => (
 <SelectItem key={t.value} value={t.value}>
 {t.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label>Factura de Referencia</Label>
 <Select
 value={formData.facturaId}
 onValueChange={(v) => setFormData({ ...formData, facturaId: v })}
 disabled={!formData.proveedorId}
 >
 <SelectTrigger>
 <SelectValue placeholder="Seleccionar factura (opcional)" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="">Sin factura</SelectItem>
 {facturas.map((f) => (
 <SelectItem key={f.id} value={f.id.toString()}>
 {f.numeroSerie}-{f.numeroFactura} (${f.total})
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label>Motivo General *</Label>
 <Input
 value={formData.motivo}
 onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
 placeholder="Ej: Faltante según recepción REC-2026-00123"
 />
 </div>
 </div>

 <div className="space-y-2">
 <Label>Descripción Adicional</Label>
 <Textarea
 value={formData.descripcion}
 onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
 placeholder="Detalles adicionales de la solicitud..."
 rows={2}
 />
 </div>

 {/* Items */}
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <Label className="text-base font-semibold">Items a Solicitar</Label>
 <Button type="button" variant="outline" size="sm" onClick={addItem}>
 <Plus className="h-4 w-4 mr-1" />
 Agregar Item
 </Button>
 </div>

 <div className="space-y-3">
 {items.map((item, index) => (
 <div key={index} className="p-4 border rounded-lg space-y-3 bg-muted/30">
 <div className="flex items-center justify-between">
 <span className="font-medium text-sm">Item {index + 1}</span>
 {items.length > 1 && (
 <Button
 type="button"
 variant="ghost"
 size="icon"
 onClick={() => removeItem(index)}
 >
 <Trash2 className="h-4 w-4 text-destructive" />
 </Button>
 )}
 </div>

 <div className="grid grid-cols-4 gap-3">
 <div className="col-span-2 space-y-1">
 <Label className="text-xs">Descripción</Label>
 <Input
 value={item.descripcion}
 onChange={(e) => updateItem(index, 'descripcion', e.target.value)}
 placeholder="Descripción del item"
 />
 </div>
 <div className="space-y-1">
 <Label className="text-xs">Cant. Facturada</Label>
 <Input
 type="number"
 value={item.cantidadFacturada || ''}
 onChange={(e) => updateItem(index, 'cantidadFacturada', parseFloat(e.target.value) || 0)}
 />
 </div>
 <div className="space-y-1">
 <Label className="text-xs">Cant. Solicitada</Label>
 <Input
 type="number"
 value={item.cantidadSolicitada || ''}
 onChange={(e) => updateItem(index, 'cantidadSolicitada', parseFloat(e.target.value) || 0)}
 />
 </div>
 <div className="space-y-1">
 <Label className="text-xs">Unidad</Label>
 <Input
 value={item.unidad}
 onChange={(e) => updateItem(index, 'unidad', e.target.value)}
 />
 </div>
 <div className="space-y-1">
 <Label className="text-xs">Precio Unitario</Label>
 <Input
 type="number"
 value={item.precioUnitario || ''}
 onChange={(e) => updateItem(index, 'precioUnitario', parseFloat(e.target.value) || 0)}
 />
 </div>
 <div className="space-y-1">
 <Label className="text-xs">Subtotal</Label>
 <Input
 value={`$${(item.cantidadSolicitada * item.precioUnitario).toFixed(2)}`}
 disabled
 className="bg-muted"
 />
 </div>
 <div className="space-y-1">
 <Label className="text-xs">Motivo Item</Label>
 <Input
 value={item.motivo}
 onChange={(e) => updateItem(index, 'motivo', e.target.value)}
 placeholder="Opcional"
 />
 </div>
 </div>
 </div>
 ))}
 </div>

 <div className="flex justify-end pt-2 border-t">
 <div className="text-right">
 <span className="text-sm text-muted-foreground">Monto Total Solicitado:</span>
 <p className="text-2xl font-bold">${calcularMontoTotal().toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
 </div>
 </div>
 </div>
 </DialogBody>

 <DialogFooter>
 <Button variant="outline" onClick={onClose} disabled={loading}>
 Cancelar
 </Button>
 <Button onClick={handleSubmit} disabled={loading}>
 {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
 Crear Solicitud
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
}
