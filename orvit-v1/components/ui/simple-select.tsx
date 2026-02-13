'use client';

import * as React from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SimpleSelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  children: React.ReactNode;
  className?: string;
}

interface SimpleSelectItemProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

// Helper para extraer texto de elementos React
function extractTextFromElement(element: React.ReactNode): string {
  if (typeof element === 'string' || typeof element === 'number') {
    return String(element);
  }
  if (React.isValidElement(element)) {
    const children = element.props?.children;
    if (typeof children === 'string' || typeof children === 'number') {
      return String(children);
    }
    if (Array.isArray(children)) {
      return children.map(extractTextFromElement).filter(Boolean).join(' ').trim();
    }
    if (children) {
      return extractTextFromElement(children);
    }
  }
  return '';
}

export function SimpleSelect({
  value,
  onValueChange,
  placeholder = 'Selecciona una opción',
  children,
  className
}: SimpleSelectProps) {
  const [open, setOpen] = React.useState(false);
  const selectRef = React.useRef<HTMLDivElement>(null);

  // Encontrar el label del valor seleccionado
  const selectedLabel = React.useMemo(() => {
    if (!value) return placeholder;
    
    const items = React.Children.toArray(children) as React.ReactElement[];
    const selectedItem = items.find((item) => {
      if (React.isValidElement(item) && item.type === SimpleSelectItem) {
        return item.props?.value === value;
      }
      return item.props?.value === value;
    });
    
    if (selectedItem && React.isValidElement(selectedItem)) {
      const text = extractTextFromElement(selectedItem.props?.children);
      return text || placeholder;
    }
    return placeholder;
  }, [value, children, placeholder]);

  // Cerrar al hacer click fuera
  React.useEffect(() => {
    if (!open) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Cerrar con Escape
  React.useEffect(() => {
    if (!open) return;
    
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open]);

  const handleSelect = (itemValue: string) => {
    onValueChange?.(itemValue);
    setOpen(false);
  };

  return (
    <div ref={selectRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm',
          'ring-offset-background placeholder:text-muted-foreground',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50'
        )}
      >
        <span className={cn(value ? '' : 'text-muted-foreground')}>
          {selectedLabel}
        </span>
        <ChevronDown className={cn('h-4 w-4 opacity-50 transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-[200] mt-1 w-full rounded-md border bg-popover shadow-md animate-in fade-in-0 zoom-in-95">
          <div className="max-h-[300px] overflow-auto p-1">
            {React.Children.map(children, (child) => {
              if (!React.isValidElement<SimpleSelectItemProps>(child)) {
                return child;
              }
              
              const itemValue = child.props.value;
              // Ignorar items vacíos o mensajes
              if (!itemValue || itemValue === '') {
                return (
                  <div key="empty-message" className="p-2 text-sm text-muted-foreground text-center pointer-events-none">
                    {child.props.children}
                  </div>
                );
              }
              
              const isSelected = value === itemValue;
              
              return (
                <div
                  key={itemValue}
                  onClick={() => handleSelect(itemValue)}
                  className={cn(
                    'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-sm',
                    'outline-none focus:bg-accent focus:text-accent-foreground',
                    'hover:bg-accent hover:text-accent-foreground',
                    isSelected && 'bg-accent text-accent-foreground',
                    child.props.className
                  )}
                >
                  {isSelected && <Check className="mr-2 h-4 w-4 flex-shrink-0" />}
                  <span className={cn(isSelected ? '' : 'ml-6', 'flex-1')}>
                    {child.props.children}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function SimpleSelectItem({ value, children, className }: SimpleSelectItemProps) {
  // Este componente solo sirve como marcador para los children
  return null;
}
