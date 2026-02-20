/**
 * OEE Calculator — Eficiencia Global del Equipo
 * OEE = Disponibilidad × Eficiencia × Calidad
 *
 * Benchmarks estándar (ISO 22400):
 *  - OEE ≥ 85%: Clase mundial
 *  - OEE 65–85%: Aceptable
 *  - OEE < 65%: Bajo
 */

export interface OEEInput {
  shiftDurationMinutes: number;
  downtimeMinutes: number;
  setupMinutes: number;
  productiveMinutes: number;
  goodQuantity: number;
  scrapQuantity: number;
  reworkQuantity: number;
  /** Tiempo de ciclo estándar en segundos por unidad (de WorkCenter) */
  standardCycleSeconds?: number | null;
}

export interface OEEResult {
  /** Disponibilidad: (TurnoMinutos - Paradas) / TurnoMinutos × 100 */
  availability: number;
  /** Eficiencia: (Producción Real × CicloStd) / TiempoProductivo × 100 — null si no hay ciclo configurado */
  performance: number | null;
  /** Calidad: Buenas / Total × 100 */
  quality: number;
  /** OEE completo: A × P × Q — null si performance es null */
  oee: number | null;
  /** OEE parcial: A × Q (siempre calculable, sin ciclo de referencia) */
  oeePartial: number;
}

export type OEEStatus = 'good' | 'acceptable' | 'poor';

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Calcula OEE a partir de los datos de un reporte de producción
 */
export function calculateOEE(input: OEEInput): OEEResult {
  const {
    shiftDurationMinutes,
    downtimeMinutes,
    goodQuantity,
    scrapQuantity,
    reworkQuantity,
    productiveMinutes,
    standardCycleSeconds,
  } = input;

  // Disponibilidad: (Turno - Paradas) / Turno
  const availability = shiftDurationMinutes > 0
    ? Math.min(100, ((shiftDurationMinutes - downtimeMinutes) / shiftDurationMinutes) * 100)
    : 0;

  // Calidad: Buenas / Total (sin producción → sin pérdidas de calidad)
  const totalOutput = goodQuantity + scrapQuantity + reworkQuantity;
  const quality = totalOutput > 0
    ? (goodQuantity / totalOutput) * 100
    : 100;

  // Eficiencia: solo si hay standardCycleSeconds configurado
  let performance: number | null = null;
  if (standardCycleSeconds && standardCycleSeconds > 0 && productiveMinutes > 0) {
    const productiveSeconds = productiveMinutes * 60;
    const theoreticalOutput = productiveSeconds / standardCycleSeconds;
    if (theoreticalOutput > 0) {
      performance = Math.min(100, (totalOutput / theoreticalOutput) * 100);
    }
  }

  const oeePartial = round1((availability / 100) * (quality / 100) * 100);
  const oee = performance !== null
    ? round1((availability / 100) * (performance / 100) * (quality / 100) * 100)
    : null;

  return {
    availability: round1(availability),
    performance: performance !== null ? round1(performance) : null,
    quality: round1(quality),
    oee,
    oeePartial,
  };
}

/**
 * Devuelve el estado del OEE según benchmarks industriales
 */
export function getOEEStatus(oee: number): OEEStatus {
  if (oee >= 85) return 'good';
  if (oee >= 65) return 'acceptable';
  return 'poor';
}

/**
 * Agrega múltiples reportes en un solo resultado OEE sumando las cantidades
 * (más preciso que promediar los OEEs individuales)
 */
export function aggregateOEE(inputs: OEEInput[]): OEEResult {
  if (inputs.length === 0) {
    return { availability: 0, performance: null, quality: 100, oee: null, oeePartial: 0 };
  }

  const totals = inputs.reduce(
    (acc, input) => ({
      shiftDurationMinutes: acc.shiftDurationMinutes + input.shiftDurationMinutes,
      downtimeMinutes: acc.downtimeMinutes + input.downtimeMinutes,
      setupMinutes: acc.setupMinutes + input.setupMinutes,
      productiveMinutes: acc.productiveMinutes + input.productiveMinutes,
      goodQuantity: acc.goodQuantity + input.goodQuantity,
      scrapQuantity: acc.scrapQuantity + input.scrapQuantity,
      reworkQuantity: acc.reworkQuantity + input.reworkQuantity,
    }),
    {
      shiftDurationMinutes: 0, downtimeMinutes: 0, setupMinutes: 0,
      productiveMinutes: 0, goodQuantity: 0, scrapQuantity: 0, reworkQuantity: 0,
    }
  );

  // standardCycleSeconds solo aplica si todos los reportes tienen el mismo valor
  const cycleTimes = inputs
    .map(i => i.standardCycleSeconds)
    .filter((v): v is number => v != null && v > 0);
  const uniqueCycleTimes = new Set(cycleTimes);
  const standardCycleSeconds = uniqueCycleTimes.size === 1
    ? [...uniqueCycleTimes][0]
    : null;

  return calculateOEE({ ...totals, standardCycleSeconds });
}
