'use client';

import { useState, useEffect } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Building2, Loader2, FileText, Plus, MoreVertical, Edit, Trash2, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import InstructiveDialog from '@/components/mantenimiento/InstructiveDialog';
import WorkStationDetailModal from '@/components/mantenimiento/WorkStationDetailModal';

interface WorkStation {
  id: number;
  name: string;
  description?: string;
  code: string;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  sectorId: number;
  companyId: number;
  createdAt: string;
  updatedAt: string;
  sector: {
    id: number;
    name: string;
  };
  instructives: Instructive[];
}

interface Instructive {
  id: number;
  title: string;
  description?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  isActive: boolean;
  createdAt: string;
  createdBy: {
    id: number;
    name: string;
  };
}

interface WorkStationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workStation?: WorkStation | null;
  onSuccess: () => void;
  onWorkStationCreated?: (workStationId: number) => void;
}

export default function WorkStationDialog({
  open,
  onOpenChange,
  workStation,
  onSuccess,
  onWorkStationCreated
}: WorkStationDialogProps) {
  const { currentCompany, currentSector } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [createdWorkStationId, setCreatedWorkStationId] = useState<number | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sectorId: ''
  });

  // Cargar datos del puesto de trabajo si se está editando
  useEffect(() => {
    if (workStation) {
      setFormData({
        name: workStation.name,
        description: workStation.description || '',
        sectorId: workStation.sectorId.toString()
      });
    } else {
      // Para nuevos puestos de trabajo, usar el sector actual
      setFormData({
        name: '',
        description: '',
        sectorId: currentSector?.id?.toString() || ''
      });
    }
  }, [workStation, currentSector]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentCompany) {
      toast({
        title: 'Error',
        description: 'No hay empresa seleccionada',
        variant: 'destructive'
      });
      return;
    }

    if (!currentSector) {
      toast({
        title: 'Error',
        description: 'No hay sector seleccionado',
        variant: 'destructive'
      });
      return;
    }

    if (!formData.name) {
      toast({
        title: 'Error',
        description: 'Por favor completa el nombre del puesto de trabajo',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      const url = workStation 
        ? `/api/work-stations/${workStation.id}`
        : '/api/work-stations';
      
      const method = workStation ? 'PUT' : 'POST';
      
      const requestBody = {
        ...formData,
        sectorId: currentSector.id,
        companyId: currentCompany?.id
      };
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const savedWorkStation = await response.json();
        
        toast({
          title: 'Éxito',
          description: workStation 
            ? 'Puesto de trabajo actualizado correctamente'
            : 'Puesto de trabajo creado correctamente'
        });
        
        if (workStation) {
          // Si es edición, cerrar el modal y actualizar lista
          onSuccess();
        } else {
          // Si es creación, notificar al componente padre y cerrar este modal
          if (onWorkStationCreated) {
            onWorkStationCreated(savedWorkStation.id);
          }
          onOpenChange(false);
        }
      } else {
        const errorData = await response.json();
        toast({
          title: 'Error',
          description: errorData.error || 'Error al guardar el puesto de trabajo',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error guardando puesto de trabajo:', error);
      toast({
        title: 'Error',
        description: 'Error al guardar el puesto de trabajo',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleClose = () => {
    onOpenChange(false);
    onSuccess();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {workStation ? 'Editar Puesto de Trabajo' : 'Nuevo Puesto de Trabajo'}
            </DialogTitle>
            <DialogDescription>
              {workStation 
                ? 'Modifica la información del puesto de trabajo'
                : 'Crea un nuevo puesto de trabajo para el sector seleccionado'
              }
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <DialogBody>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Ej: Puesto de soldadura"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Descripción del puesto de trabajo..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sector">Sector</Label>
                <Input
                  id="sector"
                  value={currentSector?.name || 'No hay sector seleccionado'}
                  disabled
                  className="bg-gray-50"
                />
              </div>
            </div>
            </DialogBody>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
                size="default"
              >
                {workStation ? 'Cancelar' : 'Cerrar'}
              </Button>
              <Button type="submit" disabled={loading} size="default">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {workStation ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
} 