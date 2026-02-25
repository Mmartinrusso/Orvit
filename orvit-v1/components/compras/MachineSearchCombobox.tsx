'use client';

import { useState, useEffect, useRef } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Check, ChevronsUpDown, X, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompany } from '@/contexts/CompanyContext';

interface MachineOption {
  id: number;
  name: string;
  nickname: string | null;
  brand: string | null;
  model: string | null;
  status: string;
}

interface MachineSearchComboboxProps {
  value: number | null;
  onSelect: (machineId: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function MachineSearchCombobox({
  value,
  onSelect,
  placeholder = 'Buscar máquina...',
  disabled = false,
  className,
}: MachineSearchComboboxProps) {
  const { currentCompany } = useCompany();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<MachineOption[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<MachineOption | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!open || !currentCompany?.id) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          companyId: String(currentCompany.id),
        });
        if (search.trim()) params.set('search', search.trim());
        params.set('limit', '20');

        const res = await fetch(`/api/machines?${params}`);
        if (res.ok) {
          const data = await res.json();
          setOptions(Array.isArray(data) ? data : data?.machines || []);
        }
      } catch {
        // silent
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, open, currentCompany?.id]);

  useEffect(() => {
    if (value && !selectedMachine && currentCompany?.id) {
      fetch(`/api/machines?companyId=${currentCompany.id}&limit=100`)
        .then(res => res.ok ? res.json() : [])
        .then((data) => {
          const machines = Array.isArray(data) ? data : data?.machines || [];
          const found = machines.find((m: MachineOption) => m.id === value);
          if (found) setSelectedMachine(found);
        })
        .catch(() => {});
    }
    if (!value) setSelectedMachine(null);
  }, [value, currentCompany?.id]);

  const handleSelect = (machine: MachineOption) => {
    if (value === machine.id) {
      onSelect(null);
      setSelectedMachine(null);
    } else {
      onSelect(machine.id);
      setSelectedMachine(machine);
    }
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(null);
    setSelectedMachine(null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between h-9 text-sm font-normal', className)}
        >
          {selectedMachine ? (
            <span className="flex items-center gap-2 truncate">
              <Settings2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">
                {selectedMachine.nickname || selectedMachine.name}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {selectedMachine && (
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
            placeholder="Buscar por nombre..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Buscando...
              </div>
            ) : options.length === 0 ? (
              <CommandEmpty>No se encontraron máquinas</CommandEmpty>
            ) : (
              <CommandGroup>
                {options.map((machine) => (
                  <CommandItem
                    key={machine.id}
                    value={String(machine.id)}
                    onSelect={() => handleSelect(machine)}
                    className="flex items-center gap-3 py-2"
                  >
                    <Check
                      className={cn(
                        'h-4 w-4 shrink-0',
                        value === machine.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <Settings2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">
                        {machine.nickname || machine.name}
                      </div>
                      {machine.brand && (
                        <span className="text-xs text-muted-foreground">
                          {machine.brand} {machine.model || ''}
                        </span>
                      )}
                    </div>
                    <Badge
                      variant={machine.status === 'ACTIVE' ? 'secondary' : 'outline'}
                      className="text-xs shrink-0"
                    >
                      {machine.status === 'ACTIVE' ? 'Activa' : machine.status}
                    </Badge>
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
