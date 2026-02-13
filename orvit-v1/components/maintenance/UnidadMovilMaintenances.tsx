'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Clock, 
  CheckCircle, 
  List, 
  Calendar,
  AlertTriangle,
  Wrench
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Maintenance {
  id: number;
  title: string;
  description?: string;
  type: 'PREVENTIVE' | 'CORRECTIVE';
  status: 'PENDING' | 'COMPLETED' | 'IN_PROGRESS' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  scheduledDate?: string;
  completedDate?: string;
  assignedTo?: {
    id: number;
    name: string;
  };
  estimatedTime?: number;
  actualTime?: number;
  notes?: string;
  issues?: string;
  frequency?: string;
  frequencyUnit?: string;
}

interface UnidadMovilMaintenancesProps {
  unidadId: number;
  companyId: number;
}

export default function UnidadMovilMaintenances({ 
  unidadId, 
  companyId 
}: UnidadMovilMaintenancesProps) {
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMaintenances();
  }, [unidadId, companyId]);

  const fetchMaintenances = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/maintenance/unidad-movil/${unidadId}?companyId=${companyId}`);
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 Datos recibidos del servidor:', data);
        console.log('📋 Mantenimientos:', data.maintenances);
        if (data.maintenances && data.maintenances.length > 0) {
          console.log('📊 Primer mantenimiento:', data.maintenances[0]);
          console.log('📅 Frecuencia del primer mantenimiento:', {
            frequency: data.maintenances[0].frequency,
            frequencyUnit: data.maintenances[0].frequencyUnit
          });
        }
        setMaintenances(data.maintenances || []);
      }
    } catch (error) {
      console.error('Error fetching maintenances:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PENDING': return 'Pendiente';
      case 'COMPLETED': return 'Completado';
      case 'IN_PROGRESS': return 'En Progreso';
      case 'CANCELLED': return 'Cancelado';
      default: return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'LOW': return 'bg-green-100 text-green-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'HIGH': return 'bg-orange-100 text-orange-800';
      case 'URGENT': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'LOW': return 'Baja';
      case 'MEDIUM': return 'Media';
      case 'HIGH': return 'Alta';
      case 'URGENT': return 'Urgente';
      default: return priority;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'PREVENTIVE': return 'Preventivo';
      case 'CORRECTIVE': return 'Correctivo';
      default: return type;
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: es });
  };

  const formatFrequency = (frequency?: string, frequencyUnit?: string) => {
    if (!frequency || !frequencyUnit) return 'No especificada';
    
    const freq = parseInt(frequency);
    const unit = frequencyUnit.toLowerCase();
    
    switch (unit) {
      case 'days':
        return freq === 1 ? 'Diario' : `Cada ${freq} días`;
      case 'weeks':
        return freq === 1 ? 'Semanal' : `Cada ${freq} semanas`;
      case 'months':
        return freq === 1 ? 'Mensual' : `Cada ${freq} meses`;
      case 'years':
        return freq === 1 ? 'Anual' : `Cada ${freq} años`;
      default:
        return `Cada ${freq} ${unit}`;
    }
  };

  const pendingMaintenances = maintenances.filter(m => m.status === 'PENDING');
  const completedMaintenances = maintenances.filter(m => m.status === 'COMPLETED');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Cargando mantenimientos...</p>
        </div>
      </div>
    );
  }

  const renderMaintenanceCard = (maintenance: Maintenance) => (
    <Card key={maintenance.id} className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{maintenance.title}</CardTitle>
            {maintenance.description && (
              <p className="text-sm text-gray-600 mt-1">{maintenance.description}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Badge className={getStatusColor(maintenance.status)}>
              {getStatusLabel(maintenance.status)}
            </Badge>
            <Badge className={getPriorityColor(maintenance.priority)}>
              {getPriorityLabel(maintenance.priority)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Información principal como en la vista de mantenimientos */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Calendar className="h-4 w-4" />
          <span>{formatFrequency(maintenance.frequency, maintenance.frequencyUnit)}</span>
          {maintenance.estimatedTime && (
            <>
              <Clock className="h-4 w-4 ml-4" />
              <span>Duración: {maintenance.estimatedTime} min</span>
            </>
          )}
          {maintenance.scheduledDate && (
            <>
              <Calendar className="h-4 w-4 ml-4" />
              <span>Próximo: {new Date(maintenance.scheduledDate).toLocaleDateString('es-ES')}</span>
            </>
          )}
        </div>

        {/* Información adicional en grid */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Tipo:</span>
            <p className="font-medium">{getTypeLabel(maintenance.type)}</p>
          </div>
          <div>
            <span className="text-gray-500">ID:</span>
            <p className="font-medium">{maintenance.id}</p>
          </div>
          {maintenance.completedDate && (
            <div>
              <span className="text-gray-500">Fecha Completado:</span>
              <p className="font-medium">{formatDate(maintenance.completedDate)}</p>
            </div>
          )}
          {maintenance.assignedTo && (
            <div>
              <span className="text-gray-500">Asignado a:</span>
              <p className="font-medium">{maintenance.assignedTo.name}</p>
            </div>
          )}
        </div>
        
        {maintenance.notes && (
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm">
              <span className="font-medium text-gray-700">Notas:</span> {maintenance.notes}
            </p>
          </div>
        )}
        
        {maintenance.issues && (
          <div className="bg-red-50 p-3 rounded-lg">
            <p className="text-sm">
              <span className="font-medium text-red-700">Problemas:</span> {maintenance.issues}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Tabs defaultValue="all" className="w-full h-full flex flex-col">
      <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
        <TabsTrigger value="all" className="flex items-center gap-2">
          <List className="h-4 w-4" />
          Todos ({maintenances.length})
        </TabsTrigger>
        <TabsTrigger value="pending" className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Pendientes ({pendingMaintenances.length})
        </TabsTrigger>
        <TabsTrigger value="completed" className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          Completados ({completedMaintenances.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="all" className="flex-1 overflow-hidden mt-4">
        {maintenances.length === 0 ? (
          <div className="text-center py-8">
            <Wrench className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No hay mantenimientos registrados para esta unidad móvil.</p>
          </div>
        ) : (
          <div className="h-full overflow-y-auto space-y-4 pr-2 max-h-[400px] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            {maintenances.map(renderMaintenanceCard)}
          </div>
        )}
      </TabsContent>

      <TabsContent value="pending" className="flex-1 overflow-hidden mt-4">
        {pendingMaintenances.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No hay mantenimientos pendientes.</p>
          </div>
        ) : (
          <div className="h-full overflow-y-auto space-y-4 pr-2 max-h-[400px] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            {pendingMaintenances.map(renderMaintenanceCard)}
          </div>
        )}
      </TabsContent>

      <TabsContent value="completed" className="flex-1 overflow-hidden mt-4">
        {completedMaintenances.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No hay mantenimientos completados.</p>
          </div>
        ) : (
          <div className="h-full overflow-y-auto space-y-4 pr-2 max-h-[400px] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            {completedMaintenances.map(renderMaintenanceCard)}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
