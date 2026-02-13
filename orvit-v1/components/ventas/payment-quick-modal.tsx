'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  CreditCard,
  Banknote,
  Building2,
  FileText,
  Calendar,
  Save,
  Loader2,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

// =====================================================
// TYPES
// =====================================================

type PaymentMethod = 'EFECTIVO' | 'TRANSFERENCIA' | 'CHEQUE' | 'TARJETA' | 'OTRO';

interface Invoice {
  id: number;
  numero: string;
  fecha: string;
  fechaVencimiento?: string;
  total: number;
  saldoPendiente: number;
  diasVencido?: number;
}

interface PaymentFormData {
  clientId: number;
  monto: number;
  metodoPago: PaymentMethod;
  fecha: string;
  referencia: string;
  notas: string;
  facturasAAplicar: Array<{
    facturaId: number;
    monto: number;
  }>;
  // For check payments
  chequeNumero?: string;
  chequeBanco?: string;
  chequeFecha?: string;
  // For transfer payments
  transferenciaCBU?: string;
  transferenciaTitular?: string;
}

interface PaymentQuickModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: number;
  clientName?: string;
  invoices?: Invoice[];
  onSuccess?: () => void;
}

// =====================================================
// CONSTANTS
// =====================================================

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ElementType }[] = [
  { value: 'EFECTIVO', label: 'Efectivo', icon: Banknote },
  { value: 'TRANSFERENCIA', label: 'Transferencia', icon: Building2 },
  { value: 'CHEQUE', label: 'Cheque', icon: FileText },
  { value: 'TARJETA', label: 'Tarjeta', icon: CreditCard },
  { value: 'OTRO', label: 'Otro', icon: DollarSign },
];

// =====================================================
// COMPONENT
// =====================================================

export function PaymentQuickModal({
  open,
  onOpenChange,
  clientId,
  clientName,
  invoices = [],
  onSuccess,
}: PaymentQuickModalProps) {
  const [loading, setLoading] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [availableInvoices, setAvailableInvoices] = useState<Invoice[]>(invoices);

  const [formData, setFormData] = useState<PaymentFormData>({
    clientId,
    monto: 0,
    metodoPago: 'EFECTIVO',
    fecha: format(new Date(), 'yyyy-MM-dd'),
    referencia: '',
    notas: '',
    facturasAAplicar: [],
    chequeNumero: '',
    chequeBanco: '',
    chequeFecha: '',
    transferenciaCBU: '',
    transferenciaTitular: '',
  });

  const [invoiceAllocations, setInvoiceAllocations] = useState<Record<number, number>>({});

  // Load invoices if not provided
  useEffect(() => {
    if (open && invoices.length === 0 && clientId) {
      loadClientInvoices();
    } else {
      setAvailableInvoices(invoices);
    }
  }, [open, clientId, invoices]);

  // Reset form when opening
  useEffect(() => {
    if (open) {
      setFormData({
        clientId,
        monto: 0,
        metodoPago: 'EFECTIVO',
        fecha: format(new Date(), 'yyyy-MM-dd'),
        referencia: '',
        notas: '',
        facturasAAplicar: [],
        chequeNumero: '',
        chequeBanco: '',
        chequeFecha: '',
        transferenciaCBU: '',
        transferenciaTitular: '',
      });
      setInvoiceAllocations({});
    }
  }, [open, clientId]);

  const loadClientInvoices = async () => {
    setLoadingInvoices(true);
    try {
      const response = await fetch(
        `/api/ventas/facturas?clientId=${clientId}&estado=EMITIDA&pendientes=true`
      );
      if (response.ok) {
        const data = await response.json();
        setAvailableInvoices(data.data || data || []);
      }
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (formData.monto <= 0) {
      toast.error('El monto debe ser mayor a 0');
      return;
    }

    if (formData.metodoPago === 'CHEQUE' && !formData.chequeNumero) {
      toast.error('El número de cheque es requerido');
      return;
    }

    // Build invoice allocations
    const allocations = Object.entries(invoiceAllocations)
      .filter(([_, monto]) => monto > 0)
      .map(([facturaId, monto]) => ({
        facturaId: parseInt(facturaId),
        monto,
      }));

    setLoading(true);
    try {
      const body = {
        clientId: formData.clientId,
        monto: formData.monto,
        metodoPago: formData.metodoPago,
        fecha: new Date(formData.fecha).toISOString(),
        referencia: formData.referencia || null,
        notas: formData.notas || null,
        facturasAAplicar: allocations,
        ...(formData.metodoPago === 'CHEQUE' && {
          chequeNumero: formData.chequeNumero,
          chequeBanco: formData.chequeBanco,
          chequeFecha: formData.chequeFecha
            ? new Date(formData.chequeFecha).toISOString()
            : null,
        }),
        ...(formData.metodoPago === 'TRANSFERENCIA' && {
          transferenciaCBU: formData.transferenciaCBU,
          transferenciaTitular: formData.transferenciaTitular,
        }),
      };

      const response = await fetch('/api/ventas/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        toast.success('Pago registrado exitosamente');
        onOpenChange(false);
        onSuccess?.();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al registrar pago');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al registrar pago');
    } finally {
      setLoading(false);
    }
  };

  const handleAllocationChange = (invoiceId: number, amount: number, maxAmount: number) => {
    const validAmount = Math.max(0, Math.min(amount, maxAmount));
    setInvoiceAllocations((prev) => ({
      ...prev,
      [invoiceId]: validAmount,
    }));
  };

  const handleAutoAllocate = () => {
    let remaining = formData.monto;
    const newAllocations: Record<number, number> = {};

    // Sort by due date (oldest first)
    const sortedInvoices = [...availableInvoices].sort((a, b) => {
      const dateA = a.fechaVencimiento ? new Date(a.fechaVencimiento).getTime() : 0;
      const dateB = b.fechaVencimiento ? new Date(b.fechaVencimiento).getTime() : 0;
      return dateA - dateB;
    });

    for (const invoice of sortedInvoices) {
      if (remaining <= 0) break;
      const toAllocate = Math.min(remaining, invoice.saldoPendiente);
      if (toAllocate > 0) {
        newAllocations[invoice.id] = toAllocate;
        remaining -= toAllocate;
      }
    }

    setInvoiceAllocations(newAllocations);
  };

  const totalAllocated = Object.values(invoiceAllocations).reduce((sum, v) => sum + v, 0);
  const unallocated = formData.monto - totalAllocated;

  const selectedMethod = PAYMENT_METHODS.find((m) => m.value === formData.metodoPago);
  const MethodIcon = selectedMethod?.icon || DollarSign;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Registrar Pago
          </DialogTitle>
          <DialogDescription>
            {clientName && (
              <span>
                Cliente: <strong>{clientName}</strong>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Monto y Fecha */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Monto *
              </Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={formData.monto || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    monto: parseFloat(e.target.value) || 0,
                  }))
                }
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Fecha *
              </Label>
              <Input
                type="date"
                value={formData.fecha}
                onChange={(e) => setFormData((prev) => ({ ...prev, fecha: e.target.value }))}
              />
            </div>
          </div>

          {/* Método de Pago */}
          <div className="space-y-2">
            <Label>Método de Pago</Label>
            <Select
              value={formData.metodoPago}
              onValueChange={(v: PaymentMethod) =>
                setFormData((prev) => ({ ...prev, metodoPago: v }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    <div className="flex items-center gap-2">
                      <method.icon className="w-4 h-4" />
                      {method.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Campos específicos por método */}
          {formData.metodoPago === 'CHEQUE' && (
            <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
              <div className="space-y-2">
                <Label>Número de Cheque *</Label>
                <Input
                  value={formData.chequeNumero}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, chequeNumero: e.target.value }))
                  }
                  placeholder="Nº de cheque"
                />
              </div>
              <div className="space-y-2">
                <Label>Banco</Label>
                <Input
                  value={formData.chequeBanco}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, chequeBanco: e.target.value }))
                  }
                  placeholder="Nombre del banco"
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha del Cheque</Label>
                <Input
                  type="date"
                  value={formData.chequeFecha}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, chequeFecha: e.target.value }))
                  }
                />
              </div>
            </div>
          )}

          {formData.metodoPago === 'TRANSFERENCIA' && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
              <div className="space-y-2">
                <Label>CBU/CVU</Label>
                <Input
                  value={formData.transferenciaCBU}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, transferenciaCBU: e.target.value }))
                  }
                  placeholder="CBU de origen"
                />
              </div>
              <div className="space-y-2">
                <Label>Titular</Label>
                <Input
                  value={formData.transferenciaTitular}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, transferenciaTitular: e.target.value }))
                  }
                  placeholder="Nombre del titular"
                />
              </div>
            </div>
          )}

          {/* Referencia */}
          <div className="space-y-2">
            <Label>Referencia / Comprobante</Label>
            <Input
              value={formData.referencia}
              onChange={(e) => setFormData((prev) => ({ ...prev, referencia: e.target.value }))}
              placeholder="Número de comprobante, referencia bancaria, etc."
            />
          </div>

          {/* Imputación a Facturas */}
          {availableInvoices.length > 0 && formData.monto > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Imputar a Facturas</Label>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={unallocated === 0 ? 'default' : 'secondary'}
                    className={unallocated < 0 ? 'bg-red-100 text-red-700' : ''}
                  >
                    {unallocated === 0
                      ? 'Totalmente imputado'
                      : unallocated > 0
                      ? `Sin imputar: $${unallocated.toLocaleString()}`
                      : `Excede: $${Math.abs(unallocated).toLocaleString()}`}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={handleAutoAllocate}>
                    Auto-imputar
                  </Button>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Factura</TableHead>
                      <TableHead>Vencimiento</TableHead>
                      <TableHead className="text-right">Pendiente</TableHead>
                      <TableHead className="text-right w-32">Imputar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {availableInvoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell>
                          <div className="font-medium">{invoice.numero}</div>
                        </TableCell>
                        <TableCell>
                          {invoice.fechaVencimiento && (
                            <div className="flex items-center gap-2">
                              <span>
                                {format(new Date(invoice.fechaVencimiento), 'dd/MM/yyyy')}
                              </span>
                              {invoice.diasVencido && invoice.diasVencido > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  {invoice.diasVencido}d
                                </Badge>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${invoice.saldoPendiente?.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={invoice.saldoPendiente}
                            step={0.01}
                            value={invoiceAllocations[invoice.id] || ''}
                            onChange={(e) =>
                              handleAllocationChange(
                                invoice.id,
                                parseFloat(e.target.value) || 0,
                                invoice.saldoPendiente
                              )
                            }
                            className="w-28 text-right"
                            placeholder="0.00"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {unallocated > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-yellow-50 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                  <span>
                    El monto no imputado quedará como saldo a favor del cliente.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Notas */}
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              value={formData.notas}
              onChange={(e) => setFormData((prev) => ({ ...prev, notas: e.target.value }))}
              placeholder="Observaciones adicionales..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || formData.monto <= 0}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Registrando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Registrar Pago
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
