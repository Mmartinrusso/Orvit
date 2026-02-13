/**
 * Hook para verificar módulos habilitados
 *
 * Re-exporta desde ModulesContext para uso conveniente
 */

export {
  useModules,
  useRouteModuleAccess,
  ModuleGuard,
  ROUTE_MODULE_MAP,
  SIDEBAR_MODULE_MAP,
} from '@/contexts/ModulesContext';

export type { Module, CompanyModule, ModuleCategory } from '@/contexts/ModulesContext';
