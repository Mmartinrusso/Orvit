'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, PanelLeft, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSidebarContext } from '@/components/layout/MainLayout';
import { useViewMode } from '@/contexts/ViewModeContext';
import { useCompany } from '@/contexts/CompanyContext';
import NotificationPanel from '@/components/notifications/NotificationPanel';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const routeMap: Record<string, string> = {
  'dashboard': 'Dashboard',
  'administracion': 'Administración',
  'mantenimiento': 'Mantenimiento',
  'produccion': 'Producción',
  'ventas': 'Ventas',
  'compras': 'Compras',
  'almacen': 'Almacén',
  'tesoreria': 'Tesorería',
  'nominas': 'Nóminas',
  'costos': 'Costos',
  'productos': 'Productos',
  'clientes': 'Clientes',
  'cotizaciones': 'Cotizaciones',
  'proveedores': 'Proveedores',
  'stock': 'Stock',
  'tareas': 'Tareas',
  'usuarios': 'Usuarios',
  'configuracion': 'Configuración',
  'permisos': 'Permisos',
  'controles': 'Controles',
  'cargas': 'Cargas',
  'agenda': 'Agenda',
  'auditoria': 'Auditoría',
  'maquinas': 'Máquinas',
  'panol': 'Pañol',
  'reportes': 'Reportes',
  'comprobantes': 'Comprobantes',
  'cuentas-corrientes': 'Cuentas Corrientes',
  'ordenes-pago': 'Órdenes de Pago',
  'anticipos': 'Anticipos',
  'preventivo': 'Preventivo',
  'correctivo': 'Correctivo',
  'unidades-moviles': 'Unidades Móviles',
  'planes': 'Planes',
  'checklists': 'Checklists',
  'recepciones': 'Recepciones',
  'remitos': 'Remitos',
  'automatizaciones': 'Automatizaciones',
};

const segmentLabel = (seg: string): string =>
  routeMap[seg] ?? seg.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

const getBreadcrumbs = (pathname: string) => {
  const cleanPath = pathname.split('?')[0].split('#')[0];
  const segments = cleanPath.split('/').filter(Boolean);
  const result: { label: string; href: string }[] = [];
  const hrefParts: string[] = [];

  for (const seg of segments) {
    hrefParts.push(seg);
    if (/^\d+$/.test(seg)) continue; // saltar IDs numéricos
    result.push({ label: segmentLabel(seg), href: '/' + hrefParts.join('/') });
  }

  return result;
};

export default function PageHeader() {
  const pathname = usePathname();
  const sidebarContext = useSidebarContext();
  const { mode, canToggle } = useViewMode();
  const { currentArea } = useCompany();

  if (!sidebarContext) return null;

  const { isSidebarOpen, toggleSidebar } = sidebarContext;
  const showT2Badge = canToggle && mode === 'E';
  const breadcrumbs = getBreadcrumbs(pathname);

  const configHref = currentArea?.name === 'Administración'
    ? '/administracion/configuracion'
    : currentArea?.name === 'Mantenimiento'
    ? '/mantenimiento/configuracion'
    : '/configuracion';

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 md:py-3 border-b border-border bg-background">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className="h-7 w-7 shrink-0"
        aria-label={isSidebarOpen ? 'Cerrar sidebar' : 'Abrir sidebar'}
      >
        <PanelLeft className="h-4 w-4" />
        <span className="sr-only">Toggle Sidebar</span>
      </Button>
      <div data-orientation="vertical" role="none" className="shrink-0 bg-border w-[1px] h-4" />

      {/* Breadcrumb */}
      <nav className="flex items-center gap-0.5 text-sm overflow-hidden min-w-0 flex-1">
        {breadcrumbs.map((crumb, i) => {
          const isLast = i === breadcrumbs.length - 1;
          return (
            <span key={crumb.href} className="flex items-center gap-0.5 min-w-0">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />}
              {isLast ? (
                <span className="font-medium text-foreground truncate">{crumb.label}</span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-muted-foreground hover:text-foreground transition-colors truncate"
                >
                  {crumb.label}
                </Link>
              )}
            </span>
          );
        })}
      </nav>

      {showT2Badge && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="relative flex h-2 w-2 ml-1 cursor-help shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning-muted-foreground opacity-40" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-warning-muted-foreground/70" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Modo extendido activo
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Right side: Notifications + Settings */}
      <div className="ml-auto flex items-center gap-1 shrink-0">
        <NotificationPanel />
        {currentArea && (
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <a href={configHref} aria-label="Configuración">
              <Settings className="h-4 w-4" />
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
