'use client';

import Link from 'next/link';
import { Machine, MachineStatus, MachineType } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ExternalLink, FileText, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface MachineTableProps {
  machines: Machine[];
  onDelete?: (machine: Machine) => Promise<void>;
  // 🔍 PERMISOS
  canDeleteMachine?: boolean;
}

export default function MachineTable({ 
  machines, 
  onDelete,
  canDeleteMachine = false
}: MachineTableProps) {
  const getMachineStatusBadge = (status: MachineStatus) => {
    switch (status) {
      case MachineStatus.ACTIVE:
        return <Badge variant="default" className="bg-success text-success-foreground">Activo</Badge>;
      case MachineStatus.OUT_OF_SERVICE:
        return <Badge variant="secondary" className="bg-warning text-warning-foreground">Fuera de servicio</Badge>;
      case MachineStatus.DECOMMISSIONED:
        return <Badge variant="destructive">Baja</Badge>;
      default:
        return null;
    }
  };
  
  const getMachineTypeLabel = (type: MachineType) => {
    switch (type) {
      case MachineType.PRODUCTION:
        return 'Producción';
      case MachineType.MAINTENANCE:
        return 'Mantenimiento';
      case MachineType.UTILITY:
        return 'Utilidad';
      case MachineType.PACKAGING:
        return 'Empaque';
      case MachineType.TRANSPORTATION:
        return 'Transporte';
      case MachineType.OTHER:
        return 'Otro';
      default:
        return type;
    }
  };
  
  const handleDelete = async (machine: Machine) => {
    if (onDelete) {
      await onDelete(machine);
    }
  };
  
  // Handle empty state
  if (machines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-10 text-center border rounded-lg bg-card/50">
        <FileText className="h-10 w-10 text-muted-foreground mb-2" />
        <h3 className="font-medium text-lg mb-1">No hay máquinas</h3>
        <p className="text-muted-foreground">
          No se encontraron máquinas con los filtros actuales.
        </p>
      </div>
    );
  }
  
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Apodo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Fecha de alta</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {machines.map((machine) => (
                <TableRow key={machine.id} className="hover:bg-muted/50 cursor-pointer">
                  <TableCell className="font-medium">{machine.name}</TableCell>
                <TableCell>{machine.nickname || 'Sin apodo'}</TableCell>
                <TableCell>{getMachineTypeLabel(machine.type)}</TableCell>
                <TableCell>{machine.brand}</TableCell>
                <TableCell>{machine.model}</TableCell>
                <TableCell>
                  {machine.acquisitionDate && !isNaN(new Date(machine.acquisitionDate).getTime())
                    ? format(new Date(machine.acquisitionDate), 'dd/MM/yyyy')
                    : 'Sin fecha'}
                </TableCell>
                <TableCell>{getMachineStatusBadge(machine.status)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Link href={`/mantenimiento/maquinas/${machine.slug}`} passHref>
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Ver
                      </Button>
                    </Link>
                    {onDelete && canDeleteMachine && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. Se eliminará permanentemente la máquina {machine.name}.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDelete(machine);
                            }}>
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </TableCell>
              </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}