/**
 * CUIT/CUIL/CDI Validator
 *
 * Validates Argentine tax identification numbers (CUIT, CUIL, CDI)
 * using the official check digit algorithm from AFIP.
 *
 * References:
 * - https://www.afip.gob.ar/genericos/guiaDeTramites/guia/documentos/PadronContribuyentesAFIP.pdf
 * - RG 1817/2005 AFIP
 */

/**
 * Validates a CUIT/CUIL/CDI number
 *
 * Format: XX-XXXXXXXX-X
 * - First 2 digits: Type (20-27 for CUIT, 23-24 for CUIL, 30-34 for companies)
 * - Next 8 digits: DNI or company number
 * - Last digit: Check digit (calculated with algorithm)
 *
 * @param cuit - CUIT/CUIL/CDI string (with or without dashes)
 * @returns Object with validation result and error message
 */
export function validateCUIT(cuit: string | null | undefined): {
  valid: boolean;
  formatted?: string;
  error?: string;
  details?: {
    type: string;
    checkDigit: number;
    calculatedCheckDigit: number;
  };
} {
  // Check if empty
  if (!cuit || cuit.trim() === '') {
    return { valid: false, error: 'CUIT no puede estar vacío' };
  }

  // Remove dashes and spaces
  const cleanCuit = cuit.replace(/[-\s]/g, '');

  // Check length (must be 11 digits)
  if (cleanCuit.length !== 11) {
    return {
      valid: false,
      error: `CUIT debe tener 11 dígitos (recibido: ${cleanCuit.length})`,
    };
  }

  // Check if all characters are numbers
  if (!/^\d+$/.test(cleanCuit)) {
    return {
      valid: false,
      error: 'CUIT debe contener solo números',
    };
  }

  // Extract parts
  const typeCode = parseInt(cleanCuit.substring(0, 2));
  const dniOrNumber = cleanCuit.substring(2, 10);
  const checkDigit = parseInt(cleanCuit.substring(10, 11));

  // Validate type code (20-27 for individuals, 30-34 for companies, 50-59 for special entities)
  const validTypeCodes = [
    20, 21, 22, 23, 24, 25, 26, 27, // Individuals (CUIT/CUIL)
    30, 31, 32, 33, 34,             // Companies/Entities
    50, 51, 55,                     // Public sector, foreign entities
  ];

  if (!validTypeCodes.includes(typeCode)) {
    return {
      valid: false,
      error: `Tipo de CUIT inválido (${typeCode}). Debe ser 20-27, 30-34, o 50-59`,
    };
  }

  // Calculate check digit using official AFIP algorithm
  const calculatedCheckDigit = calculateCheckDigit(cleanCuit.substring(0, 10));

  if (calculatedCheckDigit !== checkDigit) {
    return {
      valid: false,
      error: `Dígito verificador incorrecto. Esperado: ${calculatedCheckDigit}, recibido: ${checkDigit}`,
      details: {
        type: getTypeDescription(typeCode),
        checkDigit,
        calculatedCheckDigit,
      },
    };
  }

  // Format as XX-XXXXXXXX-X
  const formatted = `${cleanCuit.substring(0, 2)}-${cleanCuit.substring(2, 10)}-${cleanCuit.substring(10, 11)}`;

  return {
    valid: true,
    formatted,
    details: {
      type: getTypeDescription(typeCode),
      checkDigit,
      calculatedCheckDigit,
    },
  };
}

/**
 * Calculates check digit for a CUIT/CUIL (first 10 digits)
 *
 * Algorithm:
 * 1. Multiply each digit by the sequence [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
 * 2. Sum all products
 * 3. Calculate: 11 - (sum % 11)
 * 4. Special cases: if result is 11 → 0, if result is 10 → 9
 *
 * @param first10Digits - First 10 digits of CUIT
 * @returns Check digit (0-9)
 */
function calculateCheckDigit(first10Digits: string): number {
  const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(first10Digits[i]) * multipliers[i];
  }

  let checkDigit = 11 - (sum % 11);

  // Special cases
  if (checkDigit === 11) checkDigit = 0;
  if (checkDigit === 10) checkDigit = 9;

  return checkDigit;
}

/**
 * Returns human-readable description of CUIT type
 */
function getTypeDescription(typeCode: number): string {
  if (typeCode >= 20 && typeCode <= 27) {
    if (typeCode === 20 || typeCode === 27) return 'CUIT Persona Física (Masculino)';
    if (typeCode === 23 || typeCode === 24) return 'CUIL Empleado';
    if (typeCode === 25) return 'CUIT Fallecido';
    if (typeCode === 26) return 'CUIT Monotributista';
    return 'CUIT/CUIL Persona Física';
  }
  if (typeCode >= 30 && typeCode <= 34) {
    if (typeCode === 30) return 'CUIT Sociedad/Empresa';
    if (typeCode === 33) return 'CUIT Sociedad Extranjera';
    return 'CUIT Entidad Jurídica';
  }
  if (typeCode >= 50 && typeCode <= 59) {
    return 'CUIT Entidad Pública/Externa';
  }
  return 'CUIT Tipo Desconocido';
}

/**
 * Formats a CUIT string to XX-XXXXXXXX-X format
 *
 * @param cuit - CUIT string (with or without dashes)
 * @returns Formatted CUIT or original string if invalid
 */
export function formatCUIT(cuit: string | null | undefined): string {
  const validation = validateCUIT(cuit);
  return validation.formatted || (cuit || '');
}

/**
 * Checks if a CUIT belongs to a company (type 30-34)
 *
 * @param cuit - CUIT string
 * @returns true if company CUIT, false otherwise
 */
export function isCompanyCUIT(cuit: string | null | undefined): boolean {
  if (!cuit) return false;
  const cleanCuit = cuit.replace(/[-\s]/g, '');
  if (cleanCuit.length !== 11) return false;

  const typeCode = parseInt(cleanCuit.substring(0, 2));
  return typeCode >= 30 && typeCode <= 34;
}

/**
 * Checks if a CUIT belongs to an individual (type 20-27)
 *
 * @param cuit - CUIT string
 * @returns true if individual CUIT/CUIL, false otherwise
 */
export function isIndividualCUIT(cuit: string | null | undefined): boolean {
  if (!cuit) return false;
  const cleanCuit = cuit.replace(/[-\s]/g, '');
  if (cleanCuit.length !== 11) return false;

  const typeCode = parseInt(cleanCuit.substring(0, 2));
  return typeCode >= 20 && typeCode <= 27;
}

/**
 * Generates a valid CUIT from a DNI (for testing/development purposes only)
 *
 * IMPORTANT: This should NEVER be used in production for real users.
 * Real CUITs must be obtained from AFIP.
 *
 * @param dni - DNI number (7-8 digits)
 * @param gender - 'M' for male, 'F' for female
 * @returns Valid CUIT string in XX-XXXXXXXX-X format
 */
export function generateCUITFromDNI(dni: string | number, gender: 'M' | 'F' = 'M'): string {
  const dniStr = String(dni).padStart(8, '0');
  const typeCode = gender === 'M' ? '20' : '27';
  const first10 = typeCode + dniStr;
  const checkDigit = calculateCheckDigit(first10);

  return `${typeCode}-${dniStr}-${checkDigit}`;
}
