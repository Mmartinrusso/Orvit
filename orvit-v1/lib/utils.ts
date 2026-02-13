import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Strips HTML tags from a string, useful for displaying rich text content as plain text
 * in cards or previews while keeping the full HTML in detail views
 */
export function stripHtmlTags(html: string | null | undefined): string {
  if (!html) return '';
  // Remove HTML tags and decode common entities
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Formats time with the correct unit (hours or minutes)
 */
export function formatTimeWithUnit(value: number | null | undefined, unit: string | null | undefined): string {
  if (!value && value !== 0) return 'No especificado';
  const timeUnit = unit === 'minutes' ? 'min' : 'h';
  return `${value} ${timeUnit}`;
}

/**
 * Formats decimal hours to a readable duration string
 * Examples:
 * - 0.33 -> "20 min"
 * - 1.5 -> "1h 30min"
 * - 2 -> "2h"
 * - 0.5 -> "30 min"
 */
export function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined || isNaN(hours)) return 'N/A';

  const totalMinutes = Math.round(hours * 60);

  if (totalMinutes === 0) return '0 min';

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (m === 0) {
    return `${h}h`;
  }

  return `${h}h ${m}min`;
}

/**
 * Formats duration in minutes to a readable string
 */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || isNaN(minutes)) return 'N/A';

  if (minutes === 0) return '0 min';

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  if (m === 0) {
    return `${h}h`;
  }

  return `${h}h ${m}min`;
}

export function toSlug(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Tipos para tamaños de modales
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

/**
 * Genera clases CSS responsive para modales según el tamaño especificado
 * Optimizado para diferentes resoluciones de pantalla, especialmente monitores menos altos
 */
export function getResponsiveModalClasses(size: ModalSize = 'md'): string {
  const sizeConfigs = {
    sm: {
      width: 'w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] sm:max-w-sm md:max-w-md',
      height: 'max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] md:max-h-[calc(100vh-4rem)]'
    },
    md: {
      width: 'w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] md:w-[calc(100vw-3rem)] sm:max-w-lg md:max-w-xl lg:max-w-2xl',
      height: 'max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] md:max-h-[calc(100vh-4rem)]'
    },
    lg: {
      width: 'w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] md:w-[calc(100vw-3rem)] lg:w-[calc(100vw-4rem)] sm:max-w-2xl md:max-w-3xl lg:max-w-4xl',
      height: 'max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] md:max-h-[calc(100vh-4rem)]'
    },
    xl: {
      width: 'w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] md:w-[calc(100vw-3rem)] lg:w-[calc(100vw-4rem)] sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl',
      height: 'max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] md:max-h-[calc(100vh-4rem)]'
    },
    full: {
      width: 'w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] md:w-[calc(100vw-3rem)] lg:w-[calc(100vw-4rem)] sm:max-w-4xl md:max-w-5xl lg:max-w-6xl xl:max-w-7xl',
      height: 'max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] md:max-h-[calc(100vh-4rem)]'
    }
  };

  const config = sizeConfigs[size];
  return `${config.width} ${config.height}`;
}

/**
 * Genera clases CSS responsive para modales de altura completa (como detalles de máquinas)
 */
export function getFullHeightModalClasses(size: ModalSize = 'xl'): string {
  const sizeConfigs = {
    sm: 'w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] sm:max-w-lg md:max-w-xl',
    md: 'w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] md:w-[calc(100vw-3rem)] sm:max-w-xl md:max-w-2xl lg:max-w-3xl',
    lg: 'w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] md:w-[calc(100vw-3rem)] lg:w-[calc(100vw-4rem)] sm:max-w-3xl md:max-w-4xl lg:max-w-5xl',
    xl: 'w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] md:w-[calc(100vw-3rem)] lg:w-[calc(100vw-4rem)] xl:w-[calc(100vw-6rem)] sm:max-w-4xl md:max-w-5xl lg:max-w-6xl xl:max-w-7xl',
    full: 'w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] md:w-[calc(100vw-3rem)] lg:w-[calc(100vw-4rem)] xl:w-[calc(100vw-6rem)] sm:max-w-5xl md:max-w-6xl lg:max-w-7xl xl:max-w-full'
  };

  const heightClasses = 'h-[calc(100vh-1rem)] sm:h-[calc(100vh-2rem)] md:h-[calc(100vh-3rem)] lg:h-[calc(100vh-4rem)]';
  
  return `${sizeConfigs[size]} ${heightClasses}`;
}

/**
 * Formats a number as currency (ARS by default)
 * @param value - The number to format
 * @param locale - The locale to use for formatting (default: 'es-AR')
 * @param currency - The currency code (default: 'ARS')
 * @returns Formatted currency string
 */
export function formatCurrency(
  value: number | null | undefined,
  locale: string = 'es-AR',
  currency: string = 'ARS'
): string {
  if (value === null || value === undefined || isNaN(value)) return '$0';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formats a number with thousand separators
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 0)
 */
export function formatNumber(
  value: number | null | undefined,
  decimals: number = 0
): string {
  if (value === null || value === undefined || isNaN(value)) return '0';

  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}
