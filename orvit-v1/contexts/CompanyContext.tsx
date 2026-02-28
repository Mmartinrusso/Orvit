'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { Company, Area, Sector, CompanyState } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import {
  ClientCache,
  CLIENT_TTL,
  clientCacheKeys,
  CACHE_EVENTS,
  emitCacheEvent,
} from '@/lib/client-cache';
import { onTabVisible } from '@/lib/cache-utils';

interface CompanyContextType extends CompanyState {
  setArea: (area: Area | null) => void;
  setSector: (sector: Sector | null) => void;
  setCurrentCompany: (company: Company) => void;
  updateCurrentCompany: (company: Company) => void;
  updateSectors: (sector: Sector & { _delete?: boolean }) => void;
  refreshSectors: () => Promise<void>;
  refreshAreas: () => Promise<void>;
  forceRefreshAll: () => Promise<void>;
  isLoading: boolean;
  /** 0 = fresh, 1 = about to expire, null = no cache */
  areasCacheFreshness: number | null;
  sectorsCacheFreshness: number | null;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

// Singleton cache instance shared across renders
const companyCache = new ClientCache(process.env.NODE_ENV === 'development');

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [companyState, setCompanyState] = useState<CompanyState>({
    currentCompany: null,
    currentArea: null,
    currentSector: null,
    areas: [],
    sectors: [],
  });

  // Freshness tracking — updated on every fetch and periodically
  const [areasCacheFreshness, setAreasCacheFreshness] = useState<number | null>(null);
  const [sectorsCacheFreshness, setSectorsCacheFreshness] = useState<number | null>(null);

  // Refs para evitar llamadas duplicadas
  const loadingAreasRef = useRef<string | null>(null);
  const loadingSectorsRef = useRef<string | null>(null);

  // --- Freshness polling (every 15s) ---
  useEffect(() => {
    const interval = setInterval(() => {
      if (companyState.currentCompany) {
        const aKey = clientCacheKeys.areas(companyState.currentCompany.id);
        setAreasCacheFreshness(companyCache.getFreshness(aKey));
      }
      if (companyState.currentArea && companyState.currentCompany) {
        const isProduction = companyState.currentArea.name?.trim().toUpperCase() === 'PRODUCCIÓN';
        const sKey = isProduction
          ? clientCacheKeys.sectorsProduction(companyState.currentCompany.id)
          : clientCacheKeys.sectors(companyState.currentArea.id);
        setSectorsCacheFreshness(companyCache.getFreshness(sKey));
      }
    }, 15_000);
    return () => clearInterval(interval);
  }, [companyState.currentCompany, companyState.currentArea]);

  // --- Load areas (with 2-min client cache) ---
  const loadAreas = useCallback(async (companyId: string, force = false) => {
    if (loadingAreasRef.current === companyId) return;

    const cacheKey = clientCacheKeys.areas(companyId);

    if (!force) {
      const cached = companyCache.get<Area[]>(cacheKey);
      if (cached) {
        setCompanyState(prev => ({ ...prev, areas: cached }));
        setAreasCacheFreshness(companyCache.getFreshness(cacheKey));
        return;
      }
    }

    loadingAreasRef.current = companyId;
    try {
      const response = await fetch(`/api/areas?companyId=${companyId}`);
      if (response.ok) {
        const areas: Area[] = await response.json();
        companyCache.set(cacheKey, areas, CLIENT_TTL.CRITICAL);
        setCompanyState(prev => ({ ...prev, areas }));
        setAreasCacheFreshness(0);
      } else {
        toast({ title: 'Error', description: 'No se pudieron cargar las áreas', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar las áreas', variant: 'destructive' });
    } finally {
      loadingAreasRef.current = null;
    }
  }, [toast]);

  // --- Refresh areas (force) ---
  const refreshAreas = useCallback(async () => {
    if (companyState.currentCompany) {
      await loadAreas(companyState.currentCompany.id, true);
    }
  }, [companyState.currentCompany, loadAreas]);

  // --- Load sectors (with 2-min client cache) ---
  const loadSectors = useCallback(async (areaId: number, areaName?: string, companyId?: number, force = false) => {
    const isProduction = areaName?.trim().toUpperCase() === 'PRODUCCIÓN';
    const dedupeKey = isProduction ? `production-${companyId}` : String(areaId);

    if (loadingSectorsRef.current === dedupeKey) return;

    const cacheKey = isProduction && companyId
      ? clientCacheKeys.sectorsProduction(companyId)
      : clientCacheKeys.sectors(areaId);

    if (!force) {
      const cached = companyCache.get<Sector[]>(cacheKey);
      if (cached) {
        setCompanyState(prev => ({ ...prev, sectors: cached }));
        setSectorsCacheFreshness(companyCache.getFreshness(cacheKey));
        return;
      }
    }

    loadingSectorsRef.current = dedupeKey;
    try {
      const url = isProduction && companyId
        ? `/api/sectores?forProduction=true&companyId=${companyId}`
        : `/api/sectores?areaId=${areaId}`;
      const response = await fetch(url);
      if (response.ok) {
        const sectors: Sector[] = await response.json();
        companyCache.set(cacheKey, sectors, CLIENT_TTL.CRITICAL);
        setCompanyState(prev => ({ ...prev, sectors }));
        setSectorsCacheFreshness(0);
      } else {
        toast({ title: 'Error', description: 'No se pudieron cargar los sectores', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar los sectores', variant: 'destructive' });
    } finally {
      loadingSectorsRef.current = null;
    }
  }, [toast]);

  // --- Force refresh everything ---
  const forceRefreshAll = useCallback(async () => {
    companyCache.invalidateAll();
    const promises: Promise<void>[] = [];

    if (companyState.currentCompany) {
      promises.push(loadAreas(companyState.currentCompany.id, true));
    }
    if (companyState.currentArea && companyState.currentCompany) {
      promises.push(
        loadSectors(
          companyState.currentArea.id,
          companyState.currentArea.name,
          companyState.currentCompany.id,
          true
        )
      );
    }

    await Promise.all(promises);
    emitCacheEvent(CACHE_EVENTS.FORCE_REFRESH, { source: 'forceRefreshAll' });
  }, [companyState.currentCompany, companyState.currentArea, loadAreas, loadSectors]);

  // --- Listen for cache invalidation events ---
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleAreasChanged = () => {
      if (companyState.currentCompany) {
        companyCache.invalidatePattern('^client:areas:');
        loadAreas(companyState.currentCompany.id, true);
      }
    };

    const handleSectorsChanged = () => {
      if (companyState.currentArea && companyState.currentCompany) {
        companyCache.invalidatePattern('^client:sectors:');
        loadSectors(
          companyState.currentArea.id,
          companyState.currentArea.name,
          companyState.currentCompany.id,
          true
        );
      }
    };

    const handleForceRefresh = () => {
      // Already handled by forceRefreshAll — this catches external dispatches
      if (companyState.currentCompany) {
        companyCache.invalidateAll();
        loadAreas(companyState.currentCompany.id, true);
        if (companyState.currentArea) {
          loadSectors(
            companyState.currentArea.id,
            companyState.currentArea.name,
            companyState.currentCompany.id,
            true
          );
        }
      }
    };

    window.addEventListener(CACHE_EVENTS.AREAS_CHANGED, handleAreasChanged);
    window.addEventListener(CACHE_EVENTS.SECTORS_CHANGED, handleSectorsChanged);
    window.addEventListener(CACHE_EVENTS.FORCE_REFRESH, handleForceRefresh);

    return () => {
      window.removeEventListener(CACHE_EVENTS.AREAS_CHANGED, handleAreasChanged);
      window.removeEventListener(CACHE_EVENTS.SECTORS_CHANGED, handleSectorsChanged);
      window.removeEventListener(CACHE_EVENTS.FORCE_REFRESH, handleForceRefresh);
    };
  }, [companyState.currentCompany, companyState.currentArea, loadAreas, loadSectors]);

  // --- Listen for cross-tab changes via storage events ---
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cache_invalidation' && e.newValue) {
        try {
          const detail = JSON.parse(e.newValue);
          if (detail?.event) {
            // Dispatch locally only — do NOT re-broadcast to avoid infinite loop
            window.dispatchEvent(
              new CustomEvent(detail.event, { detail })
            );
          }
        } catch {
          // Ignore malformed JSON
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // --- Auto-refresh when tab becomes visible after being hidden ≥30s ---
  useEffect(() => {
    return onTabVisible(() => {
      if (companyState.currentCompany) {
        loadAreas(companyState.currentCompany.id, true);
        if (companyState.currentArea) {
          loadSectors(
            companyState.currentArea.id,
            companyState.currentArea.name,
            companyState.currentCompany.id,
            true
          );
        }
      }
    });
  }, [companyState.currentCompany, companyState.currentArea, loadAreas, loadSectors]);

  // Inicializar desde localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedCompany = localStorage.getItem('currentCompany');
    const savedArea = localStorage.getItem('currentArea');
    const savedSector = localStorage.getItem('currentSector');

    let parsedCompany = null;
    let parsedArea = null;
    let parsedSector = null;
    try {
      parsedCompany = savedCompany ? JSON.parse(savedCompany) : null;
      parsedArea = savedArea ? JSON.parse(savedArea) : null;
      parsedSector = savedSector ? JSON.parse(savedSector) : null;
    } catch {
      // Datos de localStorage corruptos — limpiar y usar null
      localStorage.removeItem('currentCompany');
      localStorage.removeItem('currentArea');
      localStorage.removeItem('currentSector');
    }

    // Si no hay sector guardado pero el área lo necesita, restaurar desde lastSector
    if (!parsedSector && parsedArea) {
      const areaName = (parsedArea as any).name?.trim().toUpperCase();
      if (areaName === 'MANTENIMIENTO' || areaName === 'PRODUCCIÓN') {
        const saved = localStorage.getItem(`lastSector_area_${(parsedArea as any).id}`);
        if (saved) {
          try {
            parsedSector = JSON.parse(saved);
            localStorage.setItem('currentSector', saved);
          } catch { /* ignore */ }
        }
      }
    }

    setCompanyState(prev => ({
      ...prev,
      currentCompany: parsedCompany,
      currentArea: parsedArea,
      currentSector: parsedSector,
    }));
    setIsLoading(false);
  }, []);

  // Mirror a sessionStorage para restauración per-tab
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (companyState.currentCompany) {
      sessionStorage.setItem('currentCompany', JSON.stringify(companyState.currentCompany));
    }
    if (companyState.currentArea) {
      sessionStorage.setItem('currentArea', JSON.stringify(companyState.currentArea));
    }
    if (companyState.currentSector) {
      sessionStorage.setItem('currentSector', JSON.stringify(companyState.currentSector));
    }
  }, [companyState.currentCompany, companyState.currentArea, companyState.currentSector]);

  // Cargar áreas cuando se selecciona una empresa
  useEffect(() => {
    if (pathname === '/login') return;
    if (companyState.currentCompany) {
      loadAreas(companyState.currentCompany.id);
    }
  }, [companyState.currentCompany, pathname, loadAreas]);

  // Cargar sectores cuando se selecciona un área
  useEffect(() => {
    if (pathname === '/login') return;
    if (companyState.currentArea && companyState.currentCompany) {
      loadSectors(
        companyState.currentArea.id,
        companyState.currentArea.name,
        companyState.currentCompany.id
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- loadSectors intentionally omitted to avoid re-fetch loops
  }, [companyState.currentArea, companyState.currentCompany, pathname]);

  // Setear área
  const setArea = (area: Area | null) => {
    setCompanyState(prev => ({
      ...prev,
      currentArea: area,
      currentSector: null,
      sectors: [],
    }));
    if (typeof window !== 'undefined') {
      if (area) {
        localStorage.setItem('currentArea', JSON.stringify(area));
      } else {
        localStorage.removeItem('currentArea');
      }
      localStorage.removeItem('currentSector');
    }
    // Invalidate sectors cache when area changes
    companyCache.invalidatePattern('^client:sectors:');
    setSectorsCacheFreshness(null);
  };

  // Actualizar lista de sectores
  const updateSectors = (sector: Sector & { _delete?: boolean }) => {
    setCompanyState(prev => {
      let newSectors: Sector[];
      if (sector._delete) {
        newSectors = prev.sectors.filter(s => s.id !== sector.id);
      } else {
        const exists = prev.sectors.some(s => s.id === sector.id);
        if (exists) {
          newSectors = prev.sectors.map(s => s.id === sector.id ? sector : s);
        } else {
          newSectors = [...prev.sectors, sector];
        }
      }

      // Update cache with the new list
      if (prev.currentArea && prev.currentCompany) {
        const isProduction = prev.currentArea.name?.trim().toUpperCase() === 'PRODUCCIÓN';
        const cacheKey = isProduction
          ? clientCacheKeys.sectorsProduction(prev.currentCompany.id)
          : clientCacheKeys.sectors(prev.currentArea.id);
        companyCache.set(cacheKey, newSectors, CLIENT_TTL.CRITICAL);
      }

      return { ...prev, sectors: newSectors };
    });

    // Notify other listeners
    emitCacheEvent(CACHE_EVENTS.SECTORS_CHANGED, { source: 'updateSectors' });
  };

  // Setear sector
  const setSector = useCallback((sector: Sector | null) => {
    setCompanyState(prev => {
      if (typeof window !== 'undefined' && sector && prev.currentArea?.id) {
        localStorage.setItem(`lastSector_area_${prev.currentArea.id}`, JSON.stringify(sector));
      }
      return { ...prev, currentSector: sector };
    });

    if (typeof window !== 'undefined') {
      if (sector) {
        localStorage.setItem('currentSector', JSON.stringify(sector));
        toast({ title: 'Sector seleccionado', description: `Ahora estás trabajando en: ${sector.name}` });
      } else {
        localStorage.removeItem('currentSector');
      }
    }
  }, [toast]);

  // Setear empresa (limpia área y sector)
  const setCurrentCompany = (company: Company) => {
    // Invalidate all client cache when switching companies
    companyCache.invalidateAll();
    setAreasCacheFreshness(null);
    setSectorsCacheFreshness(null);

    setCompanyState(prev => ({
      ...prev,
      currentCompany: company,
      currentArea: null,
      currentSector: null,
      sectors: [],
    }));
    if (typeof window !== 'undefined') {
      localStorage.setItem('currentCompany', JSON.stringify(company));
      localStorage.removeItem('currentArea');
      localStorage.removeItem('currentSector');
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('lastSector_area_')) {
          localStorage.removeItem(key);
        }
      });
    }
    toast({ title: 'Empresa seleccionada', description: `Ahora estás trabajando en: ${company.name}` });
    emitCacheEvent(CACHE_EVENTS.COMPANY_CHANGED, { source: 'setCurrentCompany', companyId: company.id });
  };

  // Actualizar empresa (mantiene área y sector actuales)
  const updateCurrentCompany = (company: Company) => {
    setCompanyState(prev => ({ ...prev, currentCompany: company }));
    if (typeof window !== 'undefined') {
      localStorage.setItem('currentCompany', JSON.stringify(company));
    }
  };

  // Refrescar sectores (force)
  const refreshSectors = async () => {
    if (!companyState.currentArea || !companyState.currentCompany) return;

    // Invalidate sectors cache
    companyCache.invalidatePattern('^client:sectors:');

    try {
      const isProduction = companyState.currentArea.name?.trim().toUpperCase() === 'PRODUCCIÓN';
      const url = isProduction
        ? `/api/sectores?forProduction=true&companyId=${companyState.currentCompany.id}`
        : `/api/sectores?areaId=${companyState.currentArea.id}`;

      const response = await fetch(url);
      if (response.ok) {
        const data: Sector[] = await response.json();

        // Re-cache
        const cacheKey = isProduction
          ? clientCacheKeys.sectorsProduction(companyState.currentCompany.id)
          : clientCacheKeys.sectors(companyState.currentArea.id);
        companyCache.set(cacheKey, data, CLIENT_TTL.CRITICAL);
        setSectorsCacheFreshness(0);

        setCompanyState(prev => {
          const updated = { ...prev, sectors: data };
          if (prev.currentSector) {
            const updatedSector = data.find((s: Sector) => s.id === prev.currentSector?.id);
            if (updatedSector) {
              updated.currentSector = updatedSector;
              if (typeof window !== 'undefined') {
                localStorage.setItem('currentSector', JSON.stringify(updatedSector));
              }
            }
          }
          return updated;
        });
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudieron refrescar los sectores', variant: 'destructive' });
    }
  };

  const contextValue = useMemo<CompanyContextType>(() => ({
    ...companyState,
    setArea,
    setSector,
    setCurrentCompany,
    updateCurrentCompany,
    updateSectors,
    refreshSectors,
    refreshAreas,
    forceRefreshAll,
    isLoading,
    areasCacheFreshness,
    sectorsCacheFreshness,
  // eslint-disable-next-line react-hooks/exhaustive-deps -- non-memoized fns intentionally omitted; they close over companyState which is tracked
  }), [companyState, setSector, refreshAreas, forceRefreshAll, isLoading, areasCacheFreshness, sectorsCacheFreshness]);

  return (
    <CompanyContext.Provider value={contextValue}>
      {children}
    </CompanyContext.Provider>
  );
}

export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
};
