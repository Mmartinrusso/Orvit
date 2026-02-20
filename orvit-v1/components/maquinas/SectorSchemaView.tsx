'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Machine, MachineStatus, MachineType } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  Tag,
  Loader2
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import html2canvas from 'html2canvas';
import { Dialog as MiniDialog, DialogContent as MiniDialogContent, DialogHeader as MiniDialogHeader, DialogTitle as MiniDialogTitle, DialogDescription as MiniDialogDescription } from '@/components/ui/dialog';

interface SectorSchemaViewProps {
  sector: any;
  machines: Machine[];
  onMachineClick?: (machine: Machine) => void;
  onComponentClick?: (component: any) => void;
}

const BASE_NODE_WIDTH = 120; // Ancho mínimo
const MAX_NODE_WIDTH = 280; // Ancho máximo
// Constantes de espaciado
const NODE_HEIGHT = 100; // Aumentado de 80
const HORIZONTAL_GAP = 80; // Aumentado de 40
const VERTICAL_GAP = 120; // Aumentado de 60

// Función para calcular el ancho dinámico del nodo basado en el texto
function calculateNodeWidth(text: string | undefined | null): number {
  if (!text) return 120;
  
  // Reducir el ancho base y el padding
  const baseWidth = 100; // Reducido de 120
  const charWidth = 8; // Reducido de 10
  const padding = 20; // Reducido de 30
  
  const textWidth = text.length * charWidth;
  const totalWidth = Math.max(baseWidth, textWidth + padding);
  
  // Limitar el ancho máximo
  return Math.min(totalWidth, 250); // Aumentado de 200
}

interface Node {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number; // Ancho dinámico del nodo
  depth: number;
  machine?: Machine;
  component?: any;
  children?: Node[];
  status?: 'operational' | 'maintenance' | 'warning' | 'error';
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

interface Edge {
  from: { x: number; y: number };
  to: { x: number; y: number };
  type?: 'parent-child' | 'dependency' | 'flow';
}

function getTreeLayout(machines: Machine[], startX: number, startY: number): Node[] {
  let nodes: Node[] = [];
  let queue: any[] = [{ 
    machine: machines[0], 
    x: startX, 
    y: startY, 
    depth: 0,
    status: 'operational' as const,
    priority: 'medium' as const
  }];
  
  while (queue.length) {
    const { machine, x, y, depth, status, priority } = queue.shift();
    const nodeWidth = calculateNodeWidth(machine.name);
    nodes.push({ 
      id: machine.id.toString(),
      name: machine.name,
      type: traducirTipo(machine.type), // Traducir el tipo al español
      x, 
      y, 
      width: nodeWidth,
      depth,
      machine: machine,
      status: machine.status === MachineStatus.ACTIVE ? 'operational' : 
              machine.status === MachineStatus.OUT_OF_SERVICE ? 'maintenance' : 'error',
      priority: 'medium' as const
    });
    
    // En el esquema de sector, no hay hijos, solo máquinas al mismo nivel
  }
  return nodes;
}

function getNodeColor(node: Node): { fill: string; stroke: string; text: string } {
  if (node.type === 'Máquina principal') {
    return {
      fill: 'hsl(var(--primary))',
      stroke: 'hsl(var(--primary))',
      text: 'hsl(var(--primary-foreground))'
    };
  }
  
  if (node.machine) {
    switch (node.machine.status) {
      case MachineStatus.ACTIVE:
        return {
          fill: 'hsl(142, 76%, 36%)',
          stroke: 'hsl(142, 76%, 36%)',
          text: 'white'
        };
      case MachineStatus.OUT_OF_SERVICE:
        return {
          fill: 'hsl(38, 92%, 50%)',
          stroke: 'hsl(38, 92%, 50%)',
          text: 'white'
        };
      case MachineStatus.DECOMMISSIONED:
        return {
          fill: 'hsl(0, 84%, 60%)',
          stroke: 'hsl(0, 84%, 60%)',
          text: 'white'
        };
      default:
        return {
          fill: 'hsl(var(--muted))',
          stroke: 'hsl(var(--border))',
          text: 'hsl(var(--muted-foreground))'
        };
    }
  }
  
  return {
    fill: 'hsl(var(--muted))',
    stroke: 'hsl(var(--border))',
    text: 'hsl(var(--muted-foreground))'
  };
}

function traducirTipo(tipo: any) {
  switch (tipo) {
    case 'PRODUCTION':
      return 'Producción';
    case 'MAINTENANCE':
      return 'Mantenimiento';
    case 'UTILITY':
      return 'Utilidad';
    case 'PACKAGING':
      return 'Empaque';
    case 'TRANSPORTATION':
      return 'Transporte';
    case 'OTHER':
      return 'Otro';
    case 'part':
      return 'Pieza';
    case 'Part':
      return 'Pieza';
    case 'piece':
      return 'Pieza';
    case 'Piece':
      return 'Pieza';
    case 'component':
      return 'Componente';
    case 'Component':
      return 'Componente';
    case 'assembly':
      return 'Ensamblaje';
    case 'Assembly':
      return 'Ensamblaje';
    case 'subcomponent':
      return 'Subcomponente';
    case 'Subcomponent':
      return 'Subcomponente';
    default:
      return tipo;
  }
}

function buscarMaquinaPorId(machines: Machine[], id: string): Machine | undefined {
  return machines.find(machine => machine.id.toString() === id);
}

// Fragmento reutilizable para el SVG del diagrama
function renderDiagramSVG({containerSize, zoom, offset, nodes, edges, showConnections, showLabels, selectedMachine, hoveredMachine, handleNodeClick, handleNodeHover, interactionMode, onMachineClick, onComponentClick, machines, expandedMachines, machineComponents, expandedComponents, handleComponentClick}: any) {
  return (
    <svg
      width="100%"
      height="100%"
      style={{ display: 'block', background: 'none' }}
      viewBox={`0 0 ${containerSize.width} ${containerSize.height}`}
    >
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="rgba(0,0,0,0.1)"/>
        </filter>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--muted-foreground))" opacity="0.7"/>
        </marker>
      </defs>
      
      {/* Transformación para zoom y pan */}
      <g transform={`translate(${offset.x}, ${offset.y}) scale(${zoom})`}>
        {/* Líneas de conexión */}
        {showConnections && edges.map((edge: any, i: any) => (
          <g key={i}>
            {/* Línea principal */}
            <path
              d={`M${edge.from.x},${edge.from.y} C${edge.from.x},${(edge.from.y + edge.to.y) / 2} ${edge.to.x},${(edge.from.y + edge.to.y) / 2} ${edge.to.x},${edge.to.y}`}
              stroke="hsl(var(--foreground))"
              strokeWidth={2}
              fill="none"
              opacity={0.8}
              markerEnd="url(#arrowhead)"
            />
            {/* Línea de sombra para mejor visibilidad */}
            <path
              d={`M${edge.from.x},${edge.from.y} C${edge.from.x},${(edge.from.y + edge.to.y) / 2} ${edge.to.x},${(edge.from.y + edge.to.y) / 2} ${edge.to.x},${edge.to.y}`}
              stroke="rgba(0,0,0,0.2)"
              strokeWidth={3}
              fill="none"
              opacity={0.3}
            />
          </g>
        ))}
        
        {/* Nodos */}
        {nodes.map((node: any, i: any) => {
          const colors = getNodeColor(node);
          const isSelected = selectedMachine === node.id;
          const isHovered = hoveredMachine === node.id;
          
          // Icono según tipo
          let Icon = null;
          if (node.type === 'Máquina principal') Icon = <Cog className="h-8 w-8 text-white/80" />;
          else if (node.type === 'Producción') Icon = <Cog className="h-8 w-8 text-white/80" />;
          else if (node.type === 'Mantenimiento') Icon = <Wrench className="h-8 w-8 text-white/80" />;
          else if (node.type === 'Utilidad') Icon = <Settings className="h-8 w-8 text-white/80" />;
          else if (node.type === 'Empaque') Icon = <Grid3X3 className="h-8 w-8 text-white/80" />;
          else if (node.type === 'Transporte') Icon = <Network className="h-8 w-8 text-white/80" />;
          else if (node.type === 'Otro') Icon = <Layers className="h-8 w-8 text-white/80" />;
          else Icon = <Cog className="h-8 w-8 text-white/80" />;
          
          return (
            <g 
              key={node.id} 
              transform={`translate(${node.x - node.width / 2},${node.y - NODE_HEIGHT / 2})`}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();

                // Usar la nueva lógica de click
                if (node.type === 'Máquina principal') {
                  return;
                }

                // Si es una máquina (depth 1), usar la nueva lógica
                if (node.machine && node.depth === 1) {
                  handleNodeClick(node.id);
                  return;
                }

                // Si es un componente, usar handleComponentClick para expandir/contraer
                if (node.component && handleComponentClick) {
                  handleComponentClick(node.component, node.id);
                  return;
                }
              }}
              onMouseEnter={() => handleNodeHover(node.id)}
              onMouseLeave={() => handleNodeHover(null)}
              style={{ 
                cursor: node.type === 'Máquina principal' ? 'default' : 
                        (node.depth === 1 && !node.component) ? 'pointer' : // Máquinas
                        node.component ? 'pointer' : 'default', // Componentes
                transition: 'filter 0.2s, transform 0.2s',
                userSelect: 'none'
              }}
            >
              {/* Sombra y fondo */}
              <rect
                width={node.width}
                height={NODE_HEIGHT}
                rx={20}
                fill={colors.fill}
                stroke={colors.stroke}
                strokeWidth={isSelected ? 4 : 2}
                filter="url(#shadow)"
                style={{
                  filter: isHovered ? 'drop-shadow(0 4px 16px hsl(var(--primary) / 0.3))' : undefined,
                  transform: isHovered ? 'scale(1.04)' : undefined,
                  transition: 'filter 0.2s, transform 0.2s',
                }}
              />
              
              {/* Icono centrado arriba, pegado al top */}
              <g transform={`translate(${node.width / 2}, 24)`}>
                <g transform="translate(-8, -16)" style={{ color: colors.text }}>{Icon}</g>
              </g>
              
              {/* Nombre y tipo centrados vertical y horizontalmente debajo del icono */}
              {showLabels && (
                <>
                  <text
                    x={node.width / 2}
                    y={NODE_HEIGHT / 2 + 8}
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    fill={colors.text}
                    fontWeight="bold"
                    fontSize={15}
                    className="select-none drop-shadow"
                  >
                    {node.name}
                  </text>
                  <text
                    x={node.width / 2}
                    y={NODE_HEIGHT / 2 + 28}
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    fill={colors.text}
                    fontSize={11}
                    opacity={0.9}
                    className="select-none"
                  >
                    {traducirTipo(node.type)}
                  </text>
                </>
              )}
              
              {/* Indicadores de estado/prioridad si aplica - DESACTIVADOS */}
              {/* {node.status && node.status !== 'operational' && (
                <circle
                  cx={node.width - 15}
                  cy={15}
                  r={6}
                  fill={
                    node.status === 'maintenance' ? 'hsl(38, 92%, 50%)' :
                    node.status === 'warning' ? 'hsl(25, 95%, 53%)' :
                    node.status === 'error' ? 'hsl(0, 84%, 60%)' :
                    'hsl(var(--muted-foreground))'
                  }
                  stroke="white"
                  strokeWidth={1}
                />
              )} */}
              
              {/* Indicador de máquina clickeable */}
              {node.depth === 1 && !node.component && (
                <circle
                  cx={15}
                  cy={15}
                  r={4}
                  fill="hsl(var(--primary))"
                  stroke="white"
                  strokeWidth={1}
                />
              )}
              
              {/* Indicador de componente */}
              {node.component && (
                <g>
                  <circle
                    cx={15}
                    cy={15}
                    r={4}
                    fill="hsl(var(--muted-foreground))"
                    stroke="white"
                    strokeWidth={1}
                  />
                  {/* Indicador de que tiene subcomponentes */}
                  {node.component.children && node.component.children.length > 0 && (
                    <>
                      <circle
                        cx={node.width - 15}
                        cy={15}
                        r={6}
                        fill="hsl(var(--primary))"
                        stroke="white"
                        strokeWidth={2}
                      />
                      {/* Indicador de expansión */}
                      {expandedComponents && expandedComponents[node.id] && (
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
                      )}
                    </>
                  )}
                </g>
              )}
              
              {/* Indicador de máquina con componentes */}
              {node.machine && node.depth === 1 && (
                <g>
                  {/* Indicador de que tiene componentes */}
                  {machineComponents[node.machine.id.toString()] && machineComponents[node.machine.id.toString()].length > 0 && (
                    <circle
                      cx={node.width - 15}
                      cy={15}
                      r={6}
                      fill="hsl(var(--primary))"
                      stroke="white"
                      strokeWidth={2}
                    />
                  )}
                  
                  {/* Indicador de expansión */}
                  {expandedMachines[node.machine.id.toString()] && (
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
                  )}
                </g>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export default function SectorSchemaView({ sector, machines, onMachineClick, onComponentClick }: SectorSchemaViewProps) {
  const [selectedMachine, setSelectedMachine] = useState<string | null>(null);
  const [hoveredMachine, setHoveredMachine] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [fullscreen, setFullscreen] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 1000, height: 600 });
  const [viewMode, setViewMode] = useState<'tree' | 'radial' | 'hierarchical'>('tree');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [interactionMode, setInteractionMode] = useState<'pan' | 'select'>('pan');
  const [showGrid, setShowGrid] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [showConnections, setShowConnections] = useState(true);
  const [autoLayout, setAutoLayout] = useState(true);
  const [showExpandedModal, setShowExpandedModal] = useState(false);
  const [machineComponents, setMachineComponents] = useState<{[key: string]: any[]}>({});
  const [isLoadingComponents, setIsLoadingComponents] = useState(false);
  const [expandedMachines, setExpandedMachines] = useState<{[key: string]: boolean}>({});
  const [expandedComponents, setExpandedComponents] = useState<{[key: string]: boolean}>({});
  const [clickTimers, setClickTimers] = useState<{[key: string]: NodeJS.Timeout}>({});
  const [lastClickTime, setLastClickTime] = useState<{[key: string]: number}>({});
  
  // Asegurar que el modal expandido esté en modo pan
  useEffect(() => {
    if (showExpandedModal) {
      setInteractionMode('pan');
    }
  }, [showExpandedModal]);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // Cargar componentes de todas las máquinas
  useEffect(() => {
    const loadAllMachineComponents = async () => {
      setIsLoadingComponents(true);
      const componentsMap: {[key: string]: any[]} = {};
      
      for (const machine of machines) {
        try {
          const response = await fetch(`/api/maquinas/${machine.id}/components`);
          if (response.ok) {
            const components = await response.json();
            componentsMap[machine.id.toString()] = components;
          } else {
            componentsMap[machine.id.toString()] = [];
          }
        } catch (error) {
          console.error(`Error cargando componentes de máquina ${machine.id}:`, error);
          componentsMap[machine.id.toString()] = [];
        }
      }
      
      setMachineComponents(componentsMap);
      setIsLoadingComponents(false);
    };

    if (machines.length > 0) {
      loadAllMachineComponents();
    }
  }, [machines]);

  // Función para manejar clicks en máquinas
  const handleMachineClick = useCallback((machineId: string, machine: Machine) => {
    const now = Date.now();
    const lastClick = lastClickTime[machineId] || 0;
    const timeDiff = now - lastClick;

    // Limpiar timer anterior si existe
    if (clickTimers[machineId]) {
      clearTimeout(clickTimers[machineId]);
    }

    if (timeDiff < 300) {
      // Doble click - abrir modal
      if (onMachineClick) {
        onMachineClick(machine);
      }
      setLastClickTime(prev => ({ ...prev, [machineId]: 0 }));
    } else {
      // Click simple - expandir/contraer
      setExpandedMachines(prev => ({
        ...prev,
        [machineId]: !prev[machineId]
      }));
      
      // Preparar timer para doble click
      const timer = setTimeout(() => {
        // Click simple confirmado
      }, 300);
      
      setClickTimers(prev => ({ ...prev, [machineId]: timer }));
      setLastClickTime(prev => ({ ...prev, [machineId]: now }));
    }
  }, [onMachineClick, clickTimers, lastClickTime]);

  // Limpiar timers al desmontar
  useEffect(() => {
    return () => {
      Object.values(clickTimers).forEach(timer => clearTimeout(timer));
    };
  }, [clickTimers]);

  // Estado para rastrear clicks en componentes (para doble click)
  const [componentClickTimers, setComponentClickTimers] = useState<{[key: string]: NodeJS.Timeout}>({});
  const [lastComponentClickTime, setLastComponentClickTime] = useState<{[key: string]: number}>({});

  // Función para manejar clicks en componentes (con soporte doble click)
  const handleComponentClick = useCallback((component: any, componentNodeId: string) => {
    const now = Date.now();
    const lastClick = lastComponentClickTime[componentNodeId] || 0;
    const timeDiff = now - lastClick;

    // Limpiar timer anterior si existe
    if (componentClickTimers[componentNodeId]) {
      clearTimeout(componentClickTimers[componentNodeId]);
    }

    if (timeDiff < 300) {
      // Doble click - abrir modal de detalles del componente
      if (onComponentClick) {
        onComponentClick(component);
      }
      setLastComponentClickTime(prev => ({ ...prev, [componentNodeId]: 0 }));
    } else {
      // Click simple - expandir/contraer si tiene hijos
      if (component.children && component.children.length > 0) {
        setExpandedComponents(prev => ({
          ...prev,
          [componentNodeId]: !prev[componentNodeId]
        }));
      }

      // Preparar timer para doble click
      const timer = setTimeout(() => {
        // Click simple confirmado
      }, 300);

      setComponentClickTimers(prev => ({ ...prev, [componentNodeId]: timer }));
      setLastComponentClickTime(prev => ({ ...prev, [componentNodeId]: now }));
    }
  }, [onComponentClick, componentClickTimers, lastComponentClickTime]);

  // Limpiar timers de componentes al desmontar
  useEffect(() => {
    return () => {
      Object.values(componentClickTimers).forEach(timer => clearTimeout(timer));
    };
  }, [componentClickTimers]);

  // Actualizar el tamaño del contenedor
  useEffect(() => {
    function updateSize() {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // Restar el padding del tamaño total (p-16 = 64px de cada lado)
        const padding = 128; // 64px de cada lado
        const width = Math.max(rect.width - padding, 800); // Tamaño mínimo
        const height = Math.max(rect.height - padding, 600); // Tamaño mínimo
        setContainerSize({ width, height });
      }
    }
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Filtrar máquinas
  const filteredMachines = machines.filter(machine => {
    const matchesSearch = searchTerm === '' || 
      machine.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (machine.nickname && machine.nickname.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = filterStatus === 'all' || machine.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  // Generar nodos - distribución en círculo alrededor del sector
  const nodes: Node[] = [];
  const centerX = containerSize.width / 2;
  const centerY = containerSize.height / 2;
  
  if (filteredMachines.length > 0) {
    // Nodo central del sector
    const sectorNode: Node = {
      id: 'sector',
      name: sector?.name || 'Sector',
      type: 'Máquina principal',
      x: centerX,
      y: centerY,
      width: calculateNodeWidth(sector?.name || 'Sector'),
      depth: 0,
      status: 'operational' as const,
      priority: 'medium' as const
    };
    nodes.push(sectorNode);
    
    // Distribuir máquinas en círculo alrededor del sector
    const radius = Math.max(250, filteredMachines.length * 80);
    const angleStep = (2 * Math.PI) / filteredMachines.length;
    
    filteredMachines.forEach((machine, index) => {
      const angle = index * angleStep;
      const machineX = centerX + radius * Math.cos(angle);
      const machineY = centerY + radius * Math.sin(angle);
      
      const machineWidth = calculateNodeWidth(machine.name);
      const machineNode: Node = {
        id: machine.id.toString(),
        name: machine.name,
        type: machine.type,
        x: machineX,
        y: machineY,
        width: machineWidth,
        depth: 1,
        machine: machine,
        status: machine.status === MachineStatus.ACTIVE ? 'operational' : 
                machine.status === MachineStatus.OUT_OF_SERVICE ? 'maintenance' : 'error',
        priority: 'medium' as const
      };
      nodes.push(machineNode);
      
      // Solo agregar componentes si la máquina está expandida
      if (expandedMachines[machine.id.toString()]) {
        const components = machineComponents[machine.id.toString()] || [];
        if (components.length > 0) {
          addComponentsToNodes(components, machineX, machineY, 2, machine.id.toString());
        }
      }
    });
  }

  // Debug: Resumen de nodos por profundidad
  const nodesByDepth: {[key: number]: number} = {};
  nodes.forEach(n => {
    nodesByDepth[n.depth] = (nodesByDepth[n.depth] || 0) + 1;
  });
  // Generar conexiones: sector -> máquinas -> componentes (todos los niveles)
  const edges: Edge[] = [];
  const sectorNode = nodes.find(n => n.type === 'Máquina principal');

  if (sectorNode) {
    // Conexiones del sector a las máquinas
    nodes.filter(n => n.machine && !n.component).forEach(machineNode => {
      edges.push({
        from: { x: sectorNode.x, y: sectorNode.y },
        to: { x: machineNode.x, y: machineNode.y },
        type: 'parent-child'
      });
    });

    // Conexiones de las máquinas a sus componentes principales (depth 2)
    nodes.filter(n => n.machine && !n.component).forEach(machineNode => {
      const machineId = machineNode.id;
      const machineComps = nodes.filter(n =>
        n.component &&
        n.id.startsWith(`${machineId}-comp-`) &&
        n.depth === 2
      );

      machineComps.forEach(componentNode => {
        edges.push({
          from: { x: machineNode.x, y: machineNode.y },
          to: { x: componentNode.x, y: componentNode.y },
          type: 'parent-child'
        });
      });
    });

    // Conexiones dinámicas para TODOS los niveles de componentes (depth 2+)
    // Buscar todos los componentes y conectar padres con hijos basado en el prefijo del ID
    const componentNodes = nodes.filter(n => n.component);
    componentNodes.forEach(parentNode => {
      // Buscar hijos directos: IDs que empiezan con "parentId-comp-" y tienen exactamente un nivel más
      const childNodes = componentNodes.filter(n => {
        if (n.depth !== parentNode.depth + 1) return false;
        // El ID del hijo debe empezar con el ID del padre + '-comp-'
        return n.id.startsWith(parentNode.id + '-comp-');
      });

      childNodes.forEach(childNode => {
        edges.push({
          from: { x: parentNode.x, y: parentNode.y },
          to: { x: childNode.x, y: childNode.y },
          type: 'parent-child'
        });
      });
    });
  }

  // Handlers para interacción
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (interactionMode === 'pan') {
      dragging.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
      (e.currentTarget as HTMLElement).style.cursor = 'grabbing';
    }
  }, [interactionMode]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging.current && interactionMode === 'pan') {
      setOffset(prev => ({
        x: prev.x + (e.clientX - lastPos.current.x),
        y: prev.y + (e.clientY - lastPos.current.y),
      }));
      lastPos.current = { x: e.clientX, y: e.clientY };
    }
  }, [interactionMode]);

  const handleMouseUp = useCallback(() => {
    dragging.current = false;
    if (containerRef.current) {
      (containerRef.current as HTMLElement).style.cursor = interactionMode === 'pan' ? 'grab' : 'default';
    }
  }, [interactionMode]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.05, Math.min(5, prev * delta)));
  }, []);

  const handleNodeClick = useCallback((nodeId: string) => {
    // Si es una máquina, usar la nueva lógica de click
    const machine = machines.find(m => m.id.toString() === nodeId);
    if (machine) {
      handleMachineClick(nodeId, machine);
    } else {
      // Si es un componente, solo seleccionar
      setSelectedMachine(nodeId);
    }
  }, [machines, handleMachineClick]);

  const handleNodeHover = useCallback((nodeId: string | null) => {
    setHoveredMachine(nodeId);
  }, []);

  const handleExport = useCallback(async () => {
    if (containerRef.current) {
      try {
        const canvas = await html2canvas(containerRef.current, {
          backgroundColor: null,
          scale: 2,
        });
        const link = document.createElement('a');
        link.download = `esquema-sector-${sector?.name || 'sector'}.png`;
        link.href = canvas.toDataURL();
        link.click();
      } catch (error) {
        console.error('Error al exportar:', error);
      }
    }
  }, [sector]);

  // Función para agregar componentes a los nodos (mejorada para sector)
  function addComponentsToNodes(components: any[], parentX: number, parentY: number, depth: number, machineId: string, parentComponentId?: string) {
    if (components.length === 0) return;

    // Calcular anchos de componentes
    const componentWidths = components.map(comp => calculateNodeWidth(comp.name));
    // Usar un espaciado mucho mayor para componentes
    const componentGap = 150; // Aumentado significativamente de HORIZONTAL_GAP (80)
    const totalComponentsWidth = componentWidths.reduce((sum, width) => sum + width, 0) + 
                                (components.length - 1) * componentGap;
    
    let currentX = parentX - totalComponentsWidth / 2;
    const currentY = parentY + NODE_HEIGHT + VERTICAL_GAP;
    
    components.forEach((component, index) => {
      const componentWidth = componentWidths[index];
      let nodeX = currentX + componentWidth / 2;
      
      // Validar que el componente tenga un ID válido
      if (!component.id) {
        console.warn('Componente sin ID encontrado:', component);
        return; // Saltar este componente
      }

      // Generar ID del componente
      let componentNodeId: string;
      if (parentComponentId) {
        // Es un subcomponente
        componentNodeId = `${parentComponentId}-comp-${component.id}`;
      } else {
        // Es un componente de primer nivel
        componentNodeId = `${machineId}-comp-${component.id}`;
      }

      // Crear el nodo temporal para verificar colisiones
      const tempNode: Node = {
        id: componentNodeId,
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
      const adjustedNode = adjustPositionIfCollision(tempNode, nodes);
      
      // Agregar el nodo ajustado
      nodes.push(adjustedNode);
      
      // Agregar subcomponentes recursivamente si el componente está expandido
      if (component.children && component.children.length > 0) {
        // Solo mostrar hijos si el componente está expandido
        if (expandedComponents[componentNodeId]) {
          addComponentsToNodes(component.children, adjustedNode.x, currentY, depth + 1, machineId, componentNodeId);
        }
      }
      
      // Actualizar currentX para el siguiente nodo, considerando la posición ajustada
      currentX = adjustedNode.x + componentWidth / 2 + componentGap;
    });
  }

  // Función para detectar colisiones entre nodos
  function detectCollision(node1: Node, node2: Node): boolean {
    const margin = 50; // Aumentado de 20 a 50 para más separación
    return Math.abs(node1.x - node2.x) < (node1.width + node2.width) / 2 + margin &&
           Math.abs(node1.y - node2.y) < NODE_HEIGHT + margin;
  }

  // Función para ajustar posición si hay colisión
  function adjustPositionIfCollision(newNode: Node, existingNodes: Node[]): Node {
    let adjustedNode = { ...newNode };
    let attempts = 0;
    const maxAttempts = 10;
    const collisionGap = 200; // Espaciado mayor para evitar colisiones
    
    while (attempts < maxAttempts) {
      let hasCollision = false;
      
      for (const existingNode of existingNodes) {
        if (detectCollision(adjustedNode, existingNode)) {
          hasCollision = true;
          break;
        }
      }
      
      if (!hasCollision) {
        break;
      }
      
      // Mover el nodo hacia la derecha con más espacio
      adjustedNode.x += collisionGap;
      attempts++;
    }
    
    return adjustedNode;
  }

  const resetView = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  return (
    <TooltipProvider>
      <div className="space-y-3">
        {/* Header con controles */}
        <div className="flex flex-col gap-1">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-2">
            <div>
              <h3 className="text-lg font-semibold">Esquema de Componentes</h3>
              <p className="text-muted-foreground text-sm">
                Vista esquemática de {sector?.name} y sus {machines.length} máquinas
              </p>
            </div>
          </div>
          
          {/* Barra de herramientas principal */}
          <div className="flex flex-wrap gap-0.5 justify-center sm:justify-start">
            {/* Modo de interacción */}
            <div className="flex border rounded-md">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={interactionMode === 'pan' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setInteractionMode('pan')}
                    className="rounded-r-none"
                  >
                    <Hand className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Modo navegación</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={interactionMode === 'select' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setInteractionMode('select')}
                    className="rounded-l-none"
                  >
                    <MousePointer className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Modo selección</TooltipContent>
              </Tooltip>
            </div>

            {/* Controles de zoom */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => setZoom(prev => Math.max(0.05, prev * 0.9))}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Alejar</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => setZoom(prev => Math.min(5, prev * 1.1))}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Acercar</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={resetView}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Resetear vista</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => setFullscreen(true)}>
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Pantalla completa</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={handleExport}>
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Exportar como imagen</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => setShowConfigModal(true)}>
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Configuración</TooltipContent>
            </Tooltip>

            {/* Toggle conexiones */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showConnections ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setShowConnections(!showConnections)}
                >
                  <Network className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {showConnections ? 'Ocultar conexiones' : 'Mostrar conexiones'}
              </TooltipContent>
            </Tooltip>
            
            {/* Toggle etiquetas */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showLabels ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setShowLabels(!showLabels)}
                >
                  <Tag className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {showLabels ? 'Ocultar etiquetas' : 'Mostrar etiquetas'}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Leyenda */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground bg-muted/30 p-2 rounded">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary"></div>
            <span>Máquinas (click = expandir, doble click = detalles)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-muted-foreground"></div>
            <span>Componentes (click = expandir, doble click = detalles)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary"></div>
            <span>Indicador de hijos disponibles</span>
          </div>
        </div>

        {/* Instrucciones */}
        <div className="text-center text-sm text-muted-foreground bg-info-muted border border-info-muted rounded-lg p-2">
          💡 <strong>Instrucciones:</strong> Click = expandir/contraer • Doble click = ver detalles (máquinas y componentes)
        </div>

        {/* Botones de control */}
        <div className="flex justify-center flex-wrap gap-2 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const allExpanded = machines.reduce((acc, machine) => {
                acc[machine.id.toString()] = true;
                return acc;
              }, {} as {[key: string]: boolean});
              setExpandedMachines(allExpanded);
            }}
          >
            Expandir Máquinas
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setExpandedMachines({});
              setExpandedComponents({});
            }}
          >
            Contraer Todo
          </Button>
        </div>

        {/* Información de estado */}
        <div className="text-center text-xs text-muted-foreground bg-success-muted border border-success-muted rounded-lg p-2">
          📊 <strong>Estado:</strong> {Object.values(expandedMachines).filter(Boolean).length} de {machines.length} máquinas expandidas • {Object.values(expandedComponents).filter(Boolean).length} componentes expandidos
        </div>

        {/* Contenedor del esquema con padding */}
        <div
          ref={containerRef}
          className="relative bg-gradient-to-br from-muted/20 to-muted/5 rounded-lg w-full h-[600px] sm:h-[650px] md:h-[700px] lg:h-[750px] xl:h-[800px] mx-auto overflow-hidden select-none border border-border shadow-lg p-16"
          id="esquema-diagrama"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          style={{ 
            cursor: dragging.current ? 'grabbing' : interactionMode === 'pan' ? 'grab' : 'default'
          }}
        >
          {/* Indicador de carga */}
          {isLoadingComponents && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Cargando componentes...</span>
              </div>
            </div>
          )}
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
            {renderDiagramSVG({
              containerSize,
              zoom,
              offset,
              nodes,
              edges,
              showConnections,
              showLabels,
              selectedMachine,
              hoveredMachine,
              handleNodeClick,
              handleNodeHover,
              interactionMode,
              onMachineClick,
              onComponentClick,
              machines,
              expandedMachines,
              machineComponents,
              expandedComponents,
              handleComponentClick
            })}
          </div>

          {/* Información de zoom */}
          <div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 bg-background/80 rounded-md px-2 py-1 sm:px-3 sm:py-1 text-xs sm:text-sm">
            Zoom: {Math.round(zoom * 100)}%
          </div>

          {/* Información de máquinas y componentes */}
          <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 bg-background/80 rounded-md px-2 py-1 sm:px-3 sm:py-1 text-xs sm:text-sm">
            {nodes.length} elementos
          </div>
        </div>

        {/* Leyenda */}
        <Card>
          <CardContent className="p-2 sm:p-3">
            <div className="flex flex-wrap items-center justify-center gap-0.5 sm:gap-2 text-xs">
              <div className="flex items-center space-x-1 sm:space-x-2">
                <div className="w-2 h-2 sm:w-3 sm:h-3 bg-primary rounded"></div>
                <span>Máquina principal</span>
              </div>
              <div className="flex items-center space-x-1 sm:space-x-2">
                <div className="w-2 h-2 sm:w-3 sm:h-3 bg-success rounded"></div>
                <span>Operacional</span>
              </div>
              <div className="flex items-center space-x-1 sm:space-x-2">
                <div className="w-2 h-2 sm:w-3 sm:h-3 bg-warning rounded"></div>
                <span>Mantenimiento</span>
              </div>
              <div className="flex items-center space-x-1 sm:space-x-2">
                <div className="w-2 h-2 sm:w-3 sm:h-3 bg-warning rounded"></div>
                <span>Advertencia</span>
              </div>
              <div className="flex items-center space-x-1 sm:space-x-2">
                <div className="w-2 h-2 sm:w-3 sm:h-3 bg-destructive rounded"></div>
                <span>Error</span>
              </div>
              <div className="flex items-center space-x-1 sm:space-x-2">
                <div className="w-3 sm:w-4 h-0.5 bg-muted-foreground opacity-60"></div>
                <span>Conexión</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Modal pantalla completa - igual al modal normal */}
        {fullscreen && (
          <div className="fixed inset-0 z-50 bg-background">
            <div 
              className="w-full h-full relative select-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onWheel={handleWheel}
              onMouseEnter={() => setInteractionMode('pan')}
              style={{ cursor: dragging.current ? 'grabbing' : interactionMode === 'pan' ? 'grab' : 'default' }}
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
                  selectedMachine,
                  hoveredMachine,
                  handleNodeClick,
                  handleNodeHover,
                  interactionMode,
                  onMachineClick,
                  onComponentClick,
                  machines,
                  expandedMachines,
                  machineComponents,
                  expandedComponents,
                  handleComponentClick
                })}
              </div>

              {/* Información de zoom */}
              <div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 bg-background/80 rounded-md px-2 py-1 sm:px-3 sm:py-1 text-xs sm:text-sm">
                Zoom: {Math.round(zoom * 100)}%
              </div>

                          {/* Información de máquinas y componentes */}
            <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 bg-background/80 rounded-md px-2 py-1 sm:px-3 sm:py-1 text-xs sm:text-sm">
              {nodes.length} elementos
            </div>

              {/* Botón cerrar */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setFullscreen(false)}
                className="absolute top-4 right-4 bg-background/80"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Modal expandido */}
        <Dialog open={showExpandedModal} onOpenChange={setShowExpandedModal}>
          <DialogContent size="full" className="h-[100vh] p-0 border-0 bg-background">
            <div 
              className="w-full h-full relative select-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onWheel={handleWheel}
              onMouseEnter={() => setInteractionMode('pan')}
              style={{ cursor: dragging.current ? 'grabbing' : interactionMode === 'pan' ? 'grab' : 'default' }}
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
                  selectedMachine,
                  hoveredMachine,
                  handleNodeClick,
                  handleNodeHover,
                  interactionMode,
                  onMachineClick,
                  onComponentClick,
                  machines,
                  expandedMachines,
                  machineComponents,
                  expandedComponents,
                  handleComponentClick
                })}
              </div>

              {/* Controles flotantes en la derecha */}
              <div className="absolute top-4 right-4 flex flex-col gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setZoom(prev => Math.max(0.05, prev * 0.9))}
                  className="bg-background/80"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setZoom(prev => Math.min(5, prev * 1.1))}
                  className="bg-background/80"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={resetView}
                  className="bg-background/80"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowExpandedModal(false)}
                  className="bg-background/80"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Información de zoom */}
              <div className="absolute bottom-4 left-4 bg-background/80 rounded-md px-3 py-1 text-sm">
                Zoom: {Math.round(zoom * 100)}%
              </div>

              {/* Información de máquinas y componentes */}
              <div className="absolute bottom-4 right-4 bg-background/80 rounded-md px-3 py-1 text-sm">
                {nodes.length} elementos
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
} 