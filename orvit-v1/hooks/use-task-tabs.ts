import { usePermission } from './use-permissions';

export interface TaskTabConfig {
  id: string;
  label: string;
  requiredPermission?: string;
}

const TAB_CONFIG: TaskTabConfig[] = [
  { id: 'tareas', label: 'Tareas' },
  { id: 'fijas', label: 'Fijas' },
  { id: 'agenda', label: 'Agenda', requiredPermission: 'ver_agenda' },
  { id: 'historial', label: 'Historial', requiredPermission: 'ver_historial' },
  { id: 'estadisticas', label: 'Estadísticas', requiredPermission: 'ver_estadisticas' },
];

export function useTaskTabs() {
  // Para cada tab con requiredPermission, consultar el permiso
  const perms = {
    agenda: usePermission('ver_agenda'),
    historial: usePermission('ver_historial'),
    estadisticas: usePermission('ver_estadisticas'),
  };

  // Construir tabs según permisos
  const tabs = TAB_CONFIG.filter(tab => {
    if (!tab.requiredPermission) return true;
    const permKey = tab.id as keyof typeof perms;
    const perm = perms[permKey];
    if (!perm) return false;
    return perm.hasPermission; // Solo mostrar si realmente tiene el permiso
  });

  return tabs;
} 