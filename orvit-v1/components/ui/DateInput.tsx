'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format, parse, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface DateInputProps {
  value?: string; // Formato: YYYY-MM-DD (para compatibilidad con inputs date)
  onChange?: (value: string) => void; // Devuelve YYYY-MM-DD
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

export function DateInput({
  value = '',
  onChange,
  placeholder = 'dd/mm/yyyy',
  className,
  disabled = false,
  id,
}: DateInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dateValue, setDateValue] = useState<Date>();
  const [inputValue, setInputValue] = useState('');

  // Convertir YYYY-MM-DD a Date
  useEffect(() => {
    if (value) {
      try {
        const date = new Date(value + 'T00:00:00');
        if (isValid(date)) {
          setDateValue(date);
          setInputValue(format(date, 'dd/MM/yyyy', { locale: es }));
        } else {
          setDateValue(undefined);
          setInputValue('');
        }
      } catch (error) {
        setDateValue(undefined);
        setInputValue('');
      }
    } else {
      setDateValue(undefined);
      setInputValue('');
    }
  }, [value]);

  // Manejar cambio en el input de texto
  const handleInputChange = (text: string) => {
    // Remover caracteres no numéricos excepto barras
    let cleanValue = text.replace(/[^\d/]/g, '');
    
    // Si el usuario borra todo, permitir campo vacío
    if (cleanValue === '') {
      setInputValue('');
      setDateValue(undefined);
      onChange?.('');
      return;
    }
    
    // Agregar barras automáticamente
    if (cleanValue.length === 2 && !cleanValue.includes('/')) {
      cleanValue = cleanValue + '/';
    } else if (cleanValue.length === 5 && cleanValue.split('/').length === 2) {
      cleanValue = cleanValue + '/';
    }
    
    // Limitar a 10 caracteres (dd/mm/yyyy)
    if (cleanValue.length <= 10) {
      setInputValue(cleanValue);
      
      // Intentar parsear la fecha
      if (cleanValue.length === 10) {
        try {
          const parsed = parse(cleanValue, 'dd/MM/yyyy', new Date(), { locale: es });
          if (isValid(parsed)) {
            setDateValue(parsed);
            // Convertir a YYYY-MM-DD para el onChange
            const isoDate = format(parsed, 'yyyy-MM-dd');
            onChange?.(isoDate);
          }
        } catch (error) {
          // Fecha inválida, no actualizar
        }
      }
    }
  };

  // Manejar selección del calendario
  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setDateValue(date);
      setInputValue(format(date, 'dd/MM/yyyy', { locale: es }));
      const isoDate = format(date, 'yyyy-MM-dd');
      onChange?.(isoDate);
      setIsOpen(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Input
            id={id}
            type="text"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className={cn('h-9 text-xs pr-9', className)}
          />
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            disabled={disabled}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <CalendarIcon className="h-4 w-4" />
          </button>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={handleDateSelect}
          initialFocus
          locale={es}
        />
      </PopoverContent>
    </Popover>
  );
}

