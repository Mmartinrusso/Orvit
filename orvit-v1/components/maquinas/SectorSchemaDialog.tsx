'use client';

import React, { useState, useEffect } from 'react';
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
  Calendar,
  Users,
  Activity
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import SectorSchemaView from './SectorSchemaView';

interface SectorSchemaDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sector: any;
  machines: Machine[];
  onMachineClick?: (machine: Machine) => void;
  onComponentClick?: (component: any) => void;
}

export default function SectorSchemaDialog({ 
  isOpen, 
  onClose, 
  sector, 
  machines,
  onMachineClick,
  onComponentClick
}: SectorSchemaDialogProps) {
  const [filteredMachines, setFilteredMachines] = useState<Machine[]>(machines);

  // Actualizar máquinas filtradas cuando cambien las máquinas
  useEffect(() => {
    setFilteredMachines(machines);
  }, [machines]);

  const handleComponentClick = (component: any) => {
    // Buscar la máquina que contiene este componente y abrir su detalle
    if (onMachineClick) {
      // Extraer el ID de la máquina del ID del componente
      // Los IDs de componentes tienen formato: machineId-comp-componentId
      const nodeIdParts = component.id ? component.id.toString().split('-comp-') : [];
      if (nodeIdParts.length > 0) {
        const machineId = nodeIdParts[0];
        const machine = machines.find(m => m.id.toString() === machineId);
        if (machine) {
          // Pasar la máquina con información del componente seleccionado
          const machineWithSelectedComponent = {
            ...machine,
            selectedComponent: component
          };
          onMachineClick(machineWithSelectedComponent);
        }
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="full">
        <DialogHeader className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Network className="h-6 w-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-2xl">Esquema del Sector</DialogTitle>
                <DialogDescription>
                  Vista general de la infraestructura y máquinas del sector
                </DialogDescription>
              </div>
            </div>
            {/* Eliminado el botón X duplicado - el Dialog ya tiene su propio botón X */}
          </div>
        </DialogHeader>

        <SectorSchemaView
          sector={sector}
          machines={filteredMachines}
          onMachineClick={onMachineClick || (() => {})}
          onComponentClick={onComponentClick || handleComponentClick}
        />
      </DialogContent>
    </Dialog>
  );
} 