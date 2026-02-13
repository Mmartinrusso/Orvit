/**
 * T2 - Advanced Form Template
 * Full-featured form with Enter navigation, real-time validation, unsaved changes indicator
 * Use this for: Complex entity creation/editing, multi-step forms, critical data entry
 */

'use client';

import { useState, useEffect, useRef } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingButtonContent } from '@/components/ui/loading-state';
import { useEnterNavigation } from '@/hooks/use-enter-navigation';
import { Save, Package, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

// Schema de validación
const formSchema = z.object({
  nombre: z.string().min(3, 'Mínimo 3 caracteres').max(100, 'Máximo 100 caracteres'),
  codigo: z.string()
    .min(3, 'Mínimo 3 caracteres')
    .regex(/^[A-Z0-9-]+$/, 'Solo letras mayúsculas, números y guiones'),
  categoria: z.string().min(1, 'Selecciona una categoría'),
  precio: z.number().min(0.01, 'El precio debe ser mayor a 0'),
  costo: z.number().min(0, 'El costo no puede ser negativo'),
  stock: z.number().int().min(0, 'El stock no puede ser negativo'),
  stockMinimo: z.number().int().min(0, 'El stock mínimo no puede ser negativo'),
  descripcion: z.string().max(500, 'Máximo 500 caracteres').optional(),
  isActive: z.boolean().default(true),
}).refine(data => data.precio > data.costo, {
  message: 'El precio debe ser mayor al costo',
  path: ['precio'],
});

type FormData = z.infer<typeof formSchema>;

interface T2FormAdvancedProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Partial<FormData>;
  onSuccess?: () => void;
}

const CATEGORIAS = [
  { value: 'herramientas', label: 'Herramientas' },
  { value: 'tornilleria', label: 'Tornillería' },
  { value: 'consumibles', label: 'Consumibles' },
  { value: 'repuestos', label: 'Repuestos' },
];

export function T2FormAdvanced({
  open,
  onOpenChange,
  initialData,
  onSuccess,
}: T2FormAdvancedProps) {
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [validatingCode, setValidatingCode] = useState(false);
  const isEdit = !!initialData;

  // Form setup
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    setValue,
    watch,
    reset,
    trigger,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      isActive: true,
      stock: 0,
      stockMinimo: 0,
    },
  });

  // Watch all fields for changes
  const watchedFields = watch();

  useEffect(() => {
    setHasChanges(isDirty);
  }, [isDirty]);

  // Enter navigation setup (6 fields)
  const { registerField, handleKeyDown, focusFirstField } = useEnterNavigation(6, {
    onLastFieldEnter: () => {
      // When Enter on last field, validate and submit
      handleSubmit(onSubmit)();
    },
    skipFields: new Set([5]), // Skip textarea (index 5)
  });

  // Focus first field when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => focusFirstField(), 100);
    }
  }, [open, focusFirstField]);

  // Real-time validation for codigo (debounced)
  const codigo = watch('codigo');
  useEffect(() => {
    if (!codigo || codigo.length < 3) return;

    const timer = setTimeout(async () => {
      setValidatingCode(true);
      // Simular validación de código único
      await new Promise(resolve => setTimeout(resolve, 500));
      setValidatingCode(false);

      // Si ya existe, mostrar error
      // if (codeExists) {
      //   setError('codigo', { message: 'Este código ya existe' });
      // }
    }, 500);

    return () => clearTimeout(timer);
  }, [codigo]);

  // Calculate margin
  const precio = watch('precio');
  const costo = watch('costo');
  const margen = precio && costo ? ((precio - costo) / precio * 100) : 0;

  const onSubmit = async (data: FormData) => {
    try {
      setSaving(true);

      // Simular API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.log('Form data:', data);

      toast({
        title: isEdit ? 'Producto actualizado' : 'Producto creado',
        description: 'Los cambios se guardaron correctamente',
      });

      reset();
      setHasChanges(false);
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
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0">
        {/* Header fijo */}
        <div className="px-6 py-4 border-b bg-background shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-primary/10">
              <Package className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">
                {isEdit ? 'Editar Producto' : 'Nuevo Producto'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isEdit
                  ? 'Modifica los datos del producto'
                  : 'Completa la información del producto. Usa Enter para avanzar entre campos.'}
              </p>
            </div>
          </div>
        </div>

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <form id="product-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Información básica */}
            <div>
              <h3 className="text-sm font-medium mb-3">Información Básica</h3>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">
                    Nombre del Producto <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    {...register('nombre')}
                    ref={registerField(0)}
                    onKeyDown={(e) => handleKeyDown(e, 0)}
                    placeholder="Ej: Tornillo hexagonal M8 x 30mm"
                    className={errors.nombre ? 'border-red-500' : ''}
                  />
                  {errors.nombre && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.nombre.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">
                      Código <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        {...register('codigo')}
                        ref={registerField(1)}
                        onKeyDown={(e) => handleKeyDown(e, 1)}
                        placeholder="PRD-001"
                        className={errors.codigo ? 'border-red-500' : ''}
                      />
                      {validatingCode && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    {errors.codigo && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.codigo.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label className="text-xs">
                      Categoría <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={watchedFields.categoria}
                      onValueChange={(value) => {
                        setValue('categoria', value, { shouldDirty: true });
                        trigger('categoria');
                      }}
                    >
                      <SelectTrigger className={errors.categoria ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIAS.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.categoria && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.categoria.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Precios */}
            <div>
              <h3 className="text-sm font-medium mb-3">Precios y Márgenes</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">
                    Costo <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    {...register('costo', { valueAsNumber: true })}
                    ref={registerField(2)}
                    onKeyDown={(e) => handleKeyDown(e, 2)}
                    placeholder="0.00"
                    className={errors.costo ? 'border-red-500' : ''}
                  />
                  {errors.costo && (
                    <p className="text-xs text-red-500 mt-1">{errors.costo.message}</p>
                  )}
                </div>

                <div>
                  <Label className="text-xs">
                    Precio de Venta <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    {...register('precio', { valueAsNumber: true })}
                    ref={registerField(3)}
                    onKeyDown={(e) => handleKeyDown(e, 3)}
                    placeholder="0.00"
                    className={errors.precio ? 'border-red-500' : ''}
                  />
                  {errors.precio && (
                    <p className="text-xs text-red-500 mt-1">{errors.precio.message}</p>
                  )}
                </div>
              </div>

              {/* Margen calculado */}
              {precio > 0 && costo > 0 && (
                <Alert className="mt-3">
                  <AlertDescription className="text-xs">
                    <span className="font-medium">Margen de ganancia:</span>{' '}
                    <span className={margen > 20 ? 'text-green-600 font-semibold' : 'text-amber-600 font-semibold'}>
                      {margen.toFixed(1)}%
                    </span>
                    {margen < 10 && (
                      <span className="text-amber-600 ml-2">(Margen bajo)</span>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <Separator />

            {/* Stock */}
            <div>
              <h3 className="text-sm font-medium mb-3">Control de Stock</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Stock Actual</Label>
                  <Input
                    type="number"
                    {...register('stock', { valueAsNumber: true })}
                    ref={registerField(4)}
                    onKeyDown={(e) => handleKeyDown(e, 4)}
                    placeholder="0"
                    className={errors.stock ? 'border-red-500' : ''}
                  />
                  {errors.stock && (
                    <p className="text-xs text-red-500 mt-1">{errors.stock.message}</p>
                  )}
                </div>

                <div>
                  <Label className="text-xs">Stock Mínimo</Label>
                  <Input
                    type="number"
                    {...register('stockMinimo', { valueAsNumber: true })}
                    placeholder="0"
                    className={errors.stockMinimo ? 'border-red-500' : ''}
                  />
                  {errors.stockMinimo && (
                    <p className="text-xs text-red-500 mt-1">{errors.stockMinimo.message}</p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Descripción */}
            <div>
              <Label className="text-xs">Descripción</Label>
              <Textarea
                {...register('descripcion')}
                rows={3}
                placeholder="Descripción detallada del producto..."
                className="resize-none"
              />
              {errors.descripcion && (
                <p className="text-xs text-red-500 mt-1">{errors.descripcion.message}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {watchedFields.descripcion?.length || 0}/500 caracteres
              </p>
            </div>

            {/* Estado */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div>
                <Label className="text-xs font-medium">Producto Activo</Label>
                <p className="text-xs text-muted-foreground">
                  Los productos inactivos no se muestran en el sistema
                </p>
              </div>
              <Switch
                checked={watchedFields.isActive}
                onCheckedChange={(checked) => setValue('isActive', checked, { shouldDirty: true })}
              />
            </div>
          </form>
        </div>

        {/* Footer fijo */}
        <div className="px-6 py-3 border-t bg-muted/30 shrink-0">
          <div className="flex items-center justify-between">
            {hasChanges ? (
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-xs text-amber-600 font-medium">Cambios sin guardar</span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">Sin cambios</span>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (hasChanges) {
                    const confirmed = confirm('¿Descartar cambios sin guardar?');
                    if (!confirmed) return;
                  }
                  onOpenChange(false);
                }}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                form="product-form"
                disabled={saving || !hasChanges}
              >
                <LoadingButtonContent
                  isLoading={saving}
                  loadingText="Guardando..."
                  icon={<Save className="h-3.5 w-3.5" />}
                >
                  {isEdit ? 'Actualizar' : 'Crear Producto'}
                </LoadingButtonContent>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
