'use client';

import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { History, Construction } from 'lucide-react';

export default function PortalHistorialPage() {
  const { canViewHistory } = usePortalAuth();

  if (!canViewHistory) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Acceso restringido</h2>
          <p className="text-muted-foreground">No tenés permisos para ver el historial.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Historial</h1>
        <p className="text-muted-foreground">Revisá tus compras y transacciones anteriores</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Construction className="h-5 w-5" />
            En construcción
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Esta sección estará disponible próximamente. Podrás ver el historial
            de todas tus transacciones con la empresa.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
