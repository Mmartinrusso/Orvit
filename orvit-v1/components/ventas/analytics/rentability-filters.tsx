'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Category {
  id: number;
  name: string;
}

interface RentabilityFiltersProps {
  dateRange: {
    from: Date;
    to: Date;
  };
  onDateRangeChange: (range: { from: Date; to: Date }) => void;
  categories: Category[];
  selectedCategory: number | null;
  onCategoryChange: (categoryId: number | null) => void;
  sortBy: string;
  onSortByChange: (sortBy: string) => void;
  margenMinimo: number | null;
  onMargenMinimoChange: (margen: number | null) => void;
  onReset?: () => void;
}

export function RentabilityFilters({
  dateRange,
  onDateRangeChange,
  categories,
  selectedCategory,
  onCategoryChange,
  sortBy,
  onSortByChange,
  margenMinimo,
  onMargenMinimoChange,
  onReset,
}: RentabilityFiltersProps) {
  const [showFromCalendar, setShowFromCalendar] = useState(false);
  const [showToCalendar, setShowToCalendar] = useState(false);

  const hasActiveFilters = selectedCategory !== null || margenMinimo !== null;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Fecha Desde */}
          <div className="space-y-2">
            <Label>Fecha Desde</Label>
            <Popover open={showFromCalendar} onOpenChange={setShowFromCalendar}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !dateRange.from && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.from ? format(dateRange.from, 'PPP', { locale: es }) : 'Seleccionar'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateRange.from}
                  onSelect={(date) => {
                    if (date) {
                      onDateRangeChange({ ...dateRange, from: date });
                      setShowFromCalendar(false);
                    }
                  }}
                  initialFocus
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Fecha Hasta */}
          <div className="space-y-2">
            <Label>Fecha Hasta</Label>
            <Popover open={showToCalendar} onOpenChange={setShowToCalendar}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !dateRange.to && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.to ? format(dateRange.to, 'PPP', { locale: es }) : 'Seleccionar'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateRange.to}
                  onSelect={(date) => {
                    if (date) {
                      onDateRangeChange({ ...dateRange, to: date });
                      setShowToCalendar(false);
                    }
                  }}
                  initialFocus
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Categoría */}
          <div className="space-y-2">
            <Label>Categoría</Label>
            <Select
              value={selectedCategory?.toString() || 'all'}
              onValueChange={(value) => onCategoryChange(value === 'all' ? null : parseInt(value, 10))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas las categorías" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id.toString()}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Ordenar Por */}
          <div className="space-y-2">
            <Label>Ordenar Por</Label>
            <Select value={sortBy} onValueChange={onSortByChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="margen">Margen</SelectItem>
                <SelectItem value="ventas">Ventas</SelectItem>
                <SelectItem value="contribucion">Contribución</SelectItem>
                <SelectItem value="rotacion">Rotación</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Margen Mínimo */}
          <div className="space-y-2">
            <Label>Margen Mínimo (%)</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Ej: 20"
                value={margenMinimo || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  onMargenMinimoChange(val ? parseFloat(val) : null);
                }}
                min="0"
                max="100"
                step="1"
              />
              {margenMinimo !== null && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onMargenMinimoChange(null)}
                  className="flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Reset Button */}
        {hasActiveFilters && onReset && (
          <div className="mt-4 flex justify-end">
            <Button variant="outline" size="sm" onClick={onReset}>
              <X className="w-4 h-4 mr-2" />
              Limpiar Filtros
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
