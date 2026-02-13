'use client';

import { useState, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Box,
  Cog,
  AlertCircle,
  CheckCircle2,
  Edit2,
  Trash2,
  Plus,
  GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface ExtractedComponent {
  tempId: string;
  name: string;
  type: string;
  systemType?: string;
  quantity?: number;
  itemNumber?: string; // Posición en el plano de despiece (Pos: 1, 2, 3...)
  code?: string; // Código de parte/archivo
  partNumber?: string; // Legacy - usar itemNumber
  brand?: string;
  model?: string;
  logo?: string | null;
  specifications?: Record<string, string>;
  parentTempId?: string | null;
  confidence: number;
  uncertainFields?: string[];
  evidences: Array<{
    fileId: number;
    fileName: string;
    page?: number;
    snippet?: string;
  }>;
}

interface ComponentTreeProps {
  components: ExtractedComponent[];
  onUpdateComponent: (tempId: string, updates: Partial<ExtractedComponent>) => void;
  onDeleteComponent: (tempId: string) => void;
  onAddComponent: (parentTempId?: string) => void;
  onSelectComponent: (component: ExtractedComponent) => void;
  selectedComponentId?: string;
  showUncertainOnly?: boolean;
}

interface TreeNodeProps {
  component: ExtractedComponent;
  children: ExtractedComponent[];
  allComponents: ExtractedComponent[];
  depth: number;
  onUpdate: (tempId: string, updates: Partial<ExtractedComponent>) => void;
  onDelete: (tempId: string) => void;
  onAdd: (parentTempId?: string) => void;
  onSelect: (component: ExtractedComponent) => void;
  selectedId?: string;
  showUncertainOnly?: boolean;
}

function TreeNode({
  component,
  children,
  allComponents,
  depth,
  onUpdate,
  onDelete,
  onAdd,
  onSelect,
  selectedId,
  showUncertainOnly,
}: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(component.name);

  const isSelected = component.tempId === selectedId;
  const hasChildren = children.length > 0;
  const isUncertain = component.confidence < 0.7 || (component.uncertainFields?.length ?? 0) > 0;

  // If showUncertainOnly and this node (and its children) have no uncertainty, skip
  const childrenHaveUncertainty = useMemo(() => {
    const checkUncertainty = (comps: ExtractedComponent[]): boolean => {
      return comps.some(c => {
        if (c.confidence < 0.7 || (c.uncertainFields?.length ?? 0) > 0) return true;
        const childComps = allComponents.filter(cc => cc.parentTempId === c.tempId);
        return checkUncertainty(childComps);
      });
    };
    return checkUncertainty(children);
  }, [children, allComponents]);

  if (showUncertainOnly && !isUncertain && !childrenHaveUncertainty) {
    return null;
  }

  const handleSaveEdit = () => {
    if (editName.trim() && editName !== component.name) {
      onUpdate(component.tempId, { name: editName.trim() });
    }
    setIsEditing(false);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600';
    if (confidence >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceBg = (confidence: number) => {
    if (confidence >= 0.9) return 'bg-green-100';
    if (confidence >= 0.7) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  return (
    <div className="select-none">
      <div
        className={cn(
          "flex items-center gap-1 py-1 px-2 rounded-md group cursor-pointer hover:bg-muted/50 transition-colors",
          isSelected && "bg-primary/10 hover:bg-primary/15"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(component)}
      >
        {/* Expand/Collapse */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="p-0.5 hover:bg-muted rounded"
          disabled={!hasChildren}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )
          ) : (
            <span className="w-4" />
          )}
        </button>

        {/* Drag Handle */}
        <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-50 cursor-grab" />

        {/* Icon / Thumbnail */}
        {component.logo ? (
          <img
            src={component.logo}
            alt={component.name}
            className="h-5 w-5 rounded object-cover flex-shrink-0"
          />
        ) : component.type === 'SYSTEM' ? (
          <Box className="h-4 w-4 text-blue-600" />
        ) : (
          <Cog className="h-4 w-4 text-muted-foreground" />
        )}

        {/* Name */}
        {isEditing ? (
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSaveEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveEdit();
              if (e.key === 'Escape') {
                setEditName(component.name);
                setIsEditing(false);
              }
            }}
            className="h-6 py-0 px-1 text-sm w-40"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className={cn(
              "text-sm font-medium truncate max-w-[200px]",
              isUncertain && "text-amber-700"
            )}
            title={component.name}
          >
            {component.name}
          </span>
        )}

        {/* Quantity Badge */}
        {component.quantity && component.quantity > 1 && (
          <Badge variant="secondary" className="text-xs h-5 px-1">
            x{component.quantity}
          </Badge>
        )}

        {/* Part Number */}
        {/* Show Pos (itemNumber) if available */}
        {component.itemNumber && (
          <span className="text-xs text-muted-foreground truncate max-w-[100px]">
            Pos: {component.itemNumber}
          </span>
        )}

        {/* Confidence Indicator */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "flex items-center gap-1 px-1.5 py-0.5 rounded text-xs",
                  getConfidenceBg(component.confidence),
                  getConfidenceColor(component.confidence)
                )}
              >
                {component.confidence >= 0.7 ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <AlertCircle className="h-3 w-3" />
                )}
                {Math.round(component.confidence * 100)}%
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Confianza: {Math.round(component.confidence * 100)}%</p>
              {component.uncertainFields && component.uncertainFields.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Campos inciertos: {component.uncertainFields.join(', ')}
                </p>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Evidence Count */}
        {component.evidences.length > 0 && (
          <Badge variant="outline" className="text-xs h-5 px-1">
            {component.evidences.length} ref
          </Badge>
        )}

        {/* Actions */}
        <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
          >
            <Edit2 className="h-3 w-3" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Plus className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onAdd(component.tempId)}>
                Agregar subcomponente
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`¿Eliminar "${component.name}" y sus subcomponentes?`)) {
                onDelete(component.tempId);
              }
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {children.map((child) => {
            const childChildren = allComponents.filter(c => c.parentTempId === child.tempId);
            return (
              <TreeNode
                key={child.tempId}
                component={child}
                children={childChildren}
                allComponents={allComponents}
                depth={depth + 1}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onAdd={onAdd}
                onSelect={onSelect}
                selectedId={selectedId}
                showUncertainOnly={showUncertainOnly}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ComponentTree({
  components,
  onUpdateComponent,
  onDeleteComponent,
  onAddComponent,
  onSelectComponent,
  selectedComponentId,
  showUncertainOnly,
}: ComponentTreeProps) {
  // Build tree structure - components without parent are root
  const rootComponents = useMemo(() => {
    return components.filter(c => !c.parentTempId);
  }, [components]);

  if (components.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Box className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No se encontraron componentes</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => onAddComponent()}
        >
          <Plus className="h-4 w-4 mr-2" />
          Agregar componente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {rootComponents.map((component) => {
        const children = components.filter(c => c.parentTempId === component.tempId);
        return (
          <TreeNode
            key={component.tempId}
            component={component}
            children={children}
            allComponents={components}
            depth={0}
            onUpdate={onUpdateComponent}
            onDelete={onDeleteComponent}
            onAdd={onAddComponent}
            onSelect={onSelectComponent}
            selectedId={selectedComponentId}
            showUncertainOnly={showUncertainOnly}
          />
        );
      })}

      <Button
        variant="ghost"
        size="sm"
        className="mt-2 w-full justify-start text-muted-foreground"
        onClick={() => onAddComponent()}
      >
        <Plus className="h-4 w-4 mr-2" />
        Agregar componente raíz
      </Button>
    </div>
  );
}
