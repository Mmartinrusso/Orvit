'use client';

import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  FileText, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  TrendingUp,
  BarChart3,
  Settings,
  Calendar,
  Users,
  Plus
} from 'lucide-react';
import TaxControlModal from '@/components/tax-control/TaxControlModal';
import CreateControlDialog from '@/components/tax-control/CreateControlDialog';
import CreateTaxBaseDialog from '@/components/tax-control/CreateTaxBaseDialog';
import { useState, useEffect } from 'react';

interface ControlCard {
  id: string;
  title: string;
  description: string;
  icon: any;
  status: 'active' | 'pending' | 'completed' | 'warning';
  lastUpdate: string;
  onClick: () => void;
  badge?: string;
  badgeColor?: string;
}

export default function ControlesPage() {
  const { currentCompany } = useCompany();
  const { hasPermission } = useAuth();
  const [isTaxControlModalOpen, setIsTaxControlModalOpen] = useState(false);
  const [isCreateControlDialogOpen, setIsCreateControlDialogOpen] = useState(false);
  const [isCreateTaxBaseDialogOpen, setIsCreateTaxBaseDialogOpen] = useState(false);
  
  // Verificar permisos
  const canAccessControls = hasPermission('ingresar_controles');
  const canManageControls = hasPermission('controles.manage');
  
  // El botón "Crear Control" solo aparece si tiene permiso de manage
  const showCreateButton = canManageControls;
  
  const [taxStats, setTaxStats] = useState({
    total: 0,
    vencidos: 0,
    pendientes: 0,
    pagados: 0,
    recibidos: 0
  });
  const [loading, setLoading] = useState(true);

  // Función para obtener estadísticas de impuestos
  const fetchTaxStats = async () => {
    if (!currentCompany) return;
    
    try {
      setLoading(true);
      
      // Obtener el mes anterior
      const today = new Date();
      const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const previousMonthStr = previousMonth.toISOString().slice(0, 7);
      
      // Obtener registros de impuestos del mes anterior
      const response = await fetch(`/api/tax-record?companyId=${currentCompany.id}&month=${previousMonthStr}`);
      
      if (response.ok) {
        const taxRecords = await response.json();
        
        // Calcular estadísticas
        const stats = {
          total: taxRecords.length,
          vencidos: taxRecords.filter((record: any) => {
            const alertDate = new Date(record.alertDate);
            const today = new Date();
            return alertDate < today && record.status !== 'PAGADO';
          }).length,
          pendientes: taxRecords.filter((record: any) => record.status === 'PENDIENTE').length,
          pagados: taxRecords.filter((record: any) => record.status === 'PAGADO').length,
          recibidos: taxRecords.filter((record: any) => record.status === 'RECIBIDO').length
        };
        
        setTaxStats(stats);
      }
    } catch (error) {
      console.error('Error fetching tax stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Cargar estadísticas cuando se monta el componente
  useEffect(() => {
    if (currentCompany) {
      fetchTaxStats();
    }
  }, [currentCompany]);

  // Datos dinámicos para las tarjetas de control
  const controlCards: ControlCard[] = [
    {
      id: 'tax-control',
      title: 'Planilla de Control de Impuestos',
      description: 'Gestión mensual de impuestos y obligaciones fiscales (IIBB, IVA, Ganancias, etc.)',
      icon: FileText,
      status: 'active',
      lastUpdate: 'Actualizado ahora',
      onClick: () => setIsTaxControlModalOpen(true),
      badge: loading ? 'Cargando controles...' : `${taxStats.vencidos} vencidos`,
      badgeColor: taxStats.vencidos > 0 ? 'bg-destructive/10 text-destructive' : 'bg-success-muted text-success'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-success-muted text-success';
      case 'pending':
        return 'bg-warning-muted text-warning-muted-foreground';
      case 'completed':
        return 'bg-info-muted text-info-muted-foreground';
      case 'warning':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-muted text-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return CheckCircle;
      case 'pending':
        return Clock;
      case 'completed':
        return CheckCircle;
      case 'warning':
        return AlertTriangle;
      default:
        return Clock;
    }
  };

  if (!currentCompany) {
    return (
      <div className="h-screen sidebar-shell">
        <div className="m-3 rounded-2xl surface-card dashboard-surface px-6 md:px-8 py-6 space-y-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Cargando empresa...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen sidebar-shell">
      <div className="m-3 rounded-2xl surface-card dashboard-surface px-6 md:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-border gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                Dashboard de Controles
              </h1>
              <p className="text-sm md:text-base mt-1 text-muted-foreground">
                {currentCompany?.name || 'Empresa'} - Sistemas de control y gestión fiscal
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {showCreateButton && (
              <Button 
                onClick={() => setIsCreateControlDialogOpen(true)}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Crear Control
              </Button>
            )}
            <Badge variant="outline" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              Actualizado hace 2 horas
            </Badge>
          </div>
        </div>

        {/* Resumen General */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-green-500 hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Sistema Activo</CardTitle>
              <div className="p-2 bg-success-muted rounded-lg">
                <CheckCircle className="h-4 w-4 text-success" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">1</div>
              <p className="text-xs text-muted-foreground mt-1">
                Control de Impuestos
              </p>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-blue-500 hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Impuestos Registrados</CardTitle>
              <div className="p-2 bg-info-muted rounded-lg">
                <FileText className="h-4 w-4 text-info-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-info-muted-foreground">
                {loading ? '...' : taxStats.total}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Registros del mes anterior
              </p>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-yellow-500 hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pendientes</CardTitle>
              <div className="p-2 bg-warning-muted rounded-lg">
                <Clock className="h-4 w-4 text-warning-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning-muted-foreground">
                {loading ? '...' : taxStats.pendientes}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Sin procesar
              </p>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-red-500 hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Alertas</CardTitle>
              <div className="p-2 bg-destructive/10 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-destructive">
                {loading ? '...' : taxStats.vencidos}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Impuestos vencidos
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tarjetas de Controles */}
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold">Sistemas de Control Disponibles</h2>
            <Badge variant="outline" className="text-xs">
              {controlCards.length} sistema disponible
            </Badge>
          </div>
          <div className="grid grid-cols-1 gap-4">
              {controlCards.map((control) => {
                const StatusIcon = getStatusIcon(control.status);
                const IconComponent = control.icon;
                
                return (
                  <Card 
                    key={control.id} 
                    className="cursor-pointer hover:shadow-lg transition-all duration-200 border-l-4 border-l-primary/20 hover:border-l-primary"
                    onClick={control.onClick}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <IconComponent className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{control.title}</CardTitle>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge className={getStatusColor(control.status)}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {control.status}
                              </Badge>
                              {control.badge && (
                                <Badge className={control.badgeColor}>
                                  {control.badge}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-sm mb-4">
                        {control.description}
                      </CardDescription>
                      
                      {/* Estadísticas de Impuestos */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        <div className="text-center p-2 bg-destructive/10 rounded-lg border border-destructive/30">
                          <div className="text-lg font-bold text-destructive">
                            {loading ? '...' : taxStats.vencidos}
                          </div>
                          <div className="text-xs text-destructive">Vencidos</div>
                        </div>
                        <div className="text-center p-2 bg-warning-muted rounded-lg border border-warning-muted">
                          <div className="text-lg font-bold text-warning-muted-foreground">
                            {loading ? '...' : taxStats.pendientes}
                          </div>
                          <div className="text-xs text-warning-muted-foreground">Pendientes</div>
                        </div>
                        <div className="text-center p-2 bg-info-muted rounded-lg border border-info-muted">
                          <div className="text-lg font-bold text-info-muted-foreground">
                            {loading ? '...' : taxStats.recibidos}
                          </div>
                          <div className="text-xs text-info-muted-foreground">Recibidos</div>
                        </div>
                        <div className="text-center p-2 bg-success-muted rounded-lg border border-success-muted">
                          <div className="text-lg font-bold text-success">
                            {loading ? '...' : taxStats.pagados}
                          </div>
                          <div className="text-xs text-success">Pagados</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Última actualización: {control.lastUpdate}</span>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                          Abrir →
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </div>

        {/* Información Adicional */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Información del Sistema de Control de Impuestos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">Funcionalidades Disponibles</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Gestión de bases de impuestos</li>
                  <li>• Registro mensual de impuestos</li>
                  <li>• Alertas automáticas por vencimientos</li>
                  <li>• Notificaciones en tiempo real</li>
                  <li>• Calendario de vencimientos</li>
                  <li>• Control de estados (Recibido/Pagado)</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Características del Sistema</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Impuestos recurrentes automáticos</li>
                  <li>• Alertas 1 día antes del vencimiento</li>
                  <li>• Recordatorios del día X de cada mes</li>
                  <li>• Seguimiento de pagos y recibos</li>
                  <li>• Historial completo de transacciones</li>
                  <li>• Integración con sistema de notificaciones</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Diálogo para crear control */}
        <CreateControlDialog
          isOpen={isCreateControlDialogOpen}
          onClose={() => setIsCreateControlDialogOpen(false)}
          onSuccess={(controlType) => {
            // Si el tipo es 'tax', abrir el diálogo de crear planilla de impuesto
            if (controlType === 'tax') {
              setIsCreateTaxBaseDialogOpen(true);
            }
          }}
        />

        {/* Diálogo para crear planilla de impuesto */}
        <CreateTaxBaseDialog
          isOpen={isCreateTaxBaseDialogOpen}
          onClose={() => setIsCreateTaxBaseDialogOpen(false)}
          onSuccess={() => {
            // Refrescar estadísticas cuando se cree una planilla
            fetchTaxStats();
          }}
        />

        {/* Modal de Control de Impuestos */}
        <TaxControlModal 
          isOpen={isTaxControlModalOpen} 
          onClose={() => {
            setIsTaxControlModalOpen(false);
            // Refrescar estadísticas cuando se cierre el modal
            fetchTaxStats();
          }} 
        />
      </div>
    </div>
  );
}
