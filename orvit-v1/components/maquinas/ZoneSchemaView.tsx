'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Machine, MachineStatus, MachineComponent } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { NodeCard } from './NodeCard';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  Download,
  Home,
  ChevronsUpDown,
  ChevronsDownUp,
  FolderOpen,
  Building2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import html2canvas from 'html2canvas';

interface PlantZone {
  id: number;
  name: string;
  color: string;
  logo?: string;
  description?: string;
  sectorId: number;
  companyId: number;
  parentId?: number | null;
  children?: PlantZone[];
  machines?: Machine[];
}

interface ZoneSchemaViewProps {
  zones: PlantZone[];
  machines: Machine[];
  onMachineClick?: (machine: Machine) => void;
  onComponentClick?: (component: MachineComponent) => void;
  onZoneClick?: (zone: PlantZone) => void;
  sectorName?: string;
}

// Constantes de layout
const ROOT_NODE_WIDTH = 220;
const ROOT_NODE_HEIGHT = 100;
const ZONE_NODE_WIDTH = 280;
const ZONE_NODE_HEIGHT = 120;
const MACHINE_NODE_WIDTH = 190;
const MACHINE_NODE_HEIGHT = 76;
const COMPONENT_NODE_WIDTH = 190;
const COMPONENT_NODE_HEIGHT = 76;
const HORIZONTAL_GAP = 30;
const VERTICAL_GAP = 90;

interface SchemaNode {
  id: string;
  name: string;
  type: 'sector' | 'zone' | 'machine' | 'component';
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  zone?: PlantZone;
  machine?: Machine;
  component?: MachineComponent;
  depth: number;
  hasChildren?: boolean;
  machineCount?: number;
}

interface Edge {
  from: { x: number; y: number };
  to: { x: number; y: number };
}

function traducirTipo(tipo: string | undefined | null): "Máquina" | "Parte" | "Módulo" {
  if (!tipo) return 'Parte';
  const lower = tipo.toLowerCase();
  if (lower === 'module' || lower === 'módulo') return 'Módulo';
  if (lower === 'machine' || lower === 'máquina') return 'Máquina';
  return 'Parte';
}

export default function ZoneSchemaView({
  zones,
  machines,
  onMachineClick,
  onComponentClick,
  sectorName = 'Sector'
}: ZoneSchemaViewProps) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 1400, height: 600 });
  const [expandedZones, setExpandedZones] = useState<Set<number>>(new Set());
  const [expandedMachines, setExpandedMachines] = useState<Set<number>>(new Set());
  const [expandedComponents, setExpandedComponents] = useState<Set<string | number>>(new Set());
  const [machineComponents, setMachineComponents] = useState<Record<number, MachineComponent[]>>({});
  const [loadingComponents, setLoadingComponents] = useState<Set<number>>(new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastClickRef = useRef<{ nodeId: string; time: number } | null>(null);

  // Cargar componentes de una máquina
  const loadMachineComponents = useCallback(async (machineId: number) => {
    if (machineComponents[machineId] || loadingComponents.has(machineId)) return;

    setLoadingComponents(prev => new Set(prev).add(machineId));
    try {
      const response = await fetch(`/api/maquinas/${machineId}/components`);
      if (response.ok) {
        const components = await response.json();
        setMachineComponents(prev => ({ ...prev, [machineId]: components }));
      }
    } catch (error) {
      console.error('Error loading components:', error);
    } finally {
      setLoadingComponents(prev => {
        const next = new Set(prev);
        next.delete(machineId);
        return next;
      });
    }
  }, [machineComponents, loadingComponents]);

  // Helper function to calculate component tree width recursively
  const calculateComponentTreeWidth = useCallback((component: MachineComponent, depth: number = 0): number => {
    const children = component.children || [];
    const isExpanded = expandedComponents.has(component.id);

    if (!isExpanded || children.length === 0) {
      return COMPONENT_NODE_WIDTH;
    }

    // Sum of all children widths
    let childrenWidth = 0;
    children.forEach(child => {
      childrenWidth += calculateComponentTreeWidth(child, depth + 1) + HORIZONTAL_GAP;
    });
    childrenWidth = Math.max(childrenWidth - HORIZONTAL_GAP, COMPONENT_NODE_WIDTH);

    return Math.max(COMPONENT_NODE_WIDTH, childrenWidth);
  }, [expandedComponents]);

  // Helper function to render component tree recursively
  const renderComponentTree = useCallback((
    component: MachineComponent,
    startX: number,
    parentY: number,
    parentCenterX: number,
    depth: number,
    nodes: SchemaNode[],
    edges: Edge[]
  ): number => {
    const children = component.children || [];
    const isExpanded = expandedComponents.has(component.id);
    const hasChildren = children.length > 0;
    const componentWidth = calculateComponentTreeWidth(component, depth);
    const compY = parentY + COMPONENT_NODE_HEIGHT + VERTICAL_GAP;
    const compCenterX = startX + componentWidth / 2;

    nodes.push({
      id: `component-${component.id}`,
      name: component.name,
      type: 'component',
      x: compCenterX,
      y: compY,
      width: COMPONENT_NODE_WIDTH,
      height: COMPONENT_NODE_HEIGHT,
      component: component,
      depth: 3 + depth,
      hasChildren
    });

    edges.push({
      from: { x: parentCenterX, y: parentY + COMPONENT_NODE_HEIGHT / 2 },
      to: { x: compCenterX, y: compY - COMPONENT_NODE_HEIGHT / 2 }
    });

    // Render children if expanded
    if (isExpanded && hasChildren) {
      let childX = startX;
      children.forEach(child => {
        const childWidth = calculateComponentTreeWidth(child, depth + 1);
        renderComponentTree(child, childX, compY, compCenterX, depth + 1, nodes, edges);
        childX += childWidth + HORIZONTAL_GAP;
      });
    }

    return componentWidth;
  }, [expandedComponents, calculateComponentTreeWidth]);

  // Calcular layout de nodos
  const calculateLayout = useCallback((): { nodes: SchemaNode[], edges: Edge[], totalWidth: number } => {
    const nodes: SchemaNode[] = [];
    const edges: Edge[] = [];

    // Agrupar máquinas por zona
    const zoneMap = new Map<number, Machine[]>();
    const machinesWithoutZone: Machine[] = [];

    zones.forEach(zone => {
      if (zone.machines) {
        zoneMap.set(zone.id, zone.machines);
      }
    });

    machines.forEach(machine => {
      const inZone = zones.some(z => z.machines?.some(m => m.id === machine.id));
      if (!inZone) {
        machinesWithoutZone.push(machine);
      }
    });

    // Calcular ancho total necesario
    let totalItems: { type: 'zone' | 'machine-group', zone?: PlantZone, machines?: Machine[] }[] = [];

    zones.forEach(zone => {
      totalItems.push({ type: 'zone', zone, machines: zone.machines });
    });

    if (machinesWithoutZone.length > 0) {
      totalItems.push({ type: 'machine-group', machines: machinesWithoutZone });
    }

    if (totalItems.length === 0) {
      // Solo mostrar el sector
      const centerX = containerSize.width / 2;
      nodes.push({
        id: 'sector',
        name: sectorName,
        type: 'sector',
        x: centerX,
        y: 60,
        width: ROOT_NODE_WIDTH,
        height: ROOT_NODE_HEIGHT,
        depth: 0
      });
      return { nodes, edges, totalWidth: ROOT_NODE_WIDTH };
    }

    // Calcular posiciones
    let currentX = HORIZONTAL_GAP;
    const zoneY = 60 + ROOT_NODE_HEIGHT + VERTICAL_GAP;

    // Primero calcular el ancho total
    let totalWidth = HORIZONTAL_GAP;
    totalItems.forEach((item, index) => {
      if (item.type === 'zone' && item.zone) {
        const isExpanded = expandedZones.has(item.zone.id);
        const zoneMachines = item.machines || [];

        if (isExpanded && zoneMachines.length > 0) {
          // Calcular ancho basado en máquinas expandidas (con componentes recursivos)
          let machinesWidth = 0;
          zoneMachines.forEach(machine => {
            const isMachineExpanded = expandedMachines.has(machine.id);
            const components = machineComponents[machine.id] || [];
            if (isMachineExpanded && components.length > 0) {
              let componentsWidth = 0;
              components.forEach(comp => {
                componentsWidth += calculateComponentTreeWidth(comp, 0) + HORIZONTAL_GAP;
              });
              machinesWidth += Math.max(MACHINE_NODE_WIDTH, componentsWidth);
            } else {
              machinesWidth += MACHINE_NODE_WIDTH + HORIZONTAL_GAP;
            }
          });
          totalWidth += Math.max(ZONE_NODE_WIDTH, machinesWidth) + HORIZONTAL_GAP;
        } else {
          totalWidth += ZONE_NODE_WIDTH + HORIZONTAL_GAP;
        }
      } else if (item.type === 'machine-group' && item.machines) {
        let machinesWidth = 0;
        item.machines.forEach(machine => {
          const isMachineExpanded = expandedMachines.has(machine.id);
          const components = machineComponents[machine.id] || [];
          if (isMachineExpanded && components.length > 0) {
            let componentsWidth = 0;
            components.forEach(comp => {
              componentsWidth += calculateComponentTreeWidth(comp, 0) + HORIZONTAL_GAP;
            });
            machinesWidth += Math.max(MACHINE_NODE_WIDTH, componentsWidth);
          } else {
            machinesWidth += MACHINE_NODE_WIDTH + HORIZONTAL_GAP;
          }
        });
        totalWidth += Math.max(ZONE_NODE_WIDTH, machinesWidth) + HORIZONTAL_GAP;
      }
    });

    // Nodo del sector centrado
    const sectorX = totalWidth / 2;
    nodes.push({
      id: 'sector',
      name: sectorName,
      type: 'sector',
      x: sectorX,
      y: 60,
      width: ROOT_NODE_WIDTH,
      height: ROOT_NODE_HEIGHT,
      depth: 0
    });

    // Posicionar zonas y máquinas
    currentX = HORIZONTAL_GAP;

    totalItems.forEach((item) => {
      if (item.type === 'zone' && item.zone) {
        const zone = item.zone;
        const isExpanded = expandedZones.has(zone.id);
        const zoneMachines = item.machines || [];

        // Calcular ancho de esta zona (con componentes recursivos)
        let zoneWidth = ZONE_NODE_WIDTH;
        if (isExpanded && zoneMachines.length > 0) {
          let machinesWidth = 0;
          zoneMachines.forEach(machine => {
            const isMachineExpanded = expandedMachines.has(machine.id);
            const components = machineComponents[machine.id] || [];
            if (isMachineExpanded && components.length > 0) {
              let componentsWidth = 0;
              components.forEach(comp => {
                componentsWidth += calculateComponentTreeWidth(comp, 0) + HORIZONTAL_GAP;
              });
              machinesWidth += Math.max(MACHINE_NODE_WIDTH, componentsWidth);
            } else {
              machinesWidth += MACHINE_NODE_WIDTH + HORIZONTAL_GAP;
            }
          });
          zoneWidth = Math.max(ZONE_NODE_WIDTH, machinesWidth);
        }

        const zoneCenterX = currentX + zoneWidth / 2;

        // Nodo de zona
        nodes.push({
          id: `zone-${zone.id}`,
          name: zone.name,
          type: 'zone',
          x: zoneCenterX,
          y: zoneY,
          width: ZONE_NODE_WIDTH,
          height: ZONE_NODE_HEIGHT,
          color: zone.color,
          zone: zone,
          depth: 1,
          hasChildren: zoneMachines.length > 0,
          machineCount: zoneMachines.length
        });

        // Edge del sector a la zona
        edges.push({
          from: { x: sectorX, y: 60 + ROOT_NODE_HEIGHT / 2 + 15 },
          to: { x: zoneCenterX, y: zoneY - ZONE_NODE_HEIGHT / 2 }
        });

        // Si está expandida, mostrar máquinas
        if (isExpanded && zoneMachines.length > 0) {
          let machineX = currentX;
          const machineY = zoneY + ZONE_NODE_HEIGHT + VERTICAL_GAP;

          zoneMachines.forEach(machine => {
            const isMachineExpanded = expandedMachines.has(machine.id);
            const components = machineComponents[machine.id] || [];

            // Calcular ancho de esta máquina (con componentes recursivos)
            let machineWidth = MACHINE_NODE_WIDTH;
            if (isMachineExpanded && components.length > 0) {
              let componentsWidth = 0;
              components.forEach(comp => {
                componentsWidth += calculateComponentTreeWidth(comp, 0) + HORIZONTAL_GAP;
              });
              machineWidth = Math.max(MACHINE_NODE_WIDTH, componentsWidth - HORIZONTAL_GAP);
            }

            const machineCenterX = machineX + machineWidth / 2;

            nodes.push({
              id: `machine-${machine.id}`,
              name: machine.name,
              type: 'machine',
              x: machineCenterX,
              y: machineY,
              width: MACHINE_NODE_WIDTH,
              height: MACHINE_NODE_HEIGHT,
              machine: machine,
              depth: 2,
              hasChildren: true
            });

            edges.push({
              from: { x: zoneCenterX, y: zoneY + ZONE_NODE_HEIGHT / 2 },
              to: { x: machineCenterX, y: machineY - MACHINE_NODE_HEIGHT / 2 }
            });

            // Si la máquina está expandida, mostrar componentes (recursivamente)
            if (isMachineExpanded && components.length > 0) {
              let compX = machineX;

              components.forEach(comp => {
                const compWidth = calculateComponentTreeWidth(comp, 0);
                renderComponentTree(comp, compX, machineY, machineCenterX, 0, nodes, edges);
                compX += compWidth + HORIZONTAL_GAP;
              });
            }

            machineX += machineWidth + HORIZONTAL_GAP;
          });
        }

        currentX += zoneWidth + HORIZONTAL_GAP;

      } else if (item.type === 'machine-group' && item.machines) {
        // Máquinas sin zona
        const groupMachines = item.machines;

        // Calcular ancho del grupo (con componentes recursivos)
        let groupWidth = ZONE_NODE_WIDTH;
        let machinesWidth = 0;
        groupMachines.forEach(machine => {
          const isMachineExpanded = expandedMachines.has(machine.id);
          const components = machineComponents[machine.id] || [];
          if (isMachineExpanded && components.length > 0) {
            let componentsWidth = 0;
            components.forEach(comp => {
              componentsWidth += calculateComponentTreeWidth(comp, 0) + HORIZONTAL_GAP;
            });
            machinesWidth += Math.max(MACHINE_NODE_WIDTH, componentsWidth);
          } else {
            machinesWidth += MACHINE_NODE_WIDTH + HORIZONTAL_GAP;
          }
        });
        groupWidth = Math.max(ZONE_NODE_WIDTH, machinesWidth);

        const groupCenterX = currentX + groupWidth / 2;
        const isExpanded = expandedZones.has(-1);

        // Nodo de grupo "Sin zona"
        nodes.push({
          id: 'no-zone',
          name: 'Sin zona',
          type: 'zone',
          x: groupCenterX,
          y: zoneY,
          width: ZONE_NODE_WIDTH,
          height: ZONE_NODE_HEIGHT,
          color: '#6b7280',
          depth: 1,
          hasChildren: groupMachines.length > 0,
          machineCount: groupMachines.length
        });

        edges.push({
          from: { x: sectorX, y: 60 + ROOT_NODE_HEIGHT / 2 + 15 },
          to: { x: groupCenterX, y: zoneY - ZONE_NODE_HEIGHT / 2 }
        });

        if (isExpanded && groupMachines.length > 0) {
          let machineX = currentX;
          const machineY = zoneY + ZONE_NODE_HEIGHT + VERTICAL_GAP;

          groupMachines.forEach(machine => {
            const isMachineExpanded = expandedMachines.has(machine.id);
            const components = machineComponents[machine.id] || [];

            // Calcular ancho de esta máquina (con componentes recursivos)
            let machineWidth = MACHINE_NODE_WIDTH;
            if (isMachineExpanded && components.length > 0) {
              let componentsWidth = 0;
              components.forEach(comp => {
                componentsWidth += calculateComponentTreeWidth(comp, 0) + HORIZONTAL_GAP;
              });
              machineWidth = Math.max(MACHINE_NODE_WIDTH, componentsWidth - HORIZONTAL_GAP);
            }

            const machineCenterX = machineX + machineWidth / 2;

            nodes.push({
              id: `machine-${machine.id}`,
              name: machine.name,
              type: 'machine',
              x: machineCenterX,
              y: machineY,
              width: MACHINE_NODE_WIDTH,
              height: MACHINE_NODE_HEIGHT,
              machine: machine,
              depth: 2,
              hasChildren: true
            });

            edges.push({
              from: { x: groupCenterX, y: zoneY + ZONE_NODE_HEIGHT / 2 },
              to: { x: machineCenterX, y: machineY - MACHINE_NODE_HEIGHT / 2 }
            });

            // Si la máquina está expandida, mostrar componentes (recursivamente)
            if (isMachineExpanded && components.length > 0) {
              let compX = machineX;

              components.forEach(comp => {
                const compWidth = calculateComponentTreeWidth(comp, 0);
                renderComponentTree(comp, compX, machineY, machineCenterX, 0, nodes, edges);
                compX += compWidth + HORIZONTAL_GAP;
              });
            }

            machineX += machineWidth + HORIZONTAL_GAP;
          });
        }

        currentX += groupWidth + HORIZONTAL_GAP;
      }
    });

    return { nodes, edges, totalWidth };
  }, [zones, machines, expandedZones, expandedMachines, expandedComponents, machineComponents, containerSize, sectorName, calculateComponentTreeWidth, renderComponentTree]);

  const { nodes, edges, totalWidth } = calculateLayout();

  // Calcular viewBox dinámico
  const viewBoxWidth = Math.max(containerSize.width, totalWidth + 100);
  const maxDepth = Math.max(...nodes.map(n => n.depth), 0);
  const viewBoxHeight = Math.max(containerSize.height, 60 + (maxDepth + 1) * (MACHINE_NODE_HEIGHT + VERTICAL_GAP) + 100);

  // Medir contenedor
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({
          width: Math.max(rect.width, 800),
          height: Math.max(rect.height, 500)
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [isFullscreen]);

  // Centrar vista inicialmente
  useEffect(() => {
    setOffset({ x: 0, y: 0 });
  }, []);

  // Zoom con rueda del mouse
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(prev => Math.max(0.05, Math.min(5, prev + delta)));
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging.current) {
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastPos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp = () => {
    dragging.current = false;
  };

  // Toggle expand zone
  const toggleZoneExpand = (zoneId: number) => {
    setExpandedZones(prev => {
      const next = new Set(prev);
      if (next.has(zoneId)) {
        next.delete(zoneId);
      } else {
        next.add(zoneId);
      }
      return next;
    });
  };

  // Toggle expand machine
  const toggleMachineExpand = async (machineId: number) => {
    if (!expandedMachines.has(machineId)) {
      await loadMachineComponents(machineId);
    }
    setExpandedMachines(prev => {
      const next = new Set(prev);
      if (next.has(machineId)) {
        next.delete(machineId);
      } else {
        next.add(machineId);
      }
      return next;
    });
  };

  // Toggle expand component
  const toggleComponentExpand = (componentId: string | number) => {
    setExpandedComponents(prev => {
      const next = new Set(prev);
      if (next.has(componentId)) {
        next.delete(componentId);
      } else {
        next.add(componentId);
      }
      return next;
    });
  };

  // Reset view
  const resetView = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  // Expand all
  const expandAll = () => {
    const allZoneIds = zones.map(z => z.id);
    allZoneIds.push(-1); // Sin zona
    setExpandedZones(new Set(allZoneIds));
  };

  // Collapse all
  const collapseAll = () => {
    setExpandedZones(new Set());
    setExpandedMachines(new Set());
    setExpandedComponents(new Set());
  };

  // Export as PNG
  const exportPNG = async () => {
    if (!containerRef.current) return;
    try {
      const canvas = await html2canvas(containerRef.current, {
        backgroundColor: '#ffffff',
        scale: 2
      });
      const link = document.createElement('a');
      link.download = `esquema-${sectorName.toLowerCase().replace(/\s+/g, '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error exporting:', error);
    }
  };

  // Handle node click with double-click detection
  const handleNodeClick = (node: SchemaNode, e: React.MouseEvent) => {
    e.stopPropagation();

    const now = Date.now();
    const DOUBLE_CLICK_THRESHOLD = 300;

    // Check if this is a double-click
    if (lastClickRef.current &&
        lastClickRef.current.nodeId === node.id &&
        now - lastClickRef.current.time < DOUBLE_CLICK_THRESHOLD) {
      // This is a double-click - cancel any pending single-click action
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      lastClickRef.current = null;

      // Handle double-click action
      if (node.type === 'machine' && node.machine && onMachineClick) {
        onMachineClick(node.machine);
      } else if (node.type === 'component' && node.component) {
        // Double-click on component opens detail modal
        if (onComponentClick) {
          onComponentClick(node.component);
        }
      }
      return;
    }

    // Record this click for potential double-click detection
    lastClickRef.current = { nodeId: node.id, time: now };

    // Delay single-click action to allow for double-click detection
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }

    clickTimeoutRef.current = setTimeout(() => {
      clickTimeoutRef.current = null;

      if (node.type === 'zone') {
        const zoneId = node.zone?.id ?? -1;
        toggleZoneExpand(zoneId);
      } else if (node.type === 'machine' && node.machine) {
        // Single click expands to show components
        toggleMachineExpand(node.machine.id);
      } else if (node.type === 'component' && node.component) {
        // Single click expands to show subcomponents
        toggleComponentExpand(node.component.id);
      }
    }, DOUBLE_CLICK_THRESHOLD);
  };

  // Handle double click explicitly (backup)
  const handleNodeDoubleClick = (node: SchemaNode, e: React.MouseEvent) => {
    e.stopPropagation();
    // Cancel any pending single-click action
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }

    if (node.type === 'machine' && node.machine && onMachineClick) {
      onMachineClick(node.machine);
    } else if (node.type === 'component' && node.component && onComponentClick) {
      onComponentClick(node.component);
    }
  };

  // Render node
  const renderNode = (node: SchemaNode) => {
    const nodeX = node.x - node.width / 2;
    const nodeY = node.y - node.height / 2;

    if (node.type === 'sector') {
      return (
        <g key={node.id} transform={`translate(${nodeX}, ${nodeY})`}>
          <foreignObject width={node.width} height={node.height}>
            <div className="w-full h-full">
              <div className="relative bg-white dark:bg-background border border-border/60 rounded-2xl shadow-[0_6px_18px_rgba(15,23,42,0.08)] flex flex-col items-center justify-center w-full h-full px-4 py-3">
                <div className="mb-1.5 text-foreground/80 h-5 w-5">
                  <Building2 className="h-full w-full" />
                </div>
                <div className="text-[15px] font-semibold text-foreground text-center truncate max-w-[180px]">
                  {node.name}
                </div>
                <div className="text-[11px] text-muted-foreground text-center mt-0.5">
                  Sector
                </div>
              </div>
            </div>
          </foreignObject>
        </g>
      );
    }

    if (node.type === 'zone') {
      const isExpanded = expandedZones.has(node.zone?.id ?? -1);
      const machineCount = node.machineCount || 0;
      const zoneColor = node.color || '#3b82f6';

      return (
        <g
          key={node.id}
          transform={`translate(${nodeX}, ${nodeY})`}
          onClick={(e) => handleNodeClick(node, e)}
          style={{ cursor: 'pointer' }}
        >
          <foreignObject width={node.width} height={node.height}>
            <div className="w-full h-full">
              <div
                className={cn(
                  "relative bg-white dark:bg-background",
                  "border border-border/60",
                  "rounded-2xl",
                  "shadow-[0_6px_18px_rgba(15,23,42,0.08)]",
                  "hover:shadow-[0_10px_26px_rgba(15,23,42,0.12)]",
                  "transition-all duration-200",
                  "flex flex-col items-center justify-center",
                  "w-full h-full px-6 py-5",
                  isExpanded && "ring-2 ring-foreground/10 border-foreground/20 bg-muted/20"
                )}
              >
                {/* Barra de color a la izquierda */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
                  style={{ backgroundColor: zoneColor }}
                />

                <div style={{ color: zoneColor, marginBottom: '6px' }}>
                  <FolderOpen style={{ width: '28px', height: '28px' }} />
                </div>
                <div
                  style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    color: '#1f2937',
                    textAlign: 'center',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '250px',
                    width: '100%',
                    lineHeight: '1.2'
                  }}
                  title={node.name}
                >
                  {node.name}
                </div>
                <div style={{ fontSize: '13px', color: '#6b7280', textAlign: 'center', marginTop: '4px' }}>
                  {machineCount} máquinas {isExpanded ? '▼' : '▶'}
                </div>
              </div>
            </div>
          </foreignObject>
          {/* Indicador de expansión */}
          {node.hasChildren && (
            <circle
              cx={node.width - 15}
              cy={15}
              r={6}
              fill={isExpanded ? zoneColor : 'white'}
              stroke={zoneColor}
              strokeWidth={2}
            />
          )}
        </g>
      );
    }

    if (node.type === 'machine') {
      const isExpanded = expandedMachines.has(node.machine?.id ?? 0);
      const isLoading = loadingComponents.has(node.machine?.id ?? 0);
      const hasComponents = (machineComponents[node.machine?.id ?? 0]?.length ?? 0) > 0;

      return (
        <g
          key={node.id}
          transform={`translate(${nodeX}, ${nodeY})`}
          onClick={(e) => handleNodeClick(node, e)}
          onDoubleClick={(e) => handleNodeDoubleClick(node, e)}
          style={{ cursor: 'pointer' }}
        >
          <foreignObject width={node.width} height={node.height}>
            <div className="w-full h-full">
              <NodeCard
                title={node.name}
                subtitle="Máquina"
                icon="gear"
                showDot={node.machine?.status === MachineStatus.ACTIVE}
                size="child"
              />
            </div>
          </foreignObject>
          {/* Indicador de expansión */}
          {(hasComponents || !machineComponents[node.machine?.id ?? 0]) && (
            <g>
              <circle
                cx={node.width - 15}
                cy={15}
                r={6}
                fill={isExpanded ? 'hsl(var(--primary))' : 'white'}
                stroke="hsl(var(--primary))"
                strokeWidth={2}
              />
              {isLoading && (
                <circle
                  cx={node.width - 15}
                  cy={15}
                  r={4}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  strokeDasharray="8 4"
                  className="animate-spin origin-center"
                  style={{ transformOrigin: `${node.width - 15}px 15px` }}
                />
              )}
            </g>
          )}
        </g>
      );
    }

    if (node.type === 'component') {
      const hasChildren = node.hasChildren || (node.component?.children && node.component.children.length > 0);
      const componentId = node.component?.id;
      const isExpanded = componentId ? expandedComponents.has(componentId) : false;

      return (
        <g
          key={node.id}
          transform={`translate(${nodeX}, ${nodeY})`}
          onClick={(e) => handleNodeClick(node, e)}
          onDoubleClick={(e) => handleNodeDoubleClick(node, e)}
          style={{ cursor: 'pointer' }}
        >
          <foreignObject width={node.width} height={node.height}>
            <div className="w-full h-full">
              <NodeCard
                title={node.name}
                subtitle={traducirTipo(node.component?.type)}
                icon="gear"
                size="child"
              />
            </div>
          </foreignObject>
          {/* Indicador de expansión para componentes con hijos */}
          {hasChildren && (
            <circle
              cx={node.width - 15}
              cy={15}
              r={6}
              fill={isExpanded ? 'hsl(var(--primary))' : 'white'}
              stroke="hsl(var(--primary))"
              strokeWidth={2}
            />
          )}
        </g>
      );
    }

    return null;
  };

  return (
    <TooltipProvider>
      <div className="space-y-2">
        {/* Header con controles */}
        <div className="flex flex-col gap-1">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">Esquema de Zonas y Máquinas</h3>
          </div>

          {/* Controles */}
          <div className="flex flex-wrap gap-0.5 justify-center sm:justify-start">
            <div className="flex border rounded-md">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2.5 text-xs rounded-r-none"
                    onClick={() => setZoom(prev => Math.max(0.05, prev - 0.2))}
                  >
                    <ZoomOut className="h-4 w-4 mr-2" />
                    <span className="text-xs">Alejar</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Alejar</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2.5 text-xs rounded-l-none"
                    onClick={() => setZoom(prev => Math.min(5, prev + 0.2))}
                  >
                    <ZoomIn className="h-4 w-4 mr-2" />
                    <span className="text-xs font-normal">Acercar</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Acercar</TooltipContent>
              </Tooltip>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs" onClick={resetView}>
                  <Home className="h-4 w-4 mr-2" />
                  <span className="text-xs font-normal">Centrar</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Centrar vista</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs" onClick={expandAll}>
                  <ChevronsUpDown className="h-4 w-4 mr-2" />
                  <span className="text-xs font-normal">Expandir</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Expandir zonas</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs" onClick={collapseAll}>
                  <ChevronsDownUp className="h-4 w-4 mr-2" />
                  <span className="text-xs font-normal">Colapsar</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Colapsar todo</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2.5 text-xs"
                  onClick={() => setIsFullscreen(prev => !prev)}
                >
                  {isFullscreen ? <Minimize2 className="h-4 w-4 mr-2" /> : <Maximize2 className="h-4 w-4 mr-2" />}
                  <span className="text-xs font-normal">{isFullscreen ? 'Salir' : 'Pantalla completa'}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs" onClick={exportPNG}>
                  <Download className="h-4 w-4 mr-2" />
                  <span className="text-xs font-normal">Exportar</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Exportar como imagen</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Canvas del esquema */}
        <div
          ref={containerRef}
          className={cn(
            "relative bg-gradient-to-br from-muted/20 to-muted/5 rounded-lg w-full mx-auto overflow-hidden select-none border border-border shadow-lg",
            isFullscreen && "fixed inset-0 z-50 rounded-none"
          )}
          style={{
            height: isFullscreen ? '100vh' : 'calc(100vh - 350px)',
            minHeight: 400
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div style={{ width: '100%', height: '100%', minHeight: 250, position: 'relative', overflow: 'hidden' }}>
            <svg
              ref={svgRef}
              width="100%"
              height="100%"
              viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
              style={{
                display: 'block',
                background: 'none',
                cursor: dragging.current ? 'grabbing' : 'grab'
              }}
            >
              <g transform={`translate(${offset.x}, ${offset.y}) scale(${zoom})`}>
                {/* Edges */}
                {edges.map((edge, i) => (
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

                {/* Nodes */}
                {nodes.map(node => renderNode(node))}
              </g>

              <defs>
                <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000" floodOpacity="0.15" />
                </filter>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--muted-foreground))" />
                </marker>
              </defs>
            </svg>
          </div>

          {/* Info de zoom */}
          <div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 bg-background/80 backdrop-blur-sm rounded-md px-2 py-1 sm:px-3 sm:py-1 text-xs font-medium">
            Zoom: {Math.round(zoom * 100)}%
          </div>

          {/* Instrucciones */}
          <div className="absolute top-2 left-2 sm:top-4 sm:left-4 bg-background/80 backdrop-blur-sm rounded-md px-2 py-1 sm:px-3 sm:py-1.5 text-xs">
            <span className="text-muted-foreground">1 click: expandir/contraer</span>
            <span className="mx-2 text-muted-foreground/50">|</span>
            <span className="text-muted-foreground">2 clicks: ver detalle (máquinas y componentes)</span>
          </div>

          {/* Conteo de elementos */}
          <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 bg-background/80 backdrop-blur-sm rounded-md px-2 py-1 sm:px-3 sm:py-1 text-xs font-medium">
            {zones.length} zonas • {machines.length} máquinas
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex justify-center space-x-2 mb-4">
          <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={expandAll}>
            Expandir Todo
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={collapseAll}>
            Contraer Todo
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}
