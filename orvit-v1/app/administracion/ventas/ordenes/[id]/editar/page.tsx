'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OrdenEditForm } from '@/components/ventas/orden-edit-form';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

export default function OrdenEditPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [orden, setOrden] = useState<any>(null);
  const [clientes, setClientes] = useState<any[]>([]);
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [params.id]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Cargar orden
      const ordenRes = await fetch(`/api/ventas/ordenes/${params.id}?full=true`);
      if (!ordenRes.ok) {
        throw new Error('Error al cargar la orden');
      }
      const ordenData = await ordenRes.json();

      // Verificar que esté en BORRADOR
      if (ordenData.estado !== 'BORRADOR') {
        toast({
          title: 'No se puede editar',
          description: 'Solo las órdenes en BORRADOR pueden editarse',
          variant: 'destructive',
        });
        router.push(`/administracion/ventas/ordenes/${params.id}`);
        return;
      }

      setOrden(ordenData);

      // Cargar clientes
      const clientesRes = await fetch('/api/ventas/clientes');
      if (clientesRes.ok) {
        const clientesData = await clientesRes.json();
        setClientes(clientesData.data || clientesData);
      }

      // Cargar vendedores (usuarios con rol de ventas)
      // TODO: Endpoint específico para vendedores
      const vendedoresRes = await fetch('/api/users');
      if (vendedoresRes.ok) {
        const vendedoresData = await vendedoresRes.json();
        setVendedores(Array.isArray(vendedoresData) ? vendedoresData : []);
      }

      // Cargar productos
      const productosRes = await fetch('/api/ventas/productos');
      if (productosRes.ok) {
        const productosData = await productosRes.json();
        setProductos(productosData.data || productosData);
      }

    } catch (error: any) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: error.message || 'Error al cargar los datos',
        variant: 'destructive',
      });
      router.push('/administracion/ventas/ordenes');
    } finally {
      setLoading(false);
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
      <div className="flex items-center gap-4">
        <Link href={`/administracion/ventas/ordenes/${params.id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Editar Orden</h1>
          <p className="text-muted-foreground">
            Orden {orden.numero} - {orden.client?.legalName || orden.client?.name}
          </p>
        </div>
      </div>

      {/* Alert de ayuda */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Solo las órdenes en estado BORRADOR pueden editarse. Los cambios recalcularán todos los totales automáticamente.
        </AlertDescription>
      </Alert>

      {/* Formulario */}
      <OrdenEditForm
        orden={orden}
        clientes={clientes}
        vendedores={vendedores}
        productos={productos}
      />
    </div>
  );
}
