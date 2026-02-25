'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Check, ChevronsUpDown, X, Puzzle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComponentOption {
  id: number;
  name: string;
  type: string;
  subcomponents?: ComponentOption[];
}

interface ComponentSearchComboboxProps {
  value: number | null;
  onSelect: (componentId: number | null) => void;
  machineId: number | null;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function flattenComponents(components: ComponentOption[]): ComponentOption[] {
  const result: ComponentOption[] = [];
  for (const comp of components) {
    result.push(comp);
    if (comp.subcomponents?.length) {
      result.push(...flattenComponents(comp.subcomponents));
    }
  }
  return result;
}

export function ComponentSearchCombobox({
  value,
  onSelect,
  machineId,
  placeholder = 'Buscar componente...',
  disabled = false,
  className,
}: ComponentSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<ComponentOption[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<ComponentOption | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch components when machineId changes
  useEffect(() => {
    if (!machineId) {
      setOptions([]);
      setSelectedComponent(null);
      return;
    }

    setIsLoading(true);
    fetch(`/api/machines/${machineId}/components`)
      .then(res => res.ok ? res.json() : [])
      .then((tree: ComponentOption[]) => {
        const flat = flattenComponents(tree);
        setOptions(flat);
        if (value) {
          const found = flat.find(c => c.id === value);
          if (found) setSelectedComponent(found);
        }
      })
      .catch(() => setOptions([]))
      .finally(() => setIsLoading(false));
  }, [machineId]);

  // Reset selection when value changes externally
  useEffect(() => {
    if (!value) setSelectedComponent(null);
  }, [value]);

  const filtered = search.trim()
    ? options.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : options;

  const handleSelect = (comp: ComponentOption) => {
    if (value === comp.id) {
      onSelect(null);
      setSelectedComponent(null);
    } else {
      onSelect(comp.id);
      setSelectedComponent(comp);
    }
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(null);
    setSelectedComponent(null);
  };

  const isDisabled = disabled || !machineId;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={isDisabled}
          className={cn('w-full justify-between h-9 text-sm font-normal', className)}
        >
          {selectedComponent ? (
            <span className="flex items-center gap-2 truncate">
              <Puzzle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{selectedComponent.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">
              {!machineId ? 'Seleccionar máquina primero' : placeholder}
            </span>
          )}
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {selectedComponent && (
              <X
                className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={handleClear}
              />
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar componente..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Cargando componentes...
              </div>
            ) : filtered.length === 0 ? (
              <CommandEmpty>No se encontraron componentes</CommandEmpty>
            ) : (
              <CommandGroup>
                {filtered.map((comp) => (
                  <CommandItem
                    key={comp.id}
                    value={String(comp.id)}
                    onSelect={() => handleSelect(comp)}
                    className="flex items-center gap-3 py-2"
                  >
                    <Check
                      className={cn(
                        'h-4 w-4 shrink-0',
                        value === comp.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <Puzzle className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <span className={cn(
                        'text-sm truncate',
                        comp.type === 'subcomponent' && 'pl-4'
                      )}>
                        {comp.type === 'subcomponent' && '└ '}
                        {comp.name}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
