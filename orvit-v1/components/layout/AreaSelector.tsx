'use client';

import { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCompany } from '@/contexts/CompanyContext';
import { useAreaPermissions } from '@/hooks/use-area-permissions';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Building2, RefreshCw } from 'lucide-react';
import { useSidebarContext } from '@/contexts/SidebarContext';
import { getFreshnessInfo } from '@/lib/cache-utils';

export default function AreaSelector() {
  const router = useRouter();
  const { currentArea, areas, setArea, isLoading, refreshAreas, areasCacheFreshness } = useCompany();
  const sidebarCtx = useSidebarContext();
  const { canAccessAdministration, canAccessMaintenance, canAccessProduction, isLoading: permissionsLoading } = useAreaPermissions();

  // Filtrar áreas según los permisos del usuario
  const availableAreas = useMemo(() => {
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
      return true;
    });
  }, [areas, canAccessAdministration, canAccessMaintenance, canAccessProduction]);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const freshness = getFreshnessInfo(areasCacheFreshness);
  const isStale = areasCacheFreshness !== null && areasCacheFreshness > 0.8;

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshAreas();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshAreas]);

  if (isLoading || !currentArea) {
    return (
      <div className="flex items-center">
        <div className="mr-2 text-muted-foreground hidden md:block">Área:</div>
        <div className="font-semibold text-foreground bg-card/70 px-4 py-2 rounded-full">
          {currentArea ? currentArea.name : 'Sin área seleccionada'}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <div className="mr-2 text-muted-foreground hidden md:block">Área:</div>
      <Select
        value={currentArea.id.toString()}
        onOpenChange={(open) => {
          sidebarCtx?.setPreventClose(open);
        }}
        onValueChange={(value) => {
          if (value === 'change-area') {
            setArea(null);
            if (typeof window !== 'undefined') {
              localStorage.removeItem('currentArea');
              localStorage.removeItem('currentSector');
            }
            router.push('/areas');
          } else {
            const area = availableAreas.find((a) => a.id.toString() === value);
            if (area) {
              setArea(area);
              if (area.name === 'Administración') {
                router.push('/administracion/dashboard');
              } else {
                router.push('/sectores');
              }
            }
          }
        }}
      >
        <SelectTrigger className={cn(
          "w-auto min-w-[180px] bg-card/70 hover:bg-card/90 transition-all !border !border-white/10 !shadow-[0_0_0_1.5px_rgba(255,255,255,0.08)] !outline-none !ring-0 focus:!ring-0 focus:!outline-none focus:!border-white/20 focus:!shadow-[0_0_0_2px_rgba(255,255,255,0.15)] active:!border-white/20 active:!shadow-[0_0_0_2px_rgba(255,255,255,0.15)] px-4 py-2 rounded-full font-medium text-foreground flex items-center gap-2",
          isStale && "!border-warning-muted"
        )}>
          <div className="flex items-center">
            <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
            <span className="font-semibold">{currentArea.name}</span>
            {isStale && (
              <span className="ml-2 h-1.5 w-1.5 rounded-full bg-warning-muted-foreground animate-pulse" />
            )}
          </div>
        </SelectTrigger>
        <SelectContent>
          {availableAreas
            .map((area) => (
              <SelectItem key={area.id} value={area.id.toString()}>
                {area.name}
              </SelectItem>
            ))}
          <SelectItem value="change-area" className="text-primary font-medium border-t">
            <div className="flex items-center">
              <Building2 className="h-4 w-4 mr-2" />
              <span>Cambiar de área...</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRefresh();
              }}
              disabled={isRefreshing}
              className={cn(
                "h-7 w-7 flex items-center justify-center rounded-full transition-colors",
                "text-muted-foreground hover:text-foreground hover:bg-card/90",
                isStale && "text-warning-muted-foreground hover:text-warning-muted-foreground",
                isRefreshing && "opacity-70 cursor-not-allowed"
              )}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {isRefreshing
              ? 'Actualizando...'
              : isStale
                ? `${freshness.label} — clic para actualizar`
                : 'Actualizar áreas'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
