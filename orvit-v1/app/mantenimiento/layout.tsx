'use client';

import { PermissionGuard } from '@/components/auth/PermissionGuard';
import MainLayout from '@/components/layout/MainLayout';

interface MantenimientoLayoutProps {
  children: React.ReactNode;
}

export default function MantenimientoLayout({ children }: MantenimientoLayoutProps) {
  return (
    <PermissionGuard permission="ingresar_mantenimiento">
      <MainLayout>
        {children}
      </MainLayout>
    </PermissionGuard>
  );
}
