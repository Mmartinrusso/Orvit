'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useCompany } from '@/contexts/CompanyContext';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import MainLayout from '@/components/layout/MainLayout';
import { AgendaV2HeaderProvider } from '@/components/agendav2/AgendaV2HeaderContext';

interface AdministracionLayoutProps {
  children: React.ReactNode;
}

export default function AdministracionLayout({ children }: AdministracionLayoutProps) {
  const { currentArea, isLoading } = useCompany();
  const router = useRouter();
  const pathname = usePathname();

  const isConfigPage = pathname.includes('/administracion/configuracion');
  const isAgendaV2   = pathname.includes('/administracion/agendav2');
  const isExempt     = isConfigPage || isAgendaV2;

  const isAdminArea = currentArea?.name?.toLowerCase().includes('administracion') ||
                     currentArea?.name?.toLowerCase().includes('administración');

  // Redirigir a /areas si no estamos en el área de Administración
  useEffect(() => {
    if (isLoading || isExempt) return;
    if (pathname === '/sectores' || pathname === '/areas') return;

    if (!currentArea || !isAdminArea) {
      router.push('/areas');
    }
  }, [currentArea, isAdminArea, router, isLoading, pathname, isExempt]);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-muted-foreground">Cargando administración...</div>
        </div>
      </MainLayout>
    );
  }

  if (!isExempt && (!currentArea || !isAdminArea)) {
    return null;
  }

  return (
    <AgendaV2HeaderProvider>
      <PermissionGuard permission="ingresar_administracion">
        <MainLayout>
          {children}
        </MainLayout>
      </PermissionGuard>
    </AgendaV2HeaderProvider>
  );
}
