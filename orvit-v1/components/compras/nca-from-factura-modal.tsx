'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
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
import { Checkbox } from '@/components/ui/checkbox';
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
import { Loader2, FileText, AlertTriangle, Calculator, Package, Check } from 'lucide-react';
import { toast } from 'sonner';

interface FacturaItem {
 id: number;
 itemId?: number;
 descripcion: string;
 cantidad: number;
 unidad: string;
 precioUnitario: number;
 subtotal: number;
}

interface NcaFromFacturaModalProps {
 open: boolean;
 onClose: () => void;
 onSuccess: () => void;
 facturaId: number;
 facturaNumero: string;
 proveedorId: number;
 proveedorNombre: string;
 items: FacturaItem[];
 totalFactura: number;
 ingresoConfirmado?: boolean;
 onCrearDevolucion?: () => void;
 /** T1 = FCA (Nota de Crédito A), T2 = PPT (Nota de Crédito simple) */
 facturaDocType?: 'T1' | 'T2';
}

// Tipos de NC para T1 (NCA - Nota de Crédito A - documentos AFIP)
const tiposNcaT1 = [
 { value: 'NCA_DESCUENTO', label: 'Descuento (pronto pago, volumen, etc.)' },
 { value: 'NCA_PRECIO', label: 'Diferencia de Precio' },
 { value: 'NCA_FALTANTE', label: 'Faltante de Mercaderia' },
 { value: 'NCA_CALIDAD', label: 'Problema de Calidad' },
 { value: 'NCA_DEVOLUCION', label: 'Devolución de Mercadería', requiresDevolucion: true },
 { value: 'NCA_OTRO', label: 'Otro motivo' },
];

// Tipos de NC para T2 (NC - Nota de Crédito simple - documentos internos)
const tiposNcaT2 = [
 { value: 'NC_DESCUENTO', label: 'Descuento (pronto pago, volumen, etc.)' },
 { value: 'NC_PRECIO', label: 'Diferencia de Precio' },
 { value: 'NC_FALTANTE', label: 'Faltante de Mercaderia' },
 { value: 'NC_CALIDAD', label: 'Problema de Calidad' },
 { value: 'NC_DEVOLUCION', label: 'Devolución de Mercadería', requiresDevolucion: true },
 { value: 'NC_OTRO', label: 'Otro motivo' },
];

interface ItemNca {
 sourceItemId: number;
 itemId?: number;
 descripcion: string;
 cantidadOriginal: number;
 cantidadNca: number;
 unidad: string;
 precioUnitario: number;
 subtotal: number;
 selected: boolean;
}

interface DevolucionDisponible {
 id: number;
 numero: string;
 fechaCreacion: string;
 tipo: string;
 motivo: string;
 estado: string;
 items: {
 id: number;
 supplierItemId: number;
 descripcion: string;
 cantidad: number;
 unidad: string;
 precioReferencia?: number;
 }[];
}

export function NcaFromFacturaModal({
 open,
 onClose,
 onSuccess,
 facturaId,
 facturaNumero,
 proveedorId,
 proveedorNombre,
 items: facturaItems,
 totalFactura,
 ingresoConfirmado = false,
 onCrearDevolucion,
 facturaDocType = 'T1',
}: NcaFromFacturaModalProps) {
 const [loading, setLoading] = useState(false);
 const [devolucionesDisponibles, setDevolucionesDisponibles] = useState<DevolucionDisponible[]>([]);
 const [loadingDevoluciones, setLoadingDevoluciones] = useState(false);
 const [selectedDevolucionId, setSelectedDevolucionId] = useState<string>('');

 // Determinar si es T1 (NCA) o T2 (NC)
 const isT2 = facturaDocType === 'T2';
 const tiposNca = isT2 ? tiposNcaT2 : tiposNcaT1;
 const defaultTipo = isT2 ? 'NC_DESCUENTO' : 'NCA_DESCUENTO';

 // Labels dinámicos según docType
 const docLabel = isT2 ? 'NC' : 'NCA';
 const docLabelFull = isT2 ? 'Nota de Crédito' : 'Nota de Crédito A';

 const [formData, setFormData] = useState({
 tipoNca: defaultTipo,
 numeroSerie: '',
 numeroFactura: '',
 motivo: '',
 porcentajeDescuento: '',
 montoFijo: '',
 });

 const [items, setItems] = useState<ItemNca[]>([]);

 // Refs for field navigation
 const numeroSerieRef = useRef<HTMLInputElement>(null);
 const numeroFacturaRef = useRef<HTMLInputElement>(null);
 const motivoRef = useRef<HTMLTextAreaElement>(null);
 const porcentajeRef = useRef<HTMLInputElement>(null);
 const montoFijoRef = useRef<HTMLInputElement>(null);

 // Move to next field on Enter
 const moveToNextField = (currentFieldId: string) => {
 const fieldOrder = ['numeroSerie', 'numeroFactura', 'motivo', 'porcentaje', 'montoFijo'];
 const refs: Record<string, React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>> = {
 numeroSerie: numeroSerieRef,
 numeroFactura: numeroFacturaRef,
 motivo: motivoRef,
 porcentaje: porcentajeRef,
 montoFijo: montoFijoRef,
 };

 const currentIndex = fieldOrder.indexOf(currentFieldId);
 if (currentIndex < fieldOrder.length - 1) {
 for (let i = currentIndex + 1; i < fieldOrder.length; i++) {
 const nextFieldId = fieldOrder[i];
 const nextRef = refs[nextFieldId];
 if (nextRef?.current) {
 nextRef.current.focus();
 break;
 }
 }
 }
 };

 // Handle numero serie blur and enter
 const handleNumeroSerieBlur = () => {
 const value = formData.numeroSerie.replace(/\D/g, '');
 if (value) {
 const padded = value.padStart(5, '0');
 const finalValue = padded.length > 5 ? padded.slice(-5) : padded;
 setFormData({ ...formData, numeroSerie: finalValue });
 }
 };

 const handleNumeroSerieKeyDown = (e: React.KeyboardEvent) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 handleNumeroSerieBlur();
 moveToNextField('numeroSerie');
 }
 };

 // Handle numero factura blur and enter
 const handleNumeroFacturaBlur = () => {
 const value = formData.numeroFactura.replace(/\D/g, '');
 if (value) {
 const padded = value.padStart(8, '0');
 const finalValue = padded.length > 8 ? padded.slice(-8) : padded;
 setFormData({ ...formData, numeroFactura: finalValue });
 }
 };

 const handleNumeroFacturaKeyDown = (e: React.KeyboardEvent) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 handleNumeroFacturaBlur();
 moveToNextField('numeroFactura');
 }
 };

 // Initialize items from factura
 useEffect(() => {
 if (open && facturaItems.length > 0) {
 const initialItems: ItemNca[] = facturaItems.map(fi => ({
 sourceItemId: fi.id,
 itemId: fi.itemId,
 descripcion: fi.descripcion,
 cantidadOriginal: fi.cantidad,
 cantidadNca: 0,
 unidad: fi.unidad,
 precioUnitario: fi.precioUnitario,
 subtotal: 0,
 selected: false,
 }));
 setItems(initialItems);
 }
 }, [open, facturaItems]);

 // Reset form when modal opens with correct default
 useEffect(() => {
 if (open) {
 setFormData(prev => ({
 ...prev,
 tipoNca: defaultTipo,
 }));
 setSelectedDevolucionId('');
 setDevolucionesDisponibles([]);
 }
 }, [open, defaultTipo]);

 // Reset form when type changes
 useEffect(() => {
 if (formData.tipoNca === 'NCA_DESCUENTO' || formData.tipoNca === 'NC_DESCUENTO') {
 // For discount, deselect all items
 setItems(items.map(item => ({ ...item, selected: false, cantidadNca: 0, subtotal: 0 })));
 }
 // Reset selected devolucion when type changes
 setSelectedDevolucionId('');
 }, [formData.tipoNca]);

 // Fetch available devoluciones when "Devolución" type is selected
 useEffect(() => {
 const fetchDevoluciones = async () => {
 const isDevolucionTipo = formData.tipoNca === 'NCA_DEVOLUCION' || formData.tipoNca === 'NC_DEVOLUCION';
 if (!open || !isDevolucionTipo || !proveedorId) {
 setDevolucionesDisponibles([]);
 return;
 }

 try {
 setLoadingDevoluciones(true);
 // Fetch devoluciones for this proveedor that don't have an NCA (creditNoteId is null)
 const params = new URLSearchParams({
 proveedorId: proveedorId.toString(),
 sinNca: 'true', // Filter for devoluciones without NCA
 limit: '50',
 });
 const response = await fetch(`/api/compras/devoluciones?${params}`);
 if (response.ok) {
 const result = await response.json();
 setDevolucionesDisponibles(result.data || result || []);
 }
 } catch (error) {
 console.error('Error fetching devoluciones:', error);
 } finally {
 setLoadingDevoluciones(false);
 }
 };

 fetchDevoluciones();
 }, [open, formData.tipoNca, proveedorId]);

 const toggleItemSelection = (index: number) => {
 const updated = [...items];
 updated[index].selected = !updated[index].selected;
 if (updated[index].selected && updated[index].cantidadNca === 0) {
 updated[index].cantidadNca = updated[index].cantidadOriginal;
 updated[index].subtotal = updated[index].cantidadNca * updated[index].precioUnitario;
 } else if (!updated[index].selected) {
 updated[index].cantidadNca = 0;
 updated[index].subtotal = 0;
 }
 setItems(updated);
 };

 const updateItemCantidad = (index: number, cantidad: number) => {
 const updated = [...items];
 updated[index].cantidadNca = Math.min(cantidad, updated[index].cantidadOriginal);
 updated[index].subtotal = updated[index].cantidadNca * updated[index].precioUnitario;
 setItems(updated);
 };

 const selectAll = () => {
 const updated = items.map(item => ({
 ...item,
 selected: true,
 cantidadNca: item.cantidadOriginal,
 subtotal: item.cantidadOriginal * item.precioUnitario,
 }));
 setItems(updated);
 };

 const deselectAll = () => {
 const updated = items.map(item => ({
 ...item,
 selected: false,
 cantidadNca: 0,
 subtotal: 0,
 }));
 setItems(updated);
 };

 // Get selected devolucion
 const selectedDevolucion = devolucionesDisponibles.find(d => d.id.toString() === selectedDevolucionId);

 // Calculate total
 const calculateTotal = () => {
 const isDescuento = formData.tipoNca === 'NCA_DESCUENTO' || formData.tipoNca === 'NC_DESCUENTO';
 const isDevolucionTipo = formData.tipoNca === 'NCA_DEVOLUCION' || formData.tipoNca === 'NC_DEVOLUCION';

 if (isDescuento) {
 if (formData.montoFijo) {
 return parseFloat(formData.montoFijo) || 0;
 }
 if (formData.porcentajeDescuento) {
 const pct = parseFloat(formData.porcentajeDescuento) || 0;
 return totalFactura * (pct / 100);
 }
 return 0;
 }

 // For devolucion with selected devolucion, calculate from devolucion items
 if (isDevolucionTipo && selectedDevolucion) {
 return selectedDevolucion.items.reduce((sum, item) => {
 return sum + ((item.precioReferencia || 0) * item.cantidad);
 }, 0);
 }

 // For other types, sum selected items
 return items.filter(i => i.selected).reduce((sum, i) => sum + i.subtotal, 0);
 };

 const total = calculateTotal();
 const selectedCount = items.filter(i => i.selected).length;
 const isDescuento = formData.tipoNca === 'NCA_DESCUENTO' || formData.tipoNca === 'NC_DESCUENTO';
 const isDevolucion = formData.tipoNca === 'NCA_DEVOLUCION' || formData.tipoNca === 'NC_DEVOLUCION';
 // Don't show items table for descuento or when devolucion is selected (items come from devolucion)
 const showItemsTable = !isDescuento && !isDevolucion;

 const handleSubmit = async () => {
 // Validate required fields
 if (!formData.numeroSerie || !formData.numeroFactura) {
 toast.error(`El número de ${docLabel} es obligatorio`);
 return;
 }

 if (!formData.tipoNca || !formData.motivo) {
 toast.error(`Complete el tipo y motivo de la ${docLabel}`);
 return;
 }

 if (total <= 0) {
 toast.error(`El monto de la ${docLabel} debe ser mayor a cero`);
 return;
 }

 // For devolucion type, require a selected devolucion
 if (isDevolucion) {
 if (!selectedDevolucion) {
 toast.error(`Seleccione una devolución existente o cree una nueva primero`);
 return;
 }
 } else if (showItemsTable && selectedCount === 0) {
 toast.error('Seleccione al menos un item');
 return;
 }

 try {
 setLoading(true);

 // Combine numeroSerie and numeroFactura
 const numeroCompleto = `${formData.numeroSerie}-${formData.numeroFactura}`;

 const payload: any = {
 tipo: 'NOTA_CREDITO',
 tipoNca: formData.tipoNca,
 numeroSerie: numeroCompleto,
 proveedorId,
 facturaId,
 motivo: formData.motivo,
 fechaEmision: new Date().toISOString().split('T')[0],
 neto: total,
 iva21: total * 0.21,
 total: total * 1.21,
 items: [],
 // Incluir docType para seguridad T1/T2
 docType: facturaDocType,
 };

 // If creating NCA from devolucion, add purchaseReturnId and use devolucion items
 if (isDevolucion && selectedDevolucion) {
 payload.purchaseReturnId = selectedDevolucion.id;
 payload.items = selectedDevolucion.items.map(item => ({
 itemId: item.supplierItemId,
 descripcion: item.descripcion,
 cantidad: item.cantidad,
 unidad: item.unidad,
 precioUnitario: item.precioReferencia || 0,
 subtotal: (item.precioReferencia || 0) * item.cantidad,
 }));
 } else if (showItemsTable) {
 // Add items based on type
 payload.items = items
 .filter(i => i.selected && i.cantidadNca > 0)
 .map(i => ({
 itemId: i.itemId,
 descripcion: i.descripcion,
 cantidad: i.cantidadNca,
 unidad: i.unidad,
 precioUnitario: i.precioUnitario,
 subtotal: i.subtotal,
 }));
 } else {
 // For discount, create a single item
 payload.items = [{
 descripcion: `Descuento ${formData.porcentajeDescuento ? formData.porcentajeDescuento + '%' : ''} - ${formData.motivo}`,
 cantidad: 1,
 unidad: 'UN',
 precioUnitario: total,
 subtotal: total,
 }];
 }

 const response = await fetch('/api/compras/notas-credito-debito', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(payload),
 });

 if (!response.ok) {
 const error = await response.json();
 throw new Error(error.error || `Error al crear ${docLabel}`);
 }

 // La NCA se crea y aplica automáticamente en el backend
 toast.success(`${docLabel} creada y aplicada correctamente`);
 onSuccess();
 onClose();
 } catch (error: any) {
 toast.error(error.message || `Error al crear ${docLabel}`);
 } finally {
 setLoading(false);
 }
 };

 const formatCurrency = (amount: number) => {
 return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
 };

 return (
 <Dialog open={open} onOpenChange={onClose}>
 <DialogContent size="full">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <FileText className="h-5 w-5" />
 Nueva {docLabelFull} desde {isT2 ? 'PPT' : 'Factura'} {facturaNumero}
 </DialogTitle>
 </DialogHeader>

 <DialogBody className="space-y-4">
 {/* Info del documento origen */}
 <div className={cn('p-3 border rounded-lg', isT2 ? 'bg-purple-50 border-purple-200' : 'bg-info-muted border border-info-muted')}>
 <div className="flex items-center gap-2 mb-2">
 {isT2 && (
 <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
 T2 - Extendido
 </Badge>
 )}
 </div>
 <div className="grid grid-cols-2 gap-4 text-sm">
 <div>
 <span className="text-muted-foreground">Proveedor: </span>
 <span className="font-medium">{proveedorNombre}</span>
 </div>
 <div>
 <span className="text-muted-foreground">{isT2 ? 'PPT' : 'Factura'}: </span>
 <span className="font-medium">{facturaNumero}</span>
 </div>
 <div>
 <span className="text-muted-foreground">Total {isT2 ? 'PPT' : 'Factura'}: </span>
 <span className="font-medium">{formatCurrency(totalFactura)}</span>
 </div>
 </div>
 </div>

 {/* Tipo de NC/NCA */}
 <div className="space-y-2">
 <Label>Tipo de {docLabel} *</Label>
 <Select
 value={formData.tipoNca}
 onValueChange={(value) => setFormData({ ...formData, tipoNca: value, porcentajeDescuento: '', montoFijo: '' })}
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {tiposNca.map((opt) => (
 <SelectItem key={opt.value} value={opt.value}>
 {opt.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 {/* Sección para devolución */}
 {isDevolucion && (
 <div className="space-y-4">
 {/* Devoluciones existentes sin NCA */}
 {loadingDevoluciones ? (
 <div className="p-4 border rounded-lg flex items-center gap-2 text-muted-foreground">
 <Loader2 className="h-4 w-4 animate-spin" />
 Buscando devoluciones disponibles...
 </div>
 ) : devolucionesDisponibles.length > 0 ? (
 <div className="p-4 border rounded-lg bg-success-muted border-success-muted ">
 <div className="flex items-center gap-2 mb-3">
 <Package className="h-4 w-4 text-success" />
 <span className="text-sm font-medium text-success-muted-foreground ">
 Seleccionar devolución existente
 </span>
 <Badge variant="outline" className="text-success border-success-muted">
 {devolucionesDisponibles.length} disponible{devolucionesDisponibles.length !== 1 ? 's' : ''}
 </Badge>
 </div>
 <Select
 value={selectedDevolucionId}
 onValueChange={setSelectedDevolucionId}
 >
 <SelectTrigger className="bg-background">
 <SelectValue placeholder="Seleccione una devolución..." />
 </SelectTrigger>
 <SelectContent>
 {devolucionesDisponibles.map((dev) => (
 <SelectItem key={dev.id} value={dev.id.toString()}>
 <div className="flex items-center gap-2">
 <span className="font-medium">{dev.numero}</span>
 <span className="text-xs text-muted-foreground">
 - {dev.tipo} - {dev.items.length} items
 </span>
 </div>
 </SelectItem>
 ))}
 </SelectContent>
 </Select>

 {/* Mostrar items de la devolución seleccionada */}
 {selectedDevolucion && (
 <div className="mt-3 pt-3 border-t border-success-muted ">
 <div className="flex items-center gap-2 mb-2">
 <Check className="h-4 w-4 text-success" />
 <span className="text-sm font-medium">Devolución {selectedDevolucion.numero}</span>
 </div>
 <p className="text-xs text-muted-foreground mb-2">{selectedDevolucion.motivo}</p>
 <div className="max-h-32 overflow-y-auto space-y-1">
 {selectedDevolucion.items.map((item, idx) => (
 <div key={idx} className="flex justify-between text-xs bg-background/50 p-1.5 rounded">
 <span className="truncate flex-1">{item.descripcion}</span>
 <span className="text-muted-foreground ml-2">{item.cantidad} {item.unidad}</span>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 ) : null}

 {/* Opción de crear nueva devolución */}
 {!selectedDevolucionId && (
 <div className="p-4 bg-warning-muted border border-warning-muted rounded-lg">
 <div className="flex items-start gap-3">
 <AlertTriangle className="h-5 w-5 text-warning-muted-foreground flex-shrink-0 mt-0.5" />
 <div className="space-y-2">
 <p className="text-sm font-medium text-warning-muted-foreground ">
 {devolucionesDisponibles.length > 0
 ? 'O crear una nueva devolución'
 : `${docLabel} por Devolución requiere una Devolución física`}
 </p>
 {!ingresoConfirmado ? (
 <p className="text-sm text-warning-muted-foreground ">
 {isT2 ? 'Este PPT' : 'Esta factura'} no tiene ingreso de stock confirmado. No es posible crear una devolución.
 </p>
 ) : (
 <>
 <p className="text-sm text-warning-muted-foreground ">
 {devolucionesDisponibles.length > 0
 ? 'Si necesita devolver otros items, primero cree una nueva devolución.'
 : `Para crear una ${docLabel} por devolución, primero debe crear una Devolución de mercadería.`}
 </p>
 {onCrearDevolucion && (
 <Button
 type="button"
 variant="outline"
 size="sm"
 className="mt-2 border-warning-muted text-warning-muted-foreground hover:bg-warning-muted"
 onClick={() => {
 onClose();
 onCrearDevolucion();
 }}
 >
 Crear Devolución Primero
 </Button>
 )}
 </>
 )}
 </div>
 </div>
 </div>
 )}
 </div>
 )}

 {/* Número de Serie y Número de Factura */}
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="numeroSerie">Número de Serie *</Label>
 <Input
 ref={numeroSerieRef}
 id="numeroSerie"
 value={formData.numeroSerie}
 onChange={(e) => {
 const value = e.target.value.replace(/\D/g, '');
 setFormData({ ...formData, numeroSerie: value });
 }}
 onBlur={handleNumeroSerieBlur}
 onKeyDown={handleNumeroSerieKeyDown}
 placeholder="00001"
 required
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="numeroFactura">Número de Factura *</Label>
 <Input
 ref={numeroFacturaRef}
 id="numeroFactura"
 value={formData.numeroFactura}
 onChange={(e) => {
 const value = e.target.value.replace(/\D/g, '');
 setFormData({ ...formData, numeroFactura: value });
 }}
 onBlur={handleNumeroFacturaBlur}
 onKeyDown={handleNumeroFacturaKeyDown}
 placeholder="00001234"
 required
 />
 </div>
 </div>

 {/* Motivo */}
 <div className="space-y-2">
 <Label>Motivo *</Label>
 <Textarea
 ref={motivoRef}
 id="motivo"
 value={formData.motivo}
 onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
 placeholder="Describa el motivo de la nota de credito..."
 rows={2}
 onKeyDown={(e) => {
 if (e.key === 'Enter' && !e.shiftKey) {
 e.preventDefault();
 moveToNextField('motivo');
 }
 }}
 />
 </div>

 {/* Campos para descuento */}
 {isDescuento && (
 <div className="p-4 bg-muted/50 rounded-lg space-y-4">
 <div className="flex items-center gap-2 text-sm text-muted-foreground">
 <Calculator className="h-4 w-4" />
 Calcular descuento
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label>Porcentaje de descuento</Label>
 <div className="relative">
 <Input
 ref={porcentajeRef}
 id="porcentaje"
 type="number"
 min="0"
 max="100"
 step="0.01"
 value={formData.porcentajeDescuento}
 onChange={(e) => setFormData({ ...formData, porcentajeDescuento: e.target.value, montoFijo: '' })}
 placeholder="Ej: 5"
 disabled={!!formData.montoFijo}
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 }
 }}
 />
 <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
 </div>
 </div>
 <div className="space-y-2">
 <Label>O monto fijo</Label>
 <div className="relative">
 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
 <Input
 ref={montoFijoRef}
 id="montoFijo"
 type="number"
 min="0"
 step="0.01"
 value={formData.montoFijo}
 onChange={(e) => setFormData({ ...formData, montoFijo: e.target.value, porcentajeDescuento: '' })}
 placeholder="Ej: 1500"
 disabled={!!formData.porcentajeDescuento}
 className="pl-7"
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 }
 }}
 />
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Items para otros tipos de NCA */}
 {showItemsTable && (
 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <Label>Items afectados ({selectedCount} seleccionados)</Label>
 <div className="flex gap-2">
 <Button type="button" variant="outline" size="sm" onClick={selectAll}>
 Seleccionar todos
 </Button>
 <Button type="button" variant="ghost" size="sm" onClick={deselectAll}>
 Deseleccionar
 </Button>
 </div>
 </div>

 {items.length === 0 ? (
 <div className="p-4 text-center text-muted-foreground border rounded-lg">
 <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
 <p>No hay items en la factura</p>
 </div>
 ) : (
 <div className="border rounded-lg overflow-hidden">
 <Table>
 <TableHeader>
 <TableRow className="bg-muted/30">
 <TableHead className="w-10"></TableHead>
 <TableHead>Producto</TableHead>
 <TableHead className="text-center w-20">Cant. Orig.</TableHead>
 <TableHead className="text-center w-28">Cant. {docLabel}</TableHead>
 <TableHead className="text-right w-24">Precio</TableHead>
 <TableHead className="text-right w-28">Subtotal</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {items.map((item, index) => (
 <TableRow key={item.sourceItemId} className={item.selected ? 'bg-primary/5' : ''}>
 <TableCell>
 <Checkbox
 checked={item.selected}
 onCheckedChange={() => toggleItemSelection(index)}
 />
 </TableCell>
 <TableCell>
 <p className="font-medium text-sm">{item.descripcion}</p>
 <p className="text-xs text-muted-foreground">{item.unidad}</p>
 </TableCell>
 <TableCell className="text-center">
 <Badge variant="outline">{item.cantidadOriginal}</Badge>
 </TableCell>
 <TableCell>
 <Input
 type="number"
 min="0"
 max={item.cantidadOriginal}
 step="0.01"
 value={item.cantidadNca || ''}
 onChange={(e) => updateItemCantidad(index, parseFloat(e.target.value) || 0)}
 disabled={!item.selected}
 className="w-24 text-center"
 />
 </TableCell>
 <TableCell className="text-right text-sm">
 {formatCurrency(item.precioUnitario)}
 </TableCell>
 <TableCell className="text-right font-medium">
 {item.selected && item.subtotal > 0 ? formatCurrency(item.subtotal) : '-'}
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 )}
 </div>
 )}

 {/* Total */}
 <div className={cn('flex items-center justify-between p-4 rounded-lg', isT2 ? 'bg-purple-50' : 'bg-primary/5')}>
 <span className="font-medium">Total {docLabel} (Neto)</span>
 <span className="text-xl font-bold">{formatCurrency(total)}</span>
 </div>
 <p className="text-xs text-muted-foreground text-right">
 + IVA 21%: {formatCurrency(total * 0.21)} = Total con IVA: {formatCurrency(total * 1.21)}
 </p>
 </DialogBody>

 <DialogFooter>
 <Button variant="outline" onClick={onClose} disabled={loading}>
 Cancelar
 </Button>
 <Button
 onClick={handleSubmit}
 disabled={loading || total <= 0}
 className={isT2 ? 'bg-purple-600 hover:bg-purple-700' : ''}
 >
 {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
 Crear {docLabel}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
}
