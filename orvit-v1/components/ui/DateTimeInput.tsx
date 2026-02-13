'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon, Clock } from 'lucide-react';
import { format, parse, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface DateTimeInputProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  error?: boolean;
}

export function DateTimeInput({
  value = '',
  onChange,
  placeholder = 'dd/mm/yyyy HH:mm',
  className,
  disabled = false,
  error = false,
}: DateTimeInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dateValue, setDateValue] = useState<Date>();
  const [timeValue, setTimeValue] = useState('09:00');
  const [inputValue, setInputValue] = useState('');

  // Inicializar valores desde el prop value
  useEffect(() => {
    if (value) {
      try {
        const date = new Date(value);
        if (isValid(date)) {
          setDateValue(date);
          setTimeValue(format(date, 'HH:mm'));
          setInputValue(format(date, 'dd/MM/yyyy HH:mm', { locale: es }));
        }
      } catch (error) {
        console.error('Error parsing date:', error);
      }
    } else {
      setDateValue(undefined);
      setTimeValue('09:00');
      setInputValue('');
    }
  }, [value]);

  // Actualizar valor cuando cambian fecha o hora
  const updateDateTime = (newDate?: Date, newTime?: string) => {
    const selectedDate = newDate || dateValue;
    const selectedTime = newTime || timeValue;

    if (selectedDate && selectedTime) {
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const combinedDate = new Date(selectedDate);
      combinedDate.setHours(hours, minutes, 0, 0);
      
      const formattedDisplay = format(combinedDate, 'dd/MM/yyyy HH:mm', { locale: es });
      const isoString = combinedDate.toISOString();
      
      setInputValue(formattedDisplay);
      onChange?.(isoString);
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    setDateValue(date);
    updateDateTime(date, timeValue);
    if (date) {
      setIsOpen(false);
    }
  };

  const handleTimeChange = (time: string) => {
    setTimeValue(time);
    updateDateTime(dateValue, time);
  };

  const handleInputChange = (inputText: string) => {
    setInputValue(inputText);
    
    // Intentar parsear el input manual
    try {
      // Permitir diferentes formatos de entrada
      const formats = [
        'dd/MM/yyyy HH:mm',
        'dd/MM/yyyy',
        'dd-MM-yyyy HH:mm',
        'dd-MM-yyyy',
      ];
      
      let parsedDate: Date | null = null;
      
      for (const formatString of formats) {
        try {
          const parsed = parse(inputText, formatString, new Date(), { locale: es });
          if (isValid(parsed)) {
            parsedDate = parsed;
            break;
          }
        } catch {
          continue;
        }
      }
      
      if (parsedDate) {
        setDateValue(parsedDate);
        setTimeValue(format(parsedDate, 'HH:mm'));
        onChange?.(parsedDate.toISOString());
      }
    } catch (error) {
      // Mantener el valor del input pero no actualizar la fecha
    }
  };

  const handleClear = () => {
    setDateValue(undefined);
    setTimeValue('09:00');
    setInputValue('');
    onChange?.('');
  };

  return (
    <div className="flex gap-2">
      {/* Input principal con formato dd/mm/yyyy */}
      <div className="flex-1 relative">
        <Input
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            'pr-10',
            error && 'border-red-500',
            className
          )}
          disabled={disabled}
        />
        <CalendarIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
      </div>

      {/* Selector de calendario */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            disabled={disabled}
            className="shrink-0"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-3 space-y-3">
            <Calendar
              mode="single"
              selected={dateValue}
              onSelect={handleDateSelect}
              initialFocus
              locale={es}
            />
            
            <div className="border-t pt-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <Input
                  type="time"
                  value={timeValue}
                  onChange={(e) => handleTimeChange(e.target.value)}
                  className="w-32"
                />
              </div>
            </div>
            
            {inputValue && (
              <div className="border-t pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClear}
                  className="w-full"
                >
                  Limpiar
                </Button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
} 