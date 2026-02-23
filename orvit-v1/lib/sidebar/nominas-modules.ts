import type { SidebarModule } from './ventas-modules';

export const NOMINAS_MODULES: SidebarModule[] = [
  { id: 'nominas.dashboard', name: 'Dashboard', icon: 'LayoutDashboard', path: '/administracion/nominas', isCore: true, category: 'core', description: 'Panel de control de nóminas y proyecciones', order: 0 },
  { id: 'nominas.empleados', name: 'Empleados', icon: 'UserPlus', path: '/administracion/nominas/empleados', isCore: true, category: 'core', description: 'Gestión de empleados', order: 10 },
  { id: 'nominas.gremios', name: 'Gremios', icon: 'Users', path: '/administracion/nominas/gremios', isCore: false, category: 'optional', description: 'Gremios, categorías y tasas de convenio', order: 20 },
  { id: 'nominas.sectores', name: 'Sectores', icon: 'MapPin', path: '/administracion/nominas/sectores', isCore: false, category: 'optional', description: 'Sectores de trabajo', order: 21 },
  { id: 'nominas.configuracion', name: 'Configuración', icon: 'Settings', path: '/administracion/nominas/configuracion', isCore: false, category: 'optional', description: 'Configuración de nóminas y feriados', order: 30 },
  { id: 'nominas.componentes', name: 'Componentes', icon: 'Calculator', path: '/administracion/nominas/componentes', isCore: false, category: 'optional', description: 'Fórmulas y componentes salariales', order: 31 },
  { id: 'nominas.adelantos', name: 'Adelantos', icon: 'DollarSign', path: '/administracion/nominas/adelantos', isCore: false, category: 'optional', description: 'Adelantos de sueldo', order: 40 },
  { id: 'nominas.liquidaciones', name: 'Liquidaciones', icon: 'Receipt', path: '/administracion/nominas/liquidaciones', isCore: true, category: 'core', description: 'Liquidaciones de sueldos', order: 41 },
];

export function getNominasModuleById(id: string): SidebarModule | undefined {
  return NOMINAS_MODULES.find(m => m.id === id);
}
