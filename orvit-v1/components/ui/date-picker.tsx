'use client';

import * as React from 'react';
import { format, isValid, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface DatePickerProps {
  value?: string; // ISO date string (YYYY-MM-DD)
  onChange?: (date: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  clearable?: boolean;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Seleccionar fecha',
  disabled = false,
  className,
  clearable = true,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Parse the ISO string value to Date manually to avoid timezone issues
  const selectedDate = React.useMemo(() => {
    if (!value) return undefined;
    // Manually parse yyyy-MM-dd to avoid timezone issues with parse()
    const parts = value.split('-');
    if (parts.length !== 3) return undefined;
    const [year, month, day] = parts.map(Number);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return undefined;
    // Create date at noon local time to avoid any day boundary issues
    const date = new Date(year, month - 1, day, 12, 0, 0);
    return isValid(date) ? date : undefined;
  }, [value]);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) {
      onChange?.('');
      return;
    }
    // Extract year, month, day directly to avoid timezone issues
    // The Calendar returns local date components, so we use local getters
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const isoDate = `${year}-${month}-${day}`;
    onChange?.(isoDate);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.('');
  };

  // Display value using local date components to avoid timezone issues
  const displayValue = selectedDate
    ? `${selectedDate.getDate()}/${selectedDate.getMonth() + 1}/${selectedDate.getFullYear()}`
    : '';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal h-7 px-2 text-xs',
            !selectedDate && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
          <span className="flex-1 truncate">
            {displayValue || placeholder}
          </span>
          {clearable && selectedDate && (
            <X
              className="h-3.5 w-3.5 ml-1 opacity-50 hover:opacity-100"
              onClick={handleClear}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          locale={es}
          initialFocus
          className="rounded-md"
        />
        <div className="border-t p-2 flex justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={() => {
              const today = new Date();
              handleDateSelect(today);
            }}
          >
            Hoy
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={() => {
              onChange?.('');
              setOpen(false);
            }}
          >
            Limpiar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
