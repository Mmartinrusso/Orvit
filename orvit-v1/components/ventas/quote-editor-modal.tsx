'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { QuoteItemTable } from '@/components/ventas/quote-item-table';
import { QuoteTotals } from '@/components/ventas/quote-totals';
import { QuickProductInput } from '@/components/ventas/quick-product-input';
import { ClientFormDialog } from '@/components/ventas/client-form-dialog';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Check, ChevronsUpDown, Send, FileText, Copy, Eye, Loader2, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Quote, QuoteItem, Client, Product, PAYMENT_METHODS, QUOTE_STATUS_LABELS } from '@/lib/types/sales';

interface QuoteEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote?: Quote;
  isEditing?: boolean;
  onQuoteCreated?: (quote: Quote) => void;
  onQuoteUpdated?: (quote: Quote) => void;
}

export function QuoteEditorModal({ 
  open, 
  onOpenChange, 
  quote, 
  isEditing = false, 
  onQuoteCreated,
  onQuoteUpdated 
}: QuoteEditorModalProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(quote?.client || null);
  const [items, setItems] = useState<QuoteItem[]>(quote?.items || []);
  const [paymentMethod, setPaymentMethod] = useState(quote?.paymentMethod || 'efectivo');
  const [validityDays, setValidityDays] = useState(30);
  const [publicNotes, setPublicNotes] = useState(quote?.notes || '');
  const [privateNotes, setPrivateNotes] = useState('');
  const [status, setStatus] = useState(quote?.status || 'draft');
  const [includeIVA, setIncludeIVA] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [clientsOpen, setClientsOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [showClientForm, setShowClientForm] = useState(false);
  const [totals, setTotals] = useState({
    subtotal: 0,
    tax: 0,
    totalDiscount: 0,
    total: 0
  });

  useEffect(() => {
    if (open) {
      loadInitialData();
    }
  }, [open]);

  useEffect(() => {
    setTotals(calculateQuoteTotals(items, includeIVA));
  }, [items, includeIVA]);

  const calculateQuoteTotals = (items: QuoteItem[], includeIVA: boolean) => {
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const totalDiscount = items.reduce((sum, item) => {
      const discountAmount = item.unitPrice * item.quantity * (item.discount / 100);
      return sum + discountAmount;
    }, 0);
    
    let tax = 0;
    let total = subtotal;
    
    if (includeIVA) {
      tax = subtotal * 0.21;
      total = subtotal + tax;
    } else {
      // Incluye 10.5% no discriminado
      total = subtotal;
    }
    
    return {
      subtotal,
      tax,
      totalDiscount,
      total
    };
  };

  const loadInitialData = async () => {
    try {
      // TODO: Implementar APIs reales
      const mockClients: Client[] = [
        {
          id: '1',
          name: 'Constructora ABC S.A.',
          email: 'contacto@abc.com',
          phone: '+54 11 4123-4567',
          address: 'Av. Corrientes 1234, CABA',
          taxCondition: 'responsable_inscripto',
          cuit: '30-12345678-9',
          paymentTerms: 30,
          creditLimit: 500000,
          discounts: [],
          currentBalance: 0,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: '2',
          name: 'Materiales del Norte S.R.L.',
          email: 'ventas@norte.com',
          phone: '+54 11 4987-6543',
          address: 'Ruta 9 Km 45, San Isidro',
          taxCondition: 'responsable_inscripto',
          cuit: '30-98765432-1',
          paymentTerms: 15,
          creditLimit: 250000,
          discounts: [],
          currentBalance: 0,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      setClients(mockClients);
      setProducts([]);
    } catch (error) {
      toast.error('Error al cargar datos');
    }
  };

  const addProduct = (product: Product) => {
    const existingItem = items.find(item => item.product.id === product.id);
    
    if (existingItem) {
      updateItem(existingItem.id, { quantity: existingItem.quantity + 1 });
    } else {
      const newItem: QuoteItem = {
        id: Math.random().toString(36).substr(2, 9),
        product,
        quantity: 1,
        unitPrice: product.costPrice * 1.25, // 25% margen por defecto
        discount: 0,
        subtotal: product.costPrice * 1.25
      };
      setItems([...items, newItem]);
    }
    setProductsOpen(false);
  };

  const addQuoteItem = (item: QuoteItem) => {
    const existingItem = items.find(existing => existing.product.id === item.product.id);
    
    if (existingItem) {
      // Si ya existe, actualizar cantidad y precio
      updateItem(existingItem.id, { 
        quantity: existingItem.quantity + item.quantity,
        unitPrice: item.unitPrice
      });
    } else {
      setItems([...items, item]);
    }
  };

  const updateItem = (itemId: string, updates: Partial<QuoteItem>) => {
    setItems(items.map(item => {
      if (item.id === itemId) {
        const updatedItem = { ...item, ...updates };
        const discountAmount = updatedItem.unitPrice * updatedItem.quantity * (updatedItem.discount / 100);
        updatedItem.subtotal = (updatedItem.unitPrice * updatedItem.quantity) - discountAmount;
        return updatedItem;
      }
      return item;
    }));
  };

  const removeItem = (itemId: string) => {
    setItems(items.filter(item => item.id !== itemId));
  };

  const sendQuote = async () => {
    if (!selectedClient) {
      toast.error('Selecciona un cliente');
      return;
    }

    if (items.length === 0) {
      toast.error('Agrega al menos un producto');
      return;
    }

    setIsLoading(true);
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + validityDays);
      
      const quoteData: Quote = {
        id: quote?.id || Math.random().toString(36).substr(2, 9),
        number: quote?.number || `COT-2024-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        clientId: selectedClient.id,
        client: selectedClient,
        description: publicNotes,
        items,
        subtotal: totals.subtotal,
        taxes: totals.tax,
        total: totals.total,
        status: 'sent',
        paymentMethod,
        paymentTerms: selectedClient.paymentTerms || 0,
        validUntil: expiresAt.toISOString(),
        notes: publicNotes,
        deliveryTerms: '',
        createdAt: quote?.createdAt || new Date(),
        updatedAt: new Date()
      };

      if (isEditing && onQuoteUpdated) {
        onQuoteUpdated(quoteData);
        toast.success('Cotización actualizada y enviada');
      } else if (onQuoteCreated) {
        onQuoteCreated(quoteData);
        toast.success('Cotización creada y enviada al cliente');
      }

      onOpenChange(false);
    } catch (error) {
      toast.error('Error al enviar cotización');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClientCreated = (newClient: Client) => {
    setClients([...clients, newClient]);
    setSelectedClient(newClient);
  };

  const getStatusBadge = (status: string) => {
    const config = {
      sent: { variant: 'default' as const, icon: Send, color: 'text-primary' },
      pending_closure: { variant: 'secondary' as const, icon: Clock, color: 'text-warning-muted-foreground' },
      payment_confirmed: { variant: 'default' as const, icon: CheckCircle, color: 'text-success' },
      rejected: { variant: 'destructive' as const, icon: XCircle, color: 'text-destructive' },
      expired: { variant: 'secondary' as const, icon: Clock, color: 'text-muted-foreground' }
    };
    
    const statusConfig = config[status as keyof typeof config];
    const Icon = statusConfig?.icon || Send;

    return (
      <Badge variant={statusConfig?.variant || 'default'} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {QUOTE_STATUS_LABELS[status as keyof typeof QUOTE_STATUS_LABELS] || status}
      </Badge>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isEditing ? `Cotizacion ${quote?.number}` : 'Nueva Cotizacion'}
              {quote && getStatusBadge(status)}
            </DialogTitle>
            <DialogDescription>
              {isEditing ? 'Modifica los datos de la cotizacion existente' : 'Crea una nueva cotizacion para un cliente'}
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Información del Cliente</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label>Cliente *</Label>
                      <Popover open={clientsOpen} onOpenChange={setClientsOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={clientsOpen}
                            className="w-full justify-between"
                          >
                            {selectedClient ? selectedClient.name : "Seleccionar cliente..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0">
                          <Command>
                            <CommandInput placeholder="Buscar cliente..." />
                            <CommandList>
                              <CommandEmpty>No se encontraron clientes.</CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  onSelect={() => {
                                    setClientsOpen(false);
                                    setShowClientForm(true);
                                  }}
                                  className="text-primary font-medium border-b"
                                >
                                  <Plus className="mr-2 h-4 w-4" />
                                  Crear nuevo cliente...
                                </CommandItem>
                                {clients.map((client) => (
                                  <CommandItem
                                    key={client.id}
                                    value={client.name}
                                    onSelect={() => {
                                      setSelectedClient(client);
                                      setClientsOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn('mr-2 h-4 w-4', selectedClient?.id === client.id ? 'opacity-100' : 'opacity-0')}
                                    />
                                    <div>
                                      <p className="font-medium">{client.name}</p>
                                      <p className="text-sm text-muted-foreground">{client.email}</p>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {selectedClient && (
                      <div className="text-sm text-muted-foreground">
                        <p>Email: {selectedClient.email}</p>
                        <p>Teléfono: {selectedClient.phone}</p>
                        <p>Dirección: {selectedClient.address}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Agregar Productos</CardTitle>
                </CardHeader>
                <CardContent>
                  <QuickProductInput onAddItem={addQuoteItem} products={products} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Productos en Cotización</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {items.length} producto{items.length !== 1 ? 's' : ''}
                      </Badge>
                      <Popover open={productsOpen} onOpenChange={setProductsOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Plus className="w-4 h-4 mr-2" />
                            Buscar Producto
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-0">
                          <Command>
                            <CommandInput placeholder="Buscar producto..." />
                            <CommandList>
                              <CommandEmpty>No se encontraron productos.</CommandEmpty>
                              <CommandGroup>
                                {products.map((product) => (
                                  <CommandItem
                                    key={product.id}
                                    value={`${product.name} ${product.code}`}
                                    onSelect={() => addProduct(product)}
                                  >
                                    <div className="flex flex-col">
                                      <p className="font-medium">{product.name}</p>
                                      <p className="text-sm text-muted-foreground">
                                        {product.code} - Stock: {product.currentStock}
                                      </p>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <QuoteItemTable
                    items={items}
                    onUpdateItem={updateItem}
                    onRemoveItem={removeItem}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Observaciones</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="publicNotes">Observaciones Públicas</Label>
                    <Textarea
                      id="publicNotes"
                      placeholder="Observaciones que verá el cliente..."
                      value={publicNotes}
                      onChange={(e) => setPublicNotes(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="privateNotes">Observaciones Internas</Label>
                    <Textarea
                      id="privateNotes"
                      placeholder="Observaciones internas (solo para administradores)..."
                      value={privateNotes}
                      onChange={(e) => setPrivateNotes(e.target.value)}
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Condiciones</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="paymentMethod">Forma de Pago</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((method) => (
                          <SelectItem key={method} value={method}>
                            {method.charAt(0).toUpperCase() + method.slice(1).replace('_', ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="validityDays">Validez (días)</Label>
                    <Input
                      id="validityDays"
                      type="number"
                      value={validityDays}
                      onChange={(e) => setValidityDays(Number(e.target.value))}
                      min="1"
                      max="365"
                    />
                  </div>
                  
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="includeIVA"
                        checked={includeIVA}
                        onCheckedChange={setIncludeIVA}
                      />
                      <Label htmlFor="includeIVA" className="text-sm">
                        Discriminar IVA (21%)
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Por defecto incluye 10.5% no discriminado. Si activas esto, se cambia a IVA 21% discriminado.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <QuoteTotals totals={totals} />

              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <Button
                      onClick={sendQuote}
                      disabled={isLoading}
                      className="w-full"
                    >
                      {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      <Send className="w-4 h-4 mr-2" />
                      {isEditing ? 'Actualizar y Enviar' : 'Enviar'} Cotización
                    </Button>
                    
                    <Button variant="outline" className="w-full" disabled>
                      <FileText className="w-4 h-4 mr-2" />
                      Generar PDF
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <ClientFormDialog
        open={showClientForm}
        onOpenChange={setShowClientForm}
        onClientCreated={handleClientCreated}
      />
    </>
  );
} 