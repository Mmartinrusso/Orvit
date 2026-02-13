'use client';

import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Cog, Building, Calendar } from 'lucide-react';
import { useMachinesInitial } from '@/hooks/use-machines-initial';

interface Machine {
  id: number;
  name: string;
  type: string;
  status: string;
  sectorId: number;
  sector?: {
    id: number;
    name: string;
  };
  proximoMantenimiento?: string;
}

interface MachineSelectorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: number;
  sectorId: number;
  onSelectMachine: (machine: Machine) => void;
}

export default function MachineSelectorDialog({
  isOpen,
  onClose,
  companyId,
  sectorId,
  onSelectMachine
}: MachineSelectorDialogProps) {
  
  const [searchTerm, setSearchTerm] = useState('');

  // ✨ OPTIMIZADO: Usar hook con React Query en lugar de fetch manual
  const { data, isLoading: loading } = useMachinesInitial(
    companyId,
    sectorId,
    { enabled: isOpen && !!companyId && !!sectorId }
  );

  const machines: Machine[] = (data?.machines || []) as Machine[];

  // ✨ OPTIMIZADO: Usar useMemo para filtrar
  const filteredMachines = useMemo(() => {
    if (!searchTerm) return machines;
    return machines.filter(machine =>
      machine.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      machine.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      machine.sector?.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, machines]);

  const handleSelectMachine = (machine: Machine) => {
    onSelectMachine(machine);
    onClose();
  };

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'ACTIVE':
      case 'ACTIVO':
        return <Badge variant="default" className="bg-green-100 text-green-800">Activo</Badge>;
      case 'INACTIVE':
      case 'INACTIVO':
        return <Badge variant="secondary">Inactivo</Badge>;
      case 'MAINTENANCE':
      case 'MANTENIMIENTO':
        return <Badge variant="destructive">En Mantenimiento</Badge>;
      case 'PRODUCTION':
      case 'PRODUCCION':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">En Producción</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case 'PRODUCTION':
      case 'PRODUCCION':
        return <Cog className="h-5 w-5 text-blue-600" />;
      case 'PACKAGING':
      case 'ENVASADO':
        return <Building className="h-5 w-5 text-green-600" />;
      default:
        return <Cog className="h-5 w-5 text-gray-600" />;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No programado';
    try {
      return new Date(dateString).toLocaleDateString('es-AR');
    } catch {
      return 'Fecha inválida';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="lg" className="max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cog className="h-5 w-5" />
            Seleccionar Máquina
          </DialogTitle>
          <DialogDescription>
            Elige la máquina para la cual quieres ejecutar el checklist
          </DialogDescription>
        </DialogHeader>

        {/* Barra de búsqueda */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por nombre, tipo o sector..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Lista de máquinas */}
        <div className="flex-1 overflow-y-auto space-y-3">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredMachines.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? 'No se encontraron máquinas que coincidan con la búsqueda' : 'No hay máquinas disponibles'}
            </div>
          ) : (
            filteredMachines.map((machine) => (
              <Card 
                key={machine.id} 
                className="cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => handleSelectMachine(machine)}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="bg-green-100 p-2 rounded-lg">
                          {getTypeIcon(machine.type)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{machine.name}</h3>
                          <p className="text-sm text-gray-600">{machine.type}</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          {getStatusBadge(machine.status)}
                        </div>
                        {machine.sector && (
                          <div className="flex items-center gap-1 text-gray-600">
                            <Building className="h-3 w-3" />
                            <span>{machine.sector.name}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-gray-600">
                          <span>PRODUCCIÓN</span>
                        </div>
                      </div>
                    </div>
                    
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectMachine(machine);
                      }}
                    >
                      Seleccionar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
