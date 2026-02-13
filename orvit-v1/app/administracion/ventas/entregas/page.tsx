'use client';

import { EntregasList } from '@/components/ventas/entregas-list';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

export default function EntregasPage() {
  return (
    <PermissionGuard permission="ventas.entregas.view">
      <EntregasList />
    </PermissionGuard>
  );
}
