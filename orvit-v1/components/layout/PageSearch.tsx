'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  LayoutDashboard,
  User,
  Calendar,
  Users,
  ClipboardList,
  Settings,
  FileText,
  Shield,
  Package,
  Calculator,
  TrendingUp,
  DollarSign,
  Cog,
  Truck,
  Building2,
  ShoppingCart,
  Receipt,
  History,
  BarChart3,
  FileCheck,
} from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { useNavigationPermissions } from '@/hooks/use-navigation-permissions';

interface PageItem {
  name: string;
  href: string;
  icon: any;
  description: string;
  area: string;
  keywords?: string[];
}

export function PageSearch() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { currentArea } = useCompany();
  const permissions = useNavigationPermissions();

  // Escuchar evento global para abrir el buscador
  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener('orvit:search:open', handleOpen);
    return () => window.removeEventListener('orvit:search:open', handleOpen);
  }, []);

  // Atajos de teclado: Ctrl+K o Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Definir todas las páginas del sistema
  const allPages = useMemo<PageItem[]>(() => {
    const pages: PageItem[] = [];

    // Mantenimiento
    pages.push({
      name: 'Dashboard de Mantenimiento',
      href: '/mantenimiento/dashboard',
      icon: LayoutDashboard,
      description: 'KPIs, tareas urgentes, mantenimientos del día',
      area: 'Mantenimiento',
      keywords: ['inicio', 'home', 'principal', 'kpis'],
    });

    if (permissions.canAccessWorkOrders) {
      pages.push({
        name: 'Órdenes de Trabajo',
        href: '/mantenimiento/ordenes',
        icon: User,
        description: 'Lista de todas las OTs de la empresa',
        area: 'Mantenimiento',
        keywords: ['ots', 'ordenes', 'trabajo', 'work orders'],
      });
    }

    if (permissions.canAccessMaintenances) {
      pages.push({
        name: 'Mantenimientos',
        href: '/mantenimiento/mantenimientos',
        icon: Calendar,
        description: 'Calendario de mantenimientos programados',
        area: 'Mantenimiento',
        keywords: ['calendario', 'programados', 'preventivo'],
      });
    }

    if (permissions.canAccessMaintenanceMachines) {
      pages.push({
        name: 'Máquinas (Mantenimiento)',
        href: '/mantenimiento/maquinas',
        icon: Cog,
        description: 'Lista completa de máquinas',
        area: 'Mantenimiento',
        keywords: ['equipos', 'equipamiento', 'maquinaria'],
      });
    }

    if (permissions.canAccessMobileUnits) {
      pages.push({
        name: 'Unidades Móviles',
        href: '/mantenimiento/unidades-moviles',
        icon: Truck,
        description: 'Gestión de vehículos y equipos móviles',
        area: 'Mantenimiento',
        keywords: ['vehiculos', 'transporte', 'movil'],
      });
    }

    if (permissions.canAccessWorkStations) {
      pages.push({
        name: 'Puestos de Trabajo',
        href: '/mantenimiento/puestos-trabajo',
        icon: Building2,
        description: 'Gestión de puestos e instructivos',
        area: 'Mantenimiento',
        keywords: ['estaciones', 'workstations', 'instructivos'],
      });
    }

    if (permissions.canAccessPanol) {
      pages.push({
        name: 'Pañol',
        href: '/panol',
        icon: Package,
        description: 'Herramientas, inventario y movimientos',
        area: 'Mantenimiento',
        keywords: ['herramientas', 'stock', 'inventario', 'almacen'],
      });
    }


    // Administración
    if (permissions.canAccessAdminDashboard) {
      pages.push({
        name: 'Dashboard de Administración',
        href: '/administracion/dashboard',
        icon: LayoutDashboard,
        description: 'Panel de control con estadísticas generales',
        area: 'Administración',
        keywords: ['inicio', 'home', 'principal', 'admin'],
      });
    }

    if (permissions.canAccessTasks) {
      pages.push({
        name: 'Agenda / Tareas',
        href: '/administracion/agenda',
        icon: ClipboardList,
        description: 'Agenda personal, tareas, tareas fijas y seguimiento',
        area: 'Administración',
        keywords: ['todo', 'pendientes', 'agenda', 'eventos', 'tareas'],
      });
    }

    if (permissions.canAccessPermissions) {
      pages.push({
        name: 'Permisos y Roles',
        href: '/administracion/permisos',
        icon: Shield,
        description: 'Configurar roles y permisos del sistema',
        area: 'Administración',
        keywords: ['seguridad', 'accesos', 'roles'],
      });
    }

    if (permissions.canAccessUsers) {
      pages.push({
        name: 'Gestión de Usuarios',
        href: '/administracion/usuarios',
        icon: Users,
        description: 'Administrar usuarios y permisos',
        area: 'Administración',
        keywords: ['empleados', 'cuentas', 'personal'],
      });
    }

    // Ventas
    if (permissions.canAccessSalesDashboard) {
      pages.push({
        name: 'Dashboard de Ventas',
        href: '/administracion/ventas',
        icon: DollarSign,
        description: 'Panel de control de ventas',
        area: 'Ventas',
        keywords: ['comercial', 'ingresos'],
      });
    }

    if (permissions.canAccessClients) {
      pages.push({
        name: 'Clientes',
        href: '/administracion/ventas/clientes',
        icon: Users,
        description: 'Gestión de clientes y contactos',
        area: 'Ventas',
        keywords: ['contactos', 'empresas'],
      });
    }

    if (permissions.canAccessProducts) {
      pages.push({
        name: 'Productos',
        href: '/administracion/ventas/productos',
        icon: Package,
        description: 'Catálogo de productos y servicios',
        area: 'Ventas',
        keywords: ['catalogo', 'articulos', 'servicios'],
      });
    }

    if (permissions.canAccessQuotes) {
      pages.push({
        name: 'Cotizaciones',
        href: '/administracion/ventas/cotizaciones',
        icon: Calculator,
        description: 'Gestión de cotizaciones y presupuestos',
        area: 'Ventas',
        keywords: ['presupuestos', 'ofertas'],
      });
    }

    if (permissions.canAccessSalesModule) {
      pages.push({
        name: 'Ventas',
        href: '/administracion/ventas/ventas',
        icon: TrendingUp,
        description: 'Registro y seguimiento de ventas',
        area: 'Ventas',
        keywords: ['facturacion', 'ventas realizadas'],
      });
    }

    // Costos
    if (permissions.canAccessCosts) {
      pages.push({
        name: 'Módulo de Costos',
        href: '/administracion/costos',
        icon: Calculator,
        description: 'Gestión y análisis de costos de fabricación',
        area: 'Costos',
        keywords: ['fabricacion', 'produccion', 'gastos'],
      });
    }

    // Compras
    pages.push({
      name: 'Dashboard de Compras',
      href: '/administracion/compras',
      icon: ShoppingCart,
      description: 'Panel de control de compras',
      area: 'Compras',
      keywords: ['proveedores', 'adquisiciones'],
    });

    pages.push({
      name: 'Órdenes de Compra',
      href: '/administracion/compras/ordenes',
      icon: ShoppingCart,
      description: 'Gestión de órdenes de compra',
      area: 'Compras',
      keywords: ['pedidos', 'ordenes'],
    });

    pages.push({
      name: 'Proveedores',
      href: '/administracion/compras/proveedores',
      icon: Building2,
      description: 'Gestión de proveedores',
      area: 'Compras',
      keywords: ['vendors', 'suministradores'],
    });

    pages.push({
      name: 'Carga de Comprobantes',
      href: '/administracion/compras/comprobantes',
      icon: Receipt,
      description: 'Cargar comprobantes de compra',
      area: 'Compras',
      keywords: ['facturas', 'recibos'],
    });

    pages.push({
      name: 'Stock',
      href: '/administracion/compras/stock',
      icon: Package,
      description: 'Gestión de stock e inventario',
      area: 'Compras',
      keywords: ['inventario', 'almacen', 'existencias'],
    });

    pages.push({
      name: 'Solicitudes de Compra',
      href: '/administracion/compras/solicitudes',
      icon: FileCheck,
      description: 'Solicitudes de compra y aprobaciones',
      area: 'Compras',
      keywords: ['aprobaciones', 'requisiciones'],
    });

    pages.push({
      name: 'Historial de Compras',
      href: '/administracion/compras/historial',
      icon: History,
      description: 'Historial de compras realizadas',
      area: 'Compras',
      keywords: ['registro', 'historico'],
    });

    pages.push({
      name: 'Reportes de Compras',
      href: '/administracion/compras/reportes',
      icon: BarChart3,
      description: 'Reportes y análisis de compras',
      area: 'Compras',
      keywords: ['informes', 'analisis'],
    });

    // Controles y Cargas
    if (permissions.canAccessControls) {
      pages.push({
        name: 'Controles',
        href: '/administracion/controles',
        icon: Shield,
        description: 'Dashboard de sistemas de control fiscal',
        area: 'Administración',
        keywords: ['fiscal', 'impuestos', 'iva'],
      });
    }

    if (permissions.canAccessCargas) {
      pages.push({
        name: 'Cargas',
        href: '/administracion/cargas',
        icon: Package,
        description: 'Gestión de camiones y cargas de viguetas',
        area: 'Administración',
        keywords: ['camiones', 'transporte', 'viguetas'],
      });
    }

    // Producción
    pages.push({
      name: 'Dashboard de Producción',
      href: '/produccion/dashboard',
      icon: LayoutDashboard,
      description: 'Panel de control de producción',
      area: 'Producción',
      keywords: ['fabricacion', 'manufactura'],
    });

    if (permissions.canAccessProductionMachines) {
      pages.push({
        name: 'Máquinas (Producción)',
        href: '/maquinas',
        icon: Cog,
        description: 'Gestión de máquinas de producción',
        area: 'Producción',
        keywords: ['equipos', 'maquinaria'],
      });
    }

    if (permissions.canAccessVehicles) {
      pages.push({
        name: 'Vehículos',
        href: '/vehicles',
        icon: Truck,
        description: 'Gestión de vehículos y transporte',
        area: 'Producción',
        keywords: ['transporte', 'flota'],
      });
    }

    // Configuración
    pages.push({
      name: 'Configuración',
      href: '/administracion/configuracion',
      icon: Settings,
      description: 'Ajustes del sistema y preferencias',
      area: 'Sistema',
      keywords: ['ajustes', 'preferencias', 'opciones'],
    });

    return pages;
  }, [permissions]);

  // Agrupar páginas por área
  const groupedPages = useMemo(() => {
    const groups: Record<string, PageItem[]> = {};
    allPages.forEach((page) => {
      if (!groups[page.area]) {
        groups[page.area] = [];
      }
      groups[page.area].push(page);
    });
    return groups;
  }, [allPages]);

  const handleSelect = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar página..." />
      <CommandList>
        <CommandEmpty>No se encontraron páginas.</CommandEmpty>
        {Object.entries(groupedPages).map(([area, pages], index) => (
          <div key={area}>
            {index > 0 && <CommandSeparator />}
            <CommandGroup heading={area}>
              {pages.map((page) => (
                <CommandItem
                  key={page.href}
                  value={`${page.name} ${page.description} ${page.keywords?.join(' ') || ''}`}
                  onSelect={() => handleSelect(page.href)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <page.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium">{page.name}</span>
                    <span className="text-xs text-muted-foreground truncate">
                      {page.description}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
