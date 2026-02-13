'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { OrdenDetailHeader } from '@/components/ventas/orden-detail-header';
import { OrdenDetailItems } from '@/components/ventas/orden-detail-items';
import { OrdenDetailTotales } from '@/components/ventas/orden-detail-totales';
import { OrdenTimeline } from '@/components/ventas/orden-timeline';
import { OrdenDetailNotas } from '@/components/ventas/orden-detail-notas';
import { OrdenDetailDocumentos } from '@/components/ventas/orden-detail-documentos';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export default function OrdenDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [orden, setOrden] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const canEdit = hasPermission?.('ventas.ordenes.edit');
  const canConfirm = hasPermission?.('ventas.ordenes.confirm');
  const canCancel = hasPermission?.('ventas.ordenes.delete');

  useEffect(() => {
    loadOrden();
  }, [params.id]);

  const loadOrden = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/ventas/ordenes/${params.id}?full=true`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al cargar la orden');
      }

      const data = await response.json();
      setOrden(data);
    } catch (error: any) {
      console.error('Error loading orden:', error);
      toast({
        title: 'Error',
        description: error.message || 'Error al cargar la orden',
        variant: 'destructive',
      });
      router.push('/administracion/ventas/ordenes');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmar = async () => {
    try {
      const response = await fetch(`/api/ventas/ordenes/${params.id}/confirmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ignorarAlertasStock: false,
          ignorarLimiteCredito: false,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al confirmar');
      }

      toast({
        title: 'Orden confirmada',
        description: 'La orden ha sido confirmada exitosamente',
      });

      await loadOrden();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al confirmar la orden',
        variant: 'destructive',
      });
    }
  };

  const handlePreparar = async () => {
    try {
      const response = await fetch(`/api/ventas/ordenes/${params.id}/preparar`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al iniciar preparación');
      }

      toast({
        title: 'Preparación iniciada',
        description: 'La orden está en preparación',
      });

      await loadOrden();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al iniciar preparación',
        variant: 'destructive',
      });
    }
  };

  const handleCancelar = async () => {
    const motivo = prompt('Ingrese el motivo de cancelación:');
    if (!motivo) return;

    try {
      const response = await fetch(`/api/ventas/ordenes/${params.id}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al cancelar');
      }

      toast({
        title: 'Orden cancelada',
        description: 'La orden ha sido cancelada',
      });

      await loadOrden();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al cancelar la orden',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`/api/ventas/ordenes/${params.id}/pdf`);

      if (!response.ok) {
        throw new Error('Error al generar PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Orden_${orden.numero}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'PDF descargado',
        description: 'El PDF se ha descargado correctamente',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Error al descargar el PDF',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!orden) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Orden no encontrada</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <OrdenDetailHeader
        orden={orden}
        onConfirmar={handleConfirmar}
        onPreparar={handlePreparar}
        onCancelar={handleCancelar}
        onDownloadPDF={handleDownloadPDF}
        canEdit={canEdit}
        canConfirm={canConfirm}
        canCancel={canCancel}
      />

      {/* Tabs */}
      <Tabs defaultValue="detalles" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="detalles">Detalles</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="notas">Notas</TabsTrigger>
        </TabsList>

        <TabsContent value="detalles" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <OrdenDetailItems items={orden.items || []} moneda={orden.moneda} />
            </div>
            <div>
              <OrdenDetailTotales orden={orden} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="historial">
          <OrdenTimeline orden={orden} />
        </TabsContent>

        <TabsContent value="documentos">
          <OrdenDetailDocumentos
            deliveries={orden.deliveries}
            remitos={orden.remitos}
            invoices={orden.invoices}
            loadOrders={orden.loadOrders}
          />
        </TabsContent>

        <TabsContent value="notas">
          <OrdenDetailNotas
            notas={orden.notas}
            notasInternas={orden.notasInternas}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
