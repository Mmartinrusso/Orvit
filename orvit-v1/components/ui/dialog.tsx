'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useModalBack } from '@/hooks/use-modal-back';

function Dialog({
  open,
  onOpenChange,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  useModalBack(open ?? false, () => onOpenChange?.(false))
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} {...props}>
      {children}
    </DialogPrimitive.Root>
  )
}

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-[150] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const dialogContentVariants = cva(
  // Base styles - usando dvh para tener en cuenta barras del navegador (marcadores, etc.)
  [
    'fixed left-1/2 top-1/2 z-[150] -translate-x-1/2 -translate-y-1/2',
    'flex flex-col border bg-background shadow-lg rounded-lg',
    'w-[95vw]',
    'max-h-[90dvh]', // dvh = dynamic viewport height, se adapta a la altura real disponible
    'overflow-hidden',
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
    'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
  ].join(' '),
  {
    variants: {
      size: {
        sm: 'sm:max-w-md',
        default: 'sm:max-w-lg',
        md: 'sm:max-w-2xl',
        lg: 'sm:max-w-4xl',
        xl: 'sm:max-w-6xl',
        '2xl': 'sm:max-w-[90vw]',
        full: 'sm:max-w-[70vw] max-h-[85dvh]',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  }
);

export interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof dialogContentVariants> {
  hideCloseButton?: boolean;
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, size, hideCloseButton = false, onPointerDownOutside, onInteractOutside, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(dialogContentVariants({ size }), className)}
      onPointerDownOutside={(e) => {
        // Permitir que dropdowns/popovers internos no cierren el dialog
        const target = e.target as HTMLElement;
        if (target?.closest('[data-radix-popper-content-wrapper]') || target?.closest('[role="listbox"]')) {
          e.preventDefault();
          return;
        }
        onPointerDownOutside?.(e);
      }}
      onInteractOutside={(e) => {
        const target = e.target as HTMLElement;
        if (target?.closest('[data-radix-popper-content-wrapper]') || target?.closest('[role="listbox"]')) {
          e.preventDefault();
          return;
        }
        onInteractOutside?.(e);
      }}
      {...props}
    >
      {children}
      {!hideCloseButton && (
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col space-y-1.5 px-6 py-4 border-b flex-shrink-0',
      className
    )}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4 border-t flex-shrink-0',
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

const DialogBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex-1 overflow-y-auto px-6 py-4 min-h-0',
      className
    )}
    {...props}
  />
);
DialogBody.displayName = 'DialogBody';

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      'text-base font-semibold leading-none tracking-tight',
      className
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogBody,
  DialogTitle,
  DialogDescription,
};
