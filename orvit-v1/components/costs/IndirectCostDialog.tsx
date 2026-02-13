'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateMonthlyIndirectSchema, type CreateMonthlyIndirectInput } from '@/lib/validations/costs';
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
import { Plus, Package, Loader2, Zap, Car, TrendingUp, HelpCircle } from 'lucide-react';

interface IndirectCostDialogProps {
  children?: React.ReactNode;
  onIndirectCreated?: () => void;
}

const categoryOptions = [
  { 
    value: 'IMP_SERV', 
    label: 'Impuestos y Servicios',
    icon: Zap,
    description: 'Electricidad, gas, agua, impuestos, etc.'
  },
  { 
    value: 'SOCIAL', 
    label: 'Gastos Sociales',
    icon: Package,
    description: 'Seguros, medicina laboral, capacitaciones, etc.'
  },
  { 
    value: 'VEHICLES', 
    label: 'Vehículos',
    icon: Car,
    description: 'Combustible, mantenimiento, seguros de vehículos'
  },
  { 
    value: 'MKT', 
    label: 'Marketing',
    icon: TrendingUp,
    description: 'Publicidad, promociones, marketing digital'
  },
  { 
    value: 'OTHER', 
    label: 'Otros',
    icon: HelpCircle,
    description: 'Gastos administrativos y otros costos indirectos'
  },
];

export function IndirectCostDialog({ children, onIndirectCreated }: IndirectCostDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<CreateMonthlyIndirectInput>({
    resolver: zodResolver(CreateMonthlyIndirectSchema),
    defaultValues: {
      category: 'IMP_SERV',
      label: '',
      amount: 0,
      month: new Date().toISOString().slice(0, 7), // Current YYYY-MM
    },
  });

  const onSubmit = async (data: CreateMonthlyIndirectInput) => {
    try {
      setIsLoading(true);
      
      const response = await fetch('/api/costs/indirects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const newIndirect = await response.json();
        toast.success('Costo indirecto registrado exitosamente');
        setOpen(false);
        form.reset({
          category: 'IMP_SERV',
          label: '',
          amount: 0,
          month: new Date().toISOString().slice(0, 7),
        });
        onIndirectCreated?.();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al registrar costo indirecto');
      }
    } catch (error) {
      console.error('Error creating indirect cost:', error);
      toast.error('Error al registrar costo indirecto');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const selectedCategory = categoryOptions.find(cat => cat.value === form.watch('category'));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Indirecto
          </Button>
        )}
      </DialogTrigger>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Package className="h-5 w-5" />
            Registrar Costo Indirecto
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Registre un costo indirecto mensual que se distribuirá entre las líneas de producción
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
            <DialogBody>
            <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel className="text-foreground">Categoría</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="bg-background border-input">
                          <SelectValue placeholder="Seleccionar categoría" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categoryOptions.map((option) => {
                          const IconComponent = option.icon;
                          return (
                            <SelectItem key={option.value} value={option.value}>
                              <div className="flex items-center gap-2">
                                <IconComponent className="h-4 w-4" />
                                <div>
                                  <div>{option.label}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {option.description}
                                  </div>
                                </div>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel className="text-foreground">Descripción del Costo</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ej: Factura de electricidad, Seguro de vehículos, etc." 
                        className="bg-background border-input" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription className="text-muted-foreground">
                      Descripción específica del gasto o concepto
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Monto Mensual</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        className="bg-background border-input" 
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription className="text-muted-foreground">
                      Importe del costo para el mes
                    </FormDescription>
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
                      Mes al que corresponde el costo
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Cost Summary */}
            {selectedCategory && form.watch('amount') > 0 && (
              <div className="p-4 bg-muted/10 rounded-lg border border-border/30">
                <h4 className="font-medium text-foreground mb-2">Resumen del Costo</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Categoría:</span>
                    <div className="flex items-center gap-2 font-medium text-foreground">
                      <selectedCategory.icon className="h-4 w-4" />
                      {selectedCategory.label}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Monto:</span>
                    <div className="font-bold text-primary text-lg">
                      {formatCurrency(form.watch('amount'))}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Mes:</span>
                    <div className="font-medium text-foreground">
                      {new Date(form.watch('month') + '-01').toLocaleDateString('es-AR', {
                        year: 'numeric',
                        month: 'long'
                      })}
                    </div>
                  </div>
                </div>
                <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-950/20 rounded text-xs text-blue-700 dark:text-blue-300">
                  <strong>Nota:</strong> Este costo se distribuirá proporcionalmente entre las líneas de producción 
                  según la configuración de porcentajes globales.
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
                    Registrar Costo
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
