'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogBody,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Plus,
  Layers,
  MoreHorizontal,
  Pencil,
  Trash2,
  Archive,
  Briefcase,
  BookOpen,
  Home,
  Star,
  Wrench,
  ShoppingCart,
  Heart,
  Zap,
  Globe,
  Users,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';
import { cn } from '@/lib/utils';
import { useApiMutation, createFetchMutation } from '@/hooks/use-api-mutation';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface TaskGroup {
  id: number;
  name: string;
  color: string;
  icon: string | null;
  description: string | null;
  isArchived: boolean;
  companyId: number;
  createdById: number;
  taskCount: number;
  agendaTaskCount: number;
  totalCount: number;
}

interface TaskGroupsSidebarProps {
  groups: TaskGroup[];
  selectedGroupId: number | null;
  onGroupSelect: (groupId: number | null) => void;
  companyId: number;
  onGroupsChange: () => void;
}

// ─── Íconos disponibles ───────────────────────────────────────────────────────

const ICON_OPTIONS = [
  { name: 'Briefcase', component: Briefcase },
  { name: 'BookOpen', component: BookOpen },
  { name: 'Home', component: Home },
  { name: 'Star', component: Star },
  { name: 'Wrench', component: Wrench },
  { name: 'ShoppingCart', component: ShoppingCart },
  { name: 'Heart', component: Heart },
  { name: 'Zap', component: Zap },
  { name: 'Globe', component: Globe },
  { name: 'Users', component: Users },
  { name: 'Layers', component: Layers },
];

const COLOR_OPTIONS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#06b6d4', '#ef4444', '#64748b',
];

// ─── Helper: renderizar ícono ─────────────────────────────────────────────────

function GroupIcon({ iconName, color, size = 14 }: { iconName: string | null; color: string; size?: number }) {
  const option = ICON_OPTIONS.find((o) => o.name === iconName);
  const IconComponent = option?.component ?? Layers;
  return <IconComponent style={{ color, width: size, height: size }} />;
}

// ─── Dialog para crear/editar grupo ──────────────────────────────────────────

function GroupDialog({
  open, onClose, companyId, group, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  companyId: number;
  group?: TaskGroup;
  onSaved: () => void;
}) {
  const isEditing = !!group;
  const [name, setName] = useState(group?.name || '');
  const [color, setColor] = useState(group?.color || '#6366f1');
  const [icon, setIcon] = useState<string | null>(group?.icon || null);
  const [description, setDescription] = useState(group?.description || '');

  const createMutation = useApiMutation({
    mutationFn: createFetchMutation({ url: '/api/task-groups', method: 'POST' }),
    invalidateKeys: [['task-groups']],
    successMessage: 'Grupo creado',
    errorMessage: 'Error al guardar grupo',
    onSuccess: () => { onSaved(); onClose(); },
  });

  const updateMutation = useApiMutation({
    mutationFn: createFetchMutation({
      url: (vars) => `/api/task-groups/${vars.id}`,
      method: 'PUT',
    }),
    invalidateKeys: [['task-groups']],
    successMessage: 'Grupo actualizado',
    errorMessage: 'Error al guardar grupo',
    onSuccess: () => { onSaved(); onClose(); },
  });

  const loading = createMutation.isPending || updateMutation.isPending;

  const handleSave = () => {
    if (!name.trim()) { toast.error('El nombre es requerido'); return; }
    const payload = { name: name.trim(), color, icon, description: description.trim() || null, companyId };
    if (isEditing) {
      updateMutation.mutate({ id: group!.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar grupo' : 'Nuevo grupo'}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Nombre</label>
            <Input placeholder="Ej: Estudio Contable" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoFocus />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_OPTIONS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{ backgroundColor: c, borderColor: color === c ? 'white' : 'transparent', outline: color === c ? `2px solid ${c}` : 'none' }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Ícono</label>
            <div className="flex gap-2 flex-wrap">
              {ICON_OPTIONS.map((opt) => {
                const IconComp = opt.component;
                const selected = icon === opt.name;
                return (
                  <button key={opt.name} type="button" onClick={() => setIcon(selected ? null : opt.name)}
                    className="w-8 h-8 rounded-lg border flex items-center justify-center transition-colors"
                    style={{ backgroundColor: selected ? `${color}20` : undefined, borderColor: selected ? color : undefined }}>
                    <IconComp style={{ color: selected ? color : undefined, width: 16, height: 16 }} />
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Descripción (opcional)</label>
            <Textarea placeholder="Descripción del grupo..." value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="resize-none" />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading || !name.trim()}>
            {loading ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear grupo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function TaskGroupsSidebar({
  groups, selectedGroupId, onGroupSelect, companyId, onGroupsChange,
}: TaskGroupsSidebarProps) {
  const confirm = useConfirm();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TaskGroup | undefined>(undefined);
  const [collapsed, setCollapsed] = useState(false);

  const totalCount = groups.reduce((acc, g) => acc + g.totalCount, 0);

  const deleteMutation = useApiMutation<unknown, { id: number }>({
    mutationFn: createFetchMutation({
      url: (vars) => `/api/task-groups/${vars.id}`,
      method: 'DELETE',
    }),
    invalidateKeys: [['task-groups']],
    successMessage: 'Grupo eliminado',
    errorMessage: 'Error al eliminar grupo',
    onSuccess: (_data, vars) => {
      if (selectedGroupId === vars.id) onGroupSelect(null);
      onGroupsChange();
    },
  });

  const archiveMutation = useApiMutation<unknown, { id: number; isArchived: boolean }>({
    mutationFn: createFetchMutation({
      url: (vars) => `/api/task-groups/${vars.id}`,
      method: 'PUT',
    }),
    invalidateKeys: [['task-groups']],
    successMessage: null,
    errorMessage: 'Error al archivar grupo',
    onSuccess: (_data, vars) => {
      toast.success(vars.isArchived ? 'Grupo archivado' : 'Grupo desarchivado');
      if (selectedGroupId === vars.id) onGroupSelect(null);
      onGroupsChange();
    },
  });

  const handleDelete = async (group: TaskGroup) => {
    const confirmed = await confirm({
      title: '¿Estás seguro?',
      description: `¿Eliminar el grupo "${group.name}"? Las tareas quedarán sin grupo.`,
      variant: 'destructive',
    });
    if (!confirmed) return;
    deleteMutation.mutate({ id: group.id });
  };

  const handleArchive = (group: TaskGroup) => {
    archiveMutation.mutate({ id: group.id, isArchived: !group.isArchived });
  };

  // ── Sin grupos: mostrar solo un botón compacto ────────────────────────────
  if (groups.length === 0) {
    return (
      <>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 flex-shrink-0 text-muted-foreground"
                onClick={() => setShowCreateDialog(true)}
              >
                <Layers className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Crear grupo de tareas</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {showCreateDialog && (
          <GroupDialog
            open={showCreateDialog}
            onClose={() => setShowCreateDialog(false)}
            companyId={companyId}
            onSaved={onGroupsChange}
          />
        )}
      </>
    );
  }

  // ── Colapsado: tira estrecha con puntos de color ──────────────────────────
  if (collapsed) {
    return (
      <>
        <TooltipProvider>
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
            {/* Botón expandir */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setCollapsed(false)}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Expandir grupos</TooltipContent>
            </Tooltip>

            {/* Punto "Todas" */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onGroupSelect(null)}
                  className={cn(
                    "w-3 h-3 rounded-full bg-muted-foreground/40 hover:bg-muted-foreground/70 transition-colors",
                    selectedGroupId === null && "ring-2 ring-offset-1 ring-muted-foreground"
                  )}
                />
              </TooltipTrigger>
              <TooltipContent side="right">Todas las tareas ({totalCount})</TooltipContent>
            </Tooltip>

            <div className="w-px h-3 bg-border" />

            {/* Puntos de cada grupo */}
            {groups.map((g) => (
              <Tooltip key={g.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onGroupSelect(g.id)}
                    className={cn(
                      "w-3 h-3 rounded-full transition-all hover:scale-125",
                      selectedGroupId === g.id && "ring-2 ring-offset-1"
                    )}
                    style={{
                      backgroundColor: g.color,
                      ...(selectedGroupId === g.id ? { outlineColor: g.color } : {}),
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent side="right">{g.name} ({g.totalCount})</TooltipContent>
              </Tooltip>
            ))}

            {/* Botón nuevo grupo */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 mt-1" onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Nuevo grupo</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>

        {showCreateDialog && (
          <GroupDialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} companyId={companyId} onSaved={onGroupsChange} />
        )}
        {editingGroup && (
          <GroupDialog open={!!editingGroup} onClose={() => setEditingGroup(undefined)} companyId={companyId} group={editingGroup} onSaved={onGroupsChange} />
        )}
      </>
    );
  }

  // ── Expandido: sidebar completo ───────────────────────────────────────────
  return (
    <>
      <Card className="flex flex-col h-full w-44 flex-shrink-0">
        <CardHeader className="pb-2 px-3 pt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Grupos</span>
              <span className="text-xs text-muted-foreground">({groups.length})</span>
            </div>
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowCreateDialog(true)} title="Nuevo grupo">
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setCollapsed(true)} title="Colapsar">
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden px-2 pb-2">
          <ScrollArea className="h-full">
            <div className="space-y-0.5">
              {/* Opción "Todas" */}
              <button
                onClick={() => onGroupSelect(null)}
                className={cn(
                  "w-full flex items-center justify-between px-2 py-2 rounded-lg text-left transition-colors hover:bg-muted/60",
                  selectedGroupId === null && "bg-muted"
                )}
              >
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40" />
                  <span className="text-sm font-medium">Todas</span>
                </div>
                <Badge variant="secondary" className="text-xs h-5">{totalCount}</Badge>
              </button>

              <div className="h-px bg-border mx-2 my-1" />

              {/* Grupos */}
              {groups.map((group) => (
                <div
                  key={group.id}
                  className={cn(
                    "flex items-center gap-1 rounded-lg transition-colors hover:bg-muted/60 group",
                    selectedGroupId === group.id && "bg-muted"
                  )}
                >
                  <button
                    onClick={() => onGroupSelect(group.id)}
                    className="flex-1 flex items-center justify-between px-2 py-2 text-left min-w-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          {group.icon && <GroupIcon iconName={group.icon} color={group.color} size={11} />}
                          <span className="text-sm font-medium truncate">{group.name}</span>
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className="text-xs h-5 flex-shrink-0 ml-1"
                      style={selectedGroupId === group.id ? { backgroundColor: `${group.color}20`, color: group.color } : {}}
                    >
                      {group.totalCount}
                    </Badge>
                  </button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost" size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:opacity-100 mr-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => setEditingGroup(group)}>
                        <Pencil className="h-4 w-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleArchive(group)}>
                        <Archive className="h-4 w-4 mr-2" /> {group.isArchived ? 'Desarchivar' : 'Archivar'}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(group)}>
                        <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {showCreateDialog && (
        <GroupDialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} companyId={companyId} onSaved={onGroupsChange} />
      )}
      {editingGroup && (
        <GroupDialog open={!!editingGroup} onClose={() => setEditingGroup(undefined)} companyId={companyId} group={editingGroup} onSaved={onGroupsChange} />
      )}
    </>
  );
}
