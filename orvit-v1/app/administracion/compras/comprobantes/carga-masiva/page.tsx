'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  ArrowLeft,
  Upload,
  FileText,
  Grid3X3,
  Plus,
  Trash2,
  Check,
  X,
  Loader2,
  AlertCircle,
  CheckCircle,
  Eye,
  Save,
  RefreshCw,
  RotateCcw,
  AlertTriangle,
  Building2,
  Calendar,
  Hash,
  DollarSign,
  Package,
  Edit,
  ChevronDown,
  ChevronUp,
  FileCheck,
  XCircle,
  PanelLeft,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';
import { pdfToImages, generatePdfPreview } from '@/lib/pdf/pdf-to-image';

interface Proveedor {
  id: string;
  nombre: string;
  razonSocial: string;
  cuit: string;
}

// Item extraído de la factura con información de matching
interface ExtractedItem {
  codigo?: string;
  descripcion: string;
  cantidad: number;
  unidad?: string;
  precio_unitario: number;
  subtotal: number;
  iva_porcentaje?: number;
  // Campos de matching
  match?: {
    supplierItemId: number;
    nombre: string;
    supplyId: number;
    supplyName: string;
    supplySku?: string;
  };
  matchType?: 'exact_alias' | 'exact_code' | 'fuzzy' | 'ai_assisted' | 'none';
  needsMapping?: boolean;
  usedAI?: boolean; // Si se usó IA para el matching
  // Campo para mapeo manual del usuario
  selectedSupplierItemId?: number;
  // Sugerencias de fuzzy matching (sin tokens extra, local)
  suggestions?: Array<{
    supplierItemId: number;
    supplyName: string;
    similarity: number; // 0-100
  }>;
}

// Item de proveedor para el selector
interface SupplierItem {
  id: number;
  nombre: string;
  codigoProveedor?: string;
  supplyId: number;
  supplyName: string;
}

// Datos completos extraídos de la IA
interface FullExtraction {
  // Proveedor (emisor)
  proveedor?: {
    razon_social?: string;
    cuit?: string;
    direccion?: string;
    condicion_iva?: string;
  };
  // Receptor (a quién está emitida)
  receptor?: {
    razon_social?: string;
    cuit?: string;
    direccion?: string;
    condicion_iva?: string;
  };
  // Comprobante
  tipo_comprobante?: string;
  letra_comprobante?: string;
  tipo_sistema?: string;
  punto_venta?: string;
  numero_comprobante?: string;
  fecha_emision?: string;
  fecha_vencimiento_pago?: string;
  // Montos
  subtotal_neto_gravado?: number;
  subtotal_neto_no_gravado?: number;
  subtotal_exento?: number;
  iva_21?: number;
  iva_10_5?: number;
  iva_27?: number;
  percepciones_iva?: number;
  percepciones_iibb?: number;
  otros_impuestos?: number;
  total?: number;
  // CAE
  cae?: string;
  fecha_vencimiento_cae?: string;
  // Items
  items?: ExtractedItem[];
  // Metadata
  confianza?: number;
  moneda?: string;
}

// Validación del receptor
interface ReceptorValidation {
  isValid: boolean;
  companyCuit: string | null;
  extractedReceptorCuit: string | null;
  message: string;
  wasAutoSwapped?: boolean; // Indica si se auto-corrigió inversión proveedor/receptor
}

// Archivo subido con extracción completa
interface UploadedFile {
  id: string;
  file: File;
  name: string;
  status: 'queued' | 'processing' | 'extracted' | 'approved' | 'failed';
  previewUrl?: string;
  extraction?: FullExtraction;
  errorMessage?: string;
  retryCount: number;
  confidence?: number;
  warnings?: string[];
  matchedSupplier?: { id: number; name: string; cuit: string; matched: boolean; matchType?: string };
  isDuplicate?: boolean;
  duplicateInfo?: { confidence: string; reason?: string };
  receptorValidation?: ReceptorValidation;
  receptorOverride?: boolean; // Usuario confirmó que la factura es correcta pese a CUIT diferente
  // Campos editables (override de la extracción)
  editedData?: Partial<FullExtraction>;
  selectedProveedorId?: string;
  // Resumen de matching de items
  itemMatching?: { total: number; matched: number; needsMapping: number; aiAssisted?: number };
}

interface GridRow {
  id: string;
  proveedorId: string;
  proveedorNombre: string;
  tipo: string;
  numeroSerie: string;
  numeroFactura: string;
  fechaEmision: string;
  fechaVencimiento: string;
  neto: string;
  iva21: string;
  total: string;
  status: 'pending' | 'valid' | 'error';
  errorMessage?: string;
}

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
];

const createEmptyRow = (): GridRow => ({
  id: crypto.randomUUID(),
  proveedorId: '',
  proveedorNombre: '',
  tipo: '',
  numeroSerie: '',
  numeroFactura: '',
  fechaEmision: new Date().toISOString().split('T')[0],
  fechaVencimiento: '',
  neto: '',
  iva21: '',
  total: '',
  status: 'pending',
});

export default function CargaMasivaPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'pdf' | 'grid'>('pdf');

  // PDF Upload state
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [processingOCR, setProcessingOCR] = useState(false);
  const [expandedFileId, setExpandedFileId] = useState<string | null>(null);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);

  // Grid state
  const [gridRows, setGridRows] = useState<GridRow[]>([createEmptyRow(), createEmptyRow(), createEmptyRow()]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loadingProveedores, setLoadingProveedores] = useState(false);
  const [saving, setSaving] = useState(false);

  // Supplier items para mapeo
  const [supplierItemsCache, setSupplierItemsCache] = useState<Record<number, SupplierItem[]>>({});
  const [loadingSupplierItems, setLoadingSupplierItems] = useState<number | null>(null);

  // Cuentas/Tipos de cuenta
  const [cuentas, setCuentas] = useState<Array<{ id: string; nombre: string }>>([]);
  const [defaultTipoCuentaId, setDefaultTipoCuentaId] = useState<string>('');

  // Crear proveedor
  const [creatingSupplier, setCreatingSupplier] = useState<string | null>(null); // fileId

  // Panel lateral para ver factura
  const [viewingFileId, setViewingFileId] = useState<string | null>(null);
  const [imageZoom, setImageZoom] = useState(100);
  const [highResPreviewUrl, setHighResPreviewUrl] = useState<string | null>(null);
  const [loadingHighResPreview, setLoadingHighResPreview] = useState(false);

  // Generar preview de alta resolución cuando se abre el panel
  useEffect(() => {
    if (!viewingFileId) {
      setHighResPreviewUrl(null);
      return;
    }

    const viewingFile = uploadedFiles.find(f => f.id === viewingFileId);
    if (!viewingFile?.file) return;

    const generateHighRes = async () => {
      setLoadingHighResPreview(true);
      try {
        // Generar preview con ancho de 1200px para alta calidad
        const highResUrl = await generatePdfPreview(viewingFile.file, 1200);
        setHighResPreviewUrl(highResUrl);
      } catch (error) {
        console.error('Error generando preview alta resolución:', error);
        // Fallback al preview de baja resolución
        setHighResPreviewUrl(viewingFile.previewUrl || null);
      } finally {
        setLoadingHighResPreview(false);
      }
    };

    generateHighRes();
  }, [viewingFileId, uploadedFiles]);

  // Load proveedores and cuentas on mount
  useEffect(() => {
    loadProveedores();
    loadCuentas();
  }, []);

  const loadCuentas = async () => {
    try {
      const response = await fetch('/api/compras/cuentas');
      if (response.ok) {
        const data = await response.json();
        const activeCuentas = (data || []).filter((c: any) => c.activa);
        setCuentas(activeCuentas.map((c: any) => ({ id: String(c.id), nombre: c.nombre })));
        // Auto-seleccionar la primera cuenta como default si hay alguna
        if (activeCuentas.length > 0 && !defaultTipoCuentaId) {
          setDefaultTipoCuentaId(String(activeCuentas[0].id));
        }
      }
    } catch (error) {
      console.error('Error loading cuentas:', error);
    }
  };

  const loadProveedores = async () => {
    setLoadingProveedores(true);
    try {
      const response = await fetch('/api/compras/proveedores?limit=500');
      if (response.ok) {
        const data = await response.json();
        const mapped = (data.data || data || []).map((p: any) => ({
          id: String(p.id),
          nombre: p.name || p.nombre,
          razonSocial: p.razon_social || p.razonSocial || '',
          cuit: p.cuit || '',
        }));
        setProveedores(mapped);
      }
    } catch (error) {
      console.error('Error loading proveedores:', error);
    } finally {
      setLoadingProveedores(false);
    }
  };

  // Cargar supplier items de un proveedor específico
  const loadSupplierItems = async (supplierId: number): Promise<SupplierItem[]> => {
    // Si ya está en caché, usar eso
    if (supplierItemsCache[supplierId]) {
      return supplierItemsCache[supplierId];
    }

    setLoadingSupplierItems(supplierId);
    try {
      const response = await fetch(`/api/compras/supplier-items?supplierId=${supplierId}`);
      if (response.ok) {
        const data = await response.json();
        const items: SupplierItem[] = (data.data || data || []).map((item: any) => ({
          id: item.id,
          nombre: item.nombre,
          codigoProveedor: item.codigoProveedor,
          supplyId: item.supplyId,
          supplyName: item.supply?.name || item.supplyName || '',
        }));
        setSupplierItemsCache(prev => ({ ...prev, [supplierId]: items }));
        return items;
      }
    } catch (error) {
      console.error('Error loading supplier items:', error);
    } finally {
      setLoadingSupplierItems(null);
    }
    return [];
  };

  // Crear proveedor desde los datos extraídos (o seleccionar si ya existe)
  const createSupplierFromExtraction = async (fileId: string) => {
    const file = uploadedFiles.find(f => f.id === fileId);
    if (!file?.extraction?.proveedor) return;

    const prov = file.extraction.proveedor;
    if (!prov.cuit || !prov.razon_social) {
      toast.error('Faltan datos para crear el proveedor (CUIT o Razón Social)');
      return;
    }

    setCreatingSupplier(fileId);
    try {
      // 1. Primero verificar si ya existe un proveedor con ese CUIT
      const cuitNormalizado = prov.cuit.replace(/-/g, '');
      const existente = proveedores.find(p =>
        p.cuit && p.cuit.replace(/-/g, '') === cuitNormalizado
      );

      if (existente) {
        // Ya existe, seleccionarlo automáticamente
        toast.info(`Proveedor "${existente.nombre}" ya existe con CUIT ${prov.cuit}. Seleccionado automáticamente.`);

        setUploadedFiles(prev => prev.map(f =>
          f.id === fileId ? {
            ...f,
            selectedProveedorId: existente.id,
            matchedSupplier: {
              id: parseInt(existente.id),
              name: existente.nombre,
              cuit: existente.cuit,
              matched: true,
              matchType: 'cuit'
            }
          } : f
        ));

        // Cargar supplier items del proveedor existente
        loadSupplierItems(parseInt(existente.id));
        setCreatingSupplier(null);
        return;
      }

      // 2. No existe, crear nuevo proveedor
      const response = await fetch('/api/compras/proveedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: prov.razon_social,
          razonSocial: prov.razon_social,
          cuit: prov.cuit,
          condicionIva: prov.condicion_iva || 'Responsable Inscripto',
          direccion: prov.direccion || '',
        }),
      });

      if (response.ok) {
        const newSupplier = await response.json();
        toast.success(`Proveedor "${prov.razon_social}" creado correctamente`);

        // Agregar a la lista de proveedores
        setProveedores(prev => [...prev, {
          id: String(newSupplier.id),
          nombre: newSupplier.name,
          razonSocial: newSupplier.razon_social,
          cuit: newSupplier.cuit,
        }]);

        // Actualizar el archivo con el proveedor creado
        setUploadedFiles(prev => prev.map(f =>
          f.id === fileId ? {
            ...f,
            selectedProveedorId: String(newSupplier.id),
            matchedSupplier: {
              id: newSupplier.id,
              name: newSupplier.name,
              cuit: newSupplier.cuit,
              matched: true,
              matchType: 'created'
            }
          } : f
        ));

        // Cargar supplier items del nuevo proveedor
        loadSupplierItems(newSupplier.id);
      } else {
        const error = await response.json();
        // Si el error es por CUIT duplicado (validación del backend)
        if (error.message?.includes('CUIT') || error.message?.includes('duplicado')) {
          toast.error('Ya existe un proveedor con ese CUIT. Recargá la página para verlo.');
        } else {
          toast.error(error.message || 'Error al crear el proveedor');
        }
      }
    } catch (error) {
      console.error('Error creating supplier:', error);
      toast.error('Error de conexión al crear el proveedor');
    } finally {
      setCreatingSupplier(null);
    }
  };

  // Crear alias para un item cuando el usuario lo mapea
  const createItemAlias = async (
    supplierItemId: number,
    alias: string,
    codigoProveedor?: string
  ) => {
    try {
      const response = await fetch('/api/compras/supplier-items/aliases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierItemId, alias, codigoProveedor }),
      });

      if (response.ok) {
        toast.success('Mapeo guardado para futuras facturas');
        return true;
      }
    } catch (error) {
      console.error('Error creating alias:', error);
    }
    return false;
  };

  // Actualizar el mapping de un item en un archivo
  const updateItemMapping = async (
    fileId: string,
    itemIndex: number,
    supplierItemId: number | null
  ) => {
    const file = uploadedFiles.find(f => f.id === fileId);
    if (!file?.extraction?.items) return;

    const item = file.extraction.items[itemIndex];
    if (!item) return;

    // Actualizar el item con el mapping seleccionado
    setUploadedFiles(prev => prev.map(f => {
      if (f.id !== fileId || !f.extraction?.items) return f;

      const updatedItems = [...f.extraction.items!];
      updatedItems[itemIndex] = {
        ...updatedItems[itemIndex],
        selectedSupplierItemId: supplierItemId || undefined,
        needsMapping: !supplierItemId,
      };

      return {
        ...f,
        extraction: { ...f.extraction, items: updatedItems },
      };
    }));

    // Si se seleccionó un item, crear el alias para futuro matching automático
    if (supplierItemId && item.descripcion) {
      await createItemAlias(supplierItemId, item.descripcion, item.codigo);
    }
  };

  // ===== PDF UPLOAD HANDLERS =====
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
    if (files.length > 0) {
      addFiles(files);
    } else {
      toast.error('Solo se permiten archivos PDF');
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => f.type === 'application/pdf');
    if (files.length > 0) {
      addFiles(files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const addFiles = async (files: File[]) => {
    const newFiles: UploadedFile[] = [];

    for (const file of files) {
      const fileObj: UploadedFile = {
        id: crypto.randomUUID(),
        file,
        name: file.name,
        status: 'queued',
        retryCount: 0
      };

      // Generate preview thumbnail
      try {
        fileObj.previewUrl = await generatePdfPreview(file, 200);
      } catch {
        // Preview failed, continue without it
      }

      newFiles.push(fileObj);
    }

    setUploadedFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  // Maximum concurrent processing
  const MAX_CONCURRENT = 2;

  const processSingleFile = async (fileId: string): Promise<void> => {
    const fileToProcess = uploadedFiles.find(f => f.id === fileId);
    if (!fileToProcess) return;

    setUploadedFiles(prev =>
      prev.map(f => f.id === fileId ? { ...f, status: 'processing' } : f)
    );

    try {
      // Convert PDF to images
      const images = await pdfToImages(fileToProcess.file, 1);

      if (images.length === 0) {
        throw new Error('No se pudo convertir el PDF a imagen');
      }

      // Create FormData with the image
      const formData = new FormData();
      formData.append('file', images[0], 'page.png');

      // Call AI processing API
      const response = await fetch('/api/compras/facturas/procesar-ia', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error al procesar con IA');
      }

      // Store full extraction
      const extraction = result.extraction as FullExtraction;

      setUploadedFiles(prev =>
        prev.map(f => f.id === fileId ? {
          ...f,
          status: 'extracted',
          extraction,
          confidence: result.confidence || extraction.confianza || 0,
          warnings: result.warnings || [],
          matchedSupplier: result.matchedSupplier,
          isDuplicate: result.duplicate?.isDuplicate || false,
          duplicateInfo: result.duplicate,
          receptorValidation: result.receptorValidation,
          itemMatching: result.itemMatching,
          selectedProveedorId: result.matchedSupplier?.matched ? String(result.matchedSupplier.id) : undefined
        } : f)
      );

      // Cargar supplier items si hay proveedor matched
      if (result.matchedSupplier?.matched) {
        loadSupplierItems(result.matchedSupplier.id);
      }

      // Auto-expand the first extracted file
      setExpandedFileId(fileId);
    } catch (error: any) {
      setUploadedFiles(prev =>
        prev.map(f => f.id === fileId ? {
          ...f,
          status: 'failed',
          errorMessage: error.message || 'Error al procesar PDF',
          retryCount: f.retryCount + 1
        } : f)
      );
    }
  };

  const processOCR = async () => {
    const queuedFiles = uploadedFiles.filter(f => f.status === 'queued');
    if (queuedFiles.length === 0) {
      toast.info('No hay archivos pendientes de procesar');
      return;
    }

    setProcessingOCR(true);

    // Process files sequentially to manage state better
    for (const file of queuedFiles) {
      await processSingleFile(file.id);
    }

    setProcessingOCR(false);

    const extracted = uploadedFiles.filter(f => f.status === 'extracted').length + queuedFiles.length;
    const failed = uploadedFiles.filter(f => f.status === 'failed').length;

    toast.success(`Procesamiento completado`);
  };

  const retryFile = async (fileId: string) => {
    setUploadedFiles(prev =>
      prev.map(f => f.id === fileId ? { ...f, status: 'queued', errorMessage: undefined } : f)
    );
    await processSingleFile(fileId);
  };

  // Aprobar factura extraída
  const approveFile = (fileId: string) => {
    setUploadedFiles(prev =>
      prev.map(f => f.id === fileId ? { ...f, status: 'approved' } : f)
    );
    toast.success('Factura aprobada');
  };

  // Rechazar factura extraída
  const rejectFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    toast.info('Factura descartada');
  };

  // Actualizar proveedor seleccionado
  const updateFileProveedor = (fileId: string, proveedorId: string) => {
    setUploadedFiles(prev =>
      prev.map(f => f.id === fileId ? { ...f, selectedProveedorId: proveedorId } : f)
    );
  };

  // Guardar todas las facturas aprobadas
  const saveApprovedInvoices = async () => {
    const approvedFiles = uploadedFiles.filter(f => f.status === 'approved');
    if (approvedFiles.length === 0) {
      toast.error('No hay facturas aprobadas para guardar');
      return;
    }

    setSaving(true);
    let successCount = 0;
    let errorCount = 0;

    for (const file of approvedFiles) {
      const ext = file.extraction;
      if (!ext) continue;

      const provId = file.selectedProveedorId || file.matchedSupplier?.id;
      if (!provId) {
        toast.error(`${file.name}: Seleccione un proveedor`);
        errorCount++;
        continue;
      }

      // Verificar que hay una cuenta seleccionada
      if (!defaultTipoCuentaId) {
        toast.error('Debe seleccionar un tipo de cuenta antes de guardar');
        setSaving(false);
        return;
      }

      try {
        // Mapear tipo de comprobante
        const tipoDisplay = mapTipoToDisplay(ext.tipo_sistema || '');
        const fechaEmisionValue = ext.fecha_emision || new Date().toISOString().split('T')[0];

        // Preparar items - si no hay items, crear uno genérico con el total
        let itemsPayload = ext.items?.map(item => ({
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          precioUnitario: item.precio_unitario,
          subtotal: item.subtotal,
          codigo: item.codigo || null,
          unidad: item.unidad || 'UN',
          ivaPorcentaje: item.iva_porcentaje || 21
        })) || [];

        // Si no hay items, crear uno genérico
        if (itemsPayload.length === 0) {
          itemsPayload = [{
            descripcion: 'Compra según comprobante',
            cantidad: 1,
            precioUnitario: ext.subtotal_neto_gravado || ext.total || 0,
            subtotal: ext.subtotal_neto_gravado || ext.total || 0,
            codigo: null,
            unidad: 'UN',
            ivaPorcentaje: 21
          }];
        }

        const payload = {
          numeroSerie: ext.punto_venta || '',
          numeroFactura: ext.numero_comprobante || '',
          tipo: tipoDisplay,
          proveedorId: parseInt(String(provId)),
          fechaEmision: fechaEmisionValue,
          fechaImputacion: fechaEmisionValue, // Usar la misma fecha de emisión
          fechaVencimiento: ext.fecha_vencimiento_pago || null,
          tipoPago: 'cta_cte',
          tipoCuentaId: defaultTipoCuentaId, // Tipo de cuenta seleccionado
          neto: ext.subtotal_neto_gravado || 0,
          netoNoGravado: ext.subtotal_neto_no_gravado || 0,
          exento: ext.subtotal_exento || 0,
          iva21: ext.iva_21 || 0,
          iva105: ext.iva_10_5 || 0,
          iva27: ext.iva_27 || 0,
          percepcionIVA: ext.percepciones_iva || 0,
          percepcionIIBB: ext.percepciones_iibb || 0,
          otrosImpuestos: ext.otros_impuestos || 0,
          total: ext.total || 0,
          cae: ext.cae || null,
          fechaVencimientoCae: ext.fecha_vencimiento_cae || null,
          items: itemsPayload,
        };

        const response = await fetch('/api/compras/comprobantes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          successCount++;

          // APRENDIZAJE AUTOMÁTICO: Crear aliases para matchs de IA
          // Esto hace que la próxima vez sea un match exacto instantáneo
          if (ext.items) {
            for (const item of ext.items) {
              if (item.matchType === 'ai_assisted' && item.match?.supplierItemId && item.descripcion) {
                // Crear alias en background (no bloqueamos el guardado)
                createItemAlias(item.match.supplierItemId, item.descripcion, item.codigo).catch(() => {
                  // Ignorar errores de alias, no es crítico
                });
              }
            }
          }

          setUploadedFiles(prev => prev.filter(f => f.id !== file.id));
        } else {
          const error = await response.json();
          toast.error(`${file.name}: ${error.message || 'Error al guardar'}`);
          errorCount++;
        }
      } catch (error) {
        toast.error(`${file.name}: Error de conexión`);
        errorCount++;
      }
    }

    setSaving(false);

    if (successCount > 0) {
      toast.success(`${successCount} factura(s) guardada(s) correctamente`);
    }
  };

  // Map API tipo to display format
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

  // Format currency
  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || value === null) return '-';
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
  };

  // Format date to dd/mm/yyyy
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    try {
      const [year, month, day] = dateStr.split('-');
      if (year && month && day) {
        return `${day}/${month}/${year}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  // ===== GRID HANDLERS =====
  const updateRow = (id: string, field: keyof GridRow, value: string) => {
    setGridRows(prev => prev.map(row => {
      if (row.id !== id) return row;

      const updated = { ...row, [field]: value, status: 'pending' as const };

      if (field === 'neto') {
        const neto = parseFloat(value) || 0;
        const iva = neto * 0.21;
        updated.iva21 = iva.toFixed(2);
        updated.total = (neto + iva).toFixed(2);
      }

      if (field === 'proveedorId') {
        const prov = proveedores.find(p => p.id === value);
        updated.proveedorNombre = prov?.nombre || '';
      }

      return updated;
    }));
  };

  const addRow = () => {
    setGridRows(prev => [...prev, createEmptyRow()]);
  };

  const removeRow = (id: string) => {
    setGridRows(prev => {
      const filtered = prev.filter(row => row.id !== id);
      return filtered.length === 0 ? [createEmptyRow()] : filtered;
    });
  };

  const validateRows = () => {
    let hasErrors = false;

    setGridRows(prev => prev.map(row => {
      const errors: string[] = [];

      if (!row.proveedorId) errors.push('Proveedor requerido');
      if (!row.tipo) errors.push('Tipo requerido');
      if (!row.numeroSerie) errors.push('N° Serie requerido');
      if (!row.numeroFactura) errors.push('N° Factura requerido');
      if (!row.fechaEmision) errors.push('Fecha emisión requerida');
      if (!row.total || parseFloat(row.total) <= 0) errors.push('Total debe ser mayor a 0');

      if (errors.length > 0) {
        hasErrors = true;
        return { ...row, status: 'error' as const, errorMessage: errors.join(', ') };
      }

      return { ...row, status: 'valid' as const, errorMessage: undefined };
    }));

    return !hasErrors;
  };

  const saveGridRows = async () => {
    if (!validateRows()) {
      toast.error('Hay errores en algunos comprobantes. Revísalos antes de guardar.');
      return;
    }

    // Verificar que hay una cuenta seleccionada
    if (!defaultTipoCuentaId) {
      toast.error('Debe seleccionar un tipo de cuenta antes de guardar');
      return;
    }

    setSaving(true);
    let successCount = 0;
    let errorCount = 0;

    for (const row of gridRows) {
      if (row.status !== 'valid') continue;

      try {
        const payload = {
          numeroSerie: row.numeroSerie,
          numeroFactura: row.numeroFactura,
          tipo: row.tipo,
          proveedorId: parseInt(row.proveedorId),
          fechaEmision: row.fechaEmision,
          fechaImputacion: row.fechaEmision, // Usar la misma fecha de emisión
          fechaVencimiento: row.fechaVencimiento || null,
          tipoPago: 'cta_cte',
          tipoCuentaId: defaultTipoCuentaId, // Tipo de cuenta seleccionado
          neto: parseFloat(row.neto) || 0,
          iva21: parseFloat(row.iva21) || 0,
          total: parseFloat(row.total) || 0,
          // Crear un item genérico ya que el grid no tiene detalle de items
          items: [{
            descripcion: 'Compra según comprobante',
            cantidad: 1,
            precioUnitario: parseFloat(row.neto) || parseFloat(row.total) || 0,
            subtotal: parseFloat(row.neto) || parseFloat(row.total) || 0,
            codigo: null,
            unidad: 'UN',
            ivaPorcentaje: 21
          }],
        };

        const response = await fetch('/api/compras/comprobantes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          successCount++;
          setGridRows(prev => prev.filter(r => r.id !== row.id));
        } else {
          errorCount++;
          const error = await response.json();
          setGridRows(prev => prev.map(r =>
            r.id === row.id ? { ...r, status: 'error' as const, errorMessage: error.message || 'Error al guardar' } : r
          ));
        }
      } catch (error) {
        errorCount++;
        setGridRows(prev => prev.map(r =>
          r.id === row.id ? { ...r, status: 'error' as const, errorMessage: 'Error de conexión' } : r
        ));
      }
    }

    setSaving(false);

    if (successCount > 0) {
      toast.success(`${successCount} comprobante(s) guardados correctamente`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} comprobante(s) con errores`);
    }

    if (gridRows.length === 0 || gridRows.every(r => r.status === 'error')) {
      setGridRows(prev => prev.length === 0 ? [createEmptyRow()] : prev);
    }
  };

  const clearGrid = () => {
    setGridRows([createEmptyRow(), createEmptyRow(), createEmptyRow()]);
  };

  // Stats
  const extractedCount = uploadedFiles.filter(f => f.status === 'extracted').length;
  const approvedCount = uploadedFiles.filter(f => f.status === 'approved').length;
  const queuedCount = uploadedFiles.filter(f => f.status === 'queued').length;
  const failedCount = uploadedFiles.filter(f => f.status === 'failed').length;
  const validGridCount = gridRows.filter(r => r.status === 'valid').length;
  const errorGridCount = gridRows.filter(r => r.status === 'error').length;

  // Render extracted file card (siempre expandido)
  const renderExtractedFileCard = (file: UploadedFile) => {
    const ext = file.extraction;
    if (!ext) return null;

    const tipoDisplay = ext.tipo_comprobante
      ? `${ext.tipo_comprobante} ${ext.letra_comprobante || ''}`
      : mapTipoToDisplay(ext.tipo_sistema || '');

    return (
      <Card
        key={file.id}
        className={cn(
          "transition-all",
          file.status === 'approved' && "border-success-muted bg-success-muted/50",
          file.isDuplicate && file.status !== 'approved' && "border-warning-muted bg-warning-muted/50"
        )}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Preview thumbnail */}
              {file.previewUrl && (
                <div className="w-16 h-20 rounded border overflow-hidden shrink-0 bg-muted">
                  <img src={file.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-base truncate">{file.name}</CardTitle>
                  {file.status === 'approved' && (
                    <Badge className="bg-success">Aprobada</Badge>
                  )}
                  {file.isDuplicate && file.status !== 'approved' && (
                    <Badge variant="outline" className="border-warning-muted text-warning-muted-foreground">
                      {file.duplicateInfo?.confidence === 'confirmed' ? 'Duplicada' : 'Posible duplicada'}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                  <span className="font-medium text-foreground">{tipoDisplay}</span>
                  <span style={{ fontFamily: 'Calibri, sans-serif' }}>{ext.punto_venta}-{ext.numero_comprobante}</span>
                  <span style={{ fontFamily: 'Calibri, sans-serif' }}>{formatDate(ext.fecha_emision)}</span>
                  <span className="font-semibold text-foreground" style={{ fontFamily: 'Calibri, sans-serif' }}>{formatCurrency(ext.total)}</span>
                </div>
                {file.confidence !== undefined && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-1.5 w-20 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.round(file.confidence * 100)}%`,
                          backgroundColor: file.confidence > 0.8 ? '#22c55e' : file.confidence > 0.6 ? '#f59e0b' : '#ef4444'
                        }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      <span style={{ fontFamily: 'Calibri, sans-serif' }}>{Math.round(file.confidence * 100)}%</span> confianza
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Botón para ver panel lateral */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewingFileId(file.id)}
              className="gap-1.5 shrink-0"
            >
              <PanelLeft className="h-4 w-4" />
              Ver
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
            <Separator className="my-3" />

            {/* Auto-swap indicator - Cuando se corrigió automáticamente la inversión proveedor/receptor */}
            {file.receptorValidation?.wasAutoSwapped && (
              <div className="mb-4 p-3 bg-info-muted rounded-lg border border-info-muted">
                <div className="flex items-start gap-2">
                  <RefreshCw className="h-4 w-4 text-info-muted-foreground mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-info-muted-foreground">
                      🔄 Auto-corrección aplicada
                    </p>
                    <p className="mt-1 text-info-muted-foreground">
                      La IA confundió proveedor y receptor. Se intercambiaron automáticamente los datos.
                      Verifica que los datos del proveedor y receptor sean correctos.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Receptor Validation Warning - Con opción de override */}
            {file.receptorValidation && !file.receptorValidation.isValid && (
              <div className={cn(
                "mb-4 p-4 rounded-lg border-2",
                file.receptorOverride
                  ? "bg-warning-muted border-warning-muted"
                  : "bg-destructive/10 border-destructive/30"
              )}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className={cn(
                    "h-5 w-5 mt-0.5 shrink-0",
                    file.receptorOverride ? "text-warning-muted-foreground" : "text-destructive"
                  )} />
                  <div className="text-sm flex-1">
                    <p className={cn(
                      "font-semibold",
                      file.receptorOverride ? "text-warning-muted-foreground" : "text-destructive"
                    )}>
                      ⚠️ CUIT del receptor no coincide con tu empresa
                    </p>
                    <p className={cn(
                      "mt-1",
                      file.receptorOverride ? "text-warning-muted-foreground" : "text-destructive"
                    )}>
                      {file.receptorValidation.message}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-4 text-xs">
                      <div className="p-2 bg-background rounded border">
                        <p className="text-muted-foreground">CUIT en factura (receptor):</p>
                        <p className="font-bold text-destructive" style={{ fontFamily: 'Calibri, sans-serif' }}>{file.receptorValidation.extractedReceptorCuit || '-'}</p>
                      </div>
                      <div className="p-2 bg-background rounded border">
                        <p className="text-muted-foreground">CUIT de tu empresa:</p>
                        <p className="font-bold text-success" style={{ fontFamily: 'Calibri, sans-serif' }}>{file.receptorValidation.companyCuit || '-'}</p>
                      </div>
                    </div>
                    {/* Checkbox para override */}
                    <label className="mt-3 flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={file.receptorOverride || false}
                        onChange={(e) => {
                          setUploadedFiles(prev => prev.map(f =>
                            f.id === file.id ? { ...f, receptorOverride: e.target.checked } : f
                          ));
                        }}
                        className="h-4 w-4 rounded border-border text-warning-muted-foreground focus:ring-amber-500"
                      />
                      <span className="text-sm font-medium text-foreground">
                        La IA leyó mal el CUIT - confirmo que esta factura es correcta
                      </span>
                    </label>
                    {!file.receptorOverride && (
                      <p className="mt-2 text-xs text-destructive font-medium">
                        Marca el checkbox de arriba si la factura es correcta y la IA confundió los datos.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Warnings */}
            {file.warnings && file.warnings.length > 0 && (
              <div className="mb-4 p-3 bg-warning-muted rounded-lg border border-warning-muted">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning-muted-foreground mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-warning-muted-foreground">Advertencias:</p>
                    <ul className="mt-1 space-y-0.5 text-warning-muted-foreground">
                      {file.warnings.map((w, i) => (
                        <li key={i}>• {w}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Receptor Section - A quién está dirigida la factura */}
            {ext.receptor && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Receptor (Destinatario de la factura)
                  {file.receptorValidation?.isValid && (
                    <Badge className="bg-success text-xs ml-2">✓ Coincide</Badge>
                  )}
                </h4>
                <div className={cn(
                  "p-3 rounded-lg space-y-2",
                  file.receptorValidation?.isValid
                    ? "bg-success-muted border border-success-muted"
                    : "bg-muted/50"
                )}>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Razón Social:</span>
                    <span className="font-medium">{ext.receptor.razon_social || '-'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">CUIT:</span>
                    <span style={{ fontFamily: 'Calibri, sans-serif' }}>{ext.receptor.cuit || '-'}</span>
                  </div>
                  {ext.receptor.condicion_iva && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Condición IVA:</span>
                      <span>{ext.receptor.condicion_iva}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Proveedor Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Proveedor
                </h4>
                <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Razón Social:</span>
                    <span className="font-medium">{ext.proveedor?.razon_social || '-'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">CUIT:</span>
                    <span style={{ fontFamily: 'Calibri, sans-serif' }}>{ext.proveedor?.cuit || '-'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Condición IVA:</span>
                    <span>{ext.proveedor?.condicion_iva || '-'}</span>
                  </div>

                  {/* Proveedor Selector */}
                  <Separator className="my-2" />
                  <div>
                    <Label className="text-xs">Asignar a proveedor:</Label>
                    <Select
                      value={file.selectedProveedorId || (file.matchedSupplier?.matched ? String(file.matchedSupplier.id) : '')}
                      onValueChange={(v) => updateFileProveedor(file.id, v)}
                    >
                      <SelectTrigger className="mt-1 h-9">
                        <SelectValue placeholder="Seleccionar proveedor..." />
                      </SelectTrigger>
                      <SelectContent>
                        {proveedores.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nombre} {p.cuit && `(${p.cuit})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {file.matchedSupplier?.matched ? (
                      <p className="text-xs text-success mt-1">
                        ✓ Coincide con: {file.matchedSupplier.name}
                      </p>
                    ) : (
                      /* Botón para crear proveedor si no existe */
                      ext.proveedor?.cuit && ext.proveedor?.razon_social && !file.selectedProveedorId && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3 w-full gap-2 border-info-muted text-info-muted-foreground hover:bg-info-muted"
                          onClick={() => createSupplierFromExtraction(file.id)}
                          disabled={creatingSupplier === file.id}
                        >
                          {creatingSupplier === file.id ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Creando proveedor...
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4" />
                              Crear proveedor nuevo
                            </>
                          )}
                        </Button>
                      )
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Comprobante
                </h4>
                <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tipo:</span>
                    <span className="font-semibold">{tipoDisplay}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Número:</span>
                    <span className="font-medium" style={{ fontFamily: 'Calibri, sans-serif' }}>{ext.punto_venta}-{ext.numero_comprobante}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Fecha Emisión:</span>
                    <span style={{ fontFamily: 'Calibri, sans-serif' }}>{formatDate(ext.fecha_emision)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Fecha Vto. Pago:</span>
                    <span style={{ fontFamily: 'Calibri, sans-serif' }}>{formatDate(ext.fecha_vencimiento_pago)}</span>
                  </div>
                  <Separator className="my-1" />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">CAE:</span>
                    <span className="text-xs" style={{ fontFamily: 'Calibri, sans-serif' }}>{ext.cae || '-'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Vto. CAE:</span>
                    <span style={{ fontFamily: 'Calibri, sans-serif' }}>{formatDate(ext.fecha_vencimiento_cae)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Items Section con Matching */}
            {ext.items && ext.items.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  Items ({ext.items.length})
                  {file.itemMatching && (
                    <div className="flex items-center gap-2 ml-2">
                      {file.itemMatching.matched > 0 && (
                        <Badge className="bg-success text-xs">
                          {file.itemMatching.matched} mapeados
                        </Badge>
                      )}
                      {file.itemMatching.aiAssisted && file.itemMatching.aiAssisted > 0 && (
                        <Badge className="bg-info text-xs">
                          ✨ {file.itemMatching.aiAssisted} con IA
                        </Badge>
                      )}
                      {file.itemMatching.needsMapping > 0 && (
                        <Badge variant="outline" className="border-warning-muted text-warning-muted-foreground text-xs">
                          {file.itemMatching.needsMapping} sin mapear
                        </Badge>
                      )}
                    </div>
                  )}
                </h4>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-[80px]">Código</TableHead>
                        <TableHead>Descripción Factura</TableHead>
                        <TableHead className="w-[200px]">Producto Interno</TableHead>
                        <TableHead className="text-right w-[80px]">Cant.</TableHead>
                        <TableHead className="text-right w-[100px]">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ext.items.map((item, idx) => {
                        const supplierId = file.matchedSupplier?.id;
                        const supplierItems = supplierId ? supplierItemsCache[supplierId] || [] : [];
                        const isMatched = item.match || item.selectedSupplierItemId;

                        return (
                          <TableRow
                            key={idx}
                            className={cn(
                              !isMatched && item.needsMapping && "bg-warning-muted"
                            )}
                          >
                            <TableCell className="font-mono text-xs">{item.codigo || '-'}</TableCell>
                            <TableCell>
                              <div className="text-sm">{item.descripcion}</div>
                              {item.match && (
                                <div className="flex items-center gap-1 mt-1">
                                  <CheckCircle className={cn(
                                    "h-3 w-3",
                                    item.matchType === 'ai_assisted' ? "text-info-muted-foreground" : "text-success"
                                  )} />
                                  <span className={cn(
                                    "text-xs",
                                    item.matchType === 'ai_assisted' ? "text-info-muted-foreground" : "text-success"
                                  )}>
                                    {item.matchType === 'exact_alias' ? 'Match por nombre' :
                                     item.matchType === 'exact_code' ? 'Match por código' :
                                     item.matchType === 'fuzzy' ? 'Match automático (similar)' :
                                     item.matchType === 'ai_assisted' ? '✨ Match con IA' : 'Match'}
                                  </span>
                                </div>
                              )}
                              {/* Mostrar sugerencias si no hay match */}
                              {!item.match && item.suggestions && item.suggestions.length > 0 && (
                                <div className="mt-1 text-xs text-info-muted-foreground">
                                  Sugerencias: {item.suggestions.map((s, i) => (
                                    <span key={s.supplierItemId}>
                                      {i > 0 && ', '}
                                      <button
                                        className="underline hover:text-info-muted-foreground"
                                        onClick={() => updateItemMapping(file.id, idx, s.supplierItemId)}
                                      >
                                        {s.supplyName} ({s.similarity}%)
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {item.match ? (
                                <div className="text-sm">
                                  <p className="font-medium">{item.match.supplyName}</p>
                                  {item.match.supplySku && (
                                    <p className="text-xs text-muted-foreground font-mono">{item.match.supplySku}</p>
                                  )}
                                </div>
                              ) : supplierId && supplierItems.length > 0 ? (
                                <Select
                                  value={item.selectedSupplierItemId?.toString() || ''}
                                  onValueChange={(v) => updateItemMapping(file.id, idx, v ? parseInt(v) : null)}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder={item.suggestions?.length ? 'Ver sugerencias arriba...' : 'Seleccionar producto...'} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="">Sin asignar</SelectItem>
                                    {supplierItems.map(si => (
                                      <SelectItem key={si.id} value={si.id.toString()}>
                                        {si.supplyName} {si.codigoProveedor && `(${si.codigoProveedor})`}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">
                                  {loadingSupplierItems === supplierId ? 'Cargando artículos...' : 'Sin productos configurados'}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right" style={{ fontFamily: 'Calibri, sans-serif' }}>{item.cantidad} {item.unidad}</TableCell>
                            <TableCell className="text-right font-medium" style={{ fontFamily: 'Calibri, sans-serif' }}>{formatCurrency(item.subtotal)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {file.itemMatching && file.itemMatching.needsMapping > 0 && (
                  <p className="text-xs text-warning-muted-foreground mt-2 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Los items sin mapear se guardarán con la descripción de la factura. Mapeá los productos para unificar stock y comparar precios.
                  </p>
                )}
              </div>
            )}

            {/* Totales Section */}
            <div className="mb-4">
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                Totales
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground mb-1">Neto Gravado</p>
                  <p className="text-base font-semibold" style={{ fontFamily: 'Calibri, sans-serif' }}>{formatCurrency(ext.subtotal_neto_gravado)}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground mb-1">IVA 21%</p>
                  <p className="text-base font-semibold" style={{ fontFamily: 'Calibri, sans-serif' }}>{formatCurrency(ext.iva_21)}</p>
                </div>
                {(ext.iva_10_5 || 0) > 0 && (
                  <div className="p-3 bg-muted/50 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground mb-1">IVA 10.5%</p>
                    <p className="text-base font-semibold" style={{ fontFamily: 'Calibri, sans-serif' }}>{formatCurrency(ext.iva_10_5)}</p>
                  </div>
                )}
                {(ext.iva_27 || 0) > 0 && (
                  <div className="p-3 bg-muted/50 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground mb-1">IVA 27%</p>
                    <p className="text-base font-semibold" style={{ fontFamily: 'Calibri, sans-serif' }}>{formatCurrency(ext.iva_27)}</p>
                  </div>
                )}
                {(ext.subtotal_neto_no_gravado || 0) > 0 && (
                  <div className="p-3 bg-muted/50 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground mb-1">No Gravado</p>
                    <p className="text-base font-semibold" style={{ fontFamily: 'Calibri, sans-serif' }}>{formatCurrency(ext.subtotal_neto_no_gravado)}</p>
                  </div>
                )}
                {(ext.subtotal_exento || 0) > 0 && (
                  <div className="p-3 bg-muted/50 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground mb-1">Exento</p>
                    <p className="text-base font-semibold" style={{ fontFamily: 'Calibri, sans-serif' }}>{formatCurrency(ext.subtotal_exento)}</p>
                  </div>
                )}
                {(ext.percepciones_iva || 0) > 0 && (
                  <div className="p-3 bg-muted/50 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground mb-1">Perc. IVA</p>
                    <p className="text-base font-semibold" style={{ fontFamily: 'Calibri, sans-serif' }}>{formatCurrency(ext.percepciones_iva)}</p>
                  </div>
                )}
                {(ext.percepciones_iibb || 0) > 0 && (
                  <div className="p-3 bg-muted/50 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground mb-1">Perc. IIBB</p>
                    <p className="text-base font-semibold" style={{ fontFamily: 'Calibri, sans-serif' }}>{formatCurrency(ext.percepciones_iibb)}</p>
                  </div>
                )}
                {(ext.otros_impuestos || 0) > 0 && (
                  <div className="p-3 bg-muted/50 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground mb-1">Otros Imp.</p>
                    <p className="text-base font-semibold" style={{ fontFamily: 'Calibri, sans-serif' }}>{formatCurrency(ext.otros_impuestos)}</p>
                  </div>
                )}
                <div className="p-3 bg-primary/10 rounded-lg text-center col-span-2 md:col-span-1 border border-primary/20">
                  <p className="text-xs text-muted-foreground mb-1">TOTAL</p>
                  <p className="text-xl font-bold text-primary" style={{ fontFamily: 'Calibri, sans-serif' }}>{formatCurrency(ext.total)}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            {file.status !== 'approved' && (
              <div className="flex items-center justify-between gap-2 pt-2 border-t">
                {/* Mensaje de bloqueo si CUIT no coincide Y no hay override */}
                {file.receptorValidation && !file.receptorValidation.isValid && !file.receptorOverride && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <XCircle className="h-3 w-3" />
                    Marca el checkbox arriba para aprobar
                  </p>
                )}
                {file.receptorValidation && !file.receptorValidation.isValid && file.receptorOverride && (
                  <p className="text-xs text-warning-muted-foreground flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Se aprobará con advertencia de CUIT
                  </p>
                )}
                {(!file.receptorValidation || file.receptorValidation.isValid) && (
                  <div />
                )}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => rejectFile(file.id)}
                    className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <XCircle className="h-4 w-4" />
                    Descartar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => approveFile(file.id)}
                    className="gap-2 bg-success hover:bg-success"
                    disabled={
                      (!file.selectedProveedorId && !file.matchedSupplier?.matched) ||
                      (file.receptorValidation && !file.receptorValidation.isValid && !file.receptorOverride)
                    }
                  >
                    <FileCheck className="h-4 w-4" />
                    Aprobar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
      </Card>
    );
  };

  return (
    <div className="w-full p-0">
      {/* Header */}
      <div className="px-4 md:px-6 pt-4 pb-3 border-b">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Button>
          <div className="h-4 w-px bg-border" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">Carga Masiva de Comprobantes</h1>
            <p className="text-sm text-muted-foreground">
              Sube PDFs para extracción automática con IA o ingresa manualmente
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 md:px-6 py-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'pdf' | 'grid')}>
          <TabsList className="mb-4">
            <TabsTrigger value="pdf" className="gap-2">
              <Upload className="w-4 h-4" />
              Subir PDFs (IA)
              {(extractedCount + approvedCount) > 0 && (
                <Badge variant="secondary" className="ml-1">{extractedCount + approvedCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="grid" className="gap-2">
              <Grid3X3 className="w-4 h-4" />
              Grilla Manual
            </TabsTrigger>
          </TabsList>

          {/* PDF Upload Tab */}
          <TabsContent value="pdf" className="space-y-4">
            {/* Drop zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/30"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">
                Arrastrá archivos PDF aquí o hacé click para seleccionar
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                La IA extraerá automáticamente todos los datos de las facturas
              </p>
            </div>

            {/* Stats bar */}
            {uploadedFiles.length > 0 && (
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {uploadedFiles.length} archivo(s)
                  </span>
                  {queuedCount > 0 && (
                    <Badge variant="outline">{queuedCount} en cola</Badge>
                  )}
                  {extractedCount > 0 && (
                    <Badge variant="outline" className="border-info-muted text-info-muted-foreground">
                      {extractedCount} extraídas
                    </Badge>
                  )}
                  {approvedCount > 0 && (
                    <Badge className="bg-success">{approvedCount} aprobadas</Badge>
                  )}
                  {failedCount > 0 && (
                    <Badge variant="destructive">{failedCount} con error</Badge>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {/* Selector de tipo de cuenta */}
                  <div className="flex items-center gap-2">
                    <Label htmlFor="tipoCuenta" className="text-sm text-muted-foreground whitespace-nowrap">
                      Tipo de cuenta:
                    </Label>
                    <Select value={defaultTipoCuentaId} onValueChange={setDefaultTipoCuentaId}>
                      <SelectTrigger id="tipoCuenta" className="w-[200px]">
                        <SelectValue placeholder="Seleccionar cuenta" />
                      </SelectTrigger>
                      <SelectContent>
                        {cuentas.map((cuenta) => (
                          <SelectItem key={cuenta.id} value={cuenta.id}>
                            {cuenta.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                  {queuedCount > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={processOCR}
                      disabled={processingOCR}
                    >
                      {processingOCR ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Procesando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Procesar con IA ({queuedCount})
                        </>
                      )}
                    </Button>
                  )}
                  {approvedCount > 0 && (
                    <Button
                      size="sm"
                      onClick={saveApprovedInvoices}
                      disabled={saving}
                      className="bg-success hover:bg-success"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Guardar Aprobadas ({approvedCount})
                        </>
                      )}
                    </Button>
                  )}
                  </div>
                </div>
              </div>
            )}

            {/* File list - Queued & Processing */}
            {uploadedFiles.filter(f => f.status === 'queued' || f.status === 'processing').length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Pendientes de procesar</h3>
                {uploadedFiles.filter(f => f.status === 'queued' || f.status === 'processing').map(file => (
                  <div
                    key={file.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border",
                      file.status === 'processing' && "border-info-muted bg-info-muted"
                    )}
                  >
                    <div className="w-10 h-12 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                      {file.previewUrl ? (
                        <img src={file.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <FileText className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      {file.status === 'processing' && (
                        <p className="text-xs text-info-muted-foreground">Extrayendo datos con IA...</p>
                      )}
                      {file.status === 'queued' && (
                        <p className="text-xs text-muted-foreground">En cola</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {file.status === 'processing' && (
                        <Loader2 className="w-4 h-4 animate-spin text-info-muted-foreground" />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(file.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* File list - Failed */}
            {uploadedFiles.filter(f => f.status === 'failed').length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-destructive">Con errores</h3>
                {uploadedFiles.filter(f => f.status === 'failed').map(file => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-destructive/30 bg-destructive/10"
                  >
                    <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-destructive">{file.errorMessage}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => retryFile(file.id)}
                        className="text-muted-foreground hover:text-primary"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(file.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Extracted files - Full cards */}
            {uploadedFiles.filter(f => f.status === 'extracted' || f.status === 'approved').length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Facturas extraídas - Revisar y aprobar</h3>
                {uploadedFiles.filter(f => f.status === 'extracted' || f.status === 'approved').map(file =>
                  renderExtractedFileCard(file)
                )}
              </div>
            )}
          </TabsContent>

          {/* Grid Tab */}
          <TabsContent value="grid" className="space-y-4">
            {/* Actions bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  {gridRows.length} fila(s)
                </span>
                {validGridCount > 0 && (
                  <Badge variant="outline" className="text-success border-success-muted">
                    {validGridCount} válidos
                  </Badge>
                )}
                {errorGridCount > 0 && (
                  <Badge variant="outline" className="text-destructive border-destructive/30">
                    {errorGridCount} con errores
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3">
                {/* Selector de tipo de cuenta */}
                <div className="flex items-center gap-2">
                  <Label htmlFor="tipoCuentaGrid" className="text-sm text-muted-foreground whitespace-nowrap">
                    Tipo de cuenta:
                  </Label>
                  <Select value={defaultTipoCuentaId} onValueChange={setDefaultTipoCuentaId}>
                    <SelectTrigger id="tipoCuentaGrid" className="w-[200px]">
                      <SelectValue placeholder="Seleccionar cuenta" />
                    </SelectTrigger>
                    <SelectContent>
                      {cuentas.map((cuenta) => (
                        <SelectItem key={cuenta.id} value={cuenta.id}>
                          {cuenta.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={clearGrid}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Limpiar
                </Button>
                <Button variant="outline" size="sm" onClick={addRow}>
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Fila
                </Button>
                <Button size="sm" onClick={saveGridRows} disabled={saving || gridRows.length === 0}>
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Guardar Todo
                    </>
                  )}
                </Button>
                </div>
              </div>
            </div>

            {/* Grid table */}
            <div className="rounded-lg border overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-10">#</TableHead>
                      <TableHead className="min-w-[200px]">Proveedor</TableHead>
                      <TableHead className="min-w-[120px]">Tipo</TableHead>
                      <TableHead className="w-[100px]">N° Serie</TableHead>
                      <TableHead className="w-[120px]">N° Factura</TableHead>
                      <TableHead className="w-[130px]">F. Emisión</TableHead>
                      <TableHead className="w-[130px]">F. Venc.</TableHead>
                      <TableHead className="w-[100px]">Neto</TableHead>
                      <TableHead className="w-[100px]">IVA 21%</TableHead>
                      <TableHead className="w-[100px]">Total</TableHead>
                      <TableHead className="w-[80px]">Estado</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gridRows.map((row, index) => (
                      <TableRow
                        key={row.id}
                        className={cn(
                          row.status === 'error' && "bg-destructive/10",
                          row.status === 'valid' && "bg-success-muted"
                        )}
                      >
                        <TableCell className="text-xs text-muted-foreground">{index + 1}</TableCell>
                        <TableCell>
                          <Select
                            value={row.proveedorId}
                            onValueChange={(v) => updateRow(row.id, 'proveedorId', v)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Seleccionar..." />
                            </SelectTrigger>
                            <SelectContent>
                              {proveedores.map(p => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.nombre} {p.cuit && `(${p.cuit})`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={row.tipo}
                            onValueChange={(v) => updateRow(row.id, 'tipo', v)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Tipo..." />
                            </SelectTrigger>
                            <SelectContent>
                              {tiposComprobantes.map(tipo => (
                                <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.numeroSerie}
                            onChange={(e) => updateRow(row.id, 'numeroSerie', e.target.value)}
                            placeholder="0001"
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.numeroFactura}
                            onChange={(e) => updateRow(row.id, 'numeroFactura', e.target.value)}
                            placeholder="00000001"
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <DatePicker
                            value={row.fechaEmision}
                            onChange={(date) => updateRow(row.id, 'fechaEmision', date)}
                            placeholder="Emisión"
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <DatePicker
                            value={row.fechaVencimiento}
                            onChange={(date) => updateRow(row.id, 'fechaVencimiento', date)}
                            placeholder="Vencimiento"
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={row.neto}
                            onChange={(e) => updateRow(row.id, 'neto', e.target.value)}
                            placeholder="0.00"
                            className="h-8 text-xs text-right"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={row.iva21}
                            onChange={(e) => updateRow(row.id, 'iva21', e.target.value)}
                            placeholder="0.00"
                            className="h-8 text-xs text-right bg-muted/50"
                            readOnly
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={row.total}
                            onChange={(e) => updateRow(row.id, 'total', e.target.value)}
                            placeholder="0.00"
                            className="h-8 text-xs text-right font-medium"
                          />
                        </TableCell>
                        <TableCell>
                          {row.status === 'valid' && (
                            <CheckCircle className="w-4 h-4 text-success" />
                          )}
                          {row.status === 'error' && (
                            <div className="flex items-center gap-1" title={row.errorMessage}>
                              <AlertCircle className="w-4 h-4 text-destructive" />
                            </div>
                          )}
                          {row.status === 'pending' && (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeRow(row.id)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Error messages */}
            {errorGridCount > 0 && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-destructive">
                      {errorGridCount} comprobante(s) con errores
                    </p>
                    <ul className="text-xs text-destructive mt-1 space-y-0.5">
                      {gridRows.filter(r => r.status === 'error').map((r, i) => (
                        <li key={r.id}>Fila {gridRows.indexOf(r) + 1}: {r.errorMessage}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Help text */}
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Tips:</strong></p>
              <ul className="list-disc list-inside space-y-0.5 ml-2">
                <li>El IVA 21% se calcula automáticamente al ingresar el Neto</li>
                <li>Podés editar el Total manualmente si necesitás ajustarlo</li>
                <li>Usá Tab para moverte entre campos rápidamente</li>
                <li>Los comprobantes se validan antes de guardar</li>
              </ul>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Panel lateral para ver factura completa */}
      <Sheet open={!!viewingFileId} onOpenChange={(open) => !open && setViewingFileId(null)}>
        <SheetContent side="left" className="w-full sm:w-[80vw] sm:max-w-none overflow-y-auto p-0">
          {(() => {
            const viewingFile = uploadedFiles.find(f => f.id === viewingFileId);
            if (!viewingFile) return null;
            const ext = viewingFile.extraction;

            return (
              <div className="flex flex-col h-full">
                {/* Header */}
                <SheetHeader className="p-4 border-b bg-muted/30">
                  <SheetTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    {viewingFile.name}
                  </SheetTitle>
                  {ext && (
                    <p className="text-sm text-muted-foreground">
                      {ext.tipo_comprobante} {ext.letra_comprobante} • {ext.punto_venta}-{ext.numero_comprobante}
                    </p>
                  )}
                </SheetHeader>

                <div className="flex-1 overflow-y-auto">
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-0 lg:divide-x">
                    {/* Columna izquierda: Imagen de la factura (3/5 = 60%) */}
                    <div className="p-4 bg-muted/20 lg:col-span-3">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold">Documento Original</h3>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setImageZoom(Math.max(50, imageZoom - 25))}
                          >
                            <ZoomOut className="h-3 w-3" />
                          </Button>
                          <span className="text-xs text-muted-foreground w-10 text-center">{imageZoom}%</span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setImageZoom(Math.min(200, imageZoom + 25))}
                          >
                            <ZoomIn className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="border rounded-lg overflow-auto bg-background max-h-[70vh]">
                        {loadingHighResPreview ? (
                          <div className="h-64 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-2">
                              <Loader2 className="h-8 w-8 animate-spin text-primary" />
                              <span className="text-sm text-muted-foreground">Cargando imagen...</span>
                            </div>
                          </div>
                        ) : highResPreviewUrl ? (
                          <img
                            src={highResPreviewUrl}
                            alt="Factura"
                            className="mx-auto"
                            style={{ width: `${imageZoom}%`, maxWidth: 'none' }}
                          />
                        ) : viewingFile.previewUrl ? (
                          <img
                            src={viewingFile.previewUrl}
                            alt="Factura"
                            className="mx-auto"
                            style={{ width: `${imageZoom}%`, maxWidth: 'none' }}
                          />
                        ) : (
                          <div className="h-64 flex items-center justify-center text-muted-foreground">
                            No hay vista previa disponible
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Columna derecha: Datos extraídos (2/5 = 40%) */}
                    <div className="p-4 space-y-4 lg:col-span-2">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-success" />
                        Datos Extraídos por IA
                      </h3>

                      {ext && (
                        <>
                          {/* Proveedor */}
                          <div className="space-y-2">
                            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Proveedor</h4>
                            <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Razón Social:</span>
                                <span className="font-medium">{ext.proveedor?.razon_social || '-'}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">CUIT:</span>
                                <span style={{ fontFamily: 'Calibri, sans-serif' }}>{ext.proveedor?.cuit || '-'}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Condición IVA:</span>
                                <span>{ext.proveedor?.condicion_iva || '-'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Comprobante */}
                          <div className="space-y-2">
                            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Comprobante</h4>
                            <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Tipo:</span>
                                <span className="font-semibold">{ext.tipo_comprobante} {ext.letra_comprobante}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Número:</span>
                                <span style={{ fontFamily: 'Calibri, sans-serif' }}>{ext.punto_venta}-{ext.numero_comprobante}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Fecha Emisión:</span>
                                <span style={{ fontFamily: 'Calibri, sans-serif' }}>{formatDate(ext.fecha_emision)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Fecha Vto. Pago:</span>
                                <span style={{ fontFamily: 'Calibri, sans-serif' }}>{formatDate(ext.fecha_vencimiento_pago)}</span>
                              </div>
                              <Separator className="my-2" />
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">CAE:</span>
                                <span className="text-xs" style={{ fontFamily: 'Calibri, sans-serif' }}>{ext.cae || '-'}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Vto. CAE:</span>
                                <span style={{ fontFamily: 'Calibri, sans-serif' }}>{formatDate(ext.fecha_vencimiento_cae)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Items */}
                          {ext.items && ext.items.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Items ({ext.items.length})
                              </h4>
                              <div className="border rounded-lg overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-muted/30">
                                      <TableHead className="text-xs">Descripción</TableHead>
                                      <TableHead className="text-xs text-right w-16">Cant.</TableHead>
                                      <TableHead className="text-xs text-right w-24">Subtotal</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {ext.items.map((item, idx) => (
                                      <TableRow key={idx}>
                                        <TableCell className="text-xs">{item.descripcion}</TableCell>
                                        <TableCell className="text-xs text-right" style={{ fontFamily: 'Calibri, sans-serif' }}>
                                          {item.cantidad}
                                        </TableCell>
                                        <TableCell className="text-xs text-right font-medium" style={{ fontFamily: 'Calibri, sans-serif' }}>
                                          {formatCurrency(item.subtotal)}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          )}

                          {/* Totales */}
                          <div className="space-y-2">
                            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Totales</h4>
                            <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Neto Gravado:</span>
                                <span style={{ fontFamily: 'Calibri, sans-serif' }}>{formatCurrency(ext.subtotal_neto_gravado)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">IVA 21%:</span>
                                <span style={{ fontFamily: 'Calibri, sans-serif' }}>{formatCurrency(ext.iva_21)}</span>
                              </div>
                              {(ext.iva_10_5 || 0) > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">IVA 10.5%:</span>
                                  <span style={{ fontFamily: 'Calibri, sans-serif' }}>{formatCurrency(ext.iva_10_5)}</span>
                                </div>
                              )}
                              {(ext.percepciones_iva || 0) > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Perc. IVA:</span>
                                  <span style={{ fontFamily: 'Calibri, sans-serif' }}>{formatCurrency(ext.percepciones_iva)}</span>
                                </div>
                              )}
                              {(ext.percepciones_iibb || 0) > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Perc. IIBB:</span>
                                  <span style={{ fontFamily: 'Calibri, sans-serif' }}>{formatCurrency(ext.percepciones_iibb)}</span>
                                </div>
                              )}
                              <Separator className="my-2" />
                              <div className="flex justify-between text-base font-bold">
                                <span>TOTAL:</span>
                                <span className="text-primary" style={{ fontFamily: 'Calibri, sans-serif' }}>
                                  {formatCurrency(ext.total)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}
