'use client';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useDashboardStore } from './useDashboardStore';
import { 
  BarChart3, 
  LineChart, 
  PieChart, 
  Activity,
  TrendingUp,
  Calendar,
  Filter,
  Minus,
  Plus
} from 'lucide-react';

export function FilterDock() {
  const { filters, updateFilter } = useDashboardStore();

  const comparisonModes = [
    { value: '2months', label: '2 Meses (Before/After)', icon: Minus },
    { value: 'range-vs-range', label: 'Rango vs Rango', icon: Plus },
    { value: 'multi-mes', label: 'Multi-mes (3-24m)', icon: BarChart3 },
    { value: 'yoy', label: 'YoY (Año vs Año)', icon: Calendar },
    { value: 'index100', label: 'Índice base = 100', icon: TrendingUp },
  ];

  const chartTypes = [
    { value: 'barras', label: 'Barras', icon: BarChart3 },
    { value: 'linea', label: 'Línea', icon: LineChart },
    { value: 'area', label: 'Área', icon: Activity },
    { value: 'pastel', label: 'Pastel', icon: PieChart },
    { value: 'waterfall', label: 'Waterfall', icon: TrendingUp },
  ];

  const categories = [
    { value: 'all', label: 'Todas las categorías' },
    { value: 'ventas', label: 'Ventas' },
    { value: 'costos', label: 'Costos' },
    { value: 'sueldos', label: 'Sueldos' },
    { value: 'produccion', label: 'Producción' },
    { value: 'insumos', label: 'Insumos' },
  ];

  const timeRanges = [
    { value: '3m', label: '3M' },
    { value: '6m', label: '6M' },
    { value: '12m', label: '12M' },
    { value: '24m', label: '24M' },
    { value: 'custom', label: 'Custom' },
  ];

  return (
    <div className="bg-gray-50 border-b border-gray-200 shadow-sm w-full">
      <div className="max-w-[1400px] mx-auto px-6 py-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-900">Filtros y Controles</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Modo de Comparación */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-600">Modo de Comparación</Label>
            <Select 
              value={filters.comparisonMode} 
              onValueChange={(value) => updateFilter('comparisonMode', value as any)}
            >
              <SelectTrigger className="h-10 bg-white border-gray-300 text-gray-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-300">
                {comparisonModes.map((mode) => {
                  const Icon = mode.icon;
                  return (
                    <SelectItem 
                      key={mode.value} 
                      value={mode.value}
                      className="text-gray-900 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {mode.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Rango de Tiempo */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-600">Rango de Tiempo</Label>
            <div className="flex gap-1">
              {timeRanges.map((range) => (
                <Button
                  key={range.value}
                  variant={filters.timeRange === range.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateFilter('timeRange', range.value as any)}
                  className={`h-8 px-3 text-xs ${
                    filters.timeRange === range.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {range.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Categoría */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-600">Categoría</Label>
            <Select 
              value={filters.category} 
              onValueChange={(value) => updateFilter('category', value as any)}
            >
              <SelectTrigger className="h-10 bg-white border-gray-300 text-gray-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-300">
                {categories.map((category) => (
                  <SelectItem 
                    key={category.value} 
                    value={category.value}
                    className="text-gray-900 hover:bg-gray-50"
                  >
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Visualización */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-600">Visualización</Label>
            <div className="flex gap-1">
              {chartTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <Button
                    key={type.value}
                    variant={filters.chartType === type.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateFilter('chartType', type.value as any)}
                    className={`h-8 px-2 text-xs ${
                      filters.chartType === type.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Vista */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-600">Vista</Label>
            <div className="flex gap-1">
              <Button
                variant={filters.viewMode === 'compact' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateFilter('viewMode', 'compact')}
                className={`h-8 px-3 text-xs ${
                  filters.viewMode === 'compact'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Compacta
              </Button>
              <Button
                variant={filters.viewMode === 'detailed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateFilter('viewMode', 'detailed')}
                className={`h-8 px-3 text-xs ${
                  filters.viewMode === 'detailed'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Detallada
              </Button>
            </div>
          </div>
        </div>

        {/* Toggles avanzados */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center space-x-2">
            <Switch
              id="nominal-adjusted"
              checked={filters.nominalVsAdjusted === 'adjusted'}
              onCheckedChange={(checked) => 
                updateFilter('nominalVsAdjusted', checked ? 'adjusted' : 'nominal')
              }
            />
            <Label htmlFor="nominal-adjusted" className="text-xs text-gray-600">
              Ajustado por inflación
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="fx-normalized"
              checked={filters.fxNormalized}
              onCheckedChange={(checked) => updateFilter('fxNormalized', checked)}
            />
            <Label htmlFor="fx-normalized" className="text-xs text-gray-600">
              FX normalizado
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="show-outliers"
              checked={filters.showOutliers}
              onCheckedChange={(checked) => updateFilter('showOutliers', checked)}
            />
            <Label htmlFor="show-outliers" className="text-xs text-gray-600">
              Mostrar outliers
            </Label>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-gray-600">
              Solo variaciones &gt; {filters.showOnlyVariationsAbove}%
            </Label>
            <Slider
              value={[filters.showOnlyVariationsAbove]}
              onValueChange={([value]) => updateFilter('showOnlyVariationsAbove', value)}
              max={50}
              min={0}
              step={1}
              className="w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
