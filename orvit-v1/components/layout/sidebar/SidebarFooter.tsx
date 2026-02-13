'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Settings,
  Search,
  Bell,
  CircleUser,
  LogOut,
  EllipsisVertical,
  MessageSquarePlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ModeIndicator } from '@/components/view-mode';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { checkIsActive } from './types';

interface SidebarFooterProps {
  isOpen: boolean;
  pathname: string;
  currentArea: any;
  user: any;
  sidebarContext: any;
  onShowFeedback: () => void;
  onLogout: () => Promise<void>;
}

/**
 * Footer del sidebar: acciones rápidas (feedback, config, buscar, notificaciones)
 * y perfil del usuario con dropdown de opciones.
 */
export function SidebarFooter({
  isOpen,
  pathname,
  currentArea,
  user,
  sidebarContext,
  onShowFeedback,
  onLogout,
}: SidebarFooterProps) {
  const router = useRouter();

  const configHref = currentArea?.name === 'Administración'
    ? '/administracion/configuracion'
    : currentArea?.name === 'Mantenimiento'
    ? '/mantenimiento/configuracion'
    : '/configuracion';

  const isConfigActive = checkIsActive(pathname, configHref);

  return (
    <>
      {/* Acciones rápidas */}
      <div className={cn("flex flex-col gap-1 p-2 md:p-3 mt-auto")}>
        {isOpen ? (
          <ExpandedActions
            configHref={configHref}
            isConfigActive={isConfigActive}
            onShowFeedback={onShowFeedback}
          />
        ) : (
          <CollapsedActions
            configHref={configHref}
            isConfigActive={isConfigActive}
            onShowFeedback={onShowFeedback}
          />
        )}
      </div>

      {/* Perfil de usuario */}
      <div className="flex flex-col gap-2 p-2 md:p-3">
        <DropdownMenu onOpenChange={(open) => sidebarContext?.setPreventClose(open)}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              data-sidebar="menu-button"
              data-size="lg"
              className={cn(
                "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left outline-none ring-sidebar-ring transition-[width,height,padding] focus-visible:ring-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sm",
                isOpen ? "h-12" : "h-12 w-12 justify-center p-0"
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
                router.push(`${configHref}?tab=notifications`);
              }}>
                <Bell className="h-4 w-4" />
                <span>Notificaciones</span>
              </DropdownMenuItem>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                try {
                  await onLogout();
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
    </>
  );
}

// ---- Subcomponentes internos ----

function ExpandedActions({
  configHref,
  isConfigActive,
  onShowFeedback,
}: {
  configHref: string;
  isConfigActive: boolean;
  onShowFeedback: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onShowFeedback}
        className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors w-full text-left"
      >
        <MessageSquarePlus className="h-4 w-4 shrink-0" />
        <span>Feedback</span>
      </button>

      <Link
        href={configHref}
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
          "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          isConfigActive && "bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-sm",
          isConfigActive && "border-l-2 border-l-sidebar-primary-foreground"
        )}
      >
        <Settings className="h-4 w-4 shrink-0" />
        <span>Configuración</span>
      </Link>

      <button
        type="button"
        onClick={() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('orvit:search:open'));
          }
        }}
        className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors w-full text-left"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span>Buscar</span>
        <kbd className="ml-auto text-[10px] text-sidebar-foreground/60 bg-sidebar-accent/50 border border-sidebar-ring/30 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
      </button>

      <button
        type="button"
        onClick={() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('orvit:notifications:open'));
          }
        }}
        className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors w-full text-left"
      >
        <Bell className="h-4 w-4 shrink-0" />
        <span>Notificaciones</span>
      </button>
    </div>
  );
}

function CollapsedActions({
  configHref,
  isConfigActive,
  onShowFeedback,
}: {
  configHref: string;
  isConfigActive: boolean;
  onShowFeedback: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Feedback"
            onClick={onShowFeedback}
            className="flex items-center justify-center w-8 h-8 rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={12}>
          Feedback
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={configHref}
            aria-label="Configuración"
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-md transition-colors",
              "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              isConfigActive && "bg-sidebar-primary text-sidebar-primary-foreground"
            )}
          >
            <Settings className="h-4 w-4" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          Configuración
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Buscar"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('orvit:search:open'));
              }
            }}
            className="flex items-center justify-center w-8 h-8 rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <Search className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={12}>
          Buscar (⌘K)
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Notificaciones"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('orvit:notifications:open'));
              }
            }}
            className="flex items-center justify-center w-8 h-8 rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <Bell className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={12}>
          Notificaciones
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
