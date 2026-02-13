'use client';

import { OrdenesVentaList } from '@/components/ventas/ordenes-venta-list';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

export default function OrdenesVentaPage() {
  return (
    <PermissionGuard permission="ventas.ordenes.view">
      <OrdenesVentaList />
    </PermissionGuard>
  );
}
