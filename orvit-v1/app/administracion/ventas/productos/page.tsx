'use client';

import { ProductTable } from '@/components/ventas/product-table';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { usePermissionRobust } from '@/hooks/use-permissions-robust';

export default function ProductosPage() {
  const { user: currentUser } = useAuth();
  const { currentCompany } = useCompany();
  const { hasPermission, isLoading: loadingPerms } = usePermissionRobust('VIEW_PRODUCTS');

  // Wait for auth
  if (!currentUser || !currentCompany) {
    return (
      <div className="w-full p-0">
        <div className="px-4 md:px-6 pt-4 pb-3">
          <h1 className="text-xl font-semibold text-foreground">Productos</h1>
          <p className="text-sm text-muted-foreground mt-1">Cargando productos...</p>
        </div>
      </div>
    );
  }

  // Loading permissions
  if (loadingPerms) {
    return (
      <div className="w-full p-0">
        <div className="px-4 md:px-6 pt-4 pb-3">
          <h1 className="text-xl font-semibold text-foreground">Productos</h1>
          <p className="text-sm text-muted-foreground mt-1">Verificando permisos...</p>
        </div>
      </div>
    );
  }

  // No permission
  if (!hasPermission) {
    return (
      <div className="w-full p-0">
        <div className="px-4 md:px-6 pt-4 pb-3">
          <h1 className="text-xl font-semibold text-foreground">Productos</h1>
          <p className="text-sm text-destructive mt-1">
            No tienes permisos para ver esta página. Necesitas el permiso VIEW_PRODUCTS.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Contacta al administrador para solicitar acceso.
          </p>
        </div>
      </div>
    );
  }

  return <ProductTable />;
} 