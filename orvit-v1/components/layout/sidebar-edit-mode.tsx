'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  DndContext, DragEndEvent, DragOverEvent, PointerSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  GripVertical, ChevronRight, Plus, Trash2, Pencil,
  RotateCcw, Check, X, Search, Loader2, Save,
  Users, DollarSign, Calculator, ShoppingCart, Wallet, Receipt, Warehouse,
  Zap, Shield, Truck, Folder, LayoutDashboard, Database, Package,
  FileText, BarChart3, Settings, Target, Factory, Star, Calendar,
  AlertTriangle, ClipboardList, Wrench, Car, TrendingUp, Heart,
  Building2, Tag, CreditCard, Banknote, Scale, BookOpen, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';

import {
  useUpdateAdminSidebar,
  useUpdateCompanySidebarConfig,
  type CompanySidebarConfigResponse,
} from '@/hooks/use-company-sidebar-config';
import {
  getEffectiveConfig,
  getAllLeafItems,
  ADMIN_ORDERABLE_MODULES,
  DEFAULT_ADMIN_MODULE_ORDER,
  getModuleByKey,
  type SidebarModuleKey,
  type ModuleSidebarConfig,
  type SidebarGroupNode,
  type SidebarNode,
  type CustomAdminGroup,
} from '@/lib/sidebar/company-sidebar-config';

// ─── Types ────────────────────────────────────────────────────────────────────

type SectionType = 'module' | 'simple' | 'custom';

// ─── Constants ────────────────────────────────────────────────────────────────

const EDITABLE_MODULES = new Set<SidebarModuleKey>([
  'ventas', 'compras', 'tesoreria', 'nominas', 'almacen', 'mantenimiento', 'produccion',
]);

const SECTION_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  personal: Users,
  ventas: DollarSign,
  costos: Calculator,
  compras: ShoppingCart,
  tesoreria: Wallet,
  nominas: Receipt,
  almacen: Warehouse,
  automatizaciones: Zap,
  controles: Shield,
  cargas: Truck,
};

const ICON_OPTIONS: Array<{ value: string; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
  { value: 'Folder', label: 'Carpeta', Icon: Folder },
  { value: 'DollarSign', label: 'Ventas', Icon: DollarSign },
  { value: 'Users', label: 'Personas', Icon: Users },
  { value: 'Package', label: 'Paquete', Icon: Package },
  { value: 'ShoppingCart', label: 'Compras', Icon: ShoppingCart },
  { value: 'Receipt', label: 'Recibo', Icon: Receipt },
  { value: 'Wallet', label: 'Billetera', Icon: Wallet },
  { value: 'BarChart3', label: 'Análisis', Icon: BarChart3 },
  { value: 'Settings', label: 'Config', Icon: Settings },
  { value: 'Zap', label: 'Auto', Icon: Zap },
  { value: 'Target', label: 'Objetivo', Icon: Target },
  { value: 'Factory', label: 'Producción', Icon: Factory },
  { value: 'Warehouse', label: 'Almacén', Icon: Warehouse },
  { value: 'Calculator', label: 'Costos', Icon: Calculator },
  { value: 'Star', label: 'Favorito', Icon: Star },
  { value: 'FileText', label: 'Docs', Icon: FileText },
  { value: 'LayoutDashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { value: 'Database', label: 'Datos', Icon: Database },
  { value: 'Calendar', label: 'Calendario', Icon: Calendar },
  { value: 'Shield', label: 'Control', Icon: Shield },
];

// Extra icon entries for item icons from module registries (not shown in ICON_OPTIONS picker)
const EXTRA_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ClipboardList, Wrench, Car, TrendingUp, Heart,
  Building2, Tag, CreditCard, Banknote, Scale, BookOpen, Clock,
  Truck, CheckCircle2: Check,
};

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = Object.fromEntries(
  ICON_OPTIONS.map(o => [o.value, o.Icon])
);

function resolveIcon(iconName: string): React.ComponentType<{ className?: string }> {
  return ICON_MAP[iconName] ?? SECTION_ICON_MAP[iconName] ?? EXTRA_ICONS[iconName] ?? Folder;
}

function getSectionDefaultLabel(key: string): string {
  return ADMIN_ORDERABLE_MODULES.find(m => m.key === key)?.label ?? key;
}

function getSectionType(
  key: string,
  customGroups: Record<string, CustomAdminGroup>,
  pendingGroups: Record<string, CustomAdminGroup>,
): SectionType {
  if (key in customGroups || key in pendingGroups) return 'custom';
  if (EDITABLE_MODULES.has(key as SidebarModuleKey)) return 'module';
  return 'simple';
}

function getChildId(child: SidebarNode): string {
  return child.type === 'item' ? child.moduleId : child.id;
}

// ─── SortableItemRow ─────────────────────────────────────────────────────────

function SortableItemRow({
  moduleId, name, itemIconName, groupId, moduleKey, onRemoveFromGroup,
}: {
  moduleId: string;
  name: string;
  itemIconName?: string;
  groupId: string;
  moduleKey: SidebarModuleKey;
  onRemoveFromGroup: (moduleId: string, groupId: string, mk: SidebarModuleKey) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: moduleId,
    data: { type: 'item', groupId, moduleKey },
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const ItemIcon = itemIconName ? resolveIcon(itemIconName) : null;

  return (
    <div ref={setNodeRef} style={style} className="group/item flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors cursor-default">
      <button
        {...attributes} {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none text-sidebar-foreground/30 hover:text-sidebar-foreground/70 shrink-0"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      {ItemIcon
        ? <ItemIcon className="h-4 w-4 shrink-0 text-sidebar-foreground/60" />
        : <div className="h-1.5 w-1.5 rounded-full bg-sidebar-foreground/30 shrink-0 ml-1 mr-0.5" />
      }
      <span className="flex-1 min-w-0 truncate">{name}</span>
      <button
        onClick={e => { e.stopPropagation(); onRemoveFromGroup(moduleId, groupId, moduleKey); }}
        className="opacity-0 group-hover/item:opacity-100 h-5 w-5 flex items-center justify-center hover:text-destructive transition-opacity shrink-0"
      >
        <X className="h-3 w-3 text-sidebar-foreground/50" />
      </button>
    </div>
  );
}

// ─── SortableGroupRow ─────────────────────────────────────────────────────────

function SortableGroupRow({
  group, moduleKey, isExpanded, onToggle,
  renamingGroupId, groupRenameValue, onStartRenameGroup, onConfirmRenameGroup, onCancelRenameGroup, onGroupRenameChange,
  onDeleteGroup, onRemoveItemFromGroup, dragOverGroupId,
}: {
  group: SidebarGroupNode;
  moduleKey: SidebarModuleKey;
  isExpanded: boolean;
  onToggle: () => void;
  renamingGroupId: string | null;
  groupRenameValue: string;
  onStartRenameGroup: (id: string, name: string) => void;
  onConfirmRenameGroup: () => void;
  onCancelRenameGroup: () => void;
  onGroupRenameChange: (v: string) => void;
  onDeleteGroup: (id: string, mk: SidebarModuleKey) => void;
  onRemoveItemFromGroup: (moduleId: string, groupId: string, mk: SidebarModuleKey) => void;
  dragOverGroupId: string | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: group.id,
    data: { type: 'group', moduleKey },
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const isFlat = group.name === '__flat__';
  const isRenaming = renamingGroupId === group.id;
  const GroupIcon = resolveIcon(group.icon);
  const isDropTarget = dragOverGroupId === group.id;
  const topChildren = group.children;

  // Flat group: render each item directly as a sidebar-style row (no group header)
  if (isFlat) {
    return (
      <div ref={setNodeRef} style={style}>
        {topChildren.map(child => {
          if (child.type !== 'item') return null;
          const mod = getModuleByKey(moduleKey, child.moduleId);
          const FlatIcon = resolveIcon(mod?.icon ?? '');
          return (
            <div key={child.moduleId} className="group/flatitem flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors cursor-default">
              <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none text-sidebar-foreground/30 hover:text-sidebar-foreground/70 shrink-0">
                <GripVertical className="h-3.5 w-3.5" />
              </button>
              <FlatIcon className="h-4 w-4 shrink-0 text-sidebar-foreground/60" />
              <span className="flex-1 min-w-0 truncate">{mod?.name ?? child.moduleId}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style}>
      {/* Group header */}
      <div className={cn(
        'group/grp flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors cursor-default',
        isDropTarget && 'ring-1 ring-primary/50 bg-primary/5',
      )}>
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none text-sidebar-foreground/30 hover:text-sidebar-foreground/70 shrink-0">
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <GroupIcon className="h-4 w-4 shrink-0 text-sidebar-foreground/60" />
        {isRenaming ? (
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <Input
              value={groupRenameValue}
              onChange={e => onGroupRenameChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onConfirmRenameGroup(); if (e.key === 'Escape') onCancelRenameGroup(); }}
              className="h-6 text-sm px-1.5 py-0 flex-1 min-w-0"
              autoFocus onClick={e => e.stopPropagation()}
            />
            <button onClick={e => { e.stopPropagation(); onConfirmRenameGroup(); }} className="text-green-600 shrink-0"><Check className="h-3.5 w-3.5" /></button>
            <button onClick={e => { e.stopPropagation(); onCancelRenameGroup(); }} className="text-muted-foreground shrink-0"><X className="h-3.5 w-3.5" /></button>
          </div>
        ) : (
          <>
            <button onClick={onToggle} className="flex-1 text-left font-medium truncate min-w-0">
              {group.name}
            </button>
            <div className="opacity-0 group-hover/grp:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity">
              <button onClick={e => { e.stopPropagation(); onStartRenameGroup(group.id, group.name); }} className="h-5 w-5 flex items-center justify-center hover:text-primary">
                <Pencil className="h-3 w-3 text-sidebar-foreground/50" />
              </button>
              <button onClick={e => { e.stopPropagation(); onDeleteGroup(group.id, moduleKey); }} className="h-5 w-5 flex items-center justify-center hover:text-destructive">
                <Trash2 className="h-3 w-3 text-sidebar-foreground/50" />
              </button>
            </div>
            <button onClick={onToggle} className="shrink-0">
              <ChevronRight className={cn('h-3.5 w-3.5 text-sidebar-foreground/40 transition-transform', isExpanded && 'rotate-90')} />
            </button>
          </>
        )}
      </div>

      {/* Items (DndContext lives in parent SortableSectionRow) */}
      {isExpanded && topChildren.length > 0 && (
        <div className="pl-6">
          <SortableContext items={topChildren.map(c => getChildId(c))} strategy={verticalListSortingStrategy}>
            {topChildren.map(child => {
              if (child.type === 'item') {
                const mod = getModuleByKey(moduleKey, child.moduleId);
                if (!mod) return null;
                return (
                  <SortableItemRow
                    key={child.moduleId} moduleId={child.moduleId} name={mod.name}
                    itemIconName={mod.icon}
                    groupId={group.id} moduleKey={moduleKey}
                    onRemoveFromGroup={onRemoveItemFromGroup}
                  />
                );
              }
              return (
                <div key={child.id} className="px-2 py-1 text-xs text-sidebar-foreground/40 font-medium uppercase tracking-wide">
                  {child.name}
                </div>
              );
            })}
          </SortableContext>
        </div>
      )}
    </div>
  );
}

// ─── OrphanedItemsPanel ───────────────────────────────────────────────────────

function OrphanedItemsPanel({
  items, groups, mk, onAssign, onLeaveUngrouped,
}: {
  items: SidebarNode[];
  groups: SidebarGroupNode[];
  mk: SidebarModuleKey;
  onAssign: (item: SidebarNode, toGroupId: string, mk: SidebarModuleKey) => void;
  onLeaveUngrouped: (item: SidebarNode, mk: SidebarModuleKey) => void;
}) {
  const leafItems = items.filter(i => i.type === 'item');
  const namedGroups = groups.filter(g => g.name !== '__flat__');
  if (leafItems.length === 0) return null;
  return (
    <div className="mt-1 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2">
      <p className="text-[10px] font-medium text-amber-700 dark:text-amber-400 mb-1.5 flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" /> Pendiente de asignar
      </p>
      <div className="flex flex-col gap-1.5">
        {leafItems.map(item => {
          if (item.type !== 'item') return null;
          const mod = getModuleByKey(mk, item.moduleId);
          return (
            <div key={item.moduleId} className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">{mod?.name ?? item.moduleId}</span>
              <div className="flex flex-wrap gap-1">
                {/* Siempre disponible: dejar sin grupo (aparece directo en el sidebar) */}
                <button
                  onClick={() => onLeaveUngrouped(item, mk)}
                  className="text-[10px] px-1.5 py-0.5 rounded border border-amber-400/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                >
                  Sin grupo
                </button>
                {namedGroups.map(g => (
                  <button
                    key={g.id}
                    onClick={() => onAssign(item, g.id, mk)}
                    className="text-[10px] px-1.5 py-0.5 rounded border border-amber-400/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                  >
                    → {g.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SortableSectionRow ───────────────────────────────────────────────────────

function SortableSectionRow({
  sectionKey, label, sectionType, isExpanded, onToggle,
  renamingKey, renameValue, onStartRename, onConfirmRename, onCancelRename, onRenameChange,
  onDelete,
  // module props
  moduleConfig, renamingGroupId, groupRenameValue, expandedGroups, onToggleGroup,
  onStartRenameGroup, onConfirmRenameGroup, onCancelRenameGroup, onGroupRenameChange,
  onDeleteGroup, onMoveItemToGroup, onItemReorder, onRemoveItemFromGroup, onGroupReorder,
  onMoveCrossGroup, onAddGroup,
  pendingNewGroup, onPendingGroupChange, onConfirmNewGroup, onCancelNewGroup,
  // custom group props
  customGroupPreview,
  // orphaned items
  orphanedItems,
  onAssignOrphaned,
  onLeaveOrphanedUngrouped,
}: {
  sectionKey: string;
  label: string;
  sectionType: SectionType;
  isExpanded: boolean;
  onToggle: () => void;
  renamingKey: string | null;
  renameValue: string;
  onStartRename: (key: string, currentLabel: string) => void;
  onConfirmRename: () => void;
  onCancelRename: () => void;
  onRenameChange: (v: string) => void;
  onDelete: (key: string) => void;
  moduleConfig?: ModuleSidebarConfig;
  renamingGroupId: string | null;
  groupRenameValue: string;
  expandedGroups: Set<string>;
  onToggleGroup: (id: string) => void;
  onStartRenameGroup: (id: string, name: string) => void;
  onConfirmRenameGroup: () => void;
  onCancelRenameGroup: () => void;
  onGroupRenameChange: (v: string) => void;
  onDeleteGroup: (id: string, mk: SidebarModuleKey) => void;
  onMoveItemToGroup: (moduleId: string, from: string, to: string, mk: SidebarModuleKey) => void;
  onItemReorder: (mk: SidebarModuleKey, groupId: string, from: number, to: number) => void;
  onRemoveItemFromGroup: (moduleId: string, groupId: string, mk: SidebarModuleKey) => void;
  onGroupReorder: (mk: SidebarModuleKey, from: number, to: number) => void;
  onMoveCrossGroup: (mk: SidebarModuleKey, moduleId: string, fromGroupId: string, toGroupId: string, atIndex: number) => void;
  onAddGroup: (mk: SidebarModuleKey) => void;
  pendingNewGroup: string | null;
  onPendingGroupChange: (v: string) => void;
  onConfirmNewGroup: (mk: SidebarModuleKey) => void;
  onCancelNewGroup: () => void;
  customGroupPreview?: string[];
  orphanedItems?: SidebarNode[];
  onAssignOrphaned?: (item: SidebarNode, toGroupId: string, mk: SidebarModuleKey) => void;
  onLeaveOrphanedUngrouped?: (item: SidebarNode, mk: SidebarModuleKey) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sectionKey,
    data: { type: 'section' },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
  };
  const isRenaming = renamingKey === sectionKey;
  const SectionIcon = resolveIcon(sectionKey);
  const isModule = sectionType === 'module';
  const mk = sectionKey as SidebarModuleKey;

  const moduleSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);

  function handleModuleDragEnd(event: DragEndEvent) {
    if (!moduleConfig) return;
    const { active, over } = event;
    setDragOverGroupId(null);
    if (!over || active.id === over.id) return;

    const activeType = active.data.current?.type as 'group' | 'item' | undefined;
    const overType = over.data.current?.type as 'group' | 'item' | undefined;

    if (activeType === 'group' && overType === 'group') {
      const fromIdx = moduleConfig.groups.findIndex(g => g.id === active.id);
      const toIdx = moduleConfig.groups.findIndex(g => g.id === over.id);
      if (fromIdx >= 0 && toIdx >= 0) onGroupReorder(mk, fromIdx, toIdx);

    } else if (activeType === 'item' && overType === 'item') {
      const fromGroupId = active.data.current?.groupId as string;
      const toGroupId = over.data.current?.groupId as string;
      if (fromGroupId === toGroupId) {
        const group = moduleConfig.groups.find(g => g.id === fromGroupId);
        if (!group) return;
        const fromIdx = group.children.findIndex(c => getChildId(c) === String(active.id));
        const toIdx = group.children.findIndex(c => getChildId(c) === String(over.id));
        if (fromIdx >= 0 && toIdx >= 0) onItemReorder(mk, fromGroupId, fromIdx, toIdx);
      } else {
        const toGroup = moduleConfig.groups.find(g => g.id === toGroupId);
        if (!toGroup) return;
        const atIdx = toGroup.children.findIndex(c => getChildId(c) === String(over.id));
        onMoveCrossGroup(mk, String(active.id), fromGroupId, toGroupId, atIdx >= 0 ? atIdx : toGroup.children.length);
      }

    } else if (activeType === 'item' && overType === 'group') {
      const fromGroupId = active.data.current?.groupId as string;
      const toGroupId = String(over.id);
      if (fromGroupId !== toGroupId) {
        onMoveItemToGroup(String(active.id), fromGroupId, toGroupId, mk);
      }
    }
  }

  function handleModuleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) { setDragOverGroupId(null); return; }
    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;
    setDragOverGroupId(activeType === 'item' && overType === 'group' ? String(over.id) : null);
  }

  return (
    <div ref={setNodeRef} style={style}>
      {/* Section header — same visual as sidebar */}
      <div className={cn(
        'group/sec flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors cursor-default',
        isDragging && 'opacity-50',
      )}>
        <button
          {...attributes} {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none text-sidebar-foreground/30 hover:text-sidebar-foreground/70 shrink-0"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <SectionIcon className="h-4 w-4 shrink-0 text-sidebar-foreground/70" />
        {isRenaming ? (
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <Input
              value={renameValue}
              onChange={e => onRenameChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onConfirmRename(); if (e.key === 'Escape') onCancelRename(); }}
              className="h-6 text-sm px-2 py-0 flex-1 min-w-0"
              autoFocus onClick={e => e.stopPropagation()}
            />
            <button onClick={e => { e.stopPropagation(); onConfirmRename(); }} className="text-green-600 shrink-0"><Check className="h-3.5 w-3.5" /></button>
            <button onClick={e => { e.stopPropagation(); onCancelRename(); }} className="text-muted-foreground shrink-0"><X className="h-3.5 w-3.5" /></button>
          </div>
        ) : (
          <>
            {isModule ? (
              <button onClick={onToggle} className="flex-1 text-left font-medium truncate min-w-0">{label}</button>
            ) : (
              <span className="flex-1 font-medium truncate min-w-0">{label}</span>
            )}
            <div className="opacity-0 group-hover/sec:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity">
              <button onClick={e => { e.stopPropagation(); onStartRename(sectionKey, label); }} className="h-5 w-5 flex items-center justify-center hover:text-primary">
                <Pencil className="h-3 w-3 text-sidebar-foreground/50" />
              </button>
              <button onClick={e => { e.stopPropagation(); onDelete(sectionKey); }} className="h-5 w-5 flex items-center justify-center hover:text-destructive">
                <Trash2 className="h-3 w-3 text-sidebar-foreground/50" />
              </button>
            </div>
            {isModule && (
              <button onClick={onToggle} className="shrink-0">
                <ChevronRight className={cn('h-3.5 w-3.5 text-sidebar-foreground/40 transition-transform', isExpanded && 'rotate-90')} />
              </button>
            )}
          </>
        )}
      </div>

      {/* Custom group items preview */}
      {sectionType === 'custom' && customGroupPreview && customGroupPreview.length > 0 && (
        <div className="pl-8 pb-1 flex flex-wrap gap-1">
          {customGroupPreview.map(name => (
            <span key={name} className="text-xs text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full">{name}</span>
          ))}
        </div>
      )}

      {/* Module expanded: unified DndContext covering groups + items */}
      {isModule && isExpanded && moduleConfig && (
        <div className="pl-4 pb-1">
          <DndContext
            sensors={moduleSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleModuleDragEnd}
            onDragOver={handleModuleDragOver}
          >
            <SortableContext items={moduleConfig.groups.map(g => g.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-0.5">
                {moduleConfig.groups.map(group => (
                  <SortableGroupRow
                    key={group.id} group={group} moduleKey={mk}
                    isExpanded={expandedGroups.has(group.id)} onToggle={() => onToggleGroup(group.id)}
                    renamingGroupId={renamingGroupId} groupRenameValue={groupRenameValue}
                    onStartRenameGroup={onStartRenameGroup} onConfirmRenameGroup={onConfirmRenameGroup}
                    onCancelRenameGroup={onCancelRenameGroup} onGroupRenameChange={onGroupRenameChange}
                    onDeleteGroup={onDeleteGroup}
                    onRemoveItemFromGroup={onRemoveItemFromGroup}
                    dragOverGroupId={dragOverGroupId}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Pendiente de asignar */}
          {orphanedItems && orphanedItems.length > 0 && onAssignOrphaned && onLeaveOrphanedUngrouped && moduleConfig && (
            <OrphanedItemsPanel
              items={orphanedItems}
              groups={moduleConfig.groups}
              mk={mk}
              onAssign={onAssignOrphaned}
              onLeaveUngrouped={onLeaveOrphanedUngrouped}
            />
          )}

          {/* Add new group */}
          {pendingNewGroup !== null ? (
            <div className="flex items-center gap-1 mt-1.5 px-2">
              <Input
                value={pendingNewGroup}
                onChange={e => onPendingGroupChange(e.target.value)}
                placeholder="Nombre del grupo..."
                onKeyDown={e => { if (e.key === 'Enter') onConfirmNewGroup(mk); if (e.key === 'Escape') onCancelNewGroup(); }}
                className="h-6 text-xs flex-1"
                autoFocus
              />
              <button onClick={() => onConfirmNewGroup(mk)} className="text-green-600"><Check className="h-3.5 w-3.5" /></button>
              <button onClick={onCancelNewGroup} className="text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
            </div>
          ) : (
            <button
              onClick={() => onAddGroup(mk)}
              className="mt-1 flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-sidebar-foreground/40 hover:text-sidebar-foreground/70 transition-colors"
            >
              <Plus className="h-3 w-3" /> Nuevo grupo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ModuleOnlyDnD ───────────────────────────────────────────────────────────
// Helper component for the moduleOnly render path. Needs its own state for dragOverGroupId.

function ModuleOnlyDnD({
  moduleOnly, moduleConfig, expandedGroups, setExpandedGroups,
  renamingGroupId, groupRenameValue,
  onStartRenameGroup, onConfirmRenameGroup, onCancelRenameGroup, onGroupRenameChange,
  onDeleteGroup, onRemoveItemFromGroup,
  onGroupReorder, onItemReorder, onMoveItemToGroup, onMoveCrossGroup, sensors,
}: {
  moduleOnly: SidebarModuleKey;
  moduleConfig: ModuleSidebarConfig;
  expandedGroups: Set<string>;
  setExpandedGroups: React.Dispatch<React.SetStateAction<Set<string>>>;
  renamingGroupId: string | null;
  groupRenameValue: string;
  onStartRenameGroup: (id: string, name: string) => void;
  onConfirmRenameGroup: () => void;
  onCancelRenameGroup: () => void;
  onGroupRenameChange: (v: string) => void;
  onDeleteGroup: (id: string, mk: SidebarModuleKey) => void;
  onRemoveItemFromGroup: (moduleId: string, groupId: string, mk: SidebarModuleKey) => void;
  onGroupReorder: (mk: SidebarModuleKey, from: number, to: number) => void;
  onItemReorder: (mk: SidebarModuleKey, groupId: string, from: number, to: number) => void;
  onMoveItemToGroup: (moduleId: string, from: string, to: string, mk: SidebarModuleKey) => void;
  onMoveCrossGroup: (mk: SidebarModuleKey, moduleId: string, fromGroupId: string, toGroupId: string, atIndex: number) => void;
  sensors: ReturnType<typeof useSensors>;
}) {
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setDragOverGroupId(null);
    if (!over || active.id === over.id) return;

    const activeType = active.data.current?.type as 'group' | 'item' | undefined;
    const overType = over.data.current?.type as 'group' | 'item' | undefined;

    if (activeType === 'group' && overType === 'group') {
      const fromIdx = moduleConfig.groups.findIndex(g => g.id === active.id);
      const toIdx = moduleConfig.groups.findIndex(g => g.id === over.id);
      if (fromIdx >= 0 && toIdx >= 0) onGroupReorder(moduleOnly, fromIdx, toIdx);

    } else if (activeType === 'item' && overType === 'item') {
      const fromGroupId = active.data.current?.groupId as string;
      const toGroupId = over.data.current?.groupId as string;
      if (fromGroupId === toGroupId) {
        const group = moduleConfig.groups.find(g => g.id === fromGroupId);
        if (!group) return;
        const fromIdx = group.children.findIndex(c => getChildId(c) === String(active.id));
        const toIdx = group.children.findIndex(c => getChildId(c) === String(over.id));
        if (fromIdx >= 0 && toIdx >= 0) onItemReorder(moduleOnly, fromGroupId, fromIdx, toIdx);
      } else {
        const toGroup = moduleConfig.groups.find(g => g.id === toGroupId);
        if (!toGroup) return;
        const atIdx = toGroup.children.findIndex(c => getChildId(c) === String(over.id));
        onMoveCrossGroup(moduleOnly, String(active.id), fromGroupId, toGroupId, atIdx >= 0 ? atIdx : toGroup.children.length);
      }

    } else if (activeType === 'item' && overType === 'group') {
      const fromGroupId = active.data.current?.groupId as string;
      const toGroupId = String(over.id);
      if (fromGroupId !== toGroupId) onMoveItemToGroup(String(active.id), fromGroupId, toGroupId, moduleOnly);
    }
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) { setDragOverGroupId(null); return; }
    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;
    setDragOverGroupId(activeType === 'item' && overType === 'group' ? String(over.id) : null);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} onDragOver={handleDragOver}>
      <SortableContext items={moduleConfig.groups.map(g => g.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-0.5 px-1">
          {moduleConfig.groups.map(group => (
            <SortableGroupRow
              key={group.id}
              group={group}
              moduleKey={moduleOnly}
              isExpanded={expandedGroups.has(group.id)}
              onToggle={() => setExpandedGroups(prev => {
                const s = new Set(prev);
                s.has(group.id) ? s.delete(group.id) : s.add(group.id);
                return s;
              })}
              renamingGroupId={renamingGroupId}
              groupRenameValue={groupRenameValue}
              onStartRenameGroup={onStartRenameGroup}
              onConfirmRenameGroup={onConfirmRenameGroup}
              onCancelRenameGroup={onCancelRenameGroup}
              onGroupRenameChange={onGroupRenameChange}
              onDeleteGroup={onDeleteGroup}
              onRemoveItemFromGroup={onRemoveItemFromGroup}
              dragOverGroupId={dragOverGroupId}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

// ─── SidebarEditMode (main component) ────────────────────────────────────────

interface SidebarEditModeProps {
  config: CompanySidebarConfigResponse | undefined;
  onExitEditMode: () => void;
  /** When set, renders directly in module-edit mode (Mantenimiento, Producción) instead of admin top-level */
  moduleOnly?: SidebarModuleKey;
}

export function SidebarEditMode({ config, onExitEditMode, moduleOnly }: SidebarEditModeProps) {
  const adminSidebarMutation = useUpdateAdminSidebar();
  const moduleConfigMutation = useUpdateCompanySidebarConfig();
  const confirm = useConfirm();

  // Effective module configs (base data)
  const effectiveConfigs = useMemo(() => {
    const keys: SidebarModuleKey[] = ['ventas', 'compras', 'tesoreria', 'nominas', 'almacen', 'mantenimiento', 'produccion'];
    return Object.fromEntries(
      keys.map(k => [k, getEffectiveConfig(k, config ?? null)])
    ) as Record<SidebarModuleKey, ModuleSidebarConfig>;
  }, [config]);

  // ── Top-level state ──────────────────────────────────────────────────────────
  const [localOrder, setLocalOrder] = useState<string[]>(() => config?.adminOrder ?? [...DEFAULT_ADMIN_MODULE_ORDER]);
  const [localLabels, setLocalLabels] = useState<Record<string, string>>(() => config?.sectionLabels ?? {});
  const [localCustomGroups, setLocalCustomGroups] = useState<Record<string, CustomAdminGroup>>(() => config?.customGroups ?? {});
  const [pendingCustomGroups, setPendingCustomGroups] = useState<Record<string, CustomAdminGroup>>({});

  // ── Expand state ─────────────────────────────────────────────────────────────
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // ── Module config state ──────────────────────────────────────────────────────
  const [localModuleConfigs, setLocalModuleConfigs] = useState<Partial<Record<SidebarModuleKey, ModuleSidebarConfig>>>({});

  // ── Orphaned items (ítems sin grupo tras eliminar su grupo) ──────────────────
  const [localOrphanedItems, setLocalOrphanedItems] = useState<Partial<Record<SidebarModuleKey, SidebarNode[]>>>({});

  // ── Rename state ─────────────────────────────────────────────────────────────
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [groupRenameValue, setGroupRenameValue] = useState('');

  // ── New group within module state ────────────────────────────────────────────
  const [addingGroupToModule, setAddingGroupToModule] = useState<SidebarModuleKey | null>(null);
  const [newGroupName, setNewGroupName] = useState('');

  // ── Create custom group state ─────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [ctgName, setCtgName] = useState('');
  const [ctgIcon, setCtgIcon] = useState('Folder');
  const [ctgItems, setCtgItems] = useState<Set<string>>(new Set());
  const [ctgSearch, setCtgSearch] = useState('');

  // ── Save state ───────────────────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false);

  // ── DnD sensors ──────────────────────────────────────────────────────────────
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // ── Derived ──────────────────────────────────────────────────────────────────

  const getModuleConfig = useCallback((key: SidebarModuleKey): ModuleSidebarConfig =>
    localModuleConfigs[key] ?? effectiveConfigs[key], [localModuleConfigs, effectiveConfigs]);

  const getSectionLabel = useCallback((key: string): string => {
    if (localLabels[key]) return localLabels[key];
    if (pendingCustomGroups[key]) return pendingCustomGroups[key].name;
    if (localCustomGroups[key]) return localCustomGroups[key].name;
    return getSectionDefaultLabel(key);
  }, [localLabels, pendingCustomGroups, localCustomGroups]);

  const getSType = useCallback((key: string) => getSectionType(key, localCustomGroups, pendingCustomGroups), [localCustomGroups, pendingCustomGroups]);

  const removedStandardSections = useMemo(
    () => DEFAULT_ADMIN_MODULE_ORDER.filter(k => !localOrder.includes(k)),
    [localOrder]
  );

  // All leaf items for picker
  const allLeafItems = useMemo(() => getAllLeafItems(), []);
  const filteredLeafItems = useMemo(() => {
    if (!ctgSearch.trim()) return allLeafItems;
    const q = ctgSearch.toLowerCase();
    return allLeafItems.filter(i => i.name.toLowerCase().includes(q) || i.moduleLabel.toLowerCase().includes(q));
  }, [allLeafItems, ctgSearch]);
  const itemsByModule = useMemo(() => {
    const grouped: Record<string, typeof allLeafItems> = {};
    for (const item of filteredLeafItems) {
      if (!grouped[item.moduleLabel]) grouped[item.moduleLabel] = [];
      grouped[item.moduleLabel].push(item);
    }
    return grouped;
  }, [filteredLeafItems]);

  // ── Section DnD ──────────────────────────────────────────────────────────────
  function onSectionDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIdx = localOrder.indexOf(String(active.id));
    const toIdx = localOrder.indexOf(String(over.id));
    if (fromIdx >= 0 && toIdx >= 0) setLocalOrder(prev => arrayMove(prev, fromIdx, toIdx));
  }

  // ── Section handlers ─────────────────────────────────────────────────────────
  function handleDeleteSection(key: string) {
    setLocalOrder(prev => prev.filter(k => k !== key));
    setExpandedSections(prev => { const s = new Set(prev); s.delete(key); return s; });
  }

  function handleRestoreSection(key: string) {
    setLocalOrder(prev => [...prev, key]);
  }

  function handleStartRename(key: string, currentLabel: string) {
    setRenamingKey(key);
    setRenameValue(currentLabel);
  }
  function handleConfirmRename() {
    if (!renamingKey || !renameValue.trim()) { setRenamingKey(null); return; }
    const key = renamingKey;
    const val = renameValue.trim();
    // For custom groups: update the group's name
    if (pendingCustomGroups[key]) {
      setPendingCustomGroups(prev => ({ ...prev, [key]: { ...prev[key], name: val } }));
    } else if (localCustomGroups[key]) {
      setLocalCustomGroups(prev => ({ ...prev, [key]: { ...prev[key], name: val } }));
    } else {
      // Standard section: set label override
      setLocalLabels(prev => ({ ...prev, [key]: val }));
    }
    setRenamingKey(null);
  }
  function handleCancelRename() { setRenamingKey(null); }

  // ── Group handlers ────────────────────────────────────────────────────────────
  function handleStartRenameGroup(id: string, name: string) {
    setRenamingGroupId(id);
    setGroupRenameValue(name);
  }
  function handleConfirmRenameGroup() {
    if (!renamingGroupId || !groupRenameValue.trim()) { setRenamingGroupId(null); return; }
    const id = renamingGroupId;
    const val = groupRenameValue.trim();
    // Find which module contains this group and update
    for (const mk of Object.keys(effectiveConfigs) as SidebarModuleKey[]) {
      const cfg = getModuleConfig(mk);
      const grpIdx = cfg.groups.findIndex(g => g.id === id);
      if (grpIdx >= 0) {
        const newGroups = cfg.groups.map(g => g.id === id ? { ...g, name: val } : g);
        setLocalModuleConfigs(prev => ({ ...prev, [mk]: { ...cfg, groups: newGroups } }));
        break;
      }
    }
    setRenamingGroupId(null);
  }
  function handleCancelRenameGroup() { setRenamingGroupId(null); }

  function handleDeleteGroup(groupId: string, mk: SidebarModuleKey) {
    const cfg = getModuleConfig(mk);
    const group = cfg.groups.find(g => g.id === groupId);
    if (!group) return;

    // Rescatar todos los ítems leaf del grupo (incluyendo sub-grupos)
    const collectLeafItems = (nodes: SidebarNode[]): SidebarNode[] =>
      nodes.flatMap(n => n.type === 'item' ? [n] : collectLeafItems(n.children));
    const freed = collectLeafItems(group.children);

    if (freed.length > 0) {
      setLocalOrphanedItems(prev => ({
        ...prev,
        [mk]: [...(prev[mk] ?? []), ...freed],
      }));
    }

    const newGroups = cfg.groups.filter(g => g.id !== groupId);
    setLocalModuleConfigs(prev => ({ ...prev, [mk]: { ...cfg, groups: newGroups } }));
    setExpandedGroups(prev => { const s = new Set(prev); s.delete(groupId); return s; });
  }

  function handleRemoveFromGroup(moduleId: string, groupId: string, mk: SidebarModuleKey) {
    const cfg = getModuleConfig(mk);
    let removedItem: SidebarNode | undefined;
    const newGroups = cfg.groups.map(g => {
      if (g.id !== groupId) return g;
      const idx = g.children.findIndex(c => c.type === 'item' && c.moduleId === moduleId);
      if (idx < 0) return g;
      removedItem = g.children[idx];
      return { ...g, children: g.children.filter((_, i) => i !== idx) };
    });
    if (removedItem) {
      setLocalOrphanedItems(prev => ({ ...prev, [mk]: [...(prev[mk] ?? []), removedItem!] }));
    }
    setLocalModuleConfigs(prev => ({ ...prev, [mk]: { ...cfg, groups: newGroups } }));
  }

  function handleAssignOrphanedItem(item: SidebarNode, toGroupId: string, mk: SidebarModuleKey) {
    if (item.type !== 'item') return;
    setLocalOrphanedItems(prev => ({
      ...prev,
      [mk]: (prev[mk] ?? []).filter(i => !(i.type === 'item' && i.moduleId === item.moduleId)),
    }));
    const cfg = getModuleConfig(mk);
    const newGroups = cfg.groups.map(g =>
      g.id === toGroupId ? { ...g, children: [...g.children, item] } : g
    );
    setLocalModuleConfigs(prev => ({ ...prev, [mk]: { ...cfg, groups: newGroups } }));
  }

  function handleLeaveOrphanedUngrouped(item: SidebarNode, mk: SidebarModuleKey) {
    if (item.type !== 'item') return;
    // Quitar de orphaned
    setLocalOrphanedItems(prev => ({
      ...prev,
      [mk]: (prev[mk] ?? []).filter(i => !(i.type === 'item' && i.moduleId === item.moduleId)),
    }));
    const cfg = getModuleConfig(mk);
    // Crear un __flat__ group INDIVIDUAL para este ítem (nunca compartir uno existente).
    // El sidebar hace spread de __flat__.children → cada ítem queda suelto al nivel de
    // los grupos principales, no anidado bajo ningún header.
    const newFlat: SidebarGroupNode = {
      type: 'group', id: 'flat-' + Date.now().toString(36), name: '__flat__', icon: 'Folder', children: [item],
    };
    setLocalModuleConfigs(prev => ({ ...prev, [mk]: { ...cfg, groups: [...cfg.groups, newFlat] } }));
  }

  // ── Item handlers ─────────────────────────────────────────────────────────────
  function handleGroupReorder(mk: SidebarModuleKey, fromIdx: number, toIdx: number) {
    const cfg = getModuleConfig(mk);
    setLocalModuleConfigs(prev => ({ ...prev, [mk]: { ...cfg, groups: arrayMove([...cfg.groups], fromIdx, toIdx) } }));
  }

  function handleItemReorder(mk: SidebarModuleKey, groupId: string, fromIdx: number, toIdx: number) {
    const cfg = getModuleConfig(mk);
    const newGroups = cfg.groups.map(g => {
      if (g.id !== groupId) return g;
      return { ...g, children: arrayMove([...g.children], fromIdx, toIdx) };
    });
    setLocalModuleConfigs(prev => ({ ...prev, [mk]: { ...cfg, groups: newGroups } }));
  }

  function handleMoveCrossGroup(mk: SidebarModuleKey, moduleId: string, fromGroupId: string, toGroupId: string, atIndex: number) {
    const cfg = getModuleConfig(mk);
    let movedItem: SidebarNode | undefined;
    const withoutSource = cfg.groups.map(g => {
      if (g.id !== fromGroupId) return g;
      const idx = g.children.findIndex(c => getChildId(c) === moduleId);
      if (idx < 0) return g;
      movedItem = g.children[idx];
      return { ...g, children: g.children.filter((_, i) => i !== idx) };
    });
    if (!movedItem) return;
    const item = movedItem;
    const newGroups = withoutSource.map(g => {
      if (g.id !== toGroupId) return g;
      const newChildren = [...g.children];
      newChildren.splice(atIndex, 0, item);
      return { ...g, children: newChildren };
    });
    setLocalModuleConfigs(prev => ({ ...prev, [mk]: { ...cfg, groups: newGroups } }));
  }

  function handleMoveItemToGroup(moduleId: string, fromGroupId: string, toGroupId: string, mk: SidebarModuleKey) {
    const cfg = getModuleConfig(mk);
    let movedItem: SidebarNode | undefined;
    const newGroups = cfg.groups.map(g => {
      if (g.id === fromGroupId) {
        const idx = g.children.findIndex(c => c.type === 'item' && c.moduleId === moduleId);
        if (idx < 0) return g;
        movedItem = g.children[idx];
        return { ...g, children: g.children.filter((_, i) => i !== idx) };
      }
      return g;
    }).map(g => {
      if (g.id === toGroupId && movedItem) {
        return { ...g, children: [...g.children, movedItem] };
      }
      return g;
    });
    setLocalModuleConfigs(prev => ({ ...prev, [mk]: { ...cfg, groups: newGroups } }));
  }

  // ── Add group within module ───────────────────────────────────────────────────
  function handleAddGroup(mk: SidebarModuleKey) {
    setAddingGroupToModule(mk);
    setNewGroupName('');
  }
  function handleConfirmNewGroup(mk: SidebarModuleKey) {
    if (!newGroupName.trim()) { setAddingGroupToModule(null); return; }
    const cfg = getModuleConfig(mk);
    const newGroup: SidebarGroupNode = {
      type: 'group',
      id: 'g-' + Date.now().toString(36),
      name: newGroupName.trim(),
      icon: 'Folder',
      children: [],
    };
    setLocalModuleConfigs(prev => ({ ...prev, [mk]: { ...cfg, groups: [...cfg.groups, newGroup] } }));
    setAddingGroupToModule(null);
    setNewGroupName('');
  }
  function handleCancelNewGroup() { setAddingGroupToModule(null); }

  // ── Create custom top-level group ────────────────────────────────────────────
  function handleCreateCustomGroup() {
    if (!ctgName.trim() || ctgItems.size === 0) return;
    const id = 'cg-' + Date.now().toString(36);
    const group: CustomAdminGroup = { name: ctgName.trim(), icon: ctgIcon, items: Array.from(ctgItems) };
    setPendingCustomGroups(prev => ({ ...prev, [id]: group }));
    setLocalOrder(prev => [...prev, id]);
    setCreateOpen(false);
    setCtgName('');
    setCtgIcon('Folder');
    setCtgItems(new Set());
    setCtgSearch('');
  }

  // ── Save ─────────────────────────────────────────────────────────────────────
  async function handleSave() {
    setIsSaving(true);
    try {
      const originalCustomIds = new Set(Object.keys(config?.customGroups ?? {}));
      const upsertCustomGroups: Record<string, CustomAdminGroup> = {};
      const removeCustomGroups: string[] = [];

      // Modified original groups still in order
      for (const [id, group] of Object.entries(localCustomGroups)) {
        if (localOrder.includes(id)) upsertCustomGroups[id] = group;
      }
      // New groups in order
      for (const [id, group] of Object.entries(pendingCustomGroups)) {
        if (localOrder.includes(id)) upsertCustomGroups[id] = group;
      }
      // Original groups removed from order
      for (const id of originalCustomIds) {
        if (!localOrder.includes(id)) removeCustomGroups.push(id);
      }

      await adminSidebarMutation.mutateAsync({
        adminOrder: localOrder,
        sectionLabels: localLabels,
        ...(Object.keys(upsertCustomGroups).length > 0 && { upsertCustomGroups }),
        ...(removeCustomGroups.length > 0 && { removeCustomGroups }),
      });

      // Merge orphaned items into module configs como __flat__ al final
      const finalModuleConfigs = { ...localModuleConfigs };
      for (const [mk, items] of Object.entries(localOrphanedItems) as [SidebarModuleKey, SidebarNode[]][]) {
        if (!items || items.length === 0) continue;
        const cfg = finalModuleConfigs[mk] ?? effectiveConfigs[mk];
        const flatGroup: SidebarGroupNode = {
          type: 'group', id: 'flat-orphaned-' + mk, name: '__flat__', icon: 'Folder', children: items,
        };
        finalModuleConfigs[mk] = { ...cfg, groups: [...cfg.groups, flatGroup] };
      }

      // Module-level changes
      const modifiedModules = Object.keys(finalModuleConfigs) as SidebarModuleKey[];
      if (modifiedModules.length > 0) {
        await Promise.all(
          modifiedModules.map(key =>
            moduleConfigMutation.mutateAsync({ module: key, config: finalModuleConfigs[key]! })
          )
        );
      }

      onExitEditMode();
    } catch {
      // toast handled by mutations
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveModuleOnly(mk: SidebarModuleKey) {
    setIsSaving(true);
    try {
      const orphaned = localOrphanedItems[mk] ?? [];
      let cfg = localModuleConfigs[mk] ?? effectiveConfigs[mk];
      if (orphaned.length > 0) {
        const flatGroup: SidebarGroupNode = {
          type: 'group', id: 'flat-orphaned-' + mk, name: '__flat__', icon: 'Folder', children: orphaned,
        };
        cfg = { ...cfg, groups: [...cfg.groups, flatGroup] };
      }
      if (localModuleConfigs[mk] || orphaned.length > 0) {
        await moduleConfigMutation.mutateAsync({ module: mk, config: cfg });
      }
      onExitEditMode();
    } catch {
      // errors handled by mutation
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    onExitEditMode();
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  // Module-only mode: Mantenimiento, Producción — muestra solo los grupos del módulo
  if (moduleOnly) {
    const moduleConfig = getModuleConfig(moduleOnly);
    return (
      <div className="flex flex-col gap-1 pb-4">
        {/* Header */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 mb-1 border-b border-border/30">
          <Pencil className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-xs font-medium text-primary flex-1">Editando sidebar</span>
        </div>

        {/* Groups DnD — unified context covering groups + items */}
        <ModuleOnlyDnD
          moduleOnly={moduleOnly}
          moduleConfig={moduleConfig}
          expandedGroups={expandedGroups}
          setExpandedGroups={setExpandedGroups}
          renamingGroupId={renamingGroupId}
          groupRenameValue={groupRenameValue}
          onStartRenameGroup={handleStartRenameGroup}
          onConfirmRenameGroup={handleConfirmRenameGroup}
          onCancelRenameGroup={handleCancelRenameGroup}
          onGroupRenameChange={setGroupRenameValue}
          onDeleteGroup={handleDeleteGroup}
          onRemoveItemFromGroup={handleRemoveFromGroup}
          onGroupReorder={handleGroupReorder}
          onItemReorder={handleItemReorder}
          onMoveItemToGroup={handleMoveItemToGroup}
          onMoveCrossGroup={handleMoveCrossGroup}
          sensors={sensors}
        />

        {/* Add group */}
        {/* Pendiente de asignar */}
        {(localOrphanedItems[moduleOnly] ?? []).length > 0 && (
          <div className="mx-1">
            <OrphanedItemsPanel
              items={localOrphanedItems[moduleOnly]!}
              groups={moduleConfig.groups}
              mk={moduleOnly}
              onAssign={handleAssignOrphanedItem}
              onLeaveUngrouped={handleLeaveOrphanedUngrouped}
            />
          </div>
        )}

        {addingGroupToModule === moduleOnly ? (
          <div className="flex items-center gap-1 mt-1.5 px-2.5">
            <Input
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              placeholder="Nombre del grupo..."
              onKeyDown={e => {
                if (e.key === 'Enter') handleConfirmNewGroup(moduleOnly);
                if (e.key === 'Escape') handleCancelNewGroup();
              }}
              className="h-6 text-xs flex-1"
              autoFocus
            />
            <button onClick={() => handleConfirmNewGroup(moduleOnly)} className="text-green-600"><Check className="h-3.5 w-3.5" /></button>
            <button onClick={handleCancelNewGroup} className="text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
          </div>
        ) : (
          <button
            onClick={() => handleAddGroup(moduleOnly)}
            className="mx-1 mt-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-dashed border-border/50 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Nuevo grupo
          </button>
        )}

        {/* Save / Cancel */}
        <div className="mx-1 mt-2 flex flex-col gap-1.5">
          <Button size="sm" className="h-7 text-xs w-full" onClick={() => handleSaveModuleOnly(moduleOnly)} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
            Guardar
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs w-full" onClick={handleCancel} disabled={isSaving}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 pb-4">
      {/* Header */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 mb-1 border-b border-border/30">
        <Pencil className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-xs font-medium text-primary flex-1">Editando sidebar</span>
      </div>

      {/* Sections list */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onSectionDragEnd}>
        <SortableContext items={localOrder} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-0.5 px-1">
            {localOrder.map(key => {
              const sType = getSType(key);
              const label = getSectionLabel(key);
              const isExpanded = expandedSections.has(key);
              const moduleConfig = sType === 'module' ? getModuleConfig(key as SidebarModuleKey) : undefined;

              // Preview items for custom groups
              let customGroupPreview: string[] | undefined;
              if (sType === 'custom') {
                const cg = localCustomGroups[key] ?? pendingCustomGroups[key];
                if (cg) {
                  customGroupPreview = cg.items.slice(0, 5).map(id => {
                    const found = allLeafItems.find(i => i.moduleId === id);
                    return found?.name ?? id;
                  });
                  if (cg.items.length > 5) customGroupPreview.push(`+${cg.items.length - 5}`);
                }
              }

              return (
                <SortableSectionRow
                  key={key}
                  sectionKey={key} label={label} sectionType={sType}
                  isExpanded={isExpanded}
                  onToggle={() => setExpandedSections(prev => {
                    const s = new Set(prev);
                    s.has(key) ? s.delete(key) : s.add(key);
                    return s;
                  })}
                  renamingKey={renamingKey} renameValue={renameValue}
                  onStartRename={handleStartRename} onConfirmRename={handleConfirmRename}
                  onCancelRename={handleCancelRename} onRenameChange={setRenameValue}
                  onDelete={handleDeleteSection}
                  moduleConfig={moduleConfig}
                  renamingGroupId={renamingGroupId} groupRenameValue={groupRenameValue}
                  expandedGroups={expandedGroups}
                  onToggleGroup={(id) => setExpandedGroups(prev => {
                    const s = new Set(prev);
                    s.has(id) ? s.delete(id) : s.add(id);
                    return s;
                  })}
                  onStartRenameGroup={handleStartRenameGroup} onConfirmRenameGroup={handleConfirmRenameGroup}
                  onCancelRenameGroup={handleCancelRenameGroup} onGroupRenameChange={setGroupRenameValue}
                  onDeleteGroup={handleDeleteGroup}
                  onMoveItemToGroup={handleMoveItemToGroup}
                  onItemReorder={handleItemReorder}
                  onRemoveItemFromGroup={handleRemoveFromGroup}
                  onGroupReorder={handleGroupReorder}
                  onMoveCrossGroup={handleMoveCrossGroup}
                  onAddGroup={handleAddGroup}
                  pendingNewGroup={addingGroupToModule === key ? newGroupName : null}
                  onPendingGroupChange={setNewGroupName}
                  onConfirmNewGroup={handleConfirmNewGroup}
                  onCancelNewGroup={handleCancelNewGroup}
                  customGroupPreview={customGroupPreview}
                  orphanedItems={localOrphanedItems[key as SidebarModuleKey]}
                  onAssignOrphaned={handleAssignOrphanedItem}
                  onLeaveOrphanedUngrouped={handleLeaveOrphanedUngrouped}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* Secciones ocultas */}
      {removedStandardSections.length > 0 && (
        <div className="mx-1 mt-1 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1.5 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Secciones ocultas
          </p>
          <div className="flex flex-col gap-1">
            {removedStandardSections.map(key => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{getSectionDefaultLabel(key)}</span>
                <button
                  onClick={() => handleRestoreSection(key)}
                  className="text-xs text-primary hover:underline shrink-0"
                >
                  Restaurar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* + Nuevo grupo custom */}
      <button
        onClick={() => setCreateOpen(true)}
        className="mx-1 mt-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-dashed border-border/50 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
      >
        <Plus className="h-3.5 w-3.5" /> Nuevo grupo
      </button>

      {/* Save / Cancel */}
      <div className="mx-1 mt-2 flex flex-col gap-1.5">
        <Button size="sm" className="h-7 text-xs w-full" onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
          Guardar
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs w-full" onClick={handleCancel} disabled={isSaving}>
          Cancelar
        </Button>
      </div>

      {/* Reset hint */}
      <button
        onClick={async () => {
          const confirmed = await confirm({
            title: '¿Estás seguro?',
            description: '¿Restablecer el sidebar al orden default?',
          });
          if (!confirmed) return;
          setLocalOrder([...DEFAULT_ADMIN_MODULE_ORDER]);
          setLocalLabels({});
        }}
        className="mx-1 flex items-center gap-1 text-xs text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
      >
        <RotateCcw className="h-2.5 w-2.5" /> Restablecer default
      </button>

      {/* Create custom group dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Nuevo grupo</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {/* Name + Icon */}
            <div className="flex gap-2">
              <Input
                placeholder="Nombre del grupo"
                value={ctgName}
                onChange={e => setCtgName(e.target.value)}
                className="h-8 text-sm flex-1"
                autoFocus
              />
              <Select value={ctgIcon} onValueChange={setCtgIcon}>
                <SelectTrigger className="h-8 w-10 p-0 justify-center">
                  {(() => { const Ic = resolveIcon(ctgIcon); return <Ic className="h-4 w-4" />; })()}
                </SelectTrigger>
                <SelectContent>
                  <div className="grid grid-cols-4 gap-1 p-1">
                    {ICON_OPTIONS.map(({ value, label, Icon }) => (
                      <button
                        key={value} title={label}
                        onClick={() => setCtgIcon(value)}
                        className={cn('flex items-center justify-center h-7 w-7 rounded hover:bg-accent', ctgIcon === value && 'bg-accent ring-1 ring-primary')}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    ))}
                  </div>
                </SelectContent>
              </Select>
            </div>

            {/* Item search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar items..."
                value={ctgSearch}
                onChange={e => setCtgSearch(e.target.value)}
                className="h-8 text-xs pl-8"
              />
              {ctgSearch && (
                <button onClick={() => setCtgSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Items list */}
            <div className="max-h-60 overflow-y-auto border rounded-md divide-y divide-border/30">
              {Object.entries(itemsByModule).map(([moduleLabel, items]) => (
                <div key={moduleLabel}>
                  <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">{moduleLabel}</p>
                  {items.map(item => (
                    <label key={item.moduleId} className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent/30 cursor-pointer">
                      <Checkbox
                        checked={ctgItems.has(item.moduleId)}
                        onCheckedChange={(checked) => {
                          setCtgItems(prev => {
                            const s = new Set(prev);
                            checked ? s.add(item.moduleId) : s.delete(item.moduleId);
                            return s;
                          });
                        }}
                        className="h-3.5 w-3.5"
                      />
                      <span className="text-xs">{item.name}</span>
                    </label>
                  ))}
                </div>
              ))}
              {filteredLeafItems.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Sin resultados</p>
              )}
            </div>

            {ctgItems.size > 0 && (
              <p className="text-xs text-muted-foreground">{ctgItems.size} item{ctgItems.size !== 1 ? 's' : ''} seleccionado{ctgItems.size !== 1 ? 's' : ''}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)} className="h-7 text-xs">Cancelar</Button>
            <Button size="sm" onClick={handleCreateCustomGroup} disabled={!ctgName.trim() || ctgItems.size === 0} className="h-7 text-xs">
              Crear grupo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
