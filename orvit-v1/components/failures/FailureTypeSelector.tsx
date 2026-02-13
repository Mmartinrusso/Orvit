'use client';

import React, { useState, useCallback } from 'react';
import { Check, ChevronsUpDown, Plus, Search, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useFailureTypes, FailureType } from '@/hooks/maintenance/use-failure-types';

interface FailureTypeSelectorProps {
  companyId: number | null;
  machineId?: number | null;
  value: FailureType | null;
  onChange: (failureType: FailureType | null) => void;
  onCreateNew?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function FailureTypeSelector({
  companyId,
  machineId,
  value,
  onChange,
  onCreateNew,
  placeholder = 'Seleccionar falla conocida...',
  disabled = false,
  className,
}: FailureTypeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Obtener tipos de falla
  const { data, isLoading } = useFailureTypes({
    companyId,
    machineId: machineId || undefined,
    isActive: true,
    enabled: !!companyId,
  });

  const failureTypes = data?.failureTypes || [];

  // Filtrar por búsqueda
  const filteredTypes = failureTypes.filter(ft =>
    ft.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (ft.description && ft.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSelect = useCallback((selectedType: FailureType) => {
    onChange(selectedType);
    setOpen(false);
    setSearchTerm('');
  }, [onChange]);

  const handleClear = useCallback(() => {
    onChange(null);
    setSearchTerm('');
  }, [onChange]);

  const handleCreateNew = useCallback(() => {
    setOpen(false);
    setSearchTerm('');
    onCreateNew?.();
  }, [onCreateNew]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH':
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'LOW':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getFailureTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      MECANICA: 'Mecánica',
      ELECTRICA: 'Eléctrica',
      HIDRAULICA: 'Hidráulica',
      NEUMATICA: 'Neumática',
      AUTOMATIZACION: 'Automatización',
      SOFTWARE: 'Software',
      OTRO: 'Otro',
    };
    return labels[type] || type;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || !companyId}
          className={cn(
            'w-full justify-between font-normal',
            !value && 'text-muted-foreground',
            className
          )}
        >
          {value ? (
            <div className="flex items-center gap-2 truncate">
              <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
              <span className="truncate">{value.title}</span>
              <Badge variant="outline" className={cn('text-xs', getPriorityColor(value.priority))}>
                {value.occurrencesCount} vez{value.occurrencesCount !== 1 ? 'es' : ''}
              </Badge>
            </div>
          ) : (
            <span className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              {placeholder}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar falla conocida..."
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList>
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Cargando tipos de falla...
              </div>
            ) : (
              <>
                <CommandEmpty>
                  <div className="p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-3">
                      No se encontraron fallas con ese nombre.
                    </p>
                    {onCreateNew && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCreateNew}
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Crear nueva falla
                      </Button>
                    )}
                  </div>
                </CommandEmpty>

                {/* Opción para crear nueva */}
                <CommandGroup heading="Opciones">
                  {value && (
                    <CommandItem onSelect={handleClear} className="text-muted-foreground">
                      <span className="mr-2">✕</span>
                      Limpiar selección (crear falla nueva)
                    </CommandItem>
                  )}
                  {onCreateNew && !value && (
                    <CommandItem onSelect={handleCreateNew} className="text-primary">
                      <Plus className="mr-2 h-4 w-4" />
                      Crear falla ad-hoc (no del catálogo)
                    </CommandItem>
                  )}
                </CommandGroup>

                <CommandSeparator />

                {/* Lista de tipos de falla */}
                {filteredTypes.length > 0 && (
                  <CommandGroup heading={`Fallas conocidas${machineId ? ' de esta máquina' : ''}`}>
                    {filteredTypes.map((ft) => (
                      <CommandItem
                        key={ft.id}
                        value={ft.title}
                        onSelect={() => handleSelect(ft)}
                        className="flex flex-col items-start py-3"
                      >
                        <div className="flex items-center w-full">
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              value?.id === ft.id ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{ft.title}</span>
                              <Badge
                                variant="outline"
                                className={cn('text-xs flex-shrink-0', getPriorityColor(ft.priority))}
                              >
                                {ft.priority}
                              </Badge>
                              <Badge variant="secondary" className="text-xs flex-shrink-0">
                                {getFailureTypeLabel(ft.failureType)}
                              </Badge>
                            </div>
                            {ft.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                {ft.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <span>Ocurrió {ft.occurrencesCount} vez{ft.occurrencesCount !== 1 ? 'es' : ''}</span>
                              {ft.estimatedHours && (
                                <>
                                  <span>•</span>
                                  <span>~{ft.estimatedHours}h estimadas</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default FailureTypeSelector;
