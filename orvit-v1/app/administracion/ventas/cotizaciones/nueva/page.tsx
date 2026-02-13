'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { QuoteEditorModal } from '@/components/ventas/quote-editor-modal';
import { Quote } from '@/lib/types/sales';

export default function NuevaCotizacionPage() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(true);

  useEffect(() => {
    // Si el modal se cierra, volver a la lista de cotizaciones
    if (!isModalOpen) {
      router.push('/administracion/ventas/cotizaciones');
    }
  }, [isModalOpen, router]);

  const handleQuoteCreated = (quote: Quote) => {
    // Redireccionar a la lista de cotizaciones después de crear
    router.push('/administracion/ventas/cotizaciones');
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  return (
    <PermissionGuard permission="ventas.cotizaciones.create">
      <QuoteEditorModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onQuoteCreated={handleQuoteCreated}
        isEditing={false}
      />
    </PermissionGuard>
  );
} 