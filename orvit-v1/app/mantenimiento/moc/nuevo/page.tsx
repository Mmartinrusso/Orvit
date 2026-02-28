'use client';

import { useCompany } from '@/contexts/CompanyContext';
import { MOCForm } from '@/components/moc';
import { Card, CardContent } from '@/components/ui/card';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { Loader2 } from 'lucide-react';

export default function NuevoMOCPage() {
  const { currentCompany, isLoading } = useCompany();

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentCompany) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Seleccione una empresa para crear un MOC
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PermissionGuard permission="moc.create" fallback={<div className="p-6 text-muted-foreground">No tienes permisos para crear MOCs</div>}>
      <div className="container mx-auto p-6">
        <MOCForm companyId={currentCompany.id} />
      </div>
    </PermissionGuard>
  );
}
