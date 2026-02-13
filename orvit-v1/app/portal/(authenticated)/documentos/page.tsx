'use client';

import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileArchive, Construction } from 'lucide-react';

export default function PortalDocumentosPage() {
  const { canViewDocuments } = usePortalAuth();

  if (!canViewDocuments) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <FileArchive className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Acceso restringido</h2>
          <p className="text-muted-foreground">No tenés permisos para ver documentos.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documentos</h1>
        <p className="text-muted-foreground">Accedé a facturas, remitos y comprobantes</p>
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
            Esta sección estará disponible próximamente. Podrás descargar facturas,
            remitos y otros documentos relacionados a tus compras.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
