/**
 * Capacity Validation Helper
 *
 * Validates vehicle/load capacity constraints.
 */

import { Prisma } from '@prisma/client';

export interface VehicleCapacity {
  capacidadPeso?: number; // kg
  capacidadVolumen?: number; // m³
}

export interface LoadRequirements {
  pesoTotal: number; // kg
  volumenTotal: number; // m³
}

export interface CapacityValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  utilizacion: {
    peso: number; // percentage
    volumen: number; // percentage
  };
}

/**
 * Validates if load fits within vehicle capacity
 */
export function validateCapacity(
  load: LoadRequirements,
  vehicle: VehicleCapacity
): CapacityValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let pesoUtilizacion = 0;
  let volumenUtilizacion = 0;

  // Validate peso (weight)
  if (vehicle.capacidadPeso) {
    pesoUtilizacion = (load.pesoTotal / vehicle.capacidadPeso) * 100;

    if (load.pesoTotal > vehicle.capacidadPeso) {
      errors.push(
        `Peso excede capacidad del vehículo: ${load.pesoTotal.toFixed(2)}kg > ${vehicle.capacidadPeso.toFixed(2)}kg (${(pesoUtilizacion - 100).toFixed(1)}% de sobrepeso)`
      );
    } else if (pesoUtilizacion > 95) {
      warnings.push(
        `Peso muy cercano al límite: ${pesoUtilizacion.toFixed(1)}% de capacidad`
      );
    } else if (pesoUtilizacion < 30) {
      warnings.push(
        `Baja utilización de capacidad de peso: ${pesoUtilizacion.toFixed(1)}%`
      );
    }
  }

  // Validate volumen (volume)
  if (vehicle.capacidadVolumen) {
    volumenUtilizacion = (load.volumenTotal / vehicle.capacidadVolumen) * 100;

    if (load.volumenTotal > vehicle.capacidadVolumen) {
      errors.push(
        `Volumen excede capacidad del vehículo: ${load.volumenTotal.toFixed(2)}m³ > ${vehicle.capacidadVolumen.toFixed(2)}m³ (${(volumenUtilizacion - 100).toFixed(1)}% de sobrevolumen)`
      );
    } else if (volumenUtilizacion > 95) {
      warnings.push(
        `Volumen muy cercano al límite: ${volumenUtilizacion.toFixed(1)}% de capacidad`
      );
    } else if (volumenUtilizacion < 30) {
      warnings.push(
        `Baja utilización de capacidad de volumen: ${volumenUtilizacion.toFixed(1)}%`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    utilizacion: {
      peso: pesoUtilizacion,
      volumen: volumenUtilizacion,
    },
  };
}

/**
 * Calculate total weight and volume from items
 */
export function calculateLoadRequirements(
  items: Array<{
    cantidad: number | Prisma.Decimal;
    pesoUnitario?: number | Prisma.Decimal | null;
    volumenUnitario?: number | Prisma.Decimal | null;
  }>
): LoadRequirements {
  let pesoTotal = 0;
  let volumenTotal = 0;

  for (const item of items) {
    const cantidad =
      typeof item.cantidad === 'number'
        ? item.cantidad
        : parseFloat(item.cantidad.toString());

    if (item.pesoUnitario) {
      const peso =
        typeof item.pesoUnitario === 'number'
          ? item.pesoUnitario
          : parseFloat(item.pesoUnitario.toString());
      pesoTotal += cantidad * peso;
    }

    if (item.volumenUnitario) {
      const volumen =
        typeof item.volumenUnitario === 'number'
          ? item.volumenUnitario
          : parseFloat(item.volumenUnitario.toString());
      volumenTotal += cantidad * volumen;
    }
  }

  return { pesoTotal, volumenTotal };
}

/**
 * Standard vehicle capacities (defaults)
 */
export const VEHICLE_CAPACITIES: Record<string, VehicleCapacity> = {
  CAMIONETA: { capacidadPeso: 1000, capacidadVolumen: 3 },
  FURGON: { capacidadPeso: 1500, capacidadVolumen: 10 },
  CAMION_PEQUEÑO: { capacidadPeso: 3500, capacidadVolumen: 20 },
  CAMION_MEDIANO: { capacidadPeso: 8000, capacidadVolumen: 40 },
  CAMION_GRANDE: { capacidadPeso: 15000, capacidadVolumen: 60 },
  SEMI: { capacidadPeso: 24000, capacidadVolumen: 90 },
};

/**
 * Suggest appropriate vehicle type for load
 */
export function suggestVehicleType(load: LoadRequirements): string[] {
  const suggestions: string[] = [];

  for (const [tipo, capacity] of Object.entries(VEHICLE_CAPACITIES)) {
    const validation = validateCapacity(load, capacity);

    // Accept if within capacity and utilization is reasonable (30%-95%)
    if (
      validation.valid &&
      validation.utilizacion.peso >= 30 &&
      validation.utilizacion.peso <= 95
    ) {
      suggestions.push(tipo);
    }
  }

  // If no good matches, suggest smallest that fits
  if (suggestions.length === 0) {
    for (const [tipo, capacity] of Object.entries(VEHICLE_CAPACITIES)) {
      if (
        (capacity.capacidadPeso || Infinity) >= load.pesoTotal &&
        (capacity.capacidadVolumen || Infinity) >= load.volumenTotal
      ) {
        return [tipo];
      }
    }
  }

  return suggestions;
}
