import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  try {
    const token = cookies().get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select: {
        id: true,
        companies: {
          select: { companyId: true },
          take: 1
        }
      }
    });

    return user;
  } catch (error) {
    return null;
  }
}

interface DuplicateCheckResult {
  isDuplicate: boolean;
  confidence: 'alta' | 'media' | 'baja';
  reason: string;
  duplicados: any[];
}

// POST - Verificar si una factura es duplicada
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const body = await request.json();
    const {
      supplierId,
      numeroFactura,
      puntoVenta,
      montoTotal,
      fecha,
      cae,
      excludeId // Para excluir la factura actual al editar
    } = body;

    if (!supplierId || !numeroFactura) {
      return NextResponse.json(
        { error: 'supplierId y numeroFactura son requeridos' },
        { status: 400 }
      );
    }

    const duplicados: any[] = [];
    let maxConfidence: 'alta' | 'media' | 'baja' = 'baja';

    // 1. Búsqueda exacta por número de factura y proveedor
    const exactMatch = await prisma.purchaseReceipt.findMany({
      where: {
        companyId,
        supplierId: parseInt(supplierId),
        numero_factura: numeroFactura.trim(),
        ...(excludeId && { id: { not: parseInt(excludeId) } })
      },
      include: {
        supplier: { select: { id: true, name: true, cuit: true } }
      }
    });

    if (exactMatch.length > 0) {
      duplicados.push(...exactMatch.map(f => ({
        ...f,
        matchType: 'exact',
        confidence: 'alta' as const,
        reason: 'Mismo número de factura y proveedor'
      })));
      maxConfidence = 'alta';
    }

    // 2. Búsqueda por CAE (único por factura)
    if (cae) {
      const caeMatch = await prisma.purchaseReceipt.findMany({
        where: {
          companyId,
          cae: cae.trim(),
          ...(excludeId && { id: { not: parseInt(excludeId) } })
        },
        include: {
          supplier: { select: { id: true, name: true, cuit: true } }
        }
      });

      if (caeMatch.length > 0) {
        const nuevos = caeMatch.filter(f => !duplicados.find(d => d.id === f.id));
        duplicados.push(...nuevos.map(f => ({
          ...f,
          matchType: 'cae',
          confidence: 'alta' as const,
          reason: 'Mismo CAE (código de autorización electrónica)'
        })));
        maxConfidence = 'alta';
      }
    }

    // 3. Búsqueda por punto de venta + número + proveedor
    if (puntoVenta) {
      const pvMatch = await prisma.purchaseReceipt.findMany({
        where: {
          companyId,
          supplierId: parseInt(supplierId),
          punto_venta: puntoVenta.toString().padStart(5, '0'),
          numero_factura: numeroFactura.trim(),
          ...(excludeId && { id: { not: parseInt(excludeId) } })
        },
        include: {
          supplier: { select: { id: true, name: true, cuit: true } }
        }
      });

      if (pvMatch.length > 0) {
        const nuevos = pvMatch.filter(f => !duplicados.find(d => d.id === f.id));
        duplicados.push(...nuevos.map(f => ({
          ...f,
          matchType: 'punto_venta',
          confidence: 'alta' as const,
          reason: 'Mismo punto de venta, número de factura y proveedor'
        })));
        maxConfidence = 'alta';
      }
    }

    // 4. Búsqueda por monto similar en el mismo día/proveedor (posible duplicado)
    if (montoTotal && fecha) {
      const monto = parseFloat(montoTotal);
      const fechaBase = new Date(fecha);
      const fechaInicio = new Date(fechaBase);
      fechaInicio.setDate(fechaInicio.getDate() - 3); // 3 días antes
      const fechaFin = new Date(fechaBase);
      fechaFin.setDate(fechaFin.getDate() + 3); // 3 días después

      const similarMatch = await prisma.purchaseReceipt.findMany({
        where: {
          companyId,
          supplierId: parseInt(supplierId),
          fecha: {
            gte: fechaInicio,
            lte: fechaFin
          },
          monto_total: {
            gte: monto * 0.99, // 1% de tolerancia
            lte: monto * 1.01
          },
          ...(excludeId && { id: { not: parseInt(excludeId) } })
        },
        include: {
          supplier: { select: { id: true, name: true, cuit: true } }
        }
      });

      if (similarMatch.length > 0) {
        const nuevos = similarMatch.filter(f => !duplicados.find(d => d.id === f.id));
        if (nuevos.length > 0) {
          duplicados.push(...nuevos.map(f => ({
            ...f,
            matchType: 'similar',
            confidence: 'media' as const,
            reason: 'Monto similar en fechas cercanas del mismo proveedor'
          })));
          if (maxConfidence === 'baja') {
            maxConfidence = 'media';
          }
        }
      }
    }

    // 5. Búsqueda por número similar (errores de tipeo)
    const numeroLimpio = numeroFactura.replace(/[^0-9]/g, '');
    if (numeroLimpio.length >= 4) {
      const similarNumberMatch = await prisma.purchaseReceipt.findMany({
        where: {
          companyId,
          supplierId: parseInt(supplierId),
          numero_factura: { contains: numeroLimpio.slice(-6) }, // Últimos 6 dígitos
          ...(excludeId && { id: { not: parseInt(excludeId) } })
        },
        include: {
          supplier: { select: { id: true, name: true, cuit: true } }
        },
        take: 5
      });

      if (similarNumberMatch.length > 0) {
        const nuevos = similarNumberMatch.filter(f => !duplicados.find(d => d.id === f.id));
        if (nuevos.length > 0) {
          duplicados.push(...nuevos.map(f => ({
            ...f,
            matchType: 'similar_number',
            confidence: 'baja' as const,
            reason: 'Número de factura similar'
          })));
        }
      }
    }

    const isDuplicate = duplicados.length > 0;
    let reason = '';

    if (isDuplicate) {
      const altaConfianza = duplicados.filter(d => d.confidence === 'alta');
      const mediaConfianza = duplicados.filter(d => d.confidence === 'media');

      if (altaConfianza.length > 0) {
        reason = `Se encontró ${altaConfianza.length} factura(s) con coincidencia exacta`;
      } else if (mediaConfianza.length > 0) {
        reason = `Se encontró ${mediaConfianza.length} factura(s) con coincidencia probable`;
      } else {
        reason = `Se encontró ${duplicados.length} factura(s) con similitudes`;
      }
    }

    const result: DuplicateCheckResult = {
      isDuplicate,
      confidence: maxConfidence,
      reason,
      duplicados: duplicados.map(d => ({
        id: d.id,
        numero_factura: d.numero_factura,
        punto_venta: d.punto_venta,
        fecha: d.fecha,
        monto_total: d.monto_total,
        estado: d.estado,
        supplier: d.supplier,
        matchType: d.matchType,
        confidence: d.confidence,
        matchReason: d.reason
      }))
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error verificando duplicado:', error);
    return NextResponse.json(
      { error: 'Error al verificar duplicados' },
      { status: 500 }
    );
  }
}
