'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Package, Plus, Factory } from 'lucide-react';
import { Product, Category, UNITS } from '@/lib/types/sales';
import { CategoryDialog } from './category-dialog';
import { ProductFileUpload } from './product-file-upload';

interface WorkCenter {
  id: number;
  name: string;
  code: string;
}

interface ProductionSector {
  id: number;
  name: string;
}

const productSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  code: z.string().min(1, 'El código es requerido'),
  description: z.string().optional().or(z.literal('')),
  categoryId: z.number().min(1, 'Selecciona una categoría'),
  unit: z.enum(UNITS, { required_error: 'Selecciona una unidad' }),
  costPrice: z.coerce.number().min(0, 'El precio debe ser mayor o igual a 0'),
  minStock: z.number().min(0, 'El stock mínimo debe ser mayor a 0'),
  currentStock: z.number().min(0, 'El stock actual debe ser mayor a 0'),
  volume: z.number().min(0, 'El volumen debe ser mayor a 0'),
  weight: z.number().min(0, 'El peso debe ser mayor a 0'),
  location: z.string().min(1, 'La ubicación es requerida'),
  blocksPerM2: z.number().min(0, 'La cantidad debe ser mayor a 0').optional(),
  isActive: z.boolean(),
  aplicaComision: z.boolean(),
  productionWorkCenterId: z.number().nullable().optional(),
  productionSectorId: z.number().nullable().optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductFormProps {
  product?: Product;
  isEditing?: boolean;
}

export function ProductForm({ product, isEditing = false }: ProductFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([]);
  const [productionSectors, setProductionSectors] = useState<ProductionSector[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingWorkCenters, setLoadingWorkCenters] = useState(true);
  const [loadingSectors, setLoadingSectors] = useState(true);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [productFiles, setProductFiles] = useState<any[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name || '',
      code: product?.code || '',
      description: product?.description || '',
      categoryId: product?.categoryId || 0,
      unit: product?.unit || 'unidad',
      costPrice: product?.costPrice || 0,
      minStock: product?.minStock || 0,
      currentStock: product?.currentStock || 0,
      volume: product?.volume || 0,
      weight: product?.weight || 0,
      location: product?.location || '',
      blocksPerM2: product?.blocksPerM2 || undefined,
      isActive: product?.isActive ?? true,
      aplicaComision: (product as any)?.aplicaComision ?? true,
      productionWorkCenterId: (product as any)?.productionWorkCenterId || null,
      productionSectorId: (product as any)?.productionSectorId || null,
    }
  });

  const watchedCategoryId = watch('categoryId');
  const watchedActive = watch('isActive');
  const watchedAplicaComision = watch('aplicaComision');
  const watchedWorkCenterId = watch('productionWorkCenterId');
  const watchedSectorId = watch('productionSectorId');

  useEffect(() => {
    loadCategories();
    loadWorkCenters();
    loadProductionSectors();
  }, []);

  const loadCategories = async () => {
    setLoadingCategories(true);
    try {
      const response = await fetch('/api/categories');
      if (response.ok) {
        const categoriesData = await response.json();
        setCategories(categoriesData);
      } else {
        throw new Error('Error al cargar categorías');
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      toast.error('Error al cargar categorías');
    } finally {
      setLoadingCategories(false);
    }
  };

  const loadWorkCenters = async () => {
    setLoadingWorkCenters(true);
    try {
      const response = await fetch('/api/production/work-centers?status=ACTIVE');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setWorkCenters(data.workCenters || []);
        }
      }
    } catch (error) {
      console.error('Error loading work centers:', error);
    } finally {
      setLoadingWorkCenters(false);
    }
  };

  const loadProductionSectors = async () => {
    setLoadingSectors(true);
    try {
      const response = await fetch('/api/production/sectors?enabledForProduction=true');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setProductionSectors(data.sectors || []);
        }
      }
    } catch (error) {
      console.error('Error loading production sectors:', error);
    } finally {
      setLoadingSectors(false);
    }
  };

  const getSelectedCategoryName = () => {
    const category = categories.find(cat => cat.id === watchedCategoryId);
    return category?.name.toLowerCase();
  };

  const onSubmit = async (data: ProductFormData) => {
    setIsLoading(true);
    try {
      const url = isEditing && product ? `/api/products/${product.id}` : '/api/products';
      const method = isEditing ? 'PUT' : 'POST';

      const productData = {
        ...data,
        // Solo incluir blocksPerM2 si la categoría contiene la palabra 'bloque'
        blocksPerM2: getSelectedCategoryName()?.includes('bloque') ? data.blocksPerM2 : undefined,
        // Asegurar que location siempre sea un string
        location: (data.location || '').trim(),
        // Planta de producción
        productionWorkCenterId: data.productionWorkCenterId || null,
        // Sector de producción
        productionSectorId: data.productionSectorId || null,
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(productData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al guardar producto');
      }

      toast.success(
        isEditing 
          ? 'Producto actualizado correctamente'
          : 'Producto creado correctamente'
      );

      router.push('/administracion/ventas/productos');
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error(error instanceof Error ? error.message : 'Error al guardar producto');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCategoryCreated = (newCategory: Category) => {
    setCategories(prev => [...prev, newCategory]);
    setValue('categoryId', newCategory.id);
    toast.success('Categoría creada y seleccionada');
  };

  const preventLeadingZero = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.startsWith('0') && value.length > 1 && value[1] !== '.') {
      e.target.value = value.substring(1);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.back()}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <Package className="w-6 h-6" />
          <h1 className="text-2xl font-bold">
            {isEditing ? 'Editar Producto' : 'Nuevo Producto'}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Información Básica */}
        <Card>
          <CardHeader>
            <CardTitle>Información Básica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nombre del Producto *</Label>
                <Input
                  id="name"
                  {...register('name')}
                  placeholder="Ej: Bloque Hormigón 20x20x40"
                  className={errors.name ? 'border-destructive' : ''}
                />
                {errors.name && (
                  <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="code">Código interno / SKU *</Label>
                <Input
                  id="code"
                  {...register('code')}
                  placeholder="Ej: BLQ-001"
                  className={errors.code ? 'border-destructive' : ''}
                />
                {errors.code && (
                  <p className="text-sm text-destructive mt-1">{errors.code.message}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="description">Descripción Técnica</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Descripción detallada del producto..."
                rows={3}
                className={errors.description ? 'border-destructive' : ''}
              />
              {errors.description && (
                <p className="text-sm text-destructive mt-1">{errors.description.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Categoría *</Label>
                <div className="flex gap-2">
                  <Select 
                    value={watchedCategoryId ? watchedCategoryId.toString() : ''} 
                    onValueChange={(value) => setValue('categoryId', parseInt(value))}
                    disabled={loadingCategories}
                  >
                    <SelectTrigger className={errors.categoryId ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Selecciona una categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowCategoryDialog(true)}
                    disabled={loadingCategories}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {errors.categoryId && (
                  <p className="text-sm text-destructive mt-1">{errors.categoryId.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="unit">Unidad *</Label>
                <Select 
                  value={watch('unit')} 
                  onValueChange={(value) => setValue('unit', value as any)}
                >
                  <SelectTrigger className={errors.unit ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Selecciona una unidad" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.unit && (
                  <p className="text-sm text-destructive mt-1">{errors.unit.message}</p>
                )}
              </div>
            </div>

            {/* Campo condicional para bloques */}
            {getSelectedCategoryName()?.includes('bloque') && (
              <div>
                <Label htmlFor="blocksPerM2">Cantidad por m² *</Label>
                <Input
                  id="blocksPerM2"
                  type="number"
                  step="0.1"
                  {...register('blocksPerM2', { 
                    valueAsNumber: true,
                    onChange: preventLeadingZero
                  })}
                  placeholder="Ej: 25"
                  className={errors.blocksPerM2 ? 'border-destructive' : ''}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Especifica cuántos bloques entran por metro cuadrado
                </p>
                {errors.blocksPerM2 && (
                  <p className="text-sm text-destructive mt-1">{errors.blocksPerM2.message}</p>
                )}
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Switch
                id="active"
                checked={watchedActive}
                onCheckedChange={(checked) => setValue('isActive', checked)}
              />
              <Label htmlFor="active">Producto activo</Label>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div>
                <p className="text-sm font-medium">Aplica comisión al vendedor</p>
                <p className="text-xs text-muted-foreground">
                  Si está desactivado, este producto no cuenta para el cálculo de comisiones
                </p>
              </div>
              <Switch
                id="aplicaComision"
                checked={watchedAplicaComision}
                onCheckedChange={(checked) => setValue('aplicaComision', checked)}
              />
            </div>

            <Separator className="my-4" />

            {/* Planta de producción */}
            <div>
              <Label htmlFor="productionWorkCenterId" className="flex items-center gap-2">
                <Factory className="w-4 h-4" />
                Planta de Producción
              </Label>
              <Select
                value={watchedWorkCenterId ? watchedWorkCenterId.toString() : '_none'}
                onValueChange={(value) => setValue('productionWorkCenterId', value === '_none' ? null : parseInt(value))}
                disabled={loadingWorkCenters}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecciona dónde se produce este producto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sin asignar</SelectItem>
                  {workCenters.map((wc) => (
                    <SelectItem key={wc.id} value={wc.id.toString()}>
                      {wc.name} ({wc.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-1">
                Si este producto se fabrica en planta, selecciona la planta/centro de trabajo
              </p>
            </div>

            {/* Sector de producción */}
            <div>
              <Label htmlFor="productionSectorId" className="flex items-center gap-2">
                <Factory className="w-4 h-4" />
                Sector de Producción
              </Label>
              <Select
                value={watchedSectorId ? watchedSectorId.toString() : '_none'}
                onValueChange={(value) => setValue('productionSectorId', value === '_none' ? null : parseInt(value))}
                disabled={loadingSectors}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecciona el sector de producción" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sin asignar</SelectItem>
                  {productionSectors.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-1">
                Sector donde se produce este producto (aparecerá en Producción del Día)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Precios y Stock */}
        <Card>
          <CardHeader>
            <CardTitle>Precios y Stock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="costPrice">Precio de Costo *</Label>
              <Input
                id="costPrice"
                type="number"
                step="0.01"
                {...register('costPrice', { 
                  setValueAs: (value) => {
                    if (value === '' || value === null || value === undefined) {
                      return 0;
                    }
                    const numValue = parseFloat(value);
                    return isNaN(numValue) ? 0 : numValue;
                  }
                })}
                placeholder="0.00"
                className={errors.costPrice ? 'border-destructive' : ''}
              />
              {errors.costPrice && (
                <p className="text-sm text-destructive mt-1">{errors.costPrice.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="minStock">Stock Mínimo *</Label>
                <Input
                  id="minStock"
                  type="number"
                  {...register('minStock', { 
                    valueAsNumber: true,
                    onChange: preventLeadingZero
                  })}
                  placeholder="0"
                  className={errors.minStock ? 'border-destructive' : ''}
                />
                {errors.minStock && (
                  <p className="text-sm text-destructive mt-1">{errors.minStock.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="currentStock">Stock Actual *</Label>
                <Input
                  id="currentStock"
                  type="number"
                  {...register('currentStock', { 
                    valueAsNumber: true,
                    onChange: preventLeadingZero
                  })}
                  placeholder="0"
                  className={errors.currentStock ? 'border-destructive' : ''}
                />
                {errors.currentStock && (
                  <p className="text-sm text-destructive mt-1">{errors.currentStock.message}</p>
                )}
              </div>
            </div>

            <Separator />

            <div>
              <Label htmlFor="location">Ubicación en almacén *</Label>
              <Input
                id="location"
                {...register('location')}
                placeholder="Ej: Depósito A-1, Patio B"
                className={errors.location ? 'border-destructive' : ''}
              />
              {errors.location && (
                <p className="text-sm text-destructive mt-1">{errors.location.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Especificaciones Técnicas */}
        <Card>
          <CardHeader>
            <CardTitle>Especificaciones Técnicas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="weight">Peso por unidad (kg) *</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.01"
                  {...register('weight', { 
                    valueAsNumber: true,
                    onChange: preventLeadingZero
                  })}
                  placeholder="0.00"
                  className={errors.weight ? 'border-destructive' : ''}
                />
                {errors.weight && (
                  <p className="text-sm text-destructive mt-1">{errors.weight.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="volume">Volumen por unidad (m³) *</Label>
                <Input
                  id="volume"
                  type="number"
                  step="0.001"
                  {...register('volume', { 
                    valueAsNumber: true,
                    onChange: preventLeadingZero
                  })}
                  placeholder="0.000"
                  className={errors.volume ? 'border-destructive' : ''}
                />
                {errors.volume && (
                  <p className="text-sm text-destructive mt-1">{errors.volume.message}</p>
                )}
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Estas especificaciones son importantes para el cálculo de transporte y almacenamiento.
            </p>
          </CardContent>
        </Card>

        {/* Archivos del Producto */}
        <Card>
          <CardHeader>
            <CardTitle>Archivos del Producto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-success-muted border border-success-muted rounded-lg p-2 text-xs text-success mb-4">
              Debug: Sección de archivos renderizada - productId: {product?.id || 'temp'}, companyId: {product?.companyId || 1}
            </div>
            <ProductFileUpload
              productId={product?.id || 'temp'}
              companyId={product?.companyId || 1}
              onFilesChange={setProductFiles}
              initialFiles={productFiles}
            />
          </CardContent>
        </Card>

        {/* Botones de acción */}
        <div className="flex flex-col sm:flex-row gap-4 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button 
            type="submit" 
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEditing ? 'Actualizar Producto' : 'Crear Producto'}
          </Button>
        </div>
      </form>

      {/* Dialog para crear categorías */}
      <CategoryDialog
        isOpen={showCategoryDialog}
        onClose={() => setShowCategoryDialog(false)}
        onCategoryCreated={handleCategoryCreated}
      />
    </div>
  );
} 