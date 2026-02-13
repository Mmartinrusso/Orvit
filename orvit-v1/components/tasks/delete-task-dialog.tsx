"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";

interface DeleteTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  taskTitle: string;
  taskType?: "normal" | "fixed";
}

export function DeleteTaskDialog({
  isOpen,
  onClose,
  onConfirm,
  taskTitle,
  taskType = "normal",
}: DeleteTaskDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error("Error al eliminar tarea:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const typeLabel = taskType === "fixed" ? "tarea fija" : "tarea";

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <AlertDialogTitle>Eliminar {typeLabel}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left">
            <span className="block mb-2">
              Esta accion no se puede deshacer. Se eliminara permanentemente la {typeLabel}:
            </span>
            <span className="block font-medium text-foreground bg-muted px-3 py-2 rounded-md">
              "{taskTitle}"
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel disabled={isDeleting}>
            Cancelar
          </AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Eliminando...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Hook helper para usar el dialog de eliminacion
import { useCallback } from "react";

interface UseDeleteTaskDialogOptions {
  onDelete: (taskId: string) => Promise<void>;
}

export function useDeleteTaskDialog({ onDelete }: UseDeleteTaskDialogOptions) {
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    taskId: string | null;
    taskTitle: string;
    taskType: "normal" | "fixed";
  }>({
    isOpen: false,
    taskId: null,
    taskTitle: "",
    taskType: "normal",
  });

  const openDialog = useCallback(
    (taskId: string, taskTitle: string, taskType: "normal" | "fixed" = "normal") => {
      setDialogState({
        isOpen: true,
        taskId,
        taskTitle,
        taskType,
      });
    },
    []
  );

  const closeDialog = useCallback(() => {
    setDialogState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handleConfirm = useCallback(async () => {
    if (dialogState.taskId) {
      await onDelete(dialogState.taskId);
    }
  }, [dialogState.taskId, onDelete]);

  return {
    dialogState,
    openDialog,
    closeDialog,
    handleConfirm,
    DialogComponent: (
      <DeleteTaskDialog
        isOpen={dialogState.isOpen}
        onClose={closeDialog}
        onConfirm={handleConfirm}
        taskTitle={dialogState.taskTitle}
        taskType={dialogState.taskType}
      />
    ),
  };
}
