'use client';

import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { ProductForm } from '@/components/ventas/product-form';

export default function NewProductPage() {
  return (
    <PermissionGuard permission="CREATE_PRODUCT">
      <ProductForm />
    </PermissionGuard>
  );
} 