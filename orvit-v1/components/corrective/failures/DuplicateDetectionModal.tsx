'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Link as LinkIcon, FileText, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface DuplicateCandidate {
  id: number;
  title: string;
  similarity: number;
  reportedAt: string;
  machine: { name: string };
  status: string;
  component?: { name: string };
}

interface DuplicateDetectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: DuplicateCandidate[];
  onLinkDuplicate: (duplicateId: number) => Promise<void> | void;
  onCreateNew: () => void;
  isLinking?: boolean;
}

/**
 * Modal que aparece cuando se detectan duplicados potenciales
 *
 * Opciones:
 * 1. Vincular a una falla existente (conserva timeline)
 * 2. Crear nueva falla (si no es duplicado real)
 *
 * IMPORTANTE: Vincular NO crea un caso paralelo, solo agrega al timeline
 */
export function DuplicateDetectionModal({
  open,
  onOpenChange,
  duplicates,
  onLinkDuplicate,
  onCreateNew,
  isLinking = false,
}: DuplicateDetectionModalProps) {
  const [linkingId, setLinkingId] = useState<number | null>(null);

  const handleLink = async (duplicateId: number) => {
    setLinkingId(duplicateId);
    try {
      await onLinkDuplicate(duplicateId);
    } finally {
      setLinkingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Posibles Duplicados Detectados
          </DialogTitle>
          <DialogDescription>
            Encontramos {duplicates.length} falla{duplicates.length > 1 ? 's' : ''} similar
            {duplicates.length > 1 ? 'es' : ''} reportada{duplicates.length > 1 ? 's' : ''} recientemente.
            ¿Es una nueva ocurrencia del mismo problema o una falla diferente?
          </DialogDescription>
        </DialogHeader>

        {/* Lista de duplicados potenciales */}
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {duplicates.map((duplicate) => (
            <div
              key={duplicate.id}
              className="rounded-lg border p-4 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  {/* Título y similitud */}
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{duplicate.title}</h4>
                    <Badge
                      variant={
                        duplicate.similarity >= 90
                          ? 'destructive'
                          : duplicate.similarity >= 75
                          ? 'default'
                          : 'secondary'
                      }
                    >
                      {Math.round(duplicate.similarity)}% similar
                    </Badge>
                  </div>

                  {/* Metadata */}
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span>🏭 {duplicate.machine.name}</span>
                    {duplicate.component && (
                      <span>🔧 {duplicate.component.name}</span>
                    )}
                    <span>
                      📅 Reportada{' '}
                      {formatDistanceToNow(new Date(duplicate.reportedAt), {
                        addSuffix: true,
                        locale: es,
                      })}
                    </span>
                  </div>
                </div>

                {/* Acción rápida */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleLink(duplicate.id)}
                  disabled={isLinking || linkingId !== null}
                >
                  {linkingId === duplicate.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <LinkIcon className="mr-2 h-4 w-4" />
                  )}
                  {linkingId === duplicate.id ? 'Vinculando...' : 'Vincular'}
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Explicación */}
        <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-medium mb-2">¿Qué significa "Vincular"?</p>
          <ul className="space-y-1 text-xs">
            <li>• Agrega tu reporte al timeline de la falla existente</li>
            <li>• NO crea un caso separado (evita duplicados)</li>
            <li>• Mantiene toda la historia del problema en un solo lugar</li>
            <li>• Tus fotos y notas se agregan automáticamente</li>
          </ul>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onCreateNew}
            className="flex-1"
            disabled={isLinking || linkingId !== null}
          >
            <FileText className="mr-2 h-4 w-4" />
            No es Duplicado, Crear Nueva Falla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
