'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCompany } from '@/contexts/CompanyContext';
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Plus, Package, Loader2, History, TrendingUp } from 'lucide-react';

// Schema local para el formulario
const CreateInputSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(100, 'Nombre muy largo'),
  unitLabel: z.string().min(1, 'Unidad requerida').max(20, 'Unidad muy larga'),
  supplier: z.string().max(100, 'Proveedor muy largo').optional(),
  currentPrice: z.number().positive('Precio debe ser positivo'),
});

type CreateInputInput = z.infer<typeof CreateInputSchema>;

interface InputItemDialogProps {
  children?: React.ReactNode;
  onInputCreated?: () => void;
}

export function InputItemDialog({ children, onInputCreated }: InputItemDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { currentCompany } = useCompany();

  const form = useForm<CreateInputInput>({
    resolver: zodResolver(CreateInputSchema),
    defaultValues: {
      name: '',
      unitLabel: '',
      currentPrice: 0,
      supplier: '',
    },
  });

  const onSubmit = async (data: CreateInputInput) => {
    try {
      setIsLoading(true);

      if (!currentCompany) {
        toast.error('No hay empresa seleccionada');
        return;
      }
      
      const response = await fetch('/api/inputs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          companyId: currentCompany.id,
        }),
      });

      if (response.ok) {
        const newInput = await response.json();
        toast.success('Insumo registrado exitosamente');
        setOpen(false);
        form.reset();
        onInputCreated?.();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al registrar insumo');
      }
    } catch (error) {
      console.error('Error creating input item:', error);
      toast.error('Error al registrar insumo');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Common unit suggestions
  const unitSuggestions = [
    'kg', 'g', 'ton', 'l', 'ml', 'm³', 'cm³', 
    'm', 'cm', 'mm', 'm²', 'cm²', 'un', 'pza', 'bolsa', 'caja'
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Insumo
          </Button>
        )}
      </DialogTrigger>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Package className="h-5 w-5" />
            Registrar Nuevo Insumo
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Registre un nuevo insumo centralizado para usar en recetas. Incluye historial automático de precios.
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
                    <FormLabel className="text-foreground">Nombre del Insumo</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ej: Cemento Portland, Arena Fina, Hierro 8mm" 
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
                name="unitLabel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Unidad de Medida</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="kg, l, m³, un, etc." 
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
                      Unidad en la que se compra/mide el insumo
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currentPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Precio Actual</FormLabel>
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
                      Precio por unidad de medida
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="supplier"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel className="text-foreground">Proveedor (Opcional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ej: Distribuidora Los Andes, Ferretería Central" 
                        className="bg-background border-input" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription className="text-muted-foreground">
                      Proveedor principal o referencia de compra
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Price Preview */}
            {form.watch('currentPrice') > 0 && form.watch('unitLabel') && (
              <div className="p-4 bg-muted/10 rounded-lg border border-border/30">
                <h4 className="font-medium text-foreground mb-2">Vista Previa del Precio</h4>
                <div className="text-sm">
                  <span className="text-muted-foreground">Precio unitario:</span>
                  <span className="ml-2 font-bold text-primary text-lg">
                    {formatCurrency(form.watch('currentPrice'))}/{form.watch('unitLabel')}
                  </span>
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
                    Registrar Insumo
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
