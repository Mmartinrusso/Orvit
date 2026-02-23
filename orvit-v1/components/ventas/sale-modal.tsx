'use client';

import { formatNumber } from '@/lib/utils';
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
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { 
  Loader2, 
  Plus, 
  Trash2, 
  ShoppingCart, 
  Users, 
  Package, 
  DollarSign,
  FileText,
  Calculator,
  CreditCard,
  Truck
} from 'lucide-react';
import { Sale, Quote, Client, Product, PAYMENT_METHODS } from '@/lib/types/sales';

const saleItemSchema = z.object({
  productId: z.string().min(1, 'Selecciona un producto'),
  quantity: z.number().min(0.01, 'La cantidad debe ser mayor a 0'),
  unitPrice: z.number().min(0, 'El precio debe ser mayor o igual a 0'),
  discount: z.number().min(0).max(100, 'El descuento debe estar entre 0 y 100'),
  notes: z.string().optional()
});

const saleSchema = z.object({
  clientId: z.string().min(1, 'Selecciona un cliente'),
  description: z.string().min(1, 'La descripción es requerida'),
  items: z.array(saleItemSchema).min(1, 'Agrega al menos un producto'),
  paymentMethod: z.enum(PAYMENT_METHODS, { required_error: 'Selecciona un método de pago' }),
  paymentTerms: z.number().min(0, 'Los términos de pago deben ser mayor o igual a 0'),
  deliveryDate: z.string().optional(),
  deliveryAddress: z.string().optional(),
  notes: z.string().optional(),
  isPaid: z.boolean().default(false),
  isDelivered: z.boolean().default(false)
});

type SaleFormData = z.infer<typeof saleSchema>;

interface SaleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaleCreated?: (sale: Sale) => void;
  onSaleUpdated?: (sale: Sale) => void;
  editingSale?: Sale | null;
  fromQuote?: Quote | null; // Para convertir cotización a venta
  mode?: 'create' | 'edit' | 'convert';
}

export function SaleModal({ 
  open, 
  onOpenChange, 
  onSaleCreated, 
  onSaleUpdated,
  editingSale, 
  fromQuote,
  mode = 'create' 
}: SaleModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { errors }
  } = useForm<SaleFormData>({
    resolver: zodResolver(saleSchema),
    defaultValues: {
      clientId: '',
      description: '',
      items: [{ productId: '', quantity: 1, unitPrice: 0, discount: 0, notes: '' }],
      paymentMethod: 'efectivo',
      paymentTerms: 0,
      deliveryDate: '',
      deliveryAddress: '',
      notes: '',
      isPaid: false,
      isDelivered: false
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items'
  });

  const watchedItems = watch('items');
  const watchedPaymentMethod = watch('paymentMethod');
  const watchedIsPaid = watch('isPaid');
  const watchedIsDelivered = watch('isDelivered');

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
      taxes: formatNumber(taxes, 2),
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

  // Cargar datos desde cotización o venta existente
  useEffect(() => {
    if (fromQuote && mode === 'convert') {
      // Convertir cotización a venta
      setValue('clientId', fromQuote.clientId);
      setValue('description', `Venta desde cotización ${fromQuote.number}: ${fromQuote.description}`);
      setValue('items', fromQuote.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
        notes: item.notes || ''
      })));
      setValue('paymentTerms', fromQuote.paymentTerms || 0);
      setValue('notes', fromQuote.notes || '');
    } else if (editingSale && mode === 'edit') {
      // Editar venta existente
      setValue('clientId', editingSale.clientId);
      setValue('description', editingSale.description);
      setValue('items', editingSale.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
        notes: item.notes || ''
      })));
      setValue('paymentMethod', editingSale.paymentMethod);
      setValue('paymentTerms', editingSale.paymentTerms || 0);
      setValue('deliveryDate', editingSale.deliveryDate?.split('T')[0] || '');
      setValue('deliveryAddress', editingSale.deliveryAddress || '');
      setValue('notes', editingSale.notes || '');
      setValue('isPaid', editingSale.status === 'paid' || editingSale.status === 'delivered');
      setValue('isDelivered', editingSale.status === 'delivered');
    }
  }, [fromQuote, editingSale, mode, setValue]);

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

  const onSubmit = async (data: SaleFormData) => {
    setIsLoading(true);
    try {
      // TODO: Implementar API de ventas
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const client = clients.find(c => c.id === data.clientId);
      
      // Determinar estado de la venta
      let status: 'pending' | 'confirmed' | 'paid' | 'delivered' | 'cancelled' = 'confirmed';
      if (data.isDelivered) {
        status = 'delivered';
      } else if (data.isPaid) {
        status = 'paid';
      }
      
      const newSale: Sale = {
        id: editingSale?.id || Math.random().toString(36).substr(2, 9),
        number: editingSale?.number || `VTA-2024-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
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
        status,
        paymentMethod: data.paymentMethod,
        paymentTerms: data.paymentTerms,
        deliveryDate: data.deliveryDate || undefined,
        deliveryAddress: data.deliveryAddress || undefined,
        notes: data.notes,
        quoteId: fromQuote?.id, // Referencia a la cotización origen
        createdAt: editingSale?.createdAt || new Date(),
        updatedAt: new Date()
      };

      if (mode === 'edit' && onSaleUpdated) {
        onSaleUpdated(newSale);
        toast.success('Venta actualizada correctamente');
      } else if (onSaleCreated) {
        onSaleCreated(newSale);
        if (mode === 'convert') {
          toast.success('Cotización convertida a venta exitosamente');
        } else {
          toast.success('Venta registrada correctamente');
        }
      }
      
      handleClose();
    } catch (error) {
      toast.error('Error al guardar venta');
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

  const getTitle = () => {
    switch (mode) {
      case 'edit':
        return 'Editar Venta';
      case 'convert':
        return 'Convertir Cotización a Venta';
      default:
        return 'Nueva Venta';
    }
  };

  const getDescription = () => {
    switch (mode) {
      case 'edit':
        return 'Modifica los datos de la venta existente';
      case 'convert':
        return `Convierte la cotización ${fromQuote?.number || ''} en una venta confirmada`;
      default:
        return 'Registra una nueva venta directa';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-success" />
            {getTitle()}
          </DialogTitle>
          <DialogDescription>
            {getDescription()}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form id="sale-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Información de origen (si viene de cotización) */}
          {fromQuote && mode === 'convert' && (
            <Card className="bg-info-muted border-info">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-info-muted-foreground">
                  <Calculator className="h-5 w-5" />
                  Cotización de Origen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="font-medium">Número:</p>
                    <p>{fromQuote.number}</p>
                  </div>
                  <div>
                    <p className="font-medium">Cliente:</p>
                    <p>{fromQuote.client.name}</p>
                  </div>
                  <div>
                    <p className="font-medium">Total:</p>
                    <p>${formatNumber(fromQuote.total, 2)}</p>
                  </div>
                  <div>
                    <p className="font-medium">Estado:</p>
                    <Badge variant="outline">{fromQuote.status}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

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
                    disabled={mode === 'convert'} // No editable si viene de cotización
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
                        clients.map((client) => (
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
                  <Label htmlFor="paymentMethod">Método de Pago *</Label>
                  <Select 
                    onValueChange={(value) => setValue('paymentMethod', value as any)}
                    defaultValue={watch('paymentMethod')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona método de pago" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="tarjeta_credito">Tarjeta de Crédito</SelectItem>
                      <SelectItem value="tarjeta_debito">Tarjeta de Débito</SelectItem>
                      <SelectItem value="transferencia">Transferencia Bancaria</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="cuenta_corriente">Cuenta Corriente</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.paymentMethod && (
                    <p className="text-sm text-destructive mt-1">{errors.paymentMethod.message}</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="description">Descripción *</Label>
                <Textarea
                  {...register('description')}
                  placeholder="Describe la venta..."
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
                Productos Vendidos
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
                              products.map((product) => (
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

          {/* Entrega y Estado */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Entrega y Estado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="deliveryDate">Fecha de Entrega</Label>
                  <DatePicker
                    value={watch('deliveryDate')}
                    onChange={(date) => setValue('deliveryDate', date)}
                    placeholder="Selecciona una fecha"
                  />
                </div>
                <div>
                  <Label htmlFor="paymentTerms">Términos de Pago (días)</Label>
                  <Input
                    type="number"
                    min="0"
                    {...register('paymentTerms', { valueAsNumber: true })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="deliveryAddress">Dirección de Entrega</Label>
                <Textarea
                  {...register('deliveryAddress')}
                  placeholder="Dirección donde entregar los productos..."
                  className="min-h-[60px]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isPaid"
                    checked={watchedIsPaid}
                    onCheckedChange={(checked) => setValue('isPaid', checked)}
                  />
                  <Label htmlFor="isPaid" className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Pago Recibido
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="isDelivered"
                    checked={watchedIsDelivered}
                    onCheckedChange={(checked) => setValue('isDelivered', checked)}
                  />
                  <Label htmlFor="isDelivered" className="flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Productos Entregados
                  </Label>
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notas Adicionales</Label>
                <Textarea
                  {...register('notes')}
                  placeholder="Observaciones, condiciones especiales..."
                  className="min-h-[80px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Resumen y Totales */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Resumen de la Venta
              </CardTitle>
            </CardHeader>
            <CardContent>
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
          <Button type="submit" form="sale-form" disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {mode === 'edit' ? 'Actualizar Venta' :
             mode === 'convert' ? 'Convertir a Venta' : 'Registrar Venta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 