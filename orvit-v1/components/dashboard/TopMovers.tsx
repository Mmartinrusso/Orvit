'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  X
} from 'lucide-react';
import { Mover } from './types';
import { formatCurrency, formatPercentage } from './utils/metrics';

interface TopMoversProps {
  movers: Mover[];
  title?: string;
  maxItems?: number;
}

export function TopMovers({ movers, title = "Top Movers", maxItems = 5 }: TopMoversProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [sortBy, setSortBy] = useState<'delta' | 'deltaPct'>('delta');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterValue, setFilterValue] = useState<string>('');

  // Filtrar y ordenar datos
  const filteredMovers = movers
    .filter(mover => {
      const typeMatch = filterType === 'all' || mover.type === filterType;
      const valueMatch = filterValue === '' || 
        mover.name.toLowerCase().includes(filterValue.toLowerCase());
      return typeMatch && valueMatch;
    })
    .sort((a, b) => {
      if (sortBy === 'delta') {
        return Math.abs(b.delta) - Math.abs(a.delta);
      } else {
        return Math.abs(b.deltaPct) - Math.abs(a.deltaPct);
      }
    });

  const totalPages = Math.ceil(filteredMovers.length / maxItems);
  const startIndex = currentPage * maxItems;
  const endIndex = startIndex + maxItems;
  const currentMovers = filteredMovers.slice(startIndex, endIndex);

  const getTypeIcon = (type: string) => {
    return null; // No mostrar iconos
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'producto':
        return 'bg-blue-500/20 text-blue-400';
      case 'cliente':
        return 'bg-green-500/20 text-green-400';
      case 'proveedor':
        return 'bg-purple-500/20 text-purple-400';
      case 'categoria':
        return 'bg-orange-500/20 text-orange-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(0, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages - 1, prev + 1));
  };

  const clearFilters = () => {
    setFilterType('all');
    setFilterValue('');
    setCurrentPage(0);
  };

  return (
    <Card className="bg-white border-gray-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">
            {title}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortBy(sortBy === 'delta' ? 'deltaPct' : 'delta')}
              className="h-8 px-3 text-xs bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              {sortBy === 'delta' ? 'Por $' : 'Por %'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <Filter className="h-3 w-3 text-gray-600" />
            <span className="text-xs text-gray-600">Filtros:</span>
          </div>
          
          {/* Filtro por tipo */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs bg-white border border-gray-300 text-gray-900 rounded px-2 py-1"
          >
            <option value="all">Todos</option>
            <option value="producto">Productos</option>
            <option value="cliente">Clientes</option>
            <option value="proveedor">Proveedores</option>
            <option value="categoria">Categorías</option>
          </select>

          {/* Filtro por valor */}
          <input
            type="text"
            placeholder="Buscar..."
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            className="text-xs bg-white border border-gray-300 text-gray-900 rounded px-2 py-1 w-24"
          />

          {(filterType !== 'all' || filterValue !== '') && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="h-6 px-2 text-xs bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Lista de movers */}
        <div className="space-y-2">
          {currentMovers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-600">No se encontraron resultados</p>
            </div>
          ) : (
            currentMovers.map((mover, index) => (
              <div
                key={`${mover.name}-${index}`}
                className="group relative flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Ranking */}
                  <div className="flex-shrink-0 w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-gray-900">
                      {startIndex + index + 1}
                    </span>
                  </div>

                  {/* Nombre */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {mover.name}
                      </p>
                      <Badge 
                        variant="secondary" 
                        className={`text-xs ${getTypeColor(mover.type)}`}
                      >
                        {mover.type}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Métricas */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      {mover.delta >= 0 ? (
                        <TrendingUp className="h-3 w-3 text-green-600" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-600" />
                      )}
                      <span className={`text-sm font-bold ${
                        mover.delta >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {mover.delta >= 0 ? '+' : ''}{formatCurrency(mover.delta)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600">
                      {formatPercentage(mover.deltaPct)}
                    </div>
                  </div>

                  {/* Contribución */}
                  <div className="text-right">
                    <div className="text-xs text-gray-600">Contribución</div>
                    <div className="text-sm font-medium text-gray-900">
                      {mover.contributionPct.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-gray-200">
            <div className="text-xs text-gray-600">
              Mostrando {startIndex + 1}-{Math.min(endIndex, filteredMovers.length)} de {filteredMovers.length}
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousPage}
                disabled={currentPage === 0}
                className="h-8 w-8 p-0 bg-white border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              
              <span className="text-xs text-gray-900 px-2">
                {currentPage + 1} / {totalPages}
              </span>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPage === totalPages - 1}
                className="h-8 w-8 p-0 bg-white border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
