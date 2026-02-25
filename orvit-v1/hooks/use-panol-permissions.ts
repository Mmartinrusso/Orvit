import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook para permisos de pañol — granulares por operación
 */
export function usePanolPermissions() {
  const { user, hasPermission } = useAuth();

  const permissions = useMemo(() => {
    if (!user) {
      return {
        canViewProducts: false,
        canCreateProduct: false,
        canEditProduct: false,
        canDeleteProduct: false,
        canRegisterMovement: false,
        canViewCosts: false,
        canManageLoans: false,
        canManageReservations: false,
        canPerformCount: false,
        canExport: false,
        canViewDashboard: false,
        canViewForecast: false,
      };
    }

    // Solo systemRole determina si es admin — user.role es el nombre custom del rol de empresa
    const isAdmin = user.systemRole === 'ADMIN' || user.systemRole === 'SUPERADMIN' || user.systemRole === 'ADMIN_ENTERPRISE';

    return {
      canViewProducts: hasPermission('panol.view_products'),
      canCreateProduct: hasPermission('panol.create_product'),
      canEditProduct: hasPermission('panol.edit_product'),
      canDeleteProduct: hasPermission('panol.delete_product'),
      canRegisterMovement: hasPermission('panol.register_movement'),
      canViewCosts: isAdmin || hasPermission('panol.view_costs'),
      canManageLoans: hasPermission('panol.register_movement'),
      canManageReservations: hasPermission('panol.register_movement'),
      canPerformCount: isAdmin || hasPermission('panol.edit_product'),
      canExport: hasPermission('panol.view_products'),
      canViewDashboard: hasPermission('panol.view_products'),
      canViewForecast: hasPermission('panol.view_products'),
    };
  }, [user, hasPermission]);

  return permissions;
}
