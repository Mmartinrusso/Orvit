'use client';

import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/hooks/use-auth';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { OperatorDashboard } from '@/components/dashboard/fixed/OperatorDashboard';
import { SupervisorDashboard } from '@/components/dashboard/fixed/SupervisorDashboard';
import { ManagerDashboard } from '@/components/dashboard/fixed/ManagerDashboard';
import { Skeleton } from '@/components/ui/skeleton';

export default function MantenimientoDashboard() {
  const { currentSector, currentCompany } = useCompany();
  const { user, loading: authLoading } = useAuth();

  const companyIdNum = currentCompany?.id ? parseInt(String(currentCompany.id)) : null;
  const sectorIdNum = currentSector?.id ? parseInt(String(currentSector.id)) : null;
  const userIdNum = user?.id ? parseInt(String(user.id)) : null;
  const userRole = user?.systemRole || user?.role || 'USER';

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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          </div>
        </div>
      </PermissionGuard>
    );
  }

  return (
    <PermissionGuard permission="ingresar_mantenimiento">
      <div className="sidebar-shell">
        <div className="px-4 md:px-6 py-4">
          {renderDashboard(userRole, companyIdNum, sectorIdNum, userIdNum)}
        </div>
      </div>
    </PermissionGuard>
  );
}

function renderDashboard(role: string, companyId: number, sectorId: number | null, userId: number) {
  switch (role) {
    case 'ADMIN':
    case 'SUPERADMIN':
    case 'ADMIN_ENTERPRISE':
      return <ManagerDashboard companyId={companyId} sectorId={sectorId} userId={userId} />;
    case 'SUPERVISOR':
      return <SupervisorDashboard companyId={companyId} sectorId={sectorId} userId={userId} />;
    case 'USER':
    default:
      return <OperatorDashboard companyId={companyId} sectorId={sectorId} userId={userId} />;
  }
}
