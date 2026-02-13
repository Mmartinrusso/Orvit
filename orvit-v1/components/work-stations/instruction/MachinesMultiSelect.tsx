'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Wrench, X, ChevronDown, Check, Search } from 'lucide-react';
import { Machine } from './types';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';

interface MachinesMultiSelectProps {
  machines: Machine[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MachinesMultiSelect({
  machines,
  selectedIds,
  onChange,
  disabled = false,
  placeholder = 'Buscar y agregar máquinas...',
}: MachinesMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 250);

  const selectedMachines = useMemo(() => 
    machines.filter(m => selectedIds.includes(String(m.id))),
    [machines, selectedIds]
  );

  const filteredMachines = useMemo(() => {
    if (!debouncedSearch) return machines;
    const term = debouncedSearch.toLowerCase();
    return machines.filter(m => 
      m.name.toLowerCase().includes(term)
    );
  }, [machines, debouncedSearch]);

  const handleSelect = useCallback((machineId: string) => {
    if (selectedIds.includes(machineId)) {
      onChange(selectedIds.filter(id => id !== machineId));
    } else {
      onChange([...selectedIds, machineId]);
    }
  }, [selectedIds, onChange]);

  const handleRemove = useCallback((machineId: string) => {
    onChange(selectedIds.filter(id => id !== machineId));
  }, [selectedIds, onChange]);

  const handleSelectAll = useCallback(() => {
    onChange(machines.map(m => String(m.id)));
  }, [machines, onChange]);

  const handleClearAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

  return (
    <div className="space-y-3">
      {/* Combobox trigger */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-10 text-sm font-normal"
            disabled={disabled}
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              <Search className="h-4 w-4" />
              <span>{placeholder}</span>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start" onWheel={(e) => e.stopPropagation()}>
          <Command shouldFilter={false} className="flex flex-col">
            <CommandInput
              placeholder="Buscar máquinas..."
              value={searchTerm}
              onValueChange={setSearchTerm}
              className="h-10"
            />
            <div className="flex items-center justify-between px-3 py-2 border-b flex-shrink-0">
              <span className="text-xs text-muted-foreground">
                {selectedIds.length} seleccionadas
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  className="h-7 text-xs"
                  disabled={selectedIds.length === machines.length}
                >
                  Todas
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  className="h-7 text-xs"
                  disabled={selectedIds.length === 0}
                >
                  Limpiar
                </Button>
              </div>
            </div>
            <CommandList 
              className="max-h-[300px] overflow-y-auto"
              style={{ 
                scrollbarWidth: 'thin',
                WebkitOverflowScrolling: 'touch'
              }}
            >
              <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                No se encontraron máquinas
              </CommandEmpty>
              <CommandGroup>
                {filteredMachines.map((machine) => {
                  const isSelected = selectedIds.includes(String(machine.id));
                  return (
                    <CommandItem
                      key={machine.id}
                      value={String(machine.id)}
                      onSelect={() => handleSelect(String(machine.id))}
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
                    >
                      <div className={cn(
                        'h-5 w-5 rounded border flex items-center justify-center shrink-0 transition-colors',
                        isSelected ? 'bg-primary border-primary' : 'border-input'
                      )}>
                        {isSelected && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                      </div>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Wrench className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate">{machine.name}</span>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected chips */}
      {selectedMachines.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-muted/30 border">
          {selectedMachines.map((machine) => (
            <Badge
              key={machine.id}
              variant="secondary"
              className="text-xs flex items-center gap-1.5 pl-2 pr-1 py-1"
            >
              <Wrench className="h-3 w-3" />
              <span className="max-w-[150px] truncate">{machine.name}</span>
              <button
                type="button"
                onClick={() => handleRemove(String(machine.id))}
                className="ml-1 h-4 w-4 rounded-full hover:bg-destructive/20 flex items-center justify-center"
                disabled={disabled}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
          {selectedMachines.length > 5 && (
            <Badge variant="outline" className="text-xs">
              +{selectedMachines.length - 5} más
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

