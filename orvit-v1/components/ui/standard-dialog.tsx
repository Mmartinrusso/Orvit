'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { DIALOG_SIZES, DIALOG_MAX_HEIGHT } from '@/lib/design-tokens';

/**
 * Tamaños estandarizados de dialog
 *
 * sm: Para formularios simples, confirmaciones (max-w-md)
 * md: Para formularios medianos, selección de items (max-w-2xl)
 * lg: Para formularios complejos, tablas pequeñas (max-w-4xl)
 * xl: Para dashboards, tablas grandes (max-w-6xl)
 * full: Pantalla casi completa para gestión compleja (max-w-[95vw])
 */
type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface StandardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Tamaño del dialog: sm | md | lg | xl | full */
  size?: DialogSize;
  /** Contenido principal del dialog */
  children: React.ReactNode;
  /** Contenido del footer (botones) */
  footer?: React.ReactNode;
  /** Clases adicionales para el content */
  contentClassName?: string;
  /** Si el contenido debe ocupar todo el espacio disponible */
  fullHeight?: boolean;
}

/**
 * StandardDialog - Dialog estandarizado con tamaños consistentes
 *
 * Uso:
 * ```tsx
 * <StandardDialog
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
 * </StandardDialog>
 * ```
 */
export function StandardDialog({
  open,
  onOpenChange,
  title,
  description,
  size = 'md',
  children,
  footer,
  contentClassName,
  fullHeight = false,
}: StandardDialogProps) {
  const sizeClass = DIALOG_SIZES[size];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          sizeClass,
          DIALOG_MAX_HEIGHT,
          'flex flex-col overflow-hidden',
          fullHeight && 'h-[90dvh]',
          contentClassName
        )}
      >
        {/* Header fijo */}
        <DialogHeader className="flex-shrink-0 pb-4 border-b">
          <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-sm text-muted-foreground">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Contenido scrolleable */}
        <DialogBody>
          {children}
        </DialogBody>

        {/* Footer fijo */}
        {footer && (
          <DialogFooter>
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * StandardDialogContent - Solo el contenido para usar con Dialog existente
 *
 * Para casos donde ya tienes <Dialog> y solo quieres estandarizar el contenido
 */
interface StandardDialogContentProps {
  title: string;
  description?: string;
  size?: DialogSize;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  fullHeight?: boolean;
}

export function StandardDialogContent({
  title,
  description,
  size = 'md',
  children,
  footer,
  className,
  fullHeight = false,
}: StandardDialogContentProps) {
  const sizeClass = DIALOG_SIZES[size];

  return (
    <DialogContent
      className={cn(
        sizeClass,
        DIALOG_MAX_HEIGHT,
        'flex flex-col overflow-hidden',
        fullHeight && 'h-[90dvh]',
        className
      )}
    >
      <DialogHeader>
        <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
        {description && (
          <DialogDescription className="text-sm text-muted-foreground">
            {description}
          </DialogDescription>
        )}
      </DialogHeader>

      <DialogBody>
        {children}
      </DialogBody>

      {footer && (
        <DialogFooter>
          {footer}
        </DialogFooter>
      )}
    </DialogContent>
  );
}

export { type DialogSize };
