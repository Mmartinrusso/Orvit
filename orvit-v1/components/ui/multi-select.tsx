'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';

export interface MultiSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  emptyMessage?: string;
  searchPlaceholder?: string;
  maxCount?: number;
  className?: string;
  disabled?: boolean;
  onCreateNew?: (name: string) => Promise<void> | void;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Seleccionar...',
  emptyMessage = 'No se encontraron opciones',
  searchPlaceholder = 'Buscar...',
  maxCount = 3,
  className,
  disabled = false,
  onCreateNew,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');

  // Filtrado manual para poder mostrar siempre la opción "Crear"
  const filteredOptions = React.useMemo(() => {
    if (!searchValue.trim()) return options;
    const lower = searchValue.toLowerCase();
    return options.filter(opt => opt.label.toLowerCase().includes(lower));
  }, [options, searchValue]);

  const selectedValues = React.useMemo(() => {
    return options.filter(option => selected.includes(option.value));
  }, [options, selected]);

  const handleUnselect = (value: string) => {
    onChange(selected.filter(item => item !== value));
  };

  const handleSelect = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(item => item !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const handleSelectAll = () => {
    const availableOptions = filteredOptions.filter(opt => !opt.disabled);
    if (selected.length === availableOptions.length) {
      onChange([]);
    } else {
      onChange(availableOptions.map(opt => opt.value));
    }
  };

  const handleCreate = async () => {
    if (!onCreateNew) return;
    const name = searchValue.trim();
    setSearchValue('');
    setOpen(false);
    await onCreateNew(name);
  };

  const showCreateOption = !!onCreateNew;
  // Evitar duplicado exacto solo cuando hay texto
  const exactMatch = searchValue.trim().length > 0 &&
    options.some(o => o.label.toLowerCase() === searchValue.trim().toLowerCase());

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearchValue(''); }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between min-h-[2.5rem] h-auto',
            selected.length > 0 && 'h-auto',
            className
          )}
          disabled={disabled}
        >
          <div className="flex gap-1 flex-wrap flex-1">
            {selected.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              <>
                {selectedValues.slice(0, maxCount).map(option => (
                  <Badge
                    variant="secondary"
                    key={option.value}
                    className="mr-1 mb-1"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleUnselect(option.value);
                    }}
                  >
                    {option.label}
                    <span
                      role="button"
                      tabIndex={0}
                      className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleUnselect(option.value);
                        }
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleUnselect(option.value);
                      }}
                    >
                      <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </span>
                  </Badge>
                ))}
                {selected.length > maxCount && (
                  <Badge variant="secondary" className="mr-1 mb-1">
                    +{selected.length - maxCount} más
                  </Badge>
                )}
              </>
            )}
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={onCreateNew ? `${searchPlaceholder} o escribir para crear...` : searchPlaceholder}
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList className="max-h-56 overflow-y-auto">
            <CommandGroup>
              {/* Seleccionar todos (solo sin búsqueda activa) */}
              {filteredOptions.length > 1 && !searchValue.trim() && (
                <CommandItem onSelect={handleSelectAll} className="font-semibold">
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selected.length === filteredOptions.filter(opt => !opt.disabled).length
                        ? 'opacity-100'
                        : 'opacity-0'
                    )}
                  />
                  Seleccionar todos
                </CommandItem>
              )}

              {/* Opciones existentes */}
              {filteredOptions.map(option => (
                <CommandItem
                  key={option.value}
                  onSelect={() => !option.disabled && handleSelect(option.value)}
                  disabled={option.disabled}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selected.includes(option.value) ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}

              {/* Opción "Crear nuevo" */}
              {showCreateOption && !exactMatch && (
                <CommandItem
                  onSelect={handleCreate}
                  className="text-primary font-medium border-t mt-1 pt-2"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {searchValue.trim() ? `Crear "${searchValue.trim()}"` : 'Crear nuevo'}
                </CommandItem>
              )}

              {/* Estado vacío */}
              {filteredOptions.length === 0 && !showCreateOption && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </div>
              )}
              {filteredOptions.length === 0 && showCreateOption && !exactMatch && searchValue.trim() && (
                <div className="py-2 text-center text-xs text-muted-foreground">
                  Sin resultados para &quot;{searchValue.trim()}&quot;
                </div>
              )}
              {exactMatch && (
                <div className="py-2 text-center text-xs text-muted-foreground">
                  Ya existe un elemento con ese nombre
                </div>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
