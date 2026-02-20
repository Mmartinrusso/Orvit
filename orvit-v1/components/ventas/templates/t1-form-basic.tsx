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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
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
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Nuevo Producto
          </DialogTitle>
          <DialogDescription>Completa los datos básicos</DialogDescription>
        </DialogHeader>

        {/* Form */}
        <form id="t1-form" onSubmit={handleSubmit(onSubmit)}>
        <DialogBody className="space-y-4">
          <div>
            <Label className="text-xs">
              Nombre <span className="text-destructive">*</span>
            </Label>
            <Input
              {...register('nombre')}
              placeholder="Ej: Tornillo M8"
              className={errors.nombre ? 'border-destructive' : ''}
            />
            {errors.nombre && (
              <p className="text-xs text-destructive mt-1">{errors.nombre.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">
                Código <span className="text-destructive">*</span>
              </Label>
              <Input
                {...register('codigo')}
                placeholder="PRD-001"
                className={errors.codigo ? 'border-destructive' : ''}
              />
              {errors.codigo && (
                <p className="text-xs text-destructive mt-1">{errors.codigo.message}</p>
              )}
            </div>

            <div>
              <Label className="text-xs">
                Precio <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                step="0.01"
                {...register('precio', { valueAsNumber: true })}
                placeholder="0.00"
                className={errors.precio ? 'border-destructive' : ''}
              />
              {errors.precio && (
                <p className="text-xs text-destructive mt-1">{errors.precio.message}</p>
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

        </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" form="t1-form" disabled={saving}>
              <LoadingButtonContent
                isLoading={saving}
                icon={<Save className="h-3.5 w-3.5" />}
              >
                Guardar
              </LoadingButtonContent>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
