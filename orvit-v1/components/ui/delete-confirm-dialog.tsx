'use client';

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface DeleteConfirmDialogProps {
  open: boolean;
  title?: string;
  description?: string;
  itemName?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  onOpenChange?: (open: boolean) => void;
  loading?: boolean;
}

export function DeleteConfirmDialog({
  open,
  title = 'Eliminar registro',
  description,
  itemName,
  confirmLabel = 'Eliminar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  onOpenChange,
  loading = false,
}: DeleteConfirmDialogProps) {
  const handleCancel = () => {
    onCancel?.();
    onOpenChange?.(false);
  };
  const finalDescription =
    description ||
    (itemName
      ? `¿Estás seguro de que querés eliminar ${itemName}? Esta acción no se puede deshacer.`
      : '¿Estás seguro de que querés eliminar este registro? Esta acción no se puede deshacer.');

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && !loading && handleCancel()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="text-destructive">{title}</DialogTitle>
          <DialogDescription className="pt-1">
            {finalDescription}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4 flex flex-row justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Eliminando...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


