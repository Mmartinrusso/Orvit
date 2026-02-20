'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
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
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import {
 Plus,
 Trash2,
 Check,
 ChevronsUpDown,
 AlertTriangle,
 Package,
 TrendingUp,
 TrendingDown,
 Calendar,
 Building2,
 Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';
import { useViewMode } from '@/contexts/ViewModeContext';

interface Proveedor {
 id: number;
 name: string;
 cuit?: string;
}

interface SupplierItem {
 id: number;
 nombre: string;
 descripcion?: string;
 codigoProveedor?: string;
 unidad: string;
 precioUnitario?: number;
 ultimaCompra?: string;
 variacionPorcentaje?: number;
 priceHistory?: Array<{
 precioUnitario: number;
 fecha: string;
 }>;
 // Stock info
 stockActual?: number;
 stockDisponible?: number;
 enCamino?: number;
 stockMinimo?: number;
 stockAlerta?: 'sin_stock' | 'bajo_stock' | 'ok' | null;
}

interface OrdenCompraItem {
 tempId: string;
 supplierItemId: number | null;
 descripcion: string;
 cantidad: number;
 unidad: string;
 precioUnitario: number;
 descuento: number;
 subtotal: number;
 notas: string;
 // Códigos para trazabilidad
 codigoPropio?: string; // Código interno (puede ser editado por usuario)
 codigoProveedor?: string; // Código del proveedor
 // Info del item seleccionado para mostrar
 itemInfo?: {
 ultimoPrecio?: number;
 ultimaFecha?: string;
 promedio90d?: number;
 variacion?: number;
 // Stock info
 stockDisponible?: number;
 enCamino?: number;
 stockMinimo?: number;
 stockAlerta?: 'sin_stock' | 'bajo_stock' | 'ok' | null;
 };
}

interface OrdenCompraFormModalProps {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 defaultProveedorId?: number;
 editingOrdenId?: number;
 onSuccess?: () => void;
}

const CONDICIONES_PAGO = [
 'Contado',
 '15 días',
 '30 días',
 '45 días',
 '60 días',
 '90 días',
 'Contra entrega',
];

const TASAS_IVA = [
 { value: '21', label: 'IVA 21%' },
 { value: '10.5', label: 'IVA 10.5%' },
 { value: '0', label: 'Exento' },
];

export function OrdenCompraFormModal({
 open,
 onOpenChange,
 defaultProveedorId,
 editingOrdenId,
 onSuccess,
}: OrdenCompraFormModalProps) {
 // ViewMode context - determina si se puede crear T2
 const { mode: viewMode } = useViewMode();

 // Estado del formulario
 const [proveedorId, setProveedorId] = useState<number | null>(defaultProveedorId || null);
 const [fechaEmision, setFechaEmision] = useState<string>(new Date().toISOString().split('T')[0]);
 const [fechaEntregaEsperada, setFechaEntregaEsperada] = useState<string>('');
 const [condicionesPago, setCondicionesPago] = useState<string>('Contado');
 const [tasaIva, setTasaIva] = useState<string>('21');
 const [esEmergencia, setEsEmergencia] = useState<boolean>(false);
 const [motivoEmergencia, setMotivoEmergencia] = useState<string>('');
 const [notas, setNotas] = useState<string>('');
 const [notasInternas, setNotasInternas] = useState<string>('');
 const [items, setItems] = useState<OrdenCompraItem[]>([]);

 // Estado de carga
 const [proveedores, setProveedores] = useState<Proveedor[]>([]);
 const [supplierItems, setSupplierItems] = useState<SupplierItem[]>([]);
 const [loadingProveedores, setLoadingProveedores] = useState(false);
 const [loadingItems, setLoadingItems] = useState(false);
 const [submitting, setSubmitting] = useState(false);

 // Estado de popovers
 const [proveedorOpen, setProveedorOpen] = useState(false);
 const [itemPopoverOpen, setItemPopoverOpen] = useState<string | null>(null);

 // Cargar proveedores
 useEffect(() => {
 if (open) {
 loadProveedores();
 }
 }, [open]);

 // Cargar items cuando cambia el proveedor
 useEffect(() => {
 if (proveedorId) {
 loadSupplierItems(proveedorId);
 } else {
 setSupplierItems([]);
 }
 }, [proveedorId]);

 // Reset form o cargar datos cuando se abre
 useEffect(() => {
 if (open) {
 if (editingOrdenId) {
 loadOrdenExistente(editingOrdenId);
 } else {
 resetForm();
 if (defaultProveedorId) {
 setProveedorId(defaultProveedorId);
 }
 }
 }
 }, [open, defaultProveedorId, editingOrdenId]);

 // Cargar orden existente para edición
 const loadOrdenExistente = async (ordenId: number) => {
 setSubmitting(true);
 try {
 const response = await fetch(`/api/compras/ordenes-compra/${ordenId}`);
 if (response.ok) {
 const orden = await response.json();
 setProveedorId(orden.proveedorId);
 setFechaEmision(orden.fechaEmision ? orden.fechaEmision.split('T')[0] : new Date().toISOString().split('T')[0]);
 setFechaEntregaEsperada(orden.fechaEntregaEsperada ? orden.fechaEntregaEsperada.split('T')[0] : '');
 setCondicionesPago(orden.condicionesPago || 'Contado');
 setTasaIva(orden.tasaIva?.toString() || '21');
 setEsEmergencia(orden.esEmergencia || false);
 setMotivoEmergencia(orden.motivoEmergencia || '');
 setNotas(orden.notas || '');
 setNotasInternas(orden.notasInternas || '');

 // Cargar items
 if (orden.items && orden.items.length > 0) {
 const mappedItems: OrdenCompraItem[] = orden.items.map((item: any) => ({
 tempId: `existing-${item.id}`,
 supplierItemId: item.supplierItemId,
 descripcion: item.descripcion || item.supplierItem?.nombre || '',
 cantidad: Number(item.cantidad),
 unidad: item.unidad || 'UN',
 precioUnitario: Number(item.precioUnitario),
 descuento: Number(item.descuento || 0),
 subtotal: Number(item.subtotal),
 notas: item.notas || '',
 // Cargar códigos existentes
 codigoPropio: item.codigoPropio || undefined,
 codigoProveedor: item.codigoProveedor || item.supplierItem?.codigoProveedor || undefined,
 itemInfo: {
 ultimoPrecio: Number(item.precioUnitario),
 },
 }));
 setItems(mappedItems);
 }
 } else {
 toast.error('Error al cargar la orden');
 }
 } catch (error) {
 console.error('Error loading orden:', error);
 toast.error('Error al cargar la orden');
 } finally {
 setSubmitting(false);
 }
 };

 const loadProveedores = async () => {
 setLoadingProveedores(true);
 try {
 const response = await fetch('/api/compras/proveedores?limit=100');
 if (response.ok) {
 const data = await response.json();
 setProveedores(data.data || data || []);
 }
 } catch (error) {
 console.error('Error loading proveedores:', error);
 } finally {
 setLoadingProveedores(false);
 }
 };

 const loadSupplierItems = async (provId: number) => {
 setLoadingItems(true);
 try {
 const response = await fetch(`/api/compras/proveedores/${provId}/items?historyLimit=10`);
 if (response.ok) {
 const data = await response.json();
 setSupplierItems(data || []);
 }
 } catch (error) {
 console.error('Error loading supplier items:', error);
 } finally {
 setLoadingItems(false);
 }
 };

 const resetForm = () => {
 setProveedorId(null);
 setFechaEmision(new Date().toISOString().split('T')[0]);
 setFechaEntregaEsperada('');
 setCondicionesPago('Contado');
 setTasaIva('21');
 setEsEmergencia(false);
 setMotivoEmergencia('');
 setNotas('');
 setNotasInternas('');
 setItems([]);
 };

 // Calcular totales
 const totales = useMemo(() => {
 const subtotal = items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
 const tasaIvaNum = parseFloat(tasaIva) || 0;
 const impuestos = subtotal * (tasaIvaNum / 100);
 const total = subtotal + impuestos;
 return { subtotal, impuestos, total };
 }, [items, tasaIva]);

 // Agregar item vacío
 const addItem = useCallback(() => {
 const newItem: OrdenCompraItem = {
 tempId: `temp-${Date.now()}`,
 supplierItemId: null,
 descripcion: '',
 cantidad: 1,
 unidad: 'UN',
 precioUnitario: 0,
 descuento: 0,
 subtotal: 0,
 notas: '',
 };
 setItems(prev => [...prev, newItem]);
 }, []);

 // Eliminar item
 const removeItem = useCallback((tempId: string) => {
 setItems(prev => prev.filter(item => item.tempId !== tempId));
 }, []);

 // Actualizar item
 const updateItem = useCallback((tempId: string, field: keyof OrdenCompraItem, value: any) => {
 setItems(prev => prev.map(item => {
 if (item.tempId !== tempId) return item;

 const updated = { ...item, [field]: value };

 // Recalcular subtotal
 if (field === 'cantidad' || field === 'precioUnitario' || field === 'descuento') {
 const cantidad = field === 'cantidad' ? value : updated.cantidad;
 const precio = field === 'precioUnitario' ? value : updated.precioUnitario;
 const descuento = field === 'descuento' ? value : updated.descuento;
 updated.subtotal = cantidad * precio * (1 - descuento / 100);
 }

 return updated;
 }));
 }, []);

 // Seleccionar item del catálogo
 const selectSupplierItem = useCallback((tempId: string, supplierItem: SupplierItem) => {
 // Calcular promedio de últimos 90 días
 const history = supplierItem.priceHistory || [];
 const now = new Date();
 const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
 const recentPrices = history.filter(h => new Date(h.fecha) >= ninetyDaysAgo);
 const promedio90d = recentPrices.length > 0
 ? recentPrices.reduce((sum, h) => sum + Number(h.precioUnitario), 0) / recentPrices.length
 : null;

 const ultimoPrecio = history[0]?.precioUnitario || supplierItem.precioUnitario || 0;

 setItems(prev => prev.map(item => {
 if (item.tempId !== tempId) return item;

 const precioUnitario = Number(ultimoPrecio);
 const subtotal = item.cantidad * precioUnitario * (1 - item.descuento / 100);

 return {
 ...item,
 supplierItemId: supplierItem.id,
 descripcion: supplierItem.nombre,
 unidad: supplierItem.unidad || 'UN',
 precioUnitario,
 subtotal,
 // Guardar código del proveedor para trazabilidad
 codigoProveedor: supplierItem.codigoProveedor || undefined,
 itemInfo: {
 ultimoPrecio: Number(ultimoPrecio),
 ultimaFecha: history[0]?.fecha,
 promedio90d: promedio90d ? Number(promedio90d) : undefined,
 variacion: supplierItem.variacionPorcentaje,
 // Stock info
 stockDisponible: supplierItem.stockDisponible,
 enCamino: supplierItem.enCamino,
 stockMinimo: supplierItem.stockMinimo,
 stockAlerta: supplierItem.stockAlerta,
 },
 };
 }));
 setItemPopoverOpen(null);
 }, []);

 // Validar formulario
 const validateForm = (): boolean => {
 if (!proveedorId) {
 toast.error('Seleccione un proveedor');
 return false;
 }
 if (items.length === 0) {
 toast.error('Agregue al menos un item');
 return false;
 }
 if (items.some(item => !item.supplierItemId)) {
 toast.error('Todos los items deben tener un producto seleccionado');
 return false;
 }
 if (items.some(item => item.cantidad <= 0)) {
 toast.error('Todas las cantidades deben ser mayores a 0');
 return false;
 }
 if (esEmergencia && !motivoEmergencia.trim()) {
 toast.error('Ingrese el motivo de emergencia');
 return false;
 }
 return true;
 };

 // Guardar
 const handleSubmit = async () => {
 if (!validateForm()) return;

 setSubmitting(true);
 try {
 const payload = {
 proveedorId,
 fechaEmision,
 fechaEntregaEsperada: fechaEntregaEsperada || null,
 condicionesPago,
 tasaIva,
 esEmergencia,
 motivoEmergencia: esEmergencia ? motivoEmergencia : null,
 notas,
 notasInternas,
 // DocType: T2 si está en modo Extended, T1 en caso contrario
 docType: viewMode === 'E' ? 'T2' : 'T1',
 items: items.map(item => ({
 supplierItemId: item.supplierItemId,
 descripcion: item.descripcion,
 cantidad: item.cantidad,
 unidad: item.unidad,
 precioUnitario: item.precioUnitario,
 descuento: item.descuento,
 notas: item.notas,
 // Códigos para trazabilidad
 codigoPropio: item.codigoPropio || undefined,
 codigoProveedor: item.codigoProveedor || undefined,
 })),
 };

 const url = editingOrdenId
 ? `/api/compras/ordenes-compra/${editingOrdenId}`
 : '/api/compras/ordenes-compra';

 const response = await fetch(url, {
 method: editingOrdenId ? 'PUT' : 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(payload),
 });

 if (response.ok) {
 const data = await response.json();
 toast.success(editingOrdenId ? 'Orden actualizada' : `Orden ${data.numero} creada`);
 onOpenChange(false);
 onSuccess?.();
 } else {
 const error = await response.json();
 toast.error(error.error || 'Error al guardar la orden');
 }
 } catch (error) {
 console.error('Error saving orden:', error);
 toast.error('Error al guardar la orden');
 } finally {
 setSubmitting(false);
 }
 };

 const proveedorSeleccionado = proveedores.find(p => p.id === proveedorId);

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent size="xl">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <Package className="w-5 h-5" />
 {editingOrdenId ? 'Editar Orden de Compra' : 'Nueva Orden de Compra'}
 </DialogTitle>
 <DialogDescription>
 Complete los datos de la orden y agregue los items a comprar
 </DialogDescription>
 </DialogHeader>

 <DialogBody className="space-y-6">
 {/* Datos Principales */}
 <div className="space-y-4">
 <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
 Datos Principales
 </h3>

 <div className="grid grid-cols-2 gap-4">
 {/* Proveedor */}
 <div className="space-y-2">
 <Label>Proveedor *</Label>
 <Popover open={proveedorOpen} onOpenChange={setProveedorOpen}>
 <PopoverTrigger asChild>
 <Button
 variant="outline"
 role="combobox"
 aria-expanded={proveedorOpen}
 className="w-full justify-between"
 disabled={loadingProveedores || !!defaultProveedorId}
 >
 {proveedorSeleccionado ? (
 <span className="truncate">{proveedorSeleccionado.name}</span>
 ) : (
 <span className="text-muted-foreground">Seleccionar proveedor...</span>
 )}
 <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-[400px] p-0" align="start">
 <Command>
 <CommandInput placeholder="Buscar proveedor..." />
 <CommandList>
 <CommandEmpty>No se encontraron proveedores</CommandEmpty>
 <CommandGroup>
 {proveedores.map((prov) => (
 <CommandItem
 key={prov.id}
 value={prov.name}
 onSelect={() => {
 setProveedorId(prov.id);
 setProveedorOpen(false);
 setItems([]); // Reset items al cambiar proveedor
 }}
 >
 <Check
 className={cn(
 "mr-2 h-4 w-4",
 proveedorId === prov.id ? "opacity-100" : "opacity-0"
 )}
 />
 <div className="flex flex-col">
 <span>{prov.name}</span>
 {prov.cuit && (
 <span className="text-xs text-muted-foreground">
 CUIT: {prov.cuit}
 </span>
 )}
 </div>
 </CommandItem>
 ))}
 </CommandGroup>
 </CommandList>
 </Command>
 </PopoverContent>
 </Popover>
 </div>

 {/* Fecha Emisión */}
 <div className="space-y-2">
 <Label>Fecha Emisión</Label>
 <DatePicker
 value={fechaEmision}
 onChange={(date) => setFechaEmision(date)}
 placeholder="Seleccionar fecha"
 />
 </div>

 {/* Fecha Entrega */}
 <div className="space-y-2">
 <Label>Fecha Entrega Esperada</Label>
 <DatePicker
 value={fechaEntregaEsperada}
 onChange={(date) => setFechaEntregaEsperada(date)}
 placeholder="Seleccionar fecha"
 clearable
 />
 </div>

 {/* Condiciones de Pago */}
 <div className="space-y-2">
 <Label>Condiciones de Pago</Label>
 <Select value={condicionesPago} onValueChange={setCondicionesPago}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {CONDICIONES_PAGO.map((cond) => (
 <SelectItem key={cond} value={cond}>{cond}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 </div>

 {/* Emergencia */}
 <div className="flex items-start gap-4 p-3 border rounded-md bg-muted/30">
 <Checkbox
 id="emergencia"
 checked={esEmergencia}
 onCheckedChange={(checked) => setEsEmergencia(checked as boolean)}
 />
 <div className="flex-1 space-y-2">
 <Label htmlFor="emergencia" className="flex items-center gap-2 cursor-pointer">
 <AlertTriangle className="w-4 h-4 text-warning-muted-foreground" />
 Compra de Emergencia
 </Label>
 {esEmergencia && (
 <Input
 placeholder="Motivo de la emergencia..."
 value={motivoEmergencia}
 onChange={(e) => setMotivoEmergencia(e.target.value)}
 />
 )}
 </div>
 </div>
 </div>

 {/* Items */}
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
 Items de la Orden
 </h3>
 <Button
 size="sm"
 variant="outline"
 onClick={addItem}
 disabled={!proveedorId}
 >
 <Plus className="w-4 h-4 mr-1" />
 Agregar Item
 </Button>
 </div>

 {!proveedorId ? (
 <div className="text-center py-8 text-muted-foreground border rounded-md">
 <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
 Seleccione un proveedor para agregar items
 </div>
 ) : items.length === 0 ? (
 <div className="text-center py-8 text-muted-foreground border rounded-md">
 <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
 No hay items. Haga clic en "Agregar Item" para comenzar.
 </div>
 ) : (
 <div className="border rounded-md overflow-x-auto">
 <Table className="min-w-[950px]">
 <TableHeader>
 <TableRow className="bg-muted/50">
 <TableHead className="w-[200px]">Item Catálogo</TableHead>
 <TableHead className="w-[150px]">Descripción</TableHead>
 <TableHead className="w-[90px]">Cód. Int.</TableHead>
 <TableHead className="w-[90px]">Cód. Prov.</TableHead>
 <TableHead className="w-[70px] text-center">Cant.</TableHead>
 <TableHead className="w-[50px]">Unid.</TableHead>
 <TableHead className="w-[100px] text-right">Precio</TableHead>
 <TableHead className="w-[60px] text-center">Desc%</TableHead>
 <TableHead className="w-[100px] text-right">Subtotal</TableHead>
 <TableHead className="w-[40px]"></TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {items.map((item) => (
 <TableRow key={item.tempId}>
 <TableCell>
 <Popover
 open={itemPopoverOpen === item.tempId}
 onOpenChange={(open) => setItemPopoverOpen(open ? item.tempId : null)}
 >
 <PopoverTrigger asChild>
 <Button
 variant="outline"
 role="combobox"
 className="w-full justify-between text-left font-normal h-auto min-h-[36px] py-1"
 >
 {item.supplierItemId ? (
 <div className="flex flex-col items-start">
 <span className="truncate">{item.descripcion}</span>
 {item.itemInfo && (
 <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
 {item.itemInfo.promedio90d && (
 <>
 <span>Prom: ${item.itemInfo.promedio90d.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
 {item.itemInfo.variacion !== undefined && item.itemInfo.variacion !== null && (
 <span className={cn(
 "flex items-center",
 item.itemInfo.variacion > 0 ? "text-destructive" : "text-success"
 )}>
 {item.itemInfo.variacion > 0 ? (
 <TrendingUp className="w-3 h-3 mr-0.5" />
 ) : (
 <TrendingDown className="w-3 h-3 mr-0.5" />
 )}
 {Math.abs(item.itemInfo.variacion).toFixed(1)}%
 </span>
 )}
 </>
 )}
 {/* Stock info */}
 {item.itemInfo.stockMinimo !== undefined && item.itemInfo.stockMinimo > 0 && (
 <>
 <span className="text-muted-foreground">|</span>
 <span className={cn(
 item.itemInfo.stockAlerta === 'sin_stock' && 'text-destructive font-medium',
 item.itemInfo.stockAlerta === 'bajo_stock' && 'text-warning-muted-foreground',
 item.itemInfo.stockAlerta === 'ok' && 'text-success'
 )}>
 Stock: {(item.itemInfo.stockDisponible || 0).toLocaleString('es-AR')}
 </span>
 {(item.itemInfo.enCamino || 0) > 0 && (
 <span className="text-info-muted-foreground">
 +{item.itemInfo.enCamino} OC
 </span>
 )}
 </>
 )}
 </div>
 )}
 </div>
 ) : (
 <span className="text-muted-foreground">Seleccionar item...</span>
 )}
 <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-[400px] p-0" align="start">
 <Command>
 <CommandInput placeholder="Buscar item..." />
 <CommandList>
 <CommandEmpty>
 {loadingItems ? 'Cargando...' : 'No se encontraron items'}
 </CommandEmpty>
 <CommandGroup>
 {supplierItems.map((si) => (
 <CommandItem
 key={si.id}
 value={si.nombre}
 onSelect={() => selectSupplierItem(item.tempId, si)}
 className={cn(
 si.stockAlerta === 'sin_stock' && 'bg-destructive/10 ',
 si.stockAlerta === 'bajo_stock' && 'bg-warning-muted '
 )}
 >
 <Check
 className={cn(
 "mr-2 h-4 w-4",
 item.supplierItemId === si.id ? "opacity-100" : "opacity-0"
 )}
 />
 <div className="flex-1">
 <div className="flex justify-between">
 <span>{si.nombre}</span>
 <span className="font-medium">
 ${Number(si.precioUnitario || 0).toLocaleString('es-AR')}
 </span>
 </div>
 <div className="flex justify-between text-xs text-muted-foreground">
 <span>{si.codigoProveedor || '-'} • {si.unidad}</span>
 {si.ultimaCompra && (
 <span>
 Última: {new Date(si.ultimaCompra).toLocaleDateString('es-AR')}
 </span>
 )}
 </div>
 {/* Stock info */}
 {si.stockMinimo !== undefined && si.stockMinimo > 0 && (
 <div className="flex items-center gap-2 mt-1">
 <span className={cn(
 "text-xs font-medium",
 si.stockAlerta === 'sin_stock' && 'text-destructive',
 si.stockAlerta === 'bajo_stock' && 'text-warning-muted-foreground',
 si.stockAlerta === 'ok' && 'text-success'
 )}>
 Stock: {(si.stockDisponible || 0).toLocaleString('es-AR')} {si.unidad}
 </span>
 {(si.enCamino || 0) > 0 && (
 <span className="text-xs text-info-muted-foreground">
 (+{si.enCamino} en camino)
 </span>
 )}
 {si.stockAlerta === 'sin_stock' && (
 <Badge variant="destructive" className="text-[10px] h-4 px-1">
 SIN STOCK
 </Badge>
 )}
 {si.stockAlerta === 'bajo_stock' && (
 <Badge variant="outline" className="text-[10px] h-4 px-1 border-warning-muted text-warning-muted-foreground">
 BAJO
 </Badge>
 )}
 </div>
 )}
 </div>
 </CommandItem>
 ))}
 </CommandGroup>
 </CommandList>
 </Command>
 </PopoverContent>
 </Popover>
 </TableCell>
 {/* Descripción editable */}
 <TableCell>
 <Input
 type="text"
 value={item.descripcion}
 onChange={(e) => updateItem(item.tempId, 'descripcion', e.target.value)}
 className="w-full text-sm"
 placeholder="Descripción..."
 />
 </TableCell>
 {/* Código Interno (propio) editable */}
 <TableCell>
 <Input
 type="text"
 value={item.codigoPropio || ''}
 onChange={(e) => updateItem(item.tempId, 'codigoPropio', e.target.value)}
 className="w-full text-sm font-mono"
 placeholder="Cód. int."
 />
 </TableCell>
 {/* Código Proveedor editable */}
 <TableCell>
 <Input
 type="text"
 value={item.codigoProveedor || ''}
 onChange={(e) => updateItem(item.tempId, 'codigoProveedor', e.target.value)}
 className="w-full text-sm font-mono"
 placeholder="Cód. prov."
 />
 </TableCell>
 {/* Cantidad */}
 <TableCell>
 <Input
 type="number"
 value={item.cantidad}
 onChange={(e) => updateItem(item.tempId, 'cantidad', parseFloat(e.target.value) || 0)}
 className="text-center w-full"
 min="0"
 step="1"
 />
 </TableCell>
 <TableCell>
 <span className="text-sm text-muted-foreground">{item.unidad}</span>
 </TableCell>
 <TableCell>
 <Input
 type="number"
 value={item.precioUnitario}
 onChange={(e) => updateItem(item.tempId, 'precioUnitario', parseFloat(e.target.value) || 0)}
 className="text-right w-full"
 min="0"
 step="0.01"
 />
 </TableCell>
 <TableCell>
 <Input
 type="number"
 value={item.descuento}
 onChange={(e) => updateItem(item.tempId, 'descuento', parseFloat(e.target.value) || 0)}
 className="text-center w-full"
 min="0"
 max="100"
 step="0.5"
 />
 </TableCell>
 <TableCell className="text-right font-medium">
 ${item.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
 </TableCell>
 <TableCell>
 <Button
 size="icon"
 variant="ghost"
 className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
 onClick={() => removeItem(item.tempId)}
 >
 <Trash2 className="h-4 w-4" />
 </Button>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 )}
 </div>

 {/* Totales */}
 {items.length > 0 && (
 <div className="flex justify-end">
 <div className="w-64 space-y-2 text-sm">
 <div className="flex justify-between">
 <span className="text-muted-foreground">Subtotal:</span>
 <span>${totales.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
 </div>
 <div className="flex justify-between items-center">
 <div className="flex items-center gap-2">
 <span className="text-muted-foreground">IVA:</span>
 <Select value={tasaIva} onValueChange={setTasaIva}>
 <SelectTrigger className="h-7 w-24">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {TASAS_IVA.map((t) => (
 <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <span>${totales.impuestos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
 </div>
 <div className="flex justify-between font-bold text-base border-t pt-2">
 <span>TOTAL:</span>
 <span>${totales.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
 </div>
 </div>
 </div>
 )}

 {/* Notas */}
 <div className="space-y-4">
 <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
 Notas
 </h3>
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label>Notas para el proveedor</Label>
 <Textarea
 placeholder="Instrucciones de entrega, observaciones..."
 value={notas}
 onChange={(e) => setNotas(e.target.value)}
 rows={3}
 />
 </div>
 <div className="space-y-2">
 <Label>Notas internas (no se muestran al proveedor)</Label>
 <Textarea
 placeholder="Notas internas..."
 value={notasInternas}
 onChange={(e) => setNotasInternas(e.target.value)}
 rows={3}
 />
 </div>
 </div>
 </div>
 </DialogBody>

 <DialogFooter>
 <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
 Cancelar
 </Button>
 <Button onClick={handleSubmit} disabled={submitting || items.length === 0}>
 {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
 {editingOrdenId ? 'Actualizar Orden' : 'Guardar como Borrador'}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
}

export default OrdenCompraFormModal;
