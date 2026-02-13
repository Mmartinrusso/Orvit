import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { getViewMode } from '@/lib/view-mode/get-mode';
import { MODE } from '@/lib/view-mode/types';
import { invalidarCacheStock } from '@/lib/compras/cache';

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
  } catch {
    return null;
  }
}

// Generar número de devolución
async function generarNumero(companyId: number): Promise<string> {
  const año = new Date().getFullYear();
  const prefix = `DEV-${año}-`;

  const ultimaDev = await prisma.purchaseReturn.findFirst({
    where: {
      companyId,
      numero: { startsWith: prefix }
    },
    orderBy: { numero: 'desc' },
    select: { numero: true }
  });

  if (ultimaDev) {
    const ultimoNumero = parseInt(ultimaDev.numero.replace(prefix, '')) || 0;
    return `${prefix}${String(ultimoNumero + 1).padStart(5, '0')}`;
  }

  return `${prefix}00001`;
}

// GET - Listar devoluciones
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
    const pendientes = searchParams.get('pendientes');
    const sinNca = searchParams.get('sinNca');

    // ViewMode: Standard (S) = solo T1, Extended (E) = todos
    const viewMode = getViewMode(request);
    const docTypeFilter = viewMode === MODE.STANDARD
      ? { OR: [{ docType: 'T1' }, { docType: null }] }
      : {};

    const where: Prisma.PurchaseReturnWhereInput = {
      companyId,
      ...docTypeFilter,
      ...(estado && { estado: estado as any }),
      ...(proveedorId && { proveedorId: parseInt(proveedorId) }),
      ...(tipo && { tipo: tipo as any }),
      ...(pendientes === 'true' && {
        estado: { in: ['BORRADOR', 'SOLICITADA', 'APROBADA_PROVEEDOR', 'ENVIADA', 'RECIBIDA_PROVEEDOR'] }
      }),
      // Filter for devoluciones without NCA (creditNoteId is null and in valid states for NCA)
      ...(sinNca === 'true' && {
        creditNoteId: null,
        estado: { in: ['ENVIADA', 'RECIBIDA_PROVEEDOR', 'EN_EVALUACION'] },
      }),
    };

    // Build include object - add items when sinNca=true for NCA selection
    const includeConfig: any = {
      proveedor: { select: { id: true, name: true, cuit: true } },
      warehouse: { select: { id: true, codigo: true, nombre: true } },
      goodsReceipt: { select: { id: true, numero: true } },
      factura: { select: { id: true, numeroSerie: true, numeroFactura: true } },
      createdByUser: { select: { id: true, name: true } },
      _count: { select: { items: true, creditNotes: true, stockMovements: true } },
    };

    // Include items when fetching for NCA selection (sinNca=true)
    if (sinNca === 'true') {
      includeConfig.items = {
        select: {
          id: true,
          supplierItemId: true,
          descripcion: true,
          cantidad: true,
          unidad: true,
          precioReferencia: true,
        }
      };
    }

    const [devoluciones, total] = await Promise.all([
      prisma.purchaseReturn.findMany({
        where,
        include: includeConfig,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.purchaseReturn.count({ where })
    ]);

    return NextResponse.json({
      data: devoluciones,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching devoluciones:', error);
    return NextResponse.json(
      { error: 'Error al obtener las devoluciones' },
      { status: 500 }
    );
  }
}

// POST - Crear devolución
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
      goodsReceiptId,
      facturaId, // Factura origen (opcional)
      warehouseId,
      tipo, // DEFECTO, EXCESO, ERROR_PEDIDO, GARANTIA, OTRO
      motivo,
      descripcion,
      evidenciaProblema,
      docType: requestedDocType, // T1 o T2 (opcional, se hereda del documento origen)
      items, // [{ supplierItemId, cantidad, unidad, descripcion, motivo, goodsReceiptItemId, precioReferencia }]
    } = body;

    // Validaciones
    if (!proveedorId) {
      return NextResponse.json({ error: 'El proveedor es requerido' }, { status: 400 });
    }
    if (!tipo || !['DEFECTO', 'EXCESO', 'ERROR_PEDIDO', 'GARANTIA', 'OTRO'].includes(tipo)) {
      return NextResponse.json({ error: 'Tipo de devolución inválido' }, { status: 400 });
    }
    if (!motivo) {
      return NextResponse.json({ error: 'El motivo es requerido' }, { status: 400 });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Debe incluir al menos un item' }, { status: 400 });
    }

    // Determinar docType - heredar del documento origen o usar el enviado
    let docType = requestedDocType || 'T1';

    // Si hay goodsReceiptId, verificar que existe y es del mismo proveedor, y heredar docType
    if (goodsReceiptId) {
      const gr = await prisma.goodsReceipt.findFirst({
        where: { id: parseInt(goodsReceiptId), companyId, supplierId: parseInt(proveedorId) },
        select: { id: true, docType: true }
      });
      if (!gr) {
        return NextResponse.json({ error: 'Recepción no encontrada o no corresponde al proveedor' }, { status: 400 });
      }
      // Heredar docType del remito
      if (gr.docType) {
        docType = gr.docType;
      }
    }

    // Si hay facturaId, heredar docType de la factura
    if (facturaId) {
      const factura = await prisma.purchaseReceipt.findFirst({
        where: { id: parseInt(facturaId), companyId, proveedorId: parseInt(proveedorId) },
        select: { id: true, docType: true }
      });
      if (factura?.docType) {
        docType = factura.docType;
      }
    }

    // Generar número
    const numero = await generarNumero(companyId);

    // Validar que hay warehouseId (requerido para mover stock)
    if (!warehouseId) {
      return NextResponse.json({ error: 'El depósito es requerido para la devolución' }, { status: 400 });
    }

    const warehouseIdNum = parseInt(warehouseId);

    // Verificar que el depósito existe
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: warehouseIdNum, companyId, isActive: true },
      select: { id: true, codigo: true, nombre: true }
    });

    if (!warehouse) {
      return NextResponse.json({ error: 'Depósito no encontrado o inactivo' }, { status: 400 });
    }

    // Crear devolución con items Y mover stock automáticamente (estado ENVIADA)
    const nuevaDevolucion = await prisma.$transaction(async (tx) => {
      // 1. Crear la devolución directamente como ENVIADA
      const devolucion = await tx.purchaseReturn.create({
        data: {
          numero,
          proveedorId: parseInt(proveedorId),
          goodsReceiptId: goodsReceiptId ? parseInt(goodsReceiptId) : null,
          facturaId: facturaId ? parseInt(facturaId) : null,
          warehouseId: warehouseIdNum,
          estado: 'ENVIADA', // Directamente ENVIADA
          stockMovementCreated: true, // Flag de que ya se movió stock
          tipo: tipo as any,
          fechaSolicitud: new Date(),
          fechaEnvio: new Date(), // Fecha de envío = ahora
          motivo,
          descripcion: descripcion || null,
          evidenciaProblema: evidenciaProblema || null,
          docType, // T1 o T2 heredado del documento origen
          companyId,
          createdBy: user.id
        }
      });

      // 2. Crear items (solo items con supplierItemId válido)
      const validItems = items.filter((item: any) => {
        const supplierItemId = parseInt(item.supplierItemId);
        return supplierItemId && supplierItemId > 0;
      });

      if (validItems.length === 0) {
        throw new Error('No hay items válidos para devolver. Los items deben tener un producto vinculado.');
      }

      const itemsCreados = await Promise.all(
        validItems.map(async (item: any) => {
          return tx.purchaseReturnItem.create({
            data: {
              returnId: devolucion.id,
              supplierItemId: parseInt(item.supplierItemId),
              descripcion: item.descripcion || '',
              cantidad: parseFloat(item.cantidad),
              unidad: item.unidad || 'UN',
              motivo: item.motivo || null,
              estado: 'ACEPTADO', // Ya devuelto/aceptado
              goodsReceiptItemId: item.goodsReceiptItemId ? parseInt(item.goodsReceiptItemId) : null,
              precioReferencia: item.precioReferencia ? parseFloat(item.precioReferencia) : null,
              fuentePrecio: item.precioReferencia ? (item.goodsReceiptItemId ? 'GR_ITEM' : 'MANUAL') : null,
            },
            include: {
              supplierItem: { select: { id: true, nombre: true, unidad: true, codigoProveedor: true } }
            }
          });
        })
      );

      // 3. Validar stock y crear movimientos de SALIDA
      for (const item of itemsCreados) {
        const cantidad = new Decimal(item.cantidad);

        // Obtener stock actual en el depósito
        let stockLocation = await tx.stockLocation.findUnique({
          where: {
            warehouseId_supplierItemId: {
              warehouseId: warehouseIdNum,
              supplierItemId: item.supplierItemId
            }
          }
        });

        const stockDisponible = stockLocation?.cantidad || new Decimal(0);

        // Validar stock suficiente
        if (new Decimal(stockDisponible).lt(cantidad)) {
          throw new Error(
            `Stock insuficiente para "${item.supplierItem?.nombre || item.descripcion}". ` +
            `Disponible: ${stockDisponible}, Requerido: ${cantidad}`
          );
        }

        const cantidadAnterior = stockLocation?.cantidad || new Decimal(0);
        const cantidadPosterior = new Decimal(cantidadAnterior).sub(cantidad);

        // Crear movimiento de salida
        await tx.stockMovement.create({
          data: {
            tipo: 'SALIDA_DEVOLUCION',
            cantidad,
            cantidadAnterior,
            cantidadPosterior,
            costoUnitario: item.precioReferencia || undefined,
            costoTotal: item.precioReferencia
              ? new Decimal(item.precioReferencia.toString()).mul(cantidad)
              : undefined,
            supplierItemId: item.supplierItemId,
            warehouseId: warehouseIdNum,
            purchaseReturnId: devolucion.id,
            codigoProveedor: item.supplierItem?.codigoProveedor || null,
            descripcionItem: item.descripcion || item.supplierItem?.nombre || null,
            motivo: `Devolución ${devolucion.numero}`,
            sourceNumber: devolucion.numero,
            notas: `Creado por ${user.name}`,
            docType: docType as any,
            companyId,
            createdBy: user.id
          }
        });

        // Actualizar o crear StockLocation
        if (stockLocation) {
          await tx.stockLocation.update({
            where: { id: stockLocation.id },
            data: { cantidad: cantidadPosterior }
          });
        } else {
          // Si no existe stock location, crear con cantidad negativa (caso raro pero posible)
          await tx.stockLocation.create({
            data: {
              warehouseId: warehouseIdNum,
              supplierItemId: item.supplierItemId,
              cantidad: cantidadPosterior,
              cantidadReservada: 0,
              companyId
            }
          });
        }
      }

      return devolucion;
    });

    // Invalidar caché de stock porque se actualizó
    invalidarCacheStock(companyId);

    // Obtener devolución completa con movimientos de stock
    const devolucionCompleta = await prisma.purchaseReturn.findUnique({
      where: { id: nuevaDevolucion.id },
      include: {
        proveedor: { select: { id: true, name: true } },
        warehouse: { select: { id: true, codigo: true, nombre: true } },
        goodsReceipt: { select: { id: true, numero: true } },
        items: {
          include: {
            supplierItem: { select: { id: true, nombre: true, unidad: true } }
          }
        },
        stockMovements: {
          where: { tipo: 'SALIDA_DEVOLUCION' },
          select: {
            id: true,
            tipo: true,
            cantidad: true,
            cantidadAnterior: true,
            cantidadPosterior: true,
            createdAt: true
          }
        }
      }
    });

    // Registrar auditoría
    await prisma.purchaseAuditLog.create({
      data: {
        entidad: 'purchase_return',
        entidadId: nuevaDevolucion.id,
        accion: 'CREAR',
        datosNuevos: {
          numero,
          estado: 'ENVIADA',
          stockMovementCreated: true,
          tipo,
          docType,
          itemsCount: items.length,
          movimientosStock: items.length
        },
        companyId,
        userId: user.id,
        docType
      }
    });

    return NextResponse.json({
      ...devolucionCompleta,
      message: `Devolución creada y stock descontado. ${items.length} movimiento(s) de stock creado(s).`
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating devolucion:', error);

    // Si el error es de stock insuficiente, devolver 400 con mensaje claro
    if (error.message?.includes('Stock insuficiente')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Error al crear la devolución' },
      { status: 500 }
    );
  }
}
