'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  History,
  Calendar,
  User,
  Camera,
  MapPin,
  Wrench,
  CheckCircle,
  Clock,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface MachineHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  machineId: number;
  machineName: string;
  componentId?: number;
  componentName?: string;
}

interface HistoryRecord {
  id: string;
  title: string;
  type: string;
  date: string;
  machine: {
    id: number;
    name: string;
  };
  component?: {
    id: number;
    name: string;
  } | null;
  subcomponent?: {
    id: number;
    name: string;
  } | null;
  supervisor: {
    id: number;
    name: string;
  };
  toolsUsed: string[];
  detailedDescription: string;
  photoUrls: string[];
  sector: string;
  plantStopId: string;
  createdAt: string;
}

export default function MachineHistoryDialog({
  isOpen,
  onClose,
  machineId,
  machineName,
  componentId,
  componentName
}: MachineHistoryDialogProps) {
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, machineId, componentId]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const url = `/api/machines/${machineId}/history${componentId ? `?componentId=${componentId}` : ''}`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        setHistoryRecords(data.history || []);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'PLANT_RESUME':
        return 'bg-success-muted text-success';
      case 'MAINTENANCE':
        return 'bg-info-muted text-info-muted-foreground';
      case 'REPAIR':
        return 'bg-warning-muted text-warning-muted-foreground';
      default:
        return 'bg-muted text-foreground';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'PLANT_RESUME':
        return <CheckCircle className="h-4 w-4" />;
      case 'MAINTENANCE':
        return <Wrench className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es });
    } catch {
      return dateString;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'PLANT_RESUME':
        return 'Resumen de Parada';
      case 'MAINTENANCE':
        return 'Mantenimiento';
      case 'REPAIR':
        return 'Reparación';
      case 'INSPECTION':
        return 'Inspección';
      case 'CLEANING':
        return 'Limpieza';
      default:
        return type.replace('_', ' ');
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent size="full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-info" />
              Historial de Mantenimiento
            </DialogTitle>
            <div className="text-muted-foreground">
              <p className="font-semibold text-sm">{machineName}</p>
              {componentName && (
                <p className="text-xs">Componente: {componentName}</p>
              )}
            </div>
          </DialogHeader>

          <DialogBody>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Cargando historial...</span>
            </div>
          ) : historyRecords.length === 0 ? (
            <div className="text-center py-8">
              <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No hay registros de mantenimiento</p>
              <p className="text-sm text-muted-foreground mt-2">
                Los registros aparecerán aquí cuando se realicen trabajos de mantenimiento
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {historyRecords.map((record) => (
                <Card key={record.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {getTypeIcon(record.type)}
                          {record.title}
                        </CardTitle>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {formatDate(record.date)}
                          </div>
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            {record.supervisor.name}
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {record.sector}
                          </div>
                        </div>
                      </div>
                                    <Badge className={getTypeColor(record.type)}>
                {getTypeLabel(record.type)}
              </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-semibold text-sm mb-1">Descripción del Trabajo Realizado:</h4>
                        <p className="text-sm text-white">{record.detailedDescription}</p>
                      </div>

                      {record.toolsUsed && record.toolsUsed.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-sm mb-1">Herramientas Utilizadas del Pañol:</h4>
                          <div className="flex flex-wrap gap-2">
                            {record.toolsUsed.map((tool, index) => (
                              <Badge key={index} variant="outline" className="bg-info-muted text-info-muted-foreground border-info-muted">
                                {tool}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {(record.component || record.subcomponent) && (
                        <div>
                          <h4 className="font-semibold text-sm mb-1">Componentes Trabajados:</h4>
                          <div className="flex flex-wrap gap-2">
                            {record.component && (
                              <Badge variant="outline">{record.component.name}</Badge>
                            )}
                            {record.subcomponent && (
                              <Badge variant="outline">{record.subcomponent.name}</Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {record.photoUrls.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                            <Camera className="h-4 w-4" />
                            Fotos del Trabajo ({record.photoUrls.length})
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {record.photoUrls.map((url, index) => (
                              <div key={index} className="relative group">
                                <img
                                  src={url}
                                  alt={`Foto ${index + 1}`}
                                  className="w-full h-20 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => window.open(url, '_blank')}
                                />
                                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded-lg transition-all flex items-center justify-center">
                                  <ExternalLink className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={onClose}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 