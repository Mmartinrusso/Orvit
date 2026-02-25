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
import { Check, ChevronsUpDown, X, Wrench, Box, Cog } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ToolOption {
  id: number;
  name: string;
  code: string | null;
  itemType: string;
  stockQuantity: number;
  minStockLevel: number;
  category: string | null;
}

interface ToolSearchComboboxProps {
  value: number | null;
  onSelect: (toolId: number | null, tool?: ToolOption) => void;
  itemTypeFilter?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const ITEM_TYPE_ICONS: Record<string, React.ElementType> = {
  TOOL: Wrench,
  SUPPLY: Box,
  SPARE_PART: Cog,
  HAND_TOOL: Wrench,
};

export function ToolSearchCombobox({
  value,
  onSelect,
  itemTypeFilter,
  placeholder = 'Buscar en pañol...',
  disabled = false,
  className,
}: ToolSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<ToolOption[]>([]);
  const [selectedTool, setSelectedTool] = useState<ToolOption | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Fetch options with debounce
  useEffect(() => {
    if (!open) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set('q', search.trim());
        if (itemTypeFilter) params.set('itemType', itemTypeFilter);
        params.set('limit', '20');

        const res = await fetch(`/api/tools/search?${params}`);
        if (res.ok) {
          setOptions(await res.json());
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
  }, [search, open, itemTypeFilter]);

  // Load selected tool info if value is set but no selectedTool
  useEffect(() => {
    if (value && !selectedTool) {
      fetch(`/api/tools/search?q=&limit=50`)
        .then(res => res.ok ? res.json() : [])
        .then((tools: ToolOption[]) => {
          const found = tools.find(t => t.id === value);
          if (found) setSelectedTool(found);
        })
        .catch(() => {});
    }
    if (!value) setSelectedTool(null);
  }, [value]);

  const handleSelect = (tool: ToolOption) => {
    if (value === tool.id) {
      onSelect(null);
      setSelectedTool(null);
    } else {
      onSelect(tool.id, tool);
      setSelectedTool(tool);
    }
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(null);
    setSelectedTool(null);
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
          {selectedTool ? (
            <span className="flex items-center gap-2 truncate">
              {selectedTool.code && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0 shrink-0">
                  {selectedTool.code}
                </Badge>
              )}
              <span className="truncate">{selectedTool.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {selectedTool && (
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
            placeholder="Buscar por nombre o código..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Buscando...
              </div>
            ) : options.length === 0 ? (
              <CommandEmpty>No se encontraron items</CommandEmpty>
            ) : (
              <CommandGroup>
                {options.map((tool) => {
                  const Icon = ITEM_TYPE_ICONS[tool.itemType] || Wrench;
                  const isLowStock = tool.stockQuantity <= tool.minStockLevel && tool.minStockLevel > 0;

                  return (
                    <CommandItem
                      key={tool.id}
                      value={String(tool.id)}
                      onSelect={() => handleSelect(tool)}
                      className="flex items-center gap-3 py-2"
                    >
                      <Check
                        className={cn(
                          'h-4 w-4 shrink-0',
                          value === tool.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {tool.code && (
                            <span className="text-xs font-mono text-muted-foreground">
                              {tool.code}
                            </span>
                          )}
                          <span className="text-sm truncate">{tool.name}</span>
                        </div>
                        {tool.category && (
                          <span className="text-xs text-muted-foreground">{tool.category}</span>
                        )}
                      </div>
                      <Badge
                        variant={isLowStock ? 'destructive' : 'secondary'}
                        className="text-xs shrink-0"
                      >
                        {tool.stockQuantity} u.
                      </Badge>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
