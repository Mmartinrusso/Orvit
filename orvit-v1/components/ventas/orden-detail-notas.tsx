'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Lock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface OrdenDetailNotasProps {
  notas?: string | null;
  notasInternas?: string | null;
}

export function OrdenDetailNotas({ notas, notasInternas }: OrdenDetailNotasProps) {
  const hasNotas = notas || notasInternas;

  if (!hasNotas) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Notas y Observaciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay notas registradas para esta orden
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Notas y Observaciones
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Notas Públicas */}
        {notas && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                Notas Públicas
              </Badge>
              <span className="text-xs text-muted-foreground">
                (Visibles para el cliente)
              </span>
            </div>
            <Alert className="bg-blue-50 border-blue-200">
              <AlertDescription className="text-sm whitespace-pre-wrap">
                {notas}
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Notas Internas */}
        {notasInternas && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                <Lock className="h-3 w-3 mr-1" />
                Notas Internas
              </Badge>
              <span className="text-xs text-muted-foreground">
                (Solo para uso interno)
              </span>
            </div>
            <Alert className="bg-amber-50 border-amber-200">
              <AlertDescription className="text-sm whitespace-pre-wrap">
                {notasInternas}
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
