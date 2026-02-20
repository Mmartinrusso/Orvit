'use client';

import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogDescription,
 DialogBody,
 DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from '@/components/ui/table';
import { Loader2, Copy, Check, Search, CheckSquare, Square, History, ArrowRight, AlertCircle, ArrowUpDown, ArrowUp, ArrowDown, Zap, Calendar, DollarSign, FileText, Printer, CreditCard, X, Receipt, Banknote, CheckCircle2, Building, Upload, Paperclip, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInDays, isPast, isFuture, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { DatePicker } from '@/components/ui/date-picker';
import { useViewMode } from '@/contexts/ViewModeContext';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';

// ============ TIPOS ============
interface Factura {
 id: number;
 numero: string;
 tipo: string;
 total: number;
 saldo: number;
 vencimiento: string | null;
 ingresoConfirmado: boolean;
 docType?: 'T1' | 'T2';
}

interface Anticipo {
 id: string;
 fecha: Date;
 monto: number;
}

interface ChequeTercero {
 id: string;
 numero: string;
 banco: string;
 titular: string;
 fechaVencimiento: string;
 importe: number;
 tipo: 'CHEQUE' | 'ECHEQ';
}

interface ProveedorBankData {
 cbu?: string;
 aliasCbu?: string;
 banco?: string;
 tipoCuenta?: string;
 numeroCuenta?: string;
 cuit?: string;
}

interface PagoHistorial {
 id: number;
 fecha: string;
 total: number;
 metodoPrincipal: string;
}

interface RegistrarPagoModalProps {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 proveedorId: number;
 proveedorNombre: string;
 proveedorBankData?: ProveedorBankData;
 preSelectedInvoices?: number[];
 onPaymentComplete?: () => void;
}

interface PagoForm {
 efectivo: string;
 dolares: string;
 transferencia: string;
 chequesTerceros: string;
 chequesPropios: string;
 retIVA: string;
 retGanancias: string;
 retIngBrutos: string;
 notas: string;
}

const initialPagoForm: PagoForm = {
 efectivo: '',
 dolares: '',
 transferencia: '',
 chequesTerceros: '',
 chequesPropios: '',
 retIVA: '',
 retGanancias: '',
 retIngBrutos: '',
 notas: '',
};

export function RegistrarPagoModal({
 open,
 onOpenChange,
 proveedorId,
 proveedorNombre,
 proveedorBankData,
 preSelectedInvoices = [],
 onPaymentComplete,
}: RegistrarPagoModalProps) {
 // ViewMode context - determina si se puede crear T2
 const { mode: viewMode } = useViewMode();
 const confirm = useConfirm();

 // En modo Extended (E), creamos pagos T2 que tienen restricciones
 const isT2Mode = viewMode === 'E';

 const [loading, setLoading] = useState(false);
 const [submitting, setSubmitting] = useState(false);

 // Facturas
 const [facturas, setFacturas] = useState<Factura[]>([]);
 const [selectedFacturas, setSelectedFacturas] = useState<number[]>([]);
 const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
 const [facturaSearch, setFacturaSearch] = useState('');
 // Pagos parciales: monto personalizado por factura
 const [montosPersonalizados, setMontosPersonalizados] = useState<Record<number, string>>({});

 // Anticipos
 const [anticiposDisponibles, setAnticiposDisponibles] = useState<Anticipo[]>([]);
 const [anticiposSeleccionados, setAnticiposSeleccionados] = useState<string[]>([]);

 // Cheques
 const [chequesCartera, setChequesCartera] = useState<ChequeTercero[]>([]);
 const [selectedCheques, setSelectedCheques] = useState<string[]>([]);
 const [isChequesModalOpen, setIsChequesModalOpen] = useState(false);
 const [chequeSearch, setChequeSearch] = useState('');
 // Cheques filters
 const [chequeFechaDesde, setChequeFechaDesde] = useState('');
 const [chequeFechaHasta, setChequeFechaHasta] = useState('');
 const [chequeImporteMin, setChequeImporteMin] = useState('');
 const [chequeImporteMax, setChequeImporteMax] = useState('');
 const [chequeSortField, setChequeSortField] = useState<'numero' | 'banco' | 'fechaVencimiento' | 'importe'>('fechaVencimiento');
 const [chequeSortOrder, setChequeSortOrder] = useState<'asc' | 'desc'>('asc');
 // Facturas filters
 const [facturaFechaDesde, setFacturaFechaDesde] = useState('');
 const [facturaFechaHasta, setFacturaFechaHasta] = useState('');
 const [facturaSortOrder, setFacturaSortOrder] = useState<'asc' | 'desc'>('asc'); // asc = most urgent first

 // Bank data modal and loaded data
 const [isBancoModalOpen, setIsBancoModalOpen] = useState(false);
 const [loadedBankData, setLoadedBankData] = useState<ProveedorBankData | null>(null);

 // Payment history
 const [pagosHistorial, setPagosHistorial] = useState<PagoHistorial[]>([]);
 const [showHistorial, setShowHistorial] = useState(false);

 // Copy animation state
 const [copiedField, setCopiedField] = useState<string | null>(null);

 // Show/hide bank data
 const [showBankData, setShowBankData] = useState(true);

 // Show/hide selected cheques
 const [showSelectedCheques, setShowSelectedCheques] = useState(true);

 // Confirmation dialog
 const [showConfirmDialog, setShowConfirmDialog] = useState(false);

 // Success dialog (after payment completion)
 const [showSuccessDialog, setShowSuccessDialog] = useState(false);
 const [savedPaymentData, setSavedPaymentData] = useState<{
 id: number;
 fecha: string;
 totalPago: number;
 proveedor: string;
 facturas: Array<{ numero: string; total: number; aplicado: number }>;
 mediosPago: Array<{ tipo: string; monto: number }>;
 retenciones: Array<{ tipo: string; monto: number }>;
 cheques: Array<{ numero: string; banco: string; tipo: string; importe: number; vencimiento: string }>;
 anticipo: number;
 esAnticipoPuro?: boolean;
 comprobantes?: Array<{ fileName: string; fileUrl: string }>;
 } | null>(null);

 // Monto change confirmation
 const [pendingMontoChange, setPendingMontoChange] = useState<{facturaId: number; newValue: string; originalSaldo: number} | null>(null);

 // USD rate (for USD invoices)
 const [cotizacionDolar, setCotizacionDolar] = useState('');
 const [hasUSDInvoices, setHasUSDInvoices] = useState(false);

 // Notas de crédito (incluye aplicadas y pendientes de aplicar)
 const [notasCredito, setNotasCredito] = useState<Array<{id: number; numero: string; total: number; saldo: number; aplicada: boolean; docType: 'T1' | 'T2'; facturaId?: number}>>([]);
 const [selectedNotasCredito, setSelectedNotasCredito] = useState<number[]>([]);

 // Comprobantes de pago (para transferencias y echeqs)
 const [comprobantes, setComprobantes] = useState<Array<{file: File; preview?: string}>>([]);
 const [uploadingComprobantes, setUploadingComprobantes] = useState(false);

 // Form
 const [pagoForm, setPagoForm] = useState<PagoForm>(initialPagoForm);

 // Autocompletar dropdown state
 const [showAutocompletarMenu, setShowAutocompletarMenu] = useState(false);
 const [autocompletarSelectedIndex, setAutocompletarSelectedIndex] = useState(0);
 // Opciones para autocompletar (T1 y T2 pueden usar transferencia y efectivo)
 const autocompletarOptions = [
 { key: 'transferencia', label: 'Transferencia' },
 { key: 'efectivo', label: 'Efectivo' },
 ];

 // Use passed bankData or loaded from API
 const bankData = proveedorBankData || loadedBankData;

 // Load facturas, anticipos, and bank data when modal opens
 useEffect(() => {
 if (open && proveedorId) {
 loadFacturas();
 loadAnticipos();
 loadChequesCartera();
 loadPagosHistorial();
 loadNotasCredito();
 // Only load bank data if not passed as prop
 if (!proveedorBankData) {
 loadProveedorBankData();
 }
 }
 }, [open, proveedorId]);

 // Pre-select invoices when they change
 useEffect(() => {
 if (preSelectedInvoices.length > 0 && facturas.length > 0) {
 const validIds = preSelectedInvoices.filter(id =>
 facturas.some(f => f.id === id && f.saldo > 0)
 );
 setSelectedFacturas(validIds);
 }
 }, [preSelectedInvoices, facturas]);

 const loadFacturas = async () => {
 setLoading(true);
 try {
 const response = await fetch(
 `/api/compras/comprobantes?proveedorId=${proveedorId}&_t=${Date.now()}`,
 { cache: 'no-store' }
 );
 if (response.ok) {
 const data = await response.json();
 const mapped: Factura[] = (data || [])
 .filter((c: any) => {
 // Filtrar comprobantes con saldo > 0
 if (Number(c.saldo ?? c.total) <= 0) return false;
 // Excluir Notas de Crédito de la lista de facturas
 // Las NCAs no se pagan, se usan para reducir el saldo
 const tipoLower = (c.tipo || '').toLowerCase();
 if (tipoLower.includes('nota de cr') || tipoLower.includes('credito')) {
 return false;
 }
 return true;
 })
 .map((c: any) => {
 // Para T2, mostrar "PPT" en lugar del tipo genérico
 const isT2 = c.docType === 'T2';
 const displayTipo = isT2 ? 'PPT' : (c.tipo || 'FC');

 return {
 id: c.id,
 numero: c.numeroSerie && c.numeroFactura
 ? `${displayTipo}-${c.numeroSerie}-${c.numeroFactura}`
 : c.numero || `#${c.id}`,
 tipo: displayTipo,
 total: Number(c.total) || 0,
 saldo: Number(c.saldo ?? c.total) || 0,
 vencimiento: c.fechaVencimiento || null,
 ingresoConfirmado: c.ingresoConfirmado ?? false,
 docType: c.docType || 'T1',
 };
 });
 setFacturas(mapped);
 }
 } catch (error) {
 console.error('Error loading facturas:', error);
 toast.error('Error al cargar comprobantes');
 } finally {
 setLoading(false);
 }
 };

 const loadProveedorBankData = async () => {
 try {
 const response = await fetch(
 `/api/compras/proveedores/${proveedorId}?_t=${Date.now()}`,
 { cache: 'no-store' }
 );
 if (response.ok) {
 const data = await response.json();
 setLoadedBankData({
 cbu: data.cbu || undefined,
 aliasCbu: data.alias_cbu || data.aliasCbu || undefined,
 banco: data.banco || undefined,
 tipoCuenta: data.tipo_cuenta || data.tipoCuenta || undefined,
 numeroCuenta: data.numero_cuenta || data.numeroCuenta || undefined,
 cuit: data.cuit || undefined,
 });
 }
 } catch (error) {
 console.error('Error loading proveedor bank data:', error);
 }
 };

 const loadAnticipos = async () => {
 try {
 const response = await fetch(
 `/api/compras/ordenes-pago?proveedorId=${proveedorId}&_t=${Date.now()}`,
 { cache: 'no-store' }
 );
 if (response.ok) {
 const data = await response.json();
 // Filter ordenes that have anticipo > 0 (money paid in advance)
 const anticipos: Anticipo[] = (data || [])
 .filter((op: any) => op.anticipo && Number(op.anticipo) > 0)
 .map((op: any) => ({
 id: String(op.id),
 fecha: new Date(op.fechaPago),
 monto: Number(op.anticipo),
 }));
 setAnticiposDisponibles(anticipos);
 }
 } catch (error) {
 console.error('Error loading anticipos:', error);
 }
 };

 const loadChequesCartera = async () => {
 // TODO: Load real cheques from API when available
 // For now, using mock data with future dates
 const today = new Date();
 setChequesCartera([
 { id: 'ch1', numero: '00012345', banco: 'Banco Nación', titular: 'Cliente Ejemplo 1', fechaVencimiento: addDays(today, 15).toISOString().slice(0, 10), importe: 150000, tipo: 'CHEQUE' },
 { id: 'ch2', numero: '00054321', banco: 'Banco Provincia', titular: 'Cliente Ejemplo 2', fechaVencimiento: addDays(today, 30).toISOString().slice(0, 10), importe: 275000, tipo: 'ECHEQ' },
 { id: 'ch3', numero: '00123456', banco: 'Banco Galicia', titular: 'Cliente Ejemplo 3', fechaVencimiento: addDays(today, 45).toISOString().slice(0, 10), importe: 98000, tipo: 'CHEQUE' },
 { id: 'ch4', numero: '00078901', banco: 'Banco Santander', titular: 'Cliente Ejemplo 4', fechaVencimiento: addDays(today, 5).toISOString().slice(0, 10), importe: 180000, tipo: 'ECHEQ' },
 { id: 'ch5', numero: '00099887', banco: 'Banco BBVA', titular: 'Cliente Ejemplo 5', fechaVencimiento: addDays(today, 60).toISOString().slice(0, 10), importe: 320000, tipo: 'CHEQUE' },
 ]);
 };

 const loadPagosHistorial = async () => {
 try {
 const response = await fetch(
 `/api/compras/ordenes-pago?proveedorId=${proveedorId}&limit=5&_t=${Date.now()}`,
 { cache: 'no-store' }
 );
 if (response.ok) {
 const data = await response.json();
 const historial: PagoHistorial[] = (data || [])
 .slice(0, 5)
 .map((op: any) => {
 // Calculate the real total from payment methods
 const totalReal =
 Number(op.efectivo || 0) +
 Number(op.dolares || 0) +
 Number(op.transferencia || 0) +
 Number(op.chequesTerceros || 0) +
 Number(op.chequesPropios || 0) +
 Number(op.retIVA || 0) +
 Number(op.retGanancias || 0) +
 Number(op.retIngBrutos || 0);

 let metodoPrincipal = 'Varios';
 if (Number(op.transferencia) > 0) metodoPrincipal = 'Transferencia';
 else if (Number(op.efectivo) > 0) metodoPrincipal = 'Efectivo';
 else if (Number(op.chequesTerceros) > 0) metodoPrincipal = 'Cheques';
 else if (Number(op.anticipo) > 0) metodoPrincipal = 'Anticipo';

 return {
 id: op.id,
 fecha: op.fechaPago,
 total: totalReal || Number(op.totalPago) || Number(op.total) || 0,
 metodoPrincipal,
 };
 })
 .filter((p: PagoHistorial) => p.total > 0); // Only show payments with actual amounts
 setPagosHistorial(historial);
 }
 } catch (error) {
 console.error('Error loading payment history:', error);
 }
 };

 const loadNotasCredito = async () => {
 try {
 // Load credit notes for this supplier - both applied and pending
 const response = await fetch(
 `/api/compras/notas-credito-debito?proveedorId=${proveedorId}&tipo=NOTA_CREDITO&limit=100&_t=${Date.now()}`,
 { cache: 'no-store' }
 );
 if (response.ok) {
 const result = await response.json();
 const data = result.data || result || [];
 // NCAs con saldo disponible:
 // - Aplicadas: ya afectaron cuenta corriente, tienen crédito disponible
 // - Pendientes: no aplicadas aún, se aplicarán automáticamente al pagar
 const notas = data
 .filter((nc: any) => {
 const tieneCredito = Number(nc.saldo ?? nc.total) > 0;
 const estaAplicada = nc.aplicada === true || nc.estado === 'APLICADA';
 const estaPendiente = !nc.aplicada && ['EMITIDA', 'PENDIENTE', 'APROBADA'].includes(nc.estado);
 // Incluir si tiene crédito Y (está aplicada O está pendiente de aplicar)
 return tieneCredito && (estaAplicada || estaPendiente);
 })
 .map((nc: any) => ({
 id: nc.id,
 numero: nc.numeroSerie
 ? `${nc.numeroSerie}-${nc.numeroFactura || ''}`
 : nc.numero || `NC-${nc.id}`,
 total: Number(nc.total) || 0,
 saldo: Number(nc.saldo ?? nc.total) || 0,
 aplicada: nc.aplicada === true || nc.estado === 'APLICADA',
 docType: nc.docType || 'T1',
 facturaId: nc.facturaId || null,
 }));
 setNotasCredito(notas);
 }
 } catch (error) {
 console.error('Error loading notas de crédito:', error);
 }
 };

 // ============ HELPERS ============
 const parseMonto = (value: string): number => {
 if (!value) return 0;
 const soloDigitos = value.replace(/\D/g, '');
 return soloDigitos ? parseFloat(soloDigitos) : 0;
 };

 const formatCurrency = (amount: number) => {
 return new Intl.NumberFormat('es-AR', {
 style: 'currency',
 currency: 'ARS',
 maximumFractionDigits: 0,
 }).format(amount);
 };

 const formatDate = (dateStr: string | Date | null) => {
 if (!dateStr) return '-';
 try {
 return format(new Date(dateStr), 'd/M/yyyy', { locale: es });
 } catch {
 return '-';
 }
 };

 const formatMontoVisual = (value: string) => {
 if (!value) return '';
 const soloDigitos = value.replace(/\D/g, '');
 return soloDigitos ? soloDigitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
 };

 // Get due date badge info
 const getDueDateBadge = (vencimiento: string | null) => {
 if (!vencimiento) return null;

 try {
 const vencDate = new Date(vencimiento);
 const today = new Date();
 const daysUntilDue = differenceInDays(vencDate, today);

 if (isPast(vencDate) && daysUntilDue < 0) {
 // Vencida
 return {
 color: 'bg-destructive/10 text-destructive border-destructive/30',
 label: `Vencida (${Math.abs(daysUntilDue)}d)`,
 priority: 3,
 };
 } else if (daysUntilDue <= 7) {
 // Próxima a vencer (7 días)
 return {
 color: 'bg-warning-muted text-warning-muted-foreground border-warning-muted',
 label: daysUntilDue === 0 ? 'Vence hoy' : `${daysUntilDue}d`,
 priority: 2,
 };
 } else if (daysUntilDue <= 30) {
 // Vence en el mes
 return {
 color: 'bg-warning-muted text-warning-muted-foreground border-warning-muted',
 label: `${daysUntilDue}d`,
 priority: 1,
 };
 }
 return null;
 } catch {
 return null;
 }
 };

 // Copy with animation
 const handleCopy = (text: string, fieldName: string, successMessage: string) => {
 navigator.clipboard.writeText(text);
 setCopiedField(fieldName);
 toast.success(successMessage);
 setTimeout(() => setCopiedField(null), 2000);
 };

 // ============ PARTIAL PAYMENTS ============
 // Get the amount to pay for a factura (custom or full saldo)
 const getMontoAPagar = (facturaId: number): number => {
 const factura = facturas.find(f => f.id === facturaId);
 if (!factura) return 0;

 const customMonto = montosPersonalizados[facturaId];
 if (customMonto !== undefined && customMonto !== '') {
 const parsed = parseMonto(customMonto);
 // Ensure we don't exceed the saldo
 return Math.min(parsed, factura.saldo);
 }
 return factura.saldo;
 };

 // Handle monto change for partial payments
 const handleMontoChange = (facturaId: number, value: string) => {
 const soloDigitos = value.replace(/\D/g, '');
 setMontosPersonalizados(prev => ({
 ...prev,
 [facturaId]: soloDigitos
 }));
 };

 // Format and validate monto on blur - with confirmation for partial payments
 const handleMontoBlur = (facturaId: number) => {
 const factura = facturas.find(f => f.id === facturaId);
 if (!factura) return;

 const customMonto = montosPersonalizados[facturaId];
 if (customMonto !== undefined && customMonto !== '') {
 const parsed = parseMonto(customMonto);
 // Cap at saldo
 const finalMonto = Math.min(parsed, factura.saldo);

 // If it's a partial payment (less than saldo), ask for confirmation
 if (finalMonto > 0 && finalMonto < factura.saldo) {
 setPendingMontoChange({
 facturaId,
 newValue: formatMontoVisual(finalMonto.toString()),
 originalSaldo: factura.saldo
 });
 } else {
 setMontosPersonalizados(prev => ({
 ...prev,
 [facturaId]: formatMontoVisual(finalMonto.toString())
 }));
 }
 }
 };

 const confirmMontoChange = () => {
 if (pendingMontoChange) {
 setMontosPersonalizados(prev => ({
 ...prev,
 [pendingMontoChange.facturaId]: pendingMontoChange.newValue
 }));
 toast.success('Pago parcial confirmado');
 }
 setPendingMontoChange(null);
 };

 const cancelMontoChange = () => {
 if (pendingMontoChange) {
 // Reset to original saldo (remove custom value)
 setMontosPersonalizados(prev => {
 const updated = { ...prev };
 delete updated[pendingMontoChange.facturaId];
 return updated;
 });
 toast.info('Se restauró el monto original');
 }
 setPendingMontoChange(null);
 };

 // Reset custom monto to full saldo
 const resetMontoToFull = (facturaId: number) => {
 setMontosPersonalizados(prev => {
 const newState = { ...prev };
 delete newState[facturaId];
 return newState;
 });
 };

 // ============ HANDLERS ============
 const toggleFactura = (id: number) => {
 const isSelecting = !selectedFacturas.includes(id);
 setSelectedFacturas(prev =>
 prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
 );

 // Auto-seleccionar NCs asociadas a esta factura cuando se selecciona
 if (isSelecting) {
 const ncsAsociadas = notasCredito.filter(nc => nc.facturaId === id);
 if (ncsAsociadas.length > 0) {
 setSelectedNotasCredito(prev => {
 const ncIds = ncsAsociadas.map(nc => nc.id);
 const newSet = new Set([...prev, ...ncIds]);
 return Array.from(newSet);
 });
 }
 }
 };

 const handleRowClick = (index: number, id: number, e: React.MouseEvent) => {
 if (e.shiftKey && lastClickedIndex !== null) {
 const start = Math.min(lastClickedIndex, index);
 const end = Math.max(lastClickedIndex, index);
 // Only select invoices with confirmed stock
 const facturasConSaldo = filteredFacturas.filter(f => f.saldo > 0 && f.ingresoConfirmado);
 const idsToSelect = facturasConSaldo.slice(start, end + 1).map(f => f.id);
 setSelectedFacturas(prev => {
 const newSet = new Set([...prev, ...idsToSelect]);
 return Array.from(newSet);
 });
 // Auto-seleccionar NCs asociadas
 const ncsAsociadas = notasCredito.filter(nc => nc.facturaId && idsToSelect.includes(nc.facturaId));
 if (ncsAsociadas.length > 0) {
 setSelectedNotasCredito(prev => {
 const ncIds = ncsAsociadas.map(nc => nc.id);
 const newSet = new Set([...prev, ...ncIds]);
 return Array.from(newSet);
 });
 }
 } else {
 toggleFactura(id);
 }
 setLastClickedIndex(index);
 };

 const selectAllFacturas = () => {
 // Select all invoices with balance > 0
 const allIds = filteredFacturas.filter(f => f.saldo > 0).map(f => f.id);
 setSelectedFacturas(allIds);

 // Auto-seleccionar todas las NCs asociadas a las facturas seleccionadas
 const ncsAsociadas = notasCredito.filter(nc => nc.facturaId && allIds.includes(nc.facturaId));
 if (ncsAsociadas.length > 0) {
 setSelectedNotasCredito(prev => {
 const ncIds = ncsAsociadas.map(nc => nc.id);
 const newSet = new Set([...prev, ...ncIds]);
 return Array.from(newSet);
 });
 }
 };

 const deselectAllFacturas = () => {
 setSelectedFacturas([]);
 };

 const toggleAnticipoSeleccionado = (id: string) => {
 setAnticiposSeleccionados(prev =>
 prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
 );
 };

 const toggleChequeSeleccionado = (id: string) => {
 setSelectedCheques(prev =>
 prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
 );
 };

 const toggleNotaCreditoSeleccionada = (id: number) => {
 setSelectedNotasCredito(prev =>
 prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
 );
 };

 // Auto-select cheques to cover the needed amount (uses filtered cheques)
 const autoSelectCheques = () => {
 const montoNecesario = saldoSeleccionadoConAnticipos;
 if (montoNecesario <= 0) {
 toast.error('Primero seleccioná facturas para pagar');
 return;
 }

 if (filteredCheques.length === 0) {
 toast.error('No hay cheques disponibles con los filtros actuales');
 return;
 }

 // Sort filtered cheques by fechaVencimiento (earliest first) to use cheques that expire sooner
 const chequesOrdenados = [...filteredCheques].sort(
 (a, b) => new Date(a.fechaVencimiento).getTime() - new Date(b.fechaVencimiento).getTime()
 );

 let acumulado = 0;
 const seleccion: string[] = [];
 let mejorSeleccion: string[] = [];
 let mejorDiferencia = Infinity;

 // Try to find the best combination that covers the amount or gets closest
 for (const ch of chequesOrdenados) {
 seleccion.push(ch.id);
 acumulado += ch.importe;

 const diferencia = Math.abs(acumulado - montoNecesario);
 if (diferencia < mejorDiferencia || acumulado >= montoNecesario) {
 mejorDiferencia = diferencia;
 mejorSeleccion = [...seleccion];
 }

 if (acumulado >= montoNecesario) break;
 }

 const totalSeleccionado = chequesOrdenados
 .filter(ch => mejorSeleccion.includes(ch.id))
 .reduce((sum, ch) => sum + ch.importe, 0);

 setSelectedCheques(mejorSeleccion);

 if (totalSeleccionado >= montoNecesario) {
 const exceso = totalSeleccionado - montoNecesario;
 toast.success(
 `Seleccionados ${mejorSeleccion.length} cheques por ${formatCurrency(totalSeleccionado)}` +
 (exceso > 0 ? ` (exceso: ${formatCurrency(exceso)})` : '')
 );
 } else {
 toast.warning(
 `Seleccionados ${mejorSeleccion.length} cheques por ${formatCurrency(totalSeleccionado)} ` +
 `(faltan ${formatCurrency(montoNecesario - totalSeleccionado)})`
 );
 }
 };

 // Toggle cheque sort
 const toggleChequeSort = (field: typeof chequeSortField) => {
 if (chequeSortField === field) {
 setChequeSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
 } else {
 setChequeSortField(field);
 setChequeSortOrder('asc');
 }
 };

 // Get cheque due date badge
 const getChequeDueBadge = (fechaVencimiento: string) => {
 try {
 const vencDate = new Date(fechaVencimiento);
 const today = new Date();
 const daysUntilDue = differenceInDays(vencDate, today);

 if (daysUntilDue < 0) {
 return { color: 'bg-destructive/10 text-destructive border-destructive/30', label: 'Vencido', icon: '⚠️' };
 } else if (daysUntilDue <= 7) {
 return { color: 'bg-warning-muted text-warning-muted-foreground border-warning-muted', label: `${daysUntilDue}d`, icon: null };
 }
 return null;
 } catch {
 return null;
 }
 };

 // Apply cheques and close modal
 const applyChequesAndClose = () => {
 const total = chequesCartera
 .filter(ch => selectedCheques.includes(ch.id))
 .reduce((sum, ch) => sum + ch.importe, 0);

 setPagoForm(prev => ({
 ...prev,
 chequesTerceros: formatMontoVisual(total.toString())
 }));
 setIsChequesModalOpen(false);
 toast.success(`Aplicados ${selectedCheques.length} cheques por ${formatCurrency(total)}`);
 };

 // Clear all cheque filters
 const clearChequeFilters = () => {
 setChequeSearch('');
 setChequeFechaDesde('');
 setChequeFechaHasta('');
 setChequeImporteMin('');
 setChequeImporteMax('');
 };

 // Toggle factura sort
 const toggleFacturaSort = () => {
 setFacturaSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
 };

 // Calculate retention suggestions based on total
 const calcularRetenciones = (base: number) => {
 // Standard rates - can be configured per company later
 const retIVA = Math.round(base * 0.105); // 10.5%
 const retGanancias = Math.round(base * 0.02); // 2%
 const retIngBrutos = Math.round(base * 0.025); // 2.5%
 return { retIVA, retGanancias, retIngBrutos };
 };

 // Apply suggested retentions
 const aplicarRetencionesSugeridas = () => {
 const base = totalSeleccionado;
 if (base <= 0) {
 toast.error('Primero seleccioná facturas');
 return;
 }
 const { retIVA, retGanancias, retIngBrutos } = calcularRetenciones(base);
 setPagoForm(prev => ({
 ...prev,
 retIVA: formatMontoVisual(retIVA.toString()),
 retGanancias: formatMontoVisual(retGanancias.toString()),
 retIngBrutos: formatMontoVisual(retIngBrutos.toString()),
 }));
 toast.success('Retenciones sugeridas aplicadas');
 };

 const handlePagoChange = (field: keyof PagoForm, raw: string) => {
 const soloDigitos = raw.replace(/\D/g, '');
 setPagoForm(prev => ({ ...prev, [field]: soloDigitos }));
 };

 const aplicarFormato = (field: keyof PagoForm) => {
 setPagoForm(prev => ({ ...prev, [field]: formatMontoVisual(prev[field] || '') }));
 };

 const pagoFieldOrder = ['pagoEfectivo', 'pagoDolares', 'pagoTransferencia', 'pagoChTerceros', 'pagoChPropios', 'pagoRetIVA', 'pagoRetGan', 'pagoRetIngBru'];

 const focusNextPagoField = (currentId: string) => {
 const idx = pagoFieldOrder.indexOf(currentId);
 if (idx === -1) return;
 const nextId = pagoFieldOrder[idx + 1];
 if (!nextId) return;
 const el = document.getElementById(nextId) as HTMLInputElement | null;
 if (el) { el.focus(); if (typeof el.select === 'function') el.select(); }
 };

 const aplicarFormatoYPasar = (field: keyof PagoForm, inputId: string) => {
 aplicarFormato(field);
 focusNextPagoField(inputId);
 };

 // Auto-fill payment method with the remaining amount (faltante)
 // Note: We calculate inline to avoid TDZ issues since saldoSeleccionadoConAnticipos is defined later
 const autoFillPayment = (method: 'transferencia' | 'efectivo') => {
 // Calculate faltante inline when function is called
 const faltante = Math.max(0, saldoSeleccionadoConAnticipos - totalPagoCalc);
 if (faltante <= 0) {
 toast.info('El pago ya está completo');
 return;
 }
 // Add the faltante to the selected payment method
 const currentValue = parseMonto(pagoForm[method]);
 const nuevoMonto = currentValue + faltante;
 setPagoForm(prev => ({ ...prev, [method]: formatMontoVisual(nuevoMonto.toString()) }));
 toast.success(`Monto autocompletado en ${method === 'transferencia' ? 'Transferencia' : 'Efectivo'}: ${formatCurrency(faltante)}`);
 setShowAutocompletarMenu(false);
 };

 // Handle autocompletar button click - show menu
 const handleAutocompletarClick = () => {
 setShowAutocompletarMenu(true);
 setAutocompletarSelectedIndex(0);
 };

 // Handle autocompletar keyboard navigation
 const handleAutocompletarKeyDown = (e: React.KeyboardEvent) => {
 if (!showAutocompletarMenu) return;

 if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
 e.preventDefault();
 setAutocompletarSelectedIndex(prev =>
 e.key === 'ArrowUp'
 ? (prev - 1 + autocompletarOptions.length) % autocompletarOptions.length
 : (prev + 1) % autocompletarOptions.length
 );
 } else if (e.key === 'Enter') {
 e.preventDefault();
 const selected = autocompletarOptions[autocompletarSelectedIndex];
 autoFillPayment(selected.key as 'transferencia' | 'efectivo');
 } else if (e.key === 'Escape') {
 setShowAutocompletarMenu(false);
 }
 };

 // ============ FILTERING ============
 const filteredFacturas = useMemo(() => {
 let result = facturas.filter(f => f.saldo > 0);

 // Text search
 if (facturaSearch.trim()) {
 const search = facturaSearch.toLowerCase();
 result = result.filter(f =>
 f.numero.toLowerCase().includes(search) ||
 f.tipo.toLowerCase().includes(search) ||
 formatCurrency(f.saldo).toLowerCase().includes(search)
 );
 }

 // Date filter
 if (facturaFechaDesde) {
 const desde = new Date(facturaFechaDesde);
 result = result.filter(f => f.vencimiento && new Date(f.vencimiento) >= desde);
 }
 if (facturaFechaHasta) {
 const hasta = new Date(facturaFechaHasta);
 result = result.filter(f => f.vencimiento && new Date(f.vencimiento) <= hasta);
 }

 // Sort by vencimiento (most urgent first by default)
 result.sort((a, b) => {
 if (!a.vencimiento && !b.vencimiento) return 0;
 if (!a.vencimiento) return 1;
 if (!b.vencimiento) return -1;
 const dateA = new Date(a.vencimiento).getTime();
 const dateB = new Date(b.vencimiento).getTime();
 return facturaSortOrder === 'asc' ? dateA - dateB : dateB - dateA;
 });

 return result;
 }, [facturas, facturaSearch, facturaFechaDesde, facturaFechaHasta, facturaSortOrder]);

 const filteredCheques = useMemo(() => {
 let result = [...chequesCartera];

 // En modo T2, filtrar solo cheques físicos (no ECHEQ)
 if (isT2Mode) {
 result = result.filter(ch => ch.tipo !== 'ECHEQ');
 }

 // Text search
 if (chequeSearch.trim()) {
 const search = chequeSearch.toLowerCase();
 result = result.filter(ch =>
 ch.numero.toLowerCase().includes(search) ||
 ch.banco.toLowerCase().includes(search) ||
 ch.titular.toLowerCase().includes(search)
 );
 }

 // Date filter
 if (chequeFechaDesde) {
 const desde = new Date(chequeFechaDesde);
 result = result.filter(ch => new Date(ch.fechaVencimiento) >= desde);
 }
 if (chequeFechaHasta) {
 const hasta = new Date(chequeFechaHasta);
 result = result.filter(ch => new Date(ch.fechaVencimiento) <= hasta);
 }

 // Amount filter
 if (chequeImporteMin) {
 const min = parseMonto(chequeImporteMin);
 result = result.filter(ch => ch.importe >= min);
 }
 if (chequeImporteMax) {
 const max = parseMonto(chequeImporteMax);
 result = result.filter(ch => ch.importe <= max);
 }

 // Sorting
 result.sort((a, b) => {
 let comparison = 0;
 switch (chequeSortField) {
 case 'numero':
 comparison = a.numero.localeCompare(b.numero);
 break;
 case 'banco':
 comparison = a.banco.localeCompare(b.banco);
 break;
 case 'fechaVencimiento':
 comparison = new Date(a.fechaVencimiento).getTime() - new Date(b.fechaVencimiento).getTime();
 break;
 case 'importe':
 comparison = a.importe - b.importe;
 break;
 }
 return chequeSortOrder === 'asc' ? comparison : -comparison;
 });

 return result;
 }, [chequesCartera, chequeSearch, chequeFechaDesde, chequeFechaHasta, chequeImporteMin, chequeImporteMax, chequeSortField, chequeSortOrder, isT2Mode]);

 // ============ CALCULATIONS ============
 const totalPagoCalc = useMemo(() => {
 // En modo T2, ignorar retenciones (son fiscales)
 const transferenciaMonto = parseMonto(pagoForm.transferencia);
 const retIVAMonto = isT2Mode ? 0 : parseMonto(pagoForm.retIVA);
 const retGananciasMonto = isT2Mode ? 0 : parseMonto(pagoForm.retGanancias);
 const retIngBrutosMonto = isT2Mode ? 0 : parseMonto(pagoForm.retIngBrutos);

 return (
 parseMonto(pagoForm.efectivo) +
 parseMonto(pagoForm.dolares) +
 transferenciaMonto +
 parseMonto(pagoForm.chequesTerceros) +
 parseMonto(pagoForm.chequesPropios) +
 retIVAMonto +
 retGananciasMonto +
 retIngBrutosMonto
 );
 }, [pagoForm, isT2Mode]);

 const totalSeleccionado = useMemo(() => {
 return selectedFacturas.reduce((sum, facturaId) => sum + getMontoAPagar(facturaId), 0);
 }, [facturas, selectedFacturas, montosPersonalizados]);

 const totalAnticiposSeleccionados = useMemo(() => {
 return anticiposDisponibles
 .filter(a => anticiposSeleccionados.includes(a.id))
 .reduce((sum, a) => sum + a.monto, 0);
 }, [anticiposDisponibles, anticiposSeleccionados]);

 const totalChequesSeleccionados = useMemo(() => {
 return chequesCartera
 .filter(ch => selectedCheques.includes(ch.id))
 .reduce((sum, ch) => sum + ch.importe, 0);
 }, [chequesCartera, selectedCheques]);

 const totalNotasCreditoSeleccionadas = useMemo(() => {
 return notasCredito
 .filter(nc => selectedNotasCredito.includes(nc.id))
 .reduce((sum, nc) => sum + nc.saldo, 0);
 }, [notasCredito, selectedNotasCredito]);

 const saldoSeleccionadoConAnticipos = Math.max(totalSeleccionado - totalAnticiposSeleccionados - totalNotasCreditoSeleccionadas, 0);
 const diferencia = totalPagoCalc - saldoSeleccionadoConAnticipos;
 const anticipo = Math.max(0, diferencia);

 // Calculate faltante for the autocompletar button
 const faltanteParaCompletar = Math.max(0, saldoSeleccionadoConAnticipos - totalPagoCalc);

 // Mostrar upload de comprobantes cuando hay transferencia o echeqs seleccionados
 const hasEcheqSelected = useMemo(() => {
 return chequesCartera.some(ch => selectedCheques.includes(ch.id) && ch.tipo === 'ECHEQ');
 }, [chequesCartera, selectedCheques]);

 const showComprobantesUpload = parseMonto(pagoForm.transferencia) > 0 || hasEcheqSelected;

 // Handler para agregar comprobantes
 const handleAddComprobante = (e: React.ChangeEvent<HTMLInputElement>) => {
 const files = e.target.files;
 if (!files) return;

 const newComprobantes = Array.from(files).map(file => ({
 file,
 preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
 }));

 setComprobantes(prev => [...prev, ...newComprobantes]);
 e.target.value = ''; // Reset input para permitir seleccionar el mismo archivo
 };

 // Handler para quitar comprobante
 const handleRemoveComprobante = (index: number) => {
 setComprobantes(prev => {
 const updated = [...prev];
 // Liberar URL del preview si existe
 if (updated[index].preview) {
 URL.revokeObjectURL(updated[index].preview!);
 }
 updated.splice(index, 1);
 return updated;
 });
 };

 // ============ SUBMIT ============
 const handleSubmit = async () => {
 if (submitting) return;

 // Determinar si es un anticipo puro (sin facturas seleccionadas)
 const esAnticipoPuro = selectedFacturas.length === 0;

 // Validar: debe haber al menos un monto de pago
 if (totalPagoCalc === 0 && totalAnticiposSeleccionados === 0) {
 toast.error('Ingresá un monto de pago');
 return;
 }

 setSubmitting(true);
 try {
 // Aplicar automáticamente las NCAs pendientes antes de crear el pago
 const ncasPendientes = selectedNotasCredito
 .map(id => notasCredito.find(nc => nc.id === id))
 .filter(nc => nc && !nc.aplicada);

 if (ncasPendientes.length > 0) {
 for (const nca of ncasPendientes) {
 if (!nca) continue;
 try {
 const aplicarResp = await fetch(`/api/compras/notas-credito-debito/${nca.id}/aplicar`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({}) // Sin allocations específicas
 });
 if (!aplicarResp.ok) {
 const err = await aplicarResp.json().catch(() => ({}));
 toast.error(`Error al aplicar NC ${nca.numero}: ${err.error || 'Error desconocido'}`);
 setSubmitting(false);
 return;
 }
 } catch (err) {
 toast.error(`Error al aplicar NC ${nca.numero}`);
 setSubmitting(false);
 return;
 }
 }
 }

 const facturasSeleccionadas = facturas.filter(f =>
 selectedFacturas.includes(f.id)
 );

 const body = {
 proveedorId,
 fechaPago: new Date().toISOString().slice(0, 10),
 efectivo: parseMonto(pagoForm.efectivo),
 dolares: parseMonto(pagoForm.dolares),
 transferencia: parseMonto(pagoForm.transferencia),
 chequesTerceros: parseMonto(pagoForm.chequesTerceros),
 chequesPropios: parseMonto(pagoForm.chequesPropios),
 retIVA: parseMonto(pagoForm.retIVA),
 retGanancias: parseMonto(pagoForm.retGanancias),
 retIngBrutos: parseMonto(pagoForm.retIngBrutos),
 anticipo,
 notas: pagoForm.notas || null,
 facturas: facturasSeleccionadas.map(f => ({
 receiptId: f.id,
 montoAplicado: getMontoAPagar(f.id),
 docType: f.docType || 'T1',
 })),
 anticiposUsados: anticiposSeleccionados.map(id => Number(id)),
 chequesUsados: selectedCheques.map(id => {
 const ch = chequesCartera.find(x => x.id === id);
 return ch ? { id: ch.id, numero: ch.numero, banco: ch.banco, tipo: ch.tipo, importe: ch.importe } : null;
 }).filter(Boolean),
 notasCreditoUsadas: selectedNotasCredito.map(id => {
 const nc = notasCredito.find(x => x.id === id);
 return nc ? { id: nc.id, numero: nc.numero, montoAplicado: nc.saldo } : null;
 }).filter(Boolean),
 // DocType: T2 si está en modo Extended, T1 en caso contrario
 docType: viewMode === 'E' ? 'T2' : 'T1',
 };

 const resp = await fetch('/api/compras/ordenes-pago', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(body),
 });

 if (!resp.ok) {
 const data = await resp.json().catch(() => ({}));
 toast.error(data?.error || 'Error al registrar el pago');
 return;
 }

 const responseData = await resp.json();

 // Subir comprobantes si hay
 let comprobantesSubidos: Array<{fileName: string; fileUrl: string}> = [];
 if (comprobantes.length > 0 && responseData.id) {
 setUploadingComprobantes(true);
 try {
 for (const comp of comprobantes) {
 const formData = new FormData();
 formData.append('file', comp.file);
 formData.append('entityType', 'payment-orders');
 formData.append('entityId', responseData.id.toString());
 formData.append('fileType', 'comprobante');

 const uploadResp = await fetch('/api/upload', {
 method: 'POST',
 body: formData,
 });

 if (uploadResp.ok) {
 const uploadData = await uploadResp.json();
 comprobantesSubidos.push({
 fileName: comp.file.name,
 fileUrl: uploadData.url,
 });
 }
 }

 // Guardar attachments en la orden de pago
 if (comprobantesSubidos.length > 0) {
 await fetch(`/api/compras/ordenes-pago/${responseData.id}/attachments`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ attachments: comprobantesSubidos }),
 });
 }
 } catch (err) {
 console.error('Error subiendo comprobantes:', err);
 toast.error('Error al subir algunos comprobantes');
 } finally {
 setUploadingComprobantes(false);
 }
 }

 // Build payment data for success dialog
 const mediosPago: Array<{ tipo: string; monto: number }> = [];
 if (parseMonto(pagoForm.efectivo) > 0) mediosPago.push({ tipo: 'Efectivo', monto: parseMonto(pagoForm.efectivo) });
 if (parseMonto(pagoForm.dolares) > 0) mediosPago.push({ tipo: 'Dólares', monto: parseMonto(pagoForm.dolares) });
 if (parseMonto(pagoForm.transferencia) > 0) mediosPago.push({ tipo: 'Transferencia', monto: parseMonto(pagoForm.transferencia) });
 if (parseMonto(pagoForm.chequesTerceros) > 0) mediosPago.push({ tipo: 'Cheques Terceros', monto: parseMonto(pagoForm.chequesTerceros) });
 if (parseMonto(pagoForm.chequesPropios) > 0) mediosPago.push({ tipo: 'Cheques Propios', monto: parseMonto(pagoForm.chequesPropios) });

 const retencionesData: Array<{ tipo: string; monto: number }> = [];
 if (parseMonto(pagoForm.retIVA) > 0) retencionesData.push({ tipo: 'Ret. IVA', monto: parseMonto(pagoForm.retIVA) });
 if (parseMonto(pagoForm.retGanancias) > 0) retencionesData.push({ tipo: 'Ret. Ganancias', monto: parseMonto(pagoForm.retGanancias) });
 if (parseMonto(pagoForm.retIngBrutos) > 0) retencionesData.push({ tipo: 'Ret. Ing. Brutos', monto: parseMonto(pagoForm.retIngBrutos) });

 const facturasData = selectedFacturas.map(id => {
 const f = facturas.find(x => x.id === id);
 return {
 numero: f?.numero || '',
 total: f?.total || 0,
 aplicado: getMontoAPagar(id),
 };
 });

 const chequesData = selectedCheques.map(id => {
 const ch = chequesCartera.find(x => x.id === id);
 return {
 numero: ch?.numero || '',
 banco: ch?.banco || '',
 tipo: ch?.tipo || 'CHEQUE',
 importe: ch?.importe || 0,
 vencimiento: ch?.fechaVencimiento || '',
 };
 });

 setSavedPaymentData({
 id: responseData.id || 0,
 fecha: new Date().toISOString().slice(0, 10),
 totalPago: totalPagoCalc,
 proveedor: proveedorNombre,
 facturas: facturasData,
 mediosPago,
 retenciones: retencionesData,
 cheques: chequesData,
 anticipo,
 esAnticipoPuro,
 comprobantes: comprobantesSubidos.length > 0 ? comprobantesSubidos : undefined,
 });

 setShowConfirmDialog(false);

 // Mostrar toast de éxito y cerrar el modal
 toast.success(`Pago registrado correctamente (OP #${responseData.id})`);
 onPaymentComplete?.();

 // Cerrar el modal después de un breve delay para que se vea el toast
 setTimeout(() => {
 handleClose();
 }, 500);
 } catch (error) {
 console.error('Error submitting payment:', error);
 toast.error('Error al registrar el pago');
 } finally {
 setSubmitting(false);
 }
 };

 const handleClose = () => {
 if (!submitting) {
 setSelectedFacturas([]);
 setAnticiposSeleccionados([]);
 setSelectedCheques([]);
 setPagoForm(initialPagoForm);
 setFacturaSearch('');
 setChequeSearch('');
 setShowHistorial(false);
 setMontosPersonalizados({});
 // Reset filters
 setChequeFechaDesde('');
 setChequeFechaHasta('');
 setChequeImporteMin('');
 setChequeImporteMax('');
 setFacturaFechaDesde('');
 setFacturaFechaHasta('');
 setCotizacionDolar('');
 setSelectedNotasCredito([]);
 // Limpiar comprobantes y liberar URLs
 comprobantes.forEach(c => c.preview && URL.revokeObjectURL(c.preview));
 setComprobantes([]);
 setShowConfirmDialog(false);
 setShowSuccessDialog(false);
 setSavedPaymentData(null);
 onOpenChange(false);
 }
 };

 // Handle closing success dialog
 const handleCloseSuccess = () => {
 setShowSuccessDialog(false);
 setSavedPaymentData(null);
 handleClose();
 };

 // Handle print PDF
 const handlePrintPDF = () => {
 if (!savedPaymentData) return;

 // Create a printable window
 const printWindow = window.open('', '_blank');
 if (!printWindow) {
 toast.error('No se pudo abrir la ventana de impresión');
 return;
 }

 const chequesHTML = savedPaymentData.cheques.length > 0 ? `
 <div class="section">
 <div class="section-title">
 <span>💳</span> Cheques Entregados (${savedPaymentData.cheques.length})
 </div>
 <table>
 <thead>
 <tr>
 <th style="text-align: left;">Tipo</th>
 <th style="text-align: left;">Número</th>
 <th style="text-align: left;">Banco</th>
 <th style="text-align: center;">Vencimiento</th>
 <th style="text-align: right;">Importe</th>
 </tr>
 </thead>
 <tbody>
 ${savedPaymentData.cheques.map(ch => `
 <tr>
 <td>${ch.tipo === 'ECHEQ' ? 'eCheq' : 'Cheque'}</td>
 <td style="font-family: monospace;">${ch.numero}</td>
 <td>${ch.banco}</td>
 <td style="text-align: center;">${ch.vencimiento ? format(new Date(ch.vencimiento), 'd/M/yyyy') : '-'}</td>
 <td style="text-align: right; font-weight: 600;">$ ${ch.importe.toLocaleString('es-AR')}</td>
 </tr>
 `).join('')}
 </tbody>
 </table>
 </div>
 ` : '';

 const html = `
 <!DOCTYPE html>
 <html>
 <head>
 <title>Orden de Pago #${savedPaymentData.id}</title>
 <style>
 * { margin: 0; padding: 0; box-sizing: border-box; }
 body {
 font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
 padding: 40px;
 color: #1a1a1a;
 font-size: 12px;
 }
 .header {
 display: flex;
 justify-content: space-between;
 align-items: flex-start;
 border-bottom: 2px solid #e5e7eb;
 padding-bottom: 20px;
 margin-bottom: 24px;
 }
 .header-left h1 {
 font-size: 24px;
 font-weight: 700;
 color: #111;
 }
 .header-left p {
 color: #6b7280;
 margin-top: 4px;
 }
 .header-right {
 text-align: right;
 }
 .header-right .order-num {
 font-size: 28px;
 font-weight: 700;
 color: #059669;
 }
 .header-right .date {
 color: #6b7280;
 margin-top: 4px;
 }
 .proveedor-box {
 background: #f9fafb;
 border: 1px solid #e5e7eb;
 border-radius: 8px;
 padding: 16px;
 margin-bottom: 24px;
 }
 .proveedor-box label {
 font-size: 10px;
 color: #6b7280;
 text-transform: uppercase;
 letter-spacing: 0.5px;
 }
 .proveedor-box .name {
 font-size: 18px;
 font-weight: 600;
 margin-top: 4px;
 }
 .total-box {
 background: linear-gradient(135deg, #059669 0%, #047857 100%);
 color: white;
 border-radius: 8px;
 padding: 20px;
 margin-bottom: 24px;
 display: flex;
 justify-content: space-between;
 align-items: center;
 }
 .total-box label {
 font-size: 14px;
 opacity: 0.9;
 }
 .total-box .amount {
 font-size: 32px;
 font-weight: 700;
 }
 .section {
 margin-bottom: 24px;
 }
 .section-title {
 font-size: 11px;
 font-weight: 600;
 color: #6b7280;
 text-transform: uppercase;
 letter-spacing: 0.5px;
 margin-bottom: 12px;
 display: flex;
 align-items: center;
 gap: 6px;
 }
 .grid-2 {
 display: grid;
 grid-template-columns: 1fr 1fr;
 gap: 12px;
 }
 .grid-item {
 background: #f9fafb;
 border: 1px solid #e5e7eb;
 border-radius: 6px;
 padding: 12px;
 display: flex;
 justify-content: space-between;
 align-items: center;
 }
 .grid-item .label {
 color: #6b7280;
 }
 .grid-item .value {
 font-weight: 600;
 }
 table {
 width: 100%;
 border-collapse: collapse;
 }
 th, td {
 padding: 10px 12px;
 border-bottom: 1px solid #e5e7eb;
 }
 th {
 background: #f9fafb;
 font-weight: 600;
 font-size: 10px;
 text-transform: uppercase;
 color: #6b7280;
 }
 .footer {
 margin-top: 40px;
 padding-top: 20px;
 border-top: 1px solid #e5e7eb;
 display: flex;
 justify-content: space-between;
 }
 .signature-box {
 width: 200px;
 text-align: center;
 }
 .signature-line {
 border-top: 1px solid #1a1a1a;
 margin-bottom: 8px;
 margin-top: 60px;
 }
 .signature-label {
 font-size: 10px;
 color: #6b7280;
 }
 @media print {
 body { padding: 20px; }
 .no-print { display: none; }
 }
 </style>
 </head>
 <body>
 <div class="header">
 <div class="header-left">
 <h1>${savedPaymentData.esAnticipoPuro ? 'ANTICIPO A PROVEEDOR' : 'ORDEN DE PAGO'}</h1>
 <p>${savedPaymentData.esAnticipoPuro ? 'Pago anticipado a proveedor' : 'Comprobante de pago a proveedor'}</p>
 </div>
 <div class="header-right">
 <div class="order-num">#${savedPaymentData.id}</div>
 <div class="date">${format(new Date(savedPaymentData.fecha), "d 'de' MMMM 'de' yyyy", { locale: es })}</div>
 </div>
 </div>

 <div class="proveedor-box">
 <label>Proveedor</label>
 <div class="name">${savedPaymentData.proveedor}</div>
 </div>

 <div class="total-box">
 <label>${savedPaymentData.esAnticipoPuro ? 'Total Anticipo' : 'Total Pagado'}</label>
 <div class="amount">$ ${savedPaymentData.totalPago.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
 </div>

 <div class="section">
 <div class="section-title">
 <span>💵</span> Medios de Pago
 </div>
 <div class="grid-2">
 ${savedPaymentData.mediosPago.map(mp => `
 <div class="grid-item">
 <span class="label">${mp.tipo}</span>
 <span class="value">$ ${mp.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
 </div>
 `).join('')}
 </div>
 </div>

 ${chequesHTML}

 ${savedPaymentData.retenciones.length > 0 ? `
 <div class="section">
 <div class="section-title">
 <span>📋</span> Retenciones
 </div>
 <div class="grid-2">
 ${savedPaymentData.retenciones.map(ret => `
 <div class="grid-item">
 <span class="label">${ret.tipo}</span>
 <span class="value">$ ${ret.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
 </div>
 `).join('')}
 </div>
 </div>
 ` : ''}

 ${savedPaymentData.facturas.length > 0 ? `
 <div class="section">
 <div class="section-title">
 <span>📄</span> Facturas Aplicadas (${savedPaymentData.facturas.length})
 </div>
 <table>
 <thead>
 <tr>
 <th style="text-align: left;">Factura</th>
 <th style="text-align: right;">Total</th>
 <th style="text-align: right;">Aplicado</th>
 </tr>
 </thead>
 <tbody>
 ${savedPaymentData.facturas.map(f => `
 <tr>
 <td style="font-weight: 500;">${f.numero}</td>
 <td style="text-align: right; color: #6b7280;">$ ${f.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
 <td style="text-align: right; font-weight: 600; color: #059669;">$ ${f.aplicado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
 </tr>
 `).join('')}
 </tbody>
 </table>
 </div>
 ` : ''}

 ${savedPaymentData.anticipo > 0 ? `
 <div class="section">
 <div class="grid-item" style="background: #dbeafe; border-color: #93c5fd;">
 <span class="label" style="color: #2563eb;">${savedPaymentData.esAnticipoPuro ? 'Anticipo Registrado' : 'Anticipo Generado'}</span>
 <span class="value" style="color: #2563eb;">$ ${savedPaymentData.anticipo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
 </div>
 ${savedPaymentData.esAnticipoPuro ? `
 <p style="font-size: 10px; color: #6b7280; margin-top: 8px;">
 Este monto queda como saldo a favor y podrá usarse para pagar facturas futuras.
 </p>
 ` : ''}
 </div>
 ` : ''}

 <div class="footer">
 <div class="signature-box">
 <div class="signature-line"></div>
 <div class="signature-label">Firma Proveedor</div>
 </div>
 <div class="signature-box">
 <div class="signature-line"></div>
 <div class="signature-label">Firma Responsable</div>
 </div>
 </div>

 <script>
 window.onload = function() {
 window.print();
 }
 </script>
 </body>
 </html>
 `;

 printWindow.document.write(html);
 printWindow.document.close();
 };

 // ============ RENDER ============
 return (
 <>
 {/* Main Payment Modal */}
 <Dialog open={open} onOpenChange={handleClose}>
 <DialogContent size="xl">
 <DialogHeader>
 <DialogTitle>Registrar Pago</DialogTitle>
 <DialogDescription>
 {proveedorNombre} - Seleccioná facturas y completá los datos del pago.
 </DialogDescription>
 </DialogHeader>

 <DialogBody className="overflow-x-hidden">
 {loading ? (
 <div className="flex items-center justify-center h-48">
 <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-[2.3fr,1fr] gap-6 items-start overflow-x-hidden">
 {/* Left Column - Facturas & Anticipos */}
 <div className="space-y-3">
 {/* Header with search and buttons */}
 <div className="flex items-center justify-between gap-2">
 <h3 className="text-sm font-semibold">Facturas del proveedor</h3>
 <div className="flex items-center gap-1">
 <Button
 type="button"
 variant="ghost"
 size="sm"
 className="h-7 px-2 text-xs"
 onClick={selectAllFacturas}
 title="Seleccionar todas"
 >
 <CheckSquare className="w-3.5 h-3.5 mr-1" />
 Todas
 </Button>
 <Button
 type="button"
 variant="ghost"
 size="sm"
 className="h-7 px-2 text-xs"
 onClick={deselectAllFacturas}
 title="Deseleccionar todas"
 >
 <Square className="w-3.5 h-3.5 mr-1" />
 Ninguna
 </Button>
 </div>
 </div>

 {/* Filters row */}
 <div className="flex flex-wrap items-end gap-2">
 {/* Search - first */}
 <div className="relative flex-1 min-w-[120px]">
 <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
 <Input
 placeholder="Buscar factura..."
 value={facturaSearch}
 onChange={(e) => setFacturaSearch(e.target.value)}
 className="pl-8 h-7 text-xs"
 />
 </div>
 {/* Date desde */}
 <div className="w-[140px]">
 <Label className="text-[9px] text-muted-foreground">Venc. desde</Label>
 <DatePicker
 value={facturaFechaDesde}
 onChange={(date) => setFacturaFechaDesde(date)}
 placeholder="Desde..."
 />
 </div>
 {/* Date hasta */}
 <div className="w-[140px]">
 <Label className="text-[9px] text-muted-foreground">Venc. hasta</Label>
 <DatePicker
 value={facturaFechaHasta}
 onChange={(date) => setFacturaFechaHasta(date)}
 placeholder="Hasta..."
 />
 </div>
 {/* Sort toggle */}
 <Button
 type="button"
 variant="outline"
 size="sm"
 className="h-7 px-2 text-xs"
 onClick={toggleFacturaSort}
 title={facturaSortOrder === 'asc' ? 'Más urgentes primero' : 'Menos urgentes primero'}
 >
 {facturaSortOrder === 'asc' ? <ArrowUp className="w-3 h-3 mr-1" /> : <ArrowDown className="w-3 h-3 mr-1" />}
 Venc.
 </Button>
 </div>

 <div className="border rounded-md max-h-64 overflow-y-auto overflow-x-hidden">
 {filteredFacturas.length === 0 ? (
 <p className="text-sm text-muted-foreground p-4">
 {facturaSearch ? 'No se encontraron facturas con ese criterio.' : 'No hay facturas pendientes para este proveedor.'}
 </p>
 ) : (
 <Table>
 <TableHeader>
 <TableRow className="bg-muted/30">
 <TableHead className="w-[40px]"></TableHead>
 <TableHead className="text-xs font-medium">Número</TableHead>
 <TableHead className="text-xs font-medium">Vencimiento</TableHead>
 <TableHead className="text-xs font-medium text-right">Saldo</TableHead>
 <TableHead className="text-xs font-medium text-right w-[100px]">A Pagar</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {filteredFacturas.map((factura, index) => {
 const dueBadge = getDueDateBadge(factura.vencimiento);
 const isSelected = selectedFacturas.includes(factura.id);
 const hasCustomMonto = montosPersonalizados[factura.id] !== undefined && montosPersonalizados[factura.id] !== '';
 const montoAPagar = getMontoAPagar(factura.id);
 const isParcial = isSelected && hasCustomMonto && montoAPagar < factura.saldo;
 const stockPendiente = !factura.ingresoConfirmado;

 return (
 <TableRow
 key={factura.id}
 className={cn('cursor-pointer hover:bg-muted/30', isSelected && 'bg-primary/5')}
 onClick={(e) => handleRowClick(index, factura.id, e)}
 >
 <TableCell>
 <Checkbox
 checked={isSelected}
 onCheckedChange={() => toggleFactura(factura.id)}
 className="h-3.5 w-3.5"
 />
 </TableCell>
 <TableCell className="text-xs font-medium">
 <div className="flex items-center gap-1">
 {factura.numero}
 {isParcial && (
 <Badge className="bg-info-muted text-info-muted-foreground border-info-muted text-[8px] px-1 py-0">
 Parcial
 </Badge>
 )}
 {stockPendiente && (
 <Badge className="bg-warning-muted text-warning-muted-foreground border-warning-muted text-[8px] px-1 py-0">
 Sin ingreso
 </Badge>
 )}
 </div>
 </TableCell>
 <TableCell className="text-xs">
 <div className="flex items-center gap-1.5">
 <span className="text-muted-foreground">{formatDate(factura.vencimiento)}</span>
 {dueBadge && (
 <Badge className={cn(dueBadge.color, 'border text-[9px] px-1 py-0')}>
 {dueBadge.label}
 </Badge>
 )}
 </div>
 </TableCell>
 <TableCell className="text-xs text-right font-medium">
 {formatCurrency(factura.saldo)}
 </TableCell>
 <TableCell className="text-xs text-right" onClick={(e) => e.stopPropagation()}>
 {isSelected ? (
 <div className="flex items-center justify-end gap-1">
 <span className="text-muted-foreground text-[10px]">$</span>
 <Input
 type="text"
 inputMode="numeric"
 value={montosPersonalizados[factura.id] !== undefined
 ? formatMontoVisual(montosPersonalizados[factura.id])
 : formatMontoVisual(factura.saldo.toString())
 }
 onChange={(e) => handleMontoChange(factura.id, e.target.value)}
 onBlur={() => handleMontoBlur(factura.id)}
 className={cn('h-6 w-[70px] text-xs text-right px-1', isParcial && 'border-info-muted bg-info-muted')}
 placeholder={formatMontoVisual(factura.saldo.toString())}
 />
 {hasCustomMonto && (
 <Button
 type="button"
 variant="ghost"
 size="sm"
 className="h-5 w-5 p-0"
 onClick={() => resetMontoToFull(factura.id)}
 title="Restablecer al saldo completo"
 >
 <ArrowRight className="h-3 w-3 text-muted-foreground" />
 </Button>
 )}
 </div>
 ) : (
 <span className="text-muted-foreground">-</span>
 )}
 </TableCell>
 </TableRow>
 );
 })}
 {/* Notas de Crédito integradas en la tabla */}
 {notasCredito.length > 0 && (
 <>
 <TableRow className="bg-teal-50/50 border-t-2 border-teal-300">
 <TableCell colSpan={5} className="py-1.5">
 <div className="flex items-center gap-2 text-xs text-teal-700 font-medium">
 <FileText className="w-3.5 h-3.5" />
 Notas de Crédito (saldo a favor)
 </div>
 </TableCell>
 </TableRow>
 {notasCredito.map((nc) => {
 const isNcSelected = selectedNotasCredito.includes(nc.id);
 // NCA (T1) = verde, NC (T2) = morado
 const isT1 = nc.docType === 'T1';
 return (
 <TableRow
 key={`nc-${nc.id}`}
 className={cn('cursor-pointer hover:bg-muted/50', isNcSelected && 'bg-primary/5')}
 onClick={() => toggleNotaCreditoSeleccionada(nc.id)}
 >
 <TableCell onClick={(e) => e.stopPropagation()}>
 <Checkbox
 checked={isNcSelected}
 onCheckedChange={() => toggleNotaCreditoSeleccionada(nc.id)}
 className="h-3.5 w-3.5"
 />
 </TableCell>
 <TableCell className="text-xs font-medium">
 {isT1 ? 'NCA' : 'NC'}-{nc.numero}
 </TableCell>
 <TableCell className="text-xs text-muted-foreground">
 Crédito a favor
 </TableCell>
 <TableCell className="text-xs text-right font-medium text-success">
 -{formatCurrency(nc.saldo)}
 </TableCell>
 <TableCell className="text-xs text-right">
 {isNcSelected ? (
 <span className="font-medium text-success">Aplicar</span>
 ) : (
 <span className="text-muted-foreground">-</span>
 )}
 </TableCell>
 </TableRow>
 );
 })}
 </>
 )}
 </TableBody>
 </Table>
 )}
 </div>

 {/* Summary */}
 <div className="mt-2 inline-flex flex-wrap items-center gap-3 rounded-md bg-muted px-3 py-1.5 text-[11px] text-muted-foreground">
 <span>
 Facturas seleccionadas:{' '}
 <span className="font-semibold">{selectedFacturas.length}</span>
 {(() => {
 const parcialesCount = selectedFacturas.filter(id => {
 const monto = montosPersonalizados[id];
 if (!monto) return false;
 const factura = facturas.find(f => f.id === id);
 return factura && parseMonto(monto) < factura.saldo;
 }).length;
 return parcialesCount > 0 ? (
 <span className="text-info-muted-foreground ml-1">({parcialesCount} parcial)</span>
 ) : null;
 })()}
 </span>
 <span className="h-4 w-px bg-border" />
 <span className="bg-muted px-2 py-0.5 rounded-md border">
 <span className="font-medium">Total facturas:</span>{' '}
 <span className="font-bold text-sm">{formatCurrency(totalSeleccionado)}</span>
 </span>
 {totalAnticiposSeleccionados > 0 && (
 <>
 <span className="h-3 w-px bg-border" />
 <span>
 Anticipos:{' '}
 <span className="font-semibold text-success">-{formatCurrency(totalAnticiposSeleccionados)}</span>
 </span>
 </>
 )}
 {totalNotasCreditoSeleccionadas > 0 && (
 <>
 <span className="h-3 w-px bg-border" />
 <span>
 NC:{' '}
 <span className="font-semibold text-success">-{formatCurrency(totalNotasCreditoSeleccionadas)}</span>
 </span>
 </>
 )}
 {(totalAnticiposSeleccionados > 0 || totalNotasCreditoSeleccionadas > 0) && (
 <>
 <span className="h-3 w-px bg-border" />
 <span>
 Saldo:{' '}
 <span className="font-semibold">{formatCurrency(saldoSeleccionadoConAnticipos)}</span>
 </span>
 </>
 )}
 </div>

 {/* Selected Cheques Section - show below summary as cards */}
 {selectedCheques.length > 0 && (
 <div className="mt-2 border rounded-md p-2 bg-muted/30">
 <div className="flex items-center justify-between mb-1.5">
 <span className="text-xs font-medium flex items-center gap-1">
 <CreditCard className="w-3.5 h-3.5" />
 Cheques seleccionados ({selectedCheques.length})
 </span>
 <span className="text-xs font-bold">
 {formatCurrency(totalChequesSeleccionados)}
 </span>
 </div>
 <div className="space-y-1">
 {chequesCartera.filter(ch => selectedCheques.includes(ch.id)).map(ch => (
 <div
 key={ch.id}
 className="flex items-center justify-between bg-background border rounded px-2 py-1.5 hover:bg-muted/50 transition-colors"
 >
 <div className="flex items-center gap-2 flex-1 min-w-0">
 <Badge
 variant="outline"
 className="text-[9px] px-1.5 py-0 shrink-0"
 >
 {ch.tipo === 'ECHEQ' ? 'eCheq' : 'Cheque'}
 </Badge>
 <span className="text-xs font-medium truncate">{ch.numero}</span>
 <span className="text-xs text-muted-foreground truncate">{ch.banco}</span>
 <span className="text-xs text-muted-foreground">{formatDate(ch.fechaVencimiento)}</span>
 </div>
 <div className="flex items-center gap-2 shrink-0 ml-2">
 <span className="text-xs font-semibold">{formatCurrency(ch.importe)}</span>
 <button
 type="button"
 onClick={() => toggleChequeSeleccionado(ch.id)}
 className="p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
 title="Quitar cheque"
 >
 <X className="w-3.5 h-3.5" />
 </button>
 </div>
 </div>
 ))}
 </div>
 <Button
 type="button"
 variant="ghost"
 size="sm"
 className="h-5 px-2 text-[10px] mt-1.5"
 onClick={() => setIsChequesModalOpen(true)}
 >
 Modificar selección
 </Button>
 </div>
 )}

 {/* Anticipos Section */}
 {anticiposDisponibles.length > 0 && (
 <div className="mt-3 border rounded-md p-2">
 <h4 className="text-xs font-semibold mb-2">Anticipos disponibles</h4>
 <div className="max-h-32 overflow-y-auto">
 <Table>
 <TableHeader>
 <TableRow className="bg-muted/30">
 <TableHead className="w-[40px]"></TableHead>
 <TableHead className="text-xs font-medium">Anticipo</TableHead>
 <TableHead className="text-xs font-medium">Fecha</TableHead>
 <TableHead className="text-xs font-medium text-right">Monto</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {anticiposDisponibles.map((a) => {
 const isSelected = anticiposSeleccionados.includes(a.id);
 return (
 <TableRow
 key={a.id}
 className={cn('hover:bg-muted/50 cursor-pointer transition-colors', isSelected && 'bg-primary/5')}
 onClick={() => toggleAnticipoSeleccionado(a.id)}
 >
 <TableCell onClick={(e) => e.stopPropagation()}>
 <Checkbox
 className="h-3.5 w-3.5"
 checked={isSelected}
 onCheckedChange={() => toggleAnticipoSeleccionado(a.id)}
 />
 </TableCell>
 <TableCell className="text-xs font-medium">
 {`ANT-${a.id.toString().padStart(3, '0')}`}
 </TableCell>
 <TableCell className="text-xs text-muted-foreground">
 {formatDate(a.fecha)}
 </TableCell>
 <TableCell className="text-xs text-right font-medium">
 {formatCurrency(a.monto)}
 </TableCell>
 </TableRow>
 );
 })}
 </TableBody>
 </Table>
 </div>
 </div>
 )}

 {/* Payment History */}
 {pagosHistorial.length > 0 && (
 <div className="mt-3">
 <Button
 type="button"
 variant="ghost"
 size="sm"
 className="h-7 px-2 text-xs text-muted-foreground"
 onClick={() => setShowHistorial(!showHistorial)}
 >
 <History className="w-3.5 h-3.5 mr-1" />
 {showHistorial ? 'Ocultar' : 'Ver'} últimos pagos ({pagosHistorial.length})
 </Button>
 {showHistorial && (
 <div className="mt-2 border rounded-md p-2 bg-muted/20">
 <div className="space-y-1">
 {pagosHistorial.map((pago) => (
 <div key={pago.id} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
 <div className="flex items-center gap-2">
 <span className="text-muted-foreground">{formatDate(pago.fecha)}</span>
 <Badge variant="outline" className="text-[10px] px-1.5 py-0">
 {pago.metodoPrincipal}
 </Badge>
 </div>
 <span className="font-medium">{formatCurrency(pago.total)}</span>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 )}

 {/* Notes */}
 <div className="mt-4">
 <Label htmlFor="pagoNotas" className="text-xs">
 Notas de la orden de pago
 </Label>
 <Textarea
 id="pagoNotas"
 className="mt-1 h-16 text-xs resize-none"
 placeholder="Agregá aquí comentarios o aclaraciones sobre esta orden de pago..."
 value={pagoForm.notas}
 onChange={(e) => setPagoForm(prev => ({ ...prev, notas: e.target.value }))}
 />
 </div>

 {/* Comprobantes de pago - solo para transferencias y echeqs */}
 {showComprobantesUpload && (
 <div className="mt-4 border rounded-md p-3 bg-info-muted/50 border-info-muted">
 <Label className="text-xs font-medium flex items-center gap-1.5 text-info-muted-foreground">
 <Paperclip className="w-3.5 h-3.5" />
 Comprobantes de pago
 <span className="text-[10px] font-normal text-info-muted-foreground">(opcional)</span>
 </Label>
 <p className="text-[10px] text-info-muted-foreground mt-0.5 mb-2">
 Adjuntá comprobantes de transferencia o echeq para tener respaldo de la operación
 </p>

 {/* Lista de comprobantes */}
 {comprobantes.length > 0 && (
 <div className="space-y-1.5 mb-2">
 {comprobantes.map((comp, idx) => (
 <div
 key={idx}
 className="flex items-center gap-2 bg-background border rounded px-2 py-1.5 text-xs"
 >
 <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
 <span className="flex-1 truncate">{comp.file.name}</span>
 <span className="text-[10px] text-muted-foreground">
 {(comp.file.size / 1024).toFixed(0)} KB
 </span>
 <Button
 type="button"
 variant="ghost"
 size="sm"
 className="h-5 w-5 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
 onClick={() => handleRemoveComprobante(idx)}
 >
 <Trash2 className="w-3 h-3" />
 </Button>
 </div>
 ))}
 </div>
 )}

 {/* Botón para agregar */}
 <label className="cursor-pointer">
 <input
 type="file"
 className="hidden"
 accept="image/*,.pdf"
 multiple
 onChange={handleAddComprobante}
 />
 <div className="flex items-center justify-center gap-1.5 border-2 border-dashed border-info-muted rounded-md py-2 px-3 hover:bg-info-muted/50 transition-colors">
 <Upload className="w-3.5 h-3.5 text-info-muted-foreground" />
 <span className="text-xs text-info-muted-foreground">
 {comprobantes.length === 0 ? 'Subir comprobante' : 'Agregar otro'}
 </span>
 </div>
 </label>
 </div>
 )}
 </div>

 {/* Right Column - Payment Data */}
 <div className="space-y-3 md:pl-8">
 <h3 className="text-sm font-semibold">Datos del Pago</h3>

 {/* Inline Bank Data - Collapsible */}
 {(bankData?.cbu || bankData?.cuit) && (
 <div className="text-xs border rounded-md bg-muted/30">
 <button
 type="button"
 onClick={() => setShowBankData(!showBankData)}
 className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-muted/50 rounded-md transition-colors"
 >
 <span className="text-muted-foreground flex items-center gap-1">
 <CreditCard className="w-3 h-3" />
 Datos bancarios
 </span>
 <span className="text-[10px] text-muted-foreground">
 {showBankData ? '▲ Ocultar' : '▼ Mostrar'}
 </span>
 </button>
 {showBankData && (
 <div className="px-2 pb-2 space-y-1.5 border-t border-muted/50 pt-1.5">
 {bankData.cuit && (
 <div className="flex items-center justify-between">
 <span className="text-muted-foreground">CUIT:</span>
 <div className="flex items-center gap-1">
 <span className="font-medium">{bankData.cuit}</span>
 <Button
 type="button"
 variant="ghost"
 size="sm"
 className={cn('h-5 w-5 p-0', copiedField === 'cuit-inline' && 'text-success')}
 onClick={() => handleCopy(bankData.cuit?.replace(/-/g, '') || '', 'cuit-inline', 'CUIT copiado')}
 >
 {copiedField === 'cuit-inline' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
 </Button>
 </div>
 </div>
 )}
 {bankData.cbu && (
 <div className="flex items-center justify-between">
 <span className="text-muted-foreground">CBU:</span>
 <div className="flex items-center gap-1">
 <span className="font-medium text-[10px]">{bankData.cbu}</span>
 <Button
 type="button"
 variant="ghost"
 size="sm"
 className={cn('h-5 w-5 p-0', copiedField === 'cbu-inline' && 'text-success')}
 onClick={() => handleCopy(bankData.cbu || '', 'cbu-inline', 'CBU copiado')}
 >
 {copiedField === 'cbu-inline' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
 </Button>
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 )}

 <div className="space-y-2 max-w-xs ml-auto">
 {[
 { id: 'pagoEfectivo', label: 'Efectivo', field: 'efectivo' as const, blockedInT2: false },
 { id: 'pagoDolares', label: 'Dólares', field: 'dolares' as const, blockedInT2: false },
 { id: 'pagoTransferencia', label: 'Transferencia', field: 'transferencia' as const, blockedInT2: false },
 { id: 'pagoChTerceros', label: 'Ch. Terceros', field: 'chequesTerceros' as const, blockedInT2: false },
 { id: 'pagoChPropios', label: 'Ch. Propios', field: 'chequesPropios' as const, blockedInT2: false },
 { id: 'pagoRetIVA', label: 'Ret. IVA', field: 'retIVA' as const, blockedInT2: true },
 { id: 'pagoRetGan', label: 'Ret. Gan.', field: 'retGanancias' as const, blockedInT2: true },
 { id: 'pagoRetIngBru', label: 'Ret. ING.BRU.', field: 'retIngBrutos' as const, blockedInT2: true },
 ].map((item) => {
 // En modo T2, bloquear solo retenciones (son fiscales)
 const isBlocked = isT2Mode && item.blockedInT2;

 return (
 <div key={item.id} className="space-y-1">
 <Label htmlFor={item.id} className={cn('text-xs', isBlocked && 'text-muted-foreground line-through')}>
 {item.label}
 {isBlocked && <span className="ml-1 text-[10px]">(no disponible)</span>}
 </Label>
 <div className="flex gap-1">
 <Input
 id={item.id}
 type="text"
 value={isBlocked ? '' : pagoForm[item.field]}
 onChange={(e) => !isBlocked && handlePagoChange(item.field, e.target.value)}
 onBlur={() => !isBlocked && aplicarFormato(item.field)}
 onKeyDown={(e) => {
 if (e.key === 'Enter' && !isBlocked) {
 e.preventDefault();
 aplicarFormatoYPasar(item.field, item.id);
 }
 }}
 className={cn('h-8 text-xs flex-1', isBlocked && 'bg-muted cursor-not-allowed')}
 disabled={isBlocked || (item.field === 'chequesTerceros' && selectedCheques.length > 0)}
 placeholder={
 isBlocked ? 'No disponible' :
 (item.field === 'chequesTerceros' && selectedCheques.length > 0) ? 'Cheques seleccionados' : undefined
 }
 />
 {item.field === 'chequesTerceros' && chequesCartera.length > 0 && !isBlocked && (
 <Button
 type="button"
 variant="outline"
 size="sm"
 className="h-8 w-8 p-0 shrink-0"
 onClick={() => setIsChequesModalOpen(true)}
 title="Seleccionar cheques"
 >
 <CreditCard className="w-4 h-4" />
 </Button>
 )}
 </div>
 </div>
 )})}
 </div>

 {/* Auto-fill button with dropdown - only show when there's something left to pay */}
 {selectedFacturas.length > 0 && faltanteParaCompletar > 0 && (
 <div className="relative mt-2">
 <Button
 type="button"
 variant="outline"
 size="sm"
 className="w-full h-7 px-2.5 text-xs rounded-md"
 onClick={handleAutocompletarClick}
 onKeyDown={handleAutocompletarKeyDown}
 >
 <ArrowRight className="w-3.5 h-3.5 mr-1" />
 Autocompletar {formatCurrency(faltanteParaCompletar)}
 </Button>
 {showAutocompletarMenu && (
 <div
 className="absolute left-0 right-0 top-full mt-1 bg-background border rounded-md shadow-lg z-50 overflow-hidden"
 onMouseLeave={() => setShowAutocompletarMenu(false)}
 >
 <div className="py-1 text-xs">
 <div className="px-2 py-1 text-[10px] text-muted-foreground border-b">
 Seleccionar método (↑↓ Enter)
 </div>
 {autocompletarOptions.map((option, index) => (
 <button
 key={option.key}
 type="button"
 className={cn('w-full px-3 py-1.5 text-left hover:bg-muted transition-colors',
 index === autocompletarSelectedIndex && 'bg-muted font-medium'
 )}
 onClick={() => autoFillPayment(option.key as 'transferencia' | 'efectivo')}
 onMouseEnter={() => setAutocompletarSelectedIndex(index)}
 >
 {option.label}
 </button>
 ))}
 </div>
 </div>
 )}
 </div>
 )}

 {/* Summary cards */}
 <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
 <div className="rounded-md border px-3 py-2 bg-muted/40">
 <p className="text-[11px] text-muted-foreground">Saldo facturas</p>
 <p className="text-sm font-semibold">{formatCurrency(totalSeleccionado)}</p>
 </div>
 <div className="rounded-md border px-3 py-2 bg-muted/40">
 <p className="text-[11px] text-muted-foreground">Total pago</p>
 <p className="text-sm font-semibold">{formatCurrency(totalPagoCalc)}</p>
 </div>
 {totalNotasCreditoSeleccionadas > 0 && (
 <div className="rounded-md border px-3 py-2 bg-success-muted border-success-muted">
 <p className="text-[11px] text-success">NC aplicadas</p>
 <p className="text-sm font-semibold text-success">-{formatCurrency(totalNotasCreditoSeleccionadas)}</p>
 </div>
 )}
 {totalAnticiposSeleccionados > 0 && (
 <div className="rounded-md border px-3 py-2 bg-success-muted border-success-muted">
 <p className="text-[11px] text-success">Anticipos</p>
 <p className="text-sm font-semibold text-success">-{formatCurrency(totalAnticiposSeleccionados)}</p>
 </div>
 )}
 {anticipo > 0 && (
 <div className="rounded-md border px-3 py-2 bg-muted/40">
 <p className="text-[11px] text-muted-foreground">Anticipo generado</p>
 <p className="text-sm font-semibold">{formatCurrency(anticipo)}</p>
 </div>
 )}
 {diferencia !== 0 && anticipo === 0 && (
 <div className="rounded-md border px-3 py-2 bg-warning-muted border-warning-muted">
 <p className="text-[11px] text-warning-muted-foreground">Diferencia</p>
 <p className="text-sm font-semibold text-warning-muted-foreground">{formatCurrency(diferencia)}</p>
 </div>
 )}
 {/* Saldo final a pagar - siempre visible y destacado */}
 <div className="col-span-2 rounded-md border-2 px-4 py-3 bg-primary/5 border-primary/30">
 <p className="text-xs text-primary/70 font-medium">SALDO A PAGAR</p>
 <p className="text-xl font-bold text-primary">{formatCurrency(saldoSeleccionadoConAnticipos)}</p>
 </div>
 </div>

 </div>
 </div>
 )}
 </DialogBody>

 <DialogFooter>
 <Button variant="outline" onClick={handleClose} disabled={submitting}>
 Cancelar
 </Button>
 <Button
 onClick={async () => {
 // Validar que hay algo que pagar (monto o anticipos)
 if (totalPagoCalc === 0 && totalAnticiposSeleccionados === 0) {
 toast.error('Ingresá un monto de pago');
 return;
 }
 // Si no hay facturas seleccionadas, es un anticipo puro - pedir confirmación directa
 if (selectedFacturas.length === 0) {
 const ok = await confirm({
 title: 'Confirmar anticipo',
 description: `¿Confirmar registro de anticipo por ${formatCurrency(totalPagoCalc)}? Este monto quedará como saldo a favor del proveedor y podrá usarse para pagar facturas futuras.`,
 confirmText: 'Confirmar',
 variant: 'default',
 });
 if (ok) {
 handleSubmit();
 }
 return;
 }
 setShowConfirmDialog(true);
 }}
 disabled={submitting || loading}
 >
 {submitting ? (
 <>
 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
 Registrando...
 </>
 ) : (
 selectedFacturas.length === 0 ? 'Registrar Anticipo' : 'Registrar Pago'
 )}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* Bank Data Modal */}
 <Dialog open={isBancoModalOpen} onOpenChange={setIsBancoModalOpen}>
 <DialogContent size="sm">
 <DialogHeader>
 <DialogTitle>Datos bancarios del proveedor</DialogTitle>
 </DialogHeader>
 <DialogBody className="space-y-3">
 {(!bankData?.cbu && !bankData?.aliasCbu && !bankData?.banco && !bankData?.cuit) ? (
 <p className="text-muted-foreground text-sm">Este proveedor no tiene datos bancarios cargados.</p>
 ) : (
 <div className="space-y-2 text-sm">
 {bankData?.cuit && (
 <div className="flex items-center justify-between p-2 rounded-md border bg-muted/30">
 <div>
 <p className="text-[11px] text-muted-foreground">CUIT</p>
 <p className="font-medium">{bankData.cuit}</p>
 </div>
 <Button
 variant="ghost"
 size="sm"
 className={cn('h-7 w-7 p-0 transition-all', copiedField === 'cuit' && 'text-success')}
 onClick={() => handleCopy(bankData.cuit?.replace(/-/g, '') || '', 'cuit', 'CUIT copiado (sin guiones)')}
 >
 {copiedField === 'cuit' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
 </Button>
 </div>
 )}
 {bankData?.banco && (
 <div className="p-2 rounded-md border bg-muted/30">
 <p className="text-[11px] text-muted-foreground">Banco</p>
 <p className="font-medium">{bankData.banco}</p>
 </div>
 )}
 {bankData?.tipoCuenta && (
 <div className="p-2 rounded-md border bg-muted/30">
 <p className="text-[11px] text-muted-foreground">Tipo de cuenta</p>
 <p className="font-medium">{bankData.tipoCuenta}</p>
 </div>
 )}
 {bankData?.numeroCuenta && (
 <div className="flex items-center justify-between p-2 rounded-md border bg-muted/30">
 <div>
 <p className="text-[11px] text-muted-foreground">Número de cuenta</p>
 <p className="font-medium">{bankData.numeroCuenta}</p>
 </div>
 <Button
 variant="ghost"
 size="sm"
 className={cn('h-7 w-7 p-0 transition-all', copiedField === 'cuenta' && 'text-success')}
 onClick={() => handleCopy(bankData.numeroCuenta || '', 'cuenta', 'Número de cuenta copiado')}
 >
 {copiedField === 'cuenta' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
 </Button>
 </div>
 )}
 {bankData?.cbu && (
 <div className="flex items-center justify-between p-2 rounded-md border bg-muted/30">
 <div>
 <p className="text-[11px] text-muted-foreground">CBU</p>
 <p className="font-medium text-xs">{bankData.cbu}</p>
 </div>
 <Button
 variant="ghost"
 size="sm"
 className={cn('h-7 w-7 p-0 transition-all', copiedField === 'cbu' && 'text-success')}
 onClick={() => handleCopy(bankData.cbu || '', 'cbu', 'CBU copiado')}
 >
 {copiedField === 'cbu' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
 </Button>
 </div>
 )}
 {bankData?.aliasCbu && (
 <div className="flex items-center justify-between p-2 rounded-md border bg-muted/30">
 <div>
 <p className="text-[11px] text-muted-foreground">Alias CBU</p>
 <p className="font-medium">{bankData.aliasCbu}</p>
 </div>
 <Button
 variant="ghost"
 size="sm"
 className={cn('h-7 w-7 p-0 transition-all', copiedField === 'alias' && 'text-success')}
 onClick={() => handleCopy(bankData.aliasCbu || '', 'alias', 'Alias copiado')}
 >
 {copiedField === 'alias' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
 </Button>
 </div>
 )}
 </div>
 )}
 </DialogBody>
 <DialogFooter>
 <Button variant="outline" onClick={() => setIsBancoModalOpen(false)}>Cerrar</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* Cheques Modal */}
 <Dialog open={isChequesModalOpen} onOpenChange={setIsChequesModalOpen}>
 <DialogContent size="xl">
 <DialogHeader>
 <DialogTitle>Cheques de terceros en cartera</DialogTitle>
 <DialogDescription>Seleccioná uno o varios cheques para aplicar en este pago.</DialogDescription>
 </DialogHeader>
 <DialogBody className="space-y-3">
 {/* Summary bar */}
 <div className="flex flex-wrap items-center justify-between gap-2 text-xs border rounded-md px-3 py-2 bg-muted/40">
 <div className="flex items-center gap-3">
 <span>Monto a pagar: <span className="font-semibold">{formatCurrency(saldoSeleccionadoConAnticipos)}</span></span>
 <span className="h-3 w-px bg-border" />
 <span>Seleccionado: <span className="font-semibold text-success">{formatCurrency(totalChequesSeleccionados)}</span></span>
 {totalChequesSeleccionados > 0 && totalChequesSeleccionados < saldoSeleccionadoConAnticipos && (
 <Badge className="bg-warning-muted text-warning-muted-foreground text-[10px]">
 Faltan {formatCurrency(saldoSeleccionadoConAnticipos - totalChequesSeleccionados)}
 </Badge>
 )}
 </div>
 <Button
 type="button"
 variant="outline"
 size="sm"
 className="h-6 px-2 text-[10px]"
 onClick={autoSelectCheques}
 >
 <Zap className="w-3 h-3 mr-1" />
 Auto-seleccionar
 </Button>
 </div>

 {/* Filters row */}
 <div className="flex flex-wrap items-end gap-2">
 {/* Date desde */}
 <div className="w-[140px]">
 <Label className="text-[9px] text-muted-foreground mb-0.5 block">Venc. desde</Label>
 <DatePicker
 value={chequeFechaDesde}
 onChange={(date) => setChequeFechaDesde(date)}
 placeholder="Desde..."
 />
 </div>
 {/* Date hasta */}
 <div className="w-[140px]">
 <Label className="text-[9px] text-muted-foreground mb-0.5 block">Venc. hasta</Label>
 <DatePicker
 value={chequeFechaHasta}
 onChange={(date) => setChequeFechaHasta(date)}
 placeholder="Hasta..."
 />
 </div>
 {/* Importe min */}
 <div className="w-[90px]">
 <Label className="text-[9px] text-muted-foreground mb-0.5 block">Importe min</Label>
 <Input
 type="text"
 inputMode="numeric"
 placeholder="$0"
 value={chequeImporteMin ? formatMontoVisual(chequeImporteMin) : ''}
 onChange={(e) => setChequeImporteMin(e.target.value.replace(/\D/g, ''))}
 className="h-7 text-xs"
 />
 </div>
 {/* Importe max */}
 <div className="w-[90px]">
 <Label className="text-[9px] text-muted-foreground mb-0.5 block">Importe max</Label>
 <Input
 type="text"
 inputMode="numeric"
 placeholder="$999.999"
 value={chequeImporteMax ? formatMontoVisual(chequeImporteMax) : ''}
 onChange={(e) => setChequeImporteMax(e.target.value.replace(/\D/g, ''))}
 className="h-7 text-xs"
 />
 </div>
 {/* Search */}
 <div className="relative flex-1 min-w-[100px]">
 <Label className="text-[9px] text-muted-foreground mb-0.5 block">Buscar</Label>
 <div className="relative">
 <Search className="absolute left-2.5 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
 <Input
 placeholder="Número, banco..."
 value={chequeSearch}
 onChange={(e) => setChequeSearch(e.target.value)}
 className="pl-8 h-7 text-xs"
 />
 </div>
 </div>
 </div>

 {/* Action buttons */}
 <div className="flex items-center gap-2">
 <Button
 type="button"
 variant="ghost"
 size="sm"
 className="h-6 px-2 text-xs"
 onClick={() => setSelectedCheques(filteredCheques.map(ch => ch.id))}
 >
 <CheckSquare className="w-3 h-3 mr-1" />
 Todos
 </Button>
 <Button
 type="button"
 variant="ghost"
 size="sm"
 className="h-6 px-2 text-xs"
 onClick={() => setSelectedCheques([])}
 >
 <Square className="w-3 h-3 mr-1" />
 Ninguno
 </Button>
 {(chequeSearch || chequeFechaDesde || chequeFechaHasta || chequeImporteMin || chequeImporteMax) && (
 <Button
 type="button"
 variant="ghost"
 size="sm"
 className="h-6 px-2 text-xs text-muted-foreground"
 onClick={clearChequeFilters}
 >
 Limpiar filtros
 </Button>
 )}
 <span className="text-[10px] text-muted-foreground ml-auto">
 Mostrando {filteredCheques.length} de {chequesCartera.length}
 </span>
 </div>

 {filteredCheques.length === 0 ? (
 <p className="text-sm text-muted-foreground py-8 text-center">
 {chequeSearch || chequeFechaDesde || chequeFechaHasta || chequeImporteMin || chequeImporteMax
 ? 'No se encontraron cheques con esos criterios.'
 : 'No hay cheques de terceros en cartera.'}
 </p>
 ) : (
 <div className="border rounded-md max-h-64 overflow-y-auto overflow-x-hidden">
 <Table>
 <TableHeader>
 <TableRow className="bg-muted/30">
 <TableHead className="w-[40px]"></TableHead>
 <TableHead
 className="text-xs font-medium cursor-pointer hover:bg-muted/50"
 onClick={() => toggleChequeSort('numero')}
 >
 <div className="flex items-center gap-1">
 Número
 {chequeSortField === 'numero' && (chequeSortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
 </div>
 </TableHead>
 <TableHead
 className="text-xs font-medium cursor-pointer hover:bg-muted/50"
 onClick={() => toggleChequeSort('banco')}
 >
 <div className="flex items-center gap-1">
 Banco
 {chequeSortField === 'banco' && (chequeSortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
 </div>
 </TableHead>
 <TableHead className="text-xs font-medium">Titular</TableHead>
 <TableHead className="text-xs font-medium w-[60px]">Tipo</TableHead>
 <TableHead
 className="text-xs font-medium cursor-pointer hover:bg-muted/50"
 onClick={() => toggleChequeSort('fechaVencimiento')}
 >
 <div className="flex items-center gap-1">
 Vencimiento
 {chequeSortField === 'fechaVencimiento' && (chequeSortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
 </div>
 </TableHead>
 <TableHead
 className="text-xs font-medium text-right cursor-pointer hover:bg-muted/50"
 onClick={() => toggleChequeSort('importe')}
 >
 <div className="flex items-center justify-end gap-1">
 Importe
 {chequeSortField === 'importe' && (chequeSortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
 </div>
 </TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {filteredCheques.map(ch => {
 const estaMarcado = selectedCheques.includes(ch.id);
 const dueBadge = getChequeDueBadge(ch.fechaVencimiento);
 return (
 <TableRow
 key={ch.id}
 className={cn('cursor-pointer hover:bg-muted/30', estaMarcado && 'bg-emerald-50 dark:bg-emerald-900/20')}
 onClick={() => toggleChequeSeleccionado(ch.id)}
 >
 <TableCell onClick={(e) => e.stopPropagation()}>
 <Checkbox
 className="h-3.5 w-3.5"
 checked={estaMarcado}
 onCheckedChange={() => toggleChequeSeleccionado(ch.id)}
 />
 </TableCell>
 <TableCell className="text-xs font-medium">{ch.numero}</TableCell>
 <TableCell className="text-xs">{ch.banco}</TableCell>
 <TableCell className="text-xs max-w-[120px] truncate">{ch.titular}</TableCell>
 <TableCell className="text-xs">
 <Badge variant="outline" className="text-[10px] px-1.5 py-0">
 {ch.tipo === 'ECHEQ' ? 'eCheq' : 'Cheque'}
 </Badge>
 </TableCell>
 <TableCell className="text-xs">
 <div className="flex items-center gap-1">
 <span className="text-muted-foreground">{formatDate(ch.fechaVencimiento)}</span>
 {dueBadge && (
 <Badge className={cn(dueBadge.color, 'border text-[9px] px-1 py-0')}>
 {dueBadge.label}
 </Badge>
 )}
 </div>
 </TableCell>
 <TableCell className="text-xs text-right font-medium">{formatCurrency(ch.importe)}</TableCell>
 </TableRow>
 );
 })}
 </TableBody>
 </Table>
 </div>
 )}

 {/* Summary */}
 <div className="flex items-center justify-between text-xs border-t pt-2">
 <span className="text-muted-foreground">
 {selectedCheques.length} cheques seleccionados
 </span>
 <span className="font-semibold">
 Total: {formatCurrency(totalChequesSeleccionados)}
 </span>
 </div>
 </DialogBody>
 <DialogFooter>
 <Button type="button" variant="outline" onClick={() => setIsChequesModalOpen(false)}>
 Cancelar
 </Button>
 <Button type="button" onClick={applyChequesAndClose} disabled={selectedCheques.length === 0}>
 Aplicar {selectedCheques.length > 0 && `(${formatCurrency(totalChequesSeleccionados)})`}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* Partial Payment Confirmation Dialog */}
 <Dialog open={!!pendingMontoChange} onOpenChange={(open) => !open && cancelMontoChange()}>
 <DialogContent size="sm">
 <DialogHeader>
 <DialogTitle>Confirmar pago parcial</DialogTitle>
 <DialogDescription>
 Estás configurando un pago parcial para esta factura
 </DialogDescription>
 </DialogHeader>
 <DialogBody>
 {pendingMontoChange && (
 <div className="space-y-3">
 <div className="flex justify-between items-center text-sm">
 <span className="text-muted-foreground">Saldo original:</span>
 <span className="font-semibold">{formatCurrency(pendingMontoChange.originalSaldo)}</span>
 </div>
 <div className="flex justify-between items-center text-sm">
 <span className="text-muted-foreground">Monto a pagar:</span>
 <span className="font-bold">{formatCurrency(parseMonto(pendingMontoChange.newValue))}</span>
 </div>
 <div className="flex justify-between items-center text-sm border-t pt-2">
 <span className="text-muted-foreground">Quedará pendiente:</span>
 <span className="font-semibold text-warning-muted-foreground">
 {formatCurrency(pendingMontoChange.originalSaldo - parseMonto(pendingMontoChange.newValue))}
 </span>
 </div>
 </div>
 )}
 </DialogBody>
 <DialogFooter>
 <Button variant="outline" onClick={cancelMontoChange}>
 Cancelar
 </Button>
 <Button onClick={confirmMontoChange}>
 Confirmar pago parcial
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* Confirmation Dialog - Improved with cheque details */}
 <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
 <DialogContent size="default" className="p-0 gap-0">
 {/* Header */}
 <div className="bg-primary/5 border-b px-4 py-3">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="p-2 rounded-lg bg-primary/10">
 <Receipt className="w-4 h-4 text-primary" />
 </div>
 <div>
 <p className="text-xs text-muted-foreground">Confirmar Pago a</p>
 <p className="text-sm font-semibold">{proveedorNombre}</p>
 </div>
 </div>
 <div className="text-right">
 <p className="text-xs text-muted-foreground">Fecha</p>
 <p className="text-sm font-medium">{format(new Date(), 'd/M/yyyy')}</p>
 </div>
 </div>
 </div>

 {/* Content */}
 <DialogBody className="space-y-4">
 {/* Total destacado */}
 <div className="flex items-center justify-between p-3 bg-success-muted border border-success-muted rounded-lg">
 <div className="flex items-center gap-2">
 <Banknote className="w-4 h-4 text-success" />
 <span className="text-sm font-medium text-success-muted-foreground ">Total a Pagar</span>
 </div>
 <span className="text-lg font-bold text-success">{formatCurrency(totalPagoCalc)}</span>
 </div>

 {/* Medios de pago */}
 <div className="space-y-2">
 <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
 <CreditCard className="w-3.5 h-3.5" />
 Medios de Pago
 </p>
 <div className="grid grid-cols-2 gap-2">
 {parseMonto(pagoForm.efectivo) > 0 && (
 <div className="flex items-center justify-between p-2.5 rounded-md border bg-muted/30">
 <span className="text-xs text-muted-foreground">Efectivo</span>
 <span className="text-xs font-semibold">{formatCurrency(parseMonto(pagoForm.efectivo))}</span>
 </div>
 )}
 {parseMonto(pagoForm.dolares) > 0 && (
 <div className="flex items-center justify-between p-2.5 rounded-md border bg-muted/30">
 <span className="text-xs text-muted-foreground">Dólares</span>
 <span className="text-xs font-semibold">{formatCurrency(parseMonto(pagoForm.dolares))}</span>
 </div>
 )}
 {parseMonto(pagoForm.transferencia) > 0 && (
 <div className="flex items-center justify-between p-2.5 rounded-md border bg-muted/30">
 <span className="text-xs text-muted-foreground">Transferencia</span>
 <span className="text-xs font-semibold">{formatCurrency(parseMonto(pagoForm.transferencia))}</span>
 </div>
 )}
 {parseMonto(pagoForm.chequesTerceros) > 0 && (
 <div className="flex items-center justify-between p-2.5 rounded-md border bg-muted/30">
 <span className="text-xs text-muted-foreground">Ch. Terceros</span>
 <span className="text-xs font-semibold">{formatCurrency(parseMonto(pagoForm.chequesTerceros))}</span>
 </div>
 )}
 {parseMonto(pagoForm.chequesPropios) > 0 && (
 <div className="flex items-center justify-between p-2.5 rounded-md border bg-muted/30">
 <span className="text-xs text-muted-foreground">Ch. Propios</span>
 <span className="text-xs font-semibold">{formatCurrency(parseMonto(pagoForm.chequesPropios))}</span>
 </div>
 )}
 </div>
 </div>

 {/* Cheques de terceros - DETALLE COMPLETO */}
 {selectedCheques.length > 0 && (
 <div className="space-y-2">
 <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
 <CreditCard className="w-3.5 h-3.5" />
 Cheques a Entregar
 <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{selectedCheques.length}</Badge>
 </p>
 <div className="border rounded-md overflow-hidden">
 <Table>
 <TableHeader>
 <TableRow className="bg-muted/30 hover:bg-muted/30">
 <TableHead className="text-xs font-medium h-7 px-2">Tipo</TableHead>
 <TableHead className="text-xs font-medium h-7 px-2">Número</TableHead>
 <TableHead className="text-xs font-medium h-7 px-2">Banco</TableHead>
 <TableHead className="text-xs font-medium h-7 px-2 text-center">Venc.</TableHead>
 <TableHead className="text-xs font-medium h-7 px-2 text-right">Importe</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {chequesCartera.filter(ch => selectedCheques.includes(ch.id)).map(ch => (
 <TableRow key={ch.id} className="hover:bg-muted/30">
 <TableCell className="text-xs py-1.5 px-2">
 <Badge variant="outline" className="text-[9px] px-1.5 py-0">
 {ch.tipo === 'ECHEQ' ? 'eCheq' : 'Cheque'}
 </Badge>
 </TableCell>
 <TableCell className="text-xs py-1.5 px-2 font-mono">{ch.numero}</TableCell>
 <TableCell className="text-xs py-1.5 px-2 text-muted-foreground">{ch.banco}</TableCell>
 <TableCell className="text-xs py-1.5 px-2 text-center text-muted-foreground">
 {formatDate(ch.fechaVencimiento)}
 </TableCell>
 <TableCell className="text-xs py-1.5 px-2 text-right font-semibold">
 {formatCurrency(ch.importe)}
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 </div>
 )}

 {/* Retenciones */}
 {(parseMonto(pagoForm.retIVA) > 0 || parseMonto(pagoForm.retGanancias) > 0 || parseMonto(pagoForm.retIngBrutos) > 0) && (
 <div className="space-y-2">
 <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
 <FileText className="w-3.5 h-3.5" />
 Retenciones
 </p>
 <div className="grid grid-cols-3 gap-2">
 {parseMonto(pagoForm.retIVA) > 0 && (
 <div className="flex items-center justify-between p-2 rounded-md border bg-muted/30">
 <span className="text-[10px] text-muted-foreground">IVA</span>
 <span className="text-xs font-semibold">{formatCurrency(parseMonto(pagoForm.retIVA))}</span>
 </div>
 )}
 {parseMonto(pagoForm.retGanancias) > 0 && (
 <div className="flex items-center justify-between p-2 rounded-md border bg-muted/30">
 <span className="text-[10px] text-muted-foreground">Ganancias</span>
 <span className="text-xs font-semibold">{formatCurrency(parseMonto(pagoForm.retGanancias))}</span>
 </div>
 )}
 {parseMonto(pagoForm.retIngBrutos) > 0 && (
 <div className="flex items-center justify-between p-2 rounded-md border bg-muted/30">
 <span className="text-[10px] text-muted-foreground">IIBB</span>
 <span className="text-xs font-semibold">{formatCurrency(parseMonto(pagoForm.retIngBrutos))}</span>
 </div>
 )}
 </div>
 </div>
 )}

 {/* Facturas */}
 <div className="space-y-2">
 <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
 <FileText className="w-3.5 h-3.5" />
 Facturas a Pagar
 <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{selectedFacturas.length}</Badge>
 </p>
 <div className="border rounded-md overflow-hidden">
 <Table>
 <TableHeader>
 <TableRow className="bg-muted/30 hover:bg-muted/30">
 <TableHead className="text-xs font-medium h-7 px-3">Factura</TableHead>
 <TableHead className="text-xs font-medium text-right h-7 px-3">Total</TableHead>
 <TableHead className="text-xs font-medium text-right h-7 px-3">Aplicado</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {selectedFacturas.map(id => {
 const f = facturas.find(x => x.id === id);
 if (!f) return null;
 const monto = getMontoAPagar(id);
 const isParcial = monto < f.saldo;
 return (
 <TableRow key={id} className="hover:bg-muted/30">
 <TableCell className="text-xs font-medium py-1.5 px-3">
 <span className="flex items-center gap-1.5">
 {f.numero}
 {isParcial && <Badge className="bg-warning-muted text-warning-muted-foreground text-[8px] px-1 py-0">Parcial</Badge>}
 </span>
 </TableCell>
 <TableCell className="text-xs text-right py-1.5 px-3 text-muted-foreground">
 {formatCurrency(f.total)}
 </TableCell>
 <TableCell className="text-xs text-right py-1.5 px-3 font-medium text-success">
 {formatCurrency(monto)}
 </TableCell>
 </TableRow>
 );
 })}
 </TableBody>
 </Table>
 </div>
 </div>

 {/* Descuentos aplicados */}
 {(totalAnticiposSeleccionados > 0 || totalNotasCreditoSeleccionadas > 0) && (
 <div className="space-y-2">
 <p className="text-xs font-medium text-muted-foreground">Descuentos Aplicados</p>
 <div className="grid grid-cols-2 gap-2">
 {totalAnticiposSeleccionados > 0 && (
 <div className="flex items-center justify-between p-2.5 rounded-md border border-success-muted bg-success-muted">
 <span className="text-xs text-success">Anticipos ({anticiposSeleccionados.length})</span>
 <span className="text-xs font-semibold text-success">-{formatCurrency(totalAnticiposSeleccionados)}</span>
 </div>
 )}
 {totalNotasCreditoSeleccionadas > 0 && (
 <div className="flex items-center justify-between p-2.5 rounded-md border border-success-muted bg-success-muted">
 <span className="text-xs text-success">Notas Crédito ({selectedNotasCredito.length})</span>
 <span className="text-xs font-semibold text-success">-{formatCurrency(totalNotasCreditoSeleccionadas)}</span>
 </div>
 )}
 </div>
 </div>
 )}

 {/* Anticipo generado */}
 {anticipo > 0 && (
 <div className="flex items-center justify-between p-3 bg-info-muted border border-info-muted rounded-lg">
 <div className="flex items-center gap-2">
 <DollarSign className="w-4 h-4 text-info-muted-foreground" />
 <span className="text-sm font-medium text-info-muted-foreground ">Anticipo Generado</span>
 </div>
 <span className="text-lg font-bold text-info-muted-foreground">{formatCurrency(anticipo)}</span>
 </div>
 )}

 {/* Warning */}
 {diferencia !== 0 && anticipo === 0 && (
 <div className="flex items-start gap-2 p-3 rounded-md bg-warning-muted border border-warning-muted">
 <AlertCircle className="w-4 h-4 text-warning-muted-foreground mt-0.5" />
 <div className="text-xs text-warning-muted-foreground">
 <p className="font-medium">Los montos no coinciden</p>
 <p className="text-muted-foreground">
 Diferencia: {formatCurrency(Math.abs(diferencia))} {diferencia > 0 ? '(pagás de más)' : '(pagás de menos)'}
 </p>
 </div>
 </div>
 )}
 </DialogBody>

 {/* Footer */}
 <DialogFooter className="justify-between bg-muted/20">
 <Button variant="ghost" size="sm" onClick={() => setShowConfirmDialog(false)} disabled={submitting}>
 Volver
 </Button>
 <Button size="sm" onClick={handleSubmit} disabled={submitting}>
 {submitting ? (
 <>
 <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
 Registrando...
 </>
 ) : (
 <>
 <CheckCircle2 className="w-3.5 h-3.5 mr-2" />
 Confirmar Pago
 </>
 )}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* Success Dialog - After payment completion */}
 <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
 <DialogContent size="default" className="p-0 gap-0">
 {/* Header with success badge */}
 <div className="bg-primary/5 border-b px-4 py-3">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="p-2 rounded-lg bg-success-muted">
 <CheckCircle2 className="w-4 h-4 text-success" />
 </div>
 <div>
 <p className="text-xs text-muted-foreground">
 {savedPaymentData?.esAnticipoPuro ? 'Anticipo Registrado' : 'Orden de Pago'}
 </p>
 <p className="text-sm font-semibold">#{savedPaymentData?.id}</p>
 </div>
 </div>
 <div className="text-right">
 <p className="text-xs text-muted-foreground">Fecha</p>
 <p className="text-sm font-medium">
 {savedPaymentData?.fecha ? format(new Date(savedPaymentData.fecha), 'd/M/yyyy') : '-'}
 </p>
 </div>
 </div>
 </div>

 {/* Content */}
 <DialogBody className="space-y-4">
 {/* Total pagado - destacado */}
 <div className="flex items-center justify-between p-3 bg-success-muted border border-success-muted rounded-lg">
 <div className="flex items-center gap-2">
 <Banknote className="w-4 h-4 text-success" />
 <span className="text-sm font-medium text-success-muted-foreground ">
 {savedPaymentData?.esAnticipoPuro ? 'Total Anticipo' : 'Total Pagado'}
 </span>
 </div>
 <span className="text-lg font-bold text-success">
 {savedPaymentData ? formatCurrency(savedPaymentData.totalPago) : '-'}
 </span>
 </div>

 {/* Proveedor */}
 <div className="flex items-center justify-between p-2.5 rounded-md border bg-muted/30">
 <span className="text-xs text-muted-foreground flex items-center gap-1.5">
 <Building className="w-3.5 h-3.5" />
 Proveedor
 </span>
 <span className="text-sm font-semibold">{savedPaymentData?.proveedor}</span>
 </div>

 {/* Medios de pago */}
 {savedPaymentData && savedPaymentData.mediosPago.length > 0 && (
 <div className="space-y-2">
 <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
 <CreditCard className="w-3.5 h-3.5" />
 Medios de Pago
 </p>
 <div className="grid grid-cols-2 gap-2">
 {savedPaymentData.mediosPago.map((mp, idx) => (
 <div key={idx} className="flex items-center justify-between p-2.5 rounded-md border bg-muted/30">
 <span className="text-xs text-muted-foreground">{mp.tipo}</span>
 <span className="text-xs font-semibold">{formatCurrency(mp.monto)}</span>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Cheques entregados - DETALLE COMPLETO */}
 {savedPaymentData && savedPaymentData.cheques.length > 0 && (
 <div className="space-y-2">
 <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
 <CreditCard className="w-3.5 h-3.5" />
 Cheques Entregados
 <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{savedPaymentData.cheques.length}</Badge>
 </p>
 <div className="border rounded-md overflow-hidden">
 <Table>
 <TableHeader>
 <TableRow className="bg-muted/30 hover:bg-muted/30">
 <TableHead className="text-xs font-medium h-7 px-2">Tipo</TableHead>
 <TableHead className="text-xs font-medium h-7 px-2">Número</TableHead>
 <TableHead className="text-xs font-medium h-7 px-2">Banco</TableHead>
 <TableHead className="text-xs font-medium h-7 px-2 text-center">Venc.</TableHead>
 <TableHead className="text-xs font-medium h-7 px-2 text-right">Importe</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {savedPaymentData.cheques.map((ch, idx) => (
 <TableRow key={idx} className="hover:bg-muted/30">
 <TableCell className="text-xs py-1.5 px-2">
 <Badge variant="outline" className="text-[9px] px-1.5 py-0">
 {ch.tipo === 'ECHEQ' ? 'eCheq' : 'Cheque'}
 </Badge>
 </TableCell>
 <TableCell className="text-xs py-1.5 px-2 font-mono">{ch.numero}</TableCell>
 <TableCell className="text-xs py-1.5 px-2 text-muted-foreground">{ch.banco}</TableCell>
 <TableCell className="text-xs py-1.5 px-2 text-center text-muted-foreground">
 {ch.vencimiento ? format(new Date(ch.vencimiento), 'd/M/yyyy') : '-'}
 </TableCell>
 <TableCell className="text-xs py-1.5 px-2 text-right font-semibold">
 {formatCurrency(ch.importe)}
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 </div>
 )}

 {/* Comprobantes adjuntos */}
 {savedPaymentData && savedPaymentData.comprobantes && savedPaymentData.comprobantes.length > 0 && (
 <div className="space-y-2">
 <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
 <Paperclip className="w-3.5 h-3.5" />
 Comprobantes adjuntos
 <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{savedPaymentData.comprobantes.length}</Badge>
 </p>
 <div className="space-y-1">
 {savedPaymentData.comprobantes.map((comp, idx) => (
 <a
 key={idx}
 href={comp.fileUrl}
 target="_blank"
 rel="noopener noreferrer"
 className="flex items-center gap-2 p-2 rounded-md border bg-info-muted/50 hover:bg-info-muted/50 transition-colors text-xs"
 >
 <FileText className="w-3.5 h-3.5 text-info-muted-foreground" />
 <span className="flex-1 truncate text-info-muted-foreground">{comp.fileName}</span>
 <span className="text-[10px] text-info-muted-foreground">Ver</span>
 </a>
 ))}
 </div>
 </div>
 )}

 {/* Retenciones */}
 {savedPaymentData && savedPaymentData.retenciones.length > 0 && (
 <div className="space-y-2">
 <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
 <FileText className="w-3.5 h-3.5" />
 Retenciones
 </p>
 <div className="grid grid-cols-3 gap-2">
 {savedPaymentData.retenciones.map((ret, idx) => (
 <div key={idx} className="flex items-center justify-between p-2 rounded-md border bg-muted/30">
 <span className="text-[10px] text-muted-foreground">{ret.tipo}</span>
 <span className="text-xs font-semibold">{formatCurrency(ret.monto)}</span>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Facturas aplicadas */}
 {savedPaymentData && savedPaymentData.facturas.length > 0 && (
 <div className="space-y-2">
 <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
 <FileText className="w-3.5 h-3.5" />
 Facturas Aplicadas
 <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{savedPaymentData.facturas.length}</Badge>
 </p>
 <div className="border rounded-md overflow-hidden">
 <Table>
 <TableHeader>
 <TableRow className="bg-muted/30 hover:bg-muted/30">
 <TableHead className="text-xs font-medium h-7 px-3">Factura</TableHead>
 <TableHead className="text-xs font-medium text-right h-7 px-3">Total</TableHead>
 <TableHead className="text-xs font-medium text-right h-7 px-3">Aplicado</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {savedPaymentData.facturas.map((f, idx) => (
 <TableRow key={idx} className="hover:bg-muted/30">
 <TableCell className="text-xs font-medium py-1.5 px-3">{f.numero}</TableCell>
 <TableCell className="text-xs text-right py-1.5 px-3 text-muted-foreground">
 {formatCurrency(f.total)}
 </TableCell>
 <TableCell className="text-xs text-right py-1.5 px-3 font-medium text-success">
 {formatCurrency(f.aplicado)}
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 </div>
 )}

 {/* Anticipo generado */}
 {savedPaymentData && savedPaymentData.anticipo > 0 && (
 <div className="p-3 bg-info-muted border border-info-muted rounded-lg space-y-1">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <DollarSign className="w-4 h-4 text-info-muted-foreground" />
 <span className="text-sm font-medium text-info-muted-foreground ">
 {savedPaymentData.esAnticipoPuro ? 'Anticipo Registrado' : 'Anticipo Generado'}
 </span>
 </div>
 <span className="text-lg font-bold text-info-muted-foreground">{formatCurrency(savedPaymentData.anticipo)}</span>
 </div>
 {savedPaymentData.esAnticipoPuro && (
 <p className="text-xs text-info-muted-foreground ">
 Este monto queda como saldo a favor y podrá usarse para pagar facturas futuras.
 </p>
 )}
 </div>
 )}
 </DialogBody>

 {/* Footer with print button */}
 <DialogFooter className="justify-between bg-muted/20">
 <Button variant="ghost" size="sm" onClick={handleCloseSuccess}>
 Cerrar
 </Button>
 <Button size="sm" onClick={handlePrintPDF}>
 <Printer className="w-3.5 h-3.5 mr-2" />
 Imprimir PDF
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </>
 );
}
