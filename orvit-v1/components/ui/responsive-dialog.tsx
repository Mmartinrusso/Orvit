'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface ResponsiveDialogProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
  trigger?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
}

const sizeClasses = {
  sm: 'sm:max-w-sm w-[95vw] sm:w-full',
  md: 'sm:max-w-md w-[95vw] sm:w-full', 
  lg: 'sm:max-w-lg w-[95vw] sm:w-full',
  xl: 'sm:max-w-xl w-[95vw] sm:w-full max-h-[95vh] sm:max-h-[90vh]',
  full: 'w-[95vw] sm:max-w-4xl max-h-[95vh] sm:max-h-[90vh]',
};

export function ResponsiveDialog({
  children,
  open,
  onOpenChange,
  title,
  description,
  trigger,
  size = 'md',
  className,
}: ResponsiveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className={cn(
          sizeClasses[size],
          'overflow-y-auto p-4 sm:p-6',
          className
        )}
      >
        {(title || description) && (
          <DialogHeader>
            {title && <DialogTitle className="text-lg sm:text-xl">{title}</DialogTitle>}
            {description && (
              <DialogDescription className="text-sm sm:text-base">
                {description}
              </DialogDescription>
            )}
          </DialogHeader>
        )}
        <div className="space-y-4">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

// Hook para detectar tamaño de pantalla
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  return isMobile;
} 