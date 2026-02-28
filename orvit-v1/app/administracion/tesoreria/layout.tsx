'use client';

import { PermissionGuard } from '@/components/auth/PermissionGuard';

export default function TesoreriaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PermissionGuard permission="treasury.ingresar">
      {children}
    </PermissionGuard>
  );
}
