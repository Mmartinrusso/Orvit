'use client';

import { PermissionGuard } from '@/components/auth/PermissionGuard';

export default function ComprasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PermissionGuard permission="ingresar_compras">
      {children}
    </PermissionGuard>
  );
}
