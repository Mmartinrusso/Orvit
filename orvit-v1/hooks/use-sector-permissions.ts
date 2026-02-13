'use client';

import { usePermissionRobust } from './use-permissions-robust';

export function useSectorPermissions() {
  const { hasPermission: canCreateSector, isLoading: loadingCreate } = usePermissionRobust('sectors.create');
  const { hasPermission: canEditSector, isLoading: loadingEdit } = usePermissionRobust('sectors.edit');
  const { hasPermission: canDeleteSector, isLoading: loadingDelete } = usePermissionRobust('sectors.delete');

  const isLoading = loadingCreate || loadingEdit || loadingDelete;

  return {
    canCreateSector,
    canEditSector,
    canDeleteSector,
    isLoading
  };
} 