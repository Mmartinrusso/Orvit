'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
 Check,
 ChevronsUpDown,
 FileText,
 Loader2,
 Building2,
 Upload,
 File,
 X,
 Plus,
 Trash2,
 FileUp,
 PenLine,
 Sparkles,
 Image as ImageIcon,
 AlertCircle,
 CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';

interface Proveedor {
 id: number;
 name: string;
 cuit?: string;
}

interface RequestItem {
 id: number;
 descripcion: string;
 cantidad: number;
 unidad: string;
 especificaciones?: string;
}

interface CotizacionItem {
 id?: string;
 requestItemId?: number;
 supplierItemId?: number;
 codigoPropio?: string;
 codigoProveedor?: string;
 descripcion: string;
 cantidad: number;
 unidad: string;
 precioUnitario: number;
 descuento: number;
 subtotal: number;
}

interface CotizacionFormModalProps {
 open: boolean;
 onClose: () => void;
 requestId: number;
 requestItems: RequestItem[];
 cotizacionId?: number;
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
 { value: '21', label: '21%' },
 { value: '10.5', label: '10.5%' },
 { value: '0', label: 'Exento' },
];

const UNIDADES = ['UN', 'KG', 'L', 'M', 'M2', 'M3', 'CAJA', 'BOLSA', 'PALLET'];

export function CotizacionFormModal({
 open,
 onClose,
 requestId,
 requestItems,
 cotizacionId,
 onSuccess,
}: CotizacionFormModalProps) {
 const [mode, setMode] = useState<'select' | 'ai' | 'manual'>('select');
 const [supplierId, setSupplierId] = useState<number | null>(null);
 const [fechaCotizacion, setFechaCotizacion] = useState(
 new Date().toISOString().split('T')[0]
 );
 const [validezHasta, setValidezHasta] = useState('');
 const [plazoEntrega, setPlazoEntrega] = useState('');
 const [condicionesPago, setCondicionesPago] = useState('Contado');
 const [formaPago, setFormaPago] = useState('');
 const [garantia, setGarantia] = useState('');
 const [tasaIva, setTasaIva] = useState('21');
 const [totalManual, setTotalManual] = useState('');
 const [beneficios, setBeneficios] = useState('');
 const [observaciones, setObservaciones] = useState('');
 const [items, setItems] = useState<CotizacionItem[]>([]);

 const [pdfFile, setPdfFile] = useState<File | null>(null);
 const [imageFile, setImageFile] = useState<File | null>(null);
 const [uploading, setUploading] = useState(false);
 const [processingAI, setProcessingAI] = useState(false);
 const [aiExtraction, setAiExtraction] = useState<any>(null);
 const [aiConfidence, setAiConfidence] = useState<number>(0);
 const [aiWarnings, setAiWarnings] = useState<string[]>([]);
 const fileInputRef = useRef<HTMLInputElement>(null);
 const imageInputRef = useRef<HTMLInputElement>(null);

 const [proveedores, setProveedores] = useState<Proveedor[]>([]);
 const [loadingProveedores, setLoadingProveedores] = useState(false);
 const [submitting, setSubmitting] = useState(false);
 const [proveedorOpen, setProveedorOpen] = useState(false);

 useEffect(() => {
 if (open) {
 loadProveedores();
 }
 }, [open]);

 useEffect(() => {
 if (open && !cotizacionId) {
 resetForm();
 }
 }, [open, cotizacionId]);

 // Cargar cotización existente para editar
 useEffect(() => {
 if (open && cotizacionId) {
 loadCotizacion(cotizacionId);
 }
 }, [open, cotizacionId]);

 const loadCotizacion = async (id: number) => {
 try {
 const response = await fetch(`/api/compras/cotizaciones/${id}`);
 if (response.ok) {
 const data = await response.json();
 // Cargar datos en el formulario
 setSupplierId(data.supplierId);
 setFechaCotizacion(data.fechaCotizacion?.split('T')[0] || '');
 setValidezHasta(data.validezHasta?.split('T')[0] || '');
 setPlazoEntrega(data.plazoEntrega?.toString() || '');
 setCondicionesPago(data.condicionesPago || 'Contado');
 setFormaPago(data.formaPago || '');
 setGarantia(data.garantia || '');
 setBeneficios(data.beneficios || '');
 setObservaciones(data.observaciones || '');

 // Cargar items
 if (data.items && data.items.length > 0) {
 setItems(data.items.map((item: any) => {
 const cantidad = parseFloat(item.cantidad) || 1;
 const precioUnitario = parseFloat(item.precioUnitario) || 0;
 // Asegurar que subtotal sea un número, no un string
 const subtotal = Number(item.subtotal) || (cantidad * precioUnitario);
 return {
 id: item.id,
 descripcion: item.descripcion,
 cantidad: cantidad.toString(),
 unidad: item.unidad || 'UN',
 precioUnitario: precioUnitario.toString(),
 codigoProveedor: item.codigoProveedor || item.supplierItem?.codigoProveedor || '',
 supplierItemId: item.supplierItemId,
 requestItemId: item.requestItemId,
 subtotal: subtotal,
 };
 }));
 }

 setMode('manual');
 }
 } catch (error) {
 console.error('Error loading cotización:', error);
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

 const resetForm = () => {
 setMode('select');
 setSupplierId(null);
 setFechaCotizacion(new Date().toISOString().split('T')[0]);
 setValidezHasta('');
 setPlazoEntrega('');
 setCondicionesPago('Contado');
 setFormaPago('');
 setGarantia('');
 setTasaIva('21');
 setTotalManual('');
 setBeneficios('');
 setObservaciones('');
 setItems([]);
 setPdfFile(null);
 setImageFile(null);
 setAiExtraction(null);
 setAiConfidence(0);
 setAiWarnings([]);
 };

 // Procesar imagen con IA
 const processImageWithAI = async (file: File) => {
 setProcessingAI(true);
 setAiWarnings([]);

 try {
 const formData = new FormData();
 formData.append('file', file);
 formData.append('requestId', requestId.toString());

 const response = await fetch('/api/compras/cotizaciones/procesar-ia', {
 method: 'POST',
 body: formData,
 });

 if (!response.ok) {
 const error = await response.json();
 throw new Error(error.error || 'Error al procesar la imagen');
 }

 const result = await response.json();

 if (result.success && result.extraction) {
 setAiExtraction(result.extraction);
 setAiConfidence(result.confidence || 0.8);
 setAiWarnings(result.warnings || []);

 // Pre-llenar el formulario con los datos extraídos
 if (result.extraction.fecha_emision) {
 setFechaCotizacion(result.extraction.fecha_emision);
 }
 if (result.extraction.condiciones_pago) {
 const condMatch = CONDICIONES_PAGO.find(c =>
 result.extraction.condiciones_pago.toLowerCase().includes(c.toLowerCase())
 );
 if (condMatch) setCondicionesPago(condMatch);
 }
 if (result.extraction.plazo_entrega_dias) {
 setPlazoEntrega(result.extraction.plazo_entrega_dias.toString());
 }
 if (result.extraction.validez_dias) {
 const validezDate = new Date();
 validezDate.setDate(validezDate.getDate() + result.extraction.validez_dias);
 setValidezHasta(validezDate.toISOString().split('T')[0]);
 }
 if (result.extraction.observaciones) {
 setObservaciones(result.extraction.observaciones);
 }

 // Si se encontró el proveedor, seleccionarlo
 if (result.matchedSupplier?.matched) {
 setSupplierId(result.matchedSupplier.id);
 }

 // Cargar items extraídos
 if (result.extraction.items && result.extraction.items.length > 0) {
 const extractedItems: CotizacionItem[] = result.extraction.items.map((item: any, idx: number) => ({
 id: `ai-${idx}`,
 codigoPropio: '',
 codigoProveedor: item.codigo || '',
 descripcion: item.descripcion || '',
 cantidad: item.cantidad || 1,
 unidad: item.unidad || 'UN',
 precioUnitario: item.precioUnitario || 0,
 descuento: item.descuento || 0,
 subtotal: item.subtotal || (item.cantidad * item.precioUnitario),
 }));
 setItems(extractedItems);
 }

 // Cambiar a modo manual para edición
 setMode('manual');
 toast.success('Datos extraídos correctamente. Revisá y editá si es necesario.');
 } else {
 throw new Error('No se pudieron extraer datos de la imagen');
 }
 } catch (error: any) {
 console.error('Error processing image with AI:', error);
 toast.error(error.message || 'Error al procesar la imagen con IA');
 setMode('select');
 } finally {
 setProcessingAI(false);
 }
 };

 // Handle image selection for AI processing
 const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (file) {
 const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
 if (!allowedTypes.includes(file.type)) {
 toast.error('Solo se permiten imágenes (JPG, PNG, WebP, GIF)');
 return;
 }
 if (file.size > 10 * 1024 * 1024) {
 toast.error('La imagen no puede superar 10MB');
 return;
 }
 setImageFile(file);
 setMode('ai');
 processImageWithAI(file);
 }
 };

 const totales = useMemo(() => {
 // Asegurar que subtotal sea siempre un número (evita concatenación de strings)
 const subtotal = items.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
 const tasaIvaNum = parseFloat(tasaIva) || 0;
 const impuestos = subtotal * (tasaIvaNum / 100);
 const total = subtotal + impuestos;
 return { subtotal, impuestos, total };
 }, [items, tasaIva]);

 const addItem = useCallback(() => {
 const newItem: CotizacionItem = {
 id: `temp-${Date.now()}`,
 codigoPropio: '',
 codigoProveedor: '',
 descripcion: '',
 cantidad: 1,
 unidad: 'UN',
 precioUnitario: 0,
 descuento: 0,
 subtotal: 0,
 };
 setItems((prev) => [...prev, newItem]);
 }, []);

 const removeItem = useCallback((itemId: string) => {
 setItems((prev) => prev.filter((item) => item.id !== itemId));
 }, []);

 const updateItem = useCallback(
 (itemId: string, field: keyof CotizacionItem, value: any) => {
 setItems((prev) =>
 prev.map((item) => {
 if (item.id !== itemId) return item;

 const updated = { ...item, [field]: value };

 if (
 field === 'cantidad' ||
 field === 'precioUnitario' ||
 field === 'descuento'
 ) {
 const cantidad = field === 'cantidad' ? value : updated.cantidad;
 const precio =
 field === 'precioUnitario' ? value : updated.precioUnitario;
 const descuento = field === 'descuento' ? value : updated.descuento;
 updated.subtotal = cantidad * precio * (1 - descuento / 100);
 }

 return updated;
 })
 );
 },
 []
 );

 const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (file) {
 if (file.type !== 'application/pdf') {
 toast.error('Solo se permiten archivos PDF');
 return;
 }
 if (file.size > 10 * 1024 * 1024) {
 toast.error('El archivo no puede superar 10MB');
 return;
 }
 setPdfFile(file);
 }
 };

 const uploadPdf = async (): Promise<string | null> => {
 if (!pdfFile) return null;

 setUploading(true);
 try {
 const formData = new FormData();
 formData.append('file', pdfFile);
 formData.append('entityType', 'cotizaciones');
 formData.append('fileType', 'documento');
 formData.append('entityId', requestId.toString());

 const response = await fetch('/api/upload', {
 method: 'POST',
 body: formData,
 });

 if (response.ok) {
 const data = await response.json();
 return data.url;
 } else {
 const error = await response.json();
 toast.error(error.error || 'Error al subir el archivo');
 return null;
 }
 } catch (error) {
 console.error('Error uploading PDF:', error);
 toast.error('Error al subir el archivo');
 return null;
 } finally {
 setUploading(false);
 }
 };

 const validateForm = (): boolean => {
 if (!supplierId) {
 toast.error('Seleccione un proveedor');
 return false;
 }
 if (!fechaCotizacion) {
 toast.error('Ingrese la fecha de cotización');
 return false;
 }

 if (items.length === 0 || items.every((item) => item.precioUnitario <= 0)) {
 toast.error('Agregue al menos un item con precio');
 return false;
 }
 return true;
 };

 const handleSubmit = async () => {
 if (!validateForm()) return;

 setSubmitting(true);
 try {
 let pdfUrl: string | null = null;
 if (pdfFile) {
 pdfUrl = await uploadPdf();
 }

 const payload = {
 requestId,
 supplierId,
 fechaCotizacion,
 validezHasta: validezHasta || null,
 plazoEntrega: plazoEntrega ? parseInt(plazoEntrega) : null,
 condicionesPago,
 formaPago: formaPago || null,
 garantia: garantia || null,
 beneficios: beneficios || null,
 observaciones: observaciones || null,
 adjuntos: pdfUrl ? [pdfUrl] : [],
 items: items
 .filter((item) => item.precioUnitario > 0)
 .map((item) => ({
 requestItemId: item.requestItemId,
 supplierItemId: item.supplierItemId,
 codigoPropio: item.codigoPropio,
 codigoProveedor: item.codigoProveedor,
 descripcion: item.descripcion,
 cantidad: item.cantidad,
 unidad: item.unidad,
 precioUnitario: item.precioUnitario,
 descuento: item.descuento,
 })),
 };

 const url = cotizacionId
 ? `/api/compras/cotizaciones/${cotizacionId}`
 : '/api/compras/cotizaciones';

 const response = await fetch(url, {
 method: cotizacionId ? 'PUT' : 'POST',
 headers: { 'Content-Type': 'application/json' },
 credentials: 'include',
 body: JSON.stringify(payload),
 });

 if (response.ok) {
 const data = await response.json();
 toast.success(
 cotizacionId
 ? 'Cotización actualizada'
 : `Cotización ${data.numero} creada`
 );
 onClose();
 onSuccess?.();
 } else {
 const error = await response.json();
 toast.error(error.error || 'Error al guardar la cotización');
 }
 } catch (error) {
 console.error('Error saving cotización:', error);
 toast.error('Error al guardar la cotización');
 } finally {
 setSubmitting(false);
 }
 };

 const proveedorSeleccionado = proveedores.find((p) => p.id === supplierId);

 return (
 <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
 <DialogContent size="full" className="p-0 gap-0">
 <DialogHeader>
 <DialogTitle className="text-base font-semibold flex items-center gap-2">
 <FileText className="w-5 h-5" />
 {cotizacionId ? 'Editar Cotización' : 'Nueva Cotización'}
 </DialogTitle>
 </DialogHeader>

 <DialogBody className="space-y-4">
 {/* Proveedor y Fecha */}
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label className="text-sm font-medium">Proveedor *</Label>
 <Popover open={proveedorOpen} onOpenChange={setProveedorOpen}>
 <PopoverTrigger asChild>
 <Button
 variant="outline"
 role="combobox"
 aria-expanded={proveedorOpen}
 className="w-full justify-between h-9 text-sm"
 disabled={loadingProveedores}
 >
 {proveedorSeleccionado ? (
 <span className="flex items-center gap-2 truncate">
 <Building2 className="w-4 h-4 text-muted-foreground" />
 {proveedorSeleccionado.name}
 </span>
 ) : (
 <span className="text-muted-foreground">
 Seleccionar proveedor...
 </span>
 )}
 <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-[400px] p-0" align="start">
 <Command>
 <CommandInput placeholder="Buscar proveedor..." className="h-9" />
 <CommandList>
 <CommandEmpty>No se encontraron proveedores</CommandEmpty>
 <CommandGroup>
 {proveedores.map((prov) => (
 <CommandItem
 key={prov.id}
 value={prov.name}
 onSelect={() => {
 setSupplierId(prov.id);
 setProveedorOpen(false);
 }}
 className="py-2"
 >
 <Check
 className={cn(
 'mr-2 h-4 w-4',
 supplierId === prov.id
 ? 'opacity-100'
 : 'opacity-0'
 )}
 />
 <div className="flex flex-col">
 <span className="text-sm">{prov.name}</span>
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

 <div className="space-y-2">
 <Label className="text-sm font-medium">Fecha del Presupuesto *</Label>
 <DatePicker
 value={fechaCotizacion}
 onChange={(date) => setFechaCotizacion(date)}
 placeholder="Fecha del presupuesto"
 className="h-9"
 />
 </div>
 </div>

 {/* Inputs de archivo ocultos - siempre disponibles */}
 <input
 type="file"
 ref={imageInputRef}
 accept="image/jpeg,image/png,image/webp,image/gif"
 onChange={handleImageSelect}
 className="hidden"
 />
 <input
 type="file"
 ref={fileInputRef}
 accept=".pdf"
 onChange={handleFileSelect}
 className="hidden"
 />

 {/* Selector de modo inicial */}
 {mode === 'select' && (
 <div className="space-y-4">
 <p className="text-sm text-muted-foreground text-center">
 ¿Cómo querés cargar la cotización?
 </p>

 <div className="grid grid-cols-2 gap-4">
 {/* Opción IA */}
 <Card
 className="p-6 cursor-pointer hover:bg-primary/5 hover:border-primary/50 transition-all group"
 onClick={() => imageInputRef.current?.click()}
 >
 <div className="flex flex-col items-center gap-3 text-center">
 <div className="p-3 bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-full group-hover:scale-110 transition-transform">
 <Sparkles className="w-8 h-8 text-violet-600" />
 </div>
 <div>
 <p className="font-semibold text-base">Subir Imagen</p>
 <p className="text-xs text-muted-foreground mt-1">
 La IA extrae los datos automáticamente
 </p>
 </div>
 <Badge variant="secondary" className="text-xs">
 <ImageIcon className="w-3 h-3 mr-1" />
 JPG, PNG, WebP
 </Badge>
 </div>
 </Card>

 {/* Opción Manual */}
 <Card
 className="p-6 cursor-pointer hover:bg-muted/50 hover:border-muted-foreground/30 transition-all group"
 onClick={() => setMode('manual')}
 >
 <div className="flex flex-col items-center gap-3 text-center">
 <div className="p-3 bg-muted rounded-full group-hover:scale-110 transition-transform">
 <PenLine className="w-8 h-8 text-muted-foreground" />
 </div>
 <div>
 <p className="font-semibold text-base">Cargar Manual</p>
 <p className="text-xs text-muted-foreground mt-1">
 Completar el formulario manualmente
 </p>
 </div>
 <Badge variant="outline" className="text-xs">
 Tradicional
 </Badge>
 </div>
 </Card>
 </div>
 </div>
 )}

 {/* Procesando con IA */}
 {mode === 'ai' && processingAI && (
 <div className="flex flex-col items-center justify-center py-12 gap-4">
 <div className="relative">
 <div className="h-16 w-16 rounded-full border-4 border-violet-200 border-t-violet-600 animate-spin" />
 <Sparkles className="h-6 w-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-violet-600" />
 </div>
 <div className="text-center">
 <p className="font-medium">Procesando con IA...</p>
 <p className="text-sm text-muted-foreground">Extrayendo datos de la cotización</p>
 </div>
 {imageFile && (
 <div className="flex items-center gap-2 text-xs text-muted-foreground">
 <ImageIcon className="w-4 h-4" />
 {imageFile.name}
 </div>
 )}
 </div>
 )}

 {/* Modo Manual (también después de AI) */}
 {mode === 'manual' && (
 <>
 {/* Banner de extracción IA si aplica */}
 {aiExtraction && (
 <Card className={cn(
 "p-3 mb-4",
 aiConfidence >= 0.8 ? "bg-success-muted border-success-muted" : "bg-warning-muted border-warning-muted"
 )}>
 <div className="flex items-start gap-3">
 {aiConfidence >= 0.8 ? (
 <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
 ) : (
 <AlertCircle className="w-5 h-5 text-warning-muted-foreground shrink-0 mt-0.5" />
 )}
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium">
 Datos extraídos con IA ({Math.round(aiConfidence * 100)}% confianza)
 </p>
 <p className="text-xs text-muted-foreground">
 Revisá y corregí lo que sea necesario antes de guardar
 </p>
 {aiWarnings.length > 0 && (
 <ul className="mt-2 text-xs text-warning-muted-foreground space-y-1">
 {aiWarnings.map((w, i) => (
 <li key={i}>• {w}</li>
 ))}
 </ul>
 )}
 </div>
 <Button
 variant="ghost"
 size="sm"
 className="h-7 text-xs"
 onClick={() => {
 setMode('select');
 setAiExtraction(null);
 setItems([]);
 }}
 >
 Volver
 </Button>
 </div>
 </Card>
 )}

 {/* Tabs para cambiar entre subir PDF y detalle manual */}
 <Tabs defaultValue="items" className="w-full">
 <TabsList className="grid w-full grid-cols-2 h-9">
 <TabsTrigger value="items" className="text-xs gap-2">
 <FileText className="w-4 h-4" />
 Items Cotizados
 </TabsTrigger>
 <TabsTrigger value="condiciones" className="text-xs gap-2">
 <FileUp className="w-4 h-4" />
 Condiciones + PDF
 </TabsTrigger>
 </TabsList>

 <TabsContent value="items" className="space-y-4 mt-4">
 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <Label className="text-sm font-medium">Items Cotizados</Label>
 <Button variant="outline" className="h-8 px-3 text-sm" onClick={addItem}>
 <Plus className="w-4 h-4 mr-1" />
 Agregar
 </Button>
 </div>

 {items.length === 0 ? (
 <Card
 className="p-6 border-dashed cursor-pointer hover:bg-muted/30 transition-colors"
 onClick={addItem}
 >
 <div className="flex flex-col items-center gap-2 text-muted-foreground">
 <Plus className="w-6 h-6" />
 <p className="text-sm">Haz clic para agregar items</p>
 </div>
 </Card>
 ) : (
 <div className="border rounded-lg overflow-x-auto">
 <Table className="min-w-[1000px]">
 <TableHeader>
 <TableRow className="bg-muted/50">
 <TableHead className="text-xs font-medium w-[140px]">Cód. Prov.</TableHead>
 <TableHead className="text-xs font-medium min-w-[300px]">Item / Descripción</TableHead>
 <TableHead className="text-xs font-medium w-[100px] text-center">Cant.</TableHead>
 <TableHead className="text-xs font-medium w-[100px]">Unidad</TableHead>
 <TableHead className="text-xs font-medium w-[140px] text-right">P. Unit.</TableHead>
 <TableHead className="text-xs font-medium w-[130px] text-right">Subtotal</TableHead>
 <TableHead className="text-xs font-medium w-[50px]"></TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {items.map((item) => (
 <TableRow key={item.id}>
 <TableCell>
 <Input
 placeholder="Código"
 value={item.codigoProveedor || ''}
 onChange={(e) =>
 updateItem(item.id!, 'codigoProveedor', e.target.value)
 }
 className="h-8 text-xs"
 />
 </TableCell>
 <TableCell>
 <Input
 placeholder="Descripción del item..."
 value={item.descripcion}
 onChange={(e) =>
 updateItem(item.id!, 'descripcion', e.target.value)
 }
 className="h-8 text-sm"
 />
 </TableCell>
 <TableCell>
 <Input
 type="number"
 value={item.cantidad}
 onChange={(e) =>
 updateItem(
 item.id!,
 'cantidad',
 parseFloat(e.target.value) || 0
 )
 }
 className="text-center h-8 text-sm"
 min="0"
 />
 </TableCell>
 <TableCell>
 <Select
 value={item.unidad}
 onValueChange={(v) => updateItem(item.id!, 'unidad', v)}
 >
 <SelectTrigger className="h-8 text-sm">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {UNIDADES.map((u) => (
 <SelectItem key={u} value={u} className="text-sm">
 {u}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </TableCell>
 <TableCell>
 <Input
 type="number"
 value={item.precioUnitario || ''}
 onChange={(e) =>
 updateItem(
 item.id!,
 'precioUnitario',
 parseFloat(e.target.value) || 0
 )
 }
 className="text-right h-8 text-sm"
 placeholder="0.00"
 />
 </TableCell>
 <TableCell className="text-right font-medium text-sm">
 ${(item.subtotal || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
 </TableCell>
 <TableCell>
 <Button
 size="icon"
 variant="ghost"
 className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
 onClick={() => removeItem(item.id!)}
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

 {items.length > 0 && (
 <div className="flex justify-end">
 <Card className="p-4 w-64 space-y-2">
 <div className="flex justify-between items-center text-sm">
 <span className="text-muted-foreground">Subtotal:</span>
 <span className="font-medium">
 ${totales.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
 </span>
 </div>
 <div className="flex justify-between items-center text-sm">
 <div className="flex items-center gap-1">
 <span className="text-muted-foreground">IVA:</span>
 <Select value={tasaIva} onValueChange={setTasaIva}>
 <SelectTrigger className="h-6 w-16 text-xs">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {TASAS_IVA.map((t) => (
 <SelectItem key={t.value} value={t.value} className="text-xs">
 {t.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <span className="font-medium">
 ${totales.impuestos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
 </span>
 </div>
 <div className="flex justify-between items-center text-base font-semibold border-t pt-2">
 <span>TOTAL:</span>
 <span>
 ${totales.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
 </span>
 </div>
 </Card>
 </div>
 )}
 </TabsContent>

 <TabsContent value="condiciones" className="space-y-4 mt-4">
 <div className="grid grid-cols-3 gap-4">
 <div className="space-y-2">
 <Label className="text-sm font-medium">Plazo Entrega (días)</Label>
 <Input
 type="number"
 placeholder="Ej: 7"
 value={plazoEntrega}
 onChange={(e) => setPlazoEntrega(e.target.value)}
 className="h-9 text-sm"
 />
 </div>
 <div className="space-y-2">
 <Label className="text-sm font-medium">Condiciones Pago</Label>
 <Select value={condicionesPago} onValueChange={setCondicionesPago}>
 <SelectTrigger className="h-9 text-sm">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {CONDICIONES_PAGO.map((cond) => (
 <SelectItem key={cond} value={cond} className="text-sm">
 {cond}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label className="text-sm font-medium">Válido Hasta</Label>
 <DatePicker
 value={validezHasta}
 onChange={(date) => setValidezHasta(date)}
 placeholder="Vencimiento"
 clearable
 className="h-9"
 />
 </div>
 </div>

 <div className="space-y-2">
 <Label className="text-sm font-medium">Observaciones</Label>
 <Textarea
 placeholder="Notas sobre la cotización..."
 value={observaciones}
 onChange={(e) => setObservaciones(e.target.value)}
 rows={2}
 className="text-sm resize-none"
 />
 </div>

 <div className="space-y-2">
 <Label className="text-sm font-medium">Documento PDF (opcional)</Label>
 {pdfFile ? (
 <Card className="p-3 flex items-center justify-between bg-success-muted/50 border-success-muted">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-destructive/10 rounded">
 <File className="w-5 h-5 text-destructive" />
 </div>
 <div>
 <p className="font-medium text-sm">{pdfFile.name}</p>
 <p className="text-xs text-muted-foreground">
 {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
 </p>
 </div>
 </div>
 <Button
 variant="ghost"
 size="icon"
 className="h-8 w-8"
 onClick={() => setPdfFile(null)}
 >
 <X className="w-4 h-4" />
 </Button>
 </Card>
 ) : (
 <Card
 className="p-4 border-dashed cursor-pointer hover:bg-muted/30 transition-colors"
 onClick={() => fileInputRef.current?.click()}
 >
 <div className="flex items-center gap-3 text-muted-foreground">
 <Upload className="w-5 h-5" />
 <div>
 <p className="text-sm font-medium">Subir PDF de respaldo</p>
 <p className="text-xs">Opcional - máx 10MB</p>
 </div>
 </div>
 </Card>
 )}
 </div>
 </TabsContent>
 </Tabs>
 </>
 )}
 </DialogBody>

 <DialogFooter className="gap-2">
 {mode === 'select' ? (
 <Button
 variant="outline"
 onClick={onClose}
 className="h-8 px-3 text-sm"
 >
 Cancelar
 </Button>
 ) : (
 <>
 <Button
 variant="outline"
 onClick={() => {
 if (mode === 'manual' && !aiExtraction) {
 setMode('select');
 } else {
 onClose();
 }
 }}
 disabled={submitting || uploading || processingAI}
 className="h-8 px-3 text-sm"
 >
 {mode === 'manual' && !aiExtraction ? 'Volver' : 'Cancelar'}
 </Button>
 <Button
 onClick={handleSubmit}
 disabled={submitting || uploading || processingAI || !supplierId || mode !== 'manual'}
 className="h-8 px-3 text-sm"
 >
 {(submitting || uploading) && (
 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
 )}
 {cotizacionId ? 'Actualizar' : 'Guardar Cotización'}
 </Button>
 </>
 )}
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
}

export default CotizacionFormModal;
