'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Machine, MachineStatus, MachineType } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Cog, 
  X, 
  Network, 
  Building, 
  MapPin, 
  Activity,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Settings,
  Hand,
  ArrowUpDown,
  Maximize,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';

interface Component {
  id: number;
  name: string;
  type: string;
  technicalInfo?: string;
  machineId: number;
  parentId?: number;
  children?: Component[];
  status?: string;
}

interface SectorHierarchicalSchemaProps {
  isOpen: boolean;
  onClose: () => void;
  sector: any;
  machines: Machine[];
}

interface SchemaNode {
  id: string;
  name: string;
  type: 'sector' | 'machine' | 'component' | 'subcomponent';
  status?: string;
  machineStatus?: string;
  children?: SchemaNode[];
  level: number;
  expanded?: boolean;
}

export default function SectorHierarchicalSchema({ 
  isOpen, 
  onClose, 
  sector, 
  machines 
}: SectorHierarchicalSchemaProps) {
  const [schemaData, setSchemaData] = useState<SchemaNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [totalComponents, setTotalComponents] = useState(0);

  // Cargar datos del esquema
  useEffect(() => {
    if (isOpen && sector && machines.length > 0) {
      loadSchemaData();
    }
  }, [isOpen, sector, machines]);

  const loadSchemaData = async () => {
    setLoading(true);
    try {
      // Crear nodo raíz del sector
      const sectorNode: SchemaNode = {
        id: `sector-${sector.id}`,
        name: sector.name,
        type: 'sector',
        level: 0,
        expanded: true,
        children: []
      };

      let totalCompCount = 0;

      // Cargar máquinas y sus componentes
      for (const machine of machines) {
        const machineNode: SchemaNode = {
          id: `machine-${machine.id}`,
          name: machine.name,
          type: 'machine',
          machineStatus: machine.status,
          level: 1,
          expanded: false,
          children: []
        };

        try {
          // Cargar componentes de la máquina
          const componentsResponse = await fetch(`/api/maquinas/${machine.id}/components`);
          if (componentsResponse.ok) {
            const components: Component[] = await componentsResponse.json();
            
            for (const component of components) {
              const componentNode: SchemaNode = {
                id: `component-${component.id}`,
                name: component.name,
                type: 'component',
                status: component.status,
                level: 2,
                expanded: false,
                children: []
              };

              // Cargar subcomponentes si existen
              if (component.children && component.children.length > 0) {
                for (const subcomponent of component.children) {
                  const subcomponentNode: SchemaNode = {
                    id: `subcomponent-${subcomponent.id}`,
                    name: subcomponent.name,
                    type: 'subcomponent',
                    status: subcomponent.status,
                    level: 3,
                    expanded: false
                  };
                  componentNode.children!.push(subcomponentNode);
                  totalCompCount++;
                }
              }

              machineNode.children!.push(componentNode);
              totalCompCount++;
            }
          }
        } catch (error) {
          console.error(`Error cargando componentes de máquina ${machine.id}:`, error);
        }

        sectorNode.children!.push(machineNode);
      }

      setSchemaData(sectorNode);
      setTotalComponents(totalCompCount);
      setExpandedNodes(new Set([sectorNode.id]));
    } catch (error) {
      console.error('Error cargando esquema:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    const allNodeIds = getAllNodeIds(schemaData);
    setExpandedNodes(new Set(allNodeIds));
  };

  const collapseAll = () => {
    if (schemaData) {
      setExpandedNodes(new Set([schemaData.id]));
    }
  };

  const getAllNodeIds = (node: SchemaNode | null): string[] => {
    if (!node) return [];
    const ids = [node.id];
    if (node.children) {
      node.children.forEach(child => {
        ids.push(...getAllNodeIds(child));
      });
    }
    return ids;
  };

  const getNodeStatusColor = (node: SchemaNode) => {
    if (node.type === 'machine') {
      switch (node.machineStatus) {
        case MachineStatus.ACTIVE:
          return 'border-green-500 bg-green-50';
        case MachineStatus.OUT_OF_SERVICE:
          return 'border-amber-500 bg-amber-50';
        case MachineStatus.DECOMMISSIONED:
          return 'border-red-500 bg-red-50';
        default:
          return 'border-gray-300 bg-gray-50';
      }
    }
    
    if (node.type === 'component' || node.type === 'subcomponent') {
      switch (node.status) {
        case 'ACTIVE':
          return 'border-green-500 bg-green-50';
        case 'MAINTENANCE':
          return 'border-amber-500 bg-amber-50';
        case 'INACTIVE':
          return 'border-red-500 bg-red-50';
        default:
          return 'border-gray-300 bg-gray-50';
      }
    }

    return 'border-blue-500 bg-blue-50';
  };

  const getNodeIcon = (node: SchemaNode) => {
    switch (node.type) {
      case 'sector':
        return <Building className="h-4 w-4" />;
      case 'machine':
        return <Cog className="h-4 w-4" />;
      case 'component':
        return <Settings className="h-4 w-4" />;
      case 'subcomponent':
        return <Activity className="h-4 w-4" />;
      default:
        return <Network className="h-4 w-4" />;
    }
  };

  const renderNode = (node: SchemaNode, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id} className="w-full">
        <div 
          className={`
            flex items-center p-3 rounded-lg border-2 transition-all duration-200 hover:shadow-md cursor-pointer
            ${getNodeStatusColor(node)}
            ${depth > 0 ? 'ml-6' : ''}
          `}
          onClick={() => hasChildren && toggleNode(node.id)}
        >
          <div className="flex items-center space-x-3 flex-1">
            {hasChildren && (
              <div className="text-gray-500">
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </div>
            )}
            {!hasChildren && <div className="w-4" />}
            
            <div className="text-gray-600">
              {getNodeIcon(node)}
            </div>
            
            <div className="flex-1">
              <div className="font-medium text-gray-900">{node.name}</div>
              <div className="text-sm text-gray-500 capitalize">
                {node.type === 'sector' && 'Sector'}
                {node.type === 'machine' && 'Máquina'}
                {node.type === 'component' && 'Componente'}
                {node.type === 'subcomponent' && 'Pieza'}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {node.type === 'machine' && node.machineStatus && (
              <Badge 
                variant={node.machineStatus === MachineStatus.ACTIVE ? 'default' : 'secondary'}
                className={node.machineStatus === MachineStatus.ACTIVE ? 'bg-green-500' : 'bg-amber-500'}
              >
                {node.machineStatus === MachineStatus.ACTIVE ? 'Activo' : 
                 node.machineStatus === MachineStatus.OUT_OF_SERVICE ? 'Fuera de servicio' : 'Baja'}
              </Badge>
            )}
            
            {node.type === 'component' && node.status && (
              <Badge variant="outline" className="text-xs">
                {node.status === 'ACTIVE' ? 'Operacional' : 
                 node.status === 'MAINTENANCE' ? 'Mantenimiento' : 'Inactivo'}
              </Badge>
            )}

            {hasChildren && (
              <Badge variant="outline" className="text-xs">
                {node.children?.length} {node.children?.length === 1 ? 'elemento' : 'elementos'}
              </Badge>
            )}
          </div>
        </div>

        {isExpanded && hasChildren && (
          <div className="mt-2 space-y-2">
            {node.children!.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="full" className="max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Network className="h-6 w-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-2xl">Esquema Jerárquico del Sector</DialogTitle>
                <DialogDescription>
                  Vista esquemática de {sector?.name} y sus {machines.length} máquinas
                </DialogDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Barra de herramientas */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={expandAll}>
              <ChevronDown className="h-4 w-4 mr-1" />
              Expandir Todo
            </Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>
              <ChevronRight className="h-4 w-4 mr-1" />
              Colapsar Todo
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={() => setZoom(Math.max(50, zoom - 10))}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">Zoom: {zoom}%</span>
            <Button variant="outline" size="sm" onClick={() => setZoom(Math.min(200, zoom + 10))}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setZoom(100)}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Contenido del esquema */}
        <div 
          className="flex-1 overflow-y-auto p-4"
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
        >
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-gray-600">Cargando esquema...</p>
              </div>
            </div>
          ) : schemaData ? (
            <div className="space-y-4">
              {renderNode(schemaData)}
            </div>
          ) : (
            <div className="text-center py-8">
              <Network className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay datos disponibles para mostrar</p>
            </div>
          )}
        </div>

        {/* Barra de estado */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg text-sm">
          <div className="flex items-center space-x-4">
            <span>Zoom: {zoom}%</span>
            <span>{totalComponents} componentes</span>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span>Sector</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>Operacional</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
              <span>Mantenimiento</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span>Error</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 