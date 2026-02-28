'use client';

import { PermissionGuard } from '@/components/auth/PermissionGuard';
import MainLayout from '@/components/layout/MainLayout';

interface ProduccionLayoutProps {
  children: React.ReactNode;
}

export default function ProduccionLayout({ children }: ProduccionLayoutProps) {
  return (
    <PermissionGuard permission="ingresar_produccion">
      <MainLayout>
        {children}
      </MainLayout>
    </PermissionGuard>
  );
}
