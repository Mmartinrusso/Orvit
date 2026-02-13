'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Cog, Construction } from 'lucide-react';

export default function ConfiabilidadComponentesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Confiabilidad por Componentes</h1>
        <p className="text-muted-foreground">
          Análisis de fallas y confiabilidad a nivel de componente
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cog className="h-5 w-5" />
            En desarrollo
          </CardTitle>
          <CardDescription>
            Análisis detallado de confiabilidad por componente y subcomponente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Construction className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground max-w-md">
              Esta sección permitirá analizar qué componentes fallan más frecuentemente,
              identificar patrones de falla, y priorizar mejoras o reemplazos
              basados en datos históricos.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
