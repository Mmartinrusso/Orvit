'use client';

import { FacturasList } from '@/components/ventas/facturas-list';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

export default function FacturasPage() {
  return (
    <PermissionGuard permission="ventas.facturas.view">
      <FacturasList />
    </PermissionGuard>
  );
}
