'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X, Save } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

interface AdvancedSearchFilters {
  numero?: string;
  search?: string;
  estados?: string[];
  clienteId?: string;
  vendedorId?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  montoMin?: number;
  montoMax?: number;
  moneda?: string;
  requiereAprobacion?: boolean;
  entregasRetrasadas?: boolean;
}

interface OrdenesAdvancedSearchProps {
  onSearch: (filters: AdvancedSearchFilters) => void;
  clientes?: any[];
  vendedores?: any[];
}

const ESTADOS = [
  { value: 'BORRADOR', label: 'Borrador' },
  { value: 'CONFIRMADA', label: 'Confirmada' },
  { value: 'EN_PREPARACION', label: 'En Preparación' },
  { value: 'PARCIALMENTE_ENTREGADA', label: 'Parcialmente Entregada' },
  { value: 'ENTREGADA', label: 'Entregada' },
  { value: 'FACTURADA', label: 'Facturada' },
  { value: 'COMPLETADA', label: 'Completada' },
  { value: 'CANCELADA', label: 'Cancelada' },
];

export function OrdenesAdvancedSearch({ onSearch, clientes = [], vendedores = [] }: OrdenesAdvancedSearchProps) {
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<AdvancedSearchFilters>({});
  const [savedFilters, setSavedFilters] = useState<Array<{ name: string; filters: AdvancedSearchFilters }>>([]);

  const handleSearch = () => {
    onSearch(filters);
    setOpen(false);
  };

  const handleClear = () => {
    setFilters({});
    onSearch({});
  };

  const handleSaveFilter = () => {
    const name = prompt('Nombre del filtro:');
    if (name) {
      setSavedFilters([...savedFilters, { name, filters: { ...filters } }]);
    }
  };

  const handleLoadFilter = (savedFilter: { name: string; filters: AdvancedSearchFilters }) => {
    setFilters(savedFilter.filters);
  };

  const activeFiltersCount = Object.keys(filters).filter(
    (key) => filters[key as keyof AdvancedSearchFilters] !== undefined &&
              filters[key as keyof AdvancedSearchFilters] !== '' &&
              (Array.isArray(filters[key as keyof AdvancedSearchFilters])
                ? (filters[key as keyof AdvancedSearchFilters] as any[]).length > 0
                : true)
  ).length;

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" className="relative">
            <Search className="h-4 w-4 mr-2" />
            Búsqueda Avanzada
            {activeFiltersCount > 0 && (
              <Badge variant="default" className="ml-2 px-1.5 py-0.5 text-xs">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent size="default" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Búsqueda Avanzada de Órdenes</SheetTitle>
            <SheetDescription>
              Filtre órdenes por múltiples criterios
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 py-6">
            {/* Número y Búsqueda General */}
            <div className="space-y-4">
              <div>
                <Label>Número de Orden</Label>
                <Input
                  placeholder="OV-2025-00001"
                  value={filters.numero || ''}
                  onChange={(e) => setFilters({ ...filters, numero: e.target.value })}
                />
              </div>

              <div>
                <Label>Búsqueda General</Label>
                <Input
                  placeholder="Cliente, producto, observaciones..."
                  value={filters.search || ''}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                />
              </div>
            </div>

            {/* Estados */}
            <div>
              <Label>Estados</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {ESTADOS.map((estado) => (
                  <div key={estado.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`estado-${estado.value}`}
                      checked={filters.estados?.includes(estado.value)}
                      onCheckedChange={(checked) => {
                        const newEstados = checked
                          ? [...(filters.estados || []), estado.value]
                          : (filters.estados || []).filter((e) => e !== estado.value);
                        setFilters({ ...filters, estados: newEstados });
                      }}
                    />
                    <Label htmlFor={`estado-${estado.value}`} className="text-sm">
                      {estado.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Cliente */}
            <div>
              <Label>Cliente</Label>
              <Select
                value={filters.clienteId}
                onValueChange={(value) => setFilters({ ...filters, clienteId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos los clientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {clientes.map((cliente) => (
                    <SelectItem key={cliente.id} value={cliente.id}>
                      {cliente.legalName || cliente.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Vendedor */}
            <div>
              <Label>Vendedor</Label>
              <Select
                value={filters.vendedorId?.toString()}
                onValueChange={(value) =>
                  setFilters({ ...filters, vendedorId: value === '__all__' ? undefined : parseInt(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos los vendedores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {vendedores.map((vendedor) => (
                    <SelectItem key={vendedor.id} value={vendedor.id.toString()}>
                      {vendedor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Rango de Fechas */}
            <div>
              <Label>Rango de Fechas de Emisión</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <Label className="text-xs">Desde</Label>
                  <Input
                    type="date"
                    value={filters.fechaDesde || ''}
                    onChange={(e) => setFilters({ ...filters, fechaDesde: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Hasta</Label>
                  <Input
                    type="date"
                    value={filters.fechaHasta || ''}
                    onChange={(e) => setFilters({ ...filters, fechaHasta: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Rango de Montos */}
            <div>
              <Label>Rango de Montos</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <Label className="text-xs">Mínimo</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={filters.montoMin || ''}
                    onChange={(e) =>
                      setFilters({ ...filters, montoMin: parseFloat(e.target.value) || undefined })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Máximo</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Sin límite"
                    value={filters.montoMax || ''}
                    onChange={(e) =>
                      setFilters({ ...filters, montoMax: parseFloat(e.target.value) || undefined })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Moneda */}
            <div>
              <Label>Moneda</Label>
              <Select
                value={filters.moneda}
                onValueChange={(value) => setFilters({ ...filters, moneda: value === '__all__' ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas las monedas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  <SelectItem value="ARS">ARS (Pesos)</SelectItem>
                  <SelectItem value="USD">USD (Dólares)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Checkboxes especiales */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="requiere-aprobacion"
                  checked={filters.requiereAprobacion}
                  onCheckedChange={(checked) =>
                    setFilters({ ...filters, requiereAprobacion: checked as boolean })
                  }
                />
                <Label htmlFor="requiere-aprobacion">Solo pendientes de aprobación</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="entregas-retrasadas"
                  checked={filters.entregasRetrasadas}
                  onCheckedChange={(checked) =>
                    setFilters({ ...filters, entregasRetrasadas: checked as boolean })
                  }
                />
                <Label htmlFor="entregas-retrasadas">Solo con entregas retrasadas</Label>
              </div>
            </div>

            {/* Filtros guardados */}
            {savedFilters.length > 0 && (
              <div>
                <Label>Filtros Guardados</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {savedFilters.map((saved, idx) => (
                    <Badge
                      key={idx}
                      variant="outline"
                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                      onClick={() => handleLoadFilter(saved)}
                    >
                      {saved.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <SheetFooter className="gap-2">
            <Button variant="outline" onClick={handleClear}>
              <X className="h-4 w-4 mr-2" />
              Limpiar
            </Button>
            <Button variant="outline" onClick={handleSaveFilter}>
              <Save className="h-4 w-4 mr-2" />
              Guardar
            </Button>
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
