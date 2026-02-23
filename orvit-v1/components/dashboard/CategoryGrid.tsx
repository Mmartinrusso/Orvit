'use client';

import { useState } from 'react';
import { cn, formatNumber } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  BarChart3,
  ExternalLink,
  Download,
  Plus
} from 'lucide-react';
import { CategoryCard } from './types';
import { formatCurrency, formatPercentage, getTrendColor } from './utils/metrics';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';

interface CategoryGridProps {
  categories: CategoryCard[];
  onCategoryClick?: (category: CategoryCard) => void;
  compact?: boolean;
}

export function CategoryGrid({ categories, onCategoryClick, compact = false }: CategoryGridProps) {
  const [selectedCategory, setSelectedCategory] = useState<CategoryCard | null>(null);

  const getPerformanceIcon = (performance: string) => {
    switch (performance) {
      case 'positivo':
        return <TrendingUp className="h-4 w-4 text-success" />;
      case 'negativo':
        return <TrendingDown className="h-4 w-4 text-destructive" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getPerformanceColor = (performance: string) => {
    switch (performance) {
      case 'positivo':
        return 'bg-success-muted text-success border-success-muted';
      case 'negativo':
        return 'bg-destructive/10 text-destructive border-destructive/30';
      default:
        return 'bg-muted text-foreground border-border';
    }
  };

  const handleCategoryClick = (category: CategoryCard) => {
    setSelectedCategory(category);
    onCategoryClick?.(category);
  };

  const handleExport = (category: CategoryCard) => {
    // TODO: Implement export
  };

  const handleCreateTask = (category: CategoryCard) => {
    // TODO: Implement create task
  };

  const gridCols = compact ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';

  return (
    <div className="space-y-6">
      {/* Grid de categorías */}
      <div className={cn('grid gap-4', gridCols)}>
        {categories.map((category, index) => (
          <Card
            key={index}
            className="group relative overflow-hidden border border-border shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer"
            onClick={() => handleCategoryClick(category)}
          >
            {/* Fondo con gradiente sutil */}
            <div className={cn('absolute inset-0',
              category.performance === 'positivo'
                ? 'bg-success-muted'
                : category.performance === 'negativo'
                ? 'bg-destructive/10'
                : 'bg-muted'
            )}></div>
            
            <CardHeader className={cn('relative', compact ? 'pb-2' : 'pb-3')}>
              <div className="flex items-center justify-between">
                <CardTitle className={cn('font-semibold text-foreground', compact ? 'text-sm' : 'text-base')}>
                  {category.name}
                </CardTitle>
                
                <div className="flex items-center gap-1">
                  {getPerformanceIcon(category.performance)}
                  <Badge 
                    variant="secondary" 
                    className={cn('text-xs', getPerformanceColor(category.performance))}
                  >
                    {category.performance === 'positivo' ? '↗' : category.performance === 'negativo' ? '↘' : '→'} {formatNumber(Math.abs(category.changePct), 1)}%
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className={cn('relative space-y-3', compact ? 'pt-0' : 'pt-0')}>
              {/* Valor principal */}
              <div>
                <p className={cn('font-bold text-foreground', compact ? 'text-xl' : 'text-2xl')}>
                  {formatCurrency(category.total)}
                </p>
                <p className={cn('text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>
                  Promedio: {formatCurrency(category.avg)}
                </p>
              </div>

              {/* Cambio del período */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn('text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>
                    Cambio:
                  </span>
                  <span className={cn(getTrendColor(category.changePct), compact ? 'text-sm' : 'text-sm')}>
                    {category.change >= 0 ? '+' : ''}{formatCurrency(category.change)}
                  </span>
                </div>
                <span className={cn(getTrendColor(category.changePct), compact ? 'text-xs' : 'text-sm')}>
                  {formatPercentage(category.changePct)}
                </span>
              </div>

              {/* Share y contribución */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn('text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>
                    Share:
                  </span>
                  <span className={cn('text-foreground', compact ? 'text-xs' : 'text-sm')}>
                    {formatNumber(category.sharePct, 1)}%
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className={cn('text-xs', category.shareDeltaPct >= 0 ? 'text-success' : 'text-destructive')}>
                    {category.shareDeltaPct >= 0 ? '+' : ''}{formatNumber(category.shareDeltaPct, 1)}%
                  </span>
                </div>
              </div>

              {/* Barra de progreso del cambio */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progreso del cambio</span>
                  <span>{formatNumber(Math.abs(category.changePct), 1)}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className={cn('h-2 rounded-full transition-all duration-500',
                      category.changePct >= 0 ? 'bg-success' : 'bg-destructive'
                    )}
                    style={{ 
                      width: `${Math.min(Math.abs(category.changePct) * 10, 100)}%` 
                    }}
                  ></div>
                </div>
              </div>

              {/* Sparkline */}
              <div className={cn(compact ? 'h-8' : 'h-12', 'w-full')}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={category.spark}>
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={category.performance === 'positivo' ? '#10B981' : category.performance === 'negativo' ? '#EF4444' : '#6B7280'}
                      strokeWidth={compact ? 1.5 : 2}
                      dot={false}
                      activeDot={{
                        r: compact ? 2 : 3,
                        fill: category.performance === 'positivo' ? '#10B981' : category.performance === 'negativo' ? '#EF4444' : '#6B7280',
                      }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-card border border-border rounded-lg p-2 text-xs text-foreground shadow-lg">
                              <p>Valor: {formatCurrency(data.value)}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Acciones */}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExport(category);
                    }}
                    className="h-6 px-2 text-xs bg-background border-border text-foreground hover:bg-accent"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Export
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreateTask(category);
                    }}
                    className="h-6 px-2 text-xs bg-background border-border text-foreground hover:bg-accent"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Tarea
                  </Button>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCategoryClick(category);
                  }}
                  className="h-6 px-2 text-xs bg-background border-border text-foreground hover:bg-accent"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Ver
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Modal de detalle (placeholder) */}
      {selectedCategory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-foreground">
                Detalle de {selectedCategory.name}
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCategory(null)}
                className="bg-background border-border text-foreground hover:bg-accent"
              >
                ✕
              </Button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-lg font-bold text-foreground">
                    {formatCurrency(selectedCategory.total)}
                  </p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Promedio</p>
                  <p className="text-lg font-bold text-foreground">
                    {formatCurrency(selectedCategory.avg)}
                  </p>
                </div>
              </div>
              
              <div className="h-64">
                <h4 className="text-sm font-medium text-foreground mb-2">Tendencia 12 meses</h4>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={selectedCategory.spark}>
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-card border border-border rounded-lg p-2 text-xs text-foreground shadow-lg">
                              <p>Valor: {formatCurrency(data.value)}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
