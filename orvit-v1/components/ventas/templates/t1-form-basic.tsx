/**
 * T1 - Basic Form Template
 * Simple form with standard validation and submit
 * Use this for: Quick create dialogs, simple data entry
 */

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LoadingButtonContent } from '@/components/ui/loading-state';
import { Save, Package } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

// Schema de validación
const formSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  codigo: z.string().min(1, 'El código es requerido'),
  precio: z.number().min(0, 'El precio debe ser mayor a 0'),
  descripcion: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface T1FormBasicProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function T1FormBasic({ open, onOpenChange, onSuccess }: T1FormBasicProps) {
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      setSaving(true);

      // Simular API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('Form data:', data);

      toast({
        title: 'Guardado exitoso',
        description: 'Los datos se guardaron correctamente',
      });

      reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Hubo un error al guardar',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-primary/10">
            <Package className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Nuevo Producto</h2>
            <p className="text-xs text-muted-foreground">Completa los datos básicos</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label className="text-xs">
              Nombre <span className="text-red-500">*</span>
            </Label>
            <Input
              {...register('nombre')}
              placeholder="Ej: Tornillo M8"
              className={errors.nombre ? 'border-red-500' : ''}
            />
            {errors.nombre && (
              <p className="text-xs text-red-500 mt-1">{errors.nombre.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">
                Código <span className="text-red-500">*</span>
              </Label>
              <Input
                {...register('codigo')}
                placeholder="PRD-001"
                className={errors.codigo ? 'border-red-500' : ''}
              />
              {errors.codigo && (
                <p className="text-xs text-red-500 mt-1">{errors.codigo.message}</p>
              )}
            </div>

            <div>
              <Label className="text-xs">
                Precio <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                step="0.01"
                {...register('precio', { valueAsNumber: true })}
                placeholder="0.00"
                className={errors.precio ? 'border-red-500' : ''}
              />
              {errors.precio && (
                <p className="text-xs text-red-500 mt-1">{errors.precio.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label className="text-xs">Descripción</Label>
            <Textarea
              {...register('descripcion')}
              placeholder="Descripción opcional..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              <LoadingButtonContent
                isLoading={saving}
                icon={<Save className="h-3.5 w-3.5" />}
              >
                Guardar
              </LoadingButtonContent>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
