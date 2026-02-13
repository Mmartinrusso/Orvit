import { describe, it, expect } from 'vitest';
import {
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
  getServerTimezone,
  DEFAULT_TIMEZONE,
} from '@/lib/date-helpers';

// Timezones de referencia
const BUE = 'America/Argentina/Buenos_Aires'; // UTC-3 (sin DST)
const NYC = 'America/New_York';                // UTC-5 / UTC-4 (con DST)
const UTC = 'UTC';

describe('date-helpers', () => {
  // =========================================================================
  // parseInTimezone
  // =========================================================================
  describe('parseInTimezone', () => {
    it('interpreta una fecha como hora local en la timezone dada', () => {
      // "2026-01-15T10:00:00" en Buenos Aires (UTC-3) → UTC 13:00
      const result = parseInTimezone('2026-01-15T10:00:00', BUE);
      expect(result.getUTCHours()).toBe(13);
      expect(result.getUTCDate()).toBe(15);
    });

    it('interpreta correctamente en UTC', () => {
      const result = parseInTimezone('2026-01-15T10:00:00', UTC);
      expect(result.getUTCHours()).toBe(10);
    });

    it('usa timezone por defecto si no se especifica', () => {
      const result = parseInTimezone('2026-01-15T10:00:00');
      // Default es BUE (UTC-3)
      expect(result.getUTCHours()).toBe(13);
    });
  });

  // =========================================================================
  // formatInTimezone
  // =========================================================================
  describe('formatInTimezone', () => {
    it('formatea fecha UTC mostrando hora local', () => {
      // UTC 13:00 → en BUE (UTC-3) debería mostrar 10:00
      const utcDate = new Date('2026-01-15T13:00:00Z');
      const result = formatInTimezone(utcDate, 'HH:mm', BUE);
      expect(result).toBe('10:00');
    });

    it('formatea fecha completa con locale español', () => {
      const utcDate = new Date('2026-03-20T15:30:00Z');
      const result = formatInTimezone(utcDate, 'dd/MM/yyyy HH:mm', BUE);
      expect(result).toBe('20/03/2026 12:30');
    });

    it('retorna string vacío para null/undefined', () => {
      expect(formatInTimezone(null, 'dd/MM/yyyy')).toBe('');
      expect(formatInTimezone(undefined, 'dd/MM/yyyy')).toBe('');
    });

    it('acepta ISO string como input', () => {
      const result = formatInTimezone('2026-01-15T13:00:00Z', 'HH:mm', BUE);
      expect(result).toBe('10:00');
    });
  });

  // =========================================================================
  // toUTC / fromUTC (roundtrip)
  // =========================================================================
  describe('toUTC / fromUTC roundtrip', () => {
    it('convierte ida y vuelta sin pérdida', () => {
      const localDate = new Date(2026, 0, 15, 10, 30, 0); // 10:30 "local"
      const utc = toUTC(localDate, BUE);
      const back = fromUTC(utc, BUE);

      expect(back.getHours()).toBe(localDate.getHours());
      expect(back.getMinutes()).toBe(localDate.getMinutes());
    });

    it('toUTC convierte correctamente', () => {
      // 10:00 en Buenos Aires = 13:00 UTC
      const local = new Date(2026, 0, 15, 10, 0, 0);
      const utc = toUTC(local, BUE);
      expect(utc.getUTCHours()).toBe(13);
    });

    it('fromUTC convierte correctamente', () => {
      // UTC 13:00 → Buenos Aires 10:00
      const utcDate = new Date('2026-01-15T13:00:00Z');
      const local = fromUTC(utcDate, BUE);
      expect(local.getHours()).toBe(10);
    });

    it('maneja ISO strings', () => {
      const utc = toUTC('2026-01-15T10:00:00', BUE);
      expect(utc.getUTCHours()).toBe(13);
    });
  });

  // =========================================================================
  // getCurrentTimezoneDate
  // =========================================================================
  describe('getCurrentTimezoneDate', () => {
    it('retorna un Date válido', () => {
      const now = getCurrentTimezoneDate(BUE);
      expect(now).toBeInstanceOf(Date);
      expect(isNaN(now.getTime())).toBe(false);
    });

    it('diferencia entre UTC y BUE es ~3 horas', () => {
      const nowUtc = getCurrentTimezoneDate(UTC);
      const nowBue = getCurrentTimezoneDate(BUE);
      // La diferencia en horas debería ser ~3 (puede variar por milisegundos)
      const diffHours = Math.abs(nowUtc.getHours() - nowBue.getHours());
      // Aceptar 3 o 21 (cuando cruza medianoche)
      expect([3, 21]).toContain(diffHours);
    });
  });

  // =========================================================================
  // Helpers de formateo con timezone
  // =========================================================================
  describe('format helpers con timezone', () => {
    const utcDate = new Date('2026-06-15T18:30:00Z');

    it('formatDateTz: dd/MM/yyyy', () => {
      const result = formatDateTz(utcDate, BUE);
      expect(result).toBe('15/06/2026');
    });

    it('formatDateTimeTz: dd/MM/yyyy HH:mm', () => {
      const result = formatDateTimeTz(utcDate, BUE);
      // 18:30 UTC = 15:30 en BUE (UTC-3)
      expect(result).toBe('15/06/2026 15:30');
    });

    it('formatDateFullTz: dd de MMMM de yyyy', () => {
      const result = formatDateFullTz(utcDate, BUE);
      expect(result).toBe('15 de junio de 2026');
    });

    it('formatDateTimeFullTz: completo con hora', () => {
      const result = formatDateTimeFullTz(utcDate, BUE);
      expect(result).toBe('15 de junio de 2026 a las 15:30');
    });

    it('formatTimeTz: HH:mm', () => {
      const result = formatTimeTz(utcDate, BUE);
      expect(result).toBe('15:30');
    });

    it('formatDateForInputTz: yyyy-MM-ddTHH:mm', () => {
      const result = formatDateForInputTz(utcDate, BUE);
      expect(result).toBe('2026-06-15T15:30');
    });
  });

  // =========================================================================
  // formatDateRelativeTz
  // =========================================================================
  describe('formatDateRelativeTz', () => {
    it('retorna "Hoy" para fecha de hoy', () => {
      const now = new Date();
      const result = formatDateRelativeTz(now.toISOString(), BUE);
      expect(result).toBe('Hoy');
    });

    it('retorna "Mañana" para fecha de mañana', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const result = formatDateRelativeTz(tomorrow.toISOString(), BUE);
      expect(result).toBe('Mañana');
    });

    it('retorna "Ayer" para fecha de ayer', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const result = formatDateRelativeTz(yesterday.toISOString(), BUE);
      expect(result).toBe('Ayer');
    });

    it('retorna "En X días" para futuro', () => {
      const future = new Date();
      future.setDate(future.getDate() + 5);
      const result = formatDateRelativeTz(future.toISOString(), BUE);
      expect(result).toBe('En 5 días');
    });

    it('retorna "Hace X días" para pasado', () => {
      const past = new Date();
      past.setDate(past.getDate() - 3);
      const result = formatDateRelativeTz(past.toISOString(), BUE);
      expect(result).toBe('Hace 3 días');
    });

    it('retorna string vacío para null', () => {
      expect(formatDateRelativeTz(null)).toBe('');
    });
  });

  // =========================================================================
  // DST Transitions (New York)
  // =========================================================================
  describe('DST transitions (New York)', () => {
    it('maneja spring forward correctamente (marzo 2026)', () => {
      // En 2026, DST empieza el 8 de marzo en EE.UU.
      // NYC: UTC-5 → UTC-4

      // 7 de marzo (antes de DST): UTC-5
      const beforeDST = new Date('2026-03-07T15:00:00Z');
      const beforeResult = formatInTimezone(beforeDST, 'HH:mm', NYC);
      expect(beforeResult).toBe('10:00'); // 15:00 UTC - 5 = 10:00

      // 9 de marzo (después de DST): UTC-4
      const afterDST = new Date('2026-03-09T15:00:00Z');
      const afterResult = formatInTimezone(afterDST, 'HH:mm', NYC);
      expect(afterResult).toBe('11:00'); // 15:00 UTC - 4 = 11:00
    });

    it('maneja fall back correctamente (noviembre 2026)', () => {
      // En 2026, DST termina el 1 de noviembre en EE.UU.
      // NYC: UTC-4 → UTC-5

      // 31 de octubre (aún DST): UTC-4
      const beforeFallback = new Date('2026-10-31T15:00:00Z');
      const beforeResult = formatInTimezone(beforeFallback, 'HH:mm', NYC);
      expect(beforeResult).toBe('11:00'); // 15:00 UTC - 4 = 11:00

      // 2 de noviembre (después de fallback): UTC-5
      const afterFallback = new Date('2026-11-02T15:00:00Z');
      const afterResult = formatInTimezone(afterFallback, 'HH:mm', NYC);
      expect(afterResult).toBe('10:00'); // 15:00 UTC - 5 = 10:00
    });

    it('Buenos Aires no tiene DST (offset constante -3)', () => {
      const winter = new Date('2026-07-15T15:00:00Z');
      const summer = new Date('2026-01-15T15:00:00Z');

      const winterResult = formatInTimezone(winter, 'HH:mm', BUE);
      const summerResult = formatInTimezone(summer, 'HH:mm', BUE);

      // Ambos deberían ser 12:00 (UTC-3 todo el año)
      expect(winterResult).toBe('12:00');
      expect(summerResult).toBe('12:00');
    });
  });

  // =========================================================================
  // Cross-timezone comparisons
  // =========================================================================
  describe('cross-timezone comparisons', () => {
    it('misma fecha UTC se ve diferente en distintas TZ', () => {
      // 2026-01-16 02:00 UTC
      const utcDate = new Date('2026-01-16T02:00:00Z');

      const bueDate = formatDateTz(utcDate, BUE);
      const nycDate = formatDateTz(utcDate, NYC);

      // En BUE (UTC-3): 15/01/2026 23:00 → aún día 15
      expect(bueDate).toBe('15/01/2026');
      // En NYC (UTC-5): 15/01/2026 21:00 → aún día 15
      expect(nycDate).toBe('15/01/2026');
    });

    it('medianoche UTC es diferente día en NYC vs BUE', () => {
      // 2026-01-16 04:00 UTC
      const utcDate = new Date('2026-01-16T04:00:00Z');

      const bueDate = formatDateTz(utcDate, BUE);
      const nycDate = formatDateTz(utcDate, NYC);

      // En BUE (UTC-3): 01:00 del 16 → día 16
      expect(bueDate).toBe('16/01/2026');
      // En NYC (UTC-5): 23:00 del 15 → día 15
      expect(nycDate).toBe('15/01/2026');
    });
  });

  // =========================================================================
  // isValidTimezone
  // =========================================================================
  describe('isValidTimezone', () => {
    it('acepta timezones IANA válidas', () => {
      expect(isValidTimezone('America/Argentina/Buenos_Aires')).toBe(true);
      expect(isValidTimezone('UTC')).toBe(true);
      expect(isValidTimezone('America/New_York')).toBe(true);
      expect(isValidTimezone('Europe/Madrid')).toBe(true);
    });

    it('rechaza timezones inválidas', () => {
      expect(isValidTimezone('Invalid/Timezone')).toBe(false);
      expect(isValidTimezone('ABC')).toBe(false);
      expect(isValidTimezone('')).toBe(false);
    });
  });

  // =========================================================================
  // getServerTimezone
  // =========================================================================
  describe('getServerTimezone', () => {
    it('retorna timezone del usuario si se provee', () => {
      expect(getServerTimezone('Europe/Madrid')).toBe('Europe/Madrid');
    });

    it('retorna default si es null', () => {
      expect(getServerTimezone(null)).toBe(DEFAULT_TIMEZONE);
    });

    it('retorna default si es undefined', () => {
      expect(getServerTimezone(undefined)).toBe(DEFAULT_TIMEZONE);
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================
  describe('edge cases', () => {
    it('maneja fecha en límite de año', () => {
      // 31 dic 2025 23:00 UTC → en BUE es 31 dic 20:00
      const newYearsEve = new Date('2025-12-31T23:00:00Z');
      expect(formatDateTz(newYearsEve, BUE)).toBe('31/12/2025');

      // 01 ene 2026 01:00 UTC → en BUE es 31 dic 22:00 (día anterior!)
      const newYearsEveLate = new Date('2026-01-01T01:00:00Z');
      expect(formatDateTz(newYearsEveLate, BUE)).toBe('31/12/2025');
    });

    it('maneja febrero bisiesto', () => {
      // 2028 es bisiesto - 29 de febrero existe
      const leapDay = new Date('2028-02-29T12:00:00Z');
      expect(formatDateTz(leapDay, BUE)).toBe('29/02/2028');
    });

    it('maneja strings inválidos gracefully', () => {
      expect(formatInTimezone('invalid-date', 'dd/MM/yyyy', BUE)).toBe('');
    });
  });
});
