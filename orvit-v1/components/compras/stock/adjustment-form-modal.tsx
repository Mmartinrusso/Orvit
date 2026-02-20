'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogBody,
 DialogFooter,
 DialogHeader,
 DialogTitle,
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
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, Search, Package, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const TIPOS_AJUSTE = [
 { value: 'INVENTARIO_FISICO', label: 'Inventario Físico', description: 'Conteo físico de mercadería' },
 { value: 'ROTURA', label: 'Rotura', description: 'Mercadería dañada' },
 { value: 'VENCIMIENTO', label: 'Vencimiento', description: 'Producto vencido' },
 { value: 'MERMA', label: 'Merma', description: 'Pérdida por proceso' },
 { value: 'CORRECCION', label: 'Corrección', description: 'Corrección manual' },
 { value: 'DEVOLUCION_INTERNA', label: 'Devolución Interna', description: 'Reingreso de producción' },
];

const REASON_CODES: Record<string, string[]> = {
 INVENTARIO_FISICO: ['Conteo físico', 'Reconciliación', 'Auditoría'],
 ROTURA: ['Caída', 'Transporte', 'Manipulación', 'Otro'],
 VENCIMIENTO: ['Fecha pasada', 'Deterioro visible', 'Control de calidad'],
 MERMA: ['Evaporación', 'Pesaje', 'Proceso productivo', 'Otro'],
 CORRECCION: ['Error de carga', 'Error de sistema', 'Ajuste contable'],
 DEVOLUCION_INTERNA: ['Reingreso producción', 'Producto no usado', 'Otro'],
};

interface Warehouse {
 id: number;
 codigo: string;
 nombre: string;
}

interface SupplierItem {
 id: number;
 nombre: string;
 unidad: string;
}

interface AdjustmentItem {
 supplierItemId: number;
 supplierItemNombre: string;
 unidad: string;
 cantidadActual: number;
 cantidadNueva: number;
 diferencia: number;
 notas?: string;
}

interface AdjustmentFormModalProps {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 onSaved?: () => void;
 preselectedWarehouseId?: number;
}

const formSchema = z.object({
 tipo: z.string().min(1, 'Seleccione un tipo'),
 warehouseId: z.string().min(1, 'Seleccione un depósito'),
 motivo: z.string().min(10, 'El motivo debe tener al menos 10 caracteres'),
 motivoDetalle: z.string().optional(),
 reasonCode: z.string().optional(),
 notas: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export function AdjustmentFormModal({
 open,
 onOpenChange,
 onSaved,
 preselectedWarehouseId,
}: AdjustmentFormModalProps) {
 const [saving, setSaving] = useState(false);
 const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
 const [items, setItems] = useState<AdjustmentItem[]>([]);
 const [searchItem, setSearchItem] = useState('');
 const [searchResults, setSearchResults] = useState<SupplierItem[]>([]);
 const [stockByItem, setStockByItem] = useState<Map<number, number>>(new Map());

 const {
 register,
 handleSubmit,
 watch,
 setValue,
 reset,
 formState: { errors },
 } = useForm<FormData>({
 resolver: zodResolver(formSchema),
 defaultValues: {
 warehouseId: preselectedWarehouseId ? String(preselectedWarehouseId) : '',
 },
 });

 const tipo = watch('tipo');
 const warehouseId = watch('warehouseId');

 // Cargar warehouses
 useEffect(() => {
 async function loadWarehouses() {
 try {
 const res = await fetch('/api/compras/depositos');
 if (res.ok) {
 const data = await res.json();
 setWarehouses((data.data || data).filter((w: any) => !w.isTransit));
 }
 } catch (error) {
 console.error('Error loading warehouses:', error);
 }
 }
 if (open) {
 loadWarehouses();
 }
 }, [open]);

 // Cargar stock cuando cambia warehouse
 useEffect(() => {
 async function loadStock() {
 if (!warehouseId) return;
 try {
 const res = await fetch(`/api/compras/stock?warehouseId=${warehouseId}&limit=500`);
 if (res.ok) {
 const data = await res.json();
 const stockMap = new Map<number, number>();
 for (const item of data.data || []) {
 stockMap.set(item.supplierItemId, item.cantidad);
 }
 setStockByItem(stockMap);
 }
 } catch (error) {
 console.error('Error loading stock:', error);
 }
 }
 loadStock();
 }, [warehouseId]);

 // Buscar items - primero en stock, luego en todos los supplier-items
 const searchItems = useCallback(async (search: string) => {
 if (search.length < 2 || !warehouseId) {
 setSearchResults([]);
 return;
 }
 try {
 // Buscar solo en stock del warehouse (para ajustes solo importan items con stock)
 const stockRes = await fetch(`/api/compras/stock?warehouseId=${warehouseId}&search=${encodeURIComponent(search)}&limit=20`);
 const allItems: SupplierItem[] = [];
 const foundIds = new Set<number>();
 const stockByItemTemp = new Map<number, number>();

 // Helper para filtrar items genéricos de cotización
 const isGenericItem = (nombre: string, codigo?: string) => {
 if (!nombre) return true;
 const lowerNombre = nombre.toLowerCase();
 if (lowerNombre.includes('item de cotización') || lowerNombre.includes('cotización según documento')) return true;
 if (codigo && codigo.startsWith('COT-GEN')) return true;
 return false;
 };

 if (stockRes.ok) {
 const stockData = await stockRes.json();
 // Mapear items del stock (la API retorna objetos transformados/flat)
 for (const loc of stockData.data || []) {
 const id = loc.supplierItemId;
 const nombre = loc.supplierItemNombre || loc.descripcionItem || '';
 const codigo = loc.supplierItemCodigo;

 // Filtrar items genéricos de cotización
 if (isGenericItem(nombre, codigo)) continue;

 if (id && !foundIds.has(id)) {
 foundIds.add(id);
 allItems.push({
 id,
 nombre: nombre || 'Sin nombre',
 unidad: loc.unidad || 'UN',
 });
 // Guardar stock de este item
 stockByItemTemp.set(id, parseFloat(loc.cantidad) || 0);
 }
 }

 // Actualizar mapa de stock
 setStockByItem(stockByItemTemp);
 }

 // Solo buscar en stock del depósito (no en supplier-items)
 // Para ajustes solo tiene sentido items que ya existen en el depósito
 setSearchResults(allItems);
 } catch (error) {
 console.error('Error searching items:', error);
 }
 }, [warehouseId]);

 useEffect(() => {
 const timeoutId = setTimeout(() => {
 searchItems(searchItem);
 }, 300);
 return () => clearTimeout(timeoutId);
 }, [searchItem, searchItems]);

 // Agregar item al ajuste
 const addItem = (supplierItem: SupplierItem) => {
 if (items.some((i) => i.supplierItemId === supplierItem.id)) {
 toast.error('Este item ya está en el ajuste');
 return;
 }

 const cantidadActual = stockByItem.get(supplierItem.id) || 0;

 setItems([
 ...items,
 {
 supplierItemId: supplierItem.id,
 supplierItemNombre: supplierItem.nombre,
 unidad: supplierItem.unidad || 'UN',
 cantidadActual,
 cantidadNueva: cantidadActual,
 diferencia: 0,
 },
 ]);

 setSearchItem('');
 setSearchResults([]);
 };

 // Actualizar cantidad de un item
 const updateItemQuantity = (index: number, cantidadNueva: number) => {
 const newItems = [...items];
 newItems[index].cantidadNueva = cantidadNueva;
 newItems[index].diferencia = cantidadNueva - newItems[index].cantidadActual;
 setItems(newItems);
 };

 // Eliminar item
 const removeItem = (index: number) => {
 setItems(items.filter((_, i) => i !== index));
 };

 // Reset al cerrar
 useEffect(() => {
 if (!open) {
 reset();
 setItems([]);
 setSearchItem('');
 setSearchResults([]);
 }
 }, [open, reset]);

 const onSubmit = async (data: FormData) => {
 if (items.length === 0) {
 toast.error('Debe agregar al menos un item');
 return;
 }

 // Verificar que hay cambios
 const hayDiferencias = items.some((i) => i.diferencia !== 0);
 if (!hayDiferencias) {
 toast.error('No hay diferencias para ajustar');
 return;
 }

 setSaving(true);
 try {
 const response = await fetch('/api/compras/stock/ajustes', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 tipo: data.tipo,
 warehouseId: data.warehouseId,
 motivo: data.motivo,
 motivoDetalle: data.motivoDetalle || null,
 reasonCode: data.reasonCode || null,
 notas: data.notas || null,
 items: items.map((i) => ({
 supplierItemId: i.supplierItemId,
 cantidadNueva: i.cantidadNueva,
 notas: i.notas,
 })),
 }),
 });

 if (!response.ok) {
 const errorData = await response.json();
 throw new Error(errorData.error || 'Error al crear el ajuste');
 }

 const ajuste = await response.json();
 toast.success(`Ajuste ${ajuste.numero} creado correctamente`);
 onOpenChange(false);
 onSaved?.();
 } catch (error) {
 console.error('Error saving adjustment:', error);
 toast.error(error instanceof Error ? error.message : 'Error al guardar');
 } finally {
 setSaving(false);
 }
 };

 // Calcular totales
 const totales = items.reduce(
 (acc, item) => {
 if (item.diferencia > 0) {
 acc.positivo += item.diferencia;
 } else {
 acc.negativo += Math.abs(item.diferencia);
 }
 return acc;
 },
 { positivo: 0, negativo: 0 }
 );

 const reasonCodes = tipo ? REASON_CODES[tipo] || [] : [];

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent size="lg">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <Package className="h-5 w-5" />
 Nuevo Ajuste de Inventario
 </DialogTitle>
 <DialogDescription>
 Registre diferencias de stock por conteo, rotura, vencimiento u otros motivos.
 </DialogDescription>
 </DialogHeader>

 <form onSubmit={handleSubmit(onSubmit)}>
 <DialogBody className="space-y-6">
 {/* Tipo y Depósito */}
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label>Tipo de Ajuste *</Label>
 <Select value={tipo} onValueChange={(v) => setValue('tipo', v)}>
 <SelectTrigger>
 <SelectValue placeholder="Seleccionar tipo" />
 </SelectTrigger>
 <SelectContent>
 {TIPOS_AJUSTE.map((t) => (
 <SelectItem key={t.value} value={t.value}>
 <div>
 <div className="font-medium">{t.label}</div>
 <div className="text-xs text-muted-foreground">{t.description}</div>
 </div>
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 {errors.tipo && (
 <p className="text-xs text-destructive">{errors.tipo.message}</p>
 )}
 </div>

 <div className="space-y-2">
 <Label>Depósito *</Label>
 <Select value={warehouseId} onValueChange={(v) => setValue('warehouseId', v)}>
 <SelectTrigger>
 <SelectValue placeholder="Seleccionar depósito" />
 </SelectTrigger>
 <SelectContent>
 {warehouses.map((wh) => (
 <SelectItem key={wh.id} value={String(wh.id)}>
 {wh.codigo} - {wh.nombre}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 {errors.warehouseId && (
 <p className="text-xs text-destructive">{errors.warehouseId.message}</p>
 )}
 </div>
 </div>

 {/* Reason Code */}
 {reasonCodes.length > 0 && (
 <div className="space-y-2">
 <Label>Motivo Específico</Label>
 <Select onValueChange={(v) => setValue('reasonCode', v)}>
 <SelectTrigger>
 <SelectValue placeholder="Seleccionar motivo específico" />
 </SelectTrigger>
 <SelectContent>
 {reasonCodes.map((code) => (
 <SelectItem key={code} value={code}>
 {code}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 )}

 {/* Motivo */}
 <div className="space-y-2">
 <Label>Motivo Detallado *</Label>
 <Textarea
 placeholder="Describa detalladamente el motivo del ajuste (mínimo 10 caracteres)"
 {...register('motivo')}
 rows={3}
 />
 {errors.motivo && (
 <p className="text-xs text-destructive">{errors.motivo.message}</p>
 )}
 </div>

 {/* Items */}
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <Label>Items a Ajustar</Label>
 <Badge variant="secondary">{items.length} items</Badge>
 </div>

 {/* Buscar y agregar item */}
 {warehouseId && (
 <div className="relative">
 <div className="flex gap-2">
 <div className="relative flex-1">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input
 placeholder="Buscar item para agregar..."
 value={searchItem}
 onChange={(e) => setSearchItem(e.target.value)}
 className="pl-10"
 />
 </div>
 </div>
 {searchResults.length > 0 && (
 <div className="absolute z-10 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-48 overflow-auto">
 {searchResults.map((item) => (
 <button
 key={item.id}
 type="button"
 className="w-full px-3 py-2 text-left hover:bg-accent text-sm flex items-center justify-between"
 onClick={() => addItem(item)}
 >
 <div className="font-medium">{item.nombre}</div>
 <Badge variant="outline">
 Stock: {stockByItem.get(item.id) || 0} {item.unidad}
 </Badge>
 </button>
 ))}
 </div>
 )}
 </div>
 )}

 {/* Tabla de items */}
 {items.length > 0 ? (
 <div className="border rounded-lg overflow-hidden">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Item</TableHead>
 <TableHead className="text-right w-24">Actual</TableHead>
 <TableHead className="text-right w-32">Nueva</TableHead>
 <TableHead className="text-right w-24">Diferencia</TableHead>
 <TableHead className="w-10"></TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {items.map((item, index) => (
 <TableRow key={item.supplierItemId}>
 <TableCell>
 <div className="font-medium">{item.supplierItemNombre}</div>
 <div className="text-xs text-muted-foreground">{item.unidad}</div>
 </TableCell>
 <TableCell className="text-right">
 {item.cantidadActual.toLocaleString('es-AR')}
 </TableCell>
 <TableCell className="text-right">
 <Input
 type="number"
 step="0.01"
 min="0"
 value={item.cantidadNueva}
 onChange={(e) => updateItemQuantity(index, parseFloat(e.target.value) || 0)}
 className="w-24 text-right"
 />
 </TableCell>
 <TableCell className="text-right">
 <span
 className={
 item.diferencia > 0
 ? 'text-success font-medium'
 : item.diferencia < 0
 ? 'text-destructive font-medium'
 : 'text-muted-foreground'
 }
 >
 {item.diferencia > 0 ? '+' : ''}
 {item.diferencia.toLocaleString('es-AR')}
 </span>
 </TableCell>
 <TableCell>
 <Button
 type="button"
 variant="ghost"
 size="icon"
 onClick={() => removeItem(index)}
 >
 <Trash2 className="h-4 w-4 text-destructive" />
 </Button>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>

 {/* Totales */}
 <div className="border-t bg-muted/50 px-4 py-3 flex justify-end gap-6">
 <div className="text-sm">
 <span className="text-muted-foreground">Total positivo: </span>
 <span className="text-success font-medium">+{totales.positivo.toLocaleString('es-AR')}</span>
 </div>
 <div className="text-sm">
 <span className="text-muted-foreground">Total negativo: </span>
 <span className="text-destructive font-medium">-{totales.negativo.toLocaleString('es-AR')}</span>
 </div>
 </div>
 </div>
 ) : (
 <div className="border rounded-lg p-8 text-center text-muted-foreground">
 <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
 <p>Seleccione un depósito y busque items para agregar</p>
 </div>
 )}
 </div>

 {/* Notas */}
 <div className="space-y-2">
 <Label>Notas adicionales</Label>
 <Textarea
 placeholder="Notas adicionales (opcional)"
 {...register('notas')}
 rows={2}
 />
 </div>

 {/* Aviso de aprobación */}
 {tipo === 'INVENTARIO_FISICO' && (
 <div className="bg-warning-muted border border-warning-muted rounded-lg p-3 flex gap-2">
 <AlertTriangle className="h-4 w-4 text-warning-muted-foreground mt-0.5 shrink-0" />
 <div className="text-sm text-warning-muted-foreground ">
 <p className="font-medium">Requiere aprobación</p>
 <p className="text-xs mt-1">
 Los ajustes de inventario físico requieren aprobación antes de aplicarse.
 </p>
 </div>
 </div>
 )}
 </DialogBody>

 <DialogFooter>
 <Button
 type="button"
 variant="outline"
 onClick={() => onOpenChange(false)}
 disabled={saving}
 >
 Cancelar
 </Button>
 <Button type="submit" disabled={saving || items.length === 0}>
 {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
 Crear Ajuste
 </Button>
 </DialogFooter>
 </form>
 </DialogContent>
 </Dialog>
 );
}
