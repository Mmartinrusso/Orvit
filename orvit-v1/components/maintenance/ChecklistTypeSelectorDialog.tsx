'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Truck, Cog } from 'lucide-react';

interface ChecklistTypeSelectorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectType: (type: 'unidad-movil' | 'maquina') => void;
}

export default function ChecklistTypeSelectorDialog({
  isOpen,
  onClose,
  onSelectType
}: ChecklistTypeSelectorDialogProps) {
  
  const handleSelectType = (type: 'unidad-movil' | 'maquina') => {
    onSelectType(type);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Seleccionar Tipo de Checklist</DialogTitle>
          <DialogDescription>
            Elige el tipo de equipo para el cual quieres ejecutar el checklist
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {/* Opción Unidad Móvil */}
          <Card 
            className="cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => handleSelectType('unidad-movil')}
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3 text-lg">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <Truck className="h-6 w-6 text-blue-600" />
                </div>
                Unidad Móvil
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Ejecutar checklist para unidades móviles como autoelevadores, 
                montacargas, camiones y otros vehículos.
              </p>
              <Button
                variant="outline"
                className="w-full mt-3"
                size="default"
                onClick={() => handleSelectType('unidad-movil')}
              >
                Seleccionar Unidades Móviles
              </Button>
            </CardContent>
          </Card>

          {/* Opción Máquina */}
          <Card 
            className="cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => handleSelectType('maquina')}
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3 text-lg">
                <div className="bg-green-100 p-2 rounded-lg">
                  <Cog className="h-6 w-6 text-green-600" />
                </div>
                Máquina
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Ejecutar checklist para máquinas de producción, 
                equipos fijos y otros activos industriales.
              </p>
              <Button
                variant="outline"
                className="w-full mt-3"
                size="default"
                onClick={() => handleSelectType('maquina')}
              >
                Seleccionar Máquinas
              </Button>
            </CardContent>
          </Card>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} size="default">
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
