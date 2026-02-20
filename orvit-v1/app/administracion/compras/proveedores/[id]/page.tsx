'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  ArrowLeft,
  Edit,
  Building2,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Calendar,
  FileText,
  DollarSign,
  Info,
  Trash2,
  Check,
  Search,
  Filter,
  Download,
  Printer,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Clock,
  ChevronDown,
  ArrowUpDown,
  Receipt,
  Banknote,
  CircleDollarSign,
  FileWarning,
  MoreHorizontal,
  Eye,
  X,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  FileDown,
  ClipboardList,
  ExternalLink,
  ChevronUp,
  SlidersHorizontal,
  History,
  ArrowRight,
  Package,
  Copy,
  MessageCircle,
  Link2,
  ShoppingCart,
  Truck,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
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
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import ComprobanteFormModal from '@/components/compras/comprobante-form-modal';
import { OrdenCompraFormModal } from '@/components/compras/orden-compra-form-modal';
import { OrdenesCompraList } from '@/components/compras/ordenes-compra-list';
import { generatePaymentOrderPDF, PaymentOrderPDFData } from '@/lib/pdf/payment-order-pdf';
import { generateAccountStatementPDF, printAccountStatement, AccountStatementPDFData } from '@/lib/pdf/account-statement-pdf';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import { ProveedorModal } from '@/components/compras/proveedor-modal';
import ProveedorCuentaCorriente from '@/components/compras/proveedor-cuenta-corriente';
import { RecepcionDetalleModal } from '@/components/compras/recepcion-detalle-modal';
import { useViewMode } from '@/contexts/ViewModeContext';

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
  total: number;
  saldo: number;
  estado: 'pendiente' | 'pagada' | 'parcial' | 'vencida';
  vencimiento?: Date;
  docType?: 'T1' | 'T2';
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

export default function ProveedorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mode: viewMode, isLoading: viewModeLoading } = useViewMode();
  const [proveedor, setProveedor] = useState<Proveedor | null>(null);
  const [facturas, setFacturas] = useState<FacturaCompra[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [ordenesPago, setOrdenesPago] = useState<any[]>([]);
  
  // Deduplicar pagos antes de renderizar - usando una clave única que incluye fecha y monto
  const pagosUnicosRender = useMemo(() => {
    // Crear un Map usando una clave única que combine id, fecha y monto para evitar duplicados reales
    const pagosMap = new Map<string, Pago>();
    
    pagos.forEach(pago => {
      // Crear una clave única basada en id, fecha y monto
      const uniqueKey = `${pago.id}-${pago.fecha.getTime()}-${pago.monto}`;
      if (!pagosMap.has(uniqueKey)) {
        pagosMap.set(uniqueKey, pago);
      }
    });
    
    const unicos = Array.from(pagosMap.values());
    
    if (unicos.length !== pagos.length) {
      console.warn('⚠️ Se encontraron pagos duplicados:', { 
        total: pagos.length, 
        unicos: unicos.length,
        pagos: pagos.map(p => ({ id: p.id, fecha: p.fecha, monto: p.monto }))
      });
    }
    
    console.log('🔄 [RENDER] Pagos únicos para renderizar:', unicos.length, 'de', pagos.length);
    
    return unicos;
  }, [pagos]);
  const [anticipoProveedor, setAnticipoProveedor] = useState<number>(0);
  const [anticiposDisponibles, setAnticiposDisponibles] = useState<
    { id: string; fecha: Date; monto: number }[]
  >([]);
  const [anticiposSeleccionados, setAnticiposSeleccionados] = useState<string[]>([]);
  const [pagoDetalleSeleccionado, setPagoDetalleSeleccionado] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('general');
  const [isPagoModalOpen, setIsPagoModalOpen] = useState(false);
  const [isSubmittingPago, setIsSubmittingPago] = useState(false);
  const [isDetallePagoOpen, setIsDetallePagoOpen] = useState(false);
  const [isBancoModalOpen, setIsBancoModalOpen] = useState(false);
  const [isChequesModalOpen, setIsChequesModalOpen] = useState(false);
  const [selectedFacturas, setSelectedFacturas] = useState<string[]>([]);
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
  const [isFacturaEditModalOpen, setIsFacturaEditModalOpen] = useState(false);
  const [facturaEditandoId, setFacturaEditandoId] = useState<string | null>(null);
  const [isNuevoComprobanteModalOpen, setIsNuevoComprobanteModalOpen] = useState(false);
  const [isNuevaOCModalOpen, setIsNuevaOCModalOpen] = useState(false);

  // Estados para filtros de Cuenta Corriente
  const [ccSearchTerm, setCcSearchTerm] = useState('');
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
  const [isOCModalOpen, setIsOCModalOpen] = useState(false);
  const [ordenesCompra, setOrdenesCompra] = useState<Array<{
    id: string;
    numero: string;
    fecha: string;
    estado: string;
    total: number;
    itemsCount: number;
  }>>([]);
  const [loadingOC, setLoadingOC] = useState(false);

  // Estados para Items del Proveedor (Tab Items)
  const [itemsProveedor, setItemsProveedor] = useState<Array<{
    id: number;
    nombre: string;
    descripcion?: string;
    codigoProveedor?: string;
    unidad: string;
    precioUnitario?: number;
    supply?: { id: number; name: string; unit_measure: string };
    priceHistory?: Array<{
      id: number;
      precioUnitario: number;
      fecha: string;
      comprobante?: { id: number; numeroSerie?: string; numeroFactura?: string; docType?: 'T1' | 'T2' };
    }>;
    stockLocations?: Array<{
      id: number;
      descripcionItem?: string;
      codigoPropio?: string;
      codigoProveedor?: string;
    }>;
    ultimaCompra?: string;
    precioHistorico?: number;
    variacionPorcentaje?: number;
    variacionAbsoluta?: number;
    cantidadCompras?: number;
  }>>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemsSearchTerm, setItemsSearchTerm] = useState('');
  const [itemsSortField, setItemsSortField] = useState<'nombre' | 'precioUnitario' | 'ultimaCompra' | 'variacion'>('nombre');
  const [itemsSortDirection, setItemsSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedItemDetalle, setSelectedItemDetalle] = useState<typeof itemsProveedor[0] | null>(null);
  const [isItemDetalleOpen, setIsItemDetalleOpen] = useState(false);
  // Filtros avanzados para Items
  const [itemsFilterVariacion, setItemsFilterVariacion] = useState<'todos' | 'subio' | 'bajo' | 'alto'>('todos');
  const [itemsShowFilters, setItemsShowFilters] = useState(false);
  // Modal: filtro de fechas y calculadora
  const [modalDateRange, setModalDateRange] = useState<'todos' | '3m' | '6m' | '12m'>('todos');
  const [calculadoraCantidad, setCalculadoraCantidad] = useState<string>('1');
  const [itemNota, setItemNota] = useState<string>('');

  // Estados para Agregar Item
  const [isNuevoItemOpen, setIsNuevoItemOpen] = useState(false);
  const [isSubmittingItem, setIsSubmittingItem] = useState(false);
  const [nuevoItemForm, setNuevoItemForm] = useState({
    nombre: '',
    descripcion: '',
    codigoProveedor: '',
    unidad: 'UN',
    precioUnitario: '',
  });

  // Estados para Recepciones (Tab Recepciones)
  const [recepciones, setRecepciones] = useState<Array<{
    id: number;
    numero: string;
    fechaRecepcion: string;
    numeroRemito?: string;
    estado: string;
    purchaseOrder?: { id: number; numero: string };
    factura?: { id: number; purchaseOrder?: { id: number; numero: string } };
    warehouse?: { id: number; nombre: string };
    itemsCount: number;
    adjuntos?: string[];
    firma?: string;
  }>>([]);
  const [loadingRecepciones, setLoadingRecepciones] = useState(false);
  const [recepcionVistaModal, setRecepcionVistaModal] = useState<{
    id: number;
    adjuntos?: string[];
    firma?: string;
  } | null>(null);
  const [recepcionDetalleModalOpen, setRecepcionDetalleModalOpen] = useState(false);
  const [recepcionDetalleId, setRecepcionDetalleId] = useState<number | null>(null);

  // Estados para Devoluciones (Tab Devoluciones)
  const [devoluciones, setDevoluciones] = useState<Array<{
    id: number;
    numero: string;
    estado: string;
    tipo: string;
    fechaSolicitud: string;
    fechaEnvio?: string;
    motivo: string;
    goodsReceipt?: { id: number; numero: string };
    warehouse?: { id: number; nombre: string };
    _count?: { items: number; creditNotes: number };
    docType?: string;
  }>>([]);
  const [loadingDevoluciones, setLoadingDevoluciones] = useState(false);

  // Cargar órdenes de compra del proveedor
  const loadOrdenesCompra = async (proveedorId: string) => {
    setLoadingOC(true);
    try {
      const response = await fetch(`/api/compras/ordenes-compra?proveedorId=${proveedorId}`);
      if (response.ok) {
        const result = await response.json();
        // La API devuelve { data: [...], pagination: {...} }
        const ordenes = result.data || result || [];
        setOrdenesCompra(ordenes.map((oc: any) => ({
          id: String(oc.id),
          numero: oc.numero || `OC-${oc.id}`,
          fecha: oc.fechaEmision || oc.fecha || oc.created_at,
          estado: oc.estado || 'pendiente',
          total: Number(oc.total) || 0,
          itemsCount: oc._count?.items || oc.items?.length || 0,
        })));
      }
    } catch (error) {
      console.error('Error loading OC:', error);
    } finally {
      setLoadingOC(false);
    }
  };

  // Cargar items del proveedor
  const loadItemsProveedor = async (proveedorId: string) => {
    setLoadingItems(true);
    try {
      // Pasar viewMode para filtrar estadísticas por T1/T2
      const url = new URL(`/api/compras/proveedores/${proveedorId}/items`, window.location.origin);
      url.searchParams.set('viewMode', viewMode);
      const response = await fetch(url.toString());
      if (response.ok) {
        const data = await response.json();
        setItemsProveedor(data || []);
      }
    } catch (error) {
      console.error('Error loading items:', error);
    } finally {
      setLoadingItems(false);
    }
  };

  // Crear nuevo item del proveedor
  const handleCrearItem = async () => {
    if (!nuevoItemForm.nombre.trim()) {
      toast.error('El nombre del item es requerido');
      return;
    }

    setIsSubmittingItem(true);
    try {
      const response = await fetch(`/api/compras/proveedores/${params.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nuevoItemForm.nombre.trim(),
          descripcion: nuevoItemForm.descripcion.trim() || null,
          codigoProveedor: nuevoItemForm.codigoProveedor.trim() || null,
          unidad: nuevoItemForm.unidad || 'UN',
          precioUnitario: nuevoItemForm.precioUnitario ? parseFloat(nuevoItemForm.precioUnitario) : null,
        }),
      });

      if (response.ok) {
        toast.success('Item creado correctamente');
        setIsNuevoItemOpen(false);
        setNuevoItemForm({ nombre: '', descripcion: '', codigoProveedor: '', unidad: 'UN', precioUnitario: '' });
        // Recargar items
        loadItemsProveedor(params.id as string);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al crear el item');
      }
    } catch (error) {
      console.error('Error creating item:', error);
      toast.error('Error al crear el item');
    } finally {
      setIsSubmittingItem(false);
    }
  };

  // Cargar recepciones del proveedor
  const loadRecepcionesProveedor = async (proveedorId: string) => {
    setLoadingRecepciones(true);
    try {
      const response = await fetch(`/api/compras/recepciones?proveedorId=${proveedorId}`);
      if (response.ok) {
        const data = await response.json();
        setRecepciones((data.data || []).map((rec: any) => ({
          id: rec.id,
          numero: rec.numero || `REC-${rec.id}`,
          fechaRecepcion: rec.fechaRecepcion,
          numeroRemito: rec.numeroRemito,
          estado: rec.estado || 'borrador',
          // OC viene directo de la recepción
          purchaseOrder: rec.purchaseOrder,
          factura: rec.factura,
          warehouse: rec.warehouse,
          itemsCount: rec._count?.items || 0,
          adjuntos: rec.adjuntos,
          firma: rec.firma,
        })));
      }
    } catch (error) {
      console.error('Error loading recepciones:', error);
    } finally {
      setLoadingRecepciones(false);
    }
  };

  // Cargar devoluciones del proveedor
  const loadDevolucionesProveedor = async (proveedorId: string) => {
    setLoadingDevoluciones(true);
    try {
      const response = await fetch(`/api/compras/devoluciones?proveedorId=${proveedorId}`);
      if (response.ok) {
        const data = await response.json();
        setDevoluciones((data.data || []).map((dev: any) => ({
          id: dev.id,
          numero: dev.numero,
          estado: dev.estado,
          tipo: dev.tipo,
          fechaSolicitud: dev.fechaSolicitud,
          fechaEnvio: dev.fechaEnvio,
          motivo: dev.motivo,
          goodsReceipt: dev.goodsReceipt,
          warehouse: dev.warehouse,
          _count: dev._count,
          docType: dev.docType,
        })));
      }
    } catch (error) {
      console.error('Error loading devoluciones:', error);
    } finally {
      setLoadingDevoluciones(false);
    }
  };

  // Función para aplicar filtro de período rápido
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

  // Filtrar y ordenar facturas
  const facturasFiltradas = useMemo(() => {
    let result = [...facturas];

    // Filtrar por búsqueda
    if (ccSearchTerm) {
      const term = ccSearchTerm.toLowerCase();
      result = result.filter(f =>
        f.numero.toLowerCase().includes(term)
      );
    }

    // Filtrar por estado
    if (ccEstadoFilter !== 'todos') {
      result = result.filter(f => f.estado === ccEstadoFilter);
    }

    // Filtrar solo pendientes (saldo > 0)
    if (ccSoloPendientes) {
      result = result.filter(f => f.saldo > 0);
    }

    // Filtrar por fecha desde
    if (ccFechaDesde) {
      const desde = new Date(ccFechaDesde);
      result = result.filter(f => new Date(f.fecha) >= desde);
    }

    // Filtrar por fecha hasta
    if (ccFechaHasta) {
      const hasta = new Date(ccFechaHasta);
      result = result.filter(f => new Date(f.fecha) <= hasta);
    }

    // Ordenar
    result.sort((a, b) => {
      let comparison = 0;
      switch (ccSortField) {
        case 'fecha':
          comparison = new Date(a.fecha).getTime() - new Date(b.fecha).getTime();
          break;
        case 'total':
          comparison = a.total - b.total;
          break;
        case 'saldo':
          comparison = a.saldo - b.saldo;
          break;
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

  // Paginación de facturas
  const facturasPaginadas = useMemo(() => {
    const start = (ccPageFacturas - 1) * ccItemsPerPage;
    return facturasFiltradas.slice(start, start + ccItemsPerPage);
  }, [facturasFiltradas, ccPageFacturas]);

  const totalPagesFacturas = Math.ceil(facturasFiltradas.length / ccItemsPerPage);

  // Filtrar pagos por búsqueda
  const pagosFiltrados = useMemo(() => {
    if (!ccSearchTerm) return pagosUnicosRender;
    const term = ccSearchTerm.toLowerCase();
    return pagosUnicosRender.filter(p =>
      p.facturaNumero?.toLowerCase().includes(term) ||
      p.metodo?.toLowerCase().includes(term)
    );
  }, [pagosUnicosRender, ccSearchTerm]);

  // Paginación de pagos
  const pagosPaginados = useMemo(() => {
    const start = (ccPagePagos - 1) * ccItemsPerPage;
    return pagosFiltrados.slice(start, start + ccItemsPerPage);
  }, [pagosFiltrados, ccPagePagos]);

  const totalPagesPagos = Math.ceil(pagosFiltrados.length / ccItemsPerPage);

  // Estadísticas adicionales
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

    const montoVencido = facturasVencidas.reduce((sum, f) => sum + f.saldo, 0);
    const montoProximoVencer = facturasProximasVencer.reduce((sum, f) => sum + f.saldo, 0);

    return {
      facturasVencidas: facturasVencidas.length,
      montoVencido,
      facturasProximasVencer: facturasProximasVencer.length,
      montoProximoVencer,
    };
  }, [facturas]);

  // Timeline de movimientos (facturas + pagos combinados cronológicamente)
  const timelineMovimientos = useMemo(() => {
    const movimientos: Array<{
      id: string;
      tipo: 'factura' | 'pago';
      fecha: Date;
      descripcion: string;
      monto: number;
      saldo?: number;
      estado?: string;
      numero?: string;
    }> = [];

    // Agregar facturas
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

    // Agregar pagos
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

    // Ordenar por fecha descendente (más reciente primero)
    return movimientos.sort((a, b) => b.fecha.getTime() - a.fecha.getTime()).slice(0, 10);
  }, [facturas, pagosUnicosRender]);

  // Filtrar y ordenar items del proveedor
  const itemsFiltradosOrdenados = useMemo(() => {
    let result = [...itemsProveedor];

    // Filtrar por búsqueda
    if (itemsSearchTerm) {
      const term = itemsSearchTerm.toLowerCase();
      result = result.filter(item =>
        item.nombre.toLowerCase().includes(term) ||
        item.codigoProveedor?.toLowerCase().includes(term) ||
        item.supply?.name.toLowerCase().includes(term)
      );
    }

    // Filtrar por variación
    if (itemsFilterVariacion !== 'todos') {
      result = result.filter(item => {
        const v = item.variacionPorcentaje || 0;
        switch (itemsFilterVariacion) {
          case 'subio': return v > 0;
          case 'bajo': return v < 0;
          case 'alto': return Math.abs(v) >= 10; // Variación alta = más del 10%
          default: return true;
        }
      });
    }

    // Ordenar
    result.sort((a, b) => {
      let comparison = 0;

      switch (itemsSortField) {
        case 'nombre':
          comparison = a.nombre.localeCompare(b.nombre);
          break;
        case 'precioUnitario':
          comparison = (a.precioUnitario || 0) - (b.precioUnitario || 0);
          break;
        case 'ultimaCompra':
          const fechaA = a.ultimaCompra ? new Date(a.ultimaCompra).getTime() : 0;
          const fechaB = b.ultimaCompra ? new Date(b.ultimaCompra).getTime() : 0;
          comparison = fechaA - fechaB;
          break;
        case 'variacion':
          comparison = (a.variacionPorcentaje || 0) - (b.variacionPorcentaje || 0);
          break;
      }

      return itemsSortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [itemsProveedor, itemsSearchTerm, itemsSortField, itemsSortDirection, itemsFilterVariacion]);

  // Limpiar filtros
  const limpiarFiltros = () => {
    setCcSearchTerm('');
    setCcEstadoFilter('todos');
    setCcFechaDesde('');
    setCcFechaHasta('');
    setCcSoloPendientes(false);
    setCcPeriodo('todos');
    setCcPageFacturas(1);
    setCcPagePagos(1);
  };

  const hayFiltrosActivos = ccSearchTerm || ccEstadoFilter !== 'todos' || ccFechaDesde || ccFechaHasta || ccSoloPendientes || ccPeriodo !== 'todos';

  // Generar datos para el PDF del estado de cuenta
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

  // Imprimir estado de cuenta
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

  // Generar PDF del historial de precios de un item
  const generarItemPriceHistoryPDF = () => {
    if (!selectedItemDetalle || !proveedor) return;

    const doc = new jsPDF('portrait', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 15;

    // Título
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Historial de Precios', pageWidth / 2, y, { align: 'center' });
    y += 8;

    // Subtítulo con nombre del item (preferir descripcionItem de stockLocations)
    const nombreItem = selectedItemDetalle.stockLocations?.[0]?.descripcionItem || selectedItemDetalle.nombre;
    const codigoItem = selectedItemDetalle.stockLocations?.[0]?.codigoProveedor || selectedItemDetalle.codigoProveedor;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(nombreItem, pageWidth / 2, y, { align: 'center' });
    y += 8;

    // Info del proveedor
    doc.setFontSize(10);
    doc.text(`Proveedor: ${proveedor.nombre}`, 15, y);
    y += 5;
    if (codigoItem) {
      doc.text(`Código: ${codigoItem}`, 15, y);
      y += 5;
    }
    doc.text(`Unidad: ${selectedItemDetalle.unidad || 'N/A'}`, 15, y);
    y += 5;
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-AR')}`, 15, y);
    y += 10;

    // Estadísticas resumen
    const history = selectedItemDetalle.priceHistory || [];
    if (history.length > 0) {
      const precios = history.map(h => Number(h.precioUnitario));
      const precioActual = precios[0] || 0;
      const precioMin = Math.min(...precios);
      const precioMax = Math.max(...precios);
      const precioAvg = precios.reduce((a, b) => a + b, 0) / precios.length;
      const precioInicial = precios[precios.length - 1] || precioActual;
      const variacionTotal = precioInicial > 0 ? ((precioActual - precioInicial) / precioInicial) * 100 : 0;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Resumen de Precios', 15, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Precio Actual: $${precioActual.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 15, y);
      doc.text(`Mínimo: $${precioMin.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 80, y);
      y += 5;
      doc.text(`Máximo: $${precioMax.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 15, y);
      doc.text(`Promedio: $${precioAvg.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 80, y);
      y += 5;
      doc.text(`Variación Total: ${variacionTotal > 0 ? '+' : ''}${variacionTotal.toFixed(1)}%`, 15, y);
      doc.text(`Total Compras: ${history.length}`, 80, y);
      y += 10;
    }

    // Tabla de historial
    const tableData = history.map((h, idx) => {
      const prev = history[idx + 1];
      const diff = prev ? Number(h.precioUnitario) - Number(prev.precioUnitario) : 0;
      const diffPercent = prev && Number(prev.precioUnitario) > 0
        ? (diff / Number(prev.precioUnitario)) * 100
        : 0;

      const comprobanteStr = h.comprobante
        ? `${h.comprobante.numeroSerie || ''}${h.comprobante.numeroSerie && h.comprobante.numeroFactura ? '-' : ''}${h.comprobante.numeroFactura || ''}${h.comprobante.docType === 'T2' ? ' (T2)' : ''}`
        : '-';

      return [
        new Date(h.fecha).toLocaleDateString('es-AR'),
        `$${Number(h.precioUnitario).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
        diff !== 0 ? `${diff > 0 ? '+' : ''}${diffPercent.toFixed(1)}%` : '-',
        comprobanteStr,
      ];
    });

    (doc as any).autoTable({
      startY: y,
      head: [['Fecha', 'Precio Unitario', 'Variación', 'Comprobante']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 40, halign: 'right' },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 50 },
      },
    });

    // Descargar
    doc.save(`historial-precios-${nombreItem.replace(/\s+/g, '-').toLowerCase()}.pdf`);
    toast.success('PDF generado correctamente');
  };

  // Cheques de terceros en cartera (por ahora mock / a conectar al backend de tesorería)
  type ChequeTercero = {
    id: string;
    numero: string;
    banco: string;
    titular: string;
    fechaVencimiento: string;
    importe: number;
    tipo: 'CHEQUE' | 'ECHEQ';
  };

  const [chequesCartera, setChequesCartera] = useState<ChequeTercero[]>([
    {
      id: 'ch1',
      numero: '00012345',
      banco: 'Banco Nación',
      titular: 'Cliente Ejemplo 1',
      fechaVencimiento: '2025-03-10',
      importe: 150000,
      tipo: 'CHEQUE',
    },
    {
      id: 'ch2',
      numero: '00054321',
      banco: 'Banco Provincia',
      titular: 'Cliente Ejemplo 2',
      fechaVencimiento: '2025-04-05',
      importe: 275000,
      tipo: 'ECHEQ',
    },
    {
      id: 'ch3',
      numero: '00123456',
      banco: 'Banco Galicia',
      titular: 'Cliente Ejemplo 3',
      fechaVencimiento: '2025-05-20',
      importe: 98000,
      tipo: 'CHEQUE',
    },
  ]);
  const [selectedCheques, setSelectedCheques] = useState<string[]>([]);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [facturaAEliminar, setFacturaAEliminar] = useState<FacturaCompra | null>(null);
  const [isDeleteFacturaOpen, setIsDeleteFacturaOpen] = useState(false);
  const [deleteFacturaLoading, setDeleteFacturaLoading] = useState(false);
  const [ordenPagoAEliminar, setOrdenPagoAEliminar] = useState<any | null>(null);
  const [isDeleteOrdenPagoOpen, setIsDeleteOrdenPagoOpen] = useState(false);
  const [deleteOrdenPagoLoading, setDeleteOrdenPagoLoading] = useState(false);
  const [isProveedorModalOpen, setIsProveedorModalOpen] = useState(false);

  // Para selección múltiple de facturas con Shift
  const [lastFacturaIndexClicked, setLastFacturaIndexClicked] = useState<number | null>(null);

  useEffect(() => {
    if (params.id) {
      loadProveedorData(params.id as string);
    }
  }, [params.id]);

  // Cargar OC cuando se abre el modal
  useEffect(() => {
    if (isOCModalOpen && proveedor?.id) {
      loadOrdenesCompra(proveedor.id);
    }
  }, [isOCModalOpen, proveedor?.id]);

  // Ref para trackear el último viewMode cargado
  const lastLoadedViewMode = useRef<string | null>(null);

  // Cargar datos según el tab activo y ViewMode
  useEffect(() => {
    if (!proveedor?.id || viewModeLoading) return;

    // Si cambió el viewMode, limpiar y recargar
    const viewModeChanged = lastLoadedViewMode.current !== null && lastLoadedViewMode.current !== viewMode;

    if (viewModeChanged) {
      // Limpiar datos primero
      setOrdenesCompra([]);
      setRecepciones([]);
      setItemsProveedor([]);
      setDevoluciones([]);
    }

    // Actualizar ref
    lastLoadedViewMode.current = viewMode;

    // Cargar según tab activo (siempre recargar si viewMode cambió)
    if (activeTab === 'items' && (itemsProveedor.length === 0 || viewModeChanged) && !loadingItems) {
      loadItemsProveedor(proveedor.id);
    }
    if (activeTab === 'ordenes' && (ordenesCompra.length === 0 || viewModeChanged) && !loadingOC) {
      loadOrdenesCompra(proveedor.id);
    }
    if (activeTab === 'recepciones' && (recepciones.length === 0 || viewModeChanged) && !loadingRecepciones) {
      loadRecepcionesProveedor(proveedor.id);
    }
    if (activeTab === 'devoluciones' && (devoluciones.length === 0 || viewModeChanged) && !loadingDevoluciones) {
      loadDevolucionesProveedor(proveedor.id);
    }
  }, [activeTab, proveedor?.id, viewMode, viewModeLoading]);

  // Preseleccionar factura(s) si viene(n) en query params
  useEffect(() => {
    const selectInvoice = searchParams.get('selectInvoice');
    const selectInvoices = searchParams.getAll('selectInvoices'); // Para múltiples facturas
    const tab = searchParams.get('tab');
    
    if (tab === 'cuenta-corriente') {
      setActiveTab('cuenta-corriente');
    }
    
    // Soporte para múltiples facturas (selectInvoices[]) y una sola (selectInvoice)
    const facturasIdsToSelect = selectInvoices.length > 0 ? selectInvoices : (selectInvoice ? [selectInvoice] : []);
    
    if (facturasIdsToSelect.length > 0 && facturas.length > 0) {
      // Verificar que las facturas existen y no están pagadas
      const facturasValidas = facturasIdsToSelect.filter(facturaId => {
        const factura = facturas.find(f => f.id === facturaId);
        return factura && (factura.estado === 'pendiente' || factura.estado === 'parcial');
      });
      
      if (facturasValidas.length > 0) {
        setSelectedFacturas(facturasValidas);
        
        // Abrir el modal de pago automáticamente si hay facturas seleccionadas
        setIsPagoModalOpen(true);
        
        // Limpiar los query params después de preseleccionar
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('selectInvoice');
        newUrl.searchParams.delete('selectInvoices');
        // Mantener el tab si está
        if (!tab) {
          newUrl.searchParams.delete('tab');
        }
        window.history.replaceState({}, '', newUrl.toString());
      }
    }
  }, [searchParams, facturas]);

  const loadProveedorData = async (proveedorId: string) => {
    setLoading(true);
    try {
      // Obtener proveedor desde el backend de compras (con caché del navegador)
      const response = await fetch(`/api/compras/proveedores/${proveedorId}`, {
        cache: 'force-cache'
      });
      if (!response.ok) {
        throw new Error('Error al obtener el proveedor');
      }
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

      // Optimización: Cargar facturas y órdenes de pago en paralelo
      // Usar timestamp para evitar caché y obtener datos frescos
      const timestamp = Date.now();
      const [facturasResponse, pagosResponse] = await Promise.all([
        fetch(`/api/compras/comprobantes?proveedorId=${proveedorId}&_t=${timestamp}`, {
          cache: 'no-store', // Forzar recarga sin caché
          headers: {
            'Cache-Control': 'no-cache'
          }
        }),
        fetch(`/api/compras/ordenes-pago?proveedorId=${proveedorId}&_t=${timestamp}`, {
          cache: 'no-store', // Forzar recarga sin caché
          headers: {
            'Cache-Control': 'no-cache'
          }
        })
      ]);

      if (facturasResponse.ok) {
        const comprobantes = await facturasResponse.json();
        const mappedFacturas: FacturaCompra[] = (comprobantes || []).map((c: any) => {
          const tipoLetra =
            (c.tipo && typeof c.tipo === 'string'
              ? (c.tipo.match(/([ABC])$/)?.[1] as 'A' | 'B' | 'C' | undefined)
              : 'A') || 'A';
          const prefijo = getPrefijoComprobante(c.tipo);
          return {
          id: String(c.id),
          numero: `${prefijo}${c.numeroSerie}-${c.numeroFactura}`,
          fecha: new Date(c.fechaEmision),
          tipo: tipoLetra,
          total: Number(c.total) || 0,
          // De momento no tenemos pagos cargados, así que el saldo es el total si no está pagada
          saldo: c.estado === 'pagada' ? 0 : Number(c.total) || 0,
          estado: c.estado as 'pendiente' | 'pagada' | 'parcial' | 'vencida',
          vencimiento: c.fechaVencimiento ? new Date(c.fechaVencimiento) : undefined,
          };
        });
        setFacturas(mappedFacturas);
      } else {
        setFacturas([]);
      }

      // Procesar órdenes de pago
      if (pagosResponse.ok) {
        const ordenes = await pagosResponse.json();
        console.log('📦 [LOAD] Órdenes recibidas en loadProveedorData:', ordenes?.length || 0);

        // Eliminar duplicados en las órdenes antes de procesar
        const ordenesUnicas = Array.from(
          new Map((ordenes || []).map((o: any) => [o.id, o])).values()
        );
        console.log('✅ [LOAD] Órdenes únicas después de deduplicar:', ordenesUnicas.length);

        // Calcular anticipo total y lista de anticipos disponibles
        const anticipos = ordenesUnicas
          .filter((o: any) => Number(o.anticipo || 0) > 0)
          .map((o: any) => ({
            id: String(o.id),
            fecha: new Date(o.fechaPago),
            monto: Number(o.anticipo || 0),
          }));

        const anticipoTotal = anticipos.reduce(
          (sum: number, a) => sum + a.monto,
          0
        );
        setAnticipoProveedor(anticipoTotal);
        setAnticiposDisponibles(anticipos);

        // Mapear pagos y eliminar duplicados por ID
        const mappedPagos: Pago[] = ordenesUnicas.map((o: any) => {
          const recibos = o.recibos || [];
          const primeraFactura = recibos[0]?.receipt;
          const facturaNumero = !primeraFactura
            ? '-'
            : recibos.length > 1
              ? 'Varias facturas'
              : `${primeraFactura.numeroSerie}-${primeraFactura.numeroFactura}`;

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
        
        // Eliminar duplicados por ID - usando clave única más robusta
        const pagosMap = new Map<string, Pago>();
        mappedPagos.forEach(p => {
          const uniqueKey = `${p.id}-${p.fecha.getTime()}-${p.monto}`;
          if (!pagosMap.has(uniqueKey)) {
            pagosMap.set(uniqueKey, p);
          }
        });
        const pagosUnicos = Array.from(pagosMap.values());
        
        console.log('📊 [LOAD] Pagos únicos cargados:', pagosUnicos.length, 'de', mappedPagos.length);
        console.log('🔑 [LOAD] IDs de pagos:', pagosUnicos.map(p => p.id));
        
        setPagos(pagosUnicos);
        setOrdenesPago(ordenesUnicas || []);
      } else {
        console.warn('⚠️ [LOAD] Error al cargar órdenes de pago:', pagosResponse.status, pagosResponse.statusText);
        // NO limpiar pagos si hay un error - mantener los que ya están
        // setPagos([]);
        // setOrdenesPago([]);
        // setAnticipoProveedor(0);
        // setAnticiposDisponibles([]);
        // setAnticiposSeleccionados([]);
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

  const toggleFacturaSeleccionada = (facturaId: string) => {
    setSelectedFacturas(prev =>
      prev.includes(facturaId)
        ? prev.filter(id => id !== facturaId)
        : [...prev, facturaId]
    );
  };

  // Selección de facturas con soporte para rango usando Shift
  const handleFacturaRowClick = (index: number, facturaId: string, event: React.MouseEvent) => {
    // Evitar que el click en el checkbox dispare dos veces
    if ((event.target as HTMLElement).closest('button,input')) {
      return;
    }

    setSelectedFacturas(prev => {
      let next = [...prev];

      // Si se mantiene Shift y hay una última fila registrada, seleccionar rango
      if (event.shiftKey && lastFacturaIndexClicked !== null) {
        const start = Math.min(lastFacturaIndexClicked, index);
        const end = Math.max(lastFacturaIndexClicked, index);
        const idsRango = facturas.slice(start, end + 1).map(f => f.id);
        const yaTodosSeleccionados = idsRango.every(id => next.includes(id));

        if (yaTodosSeleccionados) {
          // Si todos ya estaban seleccionados, los desmarcamos
          next = next.filter(id => !idsRango.includes(id));
        } else {
          // Si no, los agregamos todos
          idsRango.forEach(id => {
            if (!next.includes(id)) next.push(id);
          });
        }
      } else {
        // Click simple: toggle solo esa factura
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

  const totalSeleccionado = facturas
    .filter(f => selectedFacturas.includes(f.id))
    .reduce((sum, f) => sum + f.saldo, 0);

  // Normaliza un string de monto (puede venir con puntos) a número
  const parseMonto = (value: string) => {
    if (!value) return 0;
    // Dejamos solo dígitos para que "170.000" => "170000"
    const soloDigitos = value.replace(/\D/g, '');
    if (!soloDigitos) return 0;
    return parseFloat(soloDigitos);
  };

  // Total del pago = suma de todos los medios de pago
  const totalPago =
    parseMonto(pagoForm.efectivo) +
    parseMonto(pagoForm.dolares) +
    parseMonto(pagoForm.transferencia) +
    parseMonto(pagoForm.chequesTerceros) +
    parseMonto(pagoForm.chequesPropios) +
    parseMonto(pagoForm.retIVA) +
    parseMonto(pagoForm.retGanancias) +
    parseMonto(pagoForm.retIngBrutos);
  // OJO: totalAnticiposSeleccionados se declara más abajo, antes de usarse en JSX.

  // Orden de navegación con Enter en los campos de medios de pago
  const pagoFieldOrder = [
    'pagoEfectivo',
    'pagoDolares',
    'pagoTransferencia',
    'pagoChTerceros',
    'pagoChPropios',
    'pagoRetIVA',
    'pagoRetGan',
    'pagoRetIngBru',
  ];

  const focusNextPagoField = (currentId: string) => {
    const idx = pagoFieldOrder.indexOf(currentId);
    if (idx === -1) return;
    const nextId = pagoFieldOrder[idx + 1];
    if (!nextId) return;
    const el = document.getElementById(nextId) as HTMLInputElement | null;
    if (el) {
      el.focus();
      if (typeof el.select === 'function') {
        el.select();
      }
    }
  };

  // Formatea un monto visualmente con puntos de miles: "170000" => "170.000"
  const formatMontoVisual = (value: string) => {
    if (!value) return '';
    const soloDigitos = value.replace(/\D/g, '');
    if (!soloDigitos) return '';
    return soloDigitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const handlePagoChange = (field: keyof typeof pagoForm, raw: string) => {
    // Mientras escribe, dejamos solo números (sin puntos)
    const soloDigitos = raw.replace(/\D/g, '');
    setPagoForm(prev => ({
      ...prev,
      [field]: soloDigitos,
    }));
  };

  const aplicarFormatoYPasar = (field: keyof typeof pagoForm, inputId: string) => {
    setPagoForm(prev => ({
      ...prev,
      [field]: formatMontoVisual(prev[field] || ''),
    }));
    focusNextPagoField(inputId);
  };

  const aplicarFormatoSolo = (field: keyof typeof pagoForm) => {
    setPagoForm(prev => ({
      ...prev,
      [field]: formatMontoVisual(prev[field] || ''),
    }));
  };

  // Total de cheques de terceros seleccionados
  const totalChequesSeleccionados = chequesCartera
    .filter(ch => selectedCheques.includes(ch.id))
    .reduce((sum, ch) => sum + ch.importe, 0);

  // Cheques seleccionados ordenados por fecha (más nuevo primero)
  const selectedChequesDetalle = chequesCartera
    .filter(ch => selectedCheques.includes(ch.id))
    .sort((a, b) => (a.fechaVencimiento < b.fechaVencimiento ? 1 : -1));

  // Filtros para el modal de cheques
  const [chequesFilters, setChequesFilters] = useState({
    texto: '',
    montoDesde: '',
    montoHasta: '',
    fechaDesdeInput: '',
    fechaHastaInput: '',
    fechaDesdeIso: '',
    fechaHastaIso: '',
  });

  // Estado para resaltar de forma especial los cheques marcados
  const [verMarcados, setVerMarcados] = useState(false);

  // Función que indica si un cheque cumple con los filtros actuales
  const chequeCumpleFiltros = (ch: ChequeTercero): boolean => {
    // Texto: busca en número, banco y titular
    if (chequesFilters.texto) {
      const t = chequesFilters.texto.toLowerCase();
      const hayTexto =
        ch.numero.toLowerCase().includes(t) ||
        ch.banco.toLowerCase().includes(t) ||
        ch.titular.toLowerCase().includes(t);
      if (!hayTexto) return false;
    }

    // Monto mínimo / máximo
    if (chequesFilters.montoDesde) {
      const min = parseFloat(chequesFilters.montoDesde.replace(/\D/g, '')) || 0;
      if (ch.importe < min) return false;
    }
    if (chequesFilters.montoHasta) {
      const max = parseFloat(chequesFilters.montoHasta.replace(/\D/g, '')) || 0;
      if (ch.importe > max) return false;
    }

    // Rango de fecha de vencimiento
    if (chequesFilters.fechaDesdeIso) {
      if (ch.fechaVencimiento < chequesFilters.fechaDesdeIso) return false;
    }
    if (chequesFilters.fechaHastaIso) {
      if (ch.fechaVencimiento > chequesFilters.fechaHastaIso) return false;
    }

    return true;
  };

  // Cantidad de cheques que cumplen el filtro (para mostrar info al usuario)
  const totalChequesQueCumplenFiltro = chequesCartera.filter(chequeCumpleFiltros).length;

  const toggleAnticipoSeleccionado = (id: string) => {
    setAnticiposSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const totalAnticiposSeleccionados = anticiposDisponibles
    .filter((a) => anticiposSeleccionados.includes(a.id))
    .reduce((sum, a) => sum + a.monto, 0);

  // Saldo a pagar teniendo en cuenta anticipos seleccionados
  const saldoSeleccionadoConAnticipos = Math.max(
    totalSeleccionado - totalAnticiposSeleccionados,
    0
  );

  // Diferencia entre lo que se paga y el saldo a pagar (puede ser negativa)
  const diferencia = totalPago - saldoSeleccionadoConAnticipos;

  // Helpers para fechas dd/mm/yyyy -> ISO (usamos año actual por defecto)
  const parseDDMMYYYYToISO = (value: string): string | null => {
    const clean = value.trim();
    if (!clean) return null;
    const parts = clean.split('/');
    if (parts.length < 2) return null;
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2] ? parts[2] : String(new Date().getFullYear());
    if (year.length !== 4) return null;
    return `${year}-${month}-${day}`;
  };

  const formatDateFilterInput = (value: string): string => {
    const clean = value.replace(/[^\d/]/g, '').trim();
    if (!clean) return '';
    const parts = clean.split('/');
    if (parts.length === 1) {
      return parts[0];
    }
    if (parts.length === 2) {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      return `${d}/${m}/${new Date().getFullYear()}`;
    }
    if (parts.length >= 3) {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
      return `${d}/${m}/${y}`;
    }
    return clean;
  };

  const handleFechaFiltroBlurOrEnter = (field: 'desde' | 'hasta') => {
    setChequesFilters(prev => {
      const keyInput = field === 'desde' ? 'fechaDesdeInput' : 'fechaHastaInput';
      const keyIso = field === 'desde' ? 'fechaDesdeIso' : 'fechaHastaIso';
      const formatted = formatDateFilterInput(prev[keyInput as keyof typeof prev] as string);
      const iso = formatted ? parseDDMMYYYYToISO(formatted) || '' : '';
      return {
        ...prev,
        [keyInput]: formatted,
        [keyIso]: iso,
      };
    });
  };

  // Sincroniza el total de cheques seleccionados con el campo "chequesTerceros"
  useEffect(() => {
    setPagoForm(prev => ({
      ...prev,
      chequesTerceros: totalChequesSeleccionados ? formatMontoVisual(String(totalChequesSeleccionados)) : '',
    }));
  }, [totalChequesSeleccionados]);

  const toggleChequeSeleccionado = (id: string) => {
    setSelectedCheques(prev =>
      prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]
    );
  };

  // Si se paga de más, la diferencia positiva se toma como anticipo
  const anticipo = Math.max(0, diferencia);

  const handleRegistrarPago = async () => {
    // Prevenir doble submit
    if (isSubmittingPago) {
      return;
    }

    if (selectedFacturas.length === 0) {
      toast.error('Seleccioná al menos una factura para registrar el pago');
      return;
    }
    if (totalPago <= 0) {
      toast.error('Ingresá al menos un importe en los medios de pago');
      return;
    }

    setIsSubmittingPago(true);
    try {
      const facturasSeleccionadas = facturas.filter(f => selectedFacturas.includes(f.id));
      const proveedorIdNumeric = Number(proveedor?.id ?? (params.id as string));

      // Anticipos seleccionados por el usuario
      const anticiposUsados = anticiposDisponibles.filter((a) =>
        anticiposSeleccionados.includes(a.id)
      );

      // Cheques de terceros seleccionados en esta orden
      const chequesUsados = chequesCartera
        .filter((ch) => selectedCheques.includes(ch.id))
        .map((ch) => ({
          tipo: ch.tipo,
          numero: ch.numero,
          banco: ch.banco,
          titular: ch.titular,
          fechaVencimiento: ch.fechaVencimiento,
          importe: ch.importe,
        }));

      const body = {
        proveedorId: proveedorIdNumeric,
        fechaPago: new Date().toISOString().slice(0, 10), // yyyy-mm-dd
        efectivo: parseMonto(pagoForm.efectivo),
        dolares: parseMonto(pagoForm.dolares),
        transferencia: parseMonto(pagoForm.transferencia),
        chequesTerceros: parseMonto(pagoForm.chequesTerceros),
        chequesPropios: parseMonto(pagoForm.chequesPropios),
        retIVA: parseMonto(pagoForm.retIVA),
        retGanancias: parseMonto(pagoForm.retGanancias),
        retIngBrutos: parseMonto(pagoForm.retIngBrutos),
        notas: pagoForm.notas || null,
        facturas: facturasSeleccionadas.map((f) => ({
          receiptId: f.id,
          montoAplicado: f.saldo, // por ahora aplica el saldo completo de cada factura
        })),
        anticiposUsados: anticiposUsados.map((a) => ({
          id: a.id,
          monto: a.monto,
        })),
        chequesUsados,
      };

      const resp = await fetch('/api/compras/ordenes-pago', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        console.error('[REGISTRAR PAGO] Error backend:', data);
        toast.error(data?.error || 'Error al registrar la orden de pago');
        setIsSubmittingPago(false);
        return;
      }

      const ordenCreada = await resp.json().catch(() => null);

      toast.success(
        `Orden de pago registrada por ${formatCurrency(totalPago)} sobre ${selectedFacturas.length} factura(s).` +
          (anticipo > 0 ? ` | Anticipo: ${formatCurrency(anticipo)}` : '')
      );

      // NO cerrar el modal todavía - esperar a que el usuario cierre el PDF
      // setIsPagoModalOpen(false);
      setSelectedFacturas([]);
      setPagoForm({
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
      setAnticiposSeleccionados([]);

      // Optimización: Recargar solo facturas y órdenes de pago en paralelo (más rápido que recargar todo)
      // El caché ya se invalida en el backend al crear la orden
      console.log('[REGISTRAR PAGO] Recargando datos después de crear orden...');
      const [facturasResponse, pagosResponse] = await Promise.all([
        fetch(`/api/compras/comprobantes?proveedorId=${proveedorIdNumeric}&_t=${Date.now()}`, {
          cache: 'no-store', // Forzar recarga sin caché
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        }),
        fetch(`/api/compras/ordenes-pago?proveedorId=${proveedorIdNumeric}&_t=${Date.now()}`, {
          cache: 'no-store', // Forzar recarga sin caché
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        })
      ]);
      
      console.log('[REGISTRAR PAGO] Respuestas recibidas:', {
        facturas: facturasResponse.ok,
        pagos: pagosResponse.ok
      });

      // Procesar facturas actualizadas
      if (facturasResponse.ok) {
        const comprobantes = await facturasResponse.json();
        const mappedFacturas: FacturaCompra[] = (comprobantes || []).map((c: any) => {
          const tipoLetra =
            (c.tipo && typeof c.tipo === 'string'
              ? (c.tipo.match(/([ABC])$/)?.[1] as 'A' | 'B' | 'C' | undefined)
              : 'A') || 'A';
          const prefijo = getPrefijoComprobante(c.tipo);
          return {
          id: String(c.id),
          numero: `${prefijo}${c.numeroSerie}-${c.numeroFactura}`,
          fecha: new Date(c.fechaEmision),
          tipo: tipoLetra,
          total: Number(c.total) || 0,
          // Calcular saldo: si está pagada saldo = 0, si está parcial o pendiente saldo = total (por ahora)
          // El saldo real debería calcularse desde los pagos, pero por ahora usamos el estado
          saldo: c.estado === 'pagada' ? 0 : Number(c.total) || 0,
          estado: c.estado as 'pendiente' | 'pagada' | 'parcial' | 'vencida',
          vencimiento: c.fechaVencimiento ? new Date(c.fechaVencimiento) : undefined,
          };
        });
        console.log('[REGISTRAR PAGO] Facturas actualizadas:', mappedFacturas.length);
        setFacturas(mappedFacturas);
      }

      // Procesar órdenes de pago actualizadas
      if (pagosResponse.ok) {
        const ordenes = await pagosResponse.json();
        console.log('📦 Órdenes recibidas:', ordenes?.length || 0, ordenes);
        
        // Eliminar duplicados en las órdenes antes de procesar
        const ordenesUnicas = Array.from(
          new Map((ordenes || []).map((o: any) => [o.id, o])).values()
        );
        console.log('✅ Órdenes únicas después de deduplicar:', ordenesUnicas.length);
        
        // Calcular anticipo total y lista de anticipos disponibles
        const anticipos = ordenesUnicas
          .filter((o: any) => Number(o.anticipo || 0) > 0)
          .map((o: any) => ({
            id: String(o.id),
            fecha: new Date(o.fechaPago),
            monto: Number(o.anticipo || 0),
          }));

        const anticipoTotal = anticipos.reduce(
          (sum: number, a) => sum + a.monto,
          0
        );
        setAnticipoProveedor(anticipoTotal);
        setAnticiposDisponibles(anticipos);

        // Mapear pagos y eliminar duplicados por ID
        const mappedPagos: Pago[] = ordenesUnicas.map((o: any) => {
          const recibos = o.recibos || [];
          const primeraFactura = recibos[0]?.receipt;
          const facturaNumero = !primeraFactura
            ? '-'
            : recibos.length > 1
              ? 'Varias facturas'
              : `${primeraFactura.numeroSerie}-${primeraFactura.numeroFactura}`;

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
        
        // Eliminar duplicados por ID
        const pagosUnicos = Array.from(
          new Map(mappedPagos.map(p => [p.id, p])).values()
        );
        
        console.log('📊 Pagos mapeados:', mappedPagos.length, 'Pagos únicos:', pagosUnicos.length);
        console.log('🔑 IDs de pagos únicos:', pagosUnicos.map(p => p.id));
        console.log('📋 Detalles de pagos únicos:', pagosUnicos.map(p => ({
          id: p.id,
          fecha: p.fecha,
          monto: p.monto,
          facturaNumero: p.facturaNumero
        })));
        
        // Asegurar que no haya duplicados antes de establecer el estado
        const pagosFinales = Array.from(
          new Map(pagosUnicos.map(p => [`${p.id}-${p.fecha.getTime()}-${p.monto}`, p])).values()
        );
        
        console.log('✅ Pagos finales a establecer en estado:', pagosFinales.length);
        
        setPagos(pagosFinales);
        setOrdenesPago(ordenesUnicas || []);
      }

      // Generar PDF de la orden recién creada y mostrarlo en un visor dentro de ORVIT
      if (ordenCreada) {
        const pdfData: PaymentOrderPDFData = {
          ...ordenCreada,
          company: ordenCreada.company || undefined,
          proveedor: {
            razonSocial: proveedor?.razonSocial,
            codigo: proveedor?.codigo,
            cuit: proveedor?.cuit,
            banco: proveedor?.banco,
            tipoCuenta: proveedor?.tipoCuenta,
            numeroCuenta: proveedor?.numeroCuenta,
            cbu: proveedor?.cbu,
            aliasCbu: proveedor?.aliasCbu,
          },
        };
        const url = await generatePaymentOrderPDF(pdfData);
        setPdfUrl(url);
        setIsPdfModalOpen(true);
      }
    } catch (error) {
      console.error('[REGISTRAR PAGO] Error inesperado:', error);
      toast.error('Error inesperado al registrar la orden de pago');
    } finally {
      setIsSubmittingPago(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('es-AR');
  };

  // Calcular días hasta vencimiento o días vencido
  const getDiasVencimiento = (fechaVencimiento: Date | string | null, saldo: number): { dias: number; texto: string; color: string } | null => {
    if (!fechaVencimiento || saldo === 0) return null;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const venc = new Date(fechaVencimiento);
    venc.setHours(0, 0, 0, 0);

    const diffTime = venc.getTime() - hoy.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        dias: Math.abs(diffDays),
        texto: `${Math.abs(diffDays)}d vencida`,
        color: 'text-destructive bg-destructive/10'
      };
    } else if (diffDays === 0) {
      return {
        dias: 0,
        texto: 'Vence hoy',
        color: 'text-warning-muted-foreground bg-warning-muted'
      };
    } else if (diffDays <= 7) {
      return {
        dias: diffDays,
        texto: `${diffDays}d`,
        color: 'text-warning-muted-foreground bg-warning-muted'
      };
    } else {
      return {
        dias: diffDays,
        texto: `${diffDays}d`,
        color: 'text-muted-foreground bg-muted/50'
      };
    }
  };

  // Devuelve prefijo tipo "FCA-", "FCB-" según el tipo completo del comprobante ("Factura A", etc.)
  const getPrefijoComprobante = (tipoCompleto?: string | null): string => {
    if (!tipoCompleto) return '';
    const t = tipoCompleto.toLowerCase();
    if (t.includes('factura a')) return 'FCA-';
    if (t.includes('factura b')) return 'FCB-';
    if (t.includes('factura c')) return 'FCC-';
    return '';
  };

  const getEstadoBadge = (estado: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      'pagada': 'default',
      'pendiente': 'outline',
      'parcial': 'secondary',
      'vencida': 'destructive'
    };
    
    const labels: Record<string, string> = {
      'pagada': 'Pagada',
      'pendiente': 'Pendiente',
      'parcial': 'Parcial',
      'vencida': 'Vencida'
    };

    return (
      <Badge variant={variants[estado] || 'outline'} className="flex items-center gap-1">
        {estado === 'pagada' && <Check className="w-3 h-3" />}
        {labels[estado] || estado}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6 pb-24 md:pb-6">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!proveedor) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Proveedor no encontrado</h2>
          <p className="text-muted-foreground mb-4">El proveedor solicitado no existe.</p>
          <Button onClick={() => router.push('/administracion/compras/proveedores')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Proveedores
          </Button>
        </div>
      </div>
    );
  }

  const saldoFacturas = facturas.reduce((sum, f) => sum + f.saldo, 0);
  // Saldo total a pagar = saldo de facturas menos anticipos a favor (no puede ser negativo)
  const saldoTotal = Math.max(saldoFacturas - anticipoProveedor, 0);
  const totalFacturado = facturas.reduce((sum, f) => sum + f.total, 0);
  const totalPagado = pagos.reduce((sum, p) => sum + p.monto, 0);

  const abrirEditarFactura = (factura: FacturaCompra) => {
    setFacturaEditandoId(factura.id);
    setIsFacturaEditModalOpen(true);
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
      const resp = await fetch(`/api/compras/comprobantes/${facturaAEliminar.id}${docTypeParam}`, {
        method: 'DELETE',
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        console.error('[FACTURAS] Error al eliminar comprobante:', data);
        toast.error(data?.error || 'Error al eliminar la factura');
        return;
      }

      toast.success('Factura eliminada correctamente');
      await loadProveedorData(params.id as string);
      setIsDeleteFacturaOpen(false);
      setFacturaAEliminar(null);
    } catch (error) {
      console.error('[FACTURAS] Error inesperado al eliminar comprobante:', error);
      toast.error('Error inesperado al eliminar la factura');
    } finally {
      setDeleteFacturaLoading(false);
    }
  };

  const abrirEliminarOrdenPago = (orden: any) => {
    setOrdenPagoAEliminar(orden);
    setIsDeleteOrdenPagoOpen(true);
  };

  const confirmarEliminarOrdenPago = async () => {
    if (!ordenPagoAEliminar) return;
    setDeleteOrdenPagoLoading(true);
    try {
      const resp = await fetch(`/api/compras/ordenes-pago/${ordenPagoAEliminar.id}`, {
        method: 'DELETE',
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        toast.error(data?.error || 'Error al eliminar la orden de pago');
        return;
      }
      toast.success('Orden de pago eliminada');
      await loadProveedorData(params.id as string);
      setIsDeleteOrdenPagoOpen(false);
      setOrdenPagoAEliminar(null);
    } catch (error) {
      console.error('[ORDENES PAGO] Error al eliminar:', error);
      toast.error('Error inesperado al eliminar la orden de pago');
    } finally {
      setDeleteOrdenPagoLoading(false);
    }
  };


  return (
    <div className="px-4 md:px-6 py-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/administracion/compras/proveedores')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{proveedor.nombre}</h1>
            <p className="text-xs text-muted-foreground">
              Detalle del proveedor
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsProveedorModalOpen(true);
            }}
          >
            <Edit className="w-4 h-4 mr-2" />
            Editar
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="general">
            <Info className="w-4 h-4 mr-2" />
            Información
          </TabsTrigger>
          <TabsTrigger value="cuentas">
            <CreditCard className="w-4 h-4 mr-2" />
            Cuenta Corriente
          </TabsTrigger>
          <TabsTrigger value="items">
            <Package className="w-4 h-4 mr-2" />
            Items/Precios
          </TabsTrigger>
          <TabsTrigger value="ordenes">
            <ClipboardList className="w-4 h-4 mr-2" />
            Órdenes de Compra
          </TabsTrigger>
          <TabsTrigger value="recepciones">
            <Truck className="w-4 h-4 mr-2" />
            Recepciones
          </TabsTrigger>
          <TabsTrigger value="devoluciones">
            <RefreshCw className="w-4 h-4 mr-2" />
            Devoluciones
          </TabsTrigger>
        </TabsList>

        {/* Tab: Información General */}
        <TabsContent value="general" className="space-y-4 mt-4 max-h-[70vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Main Info */}
            <div className="lg:col-span-2 space-y-4">
              {/* Card Principal - Info del Proveedor */}
              <Card>
                <CardHeader className="p-4 pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Información del Proveedor
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Columna izquierda - Contacto */}
                    <div className="space-y-3">
                      {/* Email */}
                      <div className="flex items-center justify-between group">
                        <div className="flex items-center gap-2 min-w-0">
                          <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">Email</p>
                            <p className="text-sm font-medium truncate">{proveedor.email || 'No especificado'}</p>
                          </div>
                        </div>
                        {proveedor.email && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => {
                                      navigator.clipboard.writeText(proveedor.email!);
                                      toast.success('Email copiado');
                                    }}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Copiar</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => window.open(`mailto:${proveedor.email}`, '_blank')}
                                  >
                                    <Mail className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Enviar email</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        )}
                      </div>

                      {/* Teléfono */}
                      <div className="flex items-center justify-between group">
                        <div className="flex items-center gap-2 min-w-0">
                          <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">Teléfono</p>
                            <p className="text-sm font-medium">{proveedor.telefono || 'No especificado'}</p>
                          </div>
                        </div>
                        {proveedor.telefono && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => {
                                      navigator.clipboard.writeText(proveedor.telefono!);
                                      toast.success('Teléfono copiado');
                                    }}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Copiar</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-success hover:text-success"
                                    onClick={() => {
                                      const phone = proveedor.telefono!.replace(/\D/g, '');
                                      window.open(`https://wa.me/54${phone}`, '_blank');
                                    }}
                                  >
                                    <MessageCircle className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>WhatsApp</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => window.open(`tel:${proveedor.telefono}`, '_blank')}
                                  >
                                    <Phone className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Llamar</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        )}
                      </div>

                      {/* Dirección */}
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Dirección</p>
                          <p className="text-sm font-medium">
                            {proveedor.direccion || 'No especificado'}
                            {proveedor.ciudad && `, ${proveedor.ciudad}`}
                            {proveedor.codigoPostal && ` (${proveedor.codigoPostal})`}
                            {proveedor.provincia && `, ${proveedor.provincia}`}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Columna derecha - Datos fiscales */}
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Razón Social</p>
                        <p className="text-sm font-medium">{proveedor.razonSocial}</p>
                      </div>

                      {/* CUIT con copiar */}
                      <div className="flex items-center justify-between group">
                        <div>
                          <p className="text-xs text-muted-foreground">CUIT</p>
                          <p className="text-sm font-medium">{proveedor.cuit}</p>
                        </div>
                        {proveedor.cuit && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => {
                                      const cuitLimpio = proveedor.cuit.replace(/\D/g, '');
                                      navigator.clipboard.writeText(cuitLimpio);
                                      toast.success('CUIT copiado (sin guiones)');
                                    }}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Copiar sin guiones</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => {
                                      const cuitLimpio = proveedor.cuit.replace(/\D/g, '');
                                      window.open(`https://www.cuitonline.com/constancia/inscripcion/${cuitLimpio}`, '_blank');
                                    }}
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Consultar AFIP</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-4">
                        {proveedor.condicionIva && (
                          <div>
                            <p className="text-xs text-muted-foreground">Condición IVA</p>
                            <Badge variant="outline" className="mt-0.5 text-xs">
                              {proveedor.condicionIva}
                            </Badge>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-muted-foreground">Estado</p>
                          <Badge variant={proveedor.estado === 'activo' ? 'default' : 'secondary'} className="mt-0.5 text-xs">
                            {proveedor.estado === 'activo' ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contacto Principal */}
                  {proveedor.contactoNombre && (
                    <div className="border-t pt-3">
                      <h3 className="text-xs font-semibold text-muted-foreground mb-2">CONTACTO PRINCIPAL</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Nombre</p>
                          <p className="text-sm font-medium">{proveedor.contactoNombre}</p>
                        </div>
                        {proveedor.contactoTelefono && (
                          <div className="flex items-center justify-between group">
                            <div>
                              <p className="text-xs text-muted-foreground">Teléfono</p>
                              <p className="text-sm font-medium">{proveedor.contactoTelefono}</p>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-success"
                                      onClick={() => {
                                        const phone = proveedor.contactoTelefono!.replace(/\D/g, '');
                                        window.open(`https://wa.me/54${phone}`, '_blank');
                                      }}
                                    >
                                      <MessageCircle className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>WhatsApp</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                        )}
                        {proveedor.contactoEmail && (
                          <div className="flex items-center justify-between group">
                            <div className="min-w-0">
                              <p className="text-xs text-muted-foreground">Email</p>
                              <p className="text-sm font-medium truncate">{proveedor.contactoEmail}</p>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => window.open(`mailto:${proveedor.contactoEmail}`, '_blank')}
                                    >
                                      <Mail className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Enviar email</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Datos Bancarios */}
                  {(proveedor.cbu || proveedor.banco) && (
                    <div className="border-t pt-3">
                      <h3 className="text-xs font-semibold text-muted-foreground mb-2">DATOS BANCARIOS</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {proveedor.cbu && (
                          <div className="flex items-center justify-between group md:col-span-2">
                            <div>
                              <p className="text-xs text-muted-foreground">CBU</p>
                              <p className="text-sm font-medium">{proveedor.cbu}</p>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => {
                                        navigator.clipboard.writeText(proveedor.cbu!);
                                        toast.success('CBU copiado');
                                      }}
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Copiar CBU</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                        )}
                        {proveedor.aliasCbu && (
                          <div className="flex items-center justify-between group">
                            <div>
                              <p className="text-xs text-muted-foreground">Alias CBU</p>
                              <p className="text-sm font-medium">{proveedor.aliasCbu}</p>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => {
                                        navigator.clipboard.writeText(proveedor.aliasCbu!);
                                        toast.success('Alias copiado');
                                      }}
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Copiar Alias</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                        )}
                        {proveedor.banco && (
                          <div>
                            <p className="text-xs text-muted-foreground">Banco</p>
                            <p className="text-sm font-medium">{proveedor.banco}</p>
                          </div>
                        )}
                        {proveedor.tipoCuenta && (
                          <div>
                            <p className="text-xs text-muted-foreground">Tipo de Cuenta</p>
                            <p className="text-sm font-medium">{proveedor.tipoCuenta}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {proveedor.condicionesPago && (
                    <div className="border-t pt-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">CONDICIONES DE PAGO</p>
                      <p className="text-sm bg-muted p-2 rounded-md">{proveedor.condicionesPago}</p>
                    </div>
                  )}

                  {proveedor.notas && (
                    <div className="border-t pt-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">OBSERVACIONES</p>
                      <p className="text-sm bg-muted p-2 rounded-md whitespace-pre-wrap">{proveedor.notas}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Columna derecha - Resumen y métricas */}
            <div className="space-y-4">
              {/* Card Resumen */}
              <Card>
                <CardHeader className="p-4 pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Resumen
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-3">
                  {/* Saldo Actual destacado */}
                  {proveedor.saldoActual !== undefined && (
                    <div className={`p-3 rounded-lg ${
                      proveedor.saldoActual === 0 ? 'bg-muted' :
                      proveedor.saldoActual > 0 ? 'bg-destructive/10' : 'bg-success-muted'
                    }`}>
                      <p className="text-xs text-muted-foreground">Saldo Actual</p>
                      <p className={`text-xl font-bold ${
                        proveedor.saldoActual === 0 ? 'text-muted-foreground' :
                        proveedor.saldoActual > 0 ? 'text-destructive' : 'text-success'
                      }`}>
                        {proveedor.saldoActual === 0 ? 'Al día' : formatCurrency(proveedor.saldoActual)}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Comprado</p>
                      <p className="text-lg font-bold">{formatCurrency(proveedor.montoTotal)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Facturas</p>
                      <p className="text-lg font-bold">{facturas.length}</p>
                    </div>
                  </div>

                  {/* Última Compra */}
                  {facturas.length > 0 && (
                    <div className="pt-3 border-t">
                      <p className="text-xs text-muted-foreground mb-1">Última Compra</p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {formatDate(facturas.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0]?.fecha)}
                        </span>
                        <span className="text-sm font-bold">
                          {formatCurrency(facturas.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0]?.total || 0)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Proveedor desde */}
                  {proveedor.createdAt && (
                    <div className="flex items-center gap-2 pt-3 border-t">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Proveedor desde</p>
                        <p className="text-sm font-medium">{formatDate(proveedor.createdAt)}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tab: Cuentas Corrientes */}
        <TabsContent value="cuentas" className="space-y-4 mt-4">
          {proveedor && (
            <ProveedorCuentaCorriente
              proveedorId={proveedor.id}
              showHeader={false}
            />
          )}
        </TabsContent>

        {/* Tab: Items / Precios */}
        <TabsContent value="items" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="p-4 pb-3">
              <div className="flex flex-row items-center justify-between mb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Items del Proveedor
                  {itemsProveedor.length > 0 && (
                    <Badge variant="secondary" className="ml-2">{itemsProveedor.length}</Badge>
                  )}
                </CardTitle>
                <Button size="sm" variant="outline" onClick={() => setIsNuevoItemOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Item
                </Button>
              </div>
              {/* Barra de búsqueda, filtros y ordenamiento */}
              {itemsProveedor.length > 0 && (
                <div className="space-y-3">
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar item..."
                        value={itemsSearchTerm}
                        onChange={(e) => setItemsSearchTerm(e.target.value)}
                        className="pl-8 h-9"
                      />
                    </div>
                    <Select
                      value={itemsSortField}
                      onValueChange={(v) => setItemsSortField(v as any)}
                    >
                      <SelectTrigger className="w-[160px] h-9">
                        <SelectValue placeholder="Ordenar por" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nombre">Nombre</SelectItem>
                        <SelectItem value="precioUnitario">Precio</SelectItem>
                        <SelectItem value="ultimaCompra">Última compra</SelectItem>
                        <SelectItem value="variacion">Variación %</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 px-2"
                      onClick={() => setItemsSortDirection(d => d === 'asc' ? 'desc' : 'asc')}
                    >
                      <ArrowUpDown className="h-4 w-4" />
                      {itemsSortDirection === 'asc' ? '↑' : '↓'}
                    </Button>
                    <Button
                      variant={itemsShowFilters ? 'secondary' : 'outline'}
                      size="sm"
                      className="h-9"
                      onClick={() => setItemsShowFilters(!itemsShowFilters)}
                    >
                      <Filter className="h-4 w-4 mr-1" />
                      Filtros
                      {itemsFilterVariacion !== 'todos' && (
                        <Badge variant="default" className="ml-1 px-1.5 py-0 text-xs">1</Badge>
                      )}
                    </Button>
                  </div>
                  {/* Filtros avanzados */}
                  {itemsShowFilters && (
                    <div className="flex flex-wrap gap-2 items-center p-3 bg-muted/30 rounded-lg border">
                      <span className="text-sm text-muted-foreground">Variación:</span>
                      <div className="flex gap-1">
                        <Button
                          variant={itemsFilterVariacion === 'todos' ? 'secondary' : 'ghost'}
                          size="sm"
                          className="h-7 text-xs px-2"
                          onClick={() => setItemsFilterVariacion('todos')}
                        >
                          Todos
                        </Button>
                        <Button
                          variant={itemsFilterVariacion === 'subio' ? 'secondary' : 'ghost'}
                          size="sm"
                          className="h-7 text-xs px-2"
                          onClick={() => setItemsFilterVariacion('subio')}
                        >
                          <TrendingUp className="w-3 h-3 mr-1 text-destructive" />
                          Subió
                        </Button>
                        <Button
                          variant={itemsFilterVariacion === 'bajo' ? 'secondary' : 'ghost'}
                          size="sm"
                          className="h-7 text-xs px-2"
                          onClick={() => setItemsFilterVariacion('bajo')}
                        >
                          <TrendingDown className="w-3 h-3 mr-1 text-success" />
                          Bajó
                        </Button>
                        <Button
                          variant={itemsFilterVariacion === 'alto' ? 'secondary' : 'ghost'}
                          size="sm"
                          className="h-7 text-xs px-2"
                          onClick={() => setItemsFilterVariacion('alto')}
                        >
                          <AlertCircle className="w-3 h-3 mr-1 text-warning-muted-foreground" />
                          Alta var. (&gt;10%)
                        </Button>
                      </div>
                      {itemsFilterVariacion !== 'todos' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs px-2 ml-auto text-muted-foreground"
                          onClick={() => setItemsFilterVariacion('todos')}
                        >
                          <X className="w-3 h-3 mr-1" />
                          Limpiar
                        </Button>
                      )}
                    </div>
                  )}
                  {/* Mostrar resultados filtrados */}
                  {(itemsSearchTerm || itemsFilterVariacion !== 'todos') && (
                    <div className="text-xs text-muted-foreground">
                      Mostrando {itemsFiltradosOrdenados.length} de {itemsProveedor.length} items
                    </div>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {loadingItems ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : itemsProveedor.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Este proveedor no tiene items cargados</p>
                  <p className="text-xs mt-1">Agregá items para registrar precios y productos</p>
                </div>
              ) : itemsFiltradosOrdenados.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Search className="w-6 h-6 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No se encontraron items con "{itemsSearchTerm}"</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead className="text-right">Precio Actual</TableHead>
                        <TableHead className="text-center">Variación</TableHead>
                        <TableHead>Última Compra</TableHead>
                        <TableHead className="text-center">Compras</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itemsFiltradosOrdenados.map((item) => (
                        <TableRow
                          key={item.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => {
                            setSelectedItemDetalle(item);
                            setIsItemDetalleOpen(true);
                          }}
                        >
                          <TableCell>
                            <div>
                              {/* Preferir descripcionItem de stockLocations (nombre real usado en recepciones) */}
                              <span className="font-medium">
                                {item.stockLocations?.[0]?.descripcionItem || item.nombre}
                              </span>
                              {item.supply && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  ({item.supply.name})
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">{item.unidad}</span>
                          </TableCell>
                          <TableCell>
                            {(item.stockLocations?.[0]?.codigoProveedor || item.codigoProveedor) ? (
                              <Badge variant="outline" className="text-xs">
                                {item.stockLocations?.[0]?.codigoProveedor || item.codigoProveedor}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {/* Preferir precioHistorico (del historial de compras) sobre precioUnitario (precio base) */}
                            {(() => {
                              const precio = item.precioHistorico ?? item.precioUnitario;
                              return precio && Number(precio) > 0 ? (
                                <span className="font-medium">
                                  ${Number(precio).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.variacionPorcentaje !== null && item.variacionPorcentaje !== undefined ? (
                              <Badge
                                variant={item.variacionPorcentaje > 0 ? 'destructive' : item.variacionPorcentaje < 0 ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {item.variacionPorcentaje > 0 ? (
                                  <TrendingUp className="w-3 h-3 mr-1" />
                                ) : item.variacionPorcentaje < 0 ? (
                                  <TrendingDown className="w-3 h-3 mr-1" />
                                ) : null}
                                {item.variacionPorcentaje > 0 ? '+' : ''}{item.variacionPorcentaje.toFixed(1)}%
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {item.ultimaCompra ? (
                              <span className="text-sm">
                                {new Date(item.ultimaCompra).toLocaleDateString('es-AR')}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="text-xs">
                              {item.cantidadCompras || 0}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Órdenes de Compra */}
        <TabsContent value="ordenes" className="space-y-4 mt-4">
          <OrdenesCompraList
            proveedorId={proveedor ? parseInt(proveedor.id) : undefined}
            title="Órdenes de Compra del Proveedor"
          />
        </TabsContent>

        {/* Tab: Recepciones */}
        <TabsContent value="recepciones" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Recepciones de Mercadería
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push('/administracion/compras/recepciones')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Ver Todas
                </Button>
                <Button
                  size="sm"
                  onClick={() => router.push(`/administracion/compras/recepciones/nueva?proveedorId=${proveedor?.id}`)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nueva Recepción
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {loadingRecepciones ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : recepciones.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Truck className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No hay recepciones registradas para este proveedor</p>
                  <p className="text-sm mt-1">Las recepciones se crean desde las órdenes de compra</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>N° Recepción</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>N° Remito</TableHead>
                        <TableHead>OC Relacionada</TableHead>
                        <TableHead>Depósito</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-center">Items</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recepciones.map((rec) => (
                        <TableRow key={rec.id}>
                          <TableCell className="font-medium">{rec.numero}</TableCell>
                          <TableCell>
                            {rec.fechaRecepcion ? new Date(rec.fechaRecepcion).toLocaleDateString('es-AR') : '-'}
                          </TableCell>
                          <TableCell>
                            {rec.numeroRemito || <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell>
                            {rec.purchaseOrder ? (
                              <Button
                                variant="link"
                                size="sm"
                                className="p-0 h-auto"
                                onClick={() => router.push(`/administracion/compras/ordenes-compra/${rec.purchaseOrder?.id}`)}
                              >
                                {rec.purchaseOrder.numero}
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">Sin OC</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {rec.warehouse?.nombre || <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                rec.estado === 'confirmada' ? 'default' :
                                rec.estado === 'pendiente' ? 'secondary' :
                                rec.estado === 'rechazada' ? 'destructive' :
                                'outline'
                              }
                            >
                              {rec.estado === 'borrador' && 'Borrador'}
                              {rec.estado === 'pendiente' && 'Pendiente'}
                              {rec.estado === 'confirmada' && 'Confirmada'}
                              {rec.estado === 'rechazada' && 'Rechazada'}
                              {!['borrador', 'pendiente', 'confirmada', 'rechazada'].includes(rec.estado) && rec.estado}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">{rec.itemsCount}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => {
                                    setRecepcionDetalleId(rec.id);
                                    setRecepcionDetalleModalOpen(true);
                                  }}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  Ver detalle
                                </DropdownMenuItem>
                                {(rec.adjuntos?.length || rec.firma) && (
                                  <DropdownMenuItem onClick={() => setRecepcionVistaModal({ id: rec.id, adjuntos: rec.adjuntos, firma: rec.firma })}>
                                    <FileText className="w-4 h-4 mr-2" />
                                    Ver fotos/firma
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devoluciones" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <RotateCcw className="w-4 h-4" />
                Devoluciones al Proveedor
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push('/administracion/compras/devoluciones')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Ver Todas
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {loadingDevoluciones ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : devoluciones.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <RotateCcw className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No hay devoluciones registradas para este proveedor</p>
                  <p className="text-sm mt-1">Las devoluciones se generan desde facturas o recepciones con problemas</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>N° Devolución</TableHead>
                        <TableHead>Fecha Solicitud</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead>Recepción</TableHead>
                        <TableHead>Depósito</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-center">Items</TableHead>
                        <TableHead className="text-center">NCAs</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {devoluciones.map((dev) => (
                        <TableRow key={dev.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {dev.numero}
                              {dev.docType === 'T2' && (
                                <Badge variant="outline" className="text-xs">T2</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {dev.fechaSolicitud ? new Date(dev.fechaSolicitud).toLocaleDateString('es-AR') : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {dev.tipo === 'DEFECTO' && 'Defecto'}
                              {dev.tipo === 'EXCESO' && 'Exceso'}
                              {dev.tipo === 'ERROR_PEDIDO' && 'Error Pedido'}
                              {dev.tipo === 'GARANTIA' && 'Garantía'}
                              {dev.tipo === 'OTRO' && 'Otro'}
                              {!['DEFECTO', 'EXCESO', 'ERROR_PEDIDO', 'GARANTIA', 'OTRO'].includes(dev.tipo) && dev.tipo}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate" title={dev.motivo}>
                            {dev.motivo || <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell>
                            {dev.goodsReceipt ? (
                              <Button
                                variant="link"
                                size="sm"
                                className="p-0 h-auto"
                                onClick={() => router.push(`/administracion/compras/recepciones/${dev.goodsReceipt?.id}`)}
                              >
                                {dev.goodsReceipt.numero}
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {dev.warehouse?.nombre || <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                dev.estado === 'RESUELTA' ? 'default' :
                                dev.estado === 'ENVIADA' ? 'default' :
                                dev.estado === 'APROBADA_PROVEEDOR' ? 'secondary' :
                                dev.estado === 'RECIBIDA_PROVEEDOR' ? 'default' :
                                dev.estado === 'RECHAZADA' ? 'destructive' :
                                dev.estado === 'CANCELADA' ? 'destructive' :
                                'outline'
                              }
                            >
                              {dev.estado === 'BORRADOR' && 'Borrador'}
                              {dev.estado === 'SOLICITADA' && 'Solicitada'}
                              {dev.estado === 'APROBADA_PROVEEDOR' && 'Aprobada'}
                              {dev.estado === 'ENVIADA' && 'Enviada'}
                              {dev.estado === 'RECIBIDA_PROVEEDOR' && 'Recibida'}
                              {dev.estado === 'RESUELTA' && 'Resuelta'}
                              {dev.estado === 'RECHAZADA' && 'Rechazada'}
                              {dev.estado === 'CANCELADA' && 'Cancelada'}
                              {!['BORRADOR', 'SOLICITADA', 'APROBADA_PROVEEDOR', 'ENVIADA', 'RECIBIDA_PROVEEDOR', 'RESUELTA', 'RECHAZADA', 'CANCELADA'].includes(dev.estado) && dev.estado}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">{dev._count?.items || 0}</TableCell>
                          <TableCell className="text-center">
                            {dev._count?.creditNotes ? (
                              <Badge variant="secondary">{dev._count.creditNotes}</Badge>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => router.push(`/administracion/compras/devoluciones/${dev.id}`)}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  Ver detalle
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal para editar factura (completo) */}
      <ComprobanteFormModal
        open={isFacturaEditModalOpen}
        onOpenChange={(open) => {
          setIsFacturaEditModalOpen(open);
          if (!open) {
            setFacturaEditandoId(null);
          }
        }}
        comprobanteId={facturaEditandoId}
        onSaved={() => {
          if (params.id) {
            loadProveedorData(params.id as string);
          }
          setFacturaEditandoId(null);
        }}
      />

      {/* Modal para crear nuevo comprobante con proveedor preseleccionado */}
      <ComprobanteFormModal
        open={isNuevoComprobanteModalOpen}
        onOpenChange={setIsNuevoComprobanteModalOpen}
        defaultProveedorId={proveedor?.id}
        onSaved={() => {
          if (params.id) {
            loadProveedorData(params.id as string);
          }
        }}
      />

      {/* Modal para crear nueva orden de compra con proveedor preseleccionado */}
      <OrdenCompraFormModal
        open={isNuevaOCModalOpen}
        onOpenChange={setIsNuevaOCModalOpen}
        defaultProveedorId={proveedor?.id}
        onSuccess={() => {
          loadOrdenesCompraProveedor(params.id as string);
        }}
      />

      {/* Modal para registrar pago sobre múltiples facturas */}
      <Dialog
        open={isPagoModalOpen}
        onOpenChange={(open) => {
          setIsPagoModalOpen(open);
          if (!open) {
            setSelectedFacturas([]);
            setPagoForm({
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
          }
        }}
      >
        <DialogContent size="xl" className="max-h-[90vh] w-full overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
            <DialogDescription>
              Seleccioná una o varias facturas de este proveedor y completá los datos del pago.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-[2.3fr,1fr] gap-6 py-4 items-start">
            {/* Selección de facturas */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Facturas del proveedor</h3>
              <div className="border rounded-md max-h-64 overflow-y-auto">
                {facturas.filter(f => f.saldo > 0).length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3">
                    No hay facturas pendientes para este proveedor.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead>Número</TableHead>
                        <TableHead>Vencimiento</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {facturas
                        .filter((f) => f.saldo > 0)
                        .map((factura, index) => (
                        <TableRow
                          key={factura.id}
                          className={selectedFacturas.includes(factura.id) ? 'bg-muted/60 cursor-pointer' : 'cursor-pointer'}
                          onClick={(e) => handleFacturaRowClick(index, factura.id, e)}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedFacturas.includes(factura.id)}
                              onCheckedChange={() => toggleFacturaSeleccionada(factura.id)}
                            />
                          </TableCell>
                          <TableCell className="text-xs">
                            {factura.numero}
                          </TableCell>
                          <TableCell className="text-xs">
                            {factura.vencimiento ? formatDate(factura.vencimiento) : '-'}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {formatCurrency(factura.saldo)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
    </div>
              <div className="mt-2 inline-flex flex-wrap items-center gap-3 rounded-md bg-muted px-3 py-1.5 text-[11px] text-muted-foreground">
                <span>
                  Facturas seleccionadas:{' '}
                  <span className="font-semibold">{selectedFacturas.length}</span>
                </span>
                <span className="h-3 w-px bg-border" />
                <span>
                  Saldo seleccionado:{' '}
                  <span className="font-semibold">{formatCurrency(totalSeleccionado)}</span>
                </span>
                {totalAnticiposSeleccionados > 0 && (
                  <>
                    <span className="h-3 w-px bg-border" />
                    <span>
                      Anticipos aplicados:{' '}
                      <span className="font-semibold text-success">
                        -{formatCurrency(totalAnticiposSeleccionados)}
                      </span>
                    </span>
                    <span className="h-3 w-px bg-border" />
                    <span>
                      Saldo a pagar:{' '}
                      <span className="font-semibold">
                        {formatCurrency(saldoSeleccionadoConAnticipos)}
                      </span>
                    </span>
                  </>
                )}
              </div>

              {/* Cheques de terceros seleccionados dentro del modal, debajo de las facturas */}
              {selectedCheques.length > 0 && (
                <div className="mt-3 border rounded-md p-2">
                  <h4 className="text-xs font-semibold mb-2">Cheques de terceros seleccionados</h4>
                  <div className="max-h-32 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[24px]"></TableHead>
                          <TableHead className="text-xs">Número</TableHead>
                          <TableHead className="text-xs">Banco</TableHead>
                          <TableHead className="text-xs">Tipo</TableHead>
                          <TableHead className="text-xs">Vencimiento</TableHead>
                          <TableHead className="text-xs text-right">Importe</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedChequesDetalle.map(ch => (
                          <TableRow key={ch.id}>
                            <TableCell className="text-xs">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4 text-destructive"
                                onClick={() => toggleChequeSeleccionado(ch.id)}
                              >
                                ×
                              </Button>
                            </TableCell>
                            <TableCell className="text-xs">{ch.numero}</TableCell>
                            <TableCell className="text-xs">{ch.banco}</TableCell>
                            <TableCell className="text-xs">
                              {ch.tipo === 'ECHEQ' ? 'eCheq' : 'Cheque'}
                            </TableCell>
                            <TableCell className="text-xs">
                              {formatDate(ch.fechaVencimiento)}
                            </TableCell>
                            <TableCell className="text-xs text-right">
                              {formatCurrency(ch.importe)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Total cheques:{' '}
                    <span className="font-semibold">
                      {formatCurrency(totalChequesSeleccionados)}
                    </span>
                  </p>
                </div>
              )}

              {/* Anticipos disponibles */}
              {anticiposDisponibles.length > 0 && (
                <div className="mt-3 border rounded-md p-2">
                  <h4 className="text-xs font-semibold mb-2">Anticipos disponibles</h4>
                  <div className="max-h-32 overflow-y-auto">
                    <Table>
                      <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead className="text-xs">Anticipo</TableHead>
                          <TableHead className="text-xs">Fecha</TableHead>
                          <TableHead className="text-xs text-right">Monto anticipo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {anticiposDisponibles.map((a) => (
                          <TableRow key={a.id}>
                            <TableCell>
                              <Checkbox
                                checked={anticiposSeleccionados.includes(a.id)}
                                onCheckedChange={() => toggleAnticipoSeleccionado(a.id)}
                              />
                            </TableCell>
                            <TableCell className="text-xs">
                              {`ANT-${a.id.toString().padStart(3, '0')}`}
                            </TableCell>
                            <TableCell className="text-xs">{formatDate(a.fecha)}</TableCell>
                            <TableCell className="text-xs text-right">
                              {formatCurrency(a.monto)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Anticipos seleccionados:{' '}
                    <span className="font-semibold">
                      {anticiposSeleccionados.length}
                    </span>
                  </p>
                </div>
              )}

              {/* Notas de la orden de pago (debajo de cheques seleccionados) */}
              <div className="mt-4">
                <Label htmlFor="pagoNotas" className="text-xs">
                  Notas de la orden de pago
                </Label>
                <Textarea
                  id="pagoNotas"
                  className="mt-1 h-16 text-xs resize-none"
                  placeholder="Agregá aquí comentarios o aclaraciones sobre esta orden de pago..."
                  value={pagoForm.notas}
                  onChange={(e) =>
                    setPagoForm(prev => ({
                      ...prev,
                      notas: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {/* Datos del pago */}
            <div className="space-y-3 md:pl-8">
              <h3 className="text-sm font-semibold">Datos del Pago</h3>
              {/* Panel de medios de pago, uno debajo de otro y más angosto */}
              <div className="space-y-2 max-w-xs ml-auto">
                <div className="space-y-1">
                  <Label htmlFor="pagoEfectivo" className="text-xs">Efectivo</Label>
                  <Input
                    id="pagoEfectivo"
                    type="text"
                    value={pagoForm.efectivo}
                    onChange={(e) => handlePagoChange('efectivo', e.target.value)}
                    onBlur={() => aplicarFormatoSolo('efectivo')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        aplicarFormatoYPasar('efectivo', 'pagoEfectivo');
                      }
                    }}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pagoDolares" className="text-xs">Dólares</Label>
                  <Input
                    id="pagoDolares"
                    type="text"
                    value={pagoForm.dolares}
                    onChange={(e) => handlePagoChange('dolares', e.target.value)}
                    onBlur={() => aplicarFormatoSolo('dolares')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        aplicarFormatoYPasar('dolares', 'pagoDolares');
                      }
                    }}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pagoTransferencia" className="text-xs">Transferencia</Label>
                  <Input
                    id="pagoTransferencia"
                    type="text"
                    value={pagoForm.transferencia}
                    onChange={(e) => handlePagoChange('transferencia', e.target.value)}
                    onBlur={() => aplicarFormatoSolo('transferencia')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        aplicarFormatoYPasar('transferencia', 'pagoTransferencia');
                      }
                    }}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="pagoChTerceros" className="text-xs">Ch. Terceros</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      className="h-6 px-2 text-[10px]"
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsChequesModalOpen(true);
                      }}
                    >
                      Ver cheques
                    </Button>
                  </div>
                  <Input
                    id="pagoChTerceros"
                    type="text"
                    value={pagoForm.chequesTerceros}
                    onChange={(e) => handlePagoChange('chequesTerceros', e.target.value)}
                    onBlur={() => aplicarFormatoSolo('chequesTerceros')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        aplicarFormatoYPasar('chequesTerceros', 'pagoChTerceros');
                      }
                    }}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pagoChPropios" className="text-xs">Ch. Propios</Label>
                  <Input
                    id="pagoChPropios"
                    type="text"
                    value={pagoForm.chequesPropios}
                    onChange={(e) => handlePagoChange('chequesPropios', e.target.value)}
                    onBlur={() => aplicarFormatoSolo('chequesPropios')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        aplicarFormatoYPasar('chequesPropios', 'pagoChPropios');
                      }
                    }}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pagoRetIVA" className="text-xs">Ret. IVA</Label>
                  <Input
                    id="pagoRetIVA"
                    type="text"
                    value={pagoForm.retIVA}
                    onChange={(e) => handlePagoChange('retIVA', e.target.value)}
                    onBlur={() => aplicarFormatoSolo('retIVA')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        aplicarFormatoYPasar('retIVA', 'pagoRetIVA');
                      }
                    }}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pagoRetGan" className="text-xs">Ret. Gan.</Label>
                  <Input
                    id="pagoRetGan"
                    type="text"
                    value={pagoForm.retGanancias}
                    onChange={(e) => handlePagoChange('retGanancias', e.target.value)}
                    onBlur={() => aplicarFormatoSolo('retGanancias')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        aplicarFormatoYPasar('retGanancias', 'pagoRetGan');
                      }
                    }}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pagoRetIngBru" className="text-xs">Ret. ING.BRU.</Label>
                  <Input
                    id="pagoRetIngBru"
                    type="text"
                    value={pagoForm.retIngBrutos}
                    onChange={(e) => handlePagoChange('retIngBrutos', e.target.value)}
                    onBlur={() => aplicarFormatoSolo('retIngBrutos')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        aplicarFormatoYPasar('retIngBrutos', 'pagoRetIngBru');
                      }
                    }}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Resumen compacto: saldo, pago, anticipo y diferencia */}
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md border px-3 py-2 bg-muted/40">
                  <p className="text-[11px] text-muted-foreground">Saldo seleccionado</p>
                  <p className="text-sm font-semibold">{formatCurrency(totalSeleccionado)}</p>
                </div>
                <div className="rounded-md border px-3 py-2 bg-muted/40">
                  <p className="text-[11px] text-muted-foreground">Total pago</p>
                  <p className="text-sm font-semibold">{formatCurrency(totalPago)}</p>
                </div>
                <div className="rounded-md border px-3 py-2 bg-muted/40">
                  <p className="text-[11px] text-muted-foreground">Anticipo a cuenta</p>
                  <p className="text-sm font-semibold">
                    {anticipo > 0 ? formatCurrency(anticipo) : formatCurrency(0)}
                  </p>
                </div>
                <div className="rounded-md border px-3 py-2 bg-muted/40">
                  <p className="text-[11px] text-muted-foreground">Diferencia (pago - saldo)</p>
                  <p className="text-sm font-semibold">{formatCurrency(diferencia)}</p>
                </div>
              </div>

              {/* Botón para ver datos bancarios del proveedor (abre modal separado) */}
              <div className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsBancoModalOpen(true)}
                >
                  Ver datos bancarios del proveedor
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsPagoModalOpen(false);
                setSelectedFacturas([]);
              }}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleRegistrarPago} disabled={isSubmittingPago}>
              {isSubmittingPago ? 'Registrando...' : 'Registrar Pago'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de detalle de orden de pago - Mejorado */}
      <Dialog
        open={isDetallePagoOpen && !!pagoDetalleSeleccionado}
        onOpenChange={(open) => {
          setIsDetallePagoOpen(open);
          if (!open) {
            setPagoDetalleSeleccionado(null);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] p-0 overflow-hidden print:max-w-none print:max-h-none print:w-full print:h-auto print:overflow-visible print:rounded-none print:border-none print:p-0">
          {pagoDetalleSeleccionado && (
            <>
              {/* Header con número y fecha */}
              <div className="bg-primary/5 border-b px-4 py-3 print:bg-background print:border-b print:pb-3">
                <div className="flex items-center justify-between print:hidden">
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
                {/* Print header */}
                <div className="hidden print:block text-xs">
                  <div className="text-center mb-2">
                    <p className="text-sm font-bold">{pagoDetalleSeleccionado.company?.name || 'Orden de Pago'}</p>
                    {pagoDetalleSeleccionado.company?.address && <p className="text-[11px]">{pagoDetalleSeleccionado.company.address}</p>}
                  </div>
                  <div className="flex justify-between">
                    <div><span className="font-semibold">Proveedor:</span> {proveedor?.razonSocial}</div>
                    <div><span className="font-semibold">N°:</span> {pagoDetalleSeleccionado.id} | <span className="font-semibold">Fecha:</span> {formatDate(new Date(pagoDetalleSeleccionado.fechaPago))}</div>
                  </div>
                </div>
              </div>

              {/* Contenido scrolleable */}
              <div className="overflow-y-auto max-h-[calc(90vh-180px)] px-4 py-4 space-y-4">
                {/* Total pagado - destacado */}
                <div className="flex items-center justify-between p-3 bg-success-muted border border-success-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-success" />
                    <span className="text-sm font-medium text-success">Total Pagado</span>
                  </div>
                  <span className="text-lg font-bold text-success">
                    {formatCurrency(Number(pagoDetalleSeleccionado.totalPago || 0))}
                  </span>
                </div>

                {/* Medios de pago - grid compacto */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5" />
                    Medios de Pago
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {Number(pagoDetalleSeleccionado.efectivo || 0) > 0 && (
                      <div className="flex items-center justify-between p-2.5 rounded-md border bg-muted/30">
                        <span className="text-xs text-muted-foreground">Efectivo</span>
                        <span className="text-xs font-semibold">{formatCurrency(Number(pagoDetalleSeleccionado.efectivo))}</span>
                      </div>
                    )}
                    {Number(pagoDetalleSeleccionado.dolares || 0) > 0 && (
                      <div className="flex items-center justify-between p-2.5 rounded-md border bg-muted/30">
                        <span className="text-xs text-muted-foreground">Dólares</span>
                        <span className="text-xs font-semibold">{formatCurrency(Number(pagoDetalleSeleccionado.dolares))}</span>
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
                    {Number(pagoDetalleSeleccionado.retIVA || 0) > 0 && (
                      <div className="flex items-center justify-between p-2.5 rounded-md border bg-warning-muted">
                        <span className="text-xs text-muted-foreground">Ret. IVA</span>
                        <span className="text-xs font-semibold text-warning-muted-foreground">{formatCurrency(Number(pagoDetalleSeleccionado.retIVA))}</span>
                      </div>
                    )}
                    {Number(pagoDetalleSeleccionado.retGanancias || 0) > 0 && (
                      <div className="flex items-center justify-between p-2.5 rounded-md border bg-warning-muted">
                        <span className="text-xs text-muted-foreground">Ret. Ganancias</span>
                        <span className="text-xs font-semibold text-warning-muted-foreground">{formatCurrency(Number(pagoDetalleSeleccionado.retGanancias))}</span>
                      </div>
                    )}
                    {Number(pagoDetalleSeleccionado.retIngBrutos || 0) > 0 && (
                      <div className="flex items-center justify-between p-2.5 rounded-md border bg-warning-muted">
                        <span className="text-xs text-muted-foreground">Ret. Ing. Brutos</span>
                        <span className="text-xs font-semibold text-warning-muted-foreground">{formatCurrency(Number(pagoDetalleSeleccionado.retIngBrutos))}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Facturas asociadas */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Facturas Aplicadas
                    {pagoDetalleSeleccionado.recibos?.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{pagoDetalleSeleccionado.recibos.length}</Badge>
                    )}
                  </p>
                  {(!pagoDetalleSeleccionado.recibos || pagoDetalleSeleccionado.recibos.length === 0) ? (
                    <p className="text-xs text-muted-foreground py-3 text-center border rounded-md bg-muted/20">
                      Sin facturas asociadas
                    </p>
                  ) : (
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableHead className="text-[11px] font-medium h-8">Factura</TableHead>
                            <TableHead className="text-[11px] font-medium text-right h-8">Total</TableHead>
                            <TableHead className="text-[11px] font-medium text-right h-8">Aplicado</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pagoDetalleSeleccionado.recibos.map((r: any) => {
                            const recibo = r.receipt;
                            const numero = recibo
                              ? `${getPrefijoComprobante(recibo.tipo)}${recibo.numeroSerie}-${recibo.numeroFactura}`
                              : '-';
                            return (
                              <TableRow key={r.id}>
                                <TableCell className="text-xs py-2">{numero}</TableCell>
                                <TableCell className="text-xs text-right py-2">{formatCurrency(Number(recibo?.total || 0))}</TableCell>
                                <TableCell className="text-xs text-right py-2 font-medium text-success">{formatCurrency(Number(r.montoAplicado || 0))}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                {/* Cheques utilizados */}
                {pagoDetalleSeleccionado.cheques && pagoDetalleSeleccionado.cheques.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      Cheques Utilizados
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{pagoDetalleSeleccionado.cheques.length}</Badge>
                    </p>
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableHead className="text-[11px] font-medium h-8">Tipo</TableHead>
                            <TableHead className="text-[11px] font-medium h-8">Número</TableHead>
                            <TableHead className="text-[11px] font-medium h-8">Banco</TableHead>
                            <TableHead className="text-[11px] font-medium text-right h-8">Importe</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pagoDetalleSeleccionado.cheques.map((c: any) => (
                            <TableRow key={c.id}>
                              <TableCell className="text-xs py-2">{c.tipo === 'ECHEQ' ? 'eCheq' : 'Cheque'}</TableCell>
                              <TableCell className="text-xs py-2">{c.numero}</TableCell>
                              <TableCell className="text-xs py-2">{c.banco || '-'}</TableCell>
                              <TableCell className="text-xs text-right py-2 font-medium">{formatCurrency(Number(c.importe || 0))}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Notas */}
                {pagoDetalleSeleccionado.notas && (
                  <div className="p-3 rounded-md bg-muted/30 border">
                    <p className="text-[11px] text-muted-foreground mb-1">Observaciones</p>
                    <p className="text-xs">{pagoDetalleSeleccionado.notas}</p>
                  </div>
                )}
              </div>

              {/* Footer con acciones */}
              <div className="border-t px-4 py-3 bg-muted/20 flex items-center justify-between print:hidden">
                <Button variant="ghost" size="sm" onClick={() => setIsDetallePagoOpen(false)}>
                  Cerrar
                </Button>
                <Button
                  size="sm"
                  onClick={async () => {
                    if (!pagoDetalleSeleccionado) return;
                    try {
                      const ordenId = pagoDetalleSeleccionado.id;
                      const proveedorIdNumeric = Number(proveedor?.id ?? (params.id as string));
                      const ordenResponse = await fetch(
                        `/api/compras/ordenes-pago?proveedorId=${proveedorIdNumeric}&_t=${Date.now()}`,
                        { cache: 'no-store', headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } }
                      );
                      let ordenParaPDF = null;
                      if (ordenResponse.ok) {
                        const ordenes = await ordenResponse.json();
                        ordenParaPDF = ordenes.find((o: any) => o.id === ordenId);
                      }
                      if (!ordenParaPDF) ordenParaPDF = pagoDetalleSeleccionado;
                      const pdfData: PaymentOrderPDFData = {
                        ...ordenParaPDF,
                        company: ordenParaPDF.company || pagoDetalleSeleccionado.company || undefined,
                        proveedor: {
                          razonSocial: proveedor?.razonSocial || ordenParaPDF.proveedor?.razon_social || ordenParaPDF.proveedor?.name || '',
                          codigo: proveedor?.codigo,
                          cuit: proveedor?.cuit || ordenParaPDF.proveedor?.cuit || '',
                          banco: proveedor?.banco,
                          tipoCuenta: proveedor?.tipoCuenta,
                          numeroCuenta: proveedor?.numeroCuenta,
                          cbu: proveedor?.cbu,
                          aliasCbu: proveedor?.aliasCbu,
                        },
                      };
                      const url = await generatePaymentOrderPDF(pdfData);
                      setPdfUrl(url);
                      setIsPdfModalOpen(true);
                    } catch (error) {
                      console.error('Error generando PDF:', error);
                      toast.error('Error al generar el PDF');
                    }
                  }}
                >
                  <Printer className="w-3.5 h-3.5 mr-2" />
                  Imprimir PDF
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal para seleccionar cheques de terceros en cartera */}
      <Dialog open={isChequesModalOpen} onOpenChange={setIsChequesModalOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] w-full overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cheques de terceros en cartera</DialogTitle>
            <DialogDescription>
              Seleccioná uno o varios cheques para aplicar en este pago.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* Monto a pagar considerando facturas seleccionadas y anticipos */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs border rounded-md px-3 py-2 bg-muted/40">
              <span>
                Monto a pagar:{' '}
                <span className="font-semibold">
                  {formatCurrency(saldoSeleccionadoConAnticipos)}
                </span>
              </span>
              <span className="text-[11px] text-muted-foreground">
                Facturas seleccionadas: <span className="font-semibold">{selectedFacturas.length}</span>
              </span>
            </div>

            {/* Filtros de cheques */}
            <div className="grid grid-cols-1 md:grid-cols-[3fr,2fr,2fr,3fr,auto] gap-2 text-xs items-end">
              <div className="space-y-1">
                <Label className="text-[11px]">Buscar por número / banco / titular</Label>
                <Input
                  className="h-7 text-xs"
                  placeholder="Escribí texto..."
                  value={chequesFilters.texto}
                  onChange={(e) =>
                    setChequesFilters(prev => ({ ...prev, texto: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Importe desde</Label>
                <Input
                  className="h-7 text-xs"
                  placeholder="Mínimo"
                  value={chequesFilters.montoDesde}
                  onChange={(e) =>
                    setChequesFilters(prev => ({ ...prev, montoDesde: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Importe hasta</Label>
                <Input
                  className="h-7 text-xs"
                  placeholder="Máximo"
                  value={chequesFilters.montoHasta}
                  onChange={(e) =>
                    setChequesFilters(prev => ({ ...prev, montoHasta: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Vencimiento entre (dd/mm/yyyy)</Label>
                <div className="flex gap-1">
                  <Input
                    type="text"
                    className="h-7 text-[11px]"
                    placeholder="dd/mm o dd/mm/aaaa"
                    value={chequesFilters.fechaDesdeInput}
                    onChange={(e) =>
                      setChequesFilters(prev => ({ ...prev, fechaDesdeInput: e.target.value }))
                    }
                    onBlur={() => handleFechaFiltroBlurOrEnter('desde')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleFechaFiltroBlurOrEnter('desde');
                      }
                    }}
                  />
                  <Input
                    type="text"
                    className="h-7 text-[11px]"
                    placeholder="dd/mm o dd/mm/aaaa"
                    value={chequesFilters.fechaHastaInput}
                    onChange={(e) =>
                      setChequesFilters(prev => ({ ...prev, fechaHastaInput: e.target.value }))
                    }
                    onBlur={() => handleFechaFiltroBlurOrEnter('hasta')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleFechaFiltroBlurOrEnter('hasta');
                      }
                    }}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Button
                  type="button"
                  size="xs"
                  variant={verMarcados ? 'default' : 'outline'}
                  className="h-7 text-[11px]"
                  onClick={() => setVerMarcados(prev => !prev)}
                >
                  {verMarcados ? 'Ver todos' : 'Ver marcados'}
                </Button>
                <span className="text-[10px] text-muted-foreground text-right">
                  Coinciden con filtro: <span className="font-semibold">{totalChequesQueCumplenFiltro}</span>
                </span>
              </div>
            </div>

            {chequesCartera.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay cheques de terceros en cartera cargados todavía.
              </p>
            ) : (
              <div className="border rounded-md max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead>Número</TableHead>
                      <TableHead>Banco</TableHead>
                      <TableHead>Titular</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Vencimiento</TableHead>
                      <TableHead className="text-right">Importe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(
                      verMarcados
                        ? chequesCartera.filter(chequeCumpleFiltros)
                        : chequesCartera
                    ).map(ch => {
                      const cumpleFiltro = chequeCumpleFiltros(ch);
                      const estaMarcado = selectedCheques.includes(ch.id);

                      // Clase de fondo según estado:
                      // - Marcados (si verMarcados): verde suave
                      // - Cumplen filtro: azul suave
                      // - Ambos: verde un poco más intenso con borde
                      let rowClass = '';
                      if (estaMarcado && verMarcados && cumpleFiltro) {
                        rowClass = 'bg-emerald-100 border border-emerald-300';
                      } else if (estaMarcado && verMarcados) {
                        rowClass = 'bg-emerald-50';
                      } else if (cumpleFiltro) {
                        rowClass = 'bg-sky-50';
                      }

                      return (
                      <TableRow key={ch.id} className={rowClass}>
                        <TableCell>
                          <Checkbox
                            checked={selectedCheques.includes(ch.id)}
                            onCheckedChange={() => toggleChequeSeleccionado(ch.id)}
                          />
                        </TableCell>
                        <TableCell className="text-xs">{ch.numero}</TableCell>
                        <TableCell className="text-xs">{ch.banco}</TableCell>
                        <TableCell className="text-xs">{ch.titular}</TableCell>
                        <TableCell className="text-xs">
                          {ch.tipo === 'ECHEQ' ? 'eCheq' : 'Cheque'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatDate(ch.fechaVencimiento)}
                        </TableCell>
                        <TableCell className="text-xs text-right">
                          {formatCurrency(ch.importe)}
                        </TableCell>
                      </TableRow>
                    )})}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="text-xs text-muted-foreground flex justify-between">
              <span>Cheques seleccionados: {selectedCheques.length}</span>
              <span>
                Total seleccionado:{' '}
                <span className="font-semibold">
                  {formatCurrency(totalChequesSeleccionados)}
                </span>
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsChequesModalOpen(false)}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal solo para ver datos bancarios del proveedor */}
      <Dialog open={isBancoModalOpen} onOpenChange={setIsBancoModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Datos bancarios del proveedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            {(!proveedor?.cbu && !proveedor?.aliasCbu && !proveedor?.banco) ? (
              <p className="text-muted-foreground">
                Este proveedor no tiene datos bancarios cargados.
              </p>
            ) : (
              <>
                <p><span className="font-semibold">Banco:</span> {proveedor?.banco || '-'}</p>
                <p><span className="font-semibold">Tipo de cuenta:</span> {proveedor?.tipoCuenta || '-'}</p>
                <p><span className="font-semibold">Número de cuenta:</span> {proveedor?.numeroCuenta || '-'}</p>
                <p><span className="font-semibold">CBU:</span> {proveedor?.cbu || '-'}</p>
                <p><span className="font-semibold">Alias CBU:</span> {proveedor?.aliasCbu || '-'}</p>
              </>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsBancoModalOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para editar proveedor desde el detalle */}
      <ProveedorModal
        isOpen={isProveedorModalOpen}
        onClose={() => setIsProveedorModalOpen(false)}
        proveedor={
          proveedor
            ? {
                id: proveedor.id,
                nombre: proveedor.nombre,
                razonSocial: proveedor.razonSocial,
                codigo: proveedor.codigo || '',
                cuit: proveedor.cuit,
                email: proveedor.email || '',
                telefono: proveedor.telefono || '',
                direccion: proveedor.direccion || '',
                ciudad: proveedor.ciudad || '',
                codigoPostal: proveedor.codigoPostal || '',
                provincia: proveedor.provincia || '',
                contactoNombre: proveedor.contactoNombre || '',
                contactoTelefono: proveedor.contactoTelefono || '',
                contactoEmail: proveedor.contactoEmail || '',
                condicionesPago: proveedor.condicionesPago || '',
                notas: proveedor.notas || '',
                cbu: proveedor.cbu || '',
                aliasCbu: proveedor.aliasCbu || '',
                banco: proveedor.banco || '',
                tipoCuenta: proveedor.tipoCuenta || '',
                numeroCuenta: proveedor.numeroCuenta || '',
                condicionIva: proveedor.condicionIva || '',
                ingresosBrutos: proveedor.ingresosBrutos || '',
                estado: proveedor.estado,
                ordenesCompletadas: proveedor.ordenesCompletadas,
                montoTotal: proveedor.montoTotal,
              }
            : null
        }
        onProveedorSaved={() => {
          // Recargar datos del proveedor después de editar
          loadProveedorData(params.id as string);
          setIsProveedorModalOpen(false);
        }}
      />

      {/* Modal de Órdenes de Compra del proveedor */}
      <Dialog open={isOCModalOpen} onOpenChange={setIsOCModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Órdenes de Compra - {proveedor?.nombre}
            </DialogTitle>
            <DialogDescription>
              Listado de órdenes de compra del proveedor
            </DialogDescription>
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
              {/* Resumen */}
              <div className="flex items-center gap-4 text-sm">
                <Badge variant="secondary">{ordenesCompra.length} orden{ordenesCompra.length !== 1 ? 'es' : ''}</Badge>
                <span className="text-muted-foreground">
                  Total: <span className="font-semibold text-foreground">{formatCurrency(ordenesCompra.reduce((sum, oc) => sum + oc.total, 0))}</span>
                </span>
              </div>

              {/* Tabla de OC */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="font-medium">Número</TableHead>
                      <TableHead className="font-medium">Fecha</TableHead>
                      <TableHead className="font-medium">Items</TableHead>
                      <TableHead className="font-medium">Total</TableHead>
                      <TableHead className="font-medium">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordenesCompra.slice(0, 5).map((oc) => (
                      <TableRow key={oc.id}>
                        <TableCell className="text-xs">{oc.numero}</TableCell>
                        <TableCell className="text-sm">{formatDate(oc.fecha)}</TableCell>
                        <TableCell className="text-sm">{oc.itemsCount}</TableCell>
                        <TableCell className="text-sm font-medium">{formatCurrency(oc.total)}</TableCell>
                        <TableCell>
                          <Badge variant={oc.estado === 'completada' ? 'default' : oc.estado === 'pendiente' ? 'outline' : 'secondary'}>
                            {oc.estado}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {ordenesCompra.length > 5 && (
                <p className="text-xs text-muted-foreground text-center">
                  Mostrando 5 de {ordenesCompra.length} órdenes
                </p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsOCModalOpen(false)}>
              Cerrar
            </Button>
            <Button onClick={() => {
              setIsOCModalOpen(false);
              router.push(`/administracion/compras/ordenes-compra?proveedorId=${proveedor?.id}`);
            }}>
              Ver todas las OC
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Visor de PDF de la orden de pago dentro de ORVIT */}
      <Dialog
        open={isPdfModalOpen && !!pdfUrl}
        onOpenChange={(open) => {
          setIsPdfModalOpen(open);
          if (!open && pdfUrl) {
            URL.revokeObjectURL(pdfUrl);
            setPdfUrl(null);
            // Cerrar el modal de registrar pago cuando se cierra el PDF
            setIsPagoModalOpen(false);
          }
        }}
      >
        <DialogContent className="max-w-6xl w-full max-h-[98vh]">
          <DialogHeader>
            <DialogTitle>Orden de pago - Vista previa</DialogTitle>
          </DialogHeader>
          <div className="mt-2 h-[88vh]">
            {pdfUrl && (
              <iframe
                src={pdfUrl}
                className="w-full h-full border rounded-md"
                title="Orden de pago PDF"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal genérico de confirmación de eliminación para facturas */}
      <DeleteConfirmDialog
        open={isDeleteFacturaOpen && !!facturaAEliminar}
        title="Eliminar factura"
        itemName={facturaAEliminar ? `la factura ${facturaAEliminar.numero}` : undefined}
        onCancel={() => {
          if (deleteFacturaLoading) return;
          setIsDeleteFacturaOpen(false);
          setFacturaAEliminar(null);
        }}
        onConfirm={confirmarEliminarFactura}
        loading={deleteFacturaLoading}
      />

      {/* Modal genérico de confirmación de eliminación para órdenes de pago */}
      <DeleteConfirmDialog
        open={isDeleteOrdenPagoOpen && !!ordenPagoAEliminar}
        title="Eliminar orden de pago"
        itemName={
          ordenPagoAEliminar
            ? `la orden de pago #${ordenPagoAEliminar.id}`
            : undefined
        }
        description="¿Seguro que querés eliminar esta orden de pago? Esto recalculará el estado de las facturas asociadas."
        onCancel={() => {
          if (deleteOrdenPagoLoading) return;
          setIsDeleteOrdenPagoOpen(false);
          setOrdenPagoAEliminar(null);
        }}
        onConfirm={confirmarEliminarOrdenPago}
        loading={deleteOrdenPagoLoading}
      />

      {/* Modal de detalle del item con evolución de precios */}
      <Dialog open={isItemDetalleOpen} onOpenChange={setIsItemDetalleOpen}>
        <DialogContent size="lg" className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4 text-primary" />
              {selectedItemDetalle?.stockLocations?.[0]?.descripcionItem || selectedItemDetalle?.nombre}
            </DialogTitle>
            <DialogDescription className="text-sm">
              Análisis de precios históricos • {selectedItemDetalle?.cantidadCompras || 0} compras registradas
            </DialogDescription>
          </DialogHeader>

          {selectedItemDetalle && (
            <div className="space-y-4 px-4 py-2">
              {/* Estadísticas resumen */}
              {(() => {
                const history = selectedItemDetalle.priceHistory || [];
                if (history.length === 0) return null;

                const precios = history.map(h => Number(h.precioUnitario));
                const precioActual = precios[0] || 0;
                const precioMinimo = Math.min(...precios);
                const precioMaximo = Math.max(...precios);
                const precioPromedio = precios.reduce((a, b) => a + b, 0) / precios.length;
                const primeraCompra = history[history.length - 1];
                const precioInicial = primeraCompra ? Number(primeraCompra.precioUnitario) : precioActual;
                const variacionTotal = precioInicial > 0 ? ((precioActual - precioInicial) / precioInicial) * 100 : 0;

                return (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    <div className="p-2 bg-primary/5 rounded-md border border-primary/20">
                      <p className="text-xs text-muted-foreground">Precio Actual</p>
                      <p className="font-bold text-base text-primary">
                        ${precioActual.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div className="p-2 bg-muted/50 rounded-md">
                      <p className="text-xs text-muted-foreground">Mínimo</p>
                      <p className="font-semibold text-sm text-success">
                        ${precioMinimo.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div className="p-2 bg-muted/50 rounded-md">
                      <p className="text-xs text-muted-foreground">Máximo</p>
                      <p className="font-semibold text-sm text-destructive">
                        ${precioMaximo.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div className="p-2 bg-muted/50 rounded-md">
                      <p className="text-xs text-muted-foreground">Promedio</p>
                      <p className="font-semibold text-sm">
                        ${precioPromedio.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div className={`p-2 rounded-md ${variacionTotal > 0 ? 'bg-destructive/10 border border-destructive/30' : variacionTotal < 0 ? 'bg-success-muted border border-success-muted' : 'bg-muted/50'}`}>
                      <p className="text-xs text-muted-foreground">Var. Total</p>
                      <div className="flex items-center gap-1">
                        {variacionTotal > 0 ? (
                          <TrendingUp className="w-3 h-3 text-destructive" />
                        ) : variacionTotal < 0 ? (
                          <TrendingDown className="w-3 h-3 text-success" />
                        ) : null}
                        <p className={`font-bold text-sm ${variacionTotal > 0 ? 'text-destructive' : variacionTotal < 0 ? 'text-success' : ''}`}>
                          {variacionTotal > 0 ? '+' : ''}{variacionTotal.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Info adicional del item */}
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Unidad:</span>
                  <Badge variant="outline" className="text-xs">{selectedItemDetalle.unidad}</Badge>
                </div>
                {selectedItemDetalle.codigoProveedor && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Código:</span>
                    <Badge variant="secondary" className="text-xs">{selectedItemDetalle.codigoProveedor}</Badge>
                  </div>
                )}
                {selectedItemDetalle.supply && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Item sistema:</span>
                    <span className="text-primary font-medium text-xs">{selectedItemDetalle.supply.name}</span>
                  </div>
                )}
              </div>

              {/* Gráfico de evolución mejorado */}
              {selectedItemDetalle.priceHistory && selectedItemDetalle.priceHistory.length > 1 && (
                <div className="p-3 border rounded-md bg-gradient-to-b from-muted/20 to-transparent">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                    <h4 className="text-sm font-semibold flex items-center gap-1.5">
                      <History className="w-4 h-4 text-primary" />
                      Evolución de Precios
                    </h4>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground mr-2">Período:</span>
                      {[
                        { value: 'todos', label: 'Todos' },
                        { value: '3m', label: '3 meses' },
                        { value: '6m', label: '6 meses' },
                        { value: '12m', label: '12 meses' },
                      ].map((opt) => (
                        <Button
                          key={opt.value}
                          variant={modalDateRange === opt.value ? 'secondary' : 'ghost'}
                          size="sm"
                          className="h-7 text-xs px-2"
                          onClick={() => setModalDateRange(opt.value as any)}
                        >
                          {opt.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="relative">
                    {/* Eje Y labels */}
                    {(() => {
                      // Filtrar por fecha según modalDateRange
                      const now = new Date();
                      const getMonthsAgo = (months: number) => {
                        const date = new Date();
                        date.setMonth(date.getMonth() - months);
                        return date;
                      };
                      const filterDate = modalDateRange === '3m' ? getMonthsAgo(3)
                        : modalDateRange === '6m' ? getMonthsAgo(6)
                        : modalDateRange === '12m' ? getMonthsAgo(12)
                        : null;

                      const filteredHistory = filterDate
                        ? selectedItemDetalle.priceHistory.filter(h => new Date(h.fecha) >= filterDate)
                        : selectedItemDetalle.priceHistory;

                      const history = [...filteredHistory].reverse().slice(-12);
                      const maxPrice = Math.max(...history.map(h => Number(h.precioUnitario)));
                      const minPrice = Math.min(...history.map(h => Number(h.precioUnitario)));
                      return (
                        <div className="absolute left-0 top-0 bottom-4 flex flex-col justify-between text-[10px] text-muted-foreground pr-1 w-12">
                          <span>${(maxPrice/1000).toFixed(0)}k</span>
                          <span>${(minPrice/1000).toFixed(0)}k</span>
                        </div>
                      );
                    })()}
                    {/* Chart */}
                    <div className="ml-14 h-32 flex items-end gap-1">
                      {(() => {
                        // Filtrar por fecha según modalDateRange
                        const getMonthsAgo = (months: number) => {
                          const date = new Date();
                          date.setMonth(date.getMonth() - months);
                          return date;
                        };
                        const filterDate = modalDateRange === '3m' ? getMonthsAgo(3)
                          : modalDateRange === '6m' ? getMonthsAgo(6)
                          : modalDateRange === '12m' ? getMonthsAgo(12)
                          : null;

                        const filteredHistory = filterDate
                          ? selectedItemDetalle.priceHistory.filter(h => new Date(h.fecha) >= filterDate)
                          : selectedItemDetalle.priceHistory;

                        const history = [...filteredHistory].reverse().slice(-12);
                        const maxPrice = Math.max(...history.map(h => Number(h.precioUnitario)));
                        const minPrice = Math.min(...history.map(h => Number(h.precioUnitario)));
                        const range = maxPrice - minPrice || 1;

                        return history.map((h, idx) => {
                          const height = ((Number(h.precioUnitario) - minPrice) / range) * 100;
                          const isLast = idx === history.length - 1;
                          const prev = idx > 0 ? history[idx - 1] : null;
                          const diff = prev ? Number(h.precioUnitario) - Number(prev.precioUnitario) : 0;
                          const isIncrease = diff > 0;

                          return (
                            <TooltipProvider key={h.id}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={`flex-1 rounded-t transition-all cursor-pointer hover:opacity-80 ${
                                      isLast
                                        ? 'bg-primary shadow-lg'
                                        : isIncrease
                                          ? 'bg-destructive/60'
                                          : 'bg-success/60'
                                    }`}
                                    style={{ height: `${Math.max(height, 8)}%`, minWidth: '12px' }}
                                  />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-center">
                                  <p className="font-bold">${Number(h.precioUnitario).toLocaleString('es-AR', { minimumFractionDigits: 0 })}</p>
                                  <p className="text-xs">{new Date(h.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })}</p>
                                  {diff !== 0 && (
                                    <p className={`text-xs font-medium ${isIncrease ? 'text-destructive' : 'text-success'}`}>
                                      {isIncrease ? '▲' : '▼'} {Math.abs(diff).toLocaleString('es-AR')} ({((diff / Number(prev?.precioUnitario || 1)) * 100).toFixed(1)}%)
                                    </p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        });
                      })()}
                    </div>
                    {/* Eje X labels */}
                    <div className="ml-14 flex justify-between text-[10px] text-muted-foreground mt-1">
                      <span>
                        {selectedItemDetalle.priceHistory.length > 0
                          ? new Date(selectedItemDetalle.priceHistory[selectedItemDetalle.priceHistory.length - 1].fecha).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })
                          : ''
                        }
                      </span>
                      <span>
                        {selectedItemDetalle.priceHistory.length > 0
                          ? new Date(selectedItemDetalle.priceHistory[0].fecha).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })
                          : ''
                        }
                      </span>
                    </div>
                  </div>
                  {/* Leyenda */}
                  <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded bg-success/60" />
                      <span>Bajó</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded bg-destructive/60" />
                      <span>Subió</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded bg-primary" />
                      <span>Actual</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tabla de historial mejorada */}
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />
                  Historial de Compras
                </h4>
                {selectedItemDetalle.priceHistory && selectedItemDetalle.priceHistory.length > 0 ? (
                  <div className="border rounded-md overflow-hidden max-h-48 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="text-xs font-semibold py-2">Fecha</TableHead>
                          <TableHead className="text-xs font-semibold text-right py-2">Precio</TableHead>
                          <TableHead className="text-xs font-semibold text-right py-2">Variación</TableHead>
                          <TableHead className="text-xs font-semibold py-2">Comprobante</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedItemDetalle.priceHistory.map((h, idx) => {
                          const prev = selectedItemDetalle.priceHistory?.[idx + 1];
                          const diff = prev ? Number(h.precioUnitario) - Number(prev.precioUnitario) : 0;
                          const diffPercent = prev && Number(prev.precioUnitario) > 0
                            ? (diff / Number(prev.precioUnitario)) * 100
                            : 0;
                          const isFirst = idx === 0;

                          return (
                            <TableRow key={h.id} className={isFirst ? 'bg-primary/5' : ''}>
                              <TableCell className="py-1.5">
                                <div className="flex items-center gap-1">
                                  {isFirst && <Badge variant="default" className="text-[10px] px-1 py-0">Últ</Badge>}
                                  <span className="text-xs">{new Date(h.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right py-1.5">
                                <span className={`font-semibold text-xs ${isFirst ? 'text-primary' : ''}`}>
                                  ${Number(h.precioUnitario).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                </span>
                              </TableCell>
                              <TableCell className="text-right py-1.5">
                                {diff !== 0 ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] px-1 py-0 ${diff > 0 ? 'border-destructive/30 text-destructive' : 'border-success-muted text-success'}`}
                                    >
                                      {diff > 0 ? '+' : ''}{diffPercent.toFixed(1)}%
                                    </Badge>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground py-1.5">
                                {h.comprobante ? (
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs">
                                      {h.comprobante.numeroSerie || ''}{h.comprobante.numeroSerie && h.comprobante.numeroFactura ? '-' : ''}{h.comprobante.numeroFactura || ''}
                                    </span>
                                    {h.comprobante.docType === 'T2' && (
                                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">T2</Badge>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground/50">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground text-xs border rounded-md bg-muted/20">
                    <Package className="w-6 h-6 mx-auto mb-1 opacity-30" />
                    No hay historial de precios
                  </div>
                )}
              </div>

              {/* Calculadora de costos */}
              {selectedItemDetalle.priceHistory && selectedItemDetalle.priceHistory.length > 0 && (
                <div className="p-2 border rounded-md bg-muted/20">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <CircleDollarSign className="w-4 h-4 text-primary" />
                    Calculadora
                  </h4>
                  <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs">Cant:</Label>
                      <Input
                        type="number"
                        value={calculadoraCantidad}
                        onChange={(e) => setCalculadoraCantidad(e.target.value)}
                        className="w-20 h-7 text-xs"
                        min="0"
                        step="1"
                      />
                      <span className="text-xs text-muted-foreground">{selectedItemDetalle.unidad}</span>
                    </div>
                    {(() => {
                      const qty = parseFloat(calculadoraCantidad) || 0;
                      const history = selectedItemDetalle.priceHistory || [];
                      const precios = history.map(h => Number(h.precioUnitario));
                      const precioActual = precios[0] || 0;
                      const precioMin = Math.min(...precios);
                      const precioMax = Math.max(...precios);
                      const precioAvg = precios.reduce((a, b) => a + b, 0) / precios.length;

                      return (
                        <div className="flex flex-wrap gap-2">
                          <div className="text-center px-2 py-1 bg-primary/10 rounded-md border border-primary/20">
                            <p className="text-[10px] text-muted-foreground">Actual</p>
                            <p className="font-bold text-sm text-primary">
                              ${(qty * precioActual).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </p>
                          </div>
                          <div className="text-center px-2 py-1 bg-success-muted rounded-md border border-success-muted">
                            <p className="text-[10px] text-muted-foreground">Mín</p>
                            <p className="font-semibold text-sm text-success">
                              ${(qty * precioMin).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </p>
                          </div>
                          <div className="text-center px-2 py-1 bg-destructive/10 rounded-md border border-destructive/30">
                            <p className="text-[10px] text-muted-foreground">Máx</p>
                            <p className="font-semibold text-sm text-destructive">
                              ${(qty * precioMax).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </p>
                          </div>
                          <div className="text-center px-2 py-1 bg-muted/50 rounded-md">
                            <p className="text-[10px] text-muted-foreground">Prom</p>
                            <p className="font-semibold text-sm">
                              ${(qty * precioAvg).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-2 px-4 flex-row justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={generarItemPriceHistoryPDF}
              disabled={!selectedItemDetalle?.priceHistory?.length}
            >
              <Download className="w-3 h-3 mr-1" />
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsItemDetalleOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Agregar Nuevo Item */}
      <Dialog open={isNuevoItemOpen} onOpenChange={setIsNuevoItemOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Agregar Item al Catálogo
            </DialogTitle>
            <DialogDescription>
              Crear un nuevo item en el catálogo de este proveedor
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="item-nombre">Nombre del Item *</Label>
              <Input
                id="item-nombre"
                placeholder="Ej: Aceite lubricante 20W-50"
                value={nuevoItemForm.nombre}
                onChange={(e) => setNuevoItemForm(prev => ({ ...prev, nombre: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-descripcion">Descripción</Label>
              <Textarea
                id="item-descripcion"
                placeholder="Descripción opcional del item..."
                value={nuevoItemForm.descripcion}
                onChange={(e) => setNuevoItemForm(prev => ({ ...prev, descripcion: e.target.value }))}
                className="resize-none"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="item-codigo">Código Proveedor</Label>
                <Input
                  id="item-codigo"
                  placeholder="Ej: SKU-001"
                  value={nuevoItemForm.codigoProveedor}
                  onChange={(e) => setNuevoItemForm(prev => ({ ...prev, codigoProveedor: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-unidad">Unidad</Label>
                <Select
                  value={nuevoItemForm.unidad}
                  onValueChange={(value) => setNuevoItemForm(prev => ({ ...prev, unidad: value }))}
                >
                  <SelectTrigger id="item-unidad">
                    <SelectValue placeholder="Unidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UN">Unidad (UN)</SelectItem>
                    <SelectItem value="KG">Kilogramo (KG)</SelectItem>
                    <SelectItem value="LT">Litro (LT)</SelectItem>
                    <SelectItem value="MT">Metro (MT)</SelectItem>
                    <SelectItem value="M2">Metro² (M2)</SelectItem>
                    <SelectItem value="M3">Metro³ (M3)</SelectItem>
                    <SelectItem value="CAJ">Caja (CAJ)</SelectItem>
                    <SelectItem value="PAQ">Paquete (PAQ)</SelectItem>
                    <SelectItem value="ROL">Rollo (ROL)</SelectItem>
                    <SelectItem value="BLS">Bolsa (BLS)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-precio">Precio Unitario (opcional)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="item-precio"
                  type="number"
                  placeholder="0.00"
                  value={nuevoItemForm.precioUnitario}
                  onChange={(e) => setNuevoItemForm(prev => ({ ...prev, precioUnitario: e.target.value }))}
                  className="pl-7"
                  min="0"
                  step="0.01"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                El precio se actualizará automáticamente con cada factura cargada
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNuevoItemOpen(false)} disabled={isSubmittingItem}>
              Cancelar
            </Button>
            <Button onClick={handleCrearItem} disabled={isSubmittingItem || !nuevoItemForm.nombre.trim()}>
              {isSubmittingItem ? 'Creando...' : 'Crear Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para ver fotos y firma de recepción */}
      <Dialog open={!!recepcionVistaModal} onOpenChange={(open) => !open && setRecepcionVistaModal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Evidencia de Recepción</DialogTitle>
            <DialogDescription>
              Fotos y firma de la recepción de mercadería
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {recepcionVistaModal?.adjuntos && recepcionVistaModal.adjuntos.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Fotos / Remito</h4>
                <div className="grid grid-cols-2 gap-3">
                  {recepcionVistaModal.adjuntos.map((url, idx) => (
                    <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="block">
                      <img src={url} alt={`Adjunto ${idx + 1}`} className="w-full h-40 object-cover rounded border hover:opacity-80" />
                    </a>
                  ))}
                </div>
              </div>
            )}
            {recepcionVistaModal?.firma && (
              <div>
                <h4 className="text-sm font-medium mb-2">Firma de Confirmación</h4>
                <div className="border rounded p-2 bg-background">
                  <img src={recepcionVistaModal.firma} alt="Firma" className="max-h-32 mx-auto" />
                </div>
              </div>
            )}
            {!recepcionVistaModal?.adjuntos?.length && !recepcionVistaModal?.firma && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay evidencia disponible para esta recepción.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecepcionVistaModal(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de detalle de recepción */}
      <RecepcionDetalleModal
        open={recepcionDetalleModalOpen}
        onOpenChange={setRecepcionDetalleModalOpen}
        recepcionId={recepcionDetalleId}
      />

      {/* Pie fijo para firma y sello SOLO en impresión */}
      <div
        className="hidden print:flex justify-center items-center text-xs"
        style={{ position: 'fixed', bottom: '5mm', left: 0, right: 0 }}
      >
        <div className="w-64 text-center">
          <div className="border-t border-black mb-1" />
          <p>Firma y Sello</p>
        </div>
      </div>

      {/* Estilos globales */}
      <style jsx global>{`
        /* Ocultar el botón de cerrar (X) de los diálogos en toda la app */
        button[aria-label='Close'] {
          display: none !important;
        }

        @media print {
          .sonner-toaster {
            display: none !important;
          }
          html,
          body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
        @page {
          margin-top: 0mm;
          margin-right: 10mm;
          margin-bottom: 10mm;
          margin-left: 10mm;
        }
      `}</style>
    </div>
  );
}

