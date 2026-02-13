'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Loader2, Package, Plus } from 'lucide-react';
import { Product, Category, UNITS } from '@/lib/types/sales';
import { toast } from 'sonner';
import { useCompany } from '@/contexts/CompanyContext';
import { PhotoUpload } from '@/components/ui/PhotoUpload';

const productSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  code: z.string().min(1, 'El código es requerido'),
  description: z.string().optional().or(z.literal('')),
  categoryId: z.number().min(1, 'Selecciona una categoría'),
  unit: z.string().min(1, 'Selecciona una unidad'),
  costPrice: z.number().min(0, 'El precio debe ser mayor o igual a 0'),
  minStock: z.number().min(0, 'El stock mínimo debe ser mayor o igual a 0'),
  currentStock: z.number().min(0, 'El stock actual debe ser mayor o igual a 0'),
  volume: z.number().min(0, 'El volumen debe ser mayor o igual a 0'),
  volumeUnit: z.enum(['metros_lineales', 'metros_cuadrados']).optional(),
  weight: z.number().min(0, 'El peso debe ser mayor o igual a 0'),
  location: z.string().min(1, 'La ubicación es requerida'),
  blocksPerM2: z.number().min(0, 'La cantidad debe ser mayor a 0').optional(),
  isActive: z.boolean()
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductEditModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onProductUpdated: (product: Product) => void;
}

export function ProductEditModal({ product, isOpen, onClose, onProductUpdated }: ProductEditModalProps) {
  const { currentCompany } = useCompany();
  const [isLoading, setIsLoading] = useState(false);
  const [productImage, setProductImage] = useState<string | undefined>(
    product.images && Array.isArray(product.images) && product.images.length > 0 
      ? product.images[0] 
      : undefined
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [locations, setLocations] = useState<string[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [newLocationName, setNewLocationName] = useState('');
  const [showNewLocationInput, setShowNewLocationInput] = useState(false);

  const loadCategories = async () => {
    setLoadingCategories(true);
    try {
      const response = await fetch('/api/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      toast.error('Error al cargar categorías');
    } finally {
      setLoadingCategories(false);
    }
  };

  const loadLocations = async () => {
    if (!currentCompany?.id) return;
    setLoadingLocations(true);
    try {
      const response = await fetch(`/api/locations?companyId=${currentCompany.id}`);
      if (response.ok) {
        const data = await response.json();
        const sortedLocations = Array.isArray(data) ? data.sort() : [];
        setLocations(sortedLocations);
        return sortedLocations;
      }
      return [];
    } catch (error) {
      console.error('Error loading locations:', error);
      toast.error('Error al cargar ubicaciones');
      return [];
    } finally {
      setLoadingLocations(false);
    }
  };

  const handleAddNewLocation = () => {
    if (newLocationName.trim()) {
      const trimmedLocation = newLocationName.trim();
      if (!locations.includes(trimmedLocation)) {
        setLocations(prev => [...prev, trimmedLocation]);
      }
      setValue('location', trimmedLocation);
      setNewLocationName('');
      setShowNewLocationInput(false);
      toast.success('Ubicación agregada. Se guardará al guardar el producto.');
    }
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors }
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product.name,
      code: product.code,
      description: product.description,
      categoryId: product.categoryId || 0,
      unit: product.unit,
      costPrice: product.costPrice,
      minStock: product.minStock,
      currentStock: product.currentStock,
      volume: product.volume,
      volumeUnit: (product as any).volumeUnit || 'metros_lineales',
      weight: product.weight,
      location: product.location || '',
      blocksPerM2: product.blocksPerM2 || undefined,
      isActive: product.isActive
    }
  });

  // Resetear el formulario cuando se abre el modal o cambia el producto
  useEffect(() => {
    if (isOpen) {
      loadCategories();
      loadLocations().then((loadedLocations) => {
        // Después de cargar las ubicaciones, asegurarse de que la ubicación del producto esté en la lista
        const locationValue = product.location !== undefined && product.location !== null 
          ? String(product.location).trim() 
          : '';
        
        // Preparar la lista final de ubicaciones incluyendo la del producto si no está
        let finalLocations = loadedLocations || [];
        if (locationValue && !finalLocations.includes(locationValue)) {
          finalLocations = [...finalLocations, locationValue].sort();
          // Actualizar el estado de ubicaciones ANTES de resetear el formulario
          setLocations(finalLocations);
        } else {
          setLocations(finalLocations);
        }
        
        // Actualizar la imagen del producto cuando se abre el modal
        const currentImage = product.images && Array.isArray(product.images) && product.images.length > 0 
          ? product.images[0] 
          : undefined;
        setProductImage(currentImage);
        
        // Resetear el formulario con los valores actuales del producto cuando se abre el modal
        // Usar setTimeout para asegurar que el estado de locations se haya actualizado
        setTimeout(() => {
          reset({
            name: product.name,
            code: product.code,
            description: product.description || '',
            categoryId: product.categoryId || 0,
            unit: product.unit,
            costPrice: product.costPrice,
            minStock: product.minStock,
            currentStock: product.currentStock,
            volume: product.volume,
            volumeUnit: (product as any).volumeUnit || 'metros_lineales',
            weight: product.weight,
            location: locationValue,
            blocksPerM2: product.blocksPerM2 || undefined,
            isActive: product.isActive
          });
        }, 0);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, product.id, product.location, reset]);

  const watchedCategoryId = watch('categoryId');
  const watchedActive = watch('isActive');
  const selectedCategory = categories.find(cat => cat.id === watchedCategoryId);

  const onSubmit = async (data: ProductFormData) => {
    setIsLoading(true);
    try {
      const companyId = currentCompany?.id || 1;
      
      const locationValue = (data.location || '').trim();
      
      const requestBody = {
        id: product.id,
        ...data,
        volumeUnit: data.volumeUnit || 'metros_lineales',
        location: locationValue,
        images: productImage ? [productImage] : []
      };
      
      const response = await fetch(`/api/products?companyId=${companyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al actualizar el producto');
      }

      const updatedProductData = await response.json();
      
      // Recargar la lista de ubicaciones para incluir la nueva ubicación si se agregó
      await loadLocations();
      
      // Actualizar la imagen si viene del servidor, o mantener la actual si no viene
      const updatedImage = updatedProductData.images && Array.isArray(updatedProductData.images) && updatedProductData.images.length > 0
        ? updatedProductData.images[0]
        : productImage;
      if (updatedImage !== productImage) {
        setProductImage(updatedImage);
      }
      
      // Usar siempre los datos actualizados que vienen del servidor
      const updatedProduct: Product = {
        ...product,
        ...updatedProductData,
        // Asegurar que la categoría esté incluida
        category: updatedProductData.category || categories.find(cat => cat.id === updatedProductData.categoryId),
        // Asegurar que la ubicación esté incluida - usar el valor del servidor o el procesado
        location: updatedProductData.location !== undefined && updatedProductData.location !== null 
          ? String(updatedProductData.location) 
          : locationValue,
        // Asegurar que las imágenes estén incluidas
        images: updatedProductData.images && Array.isArray(updatedProductData.images) && updatedProductData.images.length > 0
          ? updatedProductData.images
          : (productImage ? [productImage] : [])
      };
      
      // Resetear el formulario con los datos actualizados ANTES de cerrar
      reset({
        name: updatedProduct.name,
        code: updatedProduct.code,
        description: updatedProduct.description || '',
        categoryId: updatedProduct.categoryId || 0,
        unit: updatedProduct.unit,
        costPrice: updatedProduct.costPrice,
        minStock: updatedProduct.minStock,
        currentStock: updatedProduct.currentStock,
        volume: updatedProduct.volume,
        volumeUnit: (updatedProduct as any).volumeUnit || 'metros_lineales',
        weight: updatedProduct.weight,
        location: updatedProduct.location || '',
        blocksPerM2: updatedProduct.blocksPerM2 || undefined,
        isActive: updatedProduct.isActive
      });
      
      // Actualizar el producto en el padre
      onProductUpdated(updatedProduct);
      toast.success('Producto actualizado correctamente');
      
      // Cerrar el modal después de un pequeño delay para asegurar que el estado se actualice
      setTimeout(() => {
        onClose();
      }, 100);
    } catch (error: any) {
      console.error('Error updating product:', error);
      toast.error(error.message || 'Error al actualizar el producto');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Editar Producto
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
          <form id="product-edit-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Información Básica */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Información Básica</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="code">Código *</Label>
                    <Input
                      id="code"
                      {...register('code')}
                      className={errors.code ? 'border-destructive' : ''}
                      disabled={String(product.id).startsWith('costos-')}
                    />
                    {errors.code && (
                      <p className="text-sm text-destructive mt-1">{errors.code.message}</p>
                    )}
                    {String(product.id).startsWith('costos-') && (
                      <p className="text-xs text-muted-foreground mt-1">El código no se puede editar en productos de costos</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="categoryId">Categoría *</Label>
                    <Select
                      value={watchedCategoryId?.toString() || ''}
                      onValueChange={(value) => setValue('categoryId', parseInt(value), { shouldValidate: true })}
                      disabled={loadingCategories || String(product.id).startsWith('costos-')}
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
                    {errors.categoryId && (
                      <p className="text-sm text-destructive mt-1">{errors.categoryId.message}</p>
                    )}
                    {String(product.id).startsWith('costos-') && (
                      <p className="text-xs text-muted-foreground mt-1">La categoría no se puede editar en productos de costos</p>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="name">Nombre *</Label>
                  <Input
                    id="name"
                    {...register('name')}
                    className={errors.name ? 'border-destructive' : ''}
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    {...register('description')}
                    className={errors.description ? 'border-destructive' : ''}
                    rows={3}
                    placeholder="Descripción opcional del producto"
                  />
                  {errors.description && (
                    <p className="text-sm text-destructive mt-1">{errors.description.message}</p>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={watchedActive}
                    onCheckedChange={(checked) => setValue('isActive', checked)}
                  />
                  <Label htmlFor="isActive">Producto activo</Label>
                </div>
              </CardContent>
            </Card>

            {/* Stock y Precio */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Stock y Precio</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="unit">Unidad *</Label>
                    <Select
                      value={watch('unit')}
                      onValueChange={(value) => setValue('unit', value)}
                    >
                      <SelectTrigger className={errors.unit ? 'border-destructive' : ''}>
                        <SelectValue />
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

                  <div>
                    <Label htmlFor="costPrice">Precio de Costo *</Label>
                    <Input
                      id="costPrice"
                      type="number"
                      step="0.01"
                      {...register('costPrice', { valueAsNumber: true })}
                      className={errors.costPrice ? 'border-destructive' : ''}
                    />
                    {errors.costPrice && (
                      <p className="text-sm text-destructive mt-1">{errors.costPrice.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="currentStock">Stock Actual *</Label>
                    <Input
                      id="currentStock"
                      type="number"
                      {...register('currentStock', { valueAsNumber: true })}
                      className={errors.currentStock ? 'border-destructive' : ''}
                    />
                    {errors.currentStock && (
                      <p className="text-sm text-destructive mt-1">{errors.currentStock.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="minStock">Stock Mínimo *</Label>
                    <Input
                      id="minStock"
                      type="number"
                      {...register('minStock', { valueAsNumber: true })}
                      className={errors.minStock ? 'border-destructive' : ''}
                      placeholder="Cantidad mínima de stock"
                    />
                    {errors.minStock && (
                      <p className="text-sm text-destructive mt-1">{errors.minStock.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Se mostrará una alerta cuando el stock esté por debajo de este valor
                    </p>
                  </div>
                </div>

                <Separator />

                <div>
                  <Label htmlFor="location">Ubicación *</Label>
                  <div className="flex gap-2">
                    {!showNewLocationInput ? (
                      <Select
                        value={watch('location') || ''}
                        onValueChange={(value) => {
                          if (value === '__new__') {
                            setShowNewLocationInput(true);
                          } else {
                            setValue('location', value, { shouldValidate: true });
                          }
                        }}
                        key={`location-select-${product.id}-${watch('location')}`}
                      >
                        <SelectTrigger className={errors.location ? 'border-destructive flex-1' : 'flex-1'}>
                          <SelectValue placeholder="Selecciona o crea una ubicación" />
                        </SelectTrigger>
                        <SelectContent>
                          {locations.length > 0 ? (
                            <>
                              {locations.map((loc) => (
                                <SelectItem key={loc} value={loc}>
                                  {loc}
                                </SelectItem>
                              ))}
                              <SelectItem value="__new__">
                                <div className="flex items-center gap-2">
                                  <Plus className="w-4 h-4" />
                                  Crear nueva ubicación
                                </div>
                              </SelectItem>
                            </>
                          ) : (
                            <SelectItem value="__new__" disabled={false}>
                              <div className="flex items-center gap-2">
                                <Plus className="w-4 h-4" />
                                Crear nueva ubicación
                              </div>
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex gap-2 flex-1">
                        <Input
                          placeholder="Nombre de la ubicación"
                          value={newLocationName}
                          onChange={(e) => setNewLocationName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddNewLocation();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAddNewLocation}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowNewLocationInput(false);
                            setNewLocationName('');
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    )}
                  </div>
                  {errors.location && (
                    <p className="text-sm text-destructive mt-1">{errors.location.message}</p>
                  )}
                  {!showNewLocationInput && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Selecciona una ubicación existente o crea una nueva
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Especificaciones Técnicas */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Especificaciones Técnicas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="weight">Peso (kg) *</Label>
                    <Input
                      id="weight"
                      type="number"
                      step="0.01"
                      {...register('weight', { valueAsNumber: true })}
                      className={errors.weight ? 'border-destructive' : ''}
                      placeholder="0.00"
                    />
                    {errors.weight && (
                      <p className="text-sm text-destructive mt-1">{errors.weight.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="volume">Volumen *</Label>
                    <div className="space-y-2">
                      <Input
                        id="volume"
                        type="number"
                        step="0.001"
                        {...register('volume', { valueAsNumber: true })}
                        className={errors.volume ? 'border-destructive' : ''}
                        placeholder="0.000"
                      />
                      <Select
                        value={watch('volumeUnit') || 'metros_lineales'}
                        onValueChange={(value) => setValue('volumeUnit', value as 'metros_lineales' | 'metros_cuadrados')}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="metros_lineales">Metros lineales (ml)</SelectItem>
                          <SelectItem value="metros_cuadrados">Metros cuadrados (m²)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {errors.volume && (
                      <p className="text-sm text-destructive mt-1">{errors.volume.message}</p>
                    )}
                  </div>
                </div>

                {selectedCategory?.name?.toLowerCase().includes('bloque') && (
                  <div>
                    <Label htmlFor="blocksPerM2">Bloques por m²</Label>
                    <Input
                      id="blocksPerM2"
                      type="number"
                      {...register('blocksPerM2', { valueAsNumber: true })}
                      className={errors.blocksPerM2 ? 'border-destructive' : ''}
                      placeholder="Cantidad de bloques que entran en 1 m²"
                    />
                    {errors.blocksPerM2 && (
                      <p className="text-sm text-destructive mt-1">{errors.blocksPerM2.message}</p>
                    )}
                    <p className="text-sm text-muted-foreground mt-1">
                      Este campo es específico para productos de categoría &quot;bloques&quot;
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Foto del Producto */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Foto del Producto</CardTitle>
              </CardHeader>
              <CardContent>
                <PhotoUpload
                  entityType="product"
                  entityId={product.id}
                  currentPhoto={productImage}
                  onPhotoUploaded={(photoUrl) => {
                    setProductImage(photoUrl);
                    toast.success('Foto subida exitosamente');
                  }}
                  onPhotoRemoved={() => {
                    setProductImage(undefined);
                    toast.success('Foto eliminada');
                  }}
                  title="Foto del Producto"
                  description="Sube una foto para identificar visualmente el producto"
                />
              </CardContent>
            </Card>

            {/* Información del Sistema */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Información del Sistema</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>ID del Producto</Label>
                  <p className="text-sm font-mono text-muted-foreground">{product.id}</p>
                </div>

                <div>
                  <Label>Fecha de Creación</Label>
                  <p className="text-sm text-muted-foreground">
                    {new Date(product.createdAt).toLocaleDateString('es-AR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>

                <div>
                  <Label>Última Actualización</Label>
                  <p className="text-sm text-muted-foreground">
                    {new Date(product.updatedAt).toLocaleDateString('es-AR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </CardContent>
            </Card>
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="product-edit-form"
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Guardar Cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
