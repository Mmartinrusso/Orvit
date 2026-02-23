'use client';

import React, { useState, useMemo } from 'react';
import { formatDate } from '@/lib/date-utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Cog, Building, Calendar, Loader2 } from 'lucide-react';
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
 return <Badge variant="default" className="bg-success-muted text-success-muted-foreground">Activo</Badge>;
 case 'INACTIVE':
 case 'INACTIVO':
 return <Badge variant="secondary">Inactivo</Badge>;
 case 'MAINTENANCE':
 case 'MANTENIMIENTO':
 return <Badge variant="destructive">En Mantenimiento</Badge>;
 case 'PRODUCTION':
 case 'PRODUCCION':
 return <Badge variant="default" className="bg-info-muted text-info-muted-foreground">En Producción</Badge>;
 default:
 return <Badge variant="outline">{status}</Badge>;
 }
 };

 const getTypeIcon = (type: string) => {
 switch (type.toUpperCase()) {
 case 'PRODUCTION':
 case 'PRODUCCION':
 return <Cog className="h-5 w-5 text-info-muted-foreground" />;
 case 'PACKAGING':
 case 'ENVASADO':
 return <Building className="h-5 w-5 text-success" />;
 default:
 return <Cog className="h-5 w-5 text-foreground" />;
 }
 };

 // formatDate available from @/lib/date-utils if needed

 return (
 <Dialog open={isOpen} onOpenChange={onClose}>
 <DialogContent size="lg">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <Cog className="h-5 w-5" />
 Seleccionar Máquina
 </DialogTitle>
 <DialogDescription>
 Elige la máquina para la cual quieres ejecutar el checklist
 </DialogDescription>
 </DialogHeader>

 <DialogBody>
 {/* Barra de búsqueda */}
 <div className="relative mb-3">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input
 placeholder="Buscar por nombre, tipo o sector..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="pl-10"
 />
 </div>

 {/* Lista de máquinas */}
 <div className="space-y-3">
 {loading ? (
 <div className="flex justify-center items-center h-32">
 <Loader2 className="h-8 w-8 animate-spin text-primary" />
 </div>
 ) : filteredMachines.length === 0 ? (
 <div className="text-center py-8 text-muted-foreground">
 {searchTerm ? 'No se encontraron máquinas que coincidan con la búsqueda' : 'No hay máquinas disponibles'}
 </div>
 ) : (
 filteredMachines.map((machine) => (
 <Card 
 key={machine.id} 
 className="cursor-pointer hover:bg-accent transition-colors"
 onClick={() => handleSelectMachine(machine)}
 >
 <CardContent className="p-4">
 <div className="flex justify-between items-start">
 <div className="flex-1">
 <div className="flex items-center gap-3 mb-2">
 <div className="bg-success-muted p-2 rounded-lg">
 {getTypeIcon(machine.type)}
 </div>
 <div>
 <h3 className="font-semibold text-lg">{machine.name}</h3>
 <p className="text-sm text-foreground">{machine.type}</p>
 </div>
 </div>
 
 <div className="flex gap-4 text-sm">
 <div className="flex items-center gap-1">
 {getStatusBadge(machine.status)}
 </div>
 {machine.sector && (
 <div className="flex items-center gap-1 text-foreground">
 <Building className="h-3 w-3" />
 <span>{machine.sector.name}</span>
 </div>
 )}
 <div className="flex items-center gap-1 text-foreground">
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
 </DialogBody>

 <DialogFooter>
 <Button variant="outline" onClick={onClose}>
 Cancelar
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
}
