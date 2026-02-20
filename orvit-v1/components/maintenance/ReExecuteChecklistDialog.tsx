'use client';

import React from 'react';
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogDescription,
 DialogBody,
 DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, PlayCircle } from 'lucide-react';
import { format } from 'date-fns';

interface ReExecuteChecklistDialogProps {
 isOpen: boolean;
 onClose: () => void;
 onConfirm: () => void;
 checklistTitle: string;
 nextResetDate?: Date;
 frequency: string;
}

export default function ReExecuteChecklistDialog({
 isOpen,
 onClose,
 onConfirm,
 checklistTitle,
 nextResetDate,
 frequency
}: ReExecuteChecklistDialogProps) {
 const getFrequencyLabel = (freq: string) => {
 const labels = {
 'DAILY': 'diario',
 'WEEKLY': 'semanal',
 'MONTHLY': 'mensual',
 'QUARTERLY': 'trimestral',
 'SEMIANNUAL': 'semestral',
 'ANNUAL': 'anual'
 };
 return labels[freq as keyof typeof labels] || freq;
 };

 return (
 <Dialog open={isOpen} onOpenChange={onClose}>
 <DialogContent size="sm">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2 text-warning-muted-foreground">
 <AlertTriangle className="h-5 w-5" />
 Re-ejecutar Checklist
 </DialogTitle>
 <DialogDescription>
 El checklist &quot;{checklistTitle}&quot; ya fue completado.
 </DialogDescription>
 </DialogHeader>

 <DialogBody>
 <div className="space-y-2">
 {nextResetDate ? (
 <p className="text-sm text-foreground">
 Se reiniciará automáticamente el {format(nextResetDate, 'dd/MM/yyyy')}
 (frecuencia {getFrequencyLabel(frequency)}).
 </p>
 ) : (
 <p className="text-sm text-foreground">
 Frecuencia: {getFrequencyLabel(frequency)}
 </p>
 )}
 <p className="font-medium">
 ¿Deseas ejecutarlo nuevamente?
 </p>
 </div>
 </DialogBody>

 <DialogFooter>
 <Button variant="outline" onClick={onClose} size="default">
 Cancelar
 </Button>
 <Button
 onClick={() => {
 onConfirm();
 onClose();
 }}
 className="flex items-center gap-2 bg-warning hover:bg-warning/90"
 size="default"
 >
 <PlayCircle className="h-4 w-4" />
 Re-ejecutar
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
}
