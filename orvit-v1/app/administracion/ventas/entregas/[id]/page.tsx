'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Loader2, Download, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { DeliveryDetailHeader } from '@/components/ventas/delivery-detail-header';
import { DeliveryDetailItems } from '@/components/ventas/delivery-detail-items';
import { DeliveryTimeline } from '@/components/ventas/delivery-timeline';
import { DeliveryEvidenceViewer } from '@/components/ventas/delivery-evidence-viewer';

export default function DeliveryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const deliveryId = parseInt(params.id as string);

  const [delivery, setDelivery] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (deliveryId) {
      fetchDelivery();
    }
  }, [deliveryId]);

  const fetchDelivery = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/ventas/entregas/${deliveryId}`);

      if (!response.ok) {
        throw new Error('Error al cargar la entrega');
      }

      const data = await response.json();
      setDelivery(data);
    } catch (error) {
      console.error('Error fetching delivery:', error);
      toast.error('Error al cargar la entrega');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPOD = async () => {
    try {
      setDownloading(true);
      const response = await fetch(`/api/ventas/entregas/${deliveryId}/pod`);

      if (!response.ok) {
        throw new Error('Error al generar POD');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `POD-${delivery?.numero || deliveryId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('POD descargado correctamente');
    } catch (error) {
      console.error('Error downloading POD:', error);
      toast.error('Error al descargar POD');
    } finally {
      setDownloading(false);
    }
  };

  const handleOpenMap = () => {
    if (delivery?.direccionEntrega) {
      const address = encodeURIComponent(delivery.direccionEntrega);
      window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, '_blank');
    } else if (delivery?.latitudActual && delivery?.longitudActual) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${delivery.latitudActual},${delivery.longitudActual}`, '_blank');
    } else {
      toast.error('No hay dirección o coordenadas GPS disponibles');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!delivery) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px] space-y-4">
        <p className="text-muted-foreground">Entrega no encontrada</p>
        <Button onClick={() => router.push('/administracion/ventas/entregas')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a Entregas
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.push('/administracion/ventas/entregas')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a Entregas
        </Button>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleOpenMap} disabled={!delivery.direccionEntrega && !delivery.latitudActual}>
            <MapPin className="h-4 w-4 mr-2" />
            Ver en Mapa
          </Button>

          <Button variant="outline" onClick={handleDownloadPOD} disabled={downloading || delivery.estado === 'PENDIENTE'}>
            {downloading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Descargar POD
              </>
            )}
          </Button>
        </div>
      </div>

      <DeliveryDetailHeader delivery={delivery} onRefresh={fetchDelivery} />

      <Tabs defaultValue="details" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="details">Detalles</TabsTrigger>
          <TabsTrigger value="items">Items ({delivery._count?.items || delivery.items?.length || 0})</TabsTrigger>
          <TabsTrigger value="timeline">Línea de Tiempo</TabsTrigger>
          <TabsTrigger value="evidence">Evidencias ({delivery._count?.evidences || delivery.evidences?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4 mt-4">
          <DeliveryDetailItems delivery={delivery} />
        </TabsContent>

        <TabsContent value="items" className="mt-4">
          <DeliveryDetailItems delivery={delivery} />
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <DeliveryTimeline delivery={delivery} />
        </TabsContent>

        <TabsContent value="evidence" className="mt-4">
          <DeliveryEvidenceViewer delivery={delivery} evidences={delivery.evidences || []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
