import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import OpenAI from 'openai';
import { AIExtractionSchema, mapTipoComprobante, detectDocType } from '@/lib/schemas/ai-extraction';
import { validateAccounting, calculateConfidenceScore, validateRequiredFields, detectCrossedData, tryCorrectCuit, tryCorrectCae, correctOcrErrors } from '@/lib/validations/accounting';
import { checkDuplicate, findSupplierByCuit } from '@/lib/validations/duplicates';

// Normalizar texto para mejor matching
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    // Quitar acentos
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    // Normalizar unidades comunes
    .replace(/\bkilos?\b|\bkgs?\b|\bkilogramos?\b/g, 'kg')
    .replace(/\blitros?\b|\blts?\b/g, 'lt')
    .replace(/\bunidades?\b|\bunds?\b/g, 'un')
    .replace(/\bmetros?\b|\bmts?\b/g, 'm')
    .replace(/\bpaquetes?\b|\bpaq\b/g, 'paq')
    .replace(/\bcajas?\b/g, 'caja')
    // Quitar palabras que no aportan
    .replace(/\b(x|por|de|del|la|el|los|las|con|sin|para)\b/g, '')
    // Quitar caracteres especiales y espacios múltiples
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Calcular similitud entre strings (Dice coefficient) - LOCAL, sin tokens
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeText(str1);
  const s2 = normalizeText(str2);

  if (s1 === s2) return 1;
  if (s1.length < 2 || s2.length < 2) return 0;

  // Crear bigramas
  const bigrams1 = new Set<string>();
  const bigrams2 = new Set<string>();
  const clean1 = s1.replace(/\s/g, '');
  const clean2 = s2.replace(/\s/g, '');

  for (let i = 0; i < clean1.length - 1; i++) bigrams1.add(clean1.slice(i, i + 2));
  for (let i = 0; i < clean2.length - 1; i++) bigrams2.add(clean2.slice(i, i + 2));

  let intersection = 0;
  bigrams1.forEach(b => { if (bigrams2.has(b)) intersection++; });

  const diceScore = (2 * intersection) / (bigrams1.size + bigrams2.size);

  // Bonus si una cadena contiene a la otra (parcial match)
  if (s1.includes(s2) || s2.includes(s1)) {
    return Math.min(1, diceScore + 0.15);
  }

  return diceScore;
}

// Batch AI Matching - UNA sola llamada para TODOS los items (~$0.0003 total)
// Más eficiente que llamar N veces a aiMatchItem
async function aiBatchMatchItems(
  openai: OpenAI,
  itemsToMatch: Array<{ index: number; descripcion: string; candidatos: Array<{ id: number; nombre: string }> }>
): Promise<Map<number, { matchedId: number | null; confidence: number }>> {
  const results = new Map<number, { matchedId: number | null; confidence: number }>();

  if (itemsToMatch.length === 0) return results;

  // Construir prompt compacto para batch matching
  const itemsText = itemsToMatch.map((item, i) => {
    const prods = item.candidatos.slice(0, 10).map(p => `${p.id}:${p.nombre}`).join('|');
    return `${i}:"${item.descripcion.slice(0, 50)}"->[${prods}]`;
  }).join('\n');

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 100,
      temperature: 0,
      messages: [{
        role: 'user',
        content: `Matchea items de factura con productos. Responde SOLO números separados por coma (ID o 0 si no hay match).
${itemsText}
Respuesta (${itemsToMatch.length} números):`
      }]
    });

    const respuesta = response.choices[0]?.message?.content?.trim() || '';
    // Parsear respuesta: "15,0,23,7" -> [15, 0, 23, 7]
    const matchedIds = respuesta.split(/[,\s]+/).map(s => parseInt(s.trim()) || 0);

    itemsToMatch.forEach((item, i) => {
      const matchedId = matchedIds[i] || 0;
      const validMatch = matchedId > 0 && item.candidatos.some(c => c.id === matchedId);
      results.set(item.index, {
        matchedId: validMatch ? matchedId : null,
        confidence: validMatch ? 0.75 : 0
      });
    });
  } catch (error) {
    console.error('Error en batch AI match:', error);
    // En caso de error, devolver null para todos
    itemsToMatch.forEach(item => {
      results.set(item.index, { matchedId: null, confidence: 0 });
    });
  }

  return results;
}

// Función para hacer matching de items con aliases del proveedor
// OPTIMIZADO: usa batch AI matching (1 llamada para todos los items)
async function matchInvoiceItems(
  items: Array<{ codigo?: string; descripcion: string; cantidad: number; precio_unitario: number; subtotal: number }>,
  supplierId: number,
  companyId: number,
  openaiClient?: OpenAI // Cliente OpenAI para AI matching
) {
  // Cargar todos los items del proveedor una sola vez (eficiente)
  const allSupplierItems = await prisma.supplierItem.findMany({
    where: { supplierId, companyId, activo: true },
    include: { supply: true, aliases: true },
  });

  // FASE 1: Matching exacto y fuzzy local (sin IA)
  const preliminaryResults: Array<{
    item: typeof items[0];
    match: any;
    matchType: 'exact_alias' | 'exact_code' | 'fuzzy' | 'ai_assisted' | 'none';
    similarities: any[];
    aliasToUpdate?: number;
  }> = [];

  for (const item of items) {
    let match = null;
    let matchType: 'exact_alias' | 'exact_code' | 'fuzzy' | 'ai_assisted' | 'none' = 'none';
    let aliasToUpdate: number | undefined;
    let similarities: any[] = [];

    // 1. Buscar por alias exacto (nombre en factura)
    if (item.descripcion) {
      for (const si of allSupplierItems) {
        const aliasMatch = si.aliases.find(
          a => a.alias.toLowerCase() === item.descripcion.toLowerCase()
        );
        if (aliasMatch) {
          match = {
            supplierItemId: si.id,
            nombre: si.nombre,
            supplyId: si.supplyId,
            supplyName: si.supply.name,
            supplySku: si.supply.code,
          };
          matchType = 'exact_alias';
          aliasToUpdate = aliasMatch.id;
          break;
        }
      }
    }

    // 2. Si no hay match por alias, buscar por código del proveedor
    if (!match && item.codigo) {
      const codeMatch = allSupplierItems.find(
        si => si.codigoProveedor?.toLowerCase() === item.codigo?.toLowerCase()
      );
      if (codeMatch) {
        match = {
          supplierItemId: codeMatch.id,
          nombre: codeMatch.nombre,
          supplyId: codeMatch.supplyId,
          supplyName: codeMatch.supply.name,
          supplySku: codeMatch.supply.code,
        };
        matchType = 'exact_code';
      }
    }

    // 3. Si no hay match, buscar por nombre exacto del SupplierItem
    if (!match && item.descripcion) {
      const nameMatch = allSupplierItems.find(
        si => si.nombre.toLowerCase() === item.descripcion.toLowerCase()
      );
      if (nameMatch) {
        match = {
          supplierItemId: nameMatch.id,
          nombre: nameMatch.nombre,
          supplyId: nameMatch.supplyId,
          supplyName: nameMatch.supply.name,
          supplySku: nameMatch.supply.code,
        };
        matchType = 'exact_code';
      }
    }

    // 4. FUZZY MATCHING LOCAL (sin tokens)
    if (!match && item.descripcion && allSupplierItems.length > 0) {
      similarities = allSupplierItems.map(si => ({
        supplierItemId: si.id,
        nombre: si.nombre,
        supplyId: si.supplyId,
        supplyName: si.supply.name,
        supplySku: si.supply.code,
        similarity: Math.max(
          calculateSimilarity(item.descripcion, si.nombre),
          calculateSimilarity(item.descripcion, si.supply.name),
          ...si.aliases.map(a => calculateSimilarity(item.descripcion, a.alias))
        ),
      })).filter(s => s.similarity > 0.4)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5);

      // Si hay coincidencia muy alta (>85%), usar como fuzzy match
      if (similarities.length > 0 && similarities[0].similarity > 0.85) {
        match = {
          supplierItemId: similarities[0].supplierItemId,
          nombre: similarities[0].nombre,
          supplyId: similarities[0].supplyId,
          supplyName: similarities[0].supplyName,
          supplySku: similarities[0].supplySku,
        };
        matchType = 'fuzzy';
      }
    }

    preliminaryResults.push({ item, match, matchType, similarities, aliasToUpdate });
  }

  // FASE 2: Batch AI matching para items sin match (UNA sola llamada)
  const itemsNeedingAI = preliminaryResults
    .map((r, index) => ({ ...r, index }))
    .filter(r => !r.match && r.similarities.length > 0);

  let aiResults = new Map<number, { matchedId: number | null; confidence: number }>();

  if (itemsNeedingAI.length > 0 && openaiClient) {
    const batchInput = itemsNeedingAI.map(r => ({
      index: r.index,
      descripcion: r.item.descripcion,
      candidatos: r.similarities.map(s => ({ id: s.supplierItemId, nombre: s.supplyName }))
    }));

    aiResults = await aiBatchMatchItems(openaiClient, batchInput);
  }

  // FASE 3: Construir resultados finales
  const results = [];
  const aliasUpdates: number[] = [];

  for (let i = 0; i < preliminaryResults.length; i++) {
    const { item, similarities, aliasToUpdate } = preliminaryResults[i];
    let { match, matchType } = preliminaryResults[i];
    let usedAI = false;
    let suggestions: Array<{ supplierItemId: number; supplyName: string; similarity: number }> = [];

    // Aplicar resultado de IA si aplica
    if (!match && aiResults.has(i)) {
      const aiResult = aiResults.get(i)!;
      if (aiResult.matchedId && aiResult.confidence >= 0.7) {
        const matchedSimilarity = similarities.find(s => s.supplierItemId === aiResult.matchedId);
        if (matchedSimilarity) {
          match = {
            supplierItemId: matchedSimilarity.supplierItemId,
            nombre: matchedSimilarity.nombre,
            supplyId: matchedSimilarity.supplyId,
            supplyName: matchedSimilarity.supplyName,
            supplySku: matchedSimilarity.supplySku,
          };
          matchType = 'ai_assisted';
          usedAI = true;
        }
      }
    }

    // Si sigue sin match, mostrar sugerencias
    if (!match && similarities.length > 0) {
      suggestions = similarities.slice(0, 3).map(s => ({
        supplierItemId: s.supplierItemId,
        supplyName: s.supplyName,
        similarity: Math.round(s.similarity * 100),
      }));
    }

    // Registrar alias a actualizar
    if (aliasToUpdate) {
      aliasUpdates.push(aliasToUpdate);
    }

    results.push({
      ...item,
      match,
      matchType,
      needsMapping: !match,
      usedAI,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    });
  }

  // Actualizar contadores de alias en batch (más eficiente)
  if (aliasUpdates.length > 0) {
    await prisma.supplierItemAlias.updateMany({
      where: { id: { in: aliasUpdates } },
      data: { vecesUsado: { increment: 1 } }
    });
  }

  return results;
}

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Inicializar cliente de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

async function getUserFromToken() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select: {
        id: true,
        name: true,
        companies: {
          select: { companyId: true },
          take: 1
        }
      }
    });

    return user;
  } catch {
    return null;
  }
}

// Extraction version for auditing
const EXTRACTION_VERSION = 'v2';
const MODEL_ID = 'gpt-4o-mini';

// Prompt OPTIMIZADO con pistas visuales específicas para facturas argentinas
const EXTRACTION_PROMPT = `Extrae datos de esta factura argentina. Responde SOLO JSON válido.

ESTRUCTURA VISUAL DE FACTURAS ARGENTINAS (MUY IMPORTANTE):
1. PROVEEDOR/EMISOR (quien VENDE): Siempre en la parte SUPERIOR IZQUIERDA. Tiene logo, nombre grande, dirección, teléfono. El CAE pertenece a este.
2. LETRA DE FACTURA (A/B/C): En el CENTRO SUPERIOR dentro de un recuadro.
3. RECEPTOR/CLIENTE (quien COMPRA): Sección separada con etiquetas como "SEÑOR/ES:", "CLIENTE:", "FACTURAR A:", "DATOS DEL CLIENTE". Nunca tiene logo.
4. ITEMS/DETALLE: Tabla con productos en el medio.
5. TOTALES: Parte inferior con neto, IVA, total.
6. CAE + CÓDIGO DE BARRAS: Siempre al final, abajo de todo.

REGLAS:
- El nombre/logo GRANDE arriba = PROVEEDOR (quien emite)
- La sección "SEÑOR/ES" o "CLIENTE" = RECEPTOR (quien recibe)
- Si hay dos bloques de datos, el de ARRIBA es el proveedor, el etiquetado como cliente es receptor

Formato: fechas YYYY-MM-DD, montos decimales SIN $, CUIT XX-XXXXXXXX-X (11 dígitos).

{"tipo_comprobante":"FACTURA|NC|ND|REMITO","letra_comprobante":"A|B|C","punto_venta":"0001","numero_comprobante":"00012345","fecha_emision":"YYYY-MM-DD","fecha_vencimiento_pago":"YYYY-MM-DD","proveedor":{"razon_social":"","cuit":"","condicion_iva":""},"receptor":{"razon_social":"","cuit":"","condicion_iva":""},"subtotal_neto_gravado":0,"subtotal_neto_no_gravado":0,"subtotal_exento":0,"iva_21":0,"iva_10_5":0,"iva_27":0,"percepciones_iva":0,"percepciones_iibb":0,"otros_impuestos":0,"total":0,"cae":"","fecha_vencimiento_cae":"","items":[{"codigo":"","descripcion":"","cantidad":1,"unidad":"UN","precio_unitario":0,"subtotal":0,"iva_porcentaje":21}],"moneda":"ARS","confianza":0.95}

Campos faltantes: null. confianza: 0-1 según certeza.`;

// POST - Procesar factura con IA (soporta múltiples imágenes)
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    // Verificar API key de OpenAI
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'API key de OpenAI no configurada. Agregue OPENAI_API_KEY en .env.local' },
        { status: 500 }
      );
    }

    const formData = await request.formData();

    // Soportar múltiples imágenes (files[]) o una sola (file)
    const files = formData.getAll('files') as File[];
    const singleFile = formData.get('file') as File | null;
    const imagesToProcess = files.length > 0 ? files : (singleFile ? [singleFile] : []);

    if (imagesToProcess.length === 0) {
      return NextResponse.json({ error: 'Al menos un archivo es requerido' }, { status: 400 });
    }

    // Validar tipos de archivo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    for (const file of imagesToProcess) {
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
          { error: `Tipo de archivo no soportado: ${file.type}. Use JPG, PNG, WebP o GIF` },
          { status: 400 }
        );
      }
    }

    // Preparar imágenes para la API de OpenAI
    const imageContents: Array<{
      type: 'image_url';
      image_url: {
        url: string;
        detail: 'low' | 'high' | 'auto';
      };
    }> = [];

    for (const file of imagesToProcess) {
      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString('base64');
      const mimeType = file.type || 'image/png';

      imageContents.push({
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${base64}`,
          detail: 'high', // Alta resolución para mejor OCR
        },
      });
    }

    // Llamar a OpenAI API con todas las imágenes
    const completion = await openai.chat.completions.create({
      model: MODEL_ID,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            ...imageContents,
            {
              type: 'text',
              text: imagesToProcess.length > 1
                ? `${EXTRACTION_PROMPT}\n\nNOTA: Hay ${imagesToProcess.length} páginas. Consolida toda la información en un solo JSON.`
                : EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    });

    // Extraer respuesta
    const responseText = completion.choices[0]?.message?.content || '';

    // Parsear JSON de la respuesta
    let rawExtraction: any;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No se encontró JSON en la respuesta');
      }
      rawExtraction = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('Error parseando respuesta de IA:', parseError);
      return NextResponse.json(
        {
          success: false,
          status: 'parse_error',
          error: 'Error al procesar la respuesta de la IA',
          rawResponse: responseText
        },
        { status: 422 }
      );
    }

    // Validar con Zod
    const parsed = AIExtractionSchema.safeParse(rawExtraction);

    if (!parsed.success) {
      // La IA devolvió algo pero no cumple el schema
      return NextResponse.json({
        success: false,
        status: 'needs_manual',
        errors: parsed.error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message
        })),
        rawExtraction,
        metadata: {
          extractionVersion: EXTRACTION_VERSION,
          model: MODEL_ID,
          pagesProcessed: imagesToProcess.length,
          processingTimeMs: Date.now() - startTime
        }
      }, { status: 422 });
    }

    const extraction = parsed.data;

    // === AUTO-CORRECCIÓN DE ERRORES OCR ===
    const ocrCorrections: string[] = [];

    // Corregir CUIT del proveedor
    if (extraction.proveedor?.cuit) {
      const cuitFix = tryCorrectCuit(extraction.proveedor.cuit);
      if (cuitFix.wasFixed && cuitFix.corrected) {
        ocrCorrections.push(`CUIT proveedor corregido: ${cuitFix.original} → ${cuitFix.corrected}`);
        extraction.proveedor.cuit = cuitFix.corrected;
      } else if (cuitFix.corrected) {
        extraction.proveedor.cuit = cuitFix.corrected; // Formatear aunque no haya errores
      }
    }

    // Corregir CUIT del receptor
    if (extraction.receptor?.cuit) {
      const cuitFix = tryCorrectCuit(extraction.receptor.cuit);
      if (cuitFix.wasFixed && cuitFix.corrected) {
        ocrCorrections.push(`CUIT receptor corregido: ${cuitFix.original} → ${cuitFix.corrected}`);
        extraction.receptor.cuit = cuitFix.corrected;
      } else if (cuitFix.corrected) {
        extraction.receptor.cuit = cuitFix.corrected;
      }
    }

    // Corregir CAE
    if (extraction.cae) {
      const caeFix = tryCorrectCae(extraction.cae);
      if (caeFix.wasFixed && caeFix.corrected) {
        ocrCorrections.push(`CAE corregido: ${caeFix.original} → ${caeFix.corrected}`);
        extraction.cae = caeFix.corrected;
      }
    }

    // Corregir punto de venta (solo dígitos)
    if (extraction.punto_venta) {
      const pvOriginal = extraction.punto_venta;
      const { corrected } = correctOcrErrors(pvOriginal);
      if (corrected !== pvOriginal && /^\d+$/.test(corrected)) {
        ocrCorrections.push(`Punto de venta corregido: ${pvOriginal} → ${corrected}`);
        extraction.punto_venta = corrected.padStart(4, '0');
      }
    }

    // Corregir número de comprobante (solo dígitos)
    if (extraction.numero_comprobante) {
      const numOriginal = extraction.numero_comprobante;
      const { corrected } = correctOcrErrors(numOriginal);
      if (corrected !== numOriginal && /^\d+$/.test(corrected)) {
        ocrCorrections.push(`Número comprobante corregido: ${numOriginal} → ${corrected}`);
        extraction.numero_comprobante = corrected.padStart(8, '0');
      }
    }

    // Obtener CUIT de la empresa del usuario
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { cuit: true, name: true }
    });

    // === AUTO-SWAP: Detectar y corregir inversión proveedor/receptor ===
    // Si el CUIT de la empresa aparece como proveedor, la IA confundió emisor con receptor
    let wasAutoSwapped = false;
    if (company?.cuit) {
      const companyCuitNormalized = company.cuit.replace(/-/g, '');
      const proveedorCuitNormalized = extraction.proveedor?.cuit?.replace(/-/g, '') || '';
      const receptorCuitNormalized = extraction.receptor?.cuit?.replace(/-/g, '') || '';

      // Caso 1: El CUIT de la empresa está en proveedor (debería estar en receptor)
      if (proveedorCuitNormalized === companyCuitNormalized && receptorCuitNormalized !== companyCuitNormalized) {
        // Intercambiar proveedor y receptor
        const tempProveedor = { ...extraction.proveedor };
        const tempReceptor = extraction.receptor ? { ...extraction.receptor } : null;

        if (tempReceptor) {
          extraction.proveedor = {
            razon_social: tempReceptor.razon_social || '',
            cuit: tempReceptor.cuit || '',
            direccion: tempReceptor.direccion,
            condicion_iva: tempReceptor.condicion_iva
          };
          extraction.receptor = {
            razon_social: tempProveedor.razon_social || '',
            cuit: tempProveedor.cuit || '',
            direccion: tempProveedor.direccion,
            condicion_iva: tempProveedor.condicion_iva
          };
          wasAutoSwapped = true;
          ocrCorrections.push(`🔄 Auto-corregido: Se intercambiaron proveedor y receptor (la IA los confundió)`);
        }
      }
      // Caso 2: Ni proveedor ni receptor tienen el CUIT de la empresa pero el proveedor tiene datos típicos de receptor
      else if (
        proveedorCuitNormalized !== companyCuitNormalized &&
        receptorCuitNormalized !== companyCuitNormalized &&
        extraction.proveedor?.razon_social
      ) {
        const provRazon = extraction.proveedor.razon_social.toUpperCase();
        // Si el proveedor tiene nombre típico de cliente (SEÑOR, SR., etc.) probablemente está invertido
        if (provRazon.includes('SEÑOR') || provRazon.includes('SR.') || provRazon.includes('SEÑORA') || provRazon.includes('SRA.')) {
          const tempProveedor = { ...extraction.proveedor };
          const tempReceptor = extraction.receptor ? { ...extraction.receptor } : null;

          if (tempReceptor && tempReceptor.cuit) {
            extraction.proveedor = {
              razon_social: tempReceptor.razon_social || '',
              cuit: tempReceptor.cuit || '',
              direccion: tempReceptor.direccion,
              condicion_iva: tempReceptor.condicion_iva
            };
            extraction.receptor = {
              razon_social: tempProveedor.razon_social || '',
              cuit: tempProveedor.cuit || '',
              direccion: tempProveedor.direccion,
              condicion_iva: tempProveedor.condicion_iva
            };
            wasAutoSwapped = true;
            ocrCorrections.push(`🔄 Auto-corregido: Se intercambiaron proveedor y receptor (nombre de proveedor parecía cliente)`);
          }
        }
      }
    }

    // Validar que la factura esté emitida a la empresa del usuario (receptor)
    let receptorValidation = {
      isValid: true,
      companyCuit: company?.cuit || null,
      extractedReceptorCuit: extraction.receptor?.cuit || null,
      message: '',
      wasAutoSwapped
    };

    if (company?.cuit && extraction.receptor?.cuit) {
      const companyCuitNormalized = company.cuit.replace(/-/g, '');
      const receptorCuitNormalized = extraction.receptor.cuit.replace(/-/g, '');

      if (companyCuitNormalized !== receptorCuitNormalized) {
        receptorValidation.isValid = false;
        receptorValidation.message = `La factura está emitida a CUIT ${extraction.receptor.cuit} pero tu empresa tiene CUIT ${company.cuit}`;
      }
    }

    // Validación contable
    const accountingValidation = validateAccounting(extraction);
    const missingFields = validateRequiredFields(extraction);

    // Ajustar confianza basada en validaciones
    let adjustedConfidence = calculateConfidenceScore(extraction, accountingValidation);

    // Penalizar por correcciones OCR (indica lectura no perfecta)
    if (ocrCorrections.length > 0) {
      adjustedConfidence = Math.max(0, adjustedConfidence - (ocrCorrections.length * 0.05));
    }

    // Buscar proveedor por CUIT
    let matchedSupplier = null;
    if (extraction.proveedor?.cuit) {
      matchedSupplier = await findSupplierByCuit(extraction.proveedor.cuit, companyId);
    }

    // Si no se encontró por CUIT, buscar por nombre similar
    if (!matchedSupplier && extraction.proveedor?.razon_social) {
      const proveedor = await prisma.suppliers.findFirst({
        where: {
          company_id: companyId,
          OR: [
            { name: { contains: extraction.proveedor.razon_social, mode: 'insensitive' } },
            { razon_social: { contains: extraction.proveedor.razon_social, mode: 'insensitive' } }
          ]
        },
        select: { id: true, name: true, cuit: true }
      });

      if (proveedor) {
        matchedSupplier = {
          ...proveedor,
          matchType: 'nombre_similar'
        };
      }
    }

    // Verificar duplicados con el nuevo sistema
    const duplicateCheck = await checkDuplicate(extraction, companyId);

    // Detectar docType (T1/T2)
    const { docType, suggestedTipo } = detectDocType(extraction);

    // Matching de items si hay proveedor encontrado
    let itemsWithMatches = extraction.items || [];
    let itemMatchingSummary = { total: 0, matched: 0, needsMapping: 0, aiAssisted: 0 };

    if (matchedSupplier && extraction.items && extraction.items.length > 0) {
      const matchedItems = await matchInvoiceItems(
        extraction.items,
        matchedSupplier.id,
        companyId,
        openai // Pasar cliente OpenAI para AI matching de items
      );
      itemsWithMatches = matchedItems;
      itemMatchingSummary = {
        total: matchedItems.length,
        matched: matchedItems.filter(i => i.match).length,
        needsMapping: matchedItems.filter(i => !i.match).length,
        aiAssisted: matchedItems.filter(i => i.matchType === 'ai_assisted').length,
      };
    }

    // Detectar posible cruce de datos emisor/receptor
    const crossDataValidation = detectCrossedData(extraction, company?.cuit || undefined);

    // Penalizar confianza por posible cruce de datos
    if (crossDataValidation.isPotentiallyCrossed) {
      adjustedConfidence = Math.max(0, adjustedConfidence - 0.2);
    }

    // Compilar warnings
    const allWarnings: string[] = [
      ...accountingValidation.warnings,
      ...(missingFields.length > 0 ? [`Campos faltantes: ${missingFields.join(', ')}`] : []),
      ...(duplicateCheck.isDuplicate ? [`${duplicateCheck.confidence === 'confirmed' ? '⚠️ Duplicado confirmado' : '⚠️ Posible duplicado'}: ${duplicateCheck.reason}`] : []),
      ...(docType === 'T2' ? [`Documento detectado como interno (${suggestedTipo || 'no fiscal'})`] : []),
      ...(!receptorValidation.isValid ? [`🚫 ${receptorValidation.message}`] : []),
      ...crossDataValidation.warnings,
      ...(ocrCorrections.length > 0 ? [`ℹ️ Correcciones automáticas OCR: ${ocrCorrections.join('; ')}`] : [])
    ];

    // Preparar respuesta
    const response = {
      success: true,
      extraction: {
        ...extraction,
        // Agregar campos derivados
        tipo_sistema: mapTipoComprobante(extraction),
        docType,
        // Usar receptor ya corregido (puede haber sido auto-swapped)
        receptor: extraction.receptor || null,
        // Items con información de matching
        items: itemsWithMatches,
      },
      receptorValidation,
      matchedSupplier: matchedSupplier ? {
        id: matchedSupplier.id,
        name: matchedSupplier.name,
        cuit: matchedSupplier.cuit,
        matched: true,
        matchType: (matchedSupplier as any).matchType || 'cuit'
      } : {
        matched: false,
        suggested: extraction.proveedor,
        message: 'Proveedor no encontrado. Se creará uno nuevo al guardar.'
      },
      itemMatching: itemMatchingSummary,
      duplicate: duplicateCheck,
      accounting: accountingValidation,
      confidence: adjustedConfidence,
      warnings: allWarnings,
      metadata: {
        extractionVersion: EXTRACTION_VERSION,
        model: MODEL_ID,
        pagesProcessed: imagesToProcess.length,
        processingTimeMs: Date.now() - startTime
      }
    };

    // Registrar uso de IA en auditoría
    await prisma.purchaseAuditLog.create({
      data: {
        entidad: 'ia_extraction',
        entidadId: 0,
        accion: 'PROCESAR_FACTURA_IA',
        datosNuevos: {
          archivo: imagesToProcess.map(f => f.name).join(', '),
          paginasProcesadas: imagesToProcess.length,
          confianza: adjustedConfidence,
          confianzaOriginal: extraction.confianza,
          proveedorEncontrado: matchedSupplier !== null,
          duplicadoDetectado: duplicateCheck.isDuplicate,
          duplicadoConfianza: duplicateCheck.confidence,
          warningsContables: accountingValidation.warnings.length,
          wasAutoSwapped, // Registrar si hubo auto-corrección de proveedor/receptor
          ocrCorrections: ocrCorrections.length,
          itemMatching: {
            total: itemMatchingSummary.total,
            matched: itemMatchingSummary.matched,
            aiAssisted: itemMatchingSummary.aiAssisted,
            needsMapping: itemMatchingSummary.needsMapping
          },
          extractionVersion: EXTRACTION_VERSION,
          model: MODEL_ID
        },
        companyId,
        userId: user.id
      }
    });

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error procesando factura con IA:', error);

    if (error.status === 401 || error.code === 'invalid_api_key') {
      return NextResponse.json(
        { error: 'Error de autenticación con OpenAI API. Verifique su API key.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error al procesar la factura',
        metadata: {
          extractionVersion: EXTRACTION_VERSION,
          model: MODEL_ID,
          processingTimeMs: Date.now() - startTime
        }
      },
      { status: 500 }
    );
  }
}

// GET - Obtener estado de la configuración de IA
export async function GET() {
  const configured = !!process.env.OPENAI_API_KEY;

  return NextResponse.json({
    configured,
    model: MODEL_ID,
    provider: 'OpenAI',
    costPerInvoice: '~$0.001-0.003 USD',
    capabilities: [
      'Extracción de datos de facturas',
      'Detección de tipo de comprobante',
      'Identificación de proveedor',
      'Extracción de items y montos',
      'Validación de CAE'
    ],
    supportedFormats: ['JPG', 'PNG', 'WebP', 'GIF'],
    note: configured ? 'IA configurada correctamente' : 'Configure OPENAI_API_KEY en variables de entorno (.env.local)'
  });
}
