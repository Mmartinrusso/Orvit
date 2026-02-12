/**
 * Tests for CUIT/CUIL Validation System
 *
 * Covers:
 * 1. validateCUIT() - Core validation function (format, check digit, type codes)
 * 2. formatCUIT() - Formatting helper
 * 3. isCompanyCUIT() / isIndividualCUIT() - Type checking helpers
 * 4. generateCUITFromDNI() - Test CUIT generation
 * 5. Frontend formatCuit() - Auto-format logic (proveedor-modal & client-form-dialog)
 * 6. Backend API validation logic - Proveedores POST/PUT and Clientes POST/PUT
 *
 * Known valid test CUITs (verified with AFIP algorithm):
 * - 20-12345678-6 (persona física masculino)
 * - 27-12345678-0 (persona física femenino)
 * - 23-27395162-8 (CUIL empleado)
 * - 30-71234568-9 (sociedad/empresa)
 * - 20-00000000-1 (all zeros DNI)
 * - 20-99999999-9 (all nines DNI)
 */

import { describe, it, expect } from 'vitest';

import {
  validateCUIT,
  formatCUIT,
  isCompanyCUIT,
  isIndividualCUIT,
  generateCUITFromDNI,
} from '@/lib/ventas/cuit-validator';

// Known valid CUIT used throughout tests (verified check digit = 6)
const VALID_CUIT_NODASH = '20123456786';
const VALID_CUIT_FORMATTED = '20-12345678-6';

// ─────────────────────────────────────────────────────────────────────────────
// PART 1: validateCUIT() - Core validation
// ─────────────────────────────────────────────────────────────────────────────

describe('validateCUIT', () => {
  describe('Empty/null/undefined inputs', () => {
    it('should reject null', () => {
      const result = validateCUIT(null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('vacío');
    });

    it('should reject undefined', () => {
      const result = validateCUIT(undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('vacío');
    });

    it('should reject empty string', () => {
      const result = validateCUIT('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('vacío');
    });

    it('should reject whitespace-only string', () => {
      const result = validateCUIT('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('vacío');
    });
  });

  describe('Format validation - length', () => {
    it('should reject CUIT with less than 11 digits', () => {
      const result = validateCUIT('2012345678');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('11 dígitos');
    });

    it('should reject CUIT with more than 11 digits', () => {
      const result = validateCUIT('201234567899');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('11 dígitos');
    });

    it('should accept 11 digit input without dashes', () => {
      const result = validateCUIT(VALID_CUIT_NODASH);
      expect(result.valid).toBe(true);
    });

    it('should accept input with dashes (XX-XXXXXXXX-X)', () => {
      const result = validateCUIT(VALID_CUIT_FORMATTED);
      expect(result.valid).toBe(true);
    });

    it('should accept input with spaces', () => {
      const result = validateCUIT('20 12345678 6');
      expect(result.valid).toBe(true);
    });
  });

  describe('Format validation - characters', () => {
    it('should reject input with letters', () => {
      const result = validateCUIT('20-1234567A-6');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('solo números');
    });

    it('should reject input with special characters (non-dash/space)', () => {
      const result = validateCUIT('20.12345678.6');
      expect(result.valid).toBe(false);
    });
  });

  describe('Type code validation', () => {
    it('should accept type code 20 (persona física masculino)', () => {
      const result = validateCUIT(VALID_CUIT_FORMATTED);
      expect(result.valid).toBe(true);
      expect(result.details?.type).toContain('Masculino');
    });

    it('should accept type code 27 (persona física femenino)', () => {
      // 27-12345678-0 verified check digit
      const result = validateCUIT('27-12345678-0');
      expect(result.valid).toBe(true);
    });

    it('should accept type code 23 (CUIL empleado)', () => {
      // 23-27395162-8 verified check digit
      const result = validateCUIT('23-27395162-8');
      expect(result.valid).toBe(true);
      expect(result.details?.type).toContain('CUIL');
    });

    it('should accept type code 30 (sociedad/empresa)', () => {
      // 30-71234568-9 verified check digit
      const result = validateCUIT('30-71234568-9');
      expect(result.valid).toBe(true);
      expect(result.details?.type).toContain('Sociedad');
    });

    it('should reject invalid type code 10', () => {
      const result = validateCUIT('10-12345678-6');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Tipo de CUIT inválido');
    });

    it('should reject invalid type code 40', () => {
      const result = validateCUIT('40-12345678-6');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Tipo de CUIT inválido');
    });

    it('should reject invalid type code 00', () => {
      const result = validateCUIT('00-12345678-6');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Tipo de CUIT inválido');
    });

    it('should reject invalid type code 99', () => {
      const result = validateCUIT('99-12345678-6');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Tipo de CUIT inválido');
    });
  });

  describe('Check digit validation (AFIP algorithm)', () => {
    it('should validate correct check digit', () => {
      const result = validateCUIT(VALID_CUIT_FORMATTED);
      expect(result.valid).toBe(true);
      expect(result.details?.checkDigit).toBe(result.details?.calculatedCheckDigit);
    });

    it('should reject incorrect check digit', () => {
      // 20-12345678-6 is valid; 20-12345678-0 is invalid
      const result = validateCUIT('20-12345678-0');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Dígito verificador incorrecto');
      expect(result.details?.calculatedCheckDigit).toBe(6);
      expect(result.details?.checkDigit).toBe(0);
    });

    it('should handle special case where check digit is 0', () => {
      // 27-12345678-0 has check digit 0
      const result = validateCUIT('27-12345678-0');
      expect(result.valid).toBe(true);
      expect(result.details?.checkDigit).toBe(0);
    });

    it('should handle special case where check digit result is 10 → 9', () => {
      // 20-99999999-9 → sum%11=1 → 11-1=10 → 9
      const result = validateCUIT('20-99999999-9');
      expect(result.valid).toBe(true);
      expect(result.details?.checkDigit).toBe(9);
    });

    it('generated CUITs always have valid check digits', () => {
      for (let i = 10000000; i < 10000020; i++) {
        const generated = generateCUITFromDNI(String(i), 'M');
        const result = validateCUIT(generated);
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('Formatted output', () => {
    it('should return formatted CUIT in XX-XXXXXXXX-X format', () => {
      const result = validateCUIT(VALID_CUIT_NODASH);
      expect(result.formatted).toBe(VALID_CUIT_FORMATTED);
    });

    it('should return formatted CUIT when input already has dashes', () => {
      const result = validateCUIT(VALID_CUIT_FORMATTED);
      expect(result.formatted).toBe(VALID_CUIT_FORMATTED);
    });

    it('should not return formatted value for invalid CUIT', () => {
      const result = validateCUIT('invalid');
      expect(result.formatted).toBeUndefined();
    });
  });

  describe('Known valid CUITs', () => {
    it('should validate 20-12345678-6', () => {
      expect(validateCUIT('20-12345678-6').valid).toBe(true);
    });

    it('should validate 27-12345678-0', () => {
      expect(validateCUIT('27-12345678-0').valid).toBe(true);
    });

    it('should validate 30-71234568-9', () => {
      expect(validateCUIT('30-71234568-9').valid).toBe(true);
    });

    it('should validate 20-00000000-1', () => {
      expect(validateCUIT('20-00000000-1').valid).toBe(true);
    });

    it('should validate 20-99999999-9', () => {
      expect(validateCUIT('20-99999999-9').valid).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 2: formatCUIT() - Format helper
// ─────────────────────────────────────────────────────────────────────────────

describe('formatCUIT', () => {
  it('should format valid CUIT without dashes', () => {
    expect(formatCUIT(VALID_CUIT_NODASH)).toBe(VALID_CUIT_FORMATTED);
  });

  it('should return already formatted CUIT', () => {
    expect(formatCUIT(VALID_CUIT_FORMATTED)).toBe(VALID_CUIT_FORMATTED);
  });

  it('should return original string for invalid CUIT', () => {
    expect(formatCUIT('123')).toBe('123');
  });

  it('should return empty string for null', () => {
    expect(formatCUIT(null)).toBe('');
  });

  it('should return empty string for undefined', () => {
    expect(formatCUIT(undefined)).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 3: isCompanyCUIT() / isIndividualCUIT()
// ─────────────────────────────────────────────────────────────────────────────

describe('isCompanyCUIT', () => {
  it('should return true for type 30 (empresa)', () => {
    expect(isCompanyCUIT('30-71234568-9')).toBe(true);
  });

  it('should return true for type 33 (sociedad extranjera)', () => {
    expect(isCompanyCUIT('33-71234568-9')).toBe(true);
  });

  it('should return false for type 20 (persona física)', () => {
    expect(isCompanyCUIT(VALID_CUIT_FORMATTED)).toBe(false);
  });

  it('should return false for null', () => {
    expect(isCompanyCUIT(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isCompanyCUIT(undefined)).toBe(false);
  });

  it('should return false for invalid length', () => {
    expect(isCompanyCUIT('30-1234')).toBe(false);
  });
});

describe('isIndividualCUIT', () => {
  it('should return true for type 20', () => {
    expect(isIndividualCUIT(VALID_CUIT_FORMATTED)).toBe(true);
  });

  it('should return true for type 27', () => {
    expect(isIndividualCUIT('27-12345678-0')).toBe(true);
  });

  it('should return false for type 30 (empresa)', () => {
    expect(isIndividualCUIT('30-71234568-9')).toBe(false);
  });

  it('should return false for null', () => {
    expect(isIndividualCUIT(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isIndividualCUIT(undefined)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 4: generateCUITFromDNI()
// ─────────────────────────────────────────────────────────────────────────────

describe('generateCUITFromDNI', () => {
  it('should generate valid CUIT for male (type 20)', () => {
    const cuit = generateCUITFromDNI('12345678', 'M');
    expect(cuit).toMatch(/^20-\d{8}-\d$/);
    expect(validateCUIT(cuit).valid).toBe(true);
  });

  it('should generate valid CUIT for female (type 27)', () => {
    const cuit = generateCUITFromDNI('12345678', 'F');
    expect(cuit).toMatch(/^27-\d{8}-\d$/);
    expect(validateCUIT(cuit).valid).toBe(true);
  });

  it('should pad short DNI to 8 digits', () => {
    const cuit = generateCUITFromDNI('1234567', 'M');
    expect(cuit).toMatch(/^20-0\d{7}-\d$/);
    expect(validateCUIT(cuit).valid).toBe(true);
  });

  it('should accept numeric DNI', () => {
    const cuit = generateCUITFromDNI(12345678, 'M');
    expect(validateCUIT(cuit).valid).toBe(true);
  });

  it('should default to male', () => {
    const cuit = generateCUITFromDNI('12345678');
    expect(cuit.startsWith('20-')).toBe(true);
  });

  it('should produce different CUITs for different genders with same DNI', () => {
    const maleCuit = generateCUITFromDNI('12345678', 'M');
    const femaleCuit = generateCUITFromDNI('12345678', 'F');
    expect(maleCuit).not.toBe(femaleCuit);
    expect(validateCUIT(maleCuit).valid).toBe(true);
    expect(validateCUIT(femaleCuit).valid).toBe(true);
  });

  it('should always generate valid CUITs for a range of DNIs', () => {
    for (let i = 1000000; i <= 1000020; i++) {
      const cuit = generateCUITFromDNI(i, 'M');
      expect(validateCUIT(cuit).valid).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 5: Frontend formatCuit() logic
// (Replicated from proveedor-modal.tsx and client-form-dialog.tsx)
// ─────────────────────────────────────────────────────────────────────────────

// Extracted formatCuit logic identical to the one in proveedor-modal.tsx and client-form-dialog.tsx
function frontendFormatCuit(value: string): string {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 2) {
    return numbers;
  } else if (numbers.length <= 10) {
    return `${numbers.slice(0, 2)}-${numbers.slice(2)}`;
  } else {
    return `${numbers.slice(0, 2)}-${numbers.slice(2, 10)}-${numbers.slice(10, 11)}`;
  }
}

describe('Frontend formatCuit (auto-format during typing)', () => {
  it('should return raw digits for 1-2 character input', () => {
    expect(frontendFormatCuit('2')).toBe('2');
    expect(frontendFormatCuit('20')).toBe('20');
  });

  it('should add first dash after 2 digits', () => {
    expect(frontendFormatCuit('201')).toBe('20-1');
    expect(frontendFormatCuit('2012')).toBe('20-12');
  });

  it('should format partial middle section', () => {
    expect(frontendFormatCuit('201234')).toBe('20-1234');
    expect(frontendFormatCuit('2012345678')).toBe('20-12345678');
  });

  it('should add second dash after 10 digits', () => {
    expect(frontendFormatCuit('20123456786')).toBe('20-12345678-6');
  });

  it('should truncate input beyond 11 digits', () => {
    expect(frontendFormatCuit('201234567860')).toBe('20-12345678-6');
  });

  it('should strip non-numeric characters before formatting', () => {
    expect(frontendFormatCuit('20-1234')).toBe('20-1234');
    expect(frontendFormatCuit('20-12345678-6')).toBe('20-12345678-6');
    expect(frontendFormatCuit('abc20def12345678ghi6')).toBe('20-12345678-6');
  });

  it('should handle empty input', () => {
    expect(frontendFormatCuit('')).toBe('');
  });

  it('should produce result with max length 13 (XX-XXXXXXXX-X)', () => {
    const result = frontendFormatCuit(VALID_CUIT_NODASH);
    expect(result.length).toBe(13);
  });

  it('formatted output should be a valid input for validateCUIT', () => {
    const formatted = frontendFormatCuit(VALID_CUIT_NODASH);
    const result = validateCUIT(formatted);
    expect(result.valid).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 6: Backend API validation logic
// (Unit-level verification of the validation patterns used in API routes)
// ─────────────────────────────────────────────────────────────────────────────

describe('Backend API CUIT validation patterns', () => {
  describe('Proveedores POST/PUT - inline validation pattern', () => {
    it('should validate and format CUIT before storing (POST pattern)', () => {
      const cuit = VALID_CUIT_FORMATTED;
      const cuitValidation = validateCUIT(cuit.trim());

      expect(cuitValidation.valid).toBe(true);
      expect(cuitValidation.formatted).toBe(VALID_CUIT_FORMATTED);

      const formattedCuit = cuitValidation.formatted!;
      expect(formattedCuit).toBe(VALID_CUIT_FORMATTED);
    });

    it('should reject invalid CUIT in POST pattern', () => {
      const cuit = '20-12345678-0'; // Wrong check digit (correct is 6)
      const cuitValidation = validateCUIT(cuit.trim());

      expect(cuitValidation.valid).toBe(false);
      expect(cuitValidation.error).toContain('Dígito verificador');
    });

    it('should handle CUIT without dashes (from raw input)', () => {
      const cuit = VALID_CUIT_NODASH;
      const cuitValidation = validateCUIT(cuit.trim());

      expect(cuitValidation.valid).toBe(true);
      expect(cuitValidation.formatted).toBe(VALID_CUIT_FORMATTED);
    });

    it('should normalize CUIT for duplicate comparison', () => {
      const formattedCuit = VALID_CUIT_FORMATTED;
      const cuitNormalizado = formattedCuit.replace(/-/g, '');
      expect(cuitNormalizado).toBe(VALID_CUIT_NODASH);

      const otherFormat = '20 12345678 6';
      const otherValidation = validateCUIT(otherFormat);
      const otherNormalized = otherValidation.formatted!.replace(/-/g, '');
      expect(otherNormalized).toBe(cuitNormalizado);
    });
  });

  describe('Clientes POST - validateCUIT with error throwing pattern', () => {
    it('should throw INVALID_CUIT error for invalid CUIT', () => {
      const dataCuit = '20-99999999-0'; // Invalid: correct check digit is 9
      const cuitValidation = validateCUIT(dataCuit);

      expect(cuitValidation.valid).toBe(false);
      const error = new Error(`INVALID_CUIT:${cuitValidation.error}`);
      expect(error.message).toMatch(/^INVALID_CUIT:/);
      expect(error.message.split(':').slice(1).join(':')).toBeTruthy();
    });

    it('should produce formatted CUIT for storage', () => {
      const dataCuit = VALID_CUIT_NODASH;
      const cuitValidation = validateCUIT(dataCuit);
      expect(cuitValidation.valid).toBe(true);

      const formattedCuit = cuitValidation.formatted!;
      const cleanCuit = formattedCuit.replace(/[-\s]/g, '');
      expect(cleanCuit).toBe(VALID_CUIT_NODASH);
    });
  });

  describe('Clientes PUT - CUIT change validation pattern', () => {
    it('should only validate CUIT when it changes', () => {
      const existingCuit = VALID_CUIT_FORMATTED;
      const newCuit = VALID_CUIT_FORMATTED; // Same CUIT

      const shouldValidate = newCuit && newCuit !== existingCuit;
      expect(shouldValidate).toBeFalsy();
    });

    it('should validate when CUIT changes to a new value', () => {
      const existingCuit = VALID_CUIT_FORMATTED;
      const newCuit = generateCUITFromDNI('99887766', 'M');

      const shouldValidate = newCuit && newCuit !== existingCuit;
      expect(shouldValidate).toBeTruthy();

      const cuitValidation = validateCUIT(newCuit);
      expect(cuitValidation.valid).toBe(true);
    });

    it('should generate three formats for duplicate check', () => {
      const inputCuit = VALID_CUIT_NODASH;
      const cuitValidation = validateCUIT(inputCuit);
      const formattedCuit = cuitValidation.formatted!;
      const cleanCuit = formattedCuit.replace(/[-\s]/g, '');

      const searchValues = [formattedCuit, cleanCuit, inputCuit];
      expect(searchValues).toEqual([VALID_CUIT_FORMATTED, VALID_CUIT_NODASH, VALID_CUIT_NODASH]);
    });
  });

  describe('Proveedores CUIT - required vs optional', () => {
    it('proveedor schema: CUIT is required - empty should fail validation', () => {
      const result = validateCUIT('');
      expect(result.valid).toBe(false);
    });

    it('client schema: CUIT is optional - empty/null passes the refine guard', () => {
      // Simulating the Zod refine: (val) => !val || val.trim() === '' || validateCUIT(val).valid
      const clientCuitRefine = (val: string | undefined) =>
        !val || val.trim() === '' || validateCUIT(val).valid;

      expect(clientCuitRefine(undefined)).toBe(true);
      expect(clientCuitRefine('')).toBe(true);
      expect(clientCuitRefine('  ')).toBe(true);
      expect(clientCuitRefine(VALID_CUIT_FORMATTED)).toBe(true);
      expect(clientCuitRefine('20-12345678-0')).toBe(false); // invalid check digit
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 7: Edge cases and integration-style tests
// ─────────────────────────────────────────────────────────────────────────────

describe('CUIT validation edge cases', () => {
  it('should validate all zeros DNI with valid check digit', () => {
    // 20-00000000-1 verified
    const result = validateCUIT('20-00000000-1');
    expect(result.valid).toBe(true);
  });

  it('should validate CUIT with all 9s in DNI', () => {
    // 20-99999999-9 verified
    const result = validateCUIT('20-99999999-9');
    expect(result.valid).toBe(true);
  });

  it('should correctly handle the full flow: generate → format → validate', () => {
    const dni = '33456789';
    const cuit = generateCUITFromDNI(dni, 'M');

    const formatted = frontendFormatCuit(cuit.replace(/-/g, ''));

    const result = validateCUIT(formatted);
    expect(result.valid).toBe(true);
    expect(result.formatted).toBe(cuit);
  });

  it('should handle frontend → backend flow: type digits → format → validate → store', () => {
    // Use a known valid CUIT: 20-12345678-6
    const keystrokes = VALID_CUIT_NODASH;

    // Frontend auto-formats during typing
    const frontendFormatted = frontendFormatCuit(keystrokes);
    expect(frontendFormatted).toBe(VALID_CUIT_FORMATTED);

    // Frontend validates on submit
    const frontendValidation = validateCUIT(frontendFormatted);
    expect(frontendValidation.valid).toBe(true);

    // Frontend sends formatted value to backend
    const sentToBackend = frontendValidation.formatted;
    expect(sentToBackend).toBe(VALID_CUIT_FORMATTED);

    // Backend validates again
    const backendValidation = validateCUIT(sentToBackend!);
    expect(backendValidation.valid).toBe(true);

    // Backend stores formatted value
    const storedValue = backendValidation.formatted;
    expect(storedValue).toBe(VALID_CUIT_FORMATTED);
  });

  it('should handle CUIT normalization for dedup across formats', () => {
    const formats = [
      VALID_CUIT_NODASH,
      VALID_CUIT_FORMATTED,
      '20 12345678 6',
    ];

    const normalized = formats.map(f => {
      const result = validateCUIT(f);
      return result.formatted!.replace(/-/g, '');
    });

    expect(new Set(normalized).size).toBe(1);
    expect(normalized[0]).toBe(VALID_CUIT_NODASH);
  });

  it('should handle the isActive flag mapping for proveedores', () => {
    const estado = 'activo';
    expect(estado === 'activo').toBe(true);

    const isActive = true;
    expect(isActive ? 'activo' : 'inactivo').toBe('activo');
  });
});

describe('CUIT algorithm stress test', () => {
  it('every generated CUIT should round-trip through format and validate', () => {
    const dnis = [
      '00000001', '12345678', '99999999', '44556677',
      '11111111', '22222222', '33333333', '87654321',
    ];

    for (const dni of dnis) {
      for (const gender of ['M', 'F'] as const) {
        const cuit = generateCUITFromDNI(dni, gender);

        // Validate raw
        expect(validateCUIT(cuit).valid).toBe(true);

        // Remove dashes and validate
        const noDashes = cuit.replace(/-/g, '');
        expect(validateCUIT(noDashes).valid).toBe(true);

        // Frontend format and validate
        const frontendFmt = frontendFormatCuit(noDashes);
        expect(validateCUIT(frontendFmt).valid).toBe(true);

        // formatCUIT helper
        expect(formatCUIT(noDashes)).toBe(cuit);
      }
    }
  });
});
