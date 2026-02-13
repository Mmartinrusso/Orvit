'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogBody } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Truck, 
  Edit, 
  Wrench, 
  Calendar,
  Fuel,
  Gauge,
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  X,
  Plus
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import UnidadMovilMaintenances from './UnidadMovilMaintenances';

interface UnidadMovil {
  id: number;
  nombre: string;
  tipo: string;
  marca: string;
  modelo: string;
  año: number;
  patente: string;
  numeroChasis: string;
  numeroMotor: string;
  kilometraje: number;
  estado: 'ACTIVO' | 'MANTENIMIENTO' | 'FUERA_SERVICIO' | 'DESHABILITADO';
  sectorId: number;
  sector?: {
    id: number;
    name: string;
  };
  companyId: number;
  descripcion?: string;
  fechaAdquisicion?: string;
  valorAdquisicion?: number;
  proveedor?: string;
  garantiaHasta?: string;
  ultimoMantenimiento?: string;
  proximoMantenimiento?: string;
  combustible?: string;
  capacidadCombustible?: number;
  consumoPromedio?: number;
  createdAt: string;
  updatedAt: string;
}

interface UnidadMovilDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  unidad: UnidadMovil | null;
  onEdit?: (unidad: UnidadMovil) => void;
  onCreateMaintenance?: (unidad: UnidadMovil) => void;
}

export default function UnidadMovilDetailDialog({
  isOpen,
  onClose,
  unidad,
  onEdit,
  onCreateMaintenance
}: UnidadMovilDetailDialogProps) {
  const [activeTab, setActiveTab] = useState('overview');

  if (!unidad) return null;

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'ACTIVO': return 'bg-green-100 text-green-800';
      case 'MANTENIMIENTO': return 'bg-yellow-100 text-yellow-800';
      case 'FUERA_SERVICIO': return 'bg-red-100 text-red-800';
      case 'DESHABILITADO': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEstadoLabel = (estado: string) => {
    switch (estado) {
      case 'ACTIVO': return 'Activo';
      case 'MANTENIMIENTO': return 'En Mantenimiento';
      case 'FUERA_SERVICIO': return 'Fuera de Servicio';
      case 'DESHABILITADO': return 'Deshabilitado';
      default: return estado;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: es });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Truck className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold">{unidad.nombre}</DialogTitle>
                <DialogDescription className="text-base">
                  {unidad.tipo} • {unidad.marca} {unidad.modelo} • {unidad.año}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={getEstadoColor(unidad.estado)}>
                {getEstadoLabel(unidad.estado)}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <DialogBody>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Resumen</TabsTrigger>
              <TabsTrigger value="technical">Técnico</TabsTrigger>
              <TabsTrigger value="maintenance">Mantenimiento</TabsTrigger>
              <TabsTrigger value="details">Detalles</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Info className="h-5 w-5" />
                      Información Básica
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Patente:</span>
                        <p className="font-medium">{unidad.patente}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Año:</span>
                        <p className="font-medium">{unidad.año}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Sector:</span>
                        <p className="font-medium">{unidad.sector?.name || 'Sin asignar'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Kilometraje:</span>
                        <p className="font-medium">{unidad.kilometraje.toLocaleString()} km</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Fuel className="h-5 w-5" />
                      Combustible
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Tipo:</span>
                        <p className="font-medium">{unidad.combustible || 'No especificado'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Capacidad:</span>
                        <p className="font-medium">{unidad.capacidadCombustible ? `${unidad.capacidadCombustible}L` : 'No especificado'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Consumo:</span>
                        <p className="font-medium">{unidad.consumoPromedio ? `${unidad.consumoPromedio}L/100km` : 'No especificado'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {unidad.descripcion && (
                <Card>
                  <CardHeader>
                    <CardTitle>Descripción</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700">{unidad.descripcion}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="technical" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wrench className="h-5 w-5" />
                      Datos Técnicos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="text-gray-500">Número de Chasis:</span>
                        <p className="font-medium">{unidad.numeroChasis || 'No especificado'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Número de Motor:</span>
                        <p className="font-medium">{unidad.numeroMotor || 'No especificado'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Kilometraje Actual:</span>
                        <p className="font-medium">{unidad.kilometraje.toLocaleString()} km</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Gauge className="h-5 w-5" />
                      Rendimiento
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="text-gray-500">Combustible:</span>
                        <p className="font-medium">{unidad.combustible || 'No especificado'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Capacidad de Tanque:</span>
                        <p className="font-medium">{unidad.capacidadCombustible ? `${unidad.capacidadCombustible} litros` : 'No especificado'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Consumo Promedio:</span>
                        <p className="font-medium">{unidad.consumoPromedio ? `${unidad.consumoPromedio}L/100km` : 'No especificado'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="maintenance" className="flex-1 flex flex-col min-h-0 mt-4">

              {/* Mantenimientos de la Unidad Móvil */}
              <Card className="flex-1 flex flex-col min-h-0">
                <CardHeader className="flex-shrink-0">
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    Mantenimientos de {unidad.nombre}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col min-h-0">
                  <UnidadMovilMaintenances unidadId={unidad.id} companyId={unidad.companyId} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="details" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Información de Adquisición
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="text-gray-500">Fecha de Adquisición:</span>
                        <p className="font-medium">
                          {unidad.fechaAdquisicion ? formatDate(unidad.fechaAdquisicion) : 'No especificada'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Valor de Adquisición:</span>
                        <p className="font-medium">
                          {unidad.valorAdquisicion ? formatCurrency(unidad.valorAdquisicion) : 'No especificado'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Proveedor:</span>
                        <p className="font-medium">{unidad.proveedor || 'No especificado'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Garantía Hasta:</span>
                        <p className="font-medium">
                          {unidad.garantiaHasta ? formatDate(unidad.garantiaHasta) : 'No especificada'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Información del Sistema
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="text-gray-500">Creado:</span>
                        <p className="font-medium">{formatDate(unidad.createdAt)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Última Actualización:</span>
                        <p className="font-medium">{formatDate(unidad.updatedAt)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">ID:</span>
                        <p className="font-medium">{unidad.id}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
