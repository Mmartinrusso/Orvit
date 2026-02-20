'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Save, X } from 'lucide-react';

interface WorkOrderDialogFooterStickyProps {
  onCancel: () => void;
  onSave: () => void;
  loading?: boolean;
  hasChanges?: boolean;
  lastSaved?: Date | null;
  saveLabel?: string;
}

export function WorkOrderDialogFooterSticky({
  onCancel,
  onSave,
  loading = false,
  hasChanges = false,
  lastSaved = null,
  saveLabel = 'Guardar',
}: WorkOrderDialogFooterStickyProps) {
  const formatLastSaved = (date: Date | null) => {
    if (!date) return null;
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (minutes < 1) return 'Guardado ahora';
    if (minutes < 60) return `Guardado hace ${minutes}m`;
    if (hours < 24) return `Guardado hace ${hours}h`;
    return `Guardado ${date.toLocaleDateString()}`;
  };

  return (
    <div className="flex-shrink-0 border-t border-border bg-card px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {hasChanges ? (
            <span className="flex items-center gap-1.5 text-warning-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
              Cambios sin guardar
            </span>
          ) : lastSaved ? (
            <span className="text-success">
              {formatLastSaved(lastSaved)}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            onClick={onCancel} 
            disabled={loading}
            className="h-9"
          >
            Cancelar
          </Button>
          <Button 
            onClick={onSave} 
            disabled={loading || !hasChanges}
            className="h-9 gap-1.5"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {saveLabel}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
