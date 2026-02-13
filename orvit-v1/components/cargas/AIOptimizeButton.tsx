'use client';

/**
 * Botón de Optimización con IA
 * Permite optimizar la distribución de una carga usando GPT-4o-mini
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Maximize2,
  ListOrdered,
  Info,
} from 'lucide-react';
import {
  LoadItem,
  AIOptimizationResult,
  AIOptimizationStats,
} from '@/lib/cargas/types';
import { toast } from 'sonner';

interface AIOptimizeButtonProps {
  items: LoadItem[];
  truckId: number;
  truckName: string;
  onOptimizationComplete: (result: AIOptimizationResult) => void;
  disabled?: boolean;
}

type Priority = 'weight_balance' | 'space_utilization' | 'delivery_order';

const PRIORITY_OPTIONS: { value: Priority; label: string; icon: typeof Scale; description: string }[] = [
  {
    value: 'weight_balance',
    label: 'Balance de Peso',
    icon: Scale,
    description: 'Optimiza la distribución del peso entre pisos y secciones',
  },
  {
    value: 'space_utilization',
    label: 'Utilización de Espacio',
    icon: Maximize2,
    description: 'Maximiza el uso del espacio disponible en el camión',
  },
  {
    value: 'delivery_order',
    label: 'Orden de Descarga',
    icon: ListOrdered,
    description: 'Organiza para facilitar el acceso según orden de entrega',
  },
];

export default function AIOptimizeButton({
  items,
  truckId,
  truckName,
  onOptimizationComplete,
  disabled = false,
}: AIOptimizeButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [priority, setPriority] = useState<Priority>('weight_balance');
  const [result, setResult] = useState<AIOptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOptimize = async () => {
    if (items.length === 0) {
      toast.error('Agrega items antes de optimizar');
      return;
    }

    setIsOptimizing(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/loads/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: items.map(item => ({
            productName: item.productName,
            quantity: item.quantity,
            length: item.length,
            weight: item.weight,
          })),
          truckId,
          preferences: { prioritize: priority },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al optimizar');
      }

      const data = await response.json();
      setResult(data.data);
      toast.success('Optimización completada');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
      toast.error(message);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleApply = () => {
    if (result) {
      onOptimizationComplete(result);
      setIsOpen(false);
      setResult(null);
      toast.success('Distribución aplicada');
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setResult(null);
    setError(null);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        disabled={disabled || items.length === 0}
        className="gap-2"
      >
        <Sparkles className="h-4 w-4 text-purple-500" />
        Optimizar con IA
      </Button>

      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Optimización con IA
            </DialogTitle>
            <DialogDescription>
              GPT-4o-mini optimizará la distribución de {items.length} item{items.length !== 1 ? 's' : ''} en {truckName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Selector de prioridad */}
            <div className="space-y-2">
              <Label>Prioridad de optimización</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <option.icon className="h-4 w-4 text-muted-foreground" />
                        <span>{option.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {PRIORITY_OPTIONS.find(o => o.value === priority)?.description}
              </p>
            </div>

            {/* Info del costo */}
            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
              <Info className="h-4 w-4 text-blue-500 mt-0.5" />
              <div className="text-xs text-muted-foreground">
                <p>Costo estimado: ~$0.002 USD por optimización</p>
                <p className="mt-1">La IA analizará peso, largo y reglas de negocio para sugerir la mejor distribución.</p>
              </div>
            </div>

            {/* Estado de optimización */}
            {isOptimizing && (
              <div className="flex items-center justify-center py-8">
                <div className="text-center space-y-3">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-500 mx-auto" />
                  <p className="text-sm text-muted-foreground">Analizando distribución óptima...</p>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Resultado */}
            {result && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Optimización completada</span>
                </div>

                <OptimizationStats stats={result.stats} />

                {result.reasoning && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      <strong>Estrategia:</strong> {result.reasoning}
                    </p>
                  </div>
                )}

                {result.warnings && result.warnings.length > 0 && (
                  <div className="space-y-1">
                    {result.warnings.map((warning, i) => (
                      <div key={i} className="flex items-start gap-2 text-amber-600">
                        <AlertTriangle className="h-4 w-4 mt-0.5" />
                        <p className="text-xs">{warning}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            {!result ? (
              <Button onClick={handleOptimize} disabled={isOptimizing} className="gap-2">
                {isOptimizing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Optimizando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Optimizar
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={handleApply} className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Aplicar Distribución
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Componente para mostrar estadísticas de optimización
 */
function OptimizationStats({ stats }: { stats: AIOptimizationStats }) {
  const getBalanceColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const getUtilizationColor = (percent: number) => {
    if (percent >= 75) return 'bg-green-500';
    if (percent >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Balance Score */}
      <div className="p-3 border rounded-lg">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">Balance</span>
          <Badge variant="outline" className={getBalanceColor(stats.balanceScore)}>
            {stats.balanceScore}%
          </Badge>
        </div>
        <Progress value={stats.balanceScore} className="h-1.5" />
      </div>

      {/* Utilización */}
      <div className="p-3 border rounded-lg">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">Utilización</span>
          <Badge variant="outline">
            {stats.utilizationPercent}%
          </Badge>
        </div>
        <Progress
          value={stats.utilizationPercent}
          className={`h-1.5 [&>div]:${getUtilizationColor(stats.utilizationPercent)}`}
        />
      </div>

      {/* Peso total */}
      <div className="p-3 border rounded-lg">
        <span className="text-xs text-muted-foreground">Peso Total</span>
        <p className="text-lg font-semibold">{(stats.totalWeight / 1000).toFixed(2)} ton</p>
      </div>

      {/* Centro de gravedad */}
      <div className="p-3 border rounded-lg">
        <span className="text-xs text-muted-foreground">Centro de Gravedad</span>
        <p className="text-sm font-medium">
          X:{stats.centerOfGravity.x.toFixed(2)} Y:{stats.centerOfGravity.y.toFixed(2)}
        </p>
      </div>

      {/* Peso por piso */}
      <div className="col-span-2 p-3 border rounded-lg">
        <span className="text-xs text-muted-foreground block mb-2">Peso por Piso (kg)</span>
        <div className="flex gap-2">
          {stats.weightPerFloor.map((weight, floor) => (
            <div key={floor} className="flex-1 text-center">
              <div className="text-xs text-muted-foreground">P{floor + 1}</div>
              <div className="text-sm font-medium">{weight}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
