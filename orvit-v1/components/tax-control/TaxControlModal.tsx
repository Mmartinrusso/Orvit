'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Edit, Trash2, CheckCircle, AlertTriangle, Clock, DollarSign, User, Calendar, X, FileText, CalendarDays, BarChart3, ChevronLeft, ChevronRight, Bell } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTaxBases, useTaxRecords, useTaxAlerts, useCreateTaxBase, useUpsertTaxRecord, useUpdateTaxRecordStatus, useDeleteTaxRecord, useDeleteTaxBase } from '@/hooks/use-tax-control';

interface TaxBase {
  id: number;
  name: string;
  description?: string;
  isRecurring: boolean;
  recurringDay: number;
  companyId: number;
  createdBy: number;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdByUser: {
    id: number;
    name: string;
    email: string;
  };
  taxRecords: TaxRecord[];
}

interface TaxRecord {
  id: number;
  taxBaseId: number;
  amount: number;
  status: 'RECIBIDO' | 'PAGADO' | 'PENDIENTE' | 'VENCIDO';
  receivedDate?: string;
  paymentDate?: string;
  alertDate: string;
  month: string;
  receivedBy?: number;
  paidBy?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  taxBase: {
    id: number;
    name: string;
    description?: string;
    recurringDay: number;
    isRecurring: boolean;
  };
  receivedByUser?: {
    id: number;
    name: string;
    email: string;
  };
  paidByUser?: {
    id: number;
    name: string;
    email: string;
  };
}

interface TaxControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  openCreateBaseDialog?: boolean; // Nueva prop para abrir el diálogo de crear planilla automáticamente
}

export default function TaxControlModal({ isOpen, onClose, openCreateBaseDialog = false }: TaxControlModalProps) {
  const { currentCompany } = useCompany();
  const { hasPermission } = useAuth();
  
  // Verificar permisos
  const canManageControls = hasPermission('controles.manage');
  const canCreateRecords = hasPermission('controles.create_records');
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateBaseDialogOpen, setIsCreateBaseDialogOpen] = useState(false);
  const [isCreateRecordDialogOpen, setIsCreateRecordDialogOpen] = useState(false);
  const [editingTaxRecord, setEditingTaxRecord] = useState<TaxRecord | null>(null);
  const [activeTab, setActiveTab] = useState('bases');
  
  // ✨ FIX: Migrar a React Query hooks
  const enabled = isOpen && !!currentCompany;
  const { data: taxBasesData, isLoading: basesLoading } = useTaxBases(currentCompany?.id, enabled);
  const { data: taxRecordsData, isLoading: recordsLoading } = useTaxRecords(
    currentCompany?.id,
    selectedMonth,
    statusFilter === 'all' ? undefined : statusFilter,
    enabled
  );
  const { data: alertsData, isLoading: alertsLoading } = useTaxAlerts(currentCompany?.id, enabled);
  const createBaseMutation = useCreateTaxBase();
  const upsertRecordMutation = useUpsertTaxRecord();
  const updateStatusMutation = useUpdateTaxRecordStatus();
  const deleteRecordMutation = useDeleteTaxRecord();
  const deleteBaseMutation = useDeleteTaxBase();
  
  const taxBases = taxBasesData || [];
  const taxRecords = taxRecordsData || [];
  const alerts = alertsData?.alerts || [];
  const loading = basesLoading || recordsLoading;
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarFilters, setCalendarFilters] = useState({
    received: true,
    paid: true,
    due: true
  });

  // Funciones para convertir entre formatos de fecha
  const formatDateForDisplay = (dateStr: string) => {
    if (!dateStr || dateStr === 'undefined') return '';
    // Si ya está en formato DD/MM/YYYY, devolverlo tal como está
    if (dateStr.includes('/') && dateStr.length === 10) return dateStr;
    // Convierte de YYYY-MM-DD a DD/MM/YYYY
    if (dateStr.includes('-') && dateStr.length === 10) {
      const [year, month, day] = dateStr.split('-');
      if (year && month && day) {
        return `${day}/${month}/${year}`;
      }
    }
    return '';
  };

  const formatDateForAPI = (dateStr: string) => {
    if (!dateStr || dateStr === 'undefined') return '';
    // Si ya está en formato YYYY-MM-DD, devolverlo tal como está
    if (dateStr.includes('-') && dateStr.length === 10) return dateStr;
    // Convierte de DD/MM/YYYY a YYYY-MM-DD
    if (dateStr.includes('/') && dateStr.length === 10) {
      const [day, month, year] = dateStr.split('/');
      if (day && month && year) {
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }
    return '';
  };

  // Form states for creating tax base
  const [baseFormData, setBaseFormData] = useState({
    name: '',
    description: '',
    recurringDay: 5,
    notes: ''
  });

  // Form states for creating tax record
  const [recordFormData, setRecordFormData] = useState({
    taxBaseId: '',
    amount: '',
    notes: '',
    month: '',
    dueDate: ''
  });

  const statusColors = {
    RECIBIDO: 'bg-blue-100 text-blue-800',
    PAGADO: 'bg-green-100 text-green-800',
    PENDIENTE: 'bg-yellow-100 text-yellow-800',
    VENCIDO: 'bg-red-100 text-red-800'
  };

  const statusIcons = {
    RECIBIDO: Clock,
    PAGADO: CheckCircle,
    PENDIENTE: AlertTriangle,
    VENCIDO: AlertTriangle
  };

  // ✨ FIX: React Query maneja automáticamente el refetch cuando cambian las dependencias
  // No necesitamos useEffect para fetch manual

  // Abrir el diálogo de crear planilla automáticamente si se solicita
  useEffect(() => {
    if (isOpen && openCreateBaseDialog) {
      setIsCreateBaseDialogOpen(true);
      setActiveTab('bases'); // Cambiar a la pestaña de bases
    }
  }, [isOpen, openCreateBaseDialog]);

  // ✨ FIX: Eliminados fetchTaxBases, fetchTaxRecords, fetchAlerts
  // Ahora se usan hooks React Query que manejan cache y deduplicación automáticamente

  // ✨ FIX: Migrado a React Query mutation
  const handleCreateBase = async () => {
    if (!currentCompany) return;
    
    // Validaciones
    if (!baseFormData.name || baseFormData.name.trim() === '') {
      alert('Por favor ingresa el nombre del impuesto');
      return;
    }
    
    if (!baseFormData.recurringDay || baseFormData.recurringDay < 1 || baseFormData.recurringDay > 31) {
      alert('Por favor selecciona un día válido del mes (1-31)');
      return;
    }
    
    try {
      const newBase = await createBaseMutation.mutateAsync({
        name: baseFormData.name.trim(),
        description: baseFormData.description,
        recurringDay: baseFormData.recurringDay,
        companyId: currentCompany.id,
        notes: baseFormData.notes,
      });
      
      setBaseFormData({
        name: '',
        description: '',
        recurringDay: 5,
        notes: ''
      });
      setIsCreateBaseDialogOpen(false);
      alert(`✅ Planilla "${newBase.name}" creada exitosamente`);
    } catch (error: any) {
      console.error('Error creating tax base:', error);
      alert(`❌ Error al crear la planilla: ${error.message || 'Error desconocido'}`);
    }
  };

  // ✨ FIX: Migrado a React Query mutation
  const handleCreateRecord = async () => {
    if (!currentCompany) return;
    
    try {
      if (editingTaxRecord) {
        // Actualizar registro existente - usar mutation separada si existe, sino fetch directo por ahora
        const response = await fetch(`/api/tax-record/${editingTaxRecord.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: recordFormData.amount,
            notes: recordFormData.notes,
            alertDate: formatDateForAPI(recordFormData.dueDate) || editingTaxRecord.alertDate
          }),
        });
        
        if (response.ok) {
          // React Query invalida automáticamente
          setRecordFormData({
            taxBaseId: '',
            amount: '',
            notes: '',
            month: '',
            dueDate: ''
          });
          setEditingTaxRecord(null);
          setIsCreateRecordDialogOpen(false);
        }
      } else {
        // Crear nuevo registro
        const recordMonth = recordFormData.month || selectedMonth;
        await upsertRecordMutation.mutateAsync({
          taxBaseId: parseInt(recordFormData.taxBaseId),
          amount: parseFloat(recordFormData.amount),
          month: recordMonth,
          notes: recordFormData.notes,
          alertDate: formatDateForAPI(recordFormData.dueDate) || new Date().toISOString(),
          companyId: currentCompany.id,
        });
        
        // Cambiar el filtro al mes del registro creado
        setSelectedMonth(recordMonth);
        setRecordFormData({
          taxBaseId: '',
          amount: '',
          notes: '',
          month: '',
          dueDate: ''
        });
        setEditingTaxRecord(null);
        setIsCreateRecordDialogOpen(false);
      }
    } catch (error: any) {
      console.error('Error creating/updating tax record:', error);
      alert(error.message || 'Error al crear/actualizar registro');
    }
  };

  // ✨ FIX: Migrado a React Query mutation
  const handleUpdateStatus = async (id: number, status: string) => {
    if (!currentCompany) return;
    
    try {
      await updateStatusMutation.mutateAsync({ 
        id, 
        status, 
        companyId: currentCompany.id,
        month: selectedMonth 
      });
    } catch (error: any) {
      console.error('Error updating status:', error);
      alert(error.message || 'Error al actualizar estado');
    }
  };

  // ✨ FIX: Migrado a React Query mutation
  const handleDelete = async (id: number) => {
    if (!currentCompany) return;
    
    if (confirm('¿Estás seguro de que quieres eliminar este registro?')) {
      try {
        await deleteRecordMutation.mutateAsync({ 
          id, 
          companyId: currentCompany.id,
          month: selectedMonth 
        });
      } catch (error: any) {
        console.error('Error deleting tax record:', error);
        alert(error.message || 'Error al eliminar registro');
      }
    }
  };

  // ✨ FIX: Migrado a React Query mutation
  const handleDeleteBase = async (id: number, name: string) => {
    if (!currentCompany) return;
    
    const recordsCount = taxRecords.filter(record => record.taxBaseId === id).length;
    const confirmMessage = recordsCount > 0 
      ? `¿Estás seguro de que quieres eliminar la base "${name}"?\n\nSe eliminarán también ${recordsCount} registro${recordsCount !== 1 ? 's' : ''} asociado${recordsCount !== 1 ? 's' : ''}.\n\nEsta acción no se puede deshacer.`
      : `¿Estás seguro de que quieres eliminar la base "${name}"?\n\nEsta acción no se puede deshacer.`;
    
    if (confirm(confirmMessage)) {
      try {
        await deleteBaseMutation.mutateAsync({ id, companyId: currentCompany.id });
      } catch (error: any) {
        console.error('Error deleting tax base:', error);
        alert(error.message || 'Error al eliminar la base de impuesto');
      }
    }
  };

  // ✨ FIX: Migrado a React Query mutation
  const handleMarkAsPaid = async (recordId: number) => {
    if (!currentCompany) return;
    
    try {
      await updateStatusMutation.mutateAsync({ 
        id: recordId, 
        status: 'PAGADO', 
        companyId: currentCompany.id,
        month: selectedMonth 
      });
      alert('Impuesto marcado como pagado exitosamente');
    } catch (error: any) {
      console.error('Error marking as paid:', error);
      alert(error.message || 'Error al marcar como pagado');
    }
  };

  const generateMonthlyRecords = async () => {
    if (!currentCompany) return;
    try {
      const response = await fetch('/api/tax-record/generate-monthly', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          companyId: currentCompany.id,
          month: selectedMonth
        }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Se generaron ${result.totalCreated} registros mensuales para ${selectedMonth}`);
        fetchTaxRecords();
      }
    } catch (error) {
      console.error('Error generating monthly records:', error);
    }
  };

  const getTotalAmount = () => {
    return taxRecords.reduce((sum, record) => sum + record.amount, 0);
  };

  const getTotalByStatus = (status: string) => {
    return taxRecords
      .filter(record => record.status === status)
      .reduce((sum, record) => sum + record.amount, 0);
  };

  // Funciones para el calendario

  // Funciones para el resumen mensual
  const getMonthlySummary = () => {
    const summary = taxBases.map(base => {
      const record = taxRecords.find(r => r.taxBaseId === base.id);
      
      if (!record) {
        return {
          base,
          status: 'no-record' as const,
          amount: 0,
          receivedDate: null,
          paymentDate: null,
          dueDate: null
        };
      }

      return {
        base,
        status: record.status,
        amount: record.amount,
        receivedDate: record.receivedDate,
        paymentDate: record.paymentDate,
        dueDate: record.alertDate,
        record
      };
    });

    return summary;
  };


  const getSummaryStats = () => {
    const summary = getMonthlySummary();
    return {
      total: summary.length,
      completed: summary.filter(s => s.status === 'PAGADO').length,
      pending: summary.filter(s => s.status === 'RECIBIDO').length,
      overdue: summary.filter(s => s.status === 'VENCIDO').length,
      noRecord: summary.filter(s => s.status === 'no-record').length
    };
  };

  // Funciones para el calendario
  const getCalendarEvents = () => {
    const events: Array<{ date: Date; type: 'received' | 'paid' | 'due'; record: TaxRecord }> = [];
    
    taxRecords.forEach(record => {
      // Fecha de vencimiento
      if (calendarFilters.due) {
        events.push({
          date: new Date(record.alertDate),
          type: 'due',
          record
        });
      }
      
      // Fecha de recepción
      if (record.receivedDate && calendarFilters.received) {
        events.push({
          date: new Date(record.receivedDate),
          type: 'received',
          record
        });
      }
      
      // Fecha de pago
      if (record.paymentDate && calendarFilters.paid) {
        events.push({
          date: new Date(record.paymentDate),
          type: 'paid',
          record
        });
      }
    });
    
    return events;
  };

  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return getCalendarEvents().filter(event => {
      const eventDateStr = event.date.toISOString().split('T')[0];
      return eventDateStr === dateStr;
    });
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  if (!currentCompany) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="full">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 bg-primary/10 rounded-lg">
              <DollarSign className="h-6 w-6 text-primary" />
            </div>
            <div>
              <span>Planilla de Control de Impuestos</span>
              <p className="text-sm font-normal text-muted-foreground mt-1">
                Gestión mensual de impuestos y obligaciones fiscales
              </p>
            </div>
          </DialogTitle>
          <DialogDescription>
            Sistema de control y gestión de impuestos mensuales con alertas automáticas y seguimiento de pagos.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-6">
          {/* Botones de Acción */}
          <Card className="p-4">
            <div className="flex justify-end gap-2">
              {canCreateRecords && (
                <Button 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsCreateRecordDialogOpen(true);
                  }} 
                  size="sm" 
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ingreso de Impuesto
                </Button>
              )}
              {canManageControls && (
                <Button 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsCreateBaseDialogOpen(true);
                  }} 
                  variant="outline" 
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva Base
                </Button>
              )}
            </div>
          </Card>

          {/* Sistema de Pestañas */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="bases" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Impuestos
              </TabsTrigger>
              <TabsTrigger value="control" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Control
              </TabsTrigger>
              <TabsTrigger value="calendar" className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Calendario
              </TabsTrigger>
              <TabsTrigger value="alerts" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Alertas
              </TabsTrigger>
            </TabsList>

            {/* Pestaña 1: Impuestos */}
            <TabsContent value="bases" className="space-y-4">
              {/* Resumen */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total General</CardTitle>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <DollarSign className="h-4 w-4 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{taxBases.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {taxBases.length} base{taxBases.length !== 1 ? 's' : ''} de impuesto{taxBases.length !== 1 ? 's' : ''}
                </p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-yellow-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Activas</CardTitle>
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Clock className="h-4 w-4 text-yellow-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{taxBases.filter(base => base.isActive).length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Bases activas
                </p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Recurrentes</CardTitle>
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{taxBases.filter(base => base.isRecurring).length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Bases recurrentes
                </p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-red-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Inactivas</CardTitle>
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{taxBases.filter(base => !base.isActive).length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Bases inactivas
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Lista de Bases de Impuestos */}
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Bases de Impuestos
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {loading ? 'Cargando...' : `${taxBases.length} base${taxBases.length !== 1 ? 's' : ''} de impuesto${taxBases.length !== 1 ? 's' : ''} configurada${taxBases.length !== 1 ? 's' : ''}`}
                  </CardDescription>
                </div>
                {taxBases.length > 0 && !loading && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {taxBases.filter(base => base.isActive).length} activas
                    </Badge>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p>Cargando impuestos...</p>
                  </div>
                </div>
              ) : taxBases.length === 0 ? (
                <div className="text-center py-12">
                  <div className="mx-auto w-24 h-24 bg-muted/20 rounded-full flex items-center justify-center mb-6">
                    <DollarSign className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No hay bases de impuestos</h3>
                  <p className="text-muted-foreground mb-2">No se encontraron bases de impuestos configuradas</p>
                  <p className="text-sm text-muted-foreground mb-6">
                    Crea tu primera base de impuesto para comenzar
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button 
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsCreateBaseDialogOpen(true);
                      }} 
                      className="min-w-[160px]"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Crear primera base
                    </Button>
                    <Button 
                      onClick={generateMonthlyRecords} 
                      variant="outline"
                      className="min-w-[160px]"
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Generar registros
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 p-6">
                  {taxBases.map((base) => {
                    const isRecurring = base.isRecurring;
                    const isActive = base.isActive;
                    
                    // Buscar si ya existe un registro para el mes seleccionado
                    const existingRecord = taxRecords.find(record => 
                      record.taxBaseId === base.id && record.month === selectedMonth
                    );
                    
                    return (
                      <div
                        key={base.id}
                        className={cn(
                          "flex items-center justify-between p-6 border rounded-xl hover:shadow-md transition-all duration-200",
                          !isActive && "opacity-60 border-gray-200"
                        )}
                      >
                        <div className="flex items-center space-x-4">
                          <div className={cn(
                            "p-3 rounded-xl",
                            isActive && isRecurring && "bg-green-100",
                            isActive && !isRecurring && "bg-blue-100",
                            !isActive && "bg-gray-100"
                          )}>
                            {isRecurring ? (
                              <Calendar className={cn(
                                "h-5 w-5",
                                isActive && "text-green-600",
                                !isActive && "text-gray-600"
                              )} />
                            ) : (
                              <FileText className={cn(
                                "h-5 w-5",
                                isActive && "text-blue-600",
                                !isActive && "text-gray-600"
                              )} />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold text-lg">{base.name}</h3>
                              {isRecurring && (
                                <Badge variant="outline" className="text-xs">
                                  <Calendar className="h-3 w-3 mr-1" />
                                  Recurrente
                                </Badge>
                              )}
                              {!isActive && (
                                <Badge variant="secondary" className="text-xs">
                                  Inactiva
                                </Badge>
                              )}
                              {existingRecord && (
                                <Badge 
                                  variant={existingRecord.status === 'PAGADO' ? 'default' : 
                                          existingRecord.status === 'RECIBIDO' ? 'secondary' : 'destructive'}
                                  className="text-xs"
                                >
                                  {existingRecord.status}
                                </Badge>
                              )}
                            </div>
                            
                            {base.description && (
                              <p className="text-sm text-muted-foreground mb-2">{base.description}</p>
                            )}
                            
                            {existingRecord && (
                              <div className="bg-muted/30 rounded-lg p-3 mb-3">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <span className="font-medium text-muted-foreground">Monto:</span>
                                    <p className="text-lg font-semibold">${existingRecord.amount.toLocaleString()}</p>
                                  </div>
                                  <div>
                                    <span className="font-medium text-muted-foreground">Vencimiento:</span>
                                    <p className="text-sm">{new Date(existingRecord.alertDate).toLocaleDateString('es-AR')}</p>
                                  </div>
                                  {existingRecord.receivedDate && (
                                    <div>
                                      <span className="font-medium text-muted-foreground">Recibido:</span>
                                      <p className="text-sm">{new Date(existingRecord.receivedDate).toLocaleDateString('es-AR')}</p>
                                    </div>
                                  )}
                                  {existingRecord.paymentDate && (
                                    <div>
                                      <span className="font-medium text-muted-foreground">Pagado:</span>
                                      <p className="text-sm">{new Date(existingRecord.paymentDate).toLocaleDateString('es-AR')}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <User className="h-4 w-4" />
                                <span>Creado por {base.createdByUser.name}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                <span>Creado: {new Date(base.createdAt).toLocaleDateString('es-AR')}</span>
                              </div>
                              {isRecurring && base.recurringDay && (
                                <div className="flex items-center gap-1">
                                  <AlertTriangle className="h-4 w-4" />
                                  <span>Día {base.recurringDay} de cada mes</span>
                                </div>
                              )}
                            </div>
                            
                            {base.notes && (
                              <p className="text-sm text-muted-foreground mt-2 italic">&quot;{base.notes}&quot;</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end space-y-3">
                          <div className="text-right">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge 
                                className={cn(
                                  isActive && "bg-green-100 text-green-800",
                                  !isActive && "bg-gray-100 text-gray-800"
                                )}
                              >
                                {isActive ? 'Activa' : 'Inactiva'}
                              </Badge>
                              {isRecurring && (
                                <Badge variant="outline" className="text-xs">
                                  Recurrente
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex space-x-2">
                            {!existingRecord ? (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setRecordFormData(prev => ({
                                    ...prev,
                                    taxBaseId: base.id.toString(),
                                    month: selectedMonth
                                  }));
                                  setIsCreateRecordDialogOpen(true);
                                }}
                                disabled={!isActive}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Crear Registro
                              </Button>
                            ) : (
                              <div className="flex gap-2">
                                {existingRecord.status === 'RECIBIDO' && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleMarkAsPaid(existingRecord.id)}
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                  >
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Marcar Pagado
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingTaxRecord(existingRecord);
                                    setRecordFormData({
                                      taxBaseId: base.id.toString(),
                                      amount: existingRecord.amount.toString(),
                                      notes: existingRecord.notes || '',
                                      month: existingRecord.month,
                                      dueDate: formatDateForDisplay(existingRecord.alertDate)
                                    });
                                    setIsCreateRecordDialogOpen(true);
                                  }}
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  Editar
                                </Button>
                              </div>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                // TODO: Implementar edición de base
                              }}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteBase(base.id, base.name)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
            </TabsContent>

            {/* Pestaña 2: Control */}
            <TabsContent value="control" className="space-y-4">
              {/* Filtros y Navegación de Mes */}
              <Card className="p-4">
                <div className="flex flex-col lg:flex-row gap-4 items-center">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="month" className="text-sm font-medium">Período</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const [year, month] = selectedMonth.split('-');
                            const prevMonth = parseInt(month) === 1 ? 12 : parseInt(month) - 1;
                            const prevYear = parseInt(month) === 1 ? parseInt(year) - 1 : parseInt(year);
                            setSelectedMonth(`${prevYear}-${prevMonth.toString().padStart(2, '0')}`);
                          }}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(() => {
                              const currentYear = new Date().getFullYear();
                              const months = [];
                              for (let year = currentYear - 1; year <= currentYear + 1; year++) {
                                for (let month = 1; month <= 12; month++) {
                                  const monthStr = `${year}-${month.toString().padStart(2, '0')}`;
                                  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                                                    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                                  months.push(
                                    <SelectItem key={monthStr} value={monthStr}>
                                      {monthNames[month - 1]} {year}
                                    </SelectItem>
                                  );
                                }
                              }
                              return months;
                            })()}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const [year, month] = selectedMonth.split('-');
                            const nextMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1;
                            const nextYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year);
                            setSelectedMonth(`${nextYear}-${nextMonth.toString().padStart(2, '0')}`);
                          }}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedMonth(new Date().toISOString().slice(0, 7))}
                        >
                          Hoy
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="status" className="text-sm font-medium">Estado</Label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Filtrar por estado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos los estados</SelectItem>
                          <SelectItem value="RECIBIDO">Recibido</SelectItem>
                          <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                          <SelectItem value="PAGADO">Pagado</SelectItem>
                          <SelectItem value="VENCIDO">Vencido</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {(() => {
                      const [year, month] = selectedMonth.split('-');
                      const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                                        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
                      return `${monthNames[parseInt(month) - 1]} de ${year}`;
                    })()}
                  </div>
                </div>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <BarChart3 className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Control de Impuestos</CardTitle>
                      <CardDescription>
                        Vista general de todos los estados de impuestos para {(() => {
                          const [year, month] = selectedMonth.split('-');
                          const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                                            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
                          return `${monthNames[parseInt(month) - 1]} de ${year}`;
                        })()}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Resumen de Estados */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <Card className="border-l-4 border-l-gray-500">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Pendientes</CardTitle>
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <Clock className="h-4 w-4 text-gray-600" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-gray-600">
                          {taxBases.filter(base => {
                            const record = taxRecords.find(r => r.taxBaseId === base.id && r.month === selectedMonth);
                            return !record;
                          }).length}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Sin ingresar</p>
                      </CardContent>
                    </Card>
                    <Card className="border-l-4 border-l-blue-500">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Recibidos</CardTitle>
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <CheckCircle className="h-4 w-4 text-blue-600" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-blue-600">
                          {taxRecords.filter(record => record.status === 'RECIBIDO' && (statusFilter === 'all' || statusFilter === 'RECIBIDO')).length}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Pendientes de pago</p>
                      </CardContent>
                    </Card>
                    <Card className="border-l-4 border-l-green-500">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Pagados</CardTitle>
                        <div className="p-2 bg-green-100 rounded-lg">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                          {taxRecords.filter(record => record.status === 'PAGADO' && (statusFilter === 'all' || statusFilter === 'PAGADO')).length}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Completados</p>
                      </CardContent>
                    </Card>
                    <Card className="border-l-4 border-l-red-500">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Vencidos</CardTitle>
                        <div className="p-2 bg-red-100 rounded-lg">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                          {taxRecords.filter(record => record.status === 'VENCIDO' && (statusFilter === 'all' || statusFilter === 'VENCIDO')).length}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Requieren atención</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Secciones por Estado */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Pendientes */}
                    <Card>
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <Clock className="h-5 w-5 text-gray-600" />
                          <CardTitle className="text-base">Pendientes</CardTitle>
                          <Badge variant="outline" className="text-xs">
                            {taxBases.filter(base => {
                              const record = taxRecords.find(r => r.taxBaseId === base.id && r.month === selectedMonth);
                              return !record;
                            }).length}
                          </Badge>
                        </div>
                        <CardDescription>
                          Impuestos que no han sido ingresados
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {taxBases.filter(base => {
                            const record = taxRecords.find(r => r.taxBaseId === base.id && r.month === selectedMonth);
                            return !record;
                          }).map((base) => (
                            <div key={base.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
                              <div className="flex items-center space-x-3">
                                <div className="p-2 bg-gray-100 rounded-lg">
                                  <Clock className="h-4 w-4 text-gray-600" />
                                </div>
                                <div>
                                  <h4 className="font-medium">{base.name}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    Día {base.recurringDay} de cada mes
                                  </p>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => {
                                  setRecordFormData({
                                    taxBaseId: base.id.toString(),
                                    amount: '',
                                    notes: '',
                                    month: selectedMonth,
                                    dueDate: ''
                                  });
                                  setIsCreateRecordDialogOpen(true);
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Ingresar
                              </Button>
                            </div>
                          ))}
                          {taxBases.filter(base => {
                            const record = taxRecords.find(r => r.taxBaseId === base.id && r.month === selectedMonth);
                            return !record;
                          }).length === 0 && (
                            <div className="text-center py-6 text-muted-foreground">
                              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                              <p className="text-sm">Todos los impuestos han sido ingresados</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Recibidos */}
                    <Card>
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-blue-600" />
                          <CardTitle className="text-base">Recibidos</CardTitle>
                          <Badge variant="outline" className="text-xs">
                            {taxRecords.filter(record => record.status === 'RECIBIDO' && (statusFilter === 'all' || statusFilter === 'RECIBIDO')).length}
                          </Badge>
                        </div>
                        <CardDescription>
                          Impuestos recibidos, pendientes de pago
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {taxRecords.filter(record => record.status === 'RECIBIDO' && (statusFilter === 'all' || statusFilter === 'RECIBIDO')).map((record) => (
                            <div key={record.id} className="flex items-center justify-between p-3 border border-blue-200 rounded-lg hover:shadow-sm transition-shadow bg-blue-50/30">
                              <div className="flex items-center space-x-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                  <CheckCircle className="h-4 w-4 text-blue-600" />
                                </div>
                                <div>
                                  <h4 className="font-medium">{record.taxBase.name}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    ${record.amount.toLocaleString()} - {record.month}
                                  </p>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => handleMarkAsPaid(record.id)}
                                className="bg-green-600 hover:bg-green-700 text-white"
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Marcar Pagado
                              </Button>
                            </div>
                          ))}
                          {taxRecords.filter(record => record.status === 'RECIBIDO' && (statusFilter === 'all' || statusFilter === 'RECIBIDO')).length === 0 && (
                            <div className="text-center py-6 text-muted-foreground">
                              <Clock className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                              <p className="text-sm">No hay impuestos recibidos</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Pagados */}
                    <Card>
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <CardTitle className="text-base">Pagados</CardTitle>
                          <Badge variant="outline" className="text-xs">
                            {taxRecords.filter(record => record.status === 'PAGADO' && (statusFilter === 'all' || statusFilter === 'PAGADO')).length}
                          </Badge>
                        </div>
                        <CardDescription>
                          Impuestos completamente pagados
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {taxRecords.filter(record => record.status === 'PAGADO' && (statusFilter === 'all' || statusFilter === 'PAGADO')).map((record) => (
                            <div key={record.id} className="flex items-center justify-between p-3 border border-green-200 rounded-lg hover:shadow-sm transition-shadow bg-green-50/30">
                              <div className="flex items-center space-x-3">
                                <div className="p-2 bg-green-100 rounded-lg">
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                </div>
                                <div>
                                  <h4 className="font-medium">{record.taxBase.name}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    ${record.amount.toLocaleString()} - {record.month}
                                  </p>
                                  {record.paymentDate && (
                                    <p className="text-xs text-green-600">
                                      Pagado: {new Date(record.paymentDate).toLocaleDateString('es-AR')}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <Badge className="bg-green-100 text-green-800">
                                Completado
                              </Badge>
                            </div>
                          ))}
                          {taxRecords.filter(record => record.status === 'PAGADO' && (statusFilter === 'all' || statusFilter === 'PAGADO')).length === 0 && (
                            <div className="text-center py-6 text-muted-foreground">
                              <Clock className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                              <p className="text-sm">No hay impuestos pagados</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Vencidos */}
                    <Card>
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-red-600" />
                          <CardTitle className="text-base">Vencidos</CardTitle>
                          <Badge variant="outline" className="text-xs">
                            {taxRecords.filter(record => record.status === 'VENCIDO' && (statusFilter === 'all' || statusFilter === 'VENCIDO')).length}
                          </Badge>
                        </div>
                        <CardDescription>
                          Impuestos que requieren atención urgente
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {taxRecords.filter(record => record.status === 'VENCIDO' && (statusFilter === 'all' || statusFilter === 'VENCIDO')).map((record) => (
                            <div key={record.id} className="flex items-center justify-between p-3 border border-red-200 rounded-lg hover:shadow-sm transition-shadow bg-red-50/30">
                              <div className="flex items-center space-x-3">
                                <div className="p-2 bg-red-100 rounded-lg">
                                  <AlertTriangle className="h-4 w-4 text-red-600" />
                                </div>
                                <div>
                                  <h4 className="font-medium">{record.taxBase.name}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    ${record.amount.toLocaleString()} - {record.month}
                                  </p>
                                  <p className="text-xs text-red-600">
                                    Vence: {new Date(record.alertDate).toLocaleDateString('es-AR')}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleMarkAsPaid(record.id)}
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Pagar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingTaxRecord(record);
                                    setRecordFormData({
                                      taxBaseId: record.taxBaseId.toString(),
                                      amount: record.amount.toString(),
                                      notes: record.notes || '',
                                      month: record.month,
                                      dueDate: formatDateForDisplay(record.alertDate)
                                    });
                                    setIsCreateRecordDialogOpen(true);
                                  }}
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  Editar
                                </Button>
                              </div>
                            </div>
                          ))}
                          {taxRecords.filter(record => record.status === 'VENCIDO' && (statusFilter === 'all' || statusFilter === 'VENCIDO')).length === 0 && (
                            <div className="text-center py-6 text-muted-foreground">
                              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                              <p className="text-sm">¡Excelente! No hay impuestos vencidos</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Pestaña 3: Calendario */}
            <TabsContent value="calendar" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <CalendarDays className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Calendario de Impuestos</CardTitle>
                        <CardDescription>
                          Vista de fechas de pago, recibo y vencimiento para {calendarDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCalendarDate(new Date())}
                      >
                        Hoy
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Filtros del Calendario - Compactos */}
                  <div className="mb-4">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium text-gray-900">Filtros</span>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCalendarFilters({ received: true, paid: true, due: true })}
                            className="h-7 px-2 text-xs bg-white hover:bg-blue-50 border-blue-200 text-blue-700"
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Todos
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCalendarFilters({ received: false, paid: false, due: false })}
                            className="h-7 px-2 text-xs bg-white hover:bg-gray-50 border-gray-200 text-gray-700"
                          >
                            <X className="h-3 w-3 mr-1" />
                            Ninguno
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        {/* Filtro Recibido */}
                        <div 
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all duration-200",
                            calendarFilters.received 
                              ? "border-blue-300 bg-blue-100 shadow-sm" 
                              : "border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50"
                          )}
                          onClick={() => setCalendarFilters(prev => ({ ...prev, received: !prev.received }))}
                        >
                          <div className={cn(
                            "w-3 h-3 rounded-full border flex items-center justify-center transition-all duration-200",
                            calendarFilters.received 
                              ? "bg-blue-500 border-blue-500" 
                              : "border-gray-300"
                          )}>
                            {calendarFilters.received && (
                              <CheckCircle className="h-2 w-2 text-white" />
                            )}
                          </div>
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span className="text-sm font-medium text-gray-900">Recibido</span>
                        </div>

                        {/* Filtro Pagado */}
                        <div 
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all duration-200",
                            calendarFilters.paid 
                              ? "border-green-300 bg-green-100 shadow-sm" 
                              : "border-gray-200 bg-white hover:border-green-200 hover:bg-green-50"
                          )}
                          onClick={() => setCalendarFilters(prev => ({ ...prev, paid: !prev.paid }))}
                        >
                          <div className={cn(
                            "w-3 h-3 rounded-full border flex items-center justify-center transition-all duration-200",
                            calendarFilters.paid 
                              ? "bg-green-500 border-green-500" 
                              : "border-gray-300"
                          )}>
                            {calendarFilters.paid && (
                              <CheckCircle className="h-2 w-2 text-white" />
                            )}
                          </div>
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm font-medium text-gray-900">Pagado</span>
                        </div>

                        {/* Filtro Vencimiento */}
                        <div 
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all duration-200",
                            calendarFilters.due 
                              ? "border-red-300 bg-red-100 shadow-sm" 
                              : "border-gray-200 bg-white hover:border-red-200 hover:bg-red-50"
                          )}
                          onClick={() => setCalendarFilters(prev => ({ ...prev, due: !prev.due }))}
                        >
                          <div className={cn(
                            "w-3 h-3 rounded-full border flex items-center justify-center transition-all duration-200",
                            calendarFilters.due 
                              ? "bg-red-500 border-red-500" 
                              : "border-gray-300"
                          )}>
                            {calendarFilters.due && (
                              <CheckCircle className="h-2 w-2 text-white" />
                            )}
                          </div>
                          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                          <span className="text-sm font-medium text-gray-900">Vencimiento</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contador de eventos visibles - Compacto */}
                  <div className="mb-4">
                    <div className="bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 rounded-lg p-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-gray-600" />
                          <span className="text-sm font-medium text-gray-900">
                            {calendarDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          {calendarFilters.received && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 rounded-full">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              <span className="text-xs font-medium text-blue-800">
                                {getCalendarEvents().filter(e => e.type === 'received').length}
                              </span>
                            </div>
                          )}
                          {calendarFilters.paid && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-green-100 rounded-full">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-xs font-medium text-green-800">
                                {getCalendarEvents().filter(e => e.type === 'paid').length}
                              </span>
                            </div>
                          )}
                          {calendarFilters.due && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-red-100 rounded-full">
                              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                              <span className="text-xs font-medium text-red-800">
                                {getCalendarEvents().filter(e => e.type === 'due').length}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Calendario */}
                  <div className="grid grid-cols-7 gap-1">
                    {/* Días de la semana */}
                    {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                      <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground bg-muted/20 rounded">
                        {day}
                      </div>
                    ))}
                    
                    {/* Días del mes */}
                    {Array.from({ length: getDaysInMonth(calendarDate) }, (_, i) => {
                      const day = i + 1;
                      const date = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day);
                      const events = getEventsForDate(date);
                      
                      return (
                        <div
                          key={day}
                          className={cn(
                            "p-2 min-h-[60px] border rounded cursor-pointer hover:bg-muted/20 transition-colors",
                            isToday(date) && "bg-primary/10 border-primary/20",
                            events.length > 0 && "bg-blue-50/50"
                          )}
                        >
                          <div className="text-sm font-medium mb-1">{day}</div>
                          <div className="space-y-1">
                            {events.map((event, index) => (
                              <div
                                key={index}
                                className={cn(
                                  "text-xs px-1 py-0.5 rounded text-white",
                                  event.type === 'received' && "bg-blue-500",
                                  event.type === 'paid' && "bg-green-500",
                                  event.type === 'due' && "bg-red-500"
                                )}
                              >
                                {event.type === 'received' ? `Recibido: ${event.record?.taxBase.name || 'N/A'}` : 
                                 event.type === 'paid' ? `Pagado: ${event.record?.taxBase.name || 'N/A'}` : 
                                 `Vence: ${event.record?.taxBase.name || 'N/A'}`}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </DialogBody>

        {/* Modal para crear nueva planilla de impuesto */}
        <Dialog open={isCreateBaseDialogOpen} onOpenChange={(open) => {
          setIsCreateBaseDialogOpen(open);
          if (!open) {
            // Resetear formulario al cerrar
            setBaseFormData({
              name: '',
              description: '',
              recurringDay: 5,
              notes: ''
            });
          }
        }}>
          <DialogContent size="lg">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Crear Nueva Planilla de Impuesto
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Crea una planilla de impuesto que se reutilizará mensualmente. Esta planilla servirá como plantilla para registrar los impuestos de cada mes.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="baseName" className="text-sm font-medium">
                  Nombre del Impuesto <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="baseName"
                  value={baseFormData.name}
                  onChange={(e) => setBaseFormData({ ...baseFormData, name: e.target.value })}
                  placeholder="Ej: IIBB, IVA, Ganancias, Monotributo"
                  className="w-full"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Ingresa el nombre del impuesto que se registrará mensualmente
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="baseDescription" className="text-sm font-medium">
                  Descripción
                </Label>
                <Textarea
                  id="baseDescription"
                  value={baseFormData.description}
                  onChange={(e) => setBaseFormData({ ...baseFormData, description: e.target.value })}
                  placeholder="Descripción opcional del impuesto (ej: Ingresos Brutos Córdoba)"
                  className="w-full min-h-[80px]"
                  rows={3}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="baseRecurringDay" className="text-sm font-medium">
                  Día del mes para la alerta <span className="text-red-500">*</span>
                </Label>
                <Select 
                  value={baseFormData.recurringDay.toString()} 
                  onValueChange={(value) => setBaseFormData({ ...baseFormData, recurringDay: parseInt(value) })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar día del mes" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <SelectItem key={day} value={day.toString()}>
                        Día {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    <strong>ℹ️ Información:</strong> El sistema generará automáticamente un recordatorio el día <strong>{baseFormData.recurringDay}</strong> de cada mes para este impuesto.
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="baseNotes" className="text-sm font-medium">
                  Notas Adicionales
                </Label>
                <Textarea
                  id="baseNotes"
                  value={baseFormData.notes}
                  onChange={(e) => setBaseFormData({ ...baseFormData, notes: e.target.value })}
                  placeholder="Información adicional sobre este impuesto (opcional)"
                  className="w-full min-h-[80px]"
                  rows={3}
                />
              </div>
            </DialogBody>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateBaseDialogOpen(false)}
                type="button"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateBase}
                className="gap-2"
                disabled={!baseFormData.name || baseFormData.name.trim() === ''}
              >
                <Plus className="h-4 w-4" />
                Crear Planilla
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal para crear nuevo registro mensual */}
        <Dialog open={isCreateRecordDialogOpen} onOpenChange={(open) => {
          setIsCreateRecordDialogOpen(open);
          if (!open) {
            setEditingTaxRecord(null);
            setRecordFormData({
              taxBaseId: '',
              amount: '',
              notes: '',
              month: '',
              dueDate: ''
            });
          }
        }}>
          <DialogContent size="md">
            <DialogHeader>
              <DialogTitle>
                {editingTaxRecord ? 'Editar Impuesto' : 'Ingreso de Impuesto'}
              </DialogTitle>
              <DialogDescription>
                {editingTaxRecord
                  ? 'Modifica los datos del impuesto'
                  : 'Selecciona el impuesto, ingresa el monto, mes y fecha de vencimiento. La fecha de ingreso se guardará automáticamente.'
                }
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <div>
                <Label htmlFor="recordTaxBase">Base de Impuesto</Label>
                <Select 
                  value={recordFormData.taxBaseId} 
                  onValueChange={(value) => setRecordFormData({ ...recordFormData, taxBaseId: value })}
                  disabled={!!editingTaxRecord}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar base de impuesto" />
                  </SelectTrigger>
                  <SelectContent>
                    {taxBases.map((base) => (
                      <SelectItem key={base.id} value={base.id.toString()}>
                        {base.name} (Día {base.recurringDay})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="recordMonth">Mes</Label>
                <Input
                  id="recordMonth"
                  type="text"
                  value={recordFormData.month}
                  onChange={(e) => setRecordFormData({ ...recordFormData, month: e.target.value })}
                  placeholder="YYYY-MM"
                  disabled={!!editingTaxRecord}
                />
              </div>
              <div>
                <Label htmlFor="recordAmount">Monto</Label>
                <Input
                  id="recordAmount"
                  type="number"
                  step="0.01"
                  value={recordFormData.amount}
                  onChange={(e) => setRecordFormData({ ...recordFormData, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="recordDueDate">Fecha de Vencimiento</Label>
                <div className="relative">
                  <Input
                    id="recordDueDate"
                    type="text"
                    value={recordFormData.dueDate}
                    onChange={(e) => {
                      let value = e.target.value;
                      // Permitir solo números y barras
                      value = value.replace(/[^\d/]/g, '');
                      // Auto-formatear mientras escribe
                      if (value.length === 2 && !value.includes('/')) {
                        value = value + '/';
                      } else if (value.length === 5 && value.split('/').length === 2) {
                        value = value + '/';
                      }
                      // Limitar a 10 caracteres (dd/mm/yyyy)
                      if (value.length <= 10) {
                        setRecordFormData({ ...recordFormData, dueDate: value });
                      }
                    }}
                    placeholder="dd/mm/yyyy"
                    maxLength={10}
                    className="pr-10"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <Calendar className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </div>
              <div>
                <Label htmlFor="recordNotes">Notas</Label>
                <Textarea
                  id="recordNotes"
                  value={recordFormData.notes}
                  onChange={(e) => setRecordFormData({ ...recordFormData, notes: e.target.value })}
                  placeholder="Notas adicionales (opcional)"
                />
              </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsCreateRecordDialogOpen(false);
                setEditingTaxRecord(null);
                setRecordFormData({
                  taxBaseId: '',
                  amount: '',
                  notes: '',
                  month: '',
                  dueDate: ''
                });
              }}>
                Cancelar
              </Button>
              <Button onClick={handleCreateRecord}>
                {editingTaxRecord ? 'Actualizar Registro' : 'Crear Registro'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}