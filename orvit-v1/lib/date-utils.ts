import { format, parseISO, isValid } from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import { loggers } from '@/lib/logger';

// Timezone por defecto (configurable por empresa)
export const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

// Configuración global de formatos de fecha
export const DATE_FORMATS = {
  SHORT: 'dd/MM/yyyy',
  WITH_TIME: 'dd/MM/yyyy HH:mm',
  FULL: "dd 'de' MMMM 'de' yyyy",
  FULL_WITH_TIME: "dd 'de' MMMM 'de' yyyy 'a las' HH:mm",
  INPUT: "yyyy-MM-dd'T'HH:mm",
  TIME_ONLY: 'HH:mm',
};

/**
 * Convierte una fecha UTC a la hora del usuario en el timezone indicado.
 * Úsalo solo en presentación (UI), nunca para almacenar.
 */
export function toUserTime(
  date: Date | string | null | undefined,
  timezone: string = DEFAULT_TIMEZONE
): Date | null {
  if (!date) return null;
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) return null;
    return toZonedTime(dateObj, timezone);
  } catch (error) {
    loggers.utils.error({ err: error }, 'Error converting to user time');
    return null;
  }
}

/**
 * Convierte una fecha local del usuario a UTC para enviar al backend.
 * Usar cuando el usuario ingresa una fecha en un formulario.
 * @param dateStr - String de fecha del input (ej: '2026-02-13' o '2026-02-13T14:30')
 * @param timezone - Timezone del usuario
 */
export function toUTC(
  dateStr: string,
  timezone: string = DEFAULT_TIMEZONE
): Date {
  // Si el string tiene 'T' es datetime, sino es date-only (mediodía para evitar saltos de día)
  const hasTime = dateStr.includes('T');
  const fullStr = hasTime ? dateStr : `${dateStr}T12:00:00`;

  // new Date(str sin Z) interpreta como hora local del navegador/servidor.
  // Calculamos el offset del timezone deseado para convertir a UTC.
  const localDate = new Date(fullStr);
  const zonedDate = toZonedTime(localDate, timezone);
  const offsetMs = zonedDate.getTime() - localDate.getTime();
  return new Date(localDate.getTime() - offsetMs);
}

/**
 * Extrae la parte de fecha (YYYY-MM-DD) de una fecha UTC,
 * convertida al timezone del usuario.
 * Reemplazo seguro de toISOString().split('T')[0] que puede dar fecha incorrecta
 * cerca de medianoche UTC.
 */
export function toDateOnly(
  date: Date | string | null | undefined,
  timezone: string = DEFAULT_TIMEZONE
): string {
  if (!date) return '';
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return formatInTimeZone(dateObj, timezone, 'yyyy-MM-dd');
  } catch (error) {
    loggers.utils.error({ err: error }, 'Error extracting date-only');
    return '';
  }
}

/**
 * Formatea una fecha UTC al timezone del usuario con formato personalizado.
 * Centraliza el uso de date-fns-tz para que los componentes no importen directamente.
 */
export function formatDateTz(
  date: Date | string | null | undefined,
  formatStr: string = DATE_FORMATS.SHORT,
  timezone: string = DEFAULT_TIMEZONE
): string {
  if (!date) return '';
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return formatInTimeZone(dateObj, timezone, formatStr, { locale: es });
  } catch (error) {
    loggers.utils.error({ err: error }, 'Error formatting date with timezone');
    return '';
  }
}

/**
 * Formatea una fecha en formato dd/mm/yyyy
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, DATE_FORMATS.SHORT, { locale: es });
  } catch (error) {
    loggers.utils.error({ err: error }, 'Error formatting date');
    return '';
  }
}

/**
 * Formatea una fecha con hora en formato dd/mm/yyyy HH:mm
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, DATE_FORMATS.WITH_TIME, { locale: es });
  } catch (error) {
    loggers.utils.error({ err: error }, 'Error formatting datetime');
    return '';
  }
}

/**
 * Formatea una fecha en formato completo: dd de MMMM de yyyy
 */
export function formatDateFull(date: Date | string | null | undefined): string {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, DATE_FORMATS.FULL, { locale: es });
  } catch (error) {
    loggers.utils.error({ err: error }, 'Error formatting full date');
    return '';
  }
}

/**
 * Formatea una fecha completa con hora: dd de MMMM de yyyy a las HH:mm
 */
export function formatDateTimeFull(date: Date | string | null | undefined): string {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, DATE_FORMATS.FULL_WITH_TIME, { locale: es });
  } catch (error) {
    loggers.utils.error({ err: error }, 'Error formatting full datetime');
    return '';
  }
}

/**
 * Formatea una fecha para inputs datetime-local: yyyy-MM-ddTHH:mm
 */
export function formatDateForInput(date: Date | string | null | undefined): string {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, DATE_FORMATS.INPUT, { locale: es });
  } catch (error) {
    loggers.utils.error({ err: error }, 'Error formatting date for input');
    return '';
  }
}

/**
 * Formatea solo la hora: HH:mm
 */
export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, DATE_FORMATS.TIME_ONLY, { locale: es });
  } catch (error) {
    loggers.utils.error({ err: error }, 'Error formatting time');
    return '';
  }
}

/**
 * Convierte una fecha relativa a texto legible
 */
export function formatDateRelative(date: Date | string | null | undefined): string {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    const now = new Date();
    const diffDays = Math.floor((dateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Hoy';
    } else if (diffDays === 1) {
      return 'Mañana';
    } else if (diffDays === -1) {
      return 'Ayer';
    } else if (diffDays > 1) {
      return `En ${diffDays} días`;
    } else {
      return `Hace ${Math.abs(diffDays)} días`;
    }
  } catch (error) {
    loggers.utils.error({ err: error }, 'Error formatting relative date');
    return '';
  }
}

/**
 * Configura el formato de fecha global para inputs nativos
 * Utiliza JavaScript para forzar el formato dd/mm/yyyy
 */
export function configureDateInputFormat() {
  if (typeof window !== 'undefined') {
    // Configurar todos los inputs de fecha existentes
    const dateInputs = document.querySelectorAll('input[type="date"], input[type="datetime-local"]');
    
    dateInputs.forEach((input) => {
      if (input instanceof HTMLInputElement) {
        // Agregar la clase de formato español
        input.classList.add('date-format-es');
        
        // Configurar el atributo lang para español
        input.setAttribute('lang', 'es-ES');
      }
    });
    
    // Observer para nuevos inputs de fecha
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            const newDateInputs = node.querySelectorAll?.('input[type="date"], input[type="datetime-local"]');
            newDateInputs?.forEach((input) => {
              if (input instanceof HTMLInputElement) {
                input.classList.add('date-format-es');
                input.setAttribute('lang', 'es-ES');
              }
            });
          }
        });
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
    
    return observer;
  }
}

/**
 * Hook para inicializar el formato de fecha
 * Usar en componentes que tengan inputs de fecha
 */
export function useDateFormat() {
  if (typeof window !== 'undefined') {
    // Configurar al montar el componente
    const cleanup = configureDateInputFormat();
    
    return () => {
      if (cleanup && typeof cleanup.disconnect === 'function') {
        cleanup.disconnect();
      }
    };
  }
  
  return () => {};
} 