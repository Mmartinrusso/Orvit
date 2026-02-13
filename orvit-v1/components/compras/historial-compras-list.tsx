'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  History,
  CheckCircle2,
  XCircle,
  Activity,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  HistorialFiltersComponent,
  type HistorialFilters,
} from '@/components/compras/historial-filters';
import {
  HistorialTimeline,
  type HistorialEvento,
} from '@/components/compras/historial-timeline';
import { useViewMode } from '@/contexts/ViewModeContext';

const DEFAULT_FILTERS: HistorialFilters = {
  search: '',
  entidad: 'all',
  accion: 'all',
  fechaDesde: '',
  fechaHasta: '',
  quickFilter: null,
};

interface HistorialResponse {
  eventos: HistorialEvento[];
  nextCursor?: string;
  total: number;
}

export function HistorialComprasList() {
  const { mode: viewMode } = useViewMode();
  const [filters, setFilters] = useState<HistorialFilters>(DEFAULT_FILTERS);
  const [eventos, setEventos] = useState<HistorialEvento[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Estadísticas rápidas
  const [stats, setStats] = useState({
    aprobaciones: 0,
    rechazos: 0,
    hoy: 0,
  });

  // Cargar eventos
  const loadEventos = useCallback(
    async (cursor?: string, append = false) => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('limit', '25');

        if (cursor) {
          params.set('cursor', cursor);
        }
        if (filters.entidad !== 'all') {
          params.set('entidad', filters.entidad);
        }
        if (filters.accion !== 'all') {
          params.set('accion', filters.accion);
        }
        if (filters.fechaDesde) {
          params.set('fechaDesde', filters.fechaDesde);
        }
        if (filters.fechaHasta) {
          params.set('fechaHasta', filters.fechaHasta);
        }
        if (filters.search) {
          params.set('search', filters.search);
        }

        // Agregar timestamp para forzar refresh cuando cambia viewMode
        params.set('_vm', viewMode);

        const response = await fetch(`/api/compras/historial?${params.toString()}`);
        if (!response.ok) throw new Error('Error al cargar historial');

        const data: HistorialResponse = await response.json();

        if (append) {
          setEventos((prev) => [...prev, ...data.eventos]);
        } else {
          setEventos(data.eventos);
        }

        setNextCursor(data.nextCursor);
        setTotal(data.total);
      } catch (error) {
        console.error('Error cargando historial:', error);
      } finally {
        setIsLoading(false);
        setIsInitialLoad(false);
      }
    },
    [filters, viewMode]
  );

  // Cargar estadísticas
  const loadStats = useCallback(async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      const [aprobacionesRes, rechazosRes, hoyRes] = await Promise.all([
        fetch(`/api/compras/historial?accion=APPROVE&fechaDesde=${todayStr}&limit=100&_vm=${viewMode}`),
        fetch(`/api/compras/historial?accion=REJECT&fechaDesde=${todayStr}&limit=100&_vm=${viewMode}`),
        fetch(`/api/compras/historial?fechaDesde=${todayStr}&limit=100&_vm=${viewMode}`),
      ]);

      const aprobacionesData = await aprobacionesRes.json();
      const rechazosData = await rechazosRes.json();
      const hoyData = await hoyRes.json();

      setStats({
        aprobaciones: aprobacionesData.eventos?.length || 0,
        rechazos: rechazosData.eventos?.length || 0,
        hoy: hoyData.eventos?.length || 0,
      });
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  }, [viewMode]);

  // Cargar datos iniciales
  useEffect(() => {
    loadEventos();
    loadStats();
  }, [loadEventos, loadStats]);

  // Limpiar filtros
  const handleClearFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  // Cargar más
  const handleLoadMore = () => {
    if (nextCursor && !isLoading) {
      loadEventos(nextCursor, true);
    }
  };

  // Refrescar
  const handleRefresh = () => {
    loadEventos();
    loadStats();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <History className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Historial de Compras</h2>
          <span className="text-xs text-muted-foreground">
            {total} evento(s)
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <Card
          className={`cursor-pointer transition-all ${filters.quickFilter === 'hoy' ? 'ring-2 ring-primary' : 'hover:shadow-md'}`}
          onClick={() => {
            if (filters.quickFilter === 'hoy') {
              setFilters({ ...filters, quickFilter: null, fechaDesde: '', fechaHasta: '' });
            } else {
              const todayStr = new Date().toISOString().split('T')[0];
              setFilters({ ...filters, quickFilter: 'hoy', fechaDesde: todayStr, fechaHasta: todayStr, accion: 'all' });
            }
          }}
        >
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-blue-100">
                <Activity className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div>
                <p className="text-xl font-bold">{stats.hoy}</p>
                <p className="text-[10px] text-muted-foreground">Hoy</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${filters.quickFilter === 'aprobaciones' ? 'ring-2 ring-primary' : 'hover:shadow-md'}`}
          onClick={() => {
            if (filters.quickFilter === 'aprobaciones') {
              setFilters({ ...filters, quickFilter: null, accion: 'all' });
            } else {
              setFilters({ ...filters, quickFilter: 'aprobaciones', accion: 'APPROVE', fechaDesde: '', fechaHasta: '' });
            }
          }}
        >
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-green-100">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-green-600">{stats.aprobaciones}</p>
                <p className="text-[10px] text-muted-foreground">Aprob. hoy</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${filters.quickFilter === 'rechazos' ? 'ring-2 ring-primary' : 'hover:shadow-md'}`}
          onClick={() => {
            if (filters.quickFilter === 'rechazos') {
              setFilters({ ...filters, quickFilter: null, accion: 'all' });
            } else {
              setFilters({ ...filters, quickFilter: 'rechazos', accion: 'REJECT', fechaDesde: '', fechaHasta: '' });
            }
          }}
        >
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-red-100">
                <XCircle className="w-3.5 h-3.5 text-red-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-red-600">{stats.rechazos}</p>
                <p className="text-[10px] text-muted-foreground">Rech. hoy</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-purple-100">
                <History className="w-3.5 h-3.5 text-purple-600" />
              </div>
              <div>
                <p className="text-xl font-bold">{total}</p>
                <p className="text-[10px] text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <HistorialFiltersComponent
        filters={filters}
        onChange={setFilters}
        onClear={handleClearFilters}
      />

      {/* Timeline */}
      <Card>
        <CardContent className="p-0">
          {isInitialLoad ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <HistorialTimeline
              eventos={eventos}
              isLoading={isLoading}
              hasMore={!!nextCursor}
              onLoadMore={handleLoadMore}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default HistorialComprasList;
