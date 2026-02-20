'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { 
  Loader2, 
  Plus, 
  Trash2, 
  Calculator, 
  Users, 
  Package, 
  DollarSign,
  FileText,
  Search,
  X
} from 'lucide-react';
import { Quote, QuoteItem, Client, Product } from '@/lib/types/sales';

const quoteItemSchema = z.object({
  productId: z.string().min(1, 'Selecciona un producto'),
  quantity: z.number().min(0.01, 'La cantidad debe ser mayor a 0'),
  unitPrice: z.number().min(0, 'El precio debe ser mayor o igual a 0'),
  discount: z.number().min(0).max(100, 'El descuento debe estar entre 0 y 100'),
  notes: z.string().optional()
});

const quoteSchema = z.object({
  clientId: z.string().min(1, 'Selecciona un cliente'),
  description: z.string().min(1, 'La descripción es requerida'),
  items: z.array(quoteItemSchema).min(1, 'Agrega al menos un producto'),
  validUntil: z.string().min(1, 'La fecha de validez es requerida'),
  notes: z.string().optional(),
  paymentTerms: z.number().min(0, 'Los términos de pago deben ser mayor o igual a 0'),
  deliveryTerms: z.string().optional()
});

type QuoteFormData = z.infer<typeof quoteSchema>;

interface QuoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQuoteCreated?: (quote: Quote) => void;
  onQuoteUpdated?: (quote: Quote) => void;
  editingQuote?: Quote | null;
  mode?: 'create' | 'edit';
}

export function QuoteModal({ 
  open, 
  onOpenChange, 
  onQuoteCreated, 
  onQuoteUpdated,
  editingQuote, 
  mode = 'create' 
}: QuoteModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { errors }
  } = useForm<QuoteFormData>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      clientId: '',
      description: '',
      items: [{ productId: '', quantity: 1, unitPrice: 0, discount: 0, notes: '' }],
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 días
      notes: '',
      paymentTerms: 0,
      deliveryTerms: ''
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items'
  });

  const watchedItems = watch('items');
  const selectedClientId = watch('clientId');

  // Calcular totales
  const calculations = useMemo(() => {
    const subtotal = watchedItems.reduce((sum, item) => {
      const product = products.find(p => p.id === item.productId);
      const unitPrice = item.unitPrice || product?.costPrice || 0;
      const itemTotal = unitPrice * (item.quantity || 0);
      const discount = (itemTotal * (item.discount || 0)) / 100;
      return sum + (itemTotal - discount);
    }, 0);

    const taxes = subtotal * 0.21; // IVA 21%
    const total = subtotal + taxes;

    return {
      subtotal: subtotal.toFixed(2),
      taxes: taxes.toFixed(2),
      total: total.toFixed(2)
    };
  }, [watchedItems, products]);

  // Cargar datos iniciales
  useEffect(() => {
    if (open) {
      loadClients();
      loadProducts();
    }
  }, [open]);

  // Cargar datos del quote en modo edición
  useEffect(() => {
    if (editingQuote && mode === 'edit') {
      setValue('clientId', editingQuote.clientId);
      setValue('description', editingQuote.description);
      setValue('validUntil', editingQuote.validUntil.split('T')[0]);
      setValue('notes', editingQuote.notes || '');
      setValue('paymentTerms', editingQuote.paymentTerms || 0);
      setValue('deliveryTerms', editingQuote.deliveryTerms || '');
      setValue('items', editingQuote.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
        notes: item.notes || ''
      })));
    }
  }, [editingQuote, mode, setValue]);

  const loadClients = async () => {
    setLoadingClients(true);
    try {
      // TODO: Implementar API de clientes
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
    } catch (error) {
      toast.error('Error al cargar clientes');
    } finally {
      setLoadingClients(false);
    }
  };

  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      // TODO: Implementar API de productos
      setProducts([]);
    } catch (error) {
      toast.error('Error al cargar productos');
    } finally {
      setLoadingProducts(false);
    }
  };

  const onSubmit = async (data: QuoteFormData) => {
    setIsLoading(true);
    try {
      // TODO: Implementar API de cotizaciones
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const client = clients.find(c => c.id === data.clientId);
      
      const newQuote: Quote = {
        id: editingQuote?.id || Math.random().toString(36).substr(2, 9),
        number: editingQuote?.number || `COT-2024-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        clientId: data.clientId,
        client: client!,
        description: data.description,
        items: data.items.map(item => {
          const product = products.find(p => p.id === item.productId);
          return {
            id: Math.random().toString(36).substr(2, 9),
            productId: item.productId,
            product: product!,
            quantity: item.quantity,
            unitPrice: item.unitPrice || product?.costPrice || 0,
            discount: item.discount || 0,
            notes: item.notes
          };
        }),
        subtotal: parseFloat(calculations.subtotal),
        taxes: parseFloat(calculations.taxes),
        total: parseFloat(calculations.total),
        status: editingQuote?.status || 'draft',
        validUntil: data.validUntil,
        notes: data.notes,
        paymentTerms: data.paymentTerms,
        deliveryTerms: data.deliveryTerms,
        createdAt: editingQuote?.createdAt || new Date(),
        updatedAt: new Date()
      };

      if (mode === 'edit' && onQuoteUpdated) {
        onQuoteUpdated(newQuote);
        toast.success('Cotización actualizada correctamente');
      } else if (onQuoteCreated) {
        onQuoteCreated(newQuote);
        toast.success('Cotización creada correctamente');
      }
      
      handleClose();
    } catch (error) {
      toast.error('Error al guardar cotización');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const addItem = () => {
    append({ productId: '', quantity: 1, unitPrice: 0, discount: 0, notes: '' });
  };

  const removeItem = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  const handleProductSelect = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setValue(`items.${index}.productId`, productId);
      setValue(`items.${index}.unitPrice`, product.costPrice);
    }
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    client.email.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    product.code.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" />
            {mode === 'edit' ? 'Editar Cotizacion' : 'Nueva Cotizacion'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'edit'
              ? 'Modifica los datos de la cotizacion existente'
              : 'Crea una nueva cotizacion para un cliente'
            }
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form id="quote-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Información del Cliente */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Información del Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="clientId">Cliente *</Label>
                  <Select 
                    onValueChange={(value) => setValue('clientId', value)}
                    defaultValue={watch('clientId')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {loadingClients ? (
                        <SelectItem value="loading" disabled>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Cargando clientes...
                        </SelectItem>
                      ) : (
                        filteredClients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{client.name}</span>
                              <span className="text-sm text-muted-foreground">{client.email}</span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {errors.clientId && (
                    <p className="text-sm text-destructive mt-1">{errors.clientId.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="validUntil">Válida hasta *</Label>
                  <DatePicker
                    value={watch('validUntil')}
                    onChange={(date) => setValue('validUntil', date)}
                    placeholder="Selecciona una fecha"
                  />
                  {errors.validUntil && (
                    <p className="text-sm text-destructive mt-1">{errors.validUntil.message}</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="description">Descripción *</Label>
                <Textarea
                  {...register('description')}
                  placeholder="Describe brevemente el proyecto o solicitud..."
                  className="min-h-[80px]"
                />
                {errors.description && (
                  <p className="text-sm text-destructive mt-1">{errors.description.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Productos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Productos y Servicios
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Ítem {index + 1}</h4>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <Label htmlFor={`items.${index}.productId`}>Producto *</Label>
                        <Select 
                          onValueChange={(value) => handleProductSelect(index, value)}
                          defaultValue={watchedItems[index]?.productId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona producto" />
                          </SelectTrigger>
                          <SelectContent>
                            {loadingProducts ? (
                              <SelectItem value="loading" disabled>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Cargando...
                              </SelectItem>
                            ) : (
                              filteredProducts.map((product) => (
                                <SelectItem key={product.id} value={product.id}>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{product.name}</span>
                                    <span className="text-sm text-muted-foreground">
                                      {product.code} - ${product.costPrice}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        {errors.items?.[index]?.productId && (
                          <p className="text-sm text-destructive mt-1">
                            {errors.items[index].productId.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor={`items.${index}.quantity`}>Cantidad *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                        />
                        {errors.items?.[index]?.quantity && (
                          <p className="text-sm text-destructive mt-1">
                            {errors.items[index].quantity.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor={`items.${index}.unitPrice`}>Precio Unitario</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          {...register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                        />
                        {errors.items?.[index]?.unitPrice && (
                          <p className="text-sm text-destructive mt-1">
                            {errors.items[index].unitPrice.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor={`items.${index}.discount`}>Descuento (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          {...register(`items.${index}.discount`, { valueAsNumber: true })}
                        />
                        {errors.items?.[index]?.discount && (
                          <p className="text-sm text-destructive mt-1">
                            {errors.items[index].discount.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label htmlFor={`items.${index}.notes`}>Notas del ítem</Label>
                      <Textarea
                        {...register(`items.${index}.notes`)}
                        placeholder="Especificaciones, observaciones..."
                        className="min-h-[60px]"
                      />
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  onClick={addItem}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Producto
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Resumen y Totales */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Resumen de la Cotización
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="paymentTerms">Términos de Pago (días)</Label>
                      <Input
                        type="number"
                        min="0"
                        {...register('paymentTerms', { valueAsNumber: true })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="deliveryTerms">Términos de Entrega</Label>
                      <Input
                        {...register('deliveryTerms')}
                        placeholder="ej. 7-10 días hábiles"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="notes">Notas Adicionales</Label>
                    <Textarea
                      {...register('notes')}
                      placeholder="Condiciones especiales, observaciones..."
                      className="min-h-[80px]"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-muted p-4 rounded-lg space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal:</span>
                      <span>${calculations.subtotal}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>IVA (21%):</span>
                      <span>${calculations.taxes}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total:</span>
                      <span>${calculations.total}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          </form>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button type="submit" form="quote-form" disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {mode === 'edit' ? 'Actualizar Cotizacion' : 'Crear Cotizacion'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 