/**
 * Validaciones contables para facturas extraídas con IA
 * Detecta inconsistencias sin depender 100% de la IA
 */
import type { AIExtraction } from '@/lib/schemas/ai-extraction';

/**
 * Valida el dígito verificador de un CUIT argentino
 * Algoritmo: módulo 11 con multiplicadores 5,4,3,2,7,6,5,4,3,2
 */
export function validateCuitChecksum(cuit: string): { isValid: boolean; message?: string } {
  // Normalizar: quitar guiones y espacios
  const cleanCuit = cuit.replace(/[-\s]/g, '');

  if (!/^\d{11}$/.test(cleanCuit)) {
    return { isValid: false, message: `CUIT debe tener 11 dígitos (tiene ${cleanCuit.length})` };
  }

  // Multiplicadores para el algoritmo de módulo 11
  const multiplicadores = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const digitos = cleanCuit.split('').map(Number);
  const digitoVerificador = digitos[10];

  // Calcular suma ponderada
  let suma = 0;
  for (let i = 0; i < 10; i++) {
    suma += digitos[i] * multiplicadores[i];
  }

  // Calcular dígito verificador esperado
  const resto = suma % 11;
  const verificadorEsperado = resto === 0 ? 0 : resto === 1 ? 9 : 11 - resto;

  if (digitoVerificador !== verificadorEsperado) {
    return {
      isValid: false,
      message: `CUIT ${cuit} inválido: dígito verificador incorrecto (esperado: ${verificadorEsperado}, encontrado: ${digitoVerificador})`
    };
  }

  // Validar tipo de CUIT (primeros 2 dígitos)
  const tipoCuit = parseInt(cleanCuit.substring(0, 2));
  const tiposValidos = [20, 23, 24, 27, 30, 33, 34]; // Personas físicas y jurídicas
  if (!tiposValidos.includes(tipoCuit)) {
    return {
      isValid: false,
      message: `CUIT ${cuit}: tipo ${tipoCuit} no es común (válidos: 20,23,24,27,30,33,34)`
    };
  }

  return { isValid: true };
}

/**
 * Normaliza un CUIT para comparación (quita guiones)
 */
export function normalizeCuit(cuit: string): string {
  return cuit.replace(/[-\s]/g, '');
}

/**
 * Detecta si los datos del emisor/receptor pueden estar cruzados
 * Compara el CUIT del receptor extraído con el CUIT de la empresa
 */
export interface CrossDataValidation {
  isPotentiallyCrossed: boolean;
  warnings: string[];
  suggestion?: string;
}

export function detectCrossedData(
  extraction: AIExtraction,
  companyCuit?: string
): CrossDataValidation {
  const warnings: string[] = [];
  let isPotentiallyCrossed = false;
  let suggestion: string | undefined;

  const proveedorCuit = extraction.proveedor?.cuit ? normalizeCuit(extraction.proveedor.cuit) : '';
  const receptorCuit = extraction.receptor?.cuit ? normalizeCuit(extraction.receptor.cuit) : '';
  const companyNormalized = companyCuit ? normalizeCuit(companyCuit) : '';

  // Caso 1: El CUIT del proveedor coincide con el de la empresa (DEBERÍA ser el receptor)
  if (companyNormalized && proveedorCuit === companyNormalized) {
    warnings.push(`⚠️ POSIBLE ERROR: El CUIT del proveedor (${extraction.proveedor?.cuit}) coincide con tu empresa. Los datos pueden estar invertidos.`);
    isPotentiallyCrossed = true;
    suggestion = 'Revisar: el proveedor debería ser quien EMITE la factura, no tu empresa';
  }

  // Caso 2: El CUIT del receptor NO coincide con la empresa pero hay receptor
  if (companyNormalized && receptorCuit && receptorCuit !== companyNormalized) {
    // Esto podría indicar factura a nombre de otra empresa
    warnings.push(`⚠️ El CUIT del receptor (${extraction.receptor?.cuit}) no coincide con tu empresa (${companyCuit}).`);
  }

  // Caso 3: El receptor tiene un CUIT que parece de empresa (30-XX) y el proveedor de persona (20-XX)
  // En facturas de compra, generalmente el proveedor es empresa
  if (proveedorCuit.startsWith('20') && receptorCuit.startsWith('30')) {
    warnings.push(`⚠️ Verificar: El proveedor tiene CUIT de persona física (20-) y el receptor de empresa (30-). Esto es poco común en facturas de compra.`);
  }

  // Caso 4: Razones sociales sospechosas
  const proveedorRazon = extraction.proveedor?.razon_social?.toUpperCase() || '';
  const receptorRazon = extraction.receptor?.razon_social?.toUpperCase() || '';

  // Si la razón social del proveedor contiene palabras típicas de receptor
  if (proveedorRazon && (
    proveedorRazon.includes('SEÑOR') ||
    proveedorRazon.includes('SR.') ||
    proveedorRazon.includes('SEÑORA') ||
    proveedorRazon.includes('SRA.')
  )) {
    warnings.push(`⚠️ La razón social del proveedor "${extraction.proveedor?.razon_social}" parece ser de un cliente, no de un proveedor.`);
    isPotentiallyCrossed = true;
  }

  return { isPotentiallyCrossed, warnings, suggestion };
}

/**
 * Corrige errores comunes de OCR en strings numéricos
 * O → 0, l/I → 1, S → 5, B → 8, etc.
 */
export function correctOcrErrors(input: string): { corrected: string; hadErrors: boolean } {
  const original = input;
  let corrected = input
    // Letras que parecen números
    .replace(/[oO]/g, '0')
    .replace(/[lIi]/g, '1')
    .replace(/[sS]/g, '5')
    .replace(/[bB]/g, '8')
    .replace(/[gG]/g, '9')
    .replace(/[zZ]/g, '2')
    // Caracteres especiales que pueden confundirse
    .replace(/[.,]/g, '') // Quitar separadores de miles en CUITs
    .replace(/\s/g, '') // Quitar espacios
    // Guiones dobles
    .replace(/--+/g, '-');

  return {
    corrected,
    hadErrors: original !== corrected
  };
}

/**
 * Intenta corregir un CUIT con errores de OCR
 * Retorna el CUIT corregido si el checksum es válido, o null si no se pudo corregir
 */
export function tryCorrectCuit(cuit: string): { corrected: string | null; original: string; wasFixed: boolean } {
  const original = cuit;

  // Primero, normalizar quitando guiones
  let normalized = cuit.replace(/-/g, '');

  // Si tiene 11 dígitos y es válido, no hay que corregir
  if (/^\d{11}$/.test(normalized)) {
    const validation = validateCuitChecksum(normalized);
    if (validation.isValid) {
      // Formatear con guiones
      const formatted = `${normalized.slice(0, 2)}-${normalized.slice(2, 10)}-${normalized.slice(10)}`;
      return { corrected: formatted, original, wasFixed: false };
    }
  }

  // Intentar corregir errores OCR
  const { corrected } = correctOcrErrors(normalized);

  // Si después de corregir tiene 11 dígitos, verificar checksum
  if (/^\d{11}$/.test(corrected)) {
    const validation = validateCuitChecksum(corrected);
    if (validation.isValid) {
      const formatted = `${corrected.slice(0, 2)}-${corrected.slice(2, 10)}-${corrected.slice(10)}`;
      return { corrected: formatted, original, wasFixed: true };
    }
  }

  // No se pudo corregir
  return { corrected: null, original, wasFixed: false };
}

/**
 * Intenta corregir un número de CAE con errores de OCR
 * Un CAE válido tiene exactamente 14 dígitos
 */
export function tryCorrectCae(cae: string): { corrected: string | null; original: string; wasFixed: boolean } {
  const original = cae;

  // Si ya tiene 14 dígitos numéricos, está bien
  if (/^\d{14}$/.test(cae)) {
    return { corrected: cae, original, wasFixed: false };
  }

  // Intentar corregir errores OCR
  const { corrected } = correctOcrErrors(cae);

  if (/^\d{14}$/.test(corrected)) {
    return { corrected, original, wasFixed: true };
  }

  return { corrected: null, original, wasFixed: false };
}

export interface AccountingValidation {
  isValid: boolean;
  warnings: string[];
  calculatedTotal: number;
  difference: number;
  details: {
    netoGravado: number;
    netoNoGravado: number;
    exento: number;
    iva: number;
    percepciones: number;
    otros: number;
  };
}

/**
 * Valida la consistencia contable de una extracción
 * Reglas:
 * 1. Total ≈ suma de componentes (tolerancia $1)
 * 2. Punto de venta: 4-5 dígitos
 * 3. Número comprobante: 8 dígitos
 * 4. CAE: 14 dígitos
 */
export function validateAccounting(extraction: AIExtraction): AccountingValidation {
  const warnings: string[] = [];

  // Calcular componentes
  const netoGravado = extraction.subtotal_neto_gravado || 0;
  const netoNoGravado = extraction.subtotal_neto_no_gravado || 0;
  const exento = extraction.subtotal_exento || 0;
  const iva = (extraction.iva_21 || 0) + (extraction.iva_10_5 || 0) + (extraction.iva_27 || 0);
  const percepciones = (extraction.percepciones_iva || 0) + (extraction.percepciones_iibb || 0);
  const otros = extraction.otros_impuestos || 0;

  const calculatedTotal = netoGravado + netoNoGravado + exento + iva + percepciones + otros;
  const difference = Math.abs(extraction.total - calculatedTotal);

  // Regla 1: Total = suma de componentes (tolerancia $1)
  if (difference > 1) {
    warnings.push(
      `Total no coincide: extraído $${extraction.total.toFixed(2)}, calculado $${calculatedTotal.toFixed(2)} (diferencia: $${difference.toFixed(2)})`
    );
  }

  // Regla 2: Punto de venta = 4-5 dígitos
  const puntoVenta = extraction.punto_venta || '';
  if (puntoVenta && !/^\d{4,5}$/.test(puntoVenta.replace(/^0+/, '') || puntoVenta)) {
    // Permitir con ceros a la izquierda
    if (!/^\d{4,5}$/.test(puntoVenta)) {
      warnings.push(`Punto de venta con formato inválido: "${puntoVenta}" (esperado: 4-5 dígitos)`);
    }
  }

  // Regla 3: Número comprobante = 8 dígitos (con flexibilidad)
  const numeroComprobante = extraction.numero_comprobante || '';
  if (numeroComprobante && !/^\d{1,8}$/.test(numeroComprobante)) {
    warnings.push(`Número de comprobante con formato inválido: "${numeroComprobante}" (esperado: hasta 8 dígitos)`);
  }

  // Regla 4: CAE = 14 dígitos
  if (extraction.cae && !/^\d{14}$/.test(extraction.cae)) {
    warnings.push(`CAE con formato inválido: "${extraction.cae}" (esperado: 14 dígitos)`);
  }

  // Regla 5: Fecha de emisión válida
  if (extraction.fecha_emision) {
    const fecha = new Date(extraction.fecha_emision);
    if (isNaN(fecha.getTime())) {
      warnings.push(`Fecha de emisión inválida: "${extraction.fecha_emision}"`);
    }
  } else {
    warnings.push('Fecha de emisión no detectada');
  }

  // Regla 6: Total > 0 (para facturas normales)
  if (extraction.total <= 0) {
    const tipo = (extraction.tipo_comprobante || '').toUpperCase();
    // Solo warning si no es NC (las NC pueden ser negativas conceptualmente pero se guardan positivas)
    if (!tipo.includes('CREDITO')) {
      warnings.push(`Total debe ser mayor a 0: $${extraction.total}`);
    }
  }

  // Regla 7: Si hay IVA, debería haber neto gravado
  if (iva > 0 && netoGravado === 0) {
    warnings.push('Se detectó IVA pero no hay neto gravado');
  }

  // Regla 8: Validar fecha vencimiento CAE (si existe)
  if (extraction.cae && extraction.fecha_vencimiento_cae) {
    const fechaVtoCae = new Date(extraction.fecha_vencimiento_cae);
    if (!isNaN(fechaVtoCae.getTime())) {
      const hoy = new Date();
      if (fechaVtoCae < hoy) {
        warnings.push(`CAE vencido: ${extraction.fecha_vencimiento_cae}`);
      }
    }
  }

  // Regla 9: Validar CUIT del proveedor (dígito verificador)
  if (extraction.proveedor?.cuit) {
    const cuitValidation = validateCuitChecksum(extraction.proveedor.cuit);
    if (!cuitValidation.isValid && cuitValidation.message) {
      warnings.push(cuitValidation.message);
    }
  }

  // Regla 10: Validar CUIT del receptor si existe
  if (extraction.receptor?.cuit) {
    const cuitValidation = validateCuitChecksum(extraction.receptor.cuit);
    if (!cuitValidation.isValid && cuitValidation.message) {
      warnings.push(`Receptor: ${cuitValidation.message}`);
    }
  }

  // Regla 11: Verificar que punto de venta no tenga caracteres raros
  if (puntoVenta && /[^0-9]/.test(puntoVenta)) {
    warnings.push(`Punto de venta contiene caracteres no numéricos: "${puntoVenta}"`);
  }

  // Regla 12: Verificar que número de comprobante no tenga caracteres raros
  if (numeroComprobante && /[^0-9]/.test(numeroComprobante)) {
    warnings.push(`Número de comprobante contiene caracteres no numéricos: "${numeroComprobante}"`);
  }

  // Regla 13: Verificar consistencia de IVA 21%
  if (extraction.iva_21 && netoGravado > 0) {
    const ivaEsperado = netoGravado * 0.21;
    const diferenciaIva = Math.abs(extraction.iva_21 - ivaEsperado);
    // Tolerancia del 2% del IVA esperado
    if (diferenciaIva > ivaEsperado * 0.02 && diferenciaIva > 1) {
      warnings.push(
        `IVA 21% parece incorrecto: extraído $${extraction.iva_21.toFixed(2)}, esperado ~$${ivaEsperado.toFixed(2)} (21% de $${netoGravado.toFixed(2)})`
      );
    }
  }

  return {
    isValid: warnings.length === 0,
    warnings,
    calculatedTotal,
    difference,
    details: {
      netoGravado,
      netoNoGravado,
      exento,
      iva,
      percepciones,
      otros
    }
  };
}

/**
 * Valida que los campos críticos estén presentes
 */
export function validateRequiredFields(extraction: AIExtraction): string[] {
  const missing: string[] = [];

  if (!extraction.proveedor?.cuit) missing.push('CUIT del proveedor');
  if (!extraction.proveedor?.razon_social) missing.push('Razón social del proveedor');
  if (!extraction.punto_venta) missing.push('Punto de venta');
  if (!extraction.numero_comprobante) missing.push('Número de comprobante');
  if (!extraction.fecha_emision) missing.push('Fecha de emisión');
  if (extraction.total === undefined || extraction.total === null) missing.push('Total');

  return missing;
}

/**
 * Calcula un score de confianza basado en validaciones
 */
export function calculateConfidenceScore(
  extraction: AIExtraction,
  accountingValidation: AccountingValidation
): number {
  let score = extraction.confianza || 0.5;

  // Penalizar por warnings contables
  const warningPenalty = accountingValidation.warnings.length * 0.1;
  score -= warningPenalty;

  // Penalizar por campos faltantes
  const missingFields = validateRequiredFields(extraction);
  const fieldPenalty = missingFields.length * 0.15;
  score -= fieldPenalty;

  // Bonus si tiene CAE válido
  if (extraction.cae && /^\d{14}$/.test(extraction.cae)) {
    score += 0.1;
  }

  // Asegurar rango 0-1
  return Math.max(0, Math.min(1, score));
}
