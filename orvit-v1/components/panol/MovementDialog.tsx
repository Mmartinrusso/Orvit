'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowUp,
  ArrowDown,
  Save,
  User,
  Calendar,
  FileText,
  Package,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useCompany } from '@/contexts/CompanyContext';

interface Tool {
  id: number;
  name: string;
  stockQuantity: number;
  location: string;
}

interface MovementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
}

export default function MovementDialog({ isOpen, onClose, onSave }: MovementDialogProps) {
  const { currentCompany } = useCompany();
  const [formData, setFormData] = useState({
    toolId: '',
    type: 'IN' as 'IN' | 'OUT',
    quantity: 1,
    reason: '',
    notes: '',
    responsiblePerson: ''
  });

  const [tools, setTools] = useState<Tool[]>([]);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTools, setIsLoadingTools] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchTools();
      resetForm();
    }
  }, [isOpen]);

  useEffect(() => {
    if (formData.toolId) {
      const tool = tools.find(t => t.id.toString() === formData.toolId);
      setSelectedTool(tool || null);
    } else {
      setSelectedTool(null);
    }
  }, [formData.toolId, tools]);

  const fetchTools = async () => {
    if (!currentCompany?.id) return;

    setIsLoadingTools(true);
    try {
      const response = await fetch(`/api/tools?companyId=${currentCompany.id}`);
      if (response.ok) {
        const data = await response.json();
        // Ensure data is always an array
        const toolsArray = Array.isArray(data) ? data : (data?.tools || data?.items || []);
        setTools(toolsArray);
      }
    } catch (error) {
      console.error('Error fetching tools:', error);
      toast.error('Error al cargar herramientas');
      setTools([]);
    } finally {
      setIsLoadingTools(false);
    }
  };

  const resetForm = () => {
    setFormData({
      toolId: '',
      type: 'IN',
      quantity: 1,
      reason: '',
      notes: '',
      responsiblePerson: ''
    });
    setSelectedTool(null);
  };

  const handleSave = async () => {
    if (!formData.toolId || !formData.reason || !formData.responsiblePerson) {
      toast.error('Herramienta, motivo y responsable son requeridos');
      return;
    }

    if (formData.quantity <= 0) {
      toast.error('La cantidad debe ser mayor a 0');
      return;
    }

    if (formData.type === 'OUT' && selectedTool && formData.quantity > selectedTool.stockQuantity) {
      toast.error('No hay suficiente stock disponible');
      return;
    }

    setIsLoading(true);
    toast.loading('Registrando movimiento...', { id: 'movement' });

    try {
      const response = await fetch('/api/tools/movements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toolId: parseInt(formData.toolId),
          type: formData.type,
          quantity: formData.quantity,
          reason: `${formData.reason} - Responsable: ${formData.responsiblePerson}`,
          notes: formData.notes || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al registrar movimiento');
      }

      const result = await response.json();

      toast.success(
        result.message || `Movimiento de ${formData.type === 'IN' ? 'entrada' : 'salida'} registrado`,
        { id: 'movement' }
      );

      onSave?.();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al registrar el movimiento';
      toast.error(message, { id: 'movement' });
    } finally {
      setIsLoading(false);
    }
  };

  const getMovementTypeColor = (type: string) => {
    return type === 'IN' ? 'bg-success-muted text-success' : 'bg-destructive/10 text-destructive';
  };

  const getMovementTypeText = (type: string) => {
    return type === 'IN' ? 'Entrada' : 'Salida';
  };

  const getMovementIcon = (type: string) => {
    return type === 'IN' ? ArrowUp : ArrowDown;
  };

  const MovementIcon = getMovementIcon(formData.type);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Package className="h-6 w-6 text-info-muted-foreground" />
            Registrar Movimiento de Inventario
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
        <div className="space-y-6">
          {/* Tipo de Movimiento */}
          <div className="bg-info-muted p-4 rounded-lg border">
            <h3 className="font-semibold text-info-muted-foreground mb-3 flex items-center gap-2">
              <MovementIcon className="h-4 w-4" />
              Tipo de Movimiento
            </h3>
            
            <div className="flex gap-4">
              <Button
                variant={formData.type === 'IN' ? 'default' : 'outline'}
                onClick={() => setFormData(prev => ({ ...prev, type: 'IN' }))}
                className="flex-1"
              >
                <ArrowUp className="h-4 w-4 mr-2" />
                Entrada
              </Button>
              <Button
                variant={formData.type === 'OUT' ? 'default' : 'outline'}
                onClick={() => setFormData(prev => ({ ...prev, type: 'OUT' }))}
                className="flex-1"
              >
                <ArrowDown className="h-4 w-4 mr-2" />
                Salida
              </Button>
            </div>
            
            <div className="mt-3 flex items-center gap-2">
              <Badge className={getMovementTypeColor(formData.type)}>
                {getMovementTypeText(formData.type)} de Inventario
              </Badge>
            </div>
          </div>

          {/* Selección de Herramienta */}
          <div className="bg-success-muted p-4 rounded-lg border">
            <h3 className="font-semibold text-success mb-3 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Herramienta
            </h3>
            
            <div className="space-y-3">
              <div>
                <Label htmlFor="toolId">Seleccionar Herramienta *</Label>
                <Select
                  value={formData.toolId}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, toolId: value }))}
                  disabled={isLoadingTools}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingTools ? "Cargando..." : "Selecciona una herramienta"} />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingTools ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span className="text-sm text-muted-foreground">Cargando...</span>
                      </div>
                    ) : tools.length === 0 ? (
                      <div className="py-4 text-center text-sm text-muted-foreground">
                        No hay herramientas disponibles
                      </div>
                    ) : (
                      tools.map((tool) => (
                        <SelectItem key={tool.id} value={tool.id.toString()}>
                          {tool.name} (Stock: {tool.stockQuantity})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedTool && (
                <div className="bg-background p-3 rounded border">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-foreground">{selectedTool.name}</p>
                      <p className="text-sm text-foreground">📍 {selectedTool.location}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Stock Actual</p>
                      <p className="text-lg font-bold text-info-muted-foreground">{selectedTool.stockQuantity}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Cantidad y Detalles */}
          <div className="bg-warning-muted p-4 rounded-lg border">
            <h3 className="font-semibold text-warning-muted-foreground mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Detalles del Movimiento
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="quantity">Cantidad *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                />
                {formData.type === 'OUT' && selectedTool && formData.quantity > selectedTool.stockQuantity && (
                  <p className="text-destructive text-sm mt-1">
                    Stock insuficiente (disponible: {selectedTool.stockQuantity})
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="responsiblePerson">Responsable *</Label>
                <Input
                  id="responsiblePerson"
                  value={formData.responsiblePerson}
                  onChange={(e) => setFormData(prev => ({ ...prev, responsiblePerson: e.target.value }))}
                  placeholder="Nombre del responsable"
                />
              </div>
            </div>

            <div className="mt-4">
              <Label htmlFor="reason">Motivo *</Label>
              <Select 
                value={formData.reason} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, reason: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el motivo" />
                </SelectTrigger>
                <SelectContent>
                  {formData.type === 'IN' ? (
                    <>
                      <SelectItem value="purchase">Compra</SelectItem>
                      <SelectItem value="return">Devolución</SelectItem>
                      <SelectItem value="repair">Reparación</SelectItem>
                      <SelectItem value="donation">Donación</SelectItem>
                      <SelectItem value="adjustment">Ajuste de inventario</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="maintenance">Mantenimiento</SelectItem>
                      <SelectItem value="loan">Préstamo</SelectItem>
                      <SelectItem value="damage">Daño/Pérdida</SelectItem>
                      <SelectItem value="transfer">Transferencia</SelectItem>
                      <SelectItem value="disposal">Baja definitiva</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="mt-4">
              <Label htmlFor="notes">Notas Adicionales</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Detalles adicionales del movimiento..."
                rows={3}
              />
            </div>
          </div>

          {/* Resumen */}
          {selectedTool && (
            <div className="bg-muted p-4 rounded-lg border">
              <h3 className="font-semibold text-foreground mb-3">Resumen del Movimiento</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-foreground">Herramienta:</span>
                  <span className="font-medium text-foreground">{selectedTool.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground">Tipo:</span>
                  <Badge className={getMovementTypeColor(formData.type)}>
                    {getMovementTypeText(formData.type)}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground">Cantidad:</span>
                  <span className="font-medium text-foreground">{formData.quantity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground">Stock actual:</span>
                  <span className="text-foreground">{selectedTool.stockQuantity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground">Stock después:</span>
                  <span className={cn('font-bold',
                    formData.type === 'IN' ? 'text-success' : 'text-destructive'
                  )}>
                    {formData.type === 'IN' 
                      ? selectedTool.stockQuantity + formData.quantity
                      : selectedTool.stockQuantity - formData.quantity
                    }
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>

          <Button size="sm" onClick={handleSave} disabled={isLoading || isLoadingTools}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Registrando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Registrar Movimiento
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 