'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Filter, Calendar as CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export interface AdvancedFilters {
  transportista?: string;
  conductorNombre?: string;
  direccion?: string;
  tipo?: string;
  fechaProgramadaDesde?: Date;
  fechaProgramadaHasta?: Date;
  fechaEntregaDesde?: Date;
  fechaEntregaHasta?: Date;
  statusIn?: string[];
}

interface EntregasAdvancedFiltersProps {
  filters: AdvancedFilters;
  onFiltersChange: (filters: AdvancedFilters) => void;
  onClear: () => void;
}

const AVAILABLE_STATUSES = [
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'EN_PREPARACION', label: 'En Preparación' },
  { value: 'LISTA_PARA_DESPACHO', label: 'Lista para Despacho' },
  { value: 'EN_TRANSITO', label: 'En Tránsito' },
  { value: 'RETIRADA', label: 'Retirada' },
  { value: 'ENTREGADA', label: 'Entregada' },
  { value: 'ENTREGA_FALLIDA', label: 'Entrega Fallida' },
  { value: 'CANCELADA', label: 'Cancelada' },
];

export function EntregasAdvancedFilters({
  filters,
  onFiltersChange,
  onClear,
}: EntregasAdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const hasActiveFilters =
    filters.transportista ||
    filters.conductorNombre ||
    filters.direccion ||
    filters.tipo ||
    filters.fechaProgramadaDesde ||
    filters.fechaProgramadaHasta ||
    filters.fechaEntregaDesde ||
    filters.fechaEntregaHasta ||
    (filters.statusIn && filters.statusIn.length > 0);

  const handleStatusToggle = (statusValue: string) => {
    const current = filters.statusIn || [];
    const newStatusIn = current.includes(statusValue)
      ? current.filter((s) => s !== statusValue)
      : [...current, statusValue];
    onFiltersChange({ ...filters, statusIn: newStatusIn });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Filter className="w-3.5 h-3.5 mr-2" />
          Filtros Avanzados
          {hasActiveFilters && (
            <span className="ml-2 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px]">
              !
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[600px]" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Filtros Avanzados</h4>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onClear();
                  setIsOpen(false);
                }}
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Limpiar todo
              </Button>
            )}
          </div>

          {/* Row 1: Transportista, Conductor, Tipo */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Transportista</Label>
              <Input
                placeholder="Buscar transportista..."
                value={filters.transportista || ''}
                onChange={(e) =>
                  onFiltersChange({ ...filters, transportista: e.target.value })
                }
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Conductor</Label>
              <Input
                placeholder="Buscar conductor..."
                value={filters.conductorNombre || ''}
                onChange={(e) =>
                  onFiltersChange({ ...filters, conductorNombre: e.target.value })
                }
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select
                value={filters.tipo || 'all'}
                onValueChange={(v) =>
                  onFiltersChange({ ...filters, tipo: v === 'all' ? undefined : v })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Todos</SelectItem>
                  <SelectItem value="ENVIO" className="text-xs">Envío</SelectItem>
                  <SelectItem value="RETIRO" className="text-xs">Retiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Dirección */}
          <div className="space-y-1.5">
            <Label className="text-xs">Dirección de Entrega</Label>
            <Input
              placeholder="Buscar por dirección..."
              value={filters.direccion || ''}
              onChange={(e) =>
                onFiltersChange({ ...filters, direccion: e.target.value })
              }
              className="h-8 text-xs"
            />
          </div>

          {/* Row 3: Date Ranges */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Fecha Programada</Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs flex-1 justify-start"
                    >
                      <CalendarIcon className="w-3 h-3 mr-2" />
                      {filters.fechaProgramadaDesde
                        ? format(filters.fechaProgramadaDesde, 'dd/MM/yy', { locale: es })
                        : 'Desde'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.fechaProgramadaDesde}
                      onSelect={(date) =>
                        onFiltersChange({ ...filters, fechaProgramadaDesde: date })
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs flex-1 justify-start"
                    >
                      <CalendarIcon className="w-3 h-3 mr-2" />
                      {filters.fechaProgramadaHasta
                        ? format(filters.fechaProgramadaHasta, 'dd/MM/yy', { locale: es })
                        : 'Hasta'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.fechaProgramadaHasta}
                      onSelect={(date) =>
                        onFiltersChange({ ...filters, fechaProgramadaHasta: date })
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Fecha de Entrega</Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs flex-1 justify-start"
                    >
                      <CalendarIcon className="w-3 h-3 mr-2" />
                      {filters.fechaEntregaDesde
                        ? format(filters.fechaEntregaDesde, 'dd/MM/yy', { locale: es })
                        : 'Desde'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.fechaEntregaDesde}
                      onSelect={(date) =>
                        onFiltersChange({ ...filters, fechaEntregaDesde: date })
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs flex-1 justify-start"
                    >
                      <CalendarIcon className="w-3 h-3 mr-2" />
                      {filters.fechaEntregaHasta
                        ? format(filters.fechaEntregaHasta, 'dd/MM/yy', { locale: es })
                        : 'Hasta'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.fechaEntregaHasta}
                      onSelect={(date) =>
                        onFiltersChange({ ...filters, fechaEntregaHasta: date })
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Row 4: Multi-Status Selection */}
          <div className="space-y-2">
            <Label className="text-xs">Estados (múltiples)</Label>
            <Card>
              <CardContent className="p-3">
                <div className="grid grid-cols-3 gap-2">
                  {AVAILABLE_STATUSES.map((status) => (
                    <div key={status.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={status.value}
                        checked={(filters.statusIn || []).includes(status.value)}
                        onCheckedChange={() => handleStatusToggle(status.value)}
                      />
                      <label
                        htmlFor={status.value}
                        className="text-xs font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {status.label}
                      </label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Apply Button */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              Cerrar
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setIsOpen(false);
              }}
            >
              Aplicar Filtros
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
