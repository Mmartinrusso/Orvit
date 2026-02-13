'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateMonthlyProductionSchema, type CreateMonthlyProductionInput } from '@/lib/validations/costs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogBody,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Plus, FileText, Loader2, Factory } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  unitLabel: string;
  line: {
    name: string;
  };
}

interface ProductionDialogProps {
  children?: React.ReactNode;
  onProductionCreated?: () => void;
}

export function ProductionDialog({ children, onProductionCreated }: ProductionDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const form = useForm<CreateMonthlyProductionInput>({
    resolver: zodResolver(CreateMonthlyProductionSchema),
    defaultValues: {
      productId: '',
      month: new Date().toISOString().slice(0, 7), // Current YYYY-MM
      producedQuantity: 0,
    },
  });

  // Load products when dialog opens
  useEffect(() => {
    if (open) {
      loadProducts();
    }
  }, [open]);

  const loadProducts = async () => {
    try {
      setLoadingProducts(true);
      const response = await fetch('/api/costs/products?active=true');
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      } else {
        toast.error('Error al cargar productos');
      }
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Error al cargar productos');
    } finally {
      setLoadingProducts(false);
    }
  };

  const onSubmit = async (data: CreateMonthlyProductionInput) => {
    try {
      setIsLoading(true);
      
      const response = await fetch('/api/costs/production', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success('Producción registrada exitosamente');
        setOpen(false);
        form.reset({
          productId: '',
          month: new Date().toISOString().slice(0, 7),
          producedQuantity: 0,
        });
        onProductionCreated?.();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al registrar producción');
      }
    } catch (error) {
      console.error('Error creating production:', error);
      toast.error('Error al registrar producción');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedProduct = products.find(p => p.id === form.watch('productId'));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Registrar Producción
          </Button>
        )}
      </DialogTrigger>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <FileText className="h-5 w-5" />
            Registrar Producción Mensual
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Registre la cantidad producida de un producto en un mes específico
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
            <DialogBody>
            <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="productId"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel className="text-foreground">Producto</FormLabel>
                    <Select 
                      value={field.value} 
                      onValueChange={field.onChange}
                      disabled={loadingProducts}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-background border-input">
                          <SelectValue placeholder="Seleccionar producto" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {loadingProducts ? (
                          <SelectItem value="loading" disabled>
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Cargando productos...
                            </div>
                          </SelectItem>
                        ) : products.length === 0 ? (
                          <SelectItem value="empty" disabled>
                            No hay productos disponibles
                          </SelectItem>
                        ) : (
                          products.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              <div className="flex items-center gap-2">
                                <Factory className="h-4 w-4" />
                                <div>
                                  <div>{product.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {product.line.name} • {product.unitLabel}
                                  </div>
                                </div>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="month"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Mes</FormLabel>
                    <FormControl>
                      <Input 
                        type="month"
                        className="bg-background border-input" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription className="text-muted-foreground">
                      Mes al que corresponde la producción
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="producedQuantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">
                      Cantidad Producida {selectedProduct && `(${selectedProduct.unitLabel})`}
                    </FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0"
                        className="bg-background border-input" 
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription className="text-muted-foreground">
                      Cantidad total producida en el mes
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Production Summary */}
            {selectedProduct && form.watch('producedQuantity') > 0 && (
              <div className="p-4 bg-muted/10 rounded-lg border border-border/30">
                <h4 className="font-medium text-foreground mb-2">Resumen de Producción</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Producto:</span>
                    <div className="font-medium text-foreground">{selectedProduct.name}</div>
                    <div className="text-xs text-muted-foreground">{selectedProduct.line.name}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cantidad:</span>
                    <div className="font-bold text-primary text-lg">
                      {form.watch('producedQuantity').toLocaleString('es-AR')} {selectedProduct.unitLabel}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Mes:</span>
                    <div className="font-medium text-foreground">
                      {new Date(form.watch('month') + '-01').toLocaleDateString('es-AR', {
                        year: 'numeric',
                        month: 'long'
                      })}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Promedio Diario:</span>
                    <div className="font-medium text-foreground">
                      {(form.watch('producedQuantity') / 30).toFixed(2)} {selectedProduct.unitLabel}/día
                    </div>
                  </div>
                </div>
              </div>
            )}
            </div>
            </DialogBody>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Registrar Producción
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
