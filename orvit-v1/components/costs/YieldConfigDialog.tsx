'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateYieldConfigSchema, type CreateYieldConfigInput } from '@/lib/validations/costs';
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
  RadioGroup,
  RadioGroupItem,
} from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Settings, Loader2, ArrowRight, TrendingDown } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  unitLabel: string;
  line: {
    name: string;
  };
}

interface YieldConfigDialogProps {
  product?: Product;
  productId?: string;
  children?: React.ReactNode;
  onConfigSaved?: () => void;
}

export function YieldConfigDialog({ product, productId, children, onConfigSaved }: YieldConfigDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [configType, setConfigType] = useState<'chained' | 'direct'>('direct');
  const [productData, setProductData] = useState<Product | null>(product || null);

  const form = useForm<CreateYieldConfigInput>({
    resolver: zodResolver(CreateYieldConfigSchema),
    defaultValues: {
      productId: productId || product?.id || '',
      outputsPerBatch: 1,
      scrapGlobal: 0,
    },
  });

  // Load product data if not provided
  useEffect(() => {
    if (open && !productData && productId) {
      loadProductData();
    }
  }, [open, productData, productId]);

  const loadProductData = async () => {
    try {
      const response = await fetch(`/api/costs/products/${productId}`);
      if (response.ok) {
        const data = await response.json();
        setProductData(data);
      }
    } catch (error) {
      console.error('Error loading product:', error);
    }
  };

  const onSubmit = async (data: CreateYieldConfigInput) => {
    try {
      setIsLoading(true);
      
      const targetProductId = productId || product?.id;
      if (!targetProductId) {
        toast.error('ID de producto requerido');
        return;
      }

      const response = await fetch(`/api/costs/yields/${targetProductId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success('Configuración de rendimientos guardada exitosamente');
        setOpen(false);
        onConfigSaved?.();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al guardar configuración');
      }
    } catch (error) {
      console.error('Error saving yield config:', error);
      toast.error('Error al guardar configuración');
    } finally {
      setIsLoading(false);
    }
  };

  const resetFormForType = (type: 'chained' | 'direct') => {
    setConfigType(type);
    if (type === 'direct') {
      form.reset({
        productId: productId || product?.id || '',
        outputsPerBatch: form.getValues('outputsPerBatch') || 1,
        scrapGlobal: form.getValues('scrapGlobal') || 0,
      });
    } else {
      form.reset({
        productId: productId || product?.id || '',
        intermediatesPerBatch: form.getValues('intermediatesPerBatch') || 1,
        outputsPerIntermediate: form.getValues('outputsPerIntermediate') || 1,
        scrapA: form.getValues('scrapA') || 0,
        scrapB: form.getValues('scrapB') || 0,
      });
    }
  };

  const currentProduct = productData || product;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" className="bg-card text-card-foreground border-border hover:bg-accent/50">
            <Settings className="h-4 w-4 mr-2" />
            Configurar Rendimientos
          </Button>
        )}
      </DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Settings className="h-5 w-5" />
            Configurar Rendimientos BATCH
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {currentProduct && (
              <>Configure los rendimientos para el producto <strong>{currentProduct.name}</strong></>
            )}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
            <DialogBody>
            <div className="space-y-6">
            {/* Config Type Selection */}
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-foreground">Tipo de Configuración</h4>
              <RadioGroup 
                value={configType} 
                onValueChange={(value: 'chained' | 'direct') => resetFormForType(value)}
                className="grid grid-cols-1 gap-4"
              >
                <div className="flex items-start space-x-3 p-4 border border-border/30 rounded-lg">
                  <RadioGroupItem value="direct" id="direct" className="mt-1" />
                  <div className="space-y-2">
                    <Label htmlFor="direct" className="text-foreground font-medium cursor-pointer">
                      Rendimiento Directo (Batch → Salida)
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Para productos que se obtienen directamente del batch sin procesos intermedios.
                      Ejemplo: bloques que salen directamente de la máquina.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3 p-4 border border-border/30 rounded-lg">
                  <RadioGroupItem value="chained" id="chained" className="mt-1" />
                  <div className="space-y-2">
                    <Label htmlFor="chained" className="text-foreground font-medium cursor-pointer">
                      Rendimiento Encadenado (Batch → Intermedio → Salida)
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Para productos que pasan por un proceso intermedio.
                      Ejemplo: batch → placas → unidades cortadas.
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Direct Configuration */}
            {configType === 'direct' && (
              <div className="space-y-4">
                <h4 className="text-lg font-medium text-foreground flex items-center gap-2">
                  Configuración Directa
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded text-blue-700 dark:text-blue-300">
                      Batch
                    </span>
                    <ArrowRight className="h-4 w-4" />
                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900 rounded text-green-700 dark:text-green-300">
                      Salida
                    </span>
                  </div>
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="outputsPerBatch"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground">
                          Salidas por Batea {currentProduct && `(${currentProduct.unitLabel})`}
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            min="0"
                            step="0.01"
                            className="bg-background border-input"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormDescription className="text-muted-foreground">
                          Cantidad de producto final que se obtiene por batea
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="scrapGlobal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground flex items-center gap-2">
                          Merma Global (0-1)
                          <TrendingDown className="h-4 w-4 text-orange-500" />
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            min="0"
                            max="1"
                            step="0.01"
                            className="bg-background border-input"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormDescription className="text-muted-foreground">
                          Porcentaje de pérdida (0.05 = 5% de merma)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Calculation Preview */}
                {form.watch('outputsPerBatch') > 0 && (
                  <div className="p-4 bg-muted/10 rounded-lg border border-border/30">
                    <h5 className="font-medium text-foreground mb-2">Vista Previa del Cálculo</h5>
                    <div className="text-sm space-y-1">
                      <div>
                        <span className="text-muted-foreground">Salidas Esperadas:</span>
                        <span className="ml-2 font-medium text-foreground">
                          {form.watch('outputsPerBatch')} {currentProduct?.unitLabel}/batch
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Merma:</span>
                        <span className="ml-2 font-medium text-orange-600">
                          -{((form.watch('scrapGlobal') || 0) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="pt-2 border-t border-border/30">
                        <span className="text-muted-foreground">Salidas Netas:</span>
                        <span className="ml-2 font-bold text-primary">
                          {((form.watch('outputsPerBatch') || 0) * (1 - (form.watch('scrapGlobal') || 0))).toFixed(2)} {currentProduct?.unitLabel}/batch
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Chained Configuration */}
            {configType === 'chained' && (
              <div className="space-y-4">
                <h4 className="text-lg font-medium text-foreground flex items-center gap-2">
                  Configuración Encadenada
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded text-blue-700 dark:text-blue-300">
                      Batch
                    </span>
                    <ArrowRight className="h-4 w-4" />
                    <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900 rounded text-yellow-700 dark:text-yellow-300">
                      Intermedio
                    </span>
                    <ArrowRight className="h-4 w-4" />
                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900 rounded text-green-700 dark:text-green-300">
                      Salida
                    </span>
                  </div>
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="intermediatesPerBatch"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground">Intermedios por Batea</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            min="0"
                            step="0.01"
                            className="bg-background border-input"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormDescription className="text-muted-foreground">
                          Cantidad de productos intermedios por batea
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="scrapA"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground flex items-center gap-2">
                          Merma A (Batch→Intermedio)
                          <TrendingDown className="h-4 w-4 text-orange-500" />
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            min="0"
                            max="1"
                            step="0.01"
                            className="bg-background border-input"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormDescription className="text-muted-foreground">
                          Pérdida en el primer proceso (0-1)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="outputsPerIntermediate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground">
                          Salidas por Intermedio {currentProduct && `(${currentProduct.unitLabel})`}
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            min="0"
                            step="0.01"
                            className="bg-background border-input"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormDescription className="text-muted-foreground">
                          Cantidad de salidas por cada intermedio
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="scrapB"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground flex items-center gap-2">
                          Merma B (Intermedio→Salida)
                          <TrendingDown className="h-4 w-4 text-orange-500" />
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            min="0"
                            max="1"
                            step="0.01"
                            className="bg-background border-input"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormDescription className="text-muted-foreground">
                          Pérdida en el segundo proceso (0-1)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Calculation Preview */}
                {form.watch('intermediatesPerBatch') > 0 && form.watch('outputsPerIntermediate') > 0 && (
                  <div className="p-4 bg-muted/10 rounded-lg border border-border/30">
                    <h5 className="font-medium text-foreground mb-2">Vista Previa del Cálculo</h5>
                    <div className="text-sm space-y-1">
                      <div>
                        <span className="text-muted-foreground">Intermedios Esperados:</span>
                        <span className="ml-2 font-medium text-foreground">
                          {form.watch('intermediatesPerBatch')} × (1 - {((form.watch('scrapA') || 0) * 100).toFixed(1)}%) = {' '}
                          {((form.watch('intermediatesPerBatch') || 0) * (1 - (form.watch('scrapA') || 0))).toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Salidas Esperadas:</span>
                        <span className="ml-2 font-medium text-foreground">
                          {((form.watch('intermediatesPerBatch') || 0) * (1 - (form.watch('scrapA') || 0))).toFixed(2)} × {form.watch('outputsPerIntermediate')} × (1 - {((form.watch('scrapB') || 0) * 100).toFixed(1)}%)
                        </span>
                      </div>
                      <div className="pt-2 border-t border-border/30">
                        <span className="text-muted-foreground">Salidas Netas:</span>
                        <span className="ml-2 font-bold text-primary">
                          {(
                            (form.watch('intermediatesPerBatch') || 0) * 
                            (1 - (form.watch('scrapA') || 0)) * 
                            (form.watch('outputsPerIntermediate') || 0) * 
                            (1 - (form.watch('scrapB') || 0))
                          ).toFixed(2)} {currentProduct?.unitLabel}/batch
                        </span>
                      </div>
                    </div>
                  </div>
                )}
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
                    Guardando...
                  </>
                ) : (
                  <>
                    <Settings className="h-4 w-4 mr-2" />
                    Guardar Configuración
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
