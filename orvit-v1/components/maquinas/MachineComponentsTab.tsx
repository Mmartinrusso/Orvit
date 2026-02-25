'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X, Sparkles, Plus, Wrench, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MachineComponent } from '@/lib/types';

// ─── Helpers (exported so MachineDetailDialog can also import them) ──────────

export function getComponentTypeLabel(type: string) {
  const normalizedType = type?.toLowerCase();
  switch (normalizedType) {
    case 'part': return 'Parte Principal';
    case 'piece': return 'Pieza';
    case 'subpiece': return 'Subpieza';
    default: return type || 'Pieza';
  }
}

export function getSystemLabel(system: string) {
  const normalizedSystem = system?.toLowerCase();
  switch (normalizedSystem) {
    case 'electrico': return 'Sistema Eléctrico';
    case 'hidraulico': return 'Sistema Hidráulico';
    case 'neumatico': return 'Sistema Neumático';
    case 'automatizacion': return 'Automatización';
    case 'mecanico': return 'Sistema Mecánico';
    case 'refrigeracion': return 'Sistema de Refrigeración';
    case 'lubricacion': return 'Sistema de Lubricación';
    case 'combustible': return 'Sistema de Combustible';
    case 'control': return 'Sistema de Control';
    case 'seguridad': return 'Sistema de Seguridad';
    case 'otro': return 'Otro Sistema';
    default: return system || 'Sistema';
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface MachineComponentsTabProps {
  sortedComponents: MachineComponent[];
  componentList: MachineComponent[];
  componentSearchTerm: string;
  setComponentSearchTerm: (value: string) => void;
  componentSystemFilter: string;
  setComponentSystemFilter: (value: string) => void;
  componentOrder: { [key: string]: number };
  setComponentOrder: React.Dispatch<React.SetStateAction<{ [key: string]: number }>>;
  saveComponentOrder: (order: { [key: string]: number }) => void;
  setIsAIComponentDialogOpen: (open: boolean) => void;
  setIsAddComponentDialogOpen: (open: boolean) => void;
  handleViewComponentDetails: (component: MachineComponent) => void;
  handleEditComponent: (component: MachineComponent) => void;
  handleDeleteComponent: (id: number) => void;
  canCreateMachine: boolean;
  canEditMachine: boolean;
  canDeleteMachine: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MachineComponentsTab({
  sortedComponents,
  componentList,
  componentSearchTerm,
  setComponentSearchTerm,
  componentSystemFilter,
  setComponentSystemFilter,
  componentOrder,
  setComponentOrder,
  saveComponentOrder,
  setIsAIComponentDialogOpen,
  setIsAddComponentDialogOpen,
  handleViewComponentDetails,
  handleEditComponent,
  handleDeleteComponent,
  canCreateMachine,
  canEditMachine,
  canDeleteMachine,
}: MachineComponentsTabProps) {
  return (
    <div className="space-y-4 max-h-[calc(90vh-180px)] overflow-y-auto pr-2">
      {/* Toolbar de búsqueda y filtros */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-1.5 sm:gap-2">
          {/* Búsqueda */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 h-3.5 sm:h-4 w-3.5 sm:w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={componentSearchTerm}
              onChange={(e) => setComponentSearchTerm(e.target.value)}
              className="pl-8 sm:pl-10 h-7 sm:h-9 text-xs sm:text-sm"
            />
            {componentSearchTerm && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-0.5 sm:right-1 top-1/2 -translate-y-1/2 h-6 sm:h-7 w-6 sm:w-7 p-0"
                onClick={() => setComponentSearchTerm('')}
              >
                <X className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
              </Button>
            )}
          </div>
          {/* Filtro por sistema */}
          <Select value={componentSystemFilter} onValueChange={setComponentSystemFilter}>
            <SelectTrigger className="w-[100px] sm:w-[160px] h-7 sm:h-9 text-xs sm:text-sm">
              <SelectValue placeholder="Sistema" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los sistemas</SelectItem>
              <SelectItem value="electrico">Eléctrico</SelectItem>
              <SelectItem value="hidraulico">Hidráulico</SelectItem>
              <SelectItem value="neumatico">Neumático</SelectItem>
              <SelectItem value="mecanico">Mecánico</SelectItem>
              <SelectItem value="automatizacion">Automatización</SelectItem>
              <SelectItem value="refrigeracion">Refrigeración</SelectItem>
              <SelectItem value="lubricacion">Lubricación</SelectItem>
              <SelectItem value="combustible">Combustible</SelectItem>
              <SelectItem value="control">Control</SelectItem>
              <SelectItem value="seguridad">Seguridad</SelectItem>
              <SelectItem value="otro">Otro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
            {sortedComponents.length} de {componentList.length}
          </span>
          {canCreateMachine && (
            <>
              <Button
                variant="outline"
                className="h-7 sm:h-9 text-xs px-2 sm:px-3"
                onClick={() => setIsAIComponentDialogOpen(true)}
              >
                <Sparkles className="h-3 w-3 sm:mr-1.5" />
                <span className="hidden sm:inline">Agregar con IA</span>
                <span className="sm:hidden">IA</span>
              </Button>
              <Button
                variant="outline"
                className="h-7 sm:h-9 text-xs px-2 sm:px-3"
                onClick={() => setIsAddComponentDialogOpen(true)}
              >
                <Plus className="h-3 w-3 sm:mr-1.5" />
                <span className="hidden sm:inline">Agregar componente</span>
                <span className="sm:hidden">Agregar</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {sortedComponents.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sortedComponents.map((component) => (
            <Card
              key={component.id}
              className="overflow-hidden cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary/30 group"
              onClick={() => handleViewComponentDetails(component)}
            >
              {/* Imagen/Icono arriba */}
              <div className="relative h-24 sm:h-28 bg-gradient-to-br from-muted/50 to-muted/20 flex items-center justify-center">
                {component.logo ? (
                  <img
                    src={component.logo}
                    alt={`Logo de ${component.name}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Wrench className="h-10 w-10 text-muted-foreground/50" />
                )}
                {/* Input de orden en esquina - editable */}
                <input
                  type="number"
                  min="1"
                  max={componentList.length}
                  defaultValue={(componentOrder[component.id.toString()] || 0) + 1}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    e.stopPropagation();
                    const inputValue = parseInt(e.target.value);
                    const maxPosition = componentList.length;
                    if (inputValue < 1) e.target.value = '1';
                    else if (inputValue > maxPosition) e.target.value = maxPosition.toString();
                    const newPosition = parseInt(e.target.value) - 1;
                    if (newPosition >= 0 && newPosition < componentList.length) {
                      setComponentOrder(prev => {
                        const newOrder = { ...prev };
                        const currentPosition = newOrder[component.id.toString()] || 0;
                        if (currentPosition === newPosition) return prev;
                        const componentIds = Object.keys(newOrder).filter(id => id !== component.id.toString());
                        if (newPosition > currentPosition) {
                          componentIds.forEach(id => {
                            const pos = newOrder[id];
                            if (pos > currentPosition && pos <= newPosition) newOrder[id] = pos - 1;
                          });
                        } else {
                          componentIds.forEach(id => {
                            const pos = newOrder[id];
                            if (pos >= newPosition && pos < currentPosition) newOrder[id] = pos + 1;
                          });
                        }
                        newOrder[component.id.toString()] = newPosition;
                        saveComponentOrder(newOrder);
                        return newOrder;
                      });
                    }
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.currentTarget.blur();
                    }
                  }}
                  onFocus={(e) => e.stopPropagation()}
                  className="absolute top-2 left-2 h-6 w-8 text-center text-xs font-medium rounded bg-background/90 backdrop-blur-sm border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary"
                  title="Cambiar posición"
                />
                {/* Acciones en esquina derecha */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {canEditMachine && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditComponent(component);
                      }}
                      className="h-6 w-6 p-0 bg-background/80 backdrop-blur-sm"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                  {canDeleteMachine && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteComponent(Number(component.id));
                      }}
                      className="h-6 w-6 p-0 bg-background/80 backdrop-blur-sm text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
              {/* Contenido abajo */}
              <CardContent className="p-3">
                <h3 className="text-sm font-semibold text-foreground truncate">{component.name}</h3>
                <div className="flex flex-wrap items-center gap-1 mt-1.5">
                  <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20 px-1.5 py-0">
                    {component.parentId === null || component.parentId === undefined ? 'Parte Principal' : getComponentTypeLabel(component.type)}
                  </Badge>
                  {component.system && (
                    <Badge variant="outline" className="text-xs bg-info-muted text-info-muted-foreground border-info-muted px-1.5 py-0">
                      {getSystemLabel(component.system)}
                    </Badge>
                  )}
                </div>
                {component.technicalInfo && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5">
                    {typeof component.technicalInfo === 'string' ? component.technicalInfo : ''}
                  </p>
                )}
                {component.children && component.children.length > 0 && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <Wrench className="h-3 w-3" />
                    <span>{component.children.length} pieza{component.children.length !== 1 ? 's' : ''}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Wrench className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-sm font-medium mb-2">No hay componentes registrados</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Esta máquina no tiene componentes registrados en el sistema.
            </p>
            {canCreateMachine && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="h-9 text-xs"
                  onClick={() => setIsAIComponentDialogOpen(true)}
                >
                  <Sparkles className="h-3 w-3 mr-2" />
                  Agregar con IA
                </Button>
                <Button
                  variant="outline"
                  className="h-9 text-xs"
                  onClick={() => setIsAddComponentDialogOpen(true)}
                >
                  <Plus className="h-3 w-3 mr-2" />
                  Agregar componente
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
