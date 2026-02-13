import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { loggers } from '@/lib/logger';

// Re-exportar helpers de timezone para acceso centralizado
export {
  getClientTimezone,
  getServerTimezone,
  parseInTimezone,
  formatInTimezone,
  getCurrentTimezoneDate,
  toUTC,
  fromUTC,
  formatDateTz,
  formatDateTimeTz,
  formatDateFullTz,
  formatDateTimeFullTz,
  formatTimeTz,
  formatDateForInputTz,
  formatDateRelativeTz,
  isValidTimezone,
  COMMON_TIMEZONES,
  DEFAULT_TIMEZONE,
} from '@/lib/date-helpers';

// Configuración global de formatos de fecha
export const DATE_FORMATS = {
  // Formato corto: dd/mm/yyyy
  SHORT: 'dd/MM/yyyy',
  
  // Formato con hora: dd/mm/yyyy HH:mm
  WITH_TIME: 'dd/MM/yyyy HH:mm',
  
  // Formato completo: dd de MMMM de yyyy
  FULL: "dd 'de' MMMM 'de' yyyy",
  
  // Formato completo con hora: dd de MMMM de yyyy a las HH:mm
  FULL_WITH_TIME: "dd 'de' MMMM 'de' yyyy 'a las' HH:mm",
  
  // Para inputs datetime-local: yyyy-MM-ddTHH:mm
  INPUT: "yyyy-MM-dd'T'HH:mm",
  
  // Solo hora: HH:mm
  TIME_ONLY: 'HH:mm',
};

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