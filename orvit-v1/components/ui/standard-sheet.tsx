'use client';

import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { SHEET_SIZES } from '@/lib/design-tokens';

/**
 * Tamaños estandarizados de sheet (panel lateral)
 *
 * sm: Panel estrecho - detalles rápidos (400px)
 * md: Panel mediano - formularios (600px)
 * lg: Panel amplio - formularios complejos (800px)
 * xl: Panel muy amplio - gestión completa (1000px)
 */
type SheetSize = 'sm' | 'md' | 'lg' | 'xl';

interface StandardSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Tamaño del sheet: sm | md | lg | xl */
  size?: SheetSize;
  /** Lado desde donde aparece */
  side?: 'left' | 'right' | 'top' | 'bottom';
  /** Contenido principal del sheet */
  children: React.ReactNode;
  /** Contenido del footer (botones) */
  footer?: React.ReactNode;
  /** Clases adicionales para el content */
  contentClassName?: string;
}

/**
 * StandardSheet - Sheet estandarizado con tamaños consistentes
 *
 * Uso:
 * ```tsx
 * <StandardSheet
 *   open={open}
 *   onOpenChange={setOpen}
 *   title="Título"
 *   description="Descripción opcional"
 *   size="md"
 *   footer={
 *     <>
 *       <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
 *       <Button onClick={handleSave}>Guardar</Button>
 *     </>
 *   }
 * >
 *   <div>Contenido aquí</div>
 * </StandardSheet>
 * ```
 */
export function StandardSheet({
  open,
  onOpenChange,
  title,
  description,
  size = 'md',
  side = 'right',
  children,
  footer,
  contentClassName,
}: StandardSheetProps) {
  const sizeClass = SHEET_SIZES[size];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn(
          // Sobrescribir el ancho por defecto
          '!w-full sm:!max-w-none',
          sizeClass,
          'flex flex-col h-full overflow-hidden',
          contentClassName
        )}
      >
        {/* Header fijo */}
        <SheetHeader className="flex-shrink-0 pb-4 border-b space-y-1">
          <SheetTitle className="text-lg font-semibold">{title}</SheetTitle>
          {description && (
            <SheetDescription className="text-sm text-muted-foreground">
              {description}
            </SheetDescription>
          )}
        </SheetHeader>

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-y-auto py-4 min-h-0">
          {children}
        </div>

        {/* Footer fijo */}
        {footer && (
          <SheetFooter className="flex-shrink-0 pt-4 border-t gap-2 sm:flex-row">
            {footer}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * StandardSheetContent - Solo el contenido para usar con Sheet existente
 *
 * Para casos donde ya tienes <Sheet> y solo quieres estandarizar el contenido
 */
interface StandardSheetContentProps {
  title: string;
  description?: string;
  size?: SheetSize;
  side?: 'left' | 'right' | 'top' | 'bottom';
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function StandardSheetContent({
  title,
  description,
  size = 'md',
  side = 'right',
  children,
  footer,
  className,
}: StandardSheetContentProps) {
  const sizeClass = SHEET_SIZES[size];

  return (
    <SheetContent
      side={side}
      className={cn(
        '!w-full sm:!max-w-none',
        sizeClass,
        'flex flex-col h-full overflow-hidden',
        className
      )}
    >
      <SheetHeader className="flex-shrink-0 pb-4 border-b space-y-1">
        <SheetTitle className="text-lg font-semibold">{title}</SheetTitle>
        {description && (
          <SheetDescription className="text-sm text-muted-foreground">
            {description}
          </SheetDescription>
        )}
      </SheetHeader>

      <div className="flex-1 overflow-y-auto py-4 min-h-0">
        {children}
      </div>

      {footer && (
        <SheetFooter className="flex-shrink-0 pt-4 border-t gap-2 sm:flex-row">
          {footer}
        </SheetFooter>
      )}
    </SheetContent>
  );
}

export { type SheetSize };
