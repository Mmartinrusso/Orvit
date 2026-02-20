'use client';

/**
 * Credit Note Create Modal
 *
 * Comprehensive form for creating credit/debit notes with:
 * - Client selection with search
 * - Invoice selection (optional)
 * - Product items with quantities
 * - Tax calculations
 * - Stock impact option
 * - Real-time validation
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Search } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Client {
  id: string;
  name: string;
  legalName?: string;
  cuit?: string;
}

interface Invoice {
  id: number;
  numero: string;
  total: number;
  saldoPendiente: number;
  items?: any[];
}

interface Product {
  id: string;
  name: string;
  sku?: string;
  price: number;
  currentStock: number;
}

interface CreditNoteItem {
  productId?: string;
  codigo?: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  alicuotaIva: number;
}

interface CreditNoteCreateModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  viewMode: 'S' | 'E';
}

const MOTIVO_OPTIONS = [
  { value: 'DEVOLUCION', label: 'Devolución' },
  { value: 'DIFERENCIA_CARGA', label: 'Diferencia de carga' },
  { value: 'DIFERENCIA_PRECIO', label: 'Diferencia de precio' },
  { value: 'BONIFICACION', label: 'Bonificación' },
  { value: 'AJUSTE_FINANCIERO', label: 'Ajuste financiero' },
  { value: 'REFACTURACION', label: 'Refacturación' },
  { value: 'FLETE', label: 'Flete' },
  { value: 'OTRO', label: 'Otro' },
];

export function CreditNoteCreateModal({
  open,
  onClose,
  onSuccess,
  viewMode,
}: CreditNoteCreateModalProps) {
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [formData, setFormData] = useState({
    tipo: 'NOTA_CREDITO' as 'NOTA_CREDITO' | 'NOTA_DEBITO',
    clientId: '',
    invoiceId: '',
    motivo: 'DEVOLUCION',
    descripcion: '',
    fecha: new Date().toISOString().split('T')[0],
    afectaStock: false,
    puntoVenta: 1,
  });

  const [items, setItems] = useState<CreditNoteItem[]>([
    {
      descripcion: '',
      cantidad: 1,
      unidad: 'UN',
      precioUnitario: 0,
      alicuotaIva: 21,
    },
  ]);

  useEffect(() => {
    if (open) {
      loadClients();
      loadProducts();
    }
  }, [open]);

  useEffect(() => {
    if (formData.clientId) {
      loadInvoices(formData.clientId);
    } else {
      setInvoices([]);
    }
  }, [formData.clientId]);

  const loadClients = async () => {
    try {
      const response = await fetch(`/api/ventas/clientes?limit=100`);
      if (response.ok) {
        const data = await response.json();
        setClients(data.data || data || []);
      }
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const loadInvoices = async (clientId: string) => {
    try {
      const response = await fetch(
        `/api/ventas/facturas?clienteId=${clientId}&estado=EMITIDA&limit=50`
      );
      if (response.ok) {
        const data = await response.json();
        setInvoices(data.data || data || []);
      }
    } catch (error) {
      console.error('Error loading invoices:', error);
    }
  };

  const loadProducts = async () => {
    try {
      const response = await fetch(`/api/ventas/productos?limit=100`);
      if (response.ok) {
        const data = await response.json();
        setProducts(data.data || data || []);
      }
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        descripcion: '',
        cantidad: 1,
        unidad: 'UN',
        precioUnitario: 0,
        alicuotaIva: 21,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    setItems(newItems);
  };

  const calculateTotals = () => {
    let netoGravado = 0;
    let iva21 = 0;
    let iva105 = 0;
    let iva27 = 0;
    let exento = 0;

    items.forEach((item) => {
      const subtotal = item.cantidad * item.precioUnitario;

      if (item.alicuotaIva === 21) {
        netoGravado += subtotal;
        iva21 += subtotal * 0.21;
      } else if (item.alicuotaIva === 10.5) {
        netoGravado += subtotal;
        iva105 += subtotal * 0.105;
      } else if (item.alicuotaIva === 27) {
        netoGravado += subtotal;
        iva27 += subtotal * 0.27;
      } else {
        exento += subtotal;
      }
    });

    const total = netoGravado + iva21 + iva105 + iva27 + exento;

    return {
      netoGravado,
      iva21,
      iva105,
      iva27,
      exento,
      total,
    };
  };

  const handleSubmit = async () => {
    // Validations
    if (!formData.clientId) {
      toast.error('Debe seleccionar un cliente');
      return;
    }

    if (!formData.motivo) {
      toast.error('Debe seleccionar un motivo');
      return;
    }

    if (items.some((item) => !item.descripcion || item.precioUnitario <= 0)) {
      toast.error('Todos los items deben tener descripción y precio válido');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/ventas/notas-credito', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `nc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        },
        body: JSON.stringify({
          tipo: formData.tipo,
          motivo: formData.motivo,
          clientId: formData.clientId,
          invoiceId: formData.invoiceId ? parseInt(formData.invoiceId) : undefined,
          fecha: formData.fecha,
          descripcion: formData.descripcion || undefined,
          items: items.map((item) => ({
            productId: item.productId || undefined,
            codigo: item.codigo || undefined,
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            unidad: item.unidad,
            precioUnitario: item.precioUnitario,
            alicuotaIva: item.alicuotaIva,
          })),
          afectaStock: formData.afectaStock,
          puntoVenta: formData.puntoVenta,
          docType: viewMode === 'E' ? 'T2' : 'T1',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al crear nota');
      }

      const result = await response.json();
      toast.success(result.message || 'Nota creada exitosamente');
      onSuccess();
      handleClose();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setFormData({
      tipo: 'NOTA_CREDITO',
      clientId: '',
      invoiceId: '',
      motivo: 'DEVOLUCION',
      descripcion: '',
      fecha: new Date().toISOString().split('T')[0],
      afectaStock: false,
      puntoVenta: 1,
    });
    setItems([
      {
        descripcion: '',
        cantidad: 1,
        unidad: 'UN',
        precioUnitario: 0,
        alicuotaIva: 21,
      },
    ]);
    setClientSearch('');
    onClose();
  };

  const totals = calculateTotals();
  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
      (c.legalName || '').toLowerCase().includes(clientSearch.toLowerCase()) ||
      (c.cuit || '').includes(clientSearch)
  );

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            Nueva Nota de {formData.tipo === 'NOTA_CREDITO' ? 'Crédito' : 'Débito'}
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-6">
          {/* Header Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Nota *</Label>
              <Select
                value={formData.tipo}
                onValueChange={(v: 'NOTA_CREDITO' | 'NOTA_DEBITO') =>
                  setFormData({ ...formData, tipo: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOTA_CREDITO">Nota de Crédito</SelectItem>
                  <SelectItem value="NOTA_DEBITO">Nota de Débito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fecha de Emisión</Label>
              <Input
                type="date"
                value={formData.fecha}
                onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
              />
            </div>
          </div>

          {/* Client Selection */}
          <div className="space-y-2">
            <Label>Cliente *</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {clientSearch && (
              <div className="border rounded-md max-h-48 overflow-y-auto">
                {filteredClients.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => {
                      setFormData({ ...formData, clientId: client.id, invoiceId: '' });
                      setClientSearch('');
                    }}
                    className="w-full text-left p-3 hover:bg-accent border-b last:border-0"
                  >
                    <div className="font-medium">{client.legalName || client.name}</div>
                    {client.cuit && (
                      <div className="text-xs text-muted-foreground">{client.cuit}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
            {formData.clientId && !clientSearch && (
              <div className="flex items-center justify-between p-2 bg-primary/10 rounded-md">
                <span className="text-sm font-medium">
                  {clients.find((c) => c.id === formData.clientId)?.legalName ||
                    clients.find((c) => c.id === formData.clientId)?.name}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFormData({ ...formData, clientId: '', invoiceId: '' })}
                >
                  Cambiar
                </Button>
              </div>
            )}
          </div>

          {/* Invoice Selection (optional) */}
          {invoices.length > 0 && (
            <div className="space-y-2">
              <Label>Factura de Referencia (opcional)</Label>
              <Select
                value={formData.invoiceId}
                onValueChange={(v) => setFormData({ ...formData, invoiceId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin referencia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin referencia</SelectItem>
                  {invoices.map((inv) => (
                    <SelectItem key={inv.id} value={inv.id.toString()}>
                      {inv.numero} ({formatCurrency(Number(inv.total))})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Motivo */}
          <div className="space-y-2">
            <Label>Motivo *</Label>
            <Select
              value={formData.motivo}
              onValueChange={(v) => setFormData({ ...formData, motivo: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOTIVO_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              placeholder="Descripción adicional de la nota..."
              rows={2}
            />
          </div>

          <Separator />

          {/* Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base">Items de la Nota</Label>
              <Button variant="outline" size="sm" onClick={handleAddItem}>
                <Plus className="w-4 h-4 mr-2" />
                Agregar Item
              </Button>
            </div>

            {items.map((item, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Item {index + 1}</Badge>
                  {items.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveItem(index)}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-2">
                    <Label>Descripción *</Label>
                    <Input
                      value={item.descripcion}
                      onChange={(e) =>
                        handleItemChange(index, 'descripcion', e.target.value)
                      }
                      placeholder="Descripción del item"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Cantidad *</Label>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.cantidad}
                      onChange={(e) =>
                        handleItemChange(index, 'cantidad', parseFloat(e.target.value) || 0)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Unidad</Label>
                    <Input
                      value={item.unidad}
                      onChange={(e) => handleItemChange(index, 'unidad', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Precio Unitario *</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.precioUnitario}
                      onChange={(e) =>
                        handleItemChange(
                          index,
                          'precioUnitario',
                          parseFloat(e.target.value) || 0
                        )
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Alícuota IVA</Label>
                    <Select
                      value={item.alicuotaIva.toString()}
                      onValueChange={(v) =>
                        handleItemChange(index, 'alicuotaIva', parseFloat(v))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="21">21%</SelectItem>
                        <SelectItem value="10.5">10.5%</SelectItem>
                        <SelectItem value="27">27%</SelectItem>
                        <SelectItem value="0">Exento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="bg-muted p-2 rounded text-sm">
                  Subtotal: {formatCurrency(item.cantidad * item.precioUnitario)}
                </div>
              </div>
            ))}
          </div>

          <Separator />

          {/* Totals */}
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span>Neto Gravado:</span>
              <span>{formatCurrency(totals.netoGravado)}</span>
            </div>
            {totals.iva21 > 0 && (
              <div className="flex justify-between text-sm">
                <span>IVA 21%:</span>
                <span>{formatCurrency(totals.iva21)}</span>
              </div>
            )}
            {totals.iva105 > 0 && (
              <div className="flex justify-between text-sm">
                <span>IVA 10.5%:</span>
                <span>{formatCurrency(totals.iva105)}</span>
              </div>
            )}
            {totals.iva27 > 0 && (
              <div className="flex justify-between text-sm">
                <span>IVA 27%:</span>
                <span>{formatCurrency(totals.iva27)}</span>
              </div>
            )}
            {totals.exento > 0 && (
              <div className="flex justify-between text-sm">
                <span>Exento:</span>
                <span>{formatCurrency(totals.exento)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>Total:</span>
              <span className={formData.tipo === 'NOTA_CREDITO' ? 'text-success' : 'text-destructive'}>
                {formatCurrency(totals.total)}
              </span>
            </div>
          </div>

          {/* Stock Impact */}
          {formData.tipo === 'NOTA_CREDITO' && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="afectaStock"
                checked={formData.afectaStock}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, afectaStock: checked as boolean })
                }
              />
              <Label htmlFor="afectaStock" className="cursor-pointer">
                Afecta stock (devuelve productos al inventario)
              </Label>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              'Crear Nota'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
