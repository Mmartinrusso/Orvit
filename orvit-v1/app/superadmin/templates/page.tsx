'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  Star,
  StarOff,
  Building2,
  Package,
  ShoppingCart,
  Factory,
  Briefcase,
  Truck,
  Loader2,
  Check,
  Puzzle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';

interface Template {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string;
  isDefault: boolean;
  isActive: boolean;
  moduleKeys: string[];
  config: any;
  usageCount: number;
  companiesCount: number;
  modules?: Module[];
}

interface Module {
  key: string;
  name: string;
  category: string;
  icon: string | null;
}

const iconMap: Record<string, any> = {
  Package,
  ShoppingCart,
  Factory,
  Building2,
  Briefcase,
  Truck,
  Puzzle,
};

const categoryColors: Record<string, string> = {
  VENTAS: 'bg-info/10 text-info-muted-foreground border-info-muted/20',
  COMPRAS: 'bg-success/10 text-success border-success-muted/20',
  MANTENIMIENTO: 'bg-warning/10 text-warning-muted-foreground border-warning-muted/20',
  COSTOS: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  ADMINISTRACION: 'bg-muted text-muted-foreground border-border',
  GENERAL: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
};

export default function TemplatesPage() {
  const confirm = useConfirm();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: 'Package',
    color: '#8B5CF6',
    moduleKeys: [] as string[],
    isDefault: false,
    config: { maxUsers: -1, maxStorage: 'unlimited' },
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    try {
      const res = await fetch('/api/superadmin/templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
        setModules(data.modules || []);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Error al cargar templates');
    } finally {
      setLoading(false);
    }
  }

  function openCreateDialog() {
    setEditingTemplate(null);
    setFormData({
      name: '',
      description: '',
      icon: 'Package',
      color: '#8B5CF6',
      moduleKeys: [],
      isDefault: false,
      config: { maxUsers: -1, maxStorage: 'unlimited' },
    });
    setDialogOpen(true);
  }

  function openEditDialog(template: Template) {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      icon: template.icon || 'Package',
      color: template.color || '#8B5CF6',
      moduleKeys: template.moduleKeys || [],
      isDefault: template.isDefault,
      config: template.config || { maxUsers: -1, maxStorage: 'unlimited' },
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    setSaving(true);
    try {
      const url = editingTemplate
        ? `/api/superadmin/templates/${editingTemplate.id}`
        : '/api/superadmin/templates';
      const method = editingTemplate ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast.success(editingTemplate ? 'Template actualizado' : 'Template creado');
        setDialogOpen(false);
        fetchTemplates();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Error al guardar');
      }
    } catch (error) {
      toast.error('Error al guardar template');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(template: Template) {
    const ok = await confirm({
      title: 'Eliminar template',
      description: `¿Eliminar el template "${template.name}"?`,
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/superadmin/templates/${template.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Template eliminado');
        fetchTemplates();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Error al eliminar');
      }
    } catch (error) {
      toast.error('Error al eliminar template');
    }
  }

  async function handleSetDefault(template: Template) {
    try {
      const res = await fetch(`/api/superadmin/templates/${template.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });

      if (res.ok) {
        toast.success('Template establecido como predeterminado');
        fetchTemplates();
      }
    } catch (error) {
      toast.error('Error al actualizar template');
    }
  }

  async function handleDuplicate(template: Template) {
    try {
      const res = await fetch('/api/superadmin/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${template.name} (copia)`,
          description: template.description,
          icon: template.icon,
          color: template.color,
          moduleKeys: template.moduleKeys,
          config: template.config,
          isDefault: false,
        }),
      });

      if (res.ok) {
        toast.success('Template duplicado');
        fetchTemplates();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Error al duplicar');
      }
    } catch (error) {
      toast.error('Error al duplicar template');
    }
  }

  function toggleModule(moduleKey: string) {
    setFormData(prev => ({
      ...prev,
      moduleKeys: prev.moduleKeys.includes(moduleKey)
        ? prev.moduleKeys.filter(k => k !== moduleKey)
        : [...prev.moduleKeys, moduleKey],
    }));
  }

  // Group modules by category
  const modulesByCategory = modules.reduce((acc, module) => {
    if (!acc[module.category]) {
      acc[module.category] = [];
    }
    acc[module.category].push(module);
    return acc;
  }, {} as Record<string, Module[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Templates de Empresas</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Crea presets de módulos para aplicar al crear nuevas empresas
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Template
        </Button>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => {
          const IconComponent = iconMap[template.icon || 'Package'] || Package;
          return (
            <Card
              key={template.id}
              className={cn(
                "hover:border-primary/50 transition-all cursor-pointer group",
                template.isDefault && "border-primary/50"
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${template.color}20` }}
                    >
                      <IconComponent className="h-5 w-5" style={{ color: template.color }} />
                    </div>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {template.name}
                        {template.isDefault && (
                          <Star className="h-4 w-4 text-warning-muted-foreground fill-yellow-500" />
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {template.companiesCount} empresas usando este template
                      </CardDescription>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(template)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicate(template)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicar
                      </DropdownMenuItem>
                      {!template.isDefault && (
                        <DropdownMenuItem onClick={() => handleSetDefault(template)}>
                          <Star className="h-4 w-4 mr-2" />
                          Establecer como predeterminado
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDelete(template)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                  {template.description || 'Sin descripción'}
                </p>
                <div className="flex flex-wrap gap-1">
                  {(template.moduleKeys || []).slice(0, 4).map((key) => (
                    <Badge key={key} variant="outline" className="text-[10px]">
                      {key}
                    </Badge>
                  ))}
                  {(template.moduleKeys || []).length > 4 && (
                    <Badge variant="outline" className="text-[10px]">
                      +{template.moduleKeys.length - 4} más
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Editar Template' : 'Nuevo Template'}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? 'Modifica la configuración del template'
                : 'Crea un nuevo template para aplicar a empresas'}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="general" className="flex-1 overflow-hidden flex flex-col">
            <TabsList>
              <TabsTrigger value="general">
                General
              </TabsTrigger>
              <TabsTrigger value="modules">
                Módulos ({formData.moduleKeys.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="flex-1 overflow-auto space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Enterprise"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descripción</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe para qué tipo de empresas es ideal este template..."
                  className="min-h-[100px]"
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
                <div>
                  <Label>Template Predeterminado</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Se aplicará automáticamente a nuevas empresas
                  </p>
                </div>
                <Switch
                  checked={formData.isDefault}
                  onCheckedChange={(checked) => setFormData({ ...formData, isDefault: checked })}
                />
              </div>
            </TabsContent>

            <TabsContent value="modules" className="flex-1 overflow-hidden mt-4">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-6">
                  {Object.entries(modulesByCategory).map(([category, categoryModules]) => (
                    <div key={category}>
                      <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                        <Badge className={cn("text-xs", categoryColors[category])}>
                          {category}
                        </Badge>
                        <span className="text-muted-foreground/60">
                          ({categoryModules.filter(m => formData.moduleKeys.includes(m.key)).length}/{categoryModules.length})
                        </span>
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        {categoryModules.map((module) => (
                          <div
                            key={module.key}
                            onClick={() => toggleModule(module.key)}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                              formData.moduleKeys.includes(module.key)
                                ? "bg-primary/10 border-primary/30"
                                : "bg-muted/50 border-border hover:border-primary/30"
                            )}
                          >
                            <Checkbox
                              checked={formData.moduleKeys.includes(module.key)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{module.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{module.key}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          <DialogFooter className="border-t pt-4">
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              {editingTemplate ? 'Guardar Cambios' : 'Crear Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
