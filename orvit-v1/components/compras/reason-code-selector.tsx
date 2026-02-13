'use client';

import { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

// Tipos que coinciden con audit-reason-codes.ts del backend
export type EntityType =
  | 'PEDIDO'
  | 'OC'
  | 'RECEPCION'
  | 'FACTURA'
  | 'PAGO'
  | 'PROVEEDOR'
  | 'NC_ND'
  | 'MATCH'
  | 'GRNI';

export type ActionType =
  | 'APROBAR'
  | 'RECHAZAR'
  | 'ANULAR'
  | 'MODIFICAR'
  | 'CREAR'
  | 'RESOLVER'
  | 'ESCALAR'
  | 'BLOQUEAR'
  | 'LIBERAR';

export interface ReasonCode {
  code: string;
  label: string;
  description: string;
  category: 'APPROVAL' | 'REJECTION' | 'CANCELLATION' | 'MODIFICATION' | 'RESOLUTION' | 'OPERATIONAL';
  requiresText: boolean;
  isDefault?: boolean;
}

interface ReasonCodeSelectorProps {
  entityType: EntityType;
  actionType: ActionType;
  value?: string;
  textValue?: string;
  onChange: (code: string, text?: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  showDescription?: boolean;
  compact?: boolean;
}

// Colores por categoría
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  APPROVAL: { bg: 'bg-green-100', text: 'text-green-700' },
  REJECTION: { bg: 'bg-red-100', text: 'text-red-700' },
  CANCELLATION: { bg: 'bg-gray-100', text: 'text-gray-700' },
  MODIFICATION: { bg: 'bg-blue-100', text: 'text-blue-700' },
  RESOLUTION: { bg: 'bg-purple-100', text: 'text-purple-700' },
  OPERATIONAL: { bg: 'bg-orange-100', text: 'text-orange-700' },
};

export function ReasonCodeSelector({
  entityType,
  actionType,
  value,
  textValue,
  onChange,
  required = false,
  disabled = false,
  className,
  showDescription = true,
  compact = false,
}: ReasonCodeSelectorProps) {
  const [reasonCodes, setReasonCodes] = useState<ReasonCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCode, setSelectedCode] = useState<ReasonCode | null>(null);
  const [text, setText] = useState(textValue || '');

  // Cargar reason codes válidos para la entidad/acción
  useEffect(() => {
    loadReasonCodes();
  }, [entityType, actionType]);

  // Actualizar selectedCode cuando cambia value
  useEffect(() => {
    if (value && reasonCodes.length > 0) {
      const found = reasonCodes.find(rc => rc.code === value);
      setSelectedCode(found || null);
    }
  }, [value, reasonCodes]);

  const loadReasonCodes = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/compras/reason-codes?entityType=${entityType}&actionType=${actionType}`
      );
      if (response.ok) {
        const data = await response.json();
        setReasonCodes(data.codes || []);

        // Seleccionar default si no hay valor
        if (!value && data.codes?.length > 0) {
          const defaultCode = data.codes.find((rc: ReasonCode) => rc.isDefault) || data.codes[0];
          if (defaultCode) {
            setSelectedCode(defaultCode);
            onChange(defaultCode.code, text);
          }
        }
      }
    } catch (error) {
      console.error('Error loading reason codes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (code: string) => {
    const found = reasonCodes.find(rc => rc.code === code);
    setSelectedCode(found || null);
    onChange(code, found?.requiresText ? text : undefined);
  };

  const handleTextChange = (newText: string) => {
    setText(newText);
    if (selectedCode) {
      onChange(selectedCode.code, newText);
    }
  };

  if (loading) {
    return (
      <div className={cn("animate-pulse", className)}>
        <div className="h-10 bg-muted rounded-md" />
      </div>
    );
  }

  if (reasonCodes.length === 0) {
    return null; // No hay reason codes para esta combinación
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-1.5">
        <Label className={cn("text-sm font-medium", required && "after:content-['*'] after:ml-0.5 after:text-red-500")}>
          Motivo
        </Label>

        <Select
          value={value || selectedCode?.code}
          onValueChange={handleCodeChange}
          disabled={disabled}
        >
          <SelectTrigger className={cn(compact ? "h-9" : "h-10")}>
            <SelectValue placeholder="Seleccionar motivo..." />
          </SelectTrigger>
          <SelectContent>
            {reasonCodes.map((rc) => {
              const colors = CATEGORY_COLORS[rc.category] || CATEGORY_COLORS.OPERATIONAL;
              return (
                <SelectItem key={rc.code} value={rc.code}>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={cn("text-[10px] px-1.5 py-0", colors.bg, colors.text)}
                    >
                      {rc.category.slice(0, 3)}
                    </Badge>
                    <span>{rc.label}</span>
                    {rc.requiresText && (
                      <Info className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {/* Descripción del código seleccionado */}
        {showDescription && selectedCode && (
          <p className="text-xs text-muted-foreground pl-1">
            {selectedCode.description}
          </p>
        )}
      </div>

      {/* Campo de texto adicional si es requerido */}
      {selectedCode?.requiresText && (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium after:content-['*'] after:ml-0.5 after:text-red-500">
            Justificación
          </Label>
          <Textarea
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Ingrese la justificación..."
            rows={compact ? 2 : 3}
            disabled={disabled}
            className={cn(!text && required && "border-red-300")}
          />
          {!text && required && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Este código requiere una justificación
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Componente simplificado para uso inline
export function ReasonCodeBadge({
  code,
  label,
  className,
}: {
  code?: string | null;
  label?: string;
  className?: string;
}) {
  if (!code) return null;

  return (
    <Badge variant="outline" className={cn("text-xs", className)}>
      {label || code}
    </Badge>
  );
}
