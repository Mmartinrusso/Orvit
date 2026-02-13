'use client';

import { AlertCircle, Lock, Settings } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface ModuleDisabledStateProps {
  moduleName?: string;
  missingModules?: string[];
  showContactAdmin?: boolean;
  compact?: boolean;
}

/**
 * Component to display when a module is disabled
 *
 * @example
 * // Simple usage
 * <ModuleDisabledState moduleName="Stock" />
 *
 * @example
 * // With missing modules list
 * <ModuleDisabledState missingModules={['stock_management', 'stock_replenishment']} />
 */
export function ModuleDisabledState({
  moduleName,
  missingModules,
  showContactAdmin = true,
  compact = false,
}: ModuleDisabledStateProps) {
  const moduleLabels: Record<string, string> = {
    'purchases_core': 'Compras',
    'purchase_orders': 'Órdenes de Compra',
    'supplier_ledger': 'Cuentas Corrientes Proveedores',
    'stock_management': 'Gestión de Stock',
    'stock_replenishment': 'Reposición de Stock',
    'stock_transfers': 'Transferencias de Stock',
    'stock_adjustments': 'Ajustes de Inventario',
    'cost_centers': 'Centros de Costo',
    'projects': 'Proyectos',
    'sales_core': 'Ventas',
    'quotes': 'Cotizaciones',
    'sales_orders': 'Órdenes de Venta',
    'invoices': 'Facturación',
    'collections': 'Cobranzas',
    'client_ledger': 'Cuentas Corrientes Clientes',
    'tesoreria': 'Tesorería',
    'maintenance_core': 'Mantenimiento',
    'preventive_maintenance': 'Mantenimiento Preventivo',
    'corrective_maintenance': 'Mantenimiento Correctivo',
    'costs_core': 'Costos',
  };

  const displayName = moduleName ||
    (missingModules?.length === 1
      ? moduleLabels[missingModules[0]] || missingModules[0]
      : 'Este módulo');

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm p-2 bg-muted/50 rounded">
        <Lock className="h-4 w-4" />
        <span>{displayName} no disponible</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] p-6">
      <div className="w-full max-w-md">
        <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
          <Lock className="h-5 w-5 text-amber-500" />
          <AlertTitle className="text-amber-600 dark:text-amber-400">
            Módulo no habilitado
          </AlertTitle>
          <AlertDescription className="mt-2 space-y-3">
            <p className="text-muted-foreground">
              <strong>{displayName}</strong> no está habilitado para tu empresa.
            </p>

            {missingModules && missingModules.length > 1 && (
              <div className="text-sm">
                <p className="font-medium mb-1">Módulos requeridos:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  {missingModules.map((mod) => (
                    <li key={mod}>{moduleLabels[mod] || mod}</li>
                  ))}
                </ul>
              </div>
            )}

            {showContactAdmin && (
              <p className="text-sm text-muted-foreground">
                Contactá al administrador para habilitar esta funcionalidad.
              </p>
            )}
          </AlertDescription>
        </Alert>

        <div className="mt-4 flex gap-2 justify-center">
          <Button variant="outline" asChild>
            <Link href="/administracion">
              <Settings className="h-4 w-4 mr-2" />
              Ir a Administración
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Inline version for use within other components
 */
export function ModuleDisabledInline({
  moduleName,
}: {
  moduleName: string;
}) {
  return (
    <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md border border-dashed">
      <AlertCircle className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">
        {moduleName} no disponible
      </span>
    </div>
  );
}

export default ModuleDisabledState;
