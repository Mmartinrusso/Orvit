'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { usePermissionRobust } from '@/hooks/use-permissions-robust';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { PermitToWork, PTWStatus, Machine } from '@/lib/types';
import {
  PTWList,
  PTWForm,
  PTWApprovalDialog,
  PTWDetailDialog,
} from '@/components/ptw';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FileText, Shield } from 'lucide-react';

export default function PTWPage() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();

  const { hasPermission: canCreate } = usePermissionRobust('ptw.create');
  const { hasPermission: canApprove } = usePermissionRobust('ptw.approve');
  const { hasPermission: canActivate } = usePermissionRobust('ptw.activate');
  const { hasPermission: canSuspend } = usePermissionRobust('ptw.suspend');
  const { hasPermission: canClose } = usePermissionRobust('ptw.close');
  const { hasPermission: canDelete } = usePermissionRobust('ptw.delete');

  const [permits, setPermits] = useState<PermitToWork[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [workOrders, setWorkOrders] = useState<{ id: number; title: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isApprovalOpen, setIsApprovalOpen] = useState(false);
  const [selectedPermit, setSelectedPermit] = useState<PermitToWork | null>(null);

  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<string>('');
  const [actionReason, setActionReason] = useState('');

  const companyId = currentCompany?.id ? parseInt(String(currentCompany.id)) : null;

  const fetchPermits = useCallback(async () => {
    if (!companyId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/ptw?companyId=${companyId}`);
      if (!response.ok) throw new Error('Error al cargar permisos');
      const data = await response.json();
      setPermits(data);
    } catch (error) {
      console.error('Error fetching permits:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los permisos de trabajo',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [companyId, toast]);

  const fetchMachines = useCallback(async () => {
    if (!companyId) return;
    try {
      const response = await fetch(`/api/machines?companyId=${companyId}`);
      if (!response.ok) return;
      const data = await response.json();
      setMachines(data.machines || data || []);
    } catch (error) {
      console.error('Error fetching machines:', error);
    }
  }, [companyId]);

  const fetchWorkOrders = useCallback(async () => {
    if (!companyId) return;
    try {
      const response = await fetch(`/api/work-orders?companyId=${companyId}&status=pending,in_progress`);
      if (!response.ok) return;
      const data = await response.json();
      setWorkOrders(
        (data.workOrders || data || []).map((wo: any) => ({
          id: wo.id,
          title: wo.title,
        }))
      );
    } catch (error) {
      console.error('Error fetching work orders:', error);
    }
  }, [companyId]);

  useEffect(() => {
    fetchPermits();
    fetchMachines();
    fetchWorkOrders();
  }, [fetchPermits, fetchMachines, fetchWorkOrders]);

  const handleCreate = async (data: Partial<PermitToWork>) => {
    try {
      const response = await fetch('/api/ptw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, companyId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al crear PTW');
      }
      toast({ title: 'PTW creado', description: 'El permiso de trabajo fue creado exitosamente' });
      fetchPermits();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  const handleUpdate = async (data: Partial<PermitToWork>) => {
    if (!selectedPermit) return;
    try {
      const response = await fetch(`/api/ptw/${selectedPermit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al actualizar PTW');
      }
      toast({ title: 'PTW actualizado', description: 'El permiso de trabajo fue actualizado' });
      fetchPermits();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  const handleAction = async (action: string, permit: PermitToWork, extraData?: any) => {
    try {
      const response = await fetch(`/api/ptw/${permit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extraData }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Error al ejecutar accion ${action}`);
      }
      const actionLabels: Record<string, string> = {
        submit: 'enviado a aprobacion',
        approve: 'aprobado',
        reject: 'rechazado',
        activate: 'activado',
        suspend: 'suspendido',
        resume: 'reanudado',
        close: 'cerrado',
      };
      toast({
        title: 'PTW actualizado',
        description: `El permiso fue ${actionLabels[action] || 'actualizado'}`,
      });
      fetchPermits();
      setIsDetailOpen(false);
      setIsApprovalOpen(false);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  const handleDelete = async (permit: PermitToWork) => {
    try {
      const response = await fetch(`/api/ptw/${permit.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al eliminar PTW');
      }
      toast({ title: 'PTW eliminado', description: 'El permiso de trabajo fue eliminado' });
      fetchPermits();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const openActionDialog = (type: string, permit: PermitToWork) => {
    setActionType(type);
    setSelectedPermit(permit);
    setActionReason('');
    setActionDialogOpen(true);
  };

  const confirmAction = async () => {
    if (!selectedPermit) return;
    await handleAction(actionType, selectedPermit, {
      suspensionReason: actionType === 'suspend' ? actionReason : undefined,
      closeNotes: actionType === 'close' ? actionReason : undefined,
    });
    setActionDialogOpen(false);
  };

  const handleDetailAction = (action: string, permit: PermitToWork) => {
    switch (action) {
      case 'edit':
        setSelectedPermit(permit);
        setIsDetailOpen(false);
        setIsFormOpen(true);
        break;
      case 'submit':
        handleAction('submit', permit);
        break;
      case 'approve':
      case 'reject':
        setSelectedPermit(permit);
        setIsDetailOpen(false);
        setIsApprovalOpen(true);
        break;
      case 'activate':
        handleAction('activate', permit);
        break;
      case 'suspend':
      case 'close':
        openActionDialog(action, permit);
        setIsDetailOpen(false);
        break;
      case 'resume':
        handleAction('resume', permit);
        break;
    }
  };

  return (
    <PermissionGuard permission="ptw.view" fallback={<div className="p-4">No tienes permisos para ver esta pagina</div>}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Permisos de Trabajo (PTW)</h1>
              <p className="text-muted-foreground">Gestion de permisos para trabajos peligrosos</p>
            </div>
          </div>
        </div>

        {/* List */}
        <PTWList
          permits={permits}
          isLoading={isLoading}
          onView={(permit) => {
            setSelectedPermit(permit);
            setIsDetailOpen(true);
          }}
          onEdit={(permit) => {
            setSelectedPermit(permit);
            setIsFormOpen(true);
          }}
          onApprove={canApprove ? (permit) => {
            setSelectedPermit(permit);
            setIsApprovalOpen(true);
          } : undefined}
          onReject={canApprove ? (permit) => {
            setSelectedPermit(permit);
            setIsApprovalOpen(true);
          } : undefined}
          onActivate={canActivate ? (permit) => handleAction('activate', permit) : undefined}
          onSuspend={canSuspend ? (permit) => openActionDialog('suspend', permit) : undefined}
          onResume={canSuspend ? (permit) => handleAction('resume', permit) : undefined}
          onClose={canClose ? (permit) => openActionDialog('close', permit) : undefined}
          onDelete={canDelete ? handleDelete : undefined}
          onCreate={canCreate ? () => {
            setSelectedPermit(null);
            setIsFormOpen(true);
          } : undefined}
          onRefresh={fetchPermits}
        />

        {/* Form Dialog */}
        <PTWForm
          permit={selectedPermit || undefined}
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSave={selectedPermit ? handleUpdate : handleCreate}
          machines={machines}
          workOrders={workOrders}
        />

        {/* Detail Dialog */}
        <PTWDetailDialog
          permit={selectedPermit}
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          onAction={handleDetailAction}
        />

        {/* Approval Dialog */}
        <PTWApprovalDialog
          permit={selectedPermit}
          isOpen={isApprovalOpen}
          onClose={() => setIsApprovalOpen(false)}
          onApprove={(permit, notes) => handleAction('approve', permit, { approvalNotes: notes })}
          onReject={(permit, reason) => handleAction('reject', permit, { rejectionReason: reason })}
        />

        {/* Action Confirmation Dialog */}
        <AlertDialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {actionType === 'suspend' ? 'Suspender Permiso' : 'Cerrar Permiso'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {actionType === 'suspend'
                  ? 'Indique el motivo de la suspension del permiso de trabajo.'
                  : 'Agregue notas de cierre para el permiso de trabajo.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Label htmlFor="actionReason">
                {actionType === 'suspend' ? 'Motivo de Suspension *' : 'Notas de Cierre (opcional)'}
              </Label>
              <Textarea
                id="actionReason"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder={actionType === 'suspend' ? 'Explique el motivo...' : 'Observaciones finales...'}
                rows={3}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmAction}
                disabled={actionType === 'suspend' && !actionReason.trim()}
              >
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PermissionGuard>
  );
}
