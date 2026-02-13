'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Package,
  Building2,
  Calendar,
  Warehouse,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  ShoppingCart,
  User,
  Image,
  PenTool,
  ExternalLink,
  Truck,
  Tag,
  Hash,
  Edit,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DevolucionFromDocumentModal } from '@/components/compras/devolucion-from-document-modal';

interface RecepcionItem {
  id: number;
  cantidad: number;
  cantidadRecibida: number;
  unidad: string;
  descripcion: string;
  codigoPropio?: string;
  codigoProveedor?: string;
  descripcionItem?: string;
  supplierItem?: {
    id: number;
    nombre: string;
    unidad: string;
    codigoProveedor?: string;
  };
  purchaseOrderItem?: {
    id: number;
    cantidad: number;
    cantidadRecibida: number;
    cantidadPendiente: number;
    precioUnitario: number;
  };
}

interface Recepcion {
  id: number;
  numero: string;
  fechaRecepcion: string;
  numeroRemito?: string;
  estado: string;
  notas?: string;
  adjuntos?: string[];
  firma?: string;
  proveedor?: {
    id: number;
    name: string;
    cuit?: string;
    razon_social?: string;
    email?: string;
    phone?: string;
  };
  purchaseOrder?: {
    id: number;
    numero: string;
    estado: string;
    fechaEmision: string;
    total: number;
  };
  warehouse?: {
    id: number;
    codigo: string;
    nombre: string;
    direccion?: string;
  };
  factura?: {
    id: number;
    numeroSerie: string;
    numeroFactura: string;
    fechaEmision: string;
    total: number;
  };
  createdByUser?: {
    id: number;
    name: string;
  };
  items: RecepcionItem[];
  stockMovements?: Array<{
    id: number;
    tipo: string;
    cantidad: number;
    createdAt: string;
  }>;
  matchResults?: Array<{
    id: number;
    estado: string;
    matchCompleto: boolean;
    createdAt: string;
  }>;
}

export default function RecepcionDetallePage() {
  const params = useParams();
  const router = useRouter();
  const [recepcion, setRecepcion] = useState<Recepcion | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEvidenciaModal, setShowEvidenciaModal] = useState(false);
  const [devolucionModalOpen, setDevolucionModalOpen] = useState(false);

  const loadRecepcion = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/compras/recepciones/${params.id}`);
      if (!response.ok) {
        throw new Error('Error al cargar la recepción');
      }
      const data = await response.json();
      setRecepcion(data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar la recepción');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.id) {
      loadRecepcion();
    }
  }, [params.id]);

  const getEstadoBadge = (estado: string) => {
    const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
      'confirmada': { variant: 'default', icon: <CheckCircle className="w-3 h-3 mr-1" /> },
      'pendiente': { variant: 'secondary', icon: <Clock className="w-3 h-3 mr-1" /> },
      'borrador': { variant: 'outline', icon: <Edit className="w-3 h-3 mr-1" /> },
      'rechazada': { variant: 'destructive', icon: <AlertTriangle className="w-3 h-3 mr-1" /> },
    };
    const c = config[estado] || config['borrador'];
    return (
      <Badge variant={c.variant} className="flex items-center">
        {c.icon}
        {estado.charAt(0).toUpperCase() + estado.slice(1)}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!recepcion) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-medium">Recepción no encontrada</h2>
            <p className="text-muted-foreground mt-2">La recepción solicitada no existe o no tienes acceso.</p>
            <Button variant="outline" className="mt-4" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasEvidencia = recepcion.adjuntos?.length || recepcion.firma;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <Package className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold">Recepción {recepcion.numero}</h1>
              {getEstadoBadge(recepcion.estado)}
            </div>
            {recepcion.numeroRemito && (
              <p className="text-sm text-muted-foreground mt-1">
                Remito N°: {recepcion.numeroRemito}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {recepcion.estado === 'confirmada' && recepcion.proveedor && (
            <Button variant="outline" onClick={() => setDevolucionModalOpen(true)}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Crear Devolucion
            </Button>
          )}
          {hasEvidencia && (
            <Button variant="outline" onClick={() => setShowEvidenciaModal(true)}>
              <Image className="w-4 h-4 mr-2" />
              Ver Evidencia
            </Button>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Proveedor */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Proveedor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recepcion.proveedor ? (
              <>
                <p className="font-medium">{recepcion.proveedor.name}</p>
                {recepcion.proveedor.razon_social && recepcion.proveedor.razon_social !== recepcion.proveedor.name && (
                  <p className="text-sm text-muted-foreground">{recepcion.proveedor.razon_social}</p>
                )}
                {recepcion.proveedor.cuit && (
                  <p className="text-sm text-muted-foreground">CUIT: {recepcion.proveedor.cuit}</p>
                )}
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 h-auto"
                  onClick={() => router.push(`/administracion/compras/proveedores/${recepcion.proveedor?.id}`)}
                >
                  Ver proveedor <ExternalLink className="w-3 h-3 ml-1" />
                </Button>
              </>
            ) : (
              <p className="text-muted-foreground">Sin proveedor asignado</p>
            )}
          </CardContent>
        </Card>

        {/* Orden de Compra */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              Orden de Compra
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recepcion.purchaseOrder ? (
              <>
                <p className="font-medium">{recepcion.purchaseOrder.numero}</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(recepcion.purchaseOrder.fechaEmision), 'dd/MM/yyyy', { locale: es })}
                </p>
                <p className="text-sm">
                  Total: {formatCurrency(recepcion.purchaseOrder.total)}
                </p>
                <Badge variant="outline" className="text-xs">
                  {recepcion.purchaseOrder.estado}
                </Badge>
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 h-auto block mt-2"
                  onClick={() => router.push(`/administracion/compras/ordenes/${recepcion.purchaseOrder?.id}`)}
                >
                  Ver OC <ExternalLink className="w-3 h-3 ml-1" />
                </Button>
              </>
            ) : (
              <p className="text-muted-foreground">Sin OC relacionada</p>
            )}
          </CardContent>
        </Card>

        {/* Info de Recepción */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Información de Recepción
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>
                {format(new Date(recepcion.fechaRecepcion), 'dd/MM/yyyy HH:mm', { locale: es })}
              </span>
            </div>
            {recepcion.warehouse && (
              <div className="flex items-center gap-2 text-sm">
                <Warehouse className="w-4 h-4 text-muted-foreground" />
                <span>{recepcion.warehouse.nombre}</span>
              </div>
            )}
            {recepcion.createdByUser && (
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-muted-foreground" />
                <span>{recepcion.createdByUser.name}</span>
              </div>
            )}
            {recepcion.factura && (
              <div className="flex items-center gap-2 text-sm mt-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span>Factura: {recepcion.factura.numeroSerie}-{recepcion.factura.numeroFactura}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notas */}
      {recepcion.notas && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{recepcion.notas}</p>
          </CardContent>
        </Card>
      )}

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Package className="w-4 h-4" />
            Items Recibidos ({recepcion.items.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs font-medium">Código Interno</TableHead>
                  <TableHead className="text-xs font-medium">Código Proveedor</TableHead>
                  <TableHead className="text-xs font-medium">Descripción</TableHead>
                  <TableHead className="text-xs font-medium text-center">Cantidad</TableHead>
                  <TableHead className="text-xs font-medium text-center">Unidad</TableHead>
                  {recepcion.items.some(i => i.purchaseOrderItem?.precioUnitario) && (
                    <>
                      <TableHead className="text-xs font-medium text-right">Precio Unit.</TableHead>
                      <TableHead className="text-xs font-medium text-right">Subtotal</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {recepcion.items.map((item) => {
                  const codigoInterno = item.codigoPropio || '-';
                  const codigoProv = item.codigoProveedor || item.supplierItem?.codigoProveedor || '-';
                  const descripcion = item.descripcionItem || item.descripcion || item.supplierItem?.nombre || '-';
                  const precioUnit = item.purchaseOrderItem?.precioUnitario || 0;
                  const subtotal = item.cantidadRecibida * precioUnit;

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">
                        {codigoInterno !== '-' ? (
                          <span className="flex items-center gap-1">
                            <Hash className="w-3 h-3 text-muted-foreground" />
                            {codigoInterno}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {codigoProv !== '-' ? (
                          <span className="flex items-center gap-1">
                            <Tag className="w-3 h-3 text-muted-foreground" />
                            {codigoProv}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm max-w-[300px]">
                        <span className="line-clamp-2">{descripcion}</span>
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {item.cantidadRecibida}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {item.unidad || item.supplierItem?.unidad || 'UN'}
                      </TableCell>
                      {recepcion.items.some(i => i.purchaseOrderItem?.precioUnitario) && (
                        <>
                          <TableCell className="text-right text-sm">
                            {precioUnit > 0 ? formatCurrency(precioUnit) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {subtotal > 0 ? formatCurrency(subtotal) : '-'}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Evidencia */}
      <Dialog open={showEvidenciaModal} onOpenChange={setShowEvidenciaModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Image className="w-5 h-5" />
              Evidencia de Recepción
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Fotos */}
            {recepcion.adjuntos && recepcion.adjuntos.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  Fotos ({recepcion.adjuntos.length})
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {recepcion.adjuntos.map((url, index) => (
                    <div key={index} className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                      <img
                        src={url}
                        alt={`Foto ${index + 1}`}
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => window.open(url, '_blank')}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Firma */}
            {recepcion.firma && (
              <div>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <PenTool className="w-4 h-4" />
                  Firma de Conformidad
                </h3>
                <div className="bg-white border rounded-lg p-4 max-w-sm">
                  <img
                    src={recepcion.firma}
                    alt="Firma"
                    className="w-full h-auto"
                  />
                </div>
              </div>
            )}

            {!hasEvidencia && (
              <p className="text-muted-foreground text-center py-8">
                No hay evidencia adjunta para esta recepción
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Devolucion desde remito */}
      {recepcion && recepcion.proveedor && (
        <DevolucionFromDocumentModal
          open={devolucionModalOpen}
          onClose={() => setDevolucionModalOpen(false)}
          onSuccess={() => {
            setDevolucionModalOpen(false);
            toast.success('Devolucion creada. Puede verla en la seccion de Devoluciones.');
          }}
          sourceType="remito"
          sourceId={recepcion.id}
          sourceNumero={recepcion.numero}
          proveedorId={recepcion.proveedor.id}
          proveedorNombre={recepcion.proveedor.name}
          warehouseId={recepcion.warehouse?.id}
          items={recepcion.items.map(item => ({
            id: item.id,
            supplierItemId: item.supplierItem?.id,
            descripcion: item.descripcionItem || item.descripcion || item.supplierItem?.nombre || '',
            cantidad: item.cantidad,
            cantidadRecibida: item.cantidadRecibida,
            unidad: item.unidad || item.supplierItem?.unidad || 'UN',
            precioUnitario: item.purchaseOrderItem?.precioUnitario,
            codigoProveedor: item.codigoProveedor || item.supplierItem?.codigoProveedor,
          }))}
        />
      )}
    </div>
  );
}
