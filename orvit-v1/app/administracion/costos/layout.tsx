'use client';

import { PermissionGuard } from '@/components/auth/PermissionGuard';

export default function CostosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PermissionGuard permission="ingresar_costos_modulo">
      {children}
    </PermissionGuard>
  );
}
