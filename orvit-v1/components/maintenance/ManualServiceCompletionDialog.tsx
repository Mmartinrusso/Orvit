'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calendar,
  Clock,
  User,
  Wrench,
  CheckCircle,
  Save,
  X,
  Search,
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Package,
  AlertCircle,
  Camera,
  Image as ImageIcon,
  Trash2,
  Users,
  Check,
  Filter,
} from 'lucide-react';
import { format, isToday, isPast, isFuture, differenceInDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ManualMaintenanceCompletionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: number;
  sectorId: number;
  onMaintenanceCompleted?: () => void;
}

interface PendingMaintenance {
  id: number;
  title: string;
  description?: string;
  equipment: {
    id: number;
    name: string;
    type: string;
  };
  assignedTo?: {
    id: number;
    name: string;
  };
  nextMaintenanceDate?: string;
  priority: string;
  status: string;
  type: string;
  estimatedDuration?: number;
  estimatedDurationUnit?: string;
}

interface SelectedMaintenance {
  id: number;
  maintenanceId: string;
  title: string;
  equipment: string;
  equipmentType: string;
  responsible: string;
  responsibleId: number;
  datePerformed: string;
  rescheduleDate: string;
  kilometers: string;
  actualDuration: string;
  notes: string;
  problems: string;
  estimatedDuration: number;
  estimatedDurationUnit: string;
  priority: string;
  dueDate?: string;
  photos: File[];
}

interface Employee {
  id: number;
  name: string;
}

type StatusFilter = 'all' | 'overdue' | 'today' | 'upcoming';
type MobileStep = 'select' | 'configure';

export default function ManualMaintenanceCompletionDialog({
  isOpen,
  onClose,
  companyId,
  sectorId,
  onMaintenanceCompleted
}: ManualMaintenanceCompletionDialogProps) {
  const { toast } = useToast();

  // Estados principales
  const [pendingMaintenances, setPendingMaintenances] = useState<PendingMaintenance[]>([]);
  const [selectedMaintenances, setSelectedMaintenances] = useState<SelectedMaintenance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Estados de filtros y búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Estado para asignación masiva
  const [bulkResponsible, setBulkResponsible] = useState<string>('');
  const [bulkDate, setBulkDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Estado para móvil (pasos)
  const [mobileStep, setMobileStep] = useState<MobileStep>('select');
  const [isMobile, setIsMobile] = useState(false);

  // Detectar móvil
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Cargar empleados
  useEffect(() => {
    if (isOpen && companyId) {
      fetchEmployees();
    }
  }, [isOpen, companyId]);

  const fetchEmployees = async () => {
    try {
      const response = await fetch(`/api/employees?companyId=${companyId}&status=ACTIVE`);
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.employees || data || []);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  // Cargar mantenimientos pendientes al abrir
  useEffect(() => {
    if (isOpen && companyId) {
      fetchPendingMaintenances();
    }
  }, [isOpen, companyId, sectorId]);

  const fetchPendingMaintenances = async () => {
    setDataLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: companyId.toString(),
        type: 'PREVENTIVE',
        status: 'PENDING'
      });
      if (sectorId) {
        params.append('sectorId', sectorId.toString());
      }

      const response = await fetch(`/api/maintenance/pending?${params}`);
      if (response.ok) {
        const data = await response.json();
        const maintenances = data.maintenances || data.data || [];
        setPendingMaintenances(Array.isArray(maintenances) ? maintenances : []);
      }
    } catch (error) {
      console.error('Error fetching pending maintenances:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los mantenimientos pendientes',
        variant: 'destructive'
      });
    } finally {
      setDataLoading(false);
    }
  };

  // Clasificar mantenimientos por estado
  const classifiedMaintenances = useMemo(() => {
    const now = new Date();

    return pendingMaintenances.map(m => {
      let status: 'overdue' | 'today' | 'upcoming' | 'no-date' = 'no-date';
      let daysUntil = 0;

      if (m.nextMaintenanceDate) {
        const dueDate = parseISO(m.nextMaintenanceDate);
        daysUntil = differenceInDays(dueDate, now);

        if (isPast(dueDate) && !isToday(dueDate)) {
          status = 'overdue';
        } else if (isToday(dueDate)) {
          status = 'today';
        } else {
          status = 'upcoming';
        }
      }

      return { ...m, dateStatus: status, daysUntil };
    });
  }, [pendingMaintenances]);

  // Filtrar mantenimientos
  const filteredMaintenances = useMemo(() => {
    let filtered = classifiedMaintenances;

    // Filtrar por búsqueda
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(m =>
        m.title?.toLowerCase().includes(search) ||
        m.equipment?.name?.toLowerCase().includes(search) ||
        m.id.toString().includes(search) ||
        m.assignedTo?.name?.toLowerCase().includes(search)
      );
    }

    // Filtrar por estado
    if (statusFilter !== 'all') {
      filtered = filtered.filter(m => m.dateStatus === statusFilter);
    }

    // Ordenar: vencidos primero, luego hoy, luego próximos
    return filtered.sort((a, b) => {
      const order = { overdue: 0, today: 1, upcoming: 2, 'no-date': 3 };
      if (order[a.dateStatus] !== order[b.dateStatus]) {
        return order[a.dateStatus] - order[b.dateStatus];
      }
      return a.daysUntil - b.daysUntil;
    });
  }, [classifiedMaintenances, searchTerm, statusFilter]);

  // Contadores por estado
  const statusCounts = useMemo(() => {
    return {
      all: classifiedMaintenances.length,
      overdue: classifiedMaintenances.filter(m => m.dateStatus === 'overdue').length,
      today: classifiedMaintenances.filter(m => m.dateStatus === 'today').length,
      upcoming: classifiedMaintenances.filter(m => m.dateStatus === 'upcoming').length
    };
  }, [classifiedMaintenances]);

  // Manejar selección de mantenimiento
  const handleToggleMaintenance = (maintenance: PendingMaintenance & { dateStatus: string }) => {
    const isSelected = selectedMaintenances.some(s => s.id === maintenance.id);

    if (isSelected) {
      setSelectedMaintenances(prev => prev.filter(s => s.id !== maintenance.id));
    } else {
      const newSelected: SelectedMaintenance = {
        id: maintenance.id,
        maintenanceId: maintenance.id.toString(),
        title: maintenance.title,
        equipment: maintenance.equipment?.name || 'Sin equipo',
        equipmentType: maintenance.equipment?.type || '',
        responsible: maintenance.assignedTo?.name || '',
        responsibleId: maintenance.assignedTo?.id || 0,
        datePerformed: format(new Date(), 'yyyy-MM-dd'),
        rescheduleDate: '',
        kilometers: '',
        actualDuration: '',
        notes: '',
        problems: '',
        estimatedDuration: maintenance.estimatedDuration || 0,
        estimatedDurationUnit: maintenance.estimatedDurationUnit || 'MINUTES',
        priority: maintenance.priority,
        dueDate: maintenance.nextMaintenanceDate,
        photos: []
      };
      setSelectedMaintenances(prev => [...prev, newSelected]);
    }
  };

  // Seleccionar todos los visibles
  const handleSelectAllVisible = () => {
    const visibleIds = filteredMaintenances.map(m => m.id);
    const allSelected = visibleIds.every(id => selectedMaintenances.some(s => s.id === id));

    if (allSelected) {
      setSelectedMaintenances(prev => prev.filter(s => !visibleIds.includes(s.id)));
    } else {
      const newSelections = filteredMaintenances
        .filter(m => !selectedMaintenances.some(s => s.id === m.id))
        .map(m => ({
          id: m.id,
          maintenanceId: m.id.toString(),
          title: m.title,
          equipment: m.equipment?.name || 'Sin equipo',
          equipmentType: m.equipment?.type || '',
          responsible: m.assignedTo?.name || '',
          responsibleId: m.assignedTo?.id || 0,
          datePerformed: format(new Date(), 'yyyy-MM-dd'),
          rescheduleDate: '',
          kilometers: '',
          actualDuration: '',
          notes: '',
          problems: '',
          estimatedDuration: m.estimatedDuration || 0,
          estimatedDurationUnit: m.estimatedDurationUnit || 'MINUTES',
          priority: m.priority,
          dueDate: m.nextMaintenanceDate,
          photos: []
        }));
      setSelectedMaintenances(prev => [...prev, ...newSelections]);
    }
  };

  // Aplicar responsable y fecha masivamente
  const handleApplyBulkSettings = () => {
    if (!bulkResponsible && !bulkDate) {
      toast({
        title: 'Error',
        description: 'Selecciona un responsable o fecha para aplicar',
        variant: 'destructive'
      });
      return;
    }

    const employee = employees.find(e => e.id.toString() === bulkResponsible);

    setSelectedMaintenances(prev =>
      prev.map(m => ({
        ...m,
        ...(bulkResponsible && employee ? { responsible: employee.name, responsibleId: employee.id } : {}),
        ...(bulkDate ? { datePerformed: bulkDate, rescheduleDate: '' } : {})
      }))
    );

    toast({
      title: 'Aplicado',
      description: `Configuración aplicada a ${selectedMaintenances.length} mantenimientos`
    });
  };

  // Actualizar campo de un mantenimiento seleccionado
  const updateSelectedMaintenance = (id: number, field: string, value: any) => {
    setSelectedMaintenances(prev =>
      prev.map(m => {
        if (m.id !== id) return m;

        // Si se llena datePerformed, limpiar rescheduleDate y viceversa
        if (field === 'datePerformed' && value) {
          return { ...m, datePerformed: value, rescheduleDate: '' };
        }
        if (field === 'rescheduleDate' && value) {
          return { ...m, rescheduleDate: value, datePerformed: '' };
        }

        return { ...m, [field]: value };
      })
    );
  };

  // Manejar fotos
  const handleAddPhoto = (id: number, files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newPhotos = Array.from(files);
    setSelectedMaintenances(prev =>
      prev.map(m => m.id === id ? { ...m, photos: [...m.photos, ...newPhotos] } : m)
    );
  };

  const handleRemovePhoto = (maintenanceId: number, photoIndex: number) => {
    setSelectedMaintenances(prev =>
      prev.map(m => {
        if (m.id !== maintenanceId) return m;
        const newPhotos = [...m.photos];
        newPhotos.splice(photoIndex, 1);
        return { ...m, photos: newPhotos };
      })
    );
  };

  // Remover de selección
  const handleRemoveSelected = (id: number) => {
    setSelectedMaintenances(prev => prev.filter(s => s.id !== id));
  };

  // Guardar todos los mantenimientos
  const handleSave = async () => {
    if (selectedMaintenances.length === 0) {
      toast({
        title: 'Error',
        description: 'No hay mantenimientos seleccionados',
        variant: 'destructive'
      });
      return;
    }

    // Validar que todos tengan fecha y responsable
    const invalid = selectedMaintenances.filter(m => !m.datePerformed && !m.rescheduleDate);
    if (invalid.length > 0) {
      toast({
        title: 'Error',
        description: `${invalid.length} mantenimientos sin fecha de realización o reprogramación`,
        variant: 'destructive'
      });
      return;
    }

    const noResponsible = selectedMaintenances.filter(m => !m.responsible);
    if (noResponsible.length > 0) {
      toast({
        title: 'Error',
        description: `${noResponsible.length} mantenimientos sin responsable asignado`,
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      const promises = selectedMaintenances.map(async maintenance => {
        // Si hay fotos, primero subirlas
        let photoUrls: string[] = [];
        if (maintenance.photos.length > 0) {
          // TODO: Implementar subida de fotos
          // Por ahora simplemente ignoramos las fotos
        }

        return fetch('/api/maintenance/manual-completion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            maintenanceId: maintenance.maintenanceId,
            companyId,
            sectorId,
            task: maintenance.title,
            datePerformed: maintenance.datePerformed,
            rescheduleDate: maintenance.rescheduleDate,
            kilometers: maintenance.kilometers,
            actualDuration: maintenance.actualDuration,
            notes: maintenance.notes,
            problems: maintenance.problems,
            responsible: maintenance.responsible,
            responsibleId: maintenance.responsibleId,
            equipment: maintenance.equipment,
            photoUrls
          })
        });
      });

      const results = await Promise.all(promises);
      const failed = results.filter(r => !r.ok);

      if (failed.length === 0) {
        toast({
          title: 'Mantenimientos guardados',
          description: `${selectedMaintenances.length} mantenimientos ejecutados correctamente`
        });
        setSelectedMaintenances([]);
        onMaintenanceCompleted?.();
        onClose();
      } else {
        toast({
          title: 'Error parcial',
          description: `${failed.length} mantenimientos no se pudieron guardar`,
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error saving:', error);
      toast({
        title: 'Error',
        description: 'Error al guardar los mantenimientos',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  // Obtener color según estado
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'overdue': return 'bg-red-100 text-red-700 border-red-200';
      case 'today': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'upcoming': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'overdue': return 'Vencido';
      case 'today': return 'Hoy';
      case 'upcoming': return 'Próximo';
      default: return 'Sin fecha';
    }
  };

  const handleClose = () => {
    setSelectedMaintenances([]);
    setSearchTerm('');
    setStatusFilter('all');
    setMobileStep('select');
    onClose();
  };

  // Panel de selección (izquierdo en desktop, paso 1 en móvil)
  const SelectionPanel = () => (
    <div className={cn(
      "flex flex-col min-h-0",
      !isMobile && "w-1/2 border-r",
      isMobile && mobileStep !== 'select' && "hidden"
    )}>
      {/* Header de búsqueda y filtros */}
      <div className="p-3 md:p-4 border-b bg-muted/30 flex-shrink-0 space-y-3">
        {/* Búsqueda */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar mantenimiento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* Filtros de estado - scroll horizontal en móvil */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
          {[
            { id: 'all', label: 'Todos', count: statusCounts.all, color: '' },
            { id: 'overdue', label: 'Vencidos', count: statusCounts.overdue, color: 'text-red-600' },
            { id: 'today', label: 'Hoy', count: statusCounts.today, color: 'text-amber-600' },
            { id: 'upcoming', label: 'Próximos', count: statusCounts.upcoming, color: 'text-green-600' }
          ].map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setStatusFilter(filter.id as StatusFilter)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap flex-shrink-0",
                statusFilter === filter.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80',
                filter.color && statusFilter !== filter.id && filter.color
              )}
            >
              {filter.label}
              <span className={cn(
                "px-1.5 py-0.5 rounded-full text-[10px]",
                statusFilter === filter.id ? 'bg-primary-foreground/20' : 'bg-background'
              )}>
                {filter.count}
              </span>
            </button>
          ))}
        </div>

        {/* Seleccionar todos */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {filteredMaintenances.length} mantenimientos
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSelectAllVisible}
            className="h-7 text-xs"
          >
            {filteredMaintenances.every(m => selectedMaintenances.some(s => s.id === m.id))
              ? 'Deseleccionar todos'
              : 'Seleccionar todos'}
          </Button>
        </div>
      </div>

      {/* Lista de mantenimientos */}
      <ScrollArea className="flex-1">
        {dataLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Cargando...</p>
            </div>
          </div>
        ) : filteredMaintenances.length === 0 ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-center p-4">
              <AlertCircle className="h-10 w-10 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {pendingMaintenances.length === 0
                  ? 'No hay mantenimientos pendientes'
                  : 'Sin resultados'}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-2 md:p-3 space-y-2">
            {filteredMaintenances.map((maintenance) => {
              const isSelected = selectedMaintenances.some(s => s.id === maintenance.id);
              return (
                <Card
                  key={maintenance.id}
                  className={cn(
                    'cursor-pointer transition-all active:scale-[0.98]',
                    isSelected
                      ? 'ring-2 ring-primary bg-primary/5'
                      : 'hover:bg-muted/50'
                  )}
                  onClick={() => handleToggleMaintenance(maintenance)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5",
                        isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                      )}>
                        {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="font-medium text-sm leading-tight">{maintenance.title}</h4>
                          <Badge
                            variant="outline"
                            className={cn("text-[10px] px-1.5 py-0 flex-shrink-0", getStatusColor(maintenance.dateStatus))}
                          >
                            {getStatusLabel(maintenance.dateStatus)}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Wrench className="h-3 w-3" />
                            {maintenance.equipment?.name || 'Sin equipo'}
                          </span>
                          {maintenance.assignedTo?.name && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {maintenance.assignedTo.name}
                            </span>
                          )}
                        </div>

                        {maintenance.nextMaintenanceDate && (
                          <div className="flex items-center gap-1 text-xs mt-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span className={cn(
                              maintenance.dateStatus === 'overdue' && 'text-red-600 font-medium',
                              maintenance.dateStatus === 'today' && 'text-amber-600 font-medium'
                            )}>
                              {format(parseISO(maintenance.nextMaintenanceDate), 'dd/MM/yyyy', { locale: es })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Footer móvil - Continuar */}
      {isMobile && selectedMaintenances.length > 0 && (
        <div className="border-t bg-muted/30 p-3 flex-shrink-0">
          <Button
            onClick={() => setMobileStep('configure')}
            className="w-full"
          >
            Continuar con {selectedMaintenances.length} seleccionados
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );

  // Panel de configuración (derecho en desktop, paso 2 en móvil)
  const ConfigurationPanel = () => (
    <div className={cn(
      "flex flex-col min-h-0",
      !isMobile && "w-1/2",
      isMobile && mobileStep !== 'configure' && "hidden"
    )}>
      {/* Header */}
      <div className="p-3 md:p-4 border-b bg-muted/30 flex-shrink-0">
        <div className="flex items-center gap-2 mb-3">
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={() => setMobileStep('select')} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex-1">
            <h3 className="font-semibold text-sm">Configurar ejecución</h3>
            <p className="text-xs text-muted-foreground">
              {selectedMaintenances.length} mantenimientos seleccionados
            </p>
          </div>
        </div>

        {/* Asignación masiva */}
        {selectedMaintenances.length > 1 && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-medium text-blue-700">Aplicar a todos</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select value={bulkResponsible} onValueChange={setBulkResponsible}>
                  <SelectTrigger className="h-8 text-xs bg-white">
                    <SelectValue placeholder="Responsable" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id.toString()}>
                        {emp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={bulkDate}
                  onChange={(e) => setBulkDate(e.target.value)}
                  className="h-8 text-xs bg-white"
                />
              </div>
              <Button
                size="sm"
                onClick={handleApplyBulkSettings}
                className="w-full mt-2 h-7 text-xs"
              >
                Aplicar
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Lista de mantenimientos a configurar */}
      <ScrollArea className="flex-1">
        {selectedMaintenances.length === 0 ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-center p-4">
              <ChevronRight className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Selecciona mantenimientos de la lista
              </p>
            </div>
          </div>
        ) : (
          <div className="p-2 md:p-3 space-y-3">
            {selectedMaintenances.map((maintenance) => (
              <Card key={maintenance.id} className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveSelected(maintenance.id)}
                  className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:text-destructive z-10"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>

                <CardContent className="p-3 pt-2">
                  {/* Título */}
                  <div className="mb-3 pr-6">
                    <h4 className="font-medium text-sm">{maintenance.title}</h4>
                    <p className="text-xs text-muted-foreground">{maintenance.equipment}</p>
                  </div>

                  {/* Responsable */}
                  <div className="mb-3">
                    <Label className="text-xs text-muted-foreground mb-1 block">Responsable *</Label>
                    <Select
                      value={maintenance.responsibleId?.toString() || ''}
                      onValueChange={(value) => {
                        const emp = employees.find(e => e.id.toString() === value);
                        if (emp) {
                          updateSelectedMaintenance(maintenance.id, 'responsibleId', emp.id);
                          updateSelectedMaintenance(maintenance.id, 'responsible', emp.name);
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Seleccionar responsable" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map(emp => (
                          <SelectItem key={emp.id} value={emp.id.toString()}>
                            {emp.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Fechas */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Fecha realizado</Label>
                      <Input
                        type="date"
                        value={maintenance.datePerformed}
                        onChange={(e) => updateSelectedMaintenance(maintenance.id, 'datePerformed', e.target.value)}
                        className="h-8 text-xs"
                        disabled={!!maintenance.rescheduleDate}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Reprogramar</Label>
                      <Input
                        type="date"
                        value={maintenance.rescheduleDate}
                        onChange={(e) => updateSelectedMaintenance(maintenance.id, 'rescheduleDate', e.target.value)}
                        className="h-8 text-xs"
                        disabled={!!maintenance.datePerformed}
                      />
                    </div>
                  </div>

                  {/* KM/Horas y Duración */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">KM/Horas</Label>
                      <Input
                        value={maintenance.kilometers}
                        onChange={(e) => updateSelectedMaintenance(maintenance.id, 'kilometers', e.target.value)}
                        placeholder="Opcional"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Duración (min)</Label>
                      <Input
                        value={maintenance.actualDuration}
                        onChange={(e) => updateSelectedMaintenance(maintenance.id, 'actualDuration', e.target.value)}
                        placeholder="Opcional"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  {/* Notas */}
                  <div className="mb-3">
                    <Label className="text-xs text-muted-foreground mb-1 block">Notas</Label>
                    <Textarea
                      value={maintenance.notes}
                      onChange={(e) => updateSelectedMaintenance(maintenance.id, 'notes', e.target.value)}
                      placeholder="Observaciones opcionales..."
                      className="text-xs min-h-[60px] resize-none"
                    />
                  </div>

                  {/* Fotos */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Fotos (opcional)</Label>
                    <div className="flex flex-wrap gap-2">
                      {maintenance.photos.map((photo, idx) => (
                        <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden bg-muted group">
                          <img
                            src={URL.createObjectURL(photo)}
                            alt={`Foto ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(maintenance.id, idx)}
                            className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-4 w-4 text-white" />
                          </button>
                        </div>
                      ))}
                      <label className="w-16 h-16 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors">
                        <Camera className="h-5 w-5 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">Agregar</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => handleAddPhoto(maintenance.id, e.target.files)}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer - Guardar */}
      <div className="border-t bg-muted/30 p-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          {isMobile && (
            <Button variant="outline" onClick={() => setMobileStep('select')} className="flex-shrink-0">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Volver
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={saving || selectedMaintenances.length === 0}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Aplicar ({selectedMaintenances.length})
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        size="xl"
        className={cn(
          "p-0 flex flex-col overflow-hidden gap-0",
          "max-h-[95dvh] h-[95dvh] md:h-auto md:max-h-[90dvh]"
        )}
      >
        {/* HEADER */}
        <DialogHeader className="px-4 md:px-6 py-3 md:py-4 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-2 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Ejecución masiva
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Seleccioná mantenimientos y configurá fecha, responsable y observaciones para cada uno.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* BODY - Desktop: 2 columnas, Mobile: pasos */}
        <div className="flex-1 overflow-hidden flex min-h-0">
          <SelectionPanel />
          {!isMobile && <ConfigurationPanel />}
          {isMobile && <ConfigurationPanel />}
        </div>

        {/* Desktop footer */}
        {!isMobile && (
          <div className="border-t bg-muted/30 px-4 py-3 flex-shrink-0">
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={handleClose} size="sm">
                Cancelar
              </Button>
              <div className="flex items-center gap-3">
                {selectedMaintenances.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {selectedMaintenances.length} seleccionados
                  </span>
                )}
                <Button
                  onClick={handleSave}
                  disabled={saving || selectedMaintenances.length === 0}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Aplicar
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
