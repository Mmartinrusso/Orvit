'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ListChecks,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Search,
  ArrowLeft,
  CheckSquare,
  Hash,
  FileText,
  Play,
  Eye,
  Layers,
  CheckCircle2,
  Type,
  SlidersHorizontal,
  Clock,
  Camera,
  Star,
  Users,
  Package,
  Cog,
  MoreHorizontal,
  History,
  CheckCircle,
  XCircle,
  AlertTriangle,
  User,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { toast } from 'sonner';
import Link from 'next/link';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import NewRoutineTemplateForm from '@/components/produccion/NewRoutineTemplateForm';
import NewRoutineExecutionForm from '@/components/produccion/NewRoutineExecutionForm';

interface RoutineTemplate {
  id: number;
  code: string;
  name: string;
  type: string;
  frequency: string;
  isActive: boolean;
  items: any[];
  sections?: any[];
  scheduleConfig?: any;
  workCenter: { id: number; name: string; code: string } | null;
  _count: { executions: number };
}

const ITEM_TYPE_ICONS: Record<string, React.ElementType> = {
  CHECK: CheckCircle2,
  VALUE: Hash,
  TEXT: Type,
  PHOTO: Camera,
  SELECT: SlidersHorizontal,
  CHECKBOX: CheckSquare,
  DATE: Clock,
  TIME: Clock,
  RATING: Star,
  EMPLOYEE_SELECT: Users,
  MATERIAL_INPUT: Package,
  MACHINE_SELECT: Cog,
  DEFAULT: FileText,
};

const ITEM_TYPE_LABELS: Record<string, string> = {
  CHECK: 'Verificación',
  VALUE: 'Valor numérico',
  TEXT: 'Texto',
  PHOTO: 'Foto',
  SELECT: 'Selección única',
  CHECKBOX: 'Selección múltiple',
  DATE: 'Fecha',
  TIME: 'Hora',
  RATING: 'Calificación',
  EMPLOYEE_SELECT: 'Empleados',
  MATERIAL_INPUT: 'Materiales',
  MACHINE_SELECT: 'Máquina/Equipo',
};

function TemplateDetailDialog({ template, open, onOpenChange }: { template: RoutineTemplate | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  if (!template) return null;

  const sections: any[] = template.sections || [];
  const items: any[] = Array.isArray(template.items) ? template.items : [];
  const hasSections = sections.length > 0;

  const getItemsForSection = (sectionId: string | null) => {
    if (!hasSections) return items;
    if (sectionId === null) return items.filter((i: any) => !i.sectionId);
    return items.filter((i: any) => i.sectionId === sectionId);
  };

  // Support both old format (description/inputs[]) and new format (question/type)
  const getItemText = (item: any) => item.question || item.description || item.label || '(Sin pregunta)';
  const getItemType = (item: any) => item.type || item.inputs?.[0]?.type || '';
  const getItemRequired = (item: any) => item.required ?? item.inputs?.[0]?.required ?? false;
  const getItemUnit = (item: any) => item.unit || item.inputs?.[0]?.unit;
  const getItemOptions = (item: any) => item.options || item.inputs?.[0]?.options || [];

  const renderItem = (item: any, idx: number) => {
    const itemType = getItemType(item);
    const Icon = ITEM_TYPE_ICONS[itemType] || ITEM_TYPE_ICONS.DEFAULT;
    const options = getItemOptions(item);
    return (
      <div key={item.id || idx} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
        <div className="flex-shrink-0 w-6 h-6 rounded-md bg-muted flex items-center justify-center mt-0.5">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground leading-snug">{getItemText(item)}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-muted-foreground">{ITEM_TYPE_LABELS[itemType] || itemType}</span>
            {getItemRequired(item) && (
              <span className="text-[10px] font-medium text-destructive">Obligatorio</span>
            )}
            {getItemUnit(item) && (
              <span className="text-[10px] text-muted-foreground">· Unidad: {getItemUnit(item)}</span>
            )}
            {options.length > 0 && (
              <span className="text-[10px] text-muted-foreground">· {options.map((o: any) => o.text || o.label).join(', ')}</span>
            )}
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground flex-shrink-0 mt-1">#{idx + 1}</span>
      </div>
    );
  };

  const sc = template.scheduleConfig;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-purple-600" />
            {template.name}
            <span className="font-mono text-xs text-muted-foreground ml-1">({template.code})</span>
          </DialogTitle>
          <DialogDescription>
            Vista de detalle — solo lectura
          </DialogDescription>
        </DialogHeader>

        {/* Meta info */}
        <div className="flex flex-wrap gap-2 py-2 border-b border-border">
          <Badge className={`${(ROUTINE_TYPES[template.type] || { color: 'bg-muted-foreground' }).color} text-white text-xs`}>
            {(ROUTINE_TYPES[template.type] || { label: template.type }).label}
          </Badge>
          <Badge variant="outline" className="text-xs">{FREQUENCIES[template.frequency] || template.frequency}</Badge>
          <Badge variant="outline" className="text-xs">{items.length} ítems</Badge>
          {hasSections && <Badge variant="outline" className="text-xs">{sections.length} secciones</Badge>}
          {template.isActive
            ? <Badge variant="secondary" className="text-success bg-success-muted text-xs">Activa</Badge>
            : <Badge variant="secondary" className="text-muted-foreground bg-muted text-xs">Inactiva</Badge>
          }
          {sc?.enabled && (
            <Badge variant="outline" className="text-xs text-primary border-primary/40">
              ⏱ Cierre: {sc.resetType === 'DAILY' ? 'Diario' : 'Semanal'} {sc.resetTime}
            </Badge>
          )}
        </div>

        {/* Items organized by sections */}
        <div className="space-y-4 py-2">
          {hasSections ? (
            <>
              {/* Items without section */}
              {getItemsForSection(null).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    Sin sección
                  </p>
                  <div className="bg-muted/30 rounded-lg px-3 py-1">
                    {getItemsForSection(null).map((item: any, idx: number) => renderItem(item, idx))}
                  </div>
                </div>
              )}

              {/* Items by section */}
              {sections.map((section: any) => {
                const sectionItems = getItemsForSection(section.id);
                return (
                  <div key={section.id}>
                    <p className="text-xs font-medium text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-primary" />
                      {section.name}
                      <span className="font-normal text-muted-foreground normal-case">({sectionItems.length} ítems)</span>
                    </p>
                    <div className="bg-primary/5 border border-primary/10 rounded-lg px-3 py-1">
                      {sectionItems.length > 0
                        ? sectionItems.map((item: any, idx: number) => renderItem(item, idx))
                        : <p className="text-xs text-muted-foreground py-2 text-center">Sin ítems en esta sección</p>
                      }
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Preguntas</p>
              <div className="bg-muted/30 rounded-lg px-3 py-1">
                {items.length > 0
                  ? items.map((item: any, idx: number) => renderItem(item, idx))
                  : <p className="text-xs text-muted-foreground py-4 text-center">Sin ítems configurados</p>
                }
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const EXECUTION_STATUS: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  COMPLETED:  { label: 'Completa',    icon: CheckCircle,    className: 'text-success' },
  DRAFT:      { label: 'En progreso', icon: Clock,          className: 'text-warning-muted-foreground' },
  INCOMPLETE: { label: 'Incompleta',  icon: XCircle,        className: 'text-destructive' },
};

function ExecutionHistoryDialog({ templateId, templateName, open, onOpenChange }: {
  templateId: number | null;
  templateName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [executions, setExecutions] = React.useState<any[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open || !templateId) return;
    setLoading(true);
    fetch(`/api/production/routines/templates/${templateId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setExecutions(data.template.executions || []);
          setTotalCount(data.template._count?.executions ?? 0);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, templateId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Ejecuciones — {templateName}
          </DialogTitle>
          <DialogDescription>
            {totalCount > 10 ? `Últimas 10 de ${totalCount} ejecuciones` : `${totalCount} ejecución(es) registrada(s)`}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : executions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
            <History className="h-8 w-8 opacity-30" />
            <p className="text-sm">Sin ejecuciones registradas</p>
          </div>
        ) : (
          <div className="space-y-2 py-1">
            {executions.map((ex: any) => {
              const status = EXECUTION_STATUS[ex.status] || EXECUTION_STATUS.COMPLETED;
              const StatusIcon = status.icon;
              const execDate = ex.executedAt ? new Date(ex.executedAt) : null;
              return (
                <div key={ex.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors">
                  <StatusIcon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${status.className}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-medium ${status.className}`}>{status.label}</span>
                      {ex.hasIssues && (
                        <span className="flex items-center gap-1 text-xs text-warning-muted-foreground">
                          <AlertTriangle className="h-3 w-3" /> Con problemas
                        </span>
                      )}
                      {ex.shift?.name && (
                        <span className="text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5">{ex.shift.name}</span>
                      )}
                    </div>
                    {ex.issueDescription && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{ex.issueDescription}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      {ex.executedBy?.name && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />{ex.executedBy.name}
                        </span>
                      )}
                      {execDate && (
                        <span className="text-xs text-muted-foreground">
                          {execDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          {' · '}
                          {execDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const ROUTINE_TYPES: Record<string, { label: string; color: string }> = {
  SHIFT_START: { label: 'Inicio de Turno', color: 'bg-info' },
  SHIFT_END: { label: 'Fin de Turno', color: 'bg-indigo-500' },
  SETUP: { label: 'Setup/Cambio', color: 'bg-purple-500' },
  SAFETY: { label: 'Seguridad', color: 'bg-destructive' },
  '5S': { label: '5S', color: 'bg-success' },
};

const FREQUENCIES: Record<string, string> = {
  EVERY_SHIFT: 'Cada turno',
  DAILY: 'Diario',
  WEEKLY: 'Semanal',
};

export default function RoutineTemplatesConfigPage() {
  const { currentSector } = useCompany();
  const { hasPermission } = useAuth();
  const canManageRoutines = hasPermission('produccion.config.routines');

  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<RoutineTemplate[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [executeDialogOpen, setExecuteDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [executionHistoryDialogOpen, setExecutionHistoryDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<RoutineTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/production/routines/templates?limit=200');
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar plantillas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const openCreateDialog = () => {
    setSelectedTemplate(null);
    setDialogOpen(true);
  };

  const openEditDialog = (template: RoutineTemplate) => {
    setSelectedTemplate(template);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedTemplate) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/production/routines/templates/${selectedTemplate.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.success) {
        toast.success(data.message || 'Plantilla eliminada');
        setDeleteDialogOpen(false);
        setSelectedTemplate(null);
        fetchTemplates();
      } else {
        toast.error(data.error || 'Error al eliminar');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al eliminar');
    } finally {
      setSaving(false);
    }
  };

  const filteredTemplates = templates.filter(
    (t) =>
      t.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTypeInfo = (type: string) => {
    return ROUTINE_TYPES[type] || { label: type, color: 'bg-muted-foreground' };
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/produccion/configuracion">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ListChecks className="h-6 w-6 text-purple-600" />
              Plantillas de Rutinas
            </h1>
            <p className="text-muted-foreground text-sm">
              Checklists operativos para turnos, setup y seguridad
            </p>
          </div>
        </div>

        {canManageRoutines && (
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Plantilla
          </Button>
        )}
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código o nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Frecuencia</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Ejecuciones</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-24">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTemplates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      <ListChecks className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      No se encontraron plantillas
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTemplates.map((template) => {
                    const typeInfo = getTypeInfo(template.type);
                    return (
                      <TableRow key={template.id}>
                        <TableCell className="font-mono">{template.code}</TableCell>
                        <TableCell className="font-medium">{template.name}</TableCell>
                        <TableCell>
                          <Badge className={`${typeInfo.color} text-white`}>
                            {typeInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>{FREQUENCIES[template.frequency] || template.frequency}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {Array.isArray(template.items) ? template.items.length : 0} items
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-muted-foreground">{template._count?.executions || 0}</span>
                        </TableCell>
                        <TableCell>
                          {template.isActive ? (
                            <Badge variant="secondary" className="text-success bg-success-muted">
                              Activa
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-muted-foreground bg-muted">
                              Inactiva
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {template.isActive && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setSelectedTemplate(template);
                                  setExecuteDialogOpen(true);
                                }}
                                title="Ejecutar rutina"
                              >
                                <Play className="h-4 w-4 text-success" />
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedTemplate(template);
                                    setDetailDialogOpen(true);
                                  }}
                                >
                                  <Eye className="h-4 w-4 mr-2 text-muted-foreground" />
                                  Ver plantilla
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedTemplate(template);
                                    setExecutionHistoryDialogOpen(true);
                                  }}
                                >
                                  <History className="h-4 w-4 mr-2 text-muted-foreground" />
                                  Ver ejecuciones
                                </DropdownMenuItem>
                                {canManageRoutines && (
                                  <DropdownMenuItem onClick={() => openEditDialog(template)}>
                                    <Edit2 className="h-4 w-4 mr-2" />
                                    Editar
                                  </DropdownMenuItem>
                                )}
                                {canManageRoutines && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => {
                                        setSelectedTemplate(template);
                                        setDeleteDialogOpen(true);
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Eliminar
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) setSelectedTemplate(null);
      }}>
        <DialogContent size="full" className="max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 py-4 border-b sticky top-0 bg-background z-10">
            <DialogTitle>
              {selectedTemplate ? 'Editar Plantilla' : 'Nueva Plantilla de Rutina'}
            </DialogTitle>
            <DialogDescription>
              {selectedTemplate
                ? 'Modifica los datos de la plantilla'
                : 'Configure una nueva plantilla de rutina operativa'}
            </DialogDescription>
          </DialogHeader>
          <div className="p-6">
          <NewRoutineTemplateForm
            template={selectedTemplate}
            defaultSectorId={currentSector?.id}
            onSuccess={() => {
              setDialogOpen(false);
              setSelectedTemplate(null);
              fetchTemplates();
            }}
            onCancel={() => {
              setDialogOpen(false);
              setSelectedTemplate(null);
            }}
          />
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Plantilla</DialogTitle>
            <DialogDescription asChild>
              <div>
                <span>¿Estás seguro de eliminar <strong>"{selectedTemplate?.name}"</strong>?</span>
                {selectedTemplate?._count?.executions ? (
                  <span className="block mt-2 text-destructive font-medium">
                    ⚠️ Esta plantilla tiene {selectedTemplate._count.executions} ejecución(es) que también serán eliminadas permanentemente.
                  </span>
                ) : null}
                <span className="block mt-2 text-muted-foreground text-sm">Esta acción no se puede deshacer.</span>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedTemplate?._count?.executions ? 'Eliminar todo' : 'Eliminar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <TemplateDetailDialog
        template={selectedTemplate}
        open={detailDialogOpen}
        onOpenChange={(open) => {
          setDetailDialogOpen(open);
          if (!open) setSelectedTemplate(null);
        }}
      />

      {/* Execution History Dialog */}
      <ExecutionHistoryDialog
        templateId={selectedTemplate?.id ?? null}
        templateName={selectedTemplate?.name ?? ''}
        open={executionHistoryDialogOpen}
        onOpenChange={(open) => {
          setExecutionHistoryDialogOpen(open);
          if (!open) setSelectedTemplate(null);
        }}
      />

      {/* Execute Dialog */}
      <Dialog open={executeDialogOpen} onOpenChange={(open) => {
        setExecuteDialogOpen(open);
        if (!open) setSelectedTemplate(null);
      }}>
        <DialogContent className="!max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="flex-shrink-0 px-6 py-4 border-b sticky top-0 bg-background z-10">
            <DialogTitle>Ejecutar Rutina</DialogTitle>
            <DialogDescription>
              Ejecutar rutina: {selectedTemplate?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4">
            <NewRoutineExecutionForm
              preselectedTemplate={selectedTemplate as any}
              onSuccess={() => {
                setExecuteDialogOpen(false);
                setSelectedTemplate(null);
                fetchTemplates(); // Refresh to update execution count
                toast.success('Rutina ejecutada correctamente');
              }}
              onCancel={() => {
                setExecuteDialogOpen(false);
                setSelectedTemplate(null);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
