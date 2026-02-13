'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Vehicle {
  vehiculo: string;
  transportista?: string | null;
  count: number;
}

interface VehicleSelectorProps {
  selectedVehicle?: {
    vehiculo?: string;
    transportista?: string;
  };
  onVehicleChange: (vehicle: { vehiculo: string; transportista?: string }) => void;
  error?: string;
}

export function VehicleSelector({ selectedVehicle, onVehicleChange, error }: VehicleSelectorProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);

  useEffect(() => {
    loadRecentVehicles();
  }, []);

  const loadRecentVehicles = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ventas/entregas/vehicles');
      if (response.ok) {
        const data = await response.json();
        setVehicles(data.vehicles || []);
      }
    } catch (error) {
      console.error('Error loading vehicles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectVehicle = (vehicle: Vehicle) => {
    onVehicleChange({
      vehiculo: vehicle.vehiculo,
      transportista: vehicle.transportista || undefined,
    });
    setOpen(false);
    setCustomMode(false);
  };

  const handleCustomInput = () => {
    setCustomMode(true);
    setOpen(false);
  };

  return (
    <div className="space-y-3">
      {!customMode ? (
        <>
          <Label className="text-sm font-medium">Vehículo</Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className={cn(
                  'w-full justify-between',
                  error && 'border-red-500'
                )}
              >
                {selectedVehicle?.vehiculo ? (
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-muted-foreground" />
                    <span className="truncate">{selectedVehicle.vehiculo}</span>
                    {selectedVehicle.transportista && (
                      <span className="text-xs text-muted-foreground">
                        - {selectedVehicle.transportista}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground">Seleccionar vehículo...</span>
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0">
              <Command>
                <CommandInput placeholder="Buscar vehículo..." />
                <CommandEmpty>No se encontraron vehículos.</CommandEmpty>
                <CommandGroup>
                  {vehicles.map((vehicle, index) => (
                    <CommandItem
                      key={index}
                      onSelect={() => handleSelectVehicle(vehicle)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          selectedVehicle?.vehiculo === vehicle.vehiculo
                            ? 'opacity-100'
                            : 'opacity-0'
                        )}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{vehicle.vehiculo}</p>
                        {vehicle.transportista && (
                          <p className="text-xs text-muted-foreground">{vehicle.transportista}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{vehicle.count} entregas</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <div className="border-t p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs"
                    onClick={handleCustomInput}
                  >
                    + Ingresar nuevo vehículo
                  </Button>
                </div>
              </Command>
            </PopoverContent>
          </Popover>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </>
      ) : (
        <>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Patente / ID Vehículo</Label>
            <Input
              placeholder="Ej: ABC123"
              value={selectedVehicle?.vehiculo || ''}
              onChange={(e) =>
                onVehicleChange({
                  vehiculo: e.target.value,
                  transportista: selectedVehicle?.transportista,
                })
              }
              className={error ? 'border-red-500' : ''}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Transportista (opcional)</Label>
            <Input
              placeholder="Nombre de la empresa"
              value={selectedVehicle?.transportista || ''}
              onChange={(e) =>
                onVehicleChange({
                  vehiculo: selectedVehicle?.vehiculo || '',
                  transportista: e.target.value,
                })
              }
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCustomMode(false);
              onVehicleChange({ vehiculo: '', transportista: '' });
            }}
          >
            Volver a selección
          </Button>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </>
      )}
    </div>
  );
}
