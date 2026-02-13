'use client';

import * as React from 'react';
import { format, parse, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';

interface DateTimePickerProps {
  value?: Date | string;
  onChange?: (date: Date | undefined) => void;
  minDate?: Date;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function DateTimePicker({
  value,
  onChange,
  minDate,
  placeholder = 'Seleccionar fecha y hora',
  disabled = false,
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(() => {
    if (!value) return undefined;
    if (value instanceof Date) return value;
    // Try to parse ISO string
    const parsed = new Date(value);
    return isValid(parsed) ? parsed : undefined;
  });
  const [hours, setHours] = React.useState<string>(() => {
    if (!selectedDate) return '09';
    return selectedDate.getHours().toString().padStart(2, '0');
  });
  const [minutes, setMinutes] = React.useState<string>(() => {
    if (!selectedDate) return '00';
    return selectedDate.getMinutes().toString().padStart(2, '0');
  });

  // Sync with external value
  React.useEffect(() => {
    if (!value) {
      setSelectedDate(undefined);
      return;
    }
    const date = value instanceof Date ? value : new Date(value);
    if (isValid(date)) {
      setSelectedDate(date);
      setHours(date.getHours().toString().padStart(2, '0'));
      setMinutes(date.getMinutes().toString().padStart(2, '0'));
    }
  }, [value]);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) {
      setSelectedDate(undefined);
      onChange?.(undefined);
      return;
    }

    // Combine date with current time
    const h = parseInt(hours) || 9;
    const m = parseInt(minutes) || 0;
    date.setHours(h, m, 0, 0);
    setSelectedDate(date);
    onChange?.(date);
  };

  const handleTimeChange = (newHours: string, newMinutes: string) => {
    const h = Math.min(23, Math.max(0, parseInt(newHours) || 0));
    const m = Math.min(59, Math.max(0, parseInt(newMinutes) || 0));

    setHours(h.toString().padStart(2, '0'));
    setMinutes(m.toString().padStart(2, '0'));

    if (selectedDate) {
      const newDate = new Date(selectedDate);
      newDate.setHours(h, m, 0, 0);
      setSelectedDate(newDate);
      onChange?.(newDate);
    }
  };

  const displayValue = selectedDate
    ? format(selectedDate, "dd/MM/yyyy HH:mm", { locale: es })
    : '';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal h-10',
            !selectedDate && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {displayValue || placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          disabled={(date) => minDate ? date < minDate : false}
          locale={es}
          initialFocus
        />
        <div className="border-t p-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Hora:</span>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={0}
                max={23}
                value={hours}
                onChange={(e) => handleTimeChange(e.target.value, minutes)}
                className="w-14 h-8 text-center text-sm"
              />
              <span className="text-muted-foreground">:</span>
              <Input
                type="number"
                min={0}
                max={59}
                value={minutes}
                onChange={(e) => handleTimeChange(hours, e.target.value)}
                className="w-14 h-8 text-center text-sm"
              />
            </div>
          </div>
        </div>
        <div className="border-t p-2 flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedDate(undefined);
              onChange?.(undefined);
              setOpen(false);
            }}
          >
            Limpiar
          </Button>
          <Button
            size="sm"
            onClick={() => setOpen(false)}
          >
            Aceptar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
