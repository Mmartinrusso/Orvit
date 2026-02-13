'use client';

import React, { useEffect, useState, useMemo, useCallback, startTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useCompany } from '@/contexts/CompanyContext';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Cog,
  Truck,
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
  DollarSign,
  Zap,
  BookOpen,
  Target,
  Factory,
  ShoppingCart,
  ShoppingBag,
  Receipt,
  FileCheck,
  TrendingDown,
  AlertTriangle,
  Link2,
  MapPin,
  RefreshCw,
  CalendarClock,
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
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigationPermissions } from '@/hooks/use-navigation-permissions';
import { useAreaPermissions } from '@/hooks/use-area-permissions';
import { useNavigation } from '@/contexts/NavigationContext';
import NotificationPanel from '@/components/notifications/NotificationPanel';
import { PageSearch } from '@/components/layout/PageSearch';
import { useSidebarContext } from '@/contexts/SidebarContext';
import { FeedbackModal } from '@/components/feedback/FeedbackModal';
import { useModules, SIDEBAR_MODULE_MAP } from '@/contexts/ModulesContext';
import {
  TooltipProvider,
} from '@/components/ui/tooltip';
import { SidebarNavSection } from './sidebar/SidebarNavSection';
import { SidebarFooter } from './sidebar/SidebarFooter';
import type { SidebarItem } from './sidebar/types';
import type { SidebarProps } from './sidebar/types';

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

  // Estado para controlar el grupo desplegable
  const [openGroups, setOpenGroups] = useState<{[key:string]:boolean}>({});
  
  // Ref para trackear si hay dropdowns abiertos DENTRO del sidebar
  const hasOpenDropdownRef = React.useRef(false);
  const sidebarRef = React.useRef<HTMLDivElement>(null);
  
  // Monitorear dropdowns abiertos SOLO DENTRO DEL SIDEBAR para evitar que se cierre
  React.useEffect(() => {
    if (typeof window === 'undefined' || !sidebarRef.current) return;

    const sidebar = sidebarRef.current;

    const checkForOpenDropdowns = () => {
      const openMenus = sidebar.querySelectorAll('[role="menu"][data-state="open"]');
      const hasOpen = openMenus.length > 0;
      hasOpenDropdownRef.current = hasOpen;

      // Si hay un dropdown abierto DENTRO del sidebar, mantener sidebar abierto
      if (hasOpen && !isOpen && window.innerWidth >= 768) {
        setIsOpen(true);
      }
    };

    // Event delegation: detectar clicks en triggers con data-state
    const handleClick = (e: MouseEvent) => {
      const trigger = (e.target as HTMLElement).closest('[data-state]');
      if (trigger) {
        // Defer para que el DOM se actualice con el nuevo data-state
        requestAnimationFrame(checkForOpenDropdowns);
      }
    };

    sidebar.addEventListener('click', handleClick);

    // MutationObserver para cambios de data-state (cubre teclado, programático, etc.)
    const observer = new MutationObserver((mutations) => {
      // Solo reaccionar si alguna mutación cambió data-state a/desde "open"
      const isRelevant = mutations.some((m) => {
        if (m.type !== 'attributes' || m.attributeName !== 'data-state') return false;
        const el = m.target as HTMLElement;
        return el.dataset.state === 'open' || m.oldValue === 'open';
      });
      if (isRelevant) {
        checkForOpenDropdowns();
      }
    });

    observer.observe(sidebar, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-state'],
      attributeOldValue: true,
    });

    // Verificación inicial
    checkForOpenDropdowns();

    return () => {
      sidebar.removeEventListener('click', handleClick);
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
      console.log('[SIDEBAR] pathname cambió, cerrando sidebar. pathname:', pathname);
      setIsOpen(false);
    }
  }, [pathname]); // Solo ejecutar cuando cambia pathname, no cuando cambia isOpen
  
  // ========== NUEVA ESTRUCTURA SIDEBAR V2 ==========

  // V2: Órdenes ahora es item único con vista unificada (Lista/Bandeja/Calendario)
  // Las rutas viejas (/dispatcher, /mis-ots, /calendario) redirigen a ?view= params
  // const ordenesItems - REMOVIDO - ya no se usa grupo colapsable

  // ========== V2: ESTRUCTURA SIDEBAR MANTENIMIENTO ==========

  // Grupo CORRECTIVO - contiene Fallas y Órdenes
  // Fallas: vista unificada con tabs (Reportes | Reincidencias | Duplicados)
  const fallasItems: SidebarItem[] = [
    {
      name: 'Reportes',
      href: '/mantenimiento/fallas',
      icon: AlertTriangle,
      description: 'Registro y gestión de fallas reportadas'
    },
    {
      name: 'Reincidencias',
      href: '/mantenimiento/fallas?view=reincidencias',
      icon: RefreshCw,
      description: 'Análisis de fallas recurrentes'
    },
    {
      name: 'Duplicados',
      href: '/mantenimiento/fallas?view=duplicados',
      icon: Link2,
      description: 'Gestión de reportes duplicados'
    },
  ];

  // Items del grupo CORRECTIVO (Fallas + Órdenes + Soluciones) - siempre visibles
  const correctivoItems: SidebarItem[] = [
    {
      name: 'Fallas',
      href: '/mantenimiento/fallas',
      icon: AlertTriangle,
      description: 'Reportes e incidentes'
    },
    {
      name: 'Órdenes de trabajo',
      href: '/mantenimiento/ordenes',
      icon: ClipboardList,
      description: 'Gestión de órdenes de trabajo (Lista/Bandeja/Calendario)'
    },
    {
      name: 'Soluciones',
      href: '/mantenimiento/soluciones',
      icon: Lightbulb,
      description: 'Base de conocimiento de soluciones'
    },
  ];

  // PREVENTIVO - Item único con tabs internos (?view=)
  // Tabs: Hoy | Calendario | Planes | Checklists | Métricas
  // NO tiene children en sidebar - los tabs están dentro de la página

  // Items del grupo "Activos" - siempre visibles en Mantenimiento
  const activosItems: SidebarItem[] = [
    {
      name: 'Máquinas',
      href: '/mantenimiento/maquinas',
      icon: Cog,
      description: 'Lista completa de máquinas'
    },
    {
      name: 'Unidades Móviles',
      href: '/mantenimiento/unidades-moviles',
      icon: Truck,
      description: 'Vehículos y equipos móviles'
    },
    {
      name: 'Puestos de trabajo',
      href: '/mantenimiento/puestos-trabajo',
      icon: Building2,
      description: 'Puestos de trabajo e instructivos'
    },
  ];

  // Items del grupo PAÑOL - Inventario de herramientas y repuestos
  const panolItems: SidebarItem[] = [
    {
      name: 'Inventario',
      href: '/panol',
      icon: Package,
      description: 'Ver todos los items del pañol'
    },
    {
      name: 'Repuestos',
      href: '/panol/repuestos',
      icon: Cog,
      description: 'Gestión de repuestos'
    },
    {
      name: 'Movimientos',
      href: '/panol/movimientos',
      icon: ArrowRightLeft,
      description: 'Historial de entradas y salidas'
    },
    {
      name: 'Dashboard',
      href: '/panol/dashboard',
      icon: BarChart3,
      description: 'Métricas y analytics'
    },
    {
      name: 'Conteo Físico',
      href: '/panol/conteo',
      icon: ClipboardCheck,
      description: 'Auditoría de inventario'
    },
    {
      name: 'Acciones Rápidas',
      href: '/panol/rapido',
      icon: ScanLine,
      description: 'Escaneo QR y operaciones rápidas'
    },
  ];

  // ========== GRUPOS CMMS AVANZADOS ==========

  // Grupo CONFIABILIDAD: Health Score, FMEA, Criticidad, Monitoreo
  const confiabilidadItems: SidebarItem[] = [
    {
      name: 'Health Score',
      href: '/mantenimiento/health-score',
      icon: HeartPulse,
      description: 'Indicador de salud de máquinas'
    },
    {
      name: 'FMEA',
      href: '/mantenimiento/fmea',
      icon: TrendingDown,
      description: 'Análisis de modos de falla y efectos'
    },
    {
      name: 'Criticidad',
      href: '/mantenimiento/criticidad',
      icon: Target,
      description: 'Matriz de criticidad de activos'
    },
    {
      name: 'Monitoreo',
      href: '/mantenimiento/monitoreo',
      icon: Activity,
      description: 'Monitoreo de condición y sensores'
    },
  ];

  // Grupo SEGURIDAD: PTW, LOTO, MOC
  const seguridadItems: SidebarItem[] = [
    {
      name: 'PTW',
      href: '/mantenimiento/ptw',
      icon: Shield,
      description: 'Permisos de trabajo (Permit to Work)'
    },
    {
      name: 'LOTO',
      href: '/mantenimiento/loto',
      icon: Lock,
      description: 'Bloqueo y etiquetado (Lockout-Tagout)'
    },
    {
      name: 'MOC',
      href: '/mantenimiento/moc',
      icon: RefreshCw,
      description: 'Gestión del cambio (Management of Change)'
    },
  ];

  // Grupo GESTIÓN: Skills, Contadores, Calibración, Lubricación, Contratistas
  const gestionItems: SidebarItem[] = [
    {
      name: 'Skills',
      href: '/mantenimiento/skills',
      icon: Target,
      description: 'Matriz de habilidades y certificaciones'
    },
    {
      name: 'Contadores',
      href: '/mantenimiento/contadores',
      icon: Clock,
      description: 'Contadores de uso y mantenimiento'
    },
    {
      name: 'Calibración',
      href: '/mantenimiento/calibracion',
      icon: Gauge,
      description: 'Gestión de calibraciones de equipos'
    },
    {
      name: 'Lubricación',
      href: '/mantenimiento/lubricacion',
      icon: Droplet,
      description: 'Puntos y rutas de lubricación'
    },
    {
      name: 'Contratistas',
      href: '/mantenimiento/contratistas',
      icon: HardHat,
      description: 'Gestión de contratistas externos'
    },
  ];

  // Grupo DOCUMENTACIÓN: Conocimiento, Lecciones, Garantías, Paradas, QR, Puntos Medición
  const documentacionItems: SidebarItem[] = [
    {
      name: 'Conocimiento',
      href: '/mantenimiento/conocimiento',
      icon: BookOpen,
      description: 'Base de conocimiento y documentación'
    },
    {
      name: 'Lecciones',
      href: '/mantenimiento/lecciones',
      icon: GraduationCap,
      description: 'Base de lecciones aprendidas'
    },
    {
      name: 'Garantías',
      href: '/mantenimiento/garantias',
      icon: ShieldCheck,
      description: 'Gestión de garantías y reclamos'
    },
    {
      name: 'Paradas',
      href: '/mantenimiento/paradas',
      icon: Construction,
      description: 'Gestión de paradas y turnarounds'
    },
    {
      name: 'QR Codes',
      href: '/mantenimiento/qr',
      icon: QrCode,
      description: 'Generación y gestión de códigos QR'
    },
    {
      name: 'Puntos Medición',
      href: '/mantenimiento/puntos-medicion',
      icon: Thermometer,
      description: 'Puntos de medición y rondas de inspección'
    },
  ];

  // ========== ESTRUCTURA PRINCIPAL MANTENIMIENTO ==========
  const mantenimientoItems: SidebarItem[] = [
    // ===== CORE - Siempre visible =====
    {
      name: 'Dashboard',
      href: '/mantenimiento/dashboard',
      icon: LayoutDashboard,
      description: 'KPIs, tareas urgentes, alertas del sector'
    },
    {
      name: 'Correctivo',
      icon: Zap,
      description: 'Fallas, órdenes y soluciones',
      children: correctivoItems
    },
    {
      name: 'Preventivo',
      href: '/mantenimiento/preventivo',
      icon: CalendarClock,
      description: 'Mantenimiento preventivo y programado'
    },
    {
      name: 'Activos',
      icon: Cog,
      description: 'Máquinas, vehículos y puestos de trabajo',
      children: activosItems
    },
    {
      name: 'Pañol',
      icon: Package,
      description: 'Inventario de repuestos y herramientas',
      children: panolItems
    },
    {
      name: 'Ideas',
      href: '/mantenimiento/ideas',
      icon: Lightbulb,
      description: 'Libro de ideas y sugerencias de mejora'
    },
    {
      name: 'Costos',
      href: '/mantenimiento/costos',
      icon: DollarSign,
      description: 'Análisis de costos de mantenimiento'
    },
    // ===== CMMS AVANZADO - Grupos colapsables =====
    {
      name: 'Confiabilidad',
      icon: TrendingUp,
      description: 'Health Score, FMEA, Criticidad, Monitoreo',
      children: confiabilidadItems
    },
    {
      name: 'Seguridad',
      icon: ShieldAlert,
      description: 'PTW, LOTO, MOC',
      children: seguridadItems
    },
    {
      name: 'Gestión',
      icon: Users,
      description: 'Skills, Contadores, Calibración, Lubricación',
      children: gestionItems
    },
    {
      name: 'Documentación',
      icon: FileText,
      description: 'Conocimiento, Lecciones, Garantías, QR',
      children: documentacionItems
    },
  ];

  // Grupo Personal desplegable para administración
  // Tareas was moved into the unified Agenda page
  const personalItems: SidebarItem[] = [
    ...(canAccessPermissions ? [{
      name: 'Permisos & Roles',
      href: '/administracion/permisos',
      icon: Shield,
      description: 'Configurar roles de usuario y permisos del sistema'
    }] : []),
    ...(canAccessUsers ? [{
      name: 'Gestión de Usuarios',
      href: '/administracion/usuarios',
      icon: Users,
      description: 'Administrar usuarios, roles y permisos'
    }] : []),
  ];

  // Grupo Ventas desplegable para administración
  // Reorganizado con 4 subgrupos anidados para mejor UX:
  // 1. Dashboard (Overview)
  // 2. Maestros (Master Data) - GRUPO ANIDADO
  // 3. Ciclo de Ventas (O2C Process) - GRUPO ANIDADO
  // 4. Facturación (Billing & Collections) - GRUPO ANIDADO
  // 5. Análisis (Analytics & Reports) - GRUPO ANIDADO
  const ventasItems: SidebarItem[] = [
    // Dashboard - siempre al inicio
    ...(canAccessSalesDashboard ? [{
      name: 'Resumen',
      href: '/administracion/ventas',
      icon: LayoutDashboard,
      description: 'Panel de control y KPIs'
    }] : []),

    // 🗂️ GRUPO 1: MAESTROS (Master Data)
    ...(canAccessClients || canAccessProducts || canAccessSalesModule ? [{
      name: 'Maestros',
      icon: Database,
      description: 'Datos maestros del módulo',
      children: [
        ...(canAccessClients ? [{
          name: 'Clientes',
          href: '/administracion/ventas/clientes',
          icon: Users,
          description: 'Maestro de clientes'
        }] : []),
        ...(canAccessProducts ? [{
          name: 'Productos',
          href: '/administracion/ventas/productos',
          icon: Package,
          description: 'Catálogo de productos'
        }] : []),
        ...(canAccessSalesModule ? [{
          name: 'Listas de Precios',
          href: '/administracion/ventas/listas-precios',
          icon: DollarSign,
          description: 'Gestión de precios'
        }] : []),
        ...(canAccessSalesModule ? [{
          name: 'Vendedores',
          href: '/administracion/ventas/vendedores',
          icon: User,
          description: 'Equipo de ventas'
        }] : []),
        ...(canAccessSalesModule ? [{
          name: 'Zonas de Venta',
          href: '/administracion/ventas/zonas',
          icon: MapPin,
          description: 'Territorios y zonas'
        }] : []),
        ...(canAccessSalesModule ? [{
          name: 'Condiciones de Pago',
          href: '/administracion/ventas/condiciones-pago',
          icon: Calendar,
          description: 'Términos de pago'
        }] : []),
        ...(canAccessSalesModule ? [{
          name: 'Configuración',
          href: '/administracion/ventas/configuracion',
          icon: Settings,
          description: 'Configuración del módulo'
        }] : [])
      ].filter(item => item !== undefined)
    }] : []),

    // 🔄 GRUPO 2: CICLO DE VENTAS (Order-to-Cash)
    ...(canAccessQuotes || canAccessSalesModule ? [{
      name: 'Ciclo de Ventas',
      icon: RefreshCw,
      description: 'Proceso Order-to-Cash completo',
      children: [
        ...(canAccessQuotes ? [{
          name: 'Cotizaciones',
          href: '/administracion/ventas/cotizaciones',
          icon: FileText,
          description: 'Cotizaciones y presupuestos'
        }] : []),
        ...(canAccessQuotes ? [{
          name: 'Notas de Pedido',
          href: '/administracion/ventas/cotizaciones?tipo=nota_pedido',
          icon: ClipboardList,
          description: 'Pedidos de clientes'
        }] : []),
        ...(canAccessSalesModule ? [{
          name: 'Órdenes de Venta',
          href: '/administracion/ventas/ordenes',
          icon: ShoppingBag,
          description: 'Órdenes confirmadas'
        }] : []),
        ...(canAccessSalesModule ? [{
          name: 'Órdenes de Carga',
          href: '/administracion/ventas/ordenes-carga',
          icon: Boxes,
          description: 'Preparación para despacho'
        }] : []),
        ...(canAccessSalesModule ? [{
          name: 'Entregas',
          icon: Truck,
          description: 'Gestión de entregas',
          children: [
            {
              name: 'Lista de Entregas',
              href: '/administracion/ventas/entregas',
              icon: Truck,
              description: 'Ver todas las entregas'
            },
            {
              name: 'Planificación de Rutas',
              href: '/administracion/ventas/entregas/rutas',
              icon: RouteIcon,
              description: 'Optimizar rutas de entrega'
            }
          ]
        }] : []),
        ...(canAccessSalesModule ? [{
          name: 'Turnos de Retiro',
          href: '/administracion/ventas/turnos',
          icon: CalendarClock,
          description: 'Gestión de turnos pickup'
        }] : [])
      ].filter(item => item !== undefined)
    }] : []),

    // 💰 GRUPO 3: FACTURACIÓN (Billing & Collections)
    ...(canAccessSalesModule ? [{
      name: 'Facturación',
      icon: Receipt,
      description: 'Comprobantes y cobranzas',
      children: [
        {
          name: 'Comprobantes',
          href: '/administracion/ventas/comprobantes',
          icon: FileCheck,
          description: 'Facturas, NC, ND unificados'
        },
        {
          name: 'Cobranzas',
          href: '/administracion/ventas/cobranzas',
          icon: Wallet,
          description: 'Gestión de cobros'
        },
        {
          name: 'Aprobación de Pagos',
          href: '/administracion/ventas/aprobacion-pagos',
          icon: ClipboardCheck,
          description: 'Aprobación de cobros'
        },
        {
          name: 'Gestión de Valores',
          href: '/administracion/ventas/valores',
          icon: CreditCard,
          description: 'Cheques y echeqs'
        },
        {
          name: 'Cuenta Corriente',
          href: '/administracion/ventas/cuenta-corriente',
          icon: BookOpen,
          description: 'Estado de cuenta'
        },
        {
          name: 'Disputas',
          href: '/administracion/ventas/disputas',
          icon: AlertTriangle,
          description: 'Reclamos de clientes'
        }
      ]
    }] : []),

    // 📈 GRUPO 4: ANÁLISIS (Analytics & Reports)
    ...(canAccessSalesModule ? [{
      name: 'Análisis',
      icon: BarChart3,
      description: 'Reportes y análisis',
      children: [
        {
          name: 'Alertas de Riesgo',
          href: '/administracion/ventas/alertas',
          icon: AlertCircle,
          description: 'Alertas crediticias'
        },
        {
          name: 'Reportes',
          href: '/administracion/ventas/reportes',
          icon: FileText,
          description: 'Reportes de ventas'
        }
      ]
    }] : [])
  ];

  // Módulo de Costos integrado
  const costosItems: SidebarItem[] = [
    ...(canAccessCosts ? [{
      name: 'Módulo de Costos',
      href: '/administracion/costos',
      icon: Calculator,
      description: 'Sistema completo de gestión, análisis y proyección de costos de fabricación'
    }] : [])
  ];

  // Grupo Tesorería desplegable para administración
  // Siempre visible - el filtrado T1/T2 se hace en las APIs según ViewMode
  const tesoreriaItems: SidebarItem[] = [
    {
      name: 'Posición',
      href: '/administracion/tesoreria',
      icon: LayoutDashboard,
      description: 'Posición consolidada de fondos'
    },
    {
      name: 'Cajas',
      href: '/administracion/tesoreria/cajas',
      icon: DollarSign,
      description: 'Gestión de cajas de efectivo'
    },
    {
      name: 'Bancos',
      href: '/administracion/tesoreria/bancos',
      icon: Building2,
      description: 'Cuentas bancarias y movimientos'
    },
    {
      name: 'Cheques',
      href: '/administracion/tesoreria/cheques',
      icon: FileCheck,
      description: 'Cartera de cheques'
    },
    {
      name: 'Transferencias',
      href: '/administracion/tesoreria/transferencias',
      icon: ArrowRightLeft,
      description: 'Transferencias internas'
    },
    {
      name: 'Flujo de Caja',
      href: '/administracion/tesoreria/flujo-caja',
      icon: TrendingUp,
      description: 'Proyección de flujo de caja'
    },
  ];

  // Grupo Nóminas desplegable para administración
  const nominasItems: SidebarItem[] = [
    {
      name: 'Dashboard',
      href: '/administracion/nominas',
      icon: LayoutDashboard,
      description: 'Panel de control de nóminas y proyecciones'
    },
    {
      name: 'Empleados',
      href: '/administracion/nominas/empleados',
      icon: UserPlus,
      description: 'Gestión de empleados'
    },
    {
      name: 'Gremios',
      href: '/administracion/nominas/gremios',
      icon: Users,
      description: 'Gremios, categorías y tasas de convenio'
    },
    {
      name: 'Sectores',
      href: '/administracion/nominas/sectores',
      icon: MapPin,
      description: 'Sectores de trabajo'
    },
    {
      name: 'Configuración',
      href: '/administracion/nominas/configuracion',
      icon: Settings,
      description: 'Configuración de nóminas y feriados'
    },
    {
      name: 'Componentes',
      href: '/administracion/nominas/componentes',
      icon: Calculator,
      description: 'Fórmulas y componentes salariales'
    },
    {
      name: 'Adelantos',
      href: '/administracion/nominas/adelantos',
      icon: DollarSign,
      description: 'Adelantos de sueldo'
    },
    {
      name: 'Liquidaciones',
      href: '/administracion/nominas/liquidaciones',
      icon: Receipt,
      description: 'Liquidaciones de sueldos'
    },
  ];

  // Grupo Almacén - Sistema de despachos, solicitudes y control de inventario operativo
  const almacenItems: SidebarItem[] = [
    ...(canAccessAlmacenDashboard ? [{
      name: 'Dashboard',
      href: '/almacen',
      icon: LayoutDashboard,
      description: 'Panel de control de almacén'
    }] : []),
    ...(canAccessAlmacenInventario ? [{
      name: 'Inventario',
      href: '/almacen/inventario',
      icon: PackageSearch,
      description: 'Vista unificada de inventario (suministros + herramientas)'
    }] : []),
    ...(canAccessAlmacenSolicitudes ? [{
      name: 'Solicitudes',
      href: '/almacen/solicitudes',
      icon: ClipboardPen,
      description: 'Solicitudes de material de OT, OP y áreas'
    }] : []),
    ...(canAccessAlmacenDespachos ? [{
      name: 'Despachos',
      href: '/almacen/despachos',
      icon: PackageCheck,
      description: 'Despachos y entregas de material'
    }] : []),
    ...(canAccessAlmacenDevoluciones ? [{
      name: 'Devoluciones',
      href: '/almacen/devoluciones',
      icon: PackageX,
      description: 'Devoluciones de material no utilizado'
    }] : []),
    ...(canAccessAlmacenReservas ? [{
      name: 'Reservas',
      href: '/almacen/reservas',
      icon: Boxes,
      description: 'Reservas activas de stock'
    }] : []),
    {
      name: 'Movimientos',
      href: '/almacen/movimientos',
      icon: ArrowRightLeft,
      description: 'Kardex y historial de movimientos'
    },
  ];

  // Grupo Compras desplegable para administración
  // Siempre visible - el filtrado T1/T2 se hace en las APIs según ViewMode
  const comprasItems: SidebarItem[] = [
    {
      name: 'Dashboard',
      href: '/administracion/compras',
      icon: LayoutDashboard,
      description: 'Panel de control de compras'
    },
    {
      name: 'Torre de Control',
      href: '/administracion/compras/torre-control',
      icon: Gauge,
      description: 'Control centralizado de compras y entregas'
    },
    {
      name: 'Pedidos de Compra',
      href: '/administracion/compras/pedidos',
      icon: ClipboardList,
      description: 'Solicitudes internas con cotizaciones'
    },
    {
      name: 'Órdenes de Compra',
      href: '/administracion/compras/ordenes',
      icon: ShoppingCart,
      description: 'Gestión de órdenes de compra'
    },
    {
      name: 'Proveedores',
      href: '/administracion/compras/proveedores',
      icon: Building2,
      description: 'Gestión de proveedores y contactos'
    },
    {
      name: 'Cuentas Corrientes',
      href: '/administracion/compras/cuentas-corrientes',
      icon: Wallet,
      description: 'Estados de cuenta y saldos de proveedores'
    },
    {
      name: 'Comprobantes',
      href: '/administracion/compras/comprobantes',
      icon: Receipt,
      description: 'Cargar comprobantes de compra'
    },
    {
      name: 'Stock',
      icon: Boxes,
      description: 'Gestión de stock e inventario',
      children: [
        {
          name: 'Inventario',
          href: '/administracion/compras/stock',
          icon: Package,
          description: 'Stock por depósito y alertas'
        },
        {
          name: 'Kardex',
          href: '/administracion/compras/stock/kardex',
          icon: FileText,
          description: 'Historial de movimientos'
        },
        {
          name: 'Ajustes',
          href: '/administracion/compras/stock/ajustes',
          icon: ClipboardCheck,
          description: 'Ajustes de inventario'
        },
        {
          name: 'Transferencias',
          href: '/administracion/compras/stock/transferencias',
          icon: ArrowRightLeft,
          description: 'Transferencias entre depósitos'
        },
        {
          name: 'Reposición',
          href: '/administracion/compras/stock/reposicion',
          icon: Lightbulb,
          description: 'Sugerencias de reposición'
        }
      ]
    },
    {
      name: 'Solicitudes',
      href: '/administracion/compras/solicitudes',
      icon: FileCheck,
      description: 'Solicitudes de compra y aprobaciones'
    },
    {
      name: 'Devoluciones',
      href: '/administracion/compras/devoluciones',
      icon: RefreshCw,
      description: 'Gestión de devoluciones a proveedores'
    },
    {
      name: 'Historial',
      href: '/administracion/compras/historial',
      icon: History,
      description: 'Historial de compras realizadas'
    }
  ];

  const administracionItems: SidebarItem[] = [
    ...(canAccessAdminDashboard ? [{
      name: 'Dashboard',
      href: '/administracion/dashboard',
      icon: LayoutDashboard,
      description: 'Panel de control con estadísticas generales de la empresa'
    }] : []),
    // Agenda - Unifica agenda personal y gestión de tareas
    {
      name: 'Agenda',
      href: '/administracion/agenda',
      icon: CalendarClock,
      description: 'Agenda personal, tareas, tareas fijas y seguimiento'
    },
    ...(canAccessPersonalGroup && personalItems.length > 0 ? [{
      name: 'Personal',
      icon: User,
      description: 'Gestión de tareas, permisos y usuarios',
      children: personalItems
    }] : []),
    ...(canAccessVentasGroup && ventasItems.length > 0 ? [{
      name: 'Ventas',
      icon: DollarSign,
      description: 'Sistema completo de gestión de ventas',
      children: ventasItems
    }] : []),
    ...(canAccessCostosGroup && costosItems.length > 0 ? [{
      name: 'Costos',
      icon: Calculator,
      description: 'Sistema completo de gestión y análisis de costos',
      children: costosItems
    }] : []),
    // Compras - siempre visible, el filtrado T1/T2 se hace en las APIs
    ...(comprasItems.length > 0 ? [{
      name: 'Compras',
      icon: ShoppingCart,
      description: 'Sistema completo de gestión de compras y proveedores',
      children: comprasItems
    }] : []),
    // Tesorería - Gestión de cajas, bancos y cheques
    ...(tesoreriaItems.length > 0 ? [{
      name: 'Tesorería',
      icon: Wallet,
      description: 'Gestión de cajas, bancos y cheques',
      children: tesoreriaItems
    }] : []),
    // Nóminas - Gestión de sueldos y liquidaciones
    ...(nominasItems.length > 0 ? [{
      name: 'Nóminas',
      icon: Users,
      description: 'Gestión de sueldos, liquidaciones y adelantos',
      children: nominasItems
    }] : []),
    // Almacén - Sistema de despachos y control de inventario operativo
    ...(canAccessAlmacen && almacenItems.length > 0 ? [{
      name: 'Almacén',
      icon: Warehouse,
      description: 'Despachos, solicitudes y control de inventario',
      children: almacenItems
    }] : []),
    // Automatizaciones - Motor de reglas y acciones automáticas
    {
      name: 'Automatizaciones',
      href: '/administracion/automatizaciones',
      icon: Zap,
      description: 'Reglas y acciones automáticas del sistema'
    },
    ...(canAccessControls ? [{
      name: 'Controles',
      href: '/administracion/controles',
      icon: Shield,
      description: 'Dashboard de sistemas de control y gestión fiscal'
    }] : []),
    ...(canAccessCargas ? [{
      name: 'Cargas',
      href: '/administracion/cargas',
      icon: Package,
      description: 'Gestión de camiones y cargas de viguetas'
    }] : []),
  ];

  const produccionItems: SidebarItem[] = [
    // Dashboard siempre visible para quien tenga acceso a Producción
    ...(canAccessProductionDashboard ? [{
      name: 'Dashboard',
      href: '/produccion/dashboard',
      icon: LayoutDashboard,
      description: 'KPIs, alertas y resumen de producción'
    }] : []),

    // Grupo Operaciones
    ...((canAccessProductionOrders || canAccessProductionPartes || canAccessProductionParadas || canAccessProductionRutinas) ? [{
      name: 'Operaciones',
      icon: Factory,
      description: 'Gestión operativa de producción',
      children: [
        ...(canAccessProductionOrders ? [{
          name: 'Órdenes',
          href: '/produccion/ordenes',
          icon: ClipboardList,
          description: 'Órdenes de producción'
        }] : []),
        ...(canAccessProductionPartes ? [{
          name: 'Producción del Día',
          href: '/produccion/registro-diario',
          icon: Package,
          description: 'Cargar producción diaria por sector'
        }] : []),
        ...(canAccessProductionParadas ? [{
          name: 'Paradas',
          href: '/produccion/paradas',
          icon: Pause,
          description: 'Registro y análisis de paradas'
        }] : []),
        ...(canAccessProductionRutinas ? [{
          name: 'Rutinas',
          href: '/produccion/rutinas',
          icon: CheckSquare,
          description: 'Checklists operativos'
        }] : []),
      ].filter(item => item !== undefined)
    }] : []),

    // Calidad
    ...(canAccessProductionCalidad ? [{
      name: 'Calidad',
      href: '/produccion/calidad',
      icon: CheckCircle2,
      description: 'Control de calidad y lotes'
    }] : []),

    // Grupo Configuración
    ...(canAccessProductionConfig ? [{
      name: 'Configuración',
      icon: Settings,
      description: 'Maestros y configuración',
      children: [
        ...(canAccessWorkCenters ? [{
          name: 'Centros de Trabajo',
          href: '/produccion/configuracion/centros-trabajo',
          icon: Building2,
          description: 'Líneas, máquinas y estaciones'
        }] : []),
        ...(canAccessShifts ? [{
          name: 'Turnos',
          href: '/produccion/configuracion/turnos',
          icon: Clock,
          description: 'Configuración de turnos'
        }] : []),
        ...(canAccessReasonCodes ? [{
          name: 'Códigos de Motivo',
          href: '/produccion/configuracion/codigos-motivo',
          icon: Tags,
          description: 'Paradas, scrap y retrabajo'
        }] : []),
        ...(canAccessProductionRutinas ? [{
          name: 'Plantillas Rutinas',
          href: '/produccion/configuracion/rutinas',
          icon: ListChecks,
          description: 'Plantillas de checklists'
        }] : []),
        ...(canAccessProductionConfig ? [{
          name: 'Recursos',
          href: '/produccion/configuracion/recursos',
          icon: Boxes,
          description: 'Bancos, silos y recursos de producción'
        }] : []),
      ].filter(item => item !== undefined)
    }] : []),

    // Reportes
    ...(canAccessProductionReports ? [{
      name: 'Reportes',
      href: '/produccion/reportes',
      icon: BarChart3,
      description: 'Reportes y tendencias'
    }] : []),

    // Items legacy (Máquinas y Vehículos)
    ...(canAccessProductionMachines ? [{
      name: 'Máquinas',
      href: '/maquinas',
      icon: Cog,
      description: 'Gestión de máquinas de producción'
    }] : []),
    ...(canAccessVehicles ? [{
      name: 'Vehículos',
      href: '/vehicles',
      icon: Truck,
      description: 'Gestión de vehículos y transporte'
    }] : []),
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
      <aside className={`fixed top-0 left-0 z-30 h-full w-64 border-r shadow-sm ${
        theme === 'light' ? 'bg-white border-gray-200' : 'bg-black border-white/5'
      }`}>
        <div className="flex flex-col h-full">
          <div className="h-16 px-4 flex items-center justify-center border-b">
            <div className={`animate-pulse h-6 w-32 rounded ${
              theme === 'light' ? 'bg-gray-300' : 'bg-white/10'
            }`}></div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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

            {/* Header con información de la empresa */}
            {currentCompany && (
              <div className="flex items-center gap-1 px-2 pt-0 pb-2 -mt-1 md:px-3 md:pt-0 md:pb-2">
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
                
            {/* Content area */}
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
              <SidebarNavSection
                isOpen={isOpen}
                pathname={pathname}
                navItems={navItems}
                openGroups={openGroups}
                setOpenGroups={setOpenGroups}
                onLinkHover={handleLinkHover}
                onLinkClick={handleLinkClick}
                currentArea={currentArea}
                currentSector={currentSector}
                availableSectors={availableSectors}
                availableAreas={availableAreas}
                user={user}
                sidebarContext={sidebarContext}
                onSectorChange={handleSectorChange}
                onAreaChange={handleAreaChange}
              />
          </div>

          {/* Bottom section: Configuración, Buscar, Perfil */}
          <SidebarFooter
            isOpen={isOpen}
            pathname={pathname}
            currentArea={currentArea}
            user={user}
            sidebarContext={sidebarContext}
            onShowFeedback={() => setShowFeedback(true)}
            onLogout={logout}
          />
        </div>
        </div>
      </aside>

      <FeedbackModal open={showFeedback} onOpenChange={setShowFeedback} />
    </TooltipProvider>
  );
}