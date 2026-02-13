'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Wrench, Cog, Layers, Search, ChevronRight, ChevronDown, X } from 'lucide-react';
import { Machine, ComponentNode } from './types';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';

interface ComponentsTreeSelectProps {
  machines: Machine[];
  selectedMachineIds: string[];
  componentsByMachine: Map<string, ComponentNode[]>;
  selectedComponentIds: string[];
  onChange: (componentIds: string[]) => void;
  onMachinesChange: (machineIds: string[]) => void;
  disabled?: boolean;
  loadComponents: (machineId: string) => Promise<ComponentNode[]>;
  showMachineSelector?: boolean;
}

interface TreeNodeProps {
  node: ComponentNode;
  selectedIds: Set<string>;
  onToggle: (id: string, children: string[]) => void;
  depth?: number;
  searchTerm?: string;
}

// Get all descendant IDs from a node
const getAllDescendantIds = (node: ComponentNode): string[] => {
  const ids: string[] = [String(node.id)];
  if (node.children) {
    for (const child of node.children) {
      ids.push(...getAllDescendantIds(child));
    }
  }
  return ids;
};

// Check tri-state: 'all' | 'some' | 'none'
const getCheckState = (node: ComponentNode, selectedIds: Set<string>): 'all' | 'some' | 'none' => {
  const allIds = getAllDescendantIds(node);
  const selectedCount = allIds.filter(id => selectedIds.has(id)).length;
  if (selectedCount === 0) return 'none';
  if (selectedCount === allIds.length) return 'all';
  return 'some';
};

function TreeNode({ node, selectedIds, onToggle, depth = 0, searchTerm }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const checkState = getCheckState(node, selectedIds);
  const allDescendantIds = useMemo(() => getAllDescendantIds(node), [node]);

  // Filter by search
  const matchesSearch = searchTerm
    ? node.name.toLowerCase().includes(searchTerm.toLowerCase())
    : true;

  const childrenMatchSearch = searchTerm && node.children
    ? node.children.some(child => 
        child.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (child.children?.some(gc => gc.name.toLowerCase().includes(searchTerm.toLowerCase())))
      )
    : false;

  if (searchTerm && !matchesSearch && !childrenMatchSearch) {
    return null;
  }

  const handleToggle = () => {
    onToggle(String(node.id), allDescendantIds);
  };

  return (
    <div className="select-none">
      <div 
        className={cn(
          'flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors',
          depth > 0 && 'ml-4'
        )}
        onClick={handleToggle}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="h-5 w-5 flex items-center justify-center shrink-0"
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        ) : (
          <div className="w-5" />
        )}
        
        <Checkbox
          checked={checkState === 'all'}
          ref={(el) => {
            if (el) {
              (el as any).indeterminate = checkState === 'some';
            }
          }}
          onCheckedChange={handleToggle}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0"
        />
        
        {node.type === 'COMPONENT' ? (
          <Cog className="h-4 w-4 text-blue-500 shrink-0" />
        ) : (
          <Layers className="h-4 w-4 text-purple-500 shrink-0" />
        )}
        
        <span className={cn(
          'text-sm truncate',
          matchesSearch && searchTerm && 'font-medium text-primary'
        )}>
          {node.name}
        </span>
      </div>
      
      {hasChildren && expanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              selectedIds={selectedIds}
              onToggle={onToggle}
              depth={depth + 1}
              searchTerm={searchTerm}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ComponentsTreeSelect({
  machines,
  selectedMachineIds,
  componentsByMachine,
  selectedComponentIds,
  onChange,
  onMachinesChange,
  disabled = false,
  loadComponents,
  showMachineSelector = false,
}: ComponentsTreeSelectProps) {
  const [searchTerms, setSearchTerms] = useState<Map<string, string>>(new Map());
  const [loadingMachines, setLoadingMachines] = useState<Set<string>>(new Set());
  const [expandedMachines, setExpandedMachines] = useState<string[]>([]);
  const [machineSearchTerm, setMachineSearchTerm] = useState('');

  const selectedIdsSet = useMemo(() => new Set(selectedComponentIds), [selectedComponentIds]);

  const selectedMachines = useMemo(() =>
    machines.filter(m => selectedMachineIds.includes(String(m.id))),
    [machines, selectedMachineIds]
  );

  const availableMachines = useMemo(() => {
    if (!machineSearchTerm) return machines;
    return machines.filter(m =>
      m.name.toLowerCase().includes(machineSearchTerm.toLowerCase())
    );
  }, [machines, machineSearchTerm]);

  const handleMachineExpand = useCallback(async (machineId: string) => {
    // Toggle expansion
    setExpandedMachines(prev => 
      prev.includes(machineId) 
        ? prev.filter(id => id !== machineId)
        : [...prev, machineId]
    );

    // Load components if not loaded
    if (!componentsByMachine.has(machineId) && !loadingMachines.has(machineId)) {
      setLoadingMachines(prev => new Set([...prev, machineId]));
      try {
        await loadComponents(machineId);
      } finally {
        setLoadingMachines(prev => {
          const next = new Set(prev);
          next.delete(machineId);
          return next;
        });
      }
    }
  }, [componentsByMachine, loadingMachines, loadComponents]);

  const handleToggleComponent = useCallback((componentId: string, allDescendantIds: string[]) => {
    const isCurrentlySelected = selectedIdsSet.has(componentId);
    
    if (isCurrentlySelected) {
      // Deselect all descendants
      onChange(selectedComponentIds.filter(id => !allDescendantIds.includes(id)));
    } else {
      // Select all descendants
      const newIds = new Set(selectedComponentIds);
      allDescendantIds.forEach(id => newIds.add(id));
      onChange(Array.from(newIds));
    }
  }, [selectedComponentIds, selectedIdsSet, onChange]);

  const getSelectedCountForMachine = useCallback((machineId: string) => {
    const components = componentsByMachine.get(machineId) || [];
    let count = 0;
    const countSelected = (nodes: ComponentNode[]) => {
      for (const node of nodes) {
        if (selectedIdsSet.has(String(node.id))) count++;
        if (node.children) countSelected(node.children);
      }
    };
    countSelected(components);
    return count;
  }, [componentsByMachine, selectedIdsSet]);

  const clearSelectionForMachine = useCallback((machineId: string) => {
    const components = componentsByMachine.get(machineId) || [];
    const machineComponentIds = new Set<string>();
    const collectIds = (nodes: ComponentNode[]) => {
      for (const node of nodes) {
        machineComponentIds.add(String(node.id));
        if (node.children) collectIds(node.children);
      }
    };
    collectIds(components);
    onChange(selectedComponentIds.filter(id => !machineComponentIds.has(id)));
  }, [componentsByMachine, selectedComponentIds, onChange]);

  const removeMachine = useCallback((machineId: string) => {
    // Remove machine and its components
    clearSelectionForMachine(machineId);
    onMachinesChange(selectedMachineIds.filter(id => id !== machineId));
  }, [selectedMachineIds, onMachinesChange, clearSelectionForMachine]);

  const debouncedSearchTerms = useDebounce(searchTerms, 250);

  const addMachine = useCallback((machineId: string) => {
    if (!selectedMachineIds.includes(machineId)) {
      onMachinesChange([...selectedMachineIds, machineId]);
      // Auto-expand the machine
      setExpandedMachines(prev => [...prev, machineId]);
      // Auto-load components
      handleMachineExpand(machineId);
    }
  }, [selectedMachineIds, onMachinesChange, handleMachineExpand]);

  if (selectedMachines.length === 0 && !showMachineSelector) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Wrench className="h-10 w-10 mx-auto mb-3 opacity-50" />
        <p className="text-sm">Primero selecciona las máquinas arriba</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Machine selector when enabled */}
      {showMachineSelector && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar y agregar máquinas..."
              value={machineSearchTerm}
              onChange={(e) => setMachineSearchTerm(e.target.value)}
              className="pl-10 h-10"
            />
          </div>

          {machineSearchTerm && availableMachines.length > 0 && (
            <ScrollArea className="max-h-[200px] rounded-md border">
              <div className="p-2">
                {availableMachines
                  .filter(m => !selectedMachineIds.includes(String(m.id)))
                  .map((machine) => (
                    <button
                      key={machine.id}
                      type="button"
                      onClick={() => {
                        addMachine(String(machine.id));
                        setMachineSearchTerm('');
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors text-left"
                    >
                      <Wrench className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{machine.name}</span>
                    </button>
                  ))}
              </div>
            </ScrollArea>
          )}

          {machineSearchTerm && availableMachines.filter(m => !selectedMachineIds.includes(String(m.id))).length === 0 && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              {selectedMachineIds.length === machines.length
                ? 'Todas las máquinas ya están agregadas'
                : 'No se encontraron máquinas'}
            </div>
          )}
        </div>
      )}

      {/* Selected machines accordion */}
      {selectedMachines.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Wrench className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Busca y agrega máquinas arriba para seleccionar sus componentes</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[80vh]">
          <Accordion
            type="multiple"
            value={expandedMachines}
            className="space-y-2 pr-4"
          >
            {selectedMachines.map((machine) => {
        const machineId = String(machine.id);
        const components = componentsByMachine.get(machineId) || [];
        const isLoading = loadingMachines.has(machineId);
        const selectedCount = getSelectedCountForMachine(machineId);
        const searchTerm = debouncedSearchTerms.get(machineId) || '';

        return (
          <AccordionItem
            key={machine.id}
            value={machineId}
            className="border rounded-lg overflow-hidden"
          >
            <AccordionTrigger
              onClick={() => handleMachineExpand(machineId)}
              className="px-4 py-3 hover:no-underline hover:bg-muted/30 [&[data-state=open]>svg]:rotate-180"
            >
              <div className="flex items-center gap-3 flex-1">
                <Wrench className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">{machine.name}</span>
                {selectedCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {selectedCount} seleccionados
                  </Badge>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  removeMachine(machineId);
                }}
                className="h-7 w-7 p-0 mr-2"
              >
                <X className="h-4 w-4" />
              </Button>
            </AccordionTrigger>
            <AccordionContent className="pb-0">
              <div className="border-t">
                {/* Search and actions */}
                <div className="flex items-center gap-2 p-3 border-b bg-muted/20">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar componentes..."
                      value={searchTerms.get(machineId) || ''}
                      onChange={(e) => setSearchTerms(prev => new Map(prev).set(machineId, e.target.value))}
                      className="pl-9 h-8 text-xs"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => clearSelectionForMachine(machineId)}
                    className="h-8 text-xs"
                    disabled={selectedCount === 0}
                  >
                    Limpiar
                  </Button>
                </div>

                {/* Components tree */}
                <div className="max-h-[70vh] overflow-y-auto">
                  <div className="p-2">
                    {isLoading ? (
                      <div className="text-center py-6 text-muted-foreground text-sm">
                        Cargando componentes...
                      </div>
                    ) : components.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground text-sm">
                        No hay componentes disponibles
                      </div>
                    ) : (
                      components.map((component) => (
                        <TreeNode
                          key={component.id}
                          node={component}
                          selectedIds={selectedIdsSet}
                          onToggle={handleToggleComponent}
                          searchTerm={searchTerm}
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
          </Accordion>
        </ScrollArea>
      )}
    </div>
  );
}

