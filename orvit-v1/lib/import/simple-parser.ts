/**
 * Simple Parser - Parses text format AI responses into structured data
 *
 * This parser handles the simple text format that is easier to parse than JSON.
 * Used by both upload mode (internal AI) and external AI mode.
 */

import { ExtractedMachineData, ExtractedComponent, Evidence } from './machine-extractor';

// =============================================================================
// TYPES
// =============================================================================

export interface ParsedTreeData {
  machine: Record<string, string | null>;
  components: Array<Record<string, string | number | null>>;
  confidence: number;
  warnings: string[];
}

// =============================================================================
// FIELD MAPPINGS
// =============================================================================

const MACHINE_FIELDS: Record<string, string> = {
  // Spanish
  'nombre': 'name',
  'marca': 'brand',
  'modelo': 'model',
  'número de serie': 'serialNumber',
  'numero de serie': 'serialNumber',
  'año': 'manufacturingYear',
  'tipo': 'type',
  'potencia': 'power',
  'voltaje': 'voltage',
  'peso': 'weight',
  'dimensiones': 'dimensions',
  'descripción': 'description',
  'descripcion': 'description',
  'notas técnicas': 'technicalNotes',
  'notas tecnicas': 'technicalNotes',
  // English
  'name': 'name',
  'brand': 'brand',
  'model': 'model',
  'serial number': 'serialNumber',
  'year': 'manufacturingYear',
  'type': 'type',
  'power': 'power',
  'voltage': 'voltage',
  'weight': 'weight',
  'dimensions': 'dimensions',
  'description': 'description',
  'technical notes': 'technicalNotes',
  // Italian
  'nome': 'name',
  'modello': 'model',
  'numero di serie': 'serialNumber',
  'anno': 'manufacturingYear',
  'tensione': 'voltage',
  'note tecniche': 'technicalNotes',
  // Portuguese
  'tensão': 'voltage',
  'dimensões': 'dimensions',
  'descrição': 'description',
};

const COMPONENT_FIELDS: Record<string, string> = {
  // Spanish
  'código': 'code',
  'codigo': 'code',
  'posición': 'itemNumber',
  'posicion': 'itemNumber',
  'pos': 'itemNumber',
  'nº': 'itemNumber',
  'item': 'itemNumber',
  'cantidad': 'quantity',
  'archivo': 'fileName',
  'tipo': 'type',
  'sistema': 'system',
  'descripción': 'description',
  'descripcion': 'description',
  'padre': 'parentName',
  // English
  'code': 'code',
  'position': 'itemNumber',
  'item number': 'itemNumber',
  'item no': 'itemNumber',
  'ref': 'itemNumber',
  'quantity': 'quantity',
  'file': 'fileName',
  'type': 'type',
  'system': 'system',
  'description': 'description',
  'parent': 'parentName',
  // Italian
  'codice': 'code',
  'posizione': 'itemNumber',
  'rif': 'itemNumber',
  'quantità': 'quantity',
  'quantita': 'quantity',
  // Portuguese
  'posição': 'itemNumber',
  'quantidade': 'quantity',
  'arquivo': 'fileName',
  'pai': 'parentName',
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function isComponentField(fieldName: string): boolean {
  return fieldName in COMPONENT_FIELDS;
}

function isReferenceLine(line: string): boolean {
  if (!line.includes(':')) {
    if (/\b(manuale|manual|tecnico|technical|documento|document)\b/i.test(line)) {
      return true;
    }
  }
  return false;
}

function cleanFieldValue(value: string): string {
  return value
    .replace(/\s*\(inferido\s+por[^)]*\)/gi, '')
    .replace(/\s*\(inferred\s+by[^)]*\)/gi, '')
    .trim();
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\([^)]*\.(idw|iam|ipt|dwg|pdf)[^)]*\)/gi, '')
    .replace(/\s*\([^)]*manuale[^)]*\)/gi, '')
    .replace(/\s*\([^)]*manual[^)]*\)/gi, '')
    .replace(/\s*\(item\s*\d+\)/gi, '')
    .replace(/^\[|\]$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findParentMatch(
  parentName: string,
  componentsByName: Map<string, string>,
  componentNames: string[]
): string | null {
  const normalizedParent = normalizeName(parentName);

  // 1. Try exact match on normalized name
  if (componentsByName.has(normalizedParent)) {
    return componentsByName.get(normalizedParent)!;
  }

  // 2. Try partial match
  const entries = Array.from(componentsByName.entries());
  for (const [compName, tempId] of entries) {
    if (normalizedParent.includes(compName) || compName.includes(normalizedParent)) {
      return tempId;
    }
  }

  // 3. Try matching by main keywords
  const stopWords = ['de', 'del', 'la', 'el', 'los', 'las', 'con', 'para', 'por', 'en', 'y', 'o', 'a', 'the', 'of', 'with', 'for', 'and', 'or', 'to'];
  const parentWords = normalizedParent.split(' ').filter(w => w.length > 2 && !stopWords.includes(w));

  if (parentWords.length > 0) {
    let bestMatch: string | null = null;
    let bestScore = 0;

    for (const [compName, tempId] of entries) {
      const compWords = compName.split(' ').filter(w => w.length > 2 && !stopWords.includes(w));
      const matchingWords = parentWords.filter(pw => compWords.some(cw => cw.includes(pw) || pw.includes(cw)));
      const score = matchingWords.length / Math.max(parentWords.length, 1);

      if (score > bestScore && score >= 0.5) {
        bestScore = score;
        bestMatch = tempId;
      }
    }

    if (bestMatch) {
      return bestMatch;
    }
  }

  return null;
}

// =============================================================================
// MAIN PARSER
// =============================================================================

/**
 * Parse tree format text into structured data
 */
export function parseTreeFormat(text: string): ParsedTreeData {
  const result: ParsedTreeData = {
    machine: {},
    components: [],
    confidence: 0.8,
    warnings: [],
  };

  // Strip markdown code block wrappers if present
  let cleanedText = text;
  const codeBlockMatch = cleanedText.match(/^```(?:\w+)?\s*\n([\s\S]*?)```\s*$/);
  if (codeBlockMatch) {
    cleanedText = codeBlockMatch[1];
  }

  const lines = cleanedText.replace(/\r\n/g, '\n').split('\n');

  let section: 'none' | 'machine' | 'tree' | 'components' | 'confidence' = 'none';
  let currentComponent: Record<string, string | number | null> | null = null;
  let componentIndex = 0;

  // Helper: strip markdown formatting and decorators from section header lines
  function cleanSectionLine(l: string): string {
    return l
      .replace(/\*\*/g, '')        // Remove bold **
      .replace(/^#+\s*/, '')        // Remove markdown headers ##
      .replace(/^[-–—]+\s*/, '')    // Remove leading dashes
      .replace(/\s*[-–—]+$/, '')    // Remove trailing dashes
      .trim();
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line || isReferenceLine(line)) continue;

    // Clean the line for section detection (remove markdown bold, headers, etc.)
    const sectionLine = cleanSectionLine(line);

    // Detect sections — flexible: supports === X ===, ## X, **X**, plain "X", etc.
    const isMachineHeader = (
      sectionLine.match(/^={3,}\s*(MÁQUINA|MACHINE|MACCHINA|MAQUINA)\s*={3,}$/i) ||
      sectionLine.match(/^===?\s*(MÁQUINA|MACHINE|MACCHINA|MAQUINA)\s*===?$/i) ||
      sectionLine.match(/^(MÁQUINA|MACHINE|MACCHINA|MAQUINA)$/i)
    );
    if (isMachineHeader) {
      section = 'machine';
      continue;
    }

    const isTreeHeader = (
      sectionLine.match(/^={3,}\s*(ÁRBOL|ALBERO|ÁRVORE|TREE)\s+(DE\s+)?(COMPONENTES?|COMPONENTI|COMPONENTS?)\s*={3,}$/i) ||
      sectionLine.match(/^===?\s*(ÁRBOL|ALBERO|ÁRVORE|TREE)\s+(DE\s+)?(COMPONENTES?|COMPONENTI|COMPONENTS?)\s*===?$/i) ||
      sectionLine.match(/^={3,}\s*(COMPONENT\s+TREE)\s*={3,}$/i) ||
      sectionLine.match(/^(ÁRBOL|TREE)\s+(DE\s+)?(COMPONENTES?|COMPONENTS?)$/i) ||
      sectionLine.match(/^COMPONENT\s+TREE$/i)
    );
    if (isTreeHeader) {
      section = 'tree';
      continue;
    }

    const isDetailHeader = (
      sectionLine.match(/^={3,}\s*(DETALLE|DETTAGLIO|DETALHES|DETAILS?)\s+(DE\s+|DEI\s+|DOS\s+|OF\s+)?(COMPONENTES?|COMPONENTI|COMPONENTS?)\s*={3,}$/i) ||
      sectionLine.match(/^===?\s*(DETALLE|DETTAGLIO|DETALHES|DETAILS?)\s+(DE\s+|DEI\s+|DOS\s+|OF\s+)?(COMPONENTES?|COMPONENTI|COMPONENTS?)\s*===?$/i) ||
      sectionLine.match(/^={3,}\s*(COMPONENT\s+DETAILS?)\s*={3,}$/i) ||
      sectionLine.match(/^(DETALLE|DETAILS?)\s+(DE\s+|OF\s+)?(COMPONENTES?|COMPONENTS?)$/i) ||
      sectionLine.match(/^COMPONENT\s+DETAILS?$/i)
    );
    if (isDetailHeader) {
      section = 'components';
      continue;
    }

    const isComponentsHeader = (
      sectionLine.match(/^={3,}\s*(COMPONENTES?|COMPONENTS?|COMPONENTI)\s*={3,}$/i) ||
      sectionLine.match(/^===?\s*(COMPONENTES?|COMPONENTS?|COMPONENTI)\s*===?$/i) ||
      sectionLine.match(/^(COMPONENTES?|COMPONENTS?|COMPONENTI)$/i)
    );
    if (isComponentsHeader) {
      // Only switch to components if we're not already in 'components' section
      // (avoid matching a line that says just "Componente" in component detail)
      if (section !== 'components') {
        section = 'components';
        continue;
      }
    }

    const isConfidenceHeader = (
      sectionLine.match(/^={3,}\s*(CONFIANZA|CONFIDENCE|CONFIDENZA)\s*={3,}$/i) ||
      sectionLine.match(/^===?\s*(CONFIANZA|CONFIDENCE|CONFIDENZA)\s*===?$/i) ||
      sectionLine.match(/^(CONFIANZA|CONFIDENCE|CONFIDENZA)$/i)
    );
    if (isConfidenceHeader) {
      if (currentComponent && currentComponent.name) {
        result.components.push(currentComponent);
      }
      currentComponent = null;
      section = 'confidence';
      continue;
    }

    if (line.match(/^={3,}/)) continue;

    // Skip tree section - it's just visual representation
    if (section === 'tree') {
      continue;
    }

    if (section === 'machine') {
      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (match) {
        const fieldName = match[1].trim().toLowerCase();
        let value = cleanFieldValue(match[2].trim());

        const mappedField = MACHINE_FIELDS[fieldName];
        if (mappedField) {
          result.machine[mappedField] = (value && value !== 'vacío' && value !== 'empty' && value !== 'vuoto' && value !== 'vazio' && !value.startsWith('[')) ? value : null;
        }
      }
    }

    if (section === 'components') {
      // Check if this is a new component (starts with number and dot)
      const componentMatch = line.match(/^(\d+)\.\s*(.+)$/);
      if (componentMatch) {
        if (currentComponent && currentComponent.name) {
          result.components.push(currentComponent);
        }

        componentIndex++;
        currentComponent = {
          itemNumber: componentMatch[1],
          name: componentMatch[2].trim().replace(/^\[|\]$/g, ''),
          code: null,
          quantity: 1,
          fileName: null,
          type: 'otro',
          system: null,
          description: null,
          parentName: null,
        };
        continue;
      }

      // Parse component field with dash: "   - Field: value"
      const fieldMatchDash = line.match(/^\s*-\s*([^:]+):\s*(.*)$/);
      if (fieldMatchDash && currentComponent) {
        const fieldName = fieldMatchDash[1].trim().toLowerCase();
        let value = cleanFieldValue(fieldMatchDash[2].trim());
        value = value.replace(/^\[|\]$/g, '');

        const mappedField = COMPONENT_FIELDS[fieldName];
        if (mappedField) {
          if (mappedField === 'quantity') {
            const qty = parseInt(value);
            currentComponent[mappedField] = isNaN(qty) ? 1 : qty;
          } else {
            currentComponent[mappedField] = (value && value !== 'vacío' && value !== 'empty' && value !== 'vuoto' && value !== 'vazio' && !value.startsWith('[')) ? value : null;
          }
        }
        continue;
      }

      // Parse component field WITHOUT dash: "Código: xxx"
      const fieldMatchPlain = line.match(/^([^:]+):\s*(.*)$/);
      if (fieldMatchPlain) {
        const fieldName = fieldMatchPlain[1].trim().toLowerCase();
        let value = cleanFieldValue(fieldMatchPlain[2].trim());

        if (isComponentField(fieldName) && currentComponent) {
          const mappedField = COMPONENT_FIELDS[fieldName];
          if (mappedField === 'quantity') {
            const qty = parseInt(value);
            currentComponent[mappedField] = isNaN(qty) ? 1 : qty;
          } else {
            currentComponent[mappedField] = (value && value !== 'vacío' && value !== 'empty' && value !== 'vuoto' && value !== 'vazio' && !value.startsWith('[')) ? value : null;
          }
          continue;
        }
      }

      // Check if this line could be a component NAME (alternative format without number)
      if (line && !line.includes('===')) {
        const isField = fieldMatchPlain && isComponentField(fieldMatchPlain[1].trim().toLowerCase());

        if (!isField) {
          let nextIdx = i + 1;
          while (nextIdx < lines.length) {
            const nextLineTrimmed = lines[nextIdx].trim();
            if (!nextLineTrimmed || isReferenceLine(nextLineTrimmed)) {
              nextIdx++;
              continue;
            }
            break;
          }

          if (nextIdx < lines.length) {
            const nextLine = lines[nextIdx].trim();
            const nextFieldMatch = nextLine.match(/^([^:]+):\s*(.*)$/);
            if (nextFieldMatch && isComponentField(nextFieldMatch[1].trim().toLowerCase())) {
              if (currentComponent && currentComponent.name) {
                result.components.push(currentComponent);
              }

              componentIndex++;
              let componentName = line
                .replace(/^\[|\]$/g, '')
                .replace(/\s*\([^)]*manuale[^)]*\)/gi, '')
                .replace(/\s*\([^)]*manual[^)]*\)/gi, '')
                .trim();

              currentComponent = {
                itemNumber: String(componentIndex),
                name: componentName,
                code: null,
                quantity: 1,
                fileName: null,
                type: 'otro',
                system: null,
                description: null,
                parentName: null,
              };
            }
          }
        }
      }
    }

    if (section === 'confidence') {
      const levelMatch = line.match(/^(Nivel|Level|Livello|Nível):\s*([\d.]+)/i);
      if (levelMatch) {
        const conf = parseFloat(levelMatch[2]);
        if (!isNaN(conf) && conf >= 0 && conf <= 1) {
          result.confidence = conf;
        }
      }

      const warningsMatch = line.match(/^(Advertencias?|Warnings?|Avvertenze?|Avisos?):\s*(.+)/i);
      if (warningsMatch) {
        const warnings = warningsMatch[2].split(/[,;]/).map(w => w.trim()).filter(Boolean);
        result.warnings.push(...warnings);
      }
    }
  }

  // Save last component
  if (currentComponent && currentComponent.name) {
    result.components.push(currentComponent);
  }

  return result;
}

/**
 * Try to parse JSON format as fallback
 */
export function tryParseJson(text: string): any | null {
  try {
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      return JSON.parse(codeBlockMatch[1].trim());
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return JSON.parse(text.trim());
  } catch {
    return null;
  }
}

/**
 * Transform parsed tree data into ExtractedMachineData format
 */
export function transformToExtractedData(
  parsed: ParsedTreeData,
  fileId: number = 0,
  fileName: string = 'document'
): ExtractedMachineData {
  // Build component map for parent resolution
  const componentsByName = new Map<string, string>();
  const components: ExtractedComponent[] = [];

  // Process components
  (parsed.components || []).forEach((comp, idx) => {
    const tempId = `comp_${idx + 1}`;
    const rawName = String(comp.name || `Componente ${idx + 1}`);
    const name = rawName.replace(/^\[|\]$/g, '').trim();
    const normalizedName = normalizeName(name);

    componentsByName.set(normalizedName, tempId);

    // Determine fileType from fileName
    let fileType: 'assembly' | 'part' | null = null;
    const compFileName = comp.fileName ? String(comp.fileName) : null;
    if (compFileName) {
      if (compFileName.toLowerCase().endsWith('.iam')) {
        fileType = 'assembly';
      } else if (compFileName.toLowerCase().endsWith('.ipt')) {
        fileType = 'part';
      }
    }

    const evidence: Evidence = {
      fileId,
      fileName,
      page: 1,
      snippet: 'Extraído por IA',
      confidence: parsed.confidence || 0.8,
    };

    components.push({
      tempId,
      name,
      originalName: name,
      code: comp.code ? String(comp.code) : null,
      itemNumber: comp.itemNumber ? String(comp.itemNumber) : null,
      quantity: typeof comp.quantity === 'number' ? comp.quantity : 1,
      fileName: compFileName,
      fileType,
      type: comp.type ? String(comp.type).toLowerCase() : 'otro',
      system: comp.system ? String(comp.system).toLowerCase() : null,
      description: comp.description ? String(comp.description) : null,
      parentTempId: null, // Will resolve below
      confidence: parsed.confidence || 0.8,
      evidences: [evidence],
      status: 'confirmed',
      needsConfirmation: false,
    });
  });

  // Resolve parent references
  let resolvedCount = 0;
  const componentNames = Array.from(componentsByName.keys());

  components.forEach((comp, idx) => {
    const original = parsed.components[idx];
    if (original?.parentName) {
      const parentName = String(original.parentName);
      const matchedTempId = findParentMatch(parentName, componentsByName, componentNames);

      if (matchedTempId) {
        if (matchedTempId === comp.tempId) {
          // Self-reference - treat as root
          comp.parentTempId = null;
        } else {
          comp.parentTempId = matchedTempId;
          resolvedCount++;
        }
      }
    }
  });

  console.log(`[SimpleParser] Resolved ${resolvedCount} parent references`);

  const machine = parsed.machine || {};

  return {
    machine: {
      name: machine.name || 'Máquina Importada',
      brand: machine.brand || null,
      model: machine.model || null,
      serialNumber: machine.serialNumber || null,
      manufacturingYear: machine.manufacturingYear ? parseInt(machine.manufacturingYear) : null,
      type: (machine.type as any) || 'PRODUCTION',
      power: machine.power || null,
      voltage: machine.voltage || null,
      weight: machine.weight || null,
      dimensions: machine.dimensions || null,
      description: machine.description || null,
      technicalNotes: machine.technicalNotes || null,
      confidence: parsed.confidence || 0.8,
      evidences: [{
        fileId,
        fileName,
        page: 1,
        snippet: 'Extraído por IA',
        confidence: parsed.confidence || 0.8,
      }],
    },
    allMachineScopesDetected: [],
    machineMatchStatus: 'UNIQUE',
    assemblies: [],
    components,
    conflicts: [],
    duplicatesDetected: [],
    warnings: parsed.warnings || [],
    overallConfidence: parsed.confidence || 0.8,
    processingTimeMs: 0,
  };
}

/**
 * Parse AI response (text or JSON) and transform to ExtractedMachineData
 */
export function parseAIResponse(
  response: string,
  fileId: number = 0,
  fileName: string = 'document'
): ExtractedMachineData {
  // First try tree format
  let parsed = parseTreeFormat(response);

  console.log(`[SimpleParser] Tree format result: machine=${parsed.machine.name || 'N/A'}, components=${parsed.components.length}`);

  // If tree format didn't find much, try JSON fallback
  if (!parsed.machine.name && parsed.components.length === 0) {
    console.log(`[SimpleParser] Tree format failed. Response preview (first 300 chars): ${response.substring(0, 300)}`);
    const jsonParsed = tryParseJson(response);
    if (jsonParsed) {
      console.log('[SimpleParser] Falling back to JSON format');
      parsed = {
        machine: jsonParsed.machine || jsonParsed.machineInfo || {},
        components: (jsonParsed.components || []).map((c: any, i: number) => ({
          itemNumber: c.itemNumber || String(i + 1),
          name: c.name || `Componente ${i + 1}`,
          code: c.code || null,
          quantity: c.quantity || 1,
          fileName: c.fileName || null,
          type: c.type || 'otro',
          system: c.system || null,
          description: c.description || null,
          parentName: c.parentName || c.parentTempId || null,
        })),
        confidence: jsonParsed.confidence || jsonParsed.overallConfidence || 0.8,
        warnings: jsonParsed.warnings || [],
      };
    }
  }

  // Third fallback: try to extract from markdown table (PARTS LIST)
  if (!parsed.machine.name && parsed.components.length === 0) {
    const tableParsed = tryParseMarkdownTable(response);
    if (tableParsed && tableParsed.components.length > 0) {
      console.log(`[SimpleParser] Falling back to markdown table format (${tableParsed.components.length} components)`);
      parsed = tableParsed;
    }
  }

  console.log(`[SimpleParser] Parsed: machine=${parsed.machine.name || 'N/A'}, components=${parsed.components.length}`);

  return transformToExtractedData(parsed, fileId, fileName);
}

/**
 * Try to extract components from a markdown table (PARTS LIST format)
 * Handles tables like: | FILE NAME | QTY | ITEM |
 */
function tryParseMarkdownTable(text: string): ParsedTreeData | null {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const components: Array<Record<string, string | number | null>> = [];
  const machine: Record<string, string | null> = {};

  // Find table headers
  let headerCols: string[] = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect table header row (contains | and not just dashes)
    if (line.startsWith('|') && line.includes('|') && !line.match(/^\|[\s-|]+\|$/)) {
      const cols = line.split('|').map(c => c.trim()).filter(Boolean);

      // Check if this looks like a header row
      const lowerCols = cols.map(c => c.toLowerCase().replace(/\*\*/g, ''));
      const isHeader = lowerCols.some(c =>
        ['file name', 'filename', 'name', 'nombre', 'qty', 'quantity', 'cantidad',
         'item', 'pos', 'position', 'code', 'código', 'codigo', 'description',
         'descripción', 'descripcion', 'part', 'component'].includes(c)
      );

      if (isHeader && !inTable) {
        headerCols = lowerCols;
        inTable = true;
        // Skip the separator row (| --- | --- |)
        if (i + 1 < lines.length && lines[i + 1].trim().match(/^\|[\s-|]+\|$/)) {
          i++;
        }
        continue;
      }
    }

    // Parse table data rows
    if (inTable && line.startsWith('|') && line.includes('|') && !line.match(/^\|[\s-|]+\|$/)) {
      const cols = line.split('|').map(c => c.trim().replace(/\*\*/g, '')).filter(Boolean);

      if (cols.length >= 1) {
        // Map columns to component fields
        const comp: Record<string, string | number | null> = {
          name: null,
          code: null,
          itemNumber: null,
          quantity: 1,
          fileName: null,
          type: 'otro',
          system: null,
          description: null,
          parentName: null,
        };

        for (let j = 0; j < headerCols.length && j < cols.length; j++) {
          const header = headerCols[j];
          const value = cols[j].trim();
          if (!value) continue;

          if (['file name', 'filename', 'name', 'nombre', 'component', 'part'].includes(header)) {
            // Use file name as component name but strip file extension
            const cleanName = value.replace(/\.(iam|ipt|idw|dwg|stp|step|pdf)$/i, '').trim();
            comp.name = cleanName;
            comp.code = value; // Keep original as code
            // Detect type from file extension
            if (value.toLowerCase().endsWith('.iam')) {
              comp.type = 'ensamble';
            } else if (value.toLowerCase().endsWith('.ipt')) {
              comp.type = 'pieza';
            }
          } else if (['qty', 'quantity', 'cantidad'].includes(header)) {
            const qty = parseInt(value);
            comp.quantity = isNaN(qty) ? 1 : qty;
          } else if (['item', 'pos', 'position', 'posición', 'posicion', 'nº', 'ref'].includes(header)) {
            comp.itemNumber = value;
          } else if (['code', 'código', 'codigo', 'part number'].includes(header)) {
            comp.code = value;
          } else if (['description', 'descripción', 'descripcion'].includes(header)) {
            comp.description = value;
          }
        }

        if (comp.name) {
          components.push(comp);
        }
      }
    } else if (inTable && !line.startsWith('|')) {
      // End of table
      inTable = false;
    }
  }

  if (components.length === 0) return null;

  return {
    machine,
    components,
    confidence: 0.7, // Lower confidence since we're parsing a raw table
    warnings: ['Datos extraídos de tabla markdown (formato no estándar)'],
  };
}
