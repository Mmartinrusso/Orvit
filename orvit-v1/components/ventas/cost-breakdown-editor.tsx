'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, ChevronDown, ChevronUp, ListTree } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CostBreakdownItem } from '@/lib/types/sales';

interface CostBreakdownEditorProps {
  precioUnitario: number;
  breakdown: CostBreakdownItem[];
  onChange: (breakdown: CostBreakdownItem[]) => void;
  readOnly?: boolean;
}

export function CostBreakdownEditor({
  precioUnitario,
  breakdown,
  onChange,
  readOnly = false,
}: CostBreakdownEditorProps) {
  const [isOpen, setIsOpen] = useState(breakdown.length > 0);

  const sumaDesglose = breakdown.reduce((sum, item) => sum + item.monto, 0);
  const diferencia = precioUnitario - sumaDesglose;
  const cuadra = Math.abs(diferencia) <= 0.01;
  const porcentaje = precioUnitario > 0 ? (sumaDesglose / precioUnitario) * 100 : 0;

  const addConcepto = () => {
    onChange([
      ...breakdown,
      { concepto: '', monto: 0, orden: breakdown.length },
    ]);
  };

  const updateConcepto = (index: number, field: 'concepto' | 'monto', value: string | number) => {
    const updated = breakdown.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: field === 'monto' ? Number(value) || 0 : value };
      }
      return item;
    });
    onChange(updated);
  };

  const removeConcepto = (index: number) => {
    onChange(breakdown.filter((_, i) => i !== index).map((item, i) => ({ ...item, orden: i })));
  };

  if (readOnly && breakdown.length === 0) return null;

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors',
          breakdown.length > 0
            ? 'text-primary hover:bg-primary/10'
            : 'text-muted-foreground hover:bg-muted'
        )}
      >
        <ListTree className="h-3.5 w-3.5" />
        {breakdown.length > 0 ? `Desglose (${breakdown.length})` : 'Agregar desglose'}
        {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {isOpen && (
        <div className="mt-2 ml-2 pl-3 border-l-2 border-muted space-y-2">
          {breakdown.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              {readOnly ? (
                <>
                  <span className="text-sm text-muted-foreground flex-1">{item.concepto}</span>
                  <span className="text-sm font-medium tabular-nums">
                    ${item.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </>
              ) : (
                <>
                  <Input
                    value={item.concepto}
                    onChange={(e) => updateConcepto(index, 'concepto', e.target.value)}
                    placeholder="Concepto (ej: Flete)"
                    className="h-7 text-sm flex-1"
                  />
                  <Input
                    type="number"
                    value={item.monto || ''}
                    onChange={(e) => updateConcepto(index, 'monto', e.target.value)}
                    placeholder="Monto"
                    className="h-7 text-sm w-28 tabular-nums"
                    step="0.01"
                    min="0"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeConcepto(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          ))}

          {!readOnly && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={addConcepto}
            >
              <Plus className="h-3 w-3 mr-1" />
              Agregar concepto
            </Button>
          )}

          {breakdown.length > 0 && (
            <div className="pt-1 border-t border-muted">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Total desglose: ${sumaDesglose.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  {' / '}${precioUnitario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
                <span className={cn(
                  'font-medium',
                  cuadra ? 'text-success-muted-foreground' : 'text-destructive'
                )}>
                  {cuadra
                    ? 'Cuadra'
                    : diferencia > 0
                      ? `Faltan $${diferencia.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                      : `Excede $${Math.abs(diferencia).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                  }
                </span>
              </div>
              {/* Barra de progreso visual */}
              <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    cuadra ? 'bg-success' : porcentaje > 100 ? 'bg-destructive' : 'bg-amber-500'
                  )}
                  style={{ width: `${Math.min(porcentaje, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
