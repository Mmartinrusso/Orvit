'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
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
  DialogBody,
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
        <Zap className="h-4 w-4 text-warning-muted-foreground" />
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
            <ShieldCheck className="h-4 w-4 text-primary" />
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
              className={cn('flex items-start gap-3 p-3 border rounded-lg transition-colors', step.completed ? 'bg-success-muted border-success/20' : 'hover:bg-muted/50')}
            >
              <Checkbox
                id={step.id}
                checked={step.completed}
                onCheckedChange={() => toggleLockStep(step.id)}
              />
              <div className="flex-1">
                <label
                  htmlFor={step.id}
                  className={cn('font-medium cursor-pointer', step.completed && 'line-through text-muted-foreground')}
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
      <Alert className="border-primary/20 bg-info-muted">
        <CheckCircle className="h-4 w-4 text-primary" />
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
                <CheckCircle className="h-4 w-4 text-success" />
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
      <Alert className="border-success/20 bg-success-muted">
        <Unlock className="h-4 w-4 text-success" />
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
              className={cn('flex items-start gap-3 p-3 border rounded-lg transition-colors', step.completed ? 'bg-success-muted border-success/20' : 'hover:bg-muted/50')}
            >
              <Checkbox
                id={`unlock-${step.id}`}
                checked={step.completed}
                onCheckedChange={() => toggleUnlockStep(step.id)}
              />
              <div className="flex-1">
                <label
                  htmlFor={`unlock-${step.id}`}
                  className={cn('font-medium cursor-pointer', step.completed && 'line-through text-muted-foreground')}
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
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
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
              className="bg-primary hover:bg-primary/90"
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
              className="bg-success hover:bg-success/90 text-success-foreground"
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
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'lock' && <Lock className="h-5 w-5 text-destructive" />}
            {mode === 'verify' && <CheckCircle className="h-5 w-5 text-primary" />}
            {mode === 'unlock' && <Unlock className="h-5 w-5 text-success" />}
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

        <DialogBody>
          {mode === 'lock' && renderLockMode()}
          {mode === 'verify' && renderVerifyMode()}
          {mode === 'unlock' && renderUnlockMode()}
        </DialogBody>

        <DialogFooter>{getFooterButtons()}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
