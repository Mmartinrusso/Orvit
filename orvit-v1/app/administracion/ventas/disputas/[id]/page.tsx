'use client';

/**
 * Credit Note Detail Page
 *
 * Shows comprehensive information about a credit/debit note:
 * - Note details and status
 * - Items breakdown
 * - Timeline of changes
 * - Client information
 * - Actions (emit, cancel, download)
 */

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  Download,
  Send,
  Ban,
  FileText,
  User,
  Calendar,
  Building,
  CheckCircle2,
  XCircle,
  Clock,
  FileCheck,
  Package,
  Receipt,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';

interface CreditNoteDetail {
  id: number;
  tipo: 'NOTA_CREDITO' | 'NOTA_DEBITO';
  numero: string;
  fecha: string;
  motivo: string;
  descripcion?: string;
  netoGravado: number;
  iva21: number;
  iva105: number;
  iva27: number;
  exento: number;
  noGravado: number;
  total: number;
  fiscalStatus: string;
  afectaStock: boolean;
  cae?: string;
  caeVencimiento?: string;
  docType: 'T1' | 'T2';
  puntoVenta: number;
  tipoComprobante: number;
  client: {
    id: string;
    name: string;
    cuit?: string;
    email?: string;
    address?: string;
  };
  invoice?: {
    id: number;
    numero: string;
    fecha: string;
    total: number;
  };
  items: Array<{
    id: number;
    productId?: string;
    codigo?: string;
    descripcion: string;
    cantidad: number;
    unidad: string;
    precioUnitario: number;
    alicuotaIva: number;
    subtotal: number;
    product?: {
      id: string;
      name: string;
      sku?: string;
    };
  }>;
  createdAt: string;
  emitidoAt?: string;
  emitidoPor?: number;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  DRAFT: { label: 'Borrador', color: 'bg-gray-100 text-gray-700', icon: FileText },
  PENDING_AFIP: { label: 'Pendiente AFIP', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  PROCESSING: { label: 'Procesando', color: 'bg-blue-100 text-blue-700', icon: Clock },
  AUTHORIZED: { label: 'Autorizada', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  REJECTED: { label: 'Rechazada', color: 'bg-red-100 text-red-700', icon: XCircle },
  CANCELLED: { label: 'Anulada', color: 'bg-gray-100 text-gray-500', icon: Ban },
};

const MOTIVO_LABELS: Record<string, string> = {
  DEVOLUCION: 'Devolución',
  DIFERENCIA_CARGA: 'Diferencia de carga',
  DIFERENCIA_PRECIO: 'Diferencia de precio',
  BONIFICACION: 'Bonificación',
  AJUSTE_FINANCIERO: 'Ajuste financiero',
  REFACTURACION: 'Refacturación',
  FLETE: 'Flete',
  OTRO: 'Otro',
};

export default function CreditNoteDetailPage() {
  const router = useRouter();
  const params = useParams();
  const noteId = params.id as string;

  const [note, setNote] = useState<CreditNoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [emitDialog, setEmitDialog] = useState(false);
  const [cancelDialog, setCancelDialog] = useState(false);
  const [emitting, setEmitting] = useState(false);

  useEffect(() => {
    loadNote();
  }, [noteId]);

  const loadNote = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/ventas/notas-credito/${noteId}`);
      if (!response.ok) throw new Error('Error al cargar nota');

      const data = await response.json();
      setNote(data);
    } catch (error) {
      console.error('Error loading note:', error);
      toast.error('Error al cargar la nota');
      router.push('/administracion/ventas/notas-credito');
    } finally {
      setLoading(false);
    }
  };

  const handleEmit = async () => {
    setEmitting(true);
    try {
      const response = await fetch(`/api/ventas/notas-credito/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'emit' }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al emitir nota');
      }

      const result = await response.json();
      toast.success(result.message || 'Nota emitida exitosamente');
      setEmitDialog(false);
      loadNote();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setEmitting(false);
    }
  };

  const handleCancel = async () => {
    try {
      const response = await fetch(`/api/ventas/notas-credito/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al anular nota');
      }

      toast.success('Nota anulada exitosamente');
      setCancelDialog(false);
      loadNote();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDownloadPDF = async () => {
    toast.info('Generación de PDF en desarrollo');
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-12 w-96" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-96" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  if (!note) {
    return null;
  }

  const StatusIcon = STATUS_CONFIG[note.fiscalStatus]?.icon || FileText;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {note.tipo === 'NOTA_CREDITO' ? 'Nota de Crédito' : 'Nota de Débito'}{' '}
              {note.numero}
            </h1>
            <p className="text-sm text-muted-foreground">
              Emitida el {format(new Date(note.fecha), 'dd/MM/yyyy', { locale: es })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleDownloadPDF}>
            <Download className="w-4 h-4 mr-2" />
            PDF
          </Button>
          {note.fiscalStatus === 'DRAFT' && (
            <>
              <Button variant="outline" onClick={() => setCancelDialog(true)} className="text-destructive">
                <Ban className="w-4 h-4 mr-2" />
                Anular
              </Button>
              <Button onClick={() => setEmitDialog(true)}>
                <Send className="w-4 h-4 mr-2" />
                Emitir
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Note Info */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Información de la Nota</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={note.tipo === 'NOTA_CREDITO' ? 'default' : 'destructive'}
                  >
                    {note.tipo === 'NOTA_CREDITO' ? 'NC' : 'ND'}
                  </Badge>
                  <Badge className={STATUS_CONFIG[note.fiscalStatus]?.color}>
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {STATUS_CONFIG[note.fiscalStatus]?.label}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Número</p>
                  <p className="font-mono font-medium">{note.numero}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fecha de Emisión</p>
                  <p className="font-medium">
                    {format(new Date(note.fecha), 'dd/MM/yyyy', { locale: es })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Motivo</p>
                  <p className="font-medium">
                    {MOTIVO_LABELS[note.motivo] || note.motivo}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Punto de Venta</p>
                  <p className="font-medium">{String(note.puntoVenta).padStart(4, '0')}</p>
                </div>
              </div>

              {note.descripcion && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Descripción</p>
                    <p className="text-sm">{note.descripcion}</p>
                  </div>
                </>
              )}

              {note.invoice && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Factura de Referencia
                    </p>
                    <div className="flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-muted-foreground" />
                      <p className="font-medium">{note.invoice.numero}</p>
                      <span className="text-sm text-muted-foreground">
                        ({formatCurrency(Number(note.invoice.total))})
                      </span>
                    </div>
                  </div>
                </>
              )}

              {note.cae && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">CAE</p>
                      <p className="font-mono">{note.cae}</p>
                    </div>
                    {note.caeVencimiento && (
                      <div>
                        <p className="text-sm text-muted-foreground">Vto. CAE</p>
                        <p className="font-medium">
                          {format(new Date(note.caeVencimiento), 'dd/MM/yyyy', { locale: es })}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {note.afectaStock && (
                <>
                  <Separator />
                  <div className="flex items-center gap-2 text-sm text-orange-600">
                    <Package className="w-4 h-4" />
                    <span>Esta nota afecta el stock (devolución de productos)</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Items de la Nota</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">P. Unit.</TableHead>
                      <TableHead className="text-right">IVA</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {note.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-sm">
                          {item.codigo || item.product?.sku || '-'}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.descripcion}</p>
                            {item.product && (
                              <p className="text-xs text-muted-foreground">
                                {item.product.name}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {item.cantidad} {item.unidad}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(Number(item.precioUnitario))}
                        </TableCell>
                        <TableCell className="text-right">{item.alicuotaIva}%</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(Number(item.subtotal))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Separator className="my-4" />

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Neto Gravado:</span>
                  <span>{formatCurrency(Number(note.netoGravado))}</span>
                </div>
                {Number(note.iva21) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>IVA 21%:</span>
                    <span>{formatCurrency(Number(note.iva21))}</span>
                  </div>
                )}
                {Number(note.iva105) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>IVA 10.5%:</span>
                    <span>{formatCurrency(Number(note.iva105))}</span>
                  </div>
                )}
                {Number(note.iva27) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>IVA 27%:</span>
                    <span>{formatCurrency(Number(note.iva27))}</span>
                  </div>
                )}
                {Number(note.exento) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Exento:</span>
                    <span>{formatCurrency(Number(note.exento))}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span className={note.tipo === 'NOTA_CREDITO' ? 'text-green-600' : 'text-red-600'}>
                    {formatCurrency(Number(note.total))}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Client Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4" />
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="font-medium">{note.client.name}</p>
                {note.client.cuit && (
                  <p className="text-sm text-muted-foreground">CUIT: {note.client.cuit}</p>
                )}
              </div>
              {note.client.email && (
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="text-sm">{note.client.email}</p>
                </div>
              )}
              {note.client.address && (
                <div>
                  <p className="text-sm text-muted-foreground">Dirección</p>
                  <p className="text-sm">{note.client.address}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Línea de Tiempo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Created */}
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="rounded-full bg-blue-100 p-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="w-px h-full bg-gray-200 mt-2" />
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="text-sm font-medium">Creada</div>
                    <div className="text-xs text-gray-500">
                      {format(new Date(note.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                    </div>
                  </div>
                </div>

                {/* Emitted */}
                {note.emitidoAt && (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="rounded-full bg-green-100 p-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      </div>
                      <div className="w-px h-full bg-gray-200 mt-2" />
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="text-sm font-medium">Emitida y Autorizada</div>
                      <div className="text-xs text-gray-500">
                        {format(new Date(note.emitidoAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                      </div>
                      {note.cae && (
                        <div className="text-xs text-gray-500 mt-1">CAE: {note.cae}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Current Status */}
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`rounded-full p-2 ${STATUS_CONFIG[note.fiscalStatus]?.color}`}>
                      <StatusIcon className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">
                      {STATUS_CONFIG[note.fiscalStatus]?.label}
                    </div>
                    <div className="text-xs text-gray-500">Estado actual</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Technical Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building className="w-4 h-4" />
                Información Técnica
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID:</span>
                <span className="font-mono">{note.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipo Doc:</span>
                <Badge variant="outline">{note.docType}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipo Comp. AFIP:</span>
                <span className="font-mono">{note.tipoComprobante}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Emit Dialog */}
      <AlertDialog open={emitDialog} onOpenChange={setEmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Emitir y Autorizar en AFIP</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Confirma la emisión de la nota <strong>{note.numero}</strong>?
              <br />
              <br />
              Esta acción:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Enviará la nota a AFIP para autorización</li>
                <li>
                  Afectará la cuenta corriente del cliente (
                  {note.tipo === 'NOTA_CREDITO' ? 'reducirá deuda' : 'aumentará deuda'})
                </li>
                {note.afectaStock && <li>Devolverá productos al stock</li>}
                <li>No podrá ser revertida una vez autorizada</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={emitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEmit}
              disabled={emitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {emitting ? 'Emitiendo...' : 'Sí, Emitir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Dialog */}
      <AlertDialog open={cancelDialog} onOpenChange={setCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anular Borrador</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Confirma la anulación del borrador <strong>{note.numero}</strong>?
              <br />
              <br />
              Esta acción eliminará el borrador permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} className="bg-destructive hover:bg-destructive/90">
              Sí, Anular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
