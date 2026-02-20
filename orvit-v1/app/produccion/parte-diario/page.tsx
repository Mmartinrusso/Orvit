'use client';

import { AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';

export default function ParteDiarioPage() {
  return (
    <div className="p-6 flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md">
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-warning-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">Página reemplazada</h2>
          <p className="text-muted-foreground text-sm mb-6">
            El Parte Diario fue reemplazado por <strong>Producción del Día</strong>,
            donde podés cargar la producción de tu sector con una grilla inline más rápida.
          </p>
          <Link href="/produccion/registro-diario">
            <Button className="gap-2">
              Ir a Producción del Día
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
