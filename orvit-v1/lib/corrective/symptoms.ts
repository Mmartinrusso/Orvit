/**
 * Mapa de síntomas comunes del sistema correctivo
 * Este mapa se usa tanto en el frontend (SymptomChips) como en el backend (APIs)
 */

export interface Symptom {
  id: number;
  label: string;
}

/**
 * Síntomas comunes predefinidos
 * Estos IDs deben coincidir con los del componente SymptomChips
 */
export const COMMON_SYMPTOMS: Symptom[] = [
  { id: 1, label: 'Ruido extraño' },
  { id: 2, label: 'Vibración' },
  { id: 3, label: 'Sobrecalentamiento' },
  { id: 4, label: 'Fuga de aceite' },
  { id: 5, label: 'Pérdida de presión' },
  { id: 6, label: 'No arranca' },
  { id: 7, label: 'Se apaga solo' },
  { id: 8, label: 'Humo' },
  { id: 9, label: 'Olor a quemado' },
  { id: 10, label: 'Fuga de agua' },
];

/**
 * Mapa para búsqueda rápida por ID
 */
export const SYMPTOMS_MAP = new Map<number, Symptom>(
  COMMON_SYMPTOMS.map(s => [s.id, s])
);

/**
 * Convierte array de IDs de síntomas a array de objetos con label
 */
export function expandSymptoms(symptomIds: number[] | null | undefined): Symptom[] {
  if (!symptomIds || !Array.isArray(symptomIds)) return [];

  return symptomIds
    .map(id => SYMPTOMS_MAP.get(id))
    .filter((s): s is Symptom => s !== undefined);
}

/**
 * Obtiene los labels de los síntomas como string separado por comas
 */
export function getSymptomsLabels(symptomIds: number[] | null | undefined): string {
  const expanded = expandSymptoms(symptomIds);
  return expanded.map(s => s.label).join(', ');
}
