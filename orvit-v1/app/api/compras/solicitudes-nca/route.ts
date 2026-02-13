import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { getViewMode } from '@/lib/view-mode/get-mode';
import { applyViewMode } from '@/lib/view-mode/prisma-helper';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

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
  } catch (error) {
    return null;
  }
}

// Generar número de solicitud de NCA automático
async function generarNumeroSolicitud(companyId: number): Promise<string> {
  const año = new Date().getFullYear();
  const prefix = `SNCA-${año}-`;

  const ultimaSolicitud = await prisma.creditNoteRequest.findFirst({
    where: {
      companyId,
      numero: { startsWith: prefix }
    },
    orderBy: { numero: 'desc' },
    select: { numero: true }
  });

  if (ultimaSolicitud) {
    const ultimoNumero = parseInt(ultimaSolicitud.numero.replace(prefix, '')) || 0;
    return `${prefix}${String(ultimoNumero + 1).padStart(5, '0')}`;
  }

  return `${prefix}00001`;
}

// GET - Listar solicitudes de NCA
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const estado = searchParams.get('estado');
    const proveedorId = searchParams.get('proveedorId');
    const tipo = searchParams.get('tipo');
    const facturaId = searchParams.get('facturaId');
    const pendientes = searchParams.get('pendientes');

    // Get ViewMode from middleware header
    const viewMode = getViewMode(request);

    // Construir where con ViewMode filter
    const where: Prisma.CreditNoteRequestWhereInput = applyViewMode({
      companyId,
      ...(estado && { estado: estado as any }),
      ...(proveedorId && { proveedorId: parseInt(proveedorId) }),
      ...(tipo && { tipo: tipo as any }),
      ...(facturaId && { facturaId: parseInt(facturaId) }),
      ...(pendientes === 'true' && {
        estado: { in: ['SNCA_NUEVA', 'SNCA_ENVIADA', 'SNCA_EN_REVISION'] }
      }),
    }, viewMode);

    const [solicitudes, total] = await Promise.all([
      prisma.creditNoteRequest.findMany({
        where,
        include: {
          proveedor: {
            select: { id: true, name: true, cuit: true }
          },
          factura: {
            select: {
              id: true,
              numeroSerie: true,
              numeroFactura: true,
              total: true
            }
          },
          goodsReceipt: {
            select: { id: true, numero: true }
          },
          createdByUser: {
            select: { id: true, name: true }
          },
          _count: {
            select: {
              items: true,
              creditNotes: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.creditNoteRequest.count({ where })
    ]);

    return NextResponse.json({
      data: solicitudes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching solicitudes NCA:', error);
    return NextResponse.json(
      { error: 'Error al obtener las solicitudes de NCA' },
      { status: 500 }
    );
  }
}

// POST - Crear solicitud de NCA
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
      proveedorId,
      tipo,
      facturaId,
      goodsReceiptId,
      motivo,
      descripcion,
      evidencias,
      items,
      docType
    } = body;

    // Validaciones
    if (!proveedorId) {
      return NextResponse.json({ error: 'El proveedor es requerido' }, { status: 400 });
    }

    if (!tipo) {
      return NextResponse.json({ error: 'El tipo de solicitud es requerido' }, { status: 400 });
    }

    if (!motivo) {
      return NextResponse.json({ error: 'El motivo es requerido' }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Debe agregar al menos un item' }, { status: 400 });
    }

    // Calcular monto total
    let montoSolicitado = 0;
    for (const item of items) {
      const subtotal = parseFloat(item.cantidadSolicitada) * parseFloat(item.precioUnitario);
      montoSolicitado += subtotal;
    }

    // Generar número
    const numero = await generarNumeroSolicitud(companyId);

    // Crear solicitud con items en transacción
    const nuevaSolicitud = await prisma.$transaction(async (tx) => {
      const solicitud = await tx.creditNoteRequest.create({
        data: {
          numero,
          proveedorId: parseInt(proveedorId),
          estado: 'SNCA_NUEVA',
          tipo: tipo as any,
          facturaId: facturaId ? parseInt(facturaId) : null,
          goodsReceiptId: goodsReceiptId ? parseInt(goodsReceiptId) : null,
          montoSolicitado,
          motivo,
          descripcion: descripcion || null,
          evidencias: evidencias || [],
          docType: docType === 'T2' ? 'T2' : 'T1',
          companyId,
          createdBy: user.id
        }
      });

      // Crear items
      await tx.creditNoteRequestItem.createMany({
        data: items.map((item: any) => {
          const cantidadSolicitada = parseFloat(item.cantidadSolicitada);
          const precioUnitario = parseFloat(item.precioUnitario);

          return {
            requestId: solicitud.id,
            supplierItemId: item.supplierItemId ? parseInt(item.supplierItemId) : null,
            descripcion: item.descripcion || '',
            cantidadFacturada: parseFloat(item.cantidadFacturada || item.cantidadSolicitada),
            cantidadSolicitada,
            unidad: item.unidad || 'UN',
            precioUnitario,
            subtotal: cantidadSolicitada * precioUnitario,
            motivo: item.motivo || null
          };
        })
      });

      return solicitud;
    });

    // Obtener solicitud completa
    const solicitudCompleta = await prisma.creditNoteRequest.findUnique({
      where: { id: nuevaSolicitud.id },
      include: {
        proveedor: { select: { id: true, name: true } },
        factura: { select: { id: true, numeroSerie: true, numeroFactura: true } },
        goodsReceipt: { select: { id: true, numero: true } },
        items: {
          include: {
            supplierItem: { select: { id: true, nombre: true, unidad: true } }
          }
        }
      }
    });

    // Registrar auditoría
    await prisma.purchaseAuditLog.create({
      data: {
        entidad: 'credit_note_request',
        entidadId: nuevaSolicitud.id,
        accion: 'CREAR',
        datosNuevos: {
          numero,
          tipo,
          montoSolicitado,
          motivo
        },
        companyId,
        userId: user.id
      }
    });

    return NextResponse.json(solicitudCompleta, { status: 201 });
  } catch (error) {
    console.error('Error creating solicitud NCA:', error);
    return NextResponse.json(
      { error: 'Error al crear la solicitud de NCA' },
      { status: 500 }
    );
  }
}
