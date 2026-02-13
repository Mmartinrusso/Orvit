'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/use-permissions';
import { 
  Home, 
  Factory, 
  ClipboardList, 
  Plus, 
  Calendar,
  Settings,
  Users,
  Package,
  Calculator,
  TrendingUp,
  DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetBody,
} from '@/components/ui/sheet';

interface BottomBarItem {
  icon: React.ReactNode;
  label: string;
  path: string;
  permission?: string;
}

export default function MobileBottomBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  
  // Permisos para diferentes acciones
  const { hasPermission: canCreateTask } = usePermission('CREATE_TASK');
  const { hasPermission: canCreateFixedTask } = usePermission('CREATE_FIXED_TASK');
  const { hasPermission: canViewTasks } = usePermission('VIEW_TASKS');
  const { hasPermission: canViewMachines } = usePermission('VIEW_MACHINES');
  const { hasPermission: canViewAgenda } = usePermission('VIEW_AGENDA');
  const { hasPermission: canViewUsers } = usePermission('VIEW_USERS');
  
  // Permisos de ventas
  const { hasPermission: canCreateProduct } = usePermission('CREATE_PRODUCT');
  const { hasPermission: canCreateQuote } = usePermission('CREATE_QUOTE');
  const { hasPermission: canCreateClient } = usePermission('CREATE_CLIENT');
  const { hasPermission: canViewSales } = usePermission('VIEW_SALES');

  // No mostrar en páginas de login, máquinas, mantenimiento, empresas, áreas, sectores o si no hay usuario
  if (!user || pathname === '/login' || pathname === '/maquinas' || pathname === '/empresas' || pathname === '/areas' || pathname === '/sectores' || pathname.startsWith('/mantenimiento')) {
    return null;
  }

  // Elementos principales del bottom bar
  const mainItems: BottomBarItem[] = [
    {
      icon: <Home className="h-5 w-5" />,
      label: 'Inicio',
      path: '/areas'
    },
    {
      icon: <Factory className="h-5 w-5" />,
      label: 'Máquinas',
      path: '/maquinas',
      permission: 'VIEW_MACHINES'
    },
    {
      icon: <ClipboardList className="h-5 w-5" />,
      label: 'Agenda',
      path: '/administracion/agenda',
      permission: 'VIEW_TASKS'
    },
    {
      icon: <DollarSign className="h-5 w-5" />,
      label: 'Ventas',
      path: '/administracion/ventas',
      permission: 'VIEW_SALES_DASHBOARD'
    }
  ];

  // Filtrar items basado en permisos
  const visibleItems = mainItems.filter(item => 
    !item.permission || 
    (item.permission === 'VIEW_MACHINES' && canViewMachines) ||
    (item.permission === 'VIEW_TASKS' && canViewTasks) ||
    (item.permission === 'VIEW_SALES_DASHBOARD' && canViewSales)
  );

  // Opciones del menú de creación
  const createOptions = [
    {
      icon: <ClipboardList className="h-5 w-5" />,
      label: 'Tarea Normal',
      description: 'Crear una nueva tarea',
      action: () => {
        router.push('/administracion/agenda?tab=tareas');
        setIsCreateMenuOpen(false);
      },
      show: canCreateTask
    },
    {
      icon: <ClipboardList className="h-5 w-5" />,
      label: 'Tarea Fija',
      description: 'Crear una tarea recurrente',
      action: () => {
        router.push('/administracion/agenda?tab=fijas');
        setIsCreateMenuOpen(false);
      },
      show: canCreateFixedTask
    },
    {
      icon: <Calendar className="h-5 w-5" />,
      label: 'Recordatorio',
      description: 'Crear un recordatorio personal',
      action: () => {
        router.push('/administracion/agenda?tab=mi-agenda');
        setIsCreateMenuOpen(false);
      },
      show: canViewAgenda
    },
    {
      icon: <Package className="h-5 w-5" />,
      label: 'Producto',
      description: 'Agregar producto al catálogo',
      action: () => {
        router.push('/administracion/ventas/productos/nuevo');
        setIsCreateMenuOpen(false);
      },
      show: canCreateProduct
    },
    {
      icon: <Calculator className="h-5 w-5" />,
      label: 'Cotización',
      description: 'Nueva cotización para cliente',
      action: () => {
        router.push('/administracion/ventas/cotizaciones/nueva');
        setIsCreateMenuOpen(false);
      },
      show: canCreateQuote
    },
    {
      icon: <Users className="h-5 w-5" />,
      label: 'Cliente',
      description: 'Registrar nuevo cliente',
      action: () => {
        router.push('/administracion/ventas/clientes/nuevo');
        setIsCreateMenuOpen(false);
      },
      show: canCreateClient
    },
    {
      icon: <Package className="h-5 w-5" />,
      label: 'Orden de Trabajo',
      description: 'Crear orden de mantenimiento',
      action: () => {
        router.push('/mantenimiento/ordenes');
        setIsCreateMenuOpen(false);
      },
      show: user?.role === 'ADMIN' || user?.role === 'SUPERADMIN' || user?.role === 'SUPERVISOR'
    }
  ];

  const availableCreateOptions = createOptions.filter(option => option.show);

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  const isActive = (path: string) => {
    return pathname.startsWith(path);
  };

  return (
    <>
      {/* Bottom Bar - Solo visible en móviles */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border md:hidden z-50">
        <div className="flex items-center justify-around px-2 py-2">
          {/* Navegación principal */}
          {visibleItems.map((item, index) => (
            <Button
              key={index}
              variant="ghost"
              size="sm"
              className={cn(
                "flex flex-col items-center gap-1 h-auto py-2 px-3 flex-1 max-w-[80px]",
                isActive(item.path) 
                  ? "text-primary bg-primary/10" 
                  : "text-muted-foreground"
              )}
              onClick={() => handleNavigation(item.path)}
            >
              {item.icon}
              <span className="text-xs font-medium truncate">{item.label}</span>
            </Button>
          ))}

          {/* Botón de crear (centro) */}
          {availableCreateOptions.length > 0 && (
            <Sheet open={isCreateMenuOpen} onOpenChange={setIsCreateMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  size="sm"
                  className="flex flex-col items-center gap-1 h-auto py-2 px-3 bg-primary text-primary-foreground rounded-full min-w-[60px]"
                >
                  <Plus className="h-5 w-5" />
                  <span className="text-xs font-medium">Crear</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-auto max-h-[80vh]">
                <SheetHeader>
                  <SheetTitle>¿Qué quieres crear?</SheetTitle>
                  <SheetDescription>
                    Selecciona el tipo de elemento que deseas crear
                  </SheetDescription>
                </SheetHeader>
                <SheetBody className="grid gap-3">
                  {availableCreateOptions.map((option, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      className="flex items-center gap-3 h-auto p-4 justify-start"
                      onClick={option.action}
                    >
                      <div className="bg-primary/10 p-2 rounded-lg">
                        {option.icon}
                      </div>
                      <div className="text-left">
                        <div className="font-medium">{option.label}</div>
                        <div className="text-sm text-muted-foreground">
                          {option.description}
                        </div>
                      </div>
                    </Button>
                  ))}
                </SheetBody>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>

      {/* Espaciador para evitar que el contenido se superponga */}
      <div className="h-16 md:hidden" />
    </>
  );
} 