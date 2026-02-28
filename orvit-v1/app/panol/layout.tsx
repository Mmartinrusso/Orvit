'use client';

import { PermissionGuard } from '@/components/auth/PermissionGuard';
import MainLayout from '@/components/layout/MainLayout';

export default function PanolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PermissionGuard permission="ingresar_panol">
      <MainLayout>
        {children}
      </MainLayout>
    </PermissionGuard>
  );
}
