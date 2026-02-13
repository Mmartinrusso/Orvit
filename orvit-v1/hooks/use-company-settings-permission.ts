import { usePermissionRobust } from './use-permissions-robust';

export function useCompanySettingsPermission() {
  const { hasPermission: canConfigureCompany, isLoading } = usePermissionRobust('configuracion_empresa');

  return {
    canConfigureCompany,
    isLoading
  };
} 