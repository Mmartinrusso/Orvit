'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
 Table, 
 TableBody, 
 TableCell, 
 TableHead, 
 TableHeader, 
 TableRow 
} from '@/components/ui/table';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogFooter,
 DialogHeader,
 DialogTitle,
 DialogBody,
} from '@/components/ui/dialog';
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
import {
 Plus,
 Trash2,
 Check,
 ChevronsUpDown,
 Edit,
 CheckCircle,
 FileText,
 AlertCircle
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { cn, formatNumber } from '@/lib/utils';
import { useViewMode } from '@/contexts/ViewModeContext';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';

interface Proveedor {
 id: string;
 nombre: string;
 razonSocial: string;
 cuit: string;
}

interface ProveedorItem {
 id: string;
 nombre: string;
 descripcion?: string;
 codigoProveedor?: string;
 unidad: string;
 precioUnitario?: number;
 proveedorId: string;
 // Datos de stock (para mostrar nombre real usado en recepciones)
 stockLocations?: Array<{
 descripcionItem?: string;
 codigoPropio?: string;
 codigoProveedor?: string;
 }>;
}

// Datos pre-llenados desde extracción IA
interface PrefilledData {
 proveedorId?: number;
 tipo?: string;
 numeroSerie?: string;
 numeroFactura?: string;
 fechaEmision?: string;
 fechaVencimiento?: string;
 neto?: number;
 iva21?: number;
 iva105?: number;
 iva27?: number;
 noGravado?: number;
 exento?: number;
 percepcionIVA?: number;
 percepcionIIBB?: number;
 otrosConceptos?: number;
 total?: number;
 cae?: string;
 fechaVtoCae?: string;
 moneda?: string;
 warnings?: string[];
}

interface ComprobanteFormModalProps {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 comprobanteId?: string | null; // Si viene, es modo edición
 editDocType?: 'T1' | 'T2' | null; // DocType del comprobante a editar (evita colisión de IDs T1/T2)
 defaultProveedorId?: string | null; // Proveedor preseleccionado para nuevo comprobante
 prefilledData?: PrefilledData; // Datos extraídos de PDF/IA
 onSaved?: () => void; // Callback cuando se guarda exitosamente
}

// Tipos de comprobantes T1 (documentados/fiscales) - siempre disponibles
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

// Additional document types available for configuration
export const TIPOS_CFG_DISPONIBLES = [
 'Presupuesto',
 'Remito Sin Factura',
 'Comprobante Interno',
 'Vale',
 'Ticket',
];

export default function ComprobanteFormModal({
 open,
 onOpenChange,
 comprobanteId,
 editDocType,
 defaultProveedorId,
 prefilledData,
 onSaved
}: ComprobanteFormModalProps) {
 // Mode context - get mode and configured types
 const { mode: viewMode, ct } = useViewMode();
 const confirm = useConfirm();

 // Helper to determine docType based on document type
 const getDocTypeFromTipo = (tipo: string): 'T1' | 'T2' => {
 return ct.includes(tipo) ? 'T2' : 'T1';
 };

 // Helper para detectar si es Nota de Crédito o Débito
 const isNotaCredito = (tipo: string) => tipo.startsWith('Nota de Crédito');
 const isNotaDebito = (tipo: string) => tipo.startsWith('Nota de Débito');
 const isNotaCreditoDebito = (tipo: string) => isNotaCredito(tipo) || isNotaDebito(tipo);

 // Tipos de NCA disponibles
 const tiposNca = [
 { value: 'NCA_DESCUENTO', label: 'Descuento' },
 { value: 'NCA_PRECIO', label: 'Diferencia de Precio' },
 { value: 'NCA_FALTANTE', label: 'Faltante de Mercadería' },
 { value: 'NCA_CALIDAD', label: 'Problema de Calidad' },
 { value: 'NCA_DEVOLUCION', label: 'Devolución de Mercadería' },
 { value: 'NCA_OTRO', label: 'Otro' },
 ];

 // Form state
 const [formData, setFormData] = useState({
 numeroSerie: '',
 numeroFactura: '',
 tipo: '',
 proveedorId: '',
 proveedorSearch: '',
 fechaEmision: new Date().toISOString().split('T')[0],
 fechaVencimiento: '',
 fechaImputacion: new Date().toISOString().split('T')[0],
 tipoPago: 'cta_cte' as 'contado' | 'cta_cte',
 metodoPago: '',
 items: [] as Array<{
 id: string;
 itemId?: string;
 descripcion: string;
 codigoProveedor?: string;
 cantidad: string;
 unidad: string;
 precioUnitario: string;
 subtotal: string;
 proveedorId: string;
 }>,
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
 tipoCuenta: '',
 observaciones: '',
 // Campos para Notas de Crédito/Débito
 tipoNca: '' as string, // Solo para NC: NCA_DESCUENTO, NCA_PRECIO, etc.
 purchaseReturnId: '' as string, // Solo para NCA_DEVOLUCION
 facturaVinculadaId: '' as string, // Factura de referencia (opcional)
 motivo: '' as string, // Motivo de la NC/ND
 // Clasificación como Costo Indirecto (Costos V2)
 esIndirecto: false,
 indirectCategory: '' as string,
 });

 const [proveedores, setProveedores] = useState<Proveedor[]>([]);
 const [proveedorSearchResults, setProveedorSearchResults] = useState<Proveedor[]>([]);
 const [proveedorPopoverOpen, setProveedorPopoverOpen] = useState(false);
 const [proveedorItems, setProveedorItems] = useState<ProveedorItem[]>([]);
 const [loadingItems, setLoadingItems] = useState(false);
 const [itemPopoverOpen, setItemPopoverOpen] = useState<Record<string, boolean>>({});
 const [isCreateItemModalOpen, setIsCreateItemModalOpen] = useState(false);
 const [creatingItemFor, setCreatingItemFor] = useState<string>('');
 const [editingProveedorItem, setEditingProveedorItem] = useState<ProveedorItem | null>(null);
 const [newItemForm, setNewItemForm] = useState({
 nombre: '',
 descripcion: '',
 codigoProveedor: '',
 unidad: '',
 precioUnitario: '',
 });
 const [cuentas, setCuentas] = useState<Array<{ id: string; nombre: string; descripcion?: string; activa: boolean }>>([]);
 const [loadingCuentas, setLoadingCuentas] = useState(false);
 const [cuentaPopoverOpen, setCuentaPopoverOpen] = useState(false);
 const [isCuentaModalOpen, setIsCuentaModalOpen] = useState(false);
 const [editingCuenta, setEditingCuenta] = useState<{ id: string; nombre: string; descripcion?: string } | null>(null);
 const [cuentaForm, setCuentaForm] = useState({
 nombre: '',
 descripcion: '',
 });
 const [cuentaSearch, setCuentaSearch] = useState('');
 const [iva21Manual, setIva21Manual] = useState(false);
 // Buffer de tipeo para campos monetarios — evita que formatMoney interfiera mientras se tipea
 const [rawInputs, setRawInputs] = useState<Record<string, string>>({});
 const startRawEdit = (id: string, raw: string) =>
   setRawInputs(prev => ({ ...prev, [id]: raw }));
 const stopRawEdit = (id: string) =>
   setRawInputs(prev => { const n = { ...prev }; delete n[id]; return n; });

 // Estado para Conceptos del Gasto Indirecto
 const [conceptos, setConceptos] = useState<Array<{ id: string; descripcion: string; monto: string }>>([]);

 // Estado para Notas de Crédito/Débito
 const [devoluciones, setDevoluciones] = useState<Array<{
 id: number;
 numero: string;
 estado: string;
 motivo: string;
 fechaSolicitud: string;
 _count: { items: number };
 }>>([]);
 const [loadingDevoluciones, setLoadingDevoluciones] = useState(false);
 const [facturasProveedor, setFacturasProveedor] = useState<Array<{
 id: number;
 numero_factura: string;
 punto_venta: string;
 monto_total: number;
 fecha: string;
 }>>([]);
 const [devolucionPopoverOpen, setDevolucionPopoverOpen] = useState(false);
 const [facturaVinculadaPopoverOpen, setFacturaVinculadaPopoverOpen] = useState(false);

 const [dateInputValues, setDateInputValues] = useState<{
 fechaEmision: string;
 fechaVencimiento: string;
 fechaImputacion: string;
 }>({
 fechaEmision: '',
 fechaVencimiento: '',
 fechaImputacion: '',
 });

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
 // quitar separadores de miles y normalizar decimal
 const cleaned = raw.replace(/\./g, '').replace(',', '.');
 return cleaned;
 };

 // Cargar comprobante para editar o resetear formulario
 useEffect(() => {
 if (open && comprobanteId) {
 loadComprobanteParaEditar(comprobanteId);
 } else if (open && !comprobanteId) {
 resetForm();

 // Si hay un proveedor preseleccionado, cargarlo
 if (defaultProveedorId) {
 loadDefaultProveedor(defaultProveedorId);
 }
 }
 }, [open, comprobanteId, defaultProveedorId]);

 // Estado para indicar si los datos vienen de IA
 const [isFromAI, setIsFromAI] = useState(false);

 // Aplicar datos pre-llenados de extracción IA
 useEffect(() => {
 if (open && prefilledData && !comprobanteId) {
 setIsFromAI(true);

 // Mapear tipo del sistema al tipo de display
 const mapTipoToDisplay = (tipo: string): string => {
 const map: Record<string, string> = {
 'FACTURA_A': 'Factura A',
 'FACTURA_B': 'Factura B',
 'FACTURA_C': 'Factura C',
 'NC_A': 'Nota de Crédito A',
 'NC_B': 'Nota de Crédito B',
 'NC_C': 'Nota de Crédito C',
 'ND_A': 'Nota de Débito A',
 'ND_B': 'Nota de Débito B',
 'ND_C': 'Nota de Débito C'
 };
 return map[tipo] || tipo;
 };

 setFormData(prev => ({
 ...prev,
 proveedorId: prefilledData.proveedorId ? String(prefilledData.proveedorId) : prev.proveedorId || '',
 tipo: prefilledData.tipo ? mapTipoToDisplay(prefilledData.tipo) : '',
 numeroSerie: prefilledData.numeroSerie || '',
 numeroFactura: prefilledData.numeroFactura || '',
 fechaEmision: prefilledData.fechaEmision || new Date().toISOString().split('T')[0],
 fechaVencimiento: prefilledData.fechaVencimiento || '',
 fechaImputacion: prefilledData.fechaEmision || new Date().toISOString().split('T')[0],
 neto: prefilledData.neto ? String(prefilledData.neto) : '',
 iva21: prefilledData.iva21 ? String(prefilledData.iva21) : '',
 iva105: prefilledData.iva105 ? String(prefilledData.iva105) : '',
 iva27: prefilledData.iva27 ? String(prefilledData.iva27) : '',
 noGravado: prefilledData.noGravado ? String(prefilledData.noGravado) : '',
 exento: prefilledData.exento ? String(prefilledData.exento) : '',
 percepcionIVA: prefilledData.percepcionIVA ? String(prefilledData.percepcionIVA) : '',
 percepcionIIBB: prefilledData.percepcionIIBB ? String(prefilledData.percepcionIIBB) : '',
 otrosConceptos: prefilledData.otrosConceptos ? String(prefilledData.otrosConceptos) : '',
 total: prefilledData.total ? String(prefilledData.total) : '',
 tipoPago: prefilledData.fechaVencimiento ? 'cta_cte' : 'contado',
 }));

 // Actualizar valores de fecha formateados
 setDateInputValues({
 fechaEmision: prefilledData.fechaEmision ? formatDateToDDMMYYYY(prefilledData.fechaEmision) : '',
 fechaVencimiento: prefilledData.fechaVencimiento ? formatDateToDDMMYYYY(prefilledData.fechaVencimiento) : '',
 fechaImputacion: prefilledData.fechaEmision ? formatDateToDDMMYYYY(prefilledData.fechaEmision) : '',
 });

 // Mostrar warnings si los hay
 if (prefilledData.warnings && prefilledData.warnings.length > 0) {
 setTimeout(() => {
 toast.warning(`Atención: ${prefilledData.warnings![0]}${prefilledData.warnings!.length > 1 ? ` (+${prefilledData.warnings!.length - 1} más)` : ''}`);
 }, 500);
 }

 // Si hay proveedorId, cargar los items del proveedor
 if (prefilledData.proveedorId) {
 loadProveedorItems(String(prefilledData.proveedorId));
 }
 }
 }, [open, prefilledData, comprobanteId]);

 // Cargar datos iniciales (proveedores y cuentas)
 useEffect(() => {
 if (open) {
 loadProveedores();
 loadCuentas();
 
 // Solo inicializar fechaImputacion si NO estamos en modo edición
 if (!comprobanteId) {
 const todayISO = new Date().toISOString().split('T')[0];
 setFormData(prev => {
 // Solo actualizar si no tiene fechaImputacion
 if (!prev.fechaImputacion) {
 return {
 ...prev,
 fechaImputacion: todayISO
 };
 }
 return prev;
 });
 setDateInputValues(prev => {
 // Solo actualizar si no tiene fechaImputacion
 if (!prev.fechaImputacion) {
 return {
 ...prev,
 fechaImputacion: formatDateToDDMMYYYY(todayISO)
 };
 }
 return prev;
 });
 }
 }
 }, [open]);

 const loadComprobanteParaEditar = async (id: string) => {
 try {
 const dtParam = editDocType ? `?docType=${editDocType}` : '';
 const response = await fetch(`/api/compras/comprobantes/${id}${dtParam}`);
 if (!response.ok) {
 throw new Error('Error al obtener el comprobante para editar');
 }
 const c = await response.json();
 
 // Obtener nombre del proveedor para mostrar en el selector
 const proveedorNombre = c.proveedor?.razon_social || c.proveedor?.name || '';
 
 // Mapear datos del backend al formData del modal
 const mappedFormData = {
 numeroSerie: c.numeroSerie || '',
 numeroFactura: c.numeroFactura || '',
 tipo: c.tipo || '',
 proveedorId: c.proveedorId ? String(c.proveedorId) : '',
 proveedorSearch: proveedorNombre,
 fechaEmision: c.fechaEmision,
 fechaVencimiento: c.fechaVencimiento || '',
 fechaImputacion: c.fechaImputacion,
 tipoPago: c.tipoPago || 'cta_cte',
 metodoPago: c.metodoPago || '',
 items: (c.items || []).filter((i: any) => i.itemId !== null).map((i: any) => {
 const mappedItem = {
 id: String(i.id),
 itemId: i.itemId ? String(i.itemId) : undefined,
 descripcion: i.descripcion || '',
 codigoProveedor: i.supplierItem?.codigoProveedor || undefined,
 cantidad: i.cantidad != null ? (Number(i.cantidad) > 0 ? Number(i.cantidad).toFixed(2) : '') : '',
 unidad: i.unidad || '',
 precioUnitario: i.precioUnitario != null ? (Number(i.precioUnitario) > 0 ? Number(i.precioUnitario).toFixed(2) : '') : '',
 subtotal: i.subtotal != null ? (Number(i.subtotal) > 0 ? Number(i.subtotal).toFixed(2) : '') : '',
 proveedorId: i.proveedorId ? String(i.proveedorId) : '',
 };
 return mappedItem;
 }),
 neto: c.neto != null ? (Number(c.neto) > 0 ? Number(c.neto).toFixed(2) : '') : '',
 iva21: c.iva21 != null && Number(c.iva21) !== 0 ? Number(c.iva21).toFixed(2) : '',
 noGravado: c.noGravado != null && Number(c.noGravado) !== 0 ? Number(c.noGravado).toFixed(2) : '',
 impInter: c.impInter != null && Number(c.impInter) !== 0 ? Number(c.impInter).toFixed(2) : '',
 percepcionIVA: c.percepcionIVA != null && Number(c.percepcionIVA) !== 0 ? Number(c.percepcionIVA).toFixed(2) : '',
 percepcionIIBB: c.percepcionIIBB != null && Number(c.percepcionIIBB) !== 0 ? Number(c.percepcionIIBB).toFixed(2) : '',
 otrosConceptos: c.otrosConceptos != null && Number(c.otrosConceptos) !== 0 ? Number(c.otrosConceptos).toFixed(2) : '',
 iva105: c.iva105 != null && Number(c.iva105) !== 0 ? Number(c.iva105).toFixed(2) : '',
 iva27: c.iva27 != null && Number(c.iva27) !== 0 ? Number(c.iva27).toFixed(2) : '',
 exento: c.exento != null && Number(c.exento) !== 0 ? Number(c.exento).toFixed(2) : '',
 iibb: c.iibb != null && Number(c.iibb) !== 0 ? Number(c.iibb).toFixed(2) : '',
 total: c.total != null ? Number(c.total).toFixed(2) : '0.00',
 tipoCuenta: c.tipoCuentaId ? String(c.tipoCuentaId) : '',
 observaciones: c.observaciones || '',
 esIndirecto: c.esIndirecto ?? false,
 indirectCategory: c.indirectCategory ?? '',
 };

 // Inicializar dateInputValues para mostrar fechas en formato dd/mm/yyyy
 const fechaEmisionFormatted = c.fechaEmision ? formatDateToDDMMYYYY(c.fechaEmision) : '';
 const fechaVencimientoFormatted = c.fechaVencimiento ? formatDateToDDMMYYYY(c.fechaVencimiento) : '';
 const fechaImputacionFormatted = c.fechaImputacion ? formatDateToDDMMYYYY(c.fechaImputacion) : '';
 
 setDateInputValues({
 fechaEmision: fechaEmisionFormatted,
 fechaVencimiento: fechaVencimientoFormatted,
 fechaImputacion: fechaImputacionFormatted,
 });

 // Detectar si el IVA 21% fue editado manualmente
 // Si el IVA 21% no es exactamente el 21% del neto, fue editado manualmente
 const netoNum = Number(c.neto) || 0;
 const iva21Num = Number(c.iva21) || 0;
 const iva21Calculado = netoNum * 0.21;
 const diferenciaIVA = Math.abs(iva21Num - iva21Calculado);
 // Si la diferencia es mayor a 0.01, fue editado manualmente
 const isIva21Manual = diferenciaIVA > 0.01;
 setIva21Manual(isIva21Manual);

 // Establecer el formData
 setFormData(mappedFormData);

 // Cargar conceptos indirectos (items con itemId=null)
 const conceptosIniciales = (c.items || [])
 .filter((i: any) => i.itemId === null)
 .map((i: any) => ({
 id: String(i.id),
 descripcion: i.descripcion || '',
 monto: i.precioUnitario != null && Number(i.precioUnitario) > 0
 ? Number(i.precioUnitario).toFixed(2)
 : '',
 }));
 setConceptos(conceptosIniciales);

 // Recalcular totales con los datos mapeados directamente
 calculateTotal(mappedFormData, isIva21Manual);

 // Cargar items del proveedor si hay uno seleccionado
 if (c.proveedorId) {
 loadProveedorItems(String(c.proveedorId));
 }
 } catch (error) {
 console.error('Error cargando comprobante para editar:', error);
 toast.error('No se pudo cargar el comprobante para editar');
 }
 };

 const loadProveedores = async () => {
 try {
 const response = await fetch('/api/compras/proveedores');
 if (!response.ok) {
 throw new Error('Error al obtener proveedores');
 }
 const data = await response.json();
 const mapped: Proveedor[] = (data || []).map((p: any) => ({
 id: String(p.id),
 nombre: p.name,
 razonSocial: p.razon_social || p.name,
 cuit: p.cuit || '',
 }));
 setProveedores(mapped);
 setProveedorSearchResults(mapped);
 } catch (error) {
 console.error('Error loading proveedores:', error);
 toast.error('Error al cargar proveedores');
 setProveedores([]);
 setProveedorSearchResults([]);
 }
 };

 const loadCuentas = async () => {
 setLoadingCuentas(true);
 try {
 const response = await fetch('/api/compras/cuentas');
 if (response.ok) {
 const data = await response.json();
 setCuentas(data.filter((c: any) => c.activa));
 }
 } catch (error) {
 console.error('Error loading cuentas:', error);
 toast.error('Error al cargar las cuentas');
 } finally {
 setLoadingCuentas(false);
 }
 };

 // Cargar devoluciones del proveedor (para NCA_DEVOLUCION)
 const loadDevolucionesProveedor = async (provId: string) => {
 if (!provId) {
 setDevoluciones([]);
 return;
 }
 setLoadingDevoluciones(true);
 try {
 // Solo devoluciones ENVIADAS o posteriores que no tengan NCA
 const response = await fetch(`/api/compras/devoluciones?proveedorId=${provId}&sinNca=true`);
 if (response.ok) {
 const data = await response.json();
 // Filtrar solo las que están en estado válido para vincular NCA
 const devolucionesValidas = (data.devoluciones || data || []).filter((d: any) =>
 ['ENVIADA', 'RECIBIDA_PROVEEDOR'].includes(d.estado)
 );
 setDevoluciones(devolucionesValidas);
 }
 } catch (error) {
 console.error('Error loading devoluciones:', error);
 } finally {
 setLoadingDevoluciones(false);
 }
 };

 // Cargar facturas del proveedor (para vincular NC/ND)
 const loadFacturasProveedor = async (provId: string) => {
 if (!provId) {
 setFacturasProveedor([]);
 return;
 }
 try {
 const response = await fetch(`/api/compras/comprobantes?proveedorId=${provId}&tipo=Factura`);
 if (response.ok) {
 const data = await response.json();
 setFacturasProveedor(data || []);
 }
 } catch (error) {
 console.error('Error loading facturas:', error);
 }
 };

 // Cargar proveedor preseleccionado
 const loadDefaultProveedor = async (proveedorId: string) => {
 try {
 const response = await fetch(`/api/compras/proveedores/${proveedorId}`);
 if (!response.ok) {
 throw new Error('Error al obtener el proveedor');
 }
 const p = await response.json();
 const proveedorNombre = p.razon_social || p.name || '';

 setFormData(prev => ({
 ...prev,
 proveedorId: String(p.id),
 proveedorSearch: proveedorNombre,
 }));

 // Cargar items del proveedor
 loadProveedorItems(String(p.id));
 } catch (error) {
 console.error('Error loading default proveedor:', error);
 }
 };

 const loadProveedorItems = async (proveedorId: string) => {
 setLoadingItems(true);
 try {
 const response = await fetch(`/api/compras/proveedores/${proveedorId}/items`);
 if (!response.ok) {
 throw new Error('Error al obtener items del proveedor');
 }
 const data = await response.json();
 const mapped: ProveedorItem[] = (data || []).map((item: any) => ({
 id: String(item.id),
 nombre: item.nombre,
 descripcion: item.descripcion || '',
 codigoProveedor: item.codigoProveedor || undefined,
 unidad: item.unidad,
 precioUnitario: item.precioUnitario ? Number(item.precioUnitario) : undefined,
 proveedorId: String(item.supplierId),
 stockLocations: item.stockLocations || [],
 }));
 setProveedorItems(mapped);
 } catch (error) {
 console.error('Error loading proveedor items:', error);
 toast.error('Error al cargar items del proveedor');
 setProveedorItems([]);
 } finally {
 setLoadingItems(false);
 }
 };

 const handleProveedorSearch = (search: string) => {
 if (search.length >= 1) {
 const results = proveedores.filter(p =>
 p.id.toLowerCase().includes(search.toLowerCase()) ||
 p.nombre.toLowerCase().includes(search.toLowerCase()) ||
 p.razonSocial.toLowerCase().includes(search.toLowerCase()) ||
 p.cuit.includes(search)
 );
 setProveedorSearchResults(results);
 } else {
 setProveedorSearchResults(proveedores);
 }
 };

 const selectProveedor = (proveedor: Proveedor) => {
 setFormData({
 ...formData,
 proveedorId: proveedor.id,
 proveedorSearch: `${proveedor.nombre} (${proveedor.cuit})`,
 // Reset purchaseReturnId when changing proveedor
 purchaseReturnId: '',
 });
 setProveedorPopoverOpen(false);
 loadProveedorItems(proveedor.id);
 // Si es NCA_DEVOLUCION, cargar devoluciones del proveedor
 if (formData.tipoNca === 'NCA_DEVOLUCION') {
 loadDevolucionesProveedor(proveedor.id);
 }
 setTimeout(() => {
 moveToNextField('proveedor');
 }, 100);
 };

 const addItem = () => {
 if (!formData.proveedorId) {
 toast.error('Debes seleccionar un proveedor primero');
 return;
 }
 setFormData({
 ...formData,
 items: [
 ...formData.items,
 {
 id: Date.now().toString(),
 itemId: '',
 descripcion: '',
 codigoProveedor: '',
 cantidad: '',
 unidad: '',
 precioUnitario: '',
 subtotal: '',
 proveedorId: formData.proveedorId,
 },
 ],
 });
 };

 const removeItem = (itemId: string) => {
 setItemPopoverOpen(prev => {
 const updated = { ...prev };
 delete updated[itemId];
 return updated;
 });
 const updatedItems = formData.items.filter(item => item.id !== itemId);
 setFormData({
 ...formData,
 items: updatedItems,
 });
 const updatedFormData = { ...formData, items: updatedItems };
 calculateTotal(updatedFormData);
 };

 const createNewItem = async () => {
 if (!formData.proveedorId) {
 toast.error('Debes seleccionar un proveedor primero');
 return;
 }

 if (!newItemForm.nombre || !newItemForm.unidad) {
 toast.error('Debes completar al menos nombre y unidad');
 return;
 }

 try {
 const method = editingProveedorItem ? 'PUT' : 'POST';
 const url = editingProveedorItem
 ? `/api/compras/proveedores/${formData.proveedorId}/items/${editingProveedorItem.id}`
 : `/api/compras/proveedores/${formData.proveedorId}/items`;

 const response = await fetch(url, {
 method,
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 nombre: newItemForm.nombre,
 descripcion: newItemForm.descripcion || undefined,
 codigoProveedor: newItemForm.codigoProveedor || undefined,
 unidad: newItemForm.unidad,
 precioUnitario: newItemForm.precioUnitario || undefined,
 }),
 });

 if (!response.ok) {
 const errorData = await response.json().catch(() => null);
 throw new Error(errorData?.error || 'Error al crear el item');
 }

 const saved = await response.json();
 const nuevoItem: ProveedorItem = {
 id: String(saved.id),
 nombre: saved.nombre,
 descripcion: saved.descripcion || undefined,
 codigoProveedor: saved.codigoProveedor || undefined,
 unidad: saved.unidad,
 precioUnitario: saved.precioUnitario ? Number(saved.precioUnitario) : undefined,
 proveedorId: String(saved.supplierId),
 };

 if (editingProveedorItem) {
 const actualizados = proveedorItems.map((it) =>
 it.id === editingProveedorItem.id ? nuevoItem : it
 );
 setProveedorItems(actualizados);
 } else {
 setProveedorItems([...proveedorItems, nuevoItem]);
 }

 if (creatingItemFor) {
 selectItemForComprobante(creatingItemFor, nuevoItem);
 }

 setNewItemForm({
 nombre: '',
 descripcion: '',
 codigoProveedor: '',
 unidad: '',
 precioUnitario: '',
 });
 setIsCreateItemModalOpen(false);
 setCreatingItemFor('');
 setEditingProveedorItem(null);
 setItemPopoverOpen(prev => ({ ...prev, [creatingItemFor]: false }));

 toast.success(editingProveedorItem ? 'Item actualizado exitosamente' : 'Item creado exitosamente');
 } catch (error) {
 console.error('Error creating item:', error);
 toast.error('Error al crear el item');
 }
 };

 const selectItemForComprobante = (comprobanteItemId: string, proveedorItem: ProveedorItem) => {
 const updatedItems = formData.items.map(item => {
 if (item.id === comprobanteItemId) {
 // Preferir código y nombre de stockLocations (nombre real usado en recepciones)
 const codigoReal = proveedorItem.stockLocations?.[0]?.codigoProveedor || proveedorItem.codigoProveedor;
 const nombreReal = proveedorItem.stockLocations?.[0]?.descripcionItem || proveedorItem.nombre;
 const updated = {
 ...item,
 itemId: proveedorItem.id,
 descripcion: nombreReal,
 codigoProveedor: codigoReal,
 unidad: proveedorItem.unidad,
 proveedorId: proveedorItem.proveedorId,
 };
 const cantidad = parseFloat(item.cantidad) || 0;
 const precio = parseFloat(item.precioUnitario) || 0;
 updated.subtotal = (cantidad && precio ? (cantidad * precio).toFixed(2) : '');
 return updated;
 }
 return item;
 });
 const updatedFormData = { ...formData, items: updatedItems };
 setFormData(updatedFormData);
 calculateTotal(updatedFormData);
 };

 const handleCodigoProveedorChange = (itemId: string, value: string) => {
   updateItem(itemId, 'codigoProveedor', value);
 };

 const buscarItemPorCodigo = (itemId: string, value: string) => {
   if (!value.trim()) return;
   const match = proveedorItems.find(pi => {
     const cod = pi.stockLocations?.[0]?.codigoProveedor || pi.codigoProveedor;
     return cod?.toLowerCase() === value.trim().toLowerCase();
   });
   if (match) {
     selectItemForComprobante(itemId, match);
   }
   setTimeout(() => {
     const cantidadInput = document.querySelector<HTMLInputElement>(`[data-item-cantidad="${itemId}"]`);
     cantidadInput?.focus();
     cantidadInput?.select();
   }, 30);
 };

 const updateItem = (itemId: string, field: string, value: string) => {
 const updatedItems = formData.items.map(item => {
 if (item.id === itemId) {
 const updated = { ...item, [field]: value };
 if (field === 'cantidad' || field === 'precioUnitario') {
 const cantidad = field === 'cantidad' ? parseFloat(value) : parseFloat(item.cantidad);
 const precio = field === 'precioUnitario' ? parseFloat(value) : parseFloat(item.precioUnitario);
 updated.subtotal = (cantidad && precio ? (cantidad * precio).toFixed(2) : '');
 }
 return updated;
 }
 return item;
 });
 const updatedFormData = { ...formData, items: updatedItems };
 setFormData(updatedFormData);
 calculateTotal(updatedFormData);
 };

 const calculateTotal = (formDataToCalculate?: typeof formData, useIva21Manual?: boolean) => {
 const data = formDataToCalculate || formData;
 const shouldUseManualIva = useIva21Manual !== undefined ? useIva21Manual : iva21Manual;
 const itemsToCalculate = data.items;
 
 const subtotalItems = itemsToCalculate.reduce((sum, item) => {
 return sum + (parseFloat(item.subtotal) || 0);
 }, 0);

 const neto = subtotalItems;
 
 const iva21 = shouldUseManualIva
 ? (parseFloat(String(data.iva21 || '0')) || 0)
 : neto > 0
 ? Math.round(neto * 0.21 * 100) / 100
 : 0;
 const noGravado = parseFloat(String(data.noGravado || '0')) || 0;
 const impInter = parseFloat(String(data.impInter || '0')) || 0;
 const percepcionIVA = parseFloat(String(data.percepcionIVA || '0')) || 0;
 const percepcionIIBB = parseFloat(String(data.percepcionIIBB || '0')) || 0;
 const otrosConceptos = parseFloat(String(data.otrosConceptos || '0')) || 0;
 const iva105 = parseFloat(String(data.iva105 || '0')) || 0;
 const iva27 = parseFloat(String(data.iva27 || '0')) || 0;
 const exento = parseFloat(String(data.exento || '0')) || 0;
 const iibb = parseFloat(String(data.iibb || '0')) || 0;

 const total = neto + iva21 + iva105 + iva27 + noGravado + impInter + percepcionIVA + percepcionIIBB + otrosConceptos + exento + iibb;

 setFormData({ 
 ...data, 
 neto: neto > 0 ? neto.toFixed(2) : '',
 iva21: iva21 > 0 ? iva21.toFixed(2) : '',
 total: total > 0 ? total.toFixed(2) : '0.00',
 });
 };

 const handleFieldChange = (field: string, value: string) => {
 let newValue: string = value;

 // Normalizar campos monetarios para permitir puntos como separador de miles
 const moneyFields = [
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
 ];

 if (moneyFields.includes(field)) {
 newValue = normalizeMoneyInput(value);
 }

 const updated = { ...formData, [field]: newValue };
 setFormData(updated);
 calculateTotal(updated);
 };

 const formatDateToDDMMYYYY = (isoDate: string): string => {
 if (!isoDate) return '';
 
 // Si ya está en formato dd/mm/yyyy, retornarlo tal cual
 if (isoDate.includes('/') && isoDate.split('/').length === 3) {
 return isoDate;
 }
 
 try {
 // Manejar fechas ISO completas (ej: "2025-11-26T00:00:00.000Z" o "2025-11-26")
 let dateStr = isoDate;
 
 // Si tiene 'T', tomar solo la parte de la fecha
 if (dateStr.includes('T')) {
 dateStr = dateStr.split('T')[0];
 }
 
 // Si tiene espacio, tomar solo la parte de la fecha
 if (dateStr.includes(' ')) {
 dateStr = dateStr.split(' ')[0];
 }
 
 // Parsear la fecha
 const parts = dateStr.split('-');
 if (parts.length === 3) {
 const [year, month, day] = parts;
 // Limpiar el día si tiene caracteres adicionales (ej: "26T00:00:00.000Z")
 const cleanDay = day.replace(/[^0-9]/g, '');
 return `${cleanDay}/${month}/${year}`;
 }
 
 // Si no se pudo parsear con split, intentar con Date
 const date = new Date(isoDate);
 if (isNaN(date.getTime())) return '';
 
 const day = String(date.getUTCDate()).padStart(2, '0');
 const month = String(date.getUTCMonth() + 1).padStart(2, '0');
 const year = date.getUTCFullYear();
 return `${day}/${month}/${year}`;
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

 const handleDateInputChange = (field: string, value: string) => {
 let cleanValue = value.replace(/[^\d\/]/g, '');
 
 if (cleanValue === '') {
 setDateInputValues({ ...dateInputValues, [field]: '' });
 if (field !== 'fechaImputacion') {
 setFormData({ ...formData, [field]: '' });
 }
 return;
 }
 
 if (cleanValue.length === 2 && !cleanValue.includes('/')) {
 cleanValue = cleanValue + '/';
 } else if (cleanValue.length === 5 && cleanValue.split('/').length === 2) {
 if (field === 'fechaEmision' || field === 'fechaVencimiento') {
 // No agregar la tercera barra automáticamente
 } else {
 cleanValue = cleanValue + '/';
 }
 }
 
 if (cleanValue.length <= 10) {
 setDateInputValues({ ...dateInputValues, [field]: cleanValue });
 
 if (cleanValue.length === 10) {
 const isoValue = formatDDMMYYYYToISO(cleanValue);
 if (isoValue) {
 setFormData({ ...formData, [field]: isoValue });
 }
 }
 }
 };

 const handleDateEnter = (field: string, currentValue?: string) => {
 const inputValue = currentValue || dateInputValues[field as keyof typeof dateInputValues] || 
 (formData[field as keyof typeof formData] ? formatDateToDDMMYYYY(formData[field as keyof typeof formData] as string) : '');
 
 if ((field === 'fechaEmision' || field === 'fechaVencimiento') && 
 inputValue && 
 inputValue.length === 5 && 
 inputValue.includes('/') && 
 inputValue.split('/').length === 2) {
 const completedValue = inputValue + '/' + new Date().getFullYear();
 const isoValue = formatDDMMYYYYToISO(completedValue);
 if (isoValue) {
 setFormData({ ...formData, [field]: isoValue });
 setDateInputValues({ ...dateInputValues, [field]: '' });
 setTimeout(() => {
 moveToNextField(field);
 }, 50);
 return true;
 }
 }
 
 if (inputValue && inputValue.length === 10) {
 const isoValue = formatDDMMYYYYToISO(inputValue);
 if (isoValue) {
 setFormData({ ...formData, [field]: isoValue });
 setDateInputValues({ ...dateInputValues, [field]: '' });
 }
 setTimeout(() => {
 moveToNextField(field);
 }, 50);
 return true;
 }
 
 if (inputValue && inputValue.length > 0 && inputValue.length < 10) {
 const isoValue = formatDDMMYYYYToISO(inputValue);
 if (isoValue) {
 setFormData({ ...formData, [field]: isoValue });
 setDateInputValues({ ...dateInputValues, [field]: '' });
 setTimeout(() => {
 moveToNextField(field);
 }, 50);
 return true;
 }
 }
 
 return false;
 };

 const handleDateBlur = (field: string) => {
 const inputValue = dateInputValues[field as keyof typeof dateInputValues];
 if (inputValue && inputValue.includes('/') && inputValue.length === 10) {
 const isoValue = formatDDMMYYYYToISO(inputValue);
 if (isoValue) {
 setFormData({ ...formData, [field]: isoValue });
 setDateInputValues({ ...dateInputValues, [field]: '' });
 } else {
 setFormData({ ...formData, [field]: '' });
 setDateInputValues({ ...dateInputValues, [field]: '' });
 }
 } else if (inputValue && inputValue.length === 5 && inputValue.includes('/') && (field === 'fechaVencimiento' || field === 'fechaEmision')) {
 // dd/mm sin año → auto-completar con año actual
 const completedValue = inputValue + '/' + new Date().getFullYear();
 const isoValue = formatDDMMYYYYToISO(completedValue);
 if (isoValue) {
   setFormData({ ...formData, [field]: isoValue });
 }
 setDateInputValues({ ...dateInputValues, [field]: '' });
 } else if (inputValue && inputValue.length > 0 && inputValue.length < 10) {
 setFormData({ ...formData, [field]: '' });
 setDateInputValues({ ...dateInputValues, [field]: '' });
 } else if (!inputValue && formData[field as keyof typeof formData]) {
 setDateInputValues({ ...dateInputValues, [field]: '' });
 }
 };

 const moveToNextField = (currentFieldId: string) => {
 const fieldOrder = [
 'numeroSerie',
 'numeroFactura',
 'proveedor',
 'fechaEmision',
 'fechaVencimiento',
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
 'observaciones'
 ];

 const currentIndex = fieldOrder.indexOf(currentFieldId);
 if (currentIndex < fieldOrder.length - 1) {
 for (let i = currentIndex + 1; i < fieldOrder.length; i++) {
 const nextFieldId = fieldOrder[i];
 const nextField = document.getElementById(nextFieldId);
 
 if (nextFieldId === 'fechaVencimiento' && formData.tipoPago === 'contado') {
 continue;
 }
 
 if (nextField && !nextField.hasAttribute('disabled') && nextField.offsetParent !== null) {
 nextField.focus();
 if (nextField instanceof HTMLInputElement && nextField.type === 'number') {
 nextField.select();
 }
 return;
 }
 }
 }
 };

 const handleOpenCuentaModal = (cuenta?: { id: string; nombre: string; descripcion?: string }) => {
 if (cuenta) {
 setEditingCuenta(cuenta);
 setCuentaForm({
 nombre: cuenta.nombre,
 descripcion: cuenta.descripcion || '',
 });
 } else {
 setEditingCuenta(null);
 setCuentaForm({
 nombre: '',
 descripcion: '',
 });
 }
 setIsCuentaModalOpen(true);
 setCuentaPopoverOpen(false);
 };

 const handleSaveCuenta = async () => {
 if (!cuentaForm.nombre.trim()) {
 toast.error('El nombre de la cuenta es requerido');
 return;
 }

 try {
 if (editingCuenta) {
 const response = await fetch(`/api/compras/cuentas/${editingCuenta.id}`, {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 nombre: cuentaForm.nombre,
 descripcion: cuentaForm.descripcion,
 }),
 });

 if (!response.ok) {
 throw new Error('Error al actualizar la cuenta');
 }

 const updatedCuenta = await response.json();
 setCuentas(cuentas.map(c => c.id === editingCuenta.id ? updatedCuenta : c));
 toast.success('Cuenta actualizada exitosamente');
 } else {
 const response = await fetch('/api/compras/cuentas', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 nombre: cuentaForm.nombre,
 descripcion: cuentaForm.descripcion,
 }),
 });

 if (!response.ok) {
 throw new Error('Error al crear la cuenta');
 }

 const nuevaCuenta = await response.json();
 setCuentas([...cuentas, nuevaCuenta]);
 toast.success('Cuenta creada exitosamente');
 setFormData({ ...formData, tipoCuenta: nuevaCuenta.id });
 }

 setIsCuentaModalOpen(false);
 setEditingCuenta(null);
 setCuentaForm({ nombre: '', descripcion: '' });
 } catch (error) {
 console.error('Error saving cuenta:', error);
 toast.error('Error al guardar la cuenta');
 }
 };

 const handleDeleteCuenta = async (cuentaId: string) => {
 const ok = await confirm({
 title: 'Eliminar cuenta',
 description: '¿Estás seguro de que deseas eliminar esta cuenta?',
 confirmText: 'Eliminar',
 variant: 'destructive',
 });
 if (!ok) return;

 try {
 const response = await fetch(`/api/compras/cuentas/${cuentaId}`, {
 method: 'DELETE',
 });

 if (!response.ok) {
 throw new Error('Error al eliminar la cuenta');
 }

 setCuentas(cuentas.filter(c => c.id !== cuentaId));
 if (formData.tipoCuenta === cuentaId) {
 setFormData({ ...formData, tipoCuenta: '' });
 }
 toast.success('Cuenta eliminada exitosamente');
 } catch (error) {
 console.error('Error deleting cuenta:', error);
 toast.error('Error al eliminar la cuenta');
 }
 };

 const filteredCuentas = cuentas.filter(cuenta =>
 cuenta.nombre.toLowerCase().includes(cuentaSearch.toLowerCase())
 );

 const resetForm = () => {
 const todayISO = new Date().toISOString().split('T')[0];
 setFormData({
 numeroSerie: '',
 numeroFactura: '',
 tipo: '',
 proveedorId: '',
 proveedorSearch: '',
 fechaEmision: todayISO,
 fechaVencimiento: '',
 fechaImputacion: todayISO,
 tipoPago: 'cta_cte',
 metodoPago: '',
 items: [],
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
 tipoCuenta: '',
 observaciones: '',
 // NCA/NDA fields
 tipoNca: '',
 purchaseReturnId: '',
 facturaVinculadaId: '',
 motivo: '',
 // Costo Indirecto
 esIndirecto: false,
 indirectCategory: '',
 });
 setDateInputValues({
 fechaEmision: formatDateToDDMMYYYY(todayISO),
 fechaVencimiento: '',
 fechaImputacion: formatDateToDDMMYYYY(todayISO),
 });
 setProveedorItems([]);
 setItemPopoverOpen({});
 setIsCreateItemModalOpen(false);
 setCreatingItemFor('');
 setNewItemForm({
 nombre: '',
 descripcion: '',
 unidad: '',
 precioUnitario: '',
 });
 setIva21Manual(false);
 setConceptos([]);
 // Reset NCA/NDA state
 setDevoluciones([]);
 setFacturasProveedor([]);
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();

 if (!formData.tipo) {
 toast.error('Debes seleccionar un tipo de comprobante');
 return;
 }

 if (!formData.numeroSerie || !formData.numeroFactura) {
 toast.error('Debes completar número de serie y número de factura');
 return;
 }

 if (!formData.proveedorId) {
 toast.error('Debes seleccionar un proveedor');
 return;
 }

 // Validaciones específicas para Nota de Crédito
 if (isNotaCredito(formData.tipo)) {
 if (!formData.tipoNca) {
 toast.error('Debes seleccionar el tipo de nota de crédito');
 return;
 }
 if (!formData.motivo) {
 toast.error('Debes ingresar el motivo de la nota de crédito');
 return;
 }
 if (formData.tipoNca === 'NCA_DEVOLUCION' && !formData.purchaseReturnId) {
 toast.error('Para NCA por devolución debes seleccionar la devolución vinculada');
 return;
 }
 }

 // Validaciones específicas para Nota de Débito
 if (isNotaDebito(formData.tipo)) {
 if (!formData.motivo) {
 toast.error('Debes ingresar el motivo de la nota de débito');
 return;
 }
 }

 if (formData.items.length === 0) {
 toast.error('Debes agregar al menos un item');
 return;
 }

 if (!formData.neto || parseFloat(formData.neto) <= 0) {
 toast.error('El neto debe ser mayor a cero');
 return;
 }

 if (!formData.total || parseFloat(formData.total) <= 0) {
 toast.error('El total debe ser mayor a cero');
 return;
 }

 if (!formData.tipoCuenta) {
 toast.error('Debes seleccionar un tipo de cuenta');
 return;
 }

 if (formData.tipoPago === 'contado' && !formData.metodoPago) {
 toast.error('Debes especificar el método de pago para comprobantes de contado');
 return;
 }

 if (formData.tipoPago === 'cta_cte' && !formData.fechaVencimiento) {
 toast.error('Debes especificar la fecha de vencimiento para cuenta corriente');
 return;
 }

 try {
 const itemsPayload = [
 ...formData.items.map(item => ({
 itemId: item.itemId,
 descripcion: item.descripcion,
 codigoProveedor: item.codigoProveedor,
 cantidad: item.cantidad,
 unidad: item.unidad,
 precioUnitario: item.precioUnitario,
 subtotal: item.subtotal,
 proveedorId: item.proveedorId || formData.proveedorId,
 })),
 // Conceptos del gasto indirecto (solo si esIndirecto)
 ...(formData.esIndirecto
 ? conceptos
 .filter(c => c.descripcion.trim())
 .map(c => ({
 descripcion: c.descripcion,
 cantidad: '1',
 unidad: 'UN',
 precioUnitario: c.monto || '0',
 subtotal: c.monto || '0',
 isIndirectConcept: true,
 }))
 : []),
 ];

 // Si es Nota de Crédito o Nota de Débito, usar API especializada
 if (isNotaCreditoDebito(formData.tipo)) {
 const ncndPayload = {
 tipo: isNotaCredito(formData.tipo) ? 'NOTA_CREDITO' : 'NOTA_DEBITO',
 tipoNca: isNotaCredito(formData.tipo) ? formData.tipoNca : undefined,
 numeroSerie: formData.numeroSerie,
 proveedorId: formData.proveedorId,
 facturaId: formData.facturaVinculadaId || undefined,
 purchaseReturnId: formData.purchaseReturnId || undefined,
 fechaEmision: formData.fechaEmision,
 motivo: formData.motivo,
 neto: formData.neto || '0',
 iva21: formData.iva21 || '0',
 iva105: formData.iva105 || '0',
 iva27: formData.iva27 || '0',
 exento: formData.exento || '0',
 percepcionIVA: formData.percepcionIVA || '0',
 percepcionIIBB: formData.percepcionIIBB || '0',
 otrosTributos: formData.otrosConceptos || '0',
 total: formData.total || '0',
 items: itemsPayload.map(item => ({
 supplierItemId: item.itemId,
 descripcion: item.descripcion,
 cantidad: item.cantidad,
 unidad: item.unidad,
 precioUnitario: item.precioUnitario,
 subtotal: item.subtotal,
 })),
 docType: getDocTypeFromTipo(formData.tipo),
 };

 const response = await fetch('/api/compras/notas-credito-debito', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(ncndPayload),
 });

 if (!response.ok) {
 const errorData = await response.json().catch(() => null);
 console.error('[COMPROBANTE MODAL] ❌ Error NCA/NDA:', errorData);
 throw new Error(errorData?.error || 'Error al crear la nota de crédito/débito');
 }

 const result = await response.json();
 toast.success(`${isNotaCredito(formData.tipo) ? 'Nota de Crédito' : 'Nota de Débito'} creada exitosamente`);
 onSaved?.();
 onOpenChange(false);
 return;
 }

 // Flujo normal para Facturas/Recibos
 const payload = {
 numeroSerie: formData.numeroSerie,
 numeroFactura: formData.numeroFactura,
 tipo: formData.tipo,
 proveedorId: formData.proveedorId,
 fechaEmision: formData.fechaEmision,
 fechaVencimiento: formData.fechaVencimiento || null,
 fechaImputacion: formData.fechaImputacion,
 tipoPago: formData.tipoPago,
 metodoPago: formData.metodoPago || null,
 items: itemsPayload,
 neto: formData.neto || '0',
 iva21: formData.iva21 || '0',
 noGravado: formData.noGravado || '0',
 impInter: formData.impInter || '0',
 percepcionIVA: formData.percepcionIVA || '0',
 percepcionIIBB: formData.percepcionIIBB || '0',
 otrosConceptos: formData.otrosConceptos || '0',
 iva105: formData.iva105 || '0',
 iva27: formData.iva27 || '0',
 exento: formData.exento || '0',
 iibb: formData.iibb || '0',
 total: formData.total || '0',
 tipoCuentaId: formData.tipoCuenta,
 observaciones: formData.observaciones || null,
 // DocType: determinado automáticamente por el tipo de comprobante
 // Presupuesto, PPT, etc. = T2, Facturas/Recibos = T1
 docType: getDocTypeFromTipo(formData.tipo),
 // Costo Indirecto (Costos V2)
 esIndirecto: formData.esIndirecto,
 indirectCategory: formData.esIndirecto ? (formData.indirectCategory || null) : null,
 };

 const docType = getDocTypeFromTipo(formData.tipo);
 const editParam = comprobanteId && (editDocType || docType === 'T2') ? `?docType=${editDocType || docType}` : '';
 const url = comprobanteId
 ? `/api/compras/comprobantes/${comprobanteId}${editParam}`
 : '/api/compras/comprobantes';
 const method = comprobanteId ? 'PUT' : 'POST';

 const response = await fetch(url, {
 method,
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(payload),
 });

 if (!response.ok) {
 const errorData = await response.json().catch(() => null);
 console.error('[COMPROBANTE MODAL] ❌ Error en la respuesta:', errorData);
 throw new Error(errorData?.error || 'Error en la API de comprobantes');
 }

 const responseData = await response.json();

 toast.success(comprobanteId ? 'Comprobante actualizado correctamente' : 'Comprobante cargado exitosamente');
 resetForm();
 onOpenChange(false);
 if (onSaved) {
 onSaved();
 }
 } catch (error) {
 console.error('[COMPROBANTE MODAL] ❌ Error saving comprobante:', error);
 toast.error('Error al guardar el comprobante');
 }
 };

 // Sincronizar dateInputValues cuando formData cambia desde fuera
 useEffect(() => {
 if (formData.fechaEmision && !dateInputValues.fechaEmision) {
 setDateInputValues(prev => ({
 ...prev,
 fechaEmision: formatDateToDDMMYYYY(formData.fechaEmision)
 }));
 }
 if (formData.fechaImputacion && !dateInputValues.fechaImputacion) {
 setDateInputValues(prev => ({
 ...prev,
 fechaImputacion: formatDateToDDMMYYYY(formData.fechaImputacion)
 }));
 }
 }, [formData.fechaEmision, formData.fechaImputacion]);

 return (
 <>
 <Dialog open={open} onOpenChange={(open) => {
 onOpenChange(open);
 if (!open) {
 resetForm();
 }
 }}>
 <DialogContent size="2xl">
 <DialogHeader>
 <DialogTitle>{comprobanteId ? 'Editar factura' : 'Nuevo Comprobante'}</DialogTitle>
 <DialogDescription>
 Completa los datos del comprobante de compra
 </DialogDescription>
 {isFromAI && (
 <div className="flex items-center gap-2 p-3 bg-info-muted rounded-lg text-sm border border-info-muted mt-3">
 <FileText className="h-4 w-4 text-info-muted-foreground flex-shrink-0" />
 <span className="text-info-muted-foreground ">
 Datos extraídos automáticamente del PDF. Verifica antes de guardar.
 </span>
 </div>
 )}
 </DialogHeader>
 <DialogBody>
 <form onSubmit={handleSubmit} autoComplete="off">
 <div className="space-y-4">
 {/* Tipo de Comprobante */}
 <div className="space-y-2">
 <Label htmlFor="tipo">Tipo de Comprobante *</Label>
 <Select
 value={formData.tipo}
 onValueChange={(value) => {
 setFormData({ ...formData, tipo: value });
 // Al elegir tipo con Enter/tab, enfocar número de serie
 setTimeout(() => {
 const next = document.getElementById('numeroSerie');
 next?.focus();
 }, 50);
 }}
 >
 <SelectTrigger id="tipo">
 <SelectValue placeholder="Selecciona el tipo de comprobante" />
 </SelectTrigger>
 <SelectContent>
 {/* Standard types - always visible */}
 {tiposComprobantesT1.map((tipo) => (
 <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
 ))}
 {/* Additional types - only in extended mode with configured types */}
 {viewMode === 'E' && ct.length > 0 && (
 <>
 <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">
 Adicionales
 </div>
 {ct.map((tipo) => (
 <SelectItem key={tipo} value={tipo} className="text-warning-muted-foreground ">
 {tipo}
 </SelectItem>
 ))}
 </>
 )}
 </SelectContent>
 </Select>
 </div>

 {/* Campos adicionales para Notas de Crédito */}
 {isNotaCredito(formData.tipo) && (
 <div className="space-y-4 p-4 bg-info-muted rounded-lg border border-info-muted ">
 <div className="flex items-center gap-2 text-sm font-medium text-info-muted-foreground ">
 <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 Detalles de la Nota de Crédito
 </div>

 {/* Tipo de NCA */}
 <div className="space-y-2">
 <Label htmlFor="tipoNca">Tipo de Nota de Crédito *</Label>
 <Select
 value={formData.tipoNca}
 onValueChange={(value) => {
 setFormData({ ...formData, tipoNca: value, purchaseReturnId: '' });
 // Si es devolución, cargar devoluciones del proveedor
 if (value === 'NCA_DEVOLUCION' && formData.proveedorId) {
 loadDevolucionesProveedor(formData.proveedorId);
 }
 }}
 >
 <SelectTrigger id="tipoNca">
 <SelectValue placeholder="Selecciona el tipo de nota de crédito" />
 </SelectTrigger>
 <SelectContent>
 {tiposNca.map((t) => (
 <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 {/* Selector de Devolución (solo para NCA_DEVOLUCION) */}
 {formData.tipoNca === 'NCA_DEVOLUCION' && (
 <div className="space-y-2">
 <Label htmlFor="purchaseReturn">Devolución Vinculada *</Label>
 <Popover open={devolucionPopoverOpen} onOpenChange={setDevolucionPopoverOpen}>
 <PopoverTrigger asChild>
 <Button
 variant="outline"
 role="combobox"
 aria-expanded={devolucionPopoverOpen}
 className="w-full justify-between"
 disabled={!formData.proveedorId}
 >
 {formData.purchaseReturnId
 ? devoluciones.find(d => String(d.id) === formData.purchaseReturnId)?.numero || 'Devolución seleccionada'
 : formData.proveedorId
 ? 'Selecciona una devolución'
 : 'Primero selecciona un proveedor'}
 <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-[400px] p-0" align="start">
 <Command>
 <CommandInput placeholder="Buscar devolución..." />
 <CommandList>
 <CommandEmpty>
 {loadingDevoluciones
 ? 'Cargando devoluciones...'
 : 'No hay devoluciones disponibles'}
 </CommandEmpty>
 <CommandGroup>
 {devoluciones.map((dev) => (
 <CommandItem
 key={dev.id}
 value={`${dev.numero} ${dev.motivo}`}
 onSelect={() => {
 setFormData({ ...formData, purchaseReturnId: String(dev.id) });
 setDevolucionPopoverOpen(false);
 }}
 >
 <Check
 className={cn(
 "mr-2 h-4 w-4",
 formData.purchaseReturnId === String(dev.id) ? "opacity-100" : "opacity-0"
 )}
 />
 <div className="flex flex-col">
 <span className="font-medium">{dev.numero}</span>
 <span className="text-xs text-muted-foreground">
 {dev.motivo} • {dev._count?.items || 0} items • {dev.estado}
 </span>
 </div>
 </CommandItem>
 ))}
 </CommandGroup>
 </CommandList>
 </Command>
 </PopoverContent>
 </Popover>
 {!formData.proveedorId && (
 <p className="text-xs text-warning-muted-foreground">Selecciona un proveedor para ver sus devoluciones</p>
 )}
 {formData.proveedorId && devoluciones.length === 0 && !loadingDevoluciones && (
 <p className="text-xs text-warning-muted-foreground">Este proveedor no tiene devoluciones pendientes de NCA</p>
 )}
 </div>
 )}

 {/* Motivo de la NC */}
 <div className="space-y-2">
 <Label htmlFor="motivo">Motivo *</Label>
 <Input
 id="motivo"
 value={formData.motivo}
 onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
 placeholder="Describe el motivo de la nota de crédito"
 required={isNotaCredito(formData.tipo)}
 />
 </div>
 </div>
 )}

 {/* Campos adicionales para Notas de Débito */}
 {isNotaDebito(formData.tipo) && (
 <div className="space-y-4 p-4 bg-warning-muted rounded-lg border border-warning-muted ">
 <div className="flex items-center gap-2 text-sm font-medium text-warning-muted-foreground ">
 <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
 </svg>
 Detalles de la Nota de Débito
 </div>

 {/* Motivo de la ND */}
 <div className="space-y-2">
 <Label htmlFor="motivoND">Motivo *</Label>
 <Input
 id="motivoND"
 value={formData.motivo}
 onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
 placeholder="Describe el motivo de la nota de débito"
 required={isNotaDebito(formData.tipo)}
 />
 </div>
 </div>
 )}

 {/* Número de Serie y Número de Factura */}
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="numeroSerie">Número de Serie *</Label>
 <Input
 id="numeroSerie"
 value={formData.numeroSerie}
 onChange={(e) => {
 const value = e.target.value.replace(/\D/g, '');
 setFormData({ ...formData, numeroSerie: value });
 }}
 onBlur={(e) => {
 const value = e.target.value.replace(/\D/g, '');
 if (value) {
 const padded = value.padStart(5, '0');
 const finalValue = padded.length > 5 ? padded.slice(-5) : padded;
 setFormData({ ...formData, numeroSerie: finalValue });
 }
 }}
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 const value = formData.numeroSerie.replace(/\D/g, '');
 if (value) {
 const padded = value.padStart(5, '0');
 const finalValue = padded.length > 5 ? padded.slice(-5) : padded;
 setFormData({ ...formData, numeroSerie: finalValue });
 }
 moveToNextField('numeroSerie');
 }
 }}
 placeholder="00001"
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
 setFormData({ ...formData, numeroFactura: value });
 }}
 onBlur={(e) => {
 const value = e.target.value.replace(/\D/g, '');
 if (value) {
 const padded = value.padStart(8, '0');
 const finalValue = padded.length > 8 ? padded.slice(-8) : padded;
 setFormData({ ...formData, numeroFactura: finalValue });
 }
 }}
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 const value = formData.numeroFactura.replace(/\D/g, '');
 if (value) {
 const padded = value.padStart(8, '0');
 const finalValue = padded.length > 8 ? padded.slice(-8) : padded;
 setFormData({ ...formData, numeroFactura: finalValue });
 }
 moveToNextField('numeroFactura');
 }
 }}
 placeholder="00001234"
 required
 />
 </div>
 </div>

 {/* Selector de Proveedor */}
 <div className="space-y-2">
 <Label htmlFor="proveedor">Proveedor *</Label>
 <Popover 
 open={proveedorPopoverOpen} 
 onOpenChange={(open) => {
 setProveedorPopoverOpen(open);
 if (open) {
 setProveedorSearchResults(proveedores);
 }
 }}
 >
 <PopoverTrigger asChild>
 <Button
 id="proveedor"
 variant="outline"
 role="combobox"
 aria-expanded={proveedorPopoverOpen}
 className="w-full justify-between"
 >
 {formData.proveedorId
 ? proveedores.find((p) => p.id === formData.proveedorId)?.nombre || 'Seleccionar proveedor...'
 : 'Seleccionar proveedor...'}
 <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-[500px] p-0" align="start">
 <Command>
 <CommandInput 
 placeholder="Buscar por código, razón social..." 
 onValueChange={handleProveedorSearch}
 />
 <CommandList>
 <CommandEmpty>No se encontraron proveedores.</CommandEmpty>
 <CommandGroup>
 {(proveedorSearchResults.length > 0 ? proveedorSearchResults : proveedores).map((proveedor) => (
 <CommandItem
 key={proveedor.id}
 value={`${proveedor.id} ${proveedor.nombre} ${proveedor.razonSocial} ${proveedor.cuit}`}
 onSelect={() => selectProveedor(proveedor)}
 >
 <Check
 className={cn(
 "mr-2 h-4 w-4",
 formData.proveedorId === proveedor.id ? "opacity-100" : "opacity-0"
 )}
 />
 <div className="flex flex-col">
 <span className="font-medium">{proveedor.nombre}</span>
 <span className="text-sm text-muted-foreground">{proveedor.razonSocial}</span>
 <span className="text-xs text-muted-foreground">Código: {proveedor.id} | CUIT: {proveedor.cuit}</span>
 </div>
 </CommandItem>
 ))}
 </CommandGroup>
 </CommandList>
 </Command>
 </PopoverContent>
 </Popover>
 </div>

 {/* Fechas */}
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="fechaEmision">Fecha de Emisión *</Label>
 <Input
 id="fechaEmision"
 type="text"
 value={dateInputValues.fechaEmision || (formData.fechaEmision ? formatDateToDDMMYYYY(formData.fechaEmision) : '')}
 onChange={(e) => handleDateInputChange('fechaEmision', e.target.value)}
 onBlur={() => handleDateBlur('fechaEmision')}
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 const currentValue = (e.target as HTMLInputElement).value;
 if (!handleDateEnter('fechaEmision', currentValue)) {
 handleDateBlur('fechaEmision');
 moveToNextField('fechaEmision');
 }
 }
 }}
 placeholder="dd/mm"
 required
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="fechaVencimiento">
 Fecha de Vencimiento {formData.tipoPago === 'cta_cte' && '*'}
 </Label>
 <Input
 id="fechaVencimiento"
 type="text"
 value={dateInputValues.fechaVencimiento || (formData.fechaVencimiento ? formatDateToDDMMYYYY(formData.fechaVencimiento) : '')}
 onChange={(e) => handleDateInputChange('fechaVencimiento', e.target.value)}
 onBlur={() => handleDateBlur('fechaVencimiento')}
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 const currentValue = (e.target as HTMLInputElement).value;
 if (!handleDateEnter('fechaVencimiento', currentValue)) {
 handleDateBlur('fechaVencimiento');
 moveToNextField('fechaVencimiento');
 }
 }
 }}
 placeholder="dd/mm"
 required={formData.tipoPago === 'cta_cte'}
 disabled={formData.tipoPago === 'contado'}
 />
 </div>
 </div>

 {/* Tipo de Pago */}
 <div className="space-y-2">
 <Label htmlFor="tipoPago">Tipo de Pago *</Label>
 <Select 
 value={formData.tipoPago} 
 onValueChange={(value: 'contado' | 'cta_cte') => {
 setFormData({ 
 ...formData, 
 tipoPago: value,
 metodoPago: value === 'contado' ? formData.metodoPago : '',
 fechaVencimiento: value === 'contado' ? '' : formData.fechaVencimiento
 });
 }}
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="cta_cte">Cuenta Corriente</SelectItem>
 <SelectItem value="contado">Contado</SelectItem>
 </SelectContent>
 </Select>
 </div>

 {/* Método de Pago (solo si es contado) */}
 {formData.tipoPago === 'contado' && (
 <div className="space-y-2">
 <Label htmlFor="metodoPago">Método de Pago *</Label>
 <Select 
 value={formData.metodoPago} 
 onValueChange={(value) => setFormData({ ...formData, metodoPago: value })}
 >
 <SelectTrigger>
 <SelectValue placeholder="Selecciona el método de pago" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="Efectivo">Efectivo</SelectItem>
 <SelectItem value="Transferencia">Transferencia</SelectItem>
 <SelectItem value="Cheque">Cheque</SelectItem>
 <SelectItem value="Tarjeta de Débito">Tarjeta de Débito</SelectItem>
 <SelectItem value="Tarjeta de Crédito">Tarjeta de Crédito</SelectItem>
 <SelectItem value="Otro">Otro</SelectItem>
 </SelectContent>
 </Select>
 </div>
 )}

 {/* Items */}
 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <Label>Items *</Label>
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={addItem}
 >
 <Plus className="w-4 h-4 mr-2" />
 Agregar Item
 </Button>
 </div>
 {!formData.proveedorId ? (
 <p className="text-sm text-muted-foreground text-center py-4">
 Primero debes seleccionar un proveedor para cargar sus items disponibles.
 </p>
 ) : formData.items.length === 0 ? (
 <p className="text-sm text-muted-foreground text-center py-4">
 No hay items. Haz clic en &quot;Agregar Item&quot; para comenzar.
 </p>
 ) : (
 <div className="border rounded-md overflow-hidden">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead className="w-[140px]">Cód. Prov.</TableHead>
 <TableHead className="w-[260px]">Item</TableHead>
 <TableHead className="w-[90px]">Cantidad</TableHead>
 <TableHead className="w-[90px]">Unidad</TableHead>
 <TableHead className="w-[120px]">Precio Unit.</TableHead>
 <TableHead className="w-[120px]">Subtotal</TableHead>
 <TableHead className="w-[50px]"></TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {formData.items.map((item, index) => {
 const selectedProveedorItem = proveedorItems.find(pi => pi.id === item.itemId);
 
 return (
 <TableRow key={item.id}>
 <TableCell>
 <Input
 value={item.codigoProveedor || ''}
 onChange={(e) => handleCodigoProveedorChange(item.id, e.target.value)}
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 buscarItemPorCodigo(item.id, item.codigoProveedor || '');
 }
 }}
 placeholder="Código del proveedor"
 />
 </TableCell>
 <TableCell>
 {formData.proveedorId && proveedorItems.length > 0 ? (
 <Popover 
 open={itemPopoverOpen[item.id] || false}
 onOpenChange={(open) => {
 setItemPopoverOpen(prev => ({ ...prev, [item.id]: open }));
 }}
 >
 <PopoverTrigger asChild>
 <Button
 variant="outline"
 role="combobox"
 className="w-full justify-between"
 >
 {selectedProveedorItem
 ? (selectedProveedorItem.stockLocations?.[0]?.descripcionItem || selectedProveedorItem.nombre)
 : 'Seleccionar item...'}
 <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-[520px] p-0" align="start">
 <Command shouldFilter={true}>
 <CommandInput placeholder="Buscar item..." />
 <CommandList
 className="max-h-[300px] overflow-y-auto overscroll-contain"
 style={{ scrollbarGutter: 'stable' }}
 >
 <CommandEmpty>
 <div className="py-4 text-center">
 <p className="text-sm text-muted-foreground mb-2">No se encontraron items.</p>
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => {
 setCreatingItemFor(item.id);
 setIsCreateItemModalOpen(true);
 }}
 >
 <Plus className="w-4 h-4 mr-2" />
 Crear nuevo item
 </Button>
 </div>
 </CommandEmpty>
 <CommandGroup>
 {proveedorItems.map((proveedorItem) => (
 <CommandItem
 key={proveedorItem.id}
 value={proveedorItem.id}
 onSelect={() => {
 selectItemForComprobante(item.id, proveedorItem);
 setItemPopoverOpen(prev => ({ ...prev, [item.id]: false }));
 }}
 className="group flex items-center justify-between"
 >
 <div className="flex items-start gap-2">
 <Check
 className={cn(
 "mr-2 h-4 w-4 mt-1",
 item.itemId === proveedorItem.id ? "opacity-100" : "opacity-0"
 )}
 />
 <div className="flex flex-col">
 {/* Preferir descripcionItem de stockLocations (nombre real usado en recepciones) */}
 <span className="font-medium">
 {proveedorItem.stockLocations?.[0]?.descripcionItem || proveedorItem.nombre}
 </span>
 {(proveedorItem.stockLocations?.[0]?.codigoProveedor || proveedorItem.codigoProveedor || proveedorItem.descripcion) && (
 <span className="text-sm text-muted-foreground">
 {(proveedorItem.stockLocations?.[0]?.codigoProveedor || proveedorItem.codigoProveedor)
 ? `Cód: ${proveedorItem.stockLocations?.[0]?.codigoProveedor || proveedorItem.codigoProveedor}`
 : proveedorItem.descripcion}
 </span>
 )}
 <span className="text-xs text-muted-foreground">
 Unidad: {proveedorItem.unidad}
 {proveedorItem.precioUnitario && ` | Precio ref: $${proveedorItem.precioUnitario.toLocaleString('es-AR')}`}
 </span>
 </div>
 </div>
 <Button
 type="button"
 variant="ghost"
 size="sm"
 className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
 onClick={(e) => {
 e.stopPropagation();
 setEditingProveedorItem(proveedorItem);
 setNewItemForm({
 nombre: proveedorItem.nombre,
 descripcion: proveedorItem.descripcion || '',
 codigoProveedor: proveedorItem.codigoProveedor || '',
 unidad: proveedorItem.unidad,
 precioUnitario: proveedorItem.precioUnitario
 ? String(proveedorItem.precioUnitario)
 : '',
 });
 setCreatingItemFor(item.id);
 setIsCreateItemModalOpen(true);
 }}
 >
 <Edit className="h-3 w-3" />
 </Button>
 </CommandItem>
 ))}
 <CommandItem
 onSelect={() => {
 setCreatingItemFor(item.id);
 setIsCreateItemModalOpen(true);
 setItemPopoverOpen(prev => ({ ...prev, [item.id]: false }));
 }}
 className="border-t"
 >
 <Plus className="mr-2 h-4 w-4" />
 <span className="font-medium">Crear nuevo item</span>
 </CommandItem>
 </CommandGroup>
 </CommandList>
 </Command>
 </PopoverContent>
 </Popover>
 ) : (
 <Input
 value={item.descripcion}
 onChange={(e) => updateItem(item.id, 'descripcion', e.target.value)}
 placeholder={formData.proveedorId ? "Selecciona un proveedor primero" : "Nombre del item"}
 disabled={!formData.proveedorId}
 required
 />
 )}
 </TableCell>
 <TableCell>
 <Input
 type="text"
 data-item-cantidad={item.id}
 value={rawInputs[`qty-${item.id}`] !== undefined ? rawInputs[`qty-${item.id}`] : (item.cantidad ? formatMoney(item.cantidad) : '')}
 onFocus={(e) => { startRawEdit(`qty-${item.id}`, e.target.value); e.target.select(); }}
 onChange={(e) => {
 startRawEdit(`qty-${item.id}`, e.target.value);
 updateItem(item.id, 'cantidad', normalizeMoneyInput(e.target.value));
 }}
 onBlur={() => stopRawEdit(`qty-${item.id}`)}
 onKeyDown={(e) => {
 if (e.key === '.' || e.code === 'NumpadDecimal') {
 e.preventDefault();
 const input = e.currentTarget;
 const pos = input.selectionStart ?? input.value.length;
 const end = input.selectionEnd ?? pos;
 const curVal = rawInputs[`qty-${item.id}`] ?? input.value;
 const newValue = curVal.slice(0, pos) + ',' + curVal.slice(end);
 startRawEdit(`qty-${item.id}`, newValue);
 updateItem(item.id, 'cantidad', normalizeMoneyInput(newValue));
 requestAnimationFrame(() => { input.setSelectionRange(pos + 1, pos + 1); });
 return;
 }
 if (e.key === 'Enter') {
 e.preventDefault();
 const row = e.currentTarget.closest('tr');
 const precioInput = row?.querySelector<HTMLInputElement>('[data-field=\"precio-unitario\"]') ?? null;
 if (precioInput) { precioInput.focus(); precioInput.select(); }
 }
 }}
 placeholder="0"
 required
 />
 </TableCell>
 <TableCell>
 <Select
 value={item.unidad}
 onValueChange={(value) => {
 updateItem(item.id, 'unidad', value);
 // luego de elegir unidad, ir al input de precio unitario en la misma fila
 setTimeout(() => {
 const trigger = document.querySelector<HTMLElement>(
 `[data-unidad-trigger="${item.id}"]`
 );
 const row = trigger?.closest('tr') || undefined;
 const precioInput = row
 ? (row.querySelector<HTMLInputElement>('[data-field="precio-unitario"]') ??
 null)
 : null;
 precioInput?.focus();
 if (precioInput) {
 precioInput.select();
 }
 }, 0);
 }}
 >
 <SelectTrigger data-field="unidad-select" data-unidad-trigger={item.id}>
 <SelectValue placeholder="Unidad" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="UN">Unidad (un)</SelectItem>
 <SelectItem value="KG">Kilogramo (kg)</SelectItem>
 <SelectItem value="TN">Tonelada (tn)</SelectItem>
 <SelectItem value="M3">Metro cúbico (m3)</SelectItem>
 <SelectItem value="LTS">Litros (lts)</SelectItem>
 <SelectItem value="BOLSA">Bolsa</SelectItem>
 <SelectItem value="CAJA">Caja</SelectItem>
 </SelectContent>
 </Select>
 </TableCell>
 <TableCell>
 <Input
 type="text"
 value={rawInputs[`precio-${item.id}`] !== undefined ? rawInputs[`precio-${item.id}`] : (item.precioUnitario ? formatMoney(item.precioUnitario) : '')}
 onFocus={(e) => { startRawEdit(`precio-${item.id}`, e.target.value); e.target.select(); }}
 onChange={(e) => {
 startRawEdit(`precio-${item.id}`, e.target.value);
 updateItem(item.id, 'precioUnitario', normalizeMoneyInput(e.target.value));
 }}
 onBlur={() => stopRawEdit(`precio-${item.id}`)}
 onKeyDown={(e) => {
 if (e.key === '.' || e.code === 'NumpadDecimal') {
 e.preventDefault();
 const input = e.currentTarget;
 const pos = input.selectionStart ?? input.value.length;
 const end = input.selectionEnd ?? pos;
 const curVal = rawInputs[`precio-${item.id}`] ?? input.value;
 const newValue = curVal.slice(0, pos) + ',' + curVal.slice(end);
 startRawEdit(`precio-${item.id}`, newValue);
 updateItem(item.id, 'precioUnitario', normalizeMoneyInput(newValue));
 requestAnimationFrame(() => { input.setSelectionRange(pos + 1, pos + 1); });
 }
 }}
 data-field="precio-unitario"
 placeholder="0,00"
 />
 </TableCell>
 <TableCell>
 <Input
 type="text"
 value={item.subtotal ? formatMoney(item.subtotal) : ''}
 readOnly
 className="bg-muted"
 placeholder="0,00"
 />
 </TableCell>
 <TableCell className="text-right">
 <div onClick={(e) => e.stopPropagation()}>
 <Button
 type="button"
 variant="ghost"
 size="sm"
 onClick={(e) => {
 e.preventDefault();
 e.stopPropagation();
 removeItem(item.id);
 }}
 onMouseDown={(e) => {
 e.preventDefault();
 e.stopPropagation();
 }}
 className="text-destructive hover:text-destructive hover:bg-destructive/10"
 >
 <Trash2 className="w-4 h-4" />
 </Button>
 </div>
 </TableCell>
 </TableRow>
 );
 })}
 </TableBody>
 </Table>
 </div>
 )}
 </div>

 {/* Campos de Impuestos y Total */}
 <div className="space-y-4 border-t pt-4">
 <div className="grid grid-cols-3 gap-4">
 <div className="space-y-2">
 <Label htmlFor="neto">Neto *</Label>
 <Input
 id="neto"
 type="text"
 value={formatMoney(formData.neto || '0')}
 readOnly
 className="bg-muted"
 placeholder="0.00"
 required
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="iva21">IVA 21%</Label>
 <Input
 id="iva21"
 type="text"
 value={rawInputs['iva21'] !== undefined ? rawInputs['iva21'] : (formData.iva21 ? formatMoney(formData.iva21) : '')}
 onFocus={(e) => { startRawEdit('iva21', e.target.value); e.target.select(); }}
 onChange={(e) => {
 startRawEdit('iva21', e.target.value);
 setIva21Manual(true);
 handleFieldChange('iva21', e.target.value);
 }}
 onBlur={(e) => {
 stopRawEdit('iva21');
 if (!e.target.value) {
 setIva21Manual(false);
 calculateTotal();
 }
 }}
 onKeyDown={(e) => {
 if (e.key === '.' || e.code === 'NumpadDecimal') {
 e.preventDefault();
 const input = e.currentTarget;
 const pos = input.selectionStart ?? input.value.length;
 const end = input.selectionEnd ?? pos;
 const curVal = rawInputs['iva21'] ?? input.value;
 const newValue = curVal.slice(0, pos) + ',' + curVal.slice(end);
 startRawEdit('iva21', newValue);
 requestAnimationFrame(() => { input.setSelectionRange(pos + 1, pos + 1); });
 return;
 }
 if (e.key === 'Enter') {
 e.preventDefault();
 moveToNextField('iva21');
 }
 }}
 placeholder="0.00"
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="noGravado">No Gravado</Label>
 <Input
 id="noGravado"
 type="text"
 value={rawInputs['noGravado'] !== undefined ? rawInputs['noGravado'] : (formData.noGravado ? formatMoney(formData.noGravado) : '')}
 onFocus={(e) => { startRawEdit('noGravado', e.target.value); e.target.select(); }}
 onChange={(e) => { startRawEdit('noGravado', e.target.value); handleFieldChange('noGravado', e.target.value); }}
 onBlur={() => stopRawEdit('noGravado')}
 onKeyDown={(e) => {
 if (e.key === '.' || e.code === 'NumpadDecimal') {
 e.preventDefault();
 const input = e.currentTarget;
 const pos = input.selectionStart ?? input.value.length;
 const end = input.selectionEnd ?? pos;
 const curVal = rawInputs['noGravado'] ?? input.value;
 const newValue = curVal.slice(0, pos) + ',' + curVal.slice(end);
 startRawEdit('noGravado', newValue);
 requestAnimationFrame(() => { input.setSelectionRange(pos + 1, pos + 1); });
 return;
 }
 if (e.key === 'Enter') {
 e.preventDefault();
 moveToNextField('noGravado');
 }
 }}
 placeholder="0.00"
 />
 </div>
 </div>

 <div className="grid grid-cols-3 gap-4">
 <div className="space-y-2">
 <Label htmlFor="impInter">Imp Inter</Label>
 <Input
 id="impInter"
 type="text"
 value={rawInputs['impInter'] !== undefined ? rawInputs['impInter'] : (formData.impInter ? formatMoney(formData.impInter) : '')}
 onFocus={(e) => { startRawEdit('impInter', e.target.value); e.target.select(); }}
 onChange={(e) => { startRawEdit('impInter', e.target.value); handleFieldChange('impInter', e.target.value); }}
 onBlur={() => stopRawEdit('impInter')}
 onKeyDown={(e) => {
 if (e.key === '.' || e.code === 'NumpadDecimal') {
 e.preventDefault();
 const input = e.currentTarget;
 const pos = input.selectionStart ?? input.value.length;
 const end = input.selectionEnd ?? pos;
 const curVal = rawInputs['impInter'] ?? input.value;
 const newValue = curVal.slice(0, pos) + ',' + curVal.slice(end);
 startRawEdit('impInter', newValue);
 requestAnimationFrame(() => { input.setSelectionRange(pos + 1, pos + 1); });
 return;
 }
 if (e.key === 'Enter') {
 e.preventDefault();
 moveToNextField('impInter');
 }
 }}
 placeholder="0.00"
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="percepcionIVA">Percep IVA</Label>
 <Input
 id="percepcionIVA"
 type="text"
 value={rawInputs['percepcionIVA'] !== undefined ? rawInputs['percepcionIVA'] : (formData.percepcionIVA ? formatMoney(formData.percepcionIVA) : '')}
 onFocus={(e) => { startRawEdit('percepcionIVA', e.target.value); e.target.select(); }}
 onChange={(e) => { startRawEdit('percepcionIVA', e.target.value); handleFieldChange('percepcionIVA', e.target.value); }}
 onBlur={() => stopRawEdit('percepcionIVA')}
 onKeyDown={(e) => {
 if (e.key === '.' || e.code === 'NumpadDecimal') {
 e.preventDefault();
 const input = e.currentTarget;
 const pos = input.selectionStart ?? input.value.length;
 const end = input.selectionEnd ?? pos;
 const curVal = rawInputs['percepcionIVA'] ?? input.value;
 const newValue = curVal.slice(0, pos) + ',' + curVal.slice(end);
 startRawEdit('percepcionIVA', newValue);
 requestAnimationFrame(() => { input.setSelectionRange(pos + 1, pos + 1); });
 return;
 }
 if (e.key === 'Enter') {
 e.preventDefault();
 moveToNextField('percepcionIVA');
 }
 }}
 placeholder="0.00"
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="percepcionIIBB">Percep IIBB</Label>
 <Input
 id="percepcionIIBB"
 type="text"
 value={rawInputs['percepcionIIBB'] !== undefined ? rawInputs['percepcionIIBB'] : (formData.percepcionIIBB ? formatMoney(formData.percepcionIIBB) : '')}
 onFocus={(e) => { startRawEdit('percepcionIIBB', e.target.value); e.target.select(); }}
 onChange={(e) => { startRawEdit('percepcionIIBB', e.target.value); handleFieldChange('percepcionIIBB', e.target.value); }}
 onBlur={() => stopRawEdit('percepcionIIBB')}
 onKeyDown={(e) => {
 if (e.key === '.' || e.code === 'NumpadDecimal') {
 e.preventDefault();
 const input = e.currentTarget;
 const pos = input.selectionStart ?? input.value.length;
 const end = input.selectionEnd ?? pos;
 const curVal = rawInputs['percepcionIIBB'] ?? input.value;
 const newValue = curVal.slice(0, pos) + ',' + curVal.slice(end);
 startRawEdit('percepcionIIBB', newValue);
 requestAnimationFrame(() => { input.setSelectionRange(pos + 1, pos + 1); });
 return;
 }
 if (e.key === 'Enter') {
 e.preventDefault();
 moveToNextField('percepcionIIBB');
 }
 }}
 placeholder="0.00"
 />
 </div>
 </div>

 <div className="grid grid-cols-3 gap-4">
 <div className="space-y-2">
 <Label htmlFor="otrosConceptos">O. Concept</Label>
 <Input
 id="otrosConceptos"
 type="text"
 value={rawInputs['otrosConceptos'] !== undefined ? rawInputs['otrosConceptos'] : (formData.otrosConceptos ? formatMoney(formData.otrosConceptos) : '')}
 onFocus={(e) => { startRawEdit('otrosConceptos', e.target.value); e.target.select(); }}
 onChange={(e) => { startRawEdit('otrosConceptos', e.target.value); handleFieldChange('otrosConceptos', e.target.value); }}
 onBlur={() => stopRawEdit('otrosConceptos')}
 onKeyDown={(e) => {
 if (e.key === '.' || e.code === 'NumpadDecimal') {
 e.preventDefault();
 const input = e.currentTarget;
 const pos = input.selectionStart ?? input.value.length;
 const end = input.selectionEnd ?? pos;
 const curVal = rawInputs['otrosConceptos'] ?? input.value;
 const newValue = curVal.slice(0, pos) + ',' + curVal.slice(end);
 startRawEdit('otrosConceptos', newValue);
 requestAnimationFrame(() => { input.setSelectionRange(pos + 1, pos + 1); });
 return;
 }
 if (e.key === 'Enter') {
 e.preventDefault();
 moveToNextField('otrosConceptos');
 }
 }}
 placeholder="0.00"
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="iva105">IVA 10.5%</Label>
 <Input
 id="iva105"
 type="text"
 value={rawInputs['iva105'] !== undefined ? rawInputs['iva105'] : (formData.iva105 ? formatMoney(formData.iva105) : '')}
 onFocus={(e) => { startRawEdit('iva105', e.target.value); e.target.select(); }}
 onChange={(e) => { startRawEdit('iva105', e.target.value); handleFieldChange('iva105', e.target.value); }}
 onBlur={() => stopRawEdit('iva105')}
 onKeyDown={(e) => {
 if (e.key === '.' || e.code === 'NumpadDecimal') {
 e.preventDefault();
 const input = e.currentTarget;
 const pos = input.selectionStart ?? input.value.length;
 const end = input.selectionEnd ?? pos;
 const curVal = rawInputs['iva105'] ?? input.value;
 const newValue = curVal.slice(0, pos) + ',' + curVal.slice(end);
 startRawEdit('iva105', newValue);
 requestAnimationFrame(() => { input.setSelectionRange(pos + 1, pos + 1); });
 return;
 }
 if (e.key === 'Enter') {
 e.preventDefault();
 moveToNextField('iva105');
 }
 }}
 placeholder="0.00"
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="iva27">IVA 27%</Label>
 <Input
 id="iva27"
 type="text"
 value={rawInputs['iva27'] !== undefined ? rawInputs['iva27'] : (formData.iva27 ? formatMoney(formData.iva27) : '')}
 onFocus={(e) => { startRawEdit('iva27', e.target.value); e.target.select(); }}
 onChange={(e) => { startRawEdit('iva27', e.target.value); handleFieldChange('iva27', e.target.value); }}
 onBlur={() => stopRawEdit('iva27')}
 onKeyDown={(e) => {
 if (e.key === '.' || e.code === 'NumpadDecimal') {
 e.preventDefault();
 const input = e.currentTarget;
 const pos = input.selectionStart ?? input.value.length;
 const end = input.selectionEnd ?? pos;
 const curVal = rawInputs['iva27'] ?? input.value;
 const newValue = curVal.slice(0, pos) + ',' + curVal.slice(end);
 startRawEdit('iva27', newValue);
 requestAnimationFrame(() => { input.setSelectionRange(pos + 1, pos + 1); });
 return;
 }
 if (e.key === 'Enter') {
 e.preventDefault();
 moveToNextField('iva27');
 }
 }}
 placeholder="0.00"
 />
 </div>
 </div>

 <div className="grid grid-cols-3 gap-4">
 <div className="space-y-2">
 <Label htmlFor="exento">EXENTO</Label>
 <Input
 id="exento"
 type="text"
 value={rawInputs['exento'] !== undefined ? rawInputs['exento'] : (formData.exento ? formatMoney(formData.exento) : '')}
 onFocus={(e) => { startRawEdit('exento', e.target.value); e.target.select(); }}
 onChange={(e) => { startRawEdit('exento', e.target.value); handleFieldChange('exento', e.target.value); }}
 onBlur={() => stopRawEdit('exento')}
 onKeyDown={(e) => {
 if (e.key === '.' || e.code === 'NumpadDecimal') {
 e.preventDefault();
 const input = e.currentTarget;
 const pos = input.selectionStart ?? input.value.length;
 const end = input.selectionEnd ?? pos;
 const curVal = rawInputs['exento'] ?? input.value;
 const newValue = curVal.slice(0, pos) + ',' + curVal.slice(end);
 startRawEdit('exento', newValue);
 requestAnimationFrame(() => { input.setSelectionRange(pos + 1, pos + 1); });
 return;
 }
 if (e.key === 'Enter') {
 e.preventDefault();
 moveToNextField('exento');
 }
 }}
 placeholder="0.00"
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="iibb">IIBB</Label>
 <Input
 id="iibb"
 type="text"
 value={rawInputs['iibb'] !== undefined ? rawInputs['iibb'] : (formData.iibb ? formatMoney(formData.iibb) : '')}
 onFocus={(e) => { startRawEdit('iibb', e.target.value); e.target.select(); }}
 onChange={(e) => { startRawEdit('iibb', e.target.value); handleFieldChange('iibb', e.target.value); }}
 onBlur={() => stopRawEdit('iibb')}
 onKeyDown={(e) => {
 if (e.key === '.' || e.code === 'NumpadDecimal') {
 e.preventDefault();
 const input = e.currentTarget;
 const pos = input.selectionStart ?? input.value.length;
 const end = input.selectionEnd ?? pos;
 const curVal = rawInputs['iibb'] ?? input.value;
 const newValue = curVal.slice(0, pos) + ',' + curVal.slice(end);
 startRawEdit('iibb', newValue);
 requestAnimationFrame(() => { input.setSelectionRange(pos + 1, pos + 1); });
 return;
 }
 if (e.key === 'Enter') {
 e.preventDefault();
 moveToNextField('iibb');
 }
 }}
 placeholder="0.00"
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="total">Total *</Label>
 <Input
 id="total"
 type="text"
 value={formatMoney(formData.total || '0')}
 readOnly
 className="bg-muted font-bold text-lg"
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
 className="w-full justify-between"
 id="tipoCuenta"
 >
 {formData.tipoCuenta
 ? cuentas.find((c) => c.id === formData.tipoCuenta)?.nombre
 : "Selecciona el tipo de cuenta"}
 <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-[500px] p-0">
 <Command>
 <CommandInput 
 placeholder="Buscar cuenta..." 
 value={cuentaSearch}
 onValueChange={setCuentaSearch}
 />
 <CommandList>
 <CommandEmpty>
 <div className="py-6 text-center text-sm">
 <p className="mb-2">No se encontraron cuentas</p>
 <Button
 variant="outline"
 size="sm"
 onClick={() => handleOpenCuentaModal()}
 className="mt-2"
 >
 <Plus className="w-4 h-4 mr-2" />
 Crear nueva cuenta
 </Button>
 </div>
 </CommandEmpty>
 <CommandGroup>
 {filteredCuentas.map((cuenta) => (
 <div key={cuenta.id} className="flex items-center group">
 <CommandItem
 value={cuenta.id}
 onSelect={() => {
 setFormData({ ...formData, tipoCuenta: cuenta.id });
 setCuentaPopoverOpen(false);
 setCuentaSearch('');
 }}
 className="flex-1"
 >
 <Check
 className={cn(
 "mr-2 h-4 w-4",
 formData.tipoCuenta === cuenta.id ? "opacity-100" : "opacity-0"
 )}
 />
 <div className="flex flex-col">
 <span className="font-medium">{cuenta.nombre}</span>
 {cuenta.descripcion && (
 <span className="text-xs text-muted-foreground">{cuenta.descripcion}</span>
 )}
 </div>
 </CommandItem>
 <div className="flex items-center gap-1 pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
 <Button
 variant="ghost"
 size="sm"
 className="h-7 w-7 p-0"
 onClick={(e) => {
 e.stopPropagation();
 handleOpenCuentaModal(cuenta);
 }}
 >
 <Edit className="h-3 w-3" />
 </Button>
 <Button
 variant="ghost"
 size="sm"
 className="h-7 w-7 p-0 text-destructive hover:text-destructive"
 onClick={(e) => {
 e.stopPropagation();
 handleDeleteCuenta(cuenta.id);
 }}
 >
 <Trash2 className="h-3 w-3" />
 </Button>
 </div>
 </div>
 ))}
 <div className="border-t pt-2 mt-2">
 <Button
 variant="ghost"
 className="w-full justify-start"
 onClick={() => handleOpenCuentaModal()}
 >
 <Plus className="w-4 h-4 mr-2" />
 Crear nueva cuenta
 </Button>
 </div>
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
 onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 const form = e.currentTarget.closest('form');
 if (form) {
 const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement;
 if (submitButton) {
 submitButton.click();
 }
 }
 }
 }}
 placeholder="Notas adicionales..."
 />
 </div>

 {/* Costo Indirecto (Costos V2) */}
 <div className="space-y-3 rounded-lg border p-3">
 <div className="flex items-center justify-between">
 <div>
 <Label htmlFor="esIndirecto" className="text-sm font-medium">
 ¿Es costo indirecto?
 </Label>
 <p className="text-xs text-muted-foreground mt-0.5">
 Aparecerá automáticamente en Costos V2 → Indirectos
 </p>
 </div>
 <Switch
 id="esIndirecto"
 checked={formData.esIndirecto}
 onCheckedChange={(checked) =>
 setFormData({ ...formData, esIndirecto: checked, indirectCategory: checked ? formData.indirectCategory : '' })
 }
 />
 </div>
 {formData.esIndirecto && (
 <div className="space-y-1.5">
 <Label htmlFor="indirectCategory">Categoría de costo indirecto</Label>
 <Select
 value={formData.indirectCategory}
 onValueChange={(val) => setFormData({ ...formData, indirectCategory: val })}
 >
 <SelectTrigger id="indirectCategory">
 <SelectValue placeholder="Seleccionar categoría..." />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="IMP_SERV">Impuestos y Servicios</SelectItem>
 <SelectItem value="UTILITIES">Servicios Públicos</SelectItem>
 <SelectItem value="VEHICLES">Vehículos</SelectItem>
 <SelectItem value="MKT">Marketing</SelectItem>
 <SelectItem value="SOCIAL">Cargas Sociales</SelectItem>
 <SelectItem value="OTHER">Otros</SelectItem>
 </SelectContent>
 </Select>
 </div>
 )}
 {formData.esIndirecto && (
 <div className="space-y-2 pt-1">
 <div className="flex items-center justify-between">
 <Label className="text-sm font-medium">Conceptos del gasto</Label>
 <Button
 type="button"
 variant="outline"
 size="sm"
 className="h-7 text-xs gap-1"
 onClick={() =>
 setConceptos(prev => [
 ...prev,
 { id: Date.now().toString(), descripcion: '', monto: '' },
 ])
 }
 >
 <Plus className="h-3 w-3" />
 Agregar concepto
 </Button>
 </div>
 {conceptos.length === 0 && (
 <p className="text-xs text-muted-foreground italic">
 Opcional: indicá en qué se usó esta factura (ej: &quot;Seguro auto&quot;, &quot;Luz planta&quot;)
 </p>
 )}
 {conceptos.map((concepto, idx) => (
 <div key={concepto.id} className="flex items-center gap-2">
 <Input
 placeholder="Descripción del concepto"
 value={concepto.descripcion}
 onChange={(e) =>
 setConceptos(prev =>
 prev.map((c, i) =>
 i === idx ? { ...c, descripcion: e.target.value } : c
 )
 )
 }
 className="flex-1 h-8 text-sm"
 />
 <Input
 placeholder="Monto"
 value={concepto.monto}
 onChange={(e) =>
 setConceptos(prev =>
 prev.map((c, i) =>
 i === idx ? { ...c, monto: e.target.value } : c
 )
 )
 }
 className="w-28 h-8 text-sm"
 type="number"
 min="0"
 step="0.01"
 />
 <Button
 type="button"
 variant="ghost"
 size="sm"
 className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
 onClick={() =>
 setConceptos(prev => prev.filter((_, i) => i !== idx))
 }
 >
 <Trash2 className="h-3.5 w-3.5" />
 </Button>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Info sobre contado */}
 {formData.tipoPago === 'contado' && (
 <div className="bg-info-muted border border-info-muted rounded-md p-3">
 <div className="flex items-start gap-2">
 <CheckCircle className="w-5 h-5 text-info-muted-foreground mt-0.5" />
 <div>
 <p className="text-sm font-medium text-info-muted-foreground ">
 Comprobante de Contado
 </p>
 <p className="text-xs text-info-muted-foreground mt-1">
 Este comprobante se marcará automáticamente como pagado al guardarlo.
 </p>
 </div>
 </div>
 </div>
 )}
 </div>
 </form>
 </DialogBody>
 <DialogFooter>
 <Button type="button" variant="outline" size="default" onClick={() => {
 onOpenChange(false);
 resetForm();
 }}>
 Cancelar
 </Button>
 <Button type="submit" size="default" onClick={handleSubmit}>
 {comprobanteId ? 'Guardar cambios' : 'Guardar comprobante'}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* Modal para crear/editar item de proveedor */}
 <Dialog
 open={isCreateItemModalOpen}
 onOpenChange={(open) => {
 setIsCreateItemModalOpen(open);
 if (!open) {
 setCreatingItemFor('');
 setNewItemForm({
 nombre: '',
 descripcion: '',
 unidad: '',
 precioUnitario: '',
 });
 setEditingProveedorItem(null);
 }
 }}
 >
 <DialogContent size="md">
 <DialogHeader>
 <DialogTitle>
 {editingProveedorItem ? 'Editar Item del Proveedor' : 'Crear Nuevo Item'}
 </DialogTitle>
 <DialogDescription>
 {editingProveedorItem
 ? 'Modifica los datos del item asociado a este proveedor'
 : 'Crea un nuevo item para este proveedor'}
 </DialogDescription>
 </DialogHeader>
 <DialogBody>
 <div className="space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="itemNombre">Nombre *</Label>
 <Input
 id="itemNombre"
 value={newItemForm.nombre}
 onChange={(e) => setNewItemForm({ ...newItemForm, nombre: e.target.value })}
 placeholder="Nombre interno del item"
 required
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="itemCodigoProveedor">Código del proveedor</Label>
 <Input
 id="itemCodigoProveedor"
 value={newItemForm.codigoProveedor}
 onChange={(e) =>
 setNewItemForm({ ...newItemForm, codigoProveedor: e.target.value })
 }
 placeholder="Código que usa el proveedor en la factura"
 />
 </div>
 </div>
 <div className="space-y-2">
 <Label htmlFor="itemDescripcion">Descripción</Label>
 <Input
 id="itemDescripcion"
 value={newItemForm.descripcion}
 onChange={(e) => setNewItemForm({ ...newItemForm, descripcion: e.target.value })}
 placeholder="Descripción opcional"
 />
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="itemUnidad">Unidad *</Label>
 <Select
 value={newItemForm.unidad}
 onValueChange={(value) => setNewItemForm({ ...newItemForm, unidad: value })}
 >
 <SelectTrigger>
 <SelectValue placeholder="Selecciona la unidad" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="UN">Unidad (un)</SelectItem>
 <SelectItem value="KG">Kilogramo (kg)</SelectItem>
 <SelectItem value="TN">Tonelada (tn)</SelectItem>
 <SelectItem value="M3">Metro cúbico (m3)</SelectItem>
 <SelectItem value="LTS">Litros (lts)</SelectItem>
 <SelectItem value="BOLSA">Bolsa</SelectItem>
 <SelectItem value="CAJA">Caja</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label htmlFor="itemPrecio">Precio Unitario (Referencia)</Label>
 <Input
 id="itemPrecio"
 type="number"
 step="0.01"
 value={newItemForm.precioUnitario}
 onChange={(e) =>
 setNewItemForm({ ...newItemForm, precioUnitario: e.target.value })
 }
 placeholder="0.00"
 />
 </div>
 </div>
 </div>
 </DialogBody>
 <DialogFooter>
 <Button type="button" variant="outline" size="default" onClick={() => setIsCreateItemModalOpen(false)}>
 Cancelar
 </Button>
 <Button type="button" size="default" onClick={createNewItem}>
 Crear Item
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* Modal para crear/editar cuenta */}
 <Dialog open={isCuentaModalOpen} onOpenChange={(open) => {
 setIsCuentaModalOpen(open);
 if (!open) {
 setEditingCuenta(null);
 setCuentaForm({ nombre: '', descripcion: '' });
 }
 }}>
 <DialogContent size="sm">
 <DialogHeader>
 <DialogTitle>
 {editingCuenta ? 'Editar Cuenta' : 'Crear Nueva Cuenta'}
 </DialogTitle>
 <DialogDescription>
 {editingCuenta ? 'Modifica los datos de la cuenta' : 'Crea una nueva cuenta de gasto'}
 </DialogDescription>
 </DialogHeader>
 <DialogBody>
 <div className="space-y-4">
 <div className="space-y-2">
 <Label htmlFor="cuentaNombre">Nombre *</Label>
 <Input
 id="cuentaNombre"
 value={cuentaForm.nombre}
 onChange={(e) => setCuentaForm({ ...cuentaForm, nombre: e.target.value })}
 placeholder="Nombre de la cuenta"
 required
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="cuentaDescripcion">Descripcion</Label>
 <Input
 id="cuentaDescripcion"
 value={cuentaForm.descripcion}
 onChange={(e) => setCuentaForm({ ...cuentaForm, descripcion: e.target.value })}
 placeholder="Descripcion opcional"
 />
 </div>
 </div>
 </DialogBody>
 <DialogFooter>
 <Button type="button" variant="outline" size="default" onClick={() => setIsCuentaModalOpen(false)}>
 Cancelar
 </Button>
 <Button type="button" size="default" onClick={handleSaveCuenta}>
 {editingCuenta ? 'Guardar cambios' : 'Crear cuenta'}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </>
 );
}
