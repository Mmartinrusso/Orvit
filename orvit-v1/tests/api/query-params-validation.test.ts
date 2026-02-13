import { describe, it, expect } from 'vitest';
import {
  getIntParam,
  getBoolParam,
  getEnumParam,
  getDateParam,
  getStringParam,
  getPaginationParams,
  validateQueryParams,
} from '@/lib/api-utils';
import { z } from 'zod';

// ─── getIntParam ────────────────────────────────────────────────────────────

describe('getIntParam', () => {
  it('retorna el valor entero cuando es válido', () => {
    const sp = new URLSearchParams({ id: '42' });
    expect(getIntParam(sp, 'id')).toBe(42);
  });

  it('retorna null cuando el parámetro no existe', () => {
    const sp = new URLSearchParams();
    expect(getIntParam(sp, 'id')).toBeNull();
  });

  it('retorna null cuando el valor no es un número', () => {
    const sp = new URLSearchParams({ id: 'abc' });
    expect(getIntParam(sp, 'id')).toBeNull();
  });

  it('retorna null cuando el valor es un decimal', () => {
    const sp = new URLSearchParams({ id: '3.14' });
    expect(getIntParam(sp, 'id')).toBeNull();
  });

  it('retorna el valor por defecto cuando el parámetro no existe', () => {
    const sp = new URLSearchParams();
    expect(getIntParam(sp, 'id', 1)).toBe(1);
  });

  it('retorna null (no el default) cuando el valor es inválido', () => {
    const sp = new URLSearchParams({ id: 'abc' });
    expect(getIntParam(sp, 'id', 1)).toBeNull();
  });

  it('retorna el valor para string vacío con default', () => {
    const sp = new URLSearchParams({ id: '' });
    expect(getIntParam(sp, 'id', 5)).toBe(5);
  });

  it('acepta números negativos', () => {
    const sp = new URLSearchParams({ offset: '-10' });
    expect(getIntParam(sp, 'offset')).toBe(-10);
  });

  it('acepta cero', () => {
    const sp = new URLSearchParams({ count: '0' });
    expect(getIntParam(sp, 'count')).toBe(0);
  });
});

// ─── getBoolParam ───────────────────────────────────────────────────────────

describe('getBoolParam', () => {
  it('retorna true para "true"', () => {
    const sp = new URLSearchParams({ active: 'true' });
    expect(getBoolParam(sp, 'active')).toBe(true);
  });

  it('retorna true para "1"', () => {
    const sp = new URLSearchParams({ active: '1' });
    expect(getBoolParam(sp, 'active')).toBe(true);
  });

  it('retorna false para "false"', () => {
    const sp = new URLSearchParams({ active: 'false' });
    expect(getBoolParam(sp, 'active')).toBe(false);
  });

  it('retorna false para "0"', () => {
    const sp = new URLSearchParams({ active: '0' });
    expect(getBoolParam(sp, 'active')).toBe(false);
  });

  it('retorna null cuando el parámetro no existe', () => {
    const sp = new URLSearchParams();
    expect(getBoolParam(sp, 'active')).toBeNull();
  });

  it('retorna null para valor inválido', () => {
    const sp = new URLSearchParams({ active: 'yes' });
    expect(getBoolParam(sp, 'active')).toBeNull();
  });

  it('retorna el valor por defecto cuando no existe', () => {
    const sp = new URLSearchParams();
    expect(getBoolParam(sp, 'active', false)).toBe(false);
  });

  it('es case-insensitive', () => {
    const sp = new URLSearchParams({ active: 'TRUE' });
    expect(getBoolParam(sp, 'active')).toBe(true);

    const sp2 = new URLSearchParams({ active: 'False' });
    expect(getBoolParam(sp2, 'active')).toBe(false);
  });
});

// ─── getEnumParam ───────────────────────────────────────────────────────────

describe('getEnumParam', () => {
  const validStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED'] as const;

  it('retorna el valor cuando está en la lista', () => {
    const sp = new URLSearchParams({ status: 'PENDING' });
    expect(getEnumParam(sp, 'status', validStatuses)).toBe('PENDING');
  });

  it('retorna null cuando el valor no está en la lista', () => {
    const sp = new URLSearchParams({ status: 'DELETED' });
    expect(getEnumParam(sp, 'status', validStatuses)).toBeNull();
  });

  it('retorna null cuando el parámetro no existe', () => {
    const sp = new URLSearchParams();
    expect(getEnumParam(sp, 'status', validStatuses)).toBeNull();
  });

  it('retorna el valor por defecto cuando no existe', () => {
    const sp = new URLSearchParams();
    expect(getEnumParam(sp, 'status', validStatuses, 'PENDING')).toBe('PENDING');
  });

  it('es case-sensitive', () => {
    const sp = new URLSearchParams({ status: 'pending' });
    expect(getEnumParam(sp, 'status', validStatuses)).toBeNull();
  });
});

// ─── getDateParam ───────────────────────────────────────────────────────────

describe('getDateParam', () => {
  it('retorna Date para ISO string válido', () => {
    const sp = new URLSearchParams({ date: '2024-06-15T10:00:00Z' });
    const result = getDateParam(sp, 'date');
    expect(result).toBeInstanceOf(Date);
    expect(result!.toISOString()).toBe('2024-06-15T10:00:00.000Z');
  });

  it('retorna Date para fecha simple YYYY-MM-DD', () => {
    const sp = new URLSearchParams({ date: '2024-06-15' });
    const result = getDateParam(sp, 'date');
    expect(result).toBeInstanceOf(Date);
  });

  it('retorna null para fecha inválida', () => {
    const sp = new URLSearchParams({ date: 'not-a-date' });
    expect(getDateParam(sp, 'date')).toBeNull();
  });

  it('retorna null cuando el parámetro no existe', () => {
    const sp = new URLSearchParams();
    expect(getDateParam(sp, 'date')).toBeNull();
  });

  it('retorna el valor por defecto cuando no existe', () => {
    const sp = new URLSearchParams();
    const defaultDate = new Date('2024-01-01');
    expect(getDateParam(sp, 'date', defaultDate)).toBe(defaultDate);
  });
});

// ─── getStringParam ─────────────────────────────────────────────────────────

describe('getStringParam', () => {
  it('retorna el string con trim', () => {
    const sp = new URLSearchParams({ search: '  hello  ' });
    expect(getStringParam(sp, 'search')).toBe('hello');
  });

  it('retorna null cuando el parámetro no existe', () => {
    const sp = new URLSearchParams();
    expect(getStringParam(sp, 'search')).toBeNull();
  });

  it('retorna null para string vacío', () => {
    const sp = new URLSearchParams({ search: '' });
    expect(getStringParam(sp, 'search')).toBeNull();
  });

  it('retorna null para string solo con espacios', () => {
    const sp = new URLSearchParams({ search: '   ' });
    expect(getStringParam(sp, 'search')).toBeNull();
  });

  it('trunca al maxLength especificado', () => {
    const sp = new URLSearchParams({ search: 'abcdefghij' });
    expect(getStringParam(sp, 'search', { maxLength: 5 })).toBe('abcde');
  });

  it('retorna el valor por defecto cuando no existe', () => {
    const sp = new URLSearchParams();
    expect(getStringParam(sp, 'search', { defaultValue: 'all' })).toBe('all');
  });
});

// ─── getPaginationParams ────────────────────────────────────────────────────

describe('getPaginationParams', () => {
  it('retorna valores por defecto cuando no hay params', () => {
    const sp = new URLSearchParams();
    const result = getPaginationParams(sp);
    expect(result).toEqual({ page: 1, pageSize: 50, skip: 0 });
  });

  it('parsea page y pageSize correctamente', () => {
    const sp = new URLSearchParams({ page: '3', pageSize: '20' });
    const result = getPaginationParams(sp);
    expect(result).toEqual({ page: 3, pageSize: 20, skip: 40 });
  });

  it('aplica page mínimo de 1', () => {
    const sp = new URLSearchParams({ page: '0' });
    const result = getPaginationParams(sp);
    expect(result.page).toBe(1);
  });

  it('aplica page mínimo de 1 para negativos', () => {
    const sp = new URLSearchParams({ page: '-5' });
    const result = getPaginationParams(sp);
    expect(result.page).toBe(1);
  });

  it('aplica default para pageSize 0 (valor no válido)', () => {
    const sp = new URLSearchParams({ pageSize: '0' });
    const result = getPaginationParams(sp);
    // 0 es falsy, se usa el default (50)
    expect(result.pageSize).toBe(50);
  });

  it('aplica pageSize mínimo de 1 para negativos', () => {
    const sp = new URLSearchParams({ pageSize: '-5' });
    const result = getPaginationParams(sp);
    expect(result.pageSize).toBe(1);
  });

  it('aplica maxPageSize por defecto (100)', () => {
    const sp = new URLSearchParams({ pageSize: '500' });
    const result = getPaginationParams(sp);
    expect(result.pageSize).toBe(100);
  });

  it('usa opciones personalizadas', () => {
    const sp = new URLSearchParams({ page: '2', limit: '25' });
    const result = getPaginationParams(sp, {
      defaultPageSize: 25,
      maxPageSize: 200,
      pageSizeParam: 'limit',
    });
    expect(result).toEqual({ page: 2, pageSize: 25, skip: 25 });
  });

  it('calcula skip correctamente', () => {
    const sp = new URLSearchParams({ page: '5', pageSize: '10' });
    const result = getPaginationParams(sp);
    expect(result.skip).toBe(40);
  });

  it('maneja valores no numéricos con defaults', () => {
    const sp = new URLSearchParams({ page: 'abc', pageSize: 'xyz' });
    const result = getPaginationParams(sp);
    expect(result).toEqual({ page: 1, pageSize: 50, skip: 0 });
  });
});

// ─── validateQueryParams ────────────────────────────────────────────────────

describe('validateQueryParams', () => {
  const schema = z.object({
    companyId: z.coerce.number().int().positive(),
    status: z.enum(['PENDING', 'ACTIVE', 'CLOSED']).optional(),
    search: z.string().max(100).optional(),
  });

  it('retorna datos parseados cuando son válidos', () => {
    const sp = new URLSearchParams({ companyId: '5', status: 'PENDING' });
    const result = validateQueryParams(sp, schema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.companyId).toBe(5);
      expect(result.data.status).toBe('PENDING');
    }
  });

  it('retorna errores cuando la validación falla', () => {
    const sp = new URLSearchParams({ companyId: 'abc' });
    const result = validateQueryParams(sp, schema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it('maneja parámetros opcionales correctamente', () => {
    const sp = new URLSearchParams({ companyId: '1' });
    const result = validateQueryParams(sp, schema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.companyId).toBe(1);
      expect(result.data.status).toBeUndefined();
    }
  });

  it('retorna error para enum inválido', () => {
    const sp = new URLSearchParams({ companyId: '1', status: 'INVALID' });
    const result = validateQueryParams(sp, schema);
    expect(result.success).toBe(false);
  });
});
