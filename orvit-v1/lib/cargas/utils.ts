/**
 * Utilidades para el módulo de cargas
 */

import { format, isToday, isThisWeek, isThisMonth, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Load,
  LoadItem,
  TruckData,
  LoadMetrics,
  DISTRIBUTION_CONSTANTS,
} from './types';

const { MIN_LENGTH_FOR_LARGE_PACKAGE, PACKAGE_SIZE_LARGE, PACKAGE_SIZE_SMALL } = DISTRIBUTION_CONSTANTS;

/**
 * Formatear fecha para mostrar
 */
export function formatLoadDate(dateString: string): string {
  try {
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: es });
  } catch {
    return dateString;
  }
}

/**
 * Formatear fecha y hora
 */
export function formatLoadDateTime(dateString: string): string {
  try {
    return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: es });
  } catch {
    return dateString;
  }
}

/**
 * Calcular peso total de una carga (en toneladas)
 */
export function calculateTotalWeight(items: LoadItem[]): number {
  const weightKg = items.reduce(
    (sum, item) => sum + (item.weight || 0) * item.quantity,
    0
  );
  return weightKg / 1000; // Convertir a toneladas
}

/**
 * Calcular peso total en kilos
 */
export function calculateTotalWeightKg(items: LoadItem[]): number {
  return items.reduce(
    (sum, item) => sum + (item.weight || 0) * item.quantity,
    0
  );
}

/**
 * Calcular número de paquetes para un item
 */
export function calculatePackages(item: LoadItem): number {
  const itemLength = item.length || 0;
  const usesLargePackage = itemLength >= MIN_LENGTH_FOR_LARGE_PACKAGE;
  const packageSize = usesLargePackage ? PACKAGE_SIZE_LARGE : PACKAGE_SIZE_SMALL;
  return Math.ceil(item.quantity / packageSize);
}

/**
 * Calcular total de paquetes de una carga
 */
export function calculateTotalPackages(items: LoadItem[]): number {
  return items.reduce((sum, item) => sum + calculatePackages(item), 0);
}

/**
 * Obtener tipo de paquete (10 o 20 unidades)
 */
export function getPackageSize(length: number | null | undefined): number {
  return (length || 0) >= MIN_LENGTH_FOR_LARGE_PACKAGE
    ? PACKAGE_SIZE_LARGE
    : PACKAGE_SIZE_SMALL;
}

/**
 * Calcular métricas de cargas
 */
export function calculateLoadMetrics(loads: Load[]): LoadMetrics {
  const now = new Date();

  // Cargas por período
  const loadsToday = loads.filter(l => isToday(new Date(l.date))).length;
  const loadsThisWeek = loads.filter(l => isThisWeek(new Date(l.date))).length;
  const loadsThisMonth = loads.filter(l => isThisMonth(new Date(l.date))).length;

  // Promedio de items por carga
  const totalItems = loads.reduce((sum, l) => sum + l.items.length, 0);
  const avgItemsPerLoad = loads.length > 0 ? totalItems / loads.length : 0;

  // Camión más usado
  const truckCounts: Record<number, { id: number; name: string; count: number }> = {};
  loads.forEach(load => {
    if (load.truck) {
      if (!truckCounts[load.truck.id]) {
        truckCounts[load.truck.id] = { id: load.truck.id, name: load.truck.name, count: 0 };
      }
      truckCounts[load.truck.id].count++;
    }
  });
  const mostUsedTruck = Object.values(truckCounts).sort((a, b) => b.count - a.count)[0] || null;

  // Cliente más frecuente
  const clientCounts: Record<string, { name: string; count: number }> = {};
  loads.forEach(load => {
    if (load.deliveryClient) {
      if (!clientCounts[load.deliveryClient]) {
        clientCounts[load.deliveryClient] = { name: load.deliveryClient, count: 0 };
      }
      clientCounts[load.deliveryClient].count++;
    }
  });
  const mostFrequentClient = Object.values(clientCounts).sort((a, b) => b.count - a.count)[0] || null;

  // Peso total del mes
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const monthLoads = loads.filter(l => {
    const loadDate = new Date(l.date);
    return loadDate >= monthStart && loadDate <= monthEnd;
  });
  const totalWeightThisMonth = monthLoads.reduce(
    (sum, load) => sum + calculateTotalWeight(load.items),
    0
  );

  return {
    totalLoads: loads.length,
    loadsToday,
    loadsThisWeek,
    loadsThisMonth,
    avgItemsPerLoad: Math.round(avgItemsPerLoad * 10) / 10,
    mostUsedTruck,
    mostFrequentClient,
    totalWeightThisMonth: Math.round(totalWeightThisMonth * 100) / 100,
  };
}

/**
 * Exportar cargas a CSV
 */
export function exportLoadsToCSV(loads: Load[]): string {
  const headers = [
    'ID',
    'Fecha',
    'Camión',
    'Tipo Camión',
    'Cliente',
    'Dirección',
    'Items',
    'Cantidad Total',
    'Peso (Tn)',
    'Descripción',
  ];

  const rows = loads.map(load => {
    const totalQuantity = load.items.reduce((sum, item) => sum + item.quantity, 0);
    const totalWeight = calculateTotalWeight(load.items);

    return [
      load.id,
      formatLoadDate(load.date),
      load.truck?.name || '-',
      load.truck?.type || '-',
      load.deliveryClient || '-',
      load.deliveryAddress || '-',
      load.items.length,
      totalQuantity,
      totalWeight.toFixed(2),
      load.description || '-',
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  return csvContent;
}

/**
 * Exportar items de carga a CSV
 */
export function exportLoadItemsToCSV(load: Load): string {
  const headers = [
    'Posición',
    'Producto',
    'Cantidad',
    'Largo (m)',
    'Peso (kg)',
    'Paquetes',
    'Notas',
  ];

  const rows = load.items.map(item => [
    item.position + 1,
    item.productName,
    item.quantity,
    item.length?.toFixed(2) || '-',
    item.weight?.toFixed(2) || '-',
    calculatePackages(item),
    item.notes || '-',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  return csvContent;
}

/**
 * Descargar archivo CSV
 */
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * Obtener etiqueta de tipo de camión
 */
export function getTruckTypeLabel(type: string): string {
  switch (type) {
    case 'CHASIS':
      return 'Chasis';
    case 'EQUIPO':
      return 'Equipo';
    case 'SEMI':
      return 'Semi';
    default:
      return type;
  }
}

/**
 * Obtener color de badge según tipo de camión
 */
export function getTruckTypeColor(type: string): string {
  switch (type) {
    case 'CHASIS':
      return 'bg-blue-500';
    case 'EQUIPO':
      return 'bg-green-500';
    case 'SEMI':
      return 'bg-orange-500';
    default:
      return 'bg-gray-500';
  }
}

/**
 * Verificar si el peso excede la capacidad
 */
export function checkWeightCapacity(
  items: LoadItem[],
  truck: TruckData
): { exceeded: boolean; current: number; max: number } {
  const current = calculateTotalWeight(items);
  const max = truck.maxWeight || Infinity;
  return {
    exceeded: current > max,
    current,
    max,
  };
}

/**
 * Duplicar items de carga (resetear IDs)
 */
export function duplicateLoadItems(items: LoadItem[]): LoadItem[] {
  return items.map((item, index) => ({
    ...item,
    id: undefined,
    position: index,
  }));
}

/**
 * Generar descripción automática para carga
 */
export function generateLoadDescription(
  truck: TruckData,
  items: LoadItem[],
  date: Date
): string {
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const formattedDate = format(date, 'dd/MM', { locale: es });
  return `${truck.name} - ${totalQuantity} uds - ${formattedDate}`;
}

/**
 * Validar capacidad de carga para EQUIPO
 */
export function validateEquipoCapacity(
  chasisItems: LoadItem[],
  acopladoItems: LoadItem[],
  truck: TruckData
): {
  valid: boolean;
  errors: string[];
  chasisWeight: number;
  acopladoWeight: number;
} {
  const errors: string[] = [];
  const chasisWeight = calculateTotalWeight(chasisItems);
  const acopladoWeight = calculateTotalWeight(acopladoItems);

  if (truck.chasisWeight && chasisWeight > truck.chasisWeight) {
    errors.push(
      `Peso del chasis (${chasisWeight.toFixed(2)} Tn) excede el máximo (${truck.chasisWeight} Tn)`
    );
  }

  if (truck.acopladoWeight && acopladoWeight > truck.acopladoWeight) {
    errors.push(
      `Peso del acoplado (${acopladoWeight.toFixed(2)} Tn) excede el máximo (${truck.acopladoWeight} Tn)`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    chasisWeight,
    acopladoWeight,
  };
}

/**
 * Filtrar cargas por criterios
 */
export function filterLoads(
  loads: Load[],
  filters: {
    search?: string;
    truckType?: string;
    client?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }
): Load[] {
  return loads.filter(load => {
    // Filtro por búsqueda
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesDescription = load.description?.toLowerCase().includes(searchLower);
      const matchesTruck = load.truck?.name.toLowerCase().includes(searchLower);
      const matchesClient = load.deliveryClient?.toLowerCase().includes(searchLower);
      const matchesId = load.id.toString().includes(searchLower);

      if (!matchesDescription && !matchesTruck && !matchesClient && !matchesId) {
        return false;
      }
    }

    // Filtro por tipo de camión
    if (filters.truckType && filters.truckType !== 'ALL') {
      if (load.truck?.type !== filters.truckType) {
        return false;
      }
    }

    // Filtro por cliente
    if (filters.client && filters.client !== 'ALL') {
      if (load.deliveryClient !== filters.client) {
        return false;
      }
    }

    // Filtro por fecha desde
    if (filters.dateFrom) {
      if (new Date(load.date) < filters.dateFrom) {
        return false;
      }
    }

    // Filtro por fecha hasta
    if (filters.dateTo) {
      if (new Date(load.date) > filters.dateTo) {
        return false;
      }
    }

    return true;
  });
}
