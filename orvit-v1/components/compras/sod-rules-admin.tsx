'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import {
  Shield,
  Plus,
  Edit,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Info,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SoDRule {
  id: number;
  companyId: number;
  ruleCode: string;
  name: string;
  description?: string;
  action1: string;
  action2: string;
  scope: 'SAME_DOCUMENT' | 'SAME_SUPPLIER' | 'GLOBAL';
  isEnabled: boolean;
  isSystemRule: boolean;
  createdAt: string;
}

const ACTIONS = [
  { value: 'CREAR_PEDIDO', label: 'Crear Pedido' },
  { value: 'APROBAR_PEDIDO', label: 'Aprobar Pedido' },
  { value: 'CREAR_OC', label: 'Crear OC' },
  { value: 'APROBAR_OC', label: 'Aprobar OC' },
  { value: 'CONFIRMAR_RECEPCION', label: 'Confirmar Recepción' },
  { value: 'CARGAR_FACTURA', label: 'Cargar Factura' },
  { value: 'APROBAR_FACTURA', label: 'Aprobar Factura' },
  { value: 'CREAR_OP', label: 'Crear Orden de Pago' },
  { value: 'APROBAR_PAGO', label: 'Aprobar Pago' },
  { value: 'EJECUTAR_PAGO', label: 'Ejecutar Pago' },
  { value: 'MODIFICAR_PROVEEDOR', label: 'Modificar Proveedor' },
  { value: 'APROBAR_CAMBIO_BANCARIO', label: 'Aprobar Cambio Bancario' },
  { value: 'RESOLVER_MATCH', label: 'Resolver Match' },
];

const SCOPES = [
  { value: 'SAME_DOCUMENT', label: 'Mismo Documento', description: 'No puede hacer ambas acciones en el mismo documento' },
  { value: 'SAME_SUPPLIER', label: 'Mismo Proveedor', description: 'No puede hacer ambas acciones para el mismo proveedor' },
  { value: 'GLOBAL', label: 'Global', description: 'No puede tener ambos permisos simultáneamente' },
];

const DEFAULT_COLORS = {
  chart1: '#6366f1',
  chart4: '#f59e0b',
  kpiPositive: '#10b981',
  kpiNegative: '#ef4444',
};

export function SoDRulesAdmin() {
  const [rules, setRules] = useState<SoDRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<SoDRule | null>(null);
  const [formData, setFormData] = useState({
    ruleCode: '',
    name: '',
    description: '',
    action1: '',
    action2: '',
    scope: 'SAME_DOCUMENT' as const,
    isEnabled: true,
  });

  const userColors = DEFAULT_COLORS;

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/compras/sod-rules');
      if (response.ok) {
        const data = await response.json();
        setRules(data.rules || []);
      }
    } catch (error) {
      console.error('Error loading SoD rules:', error);
      toast.error('Error al cargar reglas SoD');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRule = async (rule: SoDRule) => {
    try {
      const response = await fetch(`/api/compras/sod-rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: !rule.isEnabled }),
      });

      if (response.ok) {
        toast.success(`Regla ${rule.isEnabled ? 'desactivada' : 'activada'}`);
        loadRules();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Error al actualizar regla');
      }
    } catch (error) {
      toast.error('Error al actualizar regla');
    }
  };

  const handleOpenCreate = () => {
    setEditingRule(null);
    setFormData({
      ruleCode: '',
      name: '',
      description: '',
      action1: '',
      action2: '',
      scope: 'SAME_DOCUMENT',
      isEnabled: true,
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (rule: SoDRule) => {
    if (rule.isSystemRule) {
      toast.error('Las reglas del sistema no se pueden editar');
      return;
    }
    setEditingRule(rule);
    setFormData({
      ruleCode: rule.ruleCode,
      name: rule.name,
      description: rule.description || '',
      action1: rule.action1,
      action2: rule.action2,
      scope: rule.scope,
      isEnabled: rule.isEnabled,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (rule: SoDRule) => {
    if (rule.isSystemRule) {
      toast.error('Las reglas del sistema no se pueden eliminar');
      return;
    }

    if (!confirm(`¿Eliminar la regla "${rule.name}"?`)) return;

    try {
      const response = await fetch(`/api/compras/sod-rules/${rule.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Regla eliminada');
        loadRules();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Error al eliminar regla');
      }
    } catch (error) {
      toast.error('Error al eliminar regla');
    }
  };

  const handleSave = async () => {
    // Validaciones
    if (!formData.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }
    if (!formData.action1 || !formData.action2) {
      toast.error('Ambas acciones son requeridas');
      return;
    }
    if (formData.action1 === formData.action2) {
      toast.error('Las acciones deben ser diferentes');
      return;
    }

    setSaving(true);
    try {
      const url = editingRule
        ? `/api/compras/sod-rules/${editingRule.id}`
        : '/api/compras/sod-rules';
      const method = editingRule ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success(editingRule ? 'Regla actualizada' : 'Regla creada');
        setIsDialogOpen(false);
        loadRules();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Error al guardar regla');
      }
    } catch (error) {
      toast.error('Error al guardar regla');
    } finally {
      setSaving(false);
    }
  };

  const getActionLabel = (action: string) => {
    return ACTIONS.find(a => a.value === action)?.label || action;
  };

  const getScopeLabel = (scope: string) => {
    return SCOPES.find(s => s.value === scope)?.label || scope;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const enabledCount = rules.filter(r => r.isEnabled).length;
  const systemCount = rules.filter(r => r.isSystemRule).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5" style={{ color: userColors.chart1 }} />
            Reglas de Segregación de Funciones (SoD)
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Define qué acciones no pueden ser realizadas por el mismo usuario
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadRules}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <Button size="sm" onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Regla
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Reglas</p>
                <p className="text-2xl font-bold">{rules.length}</p>
              </div>
              <Shield className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Activas</p>
                <p className="text-2xl font-bold" style={{ color: userColors.kpiPositive }}>
                  {enabledCount}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8" style={{ color: `${userColors.kpiPositive}30` }} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Del Sistema</p>
                <p className="text-2xl font-bold">{systemCount}</p>
              </div>
              <Lock className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Estado</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Acción 1</TableHead>
                <TableHead>Acción 2</TableHead>
                <TableHead>Alcance</TableHead>
                <TableHead className="w-12">Tipo</TableHead>
                <TableHead className="w-20 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No hay reglas SoD configuradas
                  </TableCell>
                </TableRow>
              ) : (
                rules.map((rule) => (
                  <TableRow key={rule.id} className={cn(!rule.isEnabled && "opacity-50")}>
                    <TableCell>
                      <Switch
                        checked={rule.isEnabled}
                        onCheckedChange={() => handleToggleRule(rule)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{rule.ruleCode}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{rule.name}</p>
                        {rule.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {rule.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {getActionLabel(rule.action1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {getActionLabel(rule.action2)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {getScopeLabel(rule.scope)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {rule.isSystemRule ? (
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Badge variant="outline" className="text-xs">Custom</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleOpenEdit(rule)}
                          disabled={rule.isSystemRule}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          onClick={() => handleDelete(rule)}
                          disabled={rule.isSystemRule}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-1">¿Cómo funcionan las reglas SoD?</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-300">
                <li>Las reglas impiden que un mismo usuario realice dos acciones conflictivas</li>
                <li>El alcance define si aplica al mismo documento, proveedor, o globalmente</li>
                <li>Las reglas del sistema no pueden modificarse pero sí desactivarse</li>
                <li>Los intentos de violación se registran en el audit log</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? 'Editar Regla SoD' : 'Nueva Regla SoD'}
            </DialogTitle>
            <DialogDescription>
              Define qué acciones no pueden ser realizadas por el mismo usuario
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código</Label>
                <Input
                  value={formData.ruleCode}
                  onChange={(e) => setFormData({ ...formData, ruleCode: e.target.value.toUpperCase() })}
                  placeholder="SOD_XXX"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nombre descriptivo"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripción de la regla..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Acción 1 (Usuario hizo) *</Label>
                <Select
                  value={formData.action1}
                  onValueChange={(v) => setFormData({ ...formData, action1: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIONS.map((action) => (
                      <SelectItem key={action.value} value={action.value}>
                        {action.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Acción 2 (No puede hacer) *</Label>
                <Select
                  value={formData.action2}
                  onValueChange={(v) => setFormData({ ...formData, action2: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIONS.map((action) => (
                      <SelectItem
                        key={action.value}
                        value={action.value}
                        disabled={action.value === formData.action1}
                      >
                        {action.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Alcance *</Label>
              <Select
                value={formData.scope}
                onValueChange={(v: any) => setFormData({ ...formData, scope: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCOPES.map((scope) => (
                    <SelectItem key={scope.value} value={scope.value}>
                      <div>
                        <p>{scope.label}</p>
                        <p className="text-xs text-muted-foreground">{scope.description}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.isEnabled}
                onCheckedChange={(v) => setFormData({ ...formData, isEnabled: v })}
              />
              <Label>Regla activa</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingRule ? 'Guardar Cambios' : 'Crear Regla'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
