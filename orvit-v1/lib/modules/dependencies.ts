/**
 * Module Dependencies Configuration
 * Defines the hierarchy and dependencies between modules
 */

/**
 * Module dependency graph
 * Key: module key, Value: array of modules it depends on
 *
 * If a parent module is disabled, all child modules are also disabled.
 * Example: if purchases_core is OFF, purchase_orders is also OFF
 */
export const MODULE_DEPENDENCIES: Record<string, string[]> = {
  // Compras submódulos dependen de purchases_core
  'purchase_orders': ['purchases_core'],
  'supplier_ledger': ['purchases_core'],
  'stock_management': ['purchases_core'],
  'cost_centers': ['purchases_core'],
  'projects': ['purchases_core'],
  // Dependencias entre submódulos
  'stock_replenishment': ['purchases_core', 'stock_management'],
  'stock_transfers': ['purchases_core', 'stock_management'],
  'stock_adjustments': ['purchases_core', 'stock_management'],

  // Ventas submódulos dependen de sales_core (granulares según plan)
  'sales_quotes': ['sales_core'],
  'sales_orders': ['sales_core'],
  'sales_deliveries': ['sales_core', 'sales_orders'],
  'sales_invoices': ['sales_core', 'sales_orders'],
  'sales_payments': ['sales_core', 'sales_invoices'],
  'sales_ledger': ['sales_core', 'sales_invoices', 'sales_payments'],
  // Extras de ventas con dependencias ajustadas
  'multi_price_lists': ['sales_core'],
  'seller_commissions': ['sales_core', 'sales_orders', 'sales_payments'],
  'acopios': ['sales_core', 'sales_orders'],
  'client_portal': ['sales_core'],
  'fiscal_invoicing': ['sales_core', 'sales_invoices'],
  'client_credit_limits': ['sales_core'],

  // Mantenimiento submódulos
  'preventive_maintenance': ['maintenance_core'],
  'corrective_maintenance': ['maintenance_core'],
  'mobile_units': ['maintenance_core'],
  'panol': ['maintenance_core'],

  // Costos submódulos
  'labor_costs': ['costs_core'],
  'indirect_costs': ['costs_core'],

  // General submódulos
  'fixed_tasks': ['tasks'],
};

/**
 * Get all dependencies for a module (including transitive)
 */
export function getAllDependencies(moduleKey: string): string[] {
  const result = new Set<string>();

  function addDeps(key: string) {
    const deps = MODULE_DEPENDENCIES[key] || [];
    for (const dep of deps) {
      if (!result.has(dep)) {
        result.add(dep);
        addDeps(dep); // Recursively add transitive dependencies
      }
    }
  }

  addDeps(moduleKey);
  return Array.from(result);
}

/**
 * Get modules with all their dependencies resolved
 */
export function getModulesWithDependencies(moduleKeys: string[]): string[] {
  const result = new Set<string>();

  for (const key of moduleKeys) {
    result.add(key);
    const deps = getAllDependencies(key);
    for (const dep of deps) {
      result.add(dep);
    }
  }

  return Array.from(result);
}

/**
 * Check if all required modules are enabled
 * Returns the list of missing modules
 */
export function getEffectiveModules(
  enabledModules: string[],
  requestedModules: string[]
): { allowed: boolean; missing: string[] } {
  // Get all required modules including dependencies
  const allRequired = getModulesWithDependencies(requestedModules);

  const enabledSet = new Set(enabledModules);
  const missing = allRequired.filter(mod => !enabledSet.has(mod));

  return {
    allowed: missing.length === 0,
    missing,
  };
}

/**
 * Check if a module can be disabled (no other enabled modules depend on it)
 */
export function canDisableModule(
  moduleKey: string,
  currentlyEnabledModules: string[]
): { canDisable: boolean; dependents: string[] } {
  const dependents: string[] = [];

  for (const enabled of currentlyEnabledModules) {
    if (enabled === moduleKey) continue;

    const deps = getAllDependencies(enabled);
    if (deps.includes(moduleKey)) {
      dependents.push(enabled);
    }
  }

  return {
    canDisable: dependents.length === 0,
    dependents,
  };
}
