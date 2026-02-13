import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Machine, MachineComponent } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { NodeCard } from './NodeCard';
import { 
  Eye, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Download, 
  RotateCcw, 
  Search, 
  Filter,
  Info,
  Settings,
  MousePointer,
  Hand,
  Layers,
  ChevronLeft,
  ChevronRight,
  Home,
  Grid3X3,
  Wrench,
  Cog,
  X,
  Network,
  Edit,
  Copy,
  Trash2,
  Undo2
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import html2canvas from 'html2canvas';
import { Dialog as MiniDialog, DialogContent as MiniDialogContent, DialogHeader as MiniDialogHeader, DialogTitle as MiniDialogTitle, DialogDescription as MiniDialogDescription } from '@/components/ui/dialog';
import { usePermissionRobust } from '@/hooks/use-permissions-robust';

interface MachineSchemaViewProps {
  machine: Machine;
  components: MachineComponent[];
  onComponentClick: (component: MachineComponent) => void;
  componentOrder?: {[key: string]: number}; // Orden de componentes de primer nivel
  subcomponentOrder?: Record<string, Record<string, number>>; // Orden de subcomponentes por componente padre
}

const BASE_NODE_WIDTH = 190; // Ancho para nodos hijos (NodeCard child)
const ROOT_NODE_WIDTH = 220; // Ancho para nodo raíz (NodeCard root)
const MAX_NODE_WIDTH = 280; // Ancho máximo (no se usa con NodeCard pero se mantiene por compatibilidad)
const NODE_HEIGHT = 90; // Altura base (se ajusta según el tipo: 74 para root, 70 para child)
const VERTICAL_GAP = 80; // Más reducido para menos espacio vertical
const HORIZONTAL_GAP = 70; // Más reducido para menos espacio horizontal

// Función para calcular el ancho del nodo (ahora usa anchos fijos del NodeCard)
function calculateNodeWidth(text: string | undefined | null, isRoot: boolean = false): number {
  // Con NodeCard, usamos anchos fijos según el tipo
  return isRoot ? ROOT_NODE_WIDTH : BASE_NODE_WIDTH;
}

interface Node {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number; // Ancho dinámico del nodo
  depth: number;
  component?: MachineComponent;
  children?: Node[];
  status?: 'operational' | 'maintenance' | 'warning' | 'error';
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

interface Edge {
  from: { x: number; y: number };
  to: { x: number; y: number };
  type?: 'parent-child' | 'dependency' | 'flow';
}

function getTreeLayout(components: MachineComponent[], startX: number, startY: number): Node[] {
  let nodes: Node[] = [];
  let queue: any[] = [{ 
    component: components[0], 
    x: startX, 
    y: startY, 
    depth: 0,
    status: 'operational' as const,
    priority: 'medium' as const
  }];
  
  while (queue.length) {
    const { component, x, y, depth, status, priority } = queue.shift();
    const nodeWidth = calculateNodeWidth(component.name, depth === 0);
    nodes.push({ 
      ...component, 
      type: traducirTipo(component.type), // Traducir el tipo al español
      x, 
      y, 
      width: nodeWidth,
      depth,
      status: status,
      priority: priority
    });
    
    if (component.children && component.children.length > 0) {
      // Calcular el ancho total considerando los anchos individuales de cada hijo
      const childWidths = component.children.map((child: any) => calculateNodeWidth(child.name, false));
      const totalChildrenWidth = childWidths.reduce((sum: number, width: number) => sum + width, 0) + 
                                (component.children.length - 1) * HORIZONTAL_GAP;
      
      let currentX = x - totalChildrenWidth / 2;
      component.children.forEach((child: any, i: number) => {
        const childWidth = childWidths[i];
        queue.push({
          component: child,
          x: currentX + childWidth / 2,
          y: y + NODE_HEIGHT + VERTICAL_GAP,
          depth: depth + 1,
          status: 'operational' as const,
          priority: 'medium' as const
        });
        currentX += childWidth + HORIZONTAL_GAP;
      });
    }
  }
  return nodes;
}

function getNodeColor(node: Node): { fill: string; stroke: string; text: string } {
  // Usar colores del sistema CSS
  const statusColors = {
    operational: { fill: 'hsl(var(--green-500))', stroke: 'hsl(var(--green-600))', text: 'hsl(var(--white))' },
    maintenance: { fill: 'hsl(var(--yellow-500))', stroke: 'hsl(var(--yellow-600))', text: 'hsl(var(--white))' },
    warning: { fill: 'hsl(var(--orange-500))', stroke: 'hsl(var(--orange-600))', text: 'hsl(var(--white))' },
    error: { fill: 'hsl(var(--red-500))', stroke: 'hsl(var(--red-600))', text: 'hsl(var(--white))' }
  };
  
  const priorityColors = {
    low: { fill: 'hsl(var(--gray-500))', stroke: 'hsl(var(--gray-600))', text: 'hsl(var(--white))' },
    medium: { fill: 'hsl(var(--blue-500))', stroke: 'hsl(var(--blue-600))', text: 'hsl(var(--white))' },
    high: { fill: 'hsl(var(--yellow-500))', stroke: 'hsl(var(--yellow-600))', text: 'hsl(var(--white))' },
    critical: { fill: 'hsl(var(--red-500))', stroke: 'hsl(var(--red-600))', text: 'hsl(var(--white))' }
  };
  
  if (node.depth === 0) {
    return { fill: 'hsl(var(--primary))', stroke: 'hsl(var(--primary-foreground))', text: 'hsl(var(--white))' };
  }
  
  return statusColors[node.status || 'operational'] || priorityColors[node.priority || 'medium'];
}

// Traducción de tipos
function traducirTipo(tipo: any) {
  const tiposTraducidos: { [key: string]: string } = {
    'Máquina': 'Máquina',
    'part': 'Parte',
    'piece': 'Pieza', 
    'subpiece': 'Subpieza',
    'module': 'Módulo',
    'other': 'Otro',
    'Parte': 'Parte',
    'Pieza': 'Pieza',
    'Subpieza': 'Subpieza',
    'Módulo': 'Módulo',
    'Otro': 'Otro',
    // Versiones en mayúsculas
    'PART': 'Parte',
    'PIECE': 'Pieza',
    'SUBPIECE': 'Subpieza',
    'MODULE': 'Módulo',
    'OTHER': 'Otro'
  };
  return tiposTraducidos[tipo] || tipo;
}

// Búsqueda recursiva de componente por id
function buscarComponentePorId(componentes: any, id: any): any {
  let encontrado: any = null;
  for (const comp of componentes) {
    // Validar que el componente tenga un ID válido
    if (!comp.id) {
      continue; // Saltar este componente
    }
    
    if (comp.id == id) { // Usar == para comparar string vs number
      return comp;
    }
    if (comp.children && comp.children.length > 0) {
      encontrado = buscarComponentePorId(comp.children, id);
      if (encontrado) return encontrado;
    }
  }
  return null;
}

// Fragmento reutilizable para el SVG del diagrama
function renderDiagramSVG({containerSize, zoom, offset, nodes, edges, showConnections, showLabels, selectedComponent, hoveredComponent, handleNodeClick, handleNodeHover, interactionMode, onComponentClick, components, expandedComponents, handleComponentClick, isEditMode, draggedComponent, setDraggedComponent, dropTarget, setDropTarget, updateComponentParent, handleTouchStartNode, handleTouchMoveNode, handleTouchEndNode, isDraggingFromTouch, setIsDraggingFromTouch, containerRef, preventClickRef, touchMovedRef, touchStartTimeRef, touchLongPressTimerRef, dragPreview, setDragPreview, handleDuplicateClick, handleDeleteComponent}: any) {
  return (
    <svg
      width="100%"
      height="100%"
      style={{ display: 'block', background: 'none', cursor: 'grab' }}
      viewBox={`0 0 ${containerSize.width} ${containerSize.height}`}
    >
      {/* Transformación para zoom y pan */}
      <g transform={`translate(${offset.x}, ${offset.y}) scale(${zoom})`}>
        {/* Líneas de conexión */}
        {showConnections && edges.map((edge: any, i: any) => (
          <path
            key={i}
            d={`M${edge.from.x},${edge.from.y} C${edge.from.x},${(edge.from.y + edge.to.y) / 2} ${edge.to.x},${(edge.from.y + edge.to.y) / 2} ${edge.to.x},${edge.to.y}`}
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={2}
            fill="none"
            opacity={0.7}
            markerEnd="url(#arrowhead)"
          />
        ))}
        {/* Nodos */}
        {nodes.map((node: any, i: any) => {
          const colors = getNodeColor(node);
          const isSelected = selectedComponent === node.id;
          const isHovered = hoveredComponent === node.id;
          // Icono según tipo
          let Icon = null;
          if (node.type === 'Máquina') Icon = <Cog className="h-8 w-8" />;
          else if (node.type === 'part' || node.type === 'Parte') Icon = <Settings className="h-8 w-8" />;
          else if (node.type === 'piece' || node.type === 'Pieza') Icon = <Wrench className="h-8 w-8" />;
          else if (node.type === 'subpiece' || node.type === 'Subpieza') Icon = <Wrench className="h-6 w-6" />;
          else if (node.type === 'module' || node.type === 'Módulo') Icon = <Grid3X3 className="h-8 w-8" />;
          else Icon = <Layers className="h-8 w-8" />;
          const isDragged = draggedComponent === node.id;
          const isDropTarget = dropTarget === node.id && draggedComponent && draggedComponent !== node.id;
          const canBeDragged = isEditMode && node.id !== 'root' && node.type !== 'Máquina';
          const canBeDroppedOn = isEditMode && node.id !== draggedComponent && draggedComponent !== null;
          
          // Ocultar completamente el nodo original si está siendo arrastrado
          const shouldHideOriginal = isDragged && (isDraggingFromTouch || dragPreview);

          // Determinar el subtítulo basado en el tipo
          const getSubtitle = (): "Máquina" | "Parte" | "Módulo" => {
            if (node.type === 'Máquina') return 'Máquina';
            if (node.type === 'module' || node.type === 'Módulo') return 'Módulo';
            return 'Parte'; // Por defecto para part, piece, subpiece, etc.
          };

          // Determinar si mostrar el punto negro (tiene hijos o estado especial)
          const hasChildren = (node.component && node.component.children && node.component.children.length > 0) || 
                             (node.type === 'Máquina' && components.length > 0);
          const showDot = hasChildren || (node.status && node.status !== 'operational');

          // Determinar el tamaño del nodo
          const nodeSize = node.type === 'Máquina' ? 'root' : 'child';
          
          // Anchos del NodeCard
          const cardWidth = nodeSize === 'root' ? 220 : 190;
          const cardHeight = nodeSize === 'root' ? 80 : 76;
          
          const handleDragStart = (e: React.MouseEvent) => {
            if (isEditMode && canBeDragged) {
              e.preventDefault();
              e.stopPropagation();
              setDraggedComponent(node.id);
              // Crear preview para desktop también
              if (setDragPreview) {
                setDragPreview({
                  x: e.clientX,
                  y: e.clientY,
                  nodeId: node.id,
                  nodeName: node.name,
                  nodeType: node.type || 'Parte'
                });
              }
            }
          };

          const handleDragEnd = (e: React.MouseEvent) => {
            if (!isEditMode || !draggedComponent) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            // Si se suelta sobre el mismo componente que se está arrastrando, cancelar
            if (node.id === draggedComponent) {
              setDraggedComponent(null);
              setDropTarget(null);
              if (setDragPreview) {
                setDragPreview(null);
              }
              return;
            }
            
            if (dropTarget && draggedComponent !== dropTarget) {
              // Verificar que no se intente mover un componente a sí mismo o a sus propios hijos
              const draggedComp = buscarComponentePorId(components, draggedComponent);
              const targetComp = buscarComponentePorId(components, dropTarget);
              
              if (!draggedComp) {
                toast.error('Componente no encontrado');
                setDraggedComponent(null);
                setDropTarget(null);
                return;
              }
              
              // Prevenir mover a un hijo (verificación recursiva)
              const isChild = (parentId: string, childId: string): boolean => {
                const parent = buscarComponentePorId(components, parentId);
                if (!parent || !parent.children || parent.children.length === 0) return false;
                for (const child of parent.children) {
                  if (child.id.toString() === childId) return true;
                  if (isChild(child.id.toString(), childId)) return true;
                }
                return false;
              };
              
              // No permitir mover a sus propios hijos
              if (isChild(draggedComponent, dropTarget)) {
                toast.error('No puedes mover un componente a sus propios hijos');
                setDraggedComponent(null);
                setDropTarget(null);
                return;
              }
              
              // No permitir mover a sí mismo
              if (draggedComponent === dropTarget) {
                setDraggedComponent(null);
                setDropTarget(null);
                return;
              }
              
              // Actualizar el parent del componente
              updateComponentParent(draggedComponent, dropTarget);
            } else {
              // Si se suelta sin un target válido, cancelar el arrastre
              setDraggedComponent(null);
              setDropTarget(null);
            }
            
            // Limpiar preview
            if (setDragPreview) {
              setDragPreview(null);
            }
          };

          // Handlers para touch events (móvil)
          const handleTouchStartLocal = (e: React.TouchEvent) => {
            // En modo edición, iniciar long press para drag and drop
            // Pero solo prevenir el default si no es un toque simple para expandir
            if (isEditMode && canBeDragged) {
              e.stopPropagation();
              // No prevenir default aquí para permitir toques simples
              if (handleTouchStartNode) {
                handleTouchStartNode(e, node.id);
              }
            }
          };

          const handleTouchMoveLocal = (e: React.TouchEvent) => {
            // Si estamos en modo edición, manejar el movimiento del touch
            if (isEditMode) {
              const touch = e.touches[0];
              
              // Si estamos arrastrando este componente, actualizar el preview
              if (draggedComponent === node.id && isDraggingFromTouch && setDragPreview) {
                setDragPreview((prev: any) => prev ? {
                  ...prev,
                  x: touch.clientX,
                  y: touch.clientY
                } : null);
              }
              
              // Si hay un timer activo, llamar a handleTouchMoveNode para verificar movimiento
              if (handleTouchMoveNode) {
                handleTouchMoveNode(e, node.id);
              }
              
              // Si estamos arrastrando un componente, detectar sobre qué nodo está el dedo
              if (draggedComponent && isDraggingFromTouch) {
                e.preventDefault();
                e.stopPropagation();
                
                if (!containerRef?.current) return;
                
                // Obtener coordenadas del touch relativas al contenedor
                const rect = containerRef.current.getBoundingClientRect();
                const touchX = (touch.clientX - rect.left - offset.x) / zoom;
                const touchY = (touch.clientY - rect.top - offset.y) / zoom;
                
                // Verificar si el touch está sobre este nodo
                const nodeLeft = node.x - node.width / 2;
                const nodeRight = node.x + node.width / 2;
                const nodeTop = node.y - NODE_HEIGHT / 2;
                const nodeBottom = node.y + NODE_HEIGHT / 2;
                
                if (touchX >= nodeLeft && touchX <= nodeRight && 
                    touchY >= nodeTop && touchY <= nodeBottom &&
                    draggedComponent !== node.id && canBeDroppedOn) {
                  setDropTarget(node.id);
                }
              } else if ((touchMovedRef && touchMovedRef.current) || (touchStartTimeRef && touchStartTimeRef.current)) {
                // Si hay movimiento detectado, prevenir el click
                if (preventClickRef) preventClickRef.current = true;
                e.preventDefault();
                e.stopPropagation();
              }
            }
          };

          const handleTouchEndLocal = (e: React.TouchEvent) => {
            e.stopPropagation();
            
            // Limpiar timer si existe
            if (touchLongPressTimerRef && touchLongPressTimerRef.current) {
              clearTimeout(touchLongPressTimerRef.current);
              touchLongPressTimerRef.current = null;
            }
            
            // Si estamos en modo edición y se activó el drag, manejar el drop
            if (isEditMode && draggedComponent && isDraggingFromTouch) {
              e.preventDefault();
              // Verificar si el touch está realmente sobre este nodo
              const touch = e.changedTouches[0];
              if (!containerRef?.current) {
                // Limpiar si no hay container
                setDraggedComponent(null);
                setDropTarget(null);
                setIsDraggingFromTouch(false);
                if (touchStartTimeRef) touchStartTimeRef.current = null;
                if (touchMovedRef) touchMovedRef.current = false;
                if (preventClickRef) preventClickRef.current = false;
                return;
              }
              
              const rect = containerRef.current.getBoundingClientRect();
              const touchX = (touch.clientX - rect.left - offset.x) / zoom;
              const touchY = (touch.clientY - rect.top - offset.y) / zoom;
              
              // Verificar si el touch está sobre este nodo
              const nodeLeft = node.x - node.width / 2;
              const nodeRight = node.x + node.width / 2;
              const nodeTop = node.y - NODE_HEIGHT / 2;
              const nodeBottom = node.y + NODE_HEIGHT / 2;
              
              const isOverThisNode = touchX >= nodeLeft && touchX <= nodeRight && 
                                     touchY >= nodeTop && touchY <= nodeBottom;
              
              // Si se suelta sobre el mismo componente que se está arrastrando, cancelar todo
              if (isOverThisNode && draggedComponent === node.id) {
                setDraggedComponent(null);
                setDropTarget(null);
                setIsDraggingFromTouch(false);
                if (setDragPreview) setDragPreview(null);
              } else if (isOverThisNode && draggedComponent !== node.id && dropTarget === node.id && canBeDroppedOn) {
                // Si se suelta sobre un componente válido que tiene el dropTarget, moverlo
                if (handleTouchEndNode) {
                  handleTouchEndNode(e, node.id);
                } else {
                  // Fallback: actualizar directamente
                  updateComponentParent(draggedComponent, node.id);
                  setDraggedComponent(null);
                  setDropTarget(null);
                  setIsDraggingFromTouch(false);
                  if (setDragPreview) setDragPreview(null);
                }
              } else if (isOverThisNode && dropTarget === node.id && draggedComponent !== node.id) {
                // Si se toca el componente que tiene el dropTarget pero no es válido o se quiere desmarcar, solo limpiar dropTarget
                setDropTarget(null);
                // Mantener el draggedComponent activo para poder seguir arrastrando o tocar de nuevo para cancelar completamente
              } else {
                // Si se suelta fuera de un nodo válido o sin dropTarget, cancelar todo
                setDraggedComponent(null);
                setDropTarget(null);
                setIsDraggingFromTouch(false);
                if (setDragPreview) setDragPreview(null);
              }
              
                // Limpiar referencias
                if (touchStartTimeRef) touchStartTimeRef.current = null;
                if (touchMovedRef) touchMovedRef.current = false;
                if (preventClickRef) preventClickRef.current = false;
                return;
              }
              
              // Si estamos en modo edición pero NO se activó el drag (toque simple sin mantener)
              // Permitir expandir/contraer el componente
              if (isEditMode && !isDraggingFromTouch && !draggedComponent) {
                const timeSinceStart = (touchStartTimeRef && touchStartTimeRef.current) ? Date.now() - touchStartTimeRef.current : 0;
                
                // Si pasó menos de 500ms (no fue un long press) y no hubo movimiento significativo, expandir/contraer
                if (timeSinceStart < 500 && (!touchMovedRef || !touchMovedRef.current)) {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  // Expandir/contraer el componente
                  const comp = buscarComponentePorId(components, node.id);
                  if (comp && handleComponentClick) {
                    handleComponentClick(node.id, comp);
                  }
                  
                  // Limpiar referencias
                  if (touchStartTimeRef) touchStartTimeRef.current = null;
                  if (touchMovedRef) touchMovedRef.current = false;
                  if (preventClickRef) preventClickRef.current = false;
                  return;
                }
              }
              
              // Si no había drag activo pero hay un dropTarget marcado (de un drag anterior que se soltó por error)
              // Permitir tocar el componente marcado para desmarcarlo
              if (isEditMode && dropTarget === node.id && !draggedComponent) {
                e.preventDefault();
                e.stopPropagation();
                setDropTarget(null);
                // Limpiar referencias
                if (touchStartTimeRef) touchStartTimeRef.current = null;
                if (touchMovedRef) touchMovedRef.current = false;
                if (preventClickRef) preventClickRef.current = false;
                return;
              }
              
              // Si no estamos en modo edición, permitir el comportamiento normal
              if (!isEditMode) {
                // Si no estamos en modo edición, verificar si debemos prevenir el click
                const timeSinceStart = (touchStartTimeRef && touchStartTimeRef.current) ? Date.now() - touchStartTimeRef.current : 0;
                
                // Si pasó menos de 500ms y no hubo movimiento, permitir el click normal
                if (timeSinceStart < 500 && (!touchMovedRef || !touchMovedRef.current) && (!preventClickRef || !preventClickRef.current)) {
                  // Permitir el click normal después de un pequeño delay
                  setTimeout(() => {
                    if (!preventClickRef || !preventClickRef.current) {
                      // El click se manejará normalmente
                    }
                  }, 50);
                } else {
                  // Prevenir el click si hubo movimiento o tiempo suficiente
                  if (preventClickRef) preventClickRef.current = true;
                }
              }
              
              // Limpiar referencias
              if (touchStartTimeRef) touchStartTimeRef.current = null;
              if (touchMovedRef) touchMovedRef.current = false;
              if (preventClickRef) preventClickRef.current = false;
          };

          const handleMouseEnter = (e: React.MouseEvent) => {
            handleNodeHover(node.id);
            if (isEditMode && draggedComponent && canBeDroppedOn && draggedComponent !== node.id) {
              setDropTarget(node.id);
            }
            // Actualizar preview mientras se arrastra con mouse
            if (isEditMode && draggedComponent === node.id && setDragPreview) {
              setDragPreview((prev: any) => prev ? {
                ...prev,
                x: e.clientX,
                y: e.clientY
              } : null);
            }
          };

          const handleMouseLeave = (e: React.MouseEvent) => {
            e.stopPropagation();
            handleNodeHover(null);
            // Si estamos arrastrando y salimos del nodo, mantener el dropTarget por si volvemos
            // Solo limpiar si no estamos arrastrando nada
            if (isEditMode && dropTarget === node.id && !draggedComponent) {
              setDropTarget(null);
            }
          };

          const handleClick = (e: React.MouseEvent) => {
            // Si estamos en modo edición y hay un componente arrastrándose
            if (isEditMode && draggedComponent) {
              // Si se hace clic en el mismo componente que se está arrastrando, cancelar
              if (node.id === draggedComponent) {
                e.stopPropagation();
                e.preventDefault();
                setDraggedComponent(null);
                setDropTarget(null);
                if (setDragPreview) {
                  setDragPreview(null);
                }
                return;
              }
              // Si se hace clic en el componente que tiene el dropTarget, cancelar el dropTarget
              if (node.id === dropTarget) {
                e.stopPropagation();
                e.preventDefault();
                setDropTarget(null);
                // No cancelar el draggedComponent, solo el dropTarget para poder seguir arrastrando
                return;
              }
            }
            
            // En modo edición, permitir click simple para expandir/contraer (no para drag)
            if (isEditMode && !draggedComponent) {
              // Permitir expandir/contraer en modo edición con click simple
              e.stopPropagation();
              e.preventDefault();
              
              // No hacer nada si es la máquina principal
              if (node.type === 'Máquina') {
                return;
              }
              
              // Buscar el componente real por id
              const comp = buscarComponentePorId(components, node.id);
              
              if (comp && handleComponentClick) {
                // Usar la lógica de click para expandir/contraer
                handleComponentClick(node.id, comp);
              }
              return;
            }
            
            // Prevenir click si se debe prevenir (por ejemplo, durante un drag)
            if (preventClickRef && preventClickRef.current) {
              e.stopPropagation();
              e.preventDefault();
              return;
            }
            
            e.stopPropagation();
            
            // No hacer nada si es la máquina principal
            if (node.type === 'Máquina') {
              return;
            }
            
            // Buscar el componente real por id
            const comp = buscarComponentePorId(components, node.id);
            
            if (comp && handleComponentClick) {
              // Usar la nueva lógica de click
              handleComponentClick(node.id, comp);
            }
          };

          return (
            <g 
              key={node.id} 
              transform={`translate(${node.x - cardWidth / 2},${node.y - cardHeight / 2})`}
              onMouseDown={handleDragStart}
              onMouseUp={handleDragEnd}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              onClick={handleClick}
              onTouchStart={handleTouchStartLocal}
              onTouchMove={handleTouchMoveLocal}
              onTouchEnd={handleTouchEndLocal}
              onTouchCancel={(e) => {
                // Limpiar estado si se cancela el touch
                if (touchLongPressTimerRef && touchLongPressTimerRef.current) {
                  clearTimeout(touchLongPressTimerRef.current);
                  touchLongPressTimerRef.current = null;
                }
                if (touchStartTimeRef) touchStartTimeRef.current = null;
                if (touchMovedRef) touchMovedRef.current = false;
                if (preventClickRef) preventClickRef.current = false;
                if (!isDraggingFromTouch) {
                  setDraggedComponent(null);
                  setDropTarget(null);
                }
              }}
              style={{ 
                cursor: isEditMode && canBeDragged ? 'grab' : isEditMode && canBeDroppedOn && draggedComponent ? 'pointer' : node.type === 'Máquina' ? 'default' : 'pointer', 
                transition: 'filter 0.2s, transform 0.2s',
                userSelect: 'none',
                touchAction: isEditMode ? 'none' : 'manipulation',
                WebkitTouchCallout: 'none',
                WebkitUserSelect: 'none',
                opacity: shouldHideOriginal ? 0 : isDragged ? 0.5 : 1,
                pointerEvents: shouldHideOriginal ? 'none' : 'auto',
                visibility: shouldHideOriginal ? 'hidden' : 'visible'
              }}
            >
              {/* NodeCard usando foreignObject */}
              {showLabels && (
                <foreignObject
                  width={cardWidth}
                  height={cardHeight}
                  x={0}
                  y={0}
                  style={{ pointerEvents: 'auto', overflow: 'visible' }}
                >
                  <div style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                    <NodeCard
                      title={node.name}
                      subtitle={getSubtitle()}
                      showDot={showDot}
                      size={nodeSize}
                      selected={isSelected || isDropTarget}
                      onClick={handleClick}
                    />
                  </div>
                </foreignObject>
              )}
              
              {/* Botones de duplicar y eliminar (visible solo en modo edición, cuando hay hover y para componentes que no sean la máquina principal) */}
              {isEditMode && canBeDragged && hoveredComponent === node.id && (
                <>
                  {/* Botón de duplicar */}
                  <foreignObject
                    x={cardWidth - 44}
                    y={cardHeight - 22}
                    width={18}
                    height={18}
                    style={{ pointerEvents: 'auto', zIndex: 1000 }}
                  >
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (handleDuplicateClick) {
                          handleDuplicateClick(node.id);
                        }
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                      }}
                      style={{
                        width: '100%',
                        height: '100%',
                        padding: '3px',
                        borderRadius: '4px',
                        border: '1px solid hsl(var(--primary) / 0.3)',
                        background: 'linear-gradient(135deg, hsl(var(--primary) / 0.1), hsl(var(--primary) / 0.05))',
                        backdropFilter: 'blur(6px)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'hsl(var(--primary))',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1), inset 0 1px 1px rgba(255,255,255,0.2)',
                        minWidth: '18px',
                        minHeight: '18px'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'linear-gradient(135deg, hsl(var(--primary) / 0.25), hsl(var(--primary) / 0.15))';
                        e.currentTarget.style.borderColor = 'hsl(var(--primary))';
                        e.currentTarget.style.transform = 'scale(1.15)';
                        e.currentTarget.style.boxShadow = '0 3px 6px rgba(0,0,0,0.15), inset 0 1px 1px rgba(255,255,255,0.3)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'linear-gradient(135deg, hsl(var(--primary) / 0.1), hsl(var(--primary) / 0.05))';
                        e.currentTarget.style.borderColor = 'hsl(var(--primary) / 0.3)';
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1), inset 0 1px 1px rgba(255,255,255,0.2)';
                      }}
                      title="Duplicar componente"
                    >
                      <Copy style={{ width: '11px', height: '11px', strokeWidth: 2.5 }} />
                    </button>
                  </foreignObject>
                  
                  {/* Botón de eliminar */}
                  <foreignObject
                    x={cardWidth - 22}
                    y={cardHeight - 22}
                    width={18}
                    height={18}
                    style={{ pointerEvents: 'auto', zIndex: 1000 }}
                  >
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (handleDeleteComponent) {
                          handleDeleteComponent(node.id);
                        }
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                      }}
                      style={{
                        width: '100%',
                        height: '100%',
                        padding: '3px',
                        borderRadius: '4px',
                        border: '1px solid hsl(var(--destructive) / 0.3)',
                        background: 'linear-gradient(135deg, hsl(var(--destructive) / 0.1), hsl(var(--destructive) / 0.05))',
                        backdropFilter: 'blur(6px)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'hsl(var(--destructive))',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1), inset 0 1px 1px rgba(255,255,255,0.2)',
                        minWidth: '18px',
                        minHeight: '18px'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'linear-gradient(135deg, hsl(var(--destructive) / 0.25), hsl(var(--destructive) / 0.15))';
                        e.currentTarget.style.borderColor = 'hsl(var(--destructive))';
                        e.currentTarget.style.transform = 'scale(1.15)';
                        e.currentTarget.style.boxShadow = '0 3px 6px rgba(0,0,0,0.15), inset 0 1px 1px rgba(255,255,255,0.3)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'linear-gradient(135deg, hsl(var(--destructive) / 0.1), hsl(var(--destructive) / 0.05))';
                        e.currentTarget.style.borderColor = 'hsl(var(--destructive) / 0.3)';
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1), inset 0 1px 1px rgba(255,255,255,0.2)';
                      }}
                      title="Eliminar componente"
                    >
                      <Trash2 style={{ width: '11px', height: '11px', strokeWidth: 2.5 }} />
                    </button>
                  </foreignObject>
                </>
              )}
              {/* Indicadores de estado/prioridad si aplica */}
              {node.status && node.status !== 'operational' && (
                <circle
                  cx={node.width - 16}
                  cy={20}
                  r={8}
                  fill={node.status === 'error' ? 'hsl(var(--red-500))' : node.status === 'warning' ? 'hsl(var(--yellow-500))' : 'hsl(var(--blue-500))'}
                  stroke="hsl(var(--white))"
                  strokeWidth={2}
                />
              )}
              {node.priority && node.priority !== 'medium' && (
                <rect
                  x={10}
                  y={10}
                  width={10}
                  height={10}
                  fill={node.priority === 'critical' ? 'hsl(var(--red-500))' : node.priority === 'high' ? 'hsl(var(--yellow-500))' : 'hsl(var(--gray-500))'}
                  rx={3}
                />
              )}
              
              {/* Indicador de componente con hijos */}
              {(node.component && node.component.children && node.component.children.length > 0) || (node.type === 'Máquina' && components.length > 0) ? (
                <g>
                  {/* Indicador de que tiene hijos */}
                  <circle
                    cx={node.width - 15}
                    cy={15}
                    r={6}
                    fill="hsl(var(--primary))"
                    stroke="white"
                    strokeWidth={2}
                  />
                  
                  {/* Indicador de expansión */}
                  {(node.component && expandedComponents[node.component.id.toString()]) || (node.type === 'Máquina' && Object.values(expandedComponents).some(Boolean)) ? (
                    <text
                      x={node.width - 15}
                      y={25}
                      textAnchor="middle"
                      fontSize="12"
                      fill="hsl(var(--primary))"
                      fontWeight="bold"
                    >
                      ▼
                    </text>
                  ) : null}
                </g>
              ) : null}
            </g>
          );
        })}
      </g>
      {/* Definiciones SVG */}
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000" floodOpacity="0.15" />
        </filter>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--muted-foreground))" />
        </marker>
      </defs>
    </svg>
  );
}

// Componente para el preview del drag (elemento que sigue al cursor/dedo)
function DragPreview({ dragPreview }: { dragPreview: { x: number, y: number, nodeId: string, nodeName: string, nodeType: string } | null }) {
  const previewRef = useRef<HTMLDivElement>(null);
  
  // Actualizar posición directamente en el DOM para máximo rendimiento
  useEffect(() => {
    if (previewRef.current && dragPreview) {
      // Usar transform para mejor rendimiento (GPU acceleration)
      previewRef.current.style.transform = `translate(${dragPreview.x}px, ${dragPreview.y}px) translate(-50%, -50%)`;
    }
  }, [dragPreview?.x, dragPreview?.y]);
  
  if (!dragPreview) return null;
  
  const traducirTipo = (type: string) => {
    const translations: {[key: string]: string} = {
      'Máquina': 'Máquina',
      'part': 'Parte',
      'Parte': 'Parte',
      'piece': 'Pieza',
      'Pieza': 'Pieza',
      'subpiece': 'Subpieza',
      'Subpieza': 'Subpieza',
      'module': 'Módulo',
      'Módulo': 'Módulo'
    };
    return translations[type] || type;
  };
  
  let Icon = null;
  if (dragPreview.nodeType === 'Máquina') Icon = <Cog className="h-8 w-8" />;
  else if (dragPreview.nodeType === 'part' || dragPreview.nodeType === 'Parte') Icon = <Settings className="h-8 w-8" />;
  else if (dragPreview.nodeType === 'piece' || dragPreview.nodeType === 'Pieza') Icon = <Wrench className="h-8 w-8" />;
  else if (dragPreview.nodeType === 'subpiece' || dragPreview.nodeType === 'Subpieza') Icon = <Wrench className="h-6 w-6" />;
  else if (dragPreview.nodeType === 'module' || dragPreview.nodeType === 'Módulo') Icon = <Grid3X3 className="h-8 w-8" />;
  else Icon = <Layers className="h-8 w-8" />;
  
  return (
    <div
      ref={previewRef}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        pointerEvents: 'none',
        zIndex: 10000,
        opacity: 0.95,
        willChange: 'transform',
        transition: 'none' // Sin transición para movimiento instantáneo
      }}
      className="bg-card border-2 border-primary rounded-lg shadow-2xl p-4 min-w-[150px] max-w-[200px]"
    >
      <div className="flex flex-col items-center gap-2">
        <div className="text-sm font-bold text-center break-words">{dragPreview.nodeName}</div>
      </div>
    </div>
  );
}

export default function MachineSchemaView({ machine, components, onComponentClick, componentOrder, subcomponentOrder }: MachineSchemaViewProps) {
  // 🔍 PERMISOS DE MÁQUINAS
  const { hasPermission: canEditMachine } = usePermissionRobust('editar_maquina');
  
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const [hoveredComponent, setHoveredComponent] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [fullscreen, setFullscreen] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 1000, height: 600 });
  const [viewMode, setViewMode] = useState<'tree' | 'radial' | 'hierarchical'>('tree');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [interactionMode, setInteractionMode] = useState<'pan'>('pan');
  const [showGrid, setShowGrid] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [showConnections, setShowConnections] = useState(true);
  const [autoLayout, setAutoLayout] = useState(true);
  const [showExpandedModal, setShowExpandedModal] = useState(false);
  const [expandedComponents, setExpandedComponents] = useState<{[key: string]: boolean}>({});
  const [clickTimers, setClickTimers] = useState<{[key: string]: NodeJS.Timeout}>({});
  const [lastClickTime, setLastClickTime] = useState<{[key: string]: number}>({});
  const [isEditMode, setIsEditMode] = useState(false);
  const [draggedComponent, setDraggedComponent] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [touchStartPosition, setTouchStartPosition] = useState<{x: number, y: number} | null>(null);
  const [isDraggingFromTouch, setIsDraggingFromTouch] = useState(false);
  const touchLongPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [localComponents, setLocalComponents] = useState<MachineComponent[]>(components);
  const touchStartTimeRef = useRef<number | null>(null);
  const touchMovedRef = useRef<boolean>(false);
  const preventClickRef = useRef<boolean>(false);
  const [dragPreview, setDragPreview] = useState<{x: number, y: number, nodeId: string, nodeName: string, nodeType: string} | null>(null);
  const dragPreviewRef = useRef<HTMLDivElement | null>(null);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicateComponentId, setDuplicateComponentId] = useState<string | null>(null);
  const [duplicateComponentName, setDuplicateComponentName] = useState('');
  const [componentHistory, setComponentHistory] = useState<MachineComponent[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [actionHistory, setActionHistory] = useState<Array<{type: 'create' | 'move' | 'delete', componentId: string, previousParentId?: string | null, previousState?: MachineComponent[]}>>([]);
  
  // Limpiar estados relacionados con el drag cuando se sale del modo edición
  useEffect(() => {
    if (!isEditMode) {
      // Limpiar todos los estados de drag
      setDraggedComponent(null);
      setDropTarget(null);
      setDragPreview(null);
      setIsDraggingFromTouch(false);
      setTouchStartPosition(null);
      
      // Limpiar timers y refs
      if (touchLongPressTimerRef.current) {
        clearTimeout(touchLongPressTimerRef.current);
        touchLongPressTimerRef.current = null;
      }
      if (touchStartTimeRef.current !== null) {
        touchStartTimeRef.current = null;
      }
      touchMovedRef.current = false;
      preventClickRef.current = false;
    }
  }, [isEditMode]);
  
  // Asegurar que el modal expandido esté en modo pan
  useEffect(() => {
    if (showExpandedModal) {
      setInteractionMode('pan');
    }
  }, [showExpandedModal]);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0, distance: undefined as number | undefined });

  // Actualizar el tamaño del contenedor
  useEffect(() => {
    function updateSize() {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    }
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Función para manejar clicks en componentes
  const handleComponentClick = useCallback((componentId: string, component: MachineComponent) => {
    const now = Date.now();
    const lastClick = lastClickTime[componentId] || 0;
    const timeDiff = now - lastClick;

    console.log(`[MachineSchema] Component click: "${component.name}" (${componentId}), timeDiff: ${timeDiff}ms, hasChildren: ${component.children?.length || 0}`);

    // Limpiar timer anterior si existe
    if (clickTimers[componentId]) {
      clearTimeout(clickTimers[componentId]);
    }

    if (timeDiff < 300) {
      // Doble click - abrir modal de componente
      console.log(`[MachineSchema] DOUBLE CLICK - Opening details for "${component.name}"`);
      if (onComponentClick) {
        onComponentClick(component);
      }
      setLastClickTime(prev => ({ ...prev, [componentId]: 0 }));
    } else {
      // Click simple - expandir/contraer
      console.log(`[MachineSchema] SINGLE CLICK - Toggle expand for "${component.name}"`);
      setExpandedComponents(prev => ({
        ...prev,
        [componentId]: !prev[componentId]
      }));

      // Preparar timer para doble click
      const timer = setTimeout(() => {
        // Click simple confirmado
      }, 300);

      setClickTimers(prev => ({ ...prev, [componentId]: timer }));
      setLastClickTime(prev => ({ ...prev, [componentId]: now }));
    }
  }, [onComponentClick, clickTimers, lastClickTime, setExpandedComponents, setClickTimers, setLastClickTime]);

  // Limpiar timers al desmontar
  useEffect(() => {
    return () => {
      Object.values(clickTimers).forEach(timer => clearTimeout(timer));
    };
  }, [clickTimers]);

  // Actualizar componentes locales cuando cambian los props
  useEffect(() => {
    setLocalComponents(components);
  }, [components]);

  // Función recursiva para encontrar y extraer un componente de la estructura
  const findAndRemoveComponent = useCallback((components: MachineComponent[], componentId: string): { component: MachineComponent | null, remaining: MachineComponent[] } => {
    const remaining: MachineComponent[] = [];
    let foundComponent: MachineComponent | null = null;
    
    for (const component of components) {
      if (component.id.toString() === componentId) {
        foundComponent = component;
        // No agregar este componente a remaining
        continue;
      }
      
      // Si tiene hijos, buscar recursivamente
      if (component.children && component.children.length > 0) {
        const { component: found, remaining: remainingChildren } = findAndRemoveComponent(component.children, componentId);
        if (found) {
          foundComponent = found;
          // Actualizar los hijos sin el componente encontrado
          remaining.push({
            ...component,
            children: remainingChildren
          });
        } else {
          remaining.push(component);
        }
      } else {
        remaining.push(component);
      }
    }
    
    return { component: foundComponent, remaining };
  }, []);

  // Función recursiva para agregar un componente a un padre específico
  const addComponentToParent = useCallback((components: MachineComponent[], component: MachineComponent, parentId: string | null): MachineComponent[] => {
    if (parentId === null || parentId === 'root') {
      // Agregar al nivel raíz
      return [...components, { ...component, parentId: null }];
    }
    
    return components.map(comp => {
      if (comp.id.toString() === parentId) {
        // Este es el padre, agregar el componente como hijo
        return {
          ...comp,
          children: [...(comp.children || []), { ...component, parentId: parseInt(parentId) }]
        };
      }
      
      // Si tiene hijos, buscar recursivamente
      if (comp.children && comp.children.length > 0) {
        return {
          ...comp,
          children: addComponentToParent(comp.children, component, parentId)
        };
      }
      
      return comp;
    });
  }, []);

  // Función para abrir el diálogo de duplicación
  const handleDuplicateClick = (componentId: string) => {
    const originalComponent = buscarComponentePorId(localComponents, componentId);
    
    if (!originalComponent) {
      toast.error('Componente no encontrado');
      return;
    }

    // Prellenar el nombre con el nombre original seguido de " - "
    setDuplicateComponentName(`${originalComponent.name} - `);
    setDuplicateComponentId(componentId);
    setShowDuplicateDialog(true);
  };

  // Función para confirmar y duplicar el componente
  const confirmDuplicateComponent = async () => {
    if (!duplicateComponentId) return;

    try {
      // Buscar el componente original
      const originalComponent = buscarComponentePorId(localComponents, duplicateComponentId);
      
      if (!originalComponent) {
        toast.error('Componente no encontrado');
        setShowDuplicateDialog(false);
        return;
      }

      // Validar que el nombre no esté vacío
      const finalName = duplicateComponentName.trim();
      if (!finalName || finalName === '-') {
        toast.error('El nombre del componente no puede estar vacío');
        return;
      }

      // Obtener companyId del localStorage
      let companyId: number | null = null;
      if (typeof window !== 'undefined') {
        const savedCompany = localStorage.getItem('currentCompany');
        if (savedCompany) {
          try {
            const company = JSON.parse(savedCompany);
            companyId = company.id || null;
          } catch (e) {
            console.error('Error parseando currentCompany:', e);
          }
        }
      }

      // Crear el payload para duplicar
      // Desactivar la creación automática de repuesto para la duplicación
      const payload = {
        name: finalName,
        type: originalComponent.type || 'part',
        system: originalComponent.system || '',
        technicalInfo: originalComponent.technicalInfo || '',
        machineId: machine.id,
        parentId: originalComponent.parentId || null,
        createSpare: false, // No crear repuesto automáticamente al duplicar
        ...(companyId && { companyId }), // Solo incluir companyId si está disponible
        // No incluir logo para evitar problemas de duplicación de imágenes
      };

      const response = await fetch('/api/components', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al duplicar el componente');
      }

      const result = await response.json();
      const newComponent = result.component;

      if (!newComponent || !newComponent.id) {
        throw new Error('El componente duplicado no tiene un ID válido');
      }

      // Guardar estado anterior antes de actualizar (para deshacer)
      const previousState = JSON.parse(JSON.stringify(localComponents));
      const newHistory = componentHistory.slice(0, historyIndex + 1);
      newHistory.push(previousState);
      setComponentHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);

      // Guardar acción en historial de acciones
      setActionHistory(prev => [...prev.slice(0, historyIndex + 1), {
        type: 'create',
        componentId: newComponent.id.toString(),
        previousState: previousState
      }]);

      // Actualizar la lista local de componentes
      const updatedComponents = [...localComponents, newComponent as MachineComponent];
      setLocalComponents(updatedComponents);

      // Cerrar el diálogo
      setShowDuplicateDialog(false);
      setDuplicateComponentId(null);
      setDuplicateComponentName('');

      // Inmediatamente activar el drag del componente duplicado para que se pueda mover
      setDraggedComponent(newComponent.id.toString());
      
      toast.success('Componente duplicado. Puedes moverlo a donde quieras.');
    } catch (error: any) {
      console.error('Error duplicando componente:', error);
      toast.error(error.message || 'Error al duplicar el componente');
    }
  };

  // Función para eliminar un componente
  const handleDeleteComponent = async (componentId: string) => {
    const componentToDelete = buscarComponentePorId(localComponents, componentId);
    
    if (!componentToDelete) {
      toast.error('Componente no encontrado');
      return;
    }

    // Confirmar eliminación
    if (!window.confirm(`¿Seguro que deseas eliminar el componente "${componentToDelete.name}" y todos sus subcomponentes?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/components/${componentId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al eliminar el componente');
      }

      const result = await response.json();

      // Guardar estado anterior antes de eliminar (para deshacer)
      const previousState = JSON.parse(JSON.stringify(localComponents));
      const newHistory = componentHistory.slice(0, historyIndex + 1);
      newHistory.push(previousState);
      setComponentHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);

      // Guardar acción en historial de acciones
      const componentToDelete = buscarComponentePorId(localComponents, componentId);
      setActionHistory(prev => [...prev.slice(0, historyIndex + 1), {
        type: 'delete',
        componentId: componentId,
        previousState: previousState,
        previousParentId: componentToDelete?.parentId || null
      }]);

      // Actualizar la lista local de componentes eliminando el componente y sus hijos
      const removeComponentFromTree = (components: MachineComponent[], idToRemove: string): MachineComponent[] => {
        return components
          .filter(comp => comp.id.toString() !== idToRemove)
          .map(comp => ({
            ...comp,
            children: comp.children ? removeComponentFromTree(comp.children, idToRemove) : []
          }));
      };

      const updatedComponents = removeComponentFromTree(localComponents, componentId);
      setLocalComponents(updatedComponents);

      // Mostrar mensaje de éxito
      const message = result.message || 'Componente eliminado correctamente.';
      toast.success(message);
    } catch (error: any) {
      console.error('Error eliminando componente:', error);
      toast.error(error.message || 'Error al eliminar el componente');
    }
  };

  // Función recursiva para actualizar el parent de un componente en la estructura local
  const updateComponentParentInTree = useCallback((components: MachineComponent[], componentId: string, newParentId: string | null): MachineComponent[] => {
    // Primero, encontrar y extraer el componente
    const { component: componentToMove, remaining: componentsWithoutMoved } = findAndRemoveComponent(components, componentId);
    
    if (!componentToMove) {
      // Si no se encuentra el componente, retornar sin cambios
      return components;
    }
    
    // Actualizar el parentId del componente
    const updatedComponent = {
      ...componentToMove,
      parentId: newParentId === 'root' || newParentId === null ? null : parseInt(newParentId),
      // Limpiar los hijos si se mueve (los hijos se mantienen pero el parent cambia)
      children: componentToMove.children || []
    };
    
    // Agregar el componente a su nuevo padre
    return addComponentToParent(componentsWithoutMoved, updatedComponent, newParentId);
  }, [findAndRemoveComponent, addComponentToParent]);

  // Función para actualizar el parent de un componente
  const updateComponentParent = async (componentId: string, newParentId: string | null) => {
    try {
      // Validación local antes de enviar
      const draggedComp = buscarComponentePorId(localComponents, componentId);
      if (draggedComp && newParentId) {
        const isChild = (parentId: string, childId: string): boolean => {
          const parent = buscarComponentePorId(localComponents, parentId);
          if (!parent || !parent.children || parent.children.length === 0) return false;
          for (const child of parent.children) {
            if (child.id.toString() === childId) return true;
            if (isChild(child.id.toString(), childId)) return true;
          }
          return false;
        };
        
        if (isChild(componentId, newParentId)) {
          toast.error('No puedes mover un componente a sus propios hijos');
          return;
        }
      }

      // Guardar estado anterior y parentId anterior antes de mover (para deshacer)
      const previousState = JSON.parse(JSON.stringify(localComponents));
      const previousParentId = draggedComp?.parentId?.toString() || null;
      const newHistory = componentHistory.slice(0, historyIndex + 1);
      newHistory.push(previousState);
      setComponentHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);

      // Guardar acción en historial de acciones
      setActionHistory(prev => [...prev.slice(0, historyIndex + 1), {
        type: 'move',
        componentId: componentId,
        previousParentId: previousParentId,
        previousState: previousState
      }]);

      const response = await fetch(`/api/components/${componentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parentId: newParentId === 'root' || newParentId === null ? null : parseInt(newParentId)
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al actualizar el componente');
      }

      // Actualizar el estado local sin recargar la página
      setLocalComponents(prev => updateComponentParentInTree(prev, componentId, newParentId));
      
      toast.success('Componente movido exitosamente');
    } catch (error: any) {
      console.error('Error actualizando parent del componente:', error);
      toast.error(error.message || 'Error al mover el componente');
    }
  };

  // ✨ OPTIMIZADO: Filtrar solo componentes de primer nivel (sin padre) para respetar la jerarquía
  const filteredComponents = useMemo(() => {
    return localComponents.filter(component => {
      // Solo incluir componentes de primer nivel (sin parentId)
      // parentId puede ser null, undefined, 0, o string vacío
      const parentIdValue = component.parentId;
      const isFirstLevel = !parentIdValue || 
                          parentIdValue === null || 
                          parentIdValue === undefined || 
                          parentIdValue === '' || 
                          parentIdValue === 0 ||
                          String(parentIdValue).trim() === '';
      
      // Aplicar filtro de búsqueda si existe
      const matchesSearch = searchTerm === '' || 
        component.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (component.type || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      return isFirstLevel && matchesSearch;
    });
  }, [localComponents, searchTerm]);

  // Layout de nodos - Generar todos los nodos de la jerarquía completa
  const { nodes, edges } = useMemo(() => {
    const allNodes: Node[] = [];
    
    // Agregar nodo de la máquina principal
    allNodes.push({
      id: 'root',
      name: machine.name,
      type: 'Máquina',
      x: containerSize.width / 2,
      y: 80,
      width: calculateNodeWidth(machine.name, true),
      depth: 0,
      status: 'operational' as const,
      priority: 'medium' as const
    });
    
    // Función para detectar colisiones entre nodos
    function detectCollision(node1: Node, node2: Node): boolean {
      const margin = 10; // Margen adicional más reducido para evitar que se toquen
      const left1 = node1.x - node1.width / 2 - margin;
      const right1 = node1.x + node1.width / 2 + margin;
      const top1 = node1.y - NODE_HEIGHT / 2 - margin;
      const bottom1 = node1.y + NODE_HEIGHT / 2 + margin;
      
      const left2 = node2.x - node2.width / 2 - margin;
      const right2 = node2.x + node2.width / 2 + margin;
      const top2 = node2.y - NODE_HEIGHT / 2 - margin;
      const bottom2 = node2.y + NODE_HEIGHT / 2 + margin;
      
      return !(left1 > right2 || right1 < left2 || top1 > bottom2 || bottom1 < top2);
    }

    // Función para ajustar posición si hay colisión
    function adjustPositionIfCollision(newNode: Node, existingNodes: Node[]): Node {
      let adjustedNode = { ...newNode };
      let attempts = 0;
      const maxAttempts = 50;
      
      while (attempts < maxAttempts) {
        let hasCollision = false;
        
        for (const existingNode of existingNodes) {
          if (detectCollision(adjustedNode, existingNode)) {
            hasCollision = true;
            // Mover el nodo hacia la derecha
            adjustedNode.x += HORIZONTAL_GAP;
            break;
          }
        }
        
        if (!hasCollision) {
          break;
        }
        
        attempts++;
      }
      
      return adjustedNode;
    }

    // ✨ OPTIMIZADO: Función helper para ordenar componentes (memoizada internamente)
    function sortComponents(components: MachineComponent[], depth: number, parentId?: string): MachineComponent[] {
      if (components.length === 0) return components;
      
      const sorted = [...components];
      
      if (depth === 1 && componentOrder) {
        // Ordenamiento para componentes de primer nivel
        sorted.sort((a, b) => {
          const idA = a.id?.toString();
          const idB = b.id?.toString();
          if (!idA || !idB) return 0;
          const orderA = componentOrder[idA] ?? 999999;
          const orderB = componentOrder[idB] ?? 999999;
          return orderA - orderB;
        });
      } else if (parentId && subcomponentOrder?.[parentId]) {
        // Ordenamiento para subcomponentes usando el orden del componente padre
        const parentOrder = subcomponentOrder[parentId];
        sorted.sort((a, b) => {
          const idA = a.id?.toString();
          const idB = b.id?.toString();
          if (!idA || !idB) return 0;
          const orderA = parentOrder[idA] ?? 999999;
          const orderB = parentOrder[idB] ?? 999999;
          return orderA - orderB;
        });
      } else {
        // Ordenamiento por defecto: por nombre si no hay orden personalizado
        sorted.sort((a, b) => {
          const nameA = a.name?.toLowerCase() || '';
          const nameB = b.name?.toLowerCase() || '';
          return nameA.localeCompare(nameB);
        });
      }
      
      return sorted;
    }

    // Función recursiva para agregar componentes y subcomponentes con prevención de colisiones
    function addComponentsToNodes(components: MachineComponent[], parentX: number, parentY: number, depth: number, parentId?: string) {
      if (components.length === 0) return;
      
      // Solo agregar componentes si el padre está expandido (o si es el primer nivel)
      if (parentId && !expandedComponents[parentId]) {
        return;
      }
      
      // ✨ OPTIMIZADO: Ordenar componentes usando la función helper
      const sortedComponents = sortComponents(components, depth, parentId);
      
      // Calcular el ancho total de todos los componentes en este nivel
      const componentWidths = sortedComponents.map(comp => calculateNodeWidth(comp.name, false));
      const totalWidth = componentWidths.reduce((sum, width) => sum + width, 0) + 
                        (sortedComponents.length - 1) * HORIZONTAL_GAP;
      
      let currentX = parentX - totalWidth / 2;
      const currentY = parentY + NODE_HEIGHT + VERTICAL_GAP;
      
      sortedComponents.forEach((component, index) => {
        const componentWidth = componentWidths[index];
        let nodeX = currentX + componentWidth / 2;
        
        // Validar que el componente tenga un ID válido
        if (!component.id) {
          console.warn('Componente sin ID encontrado:', component);
          return; // Saltar este componente
        }

        // Crear el nodo temporal para verificar colisiones
        const tempNode: Node = {
          id: component.id.toString(),
          name: component.name,
          type: component.type || 'Parte',
          x: nodeX,
          y: currentY,
          width: componentWidth,
          depth: depth,
          status: 'operational' as const,
          priority: 'medium' as const,
          component: component
        };

        // Ajustar posición si hay colisión con nodos existentes
        const adjustedNode = adjustPositionIfCollision(tempNode, allNodes);
        
        // Agregar el nodo ajustado
        allNodes.push(adjustedNode);
        
        // Agregar subcomponentes recursivamente usando la posición ajustada
        if (component.children && component.children.length > 0) {
          addComponentsToNodes(component.children, adjustedNode.x, currentY, depth + 1, component.id.toString());
        }
        
        // Actualizar currentX para el siguiente nodo, considerando la posición ajustada
        currentX = adjustedNode.x + componentWidth / 2 + HORIZONTAL_GAP;
      });
    }
    
    // Agregar solo componentes de primer nivel inicialmente
    if (filteredComponents.length > 0) {
      addComponentsToNodes(filteredComponents, containerSize.width / 2, 80, 1);
    }

    // Conexiones
    const edges: Edge[] = [];
    
    // Función recursiva para crear conexiones entre nodos
    function createConnections(components: MachineComponent[], parentNode: Node, depth: number) {
      components.forEach(component => {
        // Validar que el componente tenga un ID válido
        if (!component.id) {
          console.warn('Componente sin ID encontrado en conexiones:', component);
          return; // Saltar este componente
        }

        const childNode = allNodes.find(n => n.id === component.id.toString());
        if (childNode) {
          edges.push({
            from: { x: parentNode.x, y: parentNode.y + NODE_HEIGHT / 2 },
            to: { x: childNode.x, y: childNode.y - NODE_HEIGHT / 2 },
            type: 'parent-child'
          });
        
          // Crear conexiones para subcomponentes
          if (component.children && component.children.length > 0) {
            createConnections(component.children, childNode, depth + 1);
          }
        }
      });
    }
    
    // ✨ OPTIMIZADO: Crear conexiones basadas en la jerarquía real
    // Solo conectar componentes de primer nivel con la máquina raíz
    // Los subcomponentes se conectarán recursivamente con sus padres
    if (filteredComponents.length > 0) {
      const rootNode = allNodes.find(n => n.id === 'root');
      if (rootNode) {
        // filteredComponents ya contiene solo componentes de primer nivel, usar directamente
        createConnections(filteredComponents, rootNode, 1);
      }
    }

    return { nodes: allNodes, edges };
  }, [filteredComponents, containerSize.width, expandedComponents, componentOrder, subcomponentOrder]);



  // Funciones de interacción
  const handleCenter = useCallback(() => {
    setOffset({ x: 0, y: 0 });
    setZoom(1);
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom(z => Math.min(z + 0.2, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(z => Math.max(z - 0.2, 0.3));
  }, []);

  const handleReset = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setSelectedComponent(null);
    setHoveredComponent(null);
  }, []);

  // Pan con mouse - simplificado como ZoneSchemaView
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Si estamos arrastrando un componente en modo edición, no hacer pan
    if (draggedComponent) {
      return;
    }
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY, distance: undefined };
  }, [draggedComponent]);

  // Mouse move para pan - versión React
  const handleMouseMoveLocal = useCallback((e: React.MouseEvent) => {
    if (dragging.current && !draggedComponent) {
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastPos.current = { x: e.clientX, y: e.clientY, distance: lastPos.current.distance };
    }
  }, [draggedComponent]);

  // Mouse up para pan - versión React
  const handleMouseUpLocal = useCallback(() => {
    dragging.current = false;
  }, []);
  
  // Handler para cuando se suelta el mouse fuera de un componente
  const handleMouseUpGlobal = useCallback((e: MouseEvent) => {
    if (isEditMode && draggedComponent) {
      // Si se suelta el mouse fuera de cualquier componente, cancelar el arrastre
      // Esto permite desmarcar si se suelta por error
      setDraggedComponent(null);
      setDropTarget(null);
      setDragPreview(null);
    }
  }, [isEditMode, draggedComponent]);
  
  // Agregar listener global para mouse up
  useEffect(() => {
    if (isEditMode && draggedComponent) {
      document.addEventListener('mouseup', handleMouseUpGlobal);
      return () => {
        document.removeEventListener('mouseup', handleMouseUpGlobal);
      };
    }
  }, [isEditMode, draggedComponent, handleMouseUpGlobal]);

  // Función para obtener el nodo bajo las coordenadas táctiles
  const getNodeUnderTouch = useCallback((clientX: number, clientY: number, nodes: Node[]): string | null => {
    if (!containerRef.current) return null;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = (clientX - rect.left - offset.x) / zoom;
    const y = (clientY - rect.top - offset.y) / zoom;
    
    // Buscar el nodo que contiene estas coordenadas
    for (const node of nodes) {
      const nodeLeft = node.x - node.width / 2;
      const nodeRight = node.x + node.width / 2;
      const nodeTop = node.y - NODE_HEIGHT / 2;
      const nodeBottom = node.y + NODE_HEIGHT / 2;
      
      if (x >= nodeLeft && x <= nodeRight && y >= nodeTop && y <= nodeBottom) {
        return node.id;
      }
    }
    
    return null;
  }, [offset, zoom]);

  // Handlers para touch events en nodos (drag and drop)
  const handleTouchStartNode = useCallback((e: React.TouchEvent, nodeId: string) => {
    if (!isEditMode) {
      e.stopPropagation();
      return;
    }
    
    const touch = e.touches[0];
    const startTime = Date.now();
    touchStartTimeRef.current = startTime;
    touchMovedRef.current = false;
    preventClickRef.current = false;
    setTouchStartPosition({ x: touch.clientX, y: touch.clientY });
    
    // Limpiar timer anterior si existe
    if (touchLongPressTimerRef.current) {
      clearTimeout(touchLongPressTimerRef.current);
      touchLongPressTimerRef.current = null;
    }
    
    // Buscar información del nodo
    const node = nodes.find((n: any) => n.id === nodeId);
    
    // Iniciar timer para long press (500ms)
    touchLongPressTimerRef.current = setTimeout(() => {
      if (!touchMovedRef.current) {
        // Crear preview cuando se activa el drag
        if (node && setDragPreview) {
          setDragPreview({
            x: touch.clientX,
            y: touch.clientY,
            nodeId: nodeId,
            nodeName: node.name,
            nodeType: node.type || 'Parte'
          });
        }
        setDraggedComponent(nodeId);
        setIsDraggingFromTouch(true);
        preventClickRef.current = true; // Prevenir clicks normales
        toast.info('Arrastra sobre otro componente para cambiar su padre', { duration: 2000 });
      }
      touchLongPressTimerRef.current = null;
    }, 500);
  }, [isEditMode, nodes]);

  const handleTouchMoveNode = useCallback((e: React.TouchEvent, nodeId: string) => {
    const touch = e.touches[0];
    
    // Actualizar posición del preview para que siga al dedo - actualización directa para máxima fluidez
    if (draggedComponent === nodeId && isDraggingFromTouch && dragPreview && setDragPreview) {
      setDragPreview((prev: any) => prev ? { 
        ...prev, 
        x: touch.clientX,
        y: touch.clientY
      } : null);
    }
    
    // Marcar que el touch se movió
    if (touchStartPosition) {
      const deltaX = Math.abs(touch.clientX - touchStartPosition.x);
      const deltaY = Math.abs(touch.clientY - touchStartPosition.y);
      
      // Si se movió más de 10px, considerar que es un arrastre
      if (deltaX > 10 || deltaY > 10) {
        touchMovedRef.current = true;
        
        // Si aún no se activó el drag pero hay movimiento significativo después del long press
        if (!isDraggingFromTouch && touchLongPressTimerRef.current === null && touchStartTimeRef.current) {
          const timeSinceStart = Date.now() - touchStartTimeRef.current;
          if (timeSinceStart > 500) {
            // Si pasaron más de 500ms, activar el drag
            setDraggedComponent(nodeId);
            setIsDraggingFromTouch(true);
            preventClickRef.current = true;
            // Iniciar el preview en la posición del dedo
            setDragPreview((prev: any) => prev ? { 
              ...prev, 
              x: touch.clientX,
              y: touch.clientY 
            } : null);
          }
        }
      }
    }
    
    if (!isEditMode || !draggedComponent || !isDraggingFromTouch) {
      // Si hay movimiento pero no estamos en modo drag, prevenir el click
      if (touchMovedRef.current) {
        preventClickRef.current = true;
      }
      return;
    }
    
    if (!containerRef.current) return;
    
    e.preventDefault();
    e.stopPropagation();
  }, [isEditMode, draggedComponent, isDraggingFromTouch, touchStartPosition, dragPreview, nodes, setDragPreview]);

  const handleTouchEndNode = useCallback((e: React.TouchEvent, targetNodeId: string) => {
    // Limpiar timer de long press si existe
    if (touchLongPressTimerRef.current) {
      clearTimeout(touchLongPressTimerRef.current);
      touchLongPressTimerRef.current = null;
    }
    
    // Si no estábamos arrastrando, limpiar y salir
    if (!isEditMode) {
      setTouchStartPosition(null);
      setIsDraggingFromTouch(false);
      return;
    }
    
    // Si hay un componente arrastrándose y un target válido
    if (isDraggingFromTouch && draggedComponent && targetNodeId && draggedComponent !== targetNodeId) {
      const draggedComp = buscarComponentePorId(components, draggedComponent);
      if (draggedComp) {
        const isChild = (parentId: string, childId: string): boolean => {
          const parent = buscarComponentePorId(components, parentId);
          if (!parent || !parent.children || parent.children.length === 0) return false;
          for (const child of parent.children) {
            if (child.id.toString() === childId) return true;
            if (isChild(child.id.toString(), childId)) return true;
          }
          return false;
        };
        
        // Verificar que no se mueva a un hijo
        if (!isChild(draggedComponent, targetNodeId) && draggedComponent !== targetNodeId) {
          updateComponentParent(draggedComponent, targetNodeId);
        } else if (isChild(draggedComponent, targetNodeId)) {
          toast.error('No puedes mover un componente a sus propios hijos');
          setDraggedComponent(null);
          setDropTarget(null);
          setIsDraggingFromTouch(false);
          setTouchStartPosition(null);
        }
      }
    } else if (isDraggingFromTouch && draggedComponent) {
      // Si se suelta sin un target válido, cancelar
      setDraggedComponent(null);
      setDropTarget(null);
      setIsDraggingFromTouch(false);
      setTouchStartPosition(null);
    }
  }, [isEditMode, isDraggingFromTouch, draggedComponent, components, updateComponentParent]);

  // Pan táctil para móvil (solo si no estamos en modo edición arrastrando)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Si estamos arrastrando un componente, no hacer pan
    if (isDraggingFromTouch && draggedComponent) {
      return;
    }
    
    // Permitir pan siempre, incluso en modo edición, cuando se toca el fondo
    if (e.touches.length === 1 && !draggedComponent) {
      // Pan con un dedo (no cuando se está arrastrando un componente)
      const touch = e.touches[0];
      dragging.current = true;
      lastPos.current = { x: touch.clientX, y: touch.clientY, distance: undefined };
      e.preventDefault();
    } else if (e.touches.length === 2) {
      // Zoom con dos dedos - no hacer pan
      dragging.current = false;
      e.preventDefault();
    }
  }, [isDraggingFromTouch, draggedComponent]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // Si estamos en modo edición arrastrando, manejar el arrastre de componentes
    if (isEditMode && isDraggingFromTouch && draggedComponent) {
      const touch = e.touches[0];
      if (!containerRef.current) return;
      
      // Obtener el nodo bajo el dedo
      const rect = containerRef.current.getBoundingClientRect();
      const x = (touch.clientX - rect.left - offset.x) / zoom;
      const y = (touch.clientY - rect.top - offset.y) / zoom;
      
      // Buscar el nodo que contiene estas coordenadas en los nodos actuales
      // Esto se hará mejor en el renderDiagramSVG, pero por ahora actualizamos dropTarget
      // basado en la posición
      e.preventDefault();
      return;
    }
    
    // Permitir pan siempre, incluso en modo edición, cuando se arrastra el fondo
    if (e.touches.length === 1 && dragging.current && !draggedComponent) {
      // Pan con un dedo (no cuando se está arrastrando un componente)
      const touch = e.touches[0];
      setOffset(prev => ({
        x: prev.x + (touch.clientX - lastPos.current.x) / zoom,
        y: prev.y + (touch.clientY - lastPos.current.y) / zoom,
      }));
      lastPos.current = { x: touch.clientX, y: touch.clientY, distance: lastPos.current.distance };
      e.preventDefault();
    } else if (e.touches.length === 2) {
      // Zoom con dos dedos (pinch)
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const currentDistance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) + 
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
      
      // Calcular zoom basado en la distancia entre dedos
      if (lastPos.current.distance) {
        const scale = currentDistance / lastPos.current.distance;
        setZoom(prev => Math.max(0.3, Math.min(3, prev * scale)));
      }
      
      lastPos.current = { ...lastPos.current, distance: currentDistance };
      e.preventDefault();
    }
  }, [isDraggingFromTouch, draggedComponent, zoom]);

  const handleTouchEnd = useCallback(() => {
    // Si estábamos arrastrando desde touch, ya se maneja en handleTouchEndNode
    if (!isDraggingFromTouch) {
      dragging.current = false;
      lastPos.current = { ...lastPos.current, distance: undefined };
    }
    
    // Limpiar timer de long press si existe
    if (touchLongPressTimerRef.current) {
      clearTimeout(touchLongPressTimerRef.current);
      touchLongPressTimerRef.current = null;
    }
  }, [isDraggingFromTouch]);

  // Funciones para eventos del DOM (window)
  const handleWindowTouchStart = useCallback((e: TouchEvent) => {
    if (interactionMode === 'pan') {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        dragging.current = true;
        lastPos.current = { x: touch.clientX, y: touch.clientY, distance: undefined };
      } else if (e.touches.length === 2) {
        dragging.current = false;
      }
    }
  }, [interactionMode]);

  const handleWindowTouchMove = useCallback((e: TouchEvent) => {
    // Actualizar preview si estamos arrastrando un componente (móvil) - actualización directa para máxima fluidez
    if (isEditMode && draggedComponent && isDraggingFromTouch && dragPreview && e.touches.length > 0) {
      const touch = e.touches[0];
      setDragPreview({
        ...dragPreview,
        x: touch.clientX,
        y: touch.clientY
      });
    }
    
    // Permitir pan siempre, incluso en modo edición, cuando se mueve el dedo sobre el fondo
    if (e.touches.length === 1 && dragging.current && !draggedComponent) {
      // Pan con un dedo (no cuando se está arrastrando un componente)
      const touch = e.touches[0];
      setOffset(prev => ({
        x: prev.x + (touch.clientX - lastPos.current.x) / zoom,
        y: prev.y + (touch.clientY - lastPos.current.y) / zoom,
      }));
      lastPos.current = { x: touch.clientX, y: touch.clientY, distance: lastPos.current.distance };
    } else if (e.touches.length === 2) {
      // Zoom con dos dedos (pinch)
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const currentDistance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) + 
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
      
      if (lastPos.current.distance) {
        const scale = currentDistance / lastPos.current.distance;
        setZoom(prev => Math.max(0.3, Math.min(3, prev * scale)));
      }
      
      lastPos.current = { ...lastPos.current, distance: currentDistance };
    }
  }, [draggedComponent, isDraggingFromTouch, dragPreview, zoom]);

  const handleWindowTouchEnd = useCallback(() => {
    dragging.current = false;
    lastPos.current = { ...lastPos.current, distance: undefined };
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    // Actualizar preview si estamos arrastrando un componente (desktop) - actualización directa para máxima fluidez
    if (isEditMode && draggedComponent && !isDraggingFromTouch && dragPreview) {
      setDragPreview({
        ...dragPreview,
        x: e.clientX,
        y: e.clientY
      });
    }
    
    // Permitir pan siempre, incluso en modo edición, cuando se arrastra el fondo
    if (dragging.current && !draggedComponent) {
      setOffset(prev => ({
        x: prev.x + (e.clientX - lastPos.current.x) / zoom,
        y: prev.y + (e.clientY - lastPos.current.y) / zoom,
      }));
      lastPos.current = { x: e.clientX, y: e.clientY, distance: lastPos.current.distance };
    }
  }, [zoom, draggedComponent]);

  const handleMouseUp = useCallback(() => {
    dragging.current = false;
    document.body.style.cursor = '';
    
    // Limpiar preview si estamos en modo edición
    if (isEditMode && draggedComponent && !isDraggingFromTouch) {
      setDragPreview(null);
    }
  }, [isEditMode, draggedComponent, isDraggingFromTouch]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchstart', handleWindowTouchStart);
    window.addEventListener('touchmove', handleWindowTouchMove);
    window.addEventListener('touchend', handleWindowTouchEnd);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchstart', handleWindowTouchStart);
      window.removeEventListener('touchmove', handleWindowTouchMove);
      window.removeEventListener('touchend', handleWindowTouchEnd);
    };
  }, [handleMouseMove, handleMouseUp, handleWindowTouchStart, handleWindowTouchMove, handleWindowTouchEnd]);

  // Zoom con rueda
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.cancelable) {
      e.preventDefault();
    }
    if (interactionMode === 'pan') {
      setZoom(z => Math.max(0.3, Math.min(3, z - e.deltaY * 0.001)));
    }
  }, [interactionMode]);

  // Funciones de exportación
  const handleExport = useCallback(async () => {
    const element = document.getElementById('esquema-diagrama');
    if (!element) return;
    
    try {
      const canvas = await html2canvas(element, { 
        backgroundColor: null,
        scale: 2,
        useCORS: true
      });
      const link = document.createElement('a');
      link.download = `esquema_${machine.name}_${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error al exportar:', error);
    }
  }, [machine.name]);

  const handleExportSVG = useCallback(() => {
    if (!svgRef.current) return;
    
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    const link = document.createElement('a');
    link.href = svgUrl;
    link.download = `esquema_${machine.name}_${new Date().toISOString().split('T')[0]}.svg`;
    link.click();
    URL.revokeObjectURL(svgUrl);
  }, [machine.name]);

  // Funciones de pantalla completa
  const handleOpenFullscreen = useCallback(() => {
    setFullscreen(true);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const handleCloseFullscreen = useCallback(() => {
    setFullscreen(false);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  // Función para manejar clic en nodo
  const handleNodeClick = useCallback((node: Node) => {
    // En modo normal (no edición), permitir abrir el modal del componente
    if (!isEditMode && node.component && onComponentClick) {
      setSelectedComponent(node.id);
      onComponentClick(node.component);
    }
  }, [isEditMode, onComponentClick]);

  // Función para manejar hover en nodo
  const handleNodeHover = useCallback((nodeId: string | null) => {
    setHoveredComponent(nodeId);
  }, []);

  return (
    <TooltipProvider>
    <div className="space-y-2">
        {/* Header con controles */}
        <div className="flex flex-col gap-1">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-2">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Esquema de Componentes</h3>
            </div>
          </div>

          {/* Barra de herramientas principal - más compacta en móvil */}
          <div className="flex flex-wrap gap-0.5 sm:gap-1 justify-center sm:justify-start">

            {/* Controles de zoom */}
            <div className="flex border rounded-md">
               <Tooltip>
                 <TooltipTrigger asChild>
                   <Button variant="ghost" size="sm" onClick={handleZoomOut} className="rounded-r-none h-7 sm:h-8 px-1.5 sm:px-2">
                     <ZoomOut className="h-3.5 w-3.5 sm:mr-1" />
                     <span className="text-xs hidden sm:inline">Alejar</span>
                   </Button>
                 </TooltipTrigger>
                 <TooltipContent>Alejar</TooltipContent>
               </Tooltip>
               <Tooltip>
                 <TooltipTrigger asChild>
                   <Button variant="ghost" size="sm" onClick={handleZoomIn} className="rounded-l-none h-7 sm:h-8 px-1.5 sm:px-2">
                     <ZoomIn className="h-3.5 w-3.5 sm:mr-1" />
                     <span className="text-xs hidden sm:inline">Acercar</span>
                   </Button>
                 </TooltipTrigger>
                 <TooltipContent>Acercar</TooltipContent>
               </Tooltip>
            </div>

            {/* Botones de acción */}
             <Tooltip>
               <TooltipTrigger asChild>
                 <Button variant="ghost" size="sm" onClick={handleCenter} className="h-7 sm:h-8 px-1.5 sm:px-2">
                   <Home className="h-3.5 w-3.5 sm:mr-1" />
                   <span className="text-xs hidden sm:inline">Centrar</span>
                 </Button>
               </TooltipTrigger>
               <TooltipContent>Centrar vista</TooltipContent>
             </Tooltip>
             
             <Tooltip>
               <TooltipTrigger asChild>
                 <Button 
                   variant="ghost" 
                   size="sm" 
                   onClick={async () => {
                     if (historyIndex < 0 || actionHistory.length === 0) return;
                     
                     try {
                       const lastAction = actionHistory[actionHistory.length - 1];
                       const previousState = componentHistory[historyIndex];
                       
                       if (!previousState || !lastAction) {
                         toast.error('No hay acciones para deshacer');
                         return;
                       }
                       
                       // Restaurar estado anterior
                       const restoredState = JSON.parse(JSON.stringify(previousState));
                       
                       // Ejecutar acción inversa según el tipo
                       if (lastAction.type === 'create') {
                         // Eliminar componente creado del backend
                         try {
                           await fetch(`/api/components/${lastAction.componentId}`, { method: 'DELETE' });
                         } catch (err) {
                           console.error('Error eliminando componente creado:', err);
                         }
                       } else if (lastAction.type === 'move') {
                         // Restaurar parentId anterior
                         if (lastAction.previousParentId !== undefined) {
                           try {
                             await fetch(`/api/components/${lastAction.componentId}`, {
                               method: 'PATCH',
                               headers: { 'Content-Type': 'application/json' },
                               body: JSON.stringify({
                                 parentId: lastAction.previousParentId === null || lastAction.previousParentId === 'null' ? null : parseInt(lastAction.previousParentId)
                               }),
                             });
                           } catch (err) {
                             console.error('Error restaurando parentId:', err);
                           }
                         }
                       } else if (lastAction.type === 'delete') {
                         // Para eliminar, necesitaríamos recrear el componente
                         // Esto es más complejo, por ahora solo restauramos el estado local
                         // El componente ya fue eliminado del backend, así que no podemos recrearlo fácilmente
                         toast.warning('No se puede deshacer la eliminación de un componente');
                         return;
                       }
                       
                       // Restaurar estado local
                       setLocalComponents(restoredState);
                       
                       // Actualizar historial
                       const newHistory = componentHistory.slice(0, historyIndex);
                       setComponentHistory(newHistory);
                       setHistoryIndex(historyIndex - 1);
                       setActionHistory(actionHistory.slice(0, actionHistory.length - 1));
                       
                       toast.success('Acción deshecha');
                     } catch (error: any) {
                       console.error('Error deshaciendo acción:', error);
                       toast.error('Error al deshacer la acción');
                     }
                   }}
                   disabled={historyIndex < 0 || actionHistory.length === 0}
                   className={`h-7 sm:h-8 px-1.5 sm:px-2 ${historyIndex < 0 || actionHistory.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                 >
                   <Undo2 className="h-3.5 w-3.5 sm:mr-1" />
                   <span className="text-xs hidden sm:inline">Deshacer</span>
                 </Button>
               </TooltipTrigger>
               <TooltipContent>Deshacer última acción</TooltipContent>
             </Tooltip>

             <Tooltip>
               <TooltipTrigger asChild>
                 <Button variant="ghost" size="sm" onClick={handleOpenFullscreen} className="h-7 sm:h-8 px-1.5 sm:px-2">
                   <Maximize2 className="h-3.5 w-3.5 sm:mr-1" />
                   <span className="text-xs hidden sm:inline">Pantalla completa</span>
                 </Button>
               </TooltipTrigger>
               <TooltipContent>Pantalla completa</TooltipContent>
             </Tooltip>

             <Tooltip>
               <TooltipTrigger asChild>
                 <Button variant="ghost" size="sm" onClick={handleExport} className="h-7 sm:h-8 px-1.5 sm:px-2">
                   <Download className="h-3.5 w-3.5 sm:mr-1" />
                   <span className="text-xs hidden sm:inline">Exportar</span>
                 </Button>
               </TooltipTrigger>
               <TooltipContent>Exportar como imagen</TooltipContent>
             </Tooltip>

            {canEditMachine && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isEditMode ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setIsEditMode(!isEditMode)}
                    className="h-7 sm:h-8 px-1.5 sm:px-2"
                  >
                    <Edit className="h-3.5 w-3.5 sm:mr-1" />
                    <span className="text-xs hidden sm:inline">Editar</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isEditMode ? 'Salir de modo edición' : 'Editar jerarquía'}</TooltipContent>
              </Tooltip>
            )}
          </div>
          
          {/* Indicador de modo edición */}
          {isEditMode && (
            <div className="mt-2 text-center">
              <div className="inline-flex flex-col sm:flex-row items-center gap-2 px-3 py-1.5 bg-blue-100 border border-blue-300 rounded-lg text-sm text-blue-800">
                <div className="flex items-center gap-2">
                  <Edit className="h-4 w-4" />
                  <span className="font-medium">Modo Edición:</span>
                </div>
                <span className="text-xs sm:text-sm">
                  {typeof window !== 'undefined' && window.innerWidth < 768 
                    ? 'Mantén presionado un componente y arrástralo sobre otro para cambiar su padre'
                    : 'Arrastra un componente sobre otro para cambiar su padre'}
                </span>
              </div>
              {draggedComponent && (
                <div className="mt-2 text-center">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-100 border border-orange-300 rounded-lg text-sm text-orange-800">
                    <span>Arrastrando componente. Suelta sobre otro componente para cambiar su padre.</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Contenedor principal del esquema */}
        <div
          ref={containerRef}
          className="relative bg-gradient-to-br from-muted/20 to-muted/5 rounded-lg w-full h-[320px] sm:h-[380px] md:h-[420px] lg:h-[460px] xl:h-[520px] mx-auto overflow-hidden select-none border border-border shadow-lg"
          id="esquema-diagrama"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMoveLocal}
          onMouseUp={(e) => {
            handleMouseUpLocal();
            // Si se suelta el mouse fuera de un componente en modo edición, cancelar arrastre
            if (isEditMode && draggedComponent && !dropTarget) {
              setDraggedComponent(null);
              setDropTarget(null);
            }
          }}
          onMouseLeave={handleMouseUpLocal}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Cuadrícula de fondo */}
          {showGrid && (
            <svg
            width="100%"
            height="100%"
              className="absolute inset-0 pointer-events-none"
              style={{ opacity: 0.1 }}
            >
            <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="1"/>
                </pattern>
            </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
          )}

          {/* SVG principal */}
          <div style={{ width: '100%', height: '100%', minHeight: '250px', position: 'relative', overflow: 'hidden' }}>
            {/* Preview del componente arrastrado - sigue al cursor/dedo */}
            {dragPreview && draggedComponent && (
              <DragPreview dragPreview={dragPreview} />
            )}
            
            {renderDiagramSVG({
              containerSize, 
              zoom, 
              offset, 
              nodes, 
              edges, 
              showConnections, 
              showLabels, 
              selectedComponent, 
              hoveredComponent, 
              handleNodeClick, 
              handleNodeHover, 
              interactionMode, 
              onComponentClick, 
              components: localComponents, 
              expandedComponents, 
              handleComponentClick,
              isEditMode,
              draggedComponent,
              setDraggedComponent,
              dropTarget,
              setDropTarget,
              updateComponentParent,
              handleTouchStartNode,
              handleTouchMoveNode,
              handleTouchEndNode,
              isDraggingFromTouch,
              setIsDraggingFromTouch,
              containerRef,
              preventClickRef,
              touchMovedRef,
              touchStartTimeRef,
              touchLongPressTimerRef,
              dragPreview,
              setDragPreview,
              handleDuplicateClick,
              handleDeleteComponent
            })}
          </div>

          {/* Información de zoom */}
          <div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 bg-background/80 backdrop-blur-sm rounded-md px-2 py-1 sm:px-3 sm:py-1 text-xs font-medium">
            Zoom: {Math.round(zoom * 100)}%
          </div>

          {/* Información de componentes */}
          <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 bg-background/80 backdrop-blur-sm rounded-md px-2 py-1 sm:px-3 sm:py-1 text-xs font-medium">
            {nodes.length} componentes
          </div>
        </div>


        {/* Diálogo para ingresar el nombre del componente duplicado */}
        <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle>Duplicar componente</DialogTitle>
              <DialogDescription>
                Ingresa el nombre para el componente duplicado
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="duplicate-name">Nombre del componente</Label>
                <Input
                  id="duplicate-name"
                  value={duplicateComponentName}
                  onChange={(e) => setDuplicateComponentName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      confirmDuplicateComponent();
                    } else if (e.key === 'Escape') {
                      setShowDuplicateDialog(false);
                    }
                  }}
                  placeholder="Nombre del componente"
                  autoFocus
                  className="w-full"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDuplicateDialog(false);
                  setDuplicateComponentId(null);
                  setDuplicateComponentName('');
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmDuplicateComponent}
                disabled={!duplicateComponentName.trim() || duplicateComponentName.trim() === '-'}
              >
                Duplicar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        
        {/* Botones de control */}
        <div className="flex justify-center space-x-2 mb-4">
                            <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allExpanded = components.reduce((acc, component) => {
                        acc[component.id.toString()] = true;
                        return acc;
                      }, {} as {[key: string]: boolean});
                      setExpandedComponents(allExpanded);
                    }}
                  >
                    Expandir Todo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setExpandedComponents({});
                    }}
                  >
                    Contraer Todo
                  </Button>
        </div>
        


      {/* Modal pantalla completa - igual al modal normal */}
      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-background">
          <div
            className="w-full h-full relative select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMoveLocal}
            onMouseUp={handleMouseUpLocal}
            onMouseLeave={handleMouseUpLocal}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ cursor: 'grab' }}
          >
            {/* SVG principal - exactamente igual que en el modal normal */}
            <div style={{ width: '100%', height: '100%', minHeight: '250px', position: 'relative', overflow: 'hidden' }}>
              {renderDiagramSVG({
                containerSize, 
                zoom, 
                offset, 
                nodes, 
                edges, 
                showConnections, 
                showLabels, 
                selectedComponent, 
                hoveredComponent, 
                handleNodeClick, 
                handleNodeHover, 
                interactionMode, 
                onComponentClick, 
                components,
                expandedComponents,
                handleComponentClick,
                isEditMode,
                draggedComponent,
                setDraggedComponent,
                dropTarget,
                setDropTarget,
                updateComponentParent
              })}
            </div>

            {/* Información de zoom */}
            <div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 bg-background/80 rounded-md px-2 py-1 sm:px-3 sm:py-1 text-xs sm:text-sm">
              Zoom: {Math.round(zoom * 100)}%
            </div>

            {/* Información de componentes */}
            <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 bg-background/80 rounded-md px-2 py-1 sm:px-3 sm:py-1 text-xs sm:text-sm">
              {nodes.length} componentes
            </div>

            {/* Botón de cerrar */}
            <div className="absolute top-4 right-4">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={handleCloseFullscreen}
                className="w-10 h-10 rounded-full shadow-lg"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <MiniDialog open={showConfigModal} onOpenChange={setShowConfigModal}>
        <MiniDialogContent className="sm:max-w-[700px] max-w-[95vw] w-full max-h-[90vh] overflow-y-auto">
          <MiniDialogHeader>
            <MiniDialogTitle>Configuración del Esquema</MiniDialogTitle>
            <MiniDialogDescription>
              Personaliza la visualización del esquema de componentes con filtros, vista y opciones de exportación.
            </MiniDialogDescription>
          </MiniDialogHeader>
          <div className="p-2 max-h-[60vh] overflow-y-auto overflow-x-hidden">
            <Tabs defaultValue="filters" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="filters">Filtros</TabsTrigger>
                <TabsTrigger value="view">Vista</TabsTrigger>
                <TabsTrigger value="display">Visualización</TabsTrigger>
                <TabsTrigger value="export">Exportar</TabsTrigger>
              </TabsList>
              
              <TabsContent value="filters" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium">Buscar</label>
                    <div className="relative mt-1">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Buscar componentes..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Estado</label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="all">Todos los estados</option>
                      <option value="operational">Operacional</option>
                      <option value="maintenance">En mantenimiento</option>
                      <option value="warning">Advertencia</option>
                      <option value="error">Error</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Prioridad</label>
                    <select
                      value={filterPriority}
                      onChange={(e) => setFilterPriority(e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="all">Todas las prioridades</option>
                      <option value="low">Baja</option>
                      <option value="medium">Media</option>
                      <option value="high">Alta</option>
                      <option value="critical">Crítica</option>
                    </select>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="view" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Modo de vista</label>
                    <select
                      value={viewMode}
                      onChange={(e) => setViewMode(e.target.value as any)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="tree">Árbol</option>
                      <option value="radial">Radial</option>
                      <option value="hierarchical">Jerárquico</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Zoom actual</label>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="range"
                        min="0.3"
                        max="3"
                        step="0.1"
                        value={zoom}
                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                        className="flex-1"
                      />
                      <span className="text-sm text-muted-foreground w-12">
                        {Math.round(zoom * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="display" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Elementos visuales</label>
                    <div className="space-y-2">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={showGrid}
                          onChange={(e) => setShowGrid(e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-sm">Mostrar cuadrícula</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={showLabels}
                          onChange={(e) => setShowLabels(e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-sm">Mostrar etiquetas</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={showConnections}
                          onChange={(e) => setShowConnections(e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-sm">Mostrar conexiones</span>
                      </label>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Layout automático</label>
                    <div className="space-y-2">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={autoLayout}
                          onChange={(e) => setAutoLayout(e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-sm">Aplicar layout automático</span>
                      </label>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="export" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button onClick={handleExport} className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Exportar como PNG
                  </Button>
                  <Button onClick={handleExportSVG} variant="outline" className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Exportar como SVG
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </MiniDialogContent>
      </MiniDialog>

            {/* Modal expandido para el esquema - Solo el diagrama */}
      <Dialog open={showExpandedModal} onOpenChange={setShowExpandedModal}>
        <DialogContent size="full" className="h-[100vh] p-0 border-0 bg-background">
          <div
            className="w-full h-full relative select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMoveLocal}
            onMouseUp={handleMouseUpLocal}
            onMouseLeave={handleMouseUpLocal}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ cursor: 'grab' }}
          >
            {/* SVG principal */}
            <div style={{ width: '100%', height: '100%', minHeight: '250px', position: 'relative', overflow: 'hidden' }}>
              {renderDiagramSVG({
                containerSize, 
                zoom, 
                offset, 
                nodes, 
                edges, 
                showConnections, 
                showLabels, 
                selectedComponent, 
                hoveredComponent, 
                handleNodeClick, 
                handleNodeHover, 
                interactionMode, 
                onComponentClick, 
                components,
                expandedComponents,
                handleComponentClick,
                isEditMode,
                draggedComponent,
                setDraggedComponent,
                dropTarget,
                setDropTarget,
                updateComponentParent
              })}
            </div>

            {/* Controles flotantes en la derecha */}
            <div className="absolute top-3 right-3 z-20 flex flex-col gap-1">
              <div className="bg-background/80 backdrop-blur-sm rounded-2xl p-1.5 border shadow-lg">
                <div className="flex flex-col gap-0.5">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleZoomIn}
                    className="w-10 h-10 rounded-full shadow-lg"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleZoomOut}
                    className="w-10 h-10 rounded-full shadow-lg"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleCenter}
                    className="w-10 h-10 rounded-full shadow-lg"
                  >
                    <Home className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleReset}
                    className="w-10 h-10 rounded-full shadow-lg"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Información de navegación en la esquina inferior izquierda */}
            <div className="absolute bottom-3 left-3 z-20">
              <div className="bg-background/80 backdrop-blur-sm rounded-lg p-1.5 border shadow-lg">
                <div className="text-foreground/80 text-xs space-y-1">
                  <div className="flex items-center space-x-2">
                    <MousePointer className="h-3 w-3" />
                    <span>Arrastra para mover</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RotateCcw className="h-3 w-3" />
                    <span>Rueda para zoom</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Eye className="h-3 w-3" />
                    <span>Clic para ver detalles</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
} 