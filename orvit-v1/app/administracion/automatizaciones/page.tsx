'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Zap,
  Plus,
  MoreVertical,
  Play,
  Pause,
  Trash2,
  Edit,
  TestTube,
  History,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Activity,
  Bell,
  UserPlus,
  Tag,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

// Types
interface AutomationRule {
  id: number;
  name: string;
  description: string | null;
  triggerType: string;
  triggerConfig: any;
  conditions: any[];
  actions: any[];
  priority: number;
  isActive: boolean;
  isTestMode: boolean;
  executionCount: number;
  lastExecutedAt: string | null;
  createdAt: string;
  createdBy: { id: number; name: string; email: string };
  stats?: {
    totalExecutions: number;
    recentExecutions: number;
    successfulExecutions: number;
    successRate: number;
  };
}

interface AutomationStats {
  summary: {
    totalRules: number;
    activeRules: number;
    inactiveRules: number;
    executionsToday: number;
    executionsThisWeek: number;
    successRate: number;
  };
  rulesByTrigger: Record<string, number>;
  executionsByStatus: Record<string, number>;
  recentExecutions: any[];
  topRules: any[];
}

// Trigger type labels
const TRIGGER_LABELS: Record<string, string> = {
  WORK_ORDER_CREATED: 'OT Creada',
  WORK_ORDER_STATUS_CHANGED: 'Cambio de Estado OT',
  WORK_ORDER_ASSIGNED: 'OT Asignada',
  FAILURE_REPORTED: 'Falla Reportada',
  FAILURE_RECURRENCE: 'Falla Recurrente',
  STOCK_LOW: 'Stock Bajo',
  PREVENTIVE_DUE: 'Preventivo Próximo',
  MACHINE_STATUS_CHANGED: 'Cambio Estado Máquina',
  SCHEDULED: 'Programado',
};

// Action type labels
const ACTION_LABELS: Record<string, string> = {
  NOTIFY_USER: 'Notificar Usuario',
  NOTIFY_ROLE: 'Notificar Rol',
  ASSIGN_USER: 'Asignar Usuario',
  CHANGE_STATUS: 'Cambiar Estado',
  ADD_TAG: 'Agregar Etiqueta',
  CREATE_TASK: 'Crear Tarea',
  SEND_EMAIL: 'Enviar Email',
  SEND_WHATSAPP: 'Enviar WhatsApp',
};

// Status colors
const STATUS_COLORS: Record<string, string> = {
  COMPLETED: 'bg-green-500',
  FAILED: 'bg-red-500',
  SKIPPED: 'bg-gray-500',
  SIMULATED: 'bg-blue-500',
  PENDING: 'bg-yellow-500',
  RUNNING: 'bg-purple-500',
};

export default function AutomatizacionesPage() {
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<AutomationRule | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);

  // Fetch stats
  const { data: stats, isLoading: statsLoading } = useQuery<AutomationStats>({
    queryKey: ['automation-stats'],
    queryFn: async () => {
      const res = await fetch('/api/automations/stats');
      if (!res.ok) throw new Error('Error al cargar estadísticas');
      return res.json();
    },
  });

  // Fetch rules
  const { data: rules, isLoading: rulesLoading } = useQuery<AutomationRule[]>({
    queryKey: ['automation-rules'],
    queryFn: async () => {
      const res = await fetch('/api/automations');
      if (!res.ok) throw new Error('Error al cargar reglas');
      return res.json();
    },
  });

  // Toggle rule active status
  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await fetch(`/api/automations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error('Error al actualizar regla');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      queryClient.invalidateQueries({ queryKey: ['automation-stats'] });
      toast.success('Regla actualizada');
    },
    onError: () => {
      toast.error('Error al actualizar la regla');
    },
  });

  // Delete rule
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/automations/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar regla');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      queryClient.invalidateQueries({ queryKey: ['automation-stats'] });
      toast.success('Regla eliminada');
    },
    onError: () => {
      toast.error('Error al eliminar la regla');
    },
  });

  // Test rule
  const testMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/automations/${id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error('Error al probar regla');
      return res.json();
    },
    onSuccess: (data) => {
      if (data.result?.status === 'COMPLETED' || data.result?.status === 'SIMULATED') {
        toast.success('Prueba exitosa: la regla se ejecutó correctamente');
      } else if (data.result?.status === 'SKIPPED') {
        toast.info('Prueba completada: las condiciones no se cumplieron');
      } else {
        toast.warning('Prueba completada: revisar resultado');
      }
    },
    onError: () => {
      toast.error('Error al probar la regla');
    },
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Zap className="h-8 w-8 text-yellow-500" />
            Automatizaciones
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure reglas para automatizar acciones basadas en eventos del sistema
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Regla
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reglas Activas</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.summary.activeRules || 0}
              <span className="text-sm text-muted-foreground font-normal">
                {' '}/ {stats?.summary.totalRules || 0}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.summary.inactiveRules || 0} inactivas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ejecuciones Hoy</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.summary.executionsToday || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.summary.executionsThisWeek || 0} esta semana
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Éxito</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.summary.successRate || 0}%</div>
            <p className="text-xs text-muted-foreground">últimos 7 días</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Por Estado</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {stats?.executionsByStatus && Object.entries(stats.executionsByStatus).map(([status, count]) => (
                <Badge
                  key={status}
                  variant="outline"
                  className="text-xs"
                >
                  {status}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rules">Reglas</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
        </TabsList>

        {/* Rules Tab */}
        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reglas de Automatización</CardTitle>
              <CardDescription>
                Gestione las reglas que automatizan acciones en el sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rulesLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Cargando reglas...
                </div>
              ) : rules && rules.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Estado</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Trigger</TableHead>
                      <TableHead>Acciones</TableHead>
                      <TableHead>Ejecuciones</TableHead>
                      <TableHead>Última Ejecución</TableHead>
                      <TableHead className="text-right">Opciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell>
                          <Switch
                            checked={rule.isActive}
                            onCheckedChange={(checked) =>
                              toggleMutation.mutate({ id: rule.id, isActive: checked })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{rule.name}</div>
                          {rule.description && (
                            <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {rule.description}
                            </div>
                          )}
                          {rule.isTestMode && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              <TestTube className="h-3 w-3 mr-1" />
                              Modo Test
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {TRIGGER_LABELS[rule.triggerType] || rule.triggerType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {rule.actions.slice(0, 2).map((action: any, idx: number) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {ACTION_LABELS[action.type] || action.type}
                              </Badge>
                            ))}
                            {rule.actions.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{rule.actions.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{rule.executionCount}</div>
                          {rule.stats && (
                            <div className="text-xs text-muted-foreground">
                              {rule.stats.successRate}% éxito
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {rule.lastExecutedAt ? (
                            <span className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(rule.lastExecutedAt), {
                                addSuffix: true,
                                locale: es,
                              })}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">Nunca</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedRule(rule);
                                  setIsEditDialogOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => testMutation.mutate(rule.id)}
                              >
                                <TestTube className="h-4 w-4 mr-2" />
                                Probar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedRule(rule);
                                  setIsHistoryDialogOpen(true);
                                }}
                              >
                                <History className="h-4 w-4 mr-2" />
                                Historial
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => {
                                  if (confirm('¿Eliminar esta regla?')) {
                                    deleteMutation.mutate(rule.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">Sin reglas configuradas</h3>
                  <p className="text-muted-foreground mb-4">
                    Cree su primera regla de automatización
                  </p>
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nueva Regla
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Ejecuciones</CardTitle>
              <CardDescription>
                Últimas ejecuciones de automatizaciones
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats?.recentExecutions && stats.recentExecutions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Estado</TableHead>
                      <TableHead>Regla</TableHead>
                      <TableHead>Trigger</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Duración</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.recentExecutions.map((exec) => (
                      <TableRow key={exec.id}>
                        <TableCell>
                          <Badge
                            className={`${STATUS_COLORS[exec.status]} text-white`}
                          >
                            {exec.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {exec.rule?.name || 'Regla eliminada'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {TRIGGER_LABELS[exec.triggerType] || exec.triggerType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(exec.startedAt), 'dd/MM/yyyy HH:mm', {
                            locale: es,
                          })}
                        </TableCell>
                        <TableCell>
                          {exec.durationMs ? `${exec.durationMs}ms` : '-'}
                        </TableCell>
                        <TableCell>
                          {exec.errorMessage ? (
                            <span className="text-red-500 text-sm truncate max-w-[200px] block">
                              {exec.errorMessage}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Sin ejecuciones recientes
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <CreateEditRuleDialog
        open={isCreateDialogOpen || isEditDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false);
            setIsEditDialogOpen(false);
            setSelectedRule(null);
          }
        }}
        rule={isEditDialogOpen ? selectedRule : null}
        onSuccess={() => {
          setIsCreateDialogOpen(false);
          setIsEditDialogOpen(false);
          setSelectedRule(null);
          queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
          queryClient.invalidateQueries({ queryKey: ['automation-stats'] });
        }}
      />

      {/* History Dialog */}
      {selectedRule && (
        <RuleHistoryDialog
          open={isHistoryDialogOpen}
          onOpenChange={setIsHistoryDialogOpen}
          rule={selectedRule}
        />
      )}
    </div>
  );
}

// Create/Edit Rule Dialog Component
function CreateEditRuleDialog({
  open,
  onOpenChange,
  rule,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: AutomationRule | null;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(rule?.name || '');
  const [description, setDescription] = useState(rule?.description || '');
  const [triggerType, setTriggerType] = useState(rule?.triggerType || '');
  const [isActive, setIsActive] = useState(rule?.isActive ?? true);
  const [isTestMode, setIsTestMode] = useState(rule?.isTestMode ?? false);
  const [actions, setActions] = useState<any[]>(rule?.actions || []);
  const [conditions, setConditions] = useState<any[]>(rule?.conditions || []);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when dialog opens/closes
  const resetForm = () => {
    setName(rule?.name || '');
    setDescription(rule?.description || '');
    setTriggerType(rule?.triggerType || '');
    setIsActive(rule?.isActive ?? true);
    setIsTestMode(rule?.isTestMode ?? false);
    setActions(rule?.actions || []);
    setConditions(rule?.conditions || []);
  };

  const handleSubmit = async () => {
    if (!name || !triggerType || actions.length === 0) {
      toast.error('Complete todos los campos requeridos');
      return;
    }

    setIsSubmitting(true);
    try {
      const url = rule ? `/api/automations/${rule.id}` : '/api/automations';
      const method = rule ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          triggerType,
          isActive,
          isTestMode,
          actions,
          conditions,
        }),
      });

      if (!res.ok) throw new Error('Error al guardar');

      toast.success(rule ? 'Regla actualizada' : 'Regla creada');
      onSuccess();
    } catch (error) {
      toast.error('Error al guardar la regla');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add action
  const addAction = (type: string) => {
    setActions([...actions, { type, config: {} }]);
  };

  // Remove action
  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {rule ? 'Editar Regla' : 'Nueva Regla de Automatización'}
          </DialogTitle>
          <DialogDescription>
            Configure el trigger, condiciones y acciones de la regla
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Basic Info */}
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Notificar supervisor en OT urgente"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción opcional de la regla"
                rows={2}
              />
            </div>
          </div>

          {/* Trigger */}
          <div className="grid gap-2">
            <Label>Trigger (Evento que activa la regla) *</Label>
            <Select value={triggerType} onValueChange={setTriggerType}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccione un trigger" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="grid gap-2">
            <Label>Acciones *</Label>
            <div className="space-y-2">
              {actions.map((action, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 border rounded-md bg-muted/50"
                >
                  <Badge variant="outline">
                    {ACTION_LABELS[action.type] || action.type}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 ml-auto"
                    onClick={() => removeAction(idx)}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Select onValueChange={addAction}>
                <SelectTrigger>
                  <SelectValue placeholder="Agregar acción..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOTIFY_USER">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4" />
                      Notificar Usuario
                    </div>
                  </SelectItem>
                  <SelectItem value="NOTIFY_ROLE">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4" />
                      Notificar Rol
                    </div>
                  </SelectItem>
                  <SelectItem value="ASSIGN_USER">
                    <div className="flex items-center gap-2">
                      <UserPlus className="h-4 w-4" />
                      Asignar Usuario
                    </div>
                  </SelectItem>
                  <SelectItem value="CHANGE_STATUS">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Cambiar Estado
                    </div>
                  </SelectItem>
                  <SelectItem value="ADD_TAG">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4" />
                      Agregar Etiqueta
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Options */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="isActive">Activa</Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="isTestMode"
                checked={isTestMode}
                onCheckedChange={setIsTestMode}
              />
              <Label htmlFor="isTestMode">Modo Test (solo simula)</Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : rule ? 'Guardar Cambios' : 'Crear Regla'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Rule History Dialog Component
function RuleHistoryDialog({
  open,
  onOpenChange,
  rule,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: AutomationRule;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['automation-executions', rule.id],
    queryFn: async () => {
      const res = await fetch(`/api/automations/${rule.id}/executions`);
      if (!res.ok) throw new Error('Error al cargar historial');
      return res.json();
    },
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Historial: {rule.name}</DialogTitle>
          <DialogDescription>
            Últimas ejecuciones de esta regla
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Cargando historial...
          </div>
        ) : data?.executions?.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Condiciones</TableHead>
                <TableHead>Duración</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.executions.map((exec: any) => (
                <TableRow key={exec.id}>
                  <TableCell>
                    <Badge className={`${STATUS_COLORS[exec.status]} text-white`}>
                      {exec.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {format(new Date(exec.startedAt), 'dd/MM/yyyy HH:mm:ss', {
                      locale: es,
                    })}
                  </TableCell>
                  <TableCell>
                    {exec.conditionsPassed ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </TableCell>
                  <TableCell>
                    {exec.durationMs ? `${exec.durationMs}ms` : '-'}
                  </TableCell>
                  <TableCell>
                    {exec.errorMessage ? (
                      <span className="text-red-500 text-sm">{exec.errorMessage}</span>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Sin ejecuciones registradas
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
