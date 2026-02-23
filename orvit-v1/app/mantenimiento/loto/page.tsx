'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { usePermissionRobust } from '@/hooks/use-permissions-robust';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { LOTOProcedure, LOTOExecution, LOTOStatus, Machine } from '@/lib/types';
import {
  LOTOProcedureList,
  LOTOProcedureForm,
  LOTOExecutionDialog,
} from '@/components/loto';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Lock, Unlock, FileText, Zap, RefreshCw, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import LOTOStatusBadge from '@/components/loto/LOTOStatusBadge';

export default function LOTOPage() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();

  const { hasPermission: canCreateProcedure } = usePermissionRobust('loto.procedures.create');
  const { hasPermission: canApproveProcedure } = usePermissionRobust('loto.procedures.approve');
  const { hasPermission: canExecute } = usePermissionRobust('loto.execute');
  const { hasPermission: canVerify } = usePermissionRobust('loto.verify_zero_energy');
  const { hasPermission: canRelease } = usePermissionRobust('loto.release');

  const [procedures, setProcedures] = useState<LOTOProcedure[]>([]);
  const [executions, setExecutions] = useState<LOTOExecution[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [isLoadingProcedures, setIsLoadingProcedures] = useState(true);
  const [isLoadingExecutions, setIsLoadingExecutions] = useState(true);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isExecutionDialogOpen, setIsExecutionDialogOpen] = useState(false);
  const [selectedProcedure, setSelectedProcedure] = useState<LOTOProcedure | null>(null);
  const [selectedExecution, setSelectedExecution] = useState<LOTOExecution | null>(null);

  const companyId = currentCompany?.id ? parseInt(String(currentCompany.id)) : null;

  const fetchProcedures = useCallback(async () => {
    if (!companyId) return;
    setIsLoadingProcedures(true);
    try {
      const response = await fetch(`/api/loto/procedures?companyId=${companyId}`);
      if (!response.ok) throw new Error('Error al cargar procedimientos');
      const data = await response.json();
      setProcedures(data);
    } catch (error) {
      console.error('Error fetching procedures:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los procedimientos LOTO',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingProcedures(false);
    }
  }, [companyId, toast]);

  const fetchExecutions = useCallback(async () => {
    if (!companyId) return;
    setIsLoadingExecutions(true);
    try {
      const response = await fetch(`/api/loto/executions?companyId=${companyId}`);
      if (!response.ok) throw new Error('Error al cargar ejecuciones');
      const data = await response.json();
      setExecutions(data);
    } catch (error) {
      console.error('Error fetching executions:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las ejecuciones LOTO',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingExecutions(false);
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

  useEffect(() => {
    fetchProcedures();
    fetchExecutions();
    fetchMachines();
  }, [fetchProcedures, fetchExecutions, fetchMachines]);

  const createProcedureMutation = useApiMutation<unknown, { data: Partial<LOTOProcedure>; companyId: number | null }>({
    mutationFn: async ({ data, companyId: cId }) => {
      const response = await fetch('/api/loto/procedures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, companyId: cId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al crear procedimiento');
      }
      return response.json();
    },
    successMessage: null,
    errorMessage: 'Error al crear procedimiento',
    onSuccess: () => {
      toast({ title: 'Procedimiento creado', description: 'El procedimiento LOTO fue creado exitosamente' });
      fetchProcedures();
    },
  });

  const handleCreateProcedure = async (data: Partial<LOTOProcedure>) => {
    await createProcedureMutation.mutateAsync({ data, companyId });
  };

  const handleUpdateProcedure = async (data: Partial<LOTOProcedure>) => {
    if (!selectedProcedure) return;
    try {
      const response = await fetch(`/api/loto/procedures/${selectedProcedure.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al actualizar procedimiento');
      }
      toast({ title: 'Procedimiento actualizado', description: 'El procedimiento LOTO fue actualizado' });
      fetchProcedures();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  const handleProcedureAction = async (action: string, procedure: LOTOProcedure) => {
    try {
      const response = await fetch(`/api/loto/procedures/${procedure.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Error al ejecutar accion ${action}`);
      }
      const actionLabels: Record<string, string> = {
        approve: 'aprobado',
        activate: 'activado',
        deactivate: 'desactivado',
      };
      toast({
        title: 'Procedimiento actualizado',
        description: `El procedimiento fue ${actionLabels[action] || 'actualizado'}`,
      });
      fetchProcedures();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteProcedure = async (procedure: LOTOProcedure) => {
    try {
      const response = await fetch(`/api/loto/procedures/${procedure.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al eliminar procedimiento');
      }
      toast({ title: 'Procedimiento eliminado', description: 'El procedimiento LOTO fue eliminado' });
      fetchProcedures();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleLock = async (procedureId: number, data: any) => {
    try {
      const response = await fetch('/api/loto/executions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, companyId, procedureId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al ejecutar bloqueo');
      }
      toast({
        title: 'LOTO Bloqueado',
        description: 'El equipo ha sido bloqueado exitosamente',
      });
      fetchExecutions();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  const handleVerifyZeroEnergy = async (executionId: number, notes?: string) => {
    try {
      const response = await fetch(`/api/loto/executions/${executionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_zero_energy', verificationNotes: notes }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al verificar energia cero');
      }
      toast({
        title: 'Energia Cero Verificada',
        description: 'La verificacion de energia cero fue completada',
      });
      fetchExecutions();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  const handleUnlock = async (executionId: number, data: any) => {
    try {
      const response = await fetch(`/api/loto/executions/${executionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unlock', ...data }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al desbloquear');
      }
      toast({
        title: 'LOTO Desbloqueado',
        description: 'El equipo ha sido desbloqueado exitosamente',
      });
      fetchExecutions();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  const activeExecutions = executions.filter(e => e.status !== LOTOStatus.UNLOCKED);

  return (
    <PermissionGuard permission="loto.view" fallback={<div className="p-4">No tienes permisos para ver esta pagina</div>}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-destructive/10 rounded-lg">
              <Lock className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">LOTO (Bloqueo/Etiquetado)</h1>
              <p className="text-muted-foreground">Procedimientos de bloqueo y control de energia</p>
            </div>
          </div>
        </div>

        {/* Active LOTO Alert */}
        {activeExecutions.length > 0 && (
          <Card className="border-destructive/30 bg-destructive/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-destructive flex items-center gap-2">
                <Lock className="h-5 w-5" />
                LOTO Activos ({activeExecutions.length})
              </CardTitle>
              <CardDescription className="text-destructive">
                Los siguientes equipos estan actualmente bloqueados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {activeExecutions.slice(0, 5).map((exec) => (
                  <div
                    key={exec.id}
                    className="flex items-center justify-between p-2 bg-background rounded-lg border cursor-pointer hover:bg-muted"
                    onClick={() => {
                      const proc = procedures.find(p => p.id === exec.procedureId);
                      if (proc) {
                        setSelectedProcedure(proc);
                        setSelectedExecution(exec);
                        setIsExecutionDialogOpen(true);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <LOTOStatusBadge status={exec.status} size="sm" />
                      <div>
                        <span className="font-medium">{exec.procedure?.name}</span>
                        <span className="text-muted-foreground mx-2">-</span>
                        <span className="text-sm text-muted-foreground">{exec.procedure?.machine?.name}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      {exec.zeroEnergyVerified ? (
                        <Badge variant="outline" className="border-success-muted text-success">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Verificado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-warning-muted text-warning-muted-foreground">
                          Pendiente verificacion
                        </Badge>
                      )}
                      <span className="text-muted-foreground">
                        {exec.lockedBy?.name} - {format(new Date(exec.lockedAt), 'dd/MM HH:mm', { locale: es })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="procedures" className="space-y-4">
          <TabsList>
            <TabsTrigger value="procedures" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Procedimientos
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Historial de Ejecuciones
            </TabsTrigger>
          </TabsList>

          <TabsContent value="procedures">
            <LOTOProcedureList
              procedures={procedures}
              isLoading={isLoadingProcedures}
              onView={(procedure) => {
                setSelectedProcedure(procedure);
                // Show detail dialog or navigate
              }}
              onEdit={(procedure) => {
                setSelectedProcedure(procedure);
                setIsFormOpen(true);
              }}
              onApprove={canApproveProcedure ? (procedure) => handleProcedureAction('approve', procedure) : undefined}
              onActivate={(procedure) => handleProcedureAction('activate', procedure)}
              onDeactivate={(procedure) => handleProcedureAction('deactivate', procedure)}
              onDelete={handleDeleteProcedure}
              onExecute={canExecute ? (procedure) => {
                setSelectedProcedure(procedure);
                setSelectedExecution(null);
                setIsExecutionDialogOpen(true);
              } : undefined}
              onCreate={canCreateProcedure ? () => {
                setSelectedProcedure(null);
                setIsFormOpen(true);
              } : undefined}
              onRefresh={fetchProcedures}
            />
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Historial de Ejecuciones LOTO</CardTitle>
                    <CardDescription>Registro de todos los bloqueos y desbloqueos</CardDescription>
                  </div>
                  <Button variant="outline" size="icon" onClick={fetchExecutions} disabled={isLoadingExecutions}>
                    <RefreshCw className={`h-4 w-4 ${isLoadingExecutions ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Procedimiento</TableHead>
                      <TableHead>Maquina</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Bloqueado Por</TableHead>
                      <TableHead>Fecha Bloqueo</TableHead>
                      <TableHead>Desbloqueado Por</TableHead>
                      <TableHead>Fecha Desbloqueo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingExecutions ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Cargando historial...
                        </TableCell>
                      </TableRow>
                    ) : executions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No hay ejecuciones LOTO registradas
                        </TableCell>
                      </TableRow>
                    ) : (
                      executions.map((exec) => (
                        <TableRow
                          key={exec.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => {
                            const proc = procedures.find(p => p.id === exec.procedureId);
                            if (proc) {
                              setSelectedProcedure(proc);
                              setSelectedExecution(exec);
                              setIsExecutionDialogOpen(true);
                            }
                          }}
                        >
                          <TableCell className="font-medium">{exec.procedure?.name}</TableCell>
                          <TableCell>{exec.procedure?.machine?.name || '-'}</TableCell>
                          <TableCell>
                            <LOTOStatusBadge status={exec.status} size="sm" />
                          </TableCell>
                          <TableCell>{exec.lockedBy?.name}</TableCell>
                          <TableCell>
                            {format(new Date(exec.lockedAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                          </TableCell>
                          <TableCell>{exec.unlockedBy?.name || '-'}</TableCell>
                          <TableCell>
                            {exec.unlockedAt
                              ? format(new Date(exec.unlockedAt), 'dd/MM/yyyy HH:mm', { locale: es })
                              : '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Procedure Form */}
        <LOTOProcedureForm
          procedure={selectedProcedure || undefined}
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSave={selectedProcedure ? handleUpdateProcedure : handleCreateProcedure}
          machines={machines}
        />

        {/* Execution Dialog */}
        <LOTOExecutionDialog
          procedure={selectedProcedure}
          execution={selectedExecution}
          isOpen={isExecutionDialogOpen}
          onClose={() => setIsExecutionDialogOpen(false)}
          onLock={canExecute ? handleLock : undefined}
          onVerifyZeroEnergy={canVerify ? handleVerifyZeroEnergy : undefined}
          onUnlock={canRelease ? handleUnlock : undefined}
        />
      </div>
    </PermissionGuard>
  );
}
