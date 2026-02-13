import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { getT2Client } from '@/lib/prisma-t2';
import { JWT_SECRET } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { logCreation } from '@/lib/compras/audit-helper';
import { getViewMode, isExtendedMode } from '@/lib/view-mode/get-mode';
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

// Generar número de NC/ND
async function generarNumero(companyId: number, tipo: string): Promise<string> {
  const año = new Date().getFullYear();
  const prefijo = tipo === 'NOTA_CREDITO' ? 'NC' : 'ND';
  const prefix = `${prefijo}-${año}-`;

  const ultimaNota = await prisma.creditDebitNote.findFirst({
    where: {
      companyId,
      tipo: tipo as any,
      numero: { startsWith: prefix }
    },
    orderBy: { numero: 'desc' },
    select: { numero: true }
  });

  if (ultimaNota) {
    const ultimoNumero = parseInt(ultimaNota.numero.replace(prefix, '')) || 0;
    return `${prefix}${String(ultimoNumero + 1).padStart(5, '0')}`;
  }

  return `${prefix}00001`;
}

// GET - Listar notas de crédito/débito
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
    const tipo = searchParams.get('tipo');
    const estado = searchParams.get('estado');
    const proveedorId = searchParams.get('proveedorId');
    const pendientes = searchParams.get('pendientes');
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');

    // Get ViewMode from middleware header
    const viewMode = getViewMode(request);

    // Construir where con ViewMode filter
    const where: Prisma.CreditDebitNoteWhereInput = applyViewMode({
      companyId,
      ...(tipo && { tipo: tipo as any }),
      ...(estado && { estado: estado as any }),
      ...(proveedorId && { proveedorId: parseInt(proveedorId) }),
      ...(pendientes === 'true' && {
        estado: { in: ['BORRADOR', 'EMITIDA'] },
        aplicada: false
      }),
      ...(fechaDesde && {
        fechaEmision: { gte: new Date(fechaDesde) }
      }),
      ...(fechaHasta && {
        fechaEmision: { lte: new Date(fechaHasta) }
      }),
    }, viewMode);

    const [notas, total] = await Promise.all([
      prisma.creditDebitNote.findMany({
        where,
        include: {
          proveedor: {
            select: { id: true, name: true, cuit: true }
          },
          factura: {
            select: { id: true, numeroSerie: true, numeroFactura: true, total: true }
          },
          purchaseReturn: {
            select: { id: true, numero: true, estado: true }
          },
          createdByUser: { select: { id: true, name: true } },
          _count: { select: { items: true } },
          // Include allocations to calculate available balance (saldo)
          creditAllocations: {
            select: { amount: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.creditDebitNote.count({ where })
    ]);

    // Calculate saldo (available balance) for each note
    const notasConSaldo = notas.map(nota => {
      const totalAplicado = nota.creditAllocations.reduce(
        (sum, alloc) => sum + Number(alloc.amount || 0),
        0
      );
      const saldo = Number(nota.total) - totalAplicado;
      // Remove creditAllocations from response (only needed for calculation)
      const { creditAllocations, ...notaSinAllocations } = nota;
      return {
        ...notaSinAllocations,
        saldo: Math.max(0, saldo) // Saldo disponible (nunca negativo)
      };
    });

    // Para NCs con docType='T2', buscar la factura en T2 (Prisma include solo busca en T1)
    const notasT2SinFactura = notasConSaldo.filter(
      n => n.docType === 'T2' && n.facturaId && !n.factura
    );

    if (notasT2SinFactura.length > 0) {
      try {
        const prismaT2 = getT2Client();
        const facturaIdsT2 = notasT2SinFactura.map(n => n.facturaId!);
        const facturasT2 = await prismaT2.t2PurchaseReceipt.findMany({
          where: { id: { in: facturaIdsT2 } },
          select: { id: true, numeroSerie: true, numeroFactura: true, total: true, tipo: true }
        });

        const facturasT2Map = new Map(facturasT2.map(f => [f.id, f]));

        // Agregar factura T2 a las notas correspondientes
        for (const nota of notasConSaldo) {
          if (nota.docType === 'T2' && nota.facturaId && !nota.factura) {
            const facturaT2 = facturasT2Map.get(nota.facturaId);
            if (facturaT2) {
              (nota as any).factura = {
                id: facturaT2.id,
                numeroSerie: facturaT2.numeroSerie,
                numeroFactura: facturaT2.numeroFactura,
                total: facturaT2.total,
                tipo: facturaT2.tipo // Incluir tipo para mostrar PPT
              };
            }
          }
        }
      } catch (error) {
        console.error('Error fetching T2 facturas for NCs:', error);
        // Continue without T2 factura data
      }
    }

    return NextResponse.json({
      data: notasConSaldo,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching notas:', error);
    return NextResponse.json(
      { error: 'Error al obtener las notas' },
      { status: 500 }
    );
  }
}

// POST - Crear nota de crédito/débito
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
    // Get ViewMode from middleware header
    const viewMode = getViewMode(request);

    const {
      tipo, // 'NOTA_CREDITO' o 'NOTA_DEBITO'
      tipoNca, // 'NCA_FALTANTE', 'NCA_DEVOLUCION', 'NCA_PRECIO', 'NCA_DESCUENTO', 'NCA_CALIDAD', 'NCA_OTRO'
      numeroSerie,
      proveedorId,
      facturaId,
      goodsReceiptId,
      purchaseReturnId, // OBLIGATORIO para NCA_DEVOLUCION
      fechaEmision,
      motivo,
      neto,
      iva21,
      iva105,
      iva27,
      cae,
      fechaVtoCae,
      notas,
      items,
      docType, // T1 o T2
    } = body;

    // Validar docType - T2 solo se puede crear en modo Extended
    const requestedDocType = docType === 'T2' ? 'T2' : 'T1';
    if (requestedDocType === 'T2' && !isExtendedMode(viewMode)) {
      return NextResponse.json(
        { error: 'No autorizado para crear este tipo de documento' },
        { status: 403 }
      );
    }

    // Validaciones
    if (!tipo || !['NOTA_CREDITO', 'NOTA_DEBITO'].includes(tipo)) {
      return NextResponse.json({ error: 'Tipo debe ser NOTA_CREDITO o NOTA_DEBITO' }, { status: 400 });
    }
    if (!proveedorId) {
      return NextResponse.json({ error: 'El proveedor es requerido' }, { status: 400 });
    }
    if (!motivo) {
      return NextResponse.json({ error: 'El motivo es requerido' }, { status: 400 });
    }
    if (!neto || parseFloat(neto) <= 0) {
      return NextResponse.json({ error: 'El monto neto es requerido' }, { status: 400 });
    }

    // Si hay factura de referencia, verificar que existe (en T1 o T2 según docType)
    if (facturaId) {
      let facturaEncontrada = false;

      if (requestedDocType === 'T2') {
        // Buscar en T2 (usa supplierId en lugar de proveedorId)
        const prismaT2 = getT2Client();
        const facturaT2 = await prismaT2.t2PurchaseReceipt.findFirst({
          where: {
            id: parseInt(facturaId),
            companyId,
            supplierId: parseInt(proveedorId)
          }
        });
        facturaEncontrada = !!facturaT2;
      } else {
        // Buscar en T1
        const factura = await prisma.purchaseReceipt.findFirst({
          where: { id: parseInt(facturaId), companyId, proveedorId: parseInt(proveedorId) }
        });
        facturaEncontrada = !!factura;
      }

      if (!facturaEncontrada) {
        return NextResponse.json({ error: 'Factura de referencia no encontrada' }, { status: 400 });
      }
    }

    // Determinar tipoNca validado (solo para NOTA_CREDITO)
    // T1 usa NCA_*, T2 usa NC_*
    const tiposT1 = ['NCA_FALTANTE', 'NCA_DEVOLUCION', 'NCA_PRECIO', 'NCA_DESCUENTO', 'NCA_CALIDAD', 'NCA_OTRO'];
    const tiposT2 = ['NC_FALTANTE', 'NC_DEVOLUCION', 'NC_PRECIO', 'NC_DESCUENTO', 'NC_CALIDAD', 'NC_OTRO'];

    let tipoNcaValido: string | null = null;
    if (tipo === 'NOTA_CREDITO') {
      if (requestedDocType === 'T2') {
        // T2: Solo acepta NC_* o convierte NCA_* a NC_*
        if (tiposT2.includes(tipoNca)) {
          tipoNcaValido = tipoNca;
        } else if (tiposT1.includes(tipoNca)) {
          // Convertir NCA_* a NC_* para T2
          tipoNcaValido = tipoNca.replace('NCA_', 'NC_');
        } else {
          tipoNcaValido = 'NC_OTRO';
        }
      } else {
        // T1: Solo acepta NCA_* o convierte NC_* a NCA_*
        if (tiposT1.includes(tipoNca)) {
          tipoNcaValido = tipoNca;
        } else if (tiposT2.includes(tipoNca)) {
          // Convertir NC_* a NCA_* para T1
          tipoNcaValido = tipoNca.replace('NC_', 'NCA_');
        } else {
          tipoNcaValido = 'NCA_OTRO';
        }
      }
    }

    // =============================================
    // VALIDACIONES PARA NCA_DEVOLUCION / NC_DEVOLUCION
    // =============================================
    let devolucionValidada = null;
    let valorDevolucion = 0;

    const esDevolucion = tipoNcaValido === 'NCA_DEVOLUCION' || tipoNcaValido === 'NC_DEVOLUCION';
    if (tipo === 'NOTA_CREDITO' && esDevolucion) {
      // Etiqueta dinámica para mensajes de error
      const ncLabel = requestedDocType === 'T2' ? 'NC' : 'NCA';

      // 1. purchaseReturnId es OBLIGATORIO
      if (!purchaseReturnId) {
        return NextResponse.json({
          error: `${ncLabel} por devolución requiere una devolución física vinculada (purchaseReturnId)`
        }, { status: 400 });
      }

      // 2. Verificar que existe
      const devolucion = await prisma.purchaseReturn.findUnique({
        where: { id: parseInt(purchaseReturnId) },
        include: {
          items: {
            include: {
              supplierItem: { select: { id: true, nombre: true } }
            }
          }
        }
      });

      if (!devolucion) {
        return NextResponse.json({ error: 'Devolución no encontrada' }, { status: 404 });
      }

      // Validar que pertenece a la misma empresa
      if (devolucion.companyId !== companyId) {
        return NextResponse.json({ error: 'Devolución no pertenece a esta empresa' }, { status: 400 });
      }

      // Validar que es del mismo proveedor
      if (devolucion.proveedorId !== parseInt(proveedorId)) {
        return NextResponse.json({
          error: 'La devolución corresponde a un proveedor diferente'
        }, { status: 400 });
      }

      // 3. Estado debe ser ENVIADA o posterior (la mercadería ya salió)
      const estadosValidos = ['ENVIADA', 'RECIBIDA_PROVEEDOR', 'EN_EVALUACION', 'RESUELTA'];
      if (!estadosValidos.includes(devolucion.estado)) {
        return NextResponse.json({
          error: `La devolución debe estar enviada antes de crear la ${ncLabel}. Estado actual: ${devolucion.estado}`
        }, { status: 400 });
      }

      // 4. NO DUPLICADOS (V1: 1 PR = 1 NC/NCA_DEVOLUCION)
      const ncaExistente = await prisma.creditDebitNote.findFirst({
        where: {
          purchaseReturnId: parseInt(purchaseReturnId),
          tipoNca: { in: ['NCA_DEVOLUCION', 'NC_DEVOLUCION'] },
          estado: { not: 'ANULADA' },
          companyId
        },
        select: { id: true, numero: true }
      });

      if (ncaExistente) {
        return NextResponse.json({
          error: `Ya existe una ${ncLabel} (${ncaExistente.numero}) vinculada a esta devolución. ` +
                 `Política V1: 1 devolución = 1 ${ncLabel}.`
        }, { status: 400 });
      }

      // 5. Calcular valor de referencia de la devolución para coherencia
      for (const item of devolucion.items) {
        // Usar precioReferencia del item de devolución
        const precio = item.precioReferencia;

        if (precio) {
          valorDevolucion += parseFloat(item.cantidad.toString()) * parseFloat(precio.toString());
        }
      }

      devolucionValidada = devolucion;
    }

    // Calcular total
    const netoDecimal = parseFloat(neto);
    const iva21Decimal = parseFloat(iva21 || '0');
    const iva105Decimal = parseFloat(iva105 || '0');
    const iva27Decimal = parseFloat(iva27 || '0');
    const total = netoDecimal + iva21Decimal + iva105Decimal + iva27Decimal;

    // Generar número
    const numero = await generarNumero(companyId, tipo);

    // Crear nota con items Y aplicarla automáticamente en una sola transacción
    const nuevaNota = await prisma.$transaction(async (tx) => {
      // 1. Crear la nota ya como APLICADA
      const nota = await tx.creditDebitNote.create({
        data: {
          tipo: tipo as any,
          tipoNca: tipoNcaValido as any || undefined, // Solo para NOTA_CREDITO
          numero,
          numeroSerie: numeroSerie || 'A',
          proveedorId: parseInt(proveedorId),
          facturaId: facturaId ? parseInt(facturaId) : null,
          goodsReceiptId: goodsReceiptId ? parseInt(goodsReceiptId) : null,
          purchaseReturnId: purchaseReturnId ? parseInt(purchaseReturnId) : null,
          fechaEmision: fechaEmision ? new Date(fechaEmision) : new Date(),
          motivo,
          neto: netoDecimal,
          iva21: iva21Decimal,
          iva105: iva105Decimal,
          iva27: iva27Decimal,
          total,
          estado: 'APLICADA', // Directamente aplicada
          aplicada: true,     // Marcada como aplicada
          aplicadaAt: new Date(),
          cae: cae || null,
          fechaVtoCae: fechaVtoCae ? new Date(fechaVtoCae) : null,
          notas: notas || null,
          docType: requestedDocType,  // T1 o T2 según el modo
          companyId,
          createdBy: user.id
        }
      });

      // 2. Crear items si existen
      if (items && Array.isArray(items) && items.length > 0) {
        await tx.creditDebitNoteItem.createMany({
          data: items.map((item: any) => ({
            noteId: nota.id,
            supplierItemId: item.supplierItemId ? parseInt(item.supplierItemId) : null,
            descripcion: item.descripcion || '',
            cantidad: parseFloat(item.cantidad || '1'),
            unidad: item.unidad || 'UN',
            precioUnitario: parseFloat(item.precioUnitario || '0'),
            subtotal: parseFloat(item.subtotal || '0')
          }))
        });
      }

      // 3. Crear movimiento en cuenta corriente automáticamente
      // NCA → HABER (reduce deuda), NDA → DEBE (aumenta deuda)
      const tipoMovimiento = tipo === 'NOTA_CREDITO' ? 'NC' : 'ND';
      await tx.supplierAccountMovement.create({
        data: {
          supplierId: parseInt(proveedorId),
          tipo: tipoMovimiento,
          notaCreditoDebitoId: nota.id,
          debe: tipo === 'NOTA_DEBITO' ? total : 0,
          haber: tipo === 'NOTA_CREDITO' ? total : 0,
          saldoMovimiento: 0, // Se recalcula después si es necesario
          fecha: new Date(),
          descripcion: `${tipo === 'NOTA_CREDITO' ? 'NC' : 'ND'} ${numero} - ${motivo}`,
          comprobante: numero,
          docType: requestedDocType,
          companyId,
        }
      });

      // 4. Si es NCA_DEVOLUCION, actualizar PurchaseReturn a RESUELTA y vincular creditNoteId
      if ((tipoNcaValido === 'NCA_DEVOLUCION' || tipoNcaValido === 'NC_DEVOLUCION') && purchaseReturnId) {
        await tx.purchaseReturn.update({
          where: { id: parseInt(purchaseReturnId) },
          data: {
            estado: 'RESUELTA',
            fechaResolucion: new Date(),
            resolucion: `NCA aplicada: ${numero}`,
            creditNoteId: nota.id, // Link the NCA to the devolucion
          }
        });
      }

      return nota;
    });

    // Obtener nota completa
    const notaCompleta = await prisma.creditDebitNote.findUnique({
      where: { id: nuevaNota.id },
      include: {
        proveedor: { select: { id: true, name: true } },
        factura: { select: { id: true, numeroSerie: true, numeroFactura: true } },
        purchaseReturn: {
          select: { id: true, numero: true, estado: true }
        },
        items: true
      }
    });

    // Registrar auditoría (ya aplicada automáticamente)
    await logCreation({
      entidad: 'credit_debit_note',
      entidadId: nuevaNota.id,
      companyId,
      userId: user.id,
      estadoInicial: 'APLICADA',
      amount: total,
    });

    return NextResponse.json(notaCompleta, { status: 201 });
  } catch (error) {
    console.error('Error creating nota:', error);
    return NextResponse.json(
      { error: 'Error al crear la nota' },
      { status: 500 }
    );
  }
}
