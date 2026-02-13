import { format, parseISO } from 'date-fns';
import { toZonedTime, fromZonedTime, format as formatTz } from 'date-fns-tz';
import { es } from 'date-fns/locale';

// Timezone por defecto del sistema (Argentina)
export const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

/**
 * Obtiene la timezone actual del cliente.
 * Prioridad: window.__TIMEZONE__ > Intl API > default
 */
export function getClientTimezone(): string {
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tz = (window as any).__TIMEZONE__;
    if (tz && typeof tz === 'string') return tz;

    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      // Intl no disponible
    }
  }
  return DEFAULT_TIMEZONE;
}

/**
 * Obtiene la timezone para uso en server-side.
 * Usa la timezone del usuario si se provee, sino la del sistema.
 */
export function getServerTimezone(userTimezone?: string | null): string {
  return userTimezone || DEFAULT_TIMEZONE;
}

// ---------------------------------------------------------------------------
// Conversiones de timezone
// ---------------------------------------------------------------------------

/**
 * Parsea un string de fecha y lo interpreta en la timezone dada.
 * Útil cuando el usuario ingresa "15/02/2026 10:00" y queremos que sea 10:00 en su TZ.
 *
 * @param dateString - ISO string o fecha parseable
 * @param timezone - IANA timezone (ej: 'America/Argentina/Buenos_Aires')
 * @returns Date en UTC que representa ese momento en la timezone dada
 */
export function parseInTimezone(
  dateString: string,
  timezone: string = DEFAULT_TIMEZONE,
): Date {
  const parsed = parseISO(dateString);
  // fromZonedTime convierte: "esta fecha/hora local en esa TZ" -> UTC
  return fromZonedTime(parsed, timezone);
}

/**
 * Formatea una fecha UTC mostrándola en la timezone dada.
 *
 * @param date - Date (UTC) o ISO string
 * @param formatStr - Formato de date-fns (ej: 'dd/MM/yyyy HH:mm')
 * @param timezone - IANA timezone
 * @returns String formateado en la timezone del usuario
 */
export function formatInTimezone(
  date: Date | string | null | undefined,
  formatStr: string,
  timezone: string = DEFAULT_TIMEZONE,
): string {
  if (!date) return '';

  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return formatTz(toZonedTime(dateObj, timezone), formatStr, {
      locale: es,
      timeZone: timezone,
    });
  } catch {
    return '';
  }
}

/**
 * Obtiene la fecha/hora actual en la timezone dada como Date "zonificada".
 * El Date retornado tiene sus valores (getHours, etc.) ajustados a la TZ.
 *
 * @param timezone - IANA timezone
 * @returns Date con valores ajustados a la timezone
 */
export function getCurrentTimezoneDate(
  timezone: string = DEFAULT_TIMEZONE,
): Date {
  return toZonedTime(new Date(), timezone);
}

/**
 * Convierte una fecha local del usuario (en su TZ) a UTC para guardar en DB.
 *
 * @param localDate - Date interpretada como hora local del usuario
 * @param timezone - IANA timezone del usuario
 * @returns Date en UTC
 */
export function toUTC(
  localDate: Date | string,
  timezone: string = DEFAULT_TIMEZONE,
): Date {
  const dateObj = typeof localDate === 'string' ? parseISO(localDate) : localDate;
  return fromZonedTime(dateObj, timezone);
}

/**
 * Convierte una fecha UTC (de DB) a la hora local del usuario.
 *
 * @param utcDate - Date en UTC
 * @param timezone - IANA timezone del usuario
 * @returns Date con valores ajustados a la timezone
 */
export function fromUTC(
  utcDate: Date | string,
  timezone: string = DEFAULT_TIMEZONE,
): Date {
  const dateObj = typeof utcDate === 'string' ? parseISO(utcDate) : utcDate;
  return toZonedTime(dateObj, timezone);
}

// ---------------------------------------------------------------------------
// Helpers de formateo con timezone (wrappers sobre date-utils.ts)
// ---------------------------------------------------------------------------

/**
 * Formatea fecha corta en timezone del usuario: dd/MM/yyyy
 */
export function formatDateTz(
  date: Date | string | null | undefined,
  timezone?: string,
): string {
  return formatInTimezone(date, 'dd/MM/yyyy', timezone);
}

/**
 * Formatea fecha con hora en timezone del usuario: dd/MM/yyyy HH:mm
 */
export function formatDateTimeTz(
  date: Date | string | null | undefined,
  timezone?: string,
): string {
  return formatInTimezone(date, 'dd/MM/yyyy HH:mm', timezone);
}

/**
 * Formatea fecha completa en timezone: dd de MMMM de yyyy
 */
export function formatDateFullTz(
  date: Date | string | null | undefined,
  timezone?: string,
): string {
  return formatInTimezone(date, "dd 'de' MMMM 'de' yyyy", timezone);
}

/**
 * Formatea fecha completa con hora en timezone: dd de MMMM de yyyy a las HH:mm
 */
export function formatDateTimeFullTz(
  date: Date | string | null | undefined,
  timezone?: string,
): string {
  return formatInTimezone(date, "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", timezone);
}

/**
 * Formatea solo hora en timezone: HH:mm
 */
export function formatTimeTz(
  date: Date | string | null | undefined,
  timezone?: string,
): string {
  return formatInTimezone(date, 'HH:mm', timezone);
}

/**
 * Formatea fecha para input datetime-local en timezone: yyyy-MM-ddTHH:mm
 */
export function formatDateForInputTz(
  date: Date | string | null | undefined,
  timezone?: string,
): string {
  return formatInTimezone(date, "yyyy-MM-dd'T'HH:mm", timezone);
}

/**
 * Formatea fecha relativa considerando timezone.
 * Retorna: "Hoy", "Mañana", "Ayer", "En X días", "Hace X días"
 */
export function formatDateRelativeTz(
  date: Date | string | null | undefined,
  timezone?: string,
): string {
  if (!date) return '';

  try {
    const tz = timezone || DEFAULT_TIMEZONE;
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    const zonedDate = toZonedTime(dateObj, tz);
    const now = toZonedTime(new Date(), tz);

    // Comparar solo por día calendario
    const dateDay = new Date(zonedDate.getFullYear(), zonedDate.getMonth(), zonedDate.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round((dateDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Mañana';
    if (diffDays === -1) return 'Ayer';
    if (diffDays > 1) return `En ${diffDays} días`;
    return `Hace ${Math.abs(diffDays)} días`;
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Validación de timezone
// ---------------------------------------------------------------------------

/**
 * Verifica si un string es una timezone IANA válida.
 */
export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Lista de timezones comunes de Latinoamérica para selectores de UI.
 */
export const COMMON_TIMEZONES = [
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (Buenos Aires)' },
  { value: 'America/Sao_Paulo', label: 'Brasil (São Paulo)' },
  { value: 'America/Santiago', label: 'Chile (Santiago)' },
  { value: 'America/Bogota', label: 'Colombia (Bogotá)' },
  { value: 'America/Mexico_City', label: 'México (Ciudad de México)' },
  { value: 'America/Lima', label: 'Perú (Lima)' },
  { value: 'America/Montevideo', label: 'Uruguay (Montevideo)' },
  { value: 'America/Caracas', label: 'Venezuela (Caracas)' },
  { value: 'America/New_York', label: 'EE.UU. (Nueva York)' },
  { value: 'America/Chicago', label: 'EE.UU. (Chicago)' },
  { value: 'America/Los_Angeles', label: 'EE.UU. (Los Ángeles)' },
  { value: 'Europe/Madrid', label: 'España (Madrid)' },
  { value: 'Europe/London', label: 'Reino Unido (Londres)' },
  { value: 'UTC', label: 'UTC' },
] as const;

// ---------------------------------------------------------------------------
// Declaración global para window.__TIMEZONE__
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    __TIMEZONE__?: string;
  }
}
