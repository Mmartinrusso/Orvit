'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Truck, Eye, Wrench, Calendar } from 'lucide-react';
import UnidadMovilDetailDialog from './UnidadMovilDetailDialog';
import UnidadMovilMaintenanceDialog from './UnidadMovilMaintenanceDialog';

// Unidad móvil de ejemplo
const unidadEjemplo = {
  id: 1,
  nombre: "Mulita 001",
  tipo: "Camión",
  marca: "Mercedes-Benz",
  modelo: "Actros 1844",
  año: 2020,
  patente: "ABC123",
  numeroChasis: "WDB9634561LA12345",
  numeroMotor: "OM471LA.6-40",
  kilometraje: 125000,
  estado: "ACTIVO" as const,
  sectorId: 1,
  sector: {
    id: 1,
    name: "Logística"
  },
  companyId: 1,
  descripcion: "Camión de carga pesada para transporte de materiales. Equipado con sistema de refrigeración y GPS.",
  fechaAdquisicion: "2020-03-15",
  valorAdquisicion: 45000000,
  proveedor: "Mercedes-Benz Argentina",
  garantiaHasta: "2023-03-15",
  ultimoMantenimiento: "2024-01-15",
  proximoMantenimiento: "2024-04-15",
  combustible: "Diésel",
  capacidadCombustible: 400,
  consumoPromedio: 35,
  createdAt: "2020-03-15T10:00:00Z",
  updatedAt: "2024-01-15T14:30:00Z"
};

export default function UnidadMovilExample() {
  const [showDetail, setShowDetail] = useState(false);
  const [showMaintenance, setShowMaintenance] = useState(false);

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

  return (
    <div className="p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Ejemplo de Unidad Móvil
        </h1>
        <p className="text-gray-600">
          Aquí puedes ver cómo se vería el detalle de una unidad móvil
        </p>
      </div>

      {/* Card de la unidad móvil */}
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Truck className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-2xl">{unidadEjemplo.nombre}</CardTitle>
                <p className="text-gray-600">
                  {unidadEjemplo.tipo} • {unidadEjemplo.marca} {unidadEjemplo.modelo} • {unidadEjemplo.año}
                </p>
              </div>
            </div>
            <Badge className={getEstadoColor(unidadEjemplo.estado)}>
              {getEstadoLabel(unidadEjemplo.estado)}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Información básica */}
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">Información Básica</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Patente:</span>
                  <span className="font-medium">{unidadEjemplo.patente}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Sector:</span>
                  <span className="font-medium">{unidadEjemplo.sector.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Kilometraje:</span>
                  <span className="font-medium">{unidadEjemplo.kilometraje.toLocaleString()} km</span>
                </div>
              </div>
            </div>

            {/* Información técnica */}
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">Datos Técnicos</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Combustible:</span>
                  <span className="font-medium">{unidadEjemplo.combustible}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Capacidad:</span>
                  <span className="font-medium">{unidadEjemplo.capacidadCombustible}L</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Consumo:</span>
                  <span className="font-medium">{unidadEjemplo.consumoPromedio}L/100km</span>
                </div>
              </div>
            </div>

            {/* Mantenimiento */}
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">Mantenimiento</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Último:</span>
                  <span className="font-medium">15/01/2024</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Próximo:</span>
                  <span className="font-medium text-blue-600">15/04/2024</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Valor:</span>
                  <span className="font-medium">{formatCurrency(unidadEjemplo.valorAdquisicion)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Descripción */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">Descripción</h3>
            <p className="text-gray-700 text-sm">{unidadEjemplo.descripcion}</p>
          </div>

          {/* Botones de acción */}
          <div className="mt-6 flex gap-3 justify-center">
            <Button 
              onClick={() => setShowDetail(true)}
              className="flex items-center gap-2"
            >
              <Eye className="h-4 w-4" />
              Ver Detalle Completo
            </Button>
            <Button 
              variant="outline"
              onClick={() => setShowMaintenance(true)}
              className="flex items-center gap-2"
            >
              <Wrench className="h-4 w-4" />
              Crear Mantenimiento
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Información adicional */}
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Próximos Mantenimientos Sugeridos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div>
                  <p className="font-medium">Cambio de aceite</p>
                  <p className="text-sm text-gray-600">Cada 10,000 km</p>
                </div>
                <Badge variant="outline" className="text-yellow-700">
                  En 5,000 km
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div>
                  <p className="font-medium">Revisión de frenos</p>
                  <p className="text-sm text-gray-600">Cada 15,000 km</p>
                </div>
                <Badge variant="outline" className="text-blue-700">
                  En 10,000 km
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div>
                  <p className="font-medium">Mantenimiento mayor</p>
                  <p className="text-sm text-gray-600">Cada 50,000 km</p>
                </div>
                <Badge variant="outline" className="text-green-700">
                  En 25,000 km
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Estadísticas de Uso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Kilometraje promedio/mes:</span>
                <span className="font-medium">2,500 km</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Consumo mensual:</span>
                <span className="font-medium">875L</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Costo combustible/mes:</span>
                <span className="font-medium">$175,000</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Mantenimientos/año:</span>
                <span className="font-medium">4</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modales */}
      <UnidadMovilDetailDialog
        isOpen={showDetail}
        onClose={() => setShowDetail(false)}
        unidad={unidadEjemplo}
        onEdit={(unidad) => {
          console.log('Editar unidad:', unidad);
          setShowDetail(false);
        }}
        onCreateMaintenance={(unidad) => {
          setShowDetail(false);
          setShowMaintenance(true);
        }}
      />

      <UnidadMovilMaintenanceDialog
        isOpen={showMaintenance}
        onClose={() => setShowMaintenance(false)}
        onSave={(data) => {
          console.log('Crear mantenimiento:', data);
          setShowMaintenance(false);
        }}
        companyId={1}
        sectorId={1}
        selectedUnidad={unidadEjemplo}
      />
    </div>
  );
}
