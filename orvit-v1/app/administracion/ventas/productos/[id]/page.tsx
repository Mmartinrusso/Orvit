'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Package, MapPin, Scale, Ruler, AlertTriangle, Edit } from 'lucide-react';
import { Product } from '@/lib/types/sales';
import { toast } from 'sonner';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

interface ProductDetailPageProps {
  params: {
    id: string;
  };
}

export default function ProductDetailPage({ params }: ProductDetailPageProps) {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProduct();
  }, [params.id]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/ventas/productos/${params.id}`);

      if (!response.ok) {
        if (response.status === 404) {
          setProduct(null);
          return;
        }
        throw new Error('Error al cargar producto');
      }

      const data = await response.json();

      // Map API response to Product type
      const product: Product = {
        ...data,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
        images: data.images || [],
        files: data.files || [],
      };

      setProduct(product);
    } catch (error) {
      console.error('Error loading product:', error);
      toast.error('Error al cargar el producto');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  };

  const getStockStatus = (product: Product) => {
    if (product.currentStock <= product.minStock) {
      return { variant: 'destructive' as const, label: 'Stock Bajo', icon: AlertTriangle };
    }
    if (product.currentStock <= product.minStock * 1.5) {
      return { variant: 'secondary' as const, label: 'Stock Medio', icon: AlertTriangle };
    }
    return { variant: 'default' as const, label: 'Stock OK', icon: Package };
  };

  if (loading) {
    return (
      <PermissionGuard permission="VIEW_PRODUCTS">
        <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/3 mb-6"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-64 bg-muted rounded"></div>
              <div className="h-64 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </PermissionGuard>
    );
  }

  if (!product) {
    return (
      <PermissionGuard permission="VIEW_PRODUCTS">
        <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-6">
          <div className="text-center py-12">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Producto no encontrado</h2>
            <p className="text-muted-foreground mb-4">
              El producto que buscas no existe o fue eliminado.
            </p>
            <Button onClick={() => router.push('/administracion/ventas/productos')}>
              Volver a Productos
            </Button>
          </div>
        </div>
      </PermissionGuard>
    );
  }

  const stockStatus = getStockStatus(product);
  const StatusIcon = stockStatus.icon;

  return (
    <PermissionGuard permission="VIEW_PRODUCTS">
    <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push('/administracion/ventas/productos')}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Detalle del Producto</h1>
            <p className="text-muted-foreground">{product.code}</p>
          </div>
        </div>
        
        <Button 
          onClick={() => router.push(`/administracion/ventas/productos/${product.id}/editar`)}
        >
          <Edit className="w-4 h-4 mr-2" />
          Editar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Información Básica */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Información Básica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Código</label>
              <p className="font-mono text-lg">{product.code}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Nombre</label>
              <p className="text-lg font-medium">{product.name}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Descripción</label>
              <p className="text-sm">{product.description}</p>
            </div>

            <div className="flex gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Categoría</label>
                <div className="mt-1">
                  <Badge variant="outline">
                    {product.category?.name || 'Sin categoría'}
                  </Badge>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Estado</label>
                <div className="mt-1">
                  <Badge variant={product.isActive ? 'default' : 'secondary'}>
                    {product.isActive ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stock y Precio */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Stock y Precio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Precio de Costo</label>
              <p className="text-2xl font-bold text-success">{formatCurrency(product.costPrice)}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Unidad de Medida</label>
              <p className="text-lg">{product.unit}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Stock Actual</label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xl font-semibold">{product.currentStock}</span>
                  <span className="text-muted-foreground">{product.unit}</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Stock Mínimo</label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xl font-semibold">{product.minStock}</span>
                  <span className="text-muted-foreground">{product.unit}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
              <StatusIcon className="w-5 h-5" />
              <span className="font-medium">Estado del Stock:</span>
              <Badge variant={stockStatus.variant}>
                {stockStatus.label}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Especificaciones Técnicas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Ruler className="w-5 h-5" />
              Especificaciones Técnicas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Scale className="w-4 h-4" />
                  Peso
                </label>
                <p className="text-lg font-medium">{product.weight} kg</p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Ruler className="w-4 h-4" />
                  Volumen
                </label>
                <p className="text-lg font-medium">{product.volume} m³</p>
              </div>
            </div>

            {product.category?.name?.toLowerCase() === 'bloques' && product.blocksPerM2 && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Bloques por m²</label>
                <p className="text-lg font-medium">{product.blocksPerM2} unidades/m²</p>
              </div>
            )}

            <Separator />

            <div>
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                Ubicación
              </label>
              <p className="text-lg font-medium">{product.location}</p>
            </div>
          </CardContent>
        </Card>

        {/* Información del Sistema */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Información del Sistema</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Fecha de Creación</label>
              <p className="text-sm">{product.createdAt.toLocaleDateString('es-AR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Última Actualización</label>
              <p className="text-sm">{product.updatedAt.toLocaleDateString('es-AR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</p>
            </div>

            {product.images && product.images.length > 0 && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Imágenes</label>
                <p className="text-sm">{product.images.length} imagen(es) adjuntada(s)</p>
              </div>
            )}

            {product.files && product.files.length > 0 && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Archivos</label>
                <p className="text-sm">{product.files.length} archivo(s) adjuntado(s)</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alertas */}
      {product.currentStock <= product.minStock && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">
                ¡Atención! Este producto tiene stock bajo.
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              El stock actual ({product.currentStock} {product.unit}) está en o por debajo del stock mínimo ({product.minStock} {product.unit}).
              Se recomienda reabastecer pronto.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
    </PermissionGuard>
  );
} 