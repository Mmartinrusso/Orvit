'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, FileText } from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from 'sonner';

interface CreateTaxBaseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void; // Callback cuando se crea exitosamente
}

export default function CreateTaxBaseDialog({ isOpen, onClose, onSuccess }: CreateTaxBaseDialogProps) {
  const { currentCompany } = useCompany();
  const [baseFormData, setBaseFormData] = useState({
    name: '',
    description: '',
    recurringDay: 5,
    notes: ''
  });
  const [loading, setLoading] = useState(false);

  // Resetear formulario al abrir/cerrar
  useEffect(() => {
    if (isOpen) {
      setBaseFormData({
        name: '',
        description: '',
        recurringDay: 5,
        notes: ''
      });
    }
  }, [isOpen]);

  const handleCreateBase = async () => {
    if (!currentCompany) {
      toast.error('No se encontró la empresa');
      return;
    }
    
    // Validaciones
    if (!baseFormData.name || baseFormData.name.trim() === '') {
      toast.error('Por favor ingresa el nombre del impuesto');
      return;
    }
    
    if (!baseFormData.recurringDay || baseFormData.recurringDay < 1 || baseFormData.recurringDay > 31) {
      toast.error('Por favor selecciona un día válido del mes (1-31)');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch('/api/tax-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...baseFormData,
          name: baseFormData.name.trim(),
          companyId: currentCompany.id,
          isRecurring: true
        }),
      });
      
      if (response.ok) {
        const newBase = await response.json();
        toast.success(`Planilla "${newBase.name}" creada exitosamente`);
        onClose();
        if (onSuccess) {
          onSuccess();
        }
      } else {
        const errorData = await response.json();
        toast.error(`Error al crear la planilla: ${errorData.error || 'Error desconocido'}`);
      }
    } catch (error) {
      console.error('Error creating tax base:', error);
      toast.error('Error al crear la planilla. Por favor intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose();
      }
    }}>
      <DialogContent size="md" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Crear Nueva Planilla de Impuesto
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Crea una planilla de impuesto que se reutilizará mensualmente. Esta planilla servirá como plantilla para registrar los impuestos de cada mes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="baseName" className="text-sm font-medium">
              Nombre del Impuesto <span className="text-red-500">*</span>
            </Label>
            <Input
              id="baseName"
              value={baseFormData.name}
              onChange={(e) => setBaseFormData({ ...baseFormData, name: e.target.value })}
              placeholder="Ej: IIBB, IVA, Ganancias, Monotributo"
              className="w-full"
              required
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Ingresa el nombre del impuesto que se registrará mensualmente
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="baseDescription" className="text-sm font-medium">
              Descripción
            </Label>
            <Textarea
              id="baseDescription"
              value={baseFormData.description}
              onChange={(e) => setBaseFormData({ ...baseFormData, description: e.target.value })}
              placeholder="Descripción opcional del impuesto (ej: Ingresos Brutos Córdoba)"
              className="w-full min-h-[80px]"
              rows={3}
              disabled={loading}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="baseRecurringDay" className="text-sm font-medium">
              Día del mes para la alerta <span className="text-red-500">*</span>
            </Label>
            <Select 
              value={baseFormData.recurringDay.toString()} 
              onValueChange={(value) => setBaseFormData({ ...baseFormData, recurringDay: parseInt(value) })}
              disabled={loading}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar día del mes" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <SelectItem key={day} value={day.toString()}>
                    Día {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                <strong>ℹ️ Información:</strong> El sistema generará automáticamente un recordatorio el día <strong>{baseFormData.recurringDay}</strong> de cada mes para este impuesto.
              </p>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="baseNotes" className="text-sm font-medium">
              Notas Adicionales
            </Label>
            <Textarea
              id="baseNotes"
              value={baseFormData.notes}
              onChange={(e) => setBaseFormData({ ...baseFormData, notes: e.target.value })}
              placeholder="Información adicional sobre este impuesto (opcional)"
              className="w-full min-h-[80px]"
              rows={3}
              disabled={loading}
            />
          </div>
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
            onClick={handleCreateBase}
            className="gap-2"
            disabled={!baseFormData.name || baseFormData.name.trim() === '' || loading}
          >
            {loading ? (
              <>
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Crear Planilla
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

