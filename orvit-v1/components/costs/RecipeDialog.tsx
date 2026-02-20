'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateRecipeSchema, type CreateRecipeInput } from '@/lib/validations/costs';
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
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, BookOpen, Package, Trash2, Loader2, Factory } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  unitLabel: string;
  line: {
    name: string;
  };
}

interface InputItem {
  id: string;
  name: string;
  unitLabel: string;
  currentPrice: number;
}

interface RecipeDialogProps {
  children?: React.ReactNode;
  onRecipeCreated?: () => void;
}

export function RecipeDialog({ children, onRecipeCreated }: RecipeDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [inputs, setInputs] = useState<InputItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const form = useForm<CreateRecipeInput>({
    resolver: zodResolver(CreateRecipeSchema),
    defaultValues: {
      name: '',
      base: 'PER_BATCH',
      scopeType: 'PRODUCT',
      scopeId: '',
      version: 1,
      description: '',
      items: [{ inputId: '', quantity: 0, unitLabel: '' }],
      outputQuantity: undefined,
      outputUnitLabel: 'unidades',
      intermediateQuantity: undefined,
      intermediateUnitLabel: 'placas',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  // Load data when dialog opens
  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    try {
      setLoadingData(true);
      const [productsRes, inputsRes] = await Promise.all([
        fetch('/api/costs/products?active=true'),
        fetch('/api/costs/inputs')
      ]);

      if (productsRes.ok) {
        const productsData = await productsRes.json();
        setProducts(productsData);
      }

      if (inputsRes.ok) {
        const inputsData = await inputsRes.json();
        setInputs(inputsData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoadingData(false);
    }
  };

  const onSubmit = async (data: CreateRecipeInput) => {
    try {
      setIsLoading(true);
      
      const response = await fetch('/api/costs/recipes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const newRecipe = await response.json();
        toast.success('Receta creada exitosamente');
        setOpen(false);
        form.reset({
          name: '',
          base: 'PER_BATCH',
          scopeType: 'PRODUCT',
          scopeId: '',
          version: 1,
          description: '',
          items: [{ inputId: '', quantity: 0, unitLabel: '' }],
          outputQuantity: undefined,
          outputUnitLabel: 'unidades',
          intermediateQuantity: undefined,
          intermediateUnitLabel: 'placas',
        });
        onRecipeCreated?.();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al crear receta');
      }
    } catch (error) {
      console.error('Error creating recipe:', error);
      toast.error('Error al crear receta');
    } finally {
      setIsLoading(false);
    }
  };

  const addItem = () => {
    append({ inputId: '', quantity: 0, unitLabel: '' });
  };

  const removeItem = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const calculateItemCost = (index: number) => {
    const item = form.watch(`items.${index}`);
    const input = inputs.find(inp => inp.id === item.inputId);
    if (!input) return 0;
    return (item.quantity || 0) * input.currentPrice;
  };

  const calculateTotalCost = () => {
    const items = form.watch('items');
    return items.reduce((total, item, index) => {
      return total + calculateItemCost(index);
    }, 0);
  };

  const selectedProduct = products.find(p => p.id === form.watch('scopeId'));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Nueva Receta
          </Button>
        )}
      </DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <BookOpen className="h-5 w-5" />
            Crear Nueva Receta (BOM)
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Configure la lista de materiales (Bill of Materials) para un producto
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
            <DialogBody>
            <div className="space-y-6">
            {/* Recipe Info */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel className="text-foreground">Nombre de la Receta</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ej: Receta Bloque H8 v1" 
                        className="bg-background border-input" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="scopeId"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel className="text-foreground">Producto</FormLabel>
                    <Select 
                      value={field.value} 
                      onValueChange={field.onChange}
                      disabled={loadingData}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-background border-input">
                          <SelectValue placeholder="Seleccionar producto" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {loadingData ? (
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
                name="base"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Base de la Receta</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="bg-background border-input">
                          <SelectValue placeholder="Seleccionar base" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="PER_BATCH">Por Batea</SelectItem>
                        <SelectItem value="PER_M3">Por m³</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-muted-foreground">
                      Base de cálculo de la receta
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="version"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Versión</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        min="1"
                        placeholder="1" 
                        className="bg-background border-input" 
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      />
                    </FormControl>
                    <FormDescription className="text-muted-foreground">
                      Número de versión de la receta
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel className="text-foreground">Descripción (Opcional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Descripción de la receta..." 
                        className="bg-background border-input" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Yield Configuration */}
            <div className="space-y-4 p-4 bg-muted/10 rounded-lg border border-border/30">
              <div>
                <h4 className="text-lg font-medium text-foreground mb-2">Configuración de Rendimiento</h4>
                <p className="text-sm text-muted-foreground">
                  Configure cuántos productos y placas produce esta receta
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="outputQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground">Cantidad de Productos</FormLabel>
                      <FormControl>
                        <Input 
                          type="number"
                          min="0.00001"
                          step="0.00001"
                          placeholder="Ej: 100" 
                          className="bg-background border-input" 
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                        />
                      </FormControl>
                      <FormDescription className="text-muted-foreground">
                        Productos que salen de esta receta
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="outputUnitLabel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground">Unidad del Producto</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Ej: unidades, kg, litros" 
                          className="bg-background border-input" 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription className="text-muted-foreground">
                        Unidad de medida del producto final
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="intermediateQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground">Cantidad de Placas/Intermedios</FormLabel>
                      <FormControl>
                        <Input 
                          type="number"
                          min="0.00001"
                          step="0.00001"
                          placeholder="Ej: 5" 
                          className="bg-background border-input" 
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                        />
                      </FormControl>
                      <FormDescription className="text-muted-foreground">
                        Unidades intermedias que salen (opcional)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="intermediateUnitLabel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground">Nombre de la Unidad Intermedia</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Ej: placas, moldes, piezas" 
                          className="bg-background border-input" 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription className="text-muted-foreground">
                        Nombre personalizable para unidades intermedias
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Recipe Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-medium text-foreground">Insumos de la Receta</h4>
                  <p className="text-sm text-muted-foreground">
                    Agregue los insumos necesarios con sus cantidades para producir 1 batch
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Costo total del batch:</div>
                  <div className="text-xl font-bold text-primary">
                    {formatCurrency(calculateTotalCost())}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {fields.map((field, index) => {
                  const selectedInput = inputs.find(inp => inp.id === form.watch(`items.${index}.inputId`));
                  
                  return (
                    <div key={field.id} className="grid grid-cols-12 gap-3 items-end p-4 border border-border/30 rounded-lg">
                      <div className="col-span-6">
                        <FormField
                          control={form.control}
                          name={`items.${index}.inputId`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-foreground">Insumo</FormLabel>
                              <Select 
                                value={field.value} 
                                onValueChange={(value) => {
                                  field.onChange(value);
                                  // Auto-fill unitLabel when input is selected
                                  const selectedInput = inputs.find(inp => inp.id === value);
                                  if (selectedInput) {
                                    form.setValue(`items.${index}.unitLabel`, selectedInput.unitLabel);
                                  }
                                }}
                                disabled={loadingData}
                              >
                                <FormControl>
                                  <SelectTrigger className="bg-background border-input">
                                    <SelectValue placeholder="Seleccionar insumo" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {loadingData ? (
                                    <SelectItem value="loading" disabled>
                                      <div className="flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Cargando...
                                      </div>
                                    </SelectItem>
                                  ) : (
                                    inputs.map((input) => (
                                      <SelectItem key={input.id} value={input.id}>
                                        <div className="flex items-center gap-2">
                                          <Package className="h-4 w-4" />
                                          <div>
                                            <div>{input.name}</div>
                                            <div className="text-xs text-muted-foreground">
                                              {formatCurrency(input.currentPrice)}/{input.unitLabel}
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
                      </div>

                      <div className="col-span-2">
                        <FormField
                          control={form.control}
                          name={`items.${index}.quantity`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-foreground">
                                Cantidad {selectedInput && `(${selectedInput.unitLabel})`}
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  type="number"
                                  min="0.00001"
                                  step="0.00001"
                                  className="bg-background border-input"
                                  {...field}
                                  onChange={(e) => {
                                    field.onChange(parseFloat(e.target.value) || 0);
                                    // Auto-fill unitLabel when input is selected
                                    if (selectedInput) {
                                      form.setValue(`items.${index}.unitLabel`, selectedInput.unitLabel);
                                    }
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="col-span-2">
                        <FormLabel className="text-foreground">Precio Unitario</FormLabel>
                        <div className="h-10 flex items-center text-sm text-muted-foreground">
                          {selectedInput ? formatCurrency(selectedInput.currentPrice) : '-'}
                        </div>
                      </div>

                      <div className="col-span-1">
                        <FormLabel className="text-foreground">Subtotal</FormLabel>
                        <div className="h-10 flex items-center font-bold text-primary text-sm">
                          {formatCurrency(calculateItemCost(index))}
                        </div>
                      </div>

                      <div className="col-span-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(index)}
                          disabled={fields.length === 1}
                          className="h-8 w-8 p-0 hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={addItem}
                className="w-full bg-card text-card-foreground border-border hover:bg-accent/50"
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar Insumo
              </Button>
            </div>

            {/* Recipe Summary */}
            {products.find(p => p.id === form.watch('scopeId')) && calculateTotalCost() > 0 && (
              <div className="p-4 bg-muted/10 rounded-lg border border-border/30">
                <h4 className="font-medium text-foreground mb-2">Resumen de la Receta</h4>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Producto:</span>
                    <div className="font-medium text-foreground">{products.find(p => p.id === form.watch('scopeId'))?.name}</div>
                    <Badge variant="secondary" className="mt-1">
                      {products.find(p => p.id === form.watch('scopeId'))?.line.name}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Insumos:</span>
                    <div className="font-medium text-foreground">{fields.length} items</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Costo/Batch:</span>
                    <div className="font-bold text-primary text-lg">
                      {formatCurrency(calculateTotalCost())}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Rendimiento:</span>
                    {form.watch('outputQuantity') && (
                      <div className="font-medium text-foreground">
                        {form.watch('outputQuantity')} {form.watch('outputUnitLabel')}
                      </div>
                    )}
                    {form.watch('intermediateQuantity') && (
                      <div className="text-xs text-muted-foreground">
                        {form.watch('intermediateQuantity')} {form.watch('intermediateUnitLabel')}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 p-2 bg-info-muted rounded text-xs text-info-muted-foreground">
                  <strong>Información:</strong> Este es el costo de materias primas por batea de producción.
                  El rendimiento configurado permitirá calcular el costo unitario final.
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
                    Creando...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Receta
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