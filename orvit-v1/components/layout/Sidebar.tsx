'use client';

import React, { useEffect, useState, useMemo, useCallback, startTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useCompany } from '@/contexts/CompanyContext';
import { cn } from '@/lib/utils';
import {
  Wrench,
  LayoutDashboard,
  Cog,
  Truck,
  ChevronLeft,
  ChevronRight,
  Building2,
  User,
  Calendar,
  History,
  Users,
  ClipboardList,
  Settings,
  FileText,
  BarChart3,
  Shield,
  Clock,
  UserPlus,
  Package,
  Calculator,
  TrendingUp,
  LogOut,
  DollarSign,
  Zap,
  BookOpen,
  Target,
  Sun,
  Moon,
  Factory,
  ChevronDown,
  ShoppingCart,
  ShoppingBag,
  Receipt,
  FileCheck,
  TrendingDown,
  Search,
  CircleUser,
  Bell,
  EllipsisVertical,
  AlertTriangle,
  Link2,
  MapPin,
  RefreshCw,
  ListTodo,
  CalendarClock,
  Inbox,
  CheckCircle2,
  ClipboardCheck,
  ArrowRightLeft,
  Boxes,
  Lightbulb,
  Wallet,
  // CMMS Icons
  Activity,
  Droplet,
  HardHat,
  Gauge,
  Lock,
  QrCode,
  HeartPulse,
  Thermometer,
  GraduationCap,
  // Production Icons
  Tags,
  ListChecks,
  CheckSquare,
  Pause,
  // Additional CMMS Icons
  ShieldCheck,
  ShieldAlert,
  Construction,
  RouteIcon,
  Smartphone,
  ScanLine,
  // Almacén
  Warehouse,
  PackageSearch,
  PackageCheck,
  PackageX,
  ClipboardPen,
  Database,
  CreditCard,
  AlertCircle,
  MessageSquarePlus,
  Loader2,
  FileSpreadsheet,
  FileDown,
  Pencil,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigationPermissions } from '@/hooks/use-navigation-permissions';
import { useAreaPermissions } from '@/hooks/use-area-permissions';
import { useNavigation } from '@/contexts/NavigationContext';
import AreaSelector from './AreaSelector';
import SectorSelector from './SectorSelector';
import NotificationPanel from '@/components/notifications/NotificationPanel';
import { PageSearch } from '@/components/layout/PageSearch';
import { useSidebarContext } from '@/contexts/SidebarContext';
import { ThemeSelector } from '@/components/ui/theme-selector';
import { ModeIndicator } from '@/components/view-mode';
import { useViewMode } from '@/contexts/ViewModeContext';
import { FeedbackModal } from '@/components/feedback/FeedbackModal';
import { useModules, SIDEBAR_MODULE_MAP } from '@/contexts/ModulesContext';
import { useCompanySidebarConfig } from '@/hooks/use-company-sidebar-config';
import { SidebarEditMode } from '@/components/layout/sidebar-edit-mode';
import { getEffectiveConfig, getModuleByKey, getAdminModuleOrder, getModuleItemById, ALL_MODULE_KEYS, getAllLeafItems, type SidebarNode as ConfigSidebarNode, type SidebarModuleKey } from '@/lib/sidebar/company-sidebar-config';
import { useSidebarFavorites } from '@/hooks/use-sidebar-favorites';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SidebarItem {
  name: string;
  href?: string;
  icon: any;
  description: string;
  children?: SidebarItem[];
  badge?: number | string; // Contador o texto para badge
  badgeVariant?: 'default' | 'destructive' | 'warning'; // Variante visual del badge
  moduleId?: string; // ID del módulo para favoritos (solo items hoja de buildModuleNodes)
}

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

// Items hardcodeados del sidebar que no están en el registro de módulos
// Se usan para resolver favoritos de items que no pasan por buildModuleNodes()
const HARDCODED_ITEMS: Array<{ moduleId: string; name: string; path: string; icon: string }> = [
  { moduleId: 'sys.agenda',          name: 'Agenda',              path: '/administracion/agenda',           icon: 'CalendarClock'  },
  { moduleId: 'sys.dashboard',       name: 'Dashboard',           path: '/administracion/dashboard',        icon: 'LayoutDashboard' },
  { moduleId: 'sys.automatizaciones',name: 'Automatizaciones',    path: '/administracion/automatizaciones', icon: 'Zap'            },
  { moduleId: 'sys.controles',       name: 'Controles',           path: '/administracion/controles',        icon: 'Shield'         },
  { moduleId: 'sys.cargas',          name: 'Cargas',              path: '/administracion/cargas',           icon: 'Package'        },
  { moduleId: 'sys.permisos',        name: 'Permisos & Roles',    path: '/administracion/permisos',         icon: 'Shield'         },
  { moduleId: 'sys.usuarios',        name: 'Gestión de Usuarios', path: '/administracion/usuarios',         icon: 'Users'          },
  { moduleId: 'sys.costos',          name: 'Módulo de Costos',    path: '/administracion/costos',           icon: 'Calculator'     },
];

// Mapa de nombres de íconos (string) → componente Lucide para todos los módulos
const SIDEBAR_ICON_MAP: Record<string, React.ComponentType<any>> = {
  LayoutDashboard, Database, Users, Package, DollarSign, MapPin, Calendar,
  Settings, User, Receipt, RefreshCw, FileText, ClipboardList, ShoppingBag,
  Boxes, Truck, Route: RouteIcon, CalendarClock, FileCheck, Wallet,
  ClipboardCheck, CreditCard, BookOpen, AlertTriangle, BarChart3, AlertCircle,
  FileSpreadsheet, FileDown, Target, BarChart: BarChart3,
  // Mantenimiento
  Lightbulb, Building2, ArrowRightLeft, ScanLine, TrendingUp, TrendingDown,
  HeartPulse, Activity, Shield, Lock, Clock, Gauge, Droplet, HardHat,
  GraduationCap, ShieldCheck, ShieldAlert, Construction, QrCode, Thermometer,
  // Producción
  Factory, CheckCircle2, Pause, CheckSquare, Tags, ListChecks,
  // Compras / Admin
  ShoppingCart, History, UserPlus, Calculator, Cog, Zap,
  // Almacén
  PackageSearch, PackageCheck, PackageX, Warehouse,
};

function resolveSidebarIcon(iconName: string): React.ComponentType<any> {
  return SIDEBAR_ICON_MAP[iconName] ?? FileText;
}

function buildModuleNodes(
  nodes: ConfigSidebarNode[],
  permissionsMap: Record<string, boolean>,
  moduleKey: SidebarModuleKey
): SidebarItem[] {
  const items: SidebarItem[] = [];
  for (const node of nodes) {
    if (node.type === 'item') {
      const mod = getModuleByKey(moduleKey, node.moduleId);
      if (!mod || !permissionsMap[node.moduleId]) continue;
      items.push({
        name: mod.name,
        href: mod.path,
        icon: resolveSidebarIcon(mod.icon),
        description: mod.description ?? '',
        moduleId: mod.id,
      });
    } else {
      const children = buildModuleNodes(node.children, permissionsMap, moduleKey);
      if (children.length === 0) continue;
      if (node.name === '__flat__') {
        items.push(...children);
      } else {
        items.push({
          name: node.name,
          icon: resolveSidebarIcon(node.icon),
          description: '',
          children,
        });
      }
    }
  }
  return items;
}

export default function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
  const sidebarContext = useSidebarContext();
  const pathname = usePathname();
  const router = useRouter();
  const { currentCompany, currentArea, currentSector, sectors, setSector, areas, setArea } = useCompany();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { canAccessAdministration, canAccessMaintenance, canAccessProduction } = useAreaPermissions();
  const [overlayClickable, setOverlayClickable] = React.useState(false);
  const [showFeedback, setShowFeedback] = React.useState(false);
  const [isSidebarEditMode, setIsSidebarEditMode] = React.useState(false);
  const [favoritesOpen, setFavoritesOpen] = React.useState(true);

  // Admins de empresa (rol contiene 'ADMIN') pueden editar el sidebar
  // Cubre: ADMINISTRADOR, ADMIN, ADMIN_ENTERPRISE, SUPERADMIN, ADMINISTRATOR, ADMIN EMPRESA
  const canModifySidebar = (user?.role ?? '').toUpperCase().includes('ADMIN');

  // Favoritos — por usuario, visibles en todos los módulos
  const { favorites, isFavorite, toggleFavorite } = useSidebarFavorites();
  const allLeafItems = useMemo(() => [...getAllLeafItems(), ...HARDCODED_ITEMS], []);
  const favoriteItems = useMemo(
    () => allLeafItems.filter((i) => favorites.includes(i.moduleId)),
    [allLeafItems, favorites]
  );

  // Áreas que soportan edición de sidebar
  const areaName = currentArea?.name;
  const isEditableArea = areaName === 'Administración' || areaName === 'Mantenimiento' || areaName === 'Producción';
  const editModeModuleOnly: SidebarModuleKey | undefined =
    areaName === 'Mantenimiento' ? 'mantenimiento' :
    areaName === 'Producción' ? 'produccion' :
    undefined;
  
  // Permitir que el overlay sea clickeable solo después de que el sidebar esté completamente abierto (solo móvil)
  React.useEffect(() => {
    if (isOpen && typeof window !== 'undefined' && window.innerWidth < 768) {
      const timer = setTimeout(() => setOverlayClickable(true), 300);
      return () => clearTimeout(timer);
    } else {
      setOverlayClickable(false);
    }
  }, [isOpen]);
  
  // Filtrar sectores según el rol del usuario
  // Si es supervisor, solo mostrar su sector asignado
  const availableSectors = React.useMemo(() => {
    if (!user || !sectors || sectors.length === 0) return [];
    
    const userRole = user.role?.toUpperCase() || '';
    const isSupervisor = userRole === 'SUPERVISOR';
    
    // Si es supervisor y tiene un sectorId asignado, solo mostrar ese sector
    if (isSupervisor && user.sectorId) {
      const sectorId = String(user.sectorId);
      return sectors.filter(sector => sector.id === sectorId);
    }
    
    // Para administradores y otros roles, mostrar todos los sectores
    return sectors;
  }, [user, sectors]);

  // Filtrar áreas según los permisos del usuario
  const availableAreas = React.useMemo(() => {
    if (!areas || areas.length === 0) return [];
    
    return areas.filter(area => {
      if (area.name === 'Administración') {
        return canAccessAdministration;
      }
      if (area.name === 'Mantenimiento') {
        return canAccessMaintenance;
      }
      if (area.name === 'Producción') {
        return canAccessProduction;
      }
      // Para otras áreas, permitir acceso por defecto
      return true;
    });
  }, [areas, canAccessAdministration, canAccessMaintenance, canAccessProduction]);
  
  // Sincronizar el área del contexto con el pathname actual
  // Esto corrige el caso donde localStorage tiene un área distinta a la URL actual (ej: recarga en /mantenimiento con área "Administración" en localStorage)
  useEffect(() => {
    if (!areas || areas.length === 0 || !pathname) return;

    const areaNameByPath = pathname.startsWith('/mantenimiento')
      ? 'Mantenimiento'
      : pathname.startsWith('/administracion')
        ? 'Administración'
        : pathname.startsWith('/produccion')
          ? 'Producción'
          : null;

    if (!areaNameByPath) return;

    const currentName = currentArea?.name?.trim();
    if (currentName === areaNameByPath) return;

    const correctArea = areas.find(a => a.name.trim() === areaNameByPath);
    if (correctArea) {
      setArea(correctArea);
    }
  }, [pathname, areas, currentArea?.name, setArea]);

  // Asegurar que el supervisor tenga su sector asignado seleccionado
  useEffect(() => {
    if (!user || !sectors || sectors.length === 0 || !currentArea) return;
    
    const userRole = user.role?.toUpperCase() || '';
    const isSupervisor = userRole === 'SUPERVISOR';
    
    // Si es supervisor y tiene un sectorId asignado
    if (isSupervisor && user.sectorId) {
      const sectorId = String(user.sectorId);
      // Si no hay sector seleccionado o el sector seleccionado no es el asignado
      if (!currentSector || currentSector.id !== sectorId) {
        const assignedSector = sectors.find(s => s.id === sectorId);
        if (assignedSector) {
          setSector(assignedSector);
        }
      }
    }
  }, [user, sectors, currentArea, currentSector, setSector]);
  
  // Módulos habilitados para la empresa
  const { areAllModulesEnabled, loading: modulesLoading } = useModules();

  // Helper para verificar si un item del sidebar está habilitado según módulos
  const isModuleItemEnabled = useCallback((href: string | undefined): boolean => {
    if (!href) return true; // Items sin href (grupos) siempre visibles
    const requiredModules = SIDEBAR_MODULE_MAP[href];
    if (!requiredModules) return true; // Sin restricción de módulo
    return areAllModulesEnabled(requiredModules);
  }, [areAllModulesEnabled]);

  // ViewMode - para restringir módulos que requieren T2
  const { mode: viewMode } = useViewMode();
  const isT2Active = viewMode === 'E';

  // Permisos de navegación
  const {
    canAccessTasks,
    canAccessPermissions,
    canAccessUsers,
    canAccessReports,
    canAccessSettings,
    canAccessAdminDashboard,
    canAccessWorkOrders,
    canAccessMaintenances,
    canAccessMaintenanceMachines,
    canAccessMobileUnits,
    canAccessWorkStations,
    canAccessPanol,
    canAccessMaintenanceReports,
    canAccessSales,
    canAccessSalesDashboard,
    canAccessClients,
    canAccessProducts,
    canAccessQuotes,
    canAccessSalesModule,
    canAccessCosts,
    canAccessControls,
    canAccessCargas,
    canAccessProductionMachines,
    canAccessVehicles,
    canAccessPersonalGroup,
    canAccessVentasGroup,
    canAccessCostosGroup,
    // Producción
    canAccessProductionDashboard,
    canAccessProductionOrders,
    canAccessProductionPartes,
    canAccessProductionParadas,
    canAccessProductionCalidad,
    canAccessProductionRutinas,
    canAccessProductionConfig,
    canAccessWorkCenters,
    canAccessShifts,
    canAccessReasonCodes,
    canAccessProductionReports,
    // Almacén
    canAccessAlmacen,
    canAccessAlmacenDashboard,
    canAccessAlmacenInventario,
    canAccessAlmacenSolicitudes,
    canAccessAlmacenDespachos,
    canAccessAlmacenDevoluciones,
    canAccessAlmacenReservas,
    isLoading: permissionsLoading
  } = useNavigationPermissions();

  // Config dinámica del sidebar de Ventas por empresa
  const { data: companySidebarConfig } = useCompanySidebarConfig();

  // ─── Permission maps por módulo ─────────────────────────────────────────────

  const ventasPermissionsMap = useMemo((): Record<string, boolean> => ({
    'ventas.dashboard': canAccessSalesDashboard,
    'ventas.clientes': canAccessClients,
    'ventas.productos': canAccessProducts,
    'ventas.listas-precios': canAccessSalesModule,
    'ventas.zonas': canAccessSalesModule,
    'ventas.condiciones-pago': canAccessSalesModule,
    'ventas.configuracion': canAccessSalesModule,
    'ventas.vendedores': canAccessSalesModule,
    'ventas.liquidaciones': canAccessSalesModule,
    'ventas.cotizaciones': canAccessQuotes,
    'ventas.notas-pedido': canAccessQuotes,
    'ventas.ordenes': canAccessSalesModule,
    'ventas.ordenes-carga': canAccessSalesModule,
    'ventas.entregas': canAccessSalesModule,
    'ventas.entregas-rutas': canAccessSalesModule,
    'ventas.turnos': canAccessSalesModule,
    'ventas.comprobantes': canAccessSalesModule,
    'ventas.cobranzas': canAccessSalesModule,
    'ventas.aprobacion-pagos': canAccessSalesModule,
    'ventas.valores': canAccessSalesModule,
    'ventas.cuenta-corriente': canAccessSalesModule,
    'ventas.disputas': canAccessSalesModule,
    'ventas.alertas': canAccessSalesModule,
    'ventas.reportes': canAccessSalesModule,
  }), [canAccessSalesDashboard, canAccessClients, canAccessProducts, canAccessQuotes, canAccessSalesModule]);

  const comprasPermissionsMap = useMemo((): Record<string, boolean> => ({
    'compras.dashboard': true, 'compras.torre-control': true, 'compras.pedidos': true,
    'compras.ordenes': true, 'compras.proveedores': true, 'compras.cuentas-corrientes': true,
    'compras.comprobantes': true, 'compras.stock': true, 'compras.stock-kardex': true,
    'compras.stock-ajustes': true, 'compras.stock-transferencias': true,
    'compras.stock-reposicion': true, 'compras.solicitudes': true,
    'compras.devoluciones': true, 'compras.historial': true,
  }), []);

  const tesoreriaPermissionsMap = useMemo((): Record<string, boolean> => ({
    'tesoreria.posicion': true, 'tesoreria.cajas': true, 'tesoreria.bancos': true,
    'tesoreria.cheques': true, 'tesoreria.transferencias': true, 'tesoreria.flujo-caja': true,
  }), []);

  const nominasPermissionsMap = useMemo((): Record<string, boolean> => ({
    'nominas.dashboard': true, 'nominas.empleados': true, 'nominas.gremios': true,
    'nominas.sectores': true, 'nominas.configuracion': true, 'nominas.componentes': true,
    'nominas.adelantos': true, 'nominas.liquidaciones': true,
  }), []);

  const almacenPermissionsMap = useMemo((): Record<string, boolean> => ({
    'almacen.dashboard': canAccessAlmacenDashboard,
    'almacen.inventario': canAccessAlmacenInventario,
    'almacen.solicitudes': canAccessAlmacenSolicitudes,
    'almacen.despachos': canAccessAlmacenDespachos,
    'almacen.devoluciones': canAccessAlmacenDevoluciones,
    'almacen.reservas': canAccessAlmacenReservas,
    'almacen.movimientos': true,
  }), [canAccessAlmacenDashboard, canAccessAlmacenInventario, canAccessAlmacenSolicitudes, canAccessAlmacenDespachos, canAccessAlmacenDevoluciones, canAccessAlmacenReservas]);


  // Estado para controlar el grupo desplegable
  const [openGroups, setOpenGroups] = useState<{[key:string]:boolean}>({});
  
  // Ref para trackear si hay dropdowns abiertos DENTRO del sidebar
  const hasOpenDropdownRef = React.useRef(false);
  const sidebarRef = React.useRef<HTMLDivElement>(null);
  
  // Monitorear dropdowns abiertos SOLO DENTRO DEL SIDEBAR para evitar que se cierre
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const checkForOpenDropdowns = () => {
      if (typeof document === 'undefined' || !sidebarRef.current) return;
      
      // Solo buscar menús abiertos DENTRO del sidebar
      const openMenus = sidebarRef.current.querySelectorAll('[role="menu"][data-state="open"]');
      const hasOpen = openMenus.length > 0;
      hasOpenDropdownRef.current = hasOpen;
      
      // Si hay un dropdown abierto DENTRO del sidebar, mantener sidebar abierto
      if (hasOpen) {
        if (!isOpen && typeof window !== 'undefined' && window.innerWidth >= 768) {
          setIsOpen(true);
        }
      }
    };
    
    // Verificar periódicamente si hay dropdowns abiertos (muy frecuente para detección inmediata)
    const interval = setInterval(checkForOpenDropdowns, 25);
    
    // También observar cambios en el DOM del sidebar
    const observer = new MutationObserver(() => {
      checkForOpenDropdowns();
    });
    
    if (sidebarRef.current) {
      observer.observe(sidebarRef.current, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-state']
    });
    }
    
    // Verificación inicial
    checkForOpenDropdowns();
    
    return () => {
      clearInterval(interval);
      observer.disconnect();
    };
  }, [isOpen, setIsOpen]);
  
  // Prefetch todas las rutas disponibles al montar el sidebar
  useEffect(() => {
    const prefetchRoutes = [
      '/mantenimiento/dashboard',
      '/mantenimiento/ordenes',
      '/mantenimiento/mantenimientos',
      '/mantenimiento/maquinas',
      '/mantenimiento/unidades-moviles',
      '/mantenimiento/puestos-trabajo',
      '/panol',
      '/mantenimiento/reportes',
      '/administracion/dashboard',
      '/administracion/agenda',
      '/administracion/permisos',
      '/administracion/usuarios',
      '/maquinas',
      '/vehicles',
      '/produccion/dashboard'
    ];
    
    // Prefetch todas las rutas en paralelo después de un pequeño delay
    const timer = setTimeout(() => {
      prefetchRoutes.forEach(route => {
        router.prefetch(route);
      });
    }, 500);
    
    return () => clearTimeout(timer);
  }, [router]);

  const { setNavigating } = useNavigation();

  // Función para navegar inmediatamente y activar el indicador de carga
  const handleNavigation = useCallback((href?: string, e?: React.MouseEvent) => {
    if (!href || href === '#' || href === pathname) return;
    
    e?.preventDefault();
    e?.stopPropagation();
    
    // Activar indicador de navegación ANTES de navegar
    setNavigating(true);
    
    // Cerrar sidebar en móvil
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsOpen(false);
    }
    
    // Navegar inmediatamente usando router.push
    startTransition(() => {
      router.push(href);
    });
  }, [pathname, setNavigating, router, setIsOpen]);
  
  // Función para cerrar el sidebar en móvil al hacer clic en un enlace (memoizada)
  const handleLinkClick = useCallback((href?: string, e?: React.MouseEvent<HTMLAnchorElement>) => {
    // Usar handleNavigation para navegación inmediata
    handleNavigation(href, e);
  }, [handleNavigation]);

  // Handler para prefetch al hacer hover sobre un enlace
  const handleLinkHover = useCallback((href: string) => {
    if (href && href !== '#') {
      router.prefetch(href);
    }
  }, [router]);

  // Handler optimizado para cambio de área (memoizado)
  const handleAreaChange = useCallback((area: any) => {
    if (currentArea?.id === area.id) return;

    // Intentar restaurar el último sector usado en esta área
    let lastSector: any = null;
    if (typeof window !== 'undefined' && area.id) {
      const saved = localStorage.getItem(`lastSector_area_${area.id}`);
      if (saved) {
        try { lastSector = JSON.parse(saved); } catch { /* ignore */ }
      }
    }

    // Determinar la ruta de destino
    let targetRoute = '/sectores';
    if (area.name === 'Administración') {
      targetRoute = '/administracion/dashboard';
    } else if (area.name === 'Mantenimiento') {
      targetRoute = lastSector ? '/mantenimiento/dashboard' : '/sectores';
    } else if (area.name === 'Producción') {
      targetRoute = lastSector ? '/produccion/dashboard' : '/sectores';
    }

    // Cambiar el área ANTES de redirigir para evitar flash del área anterior
    setArea(area);

    // Restaurar sector si había uno guardado, sino limpiar
    if (lastSector) {
      setSector(lastSector);
    } else {
      setSector(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('currentSector');
      }
    }

    // Usar router.replace para evitar agregar al historial
    router.replace(targetRoute);
  }, [currentArea?.id, setSector, setArea, router]);

  // Handler optimizado para cambio de sector (memoizado)
  const handleSectorChange = useCallback((sector: any) => {
    setSector(sector);
    const areaName = currentArea?.name.trim().toUpperCase();
    if (areaName === 'MANTENIMIENTO') {
      router.replace('/mantenimiento/dashboard');
    } else if (areaName === 'PRODUCCIÓN') {
      router.replace('/produccion/dashboard');
    }
  }, [currentArea?.name, setSector, router]);
  
  // Cerrar el sidebar cuando cambia la ruta en móvil
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768 && isOpen) {
      setIsOpen(false);
    }
  }, [pathname]); // Solo ejecutar cuando cambia pathname, no cuando cambia isOpen
  
  // ========== SIDEBAR MANTENIMIENTO — configurable por empresa ==========

  // Todos los items de mantenimiento son visibles (el filtro de área ya garantiza acceso)
  const mantenimientoPermissionsMap = useMemo((): Record<string, boolean> => ({
    'mant.dashboard': true,
    'mant.fallas': true,
    'mant.ordenes': true,
    'mant.soluciones': true,
    'mant.preventivo': true,
    'mant.maquinas': canAccessMaintenanceMachines,
    'mant.unidades-moviles': canAccessMobileUnits,
    'mant.puestos-trabajo': canAccessWorkStations,
    'mant.panol': canAccessPanol,
    'mant.panol-repuestos': canAccessPanol,
    'mant.panol-movimientos': canAccessPanol,
    'mant.panol-dashboard': canAccessPanol,
    'mant.panol-conteo': canAccessPanol,
    'mant.panol-rapido': canAccessPanol,
    'mant.ideas': true,
    'mant.costos': true,
    'mant.health-score': true,
    'mant.fmea': true,
    'mant.criticidad': true,
    'mant.monitoreo': true,
    'mant.ptw': true,
    'mant.loto': true,
    'mant.moc': true,
    'mant.skills': true,
    'mant.contadores': true,
    'mant.calibracion': true,
    'mant.lubricacion': true,
    'mant.contratistas': true,
    'mant.conocimiento': true,
    'mant.lecciones': true,
    'mant.garantias': true,
    'mant.paradas': true,
    'mant.qr': true,
    'mant.puntos-medicion': true,
  }), [canAccessMaintenanceMachines, canAccessMobileUnits, canAccessWorkStations, canAccessPanol]);

  const mantenimientoItems = useMemo(() => {
    const config = getEffectiveConfig('mantenimiento', companySidebarConfig ?? null);
    return buildModuleNodes(config.groups, mantenimientoPermissionsMap, 'mantenimiento');
  }, [companySidebarConfig, mantenimientoPermissionsMap]);

  // Grupo Personal desplegable para administración
  // Tareas was moved into the unified Agenda page
  const personalItems: SidebarItem[] = [
    ...(canAccessPermissions ? [{
      name: 'Permisos & Roles',
      href: '/administracion/permisos',
      icon: Shield,
      description: 'Configurar roles de usuario y permisos del sistema',
      moduleId: 'sys.permisos',
    }] : []),
    ...(canAccessUsers ? [{
      name: 'Gestión de Usuarios',
      href: '/administracion/usuarios',
      icon: Users,
      description: 'Administrar usuarios, roles y permisos',
      moduleId: 'sys.usuarios',
    }] : []),
  ];

  // Grupos Ventas, Compras, Tesorería, Nóminas, Almacén — configurables por empresa
  const ventasItems = useMemo(() => {
    const config = getEffectiveConfig('ventas', companySidebarConfig ?? null);
    return buildModuleNodes(config.groups, ventasPermissionsMap, 'ventas');
  }, [companySidebarConfig, ventasPermissionsMap]);

  const comprasItems = useMemo(() => {
    const config = getEffectiveConfig('compras', companySidebarConfig ?? null);
    return buildModuleNodes(config.groups, comprasPermissionsMap, 'compras');
  }, [companySidebarConfig, comprasPermissionsMap]);

  const tesoreriaItems = useMemo(() => {
    const config = getEffectiveConfig('tesoreria', companySidebarConfig ?? null);
    return buildModuleNodes(config.groups, tesoreriaPermissionsMap, 'tesoreria');
  }, [companySidebarConfig, tesoreriaPermissionsMap]);

  const nominasItems = useMemo(() => {
    const config = getEffectiveConfig('nominas', companySidebarConfig ?? null);
    return buildModuleNodes(config.groups, nominasPermissionsMap, 'nominas');
  }, [companySidebarConfig, nominasPermissionsMap]);

  const almacenItems = useMemo(() => {
    const config = getEffectiveConfig('almacen', companySidebarConfig ?? null);
    return buildModuleNodes(config.groups, almacenPermissionsMap, 'almacen');
  }, [companySidebarConfig, almacenPermissionsMap]);

  const produccionPermissionsMap = useMemo((): Record<string, boolean> => ({
    'prod.dashboard': canAccessProductionDashboard,
    'prod.ordenes': canAccessProductionOrders,
    'prod.registro-diario': canAccessProductionPartes,
    'prod.paradas': canAccessProductionParadas,
    'prod.rutinas': canAccessProductionRutinas,
    'prod.calidad': canAccessProductionCalidad,
    'prod.centros-trabajo': canAccessWorkCenters,
    'prod.turnos': canAccessShifts,
    'prod.codigos-motivo': canAccessReasonCodes,
    'prod.plantillas-rutinas': canAccessProductionRutinas,
    'prod.recursos': canAccessProductionConfig,
    'prod.reportes': canAccessProductionReports,
    'prod.maquinas': canAccessProductionMachines,
    'prod.vehiculos': canAccessVehicles,
  }), [canAccessProductionDashboard, canAccessProductionOrders, canAccessProductionPartes, canAccessProductionParadas, canAccessProductionRutinas, canAccessProductionCalidad, canAccessWorkCenters, canAccessShifts, canAccessReasonCodes, canAccessProductionConfig, canAccessProductionReports, canAccessProductionMachines, canAccessVehicles]);

  const produccionItems = useMemo(() => {
    const config = getEffectiveConfig('produccion', companySidebarConfig ?? null);
    return buildModuleNodes(config.groups, produccionPermissionsMap, 'produccion');
  }, [companySidebarConfig, produccionPermissionsMap]);

  // Mapa unificado de todos los permisos (para custom groups que mezclan módulos)
  // IMPORTANTE: debe definirse DESPUÉS de todos los permissionsMap individuales
  const allPermissionsMap = useMemo(() => ({
    ...ventasPermissionsMap,
    ...comprasPermissionsMap,
    ...tesoreriaPermissionsMap,
    ...nominasPermissionsMap,
    ...almacenPermissionsMap,
    ...mantenimientoPermissionsMap,
    ...produccionPermissionsMap,
  }), [ventasPermissionsMap, comprasPermissionsMap, tesoreriaPermissionsMap, nominasPermissionsMap, almacenPermissionsMap, mantenimientoPermissionsMap, produccionPermissionsMap]);

  // Módulo de Costos integrado - requiere T2 (modo Extendido)
  const costosItems: SidebarItem[] = [
    ...(canAccessCosts && isT2Active ? [{
      name: 'Módulo de Costos',
      href: '/administracion/costos',
      icon: Calculator,
      description: 'Sistema completo de gestión, análisis y proyección de costos de fabricación',
      moduleId: 'sys.costos',
    }] : [])
  ];

  // Helper: obtiene el label de una sección (usa override si existe)
  const getSL = (key: string, defaultLabel: string) =>
    companySidebarConfig?.sectionLabels?.[key] ?? defaultLabel;

  // Secciones custom creadas por el admin (mezclan items de cualquier módulo)
  const customGroupSections = useMemo((): Record<string, SidebarItem | null> => {
    const groups = companySidebarConfig?.customGroups ?? {};
    const result: Record<string, SidebarItem | null> = {};
    for (const [id, group] of Object.entries(groups)) {
      const items = group.items
        .map(moduleId => {
          if (allPermissionsMap[moduleId] === false) return null;
          const mod = getModuleItemById(moduleId);
          if (!mod) return null;
          return { name: mod.name, href: mod.path, icon: resolveSidebarIcon(mod.icon), description: mod.description ?? '' };
        })
        .filter((item): item is SidebarItem => item !== null);
      result[id] = items.length > 0 ? {
        name: group.name,
        icon: resolveSidebarIcon(group.icon),
        description: '',
        children: items,
      } : null;
    }
    return result;
  }, [companySidebarConfig, allPermissionsMap]);

  // Mapa de secciones top-level reordenables (null = sin acceso o sin items)
  const adminModuleSectionsMap: Record<string, SidebarItem | null> = {
    ...customGroupSections,
    personal: canAccessPersonalGroup && personalItems.length > 0 ? {
      name: getSL('personal', 'Personal'), icon: User,
      description: 'Gestión de tareas, permisos y usuarios',
      children: personalItems,
    } : null,
    ventas: canAccessVentasGroup && ventasItems.length > 0 ? {
      name: getSL('ventas', 'Ventas'), icon: DollarSign,
      description: 'Sistema completo de gestión de ventas',
      children: ventasItems,
    } : null,
    costos: canAccessCostosGroup && costosItems.length > 0 ? {
      name: getSL('costos', 'Costos'), icon: Calculator,
      description: 'Sistema completo de gestión y análisis de costos',
      children: costosItems,
    } : null,
    compras: comprasItems.length > 0 ? {
      name: getSL('compras', 'Compras'), icon: ShoppingCart,
      description: 'Sistema completo de gestión de compras y proveedores',
      children: comprasItems,
    } : null,
    tesoreria: tesoreriaItems.length > 0 ? {
      name: getSL('tesoreria', 'Tesorería'), icon: Wallet,
      description: 'Gestión de cajas, bancos y cheques',
      children: tesoreriaItems,
    } : null,
    nominas: nominasItems.length > 0 ? {
      name: getSL('nominas', 'Nóminas'), icon: Users,
      description: 'Gestión de sueldos, liquidaciones y adelantos',
      children: nominasItems,
    } : null,
    almacen: canAccessAlmacen && almacenItems.length > 0 ? {
      name: getSL('almacen', 'Almacén'), icon: Warehouse,
      description: 'Despachos, solicitudes y control de inventario',
      children: almacenItems,
    } : null,
    automatizaciones: {
      name: getSL('automatizaciones', 'Automatizaciones'),
      href: '/administracion/automatizaciones',
      icon: Zap,
      description: 'Reglas y acciones automáticas del sistema',
      moduleId: 'sys.automatizaciones',
    },
    controles: canAccessControls ? {
      name: getSL('controles', 'Controles'),
      href: '/administracion/controles',
      icon: Shield,
      description: 'Dashboard de sistemas de control y gestión fiscal',
      moduleId: 'sys.controles',
    } : null,
    cargas: canAccessCargas ? {
      name: getSL('cargas', 'Cargas'),
      href: '/administracion/cargas',
      icon: Package,
      description: 'Gestión de camiones y cargas de viguetas',
      moduleId: 'sys.cargas',
    } : null,
  };

  const adminTopModuleOrder = getAdminModuleOrder(companySidebarConfig ?? null);
  const orderedModuleSections = adminTopModuleOrder
    .map(key => adminModuleSectionsMap[key] ?? null)
    .filter((s): s is SidebarItem => s !== null);

  const administracionItems: SidebarItem[] = [
    ...(canAccessAdminDashboard ? [{
      name: 'Dashboard',
      href: '/administracion/dashboard',
      icon: LayoutDashboard,
      description: 'Panel de control con estadísticas generales de la empresa',
      moduleId: 'sys.dashboard',
    }] : []),
    {
      name: 'Agenda',
      href: '/administracion/agenda',
      icon: CalendarClock,
      description: 'Agenda personal, tareas, tareas fijas y seguimiento',
      moduleId: 'sys.agenda',
    },
    // Todo lo demás es reordenable por el admin de empresa
    ...orderedModuleSections,
  ];


  // Memoizar los items de navegación para evitar recálculos innecesarios
  const navItems = useMemo(() => {
    const areaName = currentArea?.name.trim().toUpperCase();
    switch (areaName) {
      case 'MANTENIMIENTO':
        return mantenimientoItems;
      case 'ADMINISTRACIÓN':
        return administracionItems;
      case 'PRODUCCIÓN':
        return produccionItems;
      default:
        return [];
    }
  }, [currentArea?.name, mantenimientoItems, administracionItems, produccionItems]);

  // Si no hay área o compañía seleccionada, mostrar mensaje
  if (!currentArea || !currentCompany) {
    return null;
  }

  // Si los permisos están cargando, mostrar un estado de carga
  if (permissionsLoading) {
    return (
      <aside className={cn('fixed top-0 left-0 z-30 h-full w-64 border-r shadow-sm',
        theme === 'light' ? 'bg-background border-border' : 'bg-black border-white/5'
      )}>
        <div className="flex flex-col h-full">
          <div className="h-16 px-4 flex items-center justify-center border-b">
            <div className={cn('animate-pulse h-6 w-32 rounded',
              theme === 'light' ? 'bg-muted' : 'bg-background/10'
            )}></div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </div>
      </aside>
    );
  }

  return (
      <TooltipProvider delayDuration={0} skipDelayDuration={0} disableHoverableContent={false}>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[90] bg-black/60 md:hidden"
          style={{
            height: '100dvh', 
            pointerEvents: overlayClickable ? 'auto' : 'none'
          }}
          onClick={(e) => {
            // No cerrar si hay un dropdown/select abierto dentro del sidebar
            if (sidebarContext?.preventClose) return;
            // Solo cerrar si se hace click directamente en el overlay y el overlay es clickeable
            if (overlayClickable && e.target === e.currentTarget) {
              setIsOpen(false);
            }
          }}
        />
      )}
      
      {/* Sidebar */}
      <aside
        data-sidebar
        ref={sidebarRef}
        className={cn(
          "transition-all duration-100 ease-out flex-shrink-0",
          // En desktop: siempre al lado, oculto con width 0
          // En móvil: fixed overlay a pantalla completa
          isOpen ? "w-60" : "w-0",
          // Posicionamiento: fixed en móvil, relative en desktop
          "fixed left-0 top-0 md:relative md:left-auto md:top-auto",
          // En desktop: usar margin top y bottom para alinearse con el padding del contenedor
          "md:mt-3 md:mb-3",
          // Altura: en móvil 100dvh (full screen), en desktop con espacios
          "h-[100dvh] md:h-[calc(100vh-1.5rem)]",
          "overflow-hidden",
          // En móvil: z-index MUY alto para estar sobre todo, en desktop: normal
          "z-[100] md:z-auto",
          // En móvil: translate para ocultar, en desktop: no translate
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          // En móvil: fondo sólido para evitar que se vea contenido detrás
          "bg-sidebar md:bg-transparent"
        )}
        style={{
          width: isOpen ? 'var(--sidebar-width, 240px)' : '0px',
          transition: 'width 100ms ease-out, transform 100ms ease-out'
        }}
        onMouseLeave={() => {
          // Solo cerrar si fue abierto por hover y no hay un dropdown abierto
          if (sidebarContext?.isHoverOpen && !sidebarContext?.preventClose) {
            sidebarContext.setIsHoverOpen(false);
            setIsOpen(false);
          }
        }}
        onClick={(e) => {
          // Detener propagación para todos los clics dentro del sidebar
          // Esto evita que el clic cierre el sidebar cuando se hace clic dentro
          e.stopPropagation();
        }}
      >
        <div
          className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground overflow-visible pt-2 md:pt-0 md:rounded-xl"
        >
          <div className="flex flex-col h-full">
            {/* Montaje oculto para poder abrir el modal de notificaciones desde el dropdown */}
            <div className="hidden">
              <NotificationPanel triggerClassName="hidden" />
            </div>

            {/* Buscador de páginas global */}
            <PageSearch />

            {/* Header: User Profile */}
            <div className="flex flex-col px-2 py-1.5 md:px-3 border-b border-sidebar-ring/20">
              <DropdownMenu onOpenChange={(open) => sidebarContext?.setPreventClose(open)}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    data-sidebar="menu-button"
                    data-size="lg"
                    className={cn(
                      "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left outline-none ring-sidebar-ring transition-[width,height,padding] focus-visible:ring-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sm",
                      isOpen ? "h-8" : "h-8 w-8 justify-center p-0"
                    )}
                  >
                    <span className="relative flex shrink-0 overflow-hidden h-8 w-8 rounded-lg">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user?.avatar || undefined} alt={user?.name || 'Usuario'} />
                        <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs">
                          {user?.name?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </span>
                    {isOpen && (
                      <>
                        <div className="grid flex-1 text-left text-sm leading-tight">
                          <span className="truncate font-medium text-sidebar-foreground">{user?.name || 'Usuario'}</span>
                          <span className="text-sidebar-foreground/70 truncate text-xs">{user?.email || 'user@example.com'}</span>
                        </div>
                        <ModeIndicator className="shrink-0" />
                        <EllipsisVertical className="ml-auto h-4 w-4 text-sidebar-foreground/70 shrink-0" />
                      </>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56">
                  <div className="text-sm p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <span className="relative flex shrink-0 overflow-hidden h-8 w-8 rounded-lg">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user?.avatar || undefined} alt={user?.name || 'Usuario'} />
                          <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs">
                            {user?.name?.charAt(0).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                      </span>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-medium">{user?.name || 'Usuario'}</span>
                        <span className="text-muted-foreground truncate text-xs">{user?.email || 'user@example.com'}</span>
                      </div>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <div role="group">
                    <DropdownMenuItem onClick={() => {
                      const configHref = currentArea?.name === 'Administración'
                        ? '/administracion/configuracion'
                        : currentArea?.name === 'Mantenimiento'
                        ? '/mantenimiento/configuracion'
                        : '/configuracion';
                      router.push(`${configHref}?tab=profile`);
                    }}>
                      <CircleUser className="h-4 w-4" />
                      <span>Cuenta</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('orvit:notifications:open'));
                        return;
                      }
                      const configHref = currentArea?.name === 'Administración'
                        ? '/administracion/configuracion'
                        : currentArea?.name === 'Mantenimiento'
                        ? '/mantenimiento/configuracion'
                        : '/configuracion';
                      router.push(`${configHref}?tab=notifications`);
                    }}>
                      <Bell className="h-4 w-4" />
                      <span>Notificaciones</span>
                    </DropdownMenuItem>
                    {canModifySidebar && (
                      <DropdownMenuItem onClick={() => setIsSidebarEditMode(true)}>
                        <Settings className="h-4 w-4" />
                        <span>Configurar sidebar</span>
                      </DropdownMenuItem>
                    )}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={async () => {
                      try {
                        await logout();
                      } catch (error) {
                        console.error('Error al cerrar sesión:', error);
                      }
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Cerrar sesión</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {/* Content area */}
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
            {isOpen ? (
              <div className="space-y-2 px-2 md:px-3 pt-2">
                {/* Selector de Sector Rápido - Integrado en el header */}
                {currentArea && currentArea.name !== 'Administración' && availableSectors && availableSectors.length > 0 && (
                  <DropdownMenu onOpenChange={(open) => sidebarContext?.setPreventClose(open)}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-between h-8 px-2 rounded-md transition-all duration-200 text-sm font-normal",
                          "bg-sidebar-accent/50 border-sidebar-ring/30 hover:bg-sidebar-accent hover:border-sidebar-ring/50",
                          "text-sidebar-foreground"
                        )}
                        disabled={availableSectors.length === 1 && user?.role?.toUpperCase() === 'SUPERVISOR'}
                      >
                        <span className="truncate">
                          {currentSector ? currentSector.name : 'Seleccionar sector'}
                        </span>
                        {availableSectors.length > 1 && (
                          <ChevronDown className="h-3 w-3 flex-shrink-0 opacity-50 ml-1.5" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    {availableSectors.length > 1 && (
                      <DropdownMenuContent align="start" className="w-56">
                        <DropdownMenuLabel className="text-sm">Sectores disponibles</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {availableSectors.map((sector) => (
                          <DropdownMenuItem
                            key={sector.id}
                            onClick={() => handleSectorChange(sector)}
                            className={cn(
                              "text-sm",
                              currentSector?.id === sector.id && 'bg-accent'
                            )}
                          >
                            {sector.name}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => router.push('/areas')}
                          className="text-sm"
                        >
                          Cambiar de área
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    )}
                  </DropdownMenu>
                )}

                {/* Selector de Área - Solo para Administración */}
                {currentArea && currentArea.name === 'Administración' && availableAreas && availableAreas.length > 0 && (
                  <DropdownMenu onOpenChange={(open) => sidebarContext?.setPreventClose(open)}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className={cn(
                          "w-full justify-between h-8 px-3 rounded-full text-sm font-normal",
                          "bg-sidebar-accent/40 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                        aria-label="Cambiar área"
                      >
                        <span className="min-w-0 truncate flex items-baseline gap-1.5">
                          <span className="text-xs text-sidebar-foreground/60 leading-none">Área:</span>
                          <span className="truncate leading-none">{currentArea.name}</span>
                        </span>
                        {availableAreas.length > 1 && (
                          <ChevronDown className="h-3 w-3 flex-shrink-0 opacity-50 ml-1.5" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    {availableAreas.length > 1 && (
                      <DropdownMenuContent align="start" className="w-56">
                        <DropdownMenuLabel className="text-sm">Áreas disponibles</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {availableAreas.map((area) => (
                          <DropdownMenuItem
                            key={area.id}
                            onClick={() => handleAreaChange(area)}
                            className={cn(
                              "text-sm",
                              currentArea?.id === area.id && 'bg-accent'
                            )}
                          >
                            {area.name}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => router.push('/areas')}
                          className="text-sm"
                        >
                          Ver todas las áreas
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    )}
                  </DropdownMenu>
                )}

                {/* Separador fino: contexto (selectores) vs navegación */}
                {(
                  (currentArea && currentArea.name !== 'Administración' && availableSectors && availableSectors.length > 0) ||
                  (currentArea && currentArea.name === 'Administración' && availableAreas && availableAreas.length > 0)
                ) && (
                  <div className="h-px w-full bg-sidebar-ring/20" />
                )}

                {/* Nav items - Después del selector de administración */}
                <div className="relative flex w-full min-w-0 flex-col mt-2">
    {/* Edit mode */}
                  {isSidebarEditMode && isEditableArea ? (
                    <SidebarEditMode
                      config={companySidebarConfig}
                      onExitEditMode={() => setIsSidebarEditMode(false)}
                      moduleOnly={editModeModuleOnly}
                    />
                  ) : (
                  <div className="w-full text-sm">
                    <ul className="flex w-full min-w-0 flex-col gap-0.5">
              {navItems.map((item) => {
                // Función helper para determinar si un item está activo de forma precisa
                const checkIsActive = (href: string | undefined): boolean => {
                  if (!href) return false;
                  // Comparación exacta primero
                  if (pathname === href) return true;
                  // Si la ruta actual empieza con el href, verificar que el siguiente carácter sea '/' o el final
                  // Esto evita que '/administracion/costos' active '/administracion/compras'
                  if (pathname.startsWith(href)) {
                    const nextChar = pathname[href.length];
                    return !nextChar || nextChar === '/' || nextChar === '?';
                  }
                  return false;
                };

                // Si el item tiene hijos y el sidebar está cerrado, mostrar como menú desplegable
                if (item.children && Array.isArray(item.children) && !isOpen) {
                  // Abrir automáticamente el grupo si un hijo está activo (pero SIN marcar el padre como activo)
                  const hasActiveChild = item.children.some(child => checkIsActive(child.href));
                  const isOpenGroup = openGroups[item.name] ?? hasActiveChild;
                  
                  return (
                    <li key={item.name} className="flex flex-col items-center">
                      {/* Botón del grupo padre */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            className={cn(
                              'h-8 w-8 flex items-center justify-center rounded-md',
                              'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                            )}
                            onClick={() => setOpenGroups((prev) => ({ ...prev, [item.name]: !isOpenGroup }))}
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right" sideOffset={8}>
                          {item.name}
                        </TooltipContent>
                      </Tooltip>
                      
                      {/* Hijos del grupo (solo cuando está abierto) */}
                      {isOpenGroup && (
                        <ul className="mt-1 w-full flex flex-col items-center gap-0.5">
                          {item.children.map((child: SidebarItem, childIndex: number) => {
                            const isActive = checkIsActive(child.href);
                            return (
                              <li key={`${item.name}-${child.href || childIndex}`} className="flex justify-center">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Link
                                      href={child.href || '#'}
                                      prefetch={true}
                                      onMouseEnter={() => handleLinkHover(child.href || '')}
                                      onClick={() => handleLinkClick(child.href)}
                                      className={cn(
                                        'flex items-center justify-center w-8 h-8 rounded-md transition-colors',
                                        'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                                        isActive && 'bg-sidebar-primary text-sidebar-primary-foreground'
                                      )}
                                    >
                                      <child.icon className="h-4 w-4" />
                                    </Link>
                                  </TooltipTrigger>
                                  <TooltipContent side="right" sideOffset={8}>
                                    {child.name}
                                  </TooltipContent>
                                </Tooltip>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                }

                // Si el item tiene hijos (children), renderizar como grupo desplegable SOLO si isOpen
                if (item.children && Array.isArray(item.children) && isOpen) {
                  // Abrir automáticamente el grupo si un hijo está activo (pero SIN marcar el padre como activo)
                  const hasActiveChild = item.children.some(child => {
                    if (!child.href) return false;
                    if (pathname === child.href) return true;
                    if (pathname.startsWith(child.href)) {
                      const nextChar = pathname[child.href.length];
                      return !nextChar || nextChar === '/' || nextChar === '?';
                    }
                    return false;
                  });
                  const isOpenGroup = openGroups[item.name] ?? hasActiveChild;
                  
                  return (
                    <li key={item.name}>
                      <div className="flex items-center">
                          <button
                              type="button"
                          className={cn(
                                'flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors w-full text-left',
                                'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                          )}
                          onClick={() => setOpenGroups((prev) => ({ ...prev, [item.name]: !isOpenGroup }))}
                        >
                              <item.icon className={cn('h-4 w-4 shrink-0 text-sidebar-foreground')} />
                              <span>{item.name}</span>
                            </button>
                        <button
                              className="ml-auto px-1.5 focus:outline-none"
                          onClick={e => {
                            e.stopPropagation();
                            setOpenGroups((prev) => ({ ...prev, [item.name]: !isOpenGroup }));
                          }}
                          tabIndex={-1}
                          aria-label={isOpenGroup ? 'Cerrar grupo' : 'Abrir grupo'}
                        >
                              <ChevronRight
                                className={cn(
                                  'h-3.5 w-3.5 text-sidebar-foreground/70 transition-transform',
                                  isOpenGroup ? 'rotate-90' : ''
                                )}
                              />
                        </button>
                      </div>
                      {isOpenGroup && (
                        <ul className="pl-6 flex flex-col gap-0.5 mt-1">
                          {item.children.map((child: SidebarItem, childIdx: number) => {
                            // Si el hijo tiene sus propios children, renderizar como subgrupo
                            if (child.children && Array.isArray(child.children)) {
                              const hasActiveSubchild = child.children.some((subchild: SidebarItem) => {
                                if (!subchild.href) return false;
                                if (pathname === subchild.href) return true;
                                if (pathname.startsWith(subchild.href)) {
                                  const nextChar = pathname[subchild.href.length];
                                  return !nextChar || nextChar === '/' || nextChar === '?';
                                }
                                return false;
                              });
                              const isSubgroupOpen = openGroups[child.name] ?? hasActiveSubchild;

                              return (
                                <li key={`${item.name}-child-${child.name}`}>
                                  <div className="flex items-center">
                                    <button
                                      type="button"
                                      className={cn(
                                        'flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors w-full text-left',
                                        'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                                      )}
                                      onClick={() => setOpenGroups((prev) => ({ ...prev, [child.name]: !isSubgroupOpen }))}
                                    >
                                      <child.icon className="h-4 w-4 shrink-0" />
                                      <span className="flex-1">{child.name}</span>
                                    </button>
                                    <button
                                      className="ml-auto px-1.5 focus:outline-none"
                                      onClick={e => {
                                        e.stopPropagation();
                                        setOpenGroups((prev) => ({ ...prev, [child.name]: !isSubgroupOpen }));
                                      }}
                                      tabIndex={-1}
                                      aria-label={isSubgroupOpen ? 'Cerrar subgrupo' : 'Abrir subgrupo'}
                                    >
                                      <ChevronRight
                                        className={cn(
                                          'h-3.5 w-3.5 text-sidebar-foreground/70 transition-transform',
                                          isSubgroupOpen ? 'rotate-90' : ''
                                        )}
                                      />
                                    </button>
                                  </div>
                                  {isSubgroupOpen && (
                                    <ul className="pl-6 flex flex-col gap-0.5 mt-1">
                                      {child.children.map((subchild: SidebarItem, subchildIdx: number) => {
                                        const isSubchildActive = checkIsActive(subchild.href);
                                        return (
                                          <li key={`${child.name}-subchild-${subchild.href || subchildIdx}`} className="group/item flex items-center">
                                            <Link
                                              href={subchild.href || '#'}
                                              prefetch={true}
                                              onMouseEnter={() => handleLinkHover(subchild.href || '')}
                                              onClick={(e) => handleLinkClick(subchild.href, e)}
                                              className={cn(
                                                "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors flex-1",
                                                "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                                isSubchildActive && "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm",
                                                isSubchildActive && "border-l-2 border-l-sidebar-primary-foreground"
                                              )}
                                            >
                                              <subchild.icon className="h-4 w-4 shrink-0" />
                                              <span className="flex-1">{subchild.name}</span>
                                              {subchild.badge !== undefined && subchild.badge !== 0 && (
                                                <span className={cn(
                                                  "ml-auto px-1.5 py-0.5 text-xs font-medium rounded-full min-w-[18px] text-center",
                                                  subchild.badgeVariant === 'destructive' && "bg-destructive text-destructive-foreground",
                                                  subchild.badgeVariant === 'warning' && "bg-warning-muted text-warning-muted-foreground",
                                                  (!subchild.badgeVariant || subchild.badgeVariant === 'default') && "bg-sidebar-primary/20 text-sidebar-primary-foreground"
                                                )}>
                                                  {subchild.badge}
                                                </span>
                                              )}
                                            </Link>
                                            {subchild.moduleId && (
                                              <button
                                                className={cn(
                                                  'p-1 mr-0.5 rounded hover:bg-sidebar-accent transition-opacity shrink-0',
                                                  isFavorite(subchild.moduleId) ? 'opacity-100' : 'opacity-0 group-hover/item:opacity-100'
                                                )}
                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(subchild.moduleId!); }}
                                                title={isFavorite(subchild.moduleId) ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                                              >
                                                <Star className={cn('h-3 w-3', isFavorite(subchild.moduleId) ? 'fill-yellow-400 text-yellow-400' : 'text-sidebar-foreground/40')} />
                                              </button>
                                            )}
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  )}
                                </li>
                              );
                            }

                            // Si no tiene children, renderizar como link normal
                            const isActive = checkIsActive(child.href);
                            return (
                              <li key={`${item.name}-child-${child.href || childIdx}`} className="group/item flex items-center">
                                <Link
                                  href={child.href || '#'}
                                  prefetch={true}
                                  onMouseEnter={() => handleLinkHover(child.href || '')}
                                  onClick={(e) => handleLinkClick(child.href, e)}
                                      className={cn(
                                        "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors flex-1",
                                        "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                        isActive && "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm",
                                        isActive && "border-l-2 border-l-sidebar-primary-foreground"
                                      )}
                                  >
                                      <child.icon className="h-4 w-4 shrink-0" />
                                      <span className="flex-1">{child.name}</span>
                                      {child.badge !== undefined && child.badge !== 0 && (
                                        <span className={cn(
                                          "ml-auto px-1.5 py-0.5 text-xs font-medium rounded-full min-w-[18px] text-center",
                                          child.badgeVariant === 'destructive' && "bg-destructive text-destructive-foreground",
                                          child.badgeVariant === 'warning' && "bg-warning-muted text-warning-muted-foreground",
                                          (!child.badgeVariant || child.badgeVariant === 'default') && "bg-sidebar-primary/20 text-sidebar-primary-foreground"
                                        )}>
                                          {child.badge}
                                        </span>
                                      )}
                                </Link>
                                {child.moduleId && (
                                  <button
                                    className={cn(
                                      'p-1 mr-0.5 rounded hover:bg-sidebar-accent transition-opacity shrink-0',
                                      isFavorite(child.moduleId) ? 'opacity-100' : 'opacity-0 group-hover/item:opacity-100'
                                    )}
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(child.moduleId!); }}
                                    title={isFavorite(child.moduleId) ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                                  >
                                    <Star className={cn('h-3 w-3', isFavorite(child.moduleId) ? 'fill-yellow-400 text-yellow-400' : 'text-sidebar-foreground/40')} />
                                  </button>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                }
                // Si no tiene hijos, renderizar como antes
                // Si el item no tiene href, no marcarlo como activo
                const isActive = item.href ? checkIsActive(item.href) : false;

                if (!isOpen) {
                  return (
                    <li key={item.href} className="flex justify-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link
                            href={item.href || '#'}
                            prefetch={true}
                            onMouseEnter={() => handleLinkHover(item.href || '')}
                            onClick={(e) => handleLinkClick(item.href, e)}
                            className={cn(
                              'flex items-center justify-center w-8 h-8 rounded-md transition-colors',
                              'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                              isActive && 'bg-sidebar-primary text-sidebar-primary-foreground'
                            )}
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent side="right" sideOffset={8}>
                          {item.name}
                        </TooltipContent>
                      </Tooltip>
                    </li>
                  );
                }

                return (
                  <li key={item.href} className="group/item flex items-center">
                    <Link
                      href={item.href || '#'}
                      prefetch={true}
                      onMouseEnter={() => handleLinkHover(item.href || '')}
                      onClick={(e) => handleLinkClick(item.href, e)}
                          className={cn(
                            "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors flex-1",
                            "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                            isActive && "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm",
                            isActive && "border-l-2 border-l-sidebar-primary-foreground"
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="flex-1">{item.name}</span>
                          {item.badge !== undefined && item.badge !== 0 && (
                            <span className={cn(
                              "ml-auto px-1.5 py-0.5 text-xs font-medium rounded-full min-w-[18px] text-center",
                              item.badgeVariant === 'destructive' && "bg-destructive text-destructive-foreground",
                              item.badgeVariant === 'warning' && "bg-warning-muted text-warning-muted-foreground",
                              (!item.badgeVariant || item.badgeVariant === 'default') && "bg-sidebar-primary/20 text-sidebar-primary-foreground"
                            )}>
                              {item.badge}
                            </span>
                          )}
                    </Link>
                    {item.moduleId && (
                      <button
                        className={cn(
                          'p-1 mr-0.5 rounded hover:bg-sidebar-accent transition-opacity shrink-0',
                          isFavorite(item.moduleId) ? 'opacity-100' : 'opacity-0 group-hover/item:opacity-100'
                        )}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(item.moduleId!); }}
                        title={isFavorite(item.moduleId) ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                      >
                        <Star className={cn('h-3 w-3', isFavorite(item.moduleId) ? 'fill-yellow-400 text-yellow-400' : 'text-sidebar-foreground/40')} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
                  </div>
                  )} {/* end edit mode conditional */}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1 px-2">
                {/* Selector de Sector Compacto cuando sidebar está cerrado */}
                {currentArea && currentArea.name !== 'Administración' && availableSectors && availableSectors.length > 0 && currentSector && (
                  <DropdownMenu onOpenChange={(open) => sidebarContext?.setPreventClose(open)}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className={cn(
                          "w-8 h-8 p-0 rounded-md transition-colors",
                          "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                        title={currentSector.name}
                        disabled={availableSectors.length === 1 && user?.role?.toUpperCase() === 'SUPERVISOR'}
                      >
                        <Factory className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    {availableSectors.length > 1 && (
                      <DropdownMenuContent align="start" className="w-56">
                        <DropdownMenuLabel className="text-sm">Sectores disponibles</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {availableSectors.map((sector) => (
                          <DropdownMenuItem
                            key={sector.id}
                            onClick={() => handleSectorChange(sector)}
                              className={cn(
                              "text-sm",
                              currentSector?.id === sector.id && 'bg-accent'
                            )}
                          >
                            {sector.name}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => router.push('/areas')}
                          className="text-sm"
                        >
                          Cambiar de área
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    )}
                  </DropdownMenu>
                )}

                {/* Selector de Área Compacto cuando sidebar está cerrado - Solo para Administración */}
                {currentArea && currentArea.name === 'Administración' && availableAreas && availableAreas.length > 0 && (
                  <DropdownMenu onOpenChange={(open) => sidebarContext?.setPreventClose(open)}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className={cn(
                          "w-8 h-8 p-0 rounded-md transition-colors",
                          "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                        title="Cambiar área"
                        aria-label="Cambiar área"
                      >
                        <Building2 className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    {availableAreas.length > 1 && (
                      <DropdownMenuContent align="start" className="w-56">
                        <DropdownMenuLabel className="text-sm">Áreas disponibles</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {availableAreas.map((area) => (
                          <DropdownMenuItem
                            key={area.id}
                            onClick={() => handleAreaChange(area)}
                              className={cn(
                              "text-sm",
                              currentArea?.id === area.id && 'bg-accent'
                            )}
                          >
                            {area.name}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => router.push('/areas')}
                          className="text-sm"
                        >
                          Ver todas las áreas
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    )}
                  </DropdownMenu>
                )}
              </div>
            )}
          </div>

          {/* Bottom section: Configuración, Buscar y Perfil */}
            <div className={cn(
              "flex flex-col gap-1 p-2 md:p-3 mt-auto"
            )}>
                {isOpen ? (
              <div className="flex flex-col gap-1">
                {/* ─── Favoritos (bottom, colapsable) ─── */}
                {favoriteItems.length > 0 && (
                  <div className="mb-0.5">
                    <button
                      type="button"
                      onClick={() => setFavoritesOpen(o => !o)}
                      className="flex items-center gap-1.5 px-2 py-1 w-full text-xs text-sidebar-foreground/50 font-medium hover:text-sidebar-foreground transition-colors rounded-md hover:bg-sidebar-accent group/favhdr"
                    >
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span className="flex-1 text-left">Favoritos</span>
                      <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", !favoritesOpen && "-rotate-90")} />
                    </button>
                    {favoritesOpen && (
                      <ul className="flex flex-col gap-0.5 mt-0.5">
                        {favoriteItems.map((favItem) => {
                          const FavIcon = resolveSidebarIcon(favItem.icon);
                          const favActive = (() => {
                            const href = favItem.path;
                            if (pathname === href) return true;
                            if (pathname.startsWith(href)) {
                              const nc = pathname[href.length];
                              return !nc || nc === '/' || nc === '?';
                            }
                            return false;
                          })();
                          return (
                            <li key={favItem.moduleId} className="group/fav flex items-center">
                              <Link
                                href={favItem.path}
                                prefetch={true}
                                className={cn(
                                  'flex items-center gap-2 px-2 py-1.5 rounded-md text-sm flex-1 transition-colors',
                                  'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                                  favActive && 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                                )}
                              >
                                <FavIcon className="h-4 w-4 shrink-0" />
                                <span className="flex-1 truncate">{favItem.name}</span>
                              </Link>
                              <button
                                type="button"
                                className="opacity-0 group-hover/fav:opacity-100 p-1 mr-1 rounded hover:bg-sidebar-accent transition-opacity shrink-0"
                                onClick={(e) => { e.preventDefault(); toggleFavorite(favItem.moduleId); }}
                                title="Quitar de favoritos"
                              >
                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}

                {/* Divisor antes de Feedback */}
                <div className="h-[1.5px] bg-sidebar-ring/40 mx-1 my-1.5" />

                {/* Feedback */}
                <button
                  type="button"
                  onClick={() => setShowFeedback(true)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors w-full text-left"
                >
                  <MessageSquarePlus className="h-4 w-4 shrink-0" />
                  <span>Feedback</span>
                </button>

              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                {/* ─── Favoritos colapsado ─── */}
                {favoriteItems.map((favItem) => {
                  const FavIcon = resolveSidebarIcon(favItem.icon);
                  const favActive = (() => {
                    const href = favItem.path;
                    if (pathname === href) return true;
                    if (pathname.startsWith(href)) {
                      const nc = pathname[href.length];
                      return !nc || nc === '/' || nc === '?';
                    }
                    return false;
                  })();
                  return (
                    <Tooltip key={favItem.moduleId}>
                      <TooltipTrigger asChild>
                        <Link
                          href={favItem.path}
                          prefetch={true}
                          className={cn(
                            'flex items-center justify-center w-8 h-8 rounded-md transition-colors',
                            'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                            favActive && 'bg-sidebar-primary text-sidebar-primary-foreground'
                          )}
                        >
                          <FavIcon className="h-4 w-4" />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right" sideOffset={8}>{favItem.name}</TooltipContent>
                    </Tooltip>
                  );
                })}
                {favoriteItems.length > 0 && <div className="w-5 h-px bg-sidebar-ring/20 my-0.5" />}

                {/* Feedback (collapsed) */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setShowFeedback(true)}
                      className="flex items-center justify-center w-8 h-8 rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                    >
                      <MessageSquarePlus className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={12}>
                    Feedback
                  </TooltipContent>
                </Tooltip>

                  </div>
                )}
              </div>

            {/* Company - very bottom */}
            {currentCompany && (
              <div className="flex items-center gap-1 px-2 pb-2 pt-1 md:px-3 border-t border-sidebar-ring/20">
                <a
                  href="/dashboard"
                  className="flex flex-1 min-w-0 items-center gap-2 overflow-hidden rounded-md px-2 py-1.5 text-left outline-none ring-sidebar-ring transition-colors focus-visible:ring-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  {(() => {
                    const company = currentCompany as any;
                    const isDark = theme === 'dark';
                    const logoUrl = isDark
                      ? (company?.logoDark || company?.logo)
                      : (company?.logoLight || company?.logo);

                    return logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={`Logo de ${currentCompany.name}`}
                        className="h-6 w-6 shrink-0 object-contain rounded-md"
                      />
                    ) : (
                      <Building2 className="h-6 w-6 shrink-0 text-sidebar-foreground" />
                    );
                  })()}
                  {isOpen && (
                    <span className="flex-1 min-w-0 text-sm font-semibold text-sidebar-foreground truncate">
                      {currentCompany.name}
                    </span>
                  )}
                </a>
              </div>
            )}

        </div>
        </div>
      </aside>

      <FeedbackModal open={showFeedback} onOpenChange={setShowFeedback} />
    </TooltipProvider>
  );
}