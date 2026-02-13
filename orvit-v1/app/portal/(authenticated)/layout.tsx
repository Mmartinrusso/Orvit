'use client';

import { useState, useEffect } from 'react';
import { usePortalAuth, PortalAuthGuard } from '@/contexts/PortalAuthContext';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  DollarSign,
  FileText,
  ShoppingCart,
  History,
  FileArchive,
  LogOut,
  Menu,
  X,
  User,
  ChevronDown,
  ChevronRight,
  Home,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Color preferences interface
interface UserColorPreferences {
  themeName: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  chart6: string;
  kpiPositive: string;
  kpiNegative: string;
  kpiNeutral: string;
}

const DEFAULT_COLORS: UserColorPreferences = {
  themeName: 'Predeterminado',
  chart1: '#6366f1',
  chart2: '#8b5cf6',
  chart3: '#ec4899',
  chart4: '#f59e0b',
  chart5: '#10b981',
  chart6: '#06b6d4',
  kpiPositive: '#10b981',
  kpiNegative: '#ef4444',
  kpiNeutral: '#64748b',
};

type PermissionKey = 'canViewPrices' | 'canViewQuotes' | 'canAcceptQuotes' | 'canCreateOrders' | 'canViewHistory' | 'canViewDocuments';

interface NavSection {
  id: string;
  href: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: PermissionKey;
  disabled?: boolean;
}

const NAV_SECTIONS: NavSection[] = [
  {
    id: 'inicio',
    href: '/portal',
    name: 'Inicio',
    description: 'Panel principal y resumen',
    icon: Home,
  },
  {
    id: 'precios',
    href: '/portal/precios',
    name: 'Lista de Precios',
    description: 'Productos y precios actualizados',
    icon: DollarSign,
    permission: 'canViewPrices',
  },
  {
    id: 'cotizaciones',
    href: '/portal/cotizaciones',
    name: 'Cotizaciones',
    description: 'Ver y aceptar cotizaciones',
    icon: FileText,
    permission: 'canViewQuotes',
  },
  {
    id: 'pedidos',
    href: '/portal/pedidos',
    name: 'Pedidos',
    description: 'Crear y seguir pedidos',
    icon: ShoppingCart,
    permission: 'canCreateOrders',
  },
  {
    id: 'historial',
    href: '/portal/historial',
    name: 'Historial',
    description: 'Compras y transacciones',
    icon: History,
    permission: 'canViewHistory',
    disabled: true,
  },
  {
    id: 'documentos',
    href: '/portal/documentos',
    name: 'Documentos',
    description: 'Facturas y comprobantes',
    icon: FileArchive,
    permission: 'canViewDocuments',
    disabled: true,
  },
];

function PortalSidebar({
  isOpen,
  onClose,
  userColors
}: {
  isOpen: boolean;
  onClose: () => void;
  userColors: UserColorPreferences;
}) {
  const { user, logout, canViewPrices, canViewQuotes, canCreateOrders, canViewHistory, canViewDocuments } = usePortalAuth();
  const pathname = usePathname();

  const permissionMap: Record<string, boolean> = {
    canViewPrices,
    canViewQuotes,
    canCreateOrders,
    canViewHistory,
    canViewDocuments,
  };

  const filteredNavSections = NAV_SECTIONS.filter(section => {
    if (!section.permission) return true;
    return permissionMap[section.permission];
  });

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Sesion cerrada correctamente');
    } catch (error) {
      toast.error('Error al cerrar sesion');
    }
  };

  // Check if a section is active
  const isActive = (section: NavSection) => {
    if (section.href === '/portal') {
      return pathname === '/portal';
    }
    return pathname?.startsWith(section.href);
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-screen w-72 bg-muted/30 border-r transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-auto lg:h-full flex flex-col',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="p-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {user?.company.logo ? (
                <img
                  src={user.company.logo}
                  alt={user.company.name}
                  className="h-8 w-8 rounded object-contain bg-background p-0.5"
                />
              ) : (
                <div
                  className="h-8 w-8 rounded flex items-center justify-center bg-background"
                >
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
              )}
              <div>
                <h1 className="text-sm font-bold truncate max-w-[160px]">
                  {user?.company.name}
                </h1>
                <p className="text-xs text-muted-foreground">
                  Portal de Clientes
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-8 w-8"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="space-y-1">
            {filteredNavSections.map((section) => {
              const Icon = section.icon;
              const active = isActive(section);
              const disabled = section.disabled;

              if (disabled) {
                return (
                  <div
                    key={section.id}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left opacity-50 cursor-not-allowed"
                  >
                    <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {section.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {section.description}
                      </p>
                    </div>
                  </div>
                );
              }

              return (
                <Link
                  key={section.id}
                  href={section.href}
                  onClick={onClose}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                    active && 'bg-primary text-primary-foreground',
                    !active && 'hover:bg-muted'
                  )}
                >
                  <Icon className={cn(
                    'w-4 h-4 flex-shrink-0',
                    active ? 'text-primary-foreground' : 'text-muted-foreground'
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-sm font-medium',
                      !active && 'text-foreground'
                    )}>
                      {section.name}
                    </p>
                    <p className={cn(
                      'text-xs truncate',
                      active ? 'text-primary-foreground/70' : 'text-muted-foreground'
                    )}>
                      {section.description}
                    </p>
                  </div>
                  <ChevronRight className={cn(
                    'w-4 h-4 flex-shrink-0 transition-transform',
                    active && 'rotate-90',
                    active ? 'text-primary-foreground' : 'text-muted-foreground'
                  )} />
                </Link>
              );
            })}
          </div>

          {/* Nota sobre secciones proximamente */}
          {filteredNavSections.some(s => s.disabled) && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">
                Las secciones deshabilitadas estaran disponibles proximamente.
              </p>
            </div>
          )}
        </nav>

        {/* User section */}
        <div className="p-4 border-t bg-background/50 flex-shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center bg-muted"
            >
              <User className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {user?.contact.firstName} {user?.contact.lastName}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.client.legalName}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 transition-colors"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesion
          </Button>
        </div>
      </aside>
    </>
  );
}

function PortalHeader({
  onMenuClick,
  userColors
}: {
  onMenuClick: () => void;
  userColors: UserColorPreferences;
}) {
  const { user, logout } = usePortalAuth();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Sesion cerrada correctamente');
    } catch (error) {
      toast.error('Error al cerrar sesion');
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b px-4 py-3 lg:hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onMenuClick}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            {user?.company.logo ? (
              <img
                src={user.company.logo}
                alt={user.company.name}
                className="h-7 w-7 rounded object-contain"
              />
            ) : (
              <div className="h-7 w-7 rounded flex items-center justify-center bg-primary/10">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
            )}
            <span className="font-semibold text-sm">{user?.company.name}</span>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <div className="h-7 w-7 rounded-full flex items-center justify-center bg-muted">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-3 py-2">
              <p className="text-sm font-medium">
                {user?.contact.firstName} {user?.contact.lastName}
              </p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
              <p className="text-xs text-muted-foreground mt-1">{user?.client.legalName}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar sesion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export default function PortalAuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userColors, setUserColors] = useState<UserColorPreferences>(DEFAULT_COLORS);
  const { user } = usePortalAuth();

  // Load color preferences
  useEffect(() => {
    const loadColorPreferences = async () => {
      if (!user?.companyId) return;
      try {
        const response = await fetch(`/api/costos/color-preferences?companyId=${user.companyId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.colors) {
            setUserColors(data.colors);
          }
        }
      } catch (error) {
        console.error('Error loading color preferences:', error);
      }
    };
    loadColorPreferences();
  }, [user?.companyId]);

  return (
    <PortalAuthGuard>
      <div className="h-screen bg-background flex overflow-hidden">
        <PortalSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          userColors={userColors}
        />

        <div className="flex-1 flex flex-col min-w-0 h-full">
          <PortalHeader
            onMenuClick={() => setSidebarOpen(true)}
            userColors={userColors}
          />

          <main className="flex-1 p-4 lg:p-6 overflow-y-auto bg-muted/30">
            {children}
          </main>
        </div>
      </div>
    </PortalAuthGuard>
  );
}
