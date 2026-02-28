'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCompany } from '@/contexts/CompanyContext';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import MainLayout from '@/components/layout/MainLayout';

interface MaquinasLayoutProps {
  children: React.ReactNode;
}

export default function MaquinasLayout({ children }: MaquinasLayoutProps) {
  const { currentSector, isLoading } = useCompany();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return; // Esperar a que termine de cargar
    
    if (!currentSector) {
      router.push('/areas');
    }
  }, [currentSector, router, isLoading]);

  // Mostrar loading mientras se verifica el sector
  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-muted-foreground">Cargando máquinas...</div>
        </div>
      </MainLayout>
    );
  }

  // Si no hay sector seleccionado, no mostrar nada (se redirigirá)
  if (!currentSector) {
    return null;
  }

  // Renderizar el contenido dentro del MainLayout con guard de permisos
  return (
    <MainLayout>
      <PermissionGuard permission="machines.view">
        {children}
      </PermissionGuard>
    </MainLayout>
  );
} 