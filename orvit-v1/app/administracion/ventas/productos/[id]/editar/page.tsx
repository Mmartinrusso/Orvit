'use client';

import { useState, useEffect } from 'react';
import { ProductForm } from '@/components/ventas/product-form';
import { Product } from '@/lib/types/sales';
import { toast } from 'sonner';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

interface EditProductPageProps {
  params: {
    id: string;
  };
}

export default function EditProductPage({ params }: EditProductPageProps) {
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

  if (loading) {
    return (
      <PermissionGuard permission="ventas.productos.edit">
        <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/3 mb-6"></div>
            <div className="space-y-4">
              <div className="h-64 bg-muted rounded"></div>
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
      <PermissionGuard permission="ventas.productos.edit">
        <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-6">
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold mb-2">Producto no encontrado</h2>
            <p className="text-muted-foreground">
              El producto que intentas editar no existe o fue eliminado.
            </p>
          </div>
        </div>
      </PermissionGuard>
    );
  }

  return (
    <PermissionGuard permission="ventas.productos.edit">
      <ProductForm product={product} isEditing={true} />
    </PermissionGuard>
  );
} 