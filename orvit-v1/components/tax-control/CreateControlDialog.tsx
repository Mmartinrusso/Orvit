'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Shield, FileText, DollarSign, BarChart3, AlertTriangle, CheckCircle } from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from 'sonner';

interface ControlType {
  id: string;
  name: string;
  description: string;
  icon: any;
}

const CONTROL_TYPES: ControlType[] = [
  {
    id: 'tax',
    name: 'Control de Impuestos',
    description: 'Gestión mensual de impuestos y obligaciones fiscales (IIBB, IVA, Ganancias, etc.)',
    icon: FileText
  },
  {
    id: 'quality',
    name: 'Control de Calidad',
    description: 'Sistema de control y seguimiento de calidad de productos y procesos',
    icon: CheckCircle
  },
  {
    id: 'production',
    name: 'Control de Producción',
    description: 'Monitoreo y control de procesos de producción',
    icon: BarChart3
  },
  {
    id: 'financial',
    name: 'Control Financiero',
    description: 'Control y seguimiento de aspectos financieros y contables',
    icon: DollarSign
  },
  {
    id: 'compliance',
    name: 'Control de Cumplimiento',
    description: 'Verificación de cumplimiento normativo y regulatorio',
    icon: AlertTriangle
  },
  {
    id: 'custom',
    name: 'Control Personalizado',
    description: 'Crea un control personalizado según tus necesidades',
    icon: Shield
  }
];

interface CreateControlDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (controlType: string) => void; // Callback cuando se crea exitosamente
}

export default function CreateControlDialog({ isOpen, onClose, onSuccess }: CreateControlDialogProps) {
  const { currentCompany } = useCompany();
  const [selectedControlType, setSelectedControlType] = useState<string>('');
  const [controlName, setControlName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  // Resetear formulario al abrir/cerrar
  useEffect(() => {
    if (isOpen) {
      setSelectedControlType('');
      setControlName('');
      setDescription('');
    }
  }, [isOpen]);

  const handleCreateControl = async () => {
    if (!currentCompany) {
      toast.error('No se encontró la empresa');
      return;
    }
    
    // Validaciones
    if (!selectedControlType) {
      toast.error('Por favor selecciona un tipo de control');
      return;
    }
    
    if (!controlName || controlName.trim() === '') {
      toast.error('Por favor ingresa el nombre del control');
      return;
    }
    
    setLoading(true);
    try {
      // Llamar al endpoint del backend para crear el control
      const response = await fetch('/api/controls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: controlName.trim(),
          description: description.trim() || null,
          type: selectedControlType,
          companyId: currentCompany.id.toString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear el control');
      }

      const createdControl = await response.json();
      
      toast.success(`Control "${createdControl.name}" creado exitosamente`);
      
      // Si es tipo 'tax', abrir el diálogo de crear planilla de impuesto
      if (selectedControlType === 'tax' && onSuccess) {
        onSuccess('tax');
      }
      
      onClose();
    } catch (error: any) {
      console.error('Error creating control:', error);
      toast.error(error.message || 'Error al crear el control. Por favor intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const selectedType = CONTROL_TYPES.find(t => t.id === selectedControlType);
  const SelectedIcon = selectedType?.icon || Shield;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose();
      }
    }}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Crear Nuevo Control
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Crea un nuevo sistema de control para gestionar diferentes aspectos de tu empresa
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="controlType" className="text-sm font-medium">
              Tipo de Control <span className="text-destructive">*</span>
            </Label>
            <Select 
              value={selectedControlType} 
              onValueChange={setSelectedControlType}
              disabled={loading}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar tipo de control" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {CONTROL_TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <div>
                          <div className="font-medium">{type.name}</div>
                          <div className="text-xs text-muted-foreground">{type.description}</div>
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {selectedType && (
              <div className="bg-info-muted border border-info-muted rounded-md p-3">
                <div className="flex items-start gap-2">
                  <SelectedIcon className="h-4 w-4 text-info-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-foreground">
                      {selectedType.name}
                    </p>
                    <p className="text-xs text-info-muted-foreground mt-1">
                      {selectedType.description}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {selectedControlType && (
            <>
              <div className="space-y-2">
                <Label htmlFor="controlName" className="text-sm font-medium">
                  Nombre del Control <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="controlName"
                  value={controlName}
                  onChange={(e) => setControlName(e.target.value)}
                  placeholder={`Ej: ${selectedType?.name === 'Control de Impuestos' ? 'IIBB, IVA, Ganancias' : 'Nombre del control'}`}
                  className="w-full"
                  required
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Ingresa un nombre descriptivo para este control
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium">
                  Descripción
                </Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descripción adicional del control (opcional)"
                  className="w-full min-h-[80px]"
                  rows={3}
                  disabled={loading}
                />
              </div>
            </>
          )}
        </div>
        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={onClose}
            type="button"
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleCreateControl}
            className="gap-2"
            disabled={!selectedControlType || !controlName || controlName.trim() === '' || loading}
          >
            {loading ? (
              <>
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Crear Control
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

