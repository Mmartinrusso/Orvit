import React from 'react';
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogFooter,
 DialogHeader,
 DialogTitle,
 DialogBody,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';

interface DeleteConfirmationDialogProps {
 isOpen: boolean;
 onClose: () => void;
 onConfirm: () => void;
 maintenanceTitle: string;
 maintenanceType: 'preventive' | 'corrective';
 isLoading?: boolean;
}

export function DeleteConfirmationDialog({
 isOpen,
 onClose,
 onConfirm,
 maintenanceTitle,
 maintenanceType,
 isLoading = false
}: DeleteConfirmationDialogProps) {
 return (
 <Dialog open={isOpen} onOpenChange={onClose}>
 <DialogContent size="sm">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2 text-destructive">
 <Trash2 className="h-5 w-5" />
 Eliminar Mantenimiento
 </DialogTitle>
 <DialogDescription>
 ¿Estás seguro de que quieres eliminar este mantenimiento?
 </DialogDescription>
 </DialogHeader>

 <DialogBody>
 <div className="flex items-start gap-3 p-3 bg-destructive/10 rounded-lg">
 <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
 <div className="text-sm">
 <p className="font-medium text-destructive mb-1">
 {maintenanceTitle}
 </p>
 <p className="text-destructive">
 Tipo: {maintenanceType === 'preventive' ? 'Mantenimiento Preventivo' : 'Mantenimiento Correctivo'}
 </p>
 <p className="text-destructive mt-1">
 Esta acción no se puede deshacer. Se eliminarán todos los datos asociados.
 </p>
 </div>
 </div>
 </DialogBody>

 <DialogFooter>
 <Button
 variant="outline"
 onClick={onClose}
 disabled={isLoading}
 size="default"
 >
 Cancelar
 </Button>
 <Button
 variant="destructive"
 onClick={onConfirm}
 disabled={isLoading}
 className="gap-2"
 size="default"
 >
 {isLoading ? (
 <>
 <Loader2 className="h-4 w-4 animate-spin" />
 Eliminando...
 </>
 ) : (
 <>
 <Trash2 className="h-4 w-4" />
 Eliminar
 </>
 )}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
}
