'use client';

import React from 'react';
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogDescription,
 DialogBody,
 DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
 Settings,
 Wrench,
 AlertTriangle,
 TrendingUp,
 Clock,
 Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MaintenanceTypeSelectorProps {
 isOpen: boolean;
 onClose: () => void;
 onSelectType: (type: 'PREVENTIVE' | 'CORRECTIVE' | 'PREDICTIVE' | 'EMERGENCY') => void;
 machineName?: string;
}

const maintenanceTypes = [
 {
 id: 'PREVENTIVE',
 name: 'Preventivo',
 description: 'Mantenimiento programado para prevenir fallas',
 icon: Settings,
 frequency: 'Programado',
 urgency: 'Baja'
 },
 {
 id: 'CORRECTIVE',
 name: 'Correctivo',
 description: 'Reparación de equipos que han fallado',
 icon: Wrench,
 frequency: 'Según necesidad',
 urgency: 'Media-Alta'
 },
 {
 id: 'PREDICTIVE',
 name: 'Predictivo',
 description: 'Mantenimiento basado en condiciones y análisis',
 icon: TrendingUp,
 frequency: 'Monitoreo continuo',
 urgency: 'Media'
 },
 {
 id: 'EMERGENCY',
 name: 'Emergencia',
 description: 'Reparación urgente por falla crítica',
 icon: AlertTriangle,
 frequency: 'Inmediata',
 urgency: 'Crítica'
 }
];

export default function MaintenanceTypeSelector({
 isOpen,
 onClose,
 onSelectType,
 machineName
}: MaintenanceTypeSelectorProps) {
 return (
 <Dialog open={isOpen} onOpenChange={onClose}>
 <DialogContent size="lg">
 <DialogHeader className="pb-4">
 <div className="flex flex-col space-y-1.5 text-center">
 <DialogTitle className="text-sm font-medium">
 Nuevo Mantenimiento
 </DialogTitle>
 <DialogDescription className="text-sm text-muted-foreground mt-2">
 {machineName 
 ? `Selecciona el tipo de mantenimiento para ${machineName}`
 : 'Selecciona el tipo de mantenimiento que deseas crear'
 }
 </DialogDescription>
 </div>
 </DialogHeader>

 <DialogBody>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 {maintenanceTypes.map((type) => {
 const IconComponent = type.icon;
 return (
 <div
 key={type.id}
 className={cn(
 "relative p-6 rounded-xl border-2 cursor-pointer transition-all duration-200",
 "hover:shadow-lg hover:-translate-y-[1px]",
 "bg-muted/30 text-foreground border-border hover:bg-muted/50"
 )}
 onClick={() => onSelectType(type.id as any)}
 >
 <div className="flex flex-col h-full">
 {/* Header */}
 <div className="flex items-center gap-4 mb-4">
 <div className="bg-background p-3 rounded-lg shadow-sm">
 <IconComponent className="h-8 w-8 text-muted-foreground" />
 </div>
 <div className="flex-1">
 <h3 className="text-sm font-medium mb-1">{type.name}</h3>
 <p className="text-xs text-muted-foreground leading-relaxed">{type.description}</p>
 </div>
 </div>
 
 {/* Details */}
 <div className="flex-1 space-y-3">
 <div className="flex items-center gap-2">
 <Clock className="h-3 w-3 text-muted-foreground" />
 <span className="text-xs text-muted-foreground">Frecuencia:</span>
 <span className="text-xs font-medium text-foreground">{type.frequency}</span>
 </div>
 
 <div className="flex items-center gap-2">
 <Shield className="h-3 w-3 text-muted-foreground" />
 <span className="text-xs text-muted-foreground">Urgencia:</span>
 <span className="text-xs font-medium text-foreground">{type.urgency}</span>
 </div>
 </div>
 </div>
 </div>
 );
 })}
 </div>
 </DialogBody>

 <DialogFooter>
 <Button variant="outline" size="lg" onClick={onClose} className="text-xs">
 Cancelar
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
}
