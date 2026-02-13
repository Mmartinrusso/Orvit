// Utilidad compartida para generar el contenido HTML de impresión de checklists

export const generateChecklistPrintContent = (
  checklist: any,
  totalItems: number,
  totalEstimatedTime: number,
  maintenanceDataMap?: Map<number, any>
): string => {
  try {
    const formatTime = (minutes: number) => {
      if (minutes < 60) {
        return `${minutes} min`;
      }
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
    };

    const getFrequencyLabel = (frequency: string) => {
      const labels: { [key: string]: string } = {
        'DAILY': 'Diario',
        'WEEKLY': 'Semanal',
        'BIWEEKLY': 'Quincenal',
        'MONTHLY': 'Mensual',
        'QUARTERLY': 'Trimestral',
        'SEMIANNUAL': 'Semestral',
        'ANNUAL': 'Anual'
      };
      return labels[frequency] || frequency;
    };

    const getCategoryLabel = (category: string) => {
      const labels: { [key: string]: string } = {
        'SAFETY': 'Seguridad',
        'QUALITY': 'Calidad',
        'PRODUCTION': 'Producción',
        'MAINTENANCE': 'Mantenimiento',
        'CLEANING': 'Limpieza',
        'INSPECTION': 'Inspección'
      };
      return labels[category] || category;
    };

    const currentDate = new Date().toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Recopilar todos los items con su información de fase
    const allItems: Array<{ item: any; phaseIndex?: number; itemIndex: number; globalIndex: number }> = [];
    let globalIndex = 0;
    
    if (checklist.phases && checklist.phases.length > 0) {
      checklist.phases.forEach((phase: any, phaseIndex: number) => {
        if (phase.items && phase.items.length > 0) {
          phase.items.forEach((item: any, itemIndex: number) => {
            allItems.push({ item, phaseIndex, itemIndex, globalIndex: globalIndex++ });
          });
        }
      });
    } else if (checklist.items && checklist.items.length > 0) {
      checklist.items.forEach((item: any, index: number) => {
        allItems.push({ item, itemIndex: index, globalIndex: globalIndex++ });
      });
    }

    // Agrupar items por máquina, componente y subcomponente
    const itemsByMachine: { [key: string]: Array<{ item: any; phaseIndex?: number; itemIndex: number; globalIndex: number; machineInfo: any; componentInfo: any; subcomponentInfo: any }> } = {};
    let itemsWithoutMachine: Array<{ item: any; phaseIndex?: number; itemIndex: number; globalIndex: number }> = [];

    const checklistMachine = checklist.machine;

    allItems.forEach((itemData) => {
      const maintenanceId = itemData.item.maintenanceId;
      let machine = null;
      let unidadMovil = null;
      let component = null;
      let subcomponent = null;

      // Intentar obtener información desde el mapa de datos de mantenimiento
      if (maintenanceId && maintenanceDataMap) {
        const maintenanceData = maintenanceDataMap.get(maintenanceId);
        if (maintenanceData) {
          machine = maintenanceData.machine;
          unidadMovil = maintenanceData.unidadMovil;
          
          if (maintenanceData.componentIds && maintenanceData.componentIds.length > 0) {
            if (maintenanceData.component) {
              component = maintenanceData.component;
            } else if (maintenanceData.components && maintenanceData.components.length > 0) {
              component = maintenanceData.components[0];
            } else {
              component = { 
                id: maintenanceData.componentIds[0],
                name: maintenanceData.componentNames?.[0] || `Componente ${maintenanceData.componentIds[0]}`
              };
            }
          }
          
          if (maintenanceData.subcomponentIds && maintenanceData.subcomponentIds.length > 0) {
            if (maintenanceData.subcomponents && maintenanceData.subcomponents.length > 0) {
              subcomponent = maintenanceData.subcomponents[0];
            } else {
              subcomponent = { 
                id: maintenanceData.subcomponentIds[0],
                name: maintenanceData.subcomponentNames?.[0] || `Subcomponente ${maintenanceData.subcomponentIds[0]}`
              };
            }
          }
        }
      }

      if (!machine && !unidadMovil) {
        machine = itemData.item.machine;
        unidadMovil = itemData.item.unidadMovil;
      }
      
      if (!machine && !unidadMovil && itemData.item.maintenanceData) {
        machine = itemData.item.maintenanceData.machine;
        unidadMovil = itemData.item.maintenanceData.unidadMovil;
      }

      if (!machine && !unidadMovil && checklistMachine) {
        machine = checklistMachine;
      }

      const machineKey = machine 
        ? `${machine.id || 'unknown'}_${machine.name || 'Sin nombre'}`
        : unidadMovil
        ? `unidad_${unidadMovil.id || 'unknown'}_${unidadMovil.nombre || 'Sin nombre'}`
        : null;

      const componentKey = component 
        ? `_comp_${component.id || 'unknown'}_${component.name || 'Sin nombre'}`
        : '';

      const subcomponentKey = subcomponent
        ? `_subcomp_${subcomponent.id || 'unknown'}_${subcomponent.name || 'Sin nombre'}`
        : '';

      const fullKey = machineKey ? `${machineKey}${componentKey}${subcomponentKey}` : null;

      if (fullKey) {
        if (!itemsByMachine[fullKey]) {
          itemsByMachine[fullKey] = [];
        }
        itemsByMachine[fullKey].push({ 
          ...itemData, 
          machineInfo: machine || unidadMovil,
          componentInfo: component,
          subcomponentInfo: subcomponent
        });
      } else {
        itemsWithoutMachine.push(itemData);
      }
    });

    if (Object.keys(itemsByMachine).length === 0 && itemsWithoutMachine.length > 0 && checklistMachine) {
      const machineKey = `${checklistMachine.id || 'unknown'}_${checklistMachine.name || 'Sin nombre'}`;
      itemsByMachine[machineKey] = itemsWithoutMachine.map(item => ({ 
        ...item, 
        machineInfo: checklistMachine,
        componentInfo: null,
        subcomponentInfo: null
      }));
      itemsWithoutMachine = [];
    }

    // Generar contenido de tabla agrupado por máquina
    let tableRows = '';
    let itemCounter = 0;

    const generateItemRows = (items: Array<{ item: any; phaseIndex?: number; itemIndex: number; globalIndex: number }>) => {
      let rows = '';
      items.forEach((itemData) => {
        itemCounter++;
        const { item, phaseIndex, itemIndex } = itemData;
        const fullTitle = phaseIndex !== undefined 
          ? `${phaseIndex + 1}.${itemIndex + 1} ${item.title}`
          : `${itemCounter}. ${item.title}`;
        const itemId = item.maintenanceId || item.id || 'N/A';
        const maintenanceText = `${fullTitle} - ID: ${itemId}`;
        
        rows += `
          <tr>
            <td class="table-cell maintenance-cell">${maintenanceText}</td>
            <td class="table-cell date-cell">
              <div class="date-field">__ / __ / __</div>
            </td>
            <td class="table-cell date-cell">
              <div class="date-field">__ / __ / __</div>
            </td>
            <td class="table-cell notes-cell">
              <div class="notes-field"></div>
            </td>
            <td class="table-cell notes-cell">
              <div class="notes-field"></div>
            </td>
            <td class="table-cell responsible-cell">
              <div class="responsible-field">_________________</div>
            </td>
          </tr>
        `;
      });
      return rows;
    };

    // Agrupar primero por máquina
    const machinesMap: { [machineKey: string]: { [fullKey: string]: typeof itemsByMachine[string] } } = {};
    
    Object.keys(itemsByMachine).forEach((fullKey) => {
      const machineKeyMatch = fullKey.match(/^(unidad_[\d_]+|[\d_]+)/);
      const machineKey = machineKeyMatch ? machineKeyMatch[0] : fullKey;
      
      if (!machinesMap[machineKey]) {
        machinesMap[machineKey] = {};
      }
      machinesMap[machineKey][fullKey] = itemsByMachine[fullKey];
    });

    // Generar secciones
    Object.keys(machinesMap).forEach((machineKey) => {
      const machineGroups = machinesMap[machineKey];
      const firstGroupKey = Object.keys(machineGroups)[0];
      const firstItemData = machineGroups[firstGroupKey][0];
      const machineInfo = firstItemData.machineInfo || firstItemData.item.machine || firstItemData.item.unidadMovil;
      const machineName = machineInfo?.name || machineInfo?.nombre || 'Sin nombre';
      const isUnidadMovil = machineKey.startsWith('unidad_');
      
      tableRows += `
        <tbody class="machine-group">
        <tr class="machine-header-row">
          <td colspan="6" style="text-align: center;">
            <strong>${isUnidadMovil ? 'Unidad Móvil' : 'Máquina'}: ${machineName}</strong>
          </td>
        </tr>
      `;
      
      // Agrupar por componente dentro de esta máquina
      const componentsMap: { [componentKey: string]: { [subcomponentKey: string]: typeof itemsByMachine[string] } } = {};
      
      Object.keys(machineGroups).forEach((fullKey) => {
        const items = machineGroups[fullKey];
        const firstItem = items[0];
        const componentInfo = firstItem.componentInfo;
        const subcomponentInfo = firstItem.subcomponentInfo;
        
        const componentKey = componentInfo 
          ? `comp_${componentInfo.id}_${componentInfo.name || 'Sin nombre'}`
          : 'sin_componente';
        
        const subcomponentKey = subcomponentInfo
          ? `subcomp_${subcomponentInfo.id}_${subcomponentInfo.name || 'Sin nombre'}`
          : 'sin_subcomponente';
        
        if (!componentsMap[componentKey]) {
          componentsMap[componentKey] = {};
        }
        if (!componentsMap[componentKey][subcomponentKey]) {
          componentsMap[componentKey][subcomponentKey] = [];
        }
        componentsMap[componentKey][subcomponentKey].push(...items);
      });
      
      // Generar grupos por componente y subcomponente
      Object.keys(componentsMap).forEach((componentKey) => {
        const subcomponentsMap = componentsMap[componentKey];
        const firstSubcomponentKey = Object.keys(subcomponentsMap)[0];
        const firstItem = subcomponentsMap[firstSubcomponentKey][0];
        const componentInfo = firstItem.componentInfo;
        
        if (componentInfo && componentKey !== 'sin_componente') {
          const componentName = componentInfo.name || `Componente ${componentInfo.id}`;
          tableRows += `
            <tbody class="component-group">
            <tr class="component-header-row" style="background-color: #f3f4f6; font-weight: bold;">
              <td colspan="6" style="padding: 8px; font-size: 12px; border-left: 3px solid #3b82f6; text-align: center;">
                <strong>Componente: ${componentName}</strong>
              </td>
            </tr>
          `;
        }
        
        Object.keys(subcomponentsMap).forEach((subcomponentKey) => {
          const items = subcomponentsMap[subcomponentKey];
          const firstItem = items[0];
          const subcomponentInfo = firstItem.subcomponentInfo;
          
          if (subcomponentInfo && subcomponentKey !== 'sin_subcomponente') {
            const subcomponentName = subcomponentInfo.name || `Subcomponente ${subcomponentInfo.id}`;
            tableRows += `
            <tbody class="subcomponent-group">
            <tr class="subcomponent-header-row" style="background-color: #f9fafb; font-weight: bold;">
              <td colspan="6" style="padding: 6px 8px 6px 20px; font-size: 11px; border-left: 3px solid #60a5fa; text-align: center;">
                <strong>Subcomponente: ${subcomponentName}</strong>
              </td>
            </tr>
            `;
          }
          
          tableRows += generateItemRows(items);
          
          if (subcomponentInfo && subcomponentKey !== 'sin_subcomponente') {
            tableRows += `</tbody>`;
          }
        });
        
        if (componentInfo && componentKey !== 'sin_componente') {
          tableRows += `</tbody>`;
        }
      });
      tableRows += `</tbody>`;
    });

    if (itemsWithoutMachine.length > 0) {
      tableRows += `
        <tbody class="unassigned-group">
        <tr class="unassigned-header-row">
          <td colspan="6" style="text-align: center;">
            <strong>Mantenimientos sin máquina asignada</strong>
          </td>
        </tr>
      `;
      tableRows += generateItemRows(itemsWithoutMachine);
      tableRows += `</tbody>`;
    }

    if (allItems.length === 0) {
      tableRows = '<tr><td colspan="6" style="text-align: center; color: #6b7280; font-style: italic; padding: 20px;">Sin items definidos</td></tr>';
    }

    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Checklist - ${checklist.title}</title>
        <style>
          @media print {
            @page {
              size: landscape;
              margin: 10mm;
            }
            body { margin: 0; padding: 10px; }
            .no-print { display: none; }
            .page-break { page-break-before: always; }
            .header { margin-bottom: 10px; padding-bottom: 10px; }
            .info-grid { margin-bottom: 10px; }
            .description { margin-bottom: 10px; padding: 10px; }
            .phases-section h2 { margin-bottom: 10px; padding-bottom: 5px; }
          }
          
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
          }
          
          @media print {
            .checklist-table {
              font-size: 9px;
              width: 100%;
            }
            
            .checklist-table th,
            .checklist-table td {
              padding: 4px 3px;
            }
            
            .maintenance-cell {
              width: 20%;
              min-width: 180px;
            }
            
            .date-cell {
              width: 12%;
              min-width: 90px;
            }
            
            .notes-cell {
              width: 22%;
              min-width: 150px;
            }
            
            .responsible-cell {
              width: 22%;
              min-width: 150px;
            }
          }
          
          .header {
            text-align: center;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 10px;
            margin-bottom: 15px;
          }
          
          .title {
            font-size: 24px;
            font-weight: bold;
            color: #1e40af;
            margin-bottom: 5px;
          }
          
          .subtitle {
            font-size: 12px;
            font-weight: bold;
            color: #6b7280;
            margin-bottom: 3px;
          }
          
          .info-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 15px;
            font-size: 11px;
          }
          
          .info-card {
            border: 1px solid #e5e7eb;
            border-radius: 4px;
            padding: 8px;
            background-color: #f9fafb;
          }
          
          .info-label {
            font-weight: bold;
            color: #374151;
            margin-bottom: 3px;
            font-size: 10px;
          }
          
          .info-value {
            color: #111827;
            font-size: 11px;
            font-weight: bold;
          }
          
          .description {
            background-color: #f3f4f6;
            border-left: 3px solid #3b82f6;
            padding: 8px;
            margin-bottom: 15px;
            border-radius: 0 4px 4px 0;
            font-size: 11px;
          }
          
          .phases-section {
            margin-bottom: 15px;
          }
          
          .table-container {
            overflow-x: auto;
            margin-top: 20px;
          }
          
          .checklist-table {
            width: 100%;
            border-collapse: collapse;
            border: 2px solid #1e40af;
            background-color: white;
            font-size: 11px;
            table-layout: fixed;
          }
          
          .checklist-table thead {
            background-color: #f3f4f6;
          }
          
          .checklist-table th {
            padding: 8px 6px;
            text-align: center;
            font-weight: 900;
            border: 1px solid #1e3a8a;
            font-size: 11px;
            color: #000000;
            background-color: #f3f4f6;
          }
          
          .checklist-table td {
            padding: 6px 4px;
            border: 1px solid #d1d5db;
            vertical-align: top;
          }
          
          .checklist-table tbody tr:nth-child(even) {
            background-color: #f9fafb;
          }
          
          .checklist-table tbody tr:hover {
            background-color: #f3f4f6;
          }
          
          .table-cell {
            min-height: 40px;
          }
          
          .maintenance-cell {
            width: 20%;
            font-weight: 500;
            color: #000000;
          }
          
          .date-cell {
            width: 12%;
            text-align: center;
            color: #000000;
          }
          
          .date-field {
            min-height: 30px;
            padding: 4px;
            text-align: center;
            color: #000000;
            font-size: 14px;
            letter-spacing: 2px;
          }
          
          .notes-cell {
            width: 22%;
          }
          
          .notes-field {
            border: 1px solid #d1d5db;
            border-radius: 0;
            min-height: 80px;
            background-color: white;
            padding: 4px;
          }
          
          .responsible-cell {
            width: 22%;
          }
          
          .responsible-field {
            border-bottom: 1px solid #d1d5db;
            min-height: 30px;
            padding: 4px;
          }
          
          .footer {
            margin-top: 20px;
            padding-top: 10px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 10px;
          }
          
          .print-button {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 20px;
            background-color: #2563eb;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
          }
          
          .print-button:hover {
            background-color: #1d4ed8;
          }
          
          .machine-header-row {
            background-color: #e5e7eb !important;
            font-weight: bold;
            border-top: 3px solid #1e40af;
            border-bottom: 2px solid #1e40af;
            page-break-inside: avoid;
            page-break-after: avoid;
          }
          
          .machine-header-row td {
            padding: 12px !important;
            font-size: 14px !important;
            border: 2px solid #1e40af !important;
            background-color: #e5e7eb !important;
            text-align: center !important;
          }
          
          .component-header-row {
            page-break-inside: avoid;
            page-break-after: avoid;
          }
          
          .subcomponent-header-row {
            page-break-inside: avoid;
            page-break-after: avoid;
          }
          
          .component-group {
            page-break-inside: avoid;
          }
          
          .subcomponent-group {
            page-break-inside: avoid;
          }
          
          .component-header-row + tr,
          .subcomponent-header-row + tr {
            page-break-before: avoid;
          }
          
          .unassigned-header-row {
            background-color: #fef3c7 !important;
            font-weight: bold;
            border-top: 3px solid #f59e0b;
            border-bottom: 2px solid #f59e0b;
            page-break-inside: avoid;
            page-break-after: avoid;
          }
          
          .unassigned-header-row td {
            padding: 12px !important;
            font-size: 14px !important;
            border: 2px solid #f59e0b !important;
            background-color: #fef3c7 !important;
            text-align: center !important;
          }
          
          .checklist-table {
            text-align: center;
          }
          
          .checklist-table td {
            text-align: center;
          }
          
          .checklist-table .maintenance-cell {
            text-align: left;
          }
        </style>
      </head>
      <body>
        
        <div class="header">
          <div class="title">${checklist.title}</div>
          <div class="subtitle">Checklist de Mantenimiento</div>
          <div class="subtitle">Generado el ${currentDate}</div>
        </div>
        
        <div class="info-grid">
          <div class="info-card">
            <div class="info-label">Categoría</div>
            <div class="info-value">${getCategoryLabel(checklist.category)}</div>
          </div>
          <div class="info-card">
            <div class="info-label">Frecuencia</div>
            <div class="info-value">${getFrequencyLabel(checklist.frequency)}</div>
          </div>
          <div class="info-card">
            <div class="info-label">Total Items</div>
            <div class="info-value">${totalItems}</div>
          </div>
          <div class="info-card">
            <div class="info-label">Tiempo Estimado</div>
            <div class="info-value">${formatTime(totalEstimatedTime)}</div>
          </div>
        </div>
        
        ${checklist.description ? `
        <div class="description">
          <div class="info-label">Descripción</div>
          <div class="info-value">${checklist.description}</div>
        </div>
        ` : ''}
        
        <div class="phases-section">
          <h2 style="color: #1e40af; border-bottom: 2px solid #3b82f6; padding-bottom: 5px; margin-bottom: 10px; font-size: 16px;">
            Items del Checklist
          </h2>
          
          <div class="table-container">
            <table class="checklist-table">
              <thead>
                <tr>
                  <th style="width: 20%;">Mantenimiento</th>
                  <th style="width: 12%;">Fecha de realizado</th>
                  <th style="width: 12%;">Fecha a reprogramar</th>
                  <th style="width: 22%;">Notas</th>
                  <th style="width: 22%;">Inconvenientes</th>
                  <th style="width: 22%;">Responsables y supervisores</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
          </div>
        </div>
        
        <div class="footer">
          <p style="font-size: 10px;">Este checklist fue generado automáticamente por el sistema de mantenimiento - Fecha de impresión: ${currentDate}</p>
        </div>
      </body>
      </html>
    `;
  } catch (error) {
    console.error('🖨️ [PRINT] Error en generateChecklistPrintContent:', error);
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Error al generar checklist</title>
      </head>
      <body>
        <h1>Error al generar el checklist</h1>
        <p>${error instanceof Error ? error.message : 'Error desconocido'}</p>
      </body>
      </html>
    `;
  }
};

