'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  FileText,
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  Building2,
  Calendar,
  DollarSign,
  CreditCard,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Check,
  ChevronsUpDown,
  AlertCircle,
  ArrowRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Upload,
  Download,
  ChevronDown,
  ChevronUp,
  BarChart3,
  MoreHorizontal,
  Truck,
  Package,
  RefreshCw,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import ComprobanteFormModal from '@/components/compras/comprobante-form-modal';
import { CargarRemitoDesdeFacturaModal } from '@/components/compras/cargar-remito-desde-factura-modal';
import { NcaFromFacturaModal } from '@/components/compras/nca-from-factura-modal';
import { DevolucionFromDocumentModal } from '@/components/compras/devolucion-from-document-modal';
// import { useCompany } from '@/contexts/company-context';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import { DatePicker } from '@/components/ui/date-picker';
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
  unidad: string;
  precioUnitario?: number;
  proveedorId: string;
}

interface ComprobanteItem {
  id: string;
  itemId?: string; // ID del item del proveedor
  descripcion: string;
  cantidad: number;
  unidad?: string;
  precioUnitario?: number;
  subtotal: number;
  proveedorId: string; // ID del proveedor usado para este item
  codigoProveedor?: string;
}

interface Comprobante {
  id: string;
  numeroSerie: string;
  numeroFactura: string;
  tipo: string;
  proveedorId: string;
  proveedorNombre: string;
  proveedorCuit: string;
  fechaEmision: Date;
  fechaVencimiento?: Date;
  fechaImputacion: Date;
  tipoPago: 'contado' | 'cta_cte';
  metodoPago?: string;
  items: ComprobanteItem[];
  total: number;
  tipoCuenta: string;
  estado: 'pendiente' | 'pagada' | 'vencida';
  observaciones?: string;
  pagoUrgente?: boolean;
  createdAt: Date;
  // Control de remito
  ingresoConfirmado?: boolean;
  ingresoConfirmadoAt?: Date;
  firmaIngreso?: string;
  remitoUrl?: string;
  fotoIngresoUrl?: string;
  remitoEstado?: 'confirmado' | 'borrador' | 'sin_remito';
  goodsReceiptNumero?: string;
  goodsReceiptEstado?: string;
  // Tipo de documento: T1 = AFIP, T2 = Extendido
  docType?: 'T1' | 'T2';
}

export default function ComprobantesPage() {
  const confirm = useConfirm();
  const router = useRouter();
  // const { company } = useCompany();
  const { mode: viewMode } = useViewMode();
  const [comprobantes, setComprobantes] = useState<Comprobante[]>([]);
  const [updatingUrgente, setUpdatingUrgente] = useState<string | null>(null);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState<string>('all');
  const [estadoFilter, setEstadoFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  // Sorting state
  const [sortField, setSortField] = useState<'fechaEmision' | 'fechaVencimiento' | 'total' | 'proveedor' | 'estado' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Date filters
  const [fechaDesde, setFechaDesde] = useState<string>('');
  const [fechaHasta, setFechaHasta] = useState<string>('');

  // Mass selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // KPIs visibility
  const [showKpis, setShowKpis] = useState(false);

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
    items: [] as Array<{ id: string; itemId?: string; descripcion: string; cantidad: string; unidad: string; precioUnitario: string; subtotal: string; proveedorId: string }>,
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
  });

  const [proveedorSearchResults, setProveedorSearchResults] = useState<Proveedor[]>([]);
  const [showProveedorSearch, setShowProveedorSearch] = useState(false);
  const [proveedorPopoverOpen, setProveedorPopoverOpen] = useState(false);
  const [proveedorItems, setProveedorItems] = useState<ProveedorItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemPopoverOpen, setItemPopoverOpen] = useState<Record<string, boolean>>({});
  const [isCreateItemModalOpen, setIsCreateItemModalOpen] = useState(false);
  const [creatingItemFor, setCreatingItemFor] = useState<string>(''); // ID del item del comprobante para el cual se está creando
  const [newItemForm, setNewItemForm] = useState({
    nombre: '',
    descripcion: '',
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
  const [editingComprobanteId, setEditingComprobanteId] = useState<string | null>(null);
  const [editingDocType, setEditingDocType] = useState<'T1' | 'T2' | null>(null);
  const searchParams = useSearchParams();
  const [comprobanteAEliminar, setComprobanteAEliminar] = useState<Comprobante | null>(null);
  const [isDeleteComprobanteOpen, setIsDeleteComprobanteOpen] = useState(false);
  const [deleteComprobanteLoading, setDeleteComprobanteLoading] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Modal de confirmar ingreso de stock
  const [confirmarIngresoOpen, setConfirmarIngresoOpen] = useState(false);
  const [confirmarIngresoComprobante, setConfirmarIngresoComprobante] = useState<Comprobante | null>(null);

  // Modal de NCA desde factura
  const [ncaModalOpen, setNcaModalOpen] = useState(false);
  const [ncaFacturaData, setNcaFacturaData] = useState<{
    facturaId: number;
    facturaNumero: string;
    proveedorId: number;
    proveedorNombre: string;
    items: any[];
    totalFactura: number;
  } | null>(null);

  // Modal de Devolucion desde factura
  const [devolucionModalOpen, setDevolucionModalOpen] = useState(false);
  const [devolucionFacturaData, setDevolucionFacturaData] = useState<{
    facturaId: number;
    facturaNumero: string;
    proveedorId: number;
    proveedorNombre: string;
    items: any[];
    docType?: 'T1' | 'T2';
  } | null>(null);

  const tiposComprobantes = [
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

  const abrirEliminarComprobante = (c: Comprobante) => {
    setComprobanteAEliminar(c);
    setIsDeleteComprobanteOpen(true);
  };

  const confirmarEliminarComprobante = async () => {
    if (!comprobanteAEliminar) return;
    setDeleteComprobanteLoading(true);
    try {
      const docTypeParam = comprobanteAEliminar.docType ? `?docType=${comprobanteAEliminar.docType}` : '';
      const resp = await fetch(`/api/compras/comprobantes/${comprobanteAEliminar.id}${docTypeParam}`, {
        method: 'DELETE',
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        console.error('[COMPROBANTES] Error al eliminar comprobante:', data);
        toast.error(data?.error || 'Error al eliminar el comprobante');
        return;
      }

      toast.success('Comprobante eliminado correctamente');
      await loadComprobantes();
      setIsDeleteComprobanteOpen(false);
      setComprobanteAEliminar(null);
    } catch (error) {
      console.error('[COMPROBANTES] Error inesperado al eliminar comprobante:', error);
      toast.error('Error inesperado al eliminar el comprobante');
    } finally {
      setDeleteComprobanteLoading(false);
    }
  };

  const togglePagoUrgente = async (comprobante: Comprobante) => {
    setUpdatingUrgente(comprobante.id);
    try {
      const response = await fetch(`/api/compras/comprobantes/${comprobante.id}/urgente`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pagoUrgente: !comprobante.pagoUrgente }),
      });

      if (!response.ok) {
        throw new Error('Error al actualizar estado urgente');
      }

      toast.success(
        comprobante.pagoUrgente 
          ? 'Factura desmarcada como pago urgente' 
          : 'Factura marcada como pago urgente'
      );
      await loadComprobantes();
    } catch (error) {
      console.error('Error actualizando pago urgente:', error);
      toast.error('Error al actualizar estado urgente');
    } finally {
      setUpdatingUrgente(null);
    }
  };

  const handleSacarPago = (comprobante: Comprobante) => {
    // Navegar a la cuenta corriente del proveedor con la factura preseleccionada
    router.push(`/administracion/compras/proveedores/${comprobante.proveedorId}?selectInvoice=${comprobante.id}&tab=cuentas`);
  };

  // Abrir modal de NCA desde factura
  const handleCrearNcaDesdeFactura = async (comprobante: Comprobante) => {
    // Solo para facturas (no notas de credito ni debito) - T2/PPT también puede generar NCA
    if (!comprobante.tipo.startsWith('Factura') && comprobante.docType !== 'T2') {
      toast.error('Solo puede crear NCA desde una factura');
      return;
    }

    try {
      // Cargar detalle completo del comprobante
      const docTypeParam = comprobante.docType ? `?docType=${comprobante.docType}` : '';
      const response = await fetch(`/api/compras/comprobantes/${comprobante.id}${docTypeParam}`);
      if (!response.ok) throw new Error('Error al cargar factura');
      const data = await response.json();

      setNcaFacturaData({
        facturaId: Number(comprobante.id),
        facturaNumero: `${comprobante.numeroSerie}-${comprobante.numeroFactura}`,
        proveedorId: Number(comprobante.proveedorId),
        proveedorNombre: comprobante.proveedorNombre,
        items: (data.items || []).map((item: any) => ({
          id: item.id,
          itemId: item.itemId,
          descripcion: item.descripcion,
          cantidad: Number(item.cantidad),
          unidad: item.unidad || 'UN',
          precioUnitario: Number(item.precioUnitario) || 0,
          subtotal: Number(item.subtotal) || 0,
        })),
        totalFactura: comprobante.total,
        facturaDocType: comprobante.docType || 'T1',
      });
      setNcaModalOpen(true);
    } catch (error) {
      console.error('Error cargando factura:', error);
      toast.error('Error al cargar datos de la factura');
    }
  };

  // Abrir modal de Devolucion desde factura
  const handleCrearDevolucionDesdeFactura = async (comprobante: Comprobante) => {
    // Solo para facturas - T2/PPT también puede generar devolución
    if (!comprobante.tipo.startsWith('Factura') && comprobante.docType !== 'T2') {
      toast.error('Solo puede crear devolucion desde una factura');
      return;
    }

    try {
      // Cargar detalle completo del comprobante
      const docTypeParam = comprobante.docType ? `?docType=${comprobante.docType}` : '';
      const response = await fetch(`/api/compras/comprobantes/${comprobante.id}${docTypeParam}`);
      if (!response.ok) throw new Error('Error al cargar factura');
      const data = await response.json();

      setDevolucionFacturaData({
        facturaId: Number(comprobante.id),
        facturaNumero: `${comprobante.numeroSerie}-${comprobante.numeroFactura}`,
        proveedorId: Number(comprobante.proveedorId),
        proveedorNombre: comprobante.proveedorNombre,
        docType: (comprobante.docType as 'T1' | 'T2') || (data.docType as 'T1' | 'T2') || 'T1',
        items: (data.items || []).map((item: any) => ({
          id: item.id,
          supplierItemId: item.itemId,
          descripcion: item.descripcion,
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

  // Cargar cuentas desde la API
  const loadCuentas = async () => {
    setLoadingCuentas(true);
    try {
      const response = await fetch('/api/compras/cuentas');
      if (response.ok) {
        const data = await response.json();
        // Filtrar solo las cuentas activas
        setCuentas(data.filter((c: any) => c.activa));
      }
    } catch (error) {
      console.error('Error loading cuentas:', error);
      toast.error('Error al cargar las cuentas');
    } finally {
      setLoadingCuentas(false);
    }
  };

  // Abrir modal para crear nueva cuenta
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

  // Guardar cuenta (crear o editar)
  const handleSaveCuenta = async () => {
    if (!cuentaForm.nombre.trim()) {
      toast.error('El nombre de la cuenta es requerido');
      return;
    }

    try {
      if (editingCuenta) {
        // Actualizar cuenta existente
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
        // Crear nueva cuenta
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
        // Seleccionar la nueva cuenta automáticamente
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

  // Eliminar cuenta
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
      // Si la cuenta eliminada estaba seleccionada, limpiar la selección
      if (formData.tipoCuenta === cuentaId) {
        setFormData({ ...formData, tipoCuenta: '' });
      }
      toast.success('Cuenta eliminada exitosamente');
    } catch (error) {
      console.error('Error deleting cuenta:', error);
      toast.error('Error al eliminar la cuenta');
    }
  };

  // Filtrar cuentas por búsqueda
  const filteredCuentas = cuentas.filter(cuenta =>
    cuenta.nombre.toLowerCase().includes(cuentaSearch.toLowerCase())
  );

  const loadComprobanteParaEditar = async (id: string, docType?: string) => {
    try {
      const docTypeParam = docType ? `?docType=${docType}` : '';
      const response = await fetch(`/api/compras/comprobantes/${id}${docTypeParam}`);
      if (!response.ok) {
        throw new Error('Error al obtener el comprobante para editar');
      }
      const c = await response.json();

      // Mapear datos del backend al formData del modal
      setFormData({
        numeroSerie: c.numeroSerie || '',
        numeroFactura: c.numeroFactura || '',
        tipo: c.tipo || '',
        proveedorId: c.proveedorId ? String(c.proveedorId) : '',
        proveedorSearch: '',
        fechaEmision: c.fechaEmision,
        fechaVencimiento: c.fechaVencimiento || '',
        fechaImputacion: c.fechaImputacion,
        tipoPago: c.tipoPago || 'cta_cte',
        metodoPago: c.metodoPago || '',
        items: (c.items || []).map((i: any) => ({
          id: String(i.id),
          itemId: i.itemId ? String(i.itemId) : undefined,
          descripcion: i.descripcion || '',
          cantidad: String(i.cantidad ?? ''),
          unidad: i.unidad || '',
          precioUnitario: i.precioUnitario != null ? String(i.precioUnitario) : '',
          subtotal: i.subtotal != null ? String(i.subtotal) : '',
          proveedorId: i.proveedorId ? String(i.proveedorId) : '',
        })),
        neto: c.neto != null ? String(c.neto) : '',
        iva21: c.iva21 != null ? String(c.iva21) : '',
        noGravado: c.noGravado != null ? String(c.noGravado) : '',
        impInter: c.impInter != null ? String(c.impInter) : '',
        percepcionIVA: c.percepcionIVA != null ? String(c.percepcionIVA) : '',
        percepcionIIBB: c.percepcionIIBB != null ? String(c.percepcionIIBB) : '',
        otrosConceptos: c.otrosConceptos != null ? String(c.otrosConceptos) : '',
        iva105: c.iva105 != null ? String(c.iva105) : '',
        iva27: c.iva27 != null ? String(c.iva27) : '',
        exento: c.exento != null ? String(c.exento) : '',
        iibb: c.iibb != null ? String(c.iibb) : '',
        total: c.total != null ? String(c.total) : '',
        tipoCuenta: c.tipoCuentaId ? String(c.tipoCuentaId) : '',
        observaciones: c.observaciones || '',
      });

      setEditingComprobanteId(String(c.id));
      setIsModalOpen(true);
    } catch (error) {
      console.error('Error cargando comprobante para editar:', error);
      toast.error('No se pudo cargar el comprobante para editar');
    }
  };

  // Cargar datos cuando cambia el ViewMode para actualizar automáticamente al usar juego de tecla
  useEffect(() => {
    loadComprobantes();
    loadProveedores();
    loadCuentas();
  }, [viewMode]);

  // Si viene editId por query, abrir modal en modo edición y cargar datos
  useEffect(() => {
    const editId = searchParams.get('editId');
    const editDocType = searchParams.get('docType') || undefined;
    if (editId && !editingComprobanteId) {
      loadComprobanteParaEditar(editId, editDocType);
    }
  }, [searchParams, editingComprobanteId]);

  const loadComprobantes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tipoFilter && tipoFilter !== 'all') params.set('tipo', tipoFilter);
      if (estadoFilter && estadoFilter !== 'all') params.set('estado', estadoFilter);

      const response = await fetch(`/api/compras/comprobantes?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Error al obtener los comprobantes');
      }

      const data = await response.json();

      const mapped: Comprobante[] = (data || []).map((c: any) => ({
        id: String(c.id),
        numeroSerie: c.numeroSerie,
        numeroFactura: c.numeroFactura,
        tipo: c.tipo,
        proveedorId: String(c.proveedorId),
        proveedorNombre: c.proveedor?.razon_social || c.proveedor?.name || '',
        proveedorCuit: c.proveedor?.cuit || '',
        fechaEmision: new Date(c.fechaEmision),
        fechaVencimiento: c.fechaVencimiento ? new Date(c.fechaVencimiento) : undefined,
        fechaImputacion: new Date(c.fechaImputacion),
        tipoPago: c.tipoPago,
        metodoPago: c.metodoPago || undefined,
        items: (c.items || []).map((i: any) => ({
          id: String(i.id),
          itemId: i.itemId ? String(i.itemId) : undefined,
          descripcion: i.descripcion,
          cantidad: Number(i.cantidad),
          unidad: i.unidad,
          precioUnitario: i.precioUnitario ? Number(i.precioUnitario) : undefined,
          subtotal: Number(i.subtotal),
          proveedorId: String(i.proveedorId),
          codigoProveedor: i.supplierItem?.codigoProveedor || undefined,
        })),
        total: Number(c.total),
        tipoCuenta: c.tipoCuenta?.nombre || '',
        estado: c.estado as 'pendiente' | 'pagada' | 'vencida',
        observaciones: c.observaciones || undefined,
        pagoUrgente: c.pagoUrgente || false,
        createdAt: new Date(c.createdAt),
        // Control de remito
        ingresoConfirmado: c.ingresoConfirmado || false,
        ingresoConfirmadoAt: c.ingresoConfirmadoAt ? new Date(c.ingresoConfirmadoAt) : undefined,
        remitoUrl: c.remitoUrl || undefined,
        fotoIngresoUrl: c.fotoIngresoUrl || undefined,
        remitoEstado: c.remitoEstado || 'sin_remito',
        goodsReceiptNumero: c.goodsReceiptNumero || undefined,
        goodsReceiptEstado: c.goodsReceiptEstado || undefined,
        // Tipo de documento
        docType: c.docType || 'T1',
      }));

      setComprobantes(mapped);
    } catch (error) {
      console.error('Error loading comprobantes:', error);
      toast.error('Error al cargar comprobantes');
      setComprobantes([]);
    } finally {
      setLoading(false);
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
        unidad: item.unidad,
        precioUnitario: item.precioUnitario ? Number(item.precioUnitario) : undefined,
        proveedorId: String(item.supplierId),
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

  const selectProveedor = (proveedor: Proveedor) => {
    setFormData({
      ...formData,
      proveedorId: proveedor.id,
      proveedorSearch: `${proveedor.nombre} (${proveedor.cuit})`,
    });
    setProveedorPopoverOpen(false);
    // Cargar items del proveedor seleccionado
    loadProveedorItems(proveedor.id);
    // Mover al siguiente campo después de seleccionar
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
    // Cerrar el popover si está abierto para este item
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
    // Recalcular total con los items actualizados
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
      // Crear el item en el backend: crea (si hace falta) el supply base y el vínculo SupplierItem
      const response = await fetch(`/api/compras/proveedores/${formData.proveedorId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: newItemForm.nombre,
          descripcion: newItemForm.descripcion || undefined,
          unidad: newItemForm.unidad,
          precioUnitario: newItemForm.precioUnitario || undefined,
          // No enviamos supplyId: el backend crea uno nuevo automáticamente
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
        unidad: saved.unidad,
        precioUnitario: saved.precioUnitario ? Number(saved.precioUnitario) : undefined,
        proveedorId: String(saved.supplierId),
      };

      // Agregar el nuevo item a la lista del proveedor
      setProveedorItems([...proveedorItems, nuevoItem]);

      // Si se está creando para un item específico del comprobante, seleccionarlo automáticamente
      if (creatingItemFor) {
        selectItemForComprobante(creatingItemFor, nuevoItem);
      }

      // Limpiar el formulario y cerrar el modal
      setNewItemForm({
        nombre: '',
        descripcion: '',
        unidad: '',
        precioUnitario: '',
      });
      setIsCreateItemModalOpen(false);
      setCreatingItemFor('');
      setItemPopoverOpen(prev => ({ ...prev, [creatingItemFor]: false }));

      toast.success('Item creado exitosamente');
    } catch (error) {
      console.error('Error creating item:', error);
      toast.error('Error al crear el item');
    }
  };

  const selectItemForComprobante = (comprobanteItemId: string, proveedorItem: ProveedorItem) => {
    const updatedItems = formData.items.map(item => {
      if (item.id === comprobanteItemId) {
        const updated = {
          ...item,
          itemId: proveedorItem.id,
          descripcion: proveedorItem.nombre,
          unidad: proveedorItem.unidad,
          // NO establecer precio automáticamente - debe ingresarse manualmente para historial
          // precioUnitario: proveedorItem.precioUnitario ? proveedorItem.precioUnitario.toString() : '',
          proveedorId: proveedorItem.proveedorId,
        };
        // Recalcular subtotal con el precio actual (si existe)
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

  const updateItem = (itemId: string, field: string, value: string) => {
    const updatedItems = formData.items.map(item => {
      if (item.id === itemId) {
        const updated = { ...item, [field]: value };
        // Calcular subtotal si hay cantidad y precio
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

  const calculateTotal = (formDataToCalculate?: typeof formData) => {
    const data = formDataToCalculate || formData;
    const itemsToCalculate = data.items;
    
    // Calcular subtotal de items
    const subtotalItems = itemsToCalculate.reduce((sum, item) => {
      return sum + (parseFloat(item.subtotal) || 0);
    }, 0);

    // El neto siempre es la suma de los subtotales de los items
    const neto = subtotalItems;
    
    // Calcular todos los impuestos y conceptos
    // IVA 21%: si el usuario no lo tocó manualmente, calcular como 21% del neto
    const iva21 = iva21Manual
      ? (parseFloat(data.iva21) || 0)
      : neto > 0
        ? parseFloat((neto * 0.21).toFixed(2))
        : 0;
    const noGravado = parseFloat(data.noGravado) || 0;
    const impInter = parseFloat(data.impInter) || 0;
    const percepcionIVA = parseFloat(data.percepcionIVA) || 0;
    const percepcionIIBB = parseFloat(data.percepcionIIBB) || 0;
    const otrosConceptos = parseFloat(data.otrosConceptos) || 0;
    const iva105 = parseFloat(data.iva105) || 0;
    const iva27 = parseFloat(data.iva27) || 0;
    const exento = parseFloat(data.exento) || 0;
    const iibb = parseFloat(data.iibb) || 0;

    // Total = Neto + IVA 21% + IVA 10.5% + IVA 27% + No Gravado + Imp Inter + Percep IVA + Percep IIBB + Otros Conceptos + EXENTO + IIBB
    const total = neto + iva21 + iva105 + iva27 + noGravado + impInter + percepcionIVA + percepcionIIBB + otrosConceptos + exento + iibb;

    setFormData({ 
      ...data, 
      neto: neto > 0 ? neto.toFixed(2) : '',
      iva21: iva21 > 0 ? iva21.toFixed(2) : '',
      total: total > 0 ? total.toFixed(2) : '0.00',
    });
  };

  const handleFieldChange = (field: string, value: string) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    calculateTotal(updated);
  };

  // Funciones para convertir entre formato ISO (yyyy-mm-dd) y formato español (dd/mm/yyyy)
  const formatDateToDDMMYYYY = (isoDate: string): string => {
    if (!isoDate) return '';
    // Parsear directamente desde el formato ISO para evitar problemas de zona horaria
    const parts = isoDate.split('-');
    if (parts.length !== 3) {
      // Si no está en formato ISO, intentar con Date pero usando UTC
      try {
        const date = new Date(isoDate + 'T00:00:00');
        if (isNaN(date.getTime())) return '';
        const day = String(date.getUTCDate()).padStart(2, '0');
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const year = date.getUTCFullYear();
        return `${day}/${month}/${year}`;
      } catch {
        return '';
      }
    }
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  };

  const formatDDMMYYYYToISO = (ddmmyyyy: string): string => {
    if (!ddmmyyyy) return '';
    const parts = ddmmyyyy.split('/');
    if (parts.length !== 3) return '';
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  };

  // Estado temporal para los valores de fecha mientras se escriben
  const [dateInputValues, setDateInputValues] = useState<{
    fechaEmision: string;
    fechaVencimiento: string;
    fechaImputacion: string;
  }>({
    fechaEmision: '',
    fechaVencimiento: '',
    fechaImputacion: '',
  });

  const handleDateInputChange = (field: string, value: string) => {
    // Remover caracteres no numéricos excepto barras
    let cleanValue = value.replace(/[^\d\/]/g, '');
    
    // Si el usuario borra todo, permitir campo vacío
    if (cleanValue === '') {
      setDateInputValues({ ...dateInputValues, [field]: '' });
      if (field !== 'fechaImputacion') {
        setFormData({ ...formData, [field]: '' });
      }
      return;
    }
    
    // Agregar barras automáticamente
    if (cleanValue.length === 2 && !cleanValue.includes('/')) {
      cleanValue = cleanValue + '/';
    } else if (cleanValue.length === 5 && cleanValue.split('/').length === 2) {
      // Para fechaEmision y fechaVencimiento, no agregar la barra automáticamente
      // El usuario puede escribir dd/mm y presionar Enter para completar con 2025
      if (field === 'fechaEmision' || field === 'fechaVencimiento') {
        // No agregar la tercera barra automáticamente, dejar que el usuario presione Enter
      } else {
        cleanValue = cleanValue + '/';
      }
    }
    
    // Limitar a 10 caracteres (dd/mm/yyyy)
    if (cleanValue.length <= 10) {
      // Guardar el valor formateado para mostrar
      setDateInputValues({ ...dateInputValues, [field]: cleanValue });
      
      // Si está completo, convertir a ISO y guardar en formData
      if (cleanValue.length === 10) {
        const isoValue = formatDDMMYYYYToISO(cleanValue);
        if (isoValue) {
          setFormData({ ...formData, [field]: isoValue });
        }
      }
    }
  };

  const handleDateEnter = (field: string, currentValue?: string) => {
    // Obtener el valor actual del input o del estado
    const inputValue = currentValue || dateInputValues[field as keyof typeof dateInputValues] || 
                      (formData[field as keyof typeof formData] ? formatDateToDDMMYYYY(formData[field as keyof typeof formData] as string) : '');
    
    // Si el campo es fechaEmision o fechaVencimiento y tiene formato dd/mm (5 caracteres)
    if ((field === 'fechaEmision' || field === 'fechaVencimiento') && 
        inputValue && 
        inputValue.length === 5 && 
        inputValue.includes('/') && 
        inputValue.split('/').length === 2) {
      // Completar con /2025
      const completedValue = inputValue + '/2025';
      const isoValue = formatDDMMYYYYToISO(completedValue);
      if (isoValue) {
        setFormData({ ...formData, [field]: isoValue });
        // Limpiar dateInputValues para que se muestre el valor desde formData
        setDateInputValues({ ...dateInputValues, [field]: '' });
        // Mover al siguiente campo después de un pequeño delay para asegurar que se actualice
        setTimeout(() => {
          moveToNextField(field);
        }, 50);
        return true;
      }
    }
    
    // Si ya está completo (10 caracteres), convertir y mover al siguiente campo
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
    
    // Si no está completo y no es dd/mm, intentar convertir lo que hay
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
    // Al salir del campo, convertir a ISO si está en formato dd/mm/yyyy completo
    if (inputValue && inputValue.includes('/') && inputValue.length === 10) {
      const isoValue = formatDDMMYYYYToISO(inputValue);
      if (isoValue) {
        setFormData({ ...formData, [field]: isoValue });
        // Limpiar dateInputValues para que se muestre el valor convertido desde formData
        setDateInputValues({ ...dateInputValues, [field]: '' });
      } else {
        // Si no es válido, limpiar
        setFormData({ ...formData, [field]: '' });
        setDateInputValues({ ...dateInputValues, [field]: '' });
      }
    } else if (inputValue && inputValue.length > 0 && inputValue.length < 10) {
      // Si no está completo, limpiar
      setFormData({ ...formData, [field]: '' });
      setDateInputValues({ ...dateInputValues, [field]: '' });
    } else if (!inputValue && formData[field as keyof typeof formData]) {
      // Si no hay inputValue pero hay formData, limpiar dateInputValues para mostrar formData
      setDateInputValues({ ...dateInputValues, [field]: '' });
    }
  };

  // Función para navegar al siguiente campo al presionar Enter
  const moveToNextField = (currentFieldId: string) => {
    const fieldOrder = [
      'numeroSerie',
      'numeroFactura',
      'proveedor',
      'fechaEmision',
      'fechaVencimiento',
      'fechaImputacion',
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
      // Buscar el siguiente campo disponible
      for (let i = currentIndex + 1; i < fieldOrder.length; i++) {
        const nextFieldId = fieldOrder[i];
        const nextField = document.getElementById(nextFieldId);
        
        // Saltar fechaVencimiento si está deshabilitado
        if (nextFieldId === 'fechaVencimiento' && formData.tipoPago === 'contado') {
          continue;
        }
        
        if (nextField && !nextField.hasAttribute('disabled') && nextField.offsetParent !== null) {
          nextField.focus();
          // Si es un input de tipo number, seleccionar el texto para facilitar la edición
          if (nextField instanceof HTMLInputElement && nextField.type === 'number') {
            nextField.select();
          }
          return;
        }
      }
    }
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
      const itemsPayload = formData.items.map(item => ({
        itemId: item.itemId,
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        unidad: item.unidad,
        precioUnitario: item.precioUnitario,
        subtotal: item.subtotal,
        proveedorId: item.proveedorId || formData.proveedorId,
      }));

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
      };

      const url = editingComprobanteId
        ? `/api/compras/comprobantes/${editingComprobanteId}`
        : '/api/compras/comprobantes';
      const method = editingComprobanteId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || 'Error en la API de comprobantes');
      }

      await loadComprobantes();

      toast.success(editingComprobanteId ? 'Comprobante actualizado correctamente' : 'Comprobante cargado exitosamente');
      resetForm();
      setEditingComprobanteId(null);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving comprobante:', error);
      toast.error('Error al guardar el comprobante');
    }
  };

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
    });
    setDateInputValues({
      fechaEmision: formatDateToDDMMYYYY(todayISO),
      fechaVencimiento: '',
      fechaImputacion: formatDateToDDMMYYYY(todayISO),
    });
    setEditingComprobanteId(null);
    setShowProveedorSearch(false);
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
  };

  // Inicializar fechaImputacion automáticamente cuando se abre el modal y recargar cuentas
  useEffect(() => {
    if (isModalOpen) {
      if (!formData.fechaImputacion) {
        const todayISO = new Date().toISOString().split('T')[0];
        setFormData(prev => ({
          ...prev,
          fechaImputacion: todayISO
        }));
        setDateInputValues(prev => ({
          ...prev,
          fechaImputacion: formatDateToDDMMYYYY(todayISO)
        }));
      }
      // Recargar cuentas cuando se abre el modal para tener las últimas actualizaciones
      loadCuentas();
    }
  }, [isModalOpen]);

  // Sincronizar dateInputValues cuando formData cambia desde fuera (ej: resetForm)
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getEstadoBadge = (estado: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      'pagada': 'default',
      'pendiente': 'outline',
      'vencida': 'destructive'
    };

    const labels: Record<string, string> = {
      'pagada': 'Pagada',
      'pendiente': 'Pend.',
      'vencida': 'Vencida'
    };

    return (
      <Badge variant={variants[estado] || 'outline'} className="text-[10px] px-1.5 py-0">
        {labels[estado] || estado}
      </Badge>
    );
  };

  // Check if user is filtering (for showing KPIs)
  const isFiltering = searchTerm.trim() !== '' || tipoFilter !== 'all' || estadoFilter !== 'all' || fechaDesde !== '' || fechaHasta !== '';

  // Filter and sort comprobantes
  const filteredComprobantes = comprobantes
    .filter(comp => {
      const numeroCompleto = `${comp.numeroSerie}-${comp.numeroFactura}`;
      const matchesSearch =
        numeroCompleto.toLowerCase().includes(searchTerm.toLowerCase()) ||
        comp.numeroSerie.includes(searchTerm) ||
        comp.numeroFactura.includes(searchTerm) ||
        comp.proveedorNombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        comp.proveedorCuit.includes(searchTerm);

      const matchesTipo = tipoFilter === 'all' || comp.tipo === tipoFilter;
      const matchesEstado = estadoFilter === 'all' || comp.estado === estadoFilter;

      // Date filters
      let matchesFechaDesde = true;
      let matchesFechaHasta = true;
      if (fechaDesde) {
        const desde = new Date(fechaDesde);
        matchesFechaDesde = new Date(comp.fechaEmision) >= desde;
      }
      if (fechaHasta) {
        const hasta = new Date(fechaHasta);
        hasta.setHours(23, 59, 59, 999);
        matchesFechaHasta = new Date(comp.fechaEmision) <= hasta;
      }

      return matchesSearch && matchesTipo && matchesEstado && matchesFechaDesde && matchesFechaHasta;
    })
    .sort((a, b) => {
      if (!sortField) return 0;

      let comparison = 0;
      switch (sortField) {
        case 'fechaEmision':
          comparison = new Date(a.fechaEmision).getTime() - new Date(b.fechaEmision).getTime();
          break;
        case 'fechaVencimiento':
          const fechaA = a.fechaVencimiento ? new Date(a.fechaVencimiento).getTime() : 0;
          const fechaB = b.fechaVencimiento ? new Date(b.fechaVencimiento).getTime() : 0;
          comparison = fechaA - fechaB;
          break;
        case 'total':
          comparison = a.total - b.total;
          break;
        case 'proveedor':
          comparison = a.proveedorNombre.localeCompare(b.proveedorNombre);
          break;
        case 'estado':
          comparison = a.estado.localeCompare(b.estado);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

  // Handle sorting
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Get sort icon for column
  const getSortIcon = (field: typeof sortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="h-3.5 w-3.5 text-primary" />
      : <ArrowDown className="h-3.5 w-3.5 text-primary" />;
  };

  // Mass selection handlers
  const handleSelectAll = () => {
    if (selectedIds.size === filteredComprobantes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredComprobantes.map(c => c.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // Clear selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [searchTerm, tipoFilter, estadoFilter, fechaDesde, fechaHasta]);

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    const selectedComprobantes = filteredComprobantes.filter(c => selectedIds.has(c.id));

    // Comprobantes pagados no se pueden eliminar
    const deletableComprobantes = selectedComprobantes.filter(c => c.estado !== 'pagada');
    const nonDeletableCount = selectedComprobantes.length - deletableComprobantes.length;

    if (deletableComprobantes.length === 0) {
      toast.error('Los comprobantes pagados no se pueden eliminar');
      return;
    }

    let deleteMessage = `¿Eliminar ${deletableComprobantes.length} comprobante(s)?`;
    if (nonDeletableCount > 0) {
      deleteMessage = `Se eliminarán ${deletableComprobantes.length} comprobante(s). ${nonDeletableCount} comprobante(s) pagado(s) no se pueden eliminar.`;
    }

    const ok = await confirm({
      title: 'Eliminar comprobantes',
      description: deleteMessage,
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;

    setIsBulkDeleting(true);
    let deletedCount = 0;
    let errorCount = 0;

    for (const comprobante of deletableComprobantes) {
      try {
        const docTypeParam = comprobante.docType ? `?docType=${comprobante.docType}` : '';
        const resp = await fetch(`/api/compras/comprobantes/${comprobante.id}${docTypeParam}`, {
          method: 'DELETE',
        });
        if (resp.ok) {
          deletedCount++;
        } else {
          errorCount++;
        }
      } catch {
        errorCount++;
      }
    }

    setIsBulkDeleting(false);
    setSelectedIds(new Set());

    if (deletedCount > 0) {
      toast.success(`${deletedCount} comprobante(s) eliminado(s)`);
      await loadComprobantes();
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} comprobante(s) no se pudieron eliminar`);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setTipoFilter('all');
    setEstadoFilter('all');
    setFechaDesde('');
    setFechaHasta('');
  };

  // Calculate KPIs from filtered results
  const kpis = {
    total: filteredComprobantes.length,
    pendientes: filteredComprobantes.filter(c => c.estado === 'pendiente').length,
    vencidos: filteredComprobantes.filter(c => c.estado === 'vencida').length,
    montoTotal: filteredComprobantes.reduce((sum, c) => sum + c.total, 0),
    montoPendiente: filteredComprobantes.filter(c => c.estado === 'pendiente').reduce((sum, c) => sum + c.total, 0),
  };

  return (
    <div className="w-full p-0">
      {/* Header */}
      <div className="px-4 md:px-6 pt-4 pb-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Carga de Comprobantes</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gestiona todos los comprobantes de compra
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push('/administracion/compras/comprobantes/carga-masiva')}>
              <Upload className="w-4 h-4 mr-2" />
              Carga Masiva
            </Button>
            <Button size="sm" onClick={() => setIsModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-col gap-3">
          {/* Primera fila: Búsqueda + Selectores */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px] max-w-[280px]">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>

            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {tiposComprobantes.map((tipo) => (
                  <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={estadoFilter} onValueChange={setEstadoFilter}>
              <SelectTrigger className="w-[100px] h-8 text-xs">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pagada">Pagada</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="vencida">Vencida</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1">
              <DatePicker
                value={fechaDesde}
                onChange={(date) => setFechaDesde(date)}
                placeholder="Desde"
                className="h-8 w-[130px] text-xs"
              />
              <span className="text-muted-foreground text-xs">-</span>
              <DatePicker
                value={fechaHasta}
                onChange={(date) => setFechaHasta(date)}
                placeholder="Hasta"
                className="h-8 w-[130px] text-xs"
              />
            </div>

            {isFiltering && (
              <Button
                variant="ghost"
                size="icon"
                onClick={clearFilters}
                className="h-8 w-8"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}

            <span className="text-xs text-muted-foreground ml-auto">
              {filteredComprobantes.length}/{comprobantes.length}
            </span>
          </div>

          {/* KPIs - Visible when filtering */}
          {isFiltering && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowKpis(!showKpis)}
                className="h-7 px-2 text-xs text-muted-foreground"
              >
                <BarChart3 className="h-3.5 w-3.5 mr-1" />
                {showKpis ? 'Ocultar resumen' : 'Ver resumen'}
                {showKpis ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
              </Button>
            </div>
          )}

          {isFiltering && showKpis && (
            <div className="flex flex-wrap items-center gap-4 py-2 px-3 rounded-md bg-muted/30 border border-border/50">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Total:</span>
                <span className="text-sm font-semibold">{kpis.total}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-warning-muted-foreground">Pend:</span>
                <span className="text-sm font-semibold text-warning-muted-foreground">{kpis.pendientes}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-destructive">Venc:</span>
                <span className="text-sm font-semibold text-destructive">{kpis.vencidos}</span>
              </div>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Monto:</span>
                <span className="text-sm font-semibold">{formatCurrency(kpis.montoTotal)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-info-muted-foreground">Pend $:</span>
                <span className="text-sm font-semibold text-info-muted-foreground">{formatCurrency(kpis.montoPendiente)}</span>
              </div>
            </div>
          )}

          {/* Mass actions bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 p-2 bg-primary/5 rounded-lg border border-primary/20">
              <span className="text-sm font-medium">{selectedIds.size} seleccionado(s)</span>
              <div className="flex-1" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast.info('Exportar próximamente')}
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {isBulkDeleting ? 'Eliminando...' : 'Eliminar'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
              >
                Cancelar
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Tabla de Comprobantes */}
      <div className="px-4 md:px-6 pb-6">
        {filteredComprobantes.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-xl bg-muted/50 border border-dashed border-border flex items-center justify-center mx-auto mb-4">
              <FileText className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Sin comprobantes</h3>
            <p className="text-muted-foreground">No se encontraron comprobantes con los filtros aplicados</p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 text-xs">
                    <TableHead className="w-8 px-2">
                      <Checkbox
                        checked={filteredComprobantes.length > 0 && selectedIds.size === filteredComprobantes.length}
                        onCheckedChange={handleSelectAll}
                        aria-label="Seleccionar todos"
                        className="h-3.5 w-3.5"
                      />
                    </TableHead>
                    <TableHead className="w-[90px] text-xs font-medium">N° Comprobante</TableHead>
                    <TableHead className="text-xs font-medium">Tipo</TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 select-none text-xs font-medium"
                      onClick={() => handleSort('proveedor')}
                    >
                      <div className="flex items-center gap-1">
                        Proveedor
                        {getSortIcon('proveedor')}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 select-none text-xs font-medium"
                      onClick={() => handleSort('fechaEmision')}
                    >
                      <div className="flex items-center gap-1">
                        Emisión
                        {getSortIcon('fechaEmision')}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 select-none text-xs font-medium"
                      onClick={() => handleSort('fechaVencimiento')}
                    >
                      <div className="flex items-center gap-1">
                        Venc.
                        {getSortIcon('fechaVencimiento')}
                      </div>
                    </TableHead>
                    <TableHead className="text-xs font-medium">Pago</TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 select-none text-xs font-medium text-right"
                      onClick={() => handleSort('total')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Total
                        {getSortIcon('total')}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 select-none text-xs font-medium"
                      onClick={() => handleSort('estado')}
                    >
                      <div className="flex items-center gap-1">
                        Estado
                        {getSortIcon('estado')}
                      </div>
                    </TableHead>
                    <TableHead className="text-xs font-medium text-center">Remito</TableHead>
                    <TableHead className="w-16 text-right text-xs font-medium">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredComprobantes.map((comprobante) => (
                    <TableRow key={comprobante.id} className={cn("hover:bg-muted/30", selectedIds.has(comprobante.id) && "bg-primary/5")}>
                      <TableCell className="px-2">
                        <Checkbox
                          checked={selectedIds.has(comprobante.id)}
                          onCheckedChange={() => handleSelectOne(comprobante.id)}
                          aria-label={`Seleccionar ${comprobante.numeroFactura}`}
                          className="h-3.5 w-3.5"
                        />
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="text-muted-foreground">{comprobante.numeroSerie}-</span>
                        <span className="font-medium">{comprobante.numeroFactura}</span>
                        {comprobante.pagoUrgente && (
                          <AlertCircle className="w-3 h-3 text-destructive inline ml-1" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{comprobante.tipo}</Badge>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs font-medium truncate max-w-[150px]">{comprobante.proveedorNombre}</p>
                        <p className="text-[10px] text-muted-foreground">{comprobante.proveedorCuit}</p>
                      </TableCell>
                      <TableCell className="text-xs">{formatDate(comprobante.fechaEmision)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {comprobante.fechaVencimiento ? formatDate(comprobante.fechaVencimiento) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={comprobante.tipoPago === 'contado' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                          {comprobante.tipoPago === 'contado' ? 'Contado' : 'Cta Cte'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-right">{formatCurrency(comprobante.total)}</TableCell>
                      <TableCell>{getEstadoBadge(comprobante.estado)}</TableCell>
                      <TableCell className="text-center">
                        {comprobante.remitoEstado === 'confirmado' ? (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-success-muted text-success border-success-muted">
                            <Package className="w-3 h-3 mr-1" />
                            Confirmado
                          </Badge>
                        ) : comprobante.remitoEstado === 'borrador' ? (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-info-muted text-info-muted-foreground border-info-muted">
                            <Package className="w-3 h-3 mr-1" />
                            Borrador
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-warning-muted text-warning-muted-foreground border-warning-muted">
                            <Truck className="w-3 h-3 mr-1" />
                            Sin remito
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right px-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem
                              onClick={() => router.push(`/administracion/compras/proveedores/${comprobante.proveedorId}?tab=cuentas`)}
                            >
                              <Eye className="w-3.5 h-3.5 mr-2" />
                              Ver detalle
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingComprobanteId(comprobante.id);
                                setEditingDocType(comprobante.docType as 'T1' | 'T2' || null);
                                loadComprobanteParaEditar(comprobante.id, comprobante.docType);
                              }}
                            >
                              <Edit className="w-3.5 h-3.5 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            {comprobante.estado === 'pendiente' && (
                              <DropdownMenuItem
                                onClick={() => handleSacarPago(comprobante)}
                              >
                                <CreditCard className="w-3.5 h-3.5 mr-2" />
                                Pagar
                              </DropdownMenuItem>
                            )}
                            {/* Control de remito */}
                            {comprobante.remitoEstado === 'sin_remito' && (
                              <DropdownMenuItem
                                onClick={async () => {
                                  try {
                                    const docTypeParam = comprobante.docType ? `?docType=${comprobante.docType}` : '';
                                    const resp = await fetch(`/api/compras/comprobantes/${comprobante.id}${docTypeParam}`);
                                    if (resp.ok) {
                                      const fullData = await resp.json();
                                      const comp = fullData.data || fullData;
                                      setConfirmarIngresoComprobante({
                                        ...comprobante,
                                        items: (comp.items || comprobante.items).map((item: any) => ({
                                          id: String(item.id),
                                          itemId: item.itemId ? String(item.itemId) : (item.supplierItem?.id ? String(item.supplierItem.id) : undefined),
                                          descripcion: item.descripcion || '',
                                          cantidad: Number(item.cantidad) || 0,
                                          unidad: item.unidad || 'UN',
                                          precioUnitario: Number(item.precioUnitario) || 0,
                                          subtotal: Number(item.subtotal) || 0,
                                          proveedorId: item.proveedorId ? String(item.proveedorId) : comprobante.proveedorId,
                                          codigoProveedor: item.supplierItem?.codigoProveedor || item.codigoProveedor || undefined,
                                        })),
                                        _purchaseOrderId: comp.matchResults?.[0]?.purchaseOrderId || undefined,
                                      } as any);
                                    } else {
                                      setConfirmarIngresoComprobante(comprobante);
                                    }
                                  } catch {
                                    setConfirmarIngresoComprobante(comprobante);
                                  }
                                  setConfirmarIngresoOpen(true);
                                }}
                              >
                                <Truck className="w-3.5 h-3.5 mr-2" />
                                Cargar Remito
                              </DropdownMenuItem>
                            )}
                            {comprobante.remitoEstado === 'borrador' && (
                              <DropdownMenuItem
                                onClick={() => {
                                  router.push('/administracion/compras/recepciones');
                                }}
                              >
                                <Package className="w-3.5 h-3.5 mr-2" />
                                Ver Remito (Borrador)
                              </DropdownMenuItem>
                            )}
                            {comprobante.remitoEstado === 'confirmado' && (
                              <DropdownMenuItem
                                onClick={() => {
                                  router.push('/administracion/compras/recepciones');
                                }}
                              >
                                <Package className="w-3.5 h-3.5 mr-2" />
                                Ver Remito
                              </DropdownMenuItem>
                            )}
                            {/* Crear NCA o Devolucion desde Factura */}
                            {comprobante.tipo.startsWith('Factura') && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleCrearNcaDesdeFactura(comprobante)}
                                >
                                  <FileText className="w-3.5 h-3.5 mr-2" />
                                  Crear NCA
                                </DropdownMenuItem>
                                {comprobante.remitoEstado === 'confirmado' && (
                                  <DropdownMenuItem
                                    onClick={() => handleCrearDevolucionDesdeFactura(comprobante)}
                                  >
                                    <RefreshCw className="w-3.5 h-3.5 mr-2" />
                                    Crear Devolucion
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => abrirEliminarComprobante(comprobante)}
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-2" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Carga de Comprobante */}
      <ComprobanteFormModal
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) {
            setEditingComprobanteId(null);
            setEditingDocType(null);
          }
        }}
        comprobanteId={editingComprobanteId}
        editDocType={editingDocType}
        onSaved={() => {
          loadComprobantes();
          setEditingComprobanteId(null);
          setEditingDocType(null);
        }}
      />

      {/* Modal de confirmación de eliminación de comprobante */}
      <DeleteConfirmDialog
        open={isDeleteComprobanteOpen && !!comprobanteAEliminar}
        title="Eliminar comprobante"
        itemName={comprobanteAEliminar ? `el comprobante ${comprobanteAEliminar.numeroSerie}-${comprobanteAEliminar.numeroFactura}` : undefined}
        onCancel={() => {
          if (deleteComprobanteLoading) return;
          setIsDeleteComprobanteOpen(false);
          setComprobanteAEliminar(null);
        }}
        onConfirm={confirmarEliminarComprobante}
        loading={deleteComprobanteLoading}
      />

      {/* Modal de cargar remito */}
      {confirmarIngresoComprobante && (
        <CargarRemitoDesdeFacturaModal
          open={confirmarIngresoOpen}
          onOpenChange={(open) => {
            setConfirmarIngresoOpen(open);
            if (!open) setConfirmarIngresoComprobante(null);
          }}
          factura={{
            id: Number(confirmarIngresoComprobante.id),
            numeroSerie: confirmarIngresoComprobante.numeroSerie,
            numeroFactura: confirmarIngresoComprobante.numeroFactura,
            proveedorId: Number(confirmarIngresoComprobante.proveedorId),
            proveedor: {
              id: Number(confirmarIngresoComprobante.proveedorId),
              name: confirmarIngresoComprobante.proveedorNombre,
            },
            items: confirmarIngresoComprobante.items.map((item) => ({
              id: Number(item.id),
              descripcion: item.descripcion,
              cantidad: item.cantidad,
              unidad: item.unidad || 'UN',
              precioUnitario: item.precioUnitario || 0,
              itemId: item.itemId ? Number(item.itemId) : undefined,
              codigoProveedor: item.codigoProveedor || undefined,
            })),
            docType: confirmarIngresoComprobante.docType,
            purchaseOrderId: (confirmarIngresoComprobante as any)._purchaseOrderId || undefined,
          }}
          onSuccess={() => loadComprobantes()}
        />
      )}

      {/* Modal de NCA desde factura */}
      {ncaFacturaData && (
        <NcaFromFacturaModal
          open={ncaModalOpen}
          onClose={() => {
            setNcaModalOpen(false);
            setNcaFacturaData(null);
          }}
          onSuccess={() => {
            loadComprobantes();
            setNcaModalOpen(false);
            setNcaFacturaData(null);
          }}
          facturaId={ncaFacturaData.facturaId}
          facturaNumero={ncaFacturaData.facturaNumero}
          proveedorId={ncaFacturaData.proveedorId}
          proveedorNombre={ncaFacturaData.proveedorNombre}
          items={ncaFacturaData.items}
          totalFactura={ncaFacturaData.totalFactura}
        />
      )}

      {/* Modal de Devolucion desde factura */}
      {devolucionFacturaData && (
        <DevolucionFromDocumentModal
          open={devolucionModalOpen}
          onClose={() => {
            setDevolucionModalOpen(false);
            setDevolucionFacturaData(null);
          }}
          onSuccess={() => {
            loadComprobantes();
            setDevolucionModalOpen(false);
            setDevolucionFacturaData(null);
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
    </div>
  );
}

