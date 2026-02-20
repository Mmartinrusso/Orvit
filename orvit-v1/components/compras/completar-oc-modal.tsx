'use client';

import { useState, useEffect, useCallback } from 'react';
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogFooter,
 DialogDescription,
 DialogBody,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
 Popover,
 PopoverContent,
 PopoverTrigger,
} from '@/components/ui/popover';
import {
 Command,
 CommandEmpty,
 CommandGroup,
 CommandInput,
 CommandItem,
 CommandList,
} from '@/components/ui/command';
import { Loader2, FileText, CheckCircle, Plus, Trash2, Check, ChevronsUpDown, Lock, Unlock, Edit2 } from 'lucide-react';
import {
 AlertDialog,
 AlertDialogAction,
 AlertDialogCancel,
 AlertDialogContent,
 AlertDialogDescription,
 AlertDialogFooter,
 AlertDialogHeader,
 AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useViewMode } from '@/contexts/ViewModeContext';

// Tipos de comprobantes T1 (fiscales)
const tiposComprobantesT1 = [
 'Factura A',
 'Factura B',
 'Factura C',
 'Nota de Débito A',
 'Nota de Débito B',
 'Nota de Débito C',
 'Nota de Crédito A',
 'Nota de Crédito B',
 'Nota de Crédito C',
 'Recibo A',
 'Recibo B',
 'Recibo C',
];

// Additional document types
const TIPOS_CFG_DISPONIBLES = [
 'Presupuesto',
 'Remito Sin Factura',
 'Comprobante Interno',
 'Vale',
 'Ticket',
];

interface OCItem {
 id: number;
 descripcion: string;
 cantidad: number;
 unidad: string;
 precioUnitario: number;
 subtotal: number;
 supplierItem?: {
 codigoProveedor?: string;
 };
}

interface Cuenta {
 id: string;
 nombre: string;
 descripcion?: string;
}

interface CompletarOCModalProps {
 open: boolean;
 onClose: () => void;
 ordenId: number;
 ordenNumero: string;
 proveedorId: number;
 proveedorNombre: string;
 total: number;
 moneda: string;
 ocDocType?: 'T1' | 'T2'; // DocType original de la OC
 onSuccess?: () => void;
}

export function CompletarOCModal({
 open,
 onClose,
 ordenId,
 ordenNumero,
 proveedorId,
 proveedorNombre,
 total,
 moneda,
 ocDocType,
 onSuccess
}: CompletarOCModalProps) {
 const { mode: viewMode, ct } = useViewMode();
 const isExtAvailable = viewMode === 'E';

 const [submitting, setSubmitting] = useState(false);
 const [loading, setLoading] = useState(false);
 const [ocItems, setOcItems] = useState<OCItem[]>([]);
 // Track if OC was originally created as T2 (to force T2 mode and hide Documentado)
 const [isOcT2, setIsOcT2] = useState(false);
 const [cuentas, setCuentas] = useState<Cuenta[]>([]);
 const [cuentaPopoverOpen, setCuentaPopoverOpen] = useState(false);

 // Item editing with password protection
 const [itemsEditMode, setItemsEditMode] = useState(false);
 const [showPasswordDialog, setShowPasswordDialog] = useState(false);
 const [editPassword, setEditPassword] = useState('');
 const [passwordError, setPasswordError] = useState('');
 const [itemChanges, setItemChanges] = useState<Array<{
 itemId: string;
 campo: string;
 valorAnterior: string;
 valorNuevo: string;
 timestamp: string;
 }>>([]);
 const [originalItems, setOriginalItems] = useState<typeof formData.items>([]);

 // Purchase config from company settings
 const [purchaseConfig, setPurchaseConfig] = useState({
 claveEdicionItems: 'admin123',
 permitirEdicionItems: true,
 requiereMotivoEdicion: true,
 });

 const [formData, setFormData] = useState({
 docType: 'T1' as 'T1' | 'T2',
 tipo: '',
 numeroSerie: '',
 numeroFactura: '',
 fechaEmision: '',
 fechaVencimiento: '',
 fechaImputacion: '',
 tipoPago: 'cta_cte' as 'contado' | 'cta_cte',
 // Items from OC
 items: [] as Array<{
 id: string;
 descripcion: string;
 cantidad: string;
 unidad: string;
 precioUnitario: string;
 subtotal: string;
 }>,
 // Totales
 neto: '',
 iva21: '',
 noGravado: '',
 impInter: '',
 percepcionIVA: '',
 percepcionIIBB: '',
 otrosConceptos: '',
 iva105: '',
 iva27: '',
 exento: '',
 iibb: '',
 total: '',
 tipoCuentaId: '',
 observaciones: '',
 });

 const [dateInputValues, setDateInputValues] = useState({
 fechaEmision: '',
 fechaVencimiento: '',
 fechaImputacion: '',
 });

 // Format helpers
 const formatMoney = (value: string) => {
 const num = parseFloat(value || '0');
 if (isNaN(num)) return '';
 return num.toLocaleString('es-AR', {
 minimumFractionDigits: 2,
 maximumFractionDigits: 2,
 });
 };

 const normalizeMoneyInput = (raw: string) => {
 if (!raw) return '';
 const cleaned = raw.replace(/\./g, '').replace(',', '.');
 return cleaned;
 };

 const formatDateToDDMMYYYY = (isoDate: string): string => {
 if (!isoDate) return '';
 if (isoDate.includes('/') && isoDate.split('/').length === 3) {
 return isoDate;
 }
 try {
 let dateStr = isoDate;
 if (dateStr.includes('T')) {
 dateStr = dateStr.split('T')[0];
 }
 const parts = dateStr.split('-');
 if (parts.length === 3) {
 const [year, month, day] = parts;
 return `${day}/${month}/${year}`;
 }
 return '';
 } catch {
 return '';
 }
 };

 const formatDDMMYYYYToISO = (ddmmyyyy: string): string => {
 if (!ddmmyyyy) return '';
 const parts = ddmmyyyy.split('/');
 if (parts.length !== 3) return '';
 const [day, month, year] = parts;
 return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
 };

 // Get available types based on docType
 const getTiposDisponibles = () => {
 if (formData.docType === 'T1') {
 return tiposComprobantesT1;
 }
 return ct.length > 0 ? ct : TIPOS_CFG_DISPONIBLES;
 };

 // Load purchase config from company settings
 const loadPurchaseConfig = async () => {
 try {
 const response = await fetch('/api/compras/config');
 if (response.ok) {
 const data = await response.json();
 if (data.config) {
 setPurchaseConfig(data.config);
 }
 }
 } catch (error) {
 console.error('Error loading purchase config:', error);
 }
 };

 // Load OC items and cuentas when modal opens
 useEffect(() => {
 if (open) {
 // Reset isOcT2 before loading (will be set in loadOCData)
 setIsOcT2(false);
 loadOCData();
 loadCuentas();
 loadPurchaseConfig();
 // Initialize dates
 const today = new Date().toISOString().split('T')[0];
 const todayFormatted = formatDateToDDMMYYYY(today);
 setFormData(prev => ({
 ...prev,
 fechaEmision: today,
 fechaImputacion: today,
 }));
 setDateInputValues({
 fechaEmision: todayFormatted,
 fechaVencimiento: '',
 fechaImputacion: todayFormatted,
 });
 }
 }, [open, ordenId]);

 // Reset tipo cuando cambia docType
 useEffect(() => {
 const tipos = getTiposDisponibles();
 if (tipos.length > 0 && !tipos.includes(formData.tipo)) {
 setFormData(prev => ({ ...prev, tipo: tipos[0] }));
 }
 }, [formData.docType]);

 const loadOCData = async () => {
 setLoading(true);
 try {
 const response = await fetch(`/api/compras/ordenes-compra/${ordenId}`);
 if (response.ok) {
 const data = await response.json();
 setOcItems(data.items || []);

 // Check if OC was created as T2 (from prop or from OC data)
 const ocWasT2 = ocDocType === 'T2' || data.docType === 'T2';
 setIsOcT2(ocWasT2);

 // Pre-populate items from OC
 const mappedItems = (data.items || []).map((item: OCItem) => ({
 id: String(item.id),
 descripcion: item.descripcion,
 cantidad: String(item.cantidad),
 unidad: item.unidad,
 precioUnitario: String(item.precioUnitario),
 subtotal: String(item.subtotal),
 }));

 // Calculate neto from items
 const neto = mappedItems.reduce((sum: number, item: any) =>
 sum + (parseFloat(item.subtotal) || 0), 0);
 const iva21 = neto * 0.21;
 const totalCalc = neto + iva21;

 // Get available types for T2 (use ct from config or defaults)
 const t2Types = ct.length > 0 ? ct : TIPOS_CFG_DISPONIBLES;
 const defaultT2Type = t2Types.includes('Presupuesto') ? 'Presupuesto' : t2Types[0];

 setFormData(prev => ({
 ...prev,
 items: mappedItems,
 neto: neto.toFixed(2),
 iva21: iva21.toFixed(2),
 total: totalCalc.toFixed(2),
 // Pre-cargar tipo de cuenta si fue seleccionado al crear la OC
 tipoCuentaId: data.tipoCuentaId ? String(data.tipoCuentaId) : prev.tipoCuentaId,
 // If OC was T2, force T2 mode and set default type to Presupuesto
 ...(ocWasT2 && {
 docType: 'T2' as const,
 tipo: defaultT2Type,
 }),
 }));
 // Store original items for change tracking
 setOriginalItems(mappedItems);
 }
 } catch (error) {
 console.error('Error loading OC data:', error);
 } finally {
 setLoading(false);
 }
 };

 // Password verification for editing items
 const handleRequestEditMode = () => {
 setShowPasswordDialog(true);
 setEditPassword('');
 setPasswordError('');
 };

 const handleVerifyPassword = () => {
 if (editPassword === purchaseConfig.claveEdicionItems) {
 setItemsEditMode(true);
 setShowPasswordDialog(false);
 toast.success('Modo edición activado. Los cambios quedarán registrados.');
 } else {
 setPasswordError('Clave incorrecta');
 }
 };

 // Handle item field change with tracking
 const handleItemChange = (itemId: string, field: keyof typeof formData.items[0], value: string) => {
 const item = formData.items.find(i => i.id === itemId);
 if (!item) return;

 const originalItem = originalItems.find(i => i.id === itemId);
 const oldValue = item[field];
 const originalValue = originalItem ? originalItem[field] : oldValue;

 // Track change if value is different from original
 if (value !== originalValue) {
 setItemChanges(prev => {
 // Remove existing change for same item+field if exists
 const filtered = prev.filter(c => !(c.itemId === itemId && c.campo === field));
 return [...filtered, {
 itemId,
 campo: field === 'cantidad' ? 'Cantidad' : field === 'precioUnitario' ? 'Precio' : field,
 valorAnterior: String(originalValue),
 valorNuevo: value,
 timestamp: new Date().toISOString(),
 }];
 });
 } else {
 // Remove change if back to original
 setItemChanges(prev => prev.filter(c => !(c.itemId === itemId && c.campo === field)));
 }

 // Update item
 setFormData(prev => ({
 ...prev,
 items: prev.items.map(i => {
 if (i.id !== itemId) return i;
 const updated = { ...i, [field]: value };
 // Recalculate subtotal
 if (field === 'cantidad' || field === 'precioUnitario') {
 const cantidad = parseFloat(field === 'cantidad' ? value : i.cantidad) || 0;
 const precio = parseFloat(field === 'precioUnitario' ? value : i.precioUnitario) || 0;
 updated.subtotal = (cantidad * precio).toFixed(2);
 }
 return updated;
 }),
 }));
 };

 // Recalculate neto when items change
 useEffect(() => {
 if (itemsEditMode && formData.items.length > 0) {
 const neto = formData.items.reduce((sum, item) => sum + (parseFloat(item.subtotal) || 0), 0);
 const iva21 = neto * 0.21;
 const totalCalc = neto + iva21;
 setFormData(prev => ({
 ...prev,
 neto: neto.toFixed(2),
 iva21: iva21.toFixed(2),
 total: totalCalc.toFixed(2),
 }));
 }
 }, [itemsEditMode, formData.items.map(i => i.subtotal).join(',')]);

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

 const handleDateInputChange = (field: string, value: string) => {
 let cleanValue = value.replace(/[^\d\/]/g, '');

 if (cleanValue === '') {
 setDateInputValues(prev => ({ ...prev, [field]: '' }));
 setFormData(prev => ({ ...prev, [field]: '' }));
 return;
 }

 // Auto-add slashes
 if (cleanValue.length === 2 && !cleanValue.includes('/')) {
 cleanValue = cleanValue + '/';
 } else if (cleanValue.length === 5 && cleanValue.split('/').length === 2) {
 // For fechaEmision and fechaVencimiento, allow short format dd/mm
 }

 if (cleanValue.length <= 10) {
 setDateInputValues(prev => ({ ...prev, [field]: cleanValue }));

 if (cleanValue.length === 10) {
 const isoValue = formatDDMMYYYYToISO(cleanValue);
 if (isoValue) {
 setFormData(prev => ({ ...prev, [field]: isoValue }));
 }
 }
 }
 };

 const handleDateEnter = (field: string): boolean => {
 const inputValue = dateInputValues[field as keyof typeof dateInputValues] || '';

 // If short format dd/mm, complete with current year
 if ((field === 'fechaEmision' || field === 'fechaVencimiento') &&
 inputValue.length === 5 &&
 inputValue.includes('/') &&
 inputValue.split('/').length === 2) {
 const year = new Date().getFullYear();
 const completedValue = inputValue + '/' + year;
 const isoValue = formatDDMMYYYYToISO(completedValue);
 if (isoValue) {
 setDateInputValues(prev => ({ ...prev, [field]: completedValue }));
 setFormData(prev => ({ ...prev, [field]: isoValue }));
 setTimeout(() => moveToNextField(field), 50);
 return true;
 }
 }

 // If full format dd/mm/yyyy, just move to next
 if (inputValue.length === 10) {
 const isoValue = formatDDMMYYYYToISO(inputValue);
 if (isoValue) {
 setFormData(prev => ({ ...prev, [field]: isoValue }));
 setTimeout(() => moveToNextField(field), 50);
 return true;
 }
 }

 return false;
 };

 // Navigate to next field on Enter
 const moveToNextField = (currentFieldId: string) => {
 const fieldOrder = [
 'numeroSerie',
 'numeroFactura',
 'fechaEmision',
 'fechaVencimiento',
 'fechaImputacion',
 'tipoPago',
 'neto',
 'iva21',
 'noGravado',
 'impInter',
 'percepcionIVA',
 'percepcionIIBB',
 'otrosConceptos',
 'iva105',
 'iva27',
 'exento',
 'iibb',
 'tipoCuenta',
 'observaciones',
 ];

 const currentIndex = fieldOrder.indexOf(currentFieldId);
 if (currentIndex < fieldOrder.length - 1) {
 for (let i = currentIndex + 1; i < fieldOrder.length; i++) {
 const nextFieldId = fieldOrder[i];
 const nextField = document.getElementById(nextFieldId);

 // Skip fechaVencimiento if tipoPago is contado
 if (nextFieldId === 'fechaVencimiento' && formData.tipoPago === 'contado') {
 continue;
 }

 if (nextField && !nextField.hasAttribute('disabled') && nextField.offsetParent !== null) {
 nextField.focus();
 if (nextField instanceof HTMLInputElement) {
 nextField.select();
 }
 return;
 }
 }
 }
 };

 const calculateTotal = useCallback((data: typeof formData) => {
 const neto = parseFloat(normalizeMoneyInput(data.neto)) || 0;
 const iva21 = parseFloat(normalizeMoneyInput(data.iva21)) || 0;
 const noGravado = parseFloat(normalizeMoneyInput(data.noGravado)) || 0;
 const impInter = parseFloat(normalizeMoneyInput(data.impInter)) || 0;
 const percepcionIVA = parseFloat(normalizeMoneyInput(data.percepcionIVA)) || 0;
 const percepcionIIBB = parseFloat(normalizeMoneyInput(data.percepcionIIBB)) || 0;
 const otrosConceptos = parseFloat(normalizeMoneyInput(data.otrosConceptos)) || 0;
 const iva105 = parseFloat(normalizeMoneyInput(data.iva105)) || 0;
 const iva27 = parseFloat(normalizeMoneyInput(data.iva27)) || 0;
 const exento = parseFloat(normalizeMoneyInput(data.exento)) || 0;
 const iibb = parseFloat(normalizeMoneyInput(data.iibb)) || 0;

 const total = neto + iva21 + iva105 + iva27 + noGravado + impInter +
 percepcionIVA + percepcionIIBB + otrosConceptos + exento + iibb;

 return total.toFixed(2);
 }, []);

 const handleFieldChange = (field: string, value: string) => {
 const moneyFields = ['neto', 'iva21', 'noGravado', 'impInter', 'percepcionIVA',
 'percepcionIIBB', 'otrosConceptos', 'iva105', 'iva27', 'exento', 'iibb'];

 let newValue = value;
 if (moneyFields.includes(field)) {
 newValue = normalizeMoneyInput(value);
 }

 const updated = { ...formData, [field]: newValue };
 updated.total = calculateTotal(updated);
 setFormData(updated);
 };

 const handleSubmit = async () => {
 if (!formData.numeroFactura.trim()) {
 toast.error('Debe ingresar el número de factura');
 return;
 }

 if (!formData.tipoCuentaId) {
 toast.error('Debe seleccionar un tipo de cuenta');
 return;
 }

 setSubmitting(true);
 try {
 // Build observaciones with item changes if any
 let finalObservaciones = formData.observaciones || '';
 if (itemChanges.length > 0) {
 const changesText = itemChanges.map(c => `${c.campo}: ${c.valorAnterior} → ${c.valorNuevo}`).join('; ');
 finalObservaciones = finalObservaciones
 ? `${finalObservaciones}\n[MODIFICACIONES EN ITEMS]: ${changesText}`
 : `[MODIFICACIONES EN ITEMS]: ${changesText}`;
 }

 const response = await fetch(`/api/compras/ordenes-compra/${ordenId}/completar`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 docType: formData.docType,
 tipo: formData.tipo,
 numeroSerie: formData.numeroSerie,
 numeroFactura: formData.numeroFactura,
 fechaEmision: formData.fechaEmision,
 fechaVencimiento: formData.fechaVencimiento || null,
 fechaImputacion: formData.fechaImputacion,
 tipoPago: formData.tipoPago,
 proveedorId,
 // Totales (potentially modified if items were edited)
 neto: parseFloat(formData.neto) || 0,
 iva21: parseFloat(formData.iva21) || 0,
 noGravado: parseFloat(formData.noGravado) || 0,
 impInter: parseFloat(formData.impInter) || 0,
 percepcionIVA: parseFloat(formData.percepcionIVA) || 0,
 percepcionIIBB: parseFloat(formData.percepcionIIBB) || 0,
 otrosConceptos: parseFloat(formData.otrosConceptos) || 0,
 iva105: parseFloat(formData.iva105) || 0,
 iva27: parseFloat(formData.iva27) || 0,
 exento: parseFloat(formData.exento) || 0,
 iibb: parseFloat(formData.iibb) || 0,
 total: parseFloat(formData.total) || 0,
 tipoCuentaId: parseInt(formData.tipoCuentaId),
 observaciones: finalObservaciones,
 moneda,
 // Send modified items if any changes were made
 itemsModificados: itemChanges.length > 0 ? formData.items.map(item => ({
 id: item.id,
 descripcion: item.descripcion,
 cantidad: parseFloat(item.cantidad) || 0,
 unidad: item.unidad,
 precioUnitario: parseFloat(item.precioUnitario) || 0,
 subtotal: parseFloat(item.subtotal) || 0,
 })) : undefined,
 itemChanges: itemChanges.length > 0 ? itemChanges : undefined,
 }),
 });

 if (response.ok) {
 const data = await response.json();
 toast.success(`OC completada. Comprobante ${data.comprobante.numero} creado.`);
 onSuccess?.();
 onClose();
 } else {
 const data = await response.json();
 toast.error(data.error || 'Error al completar la OC');
 }
 } catch (error) {
 console.error('Error completing OC:', error);
 toast.error('Error al completar la OC');
 } finally {
 setSubmitting(false);
 }
 };

 const selectedCuenta = cuentas.find(c => c.id === formData.tipoCuentaId);

 return (
 <Dialog open={open} onOpenChange={onClose}>
 <DialogContent size="xl">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <CheckCircle className="h-5 w-5" />
 Completar Orden de Compra - Cargar Factura
 </DialogTitle>
 <DialogDescription>
 {ordenNumero} - {proveedorNombre}
 </DialogDescription>
 </DialogHeader>

 <DialogBody>
 {loading ? (
 <div className="flex items-center justify-center py-8">
 <Loader2 className="h-8 w-8 animate-spin" />
 </div>
 ) : (
 <form autoComplete="off">
 <div className="space-y-4">
 {/* Document Type Selector - Hidden if OC was T2 (only PPT types available) */}
 {isExtAvailable && !isOcT2 && (
 <div className="space-y-2">
 <Label className="text-sm font-medium">Tipo de documento</Label>
 <div className="flex gap-2">
 <Button
 type="button"
 variant={formData.docType === 'T1' ? 'default' : 'outline'}
 size="sm"
 onClick={() => setFormData(prev => ({ ...prev, docType: 'T1' }))}
 className="flex-1"
 >
 Documentado
 </Button>
 <Button
 type="button"
 variant={formData.docType === 'T2' ? 'default' : 'outline'}
 size="sm"
 onClick={() => setFormData(prev => ({ ...prev, docType: 'T2' }))}
 className="flex-1"
 >
 Adicional
 </Button>
 </div>
 </div>
 )}
 {/* Info when OC is T2 - show that only PPT/additional types are available */}
 {isOcT2 && (
 <div className="p-3 bg-warning-muted border border-warning-muted rounded-md">
 <p className="text-sm text-warning-muted-foreground">
 <strong>OC Adicional (T2):</strong> Solo se permiten comprobantes tipo Presupuesto/Adicional.
 </p>
 </div>
 )}

 {/* Tipo de Comprobante */}
 <div className="space-y-2">
 <Label htmlFor="tipo">Tipo de Comprobante *</Label>
 <Select
 value={formData.tipo}
 onValueChange={(value) => setFormData(prev => ({ ...prev, tipo: value }))}
 >
 <SelectTrigger id="tipo">
 <SelectValue placeholder="Selecciona el tipo de comprobante" />
 </SelectTrigger>
 <SelectContent>
 {getTiposDisponibles().map(tipo => (
 <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 {/* Número Serie y Factura */}
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="numeroSerie">Número de Serie *</Label>
 <Input
 id="numeroSerie"
 value={formData.numeroSerie}
 onChange={(e) => {
 const value = e.target.value.replace(/\D/g, '');
 setFormData(prev => ({ ...prev, numeroSerie: value }));
 }}
 onBlur={(e) => {
 const value = e.target.value.replace(/\D/g, '');
 if (value) {
 const padded = value.padStart(5, '0');
 const finalValue = padded.length > 5 ? padded.slice(-5) : padded;
 setFormData(prev => ({ ...prev, numeroSerie: finalValue }));
 }
 }}
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 const value = formData.numeroSerie.replace(/\D/g, '');
 if (value) {
 const padded = value.padStart(5, '0');
 const finalValue = padded.length > 5 ? padded.slice(-5) : padded;
 setFormData(prev => ({ ...prev, numeroSerie: finalValue }));
 }
 moveToNextField('numeroSerie');
 }
 }}
 placeholder="00001"
 className="h-8"
 required
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="numeroFactura">Número de Factura *</Label>
 <Input
 id="numeroFactura"
 value={formData.numeroFactura}
 onChange={(e) => {
 const value = e.target.value.replace(/\D/g, '');
 setFormData(prev => ({ ...prev, numeroFactura: value }));
 }}
 onBlur={(e) => {
 const value = e.target.value.replace(/\D/g, '');
 if (value) {
 const padded = value.padStart(8, '0');
 const finalValue = padded.length > 8 ? padded.slice(-8) : padded;
 setFormData(prev => ({ ...prev, numeroFactura: finalValue }));
 }
 }}
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 const value = formData.numeroFactura.replace(/\D/g, '');
 if (value) {
 const padded = value.padStart(8, '0');
 const finalValue = padded.length > 8 ? padded.slice(-8) : padded;
 setFormData(prev => ({ ...prev, numeroFactura: finalValue }));
 }
 moveToNextField('numeroFactura');
 }
 }}
 placeholder="00001234"
 className="h-8"
 required
 />
 </div>
 </div>

 {/* Proveedor (read-only) */}
 <div className="space-y-2">
 <Label>Proveedor</Label>
 <Input
 value={proveedorNombre}
 disabled
 className="h-8 bg-muted"
 />
 </div>

 {/* Fechas */}
 <div className="grid grid-cols-3 gap-4">
 <div className="space-y-2">
 <Label htmlFor="fechaEmision">Fecha de Emisión *</Label>
 <Input
 id="fechaEmision"
 value={dateInputValues.fechaEmision}
 onChange={(e) => handleDateInputChange('fechaEmision', e.target.value)}
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 handleDateEnter('fechaEmision');
 }
 }}
 onBlur={() => handleDateEnter('fechaEmision')}
 placeholder="dd/mm"
 className="h-8"
 required
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="fechaVencimiento">Fecha de Vencimiento</Label>
 <Input
 id="fechaVencimiento"
 value={dateInputValues.fechaVencimiento}
 onChange={(e) => handleDateInputChange('fechaVencimiento', e.target.value)}
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 handleDateEnter('fechaVencimiento');
 }
 }}
 onBlur={() => handleDateEnter('fechaVencimiento')}
 placeholder="dd/mm"
 className="h-8"
 disabled={formData.tipoPago === 'contado'}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="fechaImputacion">Fecha de Imputación *</Label>
 <Input
 id="fechaImputacion"
 value={dateInputValues.fechaImputacion}
 onChange={(e) => handleDateInputChange('fechaImputacion', e.target.value)}
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 moveToNextField('fechaImputacion');
 }
 }}
 placeholder="dd/mm/yyyy"
 className="h-8"
 required
 />
 </div>
 </div>

 {/* Tipo de Pago */}
 <div className="space-y-2">
 <Label htmlFor="tipoPago">Tipo de Pago *</Label>
 <Select
 value={formData.tipoPago}
 onValueChange={(value: 'contado' | 'cta_cte') => setFormData(prev => ({ ...prev, tipoPago: value }))}
 >
 <SelectTrigger id="tipoPago">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="cta_cte">Cuenta Corriente</SelectItem>
 <SelectItem value="contado">Contado</SelectItem>
 </SelectContent>
 </Select>
 </div>

 {/* Items de la OC */}
 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Label>Items de la Orden de Compra</Label>
 {purchaseConfig.permitirEdicionItems && !itemsEditMode ? (
 <Button
 type="button"
 variant="ghost"
 size="sm"
 className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
 onClick={handleRequestEditMode}
 >
 <Lock className="h-3 w-3 mr-1" />
 Desbloquear edición
 </Button>
 ) : itemsEditMode ? (
 <span className="inline-flex items-center gap-1 text-xs text-warning-muted-foreground bg-warning-muted px-2 py-0.5 rounded">
 <Unlock className="h-3 w-3" />
 Modo edición activo
 </span>
 ) : null}
 </div>
 <div className="flex items-center gap-2">
 {itemChanges.length > 0 && (
 <span className="text-xs text-warning-muted-foreground">
 {itemChanges.length} cambio(s)
 </span>
 )}
 <span className="text-xs text-muted-foreground">
 {formData.items.length} items
 </span>
 </div>
 </div>
 <div className="border rounded-md max-h-[200px] overflow-y-auto">
 <Table>
 <TableHeader>
 <TableRow className="bg-muted/30">
 <TableHead className="text-xs">Item</TableHead>
 <TableHead className="text-xs w-[100px] text-right">Cant.</TableHead>
 <TableHead className="text-xs w-[60px]">Unidad</TableHead>
 <TableHead className="text-xs w-[120px] text-right">Precio</TableHead>
 <TableHead className="text-xs w-[100px] text-right">Subtotal</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {formData.items.length === 0 ? (
 <TableRow>
 <TableCell colSpan={5} className="text-center py-4 text-muted-foreground text-sm">
 No hay items en la OC
 </TableCell>
 </TableRow>
 ) : (
 formData.items.map((item) => {
 const hasChanges = itemChanges.some(c => c.itemId === item.id);
 return (
 <TableRow key={item.id} className={hasChanges ? 'bg-warning-muted/50' : ''}>
 <TableCell className="text-sm">{item.descripcion}</TableCell>
 <TableCell className="text-sm text-right">
 {itemsEditMode ? (
 <Input
 type="number"
 value={item.cantidad}
 onChange={(e) => handleItemChange(item.id, 'cantidad', e.target.value)}
 className="h-7 w-20 text-right text-xs"
 step="0.01"
 min="0"
 />
 ) : (
 item.cantidad
 )}
 </TableCell>
 <TableCell className="text-sm">{item.unidad}</TableCell>
 <TableCell className="text-sm text-right">
 {itemsEditMode ? (
 <Input
 type="number"
 value={item.precioUnitario}
 onChange={(e) => handleItemChange(item.id, 'precioUnitario', e.target.value)}
 className="h-7 w-24 text-right text-xs"
 step="0.01"
 min="0"
 />
 ) : (
 formatMoney(item.precioUnitario)
 )}
 </TableCell>
 <TableCell className="text-sm text-right font-medium">
 {formatMoney(item.subtotal)}
 </TableCell>
 </TableRow>
 );
 })
 )}
 </TableBody>
 </Table>
 </div>
 {/* Item changes summary */}
 {itemChanges.length > 0 && (
 <div className="p-2 bg-warning-muted border border-warning-muted rounded text-xs">
 <p className="font-medium text-warning-muted-foreground mb-1">Cambios realizados:</p>
 <ul className="space-y-0.5 text-warning-muted-foreground">
 {itemChanges.map((change, idx) => (
 <li key={idx}>
 {change.campo}: {change.valorAnterior} → {change.valorNuevo}
 </li>
 ))}
 </ul>
 </div>
 )}
 </div>

 {/* Totales */}
 <div className="space-y-4 border-t pt-4">
 <div className="grid grid-cols-3 gap-4">
 <div className="space-y-2">
 <Label htmlFor="neto">Neto *</Label>
 <Input
 id="neto"
 value={formatMoney(formData.neto)}
 readOnly
 className="h-8 bg-muted"
 placeholder="0.00"
 required
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 moveToNextField('neto');
 }
 }}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="iva21">IVA 21%</Label>
 <Input
 id="iva21"
 value={formData.iva21}
 onChange={(e) => handleFieldChange('iva21', e.target.value)}
 placeholder="0.00"
 className="h-8"
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 moveToNextField('iva21');
 }
 }}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="noGravado">No Gravado</Label>
 <Input
 id="noGravado"
 value={formData.noGravado}
 onChange={(e) => handleFieldChange('noGravado', e.target.value)}
 placeholder="0.00"
 className="h-8"
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 moveToNextField('noGravado');
 }
 }}
 />
 </div>
 </div>

 <div className="grid grid-cols-3 gap-4">
 <div className="space-y-2">
 <Label htmlFor="impInter">Imp Inter</Label>
 <Input
 id="impInter"
 value={formData.impInter}
 onChange={(e) => handleFieldChange('impInter', e.target.value)}
 placeholder="0.00"
 className="h-8"
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 moveToNextField('impInter');
 }
 }}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="percepcionIVA">Percep IVA</Label>
 <Input
 id="percepcionIVA"
 value={formData.percepcionIVA}
 onChange={(e) => handleFieldChange('percepcionIVA', e.target.value)}
 placeholder="0.00"
 className="h-8"
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 moveToNextField('percepcionIVA');
 }
 }}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="percepcionIIBB">Percep IIBB</Label>
 <Input
 id="percepcionIIBB"
 value={formData.percepcionIIBB}
 onChange={(e) => handleFieldChange('percepcionIIBB', e.target.value)}
 placeholder="0.00"
 className="h-8"
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 moveToNextField('percepcionIIBB');
 }
 }}
 />
 </div>
 </div>

 <div className="grid grid-cols-3 gap-4">
 <div className="space-y-2">
 <Label htmlFor="otrosConceptos">O. Concept</Label>
 <Input
 id="otrosConceptos"
 value={formData.otrosConceptos}
 onChange={(e) => handleFieldChange('otrosConceptos', e.target.value)}
 placeholder="0.00"
 className="h-8"
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 moveToNextField('otrosConceptos');
 }
 }}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="iva105">IVA 10.5%</Label>
 <Input
 id="iva105"
 value={formData.iva105}
 onChange={(e) => handleFieldChange('iva105', e.target.value)}
 placeholder="0.00"
 className="h-8"
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 moveToNextField('iva105');
 }
 }}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="iva27">IVA 27%</Label>
 <Input
 id="iva27"
 value={formData.iva27}
 onChange={(e) => handleFieldChange('iva27', e.target.value)}
 placeholder="0.00"
 className="h-8"
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 moveToNextField('iva27');
 }
 }}
 />
 </div>
 </div>

 <div className="grid grid-cols-3 gap-4">
 <div className="space-y-2">
 <Label htmlFor="exento">EXENTO</Label>
 <Input
 id="exento"
 value={formData.exento}
 onChange={(e) => handleFieldChange('exento', e.target.value)}
 placeholder="0.00"
 className="h-8"
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 moveToNextField('exento');
 }
 }}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="iibb">IIBB</Label>
 <Input
 id="iibb"
 value={formData.iibb}
 onChange={(e) => handleFieldChange('iibb', e.target.value)}
 placeholder="0.00"
 className="h-8"
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 moveToNextField('iibb');
 }
 }}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="total">Total *</Label>
 <Input
 id="total"
 value={formatMoney(formData.total)}
 readOnly
 className="h-8 bg-muted font-bold text-lg"
 placeholder="0.00"
 required
 />
 </div>
 </div>
 </div>

 {/* Tipo de Cuenta */}
 <div className="space-y-2">
 <Label htmlFor="tipoCuenta">Tipo de Cuenta / Gasto *</Label>
 <Popover open={cuentaPopoverOpen} onOpenChange={setCuentaPopoverOpen}>
 <PopoverTrigger asChild>
 <Button
 variant="outline"
 role="combobox"
 aria-expanded={cuentaPopoverOpen}
 className="w-full justify-between h-8 text-sm"
 id="tipoCuenta"
 type="button"
 >
 {selectedCuenta ? selectedCuenta.nombre : 'Selecciona el tipo de cuenta'}
 <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-[400px] p-0">
 <Command>
 <CommandInput placeholder="Buscar cuenta..." />
 <CommandList>
 <CommandEmpty>No se encontraron cuentas.</CommandEmpty>
 <CommandGroup>
 {cuentas.map((cuenta) => (
 <CommandItem
 key={cuenta.id}
 value={cuenta.nombre}
 onSelect={() => {
 setFormData(prev => ({ ...prev, tipoCuentaId: cuenta.id }));
 setCuentaPopoverOpen(false);
 }}
 >
 <Check
 className={cn(
 "mr-2 h-4 w-4",
 formData.tipoCuentaId === cuenta.id ? "opacity-100" : "opacity-0"
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

 {/* Observaciones */}
 <div className="space-y-2">
 <Label htmlFor="observaciones">Observaciones</Label>
 <Input
 id="observaciones"
 value={formData.observaciones}
 onChange={(e) => setFormData(prev => ({ ...prev, observaciones: e.target.value }))}
 placeholder="Notas adicionales..."
 className="h-8"
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 handleSubmit();
 }
 }}
 />
 </div>
 </div>
 </form>
 )}
 </DialogBody>

 <DialogFooter className="gap-2">
 <Button
 variant="outline"
 onClick={onClose}
 disabled={submitting}
 className="h-8"
 type="button"
 >
 Cancelar
 </Button>
 <Button
 onClick={handleSubmit}
 disabled={submitting || !formData.numeroFactura.trim() || !formData.tipoCuentaId}
 className="h-8"
 type="submit"
 >
 {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
 <FileText className="h-4 w-4 mr-1" />
 Guardar comprobante
 </Button>
 </DialogFooter>
 </DialogContent>

 {/* Password Dialog for Item Editing */}
 <AlertDialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
 <AlertDialogContent>
 <AlertDialogHeader>
 <AlertDialogTitle className="flex items-center gap-2">
 <Lock className="h-5 w-5" />
 Desbloquear edición de items
 </AlertDialogTitle>
 <AlertDialogDescription>
 Ingrese la clave de autorización para modificar los items.
 Los cambios quedarán registrados para trazabilidad.
 </AlertDialogDescription>
 </AlertDialogHeader>
 <div className="py-4">
 <Label htmlFor="editPassword" className="text-sm">Clave de autorización</Label>
 <Input
 id="editPassword"
 type="password"
 value={editPassword}
 onChange={(e) => {
 setEditPassword(e.target.value);
 setPasswordError('');
 }}
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 handleVerifyPassword();
 }
 }}
 placeholder="Ingrese la clave..."
 className="mt-2"
 autoFocus
 />
 {passwordError && (
 <p className="text-sm text-destructive mt-2">{passwordError}</p>
 )}
 </div>
 <AlertDialogFooter>
 <AlertDialogCancel onClick={() => setEditPassword('')}>Cancelar</AlertDialogCancel>
 <AlertDialogAction onClick={handleVerifyPassword}>
 Verificar
 </AlertDialogAction>
 </AlertDialogFooter>
 </AlertDialogContent>
 </AlertDialog>
 </Dialog>
 );
}

export default CompletarOCModal;
