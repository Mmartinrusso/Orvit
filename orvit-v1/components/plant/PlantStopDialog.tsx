'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Cog,
  CheckCircle2,
  Clock,
  Loader2
} from 'lucide-react';
import { useMachinesInitial } from '@/hooks/use-machines-initial';

interface PlantStopDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PlantStopDialog({ isOpen, onClose }: PlantStopDialogProps) {
  const { currentSector, currentCompany, refreshSectors } = useCompany();
  const { user } = useAuth();
  
  // ✨ OPTIMIZADO: Usar hook con React Query para máquinas
  const companyIdNum = currentCompany?.id ? parseInt(String(currentCompany.id)) : null;
  const sectorIdNum = currentSector?.id ? parseInt(String(currentSector.id)) : null;
  const { data: machinesData } = useMachinesInitial(
    companyIdNum,
    sectorIdNum,
    { enabled: isOpen && !!companyIdNum && !!sectorIdNum }
  );
  const machines = machinesData?.machines || [];
  
  const [components, setComponents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    reason: '',
    machineId: '',
    componentId: '',
    subcomponentId: '',
    priority: 'alta' as 'baja' | 'media' | 'alta' | 'critica'
  });

  // ✨ OPTIMIZADO: Máquinas vienen del hook useMachinesInitial

  const fetchComponents = async (machineId: number) => {
    try {
      const response = await fetch(`/api/machines/${machineId}/components`);
      if (response.ok) {
        const data = await response.json();
        setComponents(data);
      }
    } catch (error) {
      console.error('Error fetching components:', error);
    }
  };

  const handleMachineSelect = (machineId: string) => {
    setFormData(prev => ({ ...prev, machineId, componentId: '', subcomponentId: '' }));
    if (machineId) {
      fetchComponents(Number(machineId));
    }
  };

  const handleSubmit = async () => {
    if (!formData.reason.trim()) {
      toast.error('Por favor completa la razón de la parada');
      return;
    }

    setIsLoading(true);
    try {
      const machine = machines.find(m => m.id.toString() === formData.machineId);
      const component = components.find(c => c.id.toString() === formData.componentId);
      const subcomponent = component?.subcomponents?.find((s: any) => s.id.toString() === formData.subcomponentId);

      const stopData = {
        sectorId: currentSector?.id,
        companyId: currentCompany?.id,
        supervisorId: user?.id,
        supervisorName: user?.name,
        reason: formData.reason,
        machineId: formData.machineId ? Number(formData.machineId) : null,
        machineName: machine?.name,
        componentId: formData.componentId ? Number(formData.componentId) : null,
        componentName: component?.name,
        subcomponentId: formData.subcomponentId ? Number(formData.subcomponentId) : null,
        subcomponentName: subcomponent?.name,
        priority: formData.priority,
        timestamp: new Date().toISOString(),
      };

      const response = await fetch('/api/plant/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(stopData),
      });

      if (response.ok) {
        toast.success('Parada de planta registrada. Notificando a todos los usuarios...');
        
        // Refrescar sectores para actualizar el estado
        await refreshSectors();
        
        onClose();
        
        // Reset form
        setFormData({
          reason: '',
          machineId: '',
          componentId: '',
          subcomponentId: '',
          priority: 'alta'
        });

        refreshSectors();
      } else {
        const errorData = await response.json();
        console.error('❌ Error del servidor:', errorData);
        throw new Error(errorData.error || 'Error al registrar la parada');
      }
    } catch (error) {
      console.error('❌ Error en parada de planta:', error);
      toast.error('Error al registrar la parada de planta: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const canSubmit = formData.reason.trim();

  const priorities = [
    { id: 'baja', name: 'Baja', color: 'bg-muted text-foreground' },
    { id: 'media', name: 'Media', color: 'bg-warning-muted text-warning-muted-foreground' },
    { id: 'alta', name: 'Alta', color: 'bg-warning-muted text-warning-muted-foreground' },
    { id: 'critica', name: 'Crítica', color: 'bg-destructive/10 text-destructive' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            Parar Planta - {currentSector?.name}
          </DialogTitle>
          <p className="text-muted-foreground">
            Esta acción detendrá las operaciones del sector y notificará a todos los usuarios
          </p>
        </DialogHeader>

        <DialogBody>
        <div className="space-y-6">
          {/* Información básica */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Razón de la Parada *
            </label>
            <Input
              value={formData.reason}
              onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="Ej: Falla eléctrica, Mantenimiento urgente, Problema de seguridad..."
              className="h-12"
            />
          </div>

          {/* Prioridad */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Prioridad de la Parada
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {priorities.map((priority) => (
                <Card 
                  key={priority.id}
                  className={cn('cursor-pointer transition-all duration-200 hover:shadow-lg', formData.priority === priority.id ? 'ring-2 ring-primary shadow-lg' : 'hover:shadow-md')}
                  onClick={() => setFormData(prev => ({ ...prev, priority: priority.id as any }))}
                >
                  <CardContent className="p-3 text-center">
                    <span className={cn('inline-block px-3 py-1 rounded-full text-sm font-medium', priority.color)}>
                      {priority.name}
                    </span>
                    {formData.priority === priority.id && (
                      <CheckCircle2 className="h-4 w-4 text-primary mx-auto mt-2" />
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Selección de máquina */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Máquina Afectada (Opcional)
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-60 overflow-y-auto">
              {machines.map((machine) => (
                <Card 
                  key={machine.id}
                  className={cn('cursor-pointer transition-all duration-200 hover:shadow-lg', formData.machineId === machine.id.toString() ? 'ring-2 ring-primary shadow-lg' : 'hover:shadow-md')}
                  onClick={() => handleMachineSelect(machine.id.toString())}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <Cog className="h-6 w-6 text-primary" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold truncate">{machine.name}</h4>
                        <p className="text-sm text-muted-foreground truncate">{machine.nickname || 'Sin apodo'}</p>
                      </div>
                      {formData.machineId === machine.id.toString() && (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Componentes */}
          {formData.machineId && components.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Componente Afectado (Opcional)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-48 overflow-y-auto">
                {components.map((component) => (
                  <Card 
                    key={component.id}
                    className={cn('cursor-pointer transition-all duration-200 hover:shadow-lg', formData.componentId === component.id.toString() ? 'ring-2 ring-primary shadow-lg' : 'hover:shadow-md')}
                    onClick={() => setFormData(prev => ({ 
                      ...prev, 
                      componentId: component.id.toString(),
                      subcomponentId: '' 
                    }))}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold">{component.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {component.subcomponents?.length || 0} subcomponentes
                          </p>
                        </div>
                        {formData.componentId === component.id.toString() && (
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Subcomponentes */}
          {formData.componentId && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Subcomponente Específico (Opcional)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-40 overflow-y-auto">
                {components
                  .find(c => c.id.toString() === formData.componentId)
                  ?.subcomponents?.map((subcomponent: any) => (
                    <Card 
                      key={subcomponent.id}
                      className={cn('cursor-pointer transition-all duration-200 hover:shadow-lg', formData.subcomponentId === subcomponent.id.toString() ? 'ring-2 ring-primary shadow-lg' : 'hover:shadow-md')}
                      onClick={() => setFormData(prev => ({ 
                        ...prev, 
                        subcomponentId: subcomponent.id.toString() 
                      }))}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{subcomponent.name}</span>
                          {formData.subcomponentId === subcomponent.id.toString() && (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          )}
        </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>

          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!canSubmit || isLoading}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Parando Planta...
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 mr-2" />
                Parar Planta
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 