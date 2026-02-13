'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Building2, Loader2, Plus, Trash2, Edit, X } from 'lucide-react';

interface Tool {
  id: number;
  name: string;
  description?: string;
  stockQuantity: number;
  category?: string;
  brand?: string;
  model?: string;
  status: string;
}

interface SectorTool {
  id: number;
  sectorId: number;
  toolId: number;
  quantity: number;
  isRequired: boolean;
  notes?: string;
  tool: Tool;
}

interface SectorToolsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sectorId: number;
  companyId: number;
}

export function SectorToolsDialog({
  isOpen,
  onClose,
  sectorId,
  companyId
}: SectorToolsDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingTools, setLoadingTools] = useState(false);
  const [sectorTools, setSectorTools] = useState<SectorTool[]>([]);
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [selectedToolId, setSelectedToolId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [isRequired, setIsRequired] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');
  const [isAddingTool, setIsAddingTool] = useState(false);

  // Cargar herramientas asignadas al sector
  const loadSectorTools = async () => {
    try {
      const response = await fetch(`/api/sectores/${sectorId}/tools`);
      if (response.ok) {
        const data = await response.json();
        setSectorTools(data);
      }
    } catch (error) {
      console.error('Error cargando herramientas del sector:', error);
    }
  };

  // Cargar herramientas disponibles
  const loadAvailableTools = async () => {
    try {
      setLoadingTools(true);
      const response = await fetch(`/api/tools?companyId=${companyId}`);
      if (response.ok) {
        const data = await response.json();
        // La API devuelve { success: true, tools: [...] }
        setAvailableTools(data.tools || data || []);
      } else {
        console.error('Error en respuesta:', response.status);
        setAvailableTools([]);
      }
    } catch (error) {
      console.error('Error cargando herramientas disponibles:', error);
      setAvailableTools([]);
    } finally {
      setLoadingTools(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSectorTools();
      loadAvailableTools();
    }
  }, [isOpen, sectorId, companyId]);

  const handleAddTool = async () => {
    if (!selectedToolId) {
             toast({
         title: 'Error',
         description: 'Por favor selecciona una herramienta o repuesto',
         variant: 'destructive'
       });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/sectores/${sectorId}/tools`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toolId: parseInt(selectedToolId),
          quantity,
          isRequired,
          notes
        }),
      });

      if (response.ok) {
        const newSectorTool = await response.json();
        setSectorTools(prev => [newSectorTool, ...prev]);
        setSelectedToolId('');
        setQuantity(1);
        setIsRequired(true);
        setNotes('');
        setIsAddingTool(false);
                 toast({
           title: 'Éxito',
           description: 'Herramienta/Repuesto asignado al sector correctamente'
         });
      } else {
        const errorData = await response.json();
                 toast({
           title: 'Error',
           description: errorData.error || 'Error al asignar herramienta/repuesto',
           variant: 'destructive'
         });
      }
    } catch (error) {
      console.error('Error asignando herramienta:', error);
             toast({
         title: 'Error',
         description: 'Error al asignar herramienta/repuesto',
         variant: 'destructive'
       });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTool = async (toolId: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/sectores/${sectorId}/tools/${toolId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSectorTools(prev => prev.filter(st => st.toolId !== toolId));
                 toast({
           title: 'Éxito',
           description: 'Herramienta/Repuesto eliminado del sector correctamente'
         });
      } else {
        const errorData = await response.json();
                 toast({
           title: 'Error',
           description: errorData.error || 'Error al eliminar herramienta/repuesto',
           variant: 'destructive'
         });
      }
    } catch (error) {
      console.error('Error eliminando herramienta:', error);
             toast({
         title: 'Error',
         description: 'Error al eliminar herramienta/repuesto',
         variant: 'destructive'
       });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (tool: Tool) => {
    if (tool.stockQuantity === 0) {
      return <Badge variant="destructive">Sin stock</Badge>;
    } else if (tool.stockQuantity <= 5) {
      return <Badge variant="secondary">Stock bajo</Badge>;
    } else {
      return <Badge variant="default">Disponible</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Gestionar Herramientas / Repuestos del Sector
          </DialogTitle>
          <DialogDescription>
            Asigna herramientas y repuestos que estarán disponibles en este sector para emergencias
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
        <div className="space-y-6">
          {/* Sección para agregar nueva herramienta */}
          <Card>
            <CardHeader>
                             <CardTitle className="flex items-center gap-2">
                 <Plus className="h-4 w-4" />
                 Agregar Herramienta / Repuesto al Sector
               </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <div className="space-y-2">
                   <Label htmlFor="tool">Herramienta / Repuesto</Label>
                                     <Select value={selectedToolId} onValueChange={setSelectedToolId} disabled={loadingTools}>
                                           <SelectTrigger>
                        <SelectValue placeholder={loadingTools ? "Cargando..." : "Herramienta / Repuesto"} />
                      </SelectTrigger>
                                         <SelectContent>
                       {(availableTools || [])
                         .filter(tool => !sectorTools.some(st => st.toolId === tool.id))
                         .map(tool => (
                                                       <SelectItem key={tool.id} value={tool.id.toString()}>
                              {tool.name} - {tool.category || 'Sin categoría'}
                            </SelectItem>
                         ))}
                                               {(availableTools || []).length === 0 && (
                          <SelectItem value="no-tools" disabled>
                            No hay herramientas/repuestos disponibles
                          </SelectItem>
                        )}
                     </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantity">Cantidad</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notas</Label>
                  <Input
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notas sobre el uso..."
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="required"
                      checked={isRequired}
                      onCheckedChange={setIsRequired}
                    />
                                         <Label htmlFor="required">Herramienta / Repuesto requerido</Label>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                                 <Button
                   onClick={handleAddTool}
                   disabled={loading || !selectedToolId}
                   className="w-full"
                 >
                   {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                   <Plus className="mr-2 h-4 w-4" />
                   Agregar Herramienta / Repuesto
                 </Button>
              </div>
            </CardContent>
          </Card>

          {/* Lista de herramientas asignadas */}
          <Card>
            <CardHeader>
              <CardTitle>Herramientas / Repuestos Asignados al Sector</CardTitle>
            </CardHeader>
            <CardContent>
                             {sectorTools.length === 0 ? (
                 <div className="text-center py-8 text-muted-foreground">
                   No hay herramientas/repuestos asignados a este sector
                 </div>
              ) : (
                <div className="space-y-3">
                  {sectorTools.map((sectorTool) => (
                    <div
                      key={sectorTool.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{sectorTool.tool.name}</h4>
                          {getStatusBadge(sectorTool.tool)}
                                                     {sectorTool.isRequired && (
                             <Badge variant="outline">Requerido</Badge>
                           )}
                        </div>
                                                 <div className="text-sm text-muted-foreground space-y-1">
                           <p>Categoría: {sectorTool.tool.category || 'Sin categoría'}</p>
                           <p>Cantidad asignada: {sectorTool.quantity}</p>
                           <p>Stock disponible: {sectorTool.tool.stockQuantity}</p>
                           {sectorTool.notes && (
                             <p>Notas: {sectorTool.notes}</p>
                           )}
                         </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveTool(sectorTool.toolId)}
                        disabled={loading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        </DialogBody>

        <DialogFooter>
          <Button onClick={onClose} size="sm" disabled={loading}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 