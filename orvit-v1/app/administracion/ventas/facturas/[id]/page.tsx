'use client';

import { useParams, useRouter } from 'next/navigation';
import { FacturaDetailSheet } from '@/components/ventas/factura-detail-sheet';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

export default function FacturaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const handleClose = () => {
    router.push('/administracion/ventas/facturas');
  };

  return (
    <PermissionGuard permission="ventas.facturas.view">
      <FacturaDetailSheet
        invoiceId={parseInt(id)}
        open={true}
        onClose={handleClose}
      />
    </PermissionGuard>
  );
}
