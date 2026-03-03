import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret
import { isT2AvailableForCompany } from '@/lib/view-mode/should-query-t2';
import { getT2Client } from '@/lib/prisma-t2';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Helper para obtener usuario desde JWT
async function getUserFromToken() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      include: {
        companies: {
          include: {
            company: true
          }
        }
      }
    });

    return user;
  } catch (error) {
    console.error('Error obteniendo usuario desde JWT:', error);
    return null;
  }
}

// GET /api/compras/proveedores/[id]/items - Obtener items de un proveedor
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const { id } = await params;
    const proveedorId = parseInt(id);
    const { searchParams } = new URL(request.url);

    // Parámetros de filtro y paginación
    const search = searchParams.get('search')?.toLowerCase() || '';
    const sortBy = searchParams.get('sortBy') || 'nombre';
    const sortDir = searchParams.get('sortDir') || 'asc';
    const variacion = searchParams.get('variacion'); // 'subio' | 'bajo' | 'alto'
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const historyLimit = parseInt(searchParams.get('historyLimit') || '20');
    const viewMode = searchParams.get('viewMode') || 'Standard'; // Standard = T1, Extended = T2 (all)

    // ViewMode: Standard = solo T1, Extended = T1 + T2 (todos)
    const isStandardMode = viewMode === 'Standard';

    // Verificar que el proveedor existe y pertenece a la empresa
    const proveedor = await prisma.suppliers.findFirst({
      where: {
        id: proveedorId,
        company_id: companyId,
      },
      select: { id: true }, // Solo necesitamos verificar existencia
    });

    if (!proveedor) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }

    // Construir where clause con búsqueda
    const whereClause: any = {
      supplierId: proveedorId,
      companyId: companyId,
      activo: true,
    };

    if (search) {
      whereClause.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { descripcion: { contains: search, mode: 'insensitive' } },
        { codigoProveedor: { contains: search, mode: 'insensitive' } },
        { supply: { name: { contains: search, mode: 'insensitive' } } },
        // Buscar también por descripcionItem en stockLocations (nombre usado en recepciones)
        { stockLocations: { some: { descripcionItem: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    // Determinar ordenamiento de Prisma
    let orderBy: any = { nombre: sortDir };
    if (sortBy === 'precioUnitario') {
      orderBy = { precioUnitario: sortDir };
    }

    // Obtener items del proveedor con historial de precios y stock
    const [items, totalCount] = await Promise.all([
      prisma.supplierItem.findMany({
        where: whereClause,
        include: {
          supply: {
            select: {
              id: true,
              name: true,
              unit_measure: true,
            }
          },
          tool: {
            select: {
              id: true,
              name: true,
              code: true,
              itemType: true,
              stockQuantity: true,
              minStockLevel: true,
            }
          },
          priceHistory: {
            where: isStandardMode ? {
              OR: [
                { comprobante: { docType: 'T1' } },
                { comprobante: { docType: null } },  // Legacy sin docType = T1
                { comprobanteId: null }              // Sin comprobante asociado
              ]
            } : undefined,
            orderBy: { fecha: 'desc' },
            take: historyLimit,
            select: {
              id: true,
              precioUnitario: true,
              fecha: true,
              comprobante: {
                select: {
                  id: true,
                  numeroSerie: true,
                  numeroFactura: true,
                  docType: true,
                }
              }
            }
          },
          stockLocations: {
            where: {
              warehouse: { isTransit: false }
            },
            select: {
              id: true,
              cantidad: true,
              cantidadReservada: true,
              stockMinimo: true,
              warehouseId: true,
              // Descripción real del item (de la última recepción)
              descripcionItem: true,
              codigoPropio: true,
              codigoProveedor: true,
              warehouse: {
                select: { codigo: true, nombre: true }
              }
            }
          }
        },
        orderBy,
        take: limit,
        skip: offset,
      }),
      prisma.supplierItem.count({ where: whereClause }),
    ]);

    // Obtener "en camino" para estos items (OC pendientes de recibir)
    const supplierItemIds = items.map(i => i.id);
    const enCaminoByItem = new Map<number, number>();

    if (supplierItemIds.length > 0) {
      const ocPendientes = await prisma.purchaseOrderItem.findMany({
        where: {
          supplierItemId: { in: supplierItemIds },
          purchaseOrder: {
            companyId,
            estado: { in: ['ENVIADA_PROVEEDOR', 'CONFIRMADA', 'PARCIALMENTE_RECIBIDA'] },
            // Filtrar por ViewMode: Standard = solo T1, Extended = todos
            ...(isStandardMode ? { docType: 'T1' } : {})
          }
        },
        select: {
          supplierItemId: true,
          cantidad: true,
          cantidadRecibida: true
        }
      });

      for (const item of ocPendientes) {
        const pendiente = Number(item.cantidad || 0) - Number(item.cantidadRecibida || 0);
        if (pendiente > 0) {
          const current = enCaminoByItem.get(item.supplierItemId) || 0;
          enCaminoByItem.set(item.supplierItemId, current + pendiente);
        }
      }
    }

    // --- Incluir compras T2 en el historial de precios (solo en Extended mode) ---
    const t2PriceMap = new Map<number, Array<{ precioUnitario: number; fecha: Date; comprobanteNum: string }>>();
    if (!isStandardMode && await isT2AvailableForCompany(companyId)) {
      try {
        const prismaT2 = getT2Client();
        const t2Items = await prismaT2.t2PurchaseReceiptItem.findMany({
          where: {
            supplierItemId: { in: supplierItemIds },
            receipt: {
              companyId,
              estado: { not: 'cancelado' },
            },
          },
          select: {
            supplierItemId: true,
            precioUnitario: true,
            receipt: {
              select: {
                id: true,
                numeroSerie: true,
                numeroFactura: true,
                fechaEmision: true,
              },
            },
          },
          orderBy: { receipt: { fechaEmision: 'desc' } },
        });

        for (const t2Item of t2Items) {
          const sid = t2Item.supplierItemId;
          if (!t2PriceMap.has(sid)) t2PriceMap.set(sid, []);
          t2PriceMap.get(sid)!.push({
            precioUnitario: Number(t2Item.precioUnitario),
            fecha: t2Item.receipt.fechaEmision,
            comprobanteNum: `T2-${t2Item.receipt.numeroSerie || ''}-${t2Item.receipt.numeroFactura || ''}`.replace(/^T2--/, 'T2-'),
          });
        }
      } catch (err) {
        console.error('[Items/T2] Error querying T2 price history:', err);
      }
    }

    // Procesar items para agregar información de variación y stock
    let itemsConVariacion = items.map(item => {
      // Merge T1 priceHistory con T2 data
      const t1Historial = (item.priceHistory || []).map(h => ({
        precioUnitario: Number(h.precioUnitario),
        fecha: h.fecha,
        source: 'T1' as const,
      }));
      const t2Historial = (t2PriceMap.get(item.id) || []).map(h => ({
        precioUnitario: h.precioUnitario,
        fecha: h.fecha,
        source: 'T2' as const,
      }));
      const historial = [...t1Historial, ...t2Historial].sort(
        (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
      );
      const ultimoPrecio = historial[0];
      const penultimoPrecio = historial[1];

      let variacionPorcentaje: number | null = null;
      let variacionAbsoluta: number | null = null;

      if (ultimoPrecio && penultimoPrecio) {
        const precioActual = Number(ultimoPrecio.precioUnitario);
        const precioAnterior = Number(penultimoPrecio.precioUnitario);
        if (precioAnterior > 0) {
          variacionPorcentaje = ((precioActual - precioAnterior) / precioAnterior) * 100;
          variacionAbsoluta = precioActual - precioAnterior;
        }
      }

      // Calcular stock consolidado de todas las ubicaciones (excluyendo IN_TRANSIT)
      const stockLocations = item.stockLocations || [];
      const stockActual = stockLocations.reduce((sum, loc) => sum + Number(loc.cantidad || 0), 0);
      const stockReservado = stockLocations.reduce((sum, loc) => sum + Number(loc.cantidadReservada || 0), 0);
      const stockDisponible = stockActual - stockReservado;
      const enCamino = enCaminoByItem.get(item.id) || 0;
      const stockMinimo = stockLocations.reduce((min, loc) => {
        const m = Number(loc.stockMinimo || 0);
        return m > 0 ? (min === 0 ? m : Math.min(min, m)) : min;
      }, 0);

      // Determinar estado de alerta
      let stockAlerta: 'sin_stock' | 'bajo_stock' | 'ok' | null = null;
      if (stockActual === 0 && stockMinimo > 0) {
        stockAlerta = 'sin_stock';
      } else if (stockDisponible + enCamino < stockMinimo && stockMinimo > 0) {
        stockAlerta = 'bajo_stock';
      } else if (stockMinimo > 0) {
        stockAlerta = 'ok';
      }

      return {
        ...item,
        ultimaCompra: ultimoPrecio?.fecha || null,
        precioHistorico: ultimoPrecio ? Number(ultimoPrecio.precioUnitario) : null,
        variacionPorcentaje,
        variacionAbsoluta,
        cantidadCompras: historial.length,
        // Stock info
        stockActual: Math.round(stockActual * 100) / 100,
        stockReservado: Math.round(stockReservado * 100) / 100,
        stockDisponible: Math.round(stockDisponible * 100) / 100,
        enCamino: Math.round(enCamino * 100) / 100,
        stockMinimo,
        stockAlerta,
      };
    });

    // Filtrar por variación (post-query porque requiere cálculo)
    if (variacion) {
      itemsConVariacion = itemsConVariacion.filter(item => {
        const v = item.variacionPorcentaje || 0;
        switch (variacion) {
          case 'subio': return v > 0;
          case 'bajo': return v < 0;
          case 'alto': return Math.abs(v) >= 10;
          default: return true;
        }
      });
    }

    // Ordenar por variación o última compra (post-query porque no son campos directos)
    if (sortBy === 'variacion') {
      itemsConVariacion.sort((a, b) => {
        const diff = (a.variacionPorcentaje || 0) - (b.variacionPorcentaje || 0);
        return sortDir === 'asc' ? diff : -diff;
      });
    } else if (sortBy === 'ultimaCompra') {
      itemsConVariacion.sort((a, b) => {
        const fechaA = a.ultimaCompra ? new Date(a.ultimaCompra).getTime() : 0;
        const fechaB = b.ultimaCompra ? new Date(b.ultimaCompra).getTime() : 0;
        const diff = fechaA - fechaB;
        return sortDir === 'asc' ? diff : -diff;
      });
    }

    return NextResponse.json(itemsConVariacion, {
      headers: {
        'X-Total-Count': totalCount.toString(),
      },
    });
  } catch (error) {
    console.error('Error fetching supplier items:', error);
    return NextResponse.json(
      { error: 'Error al obtener los items del proveedor' },
      { status: 500 }
    );
  }
}

// POST /api/compras/proveedores/[id]/items - Crear nuevo item para un proveedor
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const { id } = await params;
    const proveedorId = parseInt(id);
    const body = await request.json();
    const { nombre, descripcion, unidad, precioUnitario, supplyId, codigoProveedor, toolId, esGastoIndirecto, categoriaIndirecta, esServicio } = body;

    if (!nombre || !nombre.trim()) {
      return NextResponse.json(
        { error: 'El nombre es requerido' },
        { status: 400 }
      );
    }

    // Verificar que el proveedor existe y pertenece a la empresa
    const proveedor = await prisma.suppliers.findFirst({
      where: {
        id: proveedorId,
        company_id: companyId,
      },
    });

    if (!proveedor) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }

    // Validar supplyId si viene
    if (supplyId) {
      const existingSupply = await prisma.supplies.findFirst({
        where: { id: parseInt(supplyId), company_id: companyId },
      });
      if (!existingSupply) {
        return NextResponse.json({ error: 'Supply no encontrado' }, { status: 404 });
      }
    }

    // Validar toolId si viene (dirección B: vincular a Tool existente)
    if (toolId) {
      const tool = await prisma.tool.findFirst({
        where: { id: parseInt(toolId), companyId },
      });
      if (!tool) {
        return NextResponse.json({ error: 'Tool del pañol no encontrado' }, { status: 404 });
      }
    }

    // Todo en una transacción: Supply + SupplierItem + Tool auto-creado
    const result = await prisma.$transaction(async (tx) => {
      // Resolver supply: buscar existente por nombre (case-insensitive) o crear nuevo
      let resolvedSupplyId: number;
      if (supplyId) {
        resolvedSupplyId = parseInt(supplyId);
      } else {
        // Buscar supply existente con el mismo nombre en la misma empresa
        const existingSupply = await tx.supplies.findFirst({
          where: {
            name: { equals: nombre.trim(), mode: 'insensitive' },
            company_id: companyId,
            is_active: true,
          },
          select: { id: true },
        });

        if (existingSupply) {
          resolvedSupplyId = existingSupply.id;
        } else {
          const newSupply = await tx.supplies.create({
            data: {
              name: nombre.trim(),
              unit_measure: unidad || 'UN',
              company_id: companyId,
              is_active: true,
            },
          });
          resolvedSupplyId = newSupply.id;
        }
      }

      // Verificar duplicado (mismo supply + proveedor)
      const itemExistente = await tx.supplierItem.findFirst({
        where: { supplierId: proveedorId, supplyId: resolvedSupplyId, companyId },
      });
      if (itemExistente) {
        throw new Error('DUPLICATE_ITEM');
      }

      // Unidad final
      let unidadFinal = unidad;
      if (!unidadFinal) {
        const supplyData = await tx.supplies.findUnique({
          where: { id: resolvedSupplyId },
          select: { unit_measure: true }
        });
        unidadFinal = supplyData?.unit_measure || 'UN';
      }

      // Crear SupplierItem
      const nuevoItem = await tx.supplierItem.create({
        data: {
          supplierId: proveedorId,
          supplyId: resolvedSupplyId,
          nombre: nombre.trim(),
          descripcion: descripcion?.trim() || null,
          codigoProveedor: codigoProveedor?.trim() || null,
          unidad: unidadFinal,
          precioUnitario: precioUnitario ? parseFloat(precioUnitario) : null,
          toolId: toolId ? parseInt(toolId) : null,
          activo: true,
          companyId,
          esGastoIndirecto: esGastoIndirecto === true,
          categoriaIndirecta: categoriaIndirecta || null,
          esServicio: esServicio === true,
        },
      });

      // Auto-vincular o crear Tool en pañol si no es servicio y no se vinculó manualmente
      if (!toolId && esServicio !== true) {
        // Buscar Tool existente con nombre similar (case-insensitive)
        // Esto permite que "Filtro Aceite", "FILTRO ACEITE" y "filtro aceite" matcheen
        const existingTool = await tx.tool.findFirst({
          where: {
            name: { equals: nombre.trim(), mode: 'insensitive' },
            companyId
          },
          select: { id: true }
        });

        let resolvedToolId: number;
        if (existingTool) {
          // Reusar el Tool existente (mismo item, posiblemente de otro proveedor)
          resolvedToolId = existingTool.id;
        } else {
          // Crear Tool nuevo
          const autoTool = await tx.tool.create({
            data: {
              name: nombre.trim(),
              itemType: 'SPARE_PART',
              companyId,
              stockQuantity: 0,
              unit: unidadFinal || 'UN',
              code: codigoProveedor?.trim() || null,
              supplier: proveedor.name || null,
            }
          });
          resolvedToolId = autoTool.id;
        }

        await tx.supplierItem.update({
          where: { id: nuevoItem.id },
          data: { toolId: resolvedToolId }
        });
      }

      // Re-fetch con includes para la response (incluye el Tool auto-creado)
      return tx.supplierItem.findUnique({
        where: { id: nuevoItem.id },
        include: {
          supply: { select: { id: true, name: true, unit_measure: true } },
          tool: { select: { id: true, name: true, code: true, itemType: true } },
        },
      });
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    if (error?.message === 'DUPLICATE_ITEM') {
      return NextResponse.json(
        { error: 'Este item ya existe para este proveedor' },
        { status: 400 }
      );
    }
    console.error('Error creating supplier item:', error);
    const errorDetail = error?.message || error?.code || String(error);
    return NextResponse.json(
      { error: 'Error al crear el item', detail: errorDetail },
      { status: 500 }
    );
  }
}

