'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Package, Plus } from 'lucide-react';
import { Product, Category, UNITS } from '@/lib/types/sales';

const quickProductSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  code: z.string().min(1, 'El código es requerido'),
  description: z.string().min(1, 'La descripción es requerida'),
  categoryId: z.number().min(1, 'Selecciona una categoría'),
  unit: z.enum(UNITS, { required_error: 'Selecciona una unidad' }),
  costPrice: z.number().min(0, 'El precio debe ser mayor a 0'),
  currentStock: z.number().min(0, 'El stock debe ser mayor a 0'),
  location: z.string().min(1, 'La ubicación es requerida')
});

type QuickProductFormData = z.infer<typeof quickProductSchema>;

interface ProductQuickModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProductCreated?: (product: Product) => void;
}

export function ProductQuickModal({ 
  open, 
  onOpenChange, 
  onProductCreated 
}: ProductQuickModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors }
  } = useForm<QuickProductFormData>({
    resolver: zodResolver(quickProductSchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
      categoryId: 1,
      unit: 'unidad',
      costPrice: 0,
      currentStock: 0,
      location: ''
    }
  });

  const onSubmit = async (data: QuickProductFormData) => {
    setIsLoading(true);
    try {
      // TODO: Implementar API de productos
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const newProduct: Product = {
        id: Math.random().toString(36).substr(2, 9),
        ...data,
        minStock: Math.max(1, Math.floor(data.currentStock * 0.1)), // 10% del stock actual como mínimo
        volume: 0.01, // Valor por defecto
        weight: 1, // Valor por defecto
        blocksPerM2: data.category === 'bloques' ? 12.5 : undefined,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      if (onProductCreated) {
        onProductCreated(newProduct);
      }
      
      toast.success('Producto creado correctamente');
      handleClose();
    } catch (error) {
      toast.error('Error al crear producto');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  // Generar código automático basado en categoría y nombre
  const generateCode = () => {
    const category = watch('category');
    const name = watch('name');
    
    if (category && name) {
      const categoryCode = category.substring(0, 3).toUpperCase();
      const nameCode = name.substring(0, 3).toUpperCase();
      const randomNum = Math.floor(Math.random() * 999).toString().padStart(3, '0');
      const generatedCode = `${categoryCode}-${nameCode}-${randomNum}`;
      setValue('code', generatedCode);
    }
  };

  const categoryLabels = {
    'bloques': 'Bloques',
    'ladrillos': 'Ladrillos',
    'cementos': 'Cementos',
    'hormigon': 'Hormigón',
    'arena': 'Arena',
    'piedra': 'Piedra',
    'cal': 'Cal',
    'hierro': 'Hierro',
    'ceramicos': 'Cerámicos',
    'herramientas': 'Herramientas',
    'otros': 'Otros'
  };

  const unitLabels = {
    'unidad': 'Unidad',
    'metro': 'Metro',
    'metro2': 'Metro²',
    'metro3': 'Metro³',
    'kilogramo': 'Kilogramo',
    'tonelada': 'Tonelada',
    'litro': 'Litro',
    'bolsa': 'Bolsa',
    'pallet': 'Pallet',
    'caja': 'Caja'
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-6 w-6 text-info-muted-foreground" />
            Agregar Producto Rapido
          </DialogTitle>
          <DialogDescription>
            Agrega un nuevo producto con la informacion esencial
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form id="quick-product-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Información Básica */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Nombre del Producto *</Label>
              <Input
                {...register('name')}
                placeholder="ej. Bloque Hormigón 20x20x40"
                onBlur={generateCode}
              />
              {errors.name && (
                <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="code">Código *</Label>
              <div className="flex gap-2">
                <Input
                  {...register('code')}
                  placeholder="ej. BLO-HOR-001"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generateCode}
                  title="Generar código automático"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {errors.code && (
                <p className="text-sm text-destructive mt-1">{errors.code.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="description">Descripción *</Label>
            <Textarea
              {...register('description')}
              placeholder="Descripción del producto..."
              className="min-h-[80px]"
            />
            {errors.description && (
              <p className="text-sm text-destructive mt-1">{errors.description.message}</p>
            )}
          </div>

          {/* Categoría y Unidad */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">Categoría *</Label>
              <Select 
                onValueChange={(value) => setValue('category', value as any)}
                defaultValue={watch('category')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona categoría" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-sm text-destructive mt-1">{errors.category.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="unit">Unidad de Medida *</Label>
              <Select 
                onValueChange={(value) => setValue('unit', value as any)}
                defaultValue={watch('unit')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona unidad" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(unitLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.unit && (
                <p className="text-sm text-destructive mt-1">{errors.unit.message}</p>
              )}
            </div>
          </div>

          {/* Precio y Stock */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="costPrice">Precio de Costo *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                {...register('costPrice', { valueAsNumber: true })}
                placeholder="0.00"
              />
              {errors.costPrice && (
                <p className="text-sm text-destructive mt-1">{errors.costPrice.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="currentStock">Stock Inicial *</Label>
              <Input
                type="number"
                min="0"
                {...register('currentStock', { valueAsNumber: true })}
                placeholder="0"
              />
              {errors.currentStock && (
                <p className="text-sm text-destructive mt-1">{errors.currentStock.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="location">Ubicación *</Label>
              <Input
                {...register('location')}
                placeholder="ej. Depósito A-1"
              />
              {errors.location && (
                <p className="text-sm text-destructive mt-1">{errors.location.message}</p>
              )}
            </div>
          </div>

          </form>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button type="submit" form="quick-product-form" disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Crear Producto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 