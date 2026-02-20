'use client';

import { useState } from 'react';
import { ProductForm } from './product-form';

export function ProductFormExample() {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Formulario de Producto</h1>
        <p className="text-muted-foreground">
          Ejemplo del formulario de productos con funcionalidad de subida de archivos
        </p>
      </div>

      <div className="mb-4">
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
        >
          {isEditing ? 'Modo Creación' : 'Modo Edición'}
        </button>
      </div>

      <ProductForm 
        isEditing={isEditing}
        product={isEditing ? {
          id: 'example-product-id',
          name: 'Martillo de Bola 16oz',
          code: 'MB-16',
          description: 'Martillo de bola profesional de 16 onzas',
          categoryId: 1,
          unit: 'unidad',
          costPrice: 25.99,
          minStock: 10,
          currentStock: 50,
          volume: 0.001,
          weight: 0.5,
          location: 'Depósito A-1',
          blocksPerM2: undefined,
          isActive: true,
          companyId: 1,
          createdById: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          category: {
            id: 1,
            name: 'Herramientas',
            companyId: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          company: {
            id: 1,
            name: 'Empresa Ejemplo',
            logo: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          createdBy: {
            id: 1,
            name: 'Usuario Ejemplo',
            email: 'usuario@ejemplo.com',
            role: 'ADMIN',
            companyId: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        } : undefined}
      />
    </div>
  );
} 