'use client';

import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Factory, Wrench, Users, Building2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';

interface UnifiedAreaSectorSelectorProps {
  currentArea: any;
  currentSector: any;
  availableAreas: any[];
  availableSectors: any[];
  currentCompany: any;
  onAreaChange: (area: any, sectorOverride?: any) => void;
  onSectorChange: (sector: any) => void;
  onPreventClose: (open: boolean) => void;
  isCollapsed?: boolean;
}

const AREA_ICONS: Record<string, React.ElementType> = {
  'MANTENIMIENTO': Wrench,
  'PRODUCCIÓN': Factory,
  'ADMINISTRACIÓN': Users,
};

function getAreaIcon(areaName: string) {
  return AREA_ICONS[areaName?.trim().toUpperCase()] || Building2;
}

function needsSector(areaName: string) {
  const name = areaName?.trim().toUpperCase();
  return name === 'MANTENIMIENTO' || name === 'PRODUCCIÓN';
}

export default function UnifiedAreaSectorSelector({
  currentArea,
  currentSector,
  availableAreas,
  availableSectors,
  currentCompany,
  onAreaChange,
  onSectorChange,
  onPreventClose,
  isCollapsed = false,
}: UnifiedAreaSectorSelectorProps) {
  // Cache de sectores para áreas que no son la actual (lazy load)
  const [otherAreaSectors, setOtherAreaSectors] = useState<Record<number, any[]>>({});
  const [loadingAreaSectors, setLoadingAreaSectors] = useState<Record<number, boolean>>({});

  // Fetch sectores de un área que no es la actual
  const fetchSectorsForArea = useCallback(async (area: any) => {
    if (!currentCompany || loadingAreaSectors[area.id] || otherAreaSectors[area.id]) return;

    setLoadingAreaSectors(prev => ({ ...prev, [area.id]: true }));
    try {
      const isProduction = area.name?.trim().toUpperCase() === 'PRODUCCIÓN';
      const url = isProduction
        ? `/api/sectores?forProduction=true&companyId=${currentCompany.id}`
        : `/api/sectores?areaId=${area.id}`;
      const res = await fetch(url);
      if (res.ok) {
        const sectors = await res.json();
        setOtherAreaSectors(prev => ({ ...prev, [area.id]: sectors }));
      }
    } catch {
      // silenciar error
    } finally {
      setLoadingAreaSectors(prev => ({ ...prev, [area.id]: false }));
    }
  }, [currentCompany, loadingAreaSectors, otherAreaSectors]);

  const getSectorsForArea = (area: any) => {
    if (area.id === currentArea?.id) return availableSectors;
    return otherAreaSectors[area.id] || [];
  };

  // Cuando el usuario elige un sector de otra área
  const handleSelectAreaAndSector = useCallback((area: any, sector: any) => {
    if (area.id === currentArea?.id) {
      onSectorChange(sector);
    } else {
      onAreaChange(area, sector);
    }
  }, [currentArea?.id, onAreaChange, onSectorChange]);

  // Abreviatura del área para que entre el nombre del sector
  const SHORT_AREA_NAMES: Record<string, string> = {
    'MANTENIMIENTO': 'Mant.',
    'PRODUCCIÓN': 'Prod.',
    'ADMINISTRACIÓN': 'Admin.',
  };

  // Label del trigger
  const displayLabel = (() => {
    if (!currentArea) return 'Seleccionar área';
    if (!needsSector(currentArea.name)) return currentArea.name;
    const shortName = SHORT_AREA_NAMES[currentArea.name.trim().toUpperCase()] || currentArea.name;
    if (currentSector) return `${shortName} · ${currentSector.name}`;
    return currentArea.name;
  })();

  const AreaIcon = getAreaIcon(currentArea?.name || '');

  function renderDropdownContent() {
    return (
      <>
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Área y sector
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {availableAreas.map((area) => {
          const Icon = getAreaIcon(area.name);
          const isCurrentArea = currentArea?.id === area.id;

          if (needsSector(area.name)) {
            const sectors = getSectorsForArea(area);
            const isLoading = loadingAreaSectors[area.id];
            return (
              <DropdownMenuSub key={area.id}>
                <DropdownMenuSubTrigger
                  className={cn("text-sm gap-2", isCurrentArea && "bg-accent/50")}
                  onPointerEnter={() => {
                    if (!isCurrentArea && !otherAreaSectors[area.id]) {
                      fetchSectorsForArea(area);
                    }
                  }}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{area.name}</span>
                  {isCurrentArea && <Check className="h-3 w-3 text-primary shrink-0" />}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-52">
                  <DropdownMenuLabel className="text-xs">Sectores</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isLoading ? (
                    <DropdownMenuItem disabled className="text-sm text-muted-foreground">
                      Cargando...
                    </DropdownMenuItem>
                  ) : sectors.length > 0 ? (
                    sectors.map((sector: any) => {
                      const isActive = isCurrentArea && currentSector?.id === sector.id;
                      return (
                        <DropdownMenuItem
                          key={sector.id}
                          onClick={() => handleSelectAreaAndSector(area, sector)}
                          className={cn("text-sm gap-2", isActive && "bg-accent")}
                        >
                          <span className="flex-1">{sector.name}</span>
                          {isActive && <Check className="h-3 w-3 shrink-0" />}
                        </DropdownMenuItem>
                      );
                    })
                  ) : (
                    <DropdownMenuItem disabled className="text-sm text-muted-foreground">
                      Sin sectores
                    </DropdownMenuItem>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            );
          }

          // Área sin sectores (Administración) — click directo
          return (
            <DropdownMenuItem
              key={area.id}
              onClick={() => onAreaChange(area)}
              className={cn("text-sm gap-2", isCurrentArea && "bg-accent")}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{area.name}</span>
              {isCurrentArea && <Check className="h-3 w-3 text-primary shrink-0" />}
            </DropdownMenuItem>
          );
        })}
      </>
    );
  }

  if (isCollapsed) {
    return (
      <DropdownMenu onOpenChange={onPreventClose}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              "w-8 h-8 p-0 rounded-md transition-colors",
              "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
            title={displayLabel}
            aria-label="Cambiar área/sector"
          >
            <AreaIcon className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right" className="w-64">
          {renderDropdownContent()}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu onOpenChange={onPreventClose}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-between h-8 px-2 rounded-md transition-all duration-200 text-sm font-normal",
            "bg-sidebar-accent/50 border-sidebar-ring/30 hover:bg-sidebar-accent hover:border-sidebar-ring/50",
            "text-sidebar-foreground"
          )}
        >
          <span className="truncate text-left">{displayLabel}</span>
          <ChevronDown className="h-3 w-3 flex-shrink-0 opacity-50 ml-1.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {renderDropdownContent()}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
