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
 Cog,
 Truck,
 ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AssetTypeSelectorProps {
 isOpen: boolean;
 onClose: () => void;
 onSelectAssetType: (type: 'MACHINE' | 'UNIDAD_MOVIL') => void;
}

interface OptionCardProps {
 title: string;
 description: string;
 icon: React.ElementType;
 theme: 'blue' | 'green';
 examples: string[];
 onClick: () => void;
 selected?: boolean;
}

const OptionCard: React.FC<OptionCardProps> = ({
 title,
 description,
 icon: Icon,
 theme,
 examples,
 onClick,
 selected = false
}) => {
 const themeClasses = {
 blue: {
 container: 'bg-muted/30 text-foreground border-border hover:bg-muted/50',
 iconBg: 'bg-background',
 iconColor: 'text-muted-foreground',
 buttonBg: 'bg-background/80',
 buttonText: 'text-foreground'
 },
 green: {
 container: 'bg-muted/30 text-foreground border-border hover:bg-muted/50',
 iconBg: 'bg-background',
 iconColor: 'text-muted-foreground',
 buttonBg: 'bg-background/80',
 buttonText: 'text-foreground'
 }
 };

 const colors = themeClasses[theme];

 return (
 <div
 className={cn(
 "relative p-6 rounded-xl border-2 cursor-pointer transition-all duration-200",
 "hover:shadow-lg hover:-translate-y-[1px]",
 colors.container,
 selected && "ring-2 ring-offset-2",
 theme === 'blue' && selected && "ring-blue-500",
 theme === 'green' && selected && "ring-green-500"
 )}
 onClick={onClick}
 >
 <div className="flex flex-col h-full">
 {/* Header */}
 <div className="flex items-center gap-4 mb-4">
 <div className={cn("p-3 rounded-lg shadow-sm", colors.iconBg)}>
 <Icon className={cn("h-8 w-8", colors.iconColor)} />
 </div>
 <div className="flex-1">
 <h3 className="text-sm font-medium mb-1">{title}</h3>
 <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
 </div>
 </div>
 
 {/* Examples */}
 <div className="flex-1 mb-4">
 <p className="text-xs text-muted-foreground mb-3">Ejemplos:</p>
 <div className="flex flex-wrap gap-2">
 {examples.map((example, index) => (
 <span 
 key={index}
 className="text-xs bg-background border border-border px-3 py-1 rounded-full font-medium text-foreground"
 >
 {example}
 </span>
 ))}
 </div>
 </div>

 {/* Continue Button */}
 <div className={cn(
 "flex items-center justify-center gap-2 text-xs font-medium px-4 py-2 rounded-lg",
 "bg-background border border-border text-foreground",
 "hover:bg-muted transition-colors"
 )}>
 <span>Continuar</span>
 <ArrowRight className="h-3 w-3" />
 </div>
 </div>
 </div>
 );
};

export default function AssetTypeSelector({
 isOpen,
 onClose,
 onSelectAssetType
}: AssetTypeSelectorProps) {
 const handleSelect = (type: 'MACHINE' | 'UNIDAD_MOVIL') => {
 onSelectAssetType(type);
 onClose();
 };

 return (
 <Dialog open={isOpen} onOpenChange={onClose}>
 <DialogContent size="lg">
 <DialogHeader className="pb-4">
 <div className="flex flex-col space-y-1.5 text-center">
 <DialogTitle className="text-sm font-medium">
 Seleccionar Tipo de Activo
 </DialogTitle>
 <DialogDescription className="text-sm text-muted-foreground mt-2">
 ¿Para qué tipo de activo deseas crear el mantenimiento?
 </DialogDescription>
 </div>
 </DialogHeader>

 <DialogBody>
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 <OptionCard
 title="Máquina"
 description="Crear mantenimiento para una máquina o equipo fijo"
 icon={Cog}
 theme="blue"
 examples={[
 'Autoelevador',
 'Máquina de producción',
 'Equipo de taller',
 'Sistema de bombeo'
 ]}
 onClick={() => handleSelect('MACHINE')}
 />
 
 <OptionCard
 title="Unidad Móvil"
 description="Crear mantenimiento para un vehículo o unidad móvil"
 icon={Truck}
 theme="green"
 examples={[
 'Camión',
 'Camioneta',
 'Tractor',
 'Montacargas'
 ]}
 onClick={() => handleSelect('UNIDAD_MOVIL')}
 />
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
