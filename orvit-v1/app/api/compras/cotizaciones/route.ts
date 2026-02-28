import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/compras/auth';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

// Generar numero de cotizacion automatico
async function generarNumeroCotizacion(companyId: number): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `COT-${year}-`;

  const ultimaCot = await prisma.purchaseQuotation.findFirst({
    where: {
      companyId,
      numero: { startsWith: prefix }
    },
    orderBy: { numero: 'desc' },
    select: { numero: true }
  });

  if (ultimaCot) {
    const ultimoNumero = parseInt(ultimaCot.numero.replace(prefix, '')) || 0;
    return `${prefix}${String(ultimoNumero + 1).padStart(5, '0')}`;
  }

  return `${prefix}00001`;
}

// GET - Listar cotizaciones
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission('compras.cotizaciones.view');
    if (error) return error;

    const companyId = user!.companyId;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const estado = searchParams.get('estado');
    const requestId = searchParams.get('requestId');
    const supplierId = searchParams.get('supplierId');
    const search = searchParams.get('search');

    const where: Prisma.PurchaseQuotationWhereInput = {
      companyId,
      ...(estado && { estado: estado as any }),
      ...(requestId && { requestId: parseInt(requestId) }),
      ...(supplierId && { supplierId: parseInt(supplierId) }),
      ...(search && {
        OR: [
          { numero: { contains: search, mode: 'insensitive' } },
          { supplier: { name: { contains: search, mode: 'insensitive' } } }
        ]
      })
    };

    const [cotizaciones, total] = await Promise.all([
      prisma.purchaseQuotation.findMany({
        where,
        select: {
          id: true,
          numero: true,
          requestId: true,
          supplierId: true,
          estado: true,
          fechaCotizacion: true,
          validezHasta: true,
          plazoEntrega: true,
          subtotal: true,
          impuestos: true,
          total: true,
          moneda: true,
          esSeleccionada: true,
          createdBy: true,
          createdAt: true,
          request: {
            select: {
              id: true,
              numero: true,
              titulo: true,
              estado: true
            }
          },
          supplier: {
            select: { id: true, name: true }
          },
          createdByUser: {
            select: { id: true, name: true }
          },
          _count: {
            select: { items: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.purchaseQuotation.count({ where })
    ]);

    return NextResponse.json({
      data: cotizaciones,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('[cotizaciones] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener las cotizaciones' },
      { status: 500 }
    );
  }
}

// POST - Crear cotizacion
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission('compras.cotizaciones.create');
    if (error) return error;

    const companyId = user!.companyId;

    const body = await request.json();
    const {
      requestId,
      supplierId,
      fechaCotizacion,
      validezHasta,
      plazoEntrega,
      fechaEntregaEstimada,
      condicionesPago,
      formaPago,
      garantia,
      moneda,
      observaciones,
      beneficios,
      adjuntos,
      items
    } = body;

    // Validaciones
    if (!requestId) {
      return NextResponse.json({ error: 'El pedido es requerido' }, { status: 400 });
    }

    if (!supplierId) {
      return NextResponse.json({ error: 'El proveedor es requerido' }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Debe agregar al menos un item' }, { status: 400 });
    }

    // Verificar que el pedido existe y pertenece a la empresa
    const pedido = await prisma.purchaseRequest.findFirst({
      where: { id: parseInt(requestId), companyId },
      select: { id: true, estado: true }
    });

    if (!pedido) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    // Calcular totales
    let subtotal = 0;
    const itemsConSubtotal = items.map((item: any) => {
      const cantidad = parseFloat(item.cantidad);
      const precio = parseFloat(item.precioUnitario);
      const descuento = parseFloat(item.descuento || '0');
      const itemSubtotal = cantidad * precio * (1 - descuento / 100);
      subtotal += itemSubtotal;

      return {
        ...item,
        cantidad,
        precioUnitario: precio,
        descuento,
        subtotal: itemSubtotal
      };
    });

    // IVA default 21%
    const tasaIva = 21;
    const impuestos = subtotal * (tasaIva / 100);
    const total = subtotal + impuestos;

    // Generar numero
    const numero = await generarNumeroCotizacion(companyId);

    // Crear cotizacion con items en transaccion
    // Usar SQL directo para evitar columnas que no existen en BD (pricesIncludeVat, vatRate, etc)
    const nuevaCotizacion = await prisma.$transaction(async (tx) => {
      const fechaCot = fechaCotizacion ? new Date(fechaCotizacion) : new Date();
      const fechaValidez = validezHasta ? new Date(validezHasta) : null;
      const plazo = plazoEntrega ? parseInt(plazoEntrega) : null;
      const fechaEntrega = fechaEntregaEstimada ? new Date(fechaEntregaEstimada) : null;

      // Insertar usando SQL directo para evitar columnas que no existen
      const insertResult = await tx.$queryRawUnsafe<{ id: number }[]>(`
        INSERT INTO purchase_quotations (
          numero, "requestId", "supplierId", estado, "fechaCotizacion",
          "validezHasta", "plazoEntrega", "fechaEntregaEstimada",
          "condicionesPago", "formaPago", garantia,
          subtotal, descuento, impuestos, total, moneda,
          observaciones, beneficios, adjuntos, "esSeleccionada",
          "companyId", "createdBy", "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, 'RECIBIDA', $4,
          $5, $6, $7,
          $8, $9, $10,
          $11, 0, $12, $13, $14,
          $15, $16, $17, false,
          $18, $19, NOW(), NOW()
        ) RETURNING id
      `,
        numero,
        parseInt(requestId),
        parseInt(supplierId),
        fechaCot,
        fechaValidez,
        plazo,
        fechaEntrega,
        condicionesPago || null,
        formaPago || null,
        garantia || null,
        subtotal,
        impuestos,
        total,
        moneda || 'ARS',
        observaciones || null,
        beneficios || null,
        adjuntos && Array.isArray(adjuntos) && adjuntos.length > 0 ? adjuntos : [],
        companyId,
        user!.id
      );

      const cotizacionId = insertResult[0].id;
      const cotizacion = { id: cotizacionId, numero };

      // Crear items usando SQL directo para evitar columnas que no existen (isSubstitute, etc)
      for (const item of itemsConSubtotal) {
        await tx.$executeRawUnsafe(`
          INSERT INTO purchase_quotation_items (
            "quotationId", "requestItemId", "supplierItemId",
            "codigoProveedor", descripcion, cantidad, unidad, "precioUnitario", descuento, subtotal, notas
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `,
          cotizacion.id,
          item.requestItemId ? parseInt(item.requestItemId) : null,
          item.supplierItemId ? parseInt(item.supplierItemId) : null,
          item.codigoProveedor || null,
          item.descripcion,
          item.cantidad,
          item.unidad || 'UN',
          item.precioUnitario,
          item.descuento,
          item.subtotal,
          item.notas || null
        );
      }

      // Actualizar estado del pedido a COTIZADA si no lo esta (usar SQL directo)
      if (!['COTIZADA', 'EN_APROBACION', 'APROBADA', 'EN_PROCESO'].includes(pedido.estado)) {
        await tx.$executeRawUnsafe(
          `UPDATE purchase_requests SET estado = 'COTIZADA', "updatedAt" = NOW() WHERE id = $1`,
          parseInt(requestId)
        );
      }

      return cotizacion;
    });

    // Crear comentario de sistema
    try {
      await prisma.purchaseComment.create({
        data: {
          entidad: 'request',
          entidadId: parseInt(requestId),
          tipo: 'SISTEMA',
          contenido: `Cotizacion ${numero} recibida por ${user!.name}`,
          companyId,
          userId: user!.id
        }
      });
    } catch (commentError) {
      console.warn('No se pudo crear comentario:', commentError);
    }

    // Obtener cotizacion completa
    const cotizacionCompleta = await prisma.purchaseQuotation.findUnique({
      where: { id: nuevaCotizacion.id },
      select: {
        id: true,
        numero: true,
        estado: true,
        total: true,
        supplier: { select: { id: true, name: true } },
        items: {
          select: {
            id: true,
            descripcion: true,
            cantidad: true,
            precioUnitario: true,
            subtotal: true
          }
        }
      }
    });

    return NextResponse.json(cotizacionCompleta, { status: 201 });
  } catch (error: any) {
    console.error('[cotizaciones] Error creating:', error);
    return NextResponse.json(
      { error: error.message || 'Error al crear la cotizacion' },
      { status: 500 }
    );
  }
}
