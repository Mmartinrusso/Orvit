'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Factory, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarLink } from './SidebarLink';
import { SidebarDropdown } from './SidebarDropdown';
import type { SidebarItem } from './types';
import { checkIsActive } from './types';

interface SidebarNavSectionProps {
  isOpen: boolean;
  pathname: string;
  navItems: SidebarItem[];
  openGroups: { [key: string]: boolean };
  setOpenGroups: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  onLinkHover: (href: string) => void;
  onLinkClick: (href?: string, e?: React.MouseEvent<HTMLAnchorElement>) => void;
  // Selectores de contexto
  currentArea: any;
  currentSector: any;
  availableSectors: any[];
  availableAreas: any[];
  user: any;
  sidebarContext: any;
  onSectorChange: (sector: any) => void;
  onAreaChange: (area: any) => void;
}

/**
 * Renderiza la sección de navegación del sidebar:
 * - Selectores de sector/área (según el área activa)
 * - Árbol de navegación con links y grupos colapsables
 */
export function SidebarNavSection({
  isOpen,
  pathname,
  navItems,
  openGroups,
  setOpenGroups,
  onLinkHover,
  onLinkClick,
  currentArea,
  currentSector,
  availableSectors,
  availableAreas,
  user,
  sidebarContext,
  onSectorChange,
  onAreaChange,
}: SidebarNavSectionProps) {
  const router = useRouter();

  if (isOpen) {
    return (
      <div className="space-y-2 px-2 md:px-3">
        {/* Selector de Sector - Para Mantenimiento y Producción */}
        {currentArea && currentArea.name !== 'Administración' && availableSectors && availableSectors.length > 0 && (
          <SectorSelector
            currentSector={currentSector}
            availableSectors={availableSectors}
            user={user}
            sidebarContext={sidebarContext}
            onSectorChange={onSectorChange}
            router={router}
          />
        )}

        {/* Selector de Área - Solo para Administración */}
        {currentArea && currentArea.name === 'Administración' && availableAreas && availableAreas.length > 0 && (
          <AreaSelectorDropdown
            currentArea={currentArea}
            availableAreas={availableAreas}
            sidebarContext={sidebarContext}
            onAreaChange={onAreaChange}
            router={router}
          />
        )}

        {/* Separador: contexto vs navegación */}
        {(
          (currentArea && currentArea.name !== 'Administración' && availableSectors && availableSectors.length > 0) ||
          (currentArea && currentArea.name === 'Administración' && availableAreas && availableAreas.length > 0)
        ) && (
          <div className="h-px w-full bg-sidebar-ring/20" />
        )}

        {/* Nav items */}
        <div className="relative flex w-full min-w-0 flex-col mt-2">
          <div className="w-full text-sm">
            <ul className="flex w-full min-w-0 flex-col gap-0.5">
              <NavItemsList
                navItems={navItems}
                isOpen={true}
                pathname={pathname}
                openGroups={openGroups}
                setOpenGroups={setOpenGroups}
                onHover={onLinkHover}
                onClick={onLinkClick}
              />
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Sidebar colapsado
  return (
    <div className="flex flex-col items-center gap-1 px-2">
      {/* Selector de Sector Compacto */}
      {currentArea && currentArea.name !== 'Administración' && availableSectors && availableSectors.length > 0 && currentSector && (
        <SectorSelectorCompact
          currentSector={currentSector}
          availableSectors={availableSectors}
          user={user}
          sidebarContext={sidebarContext}
          onSectorChange={onSectorChange}
          router={router}
        />
      )}

      {/* Selector de Área Compacto - Solo para Administración */}
      {currentArea && currentArea.name === 'Administración' && availableAreas && availableAreas.length > 0 && (
        <AreaSelectorCompact
          currentArea={currentArea}
          availableAreas={availableAreas}
          sidebarContext={sidebarContext}
          onAreaChange={onAreaChange}
          router={router}
        />
      )}

      {/* Nav items colapsados */}
      <NavItemsList
        navItems={navItems}
        isOpen={false}
        pathname={pathname}
        openGroups={openGroups}
        setOpenGroups={setOpenGroups}
        onHover={onLinkHover}
        onClick={onLinkClick}
      />
    </div>
  );
}

// ---- Subcomponentes internos (no exportados) ----

function NavItemsList({
  navItems,
  isOpen,
  pathname,
  openGroups,
  setOpenGroups,
  onHover,
  onClick,
}: {
  navItems: SidebarItem[];
  isOpen: boolean;
  pathname: string;
  openGroups: { [key: string]: boolean };
  setOpenGroups: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  onHover: (href: string) => void;
  onClick: (href?: string, e?: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <>
      {navItems.map((item) => {
        // Grupo con hijos
        if (item.children && Array.isArray(item.children)) {
          return (
            <SidebarDropdown
              key={item.name}
              item={item}
              isOpen={isOpen}
              pathname={pathname}
              openGroups={openGroups}
              setOpenGroups={setOpenGroups}
              onHover={onHover}
              onClick={onClick}
            />
          );
        }

        // Link simple
        const isActive = item.href ? checkIsActive(pathname, item.href) : false;
        return (
          <SidebarLink
            key={item.href || item.name}
            item={item}
            isActive={isActive}
            isOpen={isOpen}
            onHover={onHover}
            onClick={onClick}
          />
        );
      })}
    </>
  );
}

function SectorSelector({
  currentSector,
  availableSectors,
  user,
  sidebarContext,
  onSectorChange,
  router,
}: {
  currentSector: any;
  availableSectors: any[];
  user: any;
  sidebarContext: any;
  onSectorChange: (sector: any) => void;
  router: ReturnType<typeof useRouter>;
}) {
  return (
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
              onClick={() => onSectorChange(sector)}
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
  );
}

function SectorSelectorCompact({
  currentSector,
  availableSectors,
  user,
  sidebarContext,
  onSectorChange,
  router,
}: {
  currentSector: any;
  availableSectors: any[];
  user: any;
  sidebarContext: any;
  onSectorChange: (sector: any) => void;
  router: ReturnType<typeof useRouter>;
}) {
  return (
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
              onClick={() => onSectorChange(sector)}
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
  );
}

function AreaSelectorDropdown({
  currentArea,
  availableAreas,
  sidebarContext,
  onAreaChange,
  router,
}: {
  currentArea: any;
  availableAreas: any[];
  sidebarContext: any;
  onAreaChange: (area: any) => void;
  router: ReturnType<typeof useRouter>;
}) {
  return (
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
              onClick={() => onAreaChange(area)}
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
  );
}

function AreaSelectorCompact({
  currentArea,
  availableAreas,
  sidebarContext,
  onAreaChange,
  router,
}: {
  currentArea: any;
  availableAreas: any[];
  sidebarContext: any;
  onAreaChange: (area: any) => void;
  router: ReturnType<typeof useRouter>;
}) {
  return (
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
              onClick={() => onAreaChange(area)}
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
  );
}
