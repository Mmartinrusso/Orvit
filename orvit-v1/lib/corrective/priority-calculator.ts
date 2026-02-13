/**
 * Calcula la prioridad automática de una falla basado en:
 * - Criticidad del activo (40%)
 * - Downtime (30%)
 * - Seguridad (25%)
 * - Otros factores (5%)
 *
 * Retorna: P1 | P2 | P3 | P4
 */

import { AssetCriticality } from '@prisma/client';

export type Priority = 'P1' | 'P2' | 'P3' | 'P4';

export interface PriorityCalculationParams {
  assetCriticality?: AssetCriticality | string | null;
  causedDowntime?: boolean;
  isSafetyRelated?: boolean;
  isIntermittent?: boolean;
  isObservation?: boolean;
}

export interface PriorityResult {
  priority: Priority;
  score: number;
  factors: {
    criticalityScore: number;
    downtimeScore: number;
    safetyScore: number;
    otherScore: number;
  };
  reasons: string[]; // P2: Razones legibles para el usuario
}

/**
 * Calcula la prioridad automática basada en múltiples factores
 */
export function calculatePriority(params: PriorityCalculationParams): PriorityResult {
  const {
    assetCriticality,
    causedDowntime = false,
    isSafetyRelated = false,
    isIntermittent = false,
    isObservation = false
  } = params;

  // 1. Score de criticidad del activo (40 puntos máximo)
  let criticalityScore = 0;
  switch (assetCriticality) {
    case 'CRITICAL':
      criticalityScore = 40;
      break;
    case 'HIGH':
      criticalityScore = 30;
      break;
    case 'MEDIUM':
      criticalityScore = 20;
      break;
    case 'LOW':
      criticalityScore = 10;
      break;
    default:
      criticalityScore = 15; // Default para activos sin criticidad definida
  }

  // 2. Score de downtime (30 puntos máximo)
  let downtimeScore = 0;
  if (causedDowntime) {
    downtimeScore = 30;
  }

  // 3. Score de seguridad (25 puntos máximo)
  let safetyScore = 0;
  if (isSafetyRelated) {
    safetyScore = 25;
  }

  // 4. Otros factores (5 puntos máximo)
  let otherScore = 0;
  if (isObservation) {
    otherScore = 0; // Las observaciones no suman puntos
  } else if (isIntermittent) {
    otherScore = 3; // Fallas intermitentes requieren atención
  } else {
    otherScore = 5; // Fallas normales
  }

  // 5. Score total (máximo 100)
  const totalScore = criticalityScore + downtimeScore + safetyScore + otherScore;

  // 6. Determinar prioridad basada en score
  let priority: Priority;
  if (totalScore >= 60) {
    priority = 'P1'; // Urgente
  } else if (totalScore >= 40) {
    priority = 'P2'; // Alta
  } else if (totalScore >= 20) {
    priority = 'P3'; // Media
  } else {
    priority = 'P4'; // Baja
  }

  // Override: Seguridad SIEMPRE es P1
  if (isSafetyRelated) {
    priority = 'P1';
  }

  // Override: Observación nunca es P1
  if (isObservation && priority === 'P1') {
    priority = 'P2';
  }

  // P2: Generar razones legibles para el usuario
  const reasons: string[] = [];

  if (isSafetyRelated) {
    reasons.push('Riesgo de seguridad detectado');
  }

  if (causedDowntime) {
    reasons.push('Causó parada de producción');
  }

  if (assetCriticality === 'CRITICAL') {
    reasons.push('Equipo crítico para operación');
  } else if (assetCriticality === 'HIGH') {
    reasons.push('Equipo de alta importancia');
  }

  if (isObservation) {
    reasons.push('Registrada como observación');
  }

  if (isIntermittent) {
    reasons.push('Falla intermitente (puede escalar)');
  }

  // Si no hay razones específicas, dar una genérica
  if (reasons.length === 0) {
    switch (priority) {
      case 'P1':
        reasons.push('Alta criticidad combinada');
        break;
      case 'P2':
        reasons.push('Requiere atención prioritaria');
        break;
      case 'P3':
        reasons.push('Prioridad normal');
        break;
      case 'P4':
        reasons.push('Baja urgencia');
        break;
    }
  }

  return {
    priority,
    score: totalScore,
    factors: {
      criticalityScore,
      downtimeScore,
      safetyScore,
      otherScore
    },
    reasons
  };
}

/**
 * Convierte prioridad P1-P4 a etiqueta legible
 */
export function getPriorityLabel(priority: Priority): string {
  const labels: Record<Priority, string> = {
    P1: 'Urgente',
    P2: 'Alta',
    P3: 'Media',
    P4: 'Baja'
  };
  return labels[priority];
}

/**
 * Convierte prioridad legacy (URGENT/HIGH/MEDIUM/LOW) a P1-P4
 */
export function convertLegacyPriority(legacy: string): Priority {
  const mapping: Record<string, Priority> = {
    'URGENT': 'P1',
    'HIGH': 'P2',
    'MEDIUM': 'P3',
    'LOW': 'P4'
  };
  return mapping[legacy.toUpperCase()] ?? 'P3';
}

/**
 * Convierte prioridad P1-P4 a formato legacy
 */
export function convertToLegacyPriority(priority: Priority): string {
  const mapping: Record<Priority, string> = {
    'P1': 'URGENT',
    'P2': 'HIGH',
    'P3': 'MEDIUM',
    'P4': 'LOW'
  };
  return mapping[priority];
}
