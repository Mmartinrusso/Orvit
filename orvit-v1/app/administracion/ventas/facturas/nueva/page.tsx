'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { InvoiceFormSheet } from '@/components/ventas/invoice-form-sheet';

export default function NuevaFacturaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSheetOpen, setIsSheetOpen] = useState(true);

  // Get saleId from query params if creating from sale order
  const saleId = searchParams.get('saleId');

  useEffect(() => {
    // If sheet closes, go back to invoices list
    if (!isSheetOpen) {
      router.push('/administracion/ventas/facturas');
    }
  }, [isSheetOpen, router]);

  const handleInvoiceCreated = (invoiceId: number) => {
    // Redirect to invoice detail page after creation
    router.push(`/administracion/ventas/facturas/${invoiceId}`);
  };

  const handleSheetClose = () => {
    setIsSheetOpen(false);
  };

  return (
    <PermissionGuard permission="ventas.facturas.create">
      <InvoiceFormSheet
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        onInvoiceCreated={handleInvoiceCreated}
        saleId={saleId ? parseInt(saleId) : undefined}
      />
    </PermissionGuard>
  );
}
