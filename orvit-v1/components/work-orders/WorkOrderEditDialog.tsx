'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { WorkOrder, WorkOrderStatus, Priority, MaintenanceType, Machine } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useMachinesInitial } from '@/hooks/use-machines-initial';
import { WorkOrderDialogHeaderSticky } from './WorkOrderDialogHeaderSticky';
import { WorkOrderDialogFooterSticky } from './WorkOrderDialogFooterSticky';
import { WorkOrderFormSections } from './WorkOrderFormSections';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface WorkOrderEditDialogProps {
  workOrder?: WorkOrder;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  onSave?: (workOrder: Partial<WorkOrder>) => Promise<void>;
  onUpdate?: (workOrder: WorkOrder) => void;
}

export default function WorkOrderEditDialog({
  workOrder,
  isOpen,
  onOpenChange,
  onClose,
  onSave,
  onUpdate,
}: WorkOrderEditDialogProps) {
  const { currentCompany, currentSector } = useCompany();
  const { user } = useAuth();

  const [formData, setFormData] = useState<Partial<WorkOrder>>({
    title: '',
    description: '',
    priority: Priority.MEDIUM,
    type: MaintenanceType.CORRECTIVE,
    scheduledDate: undefined,
    estimatedHours: undefined,
    cost: undefined,
    notes: '',
  });

  const [initialData, setInitialData] = useState<Partial<WorkOrder>>({});
  const [users, setUsers] = useState<Array<{ id: number; name: string }>>([]);
  const [components, setComponents] = useState<Array<{ id: number; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  const companyIdNum = currentCompany?.id ? parseInt(String(currentCompany.id)) : null;
  const sectorIdNum = currentSector?.id ? parseInt(String(currentSector.id)) : null;
  const { data: machinesData } = useMachinesInitial(
    companyIdNum,
    sectorIdNum,
    { enabled: isOpen && !!companyIdNum }
  );
  const machines = (machinesData?.machines || []) as Machine[];

  // Inicializar datos
  useEffect(() => {
    if (workOrder && isOpen) {
      const data = {
        ...workOrder,
        scheduledDate: workOrder.scheduledDate ? new Date(workOrder.scheduledDate) : undefined,
        startedDate: workOrder.startedDate ? new Date(workOrder.startedDate) : undefined,
        completedDate: workOrder.completedDate ? new Date(workOrder.completedDate) : undefined,
      };
      setFormData(data);
      setInitialData(data);
      setHasChanges(false);
      setLastSaved(null);
    } else if (!workOrder && isOpen) {
      // Nueva orden
      const newData = {
        title: '',
        description: '',
        priority: Priority.MEDIUM,
        type: MaintenanceType.CORRECTIVE,
        scheduledDate: undefined,
        estimatedHours: undefined,
        cost: undefined,
        notes: '',
        companyId: currentCompany?.id ? Number(currentCompany.id) : undefined,
        sectorId: currentSector?.id ? Number(currentSector.id) : undefined,
        createdById: user?.id ? Number(user.id) : undefined,
      };
      setFormData(newData);
      setInitialData(newData);
      setHasChanges(false);
    }
  }, [workOrder, isOpen, currentCompany, currentSector, user]);

  // Cargar usuarios
  useEffect(() => {
    if (isOpen && currentCompany) {
      fetchUsers();
    }
  }, [isOpen, currentCompany]);

  // Cargar componentes cuando cambia la máquina
  useEffect(() => {
    if (formData.machineId && isOpen) {
      fetchComponents(formData.machineId);
    } else {
      setComponents([]);
    }
  }, [formData.machineId, isOpen]);

  const fetchComponents = async (machineId: number) => {
    try {
      const response = await fetch(`/api/machines/${machineId}/components`);
      if (response.ok) {
        const data = await response.json();
        const componentsArray = data.components || data || [];
        if (Array.isArray(componentsArray)) {
          setComponents(componentsArray.map((c: any) => ({ id: c.id, name: c.name })));
        }
      }
    } catch (error) {
      console.error('Error fetching components:', error);
      setComponents([]);
    }
  };

  // Detectar cambios
  useEffect(() => {
    if (isOpen) {
      const changed = JSON.stringify(formData) !== JSON.stringify(initialData);
      setHasChanges(changed);
    }
  }, [formData, initialData, isOpen]);

  const fetchUsers = async () => {
    try {
      const response = await fetch(`/api/companies/${currentCompany?.id}/users`);
      if (response.ok) {
        const data = await response.json();
        const usersArray = data.users || data || [];
        if (Array.isArray(usersArray)) {
          setUsers(usersArray.map((u: any) => ({ id: u.id, name: u.name })));
        }
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleFieldChange = (field: keyof WorkOrder, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      alert('Errores de validación:\n' + validationErrors.join('\n'));
      return;
    }

    setLoading(true);
    try {
      if (workOrder) {
        // Actualizar orden existente
        const response = await fetch(`/api/work-orders/${workOrder.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: formData.title,
            description: formData.description,
            status: formData.status,
            priority: formData.priority,
            type: formData.type,
            machineId: formData.machineId || null,
            componentId: formData.componentId || null,
            assignedToId: formData.assignedToId || null,
            scheduledDate: formData.scheduledDate ? formData.scheduledDate.toISOString() : null,
            startedDate: formData.startedDate ? formData.startedDate.toISOString() : null,
            completedDate: formData.completedDate ? formData.completedDate.toISOString() : null,
            estimatedHours: formData.estimatedHours || null,
            actualHours: formData.actualHours || null,
            cost: formData.cost || null,
            notes: formData.notes || null,
            sectorId: formData.sectorId || null,
          }),
        });

        if (response.ok) {
          const updatedOrder = await response.json();
          if (onUpdate) {
            onUpdate(updatedOrder);
          }
          setLastSaved(new Date());
          setInitialData(formData);
          setHasChanges(false);
        } else {
          const error = await response.json();
          throw new Error(error.error || 'Error al guardar');
        }
      } else if (onSave) {
        // Crear nueva orden
        await onSave(formData);
        setLastSaved(new Date());
        setInitialData(formData);
        setHasChanges(false);
      }
    } catch (error: any) {
      console.error('Error saving work order:', error);
      alert(error.message || 'Error al guardar la orden de trabajo');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const errors: string[] = [];
    if (!formData.title?.trim()) errors.push('El título es requerido');
    if (!formData.type) errors.push('El tipo de mantenimiento es requerido');
    if (!formData.priority) errors.push('La prioridad es requerida');
    return errors;
  };

  const handleClose = () => {
    if (hasChanges) {
      setShowConfirmClose(true);
    } else {
      handleConfirmClose();
    }
  };

  const handleConfirmClose = () => {
    setShowConfirmClose(false);
    if (onOpenChange) {
      onOpenChange(false);
    } else if (onClose) {
      onClose();
    }
  };

  const dialogOpen = isOpen !== undefined ? isOpen : false;

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={handleClose}>
        <DialogContent
          className="w-[min(980px,calc(100vw-2rem))] max-h-[min(80vh,820px)] p-0 overflow-hidden rounded-2xl border-border bg-card shadow-lg"
        >
          <div className="flex flex-col h-full max-h-[min(80vh,820px)]">
            <WorkOrderDialogHeaderSticky
              workOrder={workOrder}
              onClose={handleClose}
            />

            <div className="flex-1 min-h-0 overflow-hidden">
              <div className="h-full p-6 overflow-y-auto">
                <WorkOrderFormSections
                  formData={formData}
                  onFieldChange={handleFieldChange}
                  machines={machines}
                  users={users}
                  components={components}
                />
              </div>
            </div>

            <WorkOrderDialogFooterSticky
              onCancel={handleClose}
              onSave={handleSave}
              loading={loading}
              hasChanges={hasChanges}
              lastSaved={lastSaved}
            />
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirmClose} onOpenChange={setShowConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar cambios?</AlertDialogTitle>
            <AlertDialogDescription>
              Tienes cambios sin guardar. ¿Estás seguro de que quieres cerrar sin guardar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClose}>Descartar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

