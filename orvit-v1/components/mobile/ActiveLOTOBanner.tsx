'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Lock,
  Unlock,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ActiveLOTO {
  id: number;
  machineName: string;
  procedureName: string;
  workOrderTitle?: string;
  lockedAt?: string;
}

interface ActiveLOTOBannerProps {
  lotos: ActiveLOTO[];
  onRelease?: (lotoId: number) => void;
}

export function ActiveLOTOBanner({ lotos, onRelease }: ActiveLOTOBannerProps) {
  const [expanded, setExpanded] = useState(false);

  if (lotos.length === 0) return null;

  return (
    <Card className="bg-destructive/10 border-destructive/20">
      <CardContent className="p-4">
        {/* Header */}
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-2">
            <div className="p-2 bg-destructive rounded-full animate-pulse">
              <Lock className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-destructive">
                LOTO Activo
              </h3>
              <p className="text-xs text-destructive">
                {lotos.length} bloqueo{lotos.length > 1 ? 's' : ''} activo{lotos.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon">
            {expanded ? (
              <ChevronUp className="h-5 w-5 text-destructive" />
            ) : (
              <ChevronDown className="h-5 w-5 text-destructive" />
            )}
          </Button>
        </div>

        {/* Expanded content */}
        {expanded && (
          <div className="mt-4 space-y-3">
            {lotos.map((loto) => (
              <div
                key={loto.id}
                className="bg-card rounded-lg p-3 border border-destructive/20"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{loto.machineName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {loto.procedureName}
                    </p>
                    {loto.workOrderTitle && (
                      <p className="text-xs text-muted-foreground mt-1">
                        OT: {loto.workOrderTitle}
                      </p>
                    )}
                    {loto.lockedAt && (
                      <p className="text-xs text-destructive mt-1">
                        Bloqueado: {format(new Date(loto.lockedAt), 'HH:mm', { locale: es })}
                      </p>
                    )}
                  </div>
                  {onRelease && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-destructive/30 text-destructive hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRelease(loto.id);
                      }}
                    >
                      <Unlock className="h-4 w-4 mr-1" />
                      Liberar
                    </Button>
                  )}
                </div>
              </div>
            ))}

            <div className="flex items-start gap-2 p-2 bg-destructive/10 rounded text-xs text-destructive">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <p>
                No olvides liberar los bloqueos LOTO al finalizar el trabajo.
                Verifica energía cero antes de retirar los bloqueos.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ActiveLOTOBanner;
