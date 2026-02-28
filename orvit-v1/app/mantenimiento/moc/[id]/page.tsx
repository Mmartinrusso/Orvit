'use client';

import { use } from 'react';
import { MOCDetail } from '@/components/moc';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

interface Props {
  params: Promise<{ id: string }>;
}

export default function MOCDetailPage({ params }: Props) {
  const { id } = use(params);
  const mocId = parseInt(id);

  if (isNaN(mocId)) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12 text-muted-foreground">
          ID de MOC inválido
        </div>
      </div>
    );
  }

  return (
    <PermissionGuard permission="moc.view" fallback={<div className="p-6 text-muted-foreground">No tienes permisos para ver esta página</div>}>
      <div className="container mx-auto p-6">
        <MOCDetail mocId={mocId} />
      </div>
    </PermissionGuard>
  );
}
