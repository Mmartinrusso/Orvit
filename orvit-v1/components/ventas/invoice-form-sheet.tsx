'use client';

import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  Save,
  Loader2,
  Receipt,
  User,
  Calendar,
  DollarSign,
  AlertTriangle,
  Package,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useApiClient } from '@/hooks/use-api-client';
import { ErrorMessage } from '@/components/ui/ErrorMessage';

interface InvoiceFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvoiceCreated?: (invoiceId: number) => void;
  saleId?: number;
}

interface SaleOrder {
  id: number;
  numero: string;
  total: number;
  subtotal: number;
  iva: number;
  moneda: string;
  client: {
    id: number;
    legalName?: string;
    name?: string;
    cuit?: string;
  };
  items: Array<{
    id: number;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
  }>;
}

export function InvoiceFormSheet({
  open,
  onOpenChange,
  onInvoiceCreated,
  saleId,
}: InvoiceFormSheetProps) {
  const { get, post, error: apiError, clearError } = useApiClient({ silent: true });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saleOrder, setSaleOrder] = useState<SaleOrder | null>(null);

  const [formData, setFormData] = useState({
    tipoFactura: 'B',
    fechaEmision: format(new Date(), 'yyyy-MM-dd'),
    fechaVencimiento: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    observaciones: '',
  });

  useEffect(() => {
    if (open && saleId) {
      fetchSaleOrder();
    }
  }, [open, saleId]);

  const fetchSaleOrder = async () => {
    if (!saleId) return;

    setLoading(true);
    clearError();
    const { data, error } = await get(`/api/ventas/ordenes/${saleId}`);
    if (data) setSaleOrder(data);
    if (error) toast.error('Error al cargar la orden de venta');
    setLoading(false);
  };

  const handleSave = async () => {
    if (!saleOrder) {
      toast.error('Debe seleccionar una orden de venta');
      return;
    }

    setSaving(true);

    const invoiceData = {
      saleId: saleOrder.id,
      clientId: saleOrder.client.id,
      tipoFactura: formData.tipoFactura,
      fechaEmision: new Date(formData.fechaEmision).toISOString(),
      fechaVencimiento: new Date(formData.fechaVencimiento).toISOString(),
      subtotal: saleOrder.subtotal,
      iva: saleOrder.iva,
      total: saleOrder.total,
      saldoPendiente: saleOrder.total,
      moneda: saleOrder.moneda,
      observaciones: formData.observaciones || null,
      items: saleOrder.items.map((item) => ({
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        subtotal: item.subtotal,
        iva: (item.subtotal * 0.21), // Assuming 21% IVA
      })),
    };

    const { data: result, error } = await post('/api/ventas/facturas', invoiceData);

    if (error) {
      setSaving(false);
      return;
    }

    toast.success(`Factura ${result.numero} creada exitosamente`);
    onInvoiceCreated?.(result.id);
    setSaving(false);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const formatCurrency = (amount: number, currency: string = 'ARS'): string => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent size="xl" className="overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <SheetTitle className="text-2xl">Nueva Factura</SheetTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {saleId ? `Desde Orden de Venta ${saleOrder?.numero || '...'}` : 'Creación manual'}
              </p>
            </div>
          </div>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : !saleOrder && saleId ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center space-y-3">
              {apiError ? (
                <ErrorMessage error={apiError} onRetry={fetchSaleOrder} />
              ) : (
                <>
                  <AlertTriangle className="w-12 h-12 mx-auto mb-2 text-destructive" />
                  <p className="text-muted-foreground">No se pudo cargar la orden de venta</p>
                </>
              )}
            </div>
          </div>
        ) : saleId && !saleOrder ? null : (
          <div className="space-y-6 mt-6">
            {/* Client Info */}
            {saleOrder && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <User className="w-4 h-4" />
                    Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Razón Social</p>
                      <p className="font-medium">
                        {saleOrder.client.legalName || saleOrder.client.name}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">CUIT</p>
                      <p className="font-medium">{saleOrder.client.cuit || 'No especificado'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Invoice Details Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Receipt className="w-4 h-4" />
                  Datos de la Factura
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="tipoFactura">Tipo de Factura</Label>
                    <Select
                      value={formData.tipoFactura}
                      onValueChange={(value) =>
                        setFormData({ ...formData, tipoFactura: value })
                      }
                    >
                      <SelectTrigger id="tipoFactura">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">Tipo A</SelectItem>
                        <SelectItem value="B">Tipo B</SelectItem>
                        <SelectItem value="C">Tipo C</SelectItem>
                        <SelectItem value="E">Tipo E (Exportación)</SelectItem>
                        <SelectItem value="M">Tipo M</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="fechaEmision">Fecha de Emisión</Label>
                    <Input
                      id="fechaEmision"
                      type="date"
                      value={formData.fechaEmision}
                      onChange={(e) =>
                        setFormData({ ...formData, fechaEmision: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor="fechaVencimiento">Fecha de Vencimiento</Label>
                    <Input
                      id="fechaVencimiento"
                      type="date"
                      value={formData.fechaVencimiento}
                      onChange={(e) =>
                        setFormData({ ...formData, fechaVencimiento: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="observaciones">Observaciones</Label>
                  <Textarea
                    id="observaciones"
                    value={formData.observaciones}
                    onChange={(e) =>
                      setFormData({ ...formData, observaciones: e.target.value })
                    }
                    placeholder="Observaciones adicionales..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Items */}
            {saleOrder && saleOrder.items && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Package className="w-4 h-4" />
                    Items ({saleOrder.items.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead className="text-right">P. Unitario</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {saleOrder.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.descripcion}</TableCell>
                          <TableCell className="text-right">{item.cantidad}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.precioUnitario, saleOrder.moneda)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(item.subtotal, saleOrder.moneda)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Totals */}
            {saleOrder && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <DollarSign className="w-4 h-4" />
                    Totales
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">
                      {formatCurrency(saleOrder.subtotal, saleOrder.moneda)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">IVA</span>
                    <span className="font-medium">
                      {formatCurrency(saleOrder.iva, saleOrder.moneda)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold">
                      {formatCurrency(saleOrder.total, saleOrder.moneda)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleClose} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving || !saleOrder}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Crear Factura
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
