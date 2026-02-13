'use client';

import { useCompany } from '@/contexts/CompanyContext';
import { AdministracionDashboard } from '@/components/administracion/AdministracionDashboard';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

export default function AdministracionDashboardPage() {
  return (
    <PermissionGuard permission="ingresar_dashboard_administracion">
      <div className="p-0">
          <AdministracionDashboard />
      </div>
    </PermissionGuard>
  );
} 