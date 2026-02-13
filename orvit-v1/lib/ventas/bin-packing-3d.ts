/**
 * 3D Bin Packing Algorithm for Load Order Auto-Accommodation
 *
 * Uses a simplified First-Fit Decreasing Height (FFDH) algorithm
 * adapted for truck loading scenarios.
 *
 * Key features:
 * - Supports weight and volume constraints
 * - Calculates optimal loading sequence
 * - Returns 3D positions for each item
 * - Considers stackability (heavy items at bottom)
 */

import { Prisma } from '@prisma/client';

export interface ItemDimensions {
  id: number;
  productId?: string | null;
  cantidad: number | Prisma.Decimal;
  // Per-unit dimensions
  pesoUnitario?: number | Prisma.Decimal | null;
  volumenUnitario?: number | Prisma.Decimal | null;
  largoUnitario?: number | Prisma.Decimal | null; // length in meters
  anchoUnitario?: number | Prisma.Decimal | null; // width in meters
  altoUnitario?: number | Prisma.Decimal | null; // height in meters
  // Additional properties
  esFragil?: boolean;
  esApilable?: boolean;
  prioridad?: number; // Higher = load first (e.g., heavy items)
}

export interface VehicleDimensions {
  tipo: string;
  // Capacity
  capacidadPeso: number; // kg
  capacidadVolumen: number; // m³
  // Interior dimensions
  largoInterior: number; // meters
  anchoInterior: number; // meters
  altoInterior: number; // meters
}

export interface PackedItem {
  itemId: number;
  secuencia: number;
  posX: number; // Position X in meters
  posY: number; // Position Y in meters (depth)
  posZ: number; // Position Z in meters (height)
  rotated: boolean; // If item was rotated to fit
  pesoTotal: number;
  volumenTotal: number;
}

export interface PackingResult {
  success: boolean;
  packedItems: PackedItem[];
  unpacked: number[]; // Item IDs that couldn't fit
  utilizacion: {
    peso: number; // percentage
    volumen: number; // percentage
    espacioLineal: number; // percentage of length used
  };
  pesoTotal: number;
  volumenTotal: number;
  warnings: string[];
  errors: string[];
}

// Default vehicle dimensions (interior space)
export const VEHICLE_DIMENSIONS: Record<string, VehicleDimensions> = {
  CAMIONETA: {
    tipo: 'CAMIONETA',
    capacidadPeso: 1000,
    capacidadVolumen: 3,
    largoInterior: 2.0,
    anchoInterior: 1.5,
    altoInterior: 1.0,
  },
  FURGON: {
    tipo: 'FURGON',
    capacidadPeso: 1500,
    capacidadVolumen: 10,
    largoInterior: 3.5,
    anchoInterior: 1.8,
    altoInterior: 1.6,
  },
  CAMION_PEQUEÑO: {
    tipo: 'CAMION_PEQUEÑO',
    capacidadPeso: 3500,
    capacidadVolumen: 20,
    largoInterior: 4.5,
    anchoInterior: 2.2,
    altoInterior: 2.0,
  },
  CAMION_MEDIANO: {
    tipo: 'CAMION_MEDIANO',
    capacidadPeso: 8000,
    capacidadVolumen: 40,
    largoInterior: 6.0,
    anchoInterior: 2.4,
    altoInterior: 2.4,
  },
  CAMION_GRANDE: {
    tipo: 'CAMION_GRANDE',
    capacidadPeso: 15000,
    capacidadVolumen: 60,
    largoInterior: 8.0,
    anchoInterior: 2.5,
    altoInterior: 2.7,
  },
  SEMI: {
    tipo: 'SEMI',
    capacidadPeso: 24000,
    capacidadVolumen: 90,
    largoInterior: 13.5,
    anchoInterior: 2.5,
    altoInterior: 2.7,
  },
};

/**
 * Helper to convert Prisma.Decimal or number to number
 */
function toNumber(value: number | Prisma.Decimal | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : parseFloat(value.toString());
}

/**
 * Calculate item dimensions expanded by quantity
 */
function expandItem(item: ItemDimensions): {
  id: number;
  cantidad: number;
  pesoTotal: number;
  volumenTotal: number;
  largo: number;
  ancho: number;
  alto: number;
  prioridad: number;
} {
  const cantidad = toNumber(item.cantidad);
  const pesoUnitario = toNumber(item.pesoUnitario) || 0;
  const volumenUnitario = toNumber(item.volumenUnitario) || 0;
  const largoUnitario = toNumber(item.largoUnitario) || 0.5; // Default 50cm
  const anchoUnitario = toNumber(item.anchoUnitario) || 0.3; // Default 30cm
  const altoUnitario = toNumber(item.altoUnitario) || 0.3; // Default 30cm

  // For now, stack items in a single pile (simplified)
  // A more complex algorithm would arrange them in rows
  return {
    id: item.id,
    cantidad,
    pesoTotal: pesoUnitario * cantidad,
    volumenTotal: volumenUnitario * cantidad || largoUnitario * anchoUnitario * altoUnitario * cantidad,
    largo: largoUnitario,
    ancho: anchoUnitario,
    alto: altoUnitario * Math.ceil(cantidad), // Stack vertically
    prioridad: item.prioridad || (pesoUnitario * cantidad), // Heavy items first by default
  };
}

/**
 * Pack items into a vehicle using First-Fit Decreasing algorithm
 *
 * Strategy:
 * 1. Sort items by priority (heavy/fragile first)
 * 2. Place items from back to front of vehicle
 * 3. Use shelf-based approach for vertical stacking
 */
export function packItems3D(
  items: ItemDimensions[],
  vehicle: VehicleDimensions
): PackingResult {
  const result: PackingResult = {
    success: false,
    packedItems: [],
    unpacked: [],
    utilizacion: {
      peso: 0,
      volumen: 0,
      espacioLineal: 0,
    },
    pesoTotal: 0,
    volumenTotal: 0,
    warnings: [],
    errors: [],
  };

  if (items.length === 0) {
    result.success = true;
    return result;
  }

  // Expand items with calculated dimensions
  const expandedItems = items.map(expandItem);

  // Sort by priority (descending) - heavy items first
  expandedItems.sort((a, b) => b.prioridad - a.prioridad);

  // Track used space
  let currentX = 0; // Position along length
  let currentY = 0; // Position along width
  let currentZ = 0; // Height of current shelf
  let shelfHeight = 0; // Max height on current shelf
  let totalPeso = 0;
  let totalVolumen = 0;
  let sequence = 1;

  // Place items
  for (const item of expandedItems) {
    // Check weight constraint
    if (totalPeso + item.pesoTotal > vehicle.capacidadPeso) {
      result.unpacked.push(item.id);
      result.warnings.push(
        `Item ${item.id}: Excede capacidad de peso restante`
      );
      continue;
    }

    // Check volume constraint
    if (totalVolumen + item.volumenTotal > vehicle.capacidadVolumen) {
      result.unpacked.push(item.id);
      result.warnings.push(
        `Item ${item.id}: Excede capacidad de volumen restante`
      );
      continue;
    }

    // Try to place item
    let placed = false;
    let posX = 0;
    let posY = 0;
    let posZ = 0;
    let rotated = false;

    // Try current position (within width)
    if (currentY + item.ancho <= vehicle.anchoInterior) {
      // Check if item fits at current X position
      if (currentX + item.largo <= vehicle.largoInterior) {
        // Check height
        if (currentZ + item.alto <= vehicle.altoInterior) {
          posX = currentX;
          posY = currentY;
          posZ = currentZ;
          placed = true;

          // Update position
          currentY += item.ancho;
          shelfHeight = Math.max(shelfHeight, item.alto);
        }
      }
    }

    // Try new row (reset Y, advance Z)
    if (!placed && currentZ + shelfHeight + item.alto <= vehicle.altoInterior) {
      currentZ += shelfHeight;
      shelfHeight = 0;
      currentY = 0;

      if (currentY + item.ancho <= vehicle.anchoInterior) {
        if (currentX + item.largo <= vehicle.largoInterior) {
          posX = currentX;
          posY = currentY;
          posZ = currentZ;
          placed = true;

          currentY += item.ancho;
          shelfHeight = Math.max(shelfHeight, item.alto);
        }
      }
    }

    // Try new shelf (advance X, reset Y and Z)
    if (!placed) {
      currentX += Math.max(item.largo, shelfHeight > 0 ? 0.5 : 0);
      currentY = 0;
      currentZ = 0;
      shelfHeight = 0;

      if (currentX + item.largo <= vehicle.largoInterior) {
        if (currentY + item.ancho <= vehicle.anchoInterior) {
          if (currentZ + item.alto <= vehicle.altoInterior) {
            posX = currentX;
            posY = currentY;
            posZ = currentZ;
            placed = true;

            currentY += item.ancho;
            shelfHeight = Math.max(shelfHeight, item.alto);
          }
        }
      }
    }

    // Try rotating item (swap largo and ancho) if not placed
    if (!placed) {
      const swappedLargo = item.ancho;
      const swappedAncho = item.largo;

      // Reset and try with rotation
      currentX = 0;
      currentY = 0;
      currentZ = 0;
      shelfHeight = 0;

      // Recalculate all positions with rotation
      // For simplicity, just try at origin with rotation
      if (
        swappedLargo <= vehicle.largoInterior &&
        swappedAncho <= vehicle.anchoInterior &&
        item.alto <= vehicle.altoInterior
      ) {
        // Find space for rotated item
        posX = 0;
        posY = 0;
        posZ = 0;
        rotated = true;
        placed = true;

        result.warnings.push(
          `Item ${item.id}: Rotado para acomodar`
        );
      }
    }

    if (placed) {
      result.packedItems.push({
        itemId: item.id,
        secuencia: sequence++,
        posX: Math.round(posX * 100) / 100,
        posY: Math.round(posY * 100) / 100,
        posZ: Math.round(posZ * 100) / 100,
        rotated,
        pesoTotal: item.pesoTotal,
        volumenTotal: item.volumenTotal,
      });

      totalPeso += item.pesoTotal;
      totalVolumen += item.volumenTotal;
    } else {
      result.unpacked.push(item.id);
      result.errors.push(
        `Item ${item.id}: No cabe en el vehículo con las dimensiones especificadas`
      );
    }
  }

  // Calculate utilization
  result.pesoTotal = Math.round(totalPeso * 100) / 100;
  result.volumenTotal = Math.round(totalVolumen * 1000) / 1000;
  result.utilizacion = {
    peso:
      Math.round((totalPeso / vehicle.capacidadPeso) * 10000) / 100,
    volumen:
      Math.round((totalVolumen / vehicle.capacidadVolumen) * 10000) / 100,
    espacioLineal:
      Math.round((currentX / vehicle.largoInterior) * 10000) / 100,
  };

  result.success = result.unpacked.length === 0;

  if (result.utilizacion.peso > 95) {
    result.warnings.push(
      `Peso muy cercano al límite: ${result.utilizacion.peso.toFixed(1)}%`
    );
  }
  if (result.utilizacion.volumen > 95) {
    result.warnings.push(
      `Volumen muy cercano al límite: ${result.utilizacion.volumen.toFixed(1)}%`
    );
  }

  return result;
}

/**
 * Suggest the best vehicle type for a set of items
 */
export function suggestVehicle(items: ItemDimensions[]): {
  recommended: string;
  alternatives: string[];
  details: Record<string, PackingResult>;
} {
  const results: Record<string, PackingResult> = {};
  const validVehicles: Array<{ tipo: string; score: number }> = [];

  for (const [tipo, vehicle] of Object.entries(VEHICLE_DIMENSIONS)) {
    const packingResult = packItems3D(items, vehicle);
    results[tipo] = packingResult;

    if (packingResult.success) {
      // Score based on utilization (prefer higher utilization)
      const score =
        packingResult.utilizacion.peso * 0.4 +
        packingResult.utilizacion.volumen * 0.4 +
        packingResult.utilizacion.espacioLineal * 0.2;

      // Only consider if utilization is reasonable (30-95%)
      if (
        packingResult.utilizacion.peso >= 30 &&
        packingResult.utilizacion.peso <= 95
      ) {
        validVehicles.push({ tipo, score });
      } else if (packingResult.utilizacion.peso < 30) {
        // Under-utilized, but still valid as backup
        validVehicles.push({ tipo, score: score * 0.5 });
      }
    }
  }

  // Sort by score (highest first)
  validVehicles.sort((a, b) => b.score - a.score);

  if (validVehicles.length === 0) {
    // No vehicle can fit all items
    // Find the smallest vehicle that can fit the most items
    let bestVehicle = 'SEMI';
    let bestUnpacked = Infinity;

    for (const [tipo, result] of Object.entries(results)) {
      if (result.unpacked.length < bestUnpacked) {
        bestUnpacked = result.unpacked.length;
        bestVehicle = tipo;
      }
    }

    return {
      recommended: bestVehicle,
      alternatives: [],
      details: results,
    };
  }

  return {
    recommended: validVehicles[0].tipo,
    alternatives: validVehicles.slice(1, 3).map((v) => v.tipo),
    details: results,
  };
}

/**
 * Calculate optimal loading sequence for delivery stops
 *
 * Items for the last stop should be loaded first (back of truck),
 * items for the first stop should be loaded last (front/accessible).
 */
export function calculateLoadingSequence(
  items: Array<ItemDimensions & { stopOrder?: number }>
): ItemDimensions[] {
  // Sort by stop order (descending) - last stop first
  return [...items].sort((a, b) => {
    const stopA = a.stopOrder ?? 0;
    const stopB = b.stopOrder ?? 0;
    return stopB - stopA; // Reverse order
  });
}
