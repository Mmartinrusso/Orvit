'use client';

import { useState, useEffect, useMemo } from 'react';
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogFooter,
 DialogBody,
 DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import {
 Command,
 CommandEmpty,
 CommandGroup,
 CommandInput,
 CommandItem,
 CommandList,
} from '@/components/ui/command';
import {
 Popover,
 PopoverContent,
 PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
 FileText,
 Loader2,
 Plus,
 Trash2,
 Search,
 Package,
 Check,
 ChevronsUpDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useViewMode } from '@/contexts/ViewModeContext';

// Unidades disponibles
const UNIDADES = [
 { value: 'UN', label: 'Unidad' },
 { value: 'KG', label: 'Kilogramo' },
 { value: 'TN', label: 'Tonelada' },
 { value: 'LT', label: 'Litro' },
 { value: 'M', label: 'Metro' },
 { value: 'M2', label: 'Metro²' },
 { value: 'M3', label: 'Metro³' },
 { value: 'CM', label: 'Centímetro' },
 { value: 'MM', label: 'Milímetro' },
 { value: 'GL', label: 'Galón' },
 { value: 'PZA', label: 'Pieza' },
 { value: 'PAR', label: 'Par' },
 { value: 'ROLLO', label: 'Rollo' },
 { value: 'CAJA', label: 'Caja' },
 { value: 'BOLSA', label: 'Bolsa' },
 { value: 'PALLET', label: 'Pallet' },
];

interface CrearOCModalProps {
 open: boolean;
 onClose: () => void;
 pedidoId: number;
 onSuccess?: () => void;
}

interface Cotizacion {
 id: number;
 numero: string;
 supplierId: number;
 supplier: {
 id: number;
 name: string;
 };
 moneda: string;
 condicionesPago?: string;
 plazoEntrega?: number;
 fechaEntregaEstimada?: string;
 subtotal: number;
 impuestos: number;
 total: number;
 items: CotizacionItem[];
}

interface CotizacionItem {
 id: number;
 descripcion: string;
 cantidad: number;
 unidad: string;
 precioUnitario: number;
 descuento: number;
 subtotal: number;
 supplierItemId?: number;
 codigoProveedor?: string;
 supplierItem?: {
 id: number;
 nombre: string;
 codigoProveedor?: string;
 supply?: {
 code?: string;
 };
 };
}

interface OCItem {
 id: string;
 supplierItemId?: number;
 descripcion: string;
 codigoPropio?: string;
 codigoProveedor?: string;
 cantidad: number;
 unidad: string;
 precioUnitario: number;
 descuento: number;
 subtotal: number;
}

interface ProveedorItem {
 id: number;
 nombre: string;
 descripcion?: string;
 codigoProveedor?: string;
 unidad: string;
 precioUnitario?: number;
}

export function CrearOCModal({ open, onClose, pedidoId, onSuccess }: CrearOCModalProps) {
 const { mode: viewMode, ct } = useViewMode();
 const isExtAvailable = viewMode === 'E'; // Extended mode available

 const [loading, setLoading] = useState(true);
 const [submitting, setSubmitting] = useState(false);
 const [cotizacion, setCotizacion] = useState<Cotizacion | null>(null);
 const [pedidoNumero, setPedidoNumero] = useState('');

 // Form state
 const [docType, setDocType] = useState<'T1' | 'T2'>('T1');
 const [items, setItems] = useState<OCItem[]>([]);
 const [notas, setNotas] = useState('');

 // Item search
 const [proveedorItems, setProveedorItems] = useState<ProveedorItem[]>([]);
 const [loadingItems, setLoadingItems] = useState(false);
 const [itemSearchOpen, setItemSearchOpen] = useState(false);
 const [itemSearch, setItemSearch] = useState('');

 // Tipo de cuenta (opcional)
 const [cuentas, setCuentas] = useState<{ id: string; nombre: string; descripcion?: string }[]>([]);
 const [tipoCuentaId, setTipoCuentaId] = useState<string>('');
 const [cuentaPopoverOpen, setCuentaPopoverOpen] = useState(false);

 // Load pedido and cotizacion data
 useEffect(() => {
 if (open && pedidoId) {
 // Resetear estado al abrir
 setItems([]);
 setNotas('');
 setDocType('T1');
 setTipoCuentaId('');
 setCotizacion(null);

 loadPedidoData();
 loadCuentas();
 }
 }, [open, pedidoId]);

 const loadCuentas = async () => {
 try {
 const response = await fetch('/api/compras/cuentas');
 if (response.ok) {
 const data = await response.json();
 setCuentas(data.filter((c: any) => c.activa));
 }
 } catch (error) {
 console.error('Error loading cuentas:', error);
 }
 };

 const loadPedidoData = async () => {
 setLoading(true);
 try {
 const response = await fetch(`/api/compras/pedidos/${pedidoId}`);
 if (response.ok) {
 const pedido = await response.json();
 setPedidoNumero(pedido.numero);

 // Find selected quotation
 const cotizacionSeleccionada = pedido.quotations?.find((q: any) => q.esSeleccionada);
 if (cotizacionSeleccionada) {
 setCotizacion(cotizacionSeleccionada);

 // Pre-cargar items de la cotización
 if (cotizacionSeleccionada.items && cotizacionSeleccionada.items.length > 0) {
 const itemsFromCotizacion: OCItem[] = cotizacionSeleccionada.items.map((item: CotizacionItem, idx: number) => ({
 id: `cot-${item.id || idx}`,
 supplierItemId: item.supplierItemId,
 descripcion: item.descripcion,
 codigoPropio: item.supplierItem?.supply?.code || '',
 codigoProveedor: item.codigoProveedor || item.supplierItem?.codigoProveedor || '',
 cantidad: Number(item.cantidad),
 unidad: item.unidad || 'UN',
 precioUnitario: Number(item.precioUnitario),
 descuento: Number(item.descuento) || 0,
 subtotal: Number(item.subtotal),
 }));
 setItems(itemsFromCotizacion);
 }

 // Cargar items del proveedor para búsqueda adicional
 loadProveedorItems(cotizacionSeleccionada.supplierId);
 } else {
 toast.error('No hay cotización seleccionada');
 onClose();
 }
 } else {
 toast.error('Error al cargar el pedido');
 onClose();
 }
 } catch (error) {
 console.error('Error loading pedido:', error);
 toast.error('Error al cargar el pedido');
 onClose();
 } finally {
 setLoading(false);
 }
 };

 const loadProveedorItems = async (proveedorId: number) => {
 setLoadingItems(true);
 try {
 const response = await fetch(`/api/compras/proveedores/${proveedorId}/items?limit=100`);
 if (response.ok) {
 const data = await response.json();
 setProveedorItems(data.data || []);
 }
 } catch (error) {
 console.error('Error loading proveedor items:', error);
 } finally {
 setLoadingItems(false);
 }
 };


 // Calculate totals
 const totals = useMemo(() => {
 const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
 const impuestos = subtotal * 0.21; // 21% IVA
 const total = subtotal + impuestos;
 return { subtotal, impuestos, total };
 }, [items]);

 // Update item (solo actualiza el estado, NO llama a la API)
 const updateItem = (itemId: string, field: keyof OCItem, value: any) => {
 setItems(prev => prev.map(item => {
 if (item.id !== itemId) return item;

 const updated = { ...item, [field]: value };

 // Recalculate subtotal
 if (field === 'cantidad' || field === 'precioUnitario' || field === 'descuento') {
 const cantidad = field === 'cantidad' ? Number(value) : item.cantidad;
 const precio = field === 'precioUnitario' ? Number(value) : item.precioUnitario;
 const descuento = field === 'descuento' ? Number(value) : item.descuento;
 const subtotalBruto = cantidad * precio;
 updated.subtotal = subtotalBruto - (subtotalBruto * descuento / 100);
 }

 return updated;
 }));
 };

 // Add item from search
 const addItemFromSearch = (provItem: ProveedorItem) => {
 const newItem: OCItem = {
 id: `new-${Date.now()}`,
 supplierItemId: provItem.id,
 descripcion: provItem.nombre,
 codigoPropio: '', // Inicializar vacío para que el usuario pueda editarlo
 codigoProveedor: provItem.codigoProveedor || '',
 cantidad: 1,
 unidad: provItem.unidad || 'UN',
 precioUnitario: provItem.precioUnitario || 0,
 descuento: 0,
 subtotal: provItem.precioUnitario || 0,
 };
 setItems(prev => [...prev, newItem]);
 setItemSearchOpen(false);
 setItemSearch('');
 };

 // Add manual item
 const addManualItem = () => {
 const newItem: OCItem = {
 id: `manual-${Date.now()}`,
 descripcion: '',
 codigoPropio: '',
 codigoProveedor: '',
 cantidad: 1,
 unidad: 'UN',
 precioUnitario: 0,
 descuento: 0,
 subtotal: 0,
 };
 setItems(prev => [...prev, newItem]);
 };

 // Remove item
 const removeItem = (itemId: string) => {
 setItems(prev => prev.filter(item => item.id !== itemId));
 };

 // Filter items for search
 const filteredItems = useMemo(() => {
 if (!itemSearch) return proveedorItems;
 const search = itemSearch.toLowerCase();
 return proveedorItems.filter(item =>
 item.nombre.toLowerCase().includes(search) ||
 item.codigoProveedor?.toLowerCase().includes(search)
 );
 }, [proveedorItems, itemSearch]);

 // Submit
 const handleSubmit = async () => {
 if (items.length === 0) {
 toast.error('Debe agregar al menos un item');
 return;
 }

 // Validar que todos los items tengan datos completos
 const itemInvalido = items.find(item =>
 !item.descripcion ||
 item.cantidad <= 0 ||
 item.precioUnitario <= 0
 );

 if (itemInvalido) {
 if (!itemInvalido.descripcion) {
 toast.error('Todos los items deben tener descripción');
 } else if (itemInvalido.cantidad <= 0) {
 toast.error('La cantidad debe ser mayor a 0');
 } else if (itemInvalido.precioUnitario <= 0) {
 toast.error('El precio debe ser mayor a 0');
 }
 return;
 }

 setSubmitting(true);
 try {
 const response = await fetch(`/api/compras/cotizaciones/${cotizacion!.id}/convertir-oc`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 docType,
 notas,
 tipoCuentaId: tipoCuentaId || null,
 items: items.map(item => ({
 supplierItemId: item.supplierItemId,
 codigoPropio: item.codigoPropio,
 codigoProveedor: item.codigoProveedor,
 descripcion: item.descripcion,
 cantidad: item.cantidad,
 unidad: item.unidad,
 precioUnitario: item.precioUnitario,
 descuento: item.descuento,
 subtotal: item.subtotal,
 })),
 subtotal: totals.subtotal,
 impuestos: totals.impuestos,
 total: totals.total,
 }),
 });

 if (response.ok) {
 const data = await response.json();
 toast.success(`OC ${data.purchaseOrder.numero} creada exitosamente`);
 onSuccess?.();
 onClose();
 } else {
 const data = await response.json();
 toast.error(data.error || 'Error al crear la OC');
 }
 } catch (error) {
 console.error('Error creating OC:', error);
 toast.error('Error al crear la OC');
 } finally {
 setSubmitting(false);
 }
 };

 const formatCurrency = (value: number) => {
 return new Intl.NumberFormat('es-AR', {
 style: 'currency',
 currency: cotizacion?.moneda || 'ARS',
 }).format(value);
 };

 return (
 <Dialog open={open} onOpenChange={onClose}>
 <DialogContent size="full">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <FileText className="h-5 w-5" />
 Crear Orden de Compra
 </DialogTitle>
 <DialogDescription className="text-sm">
 {pedidoNumero && `Desde pedido ${pedidoNumero}`}
 {cotizacion && ` - Proveedor: ${cotizacion.supplier.name}`}
 </DialogDescription>
 </DialogHeader>

 <DialogBody className="flex-1 overflow-hidden">
 {loading ? (
 <div className="flex items-center justify-center py-12">
 <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
 </div>
 ) : (
 <div className="space-y-4">
 {/* Document Type Selector */}
 {isExtAvailable && (
 <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg border">
 <Label className="text-sm font-medium">Tipo de documento:</Label>
 <div className="flex gap-2">
 <Button
 type="button"
 variant={docType === 'T1' ? 'default' : 'outline'}
 size="sm"
 onClick={() => setDocType('T1')}
 className="h-8"
 >
 Documentado
 </Button>
 <Button
 type="button"
 variant={docType === 'T2' ? 'default' : 'outline'}
 size="sm"
 onClick={() => setDocType('T2')}
 className="h-8"
 >
 Adicional
 </Button>
 </div>
 </div>
 )}

 {/* Info de cotización y referencia de items */}
 {cotizacion && (
 <div className="space-y-3">
 <div className="grid grid-cols-4 gap-4 p-3 bg-muted/20 rounded-lg border">
 <div>
 <span className="text-xs text-muted-foreground">Cotización</span>
 <p className="text-sm font-medium">{cotizacion.numero}</p>
 </div>
 <div>
 <span className="text-xs text-muted-foreground">Proveedor</span>
 <p className="text-sm font-medium">{cotizacion.supplier.name}</p>
 </div>
 <div>
 <span className="text-xs text-muted-foreground">Condiciones</span>
 <p className="text-sm font-medium">{cotizacion.condicionesPago || '-'}</p>
 </div>
 <div>
 <span className="text-xs text-muted-foreground">Plazo entrega</span>
 <p className="text-sm font-medium">
 {cotizacion.plazoEntrega ? `${cotizacion.plazoEntrega} días` : '-'}
 </p>
 </div>
 </div>

 {/* Referencia: Items de la cotización */}
 {cotizacion.items && cotizacion.items.length > 0 && (
 <details className="border rounded-lg">
 <summary className="px-3 py-2 cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-2">
 <Package className="h-4 w-4" />
 Ver items cotizados ({cotizacion.items.length}) - Referencia
 </summary>
 <div className="px-3 pb-3">
 <div className="grid gap-1 text-xs max-h-[150px] overflow-y-auto">
 {cotizacion.items.map((item, idx) => (
 <div key={idx} className="flex items-center justify-between py-1 border-b border-muted/50 last:border-0">
 <div className="flex-1">
 <span className="font-medium">{item.descripcion}</span>
 {(item.supplierItem?.supply?.code || item.supplierItem?.codigoProveedor) && (
 <span className="text-muted-foreground ml-2">
 ({item.supplierItem?.supply?.code && `Propio: ${item.supplierItem.supply.code}`}
 {item.supplierItem?.supply?.code && item.supplierItem?.codigoProveedor && ' | '}
 {item.supplierItem?.codigoProveedor && `Prov: ${item.supplierItem.codigoProveedor}`})
 </span>
 )}
 </div>
 <div className="flex items-center gap-4 text-muted-foreground">
 <span>{Number(item.cantidad)} {item.unidad}</span>
 <span>{formatCurrency(Number(item.precioUnitario))}</span>
 </div>
 </div>
 ))}
 </div>
 </div>
 </details>
 )}
 </div>
 )}

 {/* Items */}
 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <Label className="text-sm font-medium">Items de la orden</Label>
 <div className="flex gap-2">
 <Popover open={itemSearchOpen} onOpenChange={setItemSearchOpen}>
 <PopoverTrigger asChild>
 <Button variant="outline" size="sm" className="h-8 text-xs">
 <Search className="h-3.5 w-3.5 mr-1" />
 Buscar Item
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-[400px] p-0" align="end">
 <Command>
 <CommandInput
 placeholder="Buscar por nombre o código..."
 value={itemSearch}
 onValueChange={setItemSearch}
 />
 <CommandList>
 <CommandEmpty>
 {loadingItems ? 'Cargando artículos...' : 'No se encontraron items'}
 </CommandEmpty>
 <CommandGroup>
 {filteredItems.slice(0, 20).map((item) => (
 <CommandItem
 key={item.id}
 value={item.nombre}
 onSelect={() => addItemFromSearch(item)}
 className="cursor-pointer"
 >
 <Package className="h-4 w-4 mr-2 text-muted-foreground" />
 <div className="flex-1 min-w-0">
 <p className="text-sm truncate">{item.nombre}</p>
 {item.codigoProveedor && (
 <p className="text-xs text-muted-foreground">
 Cód: {item.codigoProveedor}
 </p>
 )}
 </div>
 {item.precioUnitario && (
 <span className="text-xs text-muted-foreground">
 {formatCurrency(item.precioUnitario)}
 </span>
 )}
 </CommandItem>
 ))}
 </CommandGroup>
 </CommandList>
 </Command>
 </PopoverContent>
 </Popover>
 <Button
 variant="outline"
 size="sm"
 className="h-8 text-xs"
 onClick={addManualItem}
 >
 <Plus className="h-3.5 w-3.5 mr-1" />
 Item Manual
 </Button>
 </div>
 </div>

 <ScrollArea className="h-[400px] border rounded-lg">
 <Table>
 <TableHeader>
 <TableRow className="bg-muted/30">
 <TableHead className="text-xs w-[100px]">Cód. Propio</TableHead>
 <TableHead className="text-xs w-[100px]">Cód. Prov.</TableHead>
 <TableHead className="text-xs min-w-[200px]">Item</TableHead>
 <TableHead className="text-xs w-[80px] text-right">Cant.</TableHead>
 <TableHead className="text-xs w-[70px]">Unidad</TableHead>
 <TableHead className="text-xs w-[120px] text-right">Precio</TableHead>
 <TableHead className="text-xs w-[70px] text-right">Dto%</TableHead>
 <TableHead className="text-xs w-[120px] text-right">Subtotal</TableHead>
 <TableHead className="text-xs w-[40px]"></TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {items.length === 0 ? (
 <TableRow>
 <TableCell colSpan={9} className="text-center py-8 text-muted-foreground text-sm">
 No hay items. Busca o agrega items manualmente.
 </TableCell>
 </TableRow>
 ) : (
 items.map((item) => (
 <TableRow key={item.id}>
 <TableCell className="p-1">
 <Input
 value={item.codigoPropio || ''}
 onChange={(e) => updateItem(item.id, 'codigoPropio', e.target.value)}
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 const nextInput = e.currentTarget.closest('tr')?.querySelector('td:nth-child(2) input') as HTMLInputElement;
 nextInput?.focus();
 }
 }}
 className="h-7 text-xs w-full"
 placeholder="Interno"
 />
 </TableCell>
 <TableCell className="p-1">
 <Input
 value={item.codigoProveedor || ''}
 onChange={(e) => updateItem(item.id, 'codigoProveedor', e.target.value)}
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 const nextInput = e.currentTarget.closest('tr')?.querySelector('td:nth-child(3) input') as HTMLInputElement;
 nextInput?.focus();
 }
 }}
 className="h-7 text-xs w-full"
 placeholder="Proveedor"
 />
 </TableCell>
 <TableCell className="p-1">
 <Input
 value={item.descripcion}
 onChange={(e) => updateItem(item.id, 'descripcion', e.target.value)}
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 const nextInput = e.currentTarget.closest('tr')?.querySelector('td:nth-child(4) input') as HTMLInputElement;
 nextInput?.focus();
 }
 }}
 className="h-7 text-xs w-full"
 placeholder="Nombre del item"
 />
 </TableCell>
 <TableCell className="p-1">
 <Input
 type="number"
 value={item.cantidad || ''}
 onChange={(e) => updateItem(item.id, 'cantidad', e.target.value)}
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 const nextInput = e.currentTarget.closest('tr')?.querySelector('td:nth-child(6) input') as HTMLInputElement;
 nextInput?.focus();
 }
 }}
 className="h-7 text-xs text-right w-full"
 placeholder="0"
 min={0}
 step="0.01"
 />
 </TableCell>
 <TableCell className="p-1">
 <Select
 value={item.unidad}
 onValueChange={(value) => updateItem(item.id, 'unidad', value)}
 >
 <SelectTrigger className="h-7 text-xs w-full">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {UNIDADES.map(u => (
 <SelectItem key={u.value} value={u.value} className="text-xs">
 {u.value}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </TableCell>
 <TableCell className="p-1">
 <Input
 type="number"
 value={item.precioUnitario || ''}
 onChange={(e) => updateItem(item.id, 'precioUnitario', e.target.value)}
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 const nextInput = e.currentTarget.closest('tr')?.querySelector('td:nth-child(7) input') as HTMLInputElement;
 nextInput?.focus();
 }
 }}
 className="h-7 text-xs text-right w-full"
 placeholder="0"
 min={0}
 step="0.01"
 />
 </TableCell>
 <TableCell className="p-1">
 <Input
 type="number"
 value={item.descuento || ''}
 onChange={(e) => updateItem(item.id, 'descuento', e.target.value)}
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 // Move to next row's first input (código propio)
 const currentRow = e.currentTarget.closest('tr');
 const nextRow = currentRow?.nextElementSibling;
 if (nextRow) {
 const nextInput = nextRow.querySelector('td:first-child input') as HTMLInputElement;
 nextInput?.focus();
 }
 }
 }}
 className="h-7 text-xs text-right w-full"
 placeholder="0"
 min={0}
 max={100}
 step="0.1"
 />
 </TableCell>
 <TableCell className="text-right p-1">
 <span className="text-sm font-medium whitespace-nowrap">
 {formatCurrency(item.subtotal)}
 </span>
 </TableCell>
 <TableCell className="p-1">
 <Button
 variant="ghost"
 size="sm"
 className="h-7 w-7 p-0 text-destructive hover:text-destructive"
 onClick={() => removeItem(item.id)}
 >
 <Trash2 className="h-3.5 w-3.5" />
 </Button>
 </TableCell>
 </TableRow>
 ))
 )}
 </TableBody>
 </Table>
 </ScrollArea>

 {/* Totals */}
 <div className="flex justify-end">
 <div className="w-[250px] space-y-1 text-sm">
 <div className="flex justify-between text-muted-foreground">
 <span>Subtotal:</span>
 <span>{formatCurrency(totals.subtotal)}</span>
 </div>
 <div className="flex justify-between text-muted-foreground">
 <span>IVA (21%):</span>
 <span>{formatCurrency(totals.impuestos)}</span>
 </div>
 <div className="flex justify-between font-semibold text-base border-t pt-1">
 <span>Total:</span>
 <span>{formatCurrency(totals.total)}</span>
 </div>
 </div>
 </div>
 </div>

 {/* Tipo de Cuenta (opcional) */}
 <div className="space-y-2">
 <Label className="text-sm font-medium text-muted-foreground">
 Tipo de Cuenta / Gasto (opcional)
 </Label>
 <Popover open={cuentaPopoverOpen} onOpenChange={setCuentaPopoverOpen}>
 <PopoverTrigger asChild>
 <Button
 variant="outline"
 role="combobox"
 aria-expanded={cuentaPopoverOpen}
 className="w-full justify-between h-9 text-sm"
 type="button"
 >
 {tipoCuentaId
 ? cuentas.find(c => c.id === tipoCuentaId)?.nombre || 'Seleccionar'
 : 'Sin asignar (se seleccionará al cargar factura)'}
 <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-[400px] p-0">
 <Command>
 <CommandInput placeholder="Buscar cuenta..." />
 <CommandList>
 <CommandEmpty>No se encontraron cuentas.</CommandEmpty>
 <CommandGroup>
 <CommandItem
 value=""
 onSelect={() => {
 setTipoCuentaId('');
 setCuentaPopoverOpen(false);
 }}
 >
 <Check
 className={cn(
 "mr-2 h-4 w-4",
 !tipoCuentaId ? "opacity-100" : "opacity-0"
 )}
 />
 Sin asignar
 </CommandItem>
 {cuentas.map((cuenta) => (
 <CommandItem
 key={cuenta.id}
 value={cuenta.nombre}
 onSelect={() => {
 setTipoCuentaId(cuenta.id);
 setCuentaPopoverOpen(false);
 }}
 >
 <Check
 className={cn(
 "mr-2 h-4 w-4",
 tipoCuentaId === cuenta.id ? "opacity-100" : "opacity-0"
 )}
 />
 {cuenta.nombre}
 {cuenta.descripcion && (
 <span className="ml-2 text-xs text-muted-foreground">
 ({cuenta.descripcion})
 </span>
 )}
 </CommandItem>
 ))}
 </CommandGroup>
 </CommandList>
 </Command>
 </PopoverContent>
 </Popover>
 </div>

 {/* Notas */}
 <div className="space-y-2">
 <Label className="text-sm font-medium text-muted-foreground">Notas (opcional)</Label>
 <Input
 value={notas}
 onChange={(e) => setNotas(e.target.value)}
 placeholder="Notas adicionales para la orden..."
 className="h-9"
 />
 </div>
 </div>
 )}
 </DialogBody>

 <DialogFooter className="gap-2">
 <Button
 variant="outline"
 onClick={onClose}
 disabled={submitting}
 className="h-8 px-3 text-sm"
 >
 Cancelar
 </Button>
 <Button
 onClick={handleSubmit}
 disabled={submitting || loading || items.length === 0}
 className="h-8 px-4 text-sm"
 >
 {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
 Crear Orden de Compra
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
}

export default CrearOCModal;
