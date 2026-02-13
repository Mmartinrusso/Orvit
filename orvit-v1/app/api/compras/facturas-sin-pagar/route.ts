import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getT2Client, isT2DatabaseConfigured } from '@/lib/prisma-t2';
import { getViewMode } from '@/lib/view-mode/get-mode';
import { MODE } from '@/lib/view-mode/types';

// Caché en memoria para facturas (5 minutos TTL)
interface CacheEntry {
  data: any[];
  timestamp: number;
  proveedorId: number;
  companyId: number;
}

const facturasCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Crear índices compuestos si no existen (ejecutar una sola vez)
let indicesCreated = false;

async function ensureIndexes() {
  if (indicesCreated) return;
  
  try {
    // Crear índice compuesto para la query principal (parcial para facturas no pagadas)
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "idx_purchase_receipt_unpaid" 
      ON "PurchaseReceipt"("proveedorId", "companyId", "fechaVencimiento")
      WHERE "estado" != 'pagado';
    `;
    
    indicesCreated = true;
  } catch (error) {
    // Si hay error creando índices, continuar (probablemente ya existen)
    console.warn('Warning al crear índices (pueden existir ya):', error);
    indicesCreated = true; // No reintentar
  }
}

// GET /api/compras/facturas-sin-pagar - Obtener facturas sin pagar de un proveedor
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const proveedorId = searchParams.get('proveedorId');
  const companyId = searchParams.get('companyId');

  try {
    if (!proveedorId || !companyId) {
      return NextResponse.json(
        { error: 'proveedorId y companyId son requeridos' },
        { status: 400 }
      );
    }

    // Obtener ViewMode desde header X-VM (inyectado por middleware)
    const viewMode = getViewMode(request);

    const proveedorIdNum = parseInt(proveedorId);
    const companyIdNum = parseInt(companyId);
    // Incluir viewMode en cache key para separar resultados por modo
    const cacheKey = `${proveedorIdNum}-${companyIdNum}-${viewMode}`;

    // Verificar caché
    const cached = facturasCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        facturas: cached.data,
        cached: true
      }, {
        headers: {
          'Cache-Control': 'public, max-age=300', // 5 minutos en el navegador
        }
      });
    }

    // Asegurar índices
    await ensureIndexes();

    // Query optimizada: calcular días de vencimiento directamente en SQL
    // En Standard mode: filtrar solo T1 y null (legacy)
    // En Extended mode: mostrar todo (T1 + T2)

    // Query T1
    const facturasT1 = viewMode === MODE.STANDARD
      ? await prisma.$queryRaw<Array<{
          id: number;
          numeroSerie: string;
          numeroFactura: string;
          tipo: string;
          fechaEmision: Date;
          fechaVencimiento: Date | null;
          total: number;
          estado: string;
          diasVencimiento: number | null;
          docType: string | null;
        }>>`
          SELECT
            pr."id",
            pr."numeroSerie",
            pr."numeroFactura",
            pr."tipo",
            pr."fechaEmision",
            pr."fechaVencimiento",
            pr."total",
            pr."estado",
            pr."docType",
            CASE
              WHEN pr."fechaVencimiento" IS NOT NULL THEN
                (pr."fechaVencimiento" - CURRENT_DATE)::integer
              ELSE NULL
            END AS "diasVencimiento"
          FROM "PurchaseReceipt" pr
          LEFT JOIN "PaymentOrderReceipt" por ON por."receiptId" = pr."id"
          WHERE pr."proveedorId" = ${proveedorIdNum}
            AND pr."companyId" = ${companyIdNum}
            AND pr."estado" != 'pagado'
            AND por."id" IS NULL
            AND (pr."docType" = 'T1' OR pr."docType" IS NULL)
          ORDER BY
            pr."fechaVencimiento" ASC NULLS LAST,
            pr."fechaEmision" DESC
          LIMIT 500
        `
      : await prisma.$queryRaw<Array<{
          id: number;
          numeroSerie: string;
          numeroFactura: string;
          tipo: string;
          fechaEmision: Date;
          fechaVencimiento: Date | null;
          total: number;
          estado: string;
          diasVencimiento: number | null;
          docType: string | null;
        }>>`
          SELECT
            pr."id",
            pr."numeroSerie",
            pr."numeroFactura",
            pr."tipo",
            pr."fechaEmision",
            pr."fechaVencimiento",
            pr."total",
            pr."estado",
            pr."docType",
            CASE
              WHEN pr."fechaVencimiento" IS NOT NULL THEN
                (pr."fechaVencimiento" - CURRENT_DATE)::integer
              ELSE NULL
            END AS "diasVencimiento"
          FROM "PurchaseReceipt" pr
          LEFT JOIN "PaymentOrderReceipt" por ON por."receiptId" = pr."id"
          WHERE pr."proveedorId" = ${proveedorIdNum}
            AND pr."companyId" = ${companyIdNum}
            AND pr."estado" != 'pagado'
            AND por."id" IS NULL
          ORDER BY
            pr."fechaVencimiento" ASC NULLS LAST,
            pr."fechaEmision" DESC
          LIMIT 500
        `;

    // En Extended mode, también consultar T2
    let facturasT2: Array<{
      id: number;
      numeroSerie: string;
      numeroFactura: string;
      tipo: string;
      fechaEmision: Date;
      fechaVencimiento: Date | null;
      total: number;
      estado: string;
      diasVencimiento: number | null;
      docType: string;
    }> = [];

    if (viewMode === MODE.EXTENDED && isT2DatabaseConfigured()) {
      try {
        const prismaT2 = getT2Client();
        // Query T2 - PPT sin pagar (usa supplierId en lugar de proveedorId)
        const t2Raw = await prismaT2.t2PurchaseReceipt.findMany({
          where: {
            supplierId: proveedorIdNum,
            companyId: companyIdNum,
            estado: { not: 'pagado' },
            // Excluir los que ya tienen orden de pago
            paymentOrders: { none: {} }
          },
          select: {
            id: true,
            numeroSerie: true,
            numeroFactura: true,
            tipo: true,
            fechaEmision: true,
            fechaVencimiento: true,
            total: true,
            estado: true,
          },
          orderBy: [
            { fechaVencimiento: 'asc' },
            { fechaEmision: 'desc' }
          ],
          take: 500
        });

        facturasT2 = t2Raw.map(f => {
          const fechaVenc = f.fechaVencimiento ? new Date(f.fechaVencimiento) : null;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const diasVenc = fechaVenc
            ? Math.ceil((fechaVenc.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            : null;

          return {
            id: f.id,
            numeroSerie: f.numeroSerie,
            numeroFactura: f.numeroFactura,
            tipo: f.tipo,
            fechaEmision: f.fechaEmision,
            fechaVencimiento: f.fechaVencimiento,
            total: f.total as unknown as number,
            estado: f.estado,
            diasVencimiento: diasVenc,
            docType: 'T2' as const
          };
        });
      } catch (error) {
        console.error('Error querying T2 for facturas-sin-pagar:', error);
        // Continue with T1 results only
      }
    }

    // Combinar y ordenar resultados
    const facturas = [...facturasT1, ...facturasT2].sort((a, b) => {
      // Ordenar por fecha de vencimiento ASC (nulls last)
      if (a.fechaVencimiento === null && b.fechaVencimiento !== null) return 1;
      if (a.fechaVencimiento !== null && b.fechaVencimiento === null) return -1;
      if (a.fechaVencimiento && b.fechaVencimiento) {
        const dateA = new Date(a.fechaVencimiento).getTime();
        const dateB = new Date(b.fechaVencimiento).getTime();
        if (dateA !== dateB) return dateA - dateB;
      }
      // Secondary sort by fechaEmision DESC
      const emisionA = new Date(a.fechaEmision).getTime();
      const emisionB = new Date(b.fechaEmision).getTime();
      return emisionB - emisionA;
    }).slice(0, 500);

    // Formatear las facturas de forma más eficiente
    const facturasFormateadas = facturas.map(f => ({
      id: f.id,
      numeroSerie: f.numeroSerie,
      numeroFactura: f.numeroFactura,
      tipo: f.tipo,
      fechaEmision: f.fechaEmision instanceof Date
        ? f.fechaEmision.toISOString().split('T')[0]
        : (typeof f.fechaEmision === 'string' ? f.fechaEmision.split('T')[0] : null),
      fechaVencimiento: f.fechaVencimiento instanceof Date
        ? f.fechaVencimiento.toISOString().split('T')[0]
        : (f.fechaVencimiento ? String(f.fechaVencimiento).split('T')[0] : null),
      total: f.total ? parseFloat(String(f.total)) : 0,
      estado: f.estado,
      diasVencimiento: f.diasVencimiento !== null ? Math.ceil(f.diasVencimiento) : undefined,
      docType: f.docType || 'T1'  // Incluir docType (default T1 para legacy/null)
    }));

    // Guardar en caché
    facturasCache.set(cacheKey, {
      data: facturasFormateadas,
      timestamp: Date.now(),
      proveedorId: proveedorIdNum,
      companyId: companyIdNum
    });

    // Limpiar caché antiguo (más de 10 minutos)
    if (facturasCache.size > 100) {
      const now = Date.now();
      for (const [key, entry] of facturasCache.entries()) {
        if (now - entry.timestamp > 10 * 60 * 1000) {
          facturasCache.delete(key);
        }
      }
    }

    return NextResponse.json({
      success: true,
      facturas: facturasFormateadas
    }, {
      headers: {
        'Cache-Control': 'public, max-age=300', // 5 minutos en el navegador
      }
    });
  } catch (error) {
    console.error('Error en GET /api/compras/facturas-sin-pagar:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    if (process.env.NODE_ENV === 'development') {
      console.error('Error detallado:', {
        message: errorMessage,
        stack: errorStack,
        proveedorId,
        companyId
      });
    }
    
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        message: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}

