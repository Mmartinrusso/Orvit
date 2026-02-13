/**
 * Module System
 *
 * Provides module-based feature flags for the application.
 * Each company can have different modules enabled/disabled.
 */

// Dependencies and hierarchy
export {
  MODULE_DEPENDENCIES,
  getAllDependencies,
  getModulesWithDependencies,
  getEffectiveModules,
  canDisableModule,
} from './dependencies';

// API guard and caching
export {
  getCompanyModules,
  invalidateModuleCache,
  invalidateAllModuleCache,
  checkModulesEnabled,
  createModuleDisabledResponse,
  API_ROUTE_MODULES,
  getRouteModules,
} from './api-guard';

// Middleware wrappers
export {
  withGuards,
  withComprasGuards,
  withVentasGuards,
  withStockGuards,
  withTesoreriaGuards,
  withMaintenanceGuards,
  type AuthContext,
} from './with-guards';
