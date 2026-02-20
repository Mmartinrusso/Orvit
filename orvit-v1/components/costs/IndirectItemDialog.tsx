'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
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
import { Plus, Tag, Loader2 } from 'lucide-react';

// Schema local para el formulario
const CreateIndirectItemSchema = z.object({
  code: z.string().min(1, 'Código requerido').max(50, 'Código muy largo'),
  label: z.string().min(1, 'Etiqueta requerida').max(100, 'Etiqueta muy larga'),
  category: z.enum(['IMP_SERV', 'SOCIAL', 'VEHICLES', 'MKT', 'UTILITIES', 'OTHER']),
  currentPrice: z.number().optional().nullable(),
});

type CreateIndirectItemInput = z.infer<typeof CreateIndirectItemSchema>;

interface IndirectItemDialogProps {
  children?: React.ReactNode;
  onItemCreated?: () => void;
}

const categoryLabels = {
  IMP_SERV: 'Impuestos y Servicios',
  SOCIAL: 'Cargas Sociales',
  VEHICLES: 'Vehículos',
  MKT: 'Marketing',
  UTILITIES: 'Servicios Básicos',
  OTHER: 'Otros',
};

const categoryColors = {
  IMP_SERV: 'bg-info-muted text-info-muted-foreground border-info-muted',
  SOCIAL: 'bg-success-muted text-success border-success-muted',
  VEHICLES: 'bg-warning-muted text-warning-muted-foreground border-warning-muted',
  MKT: 'bg-info-muted text-info-muted-foreground border-info-muted',
  UTILITIES: 'bg-info-muted text-info-muted-foreground border-info-muted',
  OTHER: 'bg-muted text-foreground border-border',
};

export function IndirectItemDialog({ children, onItemCreated }: IndirectItemDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { currentCompany } = useCompany();

  const form = useForm<CreateIndirectItemInput>({
    resolver: zodResolver(CreateIndirectItemSchema),
    defaultValues: {
      code: '',
      label: '',
      category: 'OTHER',
      currentPrice: undefined,
    },
  });

  const onSubmit = async (data: CreateIndirectItemInput) => {
    try {
      setIsLoading(true);

      if (!currentCompany) {
        toast.error('No hay empresa seleccionada');
        return;
      }
      
      const response = await fetch('/api/indirect-items', {
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
        const newItem = await response.json();
        toast.success('Ítem indirecto registrado exitosamente');
        setOpen(false);
        form.reset();
        onItemCreated?.();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al registrar ítem indirecto');
      }
    } catch (error) {
      console.error('Error creating indirect item:', error);
      toast.error('Error al registrar ítem indirecto');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Ítem Indirecto
          </Button>
        )}
      </DialogTrigger>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Tag className="h-5 w-5" />
            Registrar Ítem Indirecto
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Defina un concepto de costo indirecto para facilitar la organización del historial mensual.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
            <DialogBody>
            <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Código</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ej: ALQ01, ELEC, MAN01" 
                        className="bg-background border-input" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription className="text-muted-foreground">
                      Código único identificador
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Categoría</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-background border-input">
                          <SelectValue placeholder="Seleccionar categoría" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(categoryLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant="outline" 
                                className={cn('text-xs', categoryColors[value as keyof typeof categoryColors])}
                              >
                                {label}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Descripción</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ej: Alquiler Planta Principal, Energía Eléctrica, Mantenimiento Equipos" 
                      className="bg-background border-input" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription className="text-muted-foreground">
                    Descripción clara del concepto de costo
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
                  <FormLabel className="text-foreground">Precio Inicial (Opcional)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number"
                      step="0.01"
                      placeholder="Ej: 15000.50" 
                      className="bg-background border-input" 
                      value={field.value || ''}
                      onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                    />
                  </FormControl>
                  <FormDescription className="text-muted-foreground">
                    Precio actual del servicio. Se guardará en el historial de precios.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Preview */}
            {form.watch('code') && form.watch('label') && (
              <div className="p-4 bg-muted/10 rounded-lg border border-border/30">
                <h4 className="font-medium text-foreground mb-2">Vista Previa</h4>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(categoryColors[form.watch('category') as keyof typeof categoryColors])}
                  >
                    {categoryLabels[form.watch('category') as keyof typeof categoryLabels]}
                  </Badge>
                  <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
                    {form.watch('code')}
                  </span>
                  <span className="text-sm text-muted-foreground">-</span>
                  <span className="text-sm">{form.watch('label')}</span>
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
                    Registrar Ítem
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
