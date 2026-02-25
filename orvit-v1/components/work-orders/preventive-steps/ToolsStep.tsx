'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Hammer, Cog, Package, Loader2, Search, X, Plus } from 'lucide-react';
import { SectionCard } from '../SectionCard';
import { EmptyState } from '../EmptyState';
import { ToolRequest } from './types';

interface ToolsStepProps {
  formData: { machineId: string };
  selectedTools: ToolRequest[];
  setSelectedTools: React.Dispatch<React.SetStateAction<ToolRequest[]>>;
  toolSearchTerm: string;
  setToolSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  spareSearchTerm: string;
  setSpareSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  filteredTools: any[];
  filteredSpares: any[];
  loadingTools: boolean;
  loadingSpares: boolean;
  selectedMachine?: { name: string } | any;
  selectedComponents: { name: string }[];
  addTool: (tool: any) => void;
  addSpare: (spare: any) => void;
  removeTool: (toolId: string) => void;
  updateToolQuantity: (toolId: string, quantity: number) => void;
}

export function ToolsStep({
  formData,
  selectedTools,
  setSelectedTools,
  toolSearchTerm,
  setToolSearchTerm,
  spareSearchTerm,
  setSpareSearchTerm,
  filteredTools,
  filteredSpares,
  loadingTools,
  loadingSpares,
  selectedMachine,
  selectedComponents,
  addTool,
  addSpare,
  removeTool,
  updateToolQuantity,
}: ToolsStepProps) {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Herramientas Generales */}
        <SectionCard
          title="Herramientas Generales"
          icon={Hammer}
          description="Herramientas del pañol de uso general"
        >
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar herramientas..."
                value={toolSearchTerm}
                onChange={(e) => setToolSearchTerm(e.target.value)}
                className="pl-10 pr-10"
              />
              {toolSearchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  onClick={() => setToolSearchTerm('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <ScrollArea className="h-[320px]">
              <div className="space-y-2 pr-4">
                {loadingTools ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="ml-2 text-sm text-muted-foreground">Cargando herramientas...</span>
                  </div>
                ) : filteredTools.length === 0 ? (
                  <EmptyState
                    icon={Hammer}
                    title={toolSearchTerm ? 'No se encontraron herramientas' : 'No hay herramientas disponibles'}
                    subtitle={toolSearchTerm ? 'Intente con otro término de búsqueda' : 'Las herramientas se cargarán desde el pañol'}
                  />
                ) : (
                  filteredTools.map((tool) => (
                    <div
                      key={tool.id}
                      className="flex items-center justify-between p-2.5 border rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => addTool(tool)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs truncate">{tool.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {tool.category?.name || 'Sin categoría'} • {tool.location?.name || 'Sin ubicación'}
                        </p>
                        {tool.stockQuantity !== undefined && (
                          <Badge variant="outline" className="text-xs mt-1 bg-info-muted text-info-muted-foreground border-info-muted">
                            Stock: {tool.stockQuantity}
                          </Badge>
                        )}
                      </div>
                      <Button variant="outline" size="sm" className="ml-2 shrink-0">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </SectionCard>

        {/* Repuestos Específicos */}
        <SectionCard
          title="Repuestos Específicos"
          icon={Cog}
          description={selectedMachine
            ? `Repuestos asociados a ${selectedMachine.name}${selectedComponents.length > 0 ? ` - ${selectedComponents.map(c => c.name).join(', ')}` : ''}`
            : 'Repuestos asociados a la máquina seleccionada'
          }
        >
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar repuestos..."
                value={spareSearchTerm}
                onChange={(e) => setSpareSearchTerm(e.target.value)}
                className="pl-10 pr-10"
                disabled={!formData.machineId}
              />
              {spareSearchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  onClick={() => setSpareSearchTerm('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <ScrollArea className="h-[320px]">
              <div className="space-y-2 pr-4">
                {!formData.machineId ? (
                  <EmptyState
                    icon={Cog}
                    title="Seleccione una máquina"
                    subtitle="Para ver sus repuestos específicos"
                  />
                ) : loadingSpares ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="ml-2 text-sm text-muted-foreground">Cargando repuestos...</span>
                  </div>
                ) : filteredSpares.length === 0 ? (
                  <EmptyState
                    icon={Cog}
                    title={spareSearchTerm ? 'No se encontraron repuestos' : 'No hay repuestos específicos'}
                    subtitle={spareSearchTerm ? 'Intente con otro término' : 'Esta máquina no tiene repuestos asociados'}
                  />
                ) : (
                  filteredSpares.map((spare) => (
                    <div
                      key={spare.tool.id}
                      className="flex items-center justify-between p-2.5 border rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => addSpare(spare)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs truncate">{spare.tool.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {spare.tool.category || 'Sin categoría'}
                          {spare.tool.stockQuantity !== undefined && ` • Stock: ${spare.tool.stockQuantity}`}
                        </p>
                        {spare.components.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {spare.components.slice(0, 2).map((comp: any) => (
                              <Badge key={comp.id} variant="secondary" className="text-xs">
                                {comp.name} ({comp.quantityNeeded})
                              </Badge>
                            ))}
                            {spare.components.length > 2 && (
                              <Badge variant="secondary" className="text-xs">
                                +{spare.components.length - 2}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      <Button variant="outline" size="sm" className="ml-2 shrink-0">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </SectionCard>
      </div>

      {/* Productos Seleccionados */}
      {selectedTools.length > 0 && (
        <SectionCard
          title={`Seleccionados (${selectedTools.length})`}
          icon={Package}
          description="Productos agregados a este mantenimiento"
        >
          <div className="space-y-2">
            <div className="flex justify-end mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTools([])}
                className="h-7 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Quitar todo
              </Button>
            </div>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2 pr-4">
                {selectedTools.map((tool) => (
                  <div
                    key={tool.id}
                    className="flex items-center justify-between p-3 border rounded-md bg-muted/30"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs truncate">{tool.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {tool.category} • {tool.location}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Input
                        type="number"
                        min="1"
                        value={tool.quantity}
                        onChange={(e) => updateToolQuantity(tool.id, Number(e.target.value))}
                        className="w-20 h-8 text-sm"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTool(tool.id)}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </SectionCard>
      )}
    </>
  );
}
