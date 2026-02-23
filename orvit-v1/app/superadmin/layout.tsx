'use client';

import { useEffect, useState, useCallback, createContext, useContext } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/providers/ThemeProvider';
import {
  LayoutDashboard,
  Building2,
  Puzzle,
  Users,
  Settings,
  LogOut,
  FileStack,
  Shield,
  Database,
  Activity,
  Bell,
  Menu,
  Globe,
  CreditCard,
  EllipsisVertical,
  Zap,
  CircleUser,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Sidebar Context for SuperAdmin
interface SuperAdminSidebarContextType {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

const SuperAdminSidebarContext = createContext<SuperAdminSidebarContextType | undefined>(undefined);

export function useSuperAdminSidebarContext() {
  return useContext(SuperAdminSidebarContext);
}

interface NavSection {
  title: string;
  items: NavItem[];
}

interface NavItem {
  href: string;
  label: string;
  icon: any;
  badge?: string;
}

const navSections: NavSection[] = [
  {
    title: 'General',
    items: [
      { href: '/superadmin', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/superadmin/activity', label: 'Actividad', icon: Activity },
    ],
  },
  {
    title: 'Empresas',
    items: [
      { href: '/superadmin/companies', label: 'Todas las Empresas', icon: Building2 },
      { href: '/superadmin/templates', label: 'Templates', icon: FileStack, badge: 'Nuevo' },
      { href: '/superadmin/billing', label: 'Facturación', icon: CreditCard },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { href: '/superadmin/modules', label: 'Módulos', icon: Puzzle },
      { href: '/superadmin/users', label: 'Usuarios Globales', icon: Users },
      { href: '/superadmin/permissions', label: 'Permisos', icon: Shield },
    ],
  },
  {
    title: 'Configuración',
    items: [
      { href: '/superadmin/settings', label: 'General', icon: Settings },
      { href: '/superadmin/database', label: 'Base de Datos', icon: Database },
      { href: '/superadmin/integrations', label: 'Integraciones', icon: Globe },
    ],
  },
];

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { theme } = useTheme();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [overlayClickable, setOverlayClickable] = useState(false);

  // Handle responsive
  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        const mobile = window.innerWidth < 768;
        setIsMobile(mobile);
        if (mobile) {
          setIsSidebarOpen(false);
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Overlay clickable delay for mobile
  useEffect(() => {
    if (isSidebarOpen && isMobile) {
      const timer = setTimeout(() => setOverlayClickable(true), 300);
      return () => clearTimeout(timer);
    } else {
      setOverlayClickable(false);
    }
  }, [isSidebarOpen, isMobile]);

  // Control body scroll on mobile
  useEffect(() => {
    if (isMobile && isSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isSidebarOpen, isMobile]);

  useEffect(() => {
    if (!loading && user?.role !== 'SUPERADMIN') {
      router.push('/login');
    }
  }, [user, loading, router]);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  const handleLinkClick = useCallback((href: string, e?: React.MouseEvent) => {
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  }, [isMobile]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-muted border-t-primary animate-spin" />
          </div>
          <span className="text-muted-foreground text-sm">Cargando SuperAdmin...</span>
        </div>
      </div>
    );
  }

  if (user?.role !== 'SUPERADMIN') {
    return null;
  }

  const isActive = (href: string) => {
    if (href === '/superadmin') {
      return pathname === '/superadmin';
    }
    return pathname.startsWith(href);
  };

  return (
    <SuperAdminSidebarContext.Provider value={{ isSidebarOpen, setIsSidebarOpen, toggleSidebar }}>
      <TooltipProvider delayDuration={0}>
        <div className="flex h-screen w-full bg-sidebar">
          {/* Mobile overlay */}
          {isSidebarOpen && isMobile && (
            <div
              className="fixed inset-0 z-[90] bg-background/80 backdrop-blur-sm"
              style={{ pointerEvents: overlayClickable ? 'auto' : 'none' }}
              onClick={(e) => {
                if (overlayClickable && e.target === e.currentTarget) {
                  setIsSidebarOpen(false);
                }
              }}
            />
          )}

          {/* Sidebar */}
          <aside
            className={cn(
              "transition-all duration-100 ease-out flex-shrink-0",
              isSidebarOpen ? "w-60" : "w-0",
              "md:relative",
              "fixed left-0",
              "top-2 bottom-2",
              "md:mt-3 md:mb-3",
              "h-[calc(100vh-1rem)] md:h-[calc(100vh-1.5rem)]",
              "overflow-hidden",
              "z-[100] md:z-auto",
              isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
            )}
            style={{
              width: isSidebarOpen ? 'var(--sidebar-width, 240px)' : '0px',
            }}
          >
            <div className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground overflow-visible">
              <div className="flex flex-col h-full">
                {/* Header - Logo */}
                <div className="flex items-center gap-2 px-3 pt-3 pb-2">
                  <Link href="/superadmin" className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-sidebar-accent transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                      <Zap className="h-4 w-4 text-primary-foreground" />
                    </div>
                    {isSidebarOpen && (
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sidebar-foreground">ORVIT</span>
                        <Badge variant="outline" className="text-xs border-primary/50 text-primary">
                          SuperAdmin
                        </Badge>
                      </div>
                    )}
                  </Link>
                </div>

                {/* Separator */}
                <div className="h-px bg-sidebar-ring/20 mx-3 mb-2" />

                {/* Navigation */}
                <div className="flex-1 overflow-y-auto px-2 md:px-3">
                  {isSidebarOpen ? (
                    <div className="space-y-4">
                      {navSections.map((section) => (
                        <div key={section.title}>
                          <h3 className="px-2 mb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                            {section.title}
                          </h3>
                          <ul className="flex flex-col gap-0.5">
                            {section.items.map((item) => {
                              const Icon = item.icon;
                              const active = isActive(item.href);
                              return (
                                <li key={item.href}>
                                  <Link
                                    href={item.href}
                                    onClick={(e) => handleLinkClick(item.href, e)}
                                    className={cn(
                                      "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                                      "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                      active && "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm",
                                      active && "border-l-2 border-l-sidebar-primary-foreground"
                                    )}
                                  >
                                    <Icon className="h-4 w-4 shrink-0" />
                                    <span className="flex-1">{item.label}</span>
                                    {item.badge && (
                                      <Badge
                                        variant="secondary"
                                        className="text-xs bg-primary/20 text-primary border-0"
                                      >
                                        {item.badge}
                                      </Badge>
                                    )}
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      {navSections.flatMap((section) =>
                        section.items.map((item) => {
                          const Icon = item.icon;
                          const active = isActive(item.href);
                          return (
                            <Tooltip key={item.href}>
                              <TooltipTrigger asChild>
                                <Link
                                  href={item.href}
                                  onClick={(e) => handleLinkClick(item.href, e)}
                                  className={cn(
                                    "flex items-center justify-center w-8 h-8 rounded-md transition-colors",
                                    "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                    active && "bg-sidebar-primary text-sidebar-primary-foreground"
                                  )}
                                >
                                  <Icon className="h-4 w-4" />
                                </Link>
                              </TooltipTrigger>
                              <TooltipContent side="right" sideOffset={8}>
                                {item.label}
                              </TooltipContent>
                            </Tooltip>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* System Status */}
                {isSidebarOpen && (
                  <div className="px-3 pb-2">
                    <div className="rounded-lg bg-sidebar-accent/50 p-3 border border-sidebar-ring/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Database className="h-4 w-4 text-primary" />
                        <span className="text-xs font-medium text-sidebar-foreground">Sistema</span>
                      </div>
                      <p className="text-xs text-sidebar-foreground/60">
                        PostgreSQL conectado
                      </p>
                      <p className="text-xs text-sidebar-foreground/60">
                        v1.0.0
                      </p>
                    </div>
                  </div>
                )}

                {/* Footer - User Profile */}
                <div className="flex flex-col gap-2 p-2 md:p-3 border-t border-sidebar-ring/20">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left outline-none ring-sidebar-ring transition-[width,height,padding] focus-visible:ring-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sm",
                          isSidebarOpen ? "h-12" : "h-12 w-12 justify-center p-0"
                        )}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                            {user?.name?.charAt(0).toUpperCase() || 'SA'}
                          </AvatarFallback>
                        </Avatar>
                        {isSidebarOpen && (
                          <>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                              <span className="truncate font-medium text-sidebar-foreground">{user?.name || 'SuperAdmin'}</span>
                              <span className="text-sidebar-foreground/70 truncate text-xs">{user?.email || 'admin@example.com'}</span>
                            </div>
                            <EllipsisVertical className="ml-auto h-4 w-4 text-sidebar-foreground/70 shrink-0" />
                          </>
                        )}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <div className="flex items-center gap-2 px-2 py-1.5">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                            {user?.name?.charAt(0).toUpperCase() || 'SA'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="grid flex-1 text-left text-sm leading-tight">
                          <span className="truncate font-medium">{user?.name || 'SuperAdmin'}</span>
                          <span className="text-muted-foreground truncate text-xs">{user?.email}</span>
                        </div>
                      </div>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => router.push('/superadmin/settings')}>
                        <CircleUser className="h-4 w-4 mr-2" />
                        Cuenta
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => router.push('/superadmin/settings')}>
                        <Settings className="h-4 w-4 mr-2" />
                        Configuración
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => logout()}
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Cerrar Sesión
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden transition-all duration-100 ease-out bg-sidebar w-full">
            {/* Mobile Bottom Bar */}
            <div className="md:hidden">
              {!isSidebarOpen && (
                <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50">
                  <div className="flex items-center justify-center p-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsSidebarOpen(true)}
                      className="p-2"
                    >
                      <Menu className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <main className="flex-1 overflow-y-auto overflow-x-hidden p-0 h-screen bg-sidebar">
              <div className="p-2 md:p-3 bg-sidebar">
                <div className="rounded-xl border border-border/50 bg-card text-card-foreground shadow-sm min-h-[calc(100vh-1rem)]">
                  <div className="flex flex-col h-full p-4 md:p-6">
                    {children}
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
      </TooltipProvider>
    </SuperAdminSidebarContext.Provider>
  );
}
