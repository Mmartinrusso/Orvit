'use client';

import { useRef, useMemo, useEffect, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn, formatNumber } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Printer, X, Download } from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  TruckData,
  LoadItem,
  Load,
  GridPosition,
  PackagedItem,
} from '@/lib/cargas/types';
import {
  calculateOptimalLayout,
  calculateColumns,
  createGridVisualization,
} from '@/lib/cargas/calculate-optimal-layout';
import { exportLoadToPDF } from '@/lib/cargas/export-pdf';

interface PreCalculatedDistribution {
  chasisLayout: LoadItem[];
  acopladoLayout: LoadItem[];
  chasisGridViz: { [key: string]: LoadItem[] };
  acopladoGridViz: { [key: string]: LoadItem[] };
  chasisCols: number;
  acopladoCols: number;
  layoutItems: LoadItem[];
  gridVisualization: { [key: string]: LoadItem[] };
  fullCols: number;
}

interface LoadPrintViewProps {
  load: Load;
  onClose: () => void;
  hideOverlay?: boolean;
  hideButtons?: boolean;
  preCalculatedDistribution?: PreCalculatedDistribution;
}

export interface LoadPrintViewRef {
  handlePrint: () => void;
  handleExportPDF: () => void;
}

const LoadPrintView = forwardRef<LoadPrintViewRef, LoadPrintViewProps>(
  ({ load, onClose, hideOverlay = false, hideButtons = false, preCalculatedDistribution }, ref) => {
  const printRef = useRef<HTMLDivElement>(null);
  const { currentCompany } = useCompany();

  // Auto-imprimir cuando se monta el componente si viene del detalle
  useEffect(() => {
    // Verificar si hay un parámetro de auto-impresión en sessionStorage
    const shouldAutoPrint = sessionStorage.getItem('autoPrintLoad') === 'true';
    if (shouldAutoPrint) {
      sessionStorage.removeItem('autoPrintLoad');
      // Pequeño delay para asegurar que el contenido esté renderizado
      const timer = setTimeout(() => {
        if (printRef.current) {
          handlePrint();
          // Cerrar después de imprimir
          setTimeout(() => {
            onClose();
          }, 500);
        }
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [load]);

  // ✨ OPTIMIZACIÓN: Crear clave de cache más eficiente para evitar recálculos innecesarios
  const cacheKey = useMemo(() => {
    const itemsKey = load.items
      .filter(item => item.productId && item.quantity > 0)
      .map(item => `${item.productId}-${item.quantity}-${item.length || 0}`)
      .join('|');
    const truckKey = `${load.truck.id}-${load.truck.type}-${load.truck.length}-${load.truck.chasisLength || 0}-${load.truck.acopladoLength || 0}`;
    return `${itemsKey}::${truckKey}`;
  }, [load.items, load.truck]);

  // ✨ FIX: Usar distribución pre-calculada si está disponible, sino calcular internamente
  const { gridVisualization, chasisGridViz, acopladoGridViz, chasisLayout, acopladoLayout, chasisCols, acopladoCols } = useMemo(() => {
    // Si hay distribución pre-calculada, usarla directamente
    if (preCalculatedDistribution) {
      return {
        gridVisualization: preCalculatedDistribution.gridVisualization || {},
        chasisGridViz: preCalculatedDistribution.chasisGridViz || {},
        acopladoGridViz: preCalculatedDistribution.acopladoGridViz || {},
        chasisLayout: preCalculatedDistribution.chasisLayout || [],
        acopladoLayout: preCalculatedDistribution.acopladoLayout || [],
        chasisCols: preCalculatedDistribution.chasisCols || 3,
        acopladoCols: preCalculatedDistribution.acopladoCols || 3,
      };
    }
    
    // ✨ REFACTOR: Usar funciones importadas del módulo compartido
    const validItems = load.items.filter(item => item.productId && item.quantity > 0);

    if (validItems.length === 0) {
      return {
        gridVisualization: {},
        chasisGridViz: {},
        acopladoGridViz: {},
        chasisLayout: [],
        acopladoLayout: [],
        chasisCols: 3,
        acopladoCols: 3,
      };
    }

    // Para EQUIPO, calcular distribución separada
    if (load.truck.type === 'EQUIPO' && load.truck.chasisLength && load.truck.acopladoLength) {
      const chasisLength = load.truck.chasisLength;
      const acopladoLength = load.truck.acopladoLength;

      // Separar items según dónde caben
      const sortedItems = [...validItems].sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
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
        }
      }

      // Llenar chasis primero
      const chasisItems = [...itemsOnlyChasis, ...itemsBoth];
      chasisItems.sort((a, b) => (a.position ?? 999) - (b.position ?? 999));

      const chasisLayoutCalc = calculateOptimalLayout(chasisItems, load.truck, 'chasis');

      // Contar cantidades colocadas en chasis
      const chasisQuantityByProduct: { [productId: string]: number } = {};
      chasisLayoutCalc.forEach(item => {
        if (item.gridPosition) {
          chasisQuantityByProduct[item.productId] = (chasisQuantityByProduct[item.productId] || 0) + item.quantity;
        }
      });

      // Calcular items finales
      const finalChasisItems: LoadItem[] = [];
      const finalAcopladoItems: LoadItem[] = [];

      const allItemsByProduct: { [productId: string]: LoadItem[] } = {};
      sortedItems.forEach(item => {
        if (!allItemsByProduct[item.productId]) {
          allItemsByProduct[item.productId] = [];
        }
        allItemsByProduct[item.productId].push(item);
      });

      Object.keys(allItemsByProduct).forEach(productId => {
        const items = allItemsByProduct[productId];
        const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
        const itemLength = items[0].length || 0;

        const fitsChasis = itemLength <= chasisLength;
        const fitsAcoplado = itemLength <= acopladoLength;

        const quantityInChasis = fitsChasis ? (chasisQuantityByProduct[productId] || 0) : 0;
        const quantityInAcoplado = totalQuantity - quantityInChasis;

        if (quantityInChasis > 0) {
          finalChasisItems.push({ ...items[0], quantity: quantityInChasis });
        }

        if (quantityInAcoplado > 0 && fitsAcoplado) {
          finalAcopladoItems.push({ ...items[0], quantity: quantityInAcoplado });
        }
      });

      itemsOnlyAcoplado.forEach(item => {
        if (!finalAcopladoItems.find(i => i.productId === item.productId)) {
          finalAcopladoItems.push(item);
        }
      });

      finalChasisItems.sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
      finalAcopladoItems.sort((a, b) => (a.position ?? 999) - (b.position ?? 999));

      const finalChasisLayout = calculateOptimalLayout(finalChasisItems, load.truck, 'chasis');
      const finalAcopladoLayout = calculateOptimalLayout(finalAcopladoItems, load.truck, 'acoplado');

      return {
        gridVisualization: {},
        chasisGridViz: createGridVisualization(finalChasisLayout, 'chasis'),
        acopladoGridViz: createGridVisualization(finalAcopladoLayout, 'acoplado'),
        chasisLayout: finalChasisLayout,
        acopladoLayout: finalAcopladoLayout,
        chasisCols: calculateColumns(finalChasisItems, load.truck, 'chasis'),
        acopladoCols: calculateColumns(finalAcopladoItems, load.truck, 'acoplado'),
      };
    } else {
      // Para CHASIS o SEMI, distribución simple
      const fullLayout = calculateOptimalLayout(validItems, load.truck, 'full');

      return {
        gridVisualization: createGridVisualization(fullLayout),
        chasisGridViz: {},
        acopladoGridViz: {},
        chasisLayout: [],
        acopladoLayout: [],
        chasisCols: 3,
        acopladoCols: 3,
      };
    }
  }, [cacheKey, preCalculatedDistribution]);

  // ✨ OPTIMIZACIÓN: Memoizar función de renderizado para evitar recreaciones
  const renderGridVisualization = useCallback((
    gridViz: { [key: string]: LoadItem[] },
    layoutItems: LoadItem[],
    sectionPrefix: string = '',
    numCols: number = 3
  ) => {
    const prefix = sectionPrefix || '';
    
    // ✨ OPTIMIZACIÓN: Pre-calcular todas las claves posibles para evitar búsquedas repetidas
    const gridKeys = Object.keys(gridViz);
    
    return (
      <>
        {/* Grilla por pisos */}
        <div className="space-y-2">
          {[1, 2, 3, 4].map((floor) => {
            const rowsData: Array<{ row: number; cols: number[] }> = [];
            
            [1, 2, 3].forEach((row) => {
              const colsWithContent: number[] = [];
              // ✨ OPTIMIZACIÓN: Buscar solo en las claves que existen en lugar de iterar 50 veces
              const floorRowPrefix = prefix ? `${prefix}-${floor}-${row}-` : `${floor}-${row}-`;
              gridKeys.forEach(key => {
                if (key.startsWith(floorRowPrefix)) {
                  const col = parseInt(key.split('-').pop() || '0');
                  if (col > 0 && gridViz[key]?.length > 0) {
                  colsWithContent.push(col);
                }
              }
              });
              
              if (colsWithContent.length > 0) {
                colsWithContent.sort((a, b) => a - b);
                rowsData.push({ row, cols: colsWithContent });
              }
            });
            
            // Solo renderizar pisos que tienen contenido
            if (rowsData.length === 0) {
              return null;
            }
            
            return (
              <div key={floor} className={cn('space-y-2 print-floor-container', floor > 1 && 'floor-divider')}>
                <div className="flex items-center gap-2 print-floor-header">
                  <Badge variant={floor === 4 ? 'default' : floor === 3 ? 'secondary' : floor === 2 ? 'outline' : 'secondary'} className="print-floor-badge">
                    Piso {floor}
                  </Badge>
                  <span className="text-xs text-muted-foreground print-floor-label" style={{ fontSize: '11px' }}>
                    {floor === 4 ? '(Arriba)' : 
                     floor === 3 ? '(Medio-Alto)' : 
                     floor === 2 ? '(Medio)' : 
                     '(Abajo)'}
                  </span>
                </div>
                  <div className="space-y-2">
                    {rowsData.map(({ row, cols }, rowIndex) => (
                      <div key={row} className={cn('flex gap-1.5', rowIndex < rowsData.length - 1 && 'grid-row-divider')}>
                        <div className="flex items-center justify-center w-10 text-xs font-semibold text-muted-foreground" style={{ fontSize: '11px' }}>
                          F{row}
                        </div>
                        <div className="flex-1 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
                          {cols.map((col, colIndex) => {
                            const key = prefix ? `${prefix}-${floor}-${row}-${col}` : `${floor}-${row}-${col}`;
                            const itemsInPosition = gridViz[key] || [];
                            
                            return (
                              <div
                                key={col}
                                className={cn('border-2 rounded p-2 min-h-[70px] text-xs bg-primary/20 border-primary', colIndex < cols.length - 1 && 'grid-col-divider')}
                                data-col={col}
                              >
                                <div className="font-semibold text-center mb-1 print-cell-label" style={{ fontSize: '11px', lineHeight: '1' }}>
                                  C{col}
                                </div>
                                <div className="cell-content">
                                  {itemsInPosition[0] && (() => {
                                    const item = itemsInPosition[0];
                                    return (
                                      <div className="text-center print-cell-content" style={{ fontSize: '11px', lineHeight: '1.3' }}>
                                        <span className="print-col-label" style={{ display: 'none' }}>C{col} </span>
                                        {item.length && (
                                          <span className="font-semibold print-length" style={{ fontSize: '11px' }}>
                                            {item.length}Mts
                                          </span>
                                        )}
                                        <span className="print-package" style={{ fontSize: '10px', marginLeft: '0.2em' }}>
                                          - 1 pqt
                                        </span>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
              </div>
            );
          })}
        </div>

      </>
    );
  }, []); // ✨ OPTIMIZACIÓN: Función memoizada, no depende de props del componente

  const totalLength = load.items.reduce(
    (sum, item) => sum + (item.length || 0) * item.quantity,
    0
  );
  const totalWeight = load.items.reduce(
    (sum, item) => sum + (item.weight || 0) * item.quantity,
    0
  );

  const handlePrint = () => {
    if (!printRef.current) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let printContent = printRef.current.innerHTML;
    
    // Ocultar badge de posiciones directamente en el HTML
    printContent = printContent.replace(
      /<div[^>]*class="[^"]*print-pos-badge[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
      ''
    );
    // También buscar por el texto "pos" dentro de badges
    printContent = printContent.replace(
      /<[^>]*class="[^"]*badge[^"]*"[^>]*>[\s\S]*?\/\s*\d+\s*pos[\s\S]*?<\/[^>]*>/gi,
      ''
    );
    const style = `
      <style>
        @page {
          size: A4 landscape;
          margin: 0.2cm;
        }
         * {
           box-sizing: border-box;
           margin: 0;
           padding: 0;
         }
         body {
           font-family: Arial, sans-serif;
           margin: 0;
           padding: 0.3cm;
           font-size: 10px;
           position: relative;
           width: 100%;
           height: 100%;
           background: #fff !important;
           overflow: hidden;
           line-height: 1.3;
         }
         html {
           height: 100%;
           overflow: hidden;
         }
        .print-header {
          text-align: center;
          margin-bottom: 0.15cm;
          margin-top: 0;
          border-bottom: 2px solid #000;
          padding-bottom: 0.1cm;
          display: block !important;
          visibility: visible !important;
        }
        .print-header h1 {
          margin: 0;
          font-size: 24px !important;
          line-height: 1.3 !important;
          font-weight: bold !important;
        }
        .print-header p {
          margin: 0;
          font-size: 14px !important;
          line-height: 1.3 !important;
        }
        /* Tamaños acordes para impresión - APLICAR DIRECTAMENTE */
        [class*="badge"],
        .print-floor-badge,
        .space-y-2 [class*="badge"],
        .space-y-3 [class*="badge"] {
          font-size: 14px !important;
          padding: 0.15cm 0.2cm !important;
          font-weight: bold !important;
          display: inline-block !important;
        }
        .print-floor-label,
        .text-xs.text-muted-foreground,
        .space-y-2 .text-xs {
          font-size: 12px !important;
        }
        label.print-section-title,
        .print-section-title,
        label {
          font-size: 16px !important;
          font-weight: bold !important;
        }
        /* Asegurar que los elementos de piso sean proporcionales */
        .print-floor-header {
          margin-bottom: 0.2cm !important;
        }
        .print-floor-header [class*="badge"] {
          font-size: 14px !important;
          padding: 0.15cm 0.2cm !important;
        }
        .print-floor-header .text-xs {
          font-size: 12px !important;
        }
        /* Achicar etiquetas de fila F1, F2, F3 */
        .w-10,
        .flex.items-center.justify-center.w-10 {
          width: 0.3cm !important;
          font-size: 8px !important;
          font-weight: bold !important;
        }
        /* Bordes redondeados suaves */
        .rounded,
        .rounded-lg {
          border-radius: 2px !important;
        }
        .divider {
          border-top: 1px solid #ccc;
          margin: 0.1cm 0;
        }
        .divider-before-materials,
        .divider-after-materials {
          display: none !important;
        }
        /* Ocultar materiales y resumen en la ventana de impresión */
        .materials-list,
        .print-summary {
          display: none !important;
          visibility: hidden !important;
        }
        .print-info {
          display: grid !important;
          grid-template-columns: repeat(3, 1fr) !important;
          gap: 0.15cm !important;
          margin-bottom: 0.15cm !important;
          visibility: visible !important;
        }
        .print-info-item {
          padding: 0.15cm 0.3cm !important;
          background: #fff !important;
          border-radius: 2px;
          font-size: 16px !important;
          border: 1px solid #ddd;
          line-height: 1.4 !important;
        }
        .print-info-item strong {
          display: inline;
          margin-right: 0.2cm;
          font-size: 16px !important;
          font-weight: bold !important;
        }
        .print-info-item * {
          font-size: 16px !important;
        }
        .grid-section {
          margin: 5px 0;
          border: 1px solid #000;
          border-radius: 5px;
          padding: 4px;
          background: #fff !important;
        }
        .grid-section-title {
          text-align: center;
          font-weight: bold;
          font-size: 9px;
          margin-bottom: 3px;
          padding: 3px;
          background: #fff !important;
          border-radius: 3px;
          border: 1px solid #000;
        }
        .grid-floor {
          margin-bottom: 3px;
        }
        .grid-floor-title {
          font-weight: bold;
          margin-bottom: 10px;
          padding: 5px;
          background: #f0f0f0;
          border-radius: 3px;
        }
        .grid-row {
          display: flex;
          gap: 5px;
          margin-bottom: 5px;
        }
        .grid-cell {
          border: 1px solid #333;
          border-radius: 3px;
          padding: 5px;
          min-height: 50px;
          background: #e3f2fd;
          font-size: 10px;
        }
        .grid-cell-label {
          font-weight: bold;
          text-align: center;
          margin-bottom: 3px;
        }
        .print-summary {
          margin-top: 0.15cm;
          padding: 0.15cm;
          background: #fff !important;
          border-radius: 2px;
          border: 1px solid #ddd;
          display: none !important;
        }
        .print-summary h3 {
          margin-top: 0;
          font-size: 10px;
          margin-bottom: 0.1cm;
          font-weight: bold;
        }
        .print-summary table {
          width: 100%;
          border-collapse: collapse;
          font-size: 8px;
        }
        .print-summary td {
          padding: 0.1cm;
          border-bottom: 1px solid #ddd;
          line-height: 1.3;
        }
        .print-summary td:first-child {
          font-weight: bold;
        }
        .materials-list {
          margin: 0.1cm 0;
          padding: 0.1cm;
          background: #fff !important;
          border-radius: 1px;
          border: 1px solid #ffc107;
          display: none !important;
        }
        .materials-list h3 {
          margin-top: 0;
          margin-bottom: 0.1cm;
          font-size: 11px;
          line-height: 1.2;
          font-weight: bold;
        }
        .materials-list > div {
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: 0.1cm;
          font-size: 7px;
          line-height: 1.2;
          padding: 0.1cm;
        }
        .materials-list > div > div {
          padding: 0.1cm;
          font-size: 7px;
          line-height: 1.2;
        }
        /* Estilos para la distribución - igual que el modal */
        .space-y-4 {
          display: flex;
          flex-direction: column;
          gap: 0.1rem;
        }
        .p-4 {
          padding: 0.1rem;
        }
        .border {
          border: 1px solid #e5e7eb;
        }
        .rounded-lg {
          border-radius: 0.3rem;
        }
        .bg-muted\\/30 {
          background-color: #fff !important;
        }
        .bg-background {
          background-color: #fff !important;
        }
        .text-base {
          font-size: 0.6rem;
        }
        .font-semibold {
          font-weight: 600;
        }
        .text-xs {
          font-size: 0.5rem;
        }
        .text-muted-foreground {
          color: #6b7280;
        }
        .mb-4 {
          margin-bottom: 0.3rem;
        }
        .mb-6 {
          margin-bottom: 0.1rem;
        }
        .mb-2 {
          margin-bottom: 0.1rem;
        }
        .mb-1 {
          margin-bottom: 0.05rem;
        }
        .space-y-6 {
          display: flex;
          flex-direction: column;
          gap: 0.05cm !important;
        }
        .space-y-4 {
          display: flex;
          flex-direction: column;
          gap: 0.05cm !important;
        }
        .space-y-3 {
          display: flex;
          flex-direction: column;
          gap: 0.05cm !important;
        }
        .space-y-2 {
          display: flex;
          flex-direction: column;
          gap: 0.03cm !important;
        }
        .flex {
          display: flex;
        }
        .items-center {
          align-items: center;
        }
        .justify-between {
          justify-content: space-between;
        }
        .gap-2 {
          gap: 0.1rem;
        }
        .gap-1 {
          gap: 0.05rem;
        }
        .gap-1\\.5 {
          gap: 0.1rem;
        }
        .w-12 {
          width: 1.5rem;
        }
        .flex-1 {
          flex: 1;
        }
        .grid {
          display: grid;
        }
        .min-h-\\[60px\\] {
          min-height: 20px;
        }
        .border-2 {
          border-width: 1px;
        }
        .rounded {
          border-radius: 0.1rem;
        }
        .p-2, .p-3, .p-4 {
          padding: 0.1cm !important;
        }
        .p-1\.5 {
          padding: 0.08cm !important;
        }
        .mb-4, .mb-6 {
          margin-bottom: 0.1cm !important;
        }
        .mb-2, .mb-3 {
          margin-bottom: 0.05cm !important;
        }
        .mt-4, .mt-6 {
          margin-top: 0.1cm !important;
        }
        .bg-primary\\/20 {
          background-color: #fff !important;
          border: 1px solid #3b82f6;
        }
        .border-primary {
          border-color: #3b82f6;
        }
        /* Divisores para filas y columnas */
        .grid-row-divider {
          border-bottom: 2px solid #666;
          margin-bottom: 0.15rem;
          padding-bottom: 0.15rem;
        }
        .grid-col-divider {
          border-right: 2px solid #666;
        }
        .grid-col-divider:last-child {
          border-right: none;
        }
        /* Divisor entre pisos */
        .floor-divider {
          border-top: 3px solid #000;
          margin-top: 0.2rem;
          margin-bottom: 0.2rem;
          padding-top: 0.2rem;
        }
        .floor-divider:first-child {
          border-top: none;
          margin-top: 0;
          padding-top: 0;
        }
        /* Asegurar que los pisos vacíos se muestren al imprimir */
        .print-floor-empty {
          display: block !important;
          font-size: 5px !important;
          padding: 2px !important;
        }
        /* Ocultar badge de posiciones en estilos base */
        .print-pos-badge {
          display: none !important;
        }
        .space-y-6 > div {
          page-break-inside: avoid;
          margin-bottom: 0.05rem !important;
        }
        /* Centrar nombre de vigueta */
        .vigueta-name {
          text-align: center;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 1em;
          line-height: 1.1;
        }
        /* Reducir espacio en celdas */
        .cell-content {
          line-height: 1.1;
        }
        .cell-content > div {
          margin: 0;
          padding: 0;
        }
        /* Sin saltos de página - todo en una hoja */
        .page-break-after {
          page-break-after: avoid;
        }
        .page-break-before {
          page-break-before: avoid;
        }
        .font-medium {
          font-weight: 500;
        }
        .truncate {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .text-center {
          text-align: center;
        }
        .mb-1 {
          margin-bottom: 0.25rem;
        }
        .leading-tight {
          line-height: 1.25;
        }
        .text-\\[10px\\] {
          font-size: 6px;
        }
        .mt-4 {
          margin-top: 0.3rem;
        }
        .grid-cols-2 {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }
        .grid-cols-1 {
          grid-template-columns: repeat(1, minmax(0, 1fr));
        }
        /* Forzar dos columnas en impresión para EQUIPO */
        .grid.grid-cols-1.lg\\:grid-cols-2,
        .print-two-columns {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          display: grid !important;
        }
        .print-two-columns > div {
          width: 100% !important;
          max-width: 100% !important;
        }
        /* Reducir tamaño de las grillas en impresión */
        .space-y-3, .space-y-4 {
          gap: 0.2rem !important;
        }
        .p-3, .p-4 {
          padding: 0.2rem !important;
        }
        .text-sm {
          font-size: 0.7rem;
        }
        .text-destructive {
          color: #ef4444;
        }
        .pl-2 {
          padding-left: 0.5rem;
        }
        .border-l-2 {
          border-left-width: 2px;
        }
        .border-destructive {
          border-color: #ef4444;
        }
        /* Badge styles */
        .inline-flex {
          display: inline-flex;
        }
        .rounded-full {
          border-radius: 9999px;
        }
        .px-2\\.5 {
          padding-left: 0.625rem;
          padding-right: 0.625rem;
        }
        .py-0\\.5 {
          padding-top: 0.125rem;
          padding-bottom: 0.125rem;
        }
        /* Reducir tamaño de badges */
        [class*="badge"] {
          font-size: 2px !important;
          padding: 0.01cm 0.03cm !important;
          line-height: 1 !important;
        }
        /* Reducir tamaño de labels */
        label {
          font-size: 2.5px !important;
        }
        /* Reducir tamaño de texto en grillas */
        .text-xs, .text-sm, .text-base {
          font-size: 2px !important;
        }
        .text-lg {
          font-size: 2.5px !important;
        }
        /* Celdas de grilla más compactas */
        .border-2 {
          border-width: 1px !important;
          padding: 0.02cm !important;
          min-height: 8px !important;
          font-size: 2px !important;
        }
        /* Reducir gaps en grillas */
        .gap-1\.5, .gap-2, .gap-3, .gap-4, .gap-6 {
          gap: 0.02cm !important;
        }
        /* Reducir tamaño de badges en grillas */
        .print-preview [class*="badge"] {
          font-size: 2.5px !important;
          padding: 0.01cm 0.03cm !important;
        }
        /* Reducir tamaño de texto en celdas de grilla */
        .print-preview .border-2 > div {
          font-size: 2px !important;
          line-height: 1 !important;
        }
        /* Reducir ancho de etiquetas de fila */
        .w-10 {
          width: 0.25cm !important;
          font-size: 2px !important;
        }
        /* Optimizar espacios en la grilla */
        .space-y-4 > * + * {
          margin-top: 0.1rem !important;
        }
        .space-y-6 > * + * {
          margin-top: 0.1rem !important;
        }
         @media print {
           .no-print {
             display: none !important;
           }
           /* Ocultar materiales a cargar y resumen de carga en impresión */
           .materials-list,
           .print-preview .materials-list,
           [class*="materials-list"] {
             display: none !important;
             visibility: hidden !important;
           }
           .print-summary,
           .print-preview .print-summary,
           [class*="print-summary"] {
             display: none !important;
             visibility: hidden !important;
           }
           .divider-before-materials,
           .divider-after-materials,
           .print-preview .divider-before-materials,
           .print-preview .divider-after-materials {
             display: none !important;
             visibility: hidden !important;
           }
           body {
             margin: 0;
             padding: 0;
             height: 100vh;
             overflow: hidden;
           }
           html {
             height: 100%;
             overflow: hidden;
           }
           @page {
             size: A4 landscape;
             margin: 0.2cm;
             /* Ocultar encabezados y pies de página del navegador */
             marks: none;
           }
           /* Forzar que todo quepa en 1 hoja - evitar saltos de página */
           * {
             page-break-inside: avoid !important;
             page-break-after: avoid !important;
             page-break-before: avoid !important;
           }
           body > * {
             page-break-inside: avoid !important;
           }
           /* Asegurar que el contenido no exceda el tamaño de la página */
           body {
             max-height: 100vh !important;
             overflow: hidden !important;
             height: 100vh !important;
             padding: 0.1cm !important;
           }
           html {
             height: 100% !important;
             overflow: hidden !important;
           }
           /* Limitar altura del contenido principal */
           body > div {
             max-height: calc(100vh - 0.4cm) !important;
             overflow: hidden !important;
           }
           /* Asegurar que todo quepa - reducir escala si es necesario */
           .print-preview {
             transform: scale(0.95);
             transform-origin: top left;
             width: 105.26%;
             height: 105.26%;
           }
           /* Reducir aún más los espacios en impresión */
           .print-preview .space-y-2 > * {
             margin-bottom: 0.02cm !important;
           }
           .print-preview .space-y-2 > *:last-child {
             margin-bottom: 0 !important;
           }
           /* Aumentar tamaño de header e info en impresión */
           .print-preview .print-header {
             display: block !important;
             visibility: visible !important;
           }
           .print-preview .print-header h1 {
             font-size: 24px !important;
             display: block !important;
             visibility: visible !important;
           }
           .print-preview .print-header p {
             font-size: 14px !important;
             display: block !important;
             visibility: visible !important;
           }
           .print-preview .print-info {
             display: grid !important;
             visibility: visible !important;
           }
           .print-preview .print-info-item {
             font-size: 16px !important;
             display: block !important;
             visibility: visible !important;
             opacity: 1 !important;
             padding: 0.15cm 0.3cm !important;
             line-height: 1.4 !important;
           }
           .print-preview .print-info-item strong {
             font-size: 16px !important;
             display: inline !important;
             margin-right: 0.2cm !important;
             visibility: visible !important;
           }
           .print-preview .print-info-item * {
             font-size: 16px !important;
           }
           /* Tamaños específicos - DEBE IR DESPUÉS para sobrescribir el * */
           .print-preview .print-info-item .print-truck-name {
             font-size: 13px !important;
             font-weight: bold !important;
           }
           .print-preview .print-info-item .print-truck-size {
             font-size: 12px !important;
           }
           .print-preview .print-info-item .print-label-capacity,
           .print-preview .print-info-item .print-label-total {
             font-size: 13px !important;
           }
           .print-preview .print-info-item .print-capacity-value,
           .print-preview .print-info-item .print-total-value {
             font-size: 13px !important;
           }
           /* Aumentar tamaño de materiales en impresión */
           .print-preview .materials-list h3 {
             font-size: 6px !important;
           }
           .print-preview .materials-list > div {
             font-size: 4.5px !important;
           }
           .print-preview .materials-list > div > div {
             font-size: 4.5px !important;
           }
           /* Formato horizontal en celdas SOLO EN IMPRESIÓN */
           .print-preview .border-2 {
             padding: 0.1cm !important;
             min-height: 20px !important;
             font-size: 6px !important;
           }
           .print-preview .border-2 .print-cell-label {
             display: none !important;
           }
           .print-preview .border-2 .cell-content {
             display: flex !important;
             flex-direction: row !important;
             align-items: center !important;
             justify-content: center !important;
             gap: 0.1cm !important;
             font-size: 6px !important;
             line-height: 1.2 !important;
           }
           .print-preview .border-2 .cell-content .print-col-label {
             display: inline !important;
             font-weight: bold !important;
             margin-right: 0.1cm !important;
             font-size: 6px !important;
           }
           .print-preview .border-2 .cell-content .print-length {
             display: inline !important;
             font-weight: bold !important;
             margin-right: 0.1cm !important;
             font-size: 6px !important;
           }
           .print-preview .border-2 .cell-content .print-package {
             display: inline !important;
             font-size: 6px !important;
             margin-left: 0 !important;
           }
           .print-preview .border-2 .cell-content > div {
             display: contents !important;
           }
           /* Agrandar tamaño de badges y texto de pisos en impresión */
           /* Agrandar tamaño de badges y texto de pisos - SOBRESCRIBIR TODO */
           .print-preview .space-y-2 [class*="badge"],
           .print-preview [class*="badge"],
           .print-preview .print-floor-badge {
             font-size: 28px !important;
             padding: 0.4cm 0.5cm !important;
             font-weight: bold !important;
             display: inline-block !important;
             visibility: visible !important;
             line-height: 1.5 !important;
           }
           .print-preview .space-y-2 .text-xs,
           .print-preview .print-floor-label {
             font-size: 18px !important;
             font-weight: normal !important;
             visibility: visible !important;
           }
           .print-preview .space-y-2 .flex.items-center.gap-2 {
             font-size: 18px !important;
             visibility: visible !important;
           }
           /* Agrandar etiquetas de piso */
           .print-preview .space-y-2 > div > div:first-child {
             font-size: 18px !important;
             visibility: visible !important;
           }
           /* Asegurar que los badges de piso sean visibles */
           .print-preview [class*="badge"] {
             display: inline-block !important;
             visibility: visible !important;
             opacity: 1 !important;
           }
           /* Estilos específicos para headers de piso */
           .print-preview .print-floor-header {
             display: flex !important;
             visibility: visible !important;
             margin-bottom: 0.2cm !important;
             padding: 0.1cm 0 !important;
           }
           .print-preview .print-floor-badge {
             font-size: 28px !important;
             padding: 0.4cm 0.5cm !important;
             font-weight: bold !important;
             display: inline-block !important;
             visibility: visible !important;
             opacity: 1 !important;
             min-width: auto !important;
             height: auto !important;
             line-height: 1.5 !important;
           }
           .print-preview .print-floor-badge * {
             font-size: 28px !important;
           }
           .print-preview .print-floor-label {
             font-size: 24px !important;
             display: inline-block !important;
             visibility: visible !important;
             opacity: 1 !important;
             margin-left: 0.3cm !important;
             font-weight: normal !important;
           }
           /* Asegurar que todos los badges sean grandes */
           .print-preview [class*="badge"] {
             font-size: 28px !important;
             padding: 0.4cm 0.5cm !important;
           }
           /* Agrandar títulos de Chasis y Acoplado - SOBRESCRIBIR TODO CON MÁXIMA ESPECIFICIDAD */
           .print-preview .print-section-header {
             display: flex !important;
             visibility: visible !important;
             margin-bottom: 0.3cm !important;
           }
           .print-preview .print-section-title,
           .print-preview label.print-section-title,
           .print-preview .space-y-2 ~ div label,
           .print-preview .space-y-3 ~ div label,
           .print-preview label,
           .print-preview .print-section-header label,
           .print-preview .space-y-2 label,
           .print-preview .space-y-3 label,
           .print-preview .space-y-4 label,
           .print-preview div label {
             font-size: 20px !important;
             font-weight: bold !important;
             visibility: visible !important;
             display: inline-block !important;
             opacity: 1 !important;
             line-height: 1.5 !important;
           }
           /* Reducir espacios en pisos en impresión */
           .print-preview .floor-divider {
             margin-top: 0.1cm !important;
             margin-bottom: 0.1cm !important;
             padding-top: 0.1cm !important;
             border-top-width: 1px !important;
           }
           .print-preview .print-floor-empty {
             display: none !important;
           }
           /* Achicar etiquetas de fila F1, F2, F3 en impresión */
           .print-preview .w-10 {
             width: 0.3cm !important;
             font-size: 8px !important;
             font-weight: bold !important;
           }
           /* Bordes ultra finos y necesarios para organizar */
           /* Borde inferior del header */
           .print-preview .print-header {
             border-bottom: 0.1px solid #ccc !important;
           }
           /* Bordes ultra finos para los items de información */
           .print-preview .print-info-item {
             border: 0.1px solid #ddd !important;
           }
           /* Bordes ultra finos para separar Chasis y Acoplado */
           .print-preview .space-y-2.p-3,
           .print-preview .space-y-2.p-4,
           .print-preview .space-y-3.p-3,
           .print-preview .space-y-3.p-4,
           .print-preview .space-y-2,
           .print-preview .space-y-3 {
             border: 0.1px solid #ccc !important;
             border-width: 0.1px !important;
             border-style: solid !important;
             border-color: #ccc !important;
           }
           /* Bordes ultra finos para separar pisos (Piso 1, Piso 2, etc.) */
           .print-preview .floor-divider {
             border-top: 0.1px solid #ccc !important;
             border-width: 0.1px !important;
             border-style: solid !important;
             border-color: #ccc !important;
           }
           /* Bordes ultra finos para las celdas C1, C2, C3 */
           .print-preview .border-2 {
             border: 0.1px solid #ddd !important;
             border-width: 0.1px !important;
             border-style: solid !important;
             border-color: #ddd !important;
             padding: 0.15cm !important;
             min-height: 25px !important;
             font-size: 9px !important;
           }
           /* Asegurar que los bordes se vean - FORZAR CON MÁXIMA ESPECIFICIDAD */
           .print-preview * {
             border-style: solid !important;
           }
           .print-preview .print-header {
             border-bottom: 0.1px solid #ccc !important;
             border-top: none !important;
             border-left: none !important;
             border-right: none !important;
           }
           .print-preview .print-info-item {
             border: 0.1px solid #ddd !important;
           }
           .print-preview .space-y-2,
           .print-preview .space-y-3,
           .print-preview .space-y-2.p-3,
           .print-preview .space-y-2.p-4,
           .print-preview .space-y-3.p-3,
           .print-preview .space-y-3.p-4 {
             border: 0.1px solid #ccc !important;
           }
           .print-preview .floor-divider {
             border-top: 0.1px solid #ccc !important;
             border-bottom: none !important;
             border-left: none !important;
             border-right: none !important;
           }
           .print-preview .border-2 {
             border: 0.1px solid #ddd !important;
           }
           /* Bordes redondeados suaves */
           .print-preview .rounded,
           .print-preview .rounded-lg {
             border-radius: 2px !important;
           }
           .print-preview .border-2 .cell-content {
             font-size: 9px !important;
           }
           .print-preview .border-2 .cell-content .print-col-label {
             font-size: 9px !important;
           }
           .print-preview .border-2 .cell-content .print-length {
             font-size: 9px !important;
           }
           .print-preview .border-2 .cell-content .print-package {
             font-size: 9px !important;
           }
           /* Resumen de carga en formato texto en línea separado por / */
           .print-preview .print-summary {
             border: none !important;
             padding: 0.1cm 0 !important;
             margin-top: 0.1cm !important;
             background: transparent !important;
           }
           .print-preview .print-summary h3 {
             font-size: 10px !important;
             margin-bottom: 0 !important;
             display: inline !important;
             margin-right: 0.15cm !important;
             font-weight: bold !important;
           }
           .print-preview .print-summary table {
             display: none !important;
           }
           .print-preview .print-summary-text {
             display: inline !important;
             font-size: 8px !important;
             font-weight: normal !important;
             margin-left: 0.15cm !important;
           }
           /* Ocultar completamente el resumen de carga en impresión */
           .print-preview .print-summary {
             display: none !important;
           }
           /* Ocultar materiales a cargar y sus divisores en impresión */
           .print-preview .materials-list {
             display: none !important;
           }
           /* Ocultar divisores antes y después de materiales */
           .print-preview .divider-before-materials,
           .print-preview .divider-after-materials {
             display: none !important;
           }
         }
         /* BORDES FINOS - SIMPLE Y DIRECTO */
         .print-preview .print-header {
           border-bottom: 1px solid #e0e0e0 !important;
         }
         .print-preview .print-info-item {
           border: 1px solid #e0e0e0 !important;
         }
         .print-preview .space-y-2.p-3,
         .print-preview .space-y-2.p-4,
         .print-preview .space-y-3.p-3,
         .print-preview .space-y-3.p-4 {
           border: 1px solid #d0d0d0 !important;
         }
         .print-preview .floor-divider {
           border-top: 1px solid #d0d0d0 !important;
         }
         .print-preview .border-2 {
           border: 1px solid #e0e0e0 !important;
         }
         /* Tamaños de texto específicos para información del camión - MÁXIMA ESPECIFICIDAD */
         .print-preview .print-info-item .print-truck-name {
           font-size: 13px !important;
           font-weight: bold !important;
         }
         .print-preview .print-info-item .print-truck-size {
           font-size: 12px !important;
         }
         .print-preview .print-info-item .print-label-capacity,
         .print-preview .print-info-item .print-label-total {
           font-size: 13px !important;
         }
         .print-preview .print-info-item .print-capacity-value,
         .print-preview .print-info-item .print-total-value {
           font-size: 13px !important;
         }
         /* Ocultar pisos vacíos completamente en impresión */
         .print-preview .print-floor-empty-container {
           display: none !important;
         }
         .print-preview .print-floor-empty {
           display: none !important;
         }
         /* Ocultar badge de posiciones - MÚLTIPLES SELECTORES */
         .print-preview .print-pos-badge,
         .print-preview .print-section-header .badge,
         .print-preview .print-section-header [class*="badge"],
         .print-preview [class*="badge"][class*="secondary"],
         .print-preview .print-section-header > *:last-child {
           display: none !important;
           visibility: hidden !important;
         }
         /* Fecha arriba a la izquierda */
         .print-preview .print-date-top {
           position: absolute !important;
           top: 0 !important;
           left: 0 !important;
           font-size: 10px !important;
           color: #666 !important;
           padding: 4px !important;
           z-index: 10 !important;
         }
         /* ID arriba a la derecha */
         .print-preview .print-id-top {
           position: absolute !important;
           top: 0 !important;
           right: 0 !important;
           font-size: 10px !important;
           color: #666 !important;
           padding: 4px !important;
           z-index: 10 !important;
           font-weight: bold !important;
         }
      </style>
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title> </title>
          <meta name="robots" content="noindex">
          <style>
            @media print {
              @page {
                margin: 0.3cm;
                size: A4 landscape;
              }
              /* Intentar ocultar encabezados del navegador */
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
          ${style}
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `);

    printWindow.document.close();
    
    // Agregar script para limpiar título y aplicar bordes finos
    const script = printWindow.document.createElement('script');
    script.textContent = `
      // Limpiar título para evitar que aparezca en encabezados del navegador
      document.title = ' ';
      
      // Intentar interceptar antes de imprimir
      window.addEventListener('beforeprint', function() {
        document.title = ' ';
      });
      
      window.addEventListener('afterprint', function() {
        setTimeout(function() {
          window.close();
        }, 100);
      });
    `;
    printWindow.document.head.appendChild(script);
    
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      // Cerrar después de un tiempo si no se cerró automáticamente
      setTimeout(() => {
        if (!printWindow.closed) {
          printWindow.close();
        }
      }, 1000);
    }, 300);
  };

  // Exponer handlePrint mediante useImperativeHandle
  useImperativeHandle(ref, () => ({
    handlePrint,
  }));

  // Auto-imprimir cuando se monta el componente si viene del detalle
  useEffect(() => {
    // Verificar si hay un parámetro de auto-impresión en sessionStorage
    const shouldAutoPrint = sessionStorage.getItem('autoPrintLoad') === 'true';
    if (shouldAutoPrint) {
      sessionStorage.removeItem('autoPrintLoad');
      // Delay para asegurar que el contenido esté completamente renderizado (especialmente la distribución)
      const timer = setTimeout(() => {
        if (printRef.current) {
          handlePrint();
          // Cerrar después de iniciar la impresión
          setTimeout(() => {
            onClose();
          }, 500);
        }
      }, 800);
      
      return () => clearTimeout(timer);
    }
  }, [load]);

  // ✨ FIX: Ordenar items por position antes de agrupar para mantener el orden del usuario
  const sortedItemsForMaterials = [...load.items].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  
  // Agrupar materiales por producto (usando Map para mantener orden de inserción)
  const materialsByProductMap = new Map<string, { name: string; length: number | null; totalQuantity: number; totalPackages: number; position: number }>();
  sortedItemsForMaterials.forEach((item) => {
    if (!item.productId) return;
    const key = item.productId;
    if (!materialsByProductMap.has(key)) {
      materialsByProductMap.set(key, {
        name: item.productName,
        length: item.length ?? null,
        totalQuantity: 0,
        totalPackages: 0,
        position: item.position ?? 999,
      });
    }
    const material = materialsByProductMap.get(key)!;
    material.totalQuantity += item.quantity;
    const MIN_LENGTH_FOR_PACKAGE = 5.80;
    const PACKAGE_SIZE_LARGE = 10;
    const PACKAGE_SIZE_SMALL = 20;
    const usesLargePackage = (item.length || 0) >= MIN_LENGTH_FOR_PACKAGE;
    const packageSize = usesLargePackage ? PACKAGE_SIZE_LARGE : PACKAGE_SIZE_SMALL;
    material.totalPackages += Math.ceil(item.quantity / packageSize);
  });
  
  // Convertir Map a array ordenado por position
  const materialsByProduct = Array.from(materialsByProductMap.values()).sort((a, b) => a.position - b.position);

  // Contenido del printRef (reutilizable)
  const printContent = (
    <>
          <style>{`
            /* Aplicar estilos de impresión al modal */
            .print-preview * {
              font-family: Arial, sans-serif;
            }
            .print-preview {
              font-size: 11px;
              background: #fff;
            }
            .print-preview .print-header {
              text-align: center;
              margin-bottom: 2px;
              margin-top: 0;
              border-bottom: 1px solid #000;
              padding-bottom: 2px;
            }
            .print-preview .print-header h1 {
              margin: 0;
              font-size: 18px;
              font-weight: bold;
            }
            .print-preview .print-info {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 3px;
              margin-bottom: 3px;
            }
            .print-preview .print-info-item {
              padding: 4px 8px !important;
              background: #fff !important;
              border-radius: 4px;
              font-size: 11px;
              border: 1px solid #ddd;
            }
            .print-preview .materials-list {
              margin: 2px 0;
              padding: 2px;
              background: #fff !important;
              border-radius: 2px;
              border: 1px solid #ffc107;
            }
            .print-preview .materials-list h3 {
              margin-top: 0;
              margin-bottom: 6px;
              font-size: 14px;
              font-weight: bold;
            }
            .print-preview .materials-list > div {
              display: grid;
              grid-template-columns: repeat(8, 1fr);
              gap: 6px;
              font-size: 11px;
              line-height: 1.4;
              padding: 8px;
            }
            .print-preview .materials-list > div > div {
              padding: 6px 8px;
              background: #fff3cd;
              border: 1px solid #ffc107;
              border-radius: 4px;
              text-align: center;
            }
            .print-preview .bg-muted\\/30 {
              background-color: #fff !important;
            }
            .print-preview .bg-background {
              background-color: #fff !important;
            }
            .print-preview .bg-primary\\/20 {
              background-color: #fff !important;
              border: 1px solid #3b82f6;
            }
            .print-preview .print-summary {
              margin-top: 8px;
              padding: 12px;
              background: #fff !important;
              border-radius: 6px;
              border: 2px solid #3b82f6;
            }
            .print-preview .print-summary h3 {
              margin-top: 0;
              font-size: 16px;
              margin-bottom: 8px;
              font-weight: bold;
              color: #1e40af;
            }
            .print-preview .print-summary table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
            }
            .print-preview .print-summary table td {
              padding: 6px 10px;
            }
            .print-preview .print-summary table td:first-child {
              font-weight: 600;
              width: 50%;
            }
            .print-preview .print-summary table td:last-child {
              text-align: right;
              font-weight: bold;
            }
            .print-preview .floor-divider {
              border-top: 3px solid #000;
              margin-top: 0.2rem;
              margin-bottom: 0.2rem;
              padding-top: 0.2rem;
            }
            .print-preview .grid-row-divider {
              border-bottom: 2px solid #666;
              margin-bottom: 0.15rem;
              padding-bottom: 0.15rem;
            }
            .print-preview .grid-col-divider {
              border-right: 2px solid #666;
            }
            .print-preview .space-y-6 {
              gap: 0.3rem !important;
            }
            .print-preview .space-y-6 > * + * {
              margin-top: 0.3rem !important;
            }
            .print-preview .space-y-4 {
              gap: 0.25rem !important;
            }
            .print-preview .space-y-4 > * + * {
              margin-top: 0.25rem !important;
            }
            .print-preview .space-y-2 {
              gap: 0.15rem !important;
            }
            .print-preview .space-y-2 > * + * {
              margin-top: 0.15rem !important;
            }
            /* Forzar dos columnas en impresión */
            .print-preview .grid {
              display: grid !important;
            }
            .print-preview .grid-cols-1.lg\\:grid-cols-2,
            .print-preview .lg\\:grid-cols-2 {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }
            .print-preview .p-3, .print-preview .p-4 {
              padding: 0.3rem !important;
            }
            .print-preview .gap-3, .print-preview .gap-4, .print-preview .gap-6 {
              gap: 0.3rem !important;
            }
            /* Forzar dos columnas en impresión para EQUIPO */
            .print-preview .print-two-columns {
              display: grid !important;
              grid-template-columns: 1fr 1fr !important;
              gap: 0.4rem !important;
            }
            .print-preview .print-two-columns > div {
              width: 100% !important;
              max-width: 100% !important;
            }
            .print-preview [class*="min-h-\\[60px\\]"] {
              min-height: 70px !important;
              padding: 8px !important;
            }
            .print-preview .gap-1\\.5 {
              gap: 0.25rem !important;
            }
            .print-preview .p-2 {
              padding: 0.3rem !important;
            }
            .print-preview .grid-row-divider {
              margin-bottom: 0.1rem !important;
              padding-bottom: 0.1rem !important;
            }
          `}</style>
          <div ref={printRef} className="print-preview" style={{ position: 'relative', minHeight: '100%', background: '#fff' }}>
            {/* Fecha arriba a la izquierda */}
            <div className="print-date-top" style={{ position: 'absolute', top: '0', left: '0', fontSize: '10px', color: '#666', padding: '4px' }}>
              {new Date().toLocaleDateString('es-AR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
              })}, {new Date().toLocaleTimeString('es-AR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
            {/* ID de orden arriba a la derecha */}
            <div className="print-id-top" style={{ position: 'absolute', top: '0', right: '0', fontSize: '10px', color: '#666', padding: '4px', fontWeight: 'bold' }}>
              ID: {load.id}
            </div>
            <div className="print-header mb-4 sm:mb-6">
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-2 sm:mb-3 text-center">ORDEN DE CARGA</h1>
              {currentCompany && (
                <p className="text-xs sm:text-sm md:text-base text-muted-foreground mb-0 text-center">
                  {currentCompany.name}
                </p>
              )}
            </div>

            {/* Información del camión y cliente */}
            <div className="print-info mb-4 sm:mb-6">
              <div className="print-info-item text-xs sm:text-sm">
                <strong>Camión:</strong> <span className="print-truck-name">{load.truck.name}</span>
                {load.truck.type === 'EQUIPO' && load.truck.chasisLength && load.truck.acopladoLength && (
                  <span className="print-truck-size"> - ({load.truck.chasisLength}m + {load.truck.acopladoLength}m)</span>
                )}
              </div>
              <div className="print-info-item text-xs sm:text-sm">
                <strong className="print-label-capacity">Capacidad:</strong> <span className="print-capacity-value">{load.truck.length} m{load.truck.maxWeight && ` • ${load.truck.maxWeight} Tn`}</span>
              </div>
              <div className="print-info-item text-xs sm:text-sm">
                <strong className="print-label-total">Total Cargado:</strong> <span className="print-total-value">{formatNumber(totalLength, 2)} m{totalWeight > 0 && ` • ${formatNumber(totalWeight, 2)} Tn`}</span>
              </div>
            </div>

            {/* Cliente y dirección de entrega */}
            {load.truck.isOwn && (load.deliveryClient || load.deliveryAddress || load.isCorralon) && (
              <>
                <div className="divider"></div>
                <div style={{ marginBottom: '4px', padding: '3px', background: '#e3f2fd', borderRadius: '3px', border: '1px solid #2196f3', fontSize: '6px' }}>
                  <strong>Datos de Entrega:</strong>
                  {load.isCorralon ? (
                    <div>📍 Entrega en Corralón</div>
                  ) : (
                    <>
                      {load.deliveryClient && <div><strong>Cliente:</strong> {load.deliveryClient}</div>}
                      {load.deliveryAddress && <div><strong>Dirección:</strong> {load.deliveryAddress}</div>}
                    </>
                  )}
                </div>
              </>
            )}

            <div className="divider divider-before-materials"></div>

            {/* Materiales */}
            <div className="materials-list mb-4 sm:mb-6">
              <h3 className="text-sm sm:text-base md:text-lg font-semibold mb-2 sm:mb-3">Materiales a Cargar</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2 sm:gap-3 md:gap-4 text-xs sm:text-sm md:text-base p-2 sm:p-3 md:p-4">
                {materialsByProduct.map((material, idx) => (
                  <div key={idx} className="p-2 sm:p-3 bg-warning-muted border border-warning-muted rounded-md text-center">
                    {material.length ? (
                      <span className="font-medium"><strong>{material.length}Mts</strong> - {material.totalPackages} pqt ({material.totalQuantity} uds)</span>
                    ) : (
                      <span className="font-medium"><strong>{material.name}</strong> - {material.totalPackages} pqt ({material.totalQuantity} uds)</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="divider divider-after-materials"></div>

            {/* Distribución de la grilla - EXACTAMENTE igual que el modal */}
            <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 border rounded-lg bg-muted/30 mb-4 sm:mb-6">
              {load.truck.type === 'EQUIPO' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6 print-two-columns">
                  {/* Grilla Chasis */}
                  <div className="space-y-2 sm:space-y-3 p-3 sm:p-4 border rounded-lg bg-background">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2 print-section-header">
                      <Label className="text-sm sm:text-base md:text-lg font-semibold print-section-title">Chasis ({load.truck.chasisLength}m)</Label>
                      <Badge variant="secondary" className="text-xs sm:text-sm px-2 sm:px-3 py-1 print-pos-badge">
                        {Object.keys(chasisGridViz).length} / {3 * 3 * chasisCols} pos
                      </Badge>
                    </div>
                    {renderGridVisualization(chasisGridViz, chasisLayout, 'chasis', chasisCols)}
                  </div>
                  
                  {/* Grilla Acoplado */}
                  <div className="space-y-2 sm:space-y-3 p-3 sm:p-4 border rounded-lg bg-background">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2 print-section-header">
                      <Label className="text-sm sm:text-base md:text-lg font-semibold print-section-title">Acoplado ({load.truck.acopladoLength}m)</Label>
                      <Badge variant="secondary" className="text-xs sm:text-sm px-2 sm:px-3 py-1 print-pos-badge">
                        {Object.keys(acopladoGridViz).length} / {3 * 3 * acopladoCols} pos
                      </Badge>
                    </div>
                    {renderGridVisualization(acopladoGridViz, acopladoLayout, 'acoplado', acopladoCols)}
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2 sm:space-y-3 p-3 sm:p-4 border rounded-lg bg-background">
                    {renderGridVisualization(gridVisualization, [], '', 3)}
                  </div>
                </>
              )}
            </div>

            {/* Resumen */}
            <div 
              className="print-summary mt-4 sm:mt-6 p-3 sm:p-4 md:p-6 border-2 border-primary rounded-lg"
              data-viguetas={load.items.reduce((sum, item) => sum + item.quantity, 0)}
              data-metros={formatNumber(totalLength, 2)}
              data-peso={totalWeight > 0 ? ` / Total de peso: ${formatNumber(totalWeight, 2)} Tn` : ''}
              data-utilizacion={`${formatNumber((totalLength / load.truck.length) * 100, 1)}%${load.truck.maxWeight ? ` • ${formatNumber((totalWeight / load.truck.maxWeight) * 100, 1)}% peso` : ''}`}
            >
              <h3 className="text-base sm:text-lg md:text-xl font-bold mb-3 sm:mb-4 text-primary">Resumen de Carga</h3>
              <span className="print-summary-text" style={{ display: 'none' }}>
                Total de viguetas: {load.items.reduce((sum, item) => sum + item.quantity, 0)} unidades / Total de metros: {formatNumber(totalLength, 2)} m{totalWeight > 0 ? ` / Total de peso: ${formatNumber(totalWeight, 2)} Tn` : ''} / Utilización: {formatNumber((totalLength / load.truck.length) * 100, 1)}%{load.truck.maxWeight ? ` • ${formatNumber((totalWeight / load.truck.maxWeight) * 100, 1)}% peso` : ''}
              </span>
              <table className="w-full">
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 sm:py-3 text-xs sm:text-sm md:text-base font-semibold">Total de viguetas:</td>
                    <td className="py-2 sm:py-3 text-xs sm:text-sm md:text-base text-right font-bold">{load.items.reduce((sum, item) => sum + item.quantity, 0)} unidades</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 sm:py-3 text-xs sm:text-sm md:text-base font-semibold">Total de metros:</td>
                    <td className="py-2 sm:py-3 text-xs sm:text-sm md:text-base text-right font-bold">{formatNumber(totalLength, 2)} m</td>
                  </tr>
                  {totalWeight > 0 && (
                    <tr className="border-b">
                      <td className="py-2 sm:py-3 text-xs sm:text-sm md:text-base font-semibold">Total de peso:</td>
                      <td className="py-2 sm:py-3 text-xs sm:text-sm md:text-base text-right font-bold">{formatNumber(totalWeight, 2)} Tn</td>
                    </tr>
                  )}
                  <tr>
                    <td className="py-2 sm:py-3 text-xs sm:text-sm md:text-base font-semibold">Utilización de capacidad:</td>
                    <td className="py-2 sm:py-3 text-xs sm:text-sm md:text-base text-right font-bold">
                      {formatNumber((totalLength / load.truck.length) * 100, 1)}%
                      {load.truck.maxWeight && ` • ${formatNumber((totalWeight / load.truck.maxWeight) * 100, 1)}% peso`}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
    </>
  );

  // Crear el modal completo
  const modalContent = (
    <div className="fixed inset-0 z-[150] flex items-start justify-center bg-black/50 p-2 sm:p-4 overflow-y-auto" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <Card className="w-full max-w-6xl max-h-full flex flex-col mt-2 sm:mt-4 bg-card shadow-lg" onClick={(e) => e.stopPropagation()} style={{ boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', border: '1px solid #e5e7eb' }}>
        {!hideButtons && (
          <CardHeader className="flex flex-row items-center justify-between flex-shrink-0 border-b pb-3 mb-0 px-4 sm:px-6 pt-4 sm:pt-6">
            <CardTitle className="no-print text-base sm:text-lg font-semibold">Orden de Carga {load.id} - {load.truck.name}</CardTitle>
            <div className="flex gap-2 sm:gap-3">
              <Button onClick={handlePrint} className="no-print text-xs sm:text-sm" data-print-button>
                <Printer className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Imprimir</span>
              </Button>
              <Button variant="outline" onClick={onClose} className="no-print p-2 sm:px-4">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
        )}
        <CardContent className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6" style={{ background: '#fff' }}>
          {printContent}
        </CardContent>
      </Card>
    </div>
  );

  // Si hideOverlay es true, solo retornar el contenido sin overlay
  if (hideOverlay) {
    return (
      <div style={{ background: '#fff' }}>
        {printContent}
      </div>
    );
  }

  // Usar Portal para renderizar fuera del árbol DOM normal
  if (typeof window === 'undefined') {
    return null;
  }

  return createPortal(modalContent, document.body);
});

LoadPrintView.displayName = 'LoadPrintView';

export default LoadPrintView;
