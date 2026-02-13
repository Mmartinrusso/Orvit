'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeft,
  Edit,
  Building2,
  CreditCard,
  FileText,
  Trash2,
  Check,
  Search,
  Download,
  Printer,
  TrendingUp,
  AlertCircle,
  Clock,
  ArrowUpDown,
  Receipt,
  Banknote,
  CircleDollarSign,
  FileWarning,
  Eye,
  X,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  FileDown,
  ClipboardList,
  ChevronUp,
  SlidersHorizontal,
  History,
  ArrowRight,
  Package,
  MoreHorizontal,
  Maximize2,
  Minimize2,
  Truck,
  RefreshCw,
  Paperclip,
  ExternalLink,
  Loader2,
  Send,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import ComprobanteFormModal from '@/components/compras/comprobante-form-modal';
import { generatePaymentOrderPDF, PaymentOrderPDFData } from '@/lib/pdf/payment-order-pdf';
import { pdfToImages } from '@/lib/pdf/pdf-to-image';
import { generateAccountStatementPDF, printAccountStatement, AccountStatementPDFData } from '@/lib/pdf/account-statement-pdf';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import { RegistrarPagoModal } from '@/components/compras/RegistrarPagoModal';
import { CargarRemitoDesdeFacturaModal } from '@/components/compras/cargar-remito-desde-factura-modal';
import { NcaFromFacturaModal } from '@/components/compras/nca-from-factura-modal';
import { DevolucionFromDocumentModal } from '@/components/compras/devolucion-from-document-modal';
import { RelacionesDocumentoModal } from '@/components/compras/relaciones-documento-modal';
import { DatePicker } from '@/components/ui/date-picker';
import { useViewMode } from '@/contexts/ViewModeContext';
import { FileViewer } from '@/components/ui/file-viewer';

// ============ TIPOS ============
interface Proveedor {
  id: string;
  nombre: string;
  razonSocial: string;
  codigo?: string;
  cuit: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  ciudad?: string;
  codigoPostal?: string;
  provincia?: string;
  contactoNombre?: string;
  contactoTelefono?: string;
  contactoEmail?: string;
  condicionesPago?: string;
  notas?: string;
  cbu?: string;
  aliasCbu?: string;
  banco?: string;
  tipoCuenta?: string;
  numeroCuenta?: string;
  condicionIva?: string;
  ingresosBrutos?: string;
  estado: 'activo' | 'inactivo';
  ordenesCompletadas: number;
  montoTotal: number;
  saldoActual?: number;
  createdAt?: Date;
}

interface FacturaCompra {
  id: string;
  numero: string;
  fecha: Date;
  tipo: 'A' | 'B' | 'C';
  docType?: 'T1' | 'T2';  // ViewMode: T1 = documentado, T2 = extendido
  total: number;
  saldo: number;
  estado: 'pendiente' | 'pagada' | 'parcial' | 'vencida';
  vencimiento?: Date;
  ingresoConfirmado?: boolean;
  goodsReceiptId?: number;  // ID del remito vinculado
}

interface Pago {
  id: string;
  fecha: Date;
  monto: number;
  metodo: string;
  facturaId: string;
  facturaNumero: string;
  observaciones?: string;
}

type ChequeTercero = {
  id: string;
  numero: string;
  banco: string;
  titular: string;
  fechaVencimiento: string;
  importe: number;
  tipo: 'CHEQUE' | 'ECHEQ';
};

interface QuickViewItem {
  id: number;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  subtotal: number;
  supplierItem?: {
    id: number;
    nombre: string;
    codigoProveedor?: string;
  };
}

interface QuickViewDetails {
  id: number;
  numeroSerie: string;
  numeroFactura: string;
  tipo: string;
  fechaEmision: string;
  fechaVencimiento?: string;
  estado: string;
  total: number;
  items: QuickViewItem[];
}

// ============ PROPS ============
interface ProveedorCuentaCorrienteProps {
  proveedorId: string;
  showHeader?: boolean;
}

// ============ COMPONENTE ============
export default function ProveedorCuentaCorriente({ proveedorId, showHeader = false }: ProveedorCuentaCorrienteProps) {
  const router = useRouter();

  // ViewMode - esperar a que cargue la config para evitar race condition
  const { mode, isLoading: viewModeLoading } = useViewMode();

  // Estados principales
  const [proveedor, setProveedor] = useState<Proveedor | null>(null);
  const [facturas, setFacturas] = useState<FacturaCompra[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [ordenesPago, setOrdenesPago] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Deduplicar pagos
  const pagosUnicosRender = useMemo(() => {
    const pagosMap = new Map<string, Pago>();
    pagos.forEach(pago => {
      const uniqueKey = `${pago.id}-${pago.fecha.getTime()}-${pago.monto}`;
      if (!pagosMap.has(uniqueKey)) {
        pagosMap.set(uniqueKey, pago);
      }
    });
    return Array.from(pagosMap.values());
  }, [pagos]);

  // Estados para anticipos
  const [anticipoProveedor, setAnticipoProveedor] = useState<number>(0);
  const [anticiposDisponibles, setAnticiposDisponibles] = useState<{ id: string; fecha: Date; monto: number }[]>([]);
  const [anticiposSeleccionados, setAnticiposSeleccionados] = useState<string[]>([]);

  // Estados para modales
  const [isPagoModalOpen, setIsPagoModalOpen] = useState(false);
  const [isSubmittingPago, setIsSubmittingPago] = useState(false);
  const [isDetallePagoOpen, setIsDetallePagoOpen] = useState(false);
  const [isBancoModalOpen, setIsBancoModalOpen] = useState(false);
  const [isChequesModalOpen, setIsChequesModalOpen] = useState(false);
  const [pagoDetalleSeleccionado, setPagoDetalleSeleccionado] = useState<any | null>(null);
  const [pagoDetalleAttachments, setPagoDetalleAttachments] = useState<Array<{id: number; fileName: string; fileUrl: string; fileType: string}>>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [uploadingComprobantesOP, setUploadingComprobantesOP] = useState(false);
  const comprobantesInputRef = useRef<HTMLInputElement>(null);
  const [isFacturaEditModalOpen, setIsFacturaEditModalOpen] = useState(false);
  const [facturaEditandoId, setFacturaEditandoId] = useState<string | null>(null);
  const [facturaEditandoDocType, setFacturaEditandoDocType] = useState<'T1' | 'T2' | null>(null);
  const [isNuevoComprobanteModalOpen, setIsNuevoComprobanteModalOpen] = useState(false);
  const [isOCModalOpen, setIsOCModalOpen] = useState(false);

  // Estados para carga de PDF con IA
  const [showPdfUploader, setShowPdfUploader] = useState(false);
  const [pdfProcessing, setPdfProcessing] = useState(false);
  const [prefilledData, setPrefilledData] = useState<any>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Quick View de factura
  const [quickViewFactura, setQuickViewFactura] = useState<FacturaCompra | null>(null);
  const [quickViewPosition, setQuickViewPosition] = useState<{ x: number; y: number } | null>(null);
  const [quickViewDetails, setQuickViewDetails] = useState<QuickViewDetails | null>(null);
  const [quickViewLoading, setQuickViewLoading] = useState(false);
  const [quickViewExpanded, setQuickViewExpanded] = useState(false);

  // Estados para eliminar
  const [facturaAEliminar, setFacturaAEliminar] = useState<FacturaCompra | null>(null);
  const [isDeleteFacturaOpen, setIsDeleteFacturaOpen] = useState(false);
  const [deleteFacturaLoading, setDeleteFacturaLoading] = useState(false);

  // Estados para cargar remito
  const [facturaIngresoStock, setFacturaIngresoStock] = useState<any | null>(null);
  const [isIngresoModalOpen, setIsIngresoModalOpen] = useState(false);
  const [ordenPagoAEliminar, setOrdenPagoAEliminar] = useState<any | null>(null);
  const [isDeleteOrdenPagoOpen, setIsDeleteOrdenPagoOpen] = useState(false);
  const [deleteOrdenPagoLoading, setDeleteOrdenPagoLoading] = useState(false);

  // Estados para eliminar NCA/NC
  const [ncaAEliminar, setNcaAEliminar] = useState<{
    id: number;
    numero: string;
    purchaseReturn?: { id: number; numero: string; estado: string };
    aplicada?: boolean;
  } | null>(null);
  const [isDeleteNcaOpen, setIsDeleteNcaOpen] = useState(false);
  const [deleteNcaLoading, setDeleteNcaLoading] = useState(false);

  // Estados para NCA/NC desde factura
  const [ncaModalOpen, setNcaModalOpen] = useState(false);
  const [ncaFacturaData, setNcaFacturaData] = useState<{
    facturaId: number;
    facturaNumero: string;
    proveedorId: number;
    proveedorNombre: string;
    items: any[];
    totalFactura: number;
    ingresoConfirmado: boolean;
    facturaDocType: 'T1' | 'T2';
  } | null>(null);

  // Estados para Devolucion desde factura
  const [devolucionModalOpen, setDevolucionModalOpen] = useState(false);
  const [devolucionFacturaData, setDevolucionFacturaData] = useState<{
    facturaId: number;
    facturaNumero: string;
    proveedorId: number;
    proveedorNombre: string;
    items: any[];
    docType?: 'T1' | 'T2';
  } | null>(null);

  // Estados para ver relaciones de documento
  const [relacionesModalOpen, setRelacionesModalOpen] = useState(false);
  const [relacionesFacturaData, setRelacionesFacturaData] = useState<{
    facturaId: number;
    facturaNumero: string;
    facturaTotal: number;
    proveedorId: number;
    facturaDocType?: 'T1' | 'T2';
  } | null>(null);

  // Estados para selección de facturas
  const [selectedFacturas, setSelectedFacturas] = useState<string[]>([]);
  const [lastFacturaIndexClicked, setLastFacturaIndexClicked] = useState<number | null>(null);

  // Form de pago
  const [pagoForm, setPagoForm] = useState({
    efectivo: '',
    dolares: '',
    transferencia: '',
    chequesTerceros: '',
    chequesPropios: '',
    retIVA: '',
    retGanancias: '',
    retIngBrutos: '',
    notas: '',
  });

  // Estados para filtros de Cuenta Corriente
  const [ccSearchTerm, setCcSearchTerm] = useState('');
  const [ccItemSearch, setCcItemSearch] = useState(''); // Búsqueda por item
  const [ccEstadoFilter, setCcEstadoFilter] = useState<string>('todos');
  const [ccFechaDesde, setCcFechaDesde] = useState<string>('');
  const [ccFechaHasta, setCcFechaHasta] = useState<string>('');
  const [ccSortField, setCcSortField] = useState<'fecha' | 'total' | 'saldo' | 'vencimiento'>('fecha');
  const [ccSortDirection, setCcSortDirection] = useState<'asc' | 'desc'>('desc');
  const [ccPageFacturas, setCcPageFacturas] = useState(1);
  const [ccPagePagos, setCcPagePagos] = useState(1);
  const ccItemsPerPage = 10;
  const [ccSoloPendientes, setCcSoloPendientes] = useState(false);
  const [ccPeriodo, setCcPeriodo] = useState<'todos' | 'hoy' | 'semana' | 'mes' | 'trimestre'>('todos');
  const [ccFiltrosVisibles, setCcFiltrosVisibles] = useState(true);
  const [ccTimelineVisible, setCcTimelineVisible] = useState(true);

  // Estado para vista de cuenta corriente: "todo", "pendiente" o "relaciones"
  const [ccVistaActual, setCcVistaActual] = useState<'todo' | 'pendiente' | 'relaciones'>('todo');

  // Estados para Notas de Crédito (NCA)
  const [notasCredito, setNotasCredito] = useState<Array<{
    id: number;
    numero: string;
    numeroInterno?: string;
    fecha: string;
    tipo: 'NCA' | 'NDA';
    tipoNca?: string;
    docType?: 'T1' | 'T2';
    monto: number;
    aplicada: boolean;
    estado?: string;
    facturaId?: number;
    facturaRelacionada?: string;
    purchaseReturnId?: number;
    purchaseReturn?: { id: number; numero: string; estado: string };
  }>>([]);

  // Estado para ver detalle de NCA/NC
  const [ncaDetalleOpen, setNcaDetalleOpen] = useState(false);
  const [ncaDetalleData, setNcaDetalleData] = useState<{
    id: number;
    numero: string;
    tipo: 'NCA' | 'NDA';
    tipoNca?: string;
    docType?: 'T1' | 'T2';
    monto: number;
    fecha: string;
    estado?: string;
    aplicada: boolean;
    facturaRelacionada?: string;
    purchaseReturn?: { id: number; numero: string; estado: string };
  } | null>(null);

  // Estados para OC
  const [ordenesCompra, setOrdenesCompra] = useState<Array<{
    id: string;
    numero: string;
    fecha: string;
    estado: string;
    total: number;
    itemsCount: number;
  }>>([]);
  const [loadingOC, setLoadingOC] = useState(false);

  // Estados para Recepciones (Remitos)
  const [recepciones, setRecepciones] = useState<Array<{
    id: number;
    numero: string;
    fechaRecepcion: string;
    numeroRemito?: string;
    estado: string;
    itemsCount: number;
    adjuntos?: string[];
    firma?: string;
    facturaId?: number;
    facturaNumero?: string;
    purchaseOrderId?: number;
  }>>([]);
  const [recepcionVistaModal, setRecepcionVistaModal] = useState<{
    id: number;
    adjuntos?: string[];
    firma?: string;
  } | null>(null);
  const [recepcionDetalleModal, setRecepcionDetalleModal] = useState<{
    id: number;
    numero: string;
    fechaRecepcion: string;
    numeroRemito?: string;
    estado: string;
    itemsCount: number;
    adjuntos?: string[];
    firma?: string;
    facturaId?: number;
    facturaNumero?: string;
  } | null>(null);
  const [evidenciaViewer, setEvidenciaViewer] = useState<{
    url: string;
    fileName: string;
  } | null>(null);
  const [remitoAEliminar, setRemitoAEliminar] = useState<{ id: number; numero: string } | null>(null);
  const [isDeleteRemitoOpen, setIsDeleteRemitoOpen] = useState(false);
  const [deleteRemitoLoading, setDeleteRemitoLoading] = useState(false);

  // Cheques de terceros (mock)
  const [chequesCartera, setChequesCartera] = useState<ChequeTercero[]>([
    { id: 'ch1', numero: '00012345', banco: 'Banco Nación', titular: 'Cliente Ejemplo 1', fechaVencimiento: '2025-03-10', importe: 150000, tipo: 'CHEQUE' },
    { id: 'ch2', numero: '00054321', banco: 'Banco Provincia', titular: 'Cliente Ejemplo 2', fechaVencimiento: '2025-04-05', importe: 275000, tipo: 'ECHEQ' },
    { id: 'ch3', numero: '00123456', banco: 'Banco Galicia', titular: 'Cliente Ejemplo 3', fechaVencimiento: '2025-05-20', importe: 98000, tipo: 'CHEQUE' },
  ]);
  const [selectedCheques, setSelectedCheques] = useState<string[]>([]);

  // Filtros de cheques
  const [chequesFilters, setChequesFilters] = useState({
    texto: '',
    montoDesde: '',
    montoHasta: '',
    fechaDesdeInput: '',
    fechaHastaInput: '',
    fechaDesdeIso: '',
    fechaHastaIso: '',
  });
  const [verMarcados, setVerMarcados] = useState(false);

  // ============ FUNCIONES HELPER ============
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('es-AR');
  };

  const getPrefijoComprobante = (tipoCompleto?: string | null): string => {
    if (!tipoCompleto) return '';
    const t = tipoCompleto.toLowerCase();
    if (t.includes('factura a')) return 'FCA-';
    if (t.includes('factura b')) return 'FCB-';
    if (t.includes('factura c')) return 'FCC-';
    return '';
  };

  const getDiasVencimiento = (fechaVencimiento: Date | string | null, saldo: number): { dias: number; texto: string; color: string } | null => {
    if (!fechaVencimiento || saldo === 0) return null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const venc = new Date(fechaVencimiento);
    venc.setHours(0, 0, 0, 0);
    const diffTime = venc.getTime() - hoy.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      return { dias: Math.abs(diffDays), texto: `${Math.abs(diffDays)}d vencida`, color: 'text-red-600 bg-red-50 dark:bg-red-900/20' };
    } else if (diffDays === 0) {
      return { dias: 0, texto: 'Hoy', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' };
    } else if (diffDays <= 7) {
      return { dias: diffDays, texto: `${diffDays}d`, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' };
    } else if (diffDays <= 30) {
      return { dias: diffDays, texto: `${diffDays}d`, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' };
    }
    return { dias: diffDays, texto: `${diffDays}d`, color: 'text-muted-foreground bg-muted/50' };
  };

  const getEstadoBadge = (estado: string) => {
    // Normalizar estado a minúsculas para el mapeo
    const estadoNorm = estado?.toLowerCase() || '';

    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      'pagada': 'default',
      'pendiente': 'outline',
      'parcial': 'secondary',
      'vencida': 'destructive',
      'disponible': 'default',
      'aplicada': 'default',
      'confirmada': 'default',
      'borrador': 'outline',
    };
    const labels: Record<string, string> = {
      'pagada': 'Pagada',
      'pendiente': 'Pendiente',
      'parcial': 'Parcial',
      'vencida': 'Vencida',
      'disponible': 'Disponible',
      'aplicada': 'Aplicada',
      'confirmada': 'Confirmada',
      'borrador': 'Borrador',
    };
    const icons: Record<string, React.ReactNode> = {
      'pagada': <Check className="w-3 h-3" />,
      'aplicada': <Check className="w-3 h-3" />,
      'confirmada': <Check className="w-3 h-3" />,
    };

    // Capitalizar primera letra si no está en labels
    const labelFinal = labels[estadoNorm] || (estado ? estado.charAt(0).toUpperCase() + estado.slice(1).toLowerCase() : estado);

    return (
      <Badge variant={variants[estadoNorm] || 'outline'} className="flex items-center gap-1">
        {icons[estadoNorm]}
        {labelFinal}
      </Badge>
    );
  };

  // ============ CALCULOS ============
  const totalFacturado = facturas.reduce((sum, f) => sum + f.total, 0);
  const totalPagado = pagosUnicosRender.reduce((sum, p) => sum + p.monto, 0);
  const saldoTotal = facturas.reduce((sum, f) => sum + f.saldo, 0);

  const estadisticasCuenta = useMemo(() => {
    const facturasVencidas = facturas.filter(f => {
      if (!f.vencimiento || f.saldo === 0) return false;
      return new Date(f.vencimiento) < new Date();
    });
    const facturasProximasVencer = facturas.filter(f => {
      if (!f.vencimiento || f.saldo === 0) return false;
      const venc = new Date(f.vencimiento);
      const hoy = new Date();
      const en7Dias = new Date();
      en7Dias.setDate(hoy.getDate() + 7);
      return venc >= hoy && venc <= en7Dias;
    });
    return {
      facturasVencidas: facturasVencidas.length,
      montoVencido: facturasVencidas.reduce((sum, f) => sum + f.saldo, 0),
      facturasProximasVencer: facturasProximasVencer.length,
      montoProximoVencer: facturasProximasVencer.reduce((sum, f) => sum + f.saldo, 0),
    };
  }, [facturas]);

  // Filtros y ordenamiento
  const facturasFiltradas = useMemo(() => {
    let result = [...facturas];
    if (ccSearchTerm) {
      const term = ccSearchTerm.toLowerCase();
      result = result.filter(f => f.numero.toLowerCase().includes(term));
    }
    if (ccEstadoFilter !== 'todos') {
      result = result.filter(f => f.estado === ccEstadoFilter);
    }
    if (ccSoloPendientes) {
      result = result.filter(f => f.saldo > 0);
    }
    if (ccFechaDesde) {
      const desde = new Date(ccFechaDesde);
      result = result.filter(f => new Date(f.fecha) >= desde);
    }
    if (ccFechaHasta) {
      const hasta = new Date(ccFechaHasta);
      result = result.filter(f => new Date(f.fecha) <= hasta);
    }
    result.sort((a, b) => {
      let comparison = 0;
      switch (ccSortField) {
        case 'fecha': comparison = new Date(a.fecha).getTime() - new Date(b.fecha).getTime(); break;
        case 'total': comparison = a.total - b.total; break;
        case 'saldo': comparison = a.saldo - b.saldo; break;
        case 'vencimiento':
          const aVenc = a.vencimiento ? new Date(a.vencimiento).getTime() : 0;
          const bVenc = b.vencimiento ? new Date(b.vencimiento).getTime() : 0;
          comparison = aVenc - bVenc;
          break;
      }
      return ccSortDirection === 'asc' ? comparison : -comparison;
    });
    return result;
  }, [facturas, ccSearchTerm, ccEstadoFilter, ccSoloPendientes, ccFechaDesde, ccFechaHasta, ccSortField, ccSortDirection]);

  const facturasPaginadas = useMemo(() => {
    const start = (ccPageFacturas - 1) * ccItemsPerPage;
    return facturasFiltradas.slice(start, start + ccItemsPerPage);
  }, [facturasFiltradas, ccPageFacturas]);

  const totalPagesFacturas = Math.ceil(facturasFiltradas.length / ccItemsPerPage);

  const pagosFiltrados = useMemo(() => {
    if (!ccSearchTerm) return pagosUnicosRender;
    const term = ccSearchTerm.toLowerCase();
    return pagosUnicosRender.filter(p =>
      p.facturaNumero?.toLowerCase().includes(term) || p.metodo?.toLowerCase().includes(term)
    );
  }, [pagosUnicosRender, ccSearchTerm]);

  const pagosPaginados = useMemo(() => {
    const start = (ccPagePagos - 1) * ccItemsPerPage;
    return pagosFiltrados.slice(start, start + ccItemsPerPage);
  }, [pagosFiltrados, ccPagePagos]);

  const totalPagesPagos = Math.ceil(pagosFiltrados.length / ccItemsPerPage);

  // Timeline de movimientos (incluye facturas, pagos, recepciones y NCA)
  const timelineMovimientos = useMemo(() => {
    const movimientos: Array<{
      id: string;
      tipo: 'factura' | 'pago' | 'recepcion' | 'nca' | 'anticipo';
      fecha: Date;
      descripcion: string;
      monto: number;
      saldo?: number;
      estado?: string;
      numero?: string;
      adjuntos?: string[];
      firma?: string;
      recepcionId?: number;
    }> = [];
    facturas.forEach(f => {
      movimientos.push({
        id: `f-${f.id}`,
        tipo: 'factura',
        fecha: new Date(f.fecha),
        descripcion: `Factura ${f.numero}`,
        monto: f.total,
        saldo: f.saldo,
        estado: f.estado,
        numero: f.numero,
      });
    });
    pagosUnicosRender.forEach(p => {
      movimientos.push({
        id: `p-${p.id}`,
        tipo: 'pago',
        fecha: p.fecha,
        descripcion: p.facturaNumero ? `Pago - ${p.facturaNumero}` : 'Pago registrado',
        monto: p.monto,
        numero: p.facturaNumero,
      });
    });
    // Agregar recepciones (remitos) al timeline
    recepciones.forEach(r => {
      movimientos.push({
        id: `r-${r.id}`,
        tipo: 'recepcion',
        fecha: new Date(r.fechaRecepcion),
        descripcion: r.numeroRemito ? `Remito ${r.numeroRemito}` : `Recepción ${r.numero}`,
        monto: 0, // Las recepciones no tienen monto directo
        estado: r.estado,
        numero: r.numeroRemito || r.numero,
        adjuntos: r.adjuntos,
        firma: r.firma,
        recepcionId: r.id,
      });
    });
    // Agregar notas de crédito al timeline
    notasCredito.forEach(nc => {
      movimientos.push({
        id: `nc-${nc.id}`,
        tipo: 'nca',
        fecha: new Date(nc.fecha),
        descripcion: nc.numero,
        monto: nc.monto,
        estado: nc.aplicada ? 'aplicada' : 'pendiente',
        numero: nc.numero,
      });
    });
    // Agregar anticipos al timeline
    anticiposDisponibles.forEach(ant => {
      movimientos.push({
        id: `ant-${ant.id}`,
        tipo: 'anticipo',
        fecha: new Date(ant.fecha),
        descripcion: `Anticipo ${formatCurrency(ant.monto)}`,
        monto: ant.monto,
        estado: 'disponible',
        numero: `ANT-${ant.id}`,
      });
    });
    return movimientos.sort((a, b) => b.fecha.getTime() - a.fecha.getTime()).slice(0, 20);
  }, [facturas, pagosUnicosRender, recepciones, notasCredito, anticiposDisponibles]);

  // Datos unificados para la vista de Cuenta Corriente (Todo vs Pendiente)
  type DocumentoCC = {
    id: string;
    tipo: 'FCA' | 'PPT' | 'NCA' | 'OP' | 'REMITO' | 'ANT';
    numero: string;
    fecha: Date;
    docType?: 'T1' | 'T2';
    debe: number;  // Lo que debemos (facturas)
    haber: number; // Lo que nos descuentan (NCA, pagos, anticipos)
    saldo: number;
    estado: string;
    descripcion?: string;
    vencimiento?: Date;
    ingresoConfirmado?: boolean;
  };

  const documentosCCUnificados = useMemo(() => {
    const docs: DocumentoCC[] = [];

    // Facturas (FCA) o Presupuestos (PPT) - van al DEBE
    facturas.forEach(f => {
      // Si es docType T2, mostrar como PPT
      const tipoDoc = f.docType === 'T2' ? 'PPT' : 'FCA';
      const idPrefix = f.docType === 'T2' ? 'ppt' : 'fca';
      docs.push({
        id: `${idPrefix}-${f.id}`,
        tipo: tipoDoc,
        numero: f.numero,
        fecha: new Date(f.fecha),
        docType: f.docType,
        debe: f.total,
        haber: 0,
        saldo: f.saldo,
        estado: f.estado,
        vencimiento: f.vencimiento,
        ingresoConfirmado: f.ingresoConfirmado,
      });
    });

    // Notas de Crédito (NCA/NC) - van al HABER
    // T1 = NCA (Nota de Crédito A), T2 = NC (Nota de Crédito)
    notasCredito.forEach(nc => {
      const tipoNota = nc.docType === 'T2' ? 'NC' : 'NCA';
      docs.push({
        id: `nca-${nc.id}`,
        tipo: tipoNota,
        numero: nc.numero,
        fecha: new Date(nc.fecha),
        docType: nc.docType,
        debe: 0,
        haber: nc.monto,
        saldo: nc.aplicada ? 0 : -nc.monto, // Saldo a favor si no está aplicada
        estado: nc.aplicada ? 'aplicada' : 'pendiente',
        descripcion: nc.facturaRelacionada ? `Ref: ${nc.facturaRelacionada}` : undefined,
      });
    });

    // Órdenes de Pago (OP) - van al HABER
    ordenesPago.forEach(op => {
      const totalPago = Number(op.totalPago || 0);
      docs.push({
        id: `op-${op.id}`,
        tipo: 'OP',
        numero: `OP-${op.numero || op.id}`,
        fecha: new Date(op.fechaPago),
        debe: 0,
        haber: totalPago,
        saldo: 0,
        estado: 'pagada',
        descripcion: op.notas,
      });
    });

    // Remitos (REMITO) - informativos, sin impacto en saldo
    recepciones.forEach(r => {
      docs.push({
        id: `rem-${r.id}`,
        tipo: 'REMITO',
        numero: r.numeroRemito || r.numero,
        fecha: new Date(r.fechaRecepcion),
        debe: 0,
        haber: 0,
        saldo: 0,
        estado: r.estado,
        descripcion: `${r.itemsCount} items`,
      });
    });

    // Anticipos (ANT) - saldo a favor, van al HABER
    anticiposDisponibles.forEach(ant => {
      docs.push({
        id: `ant-${ant.id}`,
        tipo: 'ANT',
        numero: `ANT-${ant.id}`,
        fecha: new Date(ant.fecha),
        debe: 0,
        haber: ant.monto,
        saldo: -ant.monto, // Saldo a favor
        estado: 'disponible',
      });
    });

    return docs.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
  }, [facturas, notasCredito, ordenesPago, recepciones, anticiposDisponibles]);

  // Filtrar documentos según la vista actual (Todo o Pendiente) y T1/T2
  const documentosCCFiltrados = useMemo(() => {
    let docs = [...documentosCCUnificados];

    // Filtrar por T1/T2 según viewMode
    if (mode === 'T1') {
      docs = docs.filter(d => d.docType !== 'T2');
    } else if (mode === 'T2') {
      docs = docs.filter(d => d.docType !== 'T1');
    }

    // Filtrar por vista
    if (ccVistaActual === 'pendiente') {
      // Solo mostrar documentos con saldo pendiente (facturas no pagadas)
      docs = docs.filter(d => {
        if (d.tipo === 'FCA' || d.tipo === 'PPT') return d.saldo > 0;
        if (d.tipo === 'NCA') return !d.estado.includes('aplicada');
        if (d.tipo === 'ANT') return d.estado === 'disponible';
        return false; // OP y REMITO no aparecen en pendientes
      });
    }

    // Aplicar filtros existentes
    if (ccSearchTerm) {
      const term = ccSearchTerm.toLowerCase();
      docs = docs.filter(d => d.numero.toLowerCase().includes(term) || d.descripcion?.toLowerCase().includes(term));
    }

    if (ccEstadoFilter !== 'todos') {
      docs = docs.filter(d => d.estado === ccEstadoFilter);
    }

    if (ccFechaDesde) {
      const desde = new Date(ccFechaDesde);
      docs = docs.filter(d => d.fecha >= desde);
    }

    if (ccFechaHasta) {
      const hasta = new Date(ccFechaHasta);
      docs = docs.filter(d => d.fecha <= hasta);
    }

    // Ordenar
    docs.sort((a, b) => {
      let comparison = 0;
      switch (ccSortField) {
        case 'fecha': comparison = a.fecha.getTime() - b.fecha.getTime(); break;
        case 'total': comparison = a.debe - b.debe; break;
        case 'saldo': comparison = a.saldo - b.saldo; break;
        case 'vencimiento':
          const aVenc = a.vencimiento ? a.vencimiento.getTime() : 0;
          const bVenc = b.vencimiento ? b.vencimiento.getTime() : 0;
          comparison = aVenc - bVenc;
          break;
      }
      return ccSortDirection === 'asc' ? comparison : -comparison;
    });

    return docs;
  }, [documentosCCUnificados, mode, ccVistaActual, ccSearchTerm, ccEstadoFilter, ccFechaDesde, ccFechaHasta, ccSortField, ccSortDirection]);

  // Paginación para documentos CC
  const documentosCCPaginados = useMemo(() => {
    const start = (ccPageFacturas - 1) * ccItemsPerPage;
    return documentosCCFiltrados.slice(start, start + ccItemsPerPage);
  }, [documentosCCFiltrados, ccPageFacturas]);

  const totalPagesDocumentosCC = Math.ceil(documentosCCFiltrados.length / ccItemsPerPage);

  // Vista de Relaciones: agrupa documentos por factura
  type FacturaConRelaciones = {
    factura: DocumentoCC;
    relacionados: DocumentoCC[];
    totalPagado: number;
    totalCreditos: number;
    saldoPendiente: number;
  };

  const documentosAgrupadosPorFactura = useMemo(() => {
    // Obtener solo facturas (FCA o PPT)
    const facturasBase = documentosCCUnificados.filter(d => d.tipo === 'FCA' || d.tipo === 'PPT');

    // Para cada factura, buscar sus documentos relacionados
    const grupos: FacturaConRelaciones[] = facturasBase.map(factura => {
      const facturaIdNum = Number(factura.id.replace(/^(fca|ppt)-/, ''));

      // Buscar NCAs relacionadas a esta factura
      const ncasRelacionadas = notasCredito
        .filter(nc => nc.facturaId === facturaIdNum)
        .map(nc => documentosCCUnificados.find(d => d.id === `nca-${nc.id}`))
        .filter(Boolean) as DocumentoCC[];

      // Buscar OPs relacionadas a esta factura (las que tienen allocation a esta factura)
      // La API devuelve "recibos" (no "receipts")
      const opsRelacionadas = ordenesPago
        .filter(op => {
          const recibos = op.recibos || op.receipts || [];
          return recibos.some((r: any) =>
            r.receiptId === facturaIdNum ||
            r.receipt?.id === facturaIdNum ||
            Number(r.receiptId) === facturaIdNum ||
            Number(r.receipt?.id) === facturaIdNum
          );
        })
        .map(op => documentosCCUnificados.find(d => d.id === `op-${op.id}`))
        .filter(Boolean) as DocumentoCC[];

      // Buscar Remitos relacionados a esta factura
      // 1. Por facturaId directo en la recepción
      // 2. Por goodsReceiptId en la factura (relación inversa)
      const facturaOriginal = facturas.find(f => f.id === String(facturaIdNum));
      const remitosRelacionados = recepciones
        .filter(r =>
          r.facturaId === facturaIdNum ||
          (facturaOriginal?.goodsReceiptId && r.id === facturaOriginal.goodsReceiptId)
        )
        .map(r => documentosCCUnificados.find(d => d.id === `rem-${r.id}`))
        .filter(Boolean) as DocumentoCC[];

      // Calcular totales
      const totalPagado = opsRelacionadas.reduce((sum, op) => sum + (op?.haber || 0), 0);
      const totalCreditos = ncasRelacionadas.reduce((sum, nc) => sum + (nc?.haber || 0), 0);
      const saldoPendiente = factura.debe - totalPagado - totalCreditos;

      return {
        factura,
        relacionados: [...opsRelacionadas, ...remitosRelacionados, ...ncasRelacionadas].sort((a, b) => b.fecha.getTime() - a.fecha.getTime()),
        totalPagado,
        totalCreditos,
        saldoPendiente,
      };
    });

    // Solo mostrar facturas que tienen al menos un documento relacionado o saldo pendiente
    return grupos.filter(g => g.relacionados.length > 0 || g.saldoPendiente > 0);
  }, [documentosCCUnificados, notasCredito, ordenesPago, recepciones, facturas]);

  const hayFiltrosActivos = ccSearchTerm || ccItemSearch || ccEstadoFilter !== 'todos' || ccFechaDesde || ccFechaHasta || ccSoloPendientes || ccPeriodo !== 'todos';

  // ============ FUNCIONES DE PERIODO ============
  const aplicarFiltroPeriodo = (periodo: 'todos' | 'hoy' | 'semana' | 'mes' | 'trimestre') => {
    setCcPeriodo(periodo);
    setCcPageFacturas(1);
    const hoy = new Date();
    const formatoFecha = (d: Date) => d.toISOString().split('T')[0];
    switch (periodo) {
      case 'hoy':
        setCcFechaDesde(formatoFecha(hoy));
        setCcFechaHasta(formatoFecha(hoy));
        break;
      case 'semana':
        const inicioSemana = new Date(hoy);
        inicioSemana.setDate(hoy.getDate() - hoy.getDay());
        setCcFechaDesde(formatoFecha(inicioSemana));
        setCcFechaHasta(formatoFecha(hoy));
        break;
      case 'mes':
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        setCcFechaDesde(formatoFecha(inicioMes));
        setCcFechaHasta(formatoFecha(hoy));
        break;
      case 'trimestre':
        const inicioTrimestre = new Date(hoy);
        inicioTrimestre.setMonth(hoy.getMonth() - 3);
        setCcFechaDesde(formatoFecha(inicioTrimestre));
        setCcFechaHasta(formatoFecha(hoy));
        break;
      case 'todos':
        setCcFechaDesde('');
        setCcFechaHasta('');
        break;
    }
  };

  const limpiarFiltros = () => {
    setCcSearchTerm('');
    setCcItemSearch('');
    setCcEstadoFilter('todos');
    setCcFechaDesde('');
    setCcFechaHasta('');
    setCcSoloPendientes(false);
    setCcPeriodo('todos');
    setCcPageFacturas(1);
    setCcPagePagos(1);
  };

  // ============ FUNCIONES DE CARGA ============
  const loadQuickViewDetails = async (facturaId: string, docType?: 'T1' | 'T2') => {
    setQuickViewLoading(true);
    setQuickViewDetails(null);
    try {
      const params = docType ? `?docType=${docType}` : '';
      const response = await fetch(`/api/compras/comprobantes/${facturaId}${params}`);
      if (response.ok) {
        const data = await response.json();
        setQuickViewDetails(data);
      }
    } catch (error) {
      console.error('Error loading quick view details:', error);
    } finally {
      setQuickViewLoading(false);
    }
  };

  const loadProveedorData = async (id: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/compras/proveedores/${id}`, { cache: 'force-cache' });
      if (!response.ok) throw new Error('Error al obtener el proveedor');
      const p = await response.json();

      const mapped: Proveedor = {
        id: String(p.id),
        nombre: p.name,
        razonSocial: p.razon_social || p.name,
        codigo: p.codigo || undefined,
        cuit: p.cuit || '',
        email: p.email || undefined,
        telefono: p.phone || undefined,
        direccion: p.address || undefined,
        ciudad: p.city || undefined,
        codigoPostal: p.postal_code || undefined,
        provincia: p.province || undefined,
        contactoNombre: p.contact_person || undefined,
        contactoTelefono: p.contact_phone || undefined,
        contactoEmail: p.contact_email || undefined,
        condicionesPago: p.condiciones_pago || undefined,
        notas: p.notes || undefined,
        cbu: p.cbu || undefined,
        aliasCbu: p.alias_cbu || undefined,
        banco: p.banco || undefined,
        tipoCuenta: p.tipo_cuenta || undefined,
        numeroCuenta: p.numero_cuenta || undefined,
        condicionIva: p.condicion_iva || undefined,
        ingresosBrutos: p.ingresos_brutos || undefined,
        estado: 'activo',
        ordenesCompletadas: 0,
        montoTotal: 0,
        saldoActual: undefined,
        createdAt: p.created_at ? new Date(p.created_at) : undefined,
      };
      setProveedor(mapped);

      const timestamp = Date.now();
      const [facturasResponse, pagosResponse] = await Promise.all([
        fetch(`/api/compras/comprobantes?proveedorId=${id}&_t=${timestamp}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }),
        fetch(`/api/compras/ordenes-pago?proveedorId=${id}&_t=${timestamp}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } })
      ]);

      if (facturasResponse.ok) {
        const comprobantes = await facturasResponse.json();
        const mappedFacturas: FacturaCompra[] = (comprobantes || []).map((c: any) => {
          const tipoLetra = (c.tipo && typeof c.tipo === 'string' ? (c.tipo.match(/([ABC])$/)?.[1] as 'A' | 'B' | 'C' | undefined) : 'A') || 'A';
          const docType = c.docType as 'T1' | 'T2' | undefined;
          // Para T2 usar prefijo PPT, para T1 usar prefijo normal
          const prefijo = docType === 'T2' ? 'PPT-' : getPrefijoComprobante(c.tipo);
          return {
            id: String(c.id),
            numero: `${prefijo}${c.numeroSerie}-${c.numeroFactura}`,
            fecha: new Date(c.fechaEmision),
            tipo: tipoLetra,
            docType: docType,
            total: Number(c.total) || 0,
            saldo: c.estado === 'pagada' ? 0 : Number(c.total) || 0,
            estado: c.estado as 'pendiente' | 'pagada' | 'parcial' | 'vencida',
            vencimiento: c.fechaVencimiento ? new Date(c.fechaVencimiento) : undefined,
            ingresoConfirmado: c.ingresoConfirmado || false,
            goodsReceiptId: c.goodsReceiptId ? Number(c.goodsReceiptId) : undefined,
          };
        });
        setFacturas(mappedFacturas);
      } else {
        setFacturas([]);
      }

      if (pagosResponse.ok) {
        const ordenes = await pagosResponse.json();
        const ordenesUnicas = Array.from(new Map((ordenes || []).map((o: any) => [o.id, o])).values());

        const anticipos = (ordenesUnicas as any[])
          .filter((o: any) => Number(o.anticipo || 0) > 0)
          .map((o: any) => ({ id: String(o.id), fecha: new Date(o.fechaPago), monto: Number(o.anticipo || 0) }));

        setAnticipoProveedor(anticipos.reduce((sum, a) => sum + a.monto, 0));
        setAnticiposDisponibles(anticipos);

        const mappedPagos: Pago[] = (ordenesUnicas as any[]).map((o: any) => {
          const recibos = o.recibos || [];
          const primeraFactura = recibos[0]?.receipt;
          const facturaNumero = !primeraFactura ? '-' : recibos.length > 1 ? 'Varias facturas' : `${primeraFactura.numeroSerie}-${primeraFactura.numeroFactura}`;
          return {
            id: String(o.id),
            fecha: new Date(o.fechaPago),
            monto: Number(o.totalPago) || 0,
            metodo: 'Orden de pago',
            facturaId: primeraFactura ? String(primeraFactura.id) : '',
            facturaNumero,
            observaciones: o.notas || '',
          };
        });

        const pagosMap = new Map<string, Pago>();
        mappedPagos.forEach(p => {
          const uniqueKey = `${p.id}-${p.fecha.getTime()}-${p.monto}`;
          if (!pagosMap.has(uniqueKey)) pagosMap.set(uniqueKey, p);
        });

        setPagos(Array.from(pagosMap.values()));
        setOrdenesPago(ordenesUnicas as any[] || []);
      }
    } catch (error) {
      console.error('Error loading proveedor data:', error);
      setProveedor(null);
      setFacturas([]);
      setPagos([]);
      toast.error('Error al cargar datos del proveedor');
    } finally {
      setLoading(false);
    }
  };

  const loadOrdenesCompra = async (id: string) => {
    setLoadingOC(true);
    try {
      const response = await fetch(`/api/compras/ordenes-compra?proveedorId=${id}`);
      if (response.ok) {
        const data = await response.json();
        setOrdenesCompra((data || []).map((oc: any) => ({
          id: String(oc.id),
          numero: oc.numero || `OC-${oc.id}`,
          fecha: oc.fecha || oc.created_at,
          estado: oc.estado || 'pendiente',
          total: oc.total || 0,
          itemsCount: oc.items?.length || 0,
        })));
      }
    } catch (error) {
      console.error('Error loading OC:', error);
    } finally {
      setLoadingOC(false);
    }
  };

  // Cargar recepciones (remitos) del proveedor
  const loadRecepciones = async (id: string) => {
    try {
      const response = await fetch(`/api/compras/recepciones?proveedorId=${id}`);
      if (response.ok) {
        const data = await response.json();
        setRecepciones((data.data || []).map((rec: any) => ({
          id: rec.id,
          numero: rec.numero || `REC-${rec.id}`,
          fechaRecepcion: rec.fechaRecepcion,
          numeroRemito: rec.numeroRemito,
          estado: rec.estado || 'borrador',
          itemsCount: rec._count?.items || 0,
          adjuntos: rec.adjuntos,
          firma: rec.firma,
          facturaId: rec.factura?.id,
          facturaNumero: rec.factura ? `${rec.factura.numeroSerie}-${rec.factura.numeroFactura}` : undefined,
          purchaseOrderId: rec.purchaseOrder?.id,
        })));
      }
    } catch (error) {
      console.error('Error loading recepciones:', error);
    }
  };

  // Cargar notas de crédito del proveedor
  const loadNotasCredito = async (id: string) => {
    try {
      const response = await fetch(`/api/compras/notas-credito-debito?proveedorId=${id}&limit=100`);
      if (response.ok) {
        const result = await response.json();
        const data = result.data || result || [];
        setNotasCredito(data.map((nc: any) => ({
          id: nc.id,
          // Mostrar numeroSerie (número del usuario) si existe, sino el auto-generado
          numero: nc.numeroSerie || nc.numero || `${nc.tipo === 'NOTA_CREDITO' ? 'NCA' : 'NDA'}-${nc.id}`,
          numeroInterno: nc.numero, // Guardar el número interno para referencia
          fecha: nc.fechaEmision || nc.createdAt,
          tipo: nc.tipo === 'NOTA_CREDITO' ? 'NCA' : 'NDA',
          tipoNca: nc.tipoNca, // Guardar tipo de NCA (NCA_DEVOLUCION, etc)
          docType: nc.docType as 'T1' | 'T2' | undefined,
          monto: Number(nc.total || nc.monto || 0),
          aplicada: nc.aplicada || false,
          estado: nc.estado,
          facturaId: nc.facturaId,
          facturaRelacionada: nc.factura
            ? (nc.docType === 'T2'
              // Para T2: mostrar PPT-serie-numero si serie es válida, sino solo PPT-numero
              ? (nc.factura.numeroSerie && nc.factura.numeroSerie !== '00000' && nc.factura.numeroSerie !== 'X'
                ? `PPT-${nc.factura.numeroSerie}-${nc.factura.numeroFactura}`
                : `PPT-${nc.factura.numeroFactura.replace(/^T2-/, '').replace(/^NC-T2-/, '')}`)
              : `${nc.factura.tipo || 'FC'}-${nc.factura.numeroSerie}-${nc.factura.numeroFactura}`)
            : undefined,
          purchaseReturnId: nc.purchaseReturnId,
          purchaseReturn: nc.purchaseReturn,
        })));
      }
    } catch (error) {
      console.error('Error loading notas de crédito:', error);
    }
  };

  // Recargar facturas con filtro de item (búsqueda server-side)
  const reloadFacturasWithItemSearch = useCallback(async (searchTerm: string) => {
    if (!proveedorId) return;
    try {
      const timestamp = Date.now();
      const url = searchTerm.trim()
        ? `/api/compras/comprobantes?proveedorId=${proveedorId}&itemSearch=${encodeURIComponent(searchTerm.trim())}&_t=${timestamp}`
        : `/api/compras/comprobantes?proveedorId=${proveedorId}&_t=${timestamp}`;

      const response = await fetch(url, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
      if (response.ok) {
        const comprobantes = await response.json();
        const mappedFacturas: FacturaCompra[] = (comprobantes || []).map((c: any) => {
          const tipoLetra = (c.tipo && typeof c.tipo === 'string' ? (c.tipo.match(/([ABC])$/)?.[1] as 'A' | 'B' | 'C' | undefined) : 'A') || 'A';
          const docType = c.docType as 'T1' | 'T2' | undefined;
          const prefijo = docType === 'T2' ? 'PPT-' : getPrefijoComprobante(c.tipo);
          return {
            id: String(c.id),
            numero: `${prefijo}${c.numeroSerie}-${c.numeroFactura}`,
            fecha: new Date(c.fechaEmision),
            tipo: tipoLetra,
            docType: docType,
            total: Number(c.total) || 0,
            saldo: c.estado === 'pagada' ? 0 : Number(c.total) || 0,
            estado: c.estado as 'pendiente' | 'pagada' | 'parcial' | 'vencida',
            vencimiento: c.fechaVencimiento ? new Date(c.fechaVencimiento) : undefined,
            ingresoConfirmado: c.ingresoConfirmado || false,
          };
        });
        setFacturas(mappedFacturas);
      }
    } catch (error) {
      console.error('Error reloading facturas with item search:', error);
    }
  }, [proveedorId]);

  // Debounce ref para búsqueda de items
  const itemSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ============ EFFECTS ============

  // Efecto para búsqueda de items con debounce
  useEffect(() => {
    if (itemSearchTimeoutRef.current) {
      clearTimeout(itemSearchTimeoutRef.current);
    }

    // Debounce de 500ms
    itemSearchTimeoutRef.current = setTimeout(() => {
      if (proveedorId && !viewModeLoading) {
        reloadFacturasWithItemSearch(ccItemSearch);
      }
    }, 500);

    return () => {
      if (itemSearchTimeoutRef.current) {
        clearTimeout(itemSearchTimeoutRef.current);
      }
    };
  }, [ccItemSearch, proveedorId, viewModeLoading, reloadFacturasWithItemSearch]);

  useEffect(() => {
    // No cargar hasta que ViewMode termine de cargar para evitar race condition
    if (viewModeLoading) {
      console.log('[ProveedorCuentaCorriente] ⏳ Esperando ViewMode...');
      return;
    }
    if (proveedorId) {
      console.log('[ProveedorCuentaCorriente] 🔄 Cargando datos, ViewMode:', mode);
      loadProveedorData(proveedorId);
    }
  }, [proveedorId, mode, viewModeLoading]);

  useEffect(() => {
    if (isOCModalOpen && proveedor?.id) {
      loadOrdenesCompra(proveedor.id);
    }
  }, [isOCModalOpen, proveedor?.id]);

  // Cargar recepciones cuando cambia el proveedor o el viewMode
  useEffect(() => {
    if (proveedorId && !viewModeLoading) {
      loadRecepciones(proveedorId);
    }
  }, [proveedorId, viewModeLoading, mode]);

  // Cargar notas de crédito cuando cambia el proveedor o el viewMode
  useEffect(() => {
    if (proveedorId && !viewModeLoading) {
      loadNotasCredito(proveedorId);
    }
  }, [proveedorId, viewModeLoading, mode]);

  // ============ FUNCIONES DE ACCIONES ============
  const abrirEditarFactura = (factura: FacturaCompra) => {
    setFacturaEditandoId(factura.id);
    setFacturaEditandoDocType(factura.docType as 'T1' | 'T2' || null);
    setIsFacturaEditModalOpen(true);
  };

  const abrirCargarRemito = async (factura: FacturaCompra) => {
    try {
      const docTypeParam = factura.docType ? `?docType=${factura.docType}` : '';
      const response = await fetch(`/api/compras/comprobantes/${factura.id}${docTypeParam}`);
      if (!response.ok) throw new Error('Error al cargar datos');
      const data = await response.json();
      const comp = data.data || data;
      setFacturaIngresoStock({
        id: Number(comp.id),
        numeroSerie: comp.numeroSerie || '',
        numeroFactura: comp.numeroFactura || '',
        proveedorId: Number(comp.proveedorId || proveedorId),
        proveedor: {
          id: Number(comp.proveedorId || proveedorId),
          name: proveedor?.nombre || proveedor?.razonSocial || '',
        },
        items: (comp.items || []).map((item: any) => ({
          id: Number(item.id),
          descripcion: item.descripcion || '',
          cantidad: Number(item.cantidad) || 0,
          unidad: item.unidad || 'UN',
          precioUnitario: Number(item.precioUnitario) || 0,
          itemId: item.itemId ? Number(item.itemId) : (item.supplierItem?.id ? Number(item.supplierItem.id) : undefined),
          codigoProveedor: item.supplierItem?.codigoProveedor || undefined,
          supplierItem: item.supplierItem || undefined,
        })),
        docType: comp.docType || factura.docType || 'T1',
        purchaseOrderId: comp.matchResults?.[0]?.purchaseOrderId || undefined,
      });
      setIsIngresoModalOpen(true);
    } catch (error) {
      toast.error('Error al cargar datos del comprobante');
    }
  };

  const abrirEliminarFactura = (factura: FacturaCompra) => {
    setFacturaAEliminar(factura);
    setIsDeleteFacturaOpen(true);
  };

  const confirmarEliminarFactura = async () => {
    if (!facturaAEliminar) return;
    setDeleteFacturaLoading(true);
    try {
      const docTypeParam = facturaAEliminar.docType ? `?docType=${facturaAEliminar.docType}` : '';
      const resp = await fetch(`/api/compras/comprobantes/${facturaAEliminar.id}${docTypeParam}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error('Error al eliminar');
      toast.success('Factura eliminada');
      loadProveedorData(proveedorId);
    } catch (error) {
      toast.error('Error al eliminar la factura');
    } finally {
      setDeleteFacturaLoading(false);
      setIsDeleteFacturaOpen(false);
      setFacturaAEliminar(null);
    }
  };

  const abrirEliminarRemito = (recepcion: { id: number; numero: string }) => {
    setRemitoAEliminar(recepcion);
    setIsDeleteRemitoOpen(true);
  };

  const confirmarEliminarRemito = async () => {
    if (!remitoAEliminar) return;
    setDeleteRemitoLoading(true);
    try {
      const resp = await fetch(`/api/compras/recepciones/${remitoAEliminar.id}`, { method: 'DELETE' });
      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.error || 'Error al eliminar');
      }
      toast.success('Remito eliminado correctamente');
      loadProveedorData(proveedorId);
    } catch (error: any) {
      toast.error(error.message || 'Error al eliminar el remito');
    } finally {
      setDeleteRemitoLoading(false);
      setIsDeleteRemitoOpen(false);
      setRemitoAEliminar(null);
    }
  };

  const abrirEliminarOrdenPago = (orden: any) => {
    setOrdenPagoAEliminar(orden);
    setIsDeleteOrdenPagoOpen(true);
  };

  // Abrir detalle de orden de pago y cargar attachments
  const abrirDetalleOrdenPago = async (orden: any) => {
    setPagoDetalleSeleccionado(orden);
    setPagoDetalleAttachments([]);
    setIsDetallePagoOpen(true);

    // Cargar attachments en background
    setLoadingAttachments(true);
    try {
      const resp = await fetch(`/api/compras/ordenes-pago/${orden.id}/attachments`);
      if (resp.ok) {
        const attachments = await resp.json();
        setPagoDetalleAttachments(attachments || []);
      }
    } catch (error) {
      console.error('Error cargando attachments:', error);
    } finally {
      setLoadingAttachments(false);
    }
  };

  const confirmarEliminarOrdenPago = async () => {
    if (!ordenPagoAEliminar) return;
    setDeleteOrdenPagoLoading(true);
    try {
      const resp = await fetch(`/api/compras/ordenes-pago/${ordenPagoAEliminar.id}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error('Error al eliminar');
      toast.success('Orden de pago eliminada');
      loadProveedorData(proveedorId);
    } catch (error) {
      toast.error('Error al eliminar la orden de pago');
    } finally {
      setDeleteOrdenPagoLoading(false);
      setIsDeleteOrdenPagoOpen(false);
      setOrdenPagoAEliminar(null);
    }
  };

  // ============ FUNCIONES PARA CARGA DESDE PDF ============
  const handlePdfUpload = async (file: File) => {
    if (!file.type.includes('pdf')) {
      toast.error('Solo se permiten archivos PDF');
      return;
    }

    setPdfProcessing(true);
    try {
      // Convertir PDF a imagen
      const images = await pdfToImages(file, 1);
      if (!images.length) {
        throw new Error('No se pudo convertir el PDF');
      }

      // Preparar FormData con la imagen
      const formData = new FormData();
      formData.append('file', images[0], 'page.png');

      // Llamar a la API de procesamiento IA
      const response = await fetch('/api/compras/facturas/procesar-ia', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al procesar PDF');
      }

      const result = await response.json();
      const extraction = result.extraction;

      // Verificar CUIT mismatch si hay proveedor seleccionado
      if (proveedor && extraction.proveedor?.cuit) {
        const extractedCuit = extraction.proveedor.cuit.replace(/-/g, '');
        const selectedCuit = (proveedor.cuit || '').replace(/-/g, '');
        if (extractedCuit && selectedCuit && extractedCuit !== selectedCuit) {
          toast.warning(
            `El CUIT del PDF (${extraction.proveedor.cuit}) no coincide con el proveedor seleccionado (${proveedor.cuit})`,
            { duration: 5000 }
          );
        }
      }

      // Preparar datos para el formulario
      const prefilledFormData = {
        proveedorId: result.matchedSupplier?.id || proveedor?.id,
        tipo: mapTipoFromExtraction(extraction),
        numeroSerie: extraction.punto_venta || '',
        numeroFactura: extraction.numero_comprobante || '',
        fechaEmision: extraction.fecha_emision || '',
        fechaVencimiento: extraction.fecha_vencimiento_pago || '',
        neto: extraction.subtotal_neto_gravado || 0,
        iva21: extraction.iva_21 || 0,
        iva105: extraction.iva_10_5 || 0,
        iva27: extraction.iva_27 || 0,
        noGravado: extraction.subtotal_neto_no_gravado || 0,
        exento: extraction.subtotal_exento || 0,
        percepcionIVA: extraction.percepciones_iva || 0,
        percepcionIIBB: extraction.percepciones_iibb || 0,
        otrosConceptos: extraction.otros_impuestos || 0,
        total: extraction.total || 0,
        cae: extraction.cae || '',
        fechaVtoCae: extraction.fecha_vencimiento_cae || '',
        moneda: extraction.moneda || 'ARS',
        warnings: result.warnings || []
      };

      setPrefilledData(prefilledFormData);
      setShowPdfUploader(false);
      setIsNuevoComprobanteModalOpen(true);

      toast.success('PDF procesado correctamente. Verifica los datos antes de guardar.');
    } catch (error: any) {
      console.error('Error procesando PDF:', error);
      toast.error(error.message || 'Error al procesar el PDF');
    } finally {
      setPdfProcessing(false);
    }
  };

  // Helper para mapear tipo de comprobante desde extracción
  const mapTipoFromExtraction = (extraction: any): string => {
    const tipo = (extraction.tipo_comprobante || '').toUpperCase();
    const letra = (extraction.letra_comprobante || '').toUpperCase();

    const map: Record<string, string> = {
      'FACTURA-A': 'FACTURA_A',
      'FACTURA-B': 'FACTURA_B',
      'FACTURA-C': 'FACTURA_C',
      'NOTA DE CREDITO-A': 'NC_A',
      'NOTA DE CREDITO-B': 'NC_B',
      'NOTA DE CREDITO-C': 'NC_C',
      'NOTA DE DEBITO-A': 'ND_A',
      'NOTA DE DEBITO-B': 'ND_B',
      'NOTA DE DEBITO-C': 'ND_C'
    };

    const key = letra ? `${tipo}-${letra}` : tipo;
    return map[key] || 'FACTURA_A';
  };

  // ============ FUNCIÓN PARA SUBIR COMPROBANTES A OP EXISTENTE ============
  const handleSubirComprobantesOP = async (files: FileList) => {
    if (!pagoDetalleSeleccionado?.id || files.length === 0) return;

    setUploadingComprobantesOP(true);
    const opId = pagoDetalleSeleccionado.id;

    try {
      const uploadedFiles: Array<{ fileName: string; fileUrl: string; fileType: string; fileSize: number }> = [];

      // Subir cada archivo a S3
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        toast.loading(`Subiendo ${i + 1}/${files.length}...`, { id: 'upload-comp' });

        const formData = new FormData();
        formData.append('file', file);
        formData.append('entityType', 'payment-orders');
        formData.append('entityId', String(opId));
        formData.append('fileType', 'comprobante');

        const uploadResp = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResp.ok) {
          const errorData = await uploadResp.json().catch(() => ({}));
          console.error('Error upload:', errorData);
          throw new Error(errorData.error || `Error subiendo archivo ${file.name}`);
        }

        const uploadData = await uploadResp.json();
        uploadedFiles.push({
          fileName: file.name,
          fileUrl: uploadData.url,
          fileType: file.type,
          fileSize: file.size,
        });
      }

      toast.loading('Guardando comprobantes...', { id: 'upload-comp' });

      // Guardar los attachments en la base de datos
      const saveResp = await fetch(`/api/compras/ordenes-pago/${opId}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attachments: uploadedFiles }),
      });

      if (!saveResp.ok) {
        throw new Error('Error guardando comprobantes');
      }

      toast.success(`${uploadedFiles.length} comprobante${uploadedFiles.length > 1 ? 's' : ''} agregado${uploadedFiles.length > 1 ? 's' : ''}`, { id: 'upload-comp' });

      // Recargar los attachments
      const attResp = await fetch(`/api/compras/ordenes-pago/${opId}/attachments`);
      if (attResp.ok) {
        const attData = await attResp.json();
        setPagoDetalleAttachments(attData || []);
      }
    } catch (error: any) {
      console.error('Error subiendo comprobantes:', error);
      toast.error(error.message || 'Error al subir comprobantes', { id: 'upload-comp' });
    } finally {
      setUploadingComprobantesOP(false);
      // Limpiar el input
      if (comprobantesInputRef.current) {
        comprobantesInputRef.current.value = '';
      }
    }
  };

  // Función para eliminar un comprobante de una OP
  const handleEliminarComprobanteOP = async (attachmentId: number) => {
    if (!pagoDetalleSeleccionado?.id) return;
    if (!confirm('¿Eliminar este comprobante?')) return;

    const opId = pagoDetalleSeleccionado.id;

    try {
      toast.loading('Eliminando...', { id: 'delete-comp' });

      const resp = await fetch(`/api/compras/ordenes-pago/${opId}/attachments?attachmentId=${attachmentId}`, {
        method: 'DELETE',
      });

      if (!resp.ok) {
        throw new Error('Error al eliminar');
      }

      toast.success('Comprobante eliminado', { id: 'delete-comp' });

      // Actualizar lista local
      setPagoDetalleAttachments(prev => prev.filter(att => att.id !== attachmentId));
    } catch (error) {
      console.error('Error eliminando comprobante:', error);
      toast.error('Error al eliminar comprobante', { id: 'delete-comp' });
    }
  };

  // ============ FUNCIONES PARA NCA Y DEVOLUCION ============
  const handleCrearNcaDesdeFactura = async (factura: FacturaCompra) => {
    try {
      // Cargar detalle completo del comprobante
      const docTypeParam = factura.docType ? `?docType=${factura.docType}` : '';
      const response = await fetch(`/api/compras/comprobantes/${factura.id}${docTypeParam}`);
      if (!response.ok) throw new Error('Error al cargar factura');
      const data = await response.json();

      setNcaFacturaData({
        facturaId: Number(factura.id),
        facturaNumero: factura.numero,
        proveedorId: Number(proveedorId),
        proveedorNombre: proveedor?.nombre || '',
        items: (data.items || []).map((item: any) => ({
          id: item.id,
          itemId: item.itemId,
          descripcion: item.descripcion,
          cantidad: Number(item.cantidad),
          unidad: item.unidad || 'UN',
          precioUnitario: Number(item.precioUnitario) || 0,
          subtotal: Number(item.subtotal) || 0,
        })),
        totalFactura: factura.total,
        ingresoConfirmado: factura.ingresoConfirmado || false,
        // T1 = FCA (Nota de Crédito A), T2 = PPT (Nota de Crédito simple)
        facturaDocType: factura.docType || 'T1',
      });
      setNcaModalOpen(true);
    } catch (error) {
      console.error('Error cargando factura:', error);
      toast.error('Error al cargar datos de la factura');
    }
  };

  const handleCrearDevolucionDesdeFactura = async (factura: FacturaCompra) => {
    try {
      // Cargar detalle completo del comprobante
      const docTypeParam = factura.docType ? `?docType=${factura.docType}` : '';
      const response = await fetch(`/api/compras/comprobantes/${factura.id}${docTypeParam}`);
      if (!response.ok) throw new Error('Error al cargar factura');
      const data = await response.json();

      setDevolucionFacturaData({
        facturaId: Number(factura.id),
        facturaNumero: factura.numero,
        proveedorId: Number(proveedorId),
        proveedorNombre: proveedor?.nombre || '',
        docType: (factura.docType as 'T1' | 'T2') || (data.docType as 'T1' | 'T2') || 'T1',
        items: (data.items || []).map((item: any) => ({
          id: item.id,
          supplierItemId: item.supplierItem?.id || item.itemId,
          descripcion: item.descripcion || item.supplierItem?.nombre || '-',
          cantidad: Number(item.cantidad),
          unidad: item.unidad || 'UN',
          precioUnitario: Number(item.precioUnitario) || 0,
        })),
      });
      setDevolucionModalOpen(true);
    } catch (error) {
      console.error('Error cargando factura:', error);
      toast.error('Error al cargar datos de la factura');
    }
  };

  const abrirEliminarNca = (nca: {
    id: number;
    numero: string;
    purchaseReturn?: { id: number; numero: string; estado: string };
    aplicada?: boolean;
  }) => {
    setNcaAEliminar(nca);
    setIsDeleteNcaOpen(true);
  };

  const confirmarEliminarNca = async () => {
    if (!ncaAEliminar) return;
    setDeleteNcaLoading(true);

    try {
      toast.loading('Eliminando NCA...', { id: 'delete-nca' });
      const response = await fetch(`/api/compras/notas-credito-debito/${ncaAEliminar.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al eliminar');
      }

      // Mostrar mensaje apropiado según si se eliminó también la devolución
      if (data.devolucionEliminada) {
        toast.success(`NCA y devolución ${data.devolucionEliminada.numero} eliminadas correctamente`, { id: 'delete-nca' });
      } else {
        toast.success('NCA eliminada correctamente', { id: 'delete-nca' });
      }

      // Recargar datos
      if (proveedorId) {
        loadNotasCredito(proveedorId);
        loadProveedorData(proveedorId);
      }
    } catch (error: any) {
      toast.error(error.message || 'Error al eliminar NCA', { id: 'delete-nca' });
    } finally {
      setDeleteNcaLoading(false);
      setIsDeleteNcaOpen(false);
      setNcaAEliminar(null);
    }
  };

  // ============ FUNCIONES DE PDF ============
  const generarEstadoCuentaPDF = () => {
    if (!proveedor) return;
    const data: AccountStatementPDFData = {
      proveedor: {
        nombre: proveedor.nombre,
        razonSocial: proveedor.razonSocial,
        cuit: proveedor.cuit,
        direccion: proveedor.direccion,
        telefono: proveedor.telefono,
        email: proveedor.email,
      },
      fechaDesde: ccFechaDesde || undefined,
      fechaHasta: ccFechaHasta || undefined,
      facturas: facturasFiltradas.map(f => ({
        numero: f.numero,
        fecha: f.fecha,
        tipo: `Tipo ${f.tipo}`,
        total: f.total,
        saldo: f.saldo,
        vencimiento: f.vencimiento,
        estado: f.estado,
      })),
      pagos: pagosFiltrados.map(p => ({
        fecha: p.fecha,
        monto: p.monto,
        metodo: p.metodo || '',
        facturaNumero: p.facturaNumero,
        observaciones: p.observaciones,
      })),
      resumen: {
        totalFacturado,
        totalPagado,
        saldoTotal,
        facturasVencidas: estadisticasCuenta.facturasVencidas,
        montoVencido: estadisticasCuenta.montoVencido,
      },
    };
    const pdfUrl = generateAccountStatementPDF(data);
    window.open(pdfUrl, '_blank');
    toast.success('PDF generado correctamente');
  };

  const imprimirEstadoCuenta = () => {
    if (!proveedor) return;
    const data: AccountStatementPDFData = {
      proveedor: {
        nombre: proveedor.nombre,
        razonSocial: proveedor.razonSocial,
        cuit: proveedor.cuit,
        direccion: proveedor.direccion,
        telefono: proveedor.telefono,
        email: proveedor.email,
      },
      fechaDesde: ccFechaDesde || undefined,
      fechaHasta: ccFechaHasta || undefined,
      facturas: facturasFiltradas.map(f => ({
        numero: f.numero,
        fecha: f.fecha,
        tipo: `Tipo ${f.tipo}`,
        total: f.total,
        saldo: f.saldo,
        vencimiento: f.vencimiento,
        estado: f.estado,
      })),
      pagos: pagosFiltrados.map(p => ({
        fecha: p.fecha,
        monto: p.monto,
        metodo: p.metodo || '',
        facturaNumero: p.facturaNumero,
        observaciones: p.observaciones,
      })),
      resumen: {
        totalFacturado,
        totalPagado,
        saldoTotal,
        facturasVencidas: estadisticasCuenta.facturasVencidas,
        montoVencido: estadisticasCuenta.montoVencido,
      },
    };
    printAccountStatement(data);
  };

  // ============ FUNCIONES DE PAGO ============
  const toggleFacturaSeleccionada = (facturaId: string) => {
    setSelectedFacturas(prev => prev.includes(facturaId) ? prev.filter(id => id !== facturaId) : [...prev, facturaId]);
  };

  const handleFacturaRowClick = (index: number, facturaId: string, event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest('button,input')) return;
    setSelectedFacturas(prev => {
      let next = [...prev];
      if (event.shiftKey && lastFacturaIndexClicked !== null) {
        const start = Math.min(lastFacturaIndexClicked, index);
        const end = Math.max(lastFacturaIndexClicked, index);
        const idsRango = facturas.filter(f => f.saldo > 0).slice(start, end + 1).map(f => f.id);
        const yaTodosSeleccionados = idsRango.every(id => next.includes(id));
        if (yaTodosSeleccionados) {
          next = next.filter(id => !idsRango.includes(id));
        } else {
          idsRango.forEach(id => { if (!next.includes(id)) next.push(id); });
        }
      } else {
        if (next.includes(facturaId)) {
          next = next.filter(id => id !== facturaId);
        } else {
          next.push(facturaId);
        }
      }
      return next;
    });
    setLastFacturaIndexClicked(index);
  };

  const parseMonto = (value: string) => {
    if (!value) return 0;
    const soloDigitos = value.replace(/\D/g, '');
    return soloDigitos ? parseFloat(soloDigitos) : 0;
  };

  const totalPagoCalc = parseMonto(pagoForm.efectivo) + parseMonto(pagoForm.dolares) + parseMonto(pagoForm.transferencia) +
    parseMonto(pagoForm.chequesTerceros) + parseMonto(pagoForm.chequesPropios) + parseMonto(pagoForm.retIVA) +
    parseMonto(pagoForm.retGanancias) + parseMonto(pagoForm.retIngBrutos);

  const totalSeleccionado = facturas.filter(f => selectedFacturas.includes(f.id)).reduce((sum, f) => sum + f.saldo, 0);

  const totalAnticiposSeleccionados = anticiposDisponibles.filter(a => anticiposSeleccionados.includes(a.id)).reduce((sum, a) => sum + a.monto, 0);

  const saldoSeleccionadoConAnticipos = Math.max(totalSeleccionado - totalAnticiposSeleccionados, 0);

  const diferencia = totalPagoCalc - saldoSeleccionadoConAnticipos;

  const anticipo = diferencia > 0 ? diferencia : 0;

  const formatMontoVisual = (value: string) => {
    if (!value) return '';
    const soloDigitos = value.replace(/\D/g, '');
    return soloDigitos ? soloDigitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
  };

  const handlePagoChange = (field: keyof typeof pagoForm, raw: string) => {
    const soloDigitos = raw.replace(/\D/g, '');
    setPagoForm(prev => ({ ...prev, [field]: soloDigitos }));
  };

  const aplicarFormatoSolo = (field: keyof typeof pagoForm) => {
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

  const aplicarFormatoYPasar = (field: keyof typeof pagoForm, inputId: string) => {
    setPagoForm(prev => ({ ...prev, [field]: formatMontoVisual(prev[field] || '') }));
    focusNextPagoField(inputId);
  };

  const toggleAnticipoSeleccionado = (id: string) => {
    setAnticiposSeleccionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleChequeSeleccionado = (id: string) => {
    setSelectedCheques(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const totalChequesSeleccionados = chequesCartera.filter(ch => selectedCheques.includes(ch.id)).reduce((sum, ch) => sum + ch.importe, 0);

  const selectedChequesDetalle = chequesCartera.filter(ch => selectedCheques.includes(ch.id)).sort((a, b) => (a.fechaVencimiento < b.fechaVencimiento ? 1 : -1));

  const chequeCumpleFiltros = (ch: ChequeTercero): boolean => {
    if (chequesFilters.texto) {
      const t = chequesFilters.texto.toLowerCase();
      if (!ch.numero.toLowerCase().includes(t) && !ch.banco.toLowerCase().includes(t) && !ch.titular.toLowerCase().includes(t)) return false;
    }
    if (chequesFilters.montoDesde) {
      const min = parseFloat(chequesFilters.montoDesde.replace(/\D/g, '')) || 0;
      if (ch.importe < min) return false;
    }
    if (chequesFilters.montoHasta) {
      const max = parseFloat(chequesFilters.montoHasta.replace(/\D/g, '')) || 0;
      if (ch.importe > max) return false;
    }
    if (chequesFilters.fechaDesdeIso && ch.fechaVencimiento < chequesFilters.fechaDesdeIso) return false;
    if (chequesFilters.fechaHastaIso && ch.fechaVencimiento > chequesFilters.fechaHastaIso) return false;
    return true;
  };

  const totalChequesQueCumplenFiltro = chequesCartera.filter(chequeCumpleFiltros).length;

  const handleRegistrarPago = async () => {
    if (selectedFacturas.length === 0) {
      toast.error('Seleccioná al menos una factura');
      return;
    }
    if (totalPagoCalc === 0 && totalAnticiposSeleccionados === 0) {
      toast.error('Ingresá un monto de pago o seleccioná anticipos');
      return;
    }
    setIsSubmittingPago(true);
    try {
      const payload = {
        proveedorId: Number(proveedorId),
        fechaPago: new Date().toISOString(),
        efectivo: parseMonto(pagoForm.efectivo),
        dolares: parseMonto(pagoForm.dolares),
        transferencia: parseMonto(pagoForm.transferencia),
        chequesTerceros: parseMonto(pagoForm.chequesTerceros),
        chequesPropios: parseMonto(pagoForm.chequesPropios),
        retIVA: parseMonto(pagoForm.retIVA),
        retGanancias: parseMonto(pagoForm.retGanancias),
        retIngBrutos: parseMonto(pagoForm.retIngBrutos),
        anticipo,
        notas: pagoForm.notas,
        facturas: selectedFacturas.map(id => {
          const f = facturas.find(x => x.id === id);
          return { facturaId: Number(id), montoAplicado: f?.saldo || 0 };
        }),
        anticiposAplicados: anticiposSeleccionados.map(id => Number(id)),
        cheques: selectedCheques.map(id => {
          const ch = chequesCartera.find(x => x.id === id);
          return ch ? { id: ch.id, numero: ch.numero, banco: ch.banco, tipo: ch.tipo, importe: ch.importe } : null;
        }).filter(Boolean),
      };

      const resp = await fetch('/api/compras/ordenes-pago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const error = await resp.json();
        throw new Error(error.error || 'Error al registrar pago');
      }

      toast.success('Pago registrado correctamente');
      setIsPagoModalOpen(false);
      setSelectedFacturas([]);
      setAnticiposSeleccionados([]);
      setSelectedCheques([]);
      setPagoForm({ efectivo: '', dolares: '', transferencia: '', chequesTerceros: '', chequesPropios: '', retIVA: '', retGanancias: '', retIngBrutos: '', notas: '' });
      loadProveedorData(proveedorId);
    } catch (error: any) {
      toast.error(error.message || 'Error al registrar pago');
    } finally {
      setIsSubmittingPago(false);
    }
  };

  // ============ RENDER ============
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (!proveedor) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Proveedor no encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header opcional */}
      {showHeader && (
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-3">
              <Building2 className="w-6 h-6 text-emerald-600" />
              {proveedor.razonSocial || proveedor.nombre}
            </h1>
            <p className="text-xs text-muted-foreground">CUIT: {proveedor.cuit}</p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Saldo Total</p>
                <p className={`text-xl font-bold ${saldoTotal === 0 ? 'text-muted-foreground' : 'text-red-600'}`}>
                  {formatCurrency(saldoTotal)}
                </p>
              </div>
              <div className={`p-2 rounded-lg ${saldoTotal === 0 ? 'bg-muted' : 'bg-red-100 dark:bg-red-900/30'}`}>
                <CircleDollarSign className={`w-4 h-4 ${saldoTotal === 0 ? 'text-muted-foreground' : 'text-red-600'}`} />
              </div>
            </div>
            {estadisticasCuenta.montoVencido > 0 && (
              <div className="mt-2 pt-2 border-t">
                <p className="text-[10px] text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {formatCurrency(estadisticasCuenta.montoVencido)} vencido
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Total Facturado</p>
                <p className="text-xl font-bold">{formatCurrency(totalFacturado)}</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Receipt className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <div className="mt-2 pt-2 border-t">
              <p className="text-[10px] text-muted-foreground">
                {facturas.length} factura{facturas.length !== 1 ? 's' : ''} registrada{facturas.length !== 1 ? 's' : ''}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Total Pagado</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(totalPagado)}</p>
              </div>
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <Banknote className="w-4 h-4 text-green-600" />
              </div>
            </div>
            <div className="mt-2 pt-2 border-t">
              <p className="text-[10px] text-muted-foreground">
                {pagosUnicosRender.length} pago{pagosUnicosRender.length !== 1 ? 's' : ''} registrado{pagosUnicosRender.length !== 1 ? 's' : ''}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Facturas Pendientes</p>
                <p className="text-xl font-bold">{facturas.filter(f => f.saldo > 0).length}</p>
              </div>
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <FileWarning className="w-4 h-4 text-amber-600" />
              </div>
            </div>
            {estadisticasCuenta.facturasProximasVencer > 0 && (
              <div className="mt-2 pt-2 border-t">
                <p className="text-[10px] text-amber-600 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {estadisticasCuenta.facturasProximasVencer} próxima{estadisticasCuenta.facturasProximasVencer !== 1 ? 's' : ''} a vencer
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Toolbar de filtros y acciones */}
      <div className="flex flex-col gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 min-w-[150px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar factura..."
              value={ccSearchTerm}
              onChange={(e) => { setCcSearchTerm(e.target.value); setCcPageFacturas(1); setCcPagePagos(1); }}
              className="pl-9 h-9 bg-background"
            />
            {ccSearchTerm && (
              <Button variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0" onClick={() => setCcSearchTerm('')}>
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          <div className="relative flex-1 min-w-[150px]">
            <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por item..."
              value={ccItemSearch}
              onChange={(e) => { setCcItemSearch(e.target.value); setCcPageFacturas(1); }}
              className="pl-9 h-9 bg-background"
            />
            {ccItemSearch && (
              <Button variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0" onClick={() => setCcItemSearch('')}>
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" className="h-9 gap-2" onClick={() => setIsNuevoComprobanteModalOpen(true)}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Cargar Comprobante</span>
              <span className="sm:hidden">Comprobante</span>
            </Button>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 gap-2"
                    onClick={() => setShowPdfUploader(true)}
                  >
                    <FileText className="h-4 w-4" />
                    <span className="hidden lg:inline">Desde PDF</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Cargar comprobante desde PDF con IA</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button size="sm" variant="outline" className="h-9 gap-2" onClick={() => setIsPagoModalOpen(true)}>
              <Banknote className="h-4 w-4" />
              <span className="hidden sm:inline">Sacar Pago</span>
              <span className="sm:hidden">Pago</span>
            </Button>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => setIsOCModalOpen(true)}>
                    <ClipboardList className="h-4 w-4" />
                    <span className="hidden md:inline">Ver OC</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Ver Órdenes de Compra</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button variant="ghost" size="sm" className="h-9 gap-2" onClick={() => setCcFiltrosVisibles(!ccFiltrosVisibles)}>
              <SlidersHorizontal className="h-4 w-4" />
              <ChevronUp className={`h-3 w-3 transition-transform ${ccFiltrosVisibles ? '' : 'rotate-180'}`} />
            </Button>
          </div>
        </div>

        {ccFiltrosVisibles && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-background rounded-md border p-0.5">
              {[
                { value: 'todos', label: 'Todo' },
                { value: 'hoy', label: 'Hoy' },
                { value: 'semana', label: 'Semana' },
                { value: 'mes', label: 'Mes' },
                { value: 'trimestre', label: '3 meses' },
              ].map((periodo) => (
                <Button
                  key={periodo.value}
                  variant={ccPeriodo === periodo.value ? 'default' : 'ghost'}
                  size="sm"
                  className={`h-7 px-2.5 text-xs ${ccPeriodo === periodo.value ? '' : 'hover:bg-muted'}`}
                  onClick={() => aplicarFiltroPeriodo(periodo.value as typeof ccPeriodo)}
                >
                  {periodo.label}
                </Button>
              ))}
            </div>

            <div className="h-6 w-px bg-border hidden sm:block" />

            <Select value={ccEstadoFilter} onValueChange={(v) => { setCcEstadoFilter(v); setCcPageFacturas(1); }}>
              <SelectTrigger className="w-[130px] h-8 text-xs bg-background">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                <SelectItem value="pendiente">Pendientes</SelectItem>
                <SelectItem value="pagada">Pagadas</SelectItem>
                <SelectItem value="parcial">Parciales</SelectItem>
                <SelectItem value="vencida">Vencidas</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 px-2 py-1 bg-background rounded-md border">
              <Switch
                id="solo-pendientes"
                checked={ccSoloPendientes}
                onCheckedChange={(checked) => { setCcSoloPendientes(checked); setCcPageFacturas(1); }}
                className="scale-75"
              />
              <Label htmlFor="solo-pendientes" className="text-xs cursor-pointer whitespace-nowrap">
                Solo con saldo
              </Label>
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-2 text-xs">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Fechas</span>
                  {(ccFechaDesde || ccFechaHasta) && ccPeriodo === 'todos' && (
                    <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">
                      {ccFechaDesde && ccFechaHasta ? '2' : '1'}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4" align="end">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Desde</Label>
                    <DatePicker value={ccFechaDesde} onChange={(date) => { setCcFechaDesde(date); setCcPeriodo('todos'); setCcPageFacturas(1); }} placeholder="Desde" clearable className="h-8" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Hasta</Label>
                    <DatePicker value={ccFechaHasta} onChange={(date) => { setCcFechaHasta(date); setCcPeriodo('todos'); setCcPageFacturas(1); }} placeholder="Hasta" clearable className="h-8" />
                  </div>
                  {(ccFechaDesde || ccFechaHasta) && (
                    <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={() => { setCcFechaDesde(''); setCcFechaHasta(''); setCcPeriodo('todos'); }}>
                      Limpiar fechas
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {hayFiltrosActivos && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={limpiarFiltros}>
                <X className="h-3 w-3 mr-1" />
                Limpiar
              </Button>
            )}

            <div className="flex-1" />

            <TooltipProvider>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Download className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Exportar a Excel</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={generarEstadoCuentaPDF}>
                      <FileDown className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Generar PDF Estado de Cuenta</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={imprimirEstadoCuenta}>
                      <Printer className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Imprimir estado de cuenta</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>
        )}
      </div>

      {/* Tabla Unificada de Cuenta Corriente */}
      <Card className="flex flex-col">
        <CardHeader className="pb-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Cuenta Corriente</CardTitle>
              <Badge variant="secondary" className="text-xs">{documentosCCFiltrados.length}</Badge>
            </div>
            {/* Selector de Vista: Todo / Pendiente / Relaciones */}
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
              <Button
                variant={ccVistaActual === 'todo' ? 'default' : 'ghost'}
                size="sm"
                className={`h-7 px-3 text-xs ${ccVistaActual === 'todo' ? '' : 'hover:bg-muted'}`}
                onClick={() => { setCcVistaActual('todo'); setCcPageFacturas(1); }}
              >
                Todo
              </Button>
              <Button
                variant={ccVistaActual === 'pendiente' ? 'default' : 'ghost'}
                size="sm"
                className={`h-7 px-3 text-xs ${ccVistaActual === 'pendiente' ? '' : 'hover:bg-muted'}`}
                onClick={() => { setCcVistaActual('pendiente'); setCcPageFacturas(1); }}
              >
                Pendiente
              </Button>
              <Button
                variant={ccVistaActual === 'relaciones' ? 'default' : 'ghost'}
                size="sm"
                className={`h-7 px-3 text-xs ${ccVistaActual === 'relaciones' ? '' : 'hover:bg-muted'}`}
                onClick={() => { setCcVistaActual('relaciones'); setCcPageFacturas(1); }}
              >
                Relaciones
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1">
          {documentosCCUnificados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="p-3 rounded-full bg-muted mb-3">
                <FileText className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No hay movimientos registrados</p>
              <p className="text-xs text-muted-foreground mt-1">Los movimientos aparecerán aquí cuando se registren</p>
            </div>
          ) : documentosCCFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="p-3 rounded-full bg-muted mb-3">
                <Search className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No se encontraron resultados</p>
              <p className="text-xs text-muted-foreground mt-1">
                {ccVistaActual === 'pendiente' ? 'No hay documentos pendientes de pago' : 'Intenta con otros filtros'}
              </p>
              {ccVistaActual === 'pendiente' && documentosCCUnificados.length > 0 && (
                <Button variant="ghost" size="sm" className="mt-3" onClick={() => setCcVistaActual('todo')}>
                  Ver todos los movimientos
                </Button>
              )}
              {hayFiltrosActivos && (
                <Button variant="ghost" size="sm" className="mt-3" onClick={limpiarFiltros}>Limpiar filtros</Button>
              )}
            </div>
          ) : ccVistaActual === 'relaciones' ? (
            /* Vista de Relaciones - Agrupa documentos por factura */
            <div className="p-4 space-y-4 max-h-[calc(100vh-350px)] min-h-[400px] overflow-y-auto">
              {documentosAgrupadosPorFactura.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="p-3 rounded-full bg-muted mb-3">
                    <FileText className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">No hay relaciones para mostrar</p>
                  <p className="text-xs text-muted-foreground mt-1">Las facturas con documentos vinculados aparecerán aquí</p>
                </div>
              ) : (
                documentosAgrupadosPorFactura.map((grupo) => {
                  const facturaIdNum = Number(grupo.factura.id.replace(/^(fca|ppt)-/, ''));
                  return (
                    <Card key={grupo.factura.id} className="overflow-hidden border-l-4 border-l-blue-500">
                      {/* Header de la factura */}
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50/50 dark:from-blue-950/30 dark:to-indigo-950/20 px-4 py-3 border-b">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge className="bg-blue-100 text-blue-700 border-0">
                              {grupo.factura.tipo}
                            </Badge>
                            <div>
                              <p className="font-semibold">{grupo.factura.numero}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(grupo.factura.fecha)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{formatCurrency(grupo.factura.debe)}</p>
                            <p className={`text-xs ${grupo.saldoPendiente > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              Saldo: {formatCurrency(grupo.saldoPendiente)}
                            </p>
                          </div>
                        </div>
                      </div>
                      {/* Documentos relacionados */}
                      <CardContent className="p-0">
                        {grupo.relacionados.length > 0 ? (
                          <div className="divide-y">
                            {grupo.relacionados.map((doc) => {
                              // Colores por tipo
                              const badgeStyles: Record<string, string> = {
                                'OP': 'text-purple-600 border-purple-300',
                                'NCA': 'text-green-600 border-green-300',
                                'NC': 'text-emerald-600 border-emerald-300',
                                'REMITO': 'text-amber-600 border-amber-300',
                              };
                              const montoStyles: Record<string, string> = {
                                'OP': 'text-purple-600',
                                'NCA': 'text-green-600',
                                'NC': 'text-emerald-600',
                                'REMITO': 'text-amber-600',
                              };
                              return (
                                <div
                                  key={doc.id}
                                  className={`flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors ${doc.tipo === 'OP' ? 'cursor-pointer' : ''}`}
                                  onClick={() => {
                                    if (doc.tipo === 'OP') {
                                      const opId = doc.id.replace('op-', '');
                                      const orden = ordenesPago.find((o) => String(o.id) === opId);
                                      if (orden) abrirDetalleOrdenPago(orden);
                                    }
                                  }}
                                >
                                  <div className="flex items-center gap-3 pl-4 border-l-2 border-muted">
                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] ${badgeStyles[doc.tipo] || 'text-gray-600 border-gray-300'}`}
                                    >
                                      {doc.tipo}
                                    </Badge>
                                    <div>
                                      <p className="text-sm font-medium">{doc.numero}</p>
                                      <p className="text-xs text-muted-foreground">{formatDate(doc.fecha)}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {doc.tipo === 'REMITO' ? (
                                      <p className={`text-xs ${montoStyles[doc.tipo]}`}>
                                        {doc.descripcion}
                                      </p>
                                    ) : (
                                      <p className={`font-medium ${montoStyles[doc.tipo] || 'text-gray-600'}`}>
                                        -{formatCurrency(doc.haber)}
                                      </p>
                                    )}
                                    <Badge variant="outline" className="text-[10px]">
                                      {doc.estado}
                                    </Badge>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="px-4 py-3 text-center">
                            <p className="text-xs text-muted-foreground">Sin documentos vinculados</p>
                          </div>
                        )}
                        {/* Resumen */}
                        <div className="px-4 py-2.5 bg-muted/30 border-t flex items-center justify-between text-xs">
                          <div className="flex items-center gap-4">
                            {grupo.totalPagado > 0 && (
                              <span className="text-purple-600">
                                Pagado: {formatCurrency(grupo.totalPagado)}
                              </span>
                            )}
                            {grupo.totalCreditos > 0 && (
                              <span className="text-green-600">
                                Créditos: {formatCurrency(grupo.totalCreditos)}
                              </span>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              setRelacionesFacturaData({
                                facturaId: facturaIdNum,
                                facturaNumero: grupo.factura.numero,
                                facturaTotal: grupo.factura.debe,
                                proveedorId: Number(proveedorId),
                                facturaDocType: grupo.factura.docType,
                              });
                              setRelacionesModalOpen(true);
                            }}
                          >
                            Ver detalle
                            <ChevronRight className="w-3 h-3 ml-1" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto max-h-[calc(100vh-350px)] min-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
                    <TableRow className="bg-muted/50 hover:bg-muted/50 border-b">
                      <TableHead className="text-xs font-medium w-[70px]">Tipo</TableHead>
                      <TableHead className="text-xs font-medium">Número</TableHead>
                      <TableHead className="text-xs font-medium">
                        <Button variant="ghost" size="sm" className="h-auto p-0 text-xs font-medium hover:bg-transparent" onClick={() => { if (ccSortField === 'fecha') { setCcSortDirection(ccSortDirection === 'asc' ? 'desc' : 'asc'); } else { setCcSortField('fecha'); setCcSortDirection('desc'); } }}>
                          Fecha<ArrowUpDown className="ml-1 h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-xs font-medium text-right">
                        <Button variant="ghost" size="sm" className="h-auto p-0 text-xs font-medium hover:bg-transparent" onClick={() => { if (ccSortField === 'total') { setCcSortDirection(ccSortDirection === 'asc' ? 'desc' : 'asc'); } else { setCcSortField('total'); setCcSortDirection('desc'); } }}>
                          Debe<ArrowUpDown className="ml-1 h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-xs font-medium text-right">Haber</TableHead>
                      <TableHead className="text-xs font-medium text-right">
                        <Button variant="ghost" size="sm" className="h-auto p-0 text-xs font-medium hover:bg-transparent" onClick={() => { if (ccSortField === 'saldo') { setCcSortDirection(ccSortDirection === 'asc' ? 'desc' : 'asc'); } else { setCcSortField('saldo'); setCcSortDirection('desc'); } }}>
                          Saldo<ArrowUpDown className="ml-1 h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-xs font-medium">
                        <Button variant="ghost" size="sm" className="h-auto p-0 text-xs font-medium hover:bg-transparent" onClick={() => { if (ccSortField === 'vencimiento') { setCcSortDirection(ccSortDirection === 'asc' ? 'desc' : 'asc'); } else { setCcSortField('vencimiento'); setCcSortDirection('asc'); } }}>
                          Venc.<ArrowUpDown className="ml-1 h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-xs font-medium w-[80px]">Estado</TableHead>
                      <TableHead className="text-xs font-medium text-right w-[70px]">Acc.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documentosCCFiltrados.map((doc) => {
                      const estaVencida = (doc.tipo === 'FCA' || doc.tipo === 'PPT') && doc.vencimiento && doc.saldo > 0 && new Date(doc.vencimiento) < new Date();
                      // Colores por tipo de documento
                      const tipoConfig: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
                        'FCA': { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', icon: <FileText className="w-3 h-3" /> },
                        'PPT': { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-300', icon: <FileText className="w-3 h-3" /> },
                        'NCA': { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', icon: <Receipt className="w-3 h-3" /> },
                        'NC': { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', icon: <Receipt className="w-3 h-3" /> },
                        'OP': { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', icon: <CreditCard className="w-3 h-3" /> },
                        'REMITO': { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', icon: <Truck className="w-3 h-3" /> },
                        'ANT': { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-300', icon: <TrendingUp className="w-3 h-3" /> },
                      };
                      const config = tipoConfig[doc.tipo] || tipoConfig['FCA'];

                      // Obtener la factura original si es FCA o PPT para las acciones
                      const facturaOriginal = (doc.tipo === 'FCA' || doc.tipo === 'PPT') ? facturas.find(f => {
                        const prefix = f.docType === 'T2' ? 'ppt' : 'fca';
                        return `${prefix}-${f.id}` === doc.id;
                      }) : null;

                      return (
                        <TableRow
                          key={doc.id}
                          className={`hover:bg-muted/50 transition-all ${estaVencida ? 'bg-red-50/50 dark:bg-red-900/10' : ''} ${doc.tipo === 'OP' ? 'cursor-pointer' : ''}`}
                          data-factura-id={(doc.tipo === 'FCA' || doc.tipo === 'PPT') ? facturaOriginal?.id : undefined}
                          data-nca-id={(doc.tipo === 'NCA' || doc.tipo === 'NC') ? doc.id.replace('nca-', '') : undefined}
                          onClick={() => {
                            if (doc.tipo === 'OP') {
                              const opId = doc.id.replace('op-', '');
                              const orden = ordenesPago.find((o) => String(o.id) === opId);
                              if (orden) abrirDetalleOrdenPago(orden);
                            }
                          }}
                        >
                          <TableCell>
                            <Badge className={`text-[10px] px-1.5 py-0.5 ${config.bg} ${config.text} border-0 gap-1`}>
                              {config.icon}
                              {doc.tipo}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            {doc.numero}
                            {doc.descripcion && <span className="text-muted-foreground ml-1">({doc.descripcion})</span>}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatDate(doc.fecha)}</TableCell>
                          <TableCell className="text-xs text-right">
                            {doc.debe > 0 ? <span className="text-red-600 font-medium">{formatCurrency(doc.debe)}</span> : '-'}
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            {doc.haber > 0 ? <span className="text-green-600 font-medium">{formatCurrency(doc.haber)}</span> : '-'}
                          </TableCell>
                          <TableCell className={`text-xs text-right ${doc.saldo > 0 ? 'text-red-600 font-medium' : doc.saldo < 0 ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}>
                            {doc.saldo !== 0 ? formatCurrency(Math.abs(doc.saldo)) : '-'}
                            {doc.saldo < 0 && <span className="text-[9px] ml-0.5">(a favor)</span>}
                          </TableCell>
                          <TableCell className="text-xs">
                            {doc.vencimiento ? (
                              <div className="flex items-center gap-1.5">
                                <span className={estaVencida ? 'text-red-600 font-medium' : 'text-muted-foreground'}>{formatDate(doc.vencimiento)}</span>
                                {(() => {
                                  const diasInfo = getDiasVencimiento(doc.vencimiento, doc.saldo);
                                  if (!diasInfo) return null;
                                  return <span className={`text-[10px] font-medium px-1 py-0 rounded ${diasInfo.color}`}>{diasInfo.texto}</span>;
                                })()}
                              </div>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {getEstadoBadge(doc.estado)}
                              {(doc.tipo === 'FCA' || doc.tipo === 'PPT') && doc.ingresoConfirmado && (
                                <span className="inline-flex items-center text-[10px] text-green-600 bg-green-50 dark:bg-green-900/20 px-1 py-0.5 rounded" title="Stock ingresado">
                                  <Truck className="w-3 h-3" />
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {(doc.tipo === 'FCA' || doc.tipo === 'PPT') && facturaOriginal && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <MoreHorizontal className="w-3.5 h-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-36">
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      const rect = (e.target as HTMLElement).getBoundingClientRect();
                                      setQuickViewPosition({ x: rect.left - 420, y: rect.top });
                                      setQuickViewFactura(facturaOriginal);
                                      loadQuickViewDetails(facturaOriginal.id, facturaOriginal.docType);
                                    }}
                                  >
                                    <Eye className="w-3.5 h-3.5 mr-2" />
                                    Ver detalle
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => abrirEditarFactura(facturaOriginal)}>
                                    <Edit className="w-3.5 h-3.5 mr-2" />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedFacturas([facturaOriginal.id]);
                                      setIsPagoModalOpen(true);
                                    }}
                                  >
                                    <CreditCard className="w-3.5 h-3.5 mr-2" />
                                    Pagar
                                  </DropdownMenuItem>
                                  {!facturaOriginal.ingresoConfirmado && (
                                    <DropdownMenuItem
                                      onClick={() => abrirCargarRemito(facturaOriginal)}
                                    >
                                      <Truck className="w-3.5 h-3.5 mr-2" />
                                      Cargar Remito
                                    </DropdownMenuItem>
                                  )}
                                  {/* Solo mostrar Ver Relaciones si hay documentos relacionados */}
                                  {(() => {
                                    const facturaIdNum = Number(facturaOriginal.id);
                                    const tieneNCA = notasCredito.some(nc => nc.facturaId === facturaIdNum);
                                    const tieneOP = ordenesPago.some(op =>
                                      op.receipts?.some((r: any) => r.receiptId === facturaIdNum || r.receipt?.id === facturaIdNum)
                                    );
                                    const tieneRemito = recepciones.length > 0; // Si hay recepciones del proveedor
                                    const tieneRelaciones = tieneNCA || tieneOP || tieneRemito;

                                    if (tieneRelaciones) {
                                      return (
                                        <DropdownMenuItem
                                          onClick={() => {
                                            setRelacionesFacturaData({
                                              facturaId: facturaIdNum,
                                              facturaNumero: facturaOriginal.numero,
                                              facturaTotal: facturaOriginal.total,
                                              proveedorId: Number(proveedorId),
                                              facturaDocType: facturaOriginal.docType,
                                            });
                                            setRelacionesModalOpen(true);
                                          }}
                                        >
                                          <ClipboardList className="w-3.5 h-3.5 mr-2" />
                                          Ver Relaciones
                                        </DropdownMenuItem>
                                      );
                                    }
                                    return null;
                                  })()}
                                  <DropdownMenuSeparator />
                                  {/* Buscar TODAS las NCAs vinculadas a esta factura */}
                                  {(() => {
                                    const ncasVinculadas = notasCredito.filter(nc => nc.facturaId === Number(facturaOriginal.id));
                                    if (ncasVinculadas.length > 0) {
                                      return (
                                        <DropdownMenuItem
                                          onClick={() => {
                                            // Resaltar TODAS las NCAs vinculadas
                                            ncasVinculadas.forEach((nca, index) => {
                                              const ncaEl = document.querySelector(`[data-nca-id="${nca.id}"]`);
                                              if (ncaEl) {
                                                // Solo scroll al primer elemento
                                                if (index === 0) {
                                                  ncaEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                }
                                                ncaEl.classList.add('ring-2', 'ring-green-500', 'bg-green-50', 'dark:bg-green-900/20');
                                                setTimeout(() => {
                                                  ncaEl.classList.remove('ring-2', 'ring-green-500', 'bg-green-50', 'dark:bg-green-900/20');
                                                }, 3000);
                                              }
                                            });
                                            const numeros = ncasVinculadas.map(nc => nc.numero).join(', ');
                                            toast.info(`${ncasVinculadas.length} NCA${ncasVinculadas.length > 1 ? 's' : ''} vinculada${ncasVinculadas.length > 1 ? 's' : ''}: ${numeros}`);
                                          }}
                                          className="text-green-600"
                                        >
                                          <Receipt className="w-3.5 h-3.5 mr-2" />
                                          Ver NCA{ncasVinculadas.length > 1 ? 's' : ''} Vinculada{ncasVinculadas.length > 1 ? 's' : ''} ({ncasVinculadas.length})
                                        </DropdownMenuItem>
                                      );
                                    }
                                    return null;
                                  })()}
                                  <DropdownMenuItem onClick={() => handleCrearNcaDesdeFactura(facturaOriginal)}>
                                    <FileText className="w-3.5 h-3.5 mr-2" />
                                    Crear NCA
                                  </DropdownMenuItem>
                                  {facturaOriginal.ingresoConfirmado && (
                                    <DropdownMenuItem onClick={() => handleCrearDevolucionDesdeFactura(facturaOriginal)}>
                                      <RefreshCw className="w-3.5 h-3.5 mr-2" />
                                      Crear Devolucion
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => abrirEliminarFactura(facturaOriginal)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                                    Eliminar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                            {/* Menu para OP */}
                            {doc.tipo === 'OP' && (() => {
                              const opId = doc.id.replace('op-', '');
                              const ordenOriginal = ordenesPago.find((o) => String(o.id) === opId);
                              if (!ordenOriginal) return null;
                              return (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7">
                                      <MoreHorizontal className="w-3.5 h-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-40">
                                    <DropdownMenuItem onClick={() => abrirDetalleOrdenPago(ordenOriginal)}>
                                      <Eye className="w-3.5 h-3.5 mr-2" />
                                      Ver detalle
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              );
                            })()}
                            {/* Menu para Remitos */}
                            {doc.tipo === 'REMITO' && (() => {
                              const remId = doc.id.replace('rem-', '');
                              const recepcionOriginal = recepciones.find((r) => String(r.id) === remId);
                              if (!recepcionOriginal) return null;
                              return (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7">
                                      <MoreHorizontal className="w-3.5 h-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-40">
                                    <DropdownMenuItem
                                      onClick={() => setRecepcionDetalleModal({
                                        id: recepcionOriginal.id,
                                        numero: recepcionOriginal.numero,
                                        fechaRecepcion: recepcionOriginal.fechaRecepcion,
                                        numeroRemito: recepcionOriginal.numeroRemito,
                                        estado: recepcionOriginal.estado,
                                        itemsCount: recepcionOriginal.itemsCount,
                                        adjuntos: recepcionOriginal.adjuntos,
                                        firma: recepcionOriginal.firma,
                                        facturaId: recepcionOriginal.facturaId,
                                        facturaNumero: recepcionOriginal.facturaNumero,
                                      })}
                                    >
                                      <Eye className="w-3.5 h-3.5 mr-2" />
                                      Ver detalle
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              );
                            })()}
                            {(doc.tipo === 'NCA' || doc.tipo === 'NC') && (() => {
                              const ncaOriginal = notasCredito.find(nc => `nca-${nc.id}` === doc.id);
                              if (!ncaOriginal) return null;
                              return (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7">
                                      <MoreHorizontal className="w-3.5 h-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48">
                                    {/* Ver Detalle - disponible para TODAS las NCAs */}
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setNcaDetalleData({
                                          id: ncaOriginal.id,
                                          numero: ncaOriginal.numero,
                                          tipo: ncaOriginal.tipo,
                                          tipoNca: ncaOriginal.tipoNca,
                                          docType: ncaOriginal.docType,
                                          monto: ncaOriginal.monto,
                                          fecha: ncaOriginal.fecha,
                                          estado: ncaOriginal.estado,
                                          aplicada: ncaOriginal.aplicada,
                                          facturaRelacionada: ncaOriginal.facturaRelacionada,
                                          purchaseReturn: ncaOriginal.purchaseReturn,
                                        });
                                        setNcaDetalleOpen(true);
                                      }}
                                    >
                                      <Eye className="w-3.5 h-3.5 mr-2" />
                                      Ver Detalle
                                    </DropdownMenuItem>
                                    {ncaOriginal.facturaRelacionada && (
                                      <DropdownMenuItem
                                        onClick={() => {
                                          // Resaltar la factura relacionada
                                          const facturaEl = document.querySelector(`[data-factura-id="${ncaOriginal.facturaId}"]`);
                                          if (facturaEl) {
                                            facturaEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            facturaEl.classList.add('ring-2', 'ring-primary', 'bg-primary/10');
                                            setTimeout(() => {
                                              facturaEl.classList.remove('ring-2', 'ring-primary', 'bg-primary/10');
                                            }, 3000);
                                          }
                                          toast.info(`Factura vinculada: ${ncaOriginal.facturaRelacionada}`);
                                        }}
                                      >
                                        <FileText className="w-3.5 h-3.5 mr-2" />
                                        Ver Factura Vinculada
                                      </DropdownMenuItem>
                                    )}
                                    {ncaOriginal.purchaseReturn && (
                                      <DropdownMenuItem
                                        onClick={() => {
                                          router.push(`/administracion/compras/devoluciones/${ncaOriginal.purchaseReturnId}`);
                                        }}
                                      >
                                        <RefreshCw className="w-3.5 h-3.5 mr-2" />
                                        Ver Devolución
                                      </DropdownMenuItem>
                                    )}
                                    {ncaOriginal.tipoNca === 'NCA_DEVOLUCION' && !ncaOriginal.purchaseReturn && (
                                      <DropdownMenuItem
                                        onClick={() => {
                                          toast.warning('Esta NCA debería tener una devolución vinculada');
                                        }}
                                        className="text-amber-600"
                                      >
                                        <AlertCircle className="w-3.5 h-3.5 mr-2" />
                                        Sin Devolución
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => abrirEliminarNca({
                                        id: ncaOriginal.id,
                                        numero: ncaOriginal.numero,
                                        purchaseReturn: ncaOriginal.purchaseReturn,
                                        aplicada: ncaOriginal.aplicada || ncaOriginal.estado === 'APLICADA',
                                      })}
                                    >
                                      <Trash2 className="w-3.5 h-3.5 mr-2" />
                                      Eliminar
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              );
                            })()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {documentosCCFiltrados.length > 0 && (
                <div className="flex items-center justify-center px-4 py-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    Mostrando {documentosCCFiltrados.length} documento{documentosCCFiltrados.length !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Tabla de Pagos */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Historial de Pagos</CardTitle>
              <Badge variant="secondary" className="text-xs">{pagosFiltrados.length}</Badge>
            </div>
            <Button size="sm" onClick={() => setIsPagoModalOpen(true)} disabled={facturas.filter(f => f.saldo > 0).length === 0} className="h-8">
              <CreditCard className="w-3.5 h-3.5 mr-2" />
              Registrar Pago
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {pagosUnicosRender.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="p-3 rounded-full bg-muted mb-3">
                <CreditCard className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No hay pagos registrados</p>
              <p className="text-xs text-muted-foreground mt-1">Los pagos aparecerán aquí cuando se registren</p>
              {facturas.filter(f => f.saldo > 0).length > 0 && (
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setIsPagoModalOpen(true)}>
                  <CreditCard className="w-3.5 h-3.5 mr-2" />
                  Registrar primer pago
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="text-xs font-medium w-[80px]">N° OP</TableHead>
                      <TableHead className="text-xs font-medium w-[80px]">Fecha</TableHead>
                      <TableHead className="text-xs font-medium w-[100px]">Monto</TableHead>
                      <TableHead className="text-xs font-medium">Método</TableHead>
                      <TableHead className="text-xs font-medium">Factura</TableHead>
                      <TableHead className="text-xs font-medium">Observaciones</TableHead>
                      <TableHead className="text-xs font-medium text-right w-[70px]">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagosUnicosRender.map((pago, index) => {
                      const uniqueKey = `pago-${pago.id}-${pago.fecha.getTime()}-${pago.monto}-${index}`;
                      const getMetodoInfo = (metodo: string) => {
                        const m = metodo?.toLowerCase() || '';
                        if (m.includes('efectivo')) return { icon: Banknote, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' };
                        if (m.includes('transferencia')) return { icon: ArrowRight, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' };
                        if (m.includes('cheque')) return { icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' };
                        if (m.includes('orden')) return { icon: CreditCard, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' };
                        return { icon: CircleDollarSign, color: 'text-muted-foreground', bg: 'bg-muted/50' };
                      };
                      const metodoInfo = getMetodoInfo(pago.metodo || '');
                      const MetodoIcon = metodoInfo.icon;

                      return (
                        <TableRow
                          key={uniqueKey}
                          className="hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => {
                            const orden = ordenesPago.find((o) => String(o.id) === pago.id);
                            if (orden) abrirDetalleOrdenPago(orden);
                          }}
                        >
                          <TableCell className="text-xs font-medium">OP-{pago.id}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatDate(pago.fecha)}</TableCell>
                          <TableCell className="text-xs font-medium text-green-600">{formatCurrency(pago.monto)}</TableCell>
                          <TableCell className="text-xs">
                            <div className="flex items-center gap-1.5">
                              <div className={`p-0.5 rounded ${metodoInfo.bg}`}>
                                <MetodoIcon className={`w-3 h-3 ${metodoInfo.color}`} />
                              </div>
                              <span>{pago.metodo || '-'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            {pago.facturaNumero ? <span className="font-medium">{pago.facturaNumero}</span> : <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{pago.observaciones || '-'}</TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreHorizontal className="w-3.5 h-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-36">
                                <DropdownMenuItem
                                  onClick={() => {
                                    const orden = ordenesPago.find((o) => String(o.id) === pago.id);
                                    if (!orden) { toast.error('No se encontró el detalle de esta orden de pago'); return; }
                                    abrirDetalleOrdenPago(orden);
                                  }}
                                >
                                  <Eye className="w-3.5 h-3.5 mr-2" />
                                  Ver detalle
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => {
                                    const orden = ordenesPago.find((o) => String(o.id) === pago.id);
                                    if (!orden) { toast.error('No se encontró el detalle de esta orden de pago'); return; }
                                    abrirEliminarOrdenPago(orden);
                                  }}
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                                  Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {pagosUnicosRender.length > 0 && (
                <div className="flex items-center justify-center px-4 py-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    Mostrando {pagosUnicosRender.length} pago{pagosUnicosRender.length !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Timeline de Movimientos */}
      {timelineMovimientos.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">Últimos Movimientos</CardTitle>
                <Badge variant="secondary" className="text-xs">{timelineMovimientos.length}</Badge>
              </div>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setCcTimelineVisible(!ccTimelineVisible)}>
                <ChevronUp className={`h-4 w-4 transition-transform ${ccTimelineVisible ? '' : 'rotate-180'}`} />
              </Button>
            </div>
          </CardHeader>
          {ccTimelineVisible && (
            <CardContent className="pt-0">
              <div className="relative">
                <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" />
                <div className="space-y-3">
                  {timelineMovimientos.map((mov) => (
                    <div key={mov.id} className="relative flex items-start gap-3 pl-7">
                      <div className={`absolute left-0 top-1 w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center ${
                        mov.tipo === 'factura' ? 'bg-blue-50 border-blue-500 dark:bg-blue-900/30' :
                        mov.tipo === 'pago' ? 'bg-green-50 border-green-500 dark:bg-green-900/30' :
                        'bg-amber-50 border-amber-500 dark:bg-amber-900/30'
                      }`}>
                        {mov.tipo === 'factura' ? <FileText className="w-3 h-3 text-blue-600" /> :
                         mov.tipo === 'pago' ? <Banknote className="w-3 h-3 text-green-600" /> :
                         <Truck className="w-3 h-3 text-amber-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate">{mov.descripcion}</p>
                          {mov.tipo !== 'recepcion' && (
                            <span className={`text-sm font-semibold whitespace-nowrap ${mov.tipo === 'factura' ? 'text-blue-600' : 'text-green-600'}`}>
                              {mov.tipo === 'factura' ? '+' : '-'} {formatCurrency(mov.monto)}
                            </span>
                          )}
                          {/* Remitos en timeline: sin acciones - se gestionan desde la factura vinculada */}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">{formatDate(mov.fecha)}</span>
                          {mov.tipo === 'factura' && mov.saldo !== undefined && mov.saldo > 0 && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1">Saldo: {formatCurrency(mov.saldo)}</Badge>
                          )}
                          {mov.tipo === 'factura' && mov.estado && (
                            <Badge variant={mov.estado === 'pagada' ? 'default' : mov.estado === 'pendiente' ? 'outline' : 'secondary'} className="text-[10px] h-4 px-1">
                              {mov.estado}
                            </Badge>
                          )}
                          {mov.tipo === 'recepcion' && mov.estado && (
                            <Badge variant={mov.estado === 'confirmada' ? 'default' : mov.estado === 'borrador' ? 'outline' : 'secondary'} className="text-[10px] h-4 px-1">
                              {mov.estado === 'confirmada' ? 'Confirmado' : mov.estado === 'borrador' ? 'Pendiente' : mov.estado}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* ============ MODALES ============ */}

      {/* Modal para editar factura */}
      <ComprobanteFormModal
        open={isFacturaEditModalOpen}
        onOpenChange={(open) => { setIsFacturaEditModalOpen(open); if (!open) { setFacturaEditandoId(null); setFacturaEditandoDocType(null); } }}
        comprobanteId={facturaEditandoId}
        editDocType={facturaEditandoDocType}
        onSaved={() => { loadProveedorData(proveedorId); setFacturaEditandoId(null); setFacturaEditandoDocType(null); }}
      />

      {/* Modal para crear nuevo comprobante */}
      <ComprobanteFormModal
        open={isNuevoComprobanteModalOpen}
        onOpenChange={(open) => {
          setIsNuevoComprobanteModalOpen(open);
          if (!open) setPrefilledData(null);
        }}
        defaultProveedorId={proveedor?.id}
        prefilledData={prefilledData}
        onSaved={() => {
          loadProveedorData(proveedorId);
          setPrefilledData(null);
        }}
      />

      {/* Modal para cargar PDF con IA */}
      <Dialog open={showPdfUploader} onOpenChange={setShowPdfUploader}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Cargar Factura desde PDF
            </DialogTitle>
            <DialogDescription>
              Arrastra un archivo PDF o selecciónalo para extraer los datos automáticamente con IA.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Drop zone */}
            <label
              className={cn(
                "flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                pdfProcessing
                  ? "border-primary/50 bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
              )}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files[0];
                if (file) handlePdfUpload(file);
              }}
            >
              <input
                type="file"
                className="hidden"
                accept=".pdf"
                disabled={pdfProcessing}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePdfUpload(file);
                }}
              />
              {pdfProcessing ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Procesando PDF con IA...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm font-medium">Arrastra tu PDF aquí</p>
                    <p className="text-xs text-muted-foreground">o haz clic para seleccionar</p>
                  </div>
                </div>
              )}
            </label>

            {/* Info */}
            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground mb-1">Información</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Se extraerán datos como proveedor, montos e impuestos</li>
                  <li>Revisa los datos antes de guardar</li>
                  <li>El proveedor {proveedor?.nombre} ya está seleccionado</li>
                </ul>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPdfUploader(false)}
              disabled={pdfProcessing}
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmar eliminar factura */}
      <DeleteConfirmDialog
        open={isDeleteFacturaOpen}
        onOpenChange={setIsDeleteFacturaOpen}
        title="Eliminar Factura"
        description={`¿Estás seguro de que querés eliminar la factura ${facturaAEliminar?.numero}? Esta acción no se puede deshacer.`}
        onConfirm={confirmarEliminarFactura}
        loading={deleteFacturaLoading}
      />

      {/* Modal Confirmar eliminar orden de pago */}
      <DeleteConfirmDialog
        open={isDeleteOrdenPagoOpen}
        onOpenChange={setIsDeleteOrdenPagoOpen}
        title="Eliminar Orden de Pago"
        description={`¿Estás seguro de que querés eliminar la orden de pago OP-${ordenPagoAEliminar?.id}? Esta acción revertirá los pagos aplicados a las facturas.`}
        onConfirm={confirmarEliminarOrdenPago}
        loading={deleteOrdenPagoLoading}
      />

      {/* Modal Confirmar eliminar remito */}
      <DeleteConfirmDialog
        open={isDeleteRemitoOpen}
        onOpenChange={setIsDeleteRemitoOpen}
        title="Eliminar Remito"
        description={`¿Estás seguro de que querés eliminar el remito ${remitoAEliminar?.numero}? Se revertirá el stock y la factura volverá a estado "sin ingreso". Esta acción no se puede deshacer.`}
        onConfirm={confirmarEliminarRemito}
        loading={deleteRemitoLoading}
      />

      {/* Modal Confirmar eliminar NCA/NC */}
      <DeleteConfirmDialog
        open={isDeleteNcaOpen}
        onOpenChange={setIsDeleteNcaOpen}
        title="Eliminar Nota de Crédito"
        description={(() => {
          const warnings: string[] = [];
          if (ncaAEliminar?.aplicada) {
            warnings.push('⚠️ Esta NC está APLICADA. Se revertirán los movimientos de cuenta corriente.');
          }
          if (ncaAEliminar?.purchaseReturn) {
            warnings.push(`⚠️ Esta NC está vinculada a la devolución ${ncaAEliminar.purchaseReturn.numero}. También se eliminará la devolución.`);
          }
          const base = `¿Estás seguro de que querés eliminar la nota ${ncaAEliminar?.numero}?`;
          if (warnings.length > 0) {
            return `${base}\n\n${warnings.join('\n\n')}\n\nEsta acción no se puede deshacer.`;
          }
          return `${base} Esta acción no se puede deshacer.`;
        })()}
        onConfirm={confirmarEliminarNca}
        loading={deleteNcaLoading}
      />

      {/* Modal de Órdenes de Compra */}
      <Dialog open={isOCModalOpen} onOpenChange={setIsOCModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Órdenes de Compra - {proveedor?.nombre}
            </DialogTitle>
            <DialogDescription>Listado de órdenes de compra del proveedor</DialogDescription>
          </DialogHeader>

          {loadingOC ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : ordenesCompra.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No hay órdenes de compra</p>
              <p className="text-xs text-muted-foreground mt-1">Las órdenes de compra aparecerán aquí cuando se creen</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-sm">
                <Badge variant="secondary">{ordenesCompra.length} orden{ordenesCompra.length !== 1 ? 'es' : ''}</Badge>
                <span className="text-muted-foreground">
                  Total: <span className="font-semibold text-foreground">{formatCurrency(ordenesCompra.reduce((sum, oc) => sum + oc.total, 0))}</span>
                </span>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs font-medium">Número</TableHead>
                      <TableHead className="text-xs font-medium">Fecha</TableHead>
                      <TableHead className="text-xs font-medium w-[50px]">Items</TableHead>
                      <TableHead className="text-xs font-medium">Total</TableHead>
                      <TableHead className="text-xs font-medium">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordenesCompra.slice(0, 5).map((oc) => (
                      <TableRow key={oc.id} className="hover:bg-muted/30">
                        <TableCell className="text-xs font-medium">{oc.numero}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(oc.fecha)}</TableCell>
                        <TableCell className="text-xs text-center">{oc.itemsCount}</TableCell>
                        <TableCell className="text-xs font-medium">{formatCurrency(oc.total)}</TableCell>
                        <TableCell>
                          <Badge variant={oc.estado === 'completada' ? 'default' : oc.estado === 'pendiente' ? 'outline' : 'secondary'} className="text-[10px] px-1.5 py-0">{oc.estado}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {ordenesCompra.length > 5 && (
                <p className="text-xs text-muted-foreground text-center">Mostrando 5 de {ordenesCompra.length} órdenes</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => router.push(`/administracion/compras/ordenes?proveedor=${proveedorId}`)}>
              Ver todas las OC
            </Button>
            <Button variant="ghost" onClick={() => setIsOCModalOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal datos bancarios */}
      <Dialog open={isBancoModalOpen} onOpenChange={setIsBancoModalOpen}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle>Datos bancarios del proveedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            {(!proveedor?.cbu && !proveedor?.aliasCbu && !proveedor?.banco && !proveedor?.cuit) ? (
              <p className="text-muted-foreground">Este proveedor no tiene datos bancarios cargados.</p>
            ) : (
              <>
                {proveedor?.cuit && (
                  <div className="p-3 rounded-lg bg-muted/30 border">
                    <p className="text-xs text-muted-foreground">CUIT</p>
                    <p className="font-semibold text-lg">{proveedor.cuit}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Banco</p>
                    <p className="font-medium">{proveedor?.banco || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tipo de cuenta</p>
                    <p className="font-medium">{proveedor?.tipoCuenta || '-'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Número de cuenta</p>
                  <p className="font-medium">{proveedor?.numeroCuenta || '-'}</p>
                </div>
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <p className="text-xs text-blue-600">CBU</p>
                  <p className="font-mono font-medium text-sm">{proveedor?.cbu || '-'}</p>
                </div>
                {proveedor?.aliasCbu && (
                  <div>
                    <p className="text-xs text-muted-foreground">Alias CBU</p>
                    <p className="font-medium">{proveedor.aliasCbu}</p>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBancoModalOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para ver evidencia de recepción (fotos/firma) */}
      <Dialog open={!!recepcionVistaModal} onOpenChange={(open) => { if (!open) setRecepcionVistaModal(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-amber-600" />
              Evidencia de Recepción
            </DialogTitle>
            <DialogDescription>
              Fotos y firma de la recepción de mercadería
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {recepcionVistaModal?.adjuntos && recepcionVistaModal.adjuntos.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Fotos del Remito/Mercadería</h4>
                <div className="grid grid-cols-2 gap-3">
                  {recepcionVistaModal.adjuntos.map((url, idx) => (
                    <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="block">
                      <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-40 object-cover rounded-lg border hover:opacity-90 transition-opacity cursor-pointer" />
                    </a>
                  ))}
                </div>
              </div>
            )}
            {recepcionVistaModal?.firma && (
              <div>
                <h4 className="text-sm font-medium mb-2">Firma de Confirmación</h4>
                <div className="p-4 bg-muted rounded-lg">
                  <img src={recepcionVistaModal.firma} alt="Firma" className="max-h-32 mx-auto" />
                </div>
              </div>
            )}
            {!recepcionVistaModal?.adjuntos?.length && !recepcionVistaModal?.firma && (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No hay evidencia adjunta para esta recepción</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecepcionVistaModal(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de detalle de recepción/remito */}
      <Dialog open={!!recepcionDetalleModal} onOpenChange={(open) => { if (!open) setRecepcionDetalleModal(null); }}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          {recepcionDetalleModal && (
            <>
              {/* Header con fondo */}
              <div className="bg-amber-50 dark:bg-amber-950/30 border-b px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50">
                      <Truck className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Recepción / Remito</p>
                      <p className="font-semibold text-lg">{recepcionDetalleModal.numero}</p>
                    </div>
                  </div>
                  <Badge
                    variant={recepcionDetalleModal.estado === 'confirmada' ? 'default' : 'secondary'}
                    className={recepcionDetalleModal.estado === 'confirmada' ? 'bg-green-600' : ''}
                  >
                    {recepcionDetalleModal.estado}
                  </Badge>
                </div>
              </div>

              {/* Contenido */}
              <div className="p-4 space-y-4">
                {/* Info principal */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Fecha Recepción</p>
                    </div>
                    <p className="font-medium">{formatDate(recepcionDetalleModal.fechaRecepcion)}</p>
                  </div>
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Package className="w-3.5 h-3.5 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Artículos</p>
                    </div>
                    <p className="font-medium">{recepcionDetalleModal.itemsCount} item{recepcionDetalleModal.itemsCount !== 1 ? 's' : ''}</p>
                  </div>
                </div>

                {/* Info secundaria */}
                <div className="space-y-2">
                  {recepcionDetalleModal.numeroRemito && (
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm text-muted-foreground">Nº Remito Proveedor</span>
                      <span className="font-medium">{recepcionDetalleModal.numeroRemito}</span>
                    </div>
                  )}
                  {recepcionDetalleModal.facturaNumero && (
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm text-muted-foreground">Factura Vinculada</span>
                      <span className="font-medium text-primary">{recepcionDetalleModal.facturaNumero}</span>
                    </div>
                  )}
                </div>

                {/* Evidencia */}
                {(recepcionDetalleModal.adjuntos?.length || recepcionDetalleModal.firma) ? (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Evidencia Adjunta</p>
                    <div className="grid grid-cols-4 gap-2">
                      {recepcionDetalleModal.adjuntos?.map((url, idx) => (
                        <button
                          key={idx}
                          onClick={() => setEvidenciaViewer({ url, fileName: `Foto-${idx + 1}.jpg` })}
                          className="aspect-square rounded-lg border overflow-hidden hover:ring-2 hover:ring-primary transition-all group relative"
                        >
                          <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <Eye className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </button>
                      ))}
                      {recepcionDetalleModal.firma && (
                        <button
                          onClick={() => setEvidenciaViewer({ url: recepcionDetalleModal.firma!, fileName: 'Firma.png' })}
                          className="aspect-square rounded-lg border overflow-hidden hover:ring-2 hover:ring-primary transition-all group relative bg-muted/50 flex items-center justify-center"
                        >
                          <img src={recepcionDetalleModal.firma} alt="Firma" className="max-h-full max-w-full p-2" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <Eye className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <span className="absolute bottom-1 left-1 right-1 text-[10px] bg-black/50 text-white rounded px-1 truncate">Firma</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 bg-muted/20 rounded-lg">
                    <Package className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">Sin evidencia adjunta</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t px-4 py-3 bg-muted/30 flex justify-end">
                <Button variant="outline" onClick={() => setRecepcionDetalleModal(null)}>Cerrar</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* FileViewer para evidencia de recepción */}
      {evidenciaViewer && (
        <FileViewer
          url={evidenciaViewer.url}
          fileName={evidenciaViewer.fileName}
          open={!!evidenciaViewer}
          onClose={() => setEvidenciaViewer(null)}
        />
      )}

      {/* Modal de detalle de orden de pago */}
      <Dialog open={isDetallePagoOpen && !!pagoDetalleSeleccionado} onOpenChange={(open) => { setIsDetallePagoOpen(open); if (!open) setPagoDetalleSeleccionado(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] p-0 overflow-hidden">
          {pagoDetalleSeleccionado && (
            <>
              <div className="bg-primary/5 border-b px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Receipt className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Orden de Pago</p>
                      <p className="text-sm font-semibold">#{pagoDetalleSeleccionado.id}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Fecha</p>
                    <p className="text-sm font-medium">{formatDate(new Date(pagoDetalleSeleccionado.fechaPago))}</p>
                  </div>
                </div>
              </div>

              <div className="overflow-y-auto max-h-[calc(90vh-180px)] px-4 py-4 space-y-4">
                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800 dark:text-green-200">Total Pagado</span>
                  </div>
                  <span className="text-lg font-bold text-green-600">{formatCurrency(Number(pagoDetalleSeleccionado.totalPago || 0))}</span>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5" />Medios de Pago
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {Number(pagoDetalleSeleccionado.efectivo || 0) > 0 && (
                      <div className="flex items-center justify-between p-2.5 rounded-md border bg-muted/30">
                        <span className="text-xs text-muted-foreground">Efectivo</span>
                        <span className="text-xs font-semibold">{formatCurrency(Number(pagoDetalleSeleccionado.efectivo))}</span>
                      </div>
                    )}
                    {Number(pagoDetalleSeleccionado.transferencia || 0) > 0 && (
                      <div className="flex items-center justify-between p-2.5 rounded-md border bg-muted/30">
                        <span className="text-xs text-muted-foreground">Transferencia</span>
                        <span className="text-xs font-semibold">{formatCurrency(Number(pagoDetalleSeleccionado.transferencia))}</span>
                      </div>
                    )}
                    {Number(pagoDetalleSeleccionado.chequesTerceros || 0) > 0 && (
                      <div className="flex items-center justify-between p-2.5 rounded-md border bg-muted/30">
                        <span className="text-xs text-muted-foreground">Ch. Terceros</span>
                        <span className="text-xs font-semibold">{formatCurrency(Number(pagoDetalleSeleccionado.chequesTerceros))}</span>
                      </div>
                    )}
                    {Number(pagoDetalleSeleccionado.chequesPropios || 0) > 0 && (
                      <div className="flex items-center justify-between p-2.5 rounded-md border bg-muted/30">
                        <span className="text-xs text-muted-foreground">Ch. Propios</span>
                        <span className="text-xs font-semibold">{formatCurrency(Number(pagoDetalleSeleccionado.chequesPropios))}</span>
                      </div>
                    )}
                  </div>
                </div>

                {pagoDetalleSeleccionado.recibos && pagoDetalleSeleccionado.recibos.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />Facturas Aplicadas
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{pagoDetalleSeleccionado.recibos.length}</Badge>
                    </p>
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableHead className="text-xs font-medium h-7">Factura</TableHead>
                            <TableHead className="text-xs font-medium text-right h-7">Total</TableHead>
                            <TableHead className="text-xs font-medium text-right h-7">Aplicado</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pagoDetalleSeleccionado.recibos.map((r: any) => {
                            const recibo = r.receipt;
                            const numero = recibo ? `${getPrefijoComprobante(recibo.tipo)}${recibo.numeroSerie}-${recibo.numeroFactura}` : '-';
                            return (
                              <TableRow key={r.id} className="hover:bg-muted/30">
                                <TableCell className="text-xs font-medium py-1.5">{numero}</TableCell>
                                <TableCell className="text-xs text-right py-1.5 text-muted-foreground">{formatCurrency(Number(recibo?.total || 0))}</TableCell>
                                <TableCell className="text-xs text-right py-1.5 font-medium text-green-600">{formatCurrency(Number(r.montoAplicado || 0))}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {pagoDetalleSeleccionado.notas && (
                  <div className="p-3 rounded-md bg-muted/30 border">
                    <p className="text-[11px] text-muted-foreground mb-1">Observaciones</p>
                    <p className="text-xs">{pagoDetalleSeleccionado.notas}</p>
                  </div>
                )}

                {/* Comprobantes adjuntos */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <Paperclip className="w-3 h-3" />
                      Comprobantes adjuntos
                      {pagoDetalleAttachments.length > 0 && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{pagoDetalleAttachments.length}</Badge>
                      )}
                    </p>
                    {/* Botón para agregar comprobantes */}
                    <div>
                      <input
                        ref={comprobantesInputRef}
                        type="file"
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png,image/*,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handleSubirComprobantesOP(e.target.files);
                          }
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] px-2"
                        disabled={uploadingComprobantesOP}
                        onClick={() => comprobantesInputRef.current?.click()}
                      >
                        {uploadingComprobantesOP ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Subiendo...
                          </>
                        ) : (
                          <>
                            <Plus className="w-3 h-3 mr-1" />
                            Agregar
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {loadingAttachments ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground p-3">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Cargando comprobantes...
                    </div>
                  ) : pagoDetalleAttachments.length > 0 ? (
                    <div className="space-y-1">
                      {pagoDetalleAttachments.map((att) => (
                        <div
                          key={att.id}
                          className="flex items-center gap-2 p-2 rounded-md border bg-blue-50/50 text-xs group"
                        >
                          <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <a
                            href={att.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 truncate text-blue-700 hover:underline"
                          >
                            {att.fileName}
                          </a>
                          <a
                            href={att.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-700 shrink-0"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          <button
                            type="button"
                            onClick={() => handleEliminarComprobanteOP(att.id)}
                            className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            title="Eliminar comprobante"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground italic p-2 text-center border border-dashed rounded-md">
                      Sin comprobantes adjuntos
                    </p>
                  )}
                </div>
              </div>

              <div className="border-t px-4 py-3 bg-muted/20 flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={() => setIsDetallePagoOpen(false)}>Cerrar</Button>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={async () => {
                    try {
                      const pdfData: PaymentOrderPDFData = {
                        ...pagoDetalleSeleccionado,
                        proveedor: {
                          razonSocial: proveedor?.razonSocial || '',
                          codigo: proveedor?.codigo,
                          cuit: proveedor?.cuit || '',
                          banco: proveedor?.banco,
                          tipoCuenta: proveedor?.tipoCuenta,
                          numeroCuenta: proveedor?.numeroCuenta,
                          cbu: proveedor?.cbu,
                          aliasCbu: proveedor?.aliasCbu,
                        },
                        attachments: pagoDetalleAttachments,
                      };
                      toast.loading('Generando PDF con comprobantes...', { id: 'pdf-gen' });
                      const url = await generatePaymentOrderPDF(pdfData);
                      toast.dismiss('pdf-gen');
                      setPdfUrl(url);
                      setIsPdfModalOpen(true);
                    } catch (error) {
                      console.error('Error generando PDF:', error);
                      toast.dismiss('pdf-gen');
                      toast.error('Error al generar el PDF');
                    }
                  }}>
                    <Printer className="w-3.5 h-3.5 mr-2" />
                    Ver PDF
                  </Button>
                  <Button size="sm" onClick={async () => {
                    try {
                      const pdfData: PaymentOrderPDFData = {
                        ...pagoDetalleSeleccionado,
                        proveedor: {
                          razonSocial: proveedor?.razonSocial || '',
                          codigo: proveedor?.codigo,
                          cuit: proveedor?.cuit || '',
                          banco: proveedor?.banco,
                          tipoCuenta: proveedor?.tipoCuenta,
                          numeroCuenta: proveedor?.numeroCuenta,
                          cbu: proveedor?.cbu,
                          aliasCbu: proveedor?.aliasCbu,
                        },
                        attachments: pagoDetalleAttachments,
                      };
                      toast.loading('Generando PDF con comprobantes...', { id: 'pdf-send' });
                      const url = await generatePaymentOrderPDF(pdfData);
                      toast.dismiss('pdf-send');

                      // Abrir el PDF combinado (OP + comprobantes adjuntos)
                      window.open(url, '_blank');

                      if (pagoDetalleAttachments.length > 0) {
                        toast.success(`PDF generado con ${pagoDetalleAttachments.length} comprobante${pagoDetalleAttachments.length > 1 ? 's' : ''} incluido${pagoDetalleAttachments.length > 1 ? 's' : ''}`);
                      } else {
                        toast.success('PDF generado');
                      }
                    } catch (error) {
                      console.error('Error generando PDF:', error);
                      toast.dismiss('pdf-send');
                      toast.error('Error al generar el PDF');
                    }
                  }}>
                    <Send className="w-3.5 h-3.5 mr-2" />
                    Enviar OP
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal para ver PDF de OP usando FileViewer */}
      {pdfUrl && (
        <FileViewer
          url={pdfUrl}
          fileName={`OP-${pagoDetalleSeleccionado?.id || ''}.pdf`}
          open={isPdfModalOpen}
          onClose={() => {
            setIsPdfModalOpen(false);
            setPdfUrl(null);
          }}
        />
      )}

      {/* Modal para registrar pago - Componente compartido */}
      <RegistrarPagoModal
        open={isPagoModalOpen}
        onOpenChange={(open) => {
          setIsPagoModalOpen(open);
          // Limpiar selección al cerrar el modal
          if (!open) setSelectedFacturas([]);
        }}
        proveedorId={Number(proveedorId)}
        proveedorNombre={proveedor?.nombre || ''}
        proveedorBankData={{
          cbu: proveedor?.cbu,
          aliasCbu: proveedor?.aliasCbu,
          banco: proveedor?.banco,
          tipoCuenta: proveedor?.tipoCuenta,
          numeroCuenta: proveedor?.numeroCuenta,
          cuit: proveedor?.cuit,
        }}
        preSelectedInvoices={selectedFacturas}
        onPaymentComplete={() => {
          setSelectedFacturas([]);
          loadProveedorData(proveedorId);
        }}
      />

      {/* Modal para cargar remito */}
      {facturaIngresoStock && (
        <CargarRemitoDesdeFacturaModal
          open={isIngresoModalOpen}
          onOpenChange={(open) => {
            setIsIngresoModalOpen(open);
            if (!open) setFacturaIngresoStock(null);
          }}
          factura={facturaIngresoStock}
          onSuccess={() => {
            loadProveedorData(proveedorId);
          }}
        />
      )}

      {/* Quick View de Factura con Items */}
      {quickViewFactura && (
        <div
          className={`fixed z-50 bg-background border rounded-lg shadow-xl flex flex-col animate-in fade-in-0 zoom-in-95 slide-in-from-right-2 transition-all duration-200 ${
            quickViewExpanded ? 'w-[600px] max-h-[90vh]' : 'w-[400px] max-h-[80vh]'
          }`}
          style={{
            top: quickViewExpanded
              ? Math.min(quickViewPosition?.y || 50, window.innerHeight - 600)
              : Math.min(quickViewPosition?.y || 100, window.innerHeight - 500),
            left: quickViewExpanded
              ? Math.max((quickViewPosition?.x || 100) - 100, 20)
              : Math.max(quickViewPosition?.x || 100, 20),
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Factura {quickViewFactura.numero}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setQuickViewExpanded(!quickViewExpanded)}
                title={quickViewExpanded ? 'Contraer' : 'Expandir'}
              >
                {quickViewExpanded ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem
                    onClick={() => {
                      abrirEditarFactura(quickViewFactura);
                      setQuickViewFactura(null);
                      setQuickViewDetails(null);
                      setQuickViewExpanded(false);
                    }}
                  >
                    <Edit className="w-3.5 h-3.5 mr-2" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setSelectedFacturas([quickViewFactura.id]);
                      setIsPagoModalOpen(true);
                      setQuickViewFactura(null);
                      setQuickViewDetails(null);
                      setQuickViewExpanded(false);
                    }}
                  >
                    <CreditCard className="w-3.5 h-3.5 mr-2" />
                    Pagar
                  </DropdownMenuItem>
                  {!quickViewFactura.ingresoConfirmado && (
                    <DropdownMenuItem
                      onClick={() => {
                        abrirCargarRemito(quickViewFactura);
                        setQuickViewFactura(null);
                        setQuickViewDetails(null);
                        setQuickViewExpanded(false);
                      }}
                    >
                      <Truck className="w-3.5 h-3.5 mr-2" />
                      Cargar Remito
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      handleCrearNcaDesdeFactura(quickViewFactura);
                      setQuickViewFactura(null);
                      setQuickViewDetails(null);
                      setQuickViewExpanded(false);
                    }}
                  >
                    <FileText className="w-3.5 h-3.5 mr-2" />
                    Crear NCA
                  </DropdownMenuItem>
                  {quickViewFactura.ingresoConfirmado && (
                    <DropdownMenuItem
                      onClick={() => {
                        handleCrearDevolucionDesdeFactura(quickViewFactura);
                        setQuickViewFactura(null);
                        setQuickViewDetails(null);
                        setQuickViewExpanded(false);
                      }}
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-2" />
                      Crear Devolucion
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => {
                      abrirEliminarFactura(quickViewFactura);
                      setQuickViewFactura(null);
                      setQuickViewDetails(null);
                      setQuickViewExpanded(false);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  setQuickViewFactura(null);
                  setQuickViewDetails(null);
                  setQuickViewExpanded(false);
                }}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Content - scrollable */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* Info básica */}
            <div className={`grid gap-2 ${quickViewExpanded ? 'grid-cols-6' : 'grid-cols-4'}`}>
              <div>
                <p className="text-[10px] text-muted-foreground">Tipo</p>
                <Badge variant="outline" className="text-[10px] mt-0.5">{quickViewFactura.tipo}</Badge>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Estado</p>
                <div className="mt-0.5 flex items-center gap-1">
                  {getEstadoBadge(quickViewFactura.estado)}
                  {quickViewFactura.ingresoConfirmado && (
                    <span className="inline-flex items-center text-[10px] text-green-600 bg-green-50 dark:bg-green-900/20 px-1 py-0.5 rounded" title="Stock ingresado">
                      <Truck className="w-3 h-3" />
                    </span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Emisión</p>
                <p className="text-xs font-medium">{formatDate(quickViewFactura.fecha)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Venc.</p>
                <p className="text-xs font-medium">
                  {quickViewFactura.vencimiento ? formatDate(quickViewFactura.vencimiento) : '-'}
                </p>
              </div>
              {quickViewExpanded && (
                <>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Total</p>
                    <p className="text-xs font-semibold">{formatCurrency(quickViewFactura.total)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Saldo</p>
                    <p className={`text-xs font-semibold ${quickViewFactura.saldo > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(quickViewFactura.saldo)}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Items/Productos */}
            <div className="h-px bg-border" />
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Package className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-[10px] font-medium text-muted-foreground uppercase">
                  Items / Productos
                  {quickViewDetails?.items?.length ? ` (${quickViewDetails.items.length})` : ''}
                </p>
              </div>
              {quickViewLoading ? (
                <div className="text-center py-4">
                  <p className="text-xs text-muted-foreground">Cargando items...</p>
                </div>
              ) : quickViewDetails && quickViewDetails.items && quickViewDetails.items.length > 0 ? (
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-[10px] font-medium py-1.5 px-2">Item</TableHead>
                        <TableHead className="text-[10px] font-medium py-1.5 px-2 w-[60px] text-right">Cant.</TableHead>
                        <TableHead className="text-[10px] font-medium py-1.5 px-2 w-[80px] text-right">Precio</TableHead>
                        <TableHead className="text-[10px] font-medium py-1.5 px-2 w-[80px] text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quickViewDetails.items.map((item) => (
                        <TableRow key={item.id} className="hover:bg-muted/20">
                          <TableCell className="text-[10px] py-1.5 px-2">
                            <span className={quickViewExpanded ? '' : 'line-clamp-1'}>
                              {item.descripcion || item.supplierItem?.nombre || '-'}
                            </span>
                            {item.supplierItem?.codigoProveedor && !item.supplierItem.codigoProveedor.startsWith('COT-GEN') && (
                              <span className="block text-[9px] text-muted-foreground mt-0.5">
                                Cod: {item.supplierItem.codigoProveedor}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-[10px] py-1.5 px-2 text-right whitespace-nowrap">
                            {item.cantidad} {item.unidad}
                          </TableCell>
                          <TableCell className="text-[10px] py-1.5 px-2 text-right">
                            {formatCurrency(item.precioUnitario)}
                          </TableCell>
                          <TableCell className="text-[10px] py-1.5 px-2 text-right font-medium">
                            {formatCurrency(item.subtotal)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-3 bg-muted/20 rounded-md">
                  <p className="text-[10px] text-muted-foreground">Sin items registrados</p>
                </div>
              )}
            </div>

            {/* Totales - solo si no está expandido (ya se muestra arriba) */}
            {!quickViewExpanded && (
              <>
                <div className="h-px bg-border" />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Total</p>
                    <p className="text-sm font-semibold">{formatCurrency(quickViewFactura.total)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Saldo</p>
                    <p className={`text-sm font-semibold ${quickViewFactura.saldo > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(quickViewFactura.saldo)}
                    </p>
                  </div>
                </div>
              </>
            )}
            {quickViewFactura.saldo > 0 && quickViewFactura.vencimiento && (
              <>
                <div className="h-px bg-border" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Días hasta vencimiento</p>
                  {(() => {
                    const diasInfo = getDiasVencimiento(quickViewFactura.vencimiento, quickViewFactura.saldo);
                    if (!diasInfo) return <p className="text-xs">-</p>;
                    return (
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${diasInfo.color}`}>
                        {diasInfo.texto}
                      </span>
                    );
                  })()}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Backdrop para cerrar Quick View */}
      {quickViewFactura && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setQuickViewFactura(null);
            setQuickViewDetails(null);
            setQuickViewExpanded(false);
          }}
        />
      )}

      {/* Modal NCA/NC desde factura */}
      {ncaFacturaData && (
        <NcaFromFacturaModal
          open={ncaModalOpen}
          onClose={() => {
            setNcaModalOpen(false);
            setNcaFacturaData(null);
          }}
          onSuccess={() => {
            loadProveedorData(proveedorId);
            loadNotasCredito(proveedorId);
          }}
          facturaId={ncaFacturaData.facturaId}
          facturaNumero={ncaFacturaData.facturaNumero}
          proveedorId={ncaFacturaData.proveedorId}
          proveedorNombre={ncaFacturaData.proveedorNombre}
          items={ncaFacturaData.items}
          totalFactura={ncaFacturaData.totalFactura}
          ingresoConfirmado={ncaFacturaData.ingresoConfirmado}
          facturaDocType={ncaFacturaData.facturaDocType}
          onCrearDevolucion={() => {
            // Cerrar NCA modal y abrir modal de devolución
            setNcaModalOpen(false);
            // Preparar datos para devolución
            setDevolucionFacturaData({
              facturaId: ncaFacturaData.facturaId,
              facturaNumero: ncaFacturaData.facturaNumero,
              proveedorId: ncaFacturaData.proveedorId,
              proveedorNombre: ncaFacturaData.proveedorNombre,
              docType: ncaFacturaData.facturaDocType,
              items: ncaFacturaData.items.map((item: any) => ({
                id: item.id,
                supplierItemId: item.itemId,
                descripcion: item.descripcion,
                cantidad: item.cantidad,
                unidad: item.unidad,
                precioUnitario: item.precioUnitario,
              })),
            });
            setDevolucionModalOpen(true);
          }}
        />
      )}

      {/* Modal Devolucion desde factura */}
      {devolucionFacturaData && (
        <DevolucionFromDocumentModal
          open={devolucionModalOpen}
          onClose={() => {
            setDevolucionModalOpen(false);
            setDevolucionFacturaData(null);
          }}
          onSuccess={() => {
            loadProveedorData(proveedorId);
            loadRecepciones(proveedorId);
          }}
          sourceType="factura"
          sourceId={devolucionFacturaData.facturaId}
          sourceNumero={devolucionFacturaData.facturaNumero}
          proveedorId={devolucionFacturaData.proveedorId}
          proveedorNombre={devolucionFacturaData.proveedorNombre}
          items={devolucionFacturaData.items}
          docType={devolucionFacturaData.docType}
        />
      )}

      {/* Modal de Relaciones de Documento */}
      {relacionesFacturaData && (
        <RelacionesDocumentoModal
          open={relacionesModalOpen}
          onClose={() => {
            setRelacionesModalOpen(false);
            setRelacionesFacturaData(null);
          }}
          facturaId={relacionesFacturaData.facturaId}
          facturaNumero={relacionesFacturaData.facturaNumero}
          facturaTotal={relacionesFacturaData.facturaTotal}
          proveedorId={relacionesFacturaData.proveedorId}
          facturaDocType={relacionesFacturaData.facturaDocType}
        />
      )}

      {/* Modal de Detalle de NCA/NC */}
      <Dialog open={ncaDetalleOpen} onOpenChange={setNcaDetalleOpen}>
        <DialogContent className="max-w-lg p-6">
          {ncaDetalleData && (() => {
            const isT2Doc = ncaDetalleData.tipoNca?.startsWith('NC_') || ncaDetalleData.docType === 'T2';
            const docLabel = isT2Doc ? 'NC' : 'NCA';
            const isCredito = ncaDetalleData.tipo === 'NCA';
            const tipoSubtipo = ncaDetalleData.tipoNca?.replace('NCA_', '').replace('NC_', '').replace('_', ' ') || '';

            return (
              <>
                <DialogHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${isCredito ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                        <Receipt className={`h-5 w-5 ${isCredito ? 'text-green-600' : 'text-red-600'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-xs ${isCredito ? 'text-green-600 border-green-300' : 'text-red-600 border-red-300'}`}>
                            {docLabel}
                          </Badge>
                          {isT2Doc && (
                            <Badge variant="secondary" className="text-[10px]">T2</Badge>
                          )}
                        </div>
                        <DialogTitle className="text-lg mt-1">{ncaDetalleData.numero}</DialogTitle>
                      </div>
                    </div>
                    <Badge variant={ncaDetalleData.aplicada ? 'default' : 'secondary'} className="text-xs">
                      {ncaDetalleData.aplicada ? 'Aplicada' : (ncaDetalleData.estado || 'Pendiente')}
                    </Badge>
                  </div>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Importe */}
                  <div className="p-4 rounded-lg bg-muted/30 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Importe</p>
                    <p className={`text-2xl font-bold ${isCredito ? 'text-green-600' : 'text-red-600'}`}>
                      {isCredito ? '-' : '+'}{formatCurrency(ncaDetalleData.monto)}
                    </p>
                  </div>

                  {/* Info grid */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Fecha</p>
                      <p className="font-medium">{formatDate(ncaDetalleData.fecha)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Tipo</p>
                      <p className="font-medium capitalize">{tipoSubtipo || docLabel}</p>
                    </div>
                  </div>

                  {/* Factura relacionada */}
                  {ncaDetalleData.facturaRelacionada && (
                    <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Documento relacionado</p>
                        <p className="font-medium text-sm">{ncaDetalleData.facturaRelacionada}</p>
                      </div>
                    </div>
                  )}

                  {/* Devolución */}
                  {ncaDetalleData.purchaseReturn && (
                    <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
                      <RefreshCw className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Devolución</p>
                        <p className="font-medium text-sm">{ncaDetalleData.purchaseReturn.numero}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {ncaDetalleData.purchaseReturn.estado}
                      </Badge>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-4">
                  <Button variant="outline" size="sm" onClick={() => setNcaDetalleOpen(false)}>
                    Cerrar
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
