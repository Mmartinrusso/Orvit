'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface DeleteFailureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  failureId: number | null;
  failureTitle?: string;
  onSuccess?: () => void;
}

export function DeleteFailureDialog({
  open,
  onOpenChange,
  failureId,
  failureTitle,
  onSuccess,
}: DeleteFailureDialogProps) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/failure-occurrences/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al eliminar la falla');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Falla eliminada correctamente');
      queryClient.invalidateQueries({ queryKey: ['failure-occurrences'] });
      queryClient.invalidateQueries({ queryKey: ['failure-kpis'] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error('Error al eliminar', {
        description: error.message,
      });
    },
  });

  const handleDelete = () => {
    if (failureId) {
      deleteMutation.mutate(failureId);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Eliminar Falla
          </AlertDialogTitle>
          <AlertDialogDescription>
            ¿Estás seguro de que deseas eliminar esta falla?
            {failureTitle && (
              <span className="block mt-2 font-medium text-foreground">
                "{failureTitle}"
              </span>
            )}
            <span className="block mt-2 text-destructive">
              Esta acción no se puede deshacer. Se eliminarán también todos los
              registros asociados (timeline, soluciones, etc).
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Eliminando...
              </>
            ) : (
              'Eliminar'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
