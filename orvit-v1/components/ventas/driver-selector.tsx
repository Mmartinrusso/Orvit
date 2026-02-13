'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Driver {
  conductorNombre: string;
  conductorDNI?: string | null;
  count: number;
}

interface DriverSelectorProps {
  selectedDriver?: {
    nombre?: string;
    dni?: string;
  };
  onDriverChange: (driver: { nombre: string; dni?: string }) => void;
  error?: string;
}

export function DriverSelector({ selectedDriver, onDriverChange, error }: DriverSelectorProps) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);

  useEffect(() => {
    loadRecentDrivers();
  }, []);

  const loadRecentDrivers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ventas/entregas/drivers');
      if (response.ok) {
        const data = await response.json();
        setDrivers(data.drivers || []);
      }
    } catch (error) {
      console.error('Error loading drivers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDriver = (driver: Driver) => {
    onDriverChange({
      nombre: driver.conductorNombre,
      dni: driver.conductorDNI || undefined,
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
          <Label className="text-sm font-medium">Conductor</Label>
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
                {selectedDriver?.nombre ? (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="truncate">{selectedDriver.nombre}</span>
                    {selectedDriver.dni && (
                      <span className="text-xs text-muted-foreground">DNI: {selectedDriver.dni}</span>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground">Seleccionar conductor...</span>
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0">
              <Command>
                <CommandInput placeholder="Buscar conductor..." />
                <CommandEmpty>No se encontraron conductores.</CommandEmpty>
                <CommandGroup>
                  {drivers.map((driver, index) => (
                    <CommandItem
                      key={index}
                      onSelect={() => handleSelectDriver(driver)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          selectedDriver?.nombre === driver.conductorNombre
                            ? 'opacity-100'
                            : 'opacity-0'
                        )}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{driver.conductorNombre}</p>
                        {driver.conductorDNI && (
                          <p className="text-xs text-muted-foreground">DNI: {driver.conductorDNI}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{driver.count} entregas</span>
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
                    + Ingresar nuevo conductor
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
            <Label className="text-sm font-medium">Nombre del Conductor</Label>
            <Input
              placeholder="Nombre completo"
              value={selectedDriver?.nombre || ''}
              onChange={(e) =>
                onDriverChange({
                  nombre: e.target.value,
                  dni: selectedDriver?.dni,
                })
              }
              className={error ? 'border-red-500' : ''}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">DNI (opcional)</Label>
            <Input
              placeholder="Número de DNI"
              value={selectedDriver?.dni || ''}
              onChange={(e) =>
                onDriverChange({
                  nombre: selectedDriver?.nombre || '',
                  dni: e.target.value,
                })
              }
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCustomMode(false);
              onDriverChange({ nombre: '', dni: '' });
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
