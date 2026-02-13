'use client';

import { useState } from 'react';
import { Machine, MachineComponent } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, Plus, Info, Cog, AlertTriangle, CheckCircle, Wrench, Eye, Pencil, Trash2, PlusCircle } from 'lucide-react';

interface MachineTreeViewProps {
  machine: Machine;
  components: MachineComponent[];
  onViewComponent?: (component: MachineComponent) => void;
  onEditComponent?: (component: MachineComponent) => void;
  onDeleteComponent?: (componentId: number) => void;
  onAddSubcomponent?: (parentId: number) => void;
  onAddComponent?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canCreate?: boolean;
  /** Map of componentId to failure count */
  componentFailures?: Record<string, number>;
}

export default function MachineTreeView({
  machine,
  components,
  onViewComponent,
  onEditComponent,
  onDeleteComponent,
  onAddSubcomponent,
  onAddComponent,
  canEdit = false,
  canDelete = false,
  canCreate = false,
  componentFailures = {},
}: MachineTreeViewProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium">Estructura de Componentes</h3>
          <p className="text-xs text-muted-foreground">Vista jerárquica de {machine.name}</p>
        </div>
        {canCreate && onAddComponent && (
          <Button size="sm" variant="outline" onClick={onAddComponent}>
            <Plus className="h-4 w-4 mr-2" />
            Agregar componente
          </Button>
        )}
      </div>

      <div className="border-l-2 border-muted ml-3 pl-3">
        {/* First level components */}
        {components.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Cog className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay componentes registrados</p>
            {canCreate && onAddComponent && (
              <Button size="sm" variant="outline" onClick={onAddComponent} className="mt-4">
                <Plus className="h-4 w-4 mr-1" />
                Agregar componente
              </Button>
            )}
          </div>
        ) : (
          components.map((component) => (
            <MachineTreeNode
              key={component.id}
              node={component}
              level={0}
              onView={onViewComponent}
              onEdit={onEditComponent}
              onDelete={onDeleteComponent}
              onAddChild={onAddSubcomponent}
              canEdit={canEdit}
              canDelete={canDelete}
              canCreate={canCreate}
              componentFailures={componentFailures}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface MachineTreeNodeProps {
  node: MachineComponent;
  level: number;
  onView?: (component: MachineComponent) => void;
  onEdit?: (component: MachineComponent) => void;
  onDelete?: (componentId: number) => void;
  onAddChild?: (parentId: number) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canCreate?: boolean;
  componentFailures?: Record<string, number>;
}

function MachineTreeNode({
  node,
  level,
  onView,
  onEdit,
  onDelete,
  onAddChild,
  canEdit = false,
  canDelete = false,
  canCreate = false,
  componentFailures = {},
}: MachineTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(level === 0);
  const hasChildren = node.children && node.children.length > 0;
  const failureCount = componentFailures[node.id.toString()] || 0;

  const getNodeTypeBadge = (type: string) => {
    const normalizedType = type?.toLowerCase();
    switch (normalizedType) {
      case 'part':
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">Parte</Badge>;
      case 'piece':
        return <Badge variant="outline" className="bg-secondary/10 text-secondary-foreground border-secondary/20 text-xs">Pieza</Badge>;
      case 'subpiece':
        return <Badge variant="outline" className="bg-muted/20 text-muted-foreground border-muted text-xs">Subpieza</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{type}</Badge>;
    }
  };

  // Status indicator based on failures
  const getStatusIndicator = () => {
    if (failureCount > 0) {
      return (
        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded-full text-xs">
          <AlertTriangle className="h-3 w-3" />
          <span>{failureCount}</span>
        </div>
      );
    }
    return (
      <div className="w-2 h-2 rounded-full bg-green-500" title="Sin fallas" />
    );
  };

  return (
    <div className="relative group">
      <div
        className={cn(
          "flex items-center py-2 px-3 rounded-md transition-all my-1 cursor-pointer",
          "hover:bg-muted/30 hover:shadow-sm",
          level === 0 && "bg-card border border-border/50"
        )}
        onClick={() => onView?.(node)}
      >
        {/* Expand/collapse button */}
        {hasChildren ? (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-6 w-6 p-0 mr-1 transition-transform duration-200",
              isExpanded && "rotate-90"
            )}
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <div className="w-6 mr-1" />
        )}

        {/* Node icon and name */}
        <div className="flex items-center flex-1 min-w-0">
          {node.logo ? (
            <div className="w-8 h-8 rounded-md overflow-hidden border border-border/30 bg-background flex-shrink-0 mr-2">
              <img src={node.logo} alt={node.name} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-md bg-muted/30 flex-shrink-0 mr-2 flex items-center justify-center">
              <Cog className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <span className="font-medium text-sm truncate">{node.name}</span>
        </div>

        {/* Badges and status */}
        <div className="flex items-center gap-2 ml-2">
          {getStatusIndicator()}
          {getNodeTypeBadge(node.type)}

          {/* Children count */}
          {hasChildren && (
            <Badge variant="secondary" className="text-xs">
              {node.children?.length} {node.children?.length === 1 ? 'hijo' : 'hijos'}
            </Badge>
          )}

          {/* Action buttons (shown on hover) */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onView?.(node);
              }}
              title="Ver detalles"
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            {canCreate && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddChild?.(Number(node.id));
                }}
                title="Agregar subcomponente"
              >
                <PlusCircle className="h-3.5 w-3.5" />
              </Button>
            )}
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.(node);
                }}
                title="Editar"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(Number(node.id));
                }}
                title="Eliminar"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Children nodes */}
      {hasChildren && isExpanded && (
        <div className="ml-8 border-l-2 border-muted pl-3 animate-in slide-in-from-top-2 duration-200">
          {node.children?.map((child: MachineComponent) => (
            <MachineTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              canEdit={canEdit}
              canDelete={canDelete}
              canCreate={canCreate}
              componentFailures={componentFailures}
            />
          ))}
        </div>
      )}
    </div>
  );
}