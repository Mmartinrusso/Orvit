'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { cn, formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { useApiMutation, createFetchMutation } from '@/hooks/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ClientFormDialog } from '@/components/ventas/client-form-dialog';
import {
  Plus,
  Check,
  ChevronsUpDown,
  Send,
  Save,
  Loader2,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileText,
  LayoutTemplate,
  Sparkles,
  Info,
  X,
  Truck,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientLight {
  id: string;
  legalName: string;
  name?: string | null;
  email?: string | null;
  paymentTerms?: number;
  defaultPriceList?: { id: number; nombre: string } | null;
}

interface VendedorLight {
  id: number;
  nombre: string;
  zona?: { id: number; nombre: string } | null;
}

interface QuoteVersionLight {
  version: number;
  createdAt: string;
  createdBy: { id: number; name: string };
  motivo: string | null;
}

interface Permisos {
  canViewCosts: boolean;
  canViewMargins: boolean;
  canOverrideMargins: boolean;
}

interface QuoteTextTemplateLight {
  id: number;
  tipo: 'NOTA' | 'PAGO' | 'ENTREGA';
  nombre: string;
  contenido: string;
}

interface TemplateLight {
  id: number;
  nombre: string;
  isDefault: boolean;
  preset?: string | null;
  notasFooter?: string | null;
  notasPosition: 'before_items' | 'after_totals';
  paymentConditionPresets: { label: string; value: string }[];
}

interface DraftItem {
  _key: string;
  productId?: string | null;
  codigo?: string | null;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  descuento: number;
  subtotal: number;
  aplicaComision: boolean;
  fromPriceList?: boolean;
}

interface Product {
  id: string;
  name: string;
  code?: string | null;
  sku?: string | null;
  unit: string;
  salePrice?: number | null;
  aplicaComision?: boolean;
}

interface QuoteEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote?: {
    id: number;
    numero?: string;
    clientId?: string;
    client?: ClientLight;
    seller?: { id: number; nombre?: string } | null;
    titulo?: string | null;
    templateId?: number | null;
    moneda?: string;
    fechaValidez?: string;
    discriminarIva?: boolean;
    descuentoGlobal?: number;
    condicionesPago?: string | null;
    diasPlazo?: number | null;
    condicionesEntrega?: string | null;
    incluyeFlete?: boolean;
    tiempoEntrega?: string | null;
    lugarEntrega?: string | null;
    notas?: string | null;
    notasInternas?: string | null;
    items?: DraftItem[];
  };
  isEditing?: boolean;
  onQuoteCreated?: () => void;
  onQuoteUpdated?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDefaultValidez(days = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function calcTotals(items: DraftItem[], descGlobal: number, discriminarIva: boolean) {
  const subtotalItems = items.reduce((s, i) => s + i.subtotal, 0);
  const descMonto = subtotalItems * (descGlobal / 100);
  const baseImponible = subtotalItems - descMonto;
  const iva = discriminarIva ? baseImponible * 0.21 : 0;
  const total = baseImponible + iva;
  return { subtotal: subtotalItems, descMonto, baseImponible, iva, total };
}

// ─── Item Row ─────────────────────────────────────────────────────────────────

function ItemRow({
  item,
  index,
  onUpdate,
  onRemove,
  onToggleComision,
}: {
  item: DraftItem;
  index: number;
  onUpdate: (key: string, field: keyof DraftItem, value: string | number) => void;
  onRemove: (key: string) => void;
  onToggleComision: (key: string) => void;
}) {
  const calcSub = (qty: number, price: number, disc: number) =>
    qty * price * (1 - disc / 100);

  return (
    <tr className="border-b last:border-b-0 group">
      <td className="p-1.5 text-xs text-muted-foreground w-6 text-center">{index + 1}</td>
      <td className="p-1.5">
        <Input
          value={item.descripcion}
          onChange={e => onUpdate(item._key, 'descripcion', e.target.value)}
          className="h-7 text-xs border-0 shadow-none focus-visible:ring-1 bg-transparent"
          placeholder="Descripción del ítem"
        />
        {item.codigo && <p className="text-[10px] text-muted-foreground pl-2">{item.codigo}</p>}
      </td>
      <td className="p-1.5 w-20">
        <Input
          type="number"
          value={item.cantidad}
          onChange={e => {
            const v = parseFloat(e.target.value) || 0;
            onUpdate(item._key, 'cantidad', v);
          }}
          className="h-7 text-xs text-right border-0 shadow-none focus-visible:ring-1 bg-transparent"
          min="0.01"
          step="0.01"
        />
      </td>
      <td className="p-1.5 w-8 text-center text-xs text-muted-foreground">{item.unidad}</td>
      <td className="p-1.5 w-28">
        <div className="relative">
          <Input
            type="number"
            value={item.precioUnitario}
            onChange={e => {
              const v = parseFloat(e.target.value) || 0;
              onUpdate(item._key, 'precioUnitario', v);
            }}
            className="h-7 text-xs text-right border-0 shadow-none focus-visible:ring-1 bg-transparent"
            min="0"
            step="0.01"
          />
          {item.fromPriceList && (
            <span
              className="absolute -top-1 -right-1 text-[8px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700 rounded px-0.5 leading-tight"
              title="Precio de la lista del cliente"
            >
              LP
            </span>
          )}
        </div>
      </td>
      <td className="p-1.5 w-16">
        <Input
          type="number"
          value={item.descuento}
          onChange={e => {
            const v = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
            onUpdate(item._key, 'descuento', v);
          }}
          className="h-7 text-xs text-right border-0 shadow-none focus-visible:ring-1 bg-transparent"
          min="0"
          max="100"
        />
      </td>
      <td className="p-1.5 w-28 text-right text-xs font-medium pr-2">
        {formatCurrency(item.subtotal)}
      </td>
      <td className="p-1 w-16 text-center">
        <button
          onClick={() => onToggleComision(item._key)}
          title={item.aplicaComision ? 'Con comisión — click para excluir' : 'Sin comisión — click para incluir'}
          className={cn(
            'h-5 px-1.5 rounded text-[10px] font-medium border transition-colors',
            item.aplicaComision
              ? 'border-transparent text-muted-foreground/40 hover:border-border hover:text-muted-foreground'
              : 'bg-amber-100 border-amber-300 text-amber-700 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-400'
          )}
        >
          {item.aplicaComision ? '% com.' : 'sin com.'}
        </button>
      </td>
      <td className="p-1 w-8">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
          onClick={() => onRemove(item._key)}
        >
          <X className="h-3 w-3" />
        </Button>
      </td>
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function QuoteEditorModal({
  open,
  onOpenChange,
  quote,
  isEditing = false,
  onQuoteCreated,
  onQuoteUpdated,
}: QuoteEditorModalProps) {
  // — Data
  const [clients, setClients] = useState<ClientLight[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [templates, setTemplates] = useState<TemplateLight[]>([]);

  // — Selection
  const [selectedClient, setSelectedClient] = useState<ClientLight | null>(quote?.client ?? null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateLight | null>(null);
  const [clientsOpen, setClientsOpen] = useState(false);
  const [showClientForm, setShowClientForm] = useState(false);

  // — Items
  const [items, setItems] = useState<DraftItem[]>(quote?.items ?? []);
  const [quickSearch, setQuickSearch] = useState('');
  const [quickProduct, setQuickProduct] = useState<Product | null>(null);
  const [quickQty, setQuickQty] = useState('1');
  const [quickPrice, setQuickPrice] = useState('');
  const [quickOpen, setQuickOpen] = useState(false);

  // — Form fields
  const [titulo, setTitulo] = useState(quote?.titulo ?? '');
  const [moneda, setMoneda] = useState<'ARS' | 'USD'>((quote?.moneda as 'ARS' | 'USD') ?? 'ARS');
  const [fechaValidez, setFechaValidez] = useState(
    quote?.fechaValidez ? quote.fechaValidez.split('T')[0] : getDefaultValidez(30)
  );
  const [discriminarIva, setDiscriminarIva] = useState(quote?.discriminarIva ?? false);
  const [descuentoGlobal, setDescuentoGlobal] = useState(quote?.descuentoGlobal ?? 0);
  const [condicionesPago, setCondicionesPago] = useState(quote?.condicionesPago ?? '');
  const [diasPlazo, setDiasPlazo] = useState<string>(
    quote?.diasPlazo != null ? String(quote.diasPlazo) : ''
  );
  const [condicionesEntrega, setCondicionesEntrega] = useState(quote?.condicionesEntrega ?? '');
  const [incluyeFlete, setIncluyeFlete] = useState(quote?.incluyeFlete ?? false);
  const [tiempoEntrega, setTiempoEntrega] = useState(quote?.tiempoEntrega ?? '');
  const [lugarEntrega, setLugarEntrega] = useState(quote?.lugarEntrega ?? '');
  const [notas, setNotas] = useState(quote?.notas ?? '');
  const [notasInternas, setNotasInternas] = useState(quote?.notasInternas ?? '');

  // — UI state
  const [showEntrega, setShowEntrega] = useState(false);

  // — Vendedor
  const [vendedores, setVendedores] = useState<VendedorLight[]>([]);
  const [selectedVendedorId, setSelectedVendedorId] = useState<number | null>(
    quote?.seller?.id ?? null
  );

  // — Lista de precios del cliente
  const [clientPriceMap, setClientPriceMap] = useState<Map<string, number>>(new Map());
  const [priceListLabel, setPriceListLabel] = useState<string | null>(null);

  // — Permisos
  const [permisos, setPermisos] = useState<Permisos>({
    canViewCosts: false,
    canViewMargins: false,
    canOverrideMargins: false,
  });

  // — Plantillas de texto
  const [textTemplates, setTextTemplates] = useState<QuoteTextTemplateLight[]>([]);

  // — PDF y versiones
  const [savedQuoteId, setSavedQuoteId] = useState<number | null>(quote?.id ?? null);
  const [versions, setVersions] = useState<QuoteVersionLight[]>([]);
  const [showVersions, setShowVersions] = useState(false);

  // — Computed
  const totals = calcTotals(items, descuentoGlobal, discriminarIva);
  const notasPos = selectedTemplate?.notasPosition ?? 'after_totals';
  const baseComision = items
    .filter(i => i.aplicaComision)
    .reduce((s, i) => s + i.subtotal, 0);
  const hayItemsSinComision = items.some(i => !i.aplicaComision);

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      const [cRes, pRes, tRes, vRes, permRes, txtRes] = await Promise.all([
        fetch('/api/ventas/clientes?limit=500'),
        fetch('/api/ventas/productos?active=true&limit=500'),
        fetch('/api/configuracion/cotizaciones'),
        fetch('/api/ventas/vendedores'),
        fetch('/api/ventas/cotizaciones/permisos'),
        fetch('/api/configuracion/cotizaciones/text-templates'),
      ]);
      if (cRes.ok) {
        const d = await cRes.json();
        setClients(d.clients ?? []);
      }
      if (pRes.ok) {
        const d = await pRes.json();
        setProducts(d.data ?? d.products ?? []);
      }
      if (tRes.ok) {
        const d = await tRes.json();
        const tpls: TemplateLight[] = d.templates ?? [];
        setTemplates(tpls);
        if (!isEditing) {
          const def = tpls.find(t => t.isDefault) ?? tpls[0];
          if (def) applyTemplate(def, true);
        } else if (quote?.templateId) {
          const tpl = tpls.find(t => t.id === quote.templateId);
          if (tpl) setSelectedTemplate(tpl);
        }
      }
      if (vRes.ok) {
        const d = await vRes.json();
        setVendedores(Array.isArray(d) ? d : []);
      }
      if (permRes.ok) {
        const d = await permRes.json();
        setPermisos(d);
      }
      if (txtRes.ok) {
        const d = await txtRes.json();
        setTextTemplates(Array.isArray(d) ? d : []);
      }

      // Cargar versiones solo al editar
      if (isEditing && quote?.id) {
        try {
          const verRes = await fetch(`/api/ventas/cotizaciones/${quote.id}/versions`);
          if (verRes.ok) {
            const verData = await verRes.json();
            setVersions(verData.versions ?? []);
          }
        } catch {
          // versions are non-critical, silently ignore
        }
      }
    } catch {
      console.error('Error loading quote editor data');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open) loadData();
  }, [open, loadData]);

  // ── Load client price list when client changes ─────────────────────────────

  useEffect(() => {
    const priceListId = selectedClient?.defaultPriceList?.id;
    if (!priceListId) {
      setClientPriceMap(new Map());
      setPriceListLabel(null);
      return;
    }
    fetch(`/api/ventas/listas-precios/${priceListId}/items`)
      .then(r => r.ok ? r.json() : [])
      .then((items: { productId: string; precioUnitario: number | string }[]) => {
        const map = new Map<string, number>(
          items.map(i => [i.productId, Number(i.precioUnitario)])
        );
        setClientPriceMap(map);
        setPriceListLabel(selectedClient?.defaultPriceList?.nombre ?? null);
      })
      .catch(() => {
        setClientPriceMap(new Map());
        setPriceListLabel(null);
      });
  }, [selectedClient]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Template apply ─────────────────────────────────────────────────────────

  const applyTemplate = (tpl: TemplateLight, isInitial = false) => {
    setSelectedTemplate(tpl);
    if (isInitial || !notas) {
      setNotas(tpl.notasFooter ?? '');
    }
  };

  // ── Items management ───────────────────────────────────────────────────────

  const calcSubtotal = (qty: number, price: number, disc: number) =>
    qty * price * (1 - disc / 100);

  const updateItem = (key: string, field: keyof DraftItem, value: string | number) => {
    setItems(prev => prev.map(item => {
      if (item._key !== key) return item;
      const updated = { ...item, [field]: value };
      updated.subtotal = calcSubtotal(
        field === 'cantidad' ? Number(value) : updated.cantidad,
        field === 'precioUnitario' ? Number(value) : updated.precioUnitario,
        field === 'descuento' ? Number(value) : updated.descuento
      );
      return updated;
    }));
  };

  const removeItem = (key: string) => setItems(prev => prev.filter(i => i._key !== key));

  const toggleItemComision = (key: string) => {
    setItems(prev => prev.map(i =>
      i._key === key ? { ...i, aplicaComision: !i.aplicaComision } : i
    ));
  };

  const selectProduct = (p: Product) => {
    setQuickProduct(p);
    setQuickSearch(`${p.code ?? p.sku ?? ''} - ${p.name}`.replace(/^- /, ''));
    const priceFromList = clientPriceMap.get(p.id);
    setQuickPrice(String(priceFromList ?? p.salePrice ?? ''));
    setQuickOpen(false);
    // Foco automático en cantidad
    setTimeout(() => qtyInputRef.current?.focus(), 50);
  };

  const addQuickItem = () => {
    const qty = parseFloat(quickQty) || 1;
    // Precio: precio lista del cliente > precio manual ingresado > precio de venta del producto
    const fromPriceList = quickProduct ? clientPriceMap.has(quickProduct.id) : false;
    const priceFromList = quickProduct ? (clientPriceMap.get(quickProduct.id) ?? null) : null;
    const price = parseFloat(quickPrice) || priceFromList || (quickProduct?.salePrice ?? 0);
    if (!quickProduct && !quickSearch.trim()) return;
    const newItem: DraftItem = {
      _key: Math.random().toString(36).slice(2),
      productId: quickProduct?.id ?? null,
      codigo: quickProduct?.sku ?? null,
      descripcion: quickProduct ? quickProduct.name : quickSearch.trim(),
      cantidad: qty,
      unidad: quickProduct?.unit ?? 'UN',
      precioUnitario: price,
      descuento: 0,
      subtotal: calcSubtotal(qty, price, 0),
      aplicaComision: quickProduct?.aplicaComision ?? true,
      fromPriceList,
    };
    setItems(prev => [...prev, newItem]);
    setQuickSearch('');
    setQuickProduct(null);
    setQuickQty('1');
    setQuickPrice('');
    setQuickOpen(false);
    // Re-enfocar el campo de búsqueda para agregar el próximo producto rápido
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  // ── Mutations ────────────────────────────────────────────────────────────────

  const saveMutation = useApiMutation<{ cotizacion: { id: number } }, Record<string, unknown>>({
    mutationFn: createFetchMutation({
      url: isEditing
        ? `/api/ventas/cotizaciones/${quote?.id}`
        : '/api/ventas/cotizaciones',
      method: isEditing ? 'PUT' : 'POST',
    }),
    invalidateKeys: [['quotes']],
    successMessage: null,
    errorMessage: 'Error al guardar',
  });

  const sendQuoteMutation = useApiMutation<unknown, { quoteId: number }>({
    mutationFn: async ({ quoteId }) => {
      const res = await fetch(`/api/ventas/cotizaciones/${quoteId}/enviar`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al enviar cotización');
      }
      return res.json();
    },
    invalidateKeys: [['quotes']],
    successMessage: null,
    errorMessage: 'Error al enviar cotización',
  });

  const saving = saveMutation.isPending || sendQuoteMutation.isPending;

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async (action: 'draft' | 'send') => {
    if (!selectedClient) { toast.error('Seleccioná un cliente'); return; }
    if (items.length === 0) { toast.error('Agregá al menos un producto'); return; }

    const body = {
      clientId: selectedClient.id,
      sellerId: selectedVendedorId ?? null,
      templateId: selectedTemplate?.id ?? null,
      titulo: titulo.trim() || null,
      moneda,
      fechaValidez: fechaValidez ? new Date(fechaValidez).toISOString() : null,
      discriminarIva,
      descuentoGlobal,
      condicionesPago: condicionesPago.trim() || null,
      diasPlazo: diasPlazo !== '' ? parseInt(diasPlazo) : null,
      condicionesEntrega: condicionesEntrega.trim() || null,
      incluyeFlete,
      tiempoEntrega: tiempoEntrega.trim() || null,
      lugarEntrega: lugarEntrega.trim() || null,
      notas: notas.trim() || null,
      notasInternas: notasInternas.trim() || null,
      items: items.map(i => ({
        productId: i.productId ?? null,
        codigo: i.codigo ?? null,
        descripcion: i.descripcion,
        cantidad: i.cantidad,
        unidad: i.unidad,
        precioUnitario: i.precioUnitario,
        descuento: i.descuento,
        aplicaComision: i.aplicaComision,
      })),
    };

    toast.loading(action === 'send' ? 'Enviando cotización...' : 'Guardando borrador...', { id: 'cot-save' });
    try {
      const { cotizacion } = await saveMutation.mutateAsync(body as Record<string, unknown>);

      // Guardar el ID para el botón "Ver PDF"
      if (cotizacion?.id) {
        setSavedQuoteId(cotizacion.id);
      }

      if (action === 'send' && cotizacion?.id) {
        await sendQuoteMutation.mutateAsync({ quoteId: cotizacion.id });
      }

      toast.success(
        action === 'send' ? 'Cotización enviada al cliente' : 'Guardada como borrador',
        { id: 'cot-save' }
      );

      if (isEditing) onQuoteUpdated?.();
      else onQuoteCreated?.();
      onOpenChange(false);
    } catch {
      // Dismiss the loading toast — the mutation hook already shows the error toast
      toast.dismiss('cot-save');
    }
  };

  // ── Refs para foco de teclado ─────────────────────────────────────────────

  const searchInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);

  // ── Filtered products ──────────────────────────────────────────────────────

  const filteredProducts = quickSearch
    ? products
        .filter(p => {
          const q = quickSearch.toLowerCase();
          return (
            p.name.toLowerCase().includes(q) ||
            (p.sku && p.sku.toLowerCase().includes(q)) ||
            (p.code && p.code.toLowerCase().includes(q))
          );
        })
        .slice(0, 12)
    : [];

  // ── Notas section (shared) ─────────────────────────────────────────────────

  const notasTpls = textTemplates.filter(t => t.tipo === 'NOTA');
  const pagoTpls  = textTemplates.filter(t => t.tipo === 'PAGO');
  const entregaTpls = textTemplates.filter(t => t.tipo === 'ENTREGA');

  const TextChips = ({
    chips,
    currentValue,
    onSelect,
  }: {
    chips: QuoteTextTemplateLight[];
    currentValue: string;
    onSelect: (v: string) => void;
  }) => chips.length === 0 ? null : (
    <div className="flex flex-wrap gap-1.5">
      {chips.map(c => (
        <button
          key={c.id}
          type="button"
          onClick={() => onSelect(c.contenido)}
          className={cn(
            'px-2.5 py-1 rounded-full text-xs border transition-colors',
            currentValue === c.contenido
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border hover:bg-muted text-muted-foreground'
          )}
        >
          {c.nombre}
        </button>
      ))}
    </div>
  );

  const NotasSection = (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs font-medium">Notas del documento</Label>
        {selectedTemplate && (
          <Badge variant="outline" className="text-[10px] h-4 font-normal">
            {notasPos === 'before_items' ? 'Posición: arriba' : 'Posición: al pie'}
          </Badge>
        )}
      </div>
      <TextChips chips={notasTpls} currentValue={notas} onSelect={setNotas} />
      <Textarea
        value={notas}
        onChange={e => setNotas(e.target.value)}
        rows={3}
        className="text-xs resize-none"
        placeholder="ej: Precios en pesos sin IVA. Validez 15 días. Los precios no incluyen fletes..."
      />
      <p className="text-[10px] text-muted-foreground">
        Visible para el cliente. La posición en el documento se configura en el template.
      </p>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="full">
          <DialogHeader>
            <DialogTitle>
              {isEditing
                ? `Editando cotización${quote?.numero ? ` ${quote.numero}` : ''}`
                : 'Nueva Cotización'}
            </DialogTitle>
          </DialogHeader>

          <DialogBody>
            <div className="flex gap-5 h-full min-h-0">

              {/* ── Left column ── */}
              <div className="flex-1 flex flex-col gap-4 min-w-0 overflow-y-auto pr-1">

                {/* Client + title */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Cliente *</Label>
                  <div className="flex gap-2">
                    <Popover open={clientsOpen} onOpenChange={setClientsOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="flex-1 justify-between font-normal"
                        >
                          {selectedClient
                            ? (selectedClient.legalName || selectedClient.name || 'Sin nombre')
                            : 'Seleccionar cliente...'}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[380px] p-0">
                        <Command>
                          <CommandInput placeholder="Buscar cliente..." />
                          <CommandList>
                            <CommandEmpty>No se encontraron clientes.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                onSelect={() => { setClientsOpen(false); setShowClientForm(true); }}
                                className="text-primary font-medium border-b"
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Crear nuevo cliente...
                              </CommandItem>
                              {clients.map(c => (
                                <CommandItem
                                  key={c.id}
                                  value={c.legalName || c.name || c.id}
                                  onSelect={() => { setSelectedClient(c); setClientsOpen(false); }}
                                >
                                  <Check className={cn('mr-2 h-4 w-4', selectedClient?.id === c.id ? 'opacity-100' : 'opacity-0')} />
                                  <div>
                                    <p className="font-medium text-sm">{c.legalName || c.name}</p>
                                    {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  {priceListLabel && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <span className="font-bold border border-emerald-400 rounded px-0.5 text-[9px]">LP</span>
                      Lista de precios: <span className="font-medium">{priceListLabel}</span>
                    </p>
                  )}
                  <Input
                    value={titulo}
                    onChange={e => setTitulo(e.target.value)}
                    placeholder="Título de la cotización (opcional)"
                    className="text-sm"
                  />
                </div>

                {/* Notas BEFORE items */}
                {notasPos === 'before_items' && (
                  <div className="border rounded-lg p-3 bg-amber-50/50 dark:bg-amber-950/10 border-amber-200/50">
                    {NotasSection}
                  </div>
                )}

                {/* Quick-add row */}
                <div className="border rounded-lg p-3 space-y-2 bg-muted/20">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Agregar productos</Label>
                  {/* Labels above */}
                  <div className="flex gap-2 text-[10px] text-muted-foreground pl-0.5">
                    <span className="flex-1">Código / nombre del producto</span>
                    <span className="w-20 text-right">Cant.</span>
                    <span className="w-28 text-right">Precio unit.</span>
                    <span className="w-[68px]" />
                  </div>
                  <div className="flex gap-2">
                    <Popover open={quickOpen} onOpenChange={setQuickOpen}>
                      <PopoverTrigger asChild>
                        <div className="flex-1 relative">
                          <Input
                            ref={searchInputRef}
                            value={quickSearch}
                            onChange={e => {
                              setQuickSearch(e.target.value);
                              setQuickOpen(true);
                              setQuickProduct(null);
                            }}
                            onFocus={() => { if (quickSearch) setQuickOpen(true); }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                // Buscar coincidencia exacta por código primero, luego por nombre
                                const q = quickSearch.trim().toLowerCase();
                                const exact = filteredProducts.find(
                                  p =>
                                    p.code?.toLowerCase() === q ||
                                    p.sku?.toLowerCase() === q
                                );
                                const single = filteredProducts.length === 1 ? filteredProducts[0] : null;
                                const match = exact ?? single;
                                if (match) {
                                  selectProduct(match);
                                } else if (filteredProducts.length > 1) {
                                  // Abrir dropdown para que elija
                                  setQuickOpen(true);
                                } else if (quickSearch.trim()) {
                                  // Ítem libre — foco a cantidad
                                  setQuickOpen(false);
                                  setTimeout(() => qtyInputRef.current?.focus(), 50);
                                }
                              }
                              if (e.key === 'Escape') {
                                setQuickOpen(false);
                              }
                            }}
                            placeholder="Código, SKU o nombre..."
                            className="text-sm pr-8"
                          />
                          {quickSearch && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full w-9"
                              onClick={() => { setQuickSearch(''); setQuickProduct(null); }}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[380px] p-0"
                        align="start"
                        onOpenAutoFocus={e => e.preventDefault()}
                      >
                        <Command>
                          <CommandList>
                            <CommandEmpty>No se encontraron productos.</CommandEmpty>
                            <CommandGroup>
                              {filteredProducts.map(p => (
                                <CommandItem
                                  key={p.id}
                                  value={p.name}
                                  onSelect={() => selectProduct(p)}
                                >
                                  <div className="flex flex-col">
                                    <span className="font-medium text-sm">{p.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {p.code ?? p.sku} · {p.unit} ·{' '}
                                      {clientPriceMap.has(p.id) ? (
                                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                          {formatCurrency(clientPriceMap.get(p.id)!)} <span className="text-[10px]">(LP)</span>
                                        </span>
                                      ) : (
                                        p.salePrice != null ? formatCurrency(p.salePrice) : 'Sin precio'
                                      )}
                                    </span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <Input
                      ref={qtyInputRef}
                      type="number"
                      value={quickQty}
                      onChange={e => setQuickQty(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          priceInputRef.current?.focus();
                          priceInputRef.current?.select();
                        }
                      }}
                      placeholder="1"
                      className="w-20 text-sm text-right"
                      min="0.01"
                      step="0.01"
                    />
                    <Input
                      ref={priceInputRef}
                      type="number"
                      value={quickPrice}
                      onChange={e => setQuickPrice(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addQuickItem();
                        }
                      }}
                      placeholder="0.00"
                      className="w-28 text-sm text-right"
                      min="0"
                      step="0.01"
                    />
                    <Button
                      onClick={addQuickItem}
                      disabled={!quickSearch.trim()}
                      size="sm"
                      className="shrink-0"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Agregar
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Escribí el código y presioná <kbd className="px-1 py-0.5 rounded border text-[9px] bg-muted">Enter</kbd> para auto-seleccionar.
                    Luego ingresá cantidad → <kbd className="px-1 py-0.5 rounded border text-[9px] bg-muted">Enter</kbd> → precio → <kbd className="px-1 py-0.5 rounded border text-[9px] bg-muted">Enter</kbd>.
                  </p>
                </div>

                {/* Items table */}
                {items.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="w-6 p-1.5 text-left text-[10px] font-medium text-muted-foreground">#</th>
                          <th className="p-1.5 text-left text-[10px] font-medium text-muted-foreground">Descripción</th>
                          <th className="p-1.5 text-right text-[10px] font-medium text-muted-foreground w-20">Cant.</th>
                          <th className="p-1.5 text-center text-[10px] font-medium text-muted-foreground w-8">UD</th>
                          <th className="p-1.5 text-right text-[10px] font-medium text-muted-foreground w-28">P. Unit.</th>
                          <th className="p-1.5 text-right text-[10px] font-medium text-muted-foreground w-16">Desc%</th>
                          <th className="p-1.5 text-right text-[10px] font-medium text-muted-foreground w-28 pr-2">Subtotal</th>
                          <th className="p-1.5 text-center text-[10px] font-medium text-muted-foreground w-16">Com.</th>
                          <th className="w-8" />
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => (
                          <ItemRow
                            key={item._key}
                            item={item}
                            index={idx}
                            onUpdate={updateItem}
                            onRemove={removeItem}
                            onToggleComision={toggleItemComision}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="border-2 border-dashed rounded-lg p-8 text-center">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">Sin productos agregados</p>
                    <p className="text-xs text-muted-foreground/60">
                      Usá el campo de búsqueda de arriba para agregar ítems
                    </p>
                  </div>
                )}

                {/* Notas AFTER totals (default) */}
                {notasPos === 'after_totals' && (
                  <div className="space-y-2">
                    {NotasSection}
                  </div>
                )}
              </div>

              {/* ── Right sidebar ── */}
              <div className="w-[300px] flex-shrink-0 flex flex-col gap-3 overflow-y-auto">

                {/* Template selector */}
                {templates.length > 0 && (
                  <div className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <LayoutTemplate className="h-3.5 w-3.5 text-muted-foreground" />
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Template de diseño
                      </Label>
                    </div>
                    <div className="space-y-1">
                      {templates.map(tpl => (
                        <button
                          key={tpl.id}
                          onClick={() => applyTemplate(tpl)}
                          className={cn(
                            'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-sm transition-colors border',
                            selectedTemplate?.id === tpl.id
                              ? 'bg-primary/5 border-primary text-primary font-medium'
                              : 'border-transparent hover:bg-muted/50 text-foreground'
                          )}
                        >
                          <span className="flex items-center gap-1.5 truncate">
                            {selectedTemplate?.id === tpl.id && (
                              <Check className="h-3 w-3 shrink-0" />
                            )}
                            <span className="truncate">{tpl.nombre}</span>
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {tpl.isDefault && (
                              <Badge variant="secondary" className="text-[9px] h-4 px-1">default</Badge>
                            )}
                            {tpl.preset && (
                              <Sparkles className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* General */}
                <div className="border rounded-lg p-3 space-y-3">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">General</Label>

                  {/* Selector de vendedor */}
                  {vendedores.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Vendedor</Label>
                      <Select
                        value={selectedVendedorId?.toString() ?? ''}
                        onValueChange={v => setSelectedVendedorId(v ? Number(v) : null)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Sin asignar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Sin asignar</SelectItem>
                          {vendedores.map(v => (
                            <SelectItem key={v.id} value={v.id.toString()}>
                              {v.nombre}{v.zona ? ` · ${v.zona.nombre}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    {(['ARS', 'USD'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setMoneda(m)}
                        className={cn(
                          'py-1.5 px-2 rounded-md text-xs font-medium border transition-colors',
                          moneda === m
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border hover:bg-muted'
                        )}
                      >
                        {m === 'ARS' ? '$ Pesos' : 'US$ Dólares'}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Válida hasta</Label>
                    <Input
                      type="date"
                      value={fechaValidez}
                      onChange={e => setFechaValidez(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Descuento global (%)</Label>
                    <Input
                      type="number"
                      value={descuentoGlobal}
                      onChange={e =>
                        setDescuentoGlobal(
                          Math.min(100, Math.max(0, parseFloat(e.target.value) || 0))
                        )
                      }
                      className="h-8 text-sm"
                      min="0"
                      max="100"
                      step="0.5"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">IVA discriminado</p>
                      <p className="text-xs text-muted-foreground">Tipo A · 21% separado</p>
                    </div>
                    <Switch checked={discriminarIva} onCheckedChange={setDiscriminarIva} />
                  </div>
                </div>

                {/* Condiciones de pago */}
                <div className="border rounded-lg p-3 space-y-3">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Condiciones de pago
                  </Label>

                  {/* Plantillas de texto de empresa */}
                  <TextChips chips={pagoTpls} currentValue={condicionesPago} onSelect={setCondicionesPago} />

                  {/* Presets del template visual (si existen) */}
                  {selectedTemplate?.paymentConditionPresets &&
                    selectedTemplate.paymentConditionPresets.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedTemplate.paymentConditionPresets.map(p => (
                          <button
                            key={p.label}
                            type="button"
                            onClick={() => setCondicionesPago(p.value)}
                            className={cn(
                              'px-2.5 py-1 rounded-full text-xs border transition-colors',
                              condicionesPago === p.value
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'border-border hover:bg-muted text-muted-foreground'
                            )}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    )}

                  <Textarea
                    value={condicionesPago}
                    onChange={e => setCondicionesPago(e.target.value)}
                    rows={2}
                    className="text-xs resize-none"
                    placeholder="ej: Pago al contado, transferencia bancaria..."
                  />

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Días de plazo</Label>
                    <Input
                      type="number"
                      value={diasPlazo}
                      onChange={e => setDiasPlazo(e.target.value)}
                      className="h-8 text-sm"
                      min="0"
                      placeholder="ej: 30"
                    />
                  </div>
                </div>

                {/* Condiciones de entrega (collapsible) */}
                <div className="border rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowEntrega(v => !v)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted/30 transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      Condiciones de entrega
                      {incluyeFlete && (
                        <Badge className="h-4 text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-0 font-normal">
                          <Truck className="h-2.5 w-2.5 mr-0.5" />
                          Flete incluido
                        </Badge>
                      )}
                    </span>
                    {showEntrega ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                  {showEntrega && (
                    <div className="p-3 space-y-3 border-t">
                      {/* Toggle flete */}
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border">
                        <div className="flex items-center gap-2">
                          <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium">Nosotros hacemos el flete</span>
                        </div>
                        <Switch
                          checked={incluyeFlete}
                          onCheckedChange={setIncluyeFlete}
                        />
                      </div>

                      {/* Plantillas de texto */}
                      <TextChips chips={entregaTpls} currentValue={condicionesEntrega} onSelect={setCondicionesEntrega} />

                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Condiciones</Label>
                        <Textarea
                          value={condicionesEntrega}
                          onChange={e => setCondicionesEntrega(e.target.value)}
                          rows={2}
                          className="text-xs resize-none"
                          placeholder="ej: Entrega en planta del cliente..."
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Tiempo</Label>
                          <Input
                            value={tiempoEntrega}
                            onChange={e => setTiempoEntrega(e.target.value)}
                            className="h-8 text-xs"
                            placeholder="ej: 7 días hábiles"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Lugar</Label>
                          <Input
                            value={lugarEntrega}
                            onChange={e => setLugarEntrega(e.target.value)}
                            className="h-8 text-xs"
                            placeholder="ej: CABA"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Notas internas */}
                <div className="border rounded-lg p-3 space-y-2 bg-blue-50/30 dark:bg-blue-950/10 border-blue-200/40">
                  <div className="flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 text-blue-500" />
                    <Label className="text-xs font-medium text-blue-700 dark:text-blue-400">
                      Notas internas
                    </Label>
                  </div>
                  <Textarea
                    value={notasInternas}
                    onChange={e => setNotasInternas(e.target.value)}
                    rows={2}
                    className="text-xs resize-none bg-white/70 dark:bg-black/20"
                    placeholder="Solo visible para el equipo, no aparece en el documento..."
                  />
                </div>

                <Separator />

                {/* Totals */}
                <div className="border rounded-lg p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(totals.subtotal)}</span>
                  </div>
                  {descuentoGlobal > 0 && (
                    <div className="flex justify-between text-sm text-destructive">
                      <span>Descuento ({descuentoGlobal}%)</span>
                      <span>- {formatCurrency(totals.descMonto)}</span>
                    </div>
                  )}
                  {discriminarIva && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">IVA (21%)</span>
                      <span>{formatCurrency(totals.iva)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold text-base">
                    <span>Total {moneda}</span>
                    <span>{formatCurrency(totals.total)}</span>
                  </div>
                  {hayItemsSinComision && (
                    <div className="flex justify-between text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded px-2 py-1">
                      <span>Base comisión</span>
                      <span className="font-medium">{formatCurrency(baseComision)}</span>
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground text-right">
                    {items.length} {items.length === 1 ? 'ítem' : 'ítems'}
                    {discriminarIva ? ' · IVA discriminado' : ' · IVA incluido'}
                  </p>
                </div>

                {/* Historial de versiones (solo al editar) */}
                {isEditing && versions.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <Collapsible open={showVersions} onOpenChange={setShowVersions}>
                      <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted/30 transition-colors">
                        <span>Historial ({versions.length} versiones)</span>
                        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showVersions && 'rotate-180')} />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t p-2 space-y-1.5 max-h-44 overflow-y-auto">
                          {versions.map(v => (
                            <div key={v.version} className="flex gap-2 text-[10px] text-muted-foreground border-l-2 border-border pl-2">
                              <span className="font-mono font-semibold text-foreground shrink-0">v{v.version}</span>
                              <div>
                                <p>{new Date(v.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                                <p>{v.createdBy.name}{v.motivo ? ` · ${v.motivo}` : ''}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-2">
                  <Button
                    className="w-full"
                    onClick={() => handleSave('send')}
                    disabled={saving || !selectedClient || items.length === 0}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    {isEditing ? 'Actualizar y Enviar' : 'Guardar y Enviar'}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleSave('draft')}
                    disabled={saving || !selectedClient || items.length === 0}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Guardar borrador
                  </Button>
                  {savedQuoteId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-muted-foreground hover:text-foreground"
                      onClick={() => window.open(`/api/ventas/cotizaciones/${savedQuoteId}/pdf`, '_blank')}
                    >
                      <FileText className="h-3.5 w-3.5 mr-1.5" />
                      Ver PDF
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <ClientFormDialog
        open={showClientForm}
        onOpenChange={setShowClientForm}
        onClientCreated={(newClient: any) => {
          setClients(prev => [...prev, newClient]);
          setSelectedClient(newClient);
        }}
      />
    </>
  );
}
