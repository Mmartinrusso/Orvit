'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissionRobust } from '@/hooks/use-permissions-robust';
import { Permission } from '@/lib/permissions';
import { Loader2 } from 'lucide-react';

interface PermissionGuardProps {
  children: React.ReactNode;
  permission: Permission;
  fallbackPath?: string;
  showUnauthorized?: boolean;
}

export function PermissionGuard({ 
  children, 
  permission, 
  fallbackPath = '/areas',
  showUnauthorized = false 
}: PermissionGuardProps) {
  const { hasPermission, isLoading } = usePermissionRobust(permission);
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !hasPermission) {
      router.push(fallbackPath);
    }
  }, [hasPermission, isLoading, router, fallbackPath]);

  // Mostrar loading mientras se verifica el permiso
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Verificando permisos...</p>
        </div>
      </div>
    );
  }

  // Si no tiene permiso, mostrar mensaje no autorizado o redirigir
  if (!hasPermission) {
    if (showUnauthorized) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Acceso Denegado</h2>
            <p className="text-muted-foreground mb-4">
              No tienes permisos para acceder a esta página.
            </p>
            <button
              onClick={() => router.push(fallbackPath)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Volver
            </button>
          </div>
        </div>
      );
    }
    return null; // Se redirigirá por el useEffect
  }

  return <>{children}</>;
} 