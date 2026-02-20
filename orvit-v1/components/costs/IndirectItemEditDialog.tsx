'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { useConfirm } from '@/components/ui/confirm-dialog-provider';
import { 
  Edit, 
  Tag, 
  Loader2,
  DollarSign
} from 'lucide-react';

// Schema para editar item
const EditIndirectItemSchema = z.object({
  code: z.string().min(1, 'Código requerido').max(50, 'Código muy largo'),
  label: z.string().min(1, 'Etiqueta requerida').max(100, 'Etiqueta muy larga'),
  category: z.enum(['IMP_SERV', 'SOCIAL', 'VEHICLES', 'MKT', 'UTILITIES', 'OTHER']),
  currentPrice: z.coerce.number().positive('El precio debe ser mayor a 0').optional().nullable(),
});

type EditIndirectItemInput = z.infer<typeof EditIndirectItemSchema>;

interface IndirectItem {
  id: string;
  code: string;
  label: string;
  category: string;
  currentPrice?: number;
}

interface IndirectItemEditDialogProps {
  children?: React.ReactNode;
  indirectItem: IndirectItem;
  onItemUpdated?: () => void;
}

const categoryLabels: Record<string, string> = {
  IMP_SERV: 'Impuestos y Servicios',
  SOCIAL: 'Cargas Sociales',
  VEHICLES: 'Vehículos',
  MKT: 'Marketing',
  UTILITIES: 'Servicios Básicos',
  OTHER: 'Otros',
};

const categoryColors: Record<string, string> = {
  IMP_SERV: 'bg-info-muted text-info-muted-foreground border-info-muted',
  SOCIAL: 'bg-success-muted text-success border-success-muted',
  VEHICLES: 'bg-warning-muted text-warning-muted-foreground border-warning-muted',
  MKT: 'bg-info-muted text-info-muted-foreground border-info-muted',
  UTILITIES: 'bg-info-muted text-info-muted-foreground border-info-muted',
  OTHER: 'bg-muted text-foreground border-border',
};

export function IndirectItemEditDialog({
  children,
  indirectItem,
  onItemUpdated
}: IndirectItemEditDialogProps) {
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<EditIndirectItemInput>({
    resolver: zodResolver(EditIndirectItemSchema),
    defaultValues: {
      code: indirectItem.code,
      label: indirectItem.label,
      category: indirectItem.category as any,
      currentPrice: indirectItem.currentPrice ? Number(indirectItem.currentPrice) : undefined,
    },
  });

  // Actualizar formulario cuando cambia el item
  useEffect(() => {
    if (indirectItem && open) {
      form.reset({
        code: indirectItem.code,
        label: indirectItem.label,
        category: indirectItem.category as any,
        currentPrice: indirectItem.currentPrice ? Number(indirectItem.currentPrice) : undefined,
      });
    }
  }, [indirectItem, open, form]);

  const onSubmit = async (data: EditIndirectItemInput) => {
    try {
      setIsLoading(true);

      const response = await fetch(`/api/indirect-items/${indirectItem.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success('Ítem indirecto actualizado exitosamente');
        
        if (result.priceHistoryCreated) {
          toast.info('Se creó un nuevo registro en el historial de precios');
        }
        
        setOpen(false);
        onItemUpdated?.();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al actualizar ítem indirecto');
      }
    } catch (error) {
      console.error('Error updating indirect item:', error);
      toast.error('Error al actualizar ítem indirecto');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Eliminar ítem indirecto',
      description: '¿Estás seguro de que quieres eliminar este ítem indirecto? Esta acción no se puede deshacer.',
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      setIsLoading(true);

      const response = await fetch(`/api/indirect-items/${indirectItem.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Ítem indirecto eliminado exitosamente');
        setOpen(false);
        onItemUpdated?.();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al eliminar ítem indirecto');
      }
    } catch (error) {
      console.error('Error deleting indirect item:', error);
      toast.error('Error al eliminar ítem indirecto');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Edit className="h-5 w-5" />
            Editar Ítem Indirecto
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Modifica los datos del ítem indirecto. Los cambios de precio se registrarán en el historial.
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
                                className={cn('text-xs', categoryColors[value])}
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
                      step="0.01"
                      placeholder="Ej: 15000.50" 
                      className="bg-background border-input" 
                      value={field.value || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || value === null || value === undefined) {
                          field.onChange(undefined);
                        } else {
                          const numValue = parseFloat(value);
                          if (!isNaN(numValue)) {
                            field.onChange(numValue);
                          }
                        }
                      }}
                    />
                  </FormControl>
                  <FormDescription className="text-muted-foreground">
                    Si cambias el precio, se creará una nueva entrada en el historial.
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
                  {form.watch('currentPrice') && (
                    <>
                      <span className="text-sm text-muted-foreground">•</span>
                      <span className="text-sm font-medium text-success">
                        ${new Intl.NumberFormat('es-AR').format(form.watch('currentPrice')!)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
            </div>
            </DialogBody>

            <DialogFooter className="flex justify-between">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isLoading}
                className="mr-auto"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  'Eliminar Ítem'
                )}
              </Button>

              <div className="flex gap-2">
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
                      Actualizando...
                    </>
                  ) : (
                    <>
                      <Edit className="h-4 w-4 mr-2" />
                      Actualizar Ítem
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
