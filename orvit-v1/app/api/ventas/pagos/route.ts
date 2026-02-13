import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma, ClientPaymentStatus } from '@prisma/client';
import { z } from 'zod';
import { logSalesCreation } from '@/lib/ventas/audit-helper';
import { getViewMode, isExtendedMode, DOC_TYPE } from '@/lib/view-mode';
import { generatePaymentNumber } from '@/lib/ventas/document-number';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { createPaymentSchema } from '@/lib/ventas/validation-schemas';
import {
  getIdempotencyKey,
  withIdempotency,
  handleIdempotencyError,
  idempotencyHeaders,
  IdempotencyConflictError,
} from '@/lib/ventas/idempotency-helper';
import { createClientPayment, PaymentMedium } from '@/lib/ventas/payment-service';

export const dynamic = 'force-dynamic';

// GET - Listar pagos/cobranzas
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.PAGOS_VIEW);
    if (error) return error;

    const companyId = user!.companyId;

    // ViewMode - filtrar según modo activo
    const viewMode = getViewMode(request);
    const isExtended = viewMode === 'E';

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const estadoParam = searchParams.get('estado') || searchParams.get('status');
    const clienteId = searchParams.get('clienteId');
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');
    const search = searchParams.get('search');

    // Construir where base (sin ORs) - NO filtrar por estado si no es válido
    const baseConditions: Prisma.ClientPaymentWhereInput = {
      companyId,
      ...(estadoParam && ['PENDIENTE', 'CONFIRMADO', 'RECHAZADO', 'ANULADO'].includes(estadoParam) && {
        estado: estadoParam as ClientPaymentStatus
      }),
      ...(clienteId && { clientId: clienteId }),
      ...(fechaDesde && { fechaPago: { gte: new Date(fechaDesde) } }),
      ...(fechaHasta && { fechaPago: { lte: new Date(fechaHasta) } }),
    };

    // Construir AND conditions para evitar conflictos entre ORs
    const andConditions: Prisma.ClientPaymentWhereInput[] = [];

    // Search OR
    if (search) {
      andConditions.push({
        OR: [
          { numero: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { client: { legalName: { contains: search, mode: Prisma.QueryMode.insensitive } } },
          { client: { name: { contains: search, mode: Prisma.QueryMode.insensitive } } },
        ]
      });
    }

    // ViewMode: Standard muestra solo T1, Extended muestra todo (T1+T2)
    if (!isExtended) {
      andConditions.push({ docType: 'T1' });
    }

    // Construir where final
    const where: Prisma.ClientPaymentWhereInput = andConditions.length > 0
      ? { ...baseConditions, AND: andConditions }
      : baseConditions;

    const [pagos, total] = await Promise.all([
      prisma.clientPayment.findMany({
        where,
        include: {
          client: { select: { id: true, legalName: true } },
          allocations: {
            include: {
              invoice: { select: { id: true, numero: true, total: true } }
            }
          },
          cheques: true,
          createdByUser: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.clientPayment.count({ where })
    ]);

    return NextResponse.json({
      data: pagos,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Error fetching pagos:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
    return NextResponse.json({
      error: 'Error al obtener pagos',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST - Registrar cobro
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.PAGOS_CREATE);
    if (error) return error;

    const companyId = user!.companyId;

    // Get idempotency key (optional but recommended)
    const idempotencyKey = getIdempotencyKey(request);

    const body = await request.json();

    // Validate with Zod schema
    const validation = createPaymentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos de entrada inválidos', details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Determine docType
    let docTypeFromInvoice: 'T1' | 'T2' | null = null;
    if (data.aplicaciones && data.aplicaciones.length > 0) {
      const firstInvoice = await prisma.salesInvoice.findFirst({
        where: { id: data.aplicaciones[0].invoiceId, companyId },
        select: { docType: true }
      });
      if (firstInvoice?.docType) {
        docTypeFromInvoice = firstInvoice.docType as 'T1' | 'T2';
      }
    }
    const docType = docTypeFromInvoice || (isExtendedMode(request) ? DOC_TYPE.T2 : DOC_TYPE.T1);

    // Get default accounts for treasury integration
    // TODO: In Phase 2, frontend should send specific accountId per medio
    const defaultCashAccount = await prisma.cashAccount.findFirst({
      where: { companyId, isActive: true },
      select: { id: true },
    });
    const defaultBankAccount = await prisma.bankAccount.findFirst({
      where: { companyId, isActive: true },
      select: { id: true },
    });

    // Transform old format to new PaymentMedium[] format for payment-service
    const medios: PaymentMedium[] = [];

    if (data.efectivo > 0 && defaultCashAccount) {
      medios.push({
        tipo: 'EFECTIVO',
        monto: data.efectivo,
        accountId: defaultCashAccount.id,
        accountType: 'CASH',
      });
    }

    if (data.transferencia > 0 && defaultBankAccount) {
      medios.push({
        tipo: 'TRANSFERENCIA',
        monto: data.transferencia,
        accountId: defaultBankAccount.id,
        accountType: 'BANK',
        numeroComprobante: data.numeroOperacion || undefined,
      });
    }

    if (data.tarjetaCredito > 0 && defaultBankAccount) {
      medios.push({
        tipo: 'TARJETA_CREDITO',
        monto: data.tarjetaCredito,
        accountId: defaultBankAccount.id,
        accountType: 'BANK',
      });
    }

    if (data.tarjetaDebito > 0 && defaultBankAccount) {
      medios.push({
        tipo: 'TARJETA_DEBITO',
        monto: data.tarjetaDebito,
        accountId: defaultBankAccount.id,
        accountType: 'BANK',
      });
    }

    // Cheques
    if ((data.chequesTerceros > 0 || data.chequesPropios > 0) && data.cheques && data.cheques.length > 0) {
      for (const cheque of data.cheques) {
        const tipo = cheque.tipo === 'PROPIO' ? 'CHEQUE_PROPIO' : 'CHEQUE_TERCERO';
        medios.push({
          tipo,
          monto: cheque.importe,
          chequeData: {
            numero: cheque.numero,
            banco: cheque.banco,
            titular: cheque.titular,
            cuit: cheque.cuit,
            fechaEmision: cheque.fechaEmision ? new Date(cheque.fechaEmision) : new Date(),
            fechaVencimiento: cheque.fechaVencimiento ? new Date(cheque.fechaVencimiento) : new Date(),
            monto: cheque.importe,
            tipo: 'FISICO',
          },
        });
      }
    }

    if (data.otrosMedios > 0) {
      medios.push({
        tipo: 'OTRO',
        monto: data.otrosMedios,
      });
    }

    // Execute with idempotency support
    const idempotencyResult = await withIdempotency(
      idempotencyKey,
      companyId,
      'CREATE_PAYMENT',
      async () => {
        // Call payment-service (with treasury integration)
        const result = await createClientPayment({
          clientId: data.clientId,
          fechaPago: data.fechaPago ? new Date(data.fechaPago) : new Date(),
          medios,
          allocations: data.aplicaciones || [],
          retIVA: data.retIVA,
          retGanancias: data.retGanancias,
          retIngBrutos: data.retIngBrutos,
          notas: data.notas || undefined,
          docType,
          companyId,
          userId: user!.id,
          idempotencyKey,
        });

        // Fetch created payment for response
        const payment = await prisma.clientPayment.findUnique({
          where: { id: result.id },
          include: {
            client: { select: { id: true, legalName: true } },
            allocations: {
              include: {
                invoice: { select: { id: true, numero: true, total: true } }
              }
            },
            cheques: true,
            createdByUser: { select: { id: true, name: true } },
          },
        });

        // Auditoría
        try {
          await logSalesCreation({
            entidad: 'client_payment',
            entidadId: result.id,
            companyId,
            userId: user!.id,
            estadoInicial: 'CONFIRMADO',
            amount: result.totalPago,
            clientId: data.clientId,
            clientName: payment?.client.legalName || '',
            documentNumber: result.numero,
          });
        } catch (e) {
          console.error('Error en auditoría:', e);
        }

        return payment;
      },
      {
        entityType: 'ClientPayment',
        getEntityId: (result) => result.id,
      }
    );

    // Return response with idempotency headers
    return NextResponse.json(idempotencyResult.response, {
      status: idempotencyResult.isReplay ? 200 : 201,
      headers: idempotencyHeaders(idempotencyResult.idempotencyKey, idempotencyResult.isReplay),
    });
  } catch (error) {
    console.error('Error creating cobro:', error);

    // Handle idempotency conflict error
    const idempotencyError = handleIdempotencyError(error);
    if (idempotencyError) return idempotencyError;

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos de entrada inválidos', details: error.errors },
        { status: 400 }
      );
    }

    // Handle custom error messages from payment-service
    if (error instanceof Error) {
      if (error.message === 'Cliente no encontrado') {
        return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
      }
      if (error.message.startsWith('Factura') && error.message.includes('no encontrada')) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes('excede el saldo pendiente')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json({
      error: 'Error al crear cobro',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
