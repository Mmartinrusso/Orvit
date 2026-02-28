'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, PanelLeft, Settings, Search, Bell, Share2, Plus, Users, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSidebarContext } from '@/components/layout/MainLayout';
import { useViewMode } from '@/contexts/ViewModeContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useAgendaV2Header } from '@/components/agendav2/AgendaV2HeaderContext';
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
  'agendav2': 'Agenda',
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
    if (/^\d+$/.test(seg)) continue;
    result.push({ label: segmentLabel(seg), href: '/' + hrefParts.join('/') });
  }

  return result;
};

export default function PageHeader() {
  const pathname = usePathname();
  const sidebarContext = useSidebarContext();
  const { mode, canToggle } = useViewMode();
  const { currentArea } = useCompany();
  const agendaHeader = useAgendaV2Header();

  if (!sidebarContext) return null;

  const { isSidebarOpen, toggleSidebar } = sidebarContext;
  const showT2Badge = canToggle && mode === 'E';
  const breadcrumbs = getBreadcrumbs(pathname);
  const isAgendaV2 = pathname.includes('/agendav2');

  const configHref = currentArea?.name === 'Administración'
    ? '/administracion/configuracion'
    : currentArea?.name === 'Mantenimiento'
    ? '/mantenimiento/configuracion'
    : '/configuracion';

  /* ─── AgendaV2 layout: 3-column (left | center search | right actions) ─── */
  if (isAgendaV2 && agendaHeader) {
    return (
      <div className="flex items-center border-b border-border bg-background" style={{ padding: '10px 16px', gap: '8px' }}>

        {/* Left: toggle + separator + breadcrumb */}
        <div className="flex items-center gap-2 min-w-0" style={{ flex: 1 }}>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-8 w-8 shrink-0"
            aria-label={isSidebarOpen ? 'Cerrar sidebar' : 'Abrir sidebar'}
          >
            <PanelLeft className="h-[18px] w-[18px]" />
          </Button>
          <div role="none" className="shrink-0 bg-border w-px h-5" />
          <nav className="flex items-center gap-0.5 text-sm overflow-hidden min-w-0">
            {breadcrumbs.map((crumb, i) => {
              const isLast = i === breadcrumbs.length - 1;
              return (
                <span key={crumb.href} className="flex items-center gap-0.5 min-w-0">
                  {i > 0 && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40" />}
                  {isLast ? (
                    <span className="font-semibold text-foreground truncate">{crumb.label}</span>
                  ) : (
                    <Link href={crumb.href} className="text-muted-foreground hover:text-foreground transition-colors truncate">
                      {crumb.label}
                    </Link>
                  )}
                </span>
              );
            })}
          </nav>
        </div>

        {/* Center: search bar — truly centered */}
        <div className="relative hidden md:flex items-center shrink-0" style={{ width: '380px' }}>
          <Search
            className="absolute pointer-events-none h-[15px] w-[15px]"
            style={{ left: '11px', color: 'hsl(var(--muted-foreground))' }}
          />
          <input
            value={agendaHeader.search}
            onChange={e => agendaHeader.setSearch(e.target.value)}
            placeholder="Buscar tareas..."
            className="w-full outline-none bg-transparent"
            style={{
              paddingLeft: '32px',
              paddingRight: '12px',
              height: '34px',
              fontSize: '13px',
              border: '1px solid hsl(var(--border))',
              borderRadius: '9px',
              color: 'hsl(var(--foreground))',
            }}
          />
        </div>

        {/* Right: team + actions */}
        <div className="flex items-center gap-2 shrink-0" style={{ flex: 1, justifyContent: 'flex-end' }}>
          {/* Avatar group */}
          <div className="hidden sm:flex items-center">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                style={{
                  height: '30px', width: '30px', borderRadius: '50%',
                  border: '2px solid hsl(var(--background))',
                  background: 'hsl(var(--muted))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginLeft: i > 1 ? '-8px' : '0',
                }}
              >
                <Users className="h-[15px] w-[15px]" style={{ color: 'hsl(var(--muted-foreground))' }} />
              </div>
            ))}
          </div>

          {/* Invite */}
          <Button
            variant="outline"
            size="sm"
            className="hidden sm:flex items-center gap-1.5 h-8 text-[13px] font-semibold"
          >
            <Plus className="h-[15px] w-[15px]" strokeWidth={2.5} />
            Invitar
          </Button>

          <div className="hidden sm:block w-px h-5 bg-border mx-0.5" />

          {/* Share */}
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Share2 className="h-[17px] w-[17px]" />
          </Button>

          {/* Bell */}
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Bell className="h-[17px] w-[17px]" />
          </Button>

          {/* Settings */}
          {currentArea && (
            <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
              <a href={configHref} aria-label="Configuración">
                <Settings className="h-[17px] w-[17px]" />
              </a>
            </Button>
          )}

          {/* Loading spinner */}
          {agendaHeader.isLoading && (
            <RefreshCw className="h-[15px] w-[15px] animate-spin" style={{ color: 'hsl(var(--muted-foreground))' }} />
          )}
        </div>
      </div>
    );
  }

  /* ─── Default layout ─── */
  return (
    <div className="flex items-center gap-2 px-4 py-3 md:py-3.5 border-b border-border bg-background">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className="h-8 w-8 shrink-0"
        aria-label={isSidebarOpen ? 'Cerrar sidebar' : 'Abrir sidebar'}
      >
        <PanelLeft className="h-[18px] w-[18px]" />
        <span className="sr-only">Toggle Sidebar</span>
      </Button>
      <div data-orientation="vertical" role="none" className="shrink-0 bg-border w-[1px] h-5" />

      {/* Breadcrumb */}
      <nav className="flex items-center gap-0.5 text-sm overflow-hidden min-w-0 flex-1">
        {breadcrumbs.map((crumb, i) => {
          const isLast = i === breadcrumbs.length - 1;
          return (
            <span key={crumb.href} className="flex items-center gap-0.5 min-w-0">
              {i > 0 && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40" />}
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

      {/* Right side: Bell + Settings */}
      <div className="ml-auto flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Bell className="h-[17px] w-[17px]" />
        </Button>
        {currentArea && (
          <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
            <a href={configHref} aria-label="Configuración">
              <Settings className="h-[17px] w-[17px]" />
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
