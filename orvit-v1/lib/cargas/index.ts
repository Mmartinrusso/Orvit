/**
 * Módulo de cargas - Exportaciones centralizadas
 */

// Tipos
export * from './types';

// Algoritmo de distribución
export {
  calculateOptimalLayout,
  calculateColumns,
  createGridVisualization,
} from './calculate-optimal-layout';

// Validaciones
export * from './validations';

// Utilidades
export * from './utils';
