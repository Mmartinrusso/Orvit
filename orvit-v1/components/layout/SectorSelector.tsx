'use client';

import { useRouter } from 'next/navigation';
import { useCompany } from '@/contexts/CompanyContext';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Factory, AlertTriangle, RefreshCw } from 'lucide-react';
import { useState, useCallback } from 'react';
import { useSidebarContext } from '@/contexts/SidebarContext';
import { getFreshnessInfo } from '@/lib/cache-utils';

export default function SectorSelector() {
  const { currentCompany, currentArea, currentSector, sectors, setSector, refreshSectors, sectorsCacheFreshness } = useCompany();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const sidebarCtx = useSidebarContext();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const freshness = getFreshnessInfo(sectorsCacheFreshness);

  // Determinar si el sector está inactivo (por ahora siempre activo ya que no hay campo estado)
  const isInactive = false;

  // Cache nearing expiry (> 80% of TTL elapsed)
  const isStale = sectorsCacheFreshness !== null && sectorsCacheFreshness > 0.8;

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshSectors();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshSectors]);

  if (isLoading || !currentSector) {
    return (
      <div className="flex items-center">
        <div className="mr-2 text-muted-foreground hidden md:block">Sector:</div>
        <div className="font-semibold text-foreground bg-card/70 px-4 py-2 rounded-full">
          {currentSector ? currentSector.name : 'Sin sector seleccionado'}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <div className="mr-2 text-muted-foreground hidden md:block">Sector:</div>
      <Select
        value={currentSector.id.toString()}
        onOpenChange={(open) => {
          sidebarCtx?.setPreventClose(open);
        }}
        onValueChange={(value) => {
          if (value === 'change-sector') {
            setSector(null);
            if (typeof window !== 'undefined') {
              localStorage.removeItem('currentSector');
            }
            router.push('/sectores');
          } else {
            const sector = sectors.find((s) => s.id.toString() === value);
            if (sector) {
              setSector(sector);
              if (currentArea?.name.trim().toUpperCase() === 'MANTENIMIENTO') {
                router.push('/mantenimiento/dashboard');
              } else if (currentArea?.name.trim().toUpperCase() === 'PRODUCCIÓN') {
                router.push('/produccion/dashboard');
              }
            }
          }
        }}
      >
        <SelectTrigger className={cn(
          "w-auto min-w-[180px] transition-all !border !shadow-[0_0_0_1.5px_rgba(255,255,255,0.08)] !outline-none !ring-0 focus:!ring-0 focus:!outline-none px-4 py-2 rounded-full font-medium text-foreground flex items-center gap-2",
          isInactive
            ? "bg-red-50 hover:bg-red-100 !border-red-200 !shadow-[0_0_0_1.5px_rgba(239,68,68,0.2)] focus:!border-red-300 focus:!shadow-[0_0_0_2px_rgba(239,68,68,0.3)] text-red-900"
            : "bg-card/70 hover:bg-card/90 !border-white/10 focus:!border-white/20 focus:!shadow-[0_0_0_2px_rgba(255,255,255,0.15)]",
          isStale && !isInactive && "!border-amber-500/30"
        )}>
          <div className="flex items-center">
            {isInactive ? (
              <AlertTriangle className="h-4 w-4 mr-2 text-red-600 animate-pulse" />
            ) : (
              <Factory className="h-4 w-4 mr-2 text-muted-foreground" />
            )}
            <span className="font-semibold">{currentSector.name}</span>
            {isInactive && (
              <span className="ml-2 px-2 py-0.5 bg-red-200 text-red-800 text-xs rounded-full font-medium">
                PARADA
              </span>
            )}
            {isStale && !isInactive && (
              <span className="ml-2 h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            )}
          </div>
        </SelectTrigger>
        <SelectContent>
          {(sectors && sectors.length > 0) ? (
            <>
              {sectors.map((sector) => {
                const sectorInactive = false;
                return (
                  <SelectItem
                    key={sector.id}
                    value={sector.id.toString()}
                    className={sectorInactive ? "text-red-700 bg-red-50" : ""}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>{sector.name}</span>
                      {sectorInactive && (
                        <span className="ml-2 px-2 py-0.5 bg-red-200 text-red-800 text-xs rounded-full font-medium">
                          PARADA
                        </span>
                      )}
                    </div>
                  </SelectItem>
                );
              })}
              <SelectItem value="change-sector" className="text-primary font-medium border-t">
                <div className="flex items-center">
                  <Factory className="h-4 w-4 mr-2" />
                  <span>Cambiar de sector...</span>
                </div>
              </SelectItem>
            </>
          ) : (
            <SelectItem value="no-sectors" disabled>
              No hay sectores disponibles
            </SelectItem>
          )}
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
                isStale && "text-amber-500 hover:text-amber-400",
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
                : 'Actualizar sectores'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
