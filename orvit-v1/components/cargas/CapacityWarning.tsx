'use client';

/**
 * Componente de alerta cuando la capacidad del camión es excedida
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Weight, Ruler, Package } from 'lucide-react';

interface CapacityWarningProps {
  warnings: string[];
  itemsNotPlaced?: Array<{ productName: string; quantity: number; reason: string }>;
  className?: string;
}

export default function CapacityWarning({
  warnings,
  itemsNotPlaced = [],
  className,
}: CapacityWarningProps) {
  if (warnings.length === 0 && itemsNotPlaced.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      {warnings.length > 0 && (
        <Alert variant="destructive" className="mb-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Capacidad excedida</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside mt-2 space-y-1">
              {warnings.map((warning, index) => (
                <li key={index} className="text-sm">
                  {warning}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {itemsNotPlaced.length > 0 && (
        <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
          <Package className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-700">
            Items sin espacio disponible
          </AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside mt-2 space-y-1">
              {itemsNotPlaced.map((item, index) => (
                <li key={index} className="text-sm text-amber-700">
                  <span className="font-medium">{item.productName}</span>:{' '}
                  {item.quantity} unidades - {item.reason}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
