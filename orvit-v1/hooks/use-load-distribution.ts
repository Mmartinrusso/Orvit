'use client';

/**
 * Hook para manejar la distribución óptima de carga en camiones
 * Centraliza la lógica de cálculo y memoización
 */

import { useMemo } from 'react';
import {
  LoadItem,
  TruckData,
  DistributionResult,
  DistributionStats,
  DISTRIBUTION_CONSTANTS,
} from '@/lib/cargas/types';
import {
  calculateOptimalLayout,
  calculateColumns,
  createGridVisualization,
} from '@/lib/cargas/calculate-optimal-layout';
import { calculateTotalWeightKg } from '@/lib/cargas/utils';

const {
  MIN_LENGTH_FOR_LARGE_PACKAGE,
  PACKAGE_SIZE_LARGE,
  PACKAGE_SIZE_SMALL,
} = DISTRIBUTION_CONSTANTS;

interface UseLoadDistributionParams {
  items: LoadItem[];
  truck: TruckData | null | undefined;
}

interface UseLoadDistributionResult extends DistributionResult {
  isValid: boolean;
  warnings: string[];
}

export function useLoadDistribution({
  items,
  truck,
}: UseLoadDistributionParams): UseLoadDistributionResult {
  return useMemo(() => {
    const emptyResult: UseLoadDistributionResult = {
      layoutItems: [],
      gridVisualization: {},
      chasisLayout: [],
      acopladoLayout: [],
      chasisGridViz: {},
      acopladoGridViz: {},
      chasisCols: 3,
      acopladoCols: 3,
      fullCols: 3,
      itemsNotPlaced: [],
      stats: {
        totalItems: 0,
        totalPackages: 0,
        placedPackages: 0,
        notPlacedPackages: 0,
        totalWeight: 0,
        chasisWeight: 0,
        acopladoWeight: 0,
        utilizationPercent: 0,
      },
      isValid: false,
      warnings: [],
    };

    const validItems = items.filter(item => item.productId && item.quantity > 0);

    if (validItems.length === 0 || !truck) {
      return emptyResult;
    }

    const warnings: string[] = [];
    const itemsNotPlaced: Array<{ productName: string; quantity: number; reason: string }> = [];

    // Si es EQUIPO, calcular distribuciones separadas
    if (truck.type === 'EQUIPO' && truck.chasisLength && truck.acopladoLength) {
      return calculateEquipoDistribution(validItems, truck, warnings);
    }

    // Para CHASIS o SEMI, distribución simple
    const layoutItems = calculateOptimalLayout(validItems, truck, 'full');
    const gridVisualization = createGridVisualization(layoutItems);
    const fullCols = calculateColumns(validItems, truck, 'full');

    // Calcular estadísticas
    const placedItems = layoutItems.filter(item => item.gridPosition);
    const notPlacedItems = layoutItems.filter(item => !item.gridPosition);

    const totalPackages = layoutItems.length;
    const placedPackages = placedItems.length;
    const notPlacedPackages = notPlacedItems.length;

    // Agregar items no colocados a la lista
    notPlacedItems.forEach(item => {
      itemsNotPlaced.push({
        productName: item.productName,
        quantity: item.quantity,
        reason: 'No cabe en el espacio disponible',
      });
    });

    // Verificar peso
    const totalWeightKg = calculateTotalWeightKg(validItems);
    const totalWeightTn = totalWeightKg / 1000;
    if (truck.maxWeight && totalWeightTn > truck.maxWeight) {
      warnings.push(`Peso (${totalWeightTn.toFixed(2)} Tn) excede el máximo (${truck.maxWeight} Tn)`);
    }

    // Calcular utilización
    const maxCapacity = truck.length * 3 * 4; // Aproximación: largo x filas x pisos
    const usedCapacity = placedItems.reduce((sum, item) => sum + (item.length || 0), 0);
    const utilizationPercent = maxCapacity > 0 ? (usedCapacity / maxCapacity) * 100 : 0;

    return {
      layoutItems,
      gridVisualization,
      chasisLayout: [],
      acopladoLayout: [],
      chasisGridViz: {},
      acopladoGridViz: {},
      chasisCols: 3,
      acopladoCols: 3,
      fullCols,
      itemsNotPlaced,
      stats: {
        totalItems: validItems.length,
        totalPackages,
        placedPackages,
        notPlacedPackages,
        totalWeight: totalWeightTn,
        chasisWeight: 0,
        acopladoWeight: 0,
        utilizationPercent: Math.round(utilizationPercent),
      },
      isValid: notPlacedPackages === 0 && warnings.length === 0,
      warnings,
    };
  }, [items, truck?.id, truck?.type, truck?.length, truck?.chasisLength, truck?.acopladoLength, truck?.maxWeight, truck?.chasisWeight, truck?.acopladoWeight]);
}

/**
 * Calcular distribución para camión tipo EQUIPO
 */
function calculateEquipoDistribution(
  validItems: LoadItem[],
  truck: TruckData,
  warnings: string[]
): UseLoadDistributionResult {
  const chasisLength = truck.chasisLength!;
  const acopladoLength = truck.acopladoLength!;
  const itemsNotPlaced: Array<{ productName: string; quantity: number; reason: string }> = [];

  // Ordenar items por position original
  const sortedItems = [...validItems].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  // Separar items según dónde caben
  const itemsOnlyChasis: LoadItem[] = [];
  const itemsOnlyAcoplado: LoadItem[] = [];
  const itemsBoth: LoadItem[] = [];

  for (const item of sortedItems) {
    const itemLength = item.length || 0;
    const fitsChasis = itemLength <= chasisLength;
    const fitsAcoplado = itemLength <= acopladoLength;

    if (fitsChasis && fitsAcoplado) {
      itemsBoth.push(item);
    } else if (fitsChasis) {
      itemsOnlyChasis.push(item);
    } else if (fitsAcoplado) {
      itemsOnlyAcoplado.push(item);
    } else {
      // No cabe en ninguno
      itemsNotPlaced.push({
        productName: item.productName,
        quantity: item.quantity,
        reason: `Largo (${itemLength}m) excede ambos: chasis (${chasisLength}m) y acoplado (${acopladoLength}m)`,
      });
    }
  }

  // Primero llenar el chasis
  const chasisItems = [...itemsOnlyChasis, ...itemsBoth];
  chasisItems.sort((a, b) => (a.position ?? 999) - (b.position ?? 999));

  const chasisLayoutCalc = calculateOptimalLayout(chasisItems, truck, 'chasis');

  // Contar cantidades colocadas en chasis
  const chasisQuantityByProduct: { [productId: string]: number } = {};
  chasisLayoutCalc.forEach(item => {
    if (item.gridPosition) {
      chasisQuantityByProduct[item.productId] = (chasisQuantityByProduct[item.productId] || 0) + item.quantity;
    }
  });

  // Calcular items finales para chasis y acoplado
  const finalChasisItems: LoadItem[] = [];
  const finalAcopladoItems: LoadItem[] = [];

  // Agrupar items originales por producto
  const allItemsByProduct: { [productId: string]: LoadItem[] } = {};
  sortedItems.forEach(item => {
    if (!allItemsByProduct[item.productId]) {
      allItemsByProduct[item.productId] = [];
    }
    allItemsByProduct[item.productId].push(item);
  });

  // Procesar cada producto
  Object.keys(allItemsByProduct).forEach(productId => {
    const items = allItemsByProduct[productId];
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const itemLength = items[0].length || 0;
    const fitsChasis = itemLength <= chasisLength;
    const fitsAcoplado = itemLength <= acopladoLength;

    const quantityInChasis = fitsChasis ? (chasisQuantityByProduct[productId] || 0) : 0;
    const quantityInAcoplado = totalQuantity - quantityInChasis;

    if (quantityInChasis > 0) {
      finalChasisItems.push({
        ...items[0],
        quantity: quantityInChasis,
      });
    }

    if (quantityInAcoplado > 0) {
      if (fitsAcoplado) {
        finalAcopladoItems.push({
          ...items[0],
          quantity: quantityInAcoplado,
        });
      } else if (!fitsChasis) {
        // Ya registrado arriba
      } else {
        itemsNotPlaced.push({
          productName: items[0].productName,
          quantity: quantityInAcoplado,
          reason: `No cabe en acoplado (largo: ${itemLength}m > ${acopladoLength}m)`,
        });
      }
    }

    // Items que solo caben en acoplado
    if (!fitsChasis && fitsAcoplado && totalQuantity > 0) {
      const alreadyInAcoplado = finalAcopladoItems.find(i => i.productId === productId);
      if (!alreadyInAcoplado) {
        finalAcopladoItems.push({
          ...items[0],
          quantity: totalQuantity,
        });
      }
    }
  });

  // Ordenar por position
  finalChasisItems.sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
  finalAcopladoItems.sort((a, b) => (a.position ?? 999) - (b.position ?? 999));

  // Calcular layouts finales
  const chasisLayout = calculateOptimalLayout(finalChasisItems, truck, 'chasis');
  const acopladoLayout = calculateOptimalLayout(finalAcopladoItems, truck, 'acoplado');

  // Crear visualizaciones
  const chasisGridViz = createGridVisualization(chasisLayout, 'chasis');
  const acopladoGridViz = createGridVisualization(acopladoLayout, 'acoplado');

  // Calcular columnas
  const chasisCols = calculateColumns(finalChasisItems, truck, 'chasis');
  const acopladoCols = calculateColumns(finalAcopladoItems, truck, 'acoplado');

  // Calcular estadísticas
  const placedChasis = chasisLayout.filter(item => item.gridPosition).length;
  const placedAcoplado = acopladoLayout.filter(item => item.gridPosition).length;
  const notPlacedChasis = chasisLayout.filter(item => !item.gridPosition).length;
  const notPlacedAcoplado = acopladoLayout.filter(item => !item.gridPosition).length;

  const chasisWeightKg = calculateTotalWeightKg(chasisLayout.filter(i => i.gridPosition));
  const acopladoWeightKg = calculateTotalWeightKg(acopladoLayout.filter(i => i.gridPosition));
  const chasisWeightTn = chasisWeightKg / 1000;
  const acopladoWeightTn = acopladoWeightKg / 1000;

  // Verificar pesos
  if (truck.chasisWeight && chasisWeightTn > truck.chasisWeight) {
    warnings.push(`Peso chasis (${chasisWeightTn.toFixed(2)} Tn) excede el máximo (${truck.chasisWeight} Tn)`);
  }
  if (truck.acopladoWeight && acopladoWeightTn > truck.acopladoWeight) {
    warnings.push(`Peso acoplado (${acopladoWeightTn.toFixed(2)} Tn) excede el máximo (${truck.acopladoWeight} Tn)`);
  }

  const totalPackages = chasisLayout.length + acopladoLayout.length;
  const placedPackages = placedChasis + placedAcoplado;
  const notPlacedPackages = notPlacedChasis + notPlacedAcoplado;

  return {
    layoutItems: [...chasisLayout, ...acopladoLayout],
    gridVisualization: { ...chasisGridViz, ...acopladoGridViz },
    chasisLayout,
    acopladoLayout,
    chasisGridViz,
    acopladoGridViz,
    chasisCols,
    acopladoCols,
    fullCols: Math.max(chasisCols, acopladoCols),
    itemsNotPlaced,
    stats: {
      totalItems: validItems.length,
      totalPackages,
      placedPackages,
      notPlacedPackages,
      totalWeight: chasisWeightTn + acopladoWeightTn,
      chasisWeight: chasisWeightTn,
      acopladoWeight: acopladoWeightTn,
      utilizationPercent: totalPackages > 0 ? Math.round((placedPackages / totalPackages) * 100) : 0,
    },
    isValid: notPlacedPackages === 0 && warnings.length === 0 && itemsNotPlaced.length === 0,
    warnings,
  };
}

export default useLoadDistribution;
