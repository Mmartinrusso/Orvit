/**
 * Algoritmo de distribución óptima de carga en camión
 * Centralizado para evitar duplicación entre LoadsManager y LoadPrintView
 */

import {
  TruckData,
  LoadItem,
  GridPosition,
  PackagedItem,
  DISTRIBUTION_CONSTANTS,
} from './types';

const {
  MIN_LENGTH_FOR_LARGE_PACKAGE,
  PACKAGE_SIZE_LARGE,
  PACKAGE_SIZE_SMALL,
  FLOORS,
  ROWS,
  MAX_COLS,
} = DISTRIBUTION_CONSTANTS;

// Flag de debug - desactivar en producción
const DEBUG = false;
const log = DEBUG ? console.log.bind(console) : () => {};

/**
 * Calcula la disposición óptima de items en la grilla del camión
 *
 * Reglas:
 * - Paquetes de 10 unidades para viguetas >= 5.80m
 * - Paquetes de 20 unidades para viguetas < 5.80m
 * - Las más largas van abajo (piso 1)
 * - Si hay algo en piso 2+, SIEMPRE debe haber algo en piso 1
 * - Para EQUIPO: dos distribuciones separadas (chasis y acoplado)
 */
export function calculateOptimalLayout(
  items: LoadItem[],
  truckData?: TruckData | null,
  section: 'chasis' | 'acoplado' | 'full' = 'full'
): LoadItem[] {
  // Filtrar items válidos
  const validItems = items.filter(item => item.productId && item.quantity > 0);

  if (validItems.length === 0) {
    return [];
  }

  // Obtener largo máximo disponible según el tipo de camión y sección
  let maxLength = truckData?.length || 0;
  if (truckData?.type === 'EQUIPO' && section !== 'full') {
    maxLength = section === 'chasis'
      ? (truckData.chasisLength || 0)
      : (truckData.acopladoLength || 0);
  }

  // Para EQUIPO, filtrar por longitud según la sección
  let itemsToDistribute = validItems;
  if (truckData?.type === 'EQUIPO' && section !== 'full') {
    itemsToDistribute = validItems.filter(item => (item.length || 0) <= maxLength);
  }

  // Calcular columnas dinámicas basadas en la vigueta más pequeña
  let COLS = 3;
  if (itemsToDistribute.length > 0 && maxLength > 0) {
    const minItemLength = Math.min(
      ...itemsToDistribute.map(item => item.length || maxLength).filter(l => l > 0)
    );
    if (minItemLength > 0) {
      const colsThatFit = Math.floor(maxLength / minItemLength);
      COLS = Math.max(3, colsThatFit);
    }
  }

  // Mantener el orden original del usuario (por position)
  const sortedItems = [...itemsToDistribute].sort((a, b) => {
    return (a.position ?? 999) - (b.position ?? 999);
  });

  // Convertir items a paquetes
  const packagedItems: PackagedItem[] = sortedItems.map(item => {
    const itemLength = item.length || 0;
    const usesPackages = itemLength >= MIN_LENGTH_FOR_LARGE_PACKAGE;

    let packages: number;
    if (usesPackages) {
      packages = Math.ceil(item.quantity / PACKAGE_SIZE_LARGE);
    } else {
      packages = Math.ceil(item.quantity / PACKAGE_SIZE_SMALL);
    }

    return {
      item,
      packages,
      gridPositions: [],
      usesPackages,
    };
  });

  // Matriz 3D para rastrear posiciones ocupadas: [floor][row][col]
  const grid: boolean[][][] = Array(FLOORS)
    .fill(null)
    .map(() => Array(ROWS).fill(null).map(() => Array(MAX_COLS).fill(false)));

  // Rastrear el largo usado en cada fila
  const rowLengthUsed: number[][] = [];
  for (let f = 0; f < FLOORS; f++) {
    rowLengthUsed[f] = [];
    for (let r = 0; r < ROWS; r++) {
      rowLengthUsed[f][r] = 0;
    }
  }

  // Rastrear tipo de paquete y longitud en cada posición
  const packageTypeGrid: (boolean | undefined)[][][] = Array(FLOORS)
    .fill(null)
    .map(() => Array(ROWS).fill(null).map(() => Array(MAX_COLS).fill(undefined)));

  const itemLengthGrid: (number | undefined)[][][] = Array(FLOORS)
    .fill(null)
    .map(() => Array(ROWS).fill(null).map(() => Array(MAX_COLS).fill(undefined)));

  // Crear lista de todos los paquetes individuales
  const allPackages: Array<{
    item: LoadItem;
    packageIndex: number;
    itemLength: number;
    usesLargePackage: boolean;
  }> = [];

  packagedItems.forEach((packagedItem) => {
    const itemLength = packagedItem.item.length || 0;
    for (let p = 0; p < packagedItem.packages; p++) {
      allPackages.push({
        item: packagedItem.item,
        packageIndex: p,
        itemLength: itemLength,
        usesLargePackage: packagedItem.usesPackages,
      });
    }
  });

  // Ordenar paquetes para maximizar combinaciones cercanas al largo máximo
  allPackages.sort((a, b) => {
    const aIsMedium = a.itemLength >= 2.0 && a.itemLength < maxLength * 0.75;
    const bIsMedium = b.itemLength >= 2.0 && b.itemLength < maxLength * 0.75;

    if (aIsMedium !== bIsMedium) {
      return aIsMedium ? -1 : 1;
    }

    const aTooCloseToMax = a.itemLength >= maxLength * 0.85 && a.itemLength <= maxLength;
    const bTooCloseToMax = b.itemLength >= maxLength * 0.85 && b.itemLength <= maxLength;

    if (aTooCloseToMax !== bTooCloseToMax) {
      return aTooCloseToMax ? 1 : -1;
    }

    if (Math.abs(a.itemLength - b.itemLength) > 0.01) {
      return b.itemLength - a.itemLength;
    }

    if (a.usesLargePackage !== b.usesLargePackage) {
      return a.usesLargePackage ? -1 : 1;
    }
    return 0;
  });

  log(`[calculateOptimalLayout] Distribuyendo ${allPackages.length} paquetes`);

  let placedCount = 0;
  let notPlacedCount = 0;

  // Distribuir paquetes
  allPackages.forEach((pkg, pkgIndex) => {
    let found = false;
    const pkgLength = pkg.itemLength;
    const usesLargePackage = pkg.usesLargePackage;

    // PASO 1: Intentar piso 1 primero
    const floor1Rows = Array.from({ length: ROWS }, (_, i) => i)
      .map(row => ({
        row,
        spaceUsed: rowLengthUsed[0][row],
        remainingSpace: maxLength - rowLengthUsed[0][row],
        isEmpty: rowLengthUsed[0][row] < 0.01
      }))
      .filter(r => r.remainingSpace >= pkgLength)
      .sort((a, b) => {
        if (a.isEmpty !== b.isEmpty) return a.isEmpty ? -1 : 1;
        return a.spaceUsed - b.spaceUsed;
      });

    for (const rowInfo of floor1Rows) {
      if (found) break;
      const f1Row = rowInfo.row;

      if (rowLengthUsed[0][f1Row] + pkgLength <= maxLength) {
        for (let f1Col = 0; f1Col < MAX_COLS && !found; f1Col++) {
          if (!grid[0][f1Row][f1Col]) {
            if (rowLengthUsed[0][f1Row] + pkgLength <= maxLength) {
              grid[0][f1Row][f1Col] = true;
              packageTypeGrid[0][f1Row][f1Col] = usesLargePackage;
              itemLengthGrid[0][f1Row][f1Col] = pkgLength;
              rowLengthUsed[0][f1Row] += pkgLength;

              const packagedItem = packagedItems.find(p => p.item.productId === pkg.item.productId);
              if (packagedItem) {
                packagedItem.gridPositions.push({
                  floor: 1,
                  row: f1Row + 1,
                  col: f1Col + 1,
                });
              }
              found = true;
              placedCount++;
            }
          }
        }
      }
    }

    // PASO 2: Si no cabe en piso 1, intentar pisos superiores
    if (!found) {
      for (let floor = 1; floor < FLOORS && !found; floor++) {
        for (let fRow = 0; fRow < ROWS && !found; fRow++) {
          if (rowLengthUsed[floor][fRow] + pkgLength <= maxLength) {
            for (let fCol = 0; fCol < MAX_COLS && !found; fCol++) {
              if (!grid[floor][fRow][fCol]) {
                if (canPlaceOnTop(grid, itemLengthGrid, floor, fRow, fCol, pkgLength)) {
                  let hasSupport = checkSupport(grid, floor, fRow, fCol);

                  if (hasSupport && rowLengthUsed[floor][fRow] + pkgLength <= maxLength) {
                    grid[floor][fRow][fCol] = true;
                    packageTypeGrid[floor][fRow][fCol] = usesLargePackage;
                    itemLengthGrid[floor][fRow][fCol] = pkgLength;
                    rowLengthUsed[floor][fRow] += pkgLength;

                    const packagedItem = packagedItems.find(p => p.item.productId === pkg.item.productId);
                    if (packagedItem) {
                      packagedItem.gridPositions.push({
                        floor: floor + 1,
                        row: fRow + 1,
                        col: fCol + 1,
                      });
                    }
                    found = true;
                    placedCount++;
                  }
                }
              }
            }
          }
        }
      }
    }

    // PASO 3: Último intento - cualquier espacio disponible
    if (!found) {
      found = tryLastResortPlacement(
        pkg, grid, packageTypeGrid, itemLengthGrid, rowLengthUsed,
        packagedItems, maxLength, FLOORS, ROWS, MAX_COLS
      );
      if (found) placedCount++;
    }

    if (!found) {
      notPlacedCount++;
    }
  });

  log(`[calculateOptimalLayout] Colocados: ${placedCount}, No colocados: ${notPlacedCount}`);

  // Crear items con posiciones
  const itemsWithPositions: LoadItem[] = [];

  packagedItems.forEach((packagedItem) => {
    const usesPackages = packagedItem.usesPackages;
    const packageSize = usesPackages ? PACKAGE_SIZE_LARGE : PACKAGE_SIZE_SMALL;

    packagedItem.gridPositions.forEach((position, index) => {
      const unitsInThisPackage = Math.min(
        packageSize,
        packagedItem.item.quantity - (index * packageSize)
      );

      itemsWithPositions.push({
        ...packagedItem.item,
        quantity: unitsInThisPackage,
        gridPosition: position,
      });
    });

    // Items sin posición (no caben)
    const placedPackages = packagedItem.gridPositions.length;
    const notPlacedPackages = packagedItem.packages - placedPackages;

    if (notPlacedPackages > 0) {
      const totalUnitsPlaced = placedPackages * packageSize;
      const remainingUnits = packagedItem.item.quantity - totalUnitsPlaced;

      if (remainingUnits > 0) {
        itemsWithPositions.push({
          ...packagedItem.item,
          quantity: remainingUnits,
          gridPosition: undefined,
        });
      }
    }
  });

  // Ordenar filas por longitud (más largas abajo)
  return sortRowsByLength(itemsWithPositions);
}

/**
 * Verificar si se puede colocar un paquete encima de otro
 */
function canPlaceOnTop(
  grid: boolean[][][],
  itemLengthGrid: (number | undefined)[][][],
  floor: number,
  row: number,
  col: number,
  itemLength: number
): boolean {
  if (floor === 0) return true;

  const placingIsLarge = itemLength >= MIN_LENGTH_FOR_LARGE_PACKAGE;

  // Verificar soporte directo abajo
  for (let checkFloor = floor - 1; checkFloor >= 0; checkFloor--) {
    if (grid[checkFloor][row][col]) {
      const belowLength = itemLengthGrid[checkFloor][row][col];
      if (belowLength !== undefined) {
        const belowIsLarge = belowLength >= MIN_LENGTH_FOR_LARGE_PACKAGE;
        // Viguetas >= 5.80m pueden ir sobre cualquier cosa
        // Viguetas < 5.80m NO pueden ir sobre viguetas >= 5.80m
        if (placingIsLarge) {
          return true;
        } else {
          return !belowIsLarge;
        }
      }
    }
  }

  // Verificar soporte lateral en la fila
  for (let checkFloor = floor - 1; checkFloor >= 0; checkFloor--) {
    for (let checkCol = 0; checkCol < MAX_COLS; checkCol++) {
      if (grid[checkFloor][row][checkCol]) {
        const belowLength = itemLengthGrid[checkFloor][row][checkCol];
        if (belowLength !== undefined) {
          const belowIsLarge = belowLength >= MIN_LENGTH_FOR_LARGE_PACKAGE;
          if (placingIsLarge) {
            return true;
          } else {
            return !belowIsLarge;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Verificar si hay soporte para colocar un paquete
 */
function checkSupport(
  grid: boolean[][][],
  floor: number,
  row: number,
  col: number
): boolean {
  // Soporte directo abajo
  for (let checkFloor = floor - 1; checkFloor >= 0; checkFloor--) {
    if (grid[checkFloor][row][col]) {
      return true;
    }
  }

  // Soporte lateral en la misma fila
  for (let checkFloor = floor - 1; checkFloor >= 0; checkFloor--) {
    for (let checkCol = 0; checkCol < MAX_COLS; checkCol++) {
      if (grid[checkFloor][row][checkCol]) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Intento de última instancia para colocar un paquete
 */
function tryLastResortPlacement(
  pkg: { item: LoadItem; itemLength: number; usesLargePackage: boolean },
  grid: boolean[][][],
  packageTypeGrid: (boolean | undefined)[][][],
  itemLengthGrid: (number | undefined)[][][],
  rowLengthUsed: number[][],
  packagedItems: PackagedItem[],
  maxLength: number,
  floors: number,
  rows: number,
  maxCols: number
): boolean {
  const { item, itemLength: pkgLength, usesLargePackage } = pkg;

  for (let floor = 0; floor < floors; floor++) {
    for (let fRow = 0; fRow < rows; fRow++) {
      if (rowLengthUsed[floor][fRow] + pkgLength <= maxLength) {
        for (let fCol = 0; fCol < maxCols; fCol++) {
          if (!grid[floor][fRow][fCol]) {
            if (floor === 0) {
              if (rowLengthUsed[floor][fRow] + pkgLength <= maxLength) {
                grid[floor][fRow][fCol] = true;
                packageTypeGrid[floor][fRow][fCol] = usesLargePackage;
                itemLengthGrid[floor][fRow][fCol] = pkgLength;
                rowLengthUsed[floor][fRow] += pkgLength;

                const packagedItem = packagedItems.find(p => p.item.productId === item.productId);
                if (packagedItem) {
                  packagedItem.gridPositions.push({
                    floor: floor + 1,
                    row: fRow + 1,
                    col: fCol + 1,
                  });
                }
                return true;
              }
            } else {
              // Verificación flexible para pisos superiores
              let hasSupportInRow = false;
              let compatibleLength = true;
              const placingIsLarge = pkgLength >= MIN_LENGTH_FOR_LARGE_PACKAGE;

              for (let checkFloor = floor - 1; checkFloor >= 0; checkFloor--) {
                for (let checkCol = 0; checkCol < maxCols; checkCol++) {
                  if (grid[checkFloor][fRow][checkCol]) {
                    hasSupportInRow = true;
                    if (checkCol === fCol) {
                      const belowLength = itemLengthGrid[checkFloor][fRow][checkCol];
                      if (belowLength !== undefined) {
                        const belowIsLarge = belowLength >= MIN_LENGTH_FOR_LARGE_PACKAGE;
                        if (!placingIsLarge && belowIsLarge) {
                          compatibleLength = false;
                        }
                      }
                    }
                    break;
                  }
                }
                if (hasSupportInRow) break;
              }

              if (hasSupportInRow && compatibleLength) {
                if (rowLengthUsed[floor][fRow] + pkgLength <= maxLength) {
                  grid[floor][fRow][fCol] = true;
                  packageTypeGrid[floor][fRow][fCol] = usesLargePackage;
                  itemLengthGrid[floor][fRow][fCol] = pkgLength;
                  rowLengthUsed[floor][fRow] += pkgLength;

                  const packagedItem = packagedItems.find(p => p.item.productId === item.productId);
                  if (packagedItem) {
                    packagedItem.gridPositions.push({
                      floor: floor + 1,
                      row: fRow + 1,
                      col: fCol + 1,
                    });
                  }
                  return true;
                }
              }
            }
          }
        }
      }
    }
  }

  return false;
}

/**
 * Ordenar filas por longitud (más largas abajo)
 */
function sortRowsByLength(items: LoadItem[]): LoadItem[] {
  const itemsWithPosition = items.filter(item => item.gridPosition);
  const itemsWithoutPosition = items.filter(item => !item.gridPosition);

  if (itemsWithPosition.length === 0) {
    return items;
  }

  // Agrupar items por piso y fila
  const itemsByFloorRow: { [floor: number]: { [row: number]: LoadItem[] } } = {};

  itemsWithPosition.forEach(item => {
    if (!item.gridPosition) return;
    const floor = item.gridPosition.floor;
    const row = item.gridPosition.row;

    if (!itemsByFloorRow[floor]) {
      itemsByFloorRow[floor] = {};
    }
    if (!itemsByFloorRow[floor][row]) {
      itemsByFloorRow[floor][row] = [];
    }
    itemsByFloorRow[floor][row].push(item);
  });

  // Calcular longitud y tipo de cada fila
  const rowInfo: Array<{
    floor: number;
    row: number;
    totalLength: number;
    hasLargeViguetas: boolean;
    items: LoadItem[];
  }> = [];

  Object.keys(itemsByFloorRow).forEach(floorStr => {
    const floor = parseInt(floorStr);
    Object.keys(itemsByFloorRow[floor]).forEach(rowStr => {
      const row = parseInt(rowStr);
      const rowItems = itemsByFloorRow[floor][row];

      const totalLength = rowItems.reduce((sum, item) => {
        return sum + (item.length || 0) * item.quantity;
      }, 0);

      const hasLargeViguetas = rowItems.some(
        item => (item.length || 0) >= MIN_LENGTH_FOR_LARGE_PACKAGE
      );

      rowInfo.push({
        floor,
        row,
        totalLength,
        hasLargeViguetas,
        items: rowItems,
      });
    });
  });

  // Reordenar filas dentro de cada piso
  const floors = Object.keys(itemsByFloorRow).map(f => parseInt(f)).sort((a, b) => a - b);
  const newRowAssignments: { [floor: number]: { [oldRow: number]: number } } = {};

  floors.forEach(floor => {
    const floorRows = rowInfo.filter(r => r.floor === floor);
    const sortedByLength = [...floorRows].sort((a, b) => b.totalLength - a.totalLength);

    const finalOrder: typeof sortedByLength = [];
    const remainingRows = [...sortedByLength];

    while (remainingRows.length > 0) {
      let selectedIndex = -1;

      for (let i = 0; i < remainingRows.length; i++) {
        const candidate = remainingRows[i];

        if (candidate.hasLargeViguetas) {
          selectedIndex = i;
          break;
        }

        const hasLargeRowsPending = remainingRows.some(
          (r, idx) => idx !== i && r.hasLargeViguetas
        );
        if (!hasLargeRowsPending) {
          selectedIndex = i;
          break;
        }
      }

      if (selectedIndex === -1) {
        selectedIndex = 0;
      }

      finalOrder.push(remainingRows[selectedIndex]);
      remainingRows.splice(selectedIndex, 1);
    }

    if (!newRowAssignments[floor]) {
      newRowAssignments[floor] = {};
    }

    finalOrder.forEach((rowInfo, index) => {
      newRowAssignments[floor][rowInfo.row] = index;
    });
  });

  // Reasignar posiciones de fila
  const reorderedItems = itemsWithPosition.map(item => {
    if (!item.gridPosition) return item;

    const floor = item.gridPosition.floor;
    const oldRow = item.gridPosition.row;
    const newRow = newRowAssignments[floor]?.[oldRow];

    if (newRow !== undefined && newRow !== oldRow) {
      return {
        ...item,
        gridPosition: {
          ...item.gridPosition,
          row: newRow,
        },
      };
    }

    return item;
  });

  return [...reorderedItems, ...itemsWithoutPosition];
}

/**
 * Calcular número de columnas dinámicamente según el largo del camión
 */
export function calculateColumns(
  items: LoadItem[],
  truckData?: TruckData | null,
  section: 'chasis' | 'acoplado' | 'full' = 'full'
): number {
  if (!truckData || items.length === 0) return 3;

  let maxLength = truckData.length || 0;
  if (truckData.type === 'EQUIPO' && section !== 'full') {
    maxLength = section === 'chasis'
      ? (truckData.chasisLength || 0)
      : (truckData.acopladoLength || 0);
  }

  if (maxLength === 0) return 3;

  const minItemLength = Math.min(
    ...items.map(item => item.length || maxLength).filter(l => l > 0)
  );
  if (minItemLength === 0 || minItemLength > maxLength) return 3;

  const cols = Math.floor(maxLength / minItemLength);
  return Math.max(3, Math.min(cols, 20));
}

/**
 * Crear visualización de grilla desde items con posiciones
 */
export function createGridVisualization(
  layoutItems: LoadItem[],
  prefix: string = ''
): { [key: string]: LoadItem[] } {
  const gridViz: { [key: string]: LoadItem[] } = {};

  layoutItems.forEach(item => {
    if (item.gridPosition) {
      const { floor, row, col } = item.gridPosition;
      const key = prefix ? `${prefix}-${floor}-${row}-${col}` : `${floor}-${row}-${col}`;
      if (!gridViz[key]) {
        gridViz[key] = [];
      }
      gridViz[key].push(item);
    }
  });

  return gridViz;
}
