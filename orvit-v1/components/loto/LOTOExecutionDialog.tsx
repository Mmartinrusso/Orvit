'use client';

import { useState, useEffect } from 'react';
import { LOTOProcedure, LOTOExecution, LOTOStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Lock,
  Unlock,
  Zap,
  CheckCircle,
  AlertTriangle,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  ClipboardCheck
} from 'lucide-react';
import LOTOStatusBadge from './LOTOStatusBadge';

interface LOTOExecutionDialogProps {
  procedure: LOTOProcedure | null;
  execution?: LOTOExecution | null;
  isOpen: boolean;
  onClose: () => void;
  onLock?: (procedureId: number, data: any) => Promise<void>;
  onVerifyZeroEnergy?: (executionId: number, notes?: string) => Promise<void>;
  onUnlock?: (executionId: number, data: any) => Promise<void>;
  workOrderId?: number;
  ptwId?: number;
}

interface LockStep {
  id: string;
  description: string;
  location: string;
  lockType: string;
  completed: boolean;
}

export default function LOTOExecutionDialog({
  procedure,
  execution,
  isOpen,
  onClose,
  onLock,
  onVerifyZeroEnergy,
  onUnlock,
  workOrderId,
  ptwId,
}: LOTOExecutionDialogProps) {
  const [mode, setMode] = useState<'lock' | 'verify' | 'unlock'>('lock');
  const [lockSteps, setLockSteps] = useState<LockStep[]>([]);
  const [unlockSteps, setUnlockSteps] = useState<LockStep[]>([]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (procedure) {
      const steps = (procedure.lockoutSteps || []).map((step: any, idx: number) => ({
        id: step.id || `step-${idx}`,
        description: step.description || step,
        location: step.location || '',
        lockType: step.lockType || 'PADLOCK',
        completed: false,
      }));
      setLockSteps(steps);
      setUnlockSteps(steps.map((s: LockStep) => ({ ...s, completed: false })));
    }
  }, [procedure]);

  useEffect(() => {
    if (execution) {
      if (execution.status === LOTOStatus.LOCKED && !execution.zeroEnergyVerified) {
        setMode('verify');
      } else if (execution.status === LOTOStatus.LOCKED && execution.zeroEnergyVerified) {
        setMode('unlock');
      }
    } else {
      setMode('lock');
    }
  }, [execution]);

  const allLockStepsCompleted = lockSteps.every(s => s.completed);
  const allUnlockStepsCompleted = unlockSteps.every(s => s.completed);

  const toggleLockStep = (id: string) => {
    setLockSteps(prev => prev.map(s => s.id === id ? { ...s, completed: !s.completed } : s));
  };

  const toggleUnlockStep = (id: string) => {
    setUnlockSteps(prev => prev.map(s => s.id === id ? { ...s, completed: !s.completed } : s));
  };

  const handleLock = async () => {
    if (!procedure || !onLock || !allLockStepsCompleted) return;
    setIsSubmitting(true);
    try {
      await onLock(procedure.id, {
        workOrderId,
        ptwId,
        lockDetails: lockSteps.map(s => ({ ...s, completedAt: new Date() })),
        notes,
      });
      onClose();
    } catch (error) {
      console.error('Error locking:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyZeroEnergy = async () => {
    if (!execution || !onVerifyZeroEnergy) return;
    setIsSubmitting(true);
    try {
      await onVerifyZeroEnergy(execution.id, notes);
      onClose();
    } catch (error) {
      console.error('Error verifying:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlock = async () => {
    if (!execution || !onUnlock || !allUnlockStepsCompleted) return;
    setIsSubmitting(true);
    try {
      await onUnlock(execution.id, {
        unlockDetails: unlockSteps.map(s => ({ ...s, completedAt: new Date() })),
        notes,
      });
      onClose();
    } catch (error) {
      console.error('Error unlocking:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!procedure) return null;

  const renderEnergySources = () => (
    <div className="space-y-2">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <Zap className="h-4 w-4 text-yellow-500" />
        Fuentes de Energia a Aislar
      </h4>
      <div className="grid grid-cols-2 gap-2">
        {(procedure.energySources || []).map((source: any, idx: number) => (
          <div key={idx} className="p-2 border rounded-lg text-sm">
            <div className="font-medium">{source.type || source}</div>
            {source.location && (
              <div className="text-xs text-muted-foreground">{source.location}</div>
            )}
            {source.voltage && (
              <Badge variant="outline" className="text-xs mt-1">{source.voltage}</Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderLockMode = () => (
    <div className="space-y-4">
      <Alert>
        <Lock className="h-4 w-4" />
        <AlertTitle>Procedimiento de Bloqueo</AlertTitle>
        <AlertDescription>
          Complete todos los pasos de bloqueo antes de iniciar el trabajo. Verifique cada punto de aislamiento.
        </AlertDescription>
      </Alert>

      {renderEnergySources()}

      <Separator />

      {/* Required PPE */}
      {procedure.requiredPPE && procedure.requiredPPE.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-blue-500" />
            EPP Requerido
          </h4>
          <div className="flex flex-wrap gap-2">
            {procedure.requiredPPE.map((ppe, idx) => (
              <Badge key={idx} variant="outline">{ppe}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {procedure.warnings && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Advertencias</AlertTitle>
          <AlertDescription>{procedure.warnings}</AlertDescription>
        </Alert>
      )}

      <Separator />

      {/* Lock Steps Checklist */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4" />
          Pasos de Bloqueo ({lockSteps.filter(s => s.completed).length}/{lockSteps.length})
        </h4>
        <div className="space-y-2">
          {lockSteps.map((step, idx) => (
            <div
              key={step.id}
              className={`flex items-start gap-3 p-3 border rounded-lg transition-colors ${
                step.completed ? 'bg-green-50 border-green-200' : 'hover:bg-muted/50'
              }`}
            >
              <Checkbox
                id={step.id}
                checked={step.completed}
                onCheckedChange={() => toggleLockStep(step.id)}
              />
              <div className="flex-1">
                <label
                  htmlFor={step.id}
                  className={`font-medium cursor-pointer ${step.completed ? 'line-through text-muted-foreground' : ''}`}
                >
                  {idx + 1}. {step.description}
                </label>
                {step.location && (
                  <p className="text-xs text-muted-foreground mt-0.5">Ubicacion: {step.location}</p>
                )}
              </div>
              <Badge variant="outline" className="text-xs">{step.lockType}</Badge>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Notas (opcional)</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Observaciones durante el bloqueo..."
          rows={2}
        />
      </div>
    </div>
  );

  const renderVerifyMode = () => (
    <div className="space-y-4">
      <Alert className="border-blue-200 bg-blue-50">
        <CheckCircle className="h-4 w-4 text-blue-500" />
        <AlertTitle>Verificacion de Energia Cero</AlertTitle>
        <AlertDescription>
          Confirme que todas las fuentes de energia han sido efectivamente aisladas antes de iniciar el trabajo.
          Esta verificacion debe ser realizada por una persona diferente al operador que realizo el bloqueo.
        </AlertDescription>
      </Alert>

      {execution && (
        <div className="p-3 border rounded-lg">
          <div className="text-sm text-muted-foreground">Bloqueado por</div>
          <div className="font-medium">{execution.lockedBy?.name}</div>
        </div>
      )}

      {renderEnergySources()}

      <Separator />

      {/* Verification Steps */}
      {procedure.verificationSteps && procedure.verificationSteps.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Pasos de Verificacion</h4>
          <div className="space-y-2">
            {procedure.verificationSteps.map((step: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2 p-2 border rounded">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">{step.description || step}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {procedure.verificationMethod && (
        <div>
          <Label className="text-muted-foreground">Metodo de Verificacion</Label>
          <p className="text-sm mt-1">{procedure.verificationMethod}</p>
        </div>
      )}

      <div>
        <Label htmlFor="verifyNotes">Notas de Verificacion (opcional)</Label>
        <Textarea
          id="verifyNotes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Observaciones de la verificación..."
          rows={2}
        />
      </div>
    </div>
  );

  const renderUnlockMode = () => (
    <div className="space-y-4">
      <Alert className="border-green-200 bg-green-50">
        <Unlock className="h-4 w-4 text-green-600" />
        <AlertTitle>Procedimiento de Desbloqueo</AlertTitle>
        <AlertDescription>
          Complete todos los pasos de desbloqueo en orden inverso. Asegurese de que el area este despejada y segura.
        </AlertDescription>
      </Alert>

      {/* Restoration Steps */}
      {procedure.restorationSteps && procedure.restorationSteps.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Pasos de Restauracion Previos</h4>
          <div className="space-y-1 text-sm">
            {procedure.restorationSteps.map((step: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2 p-2 bg-muted rounded">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span>{step.description || step}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* Unlock Steps Checklist */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4" />
          Pasos de Desbloqueo ({unlockSteps.filter(s => s.completed).length}/{unlockSteps.length})
        </h4>
        <div className="space-y-2">
          {[...unlockSteps].reverse().map((step, idx) => (
            <div
              key={step.id}
              className={`flex items-start gap-3 p-3 border rounded-lg transition-colors ${
                step.completed ? 'bg-green-50 border-green-200' : 'hover:bg-muted/50'
              }`}
            >
              <Checkbox
                id={`unlock-${step.id}`}
                checked={step.completed}
                onCheckedChange={() => toggleUnlockStep(step.id)}
              />
              <div className="flex-1">
                <label
                  htmlFor={`unlock-${step.id}`}
                  className={`font-medium cursor-pointer ${step.completed ? 'line-through text-muted-foreground' : ''}`}
                >
                  {unlockSteps.length - idx}. Desbloquear: {step.description}
                </label>
                {step.location && (
                  <p className="text-xs text-muted-foreground mt-0.5">Ubicacion: {step.location}</p>
                )}
              </div>
              <Badge variant="outline" className="text-xs">{step.lockType}</Badge>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="unlockNotes">Notas (opcional)</Label>
        <Textarea
          id="unlockNotes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Observaciones durante el desbloqueo..."
          rows={2}
        />
      </div>
    </div>
  );

  const getFooterButtons = () => {
    switch (mode) {
      case 'lock':
        return (
          <>
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              onClick={handleLock}
              disabled={!allLockStepsCompleted || isSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              <Lock className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Bloqueando...' : 'Confirmar Bloqueo'}
            </Button>
          </>
        );
      case 'verify':
        return (
          <>
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              onClick={handleVerifyZeroEnergy}
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Verificando...' : 'Confirmar Energia Cero'}
            </Button>
          </>
        );
      case 'unlock':
        return (
          <>
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              onClick={handleUnlock}
              disabled={!allUnlockStepsCompleted || isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              <Unlock className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Desbloqueando...' : 'Confirmar Desbloqueo'}
            </Button>
          </>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'lock' && <Lock className="h-5 w-5 text-red-500" />}
            {mode === 'verify' && <CheckCircle className="h-5 w-5 text-blue-500" />}
            {mode === 'unlock' && <Unlock className="h-5 w-5 text-green-500" />}
            {mode === 'lock' && 'Ejecutar Bloqueo LOTO'}
            {mode === 'verify' && 'Verificar Energia Cero'}
            {mode === 'unlock' && 'Ejecutar Desbloqueo LOTO'}
          </DialogTitle>
          <DialogDescription>
            {procedure.name} - {procedure.machine?.name}
            {execution && (
              <div className="mt-1">
                <LOTOStatusBadge status={execution.status} size="sm" />
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {mode === 'lock' && renderLockMode()}
          {mode === 'verify' && renderVerifyMode()}
          {mode === 'unlock' && renderUnlockMode()}
        </ScrollArea>

        <DialogFooter>{getFooterButtons()}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
