'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  CheckCircle2, 
  Clock, 
  Wrench, 
  Users, 
  AlertCircle,
  PlayCircle,
  CheckSquare,
  Calendar,
  Settings,
  Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SmartChecklist {
  id: string;
  title: string;
  description: string;
  frequency: string;
  type: string;
  maintenances: any[];
  totalMaintenances: number;
  estimatedTotalTime: number;
  priorities: {
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
  machines: string[];
  assignees: string[];
}

interface SmartChecklistsPanelProps {
  companyId: number;
  sectorId?: number;
  machineId?: number;
  userId: number;
}

export default function SmartChecklistsPanel({
  companyId,
  sectorId,
  machineId,
  userId
}: SmartChecklistsPanelProps) {
  const [smartChecklists, setSmartChecklists] = useState<SmartChecklist[]>([]);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);
  const [selectedMaintenances, setSelectedMaintenances] = useState<{[key: string]: number[]}>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchSmartChecklists();
  }, [companyId, sectorId, machineId]);

  const fetchSmartChecklists = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: companyId.toString(),
        ...(sectorId && { sectorId: sectorId.toString() }),
        ...(machineId && { machineId: machineId.toString() })
      });

      const response = await fetch(`/api/maintenance/smart-checklists?${params}`);
      const data = await response.json();

      if (data.success) {
        setSmartChecklists(data.checklists);
        // Inicializar todas las selecciones
        const initialSelections: {[key: string]: number[]} = {};
        data.checklists.forEach((checklist: SmartChecklist) => {
          initialSelections[checklist.id] = checklist.maintenances.map(m => m.id);
        });
        setSelectedMaintenances(initialSelections);
      } else {
        throw new Error(data.error || 'Error fetching smart checklists');
      }
    } catch (error) {
      console.error('Error fetching smart checklists:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los checklists inteligentes",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const executeSmartChecklist = async (checklist: SmartChecklist) => {
    const selectedIds = selectedMaintenances[checklist.id] || [];
    const maintenancesToExecute = checklist.maintenances.filter(m => selectedIds.includes(m.id));
    
    if (maintenancesToExecute.length === 0) {
      toast({
        title: "Sin selección",
        description: "Selecciona al menos un mantenimiento para ejecutar",
        variant: "destructive"
      });
      return;
    }

    setExecuting(checklist.id);
    try {
      const response = await fetch('/api/maintenance/smart-checklists/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          checklistId: checklist.id,
          executedById: userId,
          maintenances: maintenancesToExecute
        })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Checklist Ejecutado",
          description: result.message,
          variant: "default"
        });
        
        // Recargar checklists
        await fetchSmartChecklists();
      } else {
        throw new Error(result.error || 'Error executing checklist');
      }
    } catch (error) {
      console.error('Error executing smart checklist:', error);
      toast({
        title: "Error",
        description: "No se pudo ejecutar el checklist",
        variant: "destructive"
      });
    } finally {
      setExecuting(null);
    }
  };

  const toggleMaintenanceSelection = (checklistId: string, maintenanceId: number) => {
    setSelectedMaintenances(prev => {
      const current = prev[checklistId] || [];
      const updated = current.includes(maintenanceId)
        ? current.filter(id => id !== maintenanceId)
        : [...current, maintenanceId];
      
      return {
        ...prev,
        [checklistId]: updated
      };
    });
  };

  const toggleAllMaintenances = (checklistId: string, allIds: number[]) => {
    setSelectedMaintenances(prev => {
      const current = prev[checklistId] || [];
      const allSelected = allIds.every(id => current.includes(id));
      
      return {
        ...prev,
        [checklistId]: allSelected ? [] : allIds
      };
    });
  };

  const getFrequencyIcon = (frequency: string) => {
    const icons = {
      'DAILY': <Calendar className="h-4 w-4" />,
      'WEEKLY': <Calendar className="h-4 w-4" />,
      'BIWEEKLY': <Calendar className="h-4 w-4" />,
      'MONTHLY': <Calendar className="h-4 w-4" />,
      'QUARTERLY': <Calendar className="h-4 w-4" />,
      'SEMIANNUAL': <Calendar className="h-4 w-4" />,
      'ANNUAL': <Calendar className="h-4 w-4" />,
      'CORRECTIVE': <Zap className="h-4 w-4" />
    };
    return icons[frequency] || <Settings className="h-4 w-4" />;
  };

  const getFrequencyColor = (frequency: string) => {
    const colors = {
      'CORRECTIVE': 'bg-red-100 text-red-800 border-red-300',
      'DAILY': 'bg-blue-100 text-blue-800 border-blue-300',
      'WEEKLY': 'bg-green-100 text-green-800 border-green-300',
      'BIWEEKLY': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'MONTHLY': 'bg-purple-100 text-purple-800 border-purple-300',
      'QUARTERLY': 'bg-indigo-100 text-indigo-800 border-indigo-300',
      'SEMIANNUAL': 'bg-pink-100 text-pink-800 border-pink-300',
      'ANNUAL': 'bg-gray-100 text-gray-800 border-gray-300'
    };
    return colors[frequency] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      'HIGH': 'bg-red-100 text-red-800',
      'MEDIUM': 'bg-yellow-100 text-yellow-800',
      'LOW': 'bg-green-100 text-green-800'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (smartChecklists.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <CheckSquare className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">
            No hay checklists disponibles
          </h3>
          <p className="text-gray-500">
            No se encontraron mantenimientos pendientes para generar checklists automáticos.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">
          Checklists Inteligentes
        </h2>
        <Button 
          onClick={fetchSmartChecklists}
          variant="outline"
          size="sm"
        >
          <Settings className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      <div className="grid gap-6">
        {smartChecklists.map((checklist) => {
          const selectedIds = selectedMaintenances[checklist.id] || [];
          const allIds = checklist.maintenances.map(m => m.id);
          const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.includes(id));
          const someSelected = selectedIds.length > 0 && selectedIds.length < allIds.length;

          return (
            <Card key={checklist.id} className="border-2">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getFrequencyIcon(checklist.frequency)}
                    <div>
                      <CardTitle className="text-lg">{checklist.title}</CardTitle>
                      <p className="text-sm text-gray-600">{checklist.description}</p>
                    </div>
                  </div>
                  <Badge className={getFrequencyColor(checklist.frequency)}>
                    {checklist.frequency}
                  </Badge>
                </div>

                {/* Resumen del checklist */}
                <div className="flex items-center space-x-6 text-sm text-gray-600">
                  <div className="flex items-center space-x-1">
                    <Wrench className="h-4 w-4" />
                    <span>{checklist.totalMaintenances} mantenimientos</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Clock className="h-4 w-4" />
                    <span>{checklist.estimatedTotalTime}h estimadas</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Users className="h-4 w-4" />
                    <span>{checklist.assignees.length} asignados</span>
                  </div>
                </div>

                {/* Prioridades */}
                <div className="flex items-center space-x-2">
                  {checklist.priorities.HIGH > 0 && (
                    <Badge className={getPriorityColor('HIGH')}>
                      {checklist.priorities.HIGH} Altas
                    </Badge>
                  )}
                  {checklist.priorities.MEDIUM > 0 && (
                    <Badge className={getPriorityColor('MEDIUM')}>
                      {checklist.priorities.MEDIUM} Medias
                    </Badge>
                  )}
                  {checklist.priorities.LOW > 0 && (
                    <Badge className={getPriorityColor('LOW')}>
                      {checklist.priorities.LOW} Bajas
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                {/* Control de selección masiva */}
                <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`select-all-${checklist.id}`}
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected;
                      }}
                      onCheckedChange={() => toggleAllMaintenances(checklist.id, allIds)}
                    />
                    <label 
                      htmlFor={`select-all-${checklist.id}`}
                      className="text-sm font-medium cursor-pointer"
                    >
                      Seleccionar todos ({selectedIds.length}/{allIds.length})
                    </label>
                  </div>
                  <Button
                    onClick={() => executeSmartChecklist(checklist)}
                    disabled={selectedIds.length === 0 || executing === checklist.id}
                    className="bg-green-600 hover:bg-green-700"
                    size="sm"
                  >
                    {executing === checklist.id ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Ejecutando...
                      </>
                    ) : (
                      <>
                        <PlayCircle className="h-4 w-4 mr-2" />
                        Ejecutar Seleccionados
                      </>
                    )}
                  </Button>
                </div>

                {/* Lista de mantenimientos */}
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {checklist.maintenances.map((maintenance, index) => (
                      <div key={maintenance.id}>
                        <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                          <Checkbox
                            id={`maintenance-${checklist.id}-${maintenance.id}`}
                            checked={selectedIds.includes(maintenance.id)}
                            onCheckedChange={() => 
                              toggleMaintenanceSelection(checklist.id, maintenance.id)
                            }
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-medium truncate">
                                {maintenance.title}
                              </h4>
                              <div className="flex items-center space-x-2">
                                <Badge className={getPriorityColor(maintenance.priority)} variant="outline">
                                  {maintenance.priority}
                                </Badge>
                                <Badge variant="outline">
                                  {maintenance.type}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                              <span>📍 {maintenance.machineName || 'Sin máquina'}</span>
                              <span>⏱️ {maintenance.estimatedHours || 1}h</span>
                              <span>👤 {maintenance.assignedToName || 'Sin asignar'}</span>
                            </div>
                          </div>
                        </div>
                        {index < checklist.maintenances.length - 1 && (
                          <Separator className="my-1" />
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
