'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';
import {
  Plus,
  RefreshCw,
  Search,
  Filter,
  Send,
  FileCheck,
  XCircle,
  MoreVertical,
  Eye,
  CheckCircle,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { SolicitudNcaFormModal } from '@/components/compras/solicitud-nca-form-modal';
import { SolicitudNcaDetalleModal } from '@/components/compras/solicitud-nca-detalle-modal';

interface SolicitudNCA {
  id: number;
  numero: string;
  proveedorId: number;
  proveedor: { id: number; name: string };
  estado: string;
  tipo: string;
  facturaId?: number;
  factura?: { numeroSerie: string; numeroFactura: string };
  goodsReceiptId?: number;
  goodsReceipt?: { numero: string };
  montoSolicitado: number;
  montoAprobado?: number;
  motivo: string;
  fechaSolicitud: string;
  fechaEnvio?: string;
  fechaRespuesta?: string;
  items: any[];
}

const estadoLabels: Record<string, string> = {
  SNCA_NUEVA: 'Nueva',
  SNCA_ENVIADA: 'Enviada',
  SNCA_EN_REVISION: 'En Revisión',
  SNCA_APROBADA: 'Aprobada',
  SNCA_PARCIAL: 'Parcial',
  SNCA_RECHAZADA: 'Rechazada',
  SNCA_NCA_RECIBIDA: 'NCA Recibida',
  SNCA_APLICADA: 'Aplicada',
  SNCA_CERRADA: 'Cerrada',
  SNCA_CANCELADA: 'Cancelada',
};

const estadoColors: Record<string, string> = {
  SNCA_NUEVA: 'bg-info-muted text-info-muted-foreground',
  SNCA_ENVIADA: 'bg-purple-100 text-purple-800',
  SNCA_EN_REVISION: 'bg-warning-muted text-warning-muted-foreground',
  SNCA_APROBADA: 'bg-success-muted text-success',
  SNCA_PARCIAL: 'bg-warning-muted text-warning-muted-foreground',
  SNCA_RECHAZADA: 'bg-destructive/10 text-destructive',
  SNCA_NCA_RECIBIDA: 'bg-emerald-100 text-emerald-800',
  SNCA_APLICADA: 'bg-muted text-foreground',
  SNCA_CERRADA: 'bg-muted text-foreground',
  SNCA_CANCELADA: 'bg-destructive/10 text-destructive',
};

const tipoLabels: Record<string, string> = {
  SNCA_FALTANTE: 'Faltante',
  SNCA_DEVOLUCION: 'Devolución',
  SNCA_PRECIO: 'Precio',
  SNCA_DESCUENTO: 'Descuento',
  SNCA_CALIDAD: 'Calidad',
  SNCA_OTRO: 'Otro',
};

export default function SolicitudesNcaPage() {
  const confirm = useConfirm();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [solicitudes, setSolicitudes] = useState<SolicitudNCA[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [estadoFilter, setEstadoFilter] = useState(searchParams.get('estado') || 'all');
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDetalleModal, setShowDetalleModal] = useState<SolicitudNCA | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  const fetchSolicitudes = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (estadoFilter !== 'all') {
        params.set('estado', estadoFilter);
      }
      if (searchTerm) {
        params.set('search', searchTerm);
      }

      const response = await fetch(`/api/compras/solicitudes-nca?${params}`);
      if (!response.ok) throw new Error('Error al cargar solicitudes');
      const result = await response.json();
      setSolicitudes(result.data);
      setPagination(prev => ({
        ...prev,
        total: result.pagination.total,
        totalPages: result.pagination.totalPages
      }));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, estadoFilter, searchTerm]);

  useEffect(() => {
    fetchSolicitudes();
  }, [fetchSolicitudes]);

  const handleEnviar = async (solicitud: SolicitudNCA) => {
    const ok = await confirm({
      title: 'Enviar solicitud',
      description: `¿Enviar solicitud ${solicitud.numero} al proveedor?`,
      confirmText: 'Confirmar',
      variant: 'default',
    });
    if (!ok) return;
    try {
      const response = await fetch(`/api/compras/solicitudes-nca/${solicitud.id}/enviar`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Error al enviar');
      fetchSolicitudes();
    } catch (error) {
      alert('Error al enviar la solicitud');
    }
  };

  const handleCerrar = async (solicitud: SolicitudNCA) => {
    const ok = await confirm({
      title: 'Cerrar solicitud',
      description: `¿Cerrar solicitud ${solicitud.numero}?`,
      confirmText: 'Confirmar',
      variant: 'default',
    });
    if (!ok) return;
    try {
      const response = await fetch(`/api/compras/solicitudes-nca/${solicitud.id}/cerrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivoCierre: 'Cerrado desde UI' })
      });
      if (!response.ok) throw new Error('Error al cerrar');
      fetchSolicitudes();
    } catch (error) {
      alert('Error al cerrar la solicitud');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Solicitudes de NCA</h1>
          <p className="text-muted-foreground">
            Gestión de solicitudes de notas de crédito a proveedores
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchSolicitudes} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button onClick={() => setShowFormModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Solicitud
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número o proveedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={estadoFilter} onValueChange={setEstadoFilter}>
              <SelectTrigger className="w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {Object.entries(estadoLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Factura</TableHead>
                <TableHead className="text-right">Monto Solicitado</TableHead>
                <TableHead className="text-right">Monto Aprobado</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : solicitudes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No hay solicitudes de NCA
                  </TableCell>
                </TableRow>
              ) : (
                solicitudes.map((solicitud) => (
                  <TableRow key={solicitud.id}>
                    <TableCell className="font-mono font-medium">{solicitud.numero}</TableCell>
                    <TableCell>{solicitud.proveedor?.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{tipoLabels[solicitud.tipo] || solicitud.tipo}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={estadoColors[solicitud.estado]}>
                        {estadoLabels[solicitud.estado] || solicitud.estado}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {solicitud.factura ? (
                        <span className="text-sm">
                          {solicitud.factura.numeroSerie}-{solicitud.factura.numeroFactura}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${solicitud.montoSolicitado.toLocaleString('es-AR')}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {solicitud.montoAprobado != null ? (
                        <span className={solicitud.montoAprobado < solicitud.montoSolicitado ? 'text-warning-muted-foreground' : 'text-success'}>
                          ${solicitud.montoAprobado.toLocaleString('es-AR')}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {format(new Date(solicitud.fechaSolicitud), 'dd/MM/yy', { locale: es })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setShowDetalleModal(solicitud)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver detalle
                          </DropdownMenuItem>
                          {solicitud.estado === 'SNCA_NUEVA' && (
                            <DropdownMenuItem onClick={() => handleEnviar(solicitud)}>
                              <Send className="h-4 w-4 mr-2" />
                              Enviar al proveedor
                            </DropdownMenuItem>
                          )}
                          {['SNCA_NCA_RECIBIDA', 'SNCA_APROBADA', 'SNCA_PARCIAL', 'SNCA_RECHAZADA'].includes(solicitud.estado) && (
                            <DropdownMenuItem onClick={() => handleCerrar(solicitud)}>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Cerrar solicitud
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Paginación */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {solicitudes.length} de {pagination.total} solicitudes
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showFormModal && (
        <SolicitudNcaFormModal
          open={showFormModal}
          onClose={() => setShowFormModal(false)}
          onSuccess={() => {
            setShowFormModal(false);
            fetchSolicitudes();
          }}
        />
      )}
      {showDetalleModal && (
        <SolicitudNcaDetalleModal
          solicitud={showDetalleModal}
          open={!!showDetalleModal}
          onClose={() => setShowDetalleModal(null)}
          onUpdate={fetchSolicitudes}
        />
      )}
    </div>
  );
}
