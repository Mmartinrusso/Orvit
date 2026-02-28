'use client';

import { PermissionGuard } from '@/components/auth/PermissionGuard';

export default function NominasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PermissionGuard permission="ingresar_nominas">
      {children}
    </PermissionGuard>
  );
}
