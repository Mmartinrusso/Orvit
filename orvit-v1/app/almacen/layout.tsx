'use client';

import { PermissionGuard } from '@/components/auth/PermissionGuard';
import MainLayout from '@/components/layout/MainLayout';

interface AlmacenLayoutProps {
  children: React.ReactNode;
}

export default function AlmacenLayout({ children }: AlmacenLayoutProps) {
  return (
    <PermissionGuard permission="ingresar_almacen">
      <MainLayout>
        {children}
      </MainLayout>
    </PermissionGuard>
  );
}
