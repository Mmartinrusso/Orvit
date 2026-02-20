'use client';

/**
 * Payment Form Component
 *
 * Comprehensive form for registering client payments with:
 * - Client selection with search
 * - Multiple payment methods (cash, transfer, checks, cards)
 * - Account destination selection
 * - Application to pending invoices
 * - Retentions (IVA, Ganancias, Ingresos Brutos)
 */

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Banknote,
  CreditCard,
  DollarSign,
  FileText,
  Loader2,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { useApiClient } from '@/hooks/use-api-client';

interface Client {
  id: string;
  legalName?: string;
  name?: string;
  currentBalance?: number;
}

interface Invoice {
  id: number;
  numero: string;
  total: number;
  saldoPendiente: number;
  fechaEmision: string;
  fechaVencimiento: string;
}

interface CashAccount {
  id: number;
  nombre: string;
  isActive: boolean;
}

interface BankAccount {
  id: number;
  nombre: string;
  banco: string;
  numeroCuenta: string;
  isActive: boolean;
}

interface Cheque {
  numero: string;
  banco: string;
  titular: string;
  cuit: string;
  fechaEmision: string;
  fechaVencimiento: string;
  importe: number;
  tipo: 'TERCERO' | 'PROPIO';
}

interface InvoiceAllocation {
  invoiceId: number;
  monto: number;
}

interface PaymentFormProps {
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  submitting?: boolean;
}

export function PaymentForm({ onSubmit, onCancel, submitting = false }: PaymentFormProps) {
  const { get } = useApiClient({ silent: true });

  // Form state
  const [clientId, setClientId] = useState('');
  const [client, setClient] = useState<Client | null>(null);
  const [fechaPago, setFechaPago] = useState(
    new Date().toISOString().slice(0, 16)
  );

  // Payment methods
  const [efectivo, setEfectivo] = useState(0);
  const [transferencia, setTransferencia] = useState(0);
  const [chequesTerceros, setChequesTerceros] = useState(0);
  const [chequesPropios, setChequesPropios] = useState(0);
  const [tarjetaCredito, setTarjetaCredito] = useState(0);
  const [tarjetaDebito, setTarjetaDebito] = useState(0);
  const [otrosMedios, setOtrosMedios] = useState(0);

  // Retentions
  const [retIVA, setRetIVA] = useState(0);
  const [retGanancias, setRetGanancias] = useState(0);
  const [retIngBrutos, setRetIngBrutos] = useState(0);

  // Transfer details
  const [bancoOrigen, setBancoOrigen] = useState('');
  const [numeroOperacion, setNumeroOperacion] = useState('');

  // Cheques
  const [cheques, setCheques] = useState<Cheque[]>([]);

  // Notes
  const [notas, setNotas] = useState('');

  // Invoice allocations
  const [aplicaciones, setAplicaciones] = useState<InvoiceAllocation[]>([]);

  // Data from API
  const [clients, setClients] = useState<Client[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<Invoice[]>([]);
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  // Loading states
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  // UI state
  const [efectivoOpen, setEfectivoOpen] = useState(false);
  const [transferenciaOpen, setTransferenciaOpen] = useState(false);
  const [chequesOpen, setChequesOpen] = useState(false);
  const [tarjetasOpen, setTarjetasOpen] = useState(false);
  const [otrosOpen, setOtrosOpen] = useState(false);

  // Load accounts on mount
  useEffect(() => {
    loadAccounts();
  }, []);

  // Load pending invoices when client changes
  useEffect(() => {
    if (clientId) {
      loadPendingInvoices();
    } else {
      setPendingInvoices([]);
      setAplicaciones([]);
    }
  }, [clientId]);

  const loadAccounts = async () => {
    setLoadingAccounts(true);
    const [cashRes, bankRes] = await Promise.all([
      get('/api/tesoreria/cajas'),
      get('/api/tesoreria/bancos'),
    ]);
    if (cashRes.data) setCashAccounts(cashRes.data.data || []);
    if (bankRes.data) setBankAccounts(bankRes.data.data || []);
    setLoadingAccounts(false);
  };

  const loadClients = async (search: string) => {
    if (search.length < 2) {
      setClients([]);
      return;
    }

    setLoadingClients(true);
    const { data } = await get(`/api/ventas/clientes?search=${encodeURIComponent(search)}&limit=20`);
    if (data) setClients(data.data || []);
    setLoadingClients(false);
  };

  const loadPendingInvoices = async () => {
    setLoadingInvoices(true);
    const { data } = await get(
      `/api/ventas/facturas?clienteId=${clientId}&estado=EMITIDA,PARCIALMENTE_COBRADA&limit=100`
    );
    if (data) {
      const invoices = (data.data || []).filter((inv: any) =>
        parseFloat(inv.saldoPendiente) > 0
      );
      setPendingInvoices(invoices);
    }
    setLoadingInvoices(false);
  };

  const handleClientSelect = async (clientId: string) => {
    setClientId(clientId);
    const selected = clients.find((c) => c.id === clientId);
    setClient(selected || null);
  };

  const addCheque = () => {
    setCheques([
      ...cheques,
      {
        numero: '',
        banco: '',
        titular: '',
        cuit: '',
        fechaEmision: new Date().toISOString().slice(0, 10),
        fechaVencimiento: '',
        importe: 0,
        tipo: 'TERCERO',
      },
    ]);
    setChequesOpen(true);
  };

  const removeCheque = (index: number) => {
    setCheques(cheques.filter((_, i) => i !== index));
  };

  const updateCheque = (index: number, field: keyof Cheque, value: any) => {
    const updated = [...cheques];
    updated[index] = { ...updated[index], [field]: value };
    setCheques(updated);
  };

  const toggleInvoiceAllocation = (invoiceId: number, checked: boolean) => {
    if (checked) {
      const invoice = pendingInvoices.find((inv) => inv.id === invoiceId);
      if (invoice) {
        setAplicaciones([
          ...aplicaciones,
          { invoiceId, monto: parseFloat(invoice.saldoPendiente.toString()) },
        ]);
      }
    } else {
      setAplicaciones(aplicaciones.filter((app) => app.invoiceId !== invoiceId));
    }
  };

  const updateAllocationAmount = (invoiceId: number, monto: number) => {
    setAplicaciones(
      aplicaciones.map((app) =>
        app.invoiceId === invoiceId ? { ...app, monto } : app
      )
    );
  };

  // Calculations
  const totalPago = useMemo(() => {
    return (
      efectivo +
      transferencia +
      chequesTerceros +
      chequesPropios +
      tarjetaCredito +
      tarjetaDebito +
      otrosMedios
    );
  }, [efectivo, transferencia, chequesTerceros, chequesPropios, tarjetaCredito, tarjetaDebito, otrosMedios]);

  const totalAplicado = useMemo(() => {
    return aplicaciones.reduce((sum, app) => sum + app.monto, 0);
  }, [aplicaciones]);

  const saldoLibre = useMemo(() => {
    return totalPago - totalAplicado;
  }, [totalPago, totalAplicado]);

  const totalChequesIngresados = useMemo(() => {
    return cheques.reduce((sum, ch) => sum + ch.importe, 0);
  }, [cheques]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validations
    if (!clientId) {
      toast.error('Debe seleccionar un cliente');
      return;
    }

    if (totalPago <= 0) {
      toast.error('El monto total debe ser mayor a 0');
      return;
    }

    // Validate cheques
    if ((chequesTerceros > 0 || chequesPropios > 0) && cheques.length === 0) {
      toast.error('Debe agregar los detalles de los cheques');
      return;
    }

    if (cheques.length > 0) {
      const totalChequesEsperado = chequesTerceros + chequesPropios;
      if (Math.abs(totalChequesIngresados - totalChequesEsperado) > 0.01) {
        toast.error(
          `La suma de los cheques (${formatCurrency(totalChequesIngresados)}) no coincide con el monto ingresado (${formatCurrency(totalChequesEsperado)})`
        );
        return;
      }

      // Validate cheque fields
      for (const cheque of cheques) {
        if (!cheque.numero || !cheque.banco || cheque.importe <= 0) {
          toast.error('Todos los cheques deben tener número, banco e importe');
          return;
        }
      }
    }

    // Validate allocations
    for (const app of aplicaciones) {
      const invoice = pendingInvoices.find((inv) => inv.id === app.invoiceId);
      if (invoice && app.monto > parseFloat(invoice.saldoPendiente.toString())) {
        toast.error(
          `El monto aplicado a la factura ${invoice.numero} excede el saldo pendiente`
        );
        return;
      }
    }

    // Build payload
    const payload = {
      clientId,
      fechaPago,
      efectivo,
      transferencia,
      chequesTerceros,
      chequesPropios,
      tarjetaCredito,
      tarjetaDebito,
      otrosMedios,
      retIVA,
      retGanancias,
      retIngBrutos,
      bancoOrigen: bancoOrigen || undefined,
      numeroOperacion: numeroOperacion || undefined,
      notas: notas || undefined,
      aplicaciones,
      cheques: cheques.map((ch) => ({
        ...ch,
        fechaEmision: ch.fechaEmision || undefined,
        fechaVencimiento: ch.fechaVencimiento || undefined,
      })),
    };

    await onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Client Selection */}
      <div className="space-y-2">
        <Label>Cliente *</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Buscar cliente por nombre..."
            onChange={(e) => loadClients(e.target.value)}
            disabled={submitting}
          />
          {loadingClients && <Loader2 className="w-4 h-4 animate-spin" />}
        </div>
        {clients.length > 0 && (
          <div className="border rounded-md max-h-48 overflow-y-auto">
            {clients.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleClientSelect(c.id)}
                className={cn('w-full text-left px-3 py-2 hover:bg-accent', clientId === c.id && 'bg-primary/10')}
              >
                {c.legalName || c.name}
                {c.currentBalance !== undefined && (
                  <span className="ml-2 text-sm text-muted-foreground">
                    - Deuda: {formatCurrency(parseFloat(c.currentBalance.toString()))}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
        {client && (
          <div className="text-sm text-foreground">
            Seleccionado: <strong>{client.legalName || client.name}</strong>
          </div>
        )}
      </div>

      {/* Payment Date */}
      <div className="space-y-2">
        <Label htmlFor="fechaPago">Fecha de Pago *</Label>
        <Input
          id="fechaPago"
          type="datetime-local"
          value={fechaPago}
          onChange={(e) => setFechaPago(e.target.value)}
          disabled={submitting}
          required
        />
      </div>

      <Separator />

      {/* Payment Methods */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Medios de Pago</h3>

        {/* Efectivo */}
        <Collapsible open={efectivoOpen} onOpenChange={setEfectivoOpen}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4" />
                  <CardTitle className="text-base">Efectivo</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {efectivo > 0 && (
                    <span className="text-sm font-normal">{formatCurrency(efectivo)}</span>
                  )}
                  {efectivoOpen ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="efectivo">Monto</Label>
                  <Input
                    id="efectivo"
                    type="number"
                    step="0.01"
                    min="0"
                    value={efectivo || ''}
                    onChange={(e) => setEfectivo(parseFloat(e.target.value) || 0)}
                    disabled={submitting}
                  />
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Transferencia */}
        <Collapsible open={transferenciaOpen} onOpenChange={setTransferenciaOpen}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  <CardTitle className="text-base">Transferencia</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {transferencia > 0 && (
                    <span className="text-sm font-normal">{formatCurrency(transferencia)}</span>
                  )}
                  {transferenciaOpen ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="transferencia">Monto</Label>
                  <Input
                    id="transferencia"
                    type="number"
                    step="0.01"
                    min="0"
                    value={transferencia || ''}
                    onChange={(e) => setTransferencia(parseFloat(e.target.value) || 0)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bancoOrigen">Banco Origen</Label>
                  <Input
                    id="bancoOrigen"
                    value={bancoOrigen}
                    onChange={(e) => setBancoOrigen(e.target.value)}
                    disabled={submitting}
                    placeholder="Ej: Banco Santander"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numeroOperacion">Número de Operación</Label>
                  <Input
                    id="numeroOperacion"
                    value={numeroOperacion}
                    onChange={(e) => setNumeroOperacion(e.target.value)}
                    disabled={submitting}
                    placeholder="Número de comprobante"
                  />
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Cheques */}
        <Collapsible open={chequesOpen} onOpenChange={setChequesOpen}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <CardTitle className="text-base">Cheques</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {(chequesTerceros + chequesPropios) > 0 && (
                    <span className="text-sm font-normal">
                      {formatCurrency(chequesTerceros + chequesPropios)}
                    </span>
                  )}
                  {chequesOpen ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="chequesTerceros">Cheques de Terceros</Label>
                    <Input
                      id="chequesTerceros"
                      type="number"
                      step="0.01"
                      min="0"
                      value={chequesTerceros || ''}
                      onChange={(e) => setChequesTerceros(parseFloat(e.target.value) || 0)}
                      disabled={submitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="chequesPropios">Cheques Propios</Label>
                    <Input
                      id="chequesPropios"
                      type="number"
                      step="0.01"
                      min="0"
                      value={chequesPropios || ''}
                      onChange={(e) => setChequesPropios(parseFloat(e.target.value) || 0)}
                      disabled={submitting}
                    />
                  </div>
                </div>

                {(chequesTerceros > 0 || chequesPropios > 0) && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Detalle de Cheques</Label>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={addCheque}
                          disabled={submitting}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Agregar
                        </Button>
                      </div>

                      {cheques.map((cheque, index) => (
                        <Card key={index} className="p-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label>Cheque {index + 1}</Label>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => removeCheque(index)}
                                disabled={submitting}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label>Tipo</Label>
                                <Select
                                  value={cheque.tipo}
                                  onValueChange={(value) =>
                                    updateCheque(index, 'tipo', value as 'TERCERO' | 'PROPIO')
                                  }
                                  disabled={submitting}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="TERCERO">Tercero</SelectItem>
                                    <SelectItem value="PROPIO">Propio</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <Label>Número *</Label>
                                <Input
                                  value={cheque.numero}
                                  onChange={(e) => updateCheque(index, 'numero', e.target.value)}
                                  disabled={submitting}
                                  required
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Banco *</Label>
                                <Input
                                  value={cheque.banco}
                                  onChange={(e) => updateCheque(index, 'banco', e.target.value)}
                                  disabled={submitting}
                                  required
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Importe *</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={cheque.importe || ''}
                                  onChange={(e) =>
                                    updateCheque(index, 'importe', parseFloat(e.target.value) || 0)
                                  }
                                  disabled={submitting}
                                  required
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Titular</Label>
                                <Input
                                  value={cheque.titular}
                                  onChange={(e) => updateCheque(index, 'titular', e.target.value)}
                                  disabled={submitting}
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>CUIT</Label>
                                <Input
                                  value={cheque.cuit}
                                  onChange={(e) => updateCheque(index, 'cuit', e.target.value)}
                                  disabled={submitting}
                                  placeholder="XX-XXXXXXXX-X"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Fecha Emisión</Label>
                                <Input
                                  type="date"
                                  value={cheque.fechaEmision}
                                  onChange={(e) =>
                                    updateCheque(index, 'fechaEmision', e.target.value)
                                  }
                                  disabled={submitting}
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Fecha Vencimiento</Label>
                                <Input
                                  type="date"
                                  value={cheque.fechaVencimiento}
                                  onChange={(e) =>
                                    updateCheque(index, 'fechaVencimiento', e.target.value)
                                  }
                                  disabled={submitting}
                                />
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}

                      {cheques.length > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span>Total cheques ingresados:</span>
                          <span className="font-semibold">
                            {formatCurrency(totalChequesIngresados)}
                          </span>
                        </div>
                      )}

                      {cheques.length > 0 &&
                        Math.abs(totalChequesIngresados - (chequesTerceros + chequesPropios)) >
                          0.01 && (
                          <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 p-2 rounded">
                            <AlertCircle className="w-4 h-4" />
                            <span>
                              La suma de los cheques no coincide con el monto total
                            </span>
                          </div>
                        )}
                    </div>
                  </>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Tarjetas */}
        <Collapsible open={tarjetasOpen} onOpenChange={setTarjetasOpen}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  <CardTitle className="text-base">Tarjetas</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {(tarjetaCredito + tarjetaDebito) > 0 && (
                    <span className="text-sm font-normal">
                      {formatCurrency(tarjetaCredito + tarjetaDebito)}
                    </span>
                  )}
                  {tarjetasOpen ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tarjetaCredito">Tarjeta de Crédito</Label>
                    <Input
                      id="tarjetaCredito"
                      type="number"
                      step="0.01"
                      min="0"
                      value={tarjetaCredito || ''}
                      onChange={(e) => setTarjetaCredito(parseFloat(e.target.value) || 0)}
                      disabled={submitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tarjetaDebito">Tarjeta de Débito</Label>
                    <Input
                      id="tarjetaDebito"
                      type="number"
                      step="0.01"
                      min="0"
                      value={tarjetaDebito || ''}
                      onChange={(e) => setTarjetaDebito(parseFloat(e.target.value) || 0)}
                      disabled={submitting}
                    />
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Otros Medios */}
        <Collapsible open={otrosOpen} onOpenChange={setOtrosOpen}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  <CardTitle className="text-base">Otros Medios</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {otrosMedios > 0 && (
                    <span className="text-sm font-normal">{formatCurrency(otrosMedios)}</span>
                  )}
                  {otrosOpen ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="otrosMedios">Monto</Label>
                  <Input
                    id="otrosMedios"
                    type="number"
                    step="0.01"
                    min="0"
                    value={otrosMedios || ''}
                    onChange={(e) => setOtrosMedios(parseFloat(e.target.value) || 0)}
                    disabled={submitting}
                  />
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Total */}
        <Card className="bg-info-muted border-info">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-lg font-semibold">
              <span>Total Cobro:</span>
              <span className="text-info-muted-foreground">{formatCurrency(totalPago)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Retentions */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Retenciones</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="retIVA">Retención IVA</Label>
            <Input
              id="retIVA"
              type="number"
              step="0.01"
              min="0"
              value={retIVA || ''}
              onChange={(e) => setRetIVA(parseFloat(e.target.value) || 0)}
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="retGanancias">Retención Ganancias</Label>
            <Input
              id="retGanancias"
              type="number"
              step="0.01"
              min="0"
              value={retGanancias || ''}
              onChange={(e) => setRetGanancias(parseFloat(e.target.value) || 0)}
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="retIngBrutos">Retención Ing. Brutos</Label>
            <Input
              id="retIngBrutos"
              type="number"
              step="0.01"
              min="0"
              value={retIngBrutos || ''}
              onChange={(e) => setRetIngBrutos(parseFloat(e.target.value) || 0)}
              disabled={submitting}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Invoice Allocations */}
      {clientId && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Aplicar a Facturas</h3>

          {loadingInvoices ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cargando facturas pendientes...
            </div>
          ) : pendingInvoices.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No hay facturas pendientes para este cliente
            </div>
          ) : (
            <>
              <div className="border rounded-md">
                <div className="max-h-64 overflow-y-auto">
                  {pendingInvoices.map((invoice) => {
                    const allocation = aplicaciones.find((app) => app.invoiceId === invoice.id);
                    const isChecked = !!allocation;
                    const saldoPendiente = parseFloat(invoice.saldoPendiente.toString());

                    return (
                      <div
                        key={invoice.id}
                        className="flex items-center gap-4 p-3 border-b last:border-b-0"
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(checked) =>
                            toggleInvoiceAllocation(invoice.id, !!checked)
                          }
                          disabled={submitting}
                        />
                        <div className="flex-1">
                          <div className="font-medium">{invoice.numero}</div>
                          <div className="text-sm text-muted-foreground">
                            Saldo: {formatCurrency(saldoPendiente)}
                          </div>
                        </div>
                        {isChecked && (
                          <div className="w-32">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max={saldoPendiente}
                              value={allocation.monto || ''}
                              onChange={(e) =>
                                updateAllocationAmount(
                                  invoice.id,
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              disabled={submitting}
                              placeholder="Monto"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Total Aplicado:</span>
                  <span className="font-semibold">{formatCurrency(totalAplicado)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Saldo Libre:</span>
                  <span
                    className={cn('font-semibold', saldoLibre < 0 ? 'text-destructive' : 'text-success')}
                  >
                    {formatCurrency(saldoLibre)}
                  </span>
                </div>
              </div>

              {saldoLibre < 0 && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded">
                  <AlertCircle className="w-4 h-4" />
                  <span>El monto aplicado excede el total del pago</span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <Separator />

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notas">Notas</Label>
        <Textarea
          id="notas"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          disabled={submitting}
          rows={3}
          placeholder="Observaciones adicionales..."
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-4 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting || totalPago <= 0 || !clientId}>
          {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Registrar Cobro
        </Button>
      </div>
    </form>
  );
}
