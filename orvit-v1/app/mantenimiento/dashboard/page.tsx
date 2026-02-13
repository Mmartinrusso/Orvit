'use client';

import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/hooks/use-auth';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { DashboardBuilder } from '@/components/dashboard/DashboardBuilder';
import { Skeleton } from '@/components/ui/skeleton';

export default function MantenimientoDashboard() {
  const { currentArea, currentSector, currentCompany } = useCompany();
  const { user, loading: authLoading } = useAuth();
  
  const companyIdNum = currentCompany?.id ? parseInt(String(currentCompany.id)) : null;
  const sectorIdNum = currentSector?.id ? parseInt(String(currentSector.id)) : null;
  const userIdNum = user?.id ? parseInt(String(user.id)) : null;
  const userRole = user?.role || 'USER';
  const userName = user?.name || '';

  // Si no hay sector seleccionado, mostrar mensaje
  if (!currentSector) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Sector no seleccionado</h2>
          <p className="text-sm text-muted-foreground">
            Por favor, selecciona un sector para acceder al dashboard.
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (authLoading || !companyIdNum || !userIdNum) {
    return (
      <PermissionGuard permission="ingresar_mantenimiento">
        <div className="h-screen sidebar-shell">
          <div className="px-4 md:px-6 py-4 space-y-4">
            <div className="flex items-center justify-between pb-4 border-b">
              <div>
                <Skeleton className="h-7 w-64 mb-2" />
                <Skeleton className="h-4 w-48" />
              </div>
              <Skeleton className="h-9 w-32" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>
          </div>
        </div>
      </PermissionGuard>
    );
  }

  return (
    <PermissionGuard permission="ingresar_mantenimiento">
      <DashboardBuilder
        companyId={companyIdNum}
        sectorId={sectorIdNum}
        userId={userIdNum}
        userRole={userRole}
        userName={userName}
      />
    </PermissionGuard>
  );
}
