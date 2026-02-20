'use client';

import { usePathname } from 'next/navigation';
import { PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSidebarContext } from '@/components/layout/MainLayout';
import { useViewMode } from '@/contexts/ViewModeContext';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Función para obtener el nombre de la página desde el pathname
const getPageTitle = (path: string): string => {
  // Remover query params y hash
  const cleanPath = path.split('?')[0].split('#')[0];

  // Si es la raíz, retornar Dashboard
  if (cleanPath === '/') return 'Dashboard';

  // Obtener los segmentos del path
  const segments = cleanPath.split('/').filter(Boolean);

  // Mapeo de rutas comunes a títulos
  const routeMap: Record<string, string> = {
    'dashboard': 'Dashboard',
    'productos': 'Productos',
    'ventas': 'Ventas',
    'clientes': 'Clientes',
    'cotizaciones': 'Cotizaciones',
    'compras': 'Compras',
    'proveedores': 'Proveedores',
    'stock': 'Stock',
    'tareas': 'Tareas',
    'usuarios': 'Usuarios',
    'configuracion': 'Configuración',
    'permisos': 'Permisos',
    'controles': 'Controles',
    'costos': 'Costos',
    'cargas': 'Cargas',
    'agenda': 'Agenda',
    'auditoria': 'Auditoría',
    'maquinas': 'Máquinas',
    'mantenimiento': 'Mantenimiento',
    'panol': 'Pañol',
    'reportes': 'Reportes',
    'comprobantes': 'Comprobantes',
    'cuentas-corrientes': 'Cuentas Corrientes',
    'ordenes-pago': 'Órdenes de Pago',
    'anticipos': 'Anticipos',
  };

  // Buscar el último segmento que tenga un mapeo (ignorar IDs numéricos)
  for (let i = segments.length - 1; i >= 0; i--) {
    const segment = segments[i];
    // Si es un número (ID dinámico), seguir buscando
    if (/^\d+$/.test(segment)) continue;
    // Si hay mapeo, usarlo
    if (routeMap[segment]) {
      return routeMap[segment];
    }
  }

  // Si no se encontró mapeo, usar el último segmento no numérico
  const lastNonNumericSegment = segments.filter(s => !/^\d+$/.test(s)).pop() || segments[segments.length - 1];

  // Capitalizar la primera letra y reemplazar guiones/underscores
  return lastNonNumericSegment
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
};

export default function PageHeader() {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);
  const sidebarContext = useSidebarContext();
  const { mode, canToggle } = useViewMode();

  // Si no hay contexto (página fuera de MainLayout), no mostrar nada
  if (!sidebarContext) {
    return null;
  }

  const { isSidebarOpen, toggleSidebar } = sidebarContext;
  const showT2Badge = canToggle && mode === 'E';

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className="h-7 w-7"
        aria-label={isSidebarOpen ? 'Cerrar sidebar' : 'Abrir sidebar'}
      >
        <PanelLeft className="h-4 w-4" />
        <span className="sr-only">Toggle Sidebar</span>
      </Button>
      <div data-orientation="vertical" role="none" className="shrink-0 bg-border w-[1px] h-4" />
      <h2 className="text-sm font-medium text-muted-foreground">{pageTitle}</h2>
      {showT2Badge && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="relative flex h-2 w-2 ml-1 cursor-help">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning-muted-foreground opacity-40"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-warning-muted-foreground/70"></span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Modo extendido activo
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

