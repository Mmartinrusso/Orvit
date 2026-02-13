'use client';

import { useParams, useRouter } from 'next/navigation';
import { CotizacionDetailSheet } from '@/components/ventas/cotizacion-detail-sheet';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

export default function CotizacionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const handleClose = () => {
    router.push('/administracion/ventas/cotizaciones');
  };

  return (
    <PermissionGuard permission="ventas.cotizaciones.view">
      <CotizacionDetailSheet
        quoteId={parseInt(id)}
        open={true}
        onClose={handleClose}
      />
    </PermissionGuard>
  );
}
