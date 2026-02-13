'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface DeleteChecklistDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  checklistTitle: string;
}

export default function DeleteChecklistDialog({
  isOpen,
  onClose,
  onConfirm,
  checklistTitle
}: DeleteChecklistDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Eliminar Checklist
          </DialogTitle>
          <DialogDescription>
            ¿Estás seguro de que deseas eliminar el checklist &quot;{checklistTitle}&quot;?
            Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} size="default">
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex items-center gap-2"
            size="default"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
