import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/compras/auth';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

// Inicializar cliente de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

const MODEL_ID = 'gpt-4o-mini';
const EXTRACTION_VERSION = 'v1';

// Prompt optimizado para cotizaciones de proveedores
const EXTRACTION_PROMPT = `Extrae datos de esta COTIZACIÓN/PRESUPUESTO de proveedor. Responde SOLO JSON válido.

ESTRUCTURA TÍPICA DE COTIZACIONES:
1. PROVEEDOR (quien cotiza): Nombre/logo arriba, datos de contacto, CUIT
2. CLIENTE (a quien va dirigida): "Atención:", "Cliente:", "Señores:"
3. NÚMERO DE COTIZACIÓN: "Cotización N°", "Presupuesto N°", "Ref:"
4. FECHA: Fecha de emisión y posible validez
5. ITEMS: Tabla con productos/servicios cotizados
6. CONDICIONES: Forma de pago, plazo de entrega, validez

REGLAS:
- Extraer TODOS los items de la tabla de productos
- Si hay descuentos por item, incluirlos
- Identificar condiciones de pago (contado, 30 días, etc.)
- Plazo de entrega en días si está especificado
- Validez de la cotización en días

Formato: fechas YYYY-MM-DD, montos decimales SIN $, CUIT XX-XXXXXXXX-X.

{
  "numero_cotizacion": "string o null",
  "fecha_emision": "YYYY-MM-DD o null",
  "validez_dias": "number o null",
  "proveedor": {
    "razon_social": "string",
    "cuit": "string o null",
    "direccion": "string o null",
    "telefono": "string o null",
    "email": "string o null"
  },
  "cliente": {
    "razon_social": "string o null",
    "cuit": "string o null"
  },
  "condiciones_pago": "string o null",
  "plazo_entrega_dias": "number o null",
  "fecha_entrega_estimada": "YYYY-MM-DD o null",
  "moneda": "ARS|USD",
  "items": [
    {
      "codigo": "string o null",
      "descripcion": "string (REQUERIDO)",
      "cantidad": "number",
      "unidad": "UN|KG|LT|M|M2|etc",
      "precio_unitario": "number",
      "descuento_porcentaje": "number o 0",
      "subtotal": "number"
    }
  ],
  "subtotal": "number",
  "descuento_total": "number o 0",
  "iva": "number o null",
  "total": "number",
  "observaciones": "string o null",
  "confianza": "0-1 según certeza de la extracción"
}

Campos que no puedas leer claramente: null. Items sin precio: excluirlos.`;

// Buscar proveedor por CUIT o nombre
async function findSupplier(cuit: string | null, nombre: string | null, companyId: number) {
  // Primero buscar por CUIT
  if (cuit) {
    const cuitNormalized = cuit.replace(/-/g, '');
    const supplier = await prisma.suppliers.findFirst({
      where: {
        company_id: companyId,
        OR: [
          { cuit: cuit },
          { cuit: cuitNormalized },
          { cuit: { contains: cuitNormalized } }
        ]
      },
      select: { id: true, name: true, cuit: true }
    });
    if (supplier) return { ...supplier, matchType: 'cuit' as const };
  }

  // Luego buscar por nombre
  if (nombre) {
    const supplier = await prisma.suppliers.findFirst({
      where: {
        company_id: companyId,
        OR: [
          { name: { contains: nombre, mode: 'insensitive' } },
          { razon_social: { contains: nombre, mode: 'insensitive' } }
        ]
      },
      select: { id: true, name: true, cuit: true }
    });
    if (supplier) return { ...supplier, matchType: 'nombre' as const };
  }

  return null;
}

// POST - Procesar cotización con IA
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { user, error } = await requirePermission('compras.cotizaciones.create');
    if (error) return error;

    const companyId = user!.companyId;

    // Verificar API key de OpenAI
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'API key de OpenAI no configurada' },
        { status: 500 }
      );
    }

    const formData = await request.formData();

    // Soportar múltiples imágenes o una sola
    const files = formData.getAll('files') as File[];
    const singleFile = formData.get('file') as File | null;
    const requestId = formData.get('requestId') as string | null;
    const imagesToProcess = files.length > 0 ? files : (singleFile ? [singleFile] : []);

    if (imagesToProcess.length === 0) {
      return NextResponse.json({ error: 'Al menos un archivo es requerido' }, { status: 400 });
    }

    // Validar tipos de archivo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    for (const file of imagesToProcess) {
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
          { error: `Tipo de archivo no soportado: ${file.type}. Use JPG, PNG, WebP, GIF o PDF` },
          { status: 400 }
        );
      }
    }

    // Preparar imágenes para la API de OpenAI
    const imageContents: Array<{
      type: 'image_url';
      image_url: { url: string; detail: 'high' };
    }> = [];

    for (const file of imagesToProcess) {
      // Si es PDF, por ahora solo soportamos imágenes
      if (file.type === 'application/pdf') {
        return NextResponse.json(
          { error: 'Para PDF, por favor convierta primero a imagen (captura de pantalla o foto)' },
          { status: 400 }
        );
      }

      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString('base64');
      const mimeType = file.type || 'image/png';

      imageContents.push({
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${base64}`,
          detail: 'high',
        },
      });
    }

    // Llamar a OpenAI API
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
                ? `${EXTRACTION_PROMPT}\n\nNOTA: Hay ${imagesToProcess.length} páginas. Consolida en un solo JSON.`
                : EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    });

    // Extraer respuesta
    const responseText = completion.choices[0]?.message?.content || '';

    // Parsear JSON
    let extraction: any;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No se encontró JSON en la respuesta');
      }
      extraction = JSON.parse(jsonMatch[0]);
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

    // Buscar proveedor
    const matchedSupplier = await findSupplier(
      extraction.proveedor?.cuit,
      extraction.proveedor?.razon_social,
      companyId
    );

    // Si se proporcionó requestId, obtener info del pedido
    let requestInfo = null;
    if (requestId) {
      requestInfo = await prisma.purchaseRequest.findUnique({
        where: { id: parseInt(requestId) },
        select: { id: true, numero: true, titulo: true }
      });
    }

    // Calcular totales si faltan
    if (extraction.items && extraction.items.length > 0) {
      const calculatedSubtotal = extraction.items.reduce((sum: number, item: any) => {
        const subtotal = item.subtotal || (item.cantidad * item.precio_unitario * (1 - (item.descuento_porcentaje || 0) / 100));
        return sum + subtotal;
      }, 0);

      if (!extraction.subtotal) extraction.subtotal = calculatedSubtotal;
      if (!extraction.total && extraction.subtotal) {
        extraction.total = extraction.subtotal + (extraction.iva || extraction.subtotal * 0.21);
      }
    }

    // Preparar respuesta
    const response = {
      success: true,
      extraction: {
        ...extraction,
        // Normalizar items
        items: (extraction.items || []).map((item: any, idx: number) => ({
          id: `ext-${idx}`,
          codigo: item.codigo || null,
          descripcion: item.descripcion || 'Sin descripción',
          cantidad: Number(item.cantidad) || 1,
          unidad: item.unidad || 'UN',
          precioUnitario: Number(item.precio_unitario) || 0,
          descuento: Number(item.descuento_porcentaje) || 0,
          subtotal: Number(item.subtotal) || (Number(item.cantidad) * Number(item.precio_unitario)),
        })),
      },
      matchedSupplier: matchedSupplier ? {
        id: matchedSupplier.id,
        name: matchedSupplier.name,
        cuit: matchedSupplier.cuit,
        matched: true,
        matchType: matchedSupplier.matchType
      } : {
        matched: false,
        suggested: extraction.proveedor,
        message: 'Proveedor no encontrado. Se puede crear uno nuevo.'
      },
      requestInfo,
      confidence: extraction.confianza || 0.8,
      warnings: [
        ...(!matchedSupplier ? ['Proveedor no encontrado en el sistema'] : []),
        ...(extraction.items?.length === 0 ? ['No se detectaron items en la cotización'] : []),
        ...(!extraction.total ? ['No se pudo determinar el total'] : []),
      ],
      metadata: {
        extractionVersion: EXTRACTION_VERSION,
        model: MODEL_ID,
        pagesProcessed: imagesToProcess.length,
        processingTimeMs: Date.now() - startTime
      }
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error procesando cotización con IA:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error al procesar la cotización',
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

// GET - Estado de configuración
export async function GET() {
  const configured = !!process.env.OPENAI_API_KEY;

  return NextResponse.json({
    configured,
    model: MODEL_ID,
    provider: 'OpenAI',
    capabilities: [
      'Extracción de datos de cotizaciones/presupuestos',
      'Identificación de proveedor',
      'Extracción de items y precios',
      'Detección de condiciones de pago',
      'Plazo de entrega'
    ],
    supportedFormats: ['JPG', 'PNG', 'WebP', 'GIF'],
  });
}
