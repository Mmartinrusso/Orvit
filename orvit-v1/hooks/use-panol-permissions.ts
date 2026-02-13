import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * ✨ OPTIMIZADO: Hook para permisos de pañol
 * Ya NO hace consultas complejas - lee directamente de AuthContext
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
      };
    }

    // Admin roles can always see costs
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPERADMIN';

    return {
      canViewProducts: hasPermission('panol.view_products'),
      canCreateProduct: hasPermission('panol.create_product'),
      canEditProduct: hasPermission('panol.edit_product'),
      canDeleteProduct: hasPermission('tools.delete'),
      canRegisterMovement: hasPermission('panol.register_movement'),
      canViewCosts: isAdmin || hasPermission('panol.view_costs'),
    };
  }, [user, hasPermission]);

  return permissions;
}
