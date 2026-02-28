'use client';

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { focusNextFormField } from '@/lib/form-navigation';

interface SelectProps extends React.ComponentProps<typeof SelectPrimitive.Root> {
  autoAdvance?: boolean;
}

const Select: React.FC<SelectProps> = ({
  onValueChange,
  autoAdvance = true,
  children,
  ...props
}) => {
  const handleValueChange = React.useCallback(
    (value: string) => {
      onValueChange?.(value);
      if (autoAdvance) {
        requestAnimationFrame(() => {
          const trigger = document.activeElement;
          if (trigger) {
            focusNextFormField(trigger as HTMLElement);
          }
        });
      }
    },
    [onValueChange, autoAdvance]
  );

  return (
    <SelectPrimitive.Root onValueChange={handleValueChange} {...props}>
      {children}
    </SelectPrimitive.Root>
  );
};

const SelectGroup = SelectPrimitive.Group;

const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1',
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-70" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef({ active: false, startY: 0, scrollTop: 0 });

  // Desktop: drag-to-scroll with mouse (5px threshold so clicks still work)
  const onMouseDown = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    drag.current = {
      active: false,
      startY: e.clientY,
      scrollTop: scrollRef.current?.scrollTop ?? 0,
    };
  }, []);

  const onMouseMove = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!(e.buttons & 1)) { drag.current.active = false; return; }
    const el = scrollRef.current;
    if (!el) return;
    const dy = e.clientY - drag.current.startY;
    if (!drag.current.active && Math.abs(dy) < 5) return;
    drag.current.active = true;
    el.scrollTop = drag.current.scrollTop - dy;
  }, []);

  const onMouseUp = React.useCallback(() => {
    drag.current.active = false;
  }, []);

  // Trackpad & mouse wheel: Radix's react-remove-scroll calls preventDefault() on
  // wheel events globally when a portal is open, so native div scroll won't fire.
  // We handle it manually and stop propagation so it doesn't reach Radix's blocker.
  const onWheel = React.useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop += e.deltaY;
  }, []);

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        className={cn(
          'relative z-[150] min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          position === 'popper' &&
            'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
          className
        )}
        position={position}
        {...props}
      >
        <SelectPrimitive.Viewport
          className={cn(
            'p-1',
            position === 'popper' &&
              'w-full min-w-[var(--radix-select-trigger-width)]'
          )}
        >
          {/* Scrollable container: touch-action:pan-y enables native touch scroll on mobile,
              mouse handlers enable drag-to-scroll on desktop */}
          <div
            ref={scrollRef}
            className="overflow-y-auto overscroll-contain max-h-80 cursor-grab active:cursor-grabbing"
            style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
            onWheel={onWheel}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
            {children}
          </div>
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn('py-1.5 pl-8 pr-2 text-sm font-semibold', className)}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>

    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-muted', className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

// Keep exports compatible — ScrollUpButton/ScrollDownButton no longer used internally
// but exported in case any consumer references them directly
const SelectScrollUpButton = SelectPrimitive.ScrollUpButton;
const SelectScrollDownButton = SelectPrimitive.ScrollDownButton;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
