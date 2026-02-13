"use client";

import { CheckCircle2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TasksBulkActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkComplete?: () => void;
  onBulkDelete?: () => void;
  canDelete?: boolean;
  isProcessing?: boolean;
}

export function TasksBulkActionsBar({
  selectedCount,
  onClearSelection,
  onBulkComplete,
  onBulkDelete,
  canDelete = false,
  isProcessing = false,
}: TasksBulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-200">
      <div className="flex items-center gap-3 px-4 py-2.5 bg-background border border-border rounded-lg shadow-lg">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {selectedCount} {selectedCount === 1 ? "tarea seleccionada" : "tareas seleccionadas"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={onClearSelection}
            disabled={isProcessing}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="w-px h-6 bg-border" />

        <div className="flex items-center gap-2">
          {onBulkComplete && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={onBulkComplete}
              disabled={isProcessing}
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Completar</span>
            </Button>
          )}

          {canDelete && onBulkDelete && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={onBulkDelete}
              disabled={isProcessing}
            >
              <Trash2 className="h-4 w-4" />
              <span>Eliminar</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
