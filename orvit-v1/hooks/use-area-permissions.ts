'use client';

import { usePermissionRobust } from './use-permissions-robust';

export function useAreaPermissions() {
  const { hasPermission: canAccessAdministration, isLoading: loadingAdmin } = usePermissionRobust('ingresar_administracion');
  const { hasPermission: canAccessMaintenance, isLoading: loadingMaintenance } = usePermissionRobust('ingresar_mantenimiento');
  const { hasPermission: canAccessProduction, isLoading: loadingProduction } = usePermissionRobust('ingresar_produccion');

  const isLoading = loadingAdmin || loadingMaintenance || loadingProduction;

  return {
    canAccessAdministration,
    canAccessMaintenance,
    canAccessProduction,
    isLoading
  };
} 