'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateProductSchema, type CreateProductInput } from '@/lib/validations/costs';
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
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Plus, Package, Factory, Loader2 } from 'lucide-react';

interface Line {
  id: string;
  code: string;
  name: string;
}

interface ProductDialogProps {
  children?: React.ReactNode;
  onProductCreated?: () => void;
}

export function ProductDialog({ children, onProductCreated }: ProductDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [loadingLines, setLoadingLines] = useState(true);

  const form = useForm<CreateProductInput>({
    resolver: zodResolver(CreateProductSchema),
    defaultValues: {
      name: '',
      lineId: '',
      measureKind: 'UNIT',
      unitLabel: '',
      costMethod: 'BATCH',
      active: true,
    },
  });

  // Load lines when dialog opens
  useEffect(() => {
    if (open) {
      loadLines();
    }
  }, [open]);

  const loadLines = async () => {
    try {
      setLoadingLines(true);
      const response = await fetch('/api/costs/lines');
      if (response.ok) {
        const data = await response.json();
        setLines(data);
      } else {
        toast.error('Error al cargar líneas de producción');
      }
    } catch (error) {
      console.error('Error loading lines:', error);
      toast.error('Error al cargar líneas de producción');
    } finally {
      setLoadingLines(false);
    }
  };

  const onSubmit = async (data: CreateProductInput) => {
    try {
      setIsLoading(true);
      
      const response = await fetch('/api/costs/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const newProduct = await response.json();
        toast.success('Producto creado exitosamente');
        setOpen(false);
        form.reset();
        onProductCreated?.();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al crear producto');
      }
    } catch (error) {
      console.error('Error creating product:', error);
      toast.error('Error al crear producto');
    } finally {
      setIsLoading(false);
    }
  };

  // Common unit suggestions
  const unitSuggestions = [
    'un', 'pza', 'kg', 'g', 'ton', 'l', 'ml', 'm³', 'cm³', 
    'm', 'cm', 'mm', 'm²', 'cm²', 'bolsa', 'caja', 'pallet'
  ];

  const selectedLine = lines.find(line => line.id === form.watch('lineId'));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Producto
          </Button>
        )}
      </DialogTrigger>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Package className="h-5 w-5" />
            Crear Nuevo Producto
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Registre un nuevo producto para incluir en el sistema de costos
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
            <DialogBody>
            <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel className="text-foreground">Nombre del Producto</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ej: Bloque H8, Vigueta 12x25, Adoquín 20x20" 
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
                name="lineId"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel className="text-foreground">Línea de Producción</FormLabel>
                    <Select 
                      value={field.value} 
                      onValueChange={field.onChange}
                      disabled={loadingLines}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-background border-input">
                          <SelectValue placeholder="Seleccionar línea" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {loadingLines ? (
                          <SelectItem value="loading" disabled>
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Cargando líneas...
                            </div>
                          </SelectItem>
                        ) : lines.length === 0 ? (
                          <SelectItem value="empty" disabled>
                            No hay líneas disponibles
                          </SelectItem>
                        ) : (
                          lines.map((line) => (
                            <SelectItem key={line.id} value={line.id}>
                              <div className="flex items-center gap-2">
                                <Factory className="h-4 w-4" />
                                <div>
                                  <div className="font-medium">{line.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    Código: {line.code}
                                  </div>
                                </div>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-muted-foreground">
                      Línea de producción a la que pertenece el producto
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="measureKind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Tipo de Medida</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="bg-background border-input">
                          <SelectValue placeholder="Seleccionar tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="UNIT">Unidad</SelectItem>
                        <SelectItem value="LENGTH">Longitud</SelectItem>
                        <SelectItem value="AREA">Área</SelectItem>
                        <SelectItem value="VOLUME">Volumen</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-muted-foreground">
                      Tipo de medida del producto
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unitLabel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Unidad de Medida</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="un, kg, m², etc." 
                        className="bg-background border-input" 
                        {...field} 
                        list="unit-suggestions"
                      />
                    </FormControl>
                    <datalist id="unit-suggestions">
                      {unitSuggestions.map(unit => (
                        <option key={unit} value={unit} />
                      ))}
                    </datalist>
                    <FormDescription className="text-muted-foreground">
                      Unidad en la que se vende/produce el producto
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="costMethod"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel className="text-foreground">Método de Costeo</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="bg-background border-input">
                          <SelectValue placeholder="Seleccionar método" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="BATCH">Por Batea</SelectItem>
                        <SelectItem value="VOLUMETRIC">Volumétrico</SelectItem>
                        <SelectItem value="PER_UNIT_BOM">BOM por Unidad</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-muted-foreground">
                      Método para calcular los costos del producto
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-col justify-end">
                    <FormLabel className="text-foreground">Estado</FormLabel>
                    <div className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="text-foreground font-normal cursor-pointer">
                        Producto Activo
                      </FormLabel>
                    </div>
                    <FormDescription className="text-muted-foreground">
                      Si está activo, aparecerá en listados y cálculos
                    </FormDescription>
                  </FormItem>
                )}
              />
            </div>

            {/* Product Preview */}
            {form.watch('name') && selectedLine && (
              <div className="p-4 bg-muted/10 rounded-lg border border-border/30">
                <h4 className="font-medium text-foreground mb-2">Vista Previa del Producto</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Producto:</span>
                    <div className="font-medium text-foreground">{form.watch('name')}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Línea:</span>
                    <div className="font-medium text-foreground">
                      {selectedLine.name} ({selectedLine.code})
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Unidad:</span>
                    <div className="font-medium text-foreground">
                      {form.watch('unitLabel') || '(sin especificar)'}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Estado:</span>
                    <div className={`font-medium ${form.watch('active') ? 'text-green-600' : 'text-orange-600'}`}>
                      {form.watch('active') ? 'Activo' : 'Inactivo'}
                    </div>
                  </div>
                </div>
                <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-950/20 rounded text-xs text-blue-700 dark:text-blue-300">
                  <strong>Siguiente paso:</strong> Después de crear el producto, podrá configurar su
                  receta (BOM) y rendimientos de producción para calcular costos.
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
                    Crear Producto
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