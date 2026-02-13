'use client';

/**
 * Payment Registration Page
 *
 * Form to register client payments (cobranzas) with:
 * - Multiple payment methods
 * - Application to pending invoices
 * - Retentions
 * - Treasury account selection
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { PaymentForm } from '@/components/ventas/payment-form';
import { toast } from 'sonner';

export default function RegistrarCobranzaPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (data: any) => {
    setSubmitting(true);
    try {
      const response = await fetch('/api/ventas/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al registrar el pago');
      }

      const result = await response.json();
      toast.success(`Pago ${result.numero} registrado exitosamente`);
      router.push('/administracion/ventas/cobranzas');
    } catch (error) {
      console.error('Error:', error);
      toast.error(error instanceof Error ? error.message : 'Error al registrar el pago');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <h1 className="text-2xl font-bold">Registrar Cobro</h1>
      </div>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle>Nuevo Cobro</CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentForm
            onSubmit={handleSubmit}
            onCancel={() => router.back()}
            submitting={submitting}
          />
        </CardContent>
      </Card>
    </div>
  );
}
