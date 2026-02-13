import { Machine } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wrench, Settings, Cog, Package, Truck, Factory } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MachineStructureViewProps {
  machine: Machine;
}

// Función auxiliar para obtener el ícono según el tipo de máquina
const getMachineTypeIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'production':
      return <Factory className="h-6 w-6" />;
    case 'maintenance':
      return <Wrench className="h-6 w-6" />;
    case 'utility':
      return <Settings className="h-6 w-6" />;
    case 'packaging':
      return <Package className="h-6 w-6" />;
    case 'transportation':
      return <Truck className="h-6 w-6" />;
    default:
      return <Wrench className="h-6 w-6" />;
  }
};

// Componente para cada bloque de parte
const PartBlock = ({ name, type, status, position }: { name: string; type: string; status: string; position: string }) => {
  return (
    <Card className={cn(
      "absolute w-48 p-2 bg-card/80 backdrop-blur-sm border border-border/50 shadow-lg transition-all duration-300 hover:scale-105",
      position
    )}>
      <CardContent className="p-2">
        <div className="flex items-center gap-2 mb-2">
          {getMachineTypeIcon(type)}
          <span className="font-medium text-sm">{name}</span>
        </div>
        <Badge variant={status === 'active' ? 'default' : 'secondary'} className="text-xs">
          {status}
        </Badge>
      </CardContent>
    </Card>
  );
};

// Componente para las líneas conectoras
const ConnectionLine = ({ from, to }: { from: string; to: string }) => {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: -1 }}
    >
      <line
        x1={from.split(',')[0]}
        y1={from.split(',')[1]}
        x2={to.split(',')[0]}
        y2={to.split(',')[1]}
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="4"
        className="text-border/50"
      />
    </svg>
  );
};

export default function MachineStructureView({ machine }: MachineStructureViewProps) {
  // Ejemplo de partes (en un caso real, esto vendría de la máquina)
  const parts = [
    { id: 1, name: 'Motor Principal', type: 'maintenance', status: 'active', position: 'top-0 left-1/2 -translate-x-1/2 -translate-y-full' },
    { id: 2, name: 'Sistema de Control', type: 'utility', status: 'active', position: 'top-1/2 -right-48 -translate-y-1/2' },
    { id: 3, name: 'Banda Transportadora', type: 'transportation', status: 'active', position: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-full' },
    { id: 4, name: 'Unidad de Envasado', type: 'packaging', status: 'active', position: 'top-1/2 -left-48 -translate-y-1/2' },
  ];

  // Puntos de conexión (en un caso real, se calcularían dinámicamente)
  const connections = [
    { from: '50%,50%', to: '50%,0%' },    // Centro a Motor
    { from: '50%,50%', to: '100%,50%' },  // Centro a Control
    { from: '50%,50%', to: '50%,100%' },  // Centro a Banda
    { from: '50%,50%', to: '0%,50%' },    // Centro a Envasado
  ];

  return (
    <div className="relative w-full h-[600px] bg-muted/20 rounded-xl p-8">
      {/* Líneas conectoras */}
      {connections.map((conn, index) => (
        <ConnectionLine key={index} from={conn.from} to={conn.to} />
      ))}

      {/* Bloque central (máquina principal) */}
      <Card className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 p-4 bg-primary/10 backdrop-blur-sm border-primary/20 shadow-xl z-10">
        <CardContent className="p-4">
          <div className="flex flex-col items-center gap-3">
            <div className="bg-primary/20 p-3 rounded-full">
              {getMachineTypeIcon(machine.type)}
            </div>
            <h3 className="text-xl font-bold text-center">{machine.name}</h3>
            {machine.nickname && (
              <p className="text-sm text-muted-foreground italic">&quot;{machine.nickname}&quot;</p>
            )}
            <div className="flex flex-wrap gap-2 justify-center">
              <Badge variant="outline" className="bg-background/50">
                {machine.type}
              </Badge>
              <Badge variant={machine.status === 'active' ? 'default' : 'secondary'}>
                {machine.status}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bloques de partes */}
      {parts.map((part) => (
        <PartBlock
          key={part.id}
          name={part.name}
          type={part.type}
          status={part.status}
          position={part.position}
        />
      ))}
    </div>
  );
} 