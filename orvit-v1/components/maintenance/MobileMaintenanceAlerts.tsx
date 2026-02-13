'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  Clock, 
  Truck, 
  Calendar,
  Gauge
} from 'lucide-react';

interface UnidadMovil {
  id: number;
  nombre: string;
  tipo: string;
  marca: string;
  modelo: string;
  año: number;
  patente: string;
  kilometraje: number;
  ultimoMantenimiento?: Date;
  proximoMantenimiento?: Date;
  estado: string;
}

interface MobileMaintenanceAlertsProps {
  unidades: UnidadMovil[];
  companyId: number;
}

export default function MobileMaintenanceAlerts({ 
  unidades, 
  companyId 
}: MobileMaintenanceAlertsProps) {
  
  // Calcular alertas basadas en kilometraje y tiempo
  const getMaintenanceAlerts = () => {
    const alerts = [];
    const now = new Date();
    
    unidades.forEach(unidad => {
      // Alertas por kilometraje
      const kmSinceLastMaintenance = unidad.kilometraje - (unidad.ultimoMantenimiento ? 0 : 0); // Simplificado
      const kmToNextMaintenance = 10000 - (kmSinceLastMaintenance % 10000); // Cada 10k km
      
      // Alertas por tiempo (último mantenimiento hace más de 6 meses)
      const monthsSinceLastMaintenance = unidad.ultimoMantenimiento 
        ? Math.floor((now.getTime() - unidad.ultimoMantenimiento.getTime()) / (1000 * 60 * 60 * 24 * 30))
        : 12; // Si nunca se hizo mantenimiento, asumir 12 meses
      
      // Determinar nivel de alerta
      let alertLevel = 'info';
      let message = '';
      let icon = Clock;
      
      if (kmToNextMaintenance <= 1000 || monthsSinceLastMaintenance >= 6) {
        alertLevel = 'urgent';
        message = 'Mantenimiento urgente requerido';
        icon = AlertTriangle;
      } else if (kmToNextMaintenance <= 2000 || monthsSinceLastMaintenance >= 4) {
        alertLevel = 'warning';
        message = 'Mantenimiento próximo';
        icon = Clock;
      } else if (kmToNextMaintenance <= 3000 || monthsSinceLastMaintenance >= 3) {
        alertLevel = 'info';
        message = 'Mantenimiento programado';
        icon = Calendar;
      }
      
      if (alertLevel !== 'info' || kmToNextMaintenance <= 3000) {
        alerts.push({
          unidad,
          alertLevel,
          message,
          icon,
          kmToNextMaintenance,
          monthsSinceLastMaintenance,
          priority: alertLevel === 'urgent' ? 1 : alertLevel === 'warning' ? 2 : 3
        });
      }
    });
    
    return alerts.sort((a, b) => a.priority - b.priority);
  };

  const alerts = getMaintenanceAlerts();

  const getAlertColor = (level: string) => {
    switch (level) {
      case 'urgent': return 'border-red-200 bg-red-50';
      case 'warning': return 'border-orange-200 bg-orange-50';
      case 'info': return 'border-blue-200 bg-blue-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  const getBadgeColor = (level: string) => {
    switch (level) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'warning': return 'bg-orange-100 text-orange-800';
      case 'info': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-green-600" />
            Estado de Mantenimiento - Unidades Móviles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="bg-green-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Truck className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-green-800 mb-2">
              ¡Todo al día!
            </h3>
            <p className="text-green-600">
              Todas las unidades móviles están al día con sus mantenimientos.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          Alertas de Mantenimiento - Unidades Móviles
          <Badge variant="secondary" className="ml-auto">
            {alerts.length} alerta{alerts.length !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {alerts.map((alert, index) => {
          const IconComponent = alert.icon;
          return (
            <Alert key={index} className={getAlertColor(alert.alertLevel)}>
              <IconComponent className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{alert.unidad.nombre}</span>
                      <Badge className={getBadgeColor(alert.alertLevel)}>
                        {alert.message}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600">
                      <p>{alert.unidad.marca} {alert.unidad.modelo} - {alert.unidad.patente}</p>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="flex items-center gap-1">
                          <Gauge className="h-3 w-3" />
                          {alert.kmToNextMaintenance.toLocaleString()} km restantes
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {alert.monthsSinceLastMaintenance} meses desde último mantenimiento
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          );
        })}
        
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-semibold text-gray-900 mb-2">Recomendaciones de Mantenimiento</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• <strong>Cada 5,000-10,000 km:</strong> Cambio de aceite y filtros</li>
            <li>• <strong>Cada 15,000-30,000 km:</strong> Revisión de frenos y suspensión</li>
            <li>• <strong>Cada 40,000-60,000 km:</strong> Mantenimiento mayor</li>
            <li>• <strong>Cada 6 meses:</strong> Mantenimiento preventivo independiente del kilometraje</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
