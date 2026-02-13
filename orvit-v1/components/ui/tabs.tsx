'use client';

import * as React from 'react';
import { flushSync } from 'react-dom';
import * as TabsPrimitive from '@radix-ui/react-tabs';

import { cn } from '@/lib/utils';

// Contexto para rastrear la dirección del cambio de tab
const TabsDirectionContext = React.createContext<'left' | 'right' | null>(null);
// Contexto para almacenar el orden de los tabs
const TabsOrderContext = React.createContext<{
  registerTab: (value: string) => void;
  getOrder: () => string[];
}>({
  registerTab: () => {},
  getOrder: () => []
});

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(({ className, onValueChange, ...props }, ref) => {
  const [prevValue, setPrevValue] = React.useState<string | undefined>(props.value || props.defaultValue);
  const [direction, setDirection] = React.useState<'left' | 'right' | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const tabsOrderRef = React.useRef<string[]>([]);

  const registerTab = React.useCallback((value: string) => {
    if (!tabsOrderRef.current.includes(value)) {
      tabsOrderRef.current.push(value);
    }
  }, []);

  const getOrder = React.useCallback(() => {
    return [...tabsOrderRef.current];
  }, []);

  const handleValueChange = React.useCallback((value: string) => {
    if (prevValue !== undefined && prevValue !== value) {
      const prevIndex = tabsOrderRef.current.indexOf(prevValue);
      const nextIndex = tabsOrderRef.current.indexOf(value);

      if (prevIndex !== -1 && nextIndex !== -1) {
        const newDirection = nextIndex > prevIndex ? 'right' : 'left';
        flushSync(() => {
          setDirection(newDirection);
        });
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(() => setDirection(null), 400);
          });
        });
      }
    }
    setPrevValue(value);
    onValueChange?.(value);
  }, [prevValue, onValueChange]);

  return (
    <TabsDirectionContext.Provider value={direction}>
      <TabsOrderContext.Provider value={{ registerTab, getOrder }}>
        <TabsPrimitive.Root
          ref={(node) => {
            rootRef.current = node as HTMLDivElement;
            if (typeof ref === 'function') {
              ref(node);
            } else if (ref) {
              (ref as React.MutableRefObject<HTMLDivElement | null>).current = node as HTMLDivElement;
            }
          }}
          className={className}
          onValueChange={handleValueChange}
          {...props}
        />
      </TabsOrderContext.Provider>
    </TabsDirectionContext.Provider>
  );
});
Tabs.displayName = 'Tabs';

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      // Estándar: h-9, responsive, scroll horizontal en mobile
      'relative inline-flex h-9 items-center justify-start rounded-md border border-border bg-muted/40 p-1 text-muted-foreground',
      'w-full sm:w-fit overflow-x-auto gap-0.5',
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, value, ...props }, ref) => {
  const direction = React.useContext(TabsDirectionContext);
  const { registerTab } = React.useContext(TabsOrderContext);

  React.useEffect(() => {
    if (value) {
      registerTab(value);
    }
  }, [value, registerTab]);

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      value={value}
      className={cn(
        // Estándar minimalista: h-7, text-xs, px-3
        'relative z-10 inline-flex items-center justify-center whitespace-nowrap rounded-md',
        'h-7 px-3 gap-1.5',
        'text-xs font-normal',
        'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        'transition-colors duration-150 ease-in-out',
        'shrink-0',
        // Estados - texto blanco cuando está seleccionado (sobre fondo primary)
        'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-medium data-[state=active]:shadow-sm',
        'data-[state=inactive]:hover:bg-muted/70 data-[state=inactive]:hover:text-foreground',
        // Animación de fondo
        'before:absolute before:inset-0 before:z-[-1] before:rounded-md before:shadow-md',
        'before:transition-transform before:duration-300 before:ease-in-out',
        'before:scale-x-0 before:origin-left',
        direction === 'right'
          ? 'data-[state=inactive]:before:bg-gradient-to-l data-[state=inactive]:before:from-primary data-[state=inactive]:before:to-primary/0 data-[state=inactive]:before:origin-right data-[state=inactive]:before:scale-x-0 data-[state=active]:before:bg-primary data-[state=active]:before:origin-left data-[state=active]:before:scale-x-100'
          : direction === 'left'
          ? 'data-[state=inactive]:before:bg-gradient-to-r data-[state=inactive]:before:from-primary data-[state=inactive]:before:to-primary/0 data-[state=inactive]:before:origin-left data-[state=inactive]:before:scale-x-0 data-[state=active]:before:bg-primary data-[state=active]:before:origin-right data-[state=active]:before:scale-x-100'
          : 'before:bg-primary data-[state=active]:before:scale-x-100',
        className
      )}
      {...props}
    />
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-3 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-right-1 data-[state=active]:duration-300 data-[state=active]:ease-out',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
