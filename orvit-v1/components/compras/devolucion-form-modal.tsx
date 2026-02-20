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

interface DevolucionFormModalProps {
 open: boolean;
 onClose: () => void;
 onSuccess: () => void;
 goodsReceiptId?: number;
}

const tipoOptions = [
 { value: 'DEFECTO', label: 'Defecto - Mercadería defectuosa' },
 { value: 'EXCESO', label: 'Exceso - Llegó de más' },
 { value: 'ERROR_PEDIDO', label: 'Error en pedido - No era lo solicitado' },
 { value: 'GARANTIA', label: 'Garantía - Falla en garantía' },
 { value: 'OTRO', label: 'Otro motivo' },
];

interface ItemDevolucion {
 supplierItemId: string;
 descripcion: string;
 cantidad: number;
 unidad: string;
 motivo: string;
 precioReferencia?: number;
}

export function DevolucionFormModal({
 open,
 onClose,
 onSuccess,
 goodsReceiptId
}: DevolucionFormModalProps) {
 const [loading, setLoading] = useState(false);
 const [proveedores, setProveedores] = useState<any[]>([]);
 const [supplierItems, setSupplierItems] = useState<any[]>([]);
 const [warehouses, setWarehouses] = useState<any[]>([]);

 const [formData, setFormData] = useState({
 proveedorId: '',
 warehouseId: '',
 tipo: 'DEFECTO',
 motivo: '',
 descripcion: '',
 goodsReceiptId: goodsReceiptId?.toString() || '',
 });

 const [items, setItems] = useState<ItemDevolucion[]>([
 { supplierItemId: '', descripcion: '', cantidad: 1, unidad: 'UN', motivo: '' }
 ]);

 useEffect(() => {
 const fetchData = async () => {
 try {
 const [provRes, whRes] = await Promise.all([
 fetch('/api/compras/proveedores?limit=1000'),
 fetch('/api/compras/depositos?limit=100')
 ]);

 if (provRes.ok) {
 const result = await provRes.json();
 setProveedores(result.data || result);
 }

 if (whRes.ok) {
 const result = await whRes.json();
 setWarehouses(result.data || result);
 }
 } catch (error) {
 console.error('Error fetching data:', error);
 }
 };
 fetchData();
 }, []);

 useEffect(() => {
 const fetchSupplierItems = async () => {
 if (!formData.proveedorId) return;
 try {
 const response = await fetch(`/api/compras/supplier-items?proveedorId=${formData.proveedorId}&limit=500`);
 if (response.ok) {
 const result = await response.json();
 setSupplierItems(result.data || []);
 }
 } catch (error) {
 console.error('Error fetching supplier items:', error);
 }
 };
 fetchSupplierItems();
 }, [formData.proveedorId]);

 const addItem = () => {
 setItems([...items, { supplierItemId: '', descripcion: '', cantidad: 1, unidad: 'UN', motivo: '' }]);
 };

 const removeItem = (index: number) => {
 if (items.length > 1) {
 setItems(items.filter((_, i) => i !== index));
 }
 };

 const updateItem = (index: number, field: keyof ItemDevolucion, value: string | number) => {
 const updated = [...items];
 updated[index] = { ...updated[index], [field]: value };

 // Auto-fill descripcion from supplierItem
 if (field === 'supplierItemId') {
 const item = supplierItems.find(si => si.id.toString() === value);
 if (item) {
 updated[index].descripcion = item.nombre;
 updated[index].unidad = item.unidad || 'UN';
 if (item.precioUnitario) {
 updated[index].precioReferencia = parseFloat(item.precioUnitario);
 }
 }
 }

 setItems(updated);
 };

 const handleSubmit = async () => {
 if (!formData.proveedorId || !formData.tipo || !formData.motivo) {
 toast.error('Complete los campos obligatorios');
 return;
 }

 if (items.some(i => !i.supplierItemId || i.cantidad <= 0)) {
 toast.error('Todos los items deben tener producto y cantidad');
 return;
 }

 try {
 setLoading(true);
 const response = await fetch('/api/compras/devoluciones', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 proveedorId: parseInt(formData.proveedorId),
 warehouseId: formData.warehouseId ? parseInt(formData.warehouseId) : undefined,
 goodsReceiptId: formData.goodsReceiptId ? parseInt(formData.goodsReceiptId) : undefined,
 tipo: formData.tipo,
 motivo: formData.motivo,
 descripcion: formData.descripcion,
 items: items.map(i => ({
 supplierItemId: parseInt(i.supplierItemId),
 descripcion: i.descripcion,
 cantidad: i.cantidad,
 unidad: i.unidad,
 motivo: i.motivo,
 precioReferencia: i.precioReferencia,
 }))
 })
 });

 if (!response.ok) {
 const error = await response.json();
 throw new Error(error.error || 'Error al crear devolución');
 }

 toast.success('Devolución creada correctamente');
 onSuccess();
 } catch (error: any) {
 toast.error(error.message || 'Error al crear devolución');
 } finally {
 setLoading(false);
 }
 };

 return (
 <Dialog open={open} onOpenChange={onClose}>
 <DialogContent size="lg">
 <DialogHeader>
 <DialogTitle>Nueva Devolución</DialogTitle>
 </DialogHeader>

 <DialogBody className="space-y-4">
 {/* Proveedor */}
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label>Proveedor *</Label>
 <Select
 value={formData.proveedorId}
 onValueChange={(value) => setFormData({ ...formData, proveedorId: value })}
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
 <Label>Depósito origen</Label>
 <Select
 value={formData.warehouseId}
 onValueChange={(value) => setFormData({ ...formData, warehouseId: value })}
 >
 <SelectTrigger>
 <SelectValue placeholder="Seleccionar depósito" />
 </SelectTrigger>
 <SelectContent>
 {warehouses.map((w) => (
 <SelectItem key={w.id} value={w.id.toString()}>
 {w.codigo} - {w.nombre}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 </div>

 {/* Tipo y Motivo */}
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label>Tipo de devolución *</Label>
 <Select
 value={formData.tipo}
 onValueChange={(value) => setFormData({ ...formData, tipo: value })}
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {tipoOptions.map((opt) => (
 <SelectItem key={opt.value} value={opt.value}>
 {opt.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label>Motivo breve *</Label>
 <Input
 value={formData.motivo}
 onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
 placeholder="Ej: Mercadería con defectos de fábrica"
 />
 </div>
 </div>

 {/* Descripción */}
 <div className="space-y-2">
 <Label>Descripción detallada</Label>
 <Textarea
 value={formData.descripcion}
 onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
 placeholder="Describa el problema en detalle..."
 rows={2}
 />
 </div>

 {/* Items */}
 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <Label>Items a devolver</Label>
 <Button type="button" variant="outline" size="sm" onClick={addItem}>
 <Plus className="h-4 w-4 mr-1" />
 Agregar item
 </Button>
 </div>

 <div className="space-y-3 border rounded-lg p-3">
 {items.map((item, index) => (
 <div key={index} className="grid grid-cols-12 gap-2 items-end">
 <div className="col-span-4">
 <Label className="text-xs">Producto *</Label>
 <Select
 value={item.supplierItemId}
 onValueChange={(value) => updateItem(index, 'supplierItemId', value)}
 >
 <SelectTrigger>
 <SelectValue placeholder="Seleccionar..." />
 </SelectTrigger>
 <SelectContent>
 {supplierItems.map((si) => (
 <SelectItem key={si.id} value={si.id.toString()}>
 {si.nombre}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div className="col-span-2">
 <Label className="text-xs">Cantidad *</Label>
 <Input
 type="number"
 min="0.01"
 step="0.01"
 value={item.cantidad}
 onChange={(e) => updateItem(index, 'cantidad', parseFloat(e.target.value) || 0)}
 />
 </div>

 <div className="col-span-1">
 <Label className="text-xs">Unidad</Label>
 <Input
 value={item.unidad}
 onChange={(e) => updateItem(index, 'unidad', e.target.value)}
 />
 </div>

 <div className="col-span-4">
 <Label className="text-xs">Motivo item</Label>
 <Input
 value={item.motivo}
 onChange={(e) => updateItem(index, 'motivo', e.target.value)}
 placeholder="Opcional"
 />
 </div>

 <div className="col-span-1">
 <Button
 type="button"
 variant="ghost"
 size="icon"
 onClick={() => removeItem(index)}
 disabled={items.length === 1}
 >
 <Trash2 className="h-4 w-4 text-destructive" />
 </Button>
 </div>
 </div>
 ))}
 </div>
 </div>
 </DialogBody>

 <DialogFooter>
 <Button variant="outline" onClick={onClose} disabled={loading}>
 Cancelar
 </Button>
 <Button onClick={handleSubmit} disabled={loading}>
 {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
 Crear Devolución
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
}
